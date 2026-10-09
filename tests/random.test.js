import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, yearlyChanceToPeriod } from '../src/engine/random.js';

test('same seed produces the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test('next() stays within [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1);
  }
});

test('nextInt() stays within [min, max)', () => {
  const rng = createRng(99);
  for (let i = 0; i < 1000; i++) {
    const value = rng.nextInt(5, 10);
    assert.ok(value >= 5 && value < 10);
    assert.equal(value, Math.floor(value));
  }
});

test('chance(0) is always false, chance(1) is always true', () => {
  const rng = createRng(5);
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
  }
});

test('yearlyChanceToPeriod matches the proportional-chance formula', () => {
  assert.equal(yearlyChanceToPeriod(0.5, 12), 0.5);
  assert.equal(yearlyChanceToPeriod(0.5, 6), 1 - (1 - 0.5) ** 0.5);
  assert.equal(yearlyChanceToPeriod(0, 6), 0);
  assert.equal(yearlyChanceToPeriod(1, 6), 1);
});
