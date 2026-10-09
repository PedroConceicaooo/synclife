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
