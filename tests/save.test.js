import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, attemptPlayerInteraction, attemptPlayerActivity } from '../src/systems/game.js';
import { toSave, fromSave, migrate, SAVE_VERSION } from '../src/systems/save.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};

function play(state, turns) {
  let s = state;
  for (let i = 0; i < turns; i++) {
    s = advanceStep(s, i % 2 ? 12 : 6);
    while (s.pendingDecisions.length > 0) s = resolveDecision(s);
    s = attemptPlayerInteraction(s, 'chat', s.mother.id);
    s = attemptPlayerActivity(s, 'mow_lawn');
    while (s.pendingDecisions.length > 0) s = resolveDecision(s);
  }
  return s;
}

const comparable = (state) => JSON.parse(JSON.stringify(toSave(state)));

test('a save survives JSON and the loaded game continues exactly like the original', () => {
  for (const seed of [3, 8, 21]) {
    const midway = play(createGameState({ seed, ...DATA }), 8);
    const loaded = fromSave(JSON.parse(JSON.stringify(toSave(midway))), DATA);

    assert.deepEqual(comparable(loaded), comparable(midway));
    assert.deepEqual(comparable(play(loaded, 10)), comparable(play(midway, 10)), `seed ${seed}`);
  }
});

test('a loaded save rebuilds the player and family pointers', () => {
  const state = play(createGameState({ seed: 5, ...DATA }), 4);
  const loaded = fromSave(toSave(state), DATA);

  assert.equal(loaded.player.id, state.player.id);
  assert.equal(loaded.mother.id, state.mother.id);
  assert.equal(loaded.father.id, state.father.id);
  assert.equal(loaded.motherChildId, state.motherChildId);
  assert.equal(loaded.fatherChildId, state.fatherChildId);
  assert.equal(loaded.marriageId, state.marriageId);
  assert.equal(loaded.country.id, state.country.id);
});

test('a save keeps a pending decision', () => {
  let state = createGameState({ seed: 9, ...DATA });
  state = advanceStep(state, 12);
  assert.ok(state.pendingDecisions.length > 0);
  const loaded = fromSave(JSON.parse(JSON.stringify(toSave(state))), DATA);
  assert.deepEqual(loaded.pendingDecisions, JSON.parse(JSON.stringify(state.pendingDecisions)));
});

test('saves carry their version and unknown versions are refused', () => {
  const save = toSave(createGameState({ seed: 1, ...DATA }));
  assert.equal(save.saveVersion, SAVE_VERSION);
  assert.throws(() => fromSave({ ...save, saveVersion: 999 }, DATA), /Unsupported save version/);
});

test('a version 1 save (before team sports) is converted and keeps playing', () => {
  const state = play(createGameState({ seed: 21, ...DATA }), 4);
  const v1 = JSON.parse(JSON.stringify({ ...toSave(state), saveVersion: 1 }));
  for (const person of Object.values(v1.people)) {
    delete person.teams;
    delete person.tryouts;
    delete person.tryoutSignups;
  }

  const migrated = migrate(v1);
  assert.equal(migrated.saveVersion, SAVE_VERSION);
  for (const person of Object.values(migrated.people)) {
    assert.deepEqual([person.teams, person.tryouts, person.tryoutSignups], [[], [], []], person.id);
  }
  assert.equal(migrate(migrated), migrated, 'a current save is left as it is');

  const loaded = fromSave(v1, DATA);
  assert.deepEqual(loaded.people[loaded.player.id].teams, []);
  assert.doesNotThrow(() => play(loaded, 2));
  assert.throws(() => fromSave({ ...v1, saveVersion: 0 }, DATA), /Unsupported save version/);
});

test('a version 2 save keeps paying the allowance it already paid, without the offer', () => {
  // Version 2 paid from 3 years on: a 4-year-old was already getting it.
  const young = createGameState({ seed: 21, ...DATA });
  const v2 = (state, month) => JSON.parse(JSON.stringify({ ...toSave(state), currentMonth: month, saveVersion: 2 }));
  const playerId = young.player.id;

  const receiving = migrate(v2(young, young.player.birth + 4 * 12));
  assert.equal(receiving.saveVersion, 3);
  assert.deepEqual(receiving.people[playerId].allowance, { since: young.player.birth + 4 * 12, factor: 1 });

  const baby = migrate(v2(young, young.player.birth + 2 * 12));
  assert.equal(baby.people[playerId].allowance, undefined, 'a 2-year-old was not getting it yet');
  assert.ok(Object.values(receiving.people).every((p) => p.id === playerId || p.allowance === undefined), 'only the player had it');
});
