import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { createRelationship } from '../src/systems/relationship.js';
import {
  indexInteractions,
  resolveChance,
  attemptInteraction,
  listAvailableInteractions,
  DEFAULT_INTERACTIONS_PER_PERIOD_LIMIT,
} from '../src/systems/interactions.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';

const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };

function buildRelationship(affinity) {
  return createRelationship({
    id: 'r_0001',
    roles: { p_player: 'son', p_mother: 'mother' },
    type: 'family',
    affinity,
    since: 0,
  });
}

test('loadInteractions loads ask_money by id', () => {
  const interactionsById = loadInteractions(INTERACTIONS_DIR);
  assert.ok(interactionsById.ask_money);
  assert.equal(interactionsById.ask_money.category, 'ask');
});

test('resolveChance returns the base chance when there are no modifiers', () => {
  const relationship = buildRelationship({ p_mother: 50, p_player: 50 });
  const target = { traits: [] };
  const chance = resolveChance({ base: 0.4, modifiers: [] }, { relationship, targetPersonId: 'p_mother', target });
  assert.equal(chance, 0.4);
});

test('resolveChance affinity modifier matches the worked example numbers', () => {
  const target = { traits: [] };
  const chance = { base: 0.4, modifiers: [{ factor: 'affinity', weight: 0.5 }] };

  const low = resolveChance(chance, { relationship: buildRelationship({ p_mother: 0, p_player: 50 }), targetPersonId: 'p_mother', target });
  const mid = resolveChance(chance, { relationship: buildRelationship({ p_mother: 50, p_player: 50 }), targetPersonId: 'p_mother', target });
  const high = resolveChance(chance, { relationship: buildRelationship({ p_mother: 100, p_player: 50 }), targetPersonId: 'p_mother', target });

  assert.ok(Math.abs(low - 0.15) < 1e-9);
  assert.ok(Math.abs(mid - 0.4) < 1e-9);
  assert.ok(Math.abs(high - 0.65) < 1e-9);
});

test('resolveChance targetTrait adjusts only when the target has the trait', () => {
  const relationship = buildRelationship({ p_mother: 50, p_player: 50 });
  const chance = { base: 0.4, modifiers: [{ factor: 'targetTrait', value: 'generous', adjust: 0.2 }] };

  const withTrait = resolveChance(chance, { relationship, targetPersonId: 'p_mother', target: { traits: ['generous'] } });
  const withoutTrait = resolveChance(chance, { relationship, targetPersonId: 'p_mother', target: { traits: ['rigid'] } });

  assert.ok(Math.abs(withTrait - 0.6) < 1e-9);
  assert.ok(Math.abs(withoutTrait - 0.4) < 1e-9);
});

test('resolveChance clamps extreme combinations to [0, 1]', () => {
  const relationship = buildRelationship({ p_mother: 100, p_player: 50 });
  const chance = { base: 0.9, modifiers: [{ factor: 'affinity', weight: 1 }, { factor: 'targetTrait', value: 'generous', adjust: 0.5 }] };
  const result = resolveChance(chance, { relationship, targetPersonId: 'p_mother', target: { traits: ['generous'] } });
  assert.equal(result, 1);
});

test('resolveChance throws on an unknown factor', () => {
  const relationship = buildRelationship({ p_mother: 50, p_player: 50 });
  assert.throws(() =>
    resolveChance({ base: 0.4, modifiers: [{ factor: 'notARealFactor' }] }, { relationship, targetPersonId: 'p_mother', target: { traits: [] } }),
  );
});

function setup() {
  const askMoney = loadInteractions(INTERACTIONS_DIR).ask_money;
  const relationship = buildRelationship({ p_mother: 80, p_player: 70 });
  const player = { id: 'p_player', birth: -120, traits: [] }; // age 10 relative to currentMonthIndex: 0
  const target = { id: 'p_mother', traits: [] };
  const peopleById = { p_player: { id: 'p_player', money: 0 }, p_mother: { id: 'p_mother', money: 1000 } };
  const relationshipsById = { [relationship.id]: relationship };
  return { askMoney, relationship, player, target, peopleById, relationshipsById };
}

