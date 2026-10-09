import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEffects } from '../src/engine/effects.js';
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
