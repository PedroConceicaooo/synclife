import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLocale } from '../src/i18n/locale.js';

const UI_LOCALE_PATH = fileURLToPath(new URL('../locales/pt-BR/ui.json', import.meta.url));

test('createLocale resolves a known key to its mapped value', () => {
  const locale = createLocale({ greeting: 'Olá' });
  assert.equal(locale.t('greeting'), 'Olá');
});

test('createLocale falls back to returning the key itself when missing', () => {
  const locale = createLocale({});
  assert.equal(locale.t('missing_key'), 'missing_key');
});

test('locales/pt-BR/ui.json has every key the screens need', () => {
  const entries = JSON.parse(readFileSync(UI_LOCALE_PATH, 'utf8'));
  const locale = createLocale(entries);

  const expectedKeys = [
    'ui.stat_happiness',
    'ui.stat_health',
    'ui.stat_intelligence',
    'ui.stat_looks',
    'ui.advance_6_months',
    'ui.advance_1_year',
    'ui.affinity_you_feel',
    'ui.affinity_they_feel',
    'ui.interaction_limit',
    'ui.back',
    'ui.balance',
    'ui.tab_relations',
    'ui.tab_activities',
    'ui.flag_alt',
    'ui.person_subtitle',
    'phase.baby',
    'phase.child',
    'phase.teen',
    'ui.summary_title',
    'ui.new_life',
    'ui.continue_as',
    'ui.end_prompt',
    'role.mother',
    'role.father',
    'role.wife',
    'role.husband',
    'role.son',
    'role.daughter',
    'relationshipType.family',
    'relationshipType.romantic',
    'interaction.ask_money.label',
    'interactionCategory.ask',
    'event.choose_who_to_live_with.prompt',
    'event.choose_who_to_live_with.option.live_with_mother',
    'event.choose_who_to_live_with.option.live_with_father',
  ];

  for (const key of expectedKeys) {
    assert.notEqual(locale.t(key), key, `missing locale entry for ${key}`);
  }
});

const PT = createLocale(JSON.parse(readFileSync(UI_LOCALE_PATH, 'utf8')));

test('format fills params and picks gendered forms by sex', () => {
  const locale = createLocale({ born: 'Eu nasci {player|menino|menina} em {city}.' });
  assert.equal(locale.format('born', { city: 'Recife' }, { player: 'F' }), 'Eu nasci menina em Recife.');
  assert.equal(locale.format('born', { city: 'Recife' }, { player: 'M' }), 'Eu nasci menino em Recife.');
  assert.equal(locale.format('born', {}, {}), 'Eu nasci {player|menino|menina} em {city}.');
});

test('plural picks .one or .other', () => {
  assert.equal(PT.plural('age.years', 1), '1 ano');
  assert.equal(PT.plural('age.years', 3), '3 anos');
});

test('age reads like the diary header', () => {
  assert.equal(PT.age(36), '3 anos');
  assert.equal(PT.age(42), '3 anos e 6 meses');
  assert.equal(PT.age(6), '6 meses');
  assert.equal(PT.age(0), '0 anos');
  assert.equal(PT.age(13), '1 ano e 1 mês');
});

test('money uses the country currency symbol without decimals', () => {
  const normalize = (s) => s.replace(/\s/g, ' ');
  assert.equal(normalize(PT.money(1250, 'USD')), 'US$ 1.250');
  assert.equal(normalize(PT.money(300, 'BRL')), 'R$ 300');
  assert.match(normalize(PT.money(2000, 'JPY')), /^(JP¥|¥) 2\.000$/);
});

test('monthName turns a month index into the month name', () => {
  assert.equal(PT.monthName(2000 * 12 + 2), 'março');
  assert.equal(PT.monthName(2000 * 12 + 11), 'dezembro');
});

test('a text missing in the chosen language falls back to Portuguese', () => {
  const locale = createLocale({ greeting: 'Hello' }, 'en', { greeting: 'Olá', farewell: 'Tchau' });
  assert.equal(locale.t('greeting'), 'Hello');
  assert.equal(locale.t('farewell'), 'Tchau');
  assert.equal(locale.has('farewell'), true);
  assert.equal(locale.t('nowhere'), 'nowhere');
});
