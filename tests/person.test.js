import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import {
  createPerson,
  pickRandomCountry,
  pickRandomBirthMonth,
  pickRandomTraits,
  rollStats,
  rollAptitudes,
  NEWBORN_STAT_RANGES,
  ADULT_STAT_RANGES,
} from '../src/engine/person.js';

test('createPerson defaults money to 0, traits to an empty array, stats to a flat 50 and no aptitudes', () => {
  const person = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
  assert.deepEqual(person, {
    id: 'p_0001',
    firstName: null,
    lastName: null,
    sex: 'F',
    birth: 123,
    countryId: 'BR',
    cityId: null,
    occupation: null,
    appearance: null,
    emotion: null,
    stress: null,
    money: 0,
    traits: [],
    traitTendencies: {},
    stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 },
    aptitudes: null,
  });
});

test('createPerson accepts explicit money, traits and stats', () => {
  const person = createPerson({
    id: 'p_0001',
    sex: 'F',
    birth: 123,
    countryId: 'BR',
    money: 500,
    traits: ['generous'],
    stats: { happiness: 80, health: 90, intelligence: 60, looks: 70 },
  });
  assert.equal(person.money, 500);
  assert.deepEqual(person.traits, ['generous']);
  assert.deepEqual(person.stats, { happiness: 80, health: 90, intelligence: 60, looks: 70 });
});

test('createPerson does not share the same default stats object across people', () => {
  const a = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
  const b = createPerson({ id: 'p_0002', sex: 'M', birth: 123, countryId: 'BR' });
  assert.notEqual(a.stats, b.stats);
});

test('pickRandomCountry is deterministic for a fixed seed', () => {
  const countries = ['BR', 'US', 'JP', 'RU', 'GB'];
  const a = pickRandomCountry(createRng(10), countries);
  const b = pickRandomCountry(createRng(10), countries);
  assert.equal(a, b);
});

test('pickRandomBirthMonth is deterministic for a fixed seed and within [1, 12]', () => {
  const a = pickRandomBirthMonth(createRng(10));
  const b = pickRandomBirthMonth(createRng(10));
  assert.equal(a, b);
  assert.ok(a >= 1 && a <= 12);
});

test('pickRandomTraits is deterministic, has no duplicates, and stays within the pool', () => {
  const pool = ['patient', 'explosive', 'shy', 'sociable', 'generous', 'rigid', 'stubborn'];
  const a = pickRandomTraits(createRng(10), 2);
  const b = pickRandomTraits(createRng(10), 2);

  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
  assert.equal(new Set(a).size, 2);
  for (const trait of a) assert.ok(pool.includes(trait));
});

test('rollStats is deterministic and stays within each range', () => {
  for (const ranges of [NEWBORN_STAT_RANGES, ADULT_STAT_RANGES]) {
    for (let seed = 1; seed <= 50; seed++) {
      const a = rollStats(createRng(seed), ranges);
      assert.deepEqual(a, rollStats(createRng(seed), ranges));
      for (const [stat, [min, maxExclusive]] of Object.entries(ranges)) {
        assert.ok(a[stat] >= min && a[stat] < maxExclusive, `${stat}=${a[stat]}`);
      }
    }
  }
});

test('rollStats does not give everyone the same stats', () => {
  const rolls = new Set();
  for (let seed = 1; seed <= 20; seed++) rolls.add(JSON.stringify(rollStats(createRng(seed), NEWBORN_STAT_RANGES)));
  assert.ok(rolls.size > 1);
});

test('rollAptitudes is deterministic and within [0, 1]', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const a = rollAptitudes(createRng(seed));
    assert.deepEqual(a, rollAptitudes(createRng(seed)));
    for (const value of Object.values(a)) assert.ok(value >= 0 && value <= 1);
  }
});
