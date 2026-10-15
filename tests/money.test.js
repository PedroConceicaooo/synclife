import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAmount, transferMoney, addMoney, receivesAllowance, familyAllowanceAt, payAllowance, isAllowanceCut, recentRaiseAsks } from '../src/systems/money.js';

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

// Bands like the default country: share of "small" by age.
const ALLOWANCE_COUNTRY = {
  ...COUNTRY,
  familyAllowance: {
    ageBands: [
      { minAge: 6, scale: 'small', multiplier: 0.4 },
      { minAge: 9, scale: 'small', multiplier: 0.8 },
      { minAge: 12, scale: 'small', multiplier: 1.4 },
      { minAge: 15, scale: 'small', multiplier: 2 },
    ],
  },
};
const AVERAGE_PARENT = { id: 'p_mother', traits: [], money: 60 * 200 }; // affinity 50, no trait, 60x "large" -> 1x
const AVERAGE_RELATIONSHIP = { affinity: { p_mother: 50 } };
// Born at month 0, getting the allowance since month 0.
const child = (allowance = { since: 0, factor: 1 }) => ({ id: 'p_child', birth: 0, ...(allowance ? { allowance } : {}) });
const pay = (overrides) =>
  payAllowance({ parent: AVERAGE_PARENT, relationship: AVERAGE_RELATIONSHIP, child: child(), country: ALLOWANCE_COUNTRY, ...overrides });

test('receivesAllowance only after the parents offered it', () => {
  assert.equal(receivesAllowance(child(null)), false);
  assert.equal(receivesAllowance(child({ offerAgainFrom: 144 })), false);
  assert.equal(receivesAllowance(child()), true);
});

test('familyAllowanceAt follows the age bands, and keeps the first band below it (old saves)', () => {
  assert.equal(familyAllowanceAt(4, ALLOWANCE_COUNTRY), 4);
  assert.equal(familyAllowanceAt(6, ALLOWANCE_COUNTRY), 4);
  assert.equal(familyAllowanceAt(8, ALLOWANCE_COUNTRY), 4);
  assert.equal(familyAllowanceAt(9, ALLOWANCE_COUNTRY), 8);
  assert.equal(familyAllowanceAt(12, ALLOWANCE_COUNTRY), 14);
  assert.equal(familyAllowanceAt(17, ALLOWANCE_COUNTRY), 20);
});

test('payAllowance pays nothing before the offer', () => {
  assert.equal(pay({ child: child(null), fromMonth: 100, toMonth: 112 }), 0);
});

test('payAllowance pays an average parent half the family amount per month, growing with age', () => {
  // 7 years: 0.4 x 10 = 4 a month for the family, 2 from each parent.
  assert.equal(pay({ fromMonth: 7 * 12, toMonth: 8 * 12 }), 2 * 12);
  // 16 years: 2 x 10 = 20 for the family, 10 from each parent.
  assert.equal(pay({ fromMonth: 16 * 12, toMonth: 17 * 12 }), 10 * 12);
});

test('payAllowance counts each month at its own age when a band changes mid-step', () => {
  // Months 8y7m..9y6m: five months at 8 (2 each), seven at 9 (4 each).
  assert.equal(pay({ fromMonth: 8 * 12 + 6, toMonth: 9 * 12 + 6 }), 5 * 2 + 7 * 4);
});

test('payAllowance only counts the months after the allowance started', () => {
  const started = child({ since: 10 * 12 + 3, factor: 1 });
  assert.equal(pay({ child: started, fromMonth: 10 * 12, toMonth: 10 * 12 + 6 }), 3 * 4);
});

test('payAllowance applies the factor agreed in the conversation (asking for more)', () => {
  const more = child({ since: 0, factor: 1.25 });
  assert.equal(pay({ child: more, fromMonth: 16 * 12, toMonth: 17 * 12 }), Math.round(10 * 1.25) * 12);
});

test('payAllowance pays more for a richer, generous, high-affinity parent than a poorer, rigid, low-affinity one', () => {
  const richGenerousParent = { id: 'p_mother', traits: ['generous'], money: 1_000_000 };
  const poorRigidParent = { id: 'p_father', traits: ['rigid'], money: 1 };
  const span = { fromMonth: 12 * 12, toMonth: 13 * 12 };

  const high = pay({ parent: richGenerousParent, relationship: { affinity: { p_mother: 100 } }, ...span });
  const low = pay({ parent: poorRigidParent, relationship: { affinity: { p_father: 1 } }, ...span });

  assert.ok(high > low);
});

test('payAllowance per parent never exceeds 1.5x the family amount even for the richest, most loving parent', () => {
  const parent = { id: 'p_mother', traits: ['generous'], money: 1_000_000_000 };
  const relationship = { affinity: { p_mother: 100 } };
  assert.ok(pay({ parent, relationship, fromMonth: 16 * 12, toMonth: 17 * 12 }) <= 1.5 * 20 * 12);
});

test('payAllowance holds back the months of a cut, and pays again after it', () => {
  const cut = child({ since: 0, factor: 1, cut: { from: 16 * 12, until: 16 * 12 + 4 } });
  // A year at 16 (10 a month from this parent): four months held back.
  assert.equal(pay({ child: cut, fromMonth: 16 * 12, toMonth: 17 * 12 }), 8 * 10);
  assert.equal(isAllowanceCut(cut, 16 * 12), false, 'the month of the punishment was already paid');
  assert.equal(isAllowanceCut(cut, 16 * 12 + 4), true);
  assert.equal(isAllowanceCut(cut, 16 * 12 + 5), false);
});

test('recentRaiseAsks keeps the asks of the last year', () => {
  const person = { allowance: { since: 0, raiseAsks: [100, 110, 120] } };
  assert.deepEqual(recentRaiseAsks(person, 111), [100, 110, 120]);
  assert.deepEqual(recentRaiseAsks(person, 130), [120]);
  assert.deepEqual(recentRaiseAsks({}, 130), []);
});
