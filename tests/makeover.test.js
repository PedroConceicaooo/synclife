import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeoverOptions, isValidChoice, applyMakeover, currentChoice } from '../src/systems/makeover.js';
import { HAIR_STYLE_IDS, HAIR_COLORS } from '../src/systems/appearance.js';
import { attemptActivity, listActivities } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { evaluateConditions } from '../src/engine/conditions.js';
import { createLocale } from '../src/i18n/locale.js';
import { makeoverLine } from '../src/ui/diary.js';
import { renderAvatar } from '../src/ui/avatar.js';
import { createGameState, attemptPlayerActivity, askParentsToPayActivity } from '../src/systems/game.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadRequests } from '../src/systems/requestsLoader.js';

const ACTIVITIES = loadActivities(fileURLToPath(new URL('../data/activities/', import.meta.url)));
const LOCALE_ENTRIES = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } }, education: { schoolYearStartMonth: 2, stages: [] } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };
const look = { skinTone: 2, hairStyle: 'long', hairColor: 'brown', naturalHairColor: null, eyeColor: 'brown', shirtColor: 0, beard: false };
const girl = (money = 1000) => ({ id: 'p_kid', sex: 'F', birth: 0, money, stats: { ...STATS }, appearance: { ...look } });

test('the barber and the hairdresser are for one sex each (condition sex)', () => {
  assert.equal(evaluateConditions({ sex: 'F' }, { sex: 'F' }), true);
  assert.equal(evaluateConditions({ sex: 'M' }, { sex: 'F' }), false);
  const list = (sex) =>
    listActivities(ACTIVITIES, { player: { ...girl(), sex }, country: COUNTRY, currentMonthIndex: 120 })
      .flatMap((g) => g.activities)
      .map((a) => a.id);
  assert.ok(list('F').includes('hair_salon') && !list('F').includes('barbershop'));
  assert.ok(list('M').includes('barbershop') && !list('M').includes('hair_salon'));
  assert.ok(!list('M').includes('shave'), 'shaving waits for 18');
});

test('makeoverOptions: cuts of the person\'s sex, the service\'s colors, the beard', () => {
  const salon = makeoverOptions(ACTIVITIES.hair_salon, girl());
  assert.deepEqual(salon.hairStyles, HAIR_STYLE_IDS.F);
  assert.ok(salon.hairColors.includes('blue') && !salon.hairColors.includes('gray'));
  assert.equal(salon.beard, false);
  assert.deepEqual(makeoverOptions(ACTIVITIES.barbershop, { sex: 'M' }).hairColors, []);
  assert.equal(makeoverOptions(ACTIVITIES.shave, { sex: 'M' }).beard, true);
});

test('isValidChoice only takes what the service offers', () => {
  assert.equal(isValidChoice(ACTIVITIES.hair_salon, girl(), { hairStyle: 'bob', hairColor: 'pink' }), true);
  assert.equal(isValidChoice(ACTIVITIES.hair_salon, girl(), { hairStyle: 'afro' }), false, 'a cut of the other sex');
  assert.equal(isValidChoice(ACTIVITIES.barbershop, { sex: 'M' }, { hairColor: 'blue' }), false, 'the barber does not dye');
  assert.equal(isValidChoice(ACTIVITIES.hair_salon, girl(), { beard: true }), false);
  assert.equal(isValidChoice(ACTIVITIES.hair_salon, girl(), {}), true);
});

test('applyMakeover: a dye keeps the natural color for the children; going back clears it', () => {
  const dyed = applyMakeover(girl(), { hairStyle: 'bob', hairColor: 'blue' });
  assert.deepEqual([dyed.appearance.hairStyle, dyed.appearance.hairColor, dyed.appearance.naturalHairColor], ['bob', 'blue', 'brown']);
  const back = applyMakeover(dyed, { hairColor: 'brown' });
  assert.deepEqual([back.appearance.hairColor, back.appearance.naturalHairColor], ['brown', null]);
  const twice = applyMakeover(applyMakeover(girl(), { hairColor: 'pink' }), { hairColor: 'blue' });
  assert.equal(twice.appearance.naturalHairColor, 'brown');
  assert.deepEqual(currentChoice(dyed), { hairStyle: 'bob', hairColor: 'blue', beard: false, glasses: 'none', earrings: null });
});

