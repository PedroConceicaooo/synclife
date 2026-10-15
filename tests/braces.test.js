import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { takeOffBraces } from '../src/systems/braces.js';
import { applyEffects } from '../src/engine/effects.js';
import { evaluateConditions } from '../src/engine/conditions.js';
import { attemptActivity, listActivities } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { createGameState, advanceStep, attemptPlayerActivity } from '../src/systems/game.js';
import { renderAvatar } from '../src/ui/avatar.js';
import { createLocale } from '../src/i18n/locale.js';
import { describeBlock } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const ACTIVITIES = loadActivities(dir('activities'));
const EVENTS = loadEvents(dir('events'));
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } }, education: { schoolYearStartMonth: 2, stages: [] } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };
const teen = (extra = {}) => ({ id: 'p_kid', sex: 'M', birth: 0, money: 1000, stats: { ...STATS }, ...extra });

test('the braces effect puts them on for its months, on the avatar too', () => {
  const result = applyEffects([{ op: 'braces', months: 24, activity: 'orthodontics' }], { peopleById: { p_kid: teen() }, relationshipsById: {}, playerId: 'p_kid', currentMonthIndex: 150 });
  const wearing = result.peopleById.p_kid;
  assert.deepEqual(wearing.braces, { until: 174, activityId: 'orthodontics' });
  assert.equal(wearing.appearance.braces, true);
  assert.equal(evaluateConditions({ hasBraces: true }, wearing), true);
  assert.equal(evaluateConditions({ hasBraces: false }, teen()), true);
});

test('the orthodontist: 10 to 17, hidden while wearing braces, costs the large scale', () => {
  const ids = (person, age) => listActivities(ACTIVITIES, { player: person, country: COUNTRY, currentMonthIndex: age * 12 }).flatMap((g) => g.activities).map((a) => a.id);
  assert.ok(!ids(teen(), 9).includes('orthodontics'));
  assert.ok(ids(teen(), 12).includes('orthodontics'));
  assert.ok(!ids(teen(), 18).includes('orthodontics'));
  assert.ok(!ids(teen({ braces: { until: 300, activityId: 'orthodontics' } }), 12).includes('orthodontics'));
  const done = attemptActivity(ACTIVITIES.orthodontics, { player: teen(), peopleById: { p_kid: teen() }, country: COUNTRY, currentMonthIndex: 144 });
  assert.equal(done.peopleById.p_kid.money, 800);
  assert.equal(done.peopleById.p_kid.braces.until, 144 + 24);
});

test('takeOffBraces: when the time is up, off they come with the finishing effects', () => {
  const wearing = teen({ braces: { until: 170, activityId: 'orthodontics' }, appearance: { skinTone: 1, hairStyle: 'short', hairColor: 'brown', naturalHairColor: null, eyeColor: 'brown', shirtColor: 0, beard: false, braces: true } });
  const early = takeOffBraces({ p_kid: wearing }, 'p_kid', 169, { activitiesById: ACTIVITIES, relationshipsById: {} });
  assert.deepEqual(early.entries, []);
  const off = takeOffBraces({ p_kid: wearing }, 'p_kid', 172, { activitiesById: ACTIVITIES, relationshipsById: {} });
  assert.deepEqual(off.entries, [{ type: 'bracesOff', activityId: 'orthodontics' }]);
  assert.equal(off.peopleById.p_kid.braces, undefined);
  assert.equal(off.peopleById.p_kid.appearance.braces, false);
  assert.equal(off.peopleById.p_kid.stats.looks, 55);
});

test('the avatar shows braces past babyhood', () => {
  const look = { skinTone: 1, hairStyle: 'short', hairColor: 'brown', naturalHairColor: null, eyeColor: 'brown', shirtColor: 0, beard: false };
  assert.ok(renderAvatar({ ...look, braces: true }, 'M', 'teen').length > renderAvatar(look, 'M', 'teen').length);
});

test('braces events need braces', () => {
  for (const id of ['braces_tightening', 'braces_teased']) assert.equal(EVENTS[id].conditions.hasBraces, true, id);
});

test('in the game: braces on, then off two years later, told in the diary', () => {
  let state = createGameState({ seed: 4, countriesById: loadCountries(dir('countries')), eventsById: {}, interactionsById: {}, activitiesById: ACTIVITIES });
  const id = state.player.id;
  state = { ...state, currentMonthIndex: state.player.birth + 12 * 12, people: { ...state.people, [id]: { ...state.people[id], money: 1e7 } } };
  const on = attemptPlayerActivity(state, 'orthodontics');
  assert.ok(on.people[id].braces);
  const off = advanceStep(advanceStep(on, 12), 12);
  assert.equal(off.people[id].braces, undefined);
  const lines = off.history.flatMap((block) => describeBlock(block, off, LOCALE).lines.map((l) => l.text));
  assert.ok(lines.includes('Tirei o aparelho! O sorriso ficou outro.'), lines.join('\n'));
});
