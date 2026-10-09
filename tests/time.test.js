import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMonthIndex, fromMonthIndex, ageAt, isBirthdayMonth, advance } from '../src/engine/time.js';

test('toMonthIndex/fromMonthIndex round-trip, including month boundaries', () => {
  for (const date of [
    { year: 2000, month: 1 },
    { year: 2000, month: 12 },
    { year: 2010, month: 4 },
    { year: 1999, month: 6 },
  ]) {
    assert.deepEqual(fromMonthIndex(toMonthIndex(date)), date);
  }
});

test('ageAt is 0 before the first birthday and increments exactly on it', () => {
  const birth = toMonthIndex({ year: 2000, month: 6 });
  assert.equal(ageAt(birth, birth), 0);
  assert.equal(ageAt(birth, birth + 11), 0);
  assert.equal(ageAt(birth, birth + 12), 1);
  assert.equal(ageAt(birth, birth + 12 * 18), 18);
});

test('isBirthdayMonth is only true on exact 12-month multiples from birth', () => {
  const birth = toMonthIndex({ year: 2000, month: 6 });
  assert.equal(isBirthdayMonth(birth, birth), true);
  assert.equal(isBirthdayMonth(birth, birth + 12), true);
  assert.equal(isBirthdayMonth(birth, birth + 11), false);
  assert.equal(isBirthdayMonth(birth, birth + 13), false);
});

test('advance crosses a birthday on a 12-month step', () => {
  const birth = toMonthIndex({ year: 2000, month: 6 });
  const start = birth + 3;
  const { nextMonthIndex, birthdays } = advance(start, 12, birth);
  assert.equal(nextMonthIndex, start + 12);
  assert.deepEqual(birthdays, [{ age: 1, monthIndex: birth + 12 }]);
});

test('advance crosses a birthday mid-advance on a 6-month step, reporting its exact month', () => {
  const birth = toMonthIndex({ year: 2000, month: 6 });
  const start = birth + 9;
  const { nextMonthIndex, birthdays } = advance(start, 6, birth);
  assert.equal(nextMonthIndex, start + 6);
  assert.deepEqual(birthdays, [{ age: 1, monthIndex: birth + 12 }]);
  assert.notEqual(birthdays[0].monthIndex, nextMonthIndex);
});

test('advance can cross zero birthdays', () => {
  const birth = toMonthIndex({ year: 2000, month: 6 });
  const start = birth + 1;
  const { nextMonthIndex, birthdays } = advance(start, 6, birth);
  assert.equal(nextMonthIndex, start + 6);
  assert.deepEqual(birthdays, []);
});
