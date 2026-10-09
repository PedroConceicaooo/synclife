import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { createPerson, pickRandomCountry, pickRandomBirthMonth, pickRandomTraits } from '../src/engine/person.js';

test('createPerson defaults money to 0 and traits to an empty array', () => {
  const person = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
  assert.deepEqual(person, { id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR', money: 0, traits: [] });
});

test('createPerson accepts explicit money and traits', () => {
  const person = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR', money: 500, traits: ['generous'] });
  assert.equal(person.money, 500);
  assert.deepEqual(person.traits, ['generous']);
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
