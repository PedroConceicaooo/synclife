import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLocale } from '../src/i18n/locale.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, attemptPlayerInteraction, attemptPlayerActivity, isAdult } from '../src/systems/game.js';
import { describeBlock, describeHistory } from '../src/ui/diary.js';
import { fullName } from '../src/systems/naming.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
const ARGS = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};

// A life that touches every kind of diary entry: events, choices, money,
// interactions and activities.
function playLife(seed) {
  let state = createGameState({ seed, ...ARGS });
  let step = 6;
  while (!isAdult(state)) {
    state = advanceStep(state, step);
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
    state = attemptPlayerInteraction(state, 'chat', state.mother.id);
    for (const activityId of ['mow_lawn', 'buy_book', 'sell_at_recess']) {
      state = attemptPlayerActivity(state, activityId);
      while (state.pendingDecisions.length > 0) state = resolveDecision(state);
    }
    step = step === 6 ? 12 : 6;
  }
  return state;
}

const UNRESOLVED = /\{|\}|(^|\s)(event|diary|activity|interaction|occupation|city|country|role|ui|age)\.[a-z_]/;

test('no diary line of a full life is left with a raw key or token', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const { header, lines } of describeHistory(playLife(seed), LOCALE)) {
      for (const text of [header, ...lines]) assert.doesNotMatch(text, UNRESOLVED, `seed ${seed}: ${text}`);
    }
  }
});

test('the first block introduces the player and both parents', () => {
  const state = createGameState({ seed: 11, ...ARGS });
  const { header, lines } = describeBlock(state.history[0], state, LOCALE);

  assert.equal(header, 'Idade: 0 anos');
  assert.ok(lines[0].startsWith(`Eu nasci ${state.player.sex === 'F' ? 'menina' : 'menino'} em ${LOCALE.t(`city.${state.player.cityId}`)}`));
  assert.ok(lines[0].includes(LOCALE.t(`country.${state.country.id}`)));
  assert.ok(lines[0].endsWith(`Meu nome é ${fullName(state.player, state.country)}.`));
  assert.ok(lines[1].startsWith(`Minha mãe é ${fullName(state.mother, state.country)}, `));
  assert.ok(lines[2].startsWith(`Meu pai é ${fullName(state.father, state.country)}, `));
  assert.match(lines[1], /\(\d+ anos\)\.$/);
});

test('a block lists birthdays, choices, allowance and a stat summary', () => {
  const state = createGameState({ seed: 11, ...ARGS });
  const block = {
    month: state.player.birth + 42,
    entries: [
      { type: 'birthday', age: 3, month: state.player.birth + 36 },
      { type: 'event', eventId: 'toy_tantrum', optionId: 'ask_nicely' },
      { type: 'event', eventId: 'acne' },
      { type: 'money', source: 'allowance', fromId: state.mother.id, amount: 30 },
      { type: 'money', source: 'allowance', fromId: state.father.id, amount: 20 },
      { type: 'stat', stat: 'happiness', delta: 2.4 },
      { type: 'stat', stat: 'health', delta: -1.2 },
      { type: 'stat', stat: 'happiness', delta: 1 },
    ],
  };
  const { header, lines } = describeBlock(block, state, LOCALE);
  const money = LOCALE.money(50, state.country.currency.code);

  assert.equal(header, 'Idade: 3 anos e 6 meses');
  assert.deepEqual(lines, [
    'Fiz 3 anos.',
    `${LOCALE.t('event.toy_tantrum.prompt')} Escolha: Pedir com educação.`,
    LOCALE.t('event.acne.text'),
    `Recebi ${money} de mesada.`,
    'Felicidade +3 · Saúde −1',
  ]);
});

test('event options follow the player sex', () => {
  const base = createGameState({ seed: 11, ...ARGS });
  const block = { month: base.player.birth + 48, entries: [{ type: 'event', eventId: 'vaccine', optionId: 'be_brave' }] };
  const asSex = (sex) => ({ ...base, player: { ...base.player, sex } });
  assert.ok(describeBlock(block, asSex('F'), LOCALE).lines[0].endsWith('Escolha: Ser corajosa.'));
  assert.ok(describeBlock(block, asSex('M'), LOCALE).lines[0].endsWith('Escolha: Ser corajoso.'));
});
