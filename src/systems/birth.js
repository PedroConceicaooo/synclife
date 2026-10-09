// A child born mid-life to a couple: a new NPC person plus family
// relationships with both parents and with every child they already have.

import { nextIdAfter } from '../engine/id.js';
import { createPerson, rollStats, rollAptitudes, NEWBORN_STAT_RANGES } from '../engine/person.js';
import { createRelationship } from './relationship.js';

const PARENT_TO_NEWBORN_AFFINITY = [60, 91]; // nextInt -> 60..90
const NEWBORN_TO_PARENT_AFFINITY = [60, 91];
// Siblings start neutral; the player's reaction (new_sibling) moves it.
const SIBLING_START_AFFINITY = 50;

const PARENT_ROLES = ['mother', 'father'];
const CHILD_ROLES = ['son', 'daughter'];

const parentRole = (person) => (person.sex === 'F' ? 'mother' : 'father');
const childRole = (person) => (person.sex === 'F' ? 'daughter' : 'son');
const siblingRole = (person) => (person.sex === 'F' ? 'sister' : 'brother');

export function childrenOf(personId, relationshipsById) {
  const children = [];
  for (const relationship of Object.values(relationshipsById)) {
    if (!PARENT_ROLES.includes(relationship.roles[personId])) continue;
    const childId = Object.keys(relationship.roles).find((id) => id !== personId);
    if (CHILD_ROLES.includes(relationship.roles[childId])) children.push(childId);
  }
  return children;
}

export function addChild(rng, { parentIds, peopleById, relationshipsById, monthIndex }) {
  const parents = parentIds.map((id) => peopleById[id]);
  const child = createPerson({
    id: nextIdAfter('p', Object.keys(peopleById)),
    sex: rng.chance(0.5) ? 'F' : 'M',
    birth: monthIndex,
    countryId: parents[0].countryId,
    stats: rollStats(rng, NEWBORN_STAT_RANGES),
    aptitudes: rollAptitudes(rng),
  });

  const siblingIds = [...new Set(parentIds.flatMap((id) => childrenOf(id, relationshipsById)))].sort();

  const relationships = { ...relationshipsById };
  function add(fields) {
    const relationship = createRelationship({ id: nextIdAfter('r', Object.keys(relationships)), since: monthIndex, type: 'family', ...fields });
    relationships[relationship.id] = relationship;
  }

  for (const parent of parents) {
    add({
      roles: { [parent.id]: parentRole(parent), [child.id]: childRole(child) },
      affinity: { [parent.id]: rng.nextInt(...PARENT_TO_NEWBORN_AFFINITY), [child.id]: rng.nextInt(...NEWBORN_TO_PARENT_AFFINITY) },
    });
  }
  for (const siblingId of siblingIds) {
    const sibling = peopleById[siblingId];
    add({
      roles: { [sibling.id]: siblingRole(sibling), [child.id]: siblingRole(child) },
      affinity: { [sibling.id]: SIBLING_START_AFFINITY, [child.id]: SIBLING_START_AFFINITY },
    });
  }

  return { peopleById: { ...peopleById, [child.id]: child }, relationshipsById: relationships, childId: child.id };
}
