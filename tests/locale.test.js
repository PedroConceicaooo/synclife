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

test('locales/pt-BR/ui.json has every key the M5 screens need', () => {
  const entries = JSON.parse(readFileSync(UI_LOCALE_PATH, 'utf8'));
  const locale = createLocale(entries);

  const expectedKeys = [
    'ui.status_title',
    'ui.age_label',
    'ui.date_label',
    'ui.country_label',
    'ui.money_label',
    'ui.stat_happiness',
    'ui.stat_health',
    'ui.stat_intelligence',
    'ui.stat_looks',
    'ui.advance_6_months',
    'ui.advance_1_year',
    'ui.profile_title',
    'ui.affinity_you_feel',
    'ui.affinity_they_feel',
    'ui.interaction_success',
    'ui.interaction_failure',
    'ui.back',
    'ui.adulthood_placeholder',
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
