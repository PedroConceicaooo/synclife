import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, availableActivities } from '../src/systems/game.js';
import { activityPage, parentPath, breadcrumb, itemStatus, sortItems, hasModalityPage, HOME_CATEGORIES } from '../src/ui/activityNav.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};

// A small hand-made list, shaped like availableActivities.
const judo = { id: 'judo', group: 'martial_arts', blocker: 'notEnrolled', enrollment: { enrolled: false }, levelId: 'white', competition: {} };
const karate = { id: 'karate', group: 'martial_arts', blocker: null, enrollment: { enrolled: true }, levelId: 'white' };
const ballet = { id: 'ballet', group: 'dance', blocker: null, enrollment: { enrolled: false } };
const football = { id: 'football', group: 'sports', blocker: null, teamSport: true, enrollment: { enrolled: false } };
const GROUPS = [
  { category: 'body_care', activities: [{ id: 'barbershop', blocker: null, makeover: true }, { id: 'dentist', blocker: null }] },
  { category: 'physical', activities: [football, judo, karate, ballet] },
  { category: 'odd_jobs', activities: [{ id: 'mow_lawn', blocker: 'limit' }, { id: 'walk_dogs', blocker: null }] },
];

test('level 1: one card per category with options, in the design order, with how many', () => {
  const page = activityPage(GROUPS, []);
  assert.equal(page.level, 1);
  assert.deepEqual(page.cards, [
    { kind: 'category', id: 'odd_jobs', count: 2 },
    { kind: 'category', id: 'physical', count: 4 },
    { kind: 'category', id: 'body_care', count: 2 },
  ]);
  assert.deepEqual(HOME_CATEGORIES, ['odd_jobs', 'leisure', 'physical', 'body_care', 'crime']);
});

test('level 2: physical activities open subcategory cards; odd jobs open the list, done ones last', () => {
  const physical = activityPage(GROUPS, ['physical']);
  assert.equal(physical.level, 2);
  assert.deepEqual(physical.cards.map((c) => [c.id, c.count, c.enrolled]), [
    ['sports', 1, 0],
    ['martial_arts', 2, 1],
    ['dance', 1, 0],
  ]);
  assert.deepEqual(physical.items, []);

  const jobs = activityPage(GROUPS, ['odd_jobs']);
  assert.deepEqual(jobs.cards, []);
  assert.deepEqual(jobs.items.map((i) => i.id), ['walk_dogs', 'mow_lawn']);
});

test('level 3 lists a subcategory; level 4 is a modality page, with clubs only for team sports', () => {
  const arts = activityPage(GROUPS, ['physical', 'martial_arts']);
  assert.equal(arts.level, 3);
  assert.deepEqual(arts.items.map((i) => i.id), ['judo', 'karate']);

  const page = activityPage(GROUPS, ['physical', 'martial_arts', 'judo']);
  assert.equal(page.kind, 'activity');
  assert.equal(page.level, 4);
  assert.equal(page.item, judo);

  assert.equal(activityPage(GROUPS, ['physical', 'sports', 'football', 'clubs']).kind, 'clubs');
  assert.equal(activityPage(GROUPS, ['physical', 'martial_arts', 'judo', 'clubs']).kind, 'activity', 'no clubs for judo');
});

test('a makeover opens its page; a one-tap activity has no page of its own', () => {
  assert.equal(activityPage(GROUPS, ['body_care', 'barbershop']).kind, 'makeover');
  const dentist = activityPage(GROUPS, ['body_care', 'dentist']);
  assert.equal(dentist.kind, 'category');
  assert.equal(hasModalityPage({ id: 'mow_lawn', blocker: null }), false);
  assert.equal(hasModalityPage(karate), true);
});

test('a path that no longer fits falls back to its deepest valid part', () => {
  assert.deepEqual(activityPage(GROUPS, ['crime']).path, []);
  assert.deepEqual(activityPage(GROUPS, ['physical', 'music']).path, ['physical']);
  assert.deepEqual(activityPage(GROUPS, ['physical', 'dance', 'judo']).path, ['physical', 'dance'], 'judo is not a dance');
  assert.deepEqual(activityPage(GROUPS, ['physical', 'martial_arts', 'tap_dance']).path, ['physical', 'martial_arts']);
});

test('back goes one level up, and the trail names the levels above the page', () => {
  const path = ['physical', 'sports', 'football', 'clubs'];
  assert.deepEqual(parentPath(path), ['physical', 'sports', 'football']);
  assert.deepEqual(parentPath(['odd_jobs']), []);

  assert.deepEqual(breadcrumb(activityPage(GROUPS, [])), []);
  assert.deepEqual(breadcrumb(activityPage(GROUPS, ['physical'])), [{ kind: 'home' }]);
  assert.deepEqual(breadcrumb(activityPage(GROUPS, ['physical', 'martial_arts'])), [{ kind: 'home' }, { kind: 'category', id: 'physical' }]);
  assert.deepEqual(breadcrumb(activityPage(GROUPS, path)), [
    { kind: 'home' },
    { kind: 'category', id: 'physical' },
    { kind: 'group', id: 'sports' },
    { kind: 'activity', id: 'football' },
  ]);
});

test('the status on the right of a row, and done items sorted last', () => {
  assert.equal(itemStatus({ blocker: 'limit' }), 'done');
  assert.equal(itemStatus({ blocker: 'competed' }), 'done');
  assert.equal(itemStatus(judo), 'needsEnrollment');
  assert.equal(itemStatus(karate), 'enrolled');
  assert.equal(itemStatus({ blocker: 'money' }), 'blocked');
  assert.equal(itemStatus({ blocker: null }), 'available');
  const a = { id: 'a', blocker: 'limit' };
  const b = { id: 'b', blocker: null };
  const c = { id: 'c', blocker: 'money' };
  assert.deepEqual(sortItems([a, b, c]).map((i) => i.id), ['b', 'c', 'a']);
});

// The real game: what a child can see hides the rest, and nothing is lost.
function stateAt(age) {
  const state = createGameState({ seed: 3, ...DATA });
  return { ...state, currentMonthIndex: state.player.birth + age * 12 };
}

test('in the game, categories without an option for the age are hidden, and every activity is reachable', () => {
  const young = activityPage(availableActivities(stateAt(5)), []);
  assert.ok(!young.cards.some((c) => c.id === 'crime'), 'no petty crimes at 5');

  for (const age of [5, 10, 14, 17]) {
    const groups = availableActivities(stateAt(age));
    const reached = new Set();
    for (const card of activityPage(groups, []).cards) {
      const category = activityPage(groups, [card.id]);
      for (const item of category.items) reached.add(item.id);
      for (const sub of category.cards) for (const item of activityPage(groups, [card.id, sub.id]).items) reached.add(item.id);
    }
    const all = groups.flatMap((g) => g.activities.map((a) => a.id));
    assert.deepEqual([...reached].sort(), [...all].sort(), `age ${age}`);
  }
});

test('in the game, physical activities split into sports, martial arts and dance', () => {
  const groups = availableActivities(stateAt(17));
  const page = activityPage(groups, ['physical']);
  assert.deepEqual(page.cards.map((c) => c.id), ['sports', 'martial_arts', 'dance']);
  assert.deepEqual(page.items, [], 'every physical activity has a subcategory');
  const counts = Object.fromEntries(page.cards.map((c) => [c.id, c.count]));
  assert.deepEqual(counts, { sports: 6, martial_arts: 10, dance: 7 });
});
