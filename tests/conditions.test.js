import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConditions } from '../src/engine/conditions.js';
import { toMonthIndex } from '../src/engine/time.js';

test('type and state must match exactly', () => {
  const relationship = { type: 'romantic', state: 'married', affinity: {} };
  assert.equal(evaluateConditions({ type: 'romantic' }, relationship), true);
  assert.equal(evaluateConditions({ type: 'family' }, relationship), false);
  assert.equal(evaluateConditions({ state: 'married' }, relationship), true);
  assert.equal(evaluateConditions({ state: 'divorced' }, relationship), false);
});

test('maxAffinity passes when the lower side is at or below the threshold', () => {
  const relationship = { affinity: { p_0001: 90, p_0002: 20 } };
  assert.equal(evaluateConditions({ maxAffinity: 25 }, relationship), true);
});

test('maxAffinity fails when both sides are above the threshold', () => {
  const relationship = { affinity: { p_0001: 90, p_0002: 30 } };
  assert.equal(evaluateConditions({ maxAffinity: 25 }, relationship), false);
});

test('minAge and maxAge compare against the current age', () => {
  const birth = toMonthIndex({ year: 2000, month: 1 });
  const person = { birth };
  const tenYearsLater = birth + 120;

  assert.equal(evaluateConditions({ minAge: 10 }, person, { currentMonthIndex: tenYearsLater }), true);
  assert.equal(evaluateConditions({ minAge: 11 }, person, { currentMonthIndex: tenYearsLater }), false);
  assert.equal(evaluateConditions({ maxAge: 10 }, person, { currentMonthIndex: tenYearsLater }), true);
  assert.equal(evaluateConditions({ maxAge: 9 }, person, { currentMonthIndex: tenYearsLater }), false);
});

test('multiple conditions are combined with AND', () => {
  const relationship = { type: 'romantic', state: 'married', affinity: { a: 10, b: 90 } };
  assert.equal(evaluateConditions({ type: 'romantic', state: 'married', maxAffinity: 25 }, relationship), true);
  assert.equal(evaluateConditions({ type: 'romantic', state: 'divorced', maxAffinity: 25 }, relationship), false);
});

test('unknown condition keys throw', () => {
  assert.throws(() => evaluateConditions({ notARealCondition: 1 }, {}));
});
