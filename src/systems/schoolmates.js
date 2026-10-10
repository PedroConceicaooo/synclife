// The people of school (design doc: classmates and teachers are
// acquaintances shown on the school screen; a classmate who becomes a
// friend moves to Relationships). Each school stage brings a new class.

import { nextIdAfter } from '../engine/id.js';
import { createPerson, pickRandomTraits, rollStats, rollAptitudes, ADULT_STAT_RANGES } from '../engine/person.js';
import { createRelationship } from './relationship.js';
import { pickFirstName, randomLastName } from './naming.js';
import { schoolEntryMonth } from './school.js';

export const CLASS_SIZE = 6;
export const TEACHERS_PER_CLASS = 2;
export const FRIENDSHIP_THRESHOLD = 65;

// Intelligence grows through childhood (growth.js), so a classmate met in
// high school starts higher than one met at six.
function classmateStatRanges(ageYears) {
  const base = Math.min(60, 15 + 3 * ageYears);
  return { happiness: [40, 91], health: [50, 91], intelligence: [base, base + 26], looks: [20, 81] };
}
const CLASSMATE_AFFINITY = [35, 61];
const TEACHER_AFFINITY = [45, 61];
const TEACHER_AGE_YEARS = [25, 61];

// Roles from the player's side: what the other person is to the player.
const otherSide = (relationship, playerId) => Object.keys(relationship.roles).find((id) => id !== playerId);
const roleOfOther = (relationship, playerId) => relationship.roles[otherSide(relationship, playerId)];

function withRoles(relationship, role) {
  return { ...relationship, roles: Object.fromEntries(Object.keys(relationship.roles).map((id) => [id, role])) };
}

// Born in the same school cohort as the player: the 12 months whose
// children start school in the same school year.
function cohortBirth(rng, player, education) {
  const entry = schoolEntryMonth(player.birth, education);
  const latest = entry - education.stages[0].startAge * 12;
  return latest - rng.nextInt(0, 12);
}

export function startClass(rng, { people, relationships, playerId, country, month }) {
  const player = people[playerId];
  const nextPeople = { ...people };
  const nextRelationships = {};

  // Last stage's classmates and teachers stay in the world, off the lists.
  for (const [id, relationship] of Object.entries(relationships)) {
    const role = playerId in relationship.roles ? roleOfOther(relationship, playerId) : null;
    if (role === 'classmate') nextRelationships[id] = withRoles(relationship, 'former_classmate');
    else if (role === 'teacher') nextRelationships[id] = { ...relationship, roles: { [otherSide(relationship, playerId)]: 'former_teacher', [playerId]: 'former_student' } };
    else nextRelationships[id] = relationship;
  }

  function addPerson(fields) {
    const person = createPerson({ id: nextIdAfter('p', Object.keys(nextPeople)), countryId: player.countryId, cityId: player.cityId, ...fields });
    nextPeople[person.id] = person;
    return person;
  }
  function addRelationship(fields) {
    const relationship = createRelationship({ id: nextIdAfter('r', Object.keys(nextRelationships)), type: 'school', since: month, ...fields });
    nextRelationships[relationship.id] = relationship;
  }

  const taken = Object.values(people).map((p) => p.firstName);
  const classmateIds = [];
  for (let i = 0; i < CLASS_SIZE; i++) {
    const sex = rng.chance(0.5) ? 'F' : 'M';
    const birth = cohortBirth(rng, player, country.education);
    const classmate = addPerson({
      sex,
      birth,
      firstName: pickFirstName(rng, country.nameList, sex, taken),
      lastName: randomLastName(rng, country, sex),
      traits: pickRandomTraits(rng, 2),
      stats: rollStats(rng, classmateStatRanges(Math.floor((month - birth) / 12))),
      aptitudes: rollAptitudes(rng),
    });
    taken.push(classmate.firstName);
    classmateIds.push(classmate.id);
    addRelationship({
      roles: { [playerId]: 'classmate', [classmate.id]: 'classmate' },
      affinity: { [playerId]: rng.nextInt(...CLASSMATE_AFFINITY), [classmate.id]: rng.nextInt(...CLASSMATE_AFFINITY) },
    });
  }

  const teacherIds = [];
  for (let i = 0; i < TEACHERS_PER_CLASS; i++) {
    const sex = rng.chance(0.5) ? 'F' : 'M';
    const teacher = addPerson({
      sex,
      birth: month - rng.nextInt(...TEACHER_AGE_YEARS) * 12 - rng.nextInt(0, 12),
      firstName: pickFirstName(rng, country.nameList, sex),
      lastName: randomLastName(rng, country, sex),
      traits: pickRandomTraits(rng, 2),
      stats: rollStats(rng, ADULT_STAT_RANGES),
      occupation: { type: 'job', title: 'teacher' },
    });
    teacherIds.push(teacher.id);
    addRelationship({
      roles: { [teacher.id]: 'teacher', [playerId]: 'student' },
      affinity: { [teacher.id]: rng.nextInt(...TEACHER_AFFINITY), [playerId]: rng.nextInt(...TEACHER_AFFINITY) },
    });
  }

  return { people: nextPeople, relationships: nextRelationships, entry: { type: 'newClass', classmateIds, teacherIds } };
}

// Classmates who like each other enough become friends (and move to the
// Relationships screen). Returns the new friends' ids for the diary.
export function promoteFriendships(relationships, playerId) {
  const next = { ...relationships };
  const newFriendIds = [];
  for (const [id, relationship] of Object.entries(relationships)) {
    if (!(playerId in relationship.roles) || roleOfOther(relationship, playerId) !== 'classmate') continue;
    if (Object.values(relationship.affinity).every((value) => value >= FRIENDSHIP_THRESHOLD)) {
      next[id] = { ...withRoles(relationship, 'friend'), type: 'friendship' };
      newFriendIds.push(otherSide(relationship, playerId));
    }
  }
  return { relationships: next, newFriendIds };
}

// Current classmates and teachers, for the school screen.
export function schoolPeople(relationships, playerId) {
  const byRole = (role) =>
    Object.values(relationships)
      .filter((r) => playerId in r.roles && roleOfOther(r, playerId) === role)
      .map((r) => otherSide(r, playerId));
  return { classmates: byRole('classmate'), teachers: byRole('teacher') };
}
