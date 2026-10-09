import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdGenerator, nextIdAfter } from '../src/engine/id.js';

test('generates sequential zero-padded ids', () => {
  const nextId = createIdGenerator('p');
  assert.equal(nextId(), 'p_0001');
  assert.equal(nextId(), 'p_0002');
});

test('independent generators do not share a counter', () => {
  const a = createIdGenerator('p');
  const b = createIdGenerator('p');
  a();
  a();
  assert.equal(b(), 'p_0001');
});

test('padding holds past single digits', () => {
  const nextId = createIdGenerator('r');
  let last;
  for (let i = 0; i < 11; i++) last = nextId();
  assert.equal(last, 'r_0011');
});

test('nextIdAfter continues after the highest id with that prefix', () => {
  assert.equal(nextIdAfter('p', ['p_0001', 'p_0003', 'r_0009']), 'p_0004');
  assert.equal(nextIdAfter('r', []), 'r_0001');
});
