import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { ACTIVITY_CATEGORIES } from '../src/systems/activities.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const UI_DATA = readFileSync(new URL('../src/ui/data.js', import.meta.url), 'utf8');

const ACTIVITIES = Object.values(loadActivities(ACTIVITIES_DIR));
const EVENTS_BY_ID = loadEvents(EVENTS_DIR);
const SCALES = ['small', 'medium', 'large'];

test('every activity declares minAge (CLAUDE.md rule 8), a known category and known money scales', () => {
  for (const activity of ACTIVITIES) {
    assert.equal(typeof activity.conditions.minAge, 'number', activity.id);
    assert.ok(ACTIVITY_CATEGORIES.includes(activity.category), activity.id);
    if (activity.earnings) assert.ok(SCALES.includes(activity.earnings), activity.id);
    if (activity.cost) assert.ok(SCALES.includes(activity.cost), activity.id);
  }
});

test('activity random events exist and are never rolled on their own', () => {
  for (const activity of ACTIVITIES) {
    for (const { event, chance } of activity.randomEvents ?? []) {
      assert.ok(EVENTS_BY_ID[event], `${activity.id} -> ${event}`);
      assert.equal(EVENTS_BY_ID[event].yearlyChance, undefined, event);
      assert.ok(chance > 0 && chance <= 1, `${activity.id} -> ${event}`);
    }
  }
});

test('every activity and category has its texts in pt-BR', () => {
  for (const activity of ACTIVITIES) {
    for (const key of ['title', 'description', 'done']) {
      assert.ok(LOCALE[`activity.${activity.id}.${key}`], `${activity.id}.${key}`);
    }
    assert.ok(LOCALE[`activityCategory.${activity.category}`], activity.category);
  }
});

test('the browser manifest lists every activity file', () => {
  for (const fileName of readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.json'))) {
    assert.ok(UI_DATA.includes(`'${fileName}'`), fileName);
  }
});
