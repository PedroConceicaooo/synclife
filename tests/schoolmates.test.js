import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { ageAt } from '../src/engine/time.js';
import { applyEffects } from '../src/engine/effects.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, continueAdvance, canContinueAdvance, isAdult, closePeople } from '../src/systems/game.js';
import { schoolEntryMonth } from '../src/systems/school.js';
import { startClass, promoteFriendships, schoolPeople, CLASS_SIZE, TEACHERS_PER_CLASS, FRIENDSHIP_THRESHOLD } from '../src/systems/schoolmates.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};

function newClassFor(state, month) {
  return startClass(createRng(1), { people: state.people, relationships: state.relationships, playerId: state.player.id, country: state.country, month });
}

test('a new class brings classmates of the same school cohort and adult teachers', () => {
  const state = createGameState({ seed: 3, ...DATA });
  const entry = schoolEntryMonth(state.player.birth, state.country.education);
  const result = newClassFor(state, entry);
  const { classmates, teachers } = schoolPeople(result.relationships, state.player.id);

  assert.equal(classmates.length, CLASS_SIZE);
  assert.equal(teachers.length, TEACHERS_PER_CLASS);
  assert.deepEqual(result.entry, { type: 'newClass', classmateIds: classmates, teacherIds: teachers });
  for (const id of classmates) {
    const classmate = result.people[id];
    assert.equal(schoolEntryMonth(classmate.birth, state.country.education), entry, 'same school year');
    assert.ok(classmate.firstName && classmate.lastName && classmate.aptitudes);
  }
  for (const id of teachers) {
    assert.ok(ageAt(result.people[id].birth, entry) >= 25);
    assert.equal(result.people[id].occupation.title, 'teacher');
  }
});

test('a new stage retires the old class but keeps friends', () => {
  const state = createGameState({ seed: 3, ...DATA });
  const entry = schoolEntryMonth(state.player.birth, state.country.education);
  const first = newClassFor(state, entry);
  const [friendId] = first.entry.classmateIds;
  const friendshipId = Object.keys(first.relationships).find((id) => friendId in first.relationships[id].roles);
  const withFriend = {
    ...first.relationships,
    [friendshipId]: { ...first.relationships[friendshipId], affinity: { [state.player.id]: 80, [friendId]: 80 } },
  };
  const promoted = promoteFriendships(withFriend, state.player.id);
  assert.deepEqual(promoted.newFriendIds, [friendId]);

  const second = startClass(createRng(2), {
    people: first.people,
    relationships: promoted.relationships,
    playerId: state.player.id,
    country: state.country,
    month: entry + 60,
  });
  const now = schoolPeople(second.relationships, state.player.id);
  assert.equal(now.classmates.length, CLASS_SIZE);
  assert.ok(first.entry.classmateIds.every((id) => !now.classmates.includes(id)));
  assert.ok(first.entry.teacherIds.every((id) => !now.teachers.includes(id)));
  assert.equal(second.relationships[friendshipId].roles[friendId], 'friend');
});

test('classmates become friends only when both sides reach the threshold', () => {
  const relationships = {
    r_1: { id: 'r_1', type: 'school', roles: { p_1: 'classmate', p_2: 'classmate' }, affinity: { p_1: FRIENDSHIP_THRESHOLD, p_2: FRIENDSHIP_THRESHOLD } },
    r_2: { id: 'r_2', type: 'school', roles: { p_1: 'classmate', p_3: 'classmate' }, affinity: { p_1: 90, p_3: FRIENDSHIP_THRESHOLD - 1 } },
  };
  const { relationships: next, newFriendIds } = promoteFriendships(relationships, 'p_1');
  assert.deepEqual(newFriendIds, ['p_2']);
  assert.equal(next.r_1.type, 'friendship');
  assert.deepEqual(next.r_1.roles, { p_1: 'friend', p_2: 'friend' });
  assert.equal(next.r_2.roles.p_3, 'classmate');
});

test('the roles effect rewrites both roles of the firing relationship', () => {
  const friendship = { id: 'r_1', type: 'friendship', roles: { p_1: 'friend', p_2: 'friend' }, affinity: { p_1: 70, p_2: 70 } };
  const result = applyEffects([{ op: 'roles', value: 'former_friend' }], {
    relationship: friendship,
    relationshipsById: { r_1: friendship },
    peopleById: {},
    playerId: 'p_1',
  });
  assert.deepEqual(result.relationshipsById.r_1.roles, { p_1: 'former_friend', p_2: 'former_friend' });
});

test('a whole life meets a new class at every school stage, and friends show up as close people', () => {
  let state = createGameState({ seed: 6, ...DATA });
  while (!isAdult(state)) {
    state = advanceStep(state, 12);
    while (state.pendingDecisions.length > 0 || canContinueAdvance(state)) {
      while (state.pendingDecisions.length > 0) state = resolveDecision(state);
      state = continueAdvance(state);
    }
  }
  const entries = state.history.flatMap((block) => block.entries);
  assert.equal(entries.filter((e) => e.type === 'newClass').length, state.country.education.stages.length);
  const { classmates, teachers } = schoolPeople(state.relationships, state.player.id);
  // Classmates who became friends left the class list for Relationships.
  assert.ok(classmates.length <= CLASS_SIZE);
  assert.equal(teachers.length, TEACHERS_PER_CLASS);
  assert.ok(closePeople(state).every((p) => !classmates.includes(p.personId)));
});