test('attemptInteraction is blocked by the per-period limit without rolling or changing anything', () => {
  const { askMoney, relationship, player, target, peopleById, relationshipsById } = setup();
  const atLimit = { ...relationship, interactionsThisPeriod: DEFAULT_INTERACTIONS_PER_PERIOD_LIMIT };
  const relationshipsAtLimit = { [relationship.id]: atLimit };

  let chanceCalls = 0;
  const spyRng = { chance: () => { chanceCalls++; return true; }, nextInt: () => 0 };

  const result = attemptInteraction(askMoney, {
    relationship: atLimit,
    player,
    target,
    peopleById,
    relationshipsById: relationshipsAtLimit,
    country: COUNTRY,
    currentMonthIndex: 0,
    rng: spyRng,
  });

  assert.equal(result.attempted, false);
  assert.equal(result.reason, 'limit');
  assert.equal(chanceCalls, 0);
  assert.equal(result.relationshipsById[relationship.id].interactionsThisPeriod, DEFAULT_INTERACTIONS_PER_PERIOD_LIMIT);
});

test('attemptInteraction is blocked when conditions are not met (e.g. player too young)', () => {
  const { askMoney, relationship, target, peopleById, relationshipsById } = setup();
  const youngPlayer = { id: 'p_player', birth: 0, traits: [] }; // age 0 at currentMonthIndex 0, minAge 5 fails

  const result = attemptInteraction(askMoney, {
    relationship,
    player: youngPlayer,
    target,
    peopleById,
    relationshipsById,
    country: COUNTRY,
    currentMonthIndex: 0,
    rng: { chance: () => true, nextInt: () => 0 },
  });

  assert.equal(result.attempted, false);
  assert.equal(result.reason, 'conditions');
});

test('attemptInteraction success path transfers money, adjusts affinity, and increments the counter', () => {
  const { askMoney, relationship, player, target, peopleById, relationshipsById } = setup();

  const result = attemptInteraction(askMoney, {
    relationship,
    player,
    target,
    peopleById,
    relationshipsById,
    country: COUNTRY,
    currentMonthIndex: 0,
    rng: { chance: () => true, nextInt: () => 0 },
  });

  assert.equal(result.attempted, true);
  assert.equal(result.succeeded, true);
  assert.equal(result.peopleById.p_player.money, 10);
  assert.equal(result.peopleById.p_mother.money, 990);
  assert.equal(result.relationshipsById[relationship.id].affinity.p_mother, 78);
  assert.equal(result.relationshipsById[relationship.id].interactionsThisPeriod, 1);
  assert.equal(result.relationshipsById[relationship.id].lastInteraction, 0);
});

test('attemptInteraction failure path only adjusts affinity on both sides', () => {
  const { askMoney, relationship, player, target, peopleById, relationshipsById } = setup();

  const result = attemptInteraction(askMoney, {
    relationship,
    player,
    target,
    peopleById,
    relationshipsById,
    country: COUNTRY,
    currentMonthIndex: 0,
    rng: { chance: () => false, nextInt: () => 0 },
  });

  assert.equal(result.succeeded, false);
  assert.equal(result.peopleById.p_player.money, 0);
  assert.equal(result.relationshipsById[relationship.id].affinity.p_mother, 76);
  assert.equal(result.relationshipsById[relationship.id].affinity.p_player, 66);
});

test('attemptInteraction is deterministic for a fixed seed', () => {
  function run(seed) {
    const { askMoney, relationship, player, target, peopleById, relationshipsById } = setup();
    const rng = createRng(seed);
    return attemptInteraction(askMoney, {
      relationship,
      player,
      target,
      peopleById,
      relationshipsById,
      country: COUNTRY,
      currentMonthIndex: 0,
      rng,
    });
  }

  assert.deepEqual(run(99), run(99));
});

test('indexInteractions builds a map by id from an in-memory array (no fs)', () => {
  const interactionsById = indexInteractions([{ id: 'ask_money', category: 'ask' }]);
  assert.deepEqual(Object.keys(interactionsById), ['ask_money']);
});

const LISTING_FIXTURE = indexInteractions([
  { id: 'chat', category: 'talk', conditions: { targetRole: ['mother', 'father'], minAge: 3 } },
  { id: 'argue', category: 'conflict', conditions: { targetRole: ['mother', 'father'], minAge: 4 } },
  { id: 'give_gift', category: 'give', conditions: { targetRole: ['mother', 'father'], minAge: 5, minMoney: 'small' } },
  { id: 'flirt', category: 'talk', conditions: { targetRole: ['crush'], minAge: 12 } },
]);

