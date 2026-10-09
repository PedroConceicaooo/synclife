import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAmount, transferMoney, addMoney, isAllowanceAge, payAllowance } from '../src/systems/money.js';

const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };

test('resolveAmount resolves a known scale against the country', () => {
  assert.equal(resolveAmount('small', COUNTRY), 10);
  assert.equal(resolveAmount('medium', COUNTRY), 50);
  assert.equal(resolveAmount('large', COUNTRY), 200);
});

test('resolveAmount throws on an unknown scale', () => {
  assert.throws(() => resolveAmount('huge', COUNTRY));
});

test('transferMoney moves money from one person to another without mutating the input', () => {
  const peopleById = { a: { id: 'a', money: 100 }, b: { id: 'b', money: 50 } };
  const result = transferMoney(peopleById, 'a', 'b', 30);

  assert.equal(result.a.money, 70);
  assert.equal(result.b.money, 80);
  assert.equal(peopleById.a.money, 100);
});

test('addMoney adds to a single person without mutating the input', () => {
  const peopleById = { a: { id: 'a', money: 100 } };
  const result = addMoney(peopleById, 'a', 25);

  assert.equal(result.a.money, 125);
  assert.equal(peopleById.a.money, 100);
});

test('isAllowanceAge is false under 3 and true at 3 and above', () => {
  assert.equal(isAllowanceAge(2), false);
  assert.equal(isAllowanceAge(3), true);
  assert.equal(isAllowanceAge(10), true);
});

test('payAllowance pays more for a richer, generous, high-affinity parent than a poorer, rigid, low-affinity one', () => {
  const richGenerousParent = { id: 'p_mother', traits: ['generous'], money: 1_000_000 };
  const poorRigidParent = { id: 'p_father', traits: ['rigid'], money: 1 };
  const highAffinity = { affinity: { p_mother: 100 } };
  const lowAffinity = { affinity: { p_father: 1 } };

  const high = payAllowance({ parent: richGenerousParent, relationship: highAffinity, country: COUNTRY, step: 6 });
  const low = payAllowance({ parent: poorRigidParent, relationship: lowAffinity, country: COUNTRY, step: 6 });

  assert.ok(high > low);
});

test('payAllowance scales linearly with step', () => {
  const parent = { id: 'p_mother', traits: [], money: 2000 };
  const relationship = { affinity: { p_mother: 50 } };

  const sixMonths = payAllowance({ parent, relationship, country: COUNTRY, step: 6 });
  const twelveMonths = payAllowance({ parent, relationship, country: COUNTRY, step: 12 });

  assert.equal(twelveMonths, sixMonths * 2);
});

test('payAllowance pays an average parent half a "small" per month', () => {
  // affinity 50 -> 1x, no trait -> 1x, money = 60x "large" -> 1x
  const parent = { id: 'p_mother', traits: [], money: 60 * 200 };
  const relationship = { affinity: { p_mother: 50 } };

  assert.equal(payAllowance({ parent, relationship, country: COUNTRY, step: 12 }), 5 * 12);
});

test('payAllowance per parent never exceeds 1.5x "small" per month even for the richest, most loving parent', () => {
  const parent = { id: 'p_mother', traits: ['generous'], money: 1_000_000_000 };
  const relationship = { affinity: { p_mother: 100 } };

  assert.ok(payAllowance({ parent, relationship, country: COUNTRY, step: 12 }) <= 1.5 * 10 * 12);
});
