import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelationship, decayAffinity, decayAll, findRelationshipBetween } from '../src/engine/relationship.js';

test('createRelationship fills in defaults', () => {
  const relationship = createRelationship({
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 80, p_0002: 70 },
    since: 100,
  });

  assert.deepEqual(relationship, {
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 80, p_0002: 70 },
    state: null,
    since: 100,
    lastInteraction: null,
    interactionsThisPeriod: 0,
  });
});

test('createRelationship honors an explicit state', () => {
  const relationship = createRelationship({
    id: 'r_0003',
    roles: { p_0001: 'wife', p_0002: 'husband' },
    type: 'romantic',
    affinity: { p_0001: 60, p_0002: 60 },
    since: 100,
    state: 'married',
  });

  assert.equal(relationship.state, 'married');
});

test('decayAffinity subtracts ratePerMonth * months per side, without mutating the input', () => {
  const relationship = createRelationship({
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 80, p_0002: 70 },
    since: 100,
  });

  const decayed = decayAffinity(relationship, 6, 1);

  assert.deepEqual(decayed.affinity, { p_0001: 74, p_0002: 64 });
  assert.deepEqual(relationship.affinity, { p_0001: 80, p_0002: 70 });
});

test('decay is proportional to months: 12 months is exactly double 6 months', () => {
  const relationship = createRelationship({
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 80, p_0002: 80 },
    since: 100,
  });

  const sixMonthDelta = 80 - decayAffinity(relationship, 6, 1).affinity.p_0001;
  const twelveMonthDelta = 80 - decayAffinity(relationship, 12, 1).affinity.p_0001;

  assert.equal(twelveMonthDelta, sixMonthDelta * 2);
});

test('decayAffinity clamps at 0', () => {
  const relationship = createRelationship({
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 5, p_0002: 5 },
    since: 100,
  });

  const decayed = decayAffinity(relationship, 100, 1);
  assert.deepEqual(decayed.affinity, { p_0001: 0, p_0002: 0 });
});

test('decayAffinity clamps at 100', () => {
  const relationship = createRelationship({
    id: 'r_0001',
    roles: { p_0001: 'mother', p_0002: 'son' },
    type: 'family',
    affinity: { p_0001: 95, p_0002: 95 },
    since: 100,
  });

  const decayed = decayAffinity(relationship, 100, -1);
  assert.deepEqual(decayed.affinity, { p_0001: 100, p_0002: 100 });
});

test('decayAll maps over the whole collection, preserving keys, without mutating the input', () => {
  const relationshipsById = {
    r_0001: createRelationship({
      id: 'r_0001',
      roles: { p_0001: 'mother', p_0002: 'son' },
      type: 'family',
      affinity: { p_0001: 80, p_0002: 80 },
      since: 100,
    }),
    r_0002: createRelationship({
      id: 'r_0002',
      roles: { p_0001: 'wife', p_0003: 'husband' },
      type: 'romantic',
      affinity: { p_0001: 60, p_0003: 60 },
      since: 100,
      state: 'married',
    }),
  };

  const decayed = decayAll(relationshipsById, 6, 1);

  assert.deepEqual(Object.keys(decayed), Object.keys(relationshipsById));
  assert.equal(decayed.r_0001.affinity.p_0001, 74);
  assert.equal(decayed.r_0002.affinity.p_0001, 54);
  assert.equal(relationshipsById.r_0001.affinity.p_0001, 80);
});

test('findRelationshipBetween finds the relationship containing both ids', () => {
  const relationshipsById = {
    r_0001: createRelationship({
      id: 'r_0001',
      roles: { p_0001: 'mother', p_0002: 'son' },
      type: 'family',
      affinity: { p_0001: 80, p_0002: 70 },
      since: 0,
    }),
  };

  assert.equal(findRelationshipBetween('p_0001', 'p_0002', relationshipsById).id, 'r_0001');
  assert.equal(findRelationshipBetween('p_0002', 'p_0001', relationshipsById).id, 'r_0001');
});

test('findRelationshipBetween returns null when no relationship connects the two ids', () => {
  const relationshipsById = {
    r_0001: createRelationship({
      id: 'r_0001',
      roles: { p_0001: 'mother', p_0002: 'son' },
      type: 'family',
      affinity: { p_0001: 80, p_0002: 70 },
      since: 0,
    }),
  };

  assert.equal(findRelationshipBetween('p_0001', 'p_0003', relationshipsById), null);
});
