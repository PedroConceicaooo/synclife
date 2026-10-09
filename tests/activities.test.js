import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { indexActivities, attemptActivity, listActivities, activityBlocker } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };

const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };

const FIXTURE = indexActivities([
  { id: 'job', category: 'odd_jobs', conditions: { minAge: 10 }, earnings: 'medium', effects: [{ op: 'stat', target: 'player', stat: 'health', delta: 2 }] },
  { id: 'tip_job', category: 'odd_jobs', conditions: { minAge: 8 }, earnings: 'small', randomEvents: [{ event: 'tip', chance: 0.5 }] },
  { id: 'park', category: 'leisure', conditions: { minAge: 6 }, cost: 'medium', effects: [{ op: 'stat', target: 'player', stat: 'happiness', delta: 5 }] },
  { id: 'teen_job', category: 'odd_jobs', conditions: { minAge: 14 }, earnings: 'medium' },
]);

function args({ ageYears = 12, money = 0, usesThisPeriod = 0, rng } = {}) {
  const player = { id: 'p_player', birth: 0, money, stats: { ...STATS } };
  return { player, peopleById: { p_player: player }, country: COUNTRY, currentMonthIndex: ageYears * 12, usesThisPeriod, rng };
}

test('loadActivities loads every activity file by id with a category and minAge', () => {
  const activitiesById = loadActivities(ACTIVITIES_DIR);
  assert.ok(activitiesById.mow_lawn);
  for (const activity of Object.values(activitiesById)) {
    assert.ok(activity.category, activity.id);
    assert.equal(typeof activity.conditions.minAge, 'number', activity.id);
  }
});

test('attemptActivity pays earnings via the country scale and applies effects', () => {
  const result = attemptActivity(FIXTURE.job, args());

  assert.equal(result.attempted, true);
  assert.equal(result.peopleById.p_player.money, 50);
  assert.equal(result.peopleById.p_player.stats.health, 52);
});

test('attemptActivity charges the cost and refuses when the player cannot afford it', () => {
  const paid = attemptActivity(FIXTURE.park, args({ money: 60 }));
  assert.equal(paid.peopleById.p_player.money, 10);
  assert.equal(paid.peopleById.p_player.stats.happiness, 55);

  const broke = attemptActivity(FIXTURE.park, args({ money: 49 }));
  assert.equal(broke.attempted, false);
  assert.equal(broke.reason, 'money');
  assert.equal(broke.peopleById.p_player.money, 49);
});

test('attemptActivity refuses under minAge and over the per-period limit', () => {
  assert.equal(attemptActivity(FIXTURE.job, args({ ageYears: 9 })).reason, 'conditions');
  assert.equal(attemptActivity(FIXTURE.job, args({ usesThisPeriod: 1 })).reason, 'limit');
});

test('attemptActivity reports random events that rolled', () => {
  const hit = attemptActivity(FIXTURE.tip_job, args({ rng: { chance: () => true } }));
  const miss = attemptActivity(FIXTURE.tip_job, args({ rng: { chance: () => false } }));
  assert.deepEqual(hit.triggeredEvents, ['tip']);
  assert.deepEqual(miss.triggeredEvents, []);
});

test('listActivities groups by category, hides by age, and keeps limit/money blockers visible', () => {
  const player = { id: 'p_player', birth: 0, money: 0 };
  const groups = listActivities(FIXTURE, { player, country: COUNTRY, currentMonthIndex: 12 * 12, usesById: { job: 1 } });

  assert.deepEqual(groups, [
    {
      category: 'odd_jobs',
      activities: [
        { id: 'tip_job', blocker: null },
        { id: 'job', blocker: 'limit' },
      ],
    },
    { category: 'leisure', activities: [{ id: 'park', blocker: 'money' }] },
  ]);
});

test('activityBlocker is null when the activity can be done', () => {
  const player = { id: 'p_player', birth: 0, money: 100 };
  assert.equal(activityBlocker(FIXTURE.park, { player, country: COUNTRY, currentMonthIndex: 120 }), null);
});

test('indexActivities builds a map by id from an in-memory array (no fs)', () => {
  const activitiesById = indexActivities([{ id: 'mow_lawn', earnings: 'small' }]);
  assert.deepEqual(Object.keys(activitiesById), ['mow_lawn']);
});
