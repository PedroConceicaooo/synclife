import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { createPerson } from '../src/engine/person.js';
import { createRelationship } from '../src/systems/relationship.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import {
  createGameState,
  advanceStep,
  resolveDecision,
  attemptPlayerInteraction,
  attemptPlayerActivity,
  availableActivities,
  isAdult,
} from '../src/systems/game.js';

const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));
const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));

const COUNTRY = { id: 'BR', currency: { scale: { small: 25, medium: 125, large: 500 } } };
const COUNTRIES_BY_ID = { default: { id: 'default' }, BR: { id: 'BR', inherits: 'default', currency: COUNTRY.currency } };

const EVENTS_BY_ID = loadEvents(EVENTS_DIR);
const INTERACTIONS_BY_ID = loadInteractions(INTERACTIONS_DIR);
const ACTIVITIES_BY_ID = loadActivities(ACTIVITIES_DIR);

function baseArgs(seed) {
  return { seed, countriesById: COUNTRIES_BY_ID, eventsById: EVENTS_BY_ID, interactionsById: INTERACTIONS_BY_ID, activitiesById: ACTIVITIES_BY_ID };
}

test('advanceStep is deterministic for a fixed seed', () => {
  const run = () => advanceStep(createGameState(baseArgs(7)), 12);
  const a = run();
  const b = run();
  assert.deepEqual(a.people, b.people);
  assert.deepEqual(a.relationships, b.relationships);
  assert.equal(a.currentMonthIndex, b.currentMonthIndex);
});

