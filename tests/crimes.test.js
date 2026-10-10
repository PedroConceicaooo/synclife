import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, attemptPlayerActivity } from '../src/systems/game.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const CAUGHT = { chance: (p) => p >= 1, nextInt: (min) => min, next: () => 0 }; // every check fails, "chance 1" events happen
const UNSEEN = { chance: () => true, nextInt: (min) => min, next: () => 0 };

function shopliftAt(countryId, ageYears, rng) {
  const base = createGameState({ seed: 7, ...DATA, choices: { countryId } });
  const state = { ...base, rng, currentMonthIndex: base.player.birth + ageYears * 12 + 1 };
  return { before: state, after: attemptPlayerActivity(state, 'shoplift') };
}

test('getting caught brings the parents below the country age of criminal responsibility, the police above it', () => {
  const cases = [
    ['BR', 11, 'caught_by_parents'],
    ['BR', 13, 'caught_by_police'],
    ['JP', 13, 'caught_by_parents'],
    ['JP', 14, 'caught_by_police'],
    ['GB', 11, 'caught_by_police'],
  ];
  for (const [countryId, age, expected] of cases) {
    const { after } = shopliftAt(countryId, age, CAUGHT);
    assert.deepEqual(after.lastActivityResult.triggeredEvents, [expected], `${countryId} at ${age}`);
    assert.equal(after.lastActivityResult.succeeded, false);
  }
});

test('a caught theft pays nothing, angers and stresses the parents, and shames the player', () => {
  const { before, after } = shopliftAt('BR', 11, CAUGHT);
  const id = before.player.id;
  assert.equal(after.people[id].money, before.people[id].money);
  assert.ok(after.relationships[before.motherChildId].affinity[before.mother.id] < before.relationships[before.motherChildId].affinity[before.mother.id]);
  assert.ok(after.people[before.mother.id].stress > before.people[before.mother.id].stress);
  assert.equal(after.people[id].emotion.type, 'ashamed');
  const entries = after.history.at(-1).entries;
  assert.ok(entries.some((e) => e.type === 'activity' && e.activityId === 'shoplift' && e.succeeded === false));
  assert.ok(entries.some((e) => e.type === 'event' && e.eventId === 'caught_by_parents'));
});

test('an unseen theft pays and sets off nothing', () => {
  const { before, after } = shopliftAt('BR', 11, UNSEEN);
  assert.equal(after.lastActivityResult.succeeded, true);
  assert.deepEqual(after.lastActivityResult.triggeredEvents, []);
  assert.ok(after.people[before.player.id].money > before.people[before.player.id].money);
});

test('every country has an age of criminal responsibility with a source, and crimes have a failure text', () => {
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const country = resolveCountry(id, DATA.countriesById);
    assert.equal(typeof country.ages.criminalResponsibility, 'number', id);
    assert.ok(country.legalSources['ages.criminalResponsibility']?.source, id);
  }
  for (const activity of Object.values(DATA.activitiesById).filter((a) => a.check)) {
    assert.ok(LOCALE[`activity.${activity.id}.failed`], activity.id);
  }
});
