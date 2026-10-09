import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { createRelationship } from '../src/systems/relationship.js';
import {
  indexEvents,
  involvesPlayer,
  processRelationshipEvents,
  processPlayerEvents,
  resolveDecision,
  MAX_PLAYER_EVENTS_PER_PERIOD,
} from '../src/systems/events.js';
import { loadEvents } from '../src/systems/eventsLoader.js';

const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));

// Only the divorce pair, so these tests stay about divorce and don't need people.
function loadDivorceEvents() {
  const { divorce, choose_who_to_live_with } = loadEvents(EVENTS_DIR);
  return { divorce, choose_who_to_live_with };
}

function buildFamily({ marriageAffinity }) {
  const marriage = createRelationship({
    id: 'r_marriage',
    roles: { p_mother: 'wife', p_father: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: marriageAffinity,
    since: 0,
  });
  const motherChild = createRelationship({
    id: 'r_mother_child',
    roles: { p_mother: 'mother', p_player: 'son' },
    type: 'family',
    affinity: { p_mother: 80, p_player: 75 },
    since: 0,
  });
  const fatherChild = createRelationship({
    id: 'r_father_child',
    roles: { p_father: 'father', p_player: 'son' },
    type: 'family',
    affinity: { p_father: 80, p_player: 75 },
    since: 0,
  });
  return { marriage, motherChild, fatherChild, relationshipsById: { [marriage.id]: marriage, [motherChild.id]: motherChild, [fatherChild.id]: fatherChild } };
}

test('loadEvents loads both fixture events by id', () => {
  const eventsById = loadEvents(EVENTS_DIR);
  assert.ok(eventsById.divorce);
  assert.ok(eventsById.choose_who_to_live_with);
  assert.equal(eventsById.divorce.subject, 'relationship');
  assert.equal(eventsById.choose_who_to_live_with.subject, 'player');
});

test('involvesPlayer is true when the player is a direct participant', () => {
  const { motherChild, relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 50, p_father: 50 } });
  assert.equal(involvesPlayer(motherChild, 'p_player', relationshipsById), true);
});

test('involvesPlayer is true when a participant is connected to the player through another relationship', () => {
  const { marriage, relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 50, p_father: 50 } });
  assert.equal(involvesPlayer(marriage, 'p_player', relationshipsById), true);
});

test('involvesPlayer is false when nobody is connected to the player', () => {
  const marriage = createRelationship({
    id: 'r_other',
    roles: { p_stranger_a: 'wife', p_stranger_b: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: { p_stranger_a: 50, p_stranger_b: 50 },
    since: 0,
  });
  assert.equal(involvesPlayer(marriage, 'p_player', { [marriage.id]: marriage }), false);
});

test('processRelationshipEvents does not fire divorce above the affinity threshold', () => {
  const eventsById = loadDivorceEvents();
  const { relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 80, p_father: 80 } });
  const forcedFireRng = { chance: () => true, nextInt: () => 0 };

  const result = processRelationshipEvents(eventsById, relationshipsById, {
    currentMonthIndex: 100,
    step: 12,
    rng: forcedFireRng,
    playerId: 'p_player',
  });

  assert.deepEqual(result.fired, []);
});

test('processRelationshipEvents fires divorce and raises a pending decision when the player is connected', () => {
  const eventsById = loadDivorceEvents();
  const { marriage, relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 10, p_father: 10 } });
  const forcedFireRng = { chance: () => true, nextInt: () => 0 };

  const result = processRelationshipEvents(eventsById, relationshipsById, {
    currentMonthIndex: 100,
    step: 12,
    rng: forcedFireRng,
    playerId: 'p_player',
  });

  assert.deepEqual(result.fired, [{ eventId: 'divorce', relationshipId: marriage.id }]);
  assert.equal(result.relationshipsById[marriage.id].state, 'divorced');
  assert.equal(result.pendingDecisions.length, 1);
  assert.equal(result.pendingDecisions[0].trigger, 'choose_who_to_live_with');
});