function listingArgs({ ageYears, money = 0 }) {
  return {
    relationship: buildRelationship({ p_player: 50, p_mother: 50 }),
    player: { id: 'p_player', birth: 0, money },
    target: { id: 'p_mother', traits: [] },
    country: COUNTRY,
    currentMonthIndex: ageYears * 12,
  };
}

test('listAvailableInteractions groups by category in display order and drops empty categories', () => {
  const groups = listAvailableInteractions(LISTING_FIXTURE, listingArgs({ ageYears: 6, money: 10 }));
  assert.deepEqual(groups, [
    { category: 'talk', interactionIds: ['chat'] },
    { category: 'give', interactionIds: ['give_gift'] },
    { category: 'conflict', interactionIds: ['argue'] },
  ]);
});

test('listAvailableInteractions hides options by age, role and money', () => {
  assert.deepEqual(listAvailableInteractions(LISTING_FIXTURE, listingArgs({ ageYears: 2 })), []);
  const broke = listAvailableInteractions(LISTING_FIXTURE, listingArgs({ ageYears: 6, money: 9 }));
  assert.ok(!broke.some((g) => g.category === 'give'));
});

test('listAvailableInteractions orders each category by minimum age', () => {
  const fixture = indexInteractions([
    { id: 'a_late', category: 'talk', conditions: { minAge: 8 } },
    { id: 'z_early', category: 'talk', conditions: { minAge: 3 } },
  ]);
  const [talk] = listAvailableInteractions(fixture, listingArgs({ ageYears: 10 }));
  assert.deepEqual(talk.interactionIds, ['z_early', 'a_late']);
});

test('resolveChance: the parents\' wealth and stress, and an age from which the chance jumps', () => {
  const country = { currency: { scale: { small: 10, medium: 50, large: 200 } } };
  const family = (money, stress) => {
    const parent = (id) => ({ id, traits: [], money, stress });
    const link = (id, rid) => ({ id: rid, roles: { [id]: 'mother', p_player: 'son' }, affinity: { [id]: 50, p_player: 50 } });
    return {
      peopleById: { p_a: parent('p_a'), p_b: parent('p_b') },
      relationshipsById: { r_a: link('p_a', 'r_a'), r_b: link('p_b', 'r_b') },
    };
  };
  const chance = (modifiers, money, stress, ageMonths = 0) =>
    resolveChance(
      { base: 0.5, modifiers },
      { ...family(money, stress), player: { id: 'p_player', birth: 0 }, playerId: 'p_player', country, currentMonthIndex: ageMonths },
    );

  // 60x "large" is the reference: no change; twice that or more adds the whole weight.
  assert.equal(chance([{ factor: 'parentsWealth', weight: 0.2 }], 60 * 200, 50), 0.5);
  assert.equal(chance([{ factor: 'parentsWealth', weight: 0.2 }], 1_000_000, 50), 0.7);
  assert.ok(chance([{ factor: 'parentsWealth', weight: 0.2 }], 0, 50) < 0.5);

  assert.equal(chance([{ factor: 'parentsStress', weight: -0.2 }], 0, 50), 0.5);
  assert.equal(chance([{ factor: 'parentsStress', weight: -0.2 }], 0, 100), 0.4);

  const fromTwelve = [{ factor: 'fromAge', age: 12, adjust: 0.3 }];
  assert.equal(chance(fromTwelve, 0, 50, 11 * 12 + 11), 0.5);
  assert.equal(chance(fromTwelve, 0, 50, 12 * 12), 0.8);
});

test('resolveChance: each ask for an allowance raise in the last year lowers the chance', () => {
  const chance = (raiseAsks) =>
    resolveChance(
      { base: 0.5, modifiers: [{ factor: 'recentAllowanceRaiseAsks', adjust: -0.15 }] },
      { player: { id: 'p', allowance: { since: 0, raiseAsks } }, currentMonthIndex: 100 },
    );
  assert.equal(chance([]), 0.5);
  assert.equal(chance([94]), 0.35);
  assert.ok(Math.abs(chance([90, 94, 98]) - 0.05) < 1e-9);
  assert.equal(chance([70]), 0.5, 'more than a year ago');
});
