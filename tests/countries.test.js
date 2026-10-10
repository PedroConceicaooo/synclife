import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { indexCountries, resolveCountry } from '../src/engine/countries.js';
import { loadCountries } from '../src/engine/countriesLoader.js';

const COUNTRIES_DIR = fileURLToPath(new URL('../data/countries/', import.meta.url));

test('loads all 5 playable countries plus default', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['default', 'BR', 'US', 'JP', 'RU', 'GB']) {
    assert.ok(countriesById[id], `missing country ${id}`);
  }
});

test('resolveCountry merges default fields with country-specific ones', () => {
  const countriesById = { default: { id: 'default', scale: 'medium' }, BR: { id: 'BR', inherits: 'default' } };
  const resolved = resolveCountry('BR', countriesById);
  assert.equal(resolved.id, 'BR');
  assert.equal(resolved.scale, 'medium');
});

test('country-specific fields win over default', () => {
  const countriesById = { default: { id: 'default', scale: 'medium' }, BR: { id: 'BR', inherits: 'default', scale: 'large' } };
  const resolved = resolveCountry('BR', countriesById);
  assert.equal(resolved.scale, 'large');
});

test('each real country declares its own currency with an ascending scale', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const country = resolveCountry(id, countriesById);
    assert.ok(country.currency, `missing currency for ${id}`);
    assert.ok(typeof country.currency.code === 'string');
    const { small, medium, large } = country.currency.scale;
    assert.ok(small < medium && medium < large, `scale not ascending for ${id}`);
  }
});

test('default.json has no currency', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  assert.equal(countriesById.default.currency, undefined);
});

test('indexCountries builds a map by id from an in-memory array (no fs)', () => {
  const countries = [{ id: 'default' }, { id: 'BR', inherits: 'default' }];
  const countriesById = indexCountries(countries);
  assert.deepEqual(Object.keys(countriesById).sort(), ['BR', 'default']);
  assert.equal(countriesById.BR.inherits, 'default');
});

test('resolveCountry merges nested objects and replaces arrays', () => {
  const countriesById = {
    default: { id: 'default', naming: { a: 1, b: 2 }, cities: ['x'] },
    BR: { id: 'BR', inherits: 'default', naming: { b: 3 }, cities: ['y'] },
  };
  const resolved = resolveCountry('BR', countriesById);
  assert.deepEqual(resolved.naming, { a: 1, b: 3 });
  assert.deepEqual(resolved.cities, ['y']);
  assert.deepEqual(countriesById.default.naming, { a: 1, b: 2 });
});

test('every playable country loads its name list and inherits naming rules', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const country = resolveCountry(id, countriesById);
    assert.ok(country.nameList.first.M.length > 0 && country.nameList.first.F.length > 0, id);
    assert.ok(country.nameList.last.length > 0, id);
    assert.ok(country.cities.length > 0, id);
    assert.ok(country.occupations.length > 0, id);
    assert.equal(typeof country.naming.childLastName, 'string', id);
  }
  assert.equal(resolveCountry('JP', countriesById).naming.familyNameFirst, true);
  assert.equal(resolveCountry('JP', countriesById).naming.childLastName, 'father');
});

test('every country, city and occupation has its text in pt-BR', async () => {
  const { readFileSync } = await import('node:fs');
  const locale = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const country = resolveCountry(id, countriesById);
    assert.ok(locale[`country.${id}`], id);
    for (const cityId of country.cities) assert.ok(locale[`city.${cityId}`], cityId);
    for (const occupation of country.occupations) assert.ok(locale[`occupation.${occupation}`], occupation);
  }
});