test('resolveDecision applies the chosen option to the correct parent relationships, not the marriage', () => {
  const eventsById = loadDivorceEvents();
  const { marriage, motherChild, fatherChild, relationshipsById } = buildFamily({
    marriageAffinity: { p_mother: 10, p_father: 10 },
  });
  const forcedFireRng = { chance: () => true, nextInt: () => 0 }; // picks option 0: live_with_mother

  const fireResult = processRelationshipEvents(eventsById, relationshipsById, {
    currentMonthIndex: 100,
    step: 12,
    rng: forcedFireRng,
    playerId: 'p_player',
  });

  const decision = fireResult.pendingDecisions[0];
  const decisionEvent = eventsById[decision.trigger];
  const { optionId, relationshipsById: afterDecision } = resolveDecision(decisionEvent, decision.firingRelationship, {
    rng: forcedFireRng,
    playerId: 'p_player',
    relationshipsById: fireResult.relationshipsById,
  });

  assert.equal(optionId, 'live_with_mother');
  assert.equal(afterDecision[motherChild.id].affinity.p_mother, 85);
  assert.equal(afterDecision[motherChild.id].affinity.p_player, 80);
  assert.equal(afterDecision[fatherChild.id].affinity.p_father, 75);
  assert.equal(afterDecision[fatherChild.id].affinity.p_player, 70);
  assert.equal(afterDecision[marriage.id].state, 'divorced');
  assert.equal(afterDecision[marriage.id].affinity.p_mother, 10);
});

test('the full event + decision flow is deterministic for a fixed seed', () => {
  const eventsById = loadDivorceEvents();

  function run(seed) {
    const rng = createRng(seed);
    const { marriage, relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 15, p_father: 15 } });
    const fireResult = processRelationshipEvents(eventsById, relationshipsById, {
      currentMonthIndex: 200,
      step: 12,
      rng,
      playerId: 'p_player',
    });

    if (fireResult.pendingDecisions.length === 0) {
      return { fired: fireResult.fired, relationshipsById: fireResult.relationshipsById };
    }

    const decision = fireResult.pendingDecisions[0];
    const decisionEvent = eventsById[decision.trigger];
    const { optionId, relationshipsById: afterDecision } = resolveDecision(decisionEvent, decision.firingRelationship, {
      rng,
      playerId: 'p_player',
      relationshipsById: fireResult.relationshipsById,
    });

    return { fired: fireResult.fired, optionId, relationshipsById: afterDecision };
  }

  assert.deepEqual(run(123), run(123));
});

test('indexEvents builds a map by id from an in-memory array (no fs)', () => {
  const eventsById = indexEvents([{ id: 'divorce', subject: 'relationship' }, { id: 'choose_who_to_live_with', subject: 'player' }]);
  assert.deepEqual(Object.keys(eventsById).sort(), ['choose_who_to_live_with', 'divorce']);
});

test('resolveDecision honors an explicit optionId over the rng pick', () => {
  const { marriage, motherChild, fatherChild, relationshipsById } = buildFamily({
    marriageAffinity: { p_mother: 10, p_father: 10 },
  });
  const decisionEvent = loadEvents(EVENTS_DIR).choose_who_to_live_with;
  // nextInt(0) would pick option 0 (live_with_mother) if optionId were ignored.
  const rngThatWouldPickMother = { nextInt: () => 0 };

  const { optionId, relationshipsById: afterDecision } = resolveDecision(decisionEvent, marriage, {
    rng: rngThatWouldPickMother,
    playerId: 'p_player',
    relationshipsById,
    optionId: 'live_with_father',
  });

  assert.equal(optionId, 'live_with_father');
  assert.equal(afterDecision[fatherChild.id].affinity.p_father, 85);
  assert.equal(afterDecision[motherChild.id].affinity.p_mother, 75);
});

test('resolveDecision throws on an unknown optionId', () => {
  const { marriage, relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 10, p_father: 10 } });
  const decisionEvent = loadEvents(EVENTS_DIR).choose_who_to_live_with;

  assert.throws(() =>
    resolveDecision(decisionEvent, marriage, {
      rng: { nextInt: () => 0 },
      playerId: 'p_player',
      relationshipsById,
      optionId: 'not_a_real_option',
    }),
  );
});

