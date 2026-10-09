import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEffects, diminishedGain } from '../src/engine/effects.js';
import { createRelationship } from '../src/systems/relationship.js';

function setup() {
  const marriage = createRelationship({
    id: 'r_0001',
    roles: { p_mother: 'wife', p_father: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: { p_mother: 20, p_father: 15 },
    since: 0,
  });
  const motherChild = createRelationship({
    id: 'r_0002',
    roles: { p_mother: 'mother', p_player: 'son' },
    type: 'family',
    affinity: { p_mother: 80, p_player: 75 },
    since: 0,
  });
  const relationshipsById = { [marriage.id]: marriage, [motherChild.id]: motherChild };
  const peopleById = {
    p_mother: { id: 'p_mother', money: 1000 },
    p_father: { id: 'p_father', money: 500 },
    p_player: { id: 'p_player', money: 0 },
  };
  const country = { currency: { scale: { small: 10, medium: 50, large: 200 } } };
  return { marriage, motherChild, relationshipsById, peopleById, country };
}

test('relationshipState sets state only on the firing relationship', () => {
  const { marriage, motherChild, relationshipsById } = setup();
  const result = applyEffects([{ op: 'relationshipState', value: 'divorced' }], {
    relationship: marriage,
    relationshipsById,
    playerId: 'p_player',
  });

  assert.equal(result.relationshipsById[marriage.id].state, 'divorced');
  assert.equal(result.relationshipsById[motherChild.id].state, null);
});

test('affinity effect with side "both" adjusts every side, clamped', () => {
  const { marriage, relationshipsById } = setup();
  const result = applyEffects([{ op: 'affinity', side: 'both', delta: -30 }], {
    relationship: marriage,
    relationshipsById,
    playerId: 'p_player',
  });

  assert.equal(result.relationshipsById[marriage.id].affinity.p_mother, 0);
  assert.equal(result.relationshipsById[marriage.id].affinity.p_father, 0);
});

test('affinity effect with side "player"/"target" adjusts only the matching person', () => {
  const { motherChild, relationshipsById } = setup();
  const result = applyEffects([{ op: 'affinity', side: 'player', delta: 10 }], {
    relationship: motherChild,
    relationshipsById,
    playerId: 'p_player',
  });

  assert.equal(result.relationshipsById[motherChild.id].affinity.p_player, 85);
  assert.equal(result.relationshipsById[motherChild.id].affinity.p_mother, 80);
});

test('targetRole redirects the effect to the relationship between that role and the player', () => {
  const { marriage, relationshipsById } = setup();
  // "mother" is p_mother's role in her relationship with the player (r_0002),
  // not in the firing relationship (the marriage, where she is "wife").
  const result = applyEffects([{ op: 'affinity', side: 'both', delta: 5, targetRole: 'mother' }], {
    relationship: marriage,
    relationshipsById,
    playerId: 'p_player',
  });

  assert.equal(result.relationshipsById['r_0002'].affinity.p_mother, 85);
  assert.equal(result.relationshipsById['r_0002'].affinity.p_player, 80);
  assert.equal(result.relationshipsById['r_0001'].affinity.p_mother, 20);
});

test('transferMoney moves money between the right two people via the country scale', () => {
  const { marriage, relationshipsById, peopleById, country } = setup();
  const result = applyEffects([{ op: 'transferMoney', from: 'target', to: 'player', amount: 'small' }], {
    relationship: marriage,
    relationshipsById,
    peopleById,
    playerId: 'p_mother',
    country,
  });

  assert.equal(result.peopleById.p_mother.money, 1010);
  assert.equal(result.peopleById.p_father.money, 490);
  assert.equal(result.relationshipsById[marriage.id].affinity.p_mother, 20);
});

test('transferMoney with an unknown amount scale throws', () => {
  const { marriage, relationshipsById, peopleById, country } = setup();
  assert.throws(() =>
    applyEffects([{ op: 'transferMoney', from: 'target', to: 'player', amount: 'huge' }], {
      relationship: marriage,
      relationshipsById,
      peopleById,
      playerId: 'p_mother',
      country,
    }),
  );
});

test('unknown effect op throws', () => {
  const { marriage, relationshipsById } = setup();
  assert.throws(() =>
    applyEffects([{ op: 'notARealOp' }], { relationship: marriage, relationshipsById, playerId: 'p_player' }),
  );
});

function withStats(peopleById) {
  const stats = { happiness: 50, health: 50, intelligence: 50, looks: 50 };
  return Object.fromEntries(Object.entries(peopleById).map(([id, p]) => [id, { ...p, stats: { ...stats } }]));
}

test('stat on player changes only the player stat, clamped to 0..100', () => {
  const { relationshipsById, peopleById } = setup();
  const people = withStats(peopleById);

  const up = applyEffects([{ op: 'stat', target: 'player', stat: 'health', delta: 70 }], {
    relationship: null,
    relationshipsById,
    peopleById: people,
    playerId: 'p_player',
  });
  assert.equal(up.peopleById.p_player.stats.health, 100);
  assert.equal(up.peopleById.p_mother.stats.health, 50);
  assert.equal(people.p_player.stats.health, 50);

  const down = applyEffects([{ op: 'stat', target: 'player', stat: 'happiness', delta: -80 }], {
    relationship: null,
    relationshipsById,
    peopleById: people,
    playerId: 'p_player',
  });
  assert.equal(down.peopleById.p_player.stats.happiness, 0);
});

test('stat on target changes the other participant of the firing relationship', () => {
  const { motherChild, relationshipsById, peopleById } = setup();
  const result = applyEffects([{ op: 'stat', target: 'target', stat: 'happiness', delta: -5 }], {
    relationship: motherChild,
    relationshipsById,
    peopleById: withStats(peopleById),
    playerId: 'p_player',
  });
  assert.equal(result.peopleById.p_mother.stats.happiness, 45);
  assert.equal(result.peopleById.p_player.stats.happiness, 50);
});

test('stat throws on an unknown stat name', () => {
  const { relationshipsById, peopleById } = setup();
  assert.throws(() =>
    applyEffects([{ op: 'stat', target: 'player', stat: 'luck', delta: 1 }], {
      relationship: null,
      relationshipsById,
      peopleById: withStats(peopleById),
      playerId: 'p_player',
    }),
  );
});

test('affinity with targetRole works without a firing relationship (player events)', () => {
  const { motherChild, marriage, relationshipsById, peopleById } = setup();
  const result = applyEffects([{ op: 'affinity', side: 'target', delta: 3, targetRole: 'mother' }], {
    relationship: null,
    relationshipsById,
    peopleById,
    playerId: 'p_player',
  });
  assert.equal(result.relationshipsById[motherChild.id].affinity.p_mother, 83);
  assert.equal(result.relationshipsById[motherChild.id].affinity.p_player, 75);
  assert.deepEqual(result.relationshipsById[marriage.id].affinity, marriage.affinity);
});

test('money gains or loses a country-scaled amount for the player, from no one', () => {
  const { relationshipsById, peopleById, country } = setup();
  const context = { relationship: null, relationshipsById, peopleById, playerId: 'p_player', country };

  assert.equal(applyEffects([{ op: 'money', target: 'player', gain: 'medium' }], context).peopleById.p_player.money, 50);
  assert.equal(applyEffects([{ op: 'money', target: 'player', lose: 'small' }], context).peopleById.p_player.money, -10);
  assert.equal(applyEffects([{ op: 'money', target: 'player', gain: 'small' }], context).peopleById.p_mother.money, 1000);
});

test('diminishedGain keeps full gains up to 50, shrinks them toward 0 at 100, and never touches losses', () => {
  assert.equal(diminishedGain(30, 4), 4);
  assert.equal(diminishedGain(50, 4), 4);
  assert.equal(diminishedGain(75, 4), 2);
  assert.equal(diminishedGain(100, 4), 0);
  assert.equal(diminishedGain(90, -4), -4);
});

test('affinity gains diminish only when the context asks for it', () => {
  const { motherChild, relationshipsById } = setup(); // p_mother 80, p_player 75
  const effects = [{ op: 'affinity', side: 'both', delta: 5 }];
  const base = { relationship: motherChild, relationshipsById, playerId: 'p_player' };

  const full = applyEffects(effects, base).relationshipsById[motherChild.id].affinity;
  const diminished = applyEffects(effects, { ...base, diminishingAffinityGains: true }).relationshipsById[motherChild.id].affinity;

  assert.deepEqual(full, { p_mother: 85, p_player: 80 });
  assert.deepEqual(diminished, { p_mother: 82, p_player: 77.5 });
});
