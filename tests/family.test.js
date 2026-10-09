import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { createPerson } from '../src/engine/person.js';
import { createIdGenerator } from '../src/engine/id.js';
import { generateParents, createFamilyRelationships } from '../src/engine/family.js';

const CHILD_BIRTH = 1200; // arbitrary month index

function makeChild(sex = 'F', nextPersonId = createIdGenerator('p')) {
  return createPerson({ id: nextPersonId(), sex, birth: CHILD_BIRTH, countryId: 'BR' });
}

test('generateParents returns a mother (F) and father (M) older than the child, in the child\'s country', () => {
  const nextPersonId = createIdGenerator('p');
  const rng = createRng(1);
  const child = makeChild('F', nextPersonId);
  const { mother, father } = generateParents(rng, child, nextPersonId);

  assert.equal(mother.sex, 'F');
  assert.equal(father.sex, 'M');
  assert.equal(mother.countryId, 'BR');
  assert.equal(father.countryId, 'BR');

  const motherAgeYears = (CHILD_BIRTH - mother.birth) / 12;
  const fatherAgeYears = (CHILD_BIRTH - father.birth) / 12;
  assert.ok(motherAgeYears >= 20 && motherAgeYears < 46);
  assert.ok(fatherAgeYears >= 20 && fatherAgeYears < 46);
});

test('generateParents is deterministic for a fixed seed', () => {
  const child = makeChild();
  const a = generateParents(createRng(7), child, createIdGenerator('p'));
  const b = generateParents(createRng(7), child, createIdGenerator('p'));
  assert.deepEqual(a, b);
});

test('createFamilyRelationships returns the 3 family relationships with correct roles', () => {
  const nextPersonId = createIdGenerator('p');
  const rng = createRng(3);
  const child = makeChild('M', nextPersonId);
  const { mother, father } = generateParents(rng, child, nextPersonId);
  const relationships = createFamilyRelationships(rng, { child, mother, father }, createIdGenerator('r'), CHILD_BIRTH);

  assert.equal(relationships.length, 3);
  const [motherChild, fatherChild, marriage] = relationships;

  assert.deepEqual(motherChild.roles, { [mother.id]: 'mother', [child.id]: 'son' });
  assert.equal(motherChild.type, 'family');
  assert.deepEqual(Object.keys(motherChild.affinity).sort(), [child.id, mother.id].sort());

  assert.deepEqual(fatherChild.roles, { [father.id]: 'father', [child.id]: 'son' });
  assert.equal(fatherChild.type, 'family');

  assert.deepEqual(marriage.roles, { [mother.id]: 'wife', [father.id]: 'husband' });
  assert.equal(marriage.type, 'romantic');
  assert.equal(marriage.state, 'married');

  for (const value of Object.values(motherChild.affinity)) assert.ok(value >= 60 && value <= 90);
  for (const value of Object.values(fatherChild.affinity)) assert.ok(value >= 60 && value <= 90);
  for (const value of Object.values(marriage.affinity)) assert.ok(value >= 40 && value <= 90);
});

test('createFamilyRelationships uses the daughter role for a female child', () => {
  const nextPersonId = createIdGenerator('p');
  const rng = createRng(5);
  const child = makeChild('F', nextPersonId);
  const { mother, father } = generateParents(rng, child, nextPersonId);
  const [motherChild] = createFamilyRelationships(rng, { child, mother, father }, createIdGenerator('r'), CHILD_BIRTH);

  assert.equal(motherChild.roles[child.id], 'daughter');
});

test('createFamilyRelationships assigns sequential ids from the passed generator', () => {
  const nextPersonId = createIdGenerator('p');
  const rng = createRng(9);
  const child = makeChild('M', nextPersonId);
  const { mother, father } = generateParents(rng, child, nextPersonId);
  const relationships = createFamilyRelationships(rng, { child, mother, father }, createIdGenerator('r'), CHILD_BIRTH);

  assert.deepEqual(relationships.map((r) => r.id), ['r_0001', 'r_0002', 'r_0003']);
});

test('createFamilyRelationships is deterministic for a fixed seed', () => {
  function build(seed) {
    const nextPersonId = createIdGenerator('p');
    const rng = createRng(seed);
    const child = makeChild('M', nextPersonId);
    const { mother, father } = generateParents(rng, child, nextPersonId);
    return createFamilyRelationships(rng, { child, mother, father }, createIdGenerator('r'), CHILD_BIRTH);
  }

  assert.deepEqual(build(11), build(11));
});