function buildDivorceReadyState() {
  const player = createPerson({ id: 'p_player', sex: 'M', birth: -72, countryId: 'BR' }); // age 6 at month 0, satisfies ask_money's minAge:5
  const mother = createPerson({ id: 'p_mother', sex: 'F', birth: -300, countryId: 'BR', traits: ['sociable', 'patient'] });
  const father = createPerson({ id: 'p_father', sex: 'M', birth: -320, countryId: 'BR', traits: ['sociable', 'patient'] });

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
  const marriage = createRelationship({
    id: 'r_marriage',
    roles: { p_mother: 'wife', p_father: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: { p_mother: 10, p_father: 10 },
    since: 0,
  });

  return {
    rng: { chance: () => true, nextInt: () => 0, next: () => 0 },
    player,
    mother,
    father,
    country: COUNTRY,
    people: { [player.id]: player, [mother.id]: mother, [father.id]: father },
    relationships: { [motherChild.id]: motherChild, [fatherChild.id]: fatherChild, [marriage.id]: marriage },
    motherChildId: motherChild.id,
    fatherChildId: fatherChild.id,
    marriageId: marriage.id,
    currentMonthIndex: 0,
    // Only the divorce pair, so these tests stay about world events.
    eventsById: { divorce: EVENTS_BY_ID.divorce, choose_who_to_live_with: EVENTS_BY_ID.choose_who_to_live_with },
    interactionsById: INTERACTIONS_BY_ID,
    activitiesById: ACTIVITIES_BY_ID,
    pendingDecisions: [],
    firedEvents: [],
    history: [{ month: 0, entries: [] }],
    lastInteractionResult: null,
  };
}

test('advanceStep surfaces a pending decision when divorce fires and involves the player', () => {
  const state = buildDivorceReadyState();
  const afterAdvance = advanceStep(state, 12);

  assert.equal(afterAdvance.relationships[state.marriageId].state, 'divorced');
  assert.equal(afterAdvance.pendingDecisions.length, 1);
  assert.equal(afterAdvance.pendingDecisions[0].trigger, 'choose_who_to_live_with');
});

test('resolveDecision honors the player\'s explicit choice even when the rng would have picked differently', () => {
  const state = buildDivorceReadyState();
  const afterAdvance = advanceStep(state, 12);

  // rng.nextInt always returns 0 (live_with_mother) in this fixture — proving
  // the explicit choice below is not just coincidentally matching the rng.
  const afterDecision = resolveDecision(afterAdvance, 'live_with_father');

  // 12 months of decay (rate 0.2/month) already dropped 80 to 77.6 before the
  // decision's +5/-5 effects apply.
  assert.equal(afterDecision.pendingDecisions.length, 0);
  assert.equal(afterDecision.relationships[state.fatherChildId].affinity.p_father, 82.6);
  assert.equal(afterDecision.relationships[state.motherChildId].affinity.p_mother, 72.6);
});

test('attemptPlayerInteraction success path transfers money and adjusts affinity', () => {
  const state = buildDivorceReadyState();
  const result = attemptPlayerInteraction(state, 'ask_money', 'p_mother');

  assert.equal(result.lastInteractionResult.attempted, true);
  assert.equal(result.lastInteractionResult.succeeded, true);
  assert.equal(result.people.p_player.money, 25);
  assert.equal(result.relationships[state.motherChildId].affinity.p_mother, 78);
});

test('attemptPlayerInteraction failure path only adjusts affinity', () => {
  const state = { ...buildDivorceReadyState(), rng: { chance: () => false, nextInt: () => 0, next: () => 0 } };
  const result = attemptPlayerInteraction(state, 'ask_money', 'p_mother');

  assert.equal(result.lastInteractionResult.succeeded, false);
  assert.equal(result.people.p_player.money, 0);
  assert.equal(result.relationships[state.motherChildId].affinity.p_mother, 76);
  assert.equal(result.relationships[state.motherChildId].affinity.p_player, 71);
});

test('a short sequence of advanceStep and attemptPlayerInteraction is deterministic for a fixed seed', () => {
  function run(seed) {
    let state = createGameState(baseArgs(seed));
    state = advanceStep(state, 6);
    while (state.pendingDecisions.length > 0) {
      state = resolveDecision(state);
    }
    state = attemptPlayerInteraction(state, 'ask_money', state.mother.id);
    state = advanceStep(state, 12);
    return { people: state.people, relationships: state.relationships, currentMonthIndex: state.currentMonthIndex };
  }

  assert.deepEqual(run(2024), run(2024));
});

function playFullLife(seed) {
  let state = createGameState(baseArgs(seed));
  const initialMoney = state.people[state.player.id].money;
  const advances = [];
  let step = 6;
  while (!isAdult(state)) {
    state = advanceStep(state, step);
    advances.push({ decisions: state.pendingDecisions.length, adult: isAdult(state) });
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
    step = step === 6 ? 12 : 6;
  }
  return { state, initialMoney, advances };
}

// The advance that reaches 18 is excluded: v1 has no adult events, and the
// choice at 18 is M6's decision point.
test('a full life asks at least one decision on every advance before 18', () => {
  for (const seed of [1, 2, 3, 42]) {
    const { advances } = playFullLife(seed);
    assert.ok(advances.filter((a) => !a.adult).every((a) => a.decisions >= 1), `seed ${seed}`);
  }
});

test('a full life ends with stats that moved away from their starting values', () => {
  const { state } = playFullLife(42);
  const start = createGameState(baseArgs(42)).people[state.player.id].stats;
  const end = state.people[state.player.id].stats;
  assert.notDeepEqual(end, start);
  assert.ok(end.intelligence > start.intelligence + 20);
});

test('every money change of the player is in the diary', () => {
  for (const seed of [1, 2, 3, 42]) {
    let { state, initialMoney } = playFullLife(seed);
    state = attemptPlayerInteraction(state, 'ask_money', state.mother.id);

    const logged = state.history.flatMap((block) => block.entries).filter((e) => e.type === 'money').reduce((sum, e) => sum + e.amount, 0);
    assert.equal(state.people[state.player.id].money - initialMoney, logged, `seed ${seed}`);
  }
});

test('advanceStep adds one diary block per advance with birthdays and allowance', () => {
  const { state } = playFullLife(7);
  const entries = state.history.flatMap((block) => block.entries);

  assert.equal(state.history[0].entries[0].type, 'birth');
  assert.equal(entries.filter((e) => e.type === 'birthday').length, 18);
  assert.ok(entries.some((e) => e.type === 'money' && e.source === 'allowance'));
  assert.ok(entries.some((e) => e.type === 'event' && e.optionId));
  assert.ok(entries.some((e) => e.type === 'stat'));
});

test('advanceStep no longer earns money from activities on its own', () => {
  const { state } = playFullLife(3);
  const sources = new Set(state.history.flatMap((b) => b.entries).filter((e) => e.type === 'money').map((e) => e.source));
  assert.deepEqual([...sources], ['allowance']);
});

test('a full life is deterministic for a fixed seed', () => {
  const a = playFullLife(2024).state;
  const b = playFullLife(2024).state;
  assert.deepEqual(a.history, b.history);
  assert.deepEqual(a.people, b.people);
});

const ACTIVITY_FIXTURE = {
  odd_job: { id: 'odd_job', category: 'odd_jobs', conditions: { minAge: 5 }, earnings: 'medium', randomEvents: [{ event: 'tip', chance: 1 }] },
  risky_job: { id: 'risky_job', category: 'odd_jobs', conditions: { minAge: 5 }, earnings: 'small', randomEvents: [{ event: 'dilemma', chance: 1 }] },
  park: { id: 'park', category: 'leisure', conditions: { minAge: 5 }, cost: 'medium', effects: [{ op: 'stat', target: 'player', stat: 'happiness', delta: 5 }] },
};
const ACTIVITY_EVENTS = {
  tip: { id: 'tip', subject: 'player', effects: [{ op: 'money', target: 'player', gain: 'small' }] },
  dilemma: { id: 'dilemma', subject: 'player', options: [{ id: 'ok', effects: [] }] },
};

function activityState() {
  const state = buildDivorceReadyState();
  return { ...state, activitiesById: ACTIVITY_FIXTURE, eventsById: { ...state.eventsById, ...ACTIVITY_EVENTS }, activityUsesThisPeriod: {} };
}

test('attemptPlayerActivity pays, applies triggered events and logs everything in the current block', () => {
  const after = attemptPlayerActivity(activityState(), 'odd_job');

  // medium (125) + tip (small, 25) in the BR fixture currency
  assert.equal(after.people.p_player.money, 150);
  assert.deepEqual(after.history[0].entries, [
    { type: 'activity', activityId: 'odd_job' },
    { type: 'event', eventId: 'tip' },
    { type: 'money', amount: 150, source: 'activity', activityId: 'odd_job' },
  ]);
});

test('attemptPlayerActivity allows each activity once per period and resets on advance', () => {
  const once = attemptPlayerActivity(activityState(), 'odd_job');
  const twice = attemptPlayerActivity(once, 'odd_job');

  assert.equal(twice.lastActivityResult.reason, 'limit');
  assert.equal(twice.people.p_player.money, 150);

  const nextPeriod = advanceStep(twice, 6);
  assert.deepEqual(nextPeriod.activityUsesThisPeriod, {});
});

test('attemptPlayerActivity spends money on leisure and blocks it without money', () => {
  const state = activityState();
  assert.equal(attemptPlayerActivity(state, 'park').lastActivityResult.reason, 'money');

  const rich = { ...state, people: { ...state.people, p_player: { ...state.people.p_player, money: 200 } } };
  const after = attemptPlayerActivity(rich, 'park');
  assert.equal(after.people.p_player.money, 75);
  assert.equal(after.people.p_player.stats.happiness, 55);
});

test('an activity event with options becomes a pending decision', () => {
  const after = attemptPlayerActivity(activityState(), 'risky_job');
  assert.deepEqual(after.pendingDecisions, [{ trigger: 'dilemma', firingRelationship: null }]);
});

test('availableActivities reflects uses this period', () => {
  const after = attemptPlayerActivity(activityState(), 'odd_job');
  const jobs = availableActivities(after).find((g) => g.category === 'odd_jobs').activities;
  assert.deepEqual(jobs.find((a) => a.id === 'odd_job'), { id: 'odd_job', blocker: 'limit' });
});

test('a new baby joins the family and the player reaction sets the sibling affinity', () => {
  const base = buildDivorceReadyState();
  const marriage = { ...base.relationships.r_marriage, affinity: { p_mother: 80, p_father: 80 } };
  const state = {
    ...base,
    relationships: { ...base.relationships, r_marriage: marriage },
    eventsById: { new_baby: EVENTS_BY_ID.new_baby, new_sibling: EVENTS_BY_ID.new_sibling },
    rng: createRng(3),
  };
  // Forces every roll above 10% (the new_baby roll among them); smaller ones use the seeded rng.
  const forced = { ...state, rng: { ...state.rng, chance: (p) => (p < 1 && p > 0.1 ? true : state.rng.chance(p)) } };

  const afterAdvance = advanceStep(forced, 12);
  const babyId = Object.keys(afterAdvance.people).find((id) => !(id in state.people));
  assert.ok(babyId);
  assert.deepEqual(afterAdvance.pendingDecisions.map((d) => d.trigger), ['new_sibling']);
  assert.ok(afterAdvance.history.at(-1).entries.some((e) => e.type === 'worldEvent' && e.eventId === 'new_baby'));

  const cuddled = resolveDecision(afterAdvance, 'cuddle');
  const siblingRelationship = Object.values(cuddled.relationships).find((r) => babyId in r.roles && 'p_player' in r.roles);
  assert.equal(siblingRelationship.roles.p_player, 'brother');
  assert.deepEqual(siblingRelationship.affinity, { p_player: 65, [babyId]: 65 });
});
