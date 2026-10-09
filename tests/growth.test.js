import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growStats } from '../src/systems/growth.js';

function child({ stats = {}, aptitudes = { cognitive: 0.5, physical: 0.5, social: 0.5 } } = {}) {
  return { id: 'p_player', stats: { happiness: 70, health: 70, intelligence: 20, looks: 50, ...stats }, aptitudes };
}

test('intelligence grows faster with higher cognitive aptitude', () => {
  const low = growStats(child({ aptitudes: { cognitive: 0, physical: 0.5, social: 0.5 } }), { months: 12, ageMonths: 24 });
  const high = growStats(child({ aptitudes: { cognitive: 1, physical: 0.5, social: 0.5 } }), { months: 12, ageMonths: 24 });

  assert.ok(low.person.stats.intelligence > 20);
  assert.ok(high.person.stats.intelligence > low.person.stats.intelligence);
});

test('intelligence stops growing at 18, even mid-advance', () => {
  const atEdge = growStats(child(), { months: 12, ageMonths: 18 * 12 - 6 });
  const adult = growStats(child(), { months: 12, ageMonths: 18 * 12 });
  const full = growStats(child(), { months: 12, ageMonths: 24 });

  assert.equal(adult.deltas.intelligence, undefined);
  assert.ok(atEdge.deltas.intelligence > 0);
  assert.ok(atEdge.deltas.intelligence < full.deltas.intelligence);
});

test('health drifts toward the physical-aptitude target from both sides', () => {
  const sick = growStats(child({ stats: { health: 30 }, aptitudes: { cognitive: 0.5, physical: 1, social: 0.5 } }), { months: 12, ageMonths: 24 });
  const fit = growStats(child({ stats: { health: 100 }, aptitudes: { cognitive: 0.5, physical: 0, social: 0.5 } }), { months: 12, ageMonths: 24 });

  assert.ok(sick.deltas.health > 0 && sick.person.stats.health < 90);
  assert.ok(fit.deltas.health < 0 && fit.person.stats.health > 50);
});

test('happiness drifts toward family affinity and stays put without it', () => {
  const loved = growStats(child({ stats: { happiness: 50 } }), { months: 6, ageMonths: 24, familyAffinity: 90 });
  const neglected = growStats(child({ stats: { happiness: 50 } }), { months: 6, ageMonths: 24, familyAffinity: 10 });
  const alone = growStats(child({ stats: { happiness: 50 } }), { months: 6, ageMonths: 24 });

  assert.ok(loved.person.stats.happiness > 50);
  assert.ok(neglected.person.stats.happiness < 50);
  assert.equal(alone.deltas.happiness, undefined);
});

test('two 6-month steps land close to one 12-month step', () => {
  const opts = { ageMonths: 24, familyAffinity: 90 };
  const once = growStats(child(), { ...opts, months: 12 }).person.stats;
  const half = growStats(child(), { ...opts, months: 6 }).person;
  const twice = growStats(half, { ...opts, ageMonths: 30, months: 6 }).person.stats;

  for (const stat of ['happiness', 'health', 'intelligence']) {
    assert.ok(Math.abs(once[stat] - twice[stat]) <= 0.2, `${stat}: ${once[stat]} vs ${twice[stat]}`);
  }
});

test('growStats does not mutate its input and leaves people without aptitudes alone', () => {
  const person = child();
  growStats(person, { months: 12, ageMonths: 24 });
  assert.equal(person.stats.intelligence, 20);

  const npc = { id: 'p_mother', stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 }, aptitudes: null };
  assert.deepEqual(growStats(npc, { months: 12, ageMonths: 400 }).deltas, {});
});