test('attemptActivity pays, applies the pick, and refuses a pick the service lacks', () => {
  const args = { player: girl(), peopleById: { p_kid: girl() }, country: COUNTRY, currentMonthIndex: 120 };
  const done = attemptActivity(ACTIVITIES.hair_salon, { ...args, choice: { hairStyle: 'ponytail', hairColor: 'red' } });
  assert.equal(done.attempted, true);
  assert.equal(done.peopleById.p_kid.money, 950);
  assert.deepEqual(done.makeover, { hairStyle: 'ponytail', hairColor: 'red', beard: false, glasses: 'none', earrings: null });

  const trim = attemptActivity(ACTIVITIES.hair_salon, args);
  assert.deepEqual(trim.peopleById.p_kid.appearance, look, 'no pick: a trim, the same look');
  assert.equal(attemptActivity(ACTIVITIES.hair_salon, { ...args, choice: { hairStyle: 'buzz' } }).reason, 'invalidChoice');
});

test('the diary line says the new look; every cut and color has a name', () => {
  const locale = createLocale(LOCALE_ENTRIES);
  assert.equal(makeoverLine(locale, 'hair_salon', { hairStyle: 'bob', hairColor: 'pink' }, 'F'), 'Saí do salão com chanel, cabelo rosa.');
  assert.equal(makeoverLine(locale, 'barbershop', { hairStyle: 'quiff', hairColor: 'black' }, 'M'), 'Saí do barbeiro com topete.');
  for (const id of [...HAIR_STYLE_IDS.M, ...HAIR_STYLE_IDS.F]) assert.ok(LOCALE_ENTRIES[`hairStyle.${id}`], id);
  for (const id of Object.keys(HAIR_COLORS)) assert.ok(LOCALE_ENTRIES[`hairColor.${id}`], id);
  for (const activity of Object.values(ACTIVITIES).filter((a) => a.makeover)) {
    for (const color of activity.makeover.hairColors ?? []) assert.ok(color in HAIR_COLORS, `${activity.id}: ${color}`);
  }
});

test('in the game: the pick reaches the diary, also when the parents pay', () => {
  const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
  let state;
  for (let seed = 1; !state; seed++) {
    const s = createGameState({ seed, countriesById: loadCountries(dir('countries')), eventsById: {}, interactionsById: {}, activitiesById: ACTIVITIES, requestsById: loadRequests(dir('requests')) });
    if (s.player.sex === 'F') state = { ...s, currentMonthIndex: s.player.birth + 12 * 12 };
  }
  const id = state.player.id;
  state = { ...state, people: { ...state.people, [id]: { ...state.people[id], money: 1e6 } } };
  const done = attemptPlayerActivity(state, 'hair_salon', { hairStyle: 'bun', hairColor: 'blue' });
  assert.deepEqual(done.history.at(-1).entries.find((e) => e.type === 'activity').look, { hairStyle: 'bun', hairColor: 'blue', beard: false, glasses: 'none', earrings: null });
  assert.equal(done.people[id].appearance.hairColor, 'blue');

  const broke = { ...state, people: { ...state.people, [id]: { ...state.people[id], money: 0 } }, rng: { ...state.rng, chance: () => true } };
  const paid = askParentsToPayActivity(broke, 'hair_salon', { hairStyle: 'bob' });
  assert.equal(paid.people[id].appearance.hairStyle, 'bob');
});

test('the optician: frames on the avatar, or contact lenses (no frame)', () => {
  const optician = ACTIVITIES.optician;
  assert.deepEqual(makeoverOptions(optician, girl()).glasses, ['round', 'square', 'none']);
  assert.equal(isValidChoice(optician, girl(), { glasses: 'square' }), true);
  assert.equal(isValidChoice(optician, girl(), { glasses: 'monocle' }), false);
  assert.equal(isValidChoice(ACTIVITIES.hair_salon, girl(), { glasses: 'round' }), false);

  const framed = applyMakeover(girl(), { glasses: 'round' });
  assert.equal(framed.appearance.glasses, 'round');
  assert.equal(currentChoice(framed).glasses, 'round');
  const lenses = applyMakeover(framed, { glasses: 'none', earrings: null });
  assert.equal(lenses.appearance.glasses, null);

  const svg = (appearance, phase) => renderAvatar(appearance, 'F', phase);
  assert.ok(svg(framed.appearance, 'child').length > svg(lenses.appearance, 'child').length, 'the frame is drawn');
  assert.equal(svg(framed.appearance, 'baby').length, svg(lenses.appearance, 'baby').length, 'not on babies');

  const locale = createLocale(LOCALE_ENTRIES);
  assert.equal(makeoverLine(locale, 'optician', { ...currentChoice(framed) }, 'F'), 'Saí da ótica com óculos redondos.');
  assert.equal(makeoverLine(locale, 'optician', { ...currentChoice(lenses) }, 'F'), 'Saí da ótica com lentes de contato.');
});
