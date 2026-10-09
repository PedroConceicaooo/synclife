import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { createPerson, pickRandomCountry, pickRandomBirthMonth, pickRandomTraits } from '../src/engine/person.js';

test('createPerson defaults money to 0, traits to an empty array, and stats to a flat 50', () => {
  const person = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
  assert.deepEqual(person, {
    id: 'p_0001',
    sex: 'F',
    birth: 123,
    countryId: 'BR',
    money: 0,
    traits: [],
    stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 },
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
