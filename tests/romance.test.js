import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadAssets } from '../src/systems/assetsLoader.js';
import { resolveChance } from '../src/systems/interactions.js';
import { processRelationshipEvents } from '../src/systems/events.js';
import { startClass, schoolPeople } from '../src/systems/schoolmates.js';
import { fullName } from '../src/systems/naming.js';
import { createGameState, attemptPlayerInteraction, availableInteractions, closePeople } from '../src/systems/game.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
  assetsById: loadAssets(dir('assets')),
};
const ALWAYS = { chance: () => true, nextInt: (min) => min, next: () => 0 };
const NEVER = { chance: () => false, nextInt: (min) => min, next: () => 0 };

// A player of `ageYears` with a fresh class (classmates the same age).
function teenWithClass(ageYears, seed = 3) {
  const base = createGameState({ seed, ...DATA, choices: { countryId: 'BR' } });
  const month = base.player.birth + ageYears * 12;
  const school = startClass(createRng(seed), { people: base.people, relationships: base.relationships, playerId: base.player.id, country: base.country, month });
  return { ...base, currentMonthIndex: month, people: school.people, relationships: school.relationships };
}

const roleOf = (state, personId) => Object.values(state.relationships).find((r) => personId in r.roles && state.player.id in r.roles).roles[personId];
const ids = (state, personId) => availableInteractions(state, personId).flatMap((g) => g.interactionIds);

test('asking someone out is only for teenagers', () => {
  const twelve = teenWithClass(12);
  const fourteen = teenWithClass(14);
  const [a] = schoolPeople(twelve.relationships, twelve.player.id).classmates;
  const [b] = schoolPeople(fourteen.relationships, fourteen.player.id).classmates;
  assert.ok(!ids(twelve, a).includes('ask_out'));
  assert.ok(ids(fourteen, b).includes('ask_out'));
});

test('a yes turns a classmate into a partner who moves to Relationships', () => {
  let state = { ...teenWithClass(14), rng: ALWAYS };
  const [crush] = schoolPeople(state.relationships, state.player.id).classmates;
  state = attemptPlayerInteraction(state, 'ask_out', crush);

  assert.equal(roleOf(state, crush), 'partner');
  assert.ok(closePeople(state).some((p) => p.personId === crush && p.role === 'partner'));
  assert.ok(!schoolPeople(state.relationships, state.player.id).classmates.includes(crush));
  const partnerIds = ids(state, crush);
  for (const id of ['send_note', 'go_on_date', 'hold_hands', 'introduce_to_parents', 'break_up']) assert.ok(partnerIds.includes(id), id);
});

test('parents can forbid the relationship, and dating in secret can be found out', () => {
  let state = { ...teenWithClass(14), rng: ALWAYS };
  const [crush] = schoolPeople(state.relationships, state.player.id).classmates;
  state = attemptPlayerInteraction(state, 'ask_out', crush);
  state = attemptPlayerInteraction({ ...state, rng: NEVER }, 'introduce_to_parents', crush);
  const relationship = Object.values(state.relationships).find((r) => crush in r.roles && state.player.id in r.roles);
  assert.equal(relationship.state, 'forbidden');
  assert.ok(!ids(state, crush).includes('introduce_to_parents'));

  const motherBefore = state.relationships[state.motherChildId].affinity[state.mother.id];
  const world = processRelationshipEvents({ secret_dating_discovered: DATA.eventsById.secret_dating_discovered }, state.relationships, {
    currentMonthIndex: state.currentMonthIndex,
    step: 12,
    rng: ALWAYS,
    playerId: state.player.id,
    peopleById: state.people,
    country: state.country,
  });
  assert.deepEqual(world.fired.map((f) => f.eventId), ['secret_dating_discovered']);
  assert.equal(world.relationshipsById[relationship.id].roles[crush], 'ex');
  assert.equal(world.relationshipsById[state.motherChildId].affinity[state.mother.id], motherBefore - 10);
});

test('rigid parents and low acceptance of same-sex couples lower the approval chance', () => {
  const chance = { base: 0.7, modifiers: DATA.interactionsById.introduce_to_parents.chance.modifiers };
  const player = { id: 'p_1', sex: 'F', traits: [], stats: {} };
  const relationshipsById = { r_1: { roles: { p_1: 'daughter', p_2: 'mother' } } };
  const context = (motherTraits, partnerSex, acceptance) => ({
    player,
    target: { id: 'p_3', sex: partnerSex, traits: [] },
    relationshipsById,
    peopleById: { p_2: { id: 'p_2', traits: motherTraits } },
    playerId: 'p_1',
    country: { topics: { same_sex_relationship: { acceptance } } },
  });
  assert.ok(Math.abs(resolveChance(chance, context([], 'M', null)) - 0.7) < 1e-9);
  assert.ok(resolveChance(chance, context(['rigid'], 'M', null)) < 0.7);
  // Unknown acceptance is neutral; a low one only matters for same-sex pairs.
  assert.ok(Math.abs(resolveChance(chance, context([], 'F', null)) - 0.7) < 1e-9);
  assert.ok(resolveChance(chance, context([], 'F', 20)) < 0.7);
  assert.ok(Math.abs(resolveChance(chance, context([], 'M', 20)) - 0.7) < 1e-9);
});

test('breaking up leaves an ex, who can be asked out again', () => {
  let state = { ...teenWithClass(15), rng: ALWAYS };
  const [crush] = schoolPeople(state.relationships, state.player.id).classmates;
  state = attemptPlayerInteraction(state, 'ask_out', crush);
  state = attemptPlayerInteraction(state, 'break_up', crush);
  assert.equal(roleOf(state, crush), 'ex');
  assert.ok(ids(state, crush).includes('ask_out'));
});

test('parents can say yes to a pet; one pet at a time, and only dogs go for walks', () => {
  let state = { ...teenWithClass(8), rng: ALWAYS };
  assert.ok(ids(state, state.mother.id).includes('ask_for_dog'));
  state = attemptPlayerInteraction(state, 'ask_for_dog', state.mother.id);

  const pet = closePeople(state).find((p) => p.role === 'pet');
  assert.ok(pet);
  const dog = state.people[pet.personId];
  assert.equal(dog.species, 'dog');
  assert.equal(fullName(dog, state.country), dog.firstName);
  assert.ok(state.country.petNames.dog.includes(dog.firstName));
  assert.ok(!ids(state, state.mother.id).includes('ask_for_cat'));
  assert.deepEqual(ids(state, dog.id).sort(), ['pet_animal', 'play_with_pet', 'walk_dog']);
});
