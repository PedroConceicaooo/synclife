import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCountries, resolveCountry } from '../src/engine/countries.js';

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
