// Parent generation and the family relationships rooted at a newborn child.
// Always a mother and a father (rule confirmed for M2 — no family-structure
// variation yet; that belongs to the event engine, M3+).

import { createPerson } from './person.js';
import { createRelationship } from './relationship.js';

const PARENT_MIN_AGE_MONTHS = 20 * 12;
const PARENT_MAX_AGE_MONTHS_EXCLUSIVE = 46 * 12; // ages 20-45 at the child's birth

const CHILD_PARENT_AFFINITY_RANGE = [60, 91]; // nextInt -> 60..90
const MARRIAGE_AFFINITY_RANGE = [40, 91]; // nextInt -> 40..90

function createParent(rng, child, sex, nextPersonId) {
  const ageAtChildBirthMonths = rng.nextInt(PARENT_MIN_AGE_MONTHS, PARENT_MAX_AGE_MONTHS_EXCLUSIVE);
  const birth = child.birth - ageAtChildBirthMonths;
  return createPerson({ id: nextPersonId(), sex, birth, countryId: child.countryId });
}

export function generateParents(rng, child, nextPersonId) {
  const mother = createParent(rng, child, 'F', nextPersonId);
  const father = createParent(rng, child, 'M', nextPersonId);
  return { mother, father };
}

export function createFamilyRelationships(rng, { child, mother, father }, nextRelationshipId, sinceMonth) {
  const childRole = child.sex === 'M' ? 'son' : 'daughter';

  const motherChild = createRelationship({
    id: nextRelationshipId(),
    roles: { [mother.id]: 'mother', [child.id]: childRole },
    type: 'family',
    affinity: {
      [mother.id]: rng.nextInt(...CHILD_PARENT_AFFINITY_RANGE),
      [child.id]: rng.nextInt(...CHILD_PARENT_AFFINITY_RANGE),
    },
    since: sinceMonth,
  });

  const fatherChild = createRelationship({
    id: nextRelationshipId(),
    roles: { [father.id]: 'father', [child.id]: childRole },
    type: 'family',
    affinity: {
      [father.id]: rng.nextInt(...CHILD_PARENT_AFFINITY_RANGE),
      [child.id]: rng.nextInt(...CHILD_PARENT_AFFINITY_RANGE),
    },
    since: sinceMonth,
  });

  const marriage = createRelationship({
    id: nextRelationshipId(),
    roles: { [mother.id]: 'wife', [father.id]: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: {
      [mother.id]: rng.nextInt(...MARRIAGE_AFFINITY_RANGE),
      [father.id]: rng.nextInt(...MARRIAGE_AFFINITY_RANGE),
    },
    since: sinceMonth,
  });

  return [motherChild, fatherChild, marriage];
}
