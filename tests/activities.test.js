import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { indexActivities, attemptActivity } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };

test('loadActivities loads mow_lawn by id', () => {
  const activitiesById = loadActivities(ACTIVITIES_DIR);
  assert.ok(activitiesById.mow_lawn);
  assert.equal(activitiesById.mow_lawn.earnings, 'small');
});

test('attemptActivity pays earnings resolved via the country scale when conditions are met', () => {
  const mowLawn = loadActivities(ACTIVITIES_DIR).mow_lawn;
  const player = { id: 'p_player', birth: -144 }; // age 12 at currentMonthIndex 0, minAge 10
  const peopleById = { p_player: { id: 'p_player', money: 0 } };

  const result = attemptActivity(mowLawn, { player, peopleById, country: COUNTRY, currentMonthIndex: 0 });

  assert.equal(result.attempted, true);
  assert.equal(result.peopleById.p_player.money, 10);
});

test('attemptActivity does not pay when the player is under minAge', () => {
  const mowLawn = loadActivities(ACTIVITIES_DIR).mow_lawn;
  const player = { id: 'p_player', birth: 0 }; // age 0 at currentMonthIndex 0
  const peopleById = { p_player: { id: 'p_player', money: 0 } };

  const result = attemptActivity(mowLawn, { player, peopleById, country: COUNTRY, currentMonthIndex: 0 });

  assert.equal(result.attempted, false);
  assert.equal(result.peopleById.p_player.money, 0);
});

test('indexActivities builds a map by id from an in-memory array (no fs)', () => {
  const activitiesById = indexActivities([{ id: 'mow_lawn', earnings: 'small' }]);
  assert.deepEqual(Object.keys(activitiesById), ['mow_lawn']);
});
