import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askParentPermission, needsPermission } from '../src/systems/enrollment.js';
import { makeoverOptions, isValidChoice, applyMakeover } from '../src/systems/makeover.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { createGameState, attemptPlayerActivity, advanceStep } from '../src/systems/game.js';
import { renderAvatar } from '../src/ui/avatar.js';
import { createLocale } from '../src/i18n/locale.js';
import { makeoverLine, describeBlock } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const ACTIVITIES = loadActivities(dir('activities'));
const PIERCING = ACTIVITIES.ear_piercing;
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));

function lifeAt(age, chance) {
  let state = createGameState({ seed: 6, countriesById: loadCountries(dir('countries')), eventsById: {}, interactionsById: {}, activitiesById: ACTIVITIES });
  const id = state.player.id;
  state = { ...state, currentMonthIndex: state.player.birth + age * 12, people: { ...state.people, [id]: { ...state.people[id], money: 1e6 } } };
  return chance ? { ...state, rng: { ...state.rng, chance } } : state;
}

test('the piercing asks the parents under 18 (its own parentPermission block)', () => {
  assert.equal(needsPermission(PIERCING, { birth: 0 }, 17 * 12), true);
  assert.equal(needsPermission(PIERCING, { birth: 0 }, 18 * 12), false);
  const state = lifeAt(13, () => true);
  const answer = askParentPermission(PIERCING, { playerId: state.player.id, peopleById: state.people, relationshipsById: state.relationships, country: state.country, currentMonthIndex: state.currentMonthIndex, rng: state.rng });
  assert.equal(answer.allowed, true);
  assert.ok(answer.parentId);
});

test('earrings: a stud or a hoop, on the avatar', () => {
  assert.deepEqual(makeoverOptions(PIERCING, { sex: 'M' }).earrings, ['stud', 'hoop']);
  assert.equal(isValidChoice(PIERCING, { sex: 'M' }, { earrings: 'nose_ring' }), false);
  const look = { skinTone: 1, hairStyle: 'short', hairColor: 'brown', naturalHairColor: null, eyeColor: 'brown', shirtColor: 0, beard: false };
  const pierced = applyMakeover({ sex: 'M', appearance: look }, { earrings: 'hoop' });
  assert.equal(pierced.appearance.earrings, 'hoop');
  assert.ok(renderAvatar(pierced.appearance, 'M', 'teen').length > renderAvatar(look, 'M', 'teen').length);
  assert.equal(makeoverLine(LOCALE, 'ear_piercing', { earrings: 'stud' }, 'M'), 'Furei a orelha e saí com um ponto de luz.');
});

test('in the game: with a yes the ear is pierced and the diary says who allowed it', () => {
  const state = lifeAt(13, () => true);
  const done = attemptPlayerActivity(state, 'ear_piercing', { earrings: 'stud' });
  const id = state.player.id;
  assert.equal(done.people[id].appearance.earrings, 'stud');
  const types = done.history.at(-1).entries.map((e) => e.type);
  assert.equal(types.indexOf('activity'), types.indexOf('permissionGranted') + 1);
  const lines = describeBlock(done.history.at(-1), done, LOCALE).lines.map((l) => l.text);
  assert.ok(lines.some((l) => /Furar a orelha: .* deixou\./.test(l)), lines.join('\n'));
});

test('in the game: a no holds for the period; an adult needs nobody', () => {
  const refused = attemptPlayerActivity(lifeAt(13, () => false), 'ear_piercing', { earrings: 'hoop' });
  const id = refused.player.id;
  assert.equal(refused.people[id].appearance?.earrings ?? null, null);
  assert.equal(refused.history.at(-1).entries.at(-1).type, 'permissionRefused');
  const again = attemptPlayerActivity({ ...refused, rng: { ...refused.rng, chance: () => true } }, 'ear_piercing', { earrings: 'hoop' });
  assert.equal(again.lastActivityResult.reason, 'permissionRefused');
  assert.deepEqual(advanceStep(refused, 6).permissionRefusedThisPeriod, {});

  const adult = attemptPlayerActivity(lifeAt(18, () => false), 'ear_piercing', { earrings: 'hoop' });
  assert.equal(adult.people[adult.player.id].appearance.earrings, 'hoop');
  assert.ok(!adult.history.at(-1).entries.some((e) => e.type === 'permissionGranted'));
});
