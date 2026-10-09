import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { createPerson, pickRandomCountry, pickRandomBirthMonth } from '../src/engine/person.js';

test('createPerson returns exactly the minimal M1 shape', () => {
  const person = createPerson({ id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
  assert.deepEqual(person, { id: 'p_0001', sex: 'F', birth: 123, countryId: 'BR' });
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