test('resolveDecision keeps people changes made by stat effects', () => {
  const { relationshipsById } = buildFamily({ marriageAffinity: { p_mother: 50, p_father: 50 } });
  const peopleById = { p_player: { id: 'p_player', money: 0, stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 } } };
  const decisionEvent = {
    id: 'test_event',
    subject: 'player',
    options: [{ id: 'cry', effects: [{ op: 'stat', target: 'player', stat: 'happiness', delta: -4 }] }],
  };

  const result = resolveDecision(decisionEvent, null, { rng: { nextInt: () => 0 }, playerId: 'p_player', relationshipsById, peopleById });

  assert.equal(result.optionId, 'cry');
  assert.equal(result.peopleById.p_player.stats.happiness, 46);
});

const PLAYER_EVENTS = indexEvents([
  {
    id: 'cry',
    subject: 'player',
    conditions: { minAge: 0, maxAge: 2 },
    yearlyChance: 0.5,
    cooldownMonths: 12,
    options: [{ id: 'loud', effects: [{ op: 'stat', target: 'player', stat: 'happiness', delta: -2 }] }],
  },
  {
    id: 'tooth',
    subject: 'player',
    conditions: { minAge: 0, maxAge: 2 },
    yearlyChance: 0.5,
    effects: [{ op: 'stat', target: 'player', stat: 'health', delta: -3 }],
  },
  {
    id: 'exam',
    subject: 'player',
    conditions: { minAge: 12 },
    yearlyChance: 0.9,
    options: [{ id: 'study', effects: [] }],
  },
  { id: 'world_only', subject: 'player', options: [{ id: 'x', effects: [] }] },
]);

function playerArgs(overrides = {}) {
  const player = { id: 'p_player', birth: 0, money: 0, stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 } };
  return {
    player,
    peopleById: { p_player: player },
    relationshipsById: {},
    currentMonthIndex: 12,
    step: 12,
    rng: createRng(1),
    ...overrides,
  };
}

test('processPlayerEvents applies effects of events without options and queues events with options', () => {
  const result = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: { chance: () => true, nextInt: () => 0, next: () => 0 } }));

  assert.deepEqual(result.fired.map((f) => f.eventId).sort(), ['cry', 'tooth']);
  assert.equal(result.peopleById.p_player.stats.health, 47);
  assert.deepEqual(result.pendingDecisions, [{ trigger: 'cry', firingRelationship: null }]);
});

test('processPlayerEvents respects age conditions and never rolls world-only decisions', () => {
  const result = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: { chance: () => true, nextInt: () => 0, next: () => 0 } }));
  const ids = result.fired.map((f) => f.eventId);
  assert.ok(!ids.includes('exam'));
  assert.ok(!ids.includes('world_only'));
});

test('processPlayerEvents forces one decision when nothing rolled and none is pending', () => {
  const neverRng = { chance: () => false, nextInt: () => 0, next: () => 0 };
  const forced = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: neverRng }));
  assert.deepEqual(forced.pendingDecisions, [{ trigger: 'cry', firingRelationship: null }]);

  const alreadyDeciding = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: neverRng, hasDecision: true }));
  assert.deepEqual(alreadyDeciding.pendingDecisions, []);
});

test('processPlayerEvents skips events on cooldown, but the forced decision still happens', () => {
  const firedEvents = [{ eventId: 'cry', month: 6 }];
  const alwaysRng = { chance: () => true, nextInt: () => 0, next: () => 0 };

  const rolled = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: alwaysRng, firedEvents, hasDecision: true }));
  assert.deepEqual(rolled.fired.map((f) => f.eventId), ['tooth']);

  const forced = processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: { ...alwaysRng, chance: () => false }, firedEvents }));
  assert.deepEqual(forced.pendingDecisions.map((d) => d.trigger), ['cry']);
});

test('processPlayerEvents caps player events per period', () => {
  const many = indexEvents(
    Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, subject: 'player', yearlyChance: 1, effects: [] })),
  );
  const result = processPlayerEvents(many, playerArgs());
  assert.equal(result.fired.length, MAX_PLAYER_EVENTS_PER_PERIOD);
});

test('processPlayerEvents is deterministic for a fixed seed', () => {
  const run = () => processPlayerEvents(PLAYER_EVENTS, playerArgs({ rng: createRng(99) }));
  assert.deepEqual(run(), run());
});
