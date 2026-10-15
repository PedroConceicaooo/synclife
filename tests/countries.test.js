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

test('every country has legal ages and a school system covering childhood, with a source for each', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const country = resolveCountry(id, countriesById);
    for (const age of ['majority', 'drinking', 'smoking', 'driving']) {
      assert.equal(typeof country.ages[age], 'number', `${id} ${age}`);
      assert.ok(country.legalSources[`ages.${age}`]?.source, `${id} source for ${age}`);
    }
    const { schoolYearStartMonth, stages } = country.education;
    assert.ok(schoolYearStartMonth >= 1 && schoolYearStartMonth <= 12, id);
    assert.ok(country.legalSources.education?.source, `${id} education source`);
    // Stages are back to back and school ends by 18.
    for (let i = 1; i < stages.length; i++) {
      assert.equal(stages[i].startAge, stages[i - 1].startAge + stages[i - 1].years, `${id} ${stages[i].id}`);
    }
    const last = stages.at(-1);
    assert.equal(last.startAge + last.years, 18, id);
    // Nothing is marked verified without a date (design doc: source and
    // date), and unverified items say so.
    for (const entry of [...Object.values(country.legalSources), country.topics.same_sex_relationship]) {
      if (entry.verifiedAt === null) {
        assert.ok(['ai_draft', 'researched', 'ai_checked', 'simplified', 'needs_primary_check'].includes(entry.reviewStatus), id);
        if (entry.reviewStatus === 'needs_primary_check') assert.match(entry.source, /^⚠️ Não verificado na fonte primária/, id);
        if (entry.reviewStatus === 'simplified') assert.match(entry.source, /^Simplificação do jogo: /, id);
        if (['ai_checked', 'simplified'].includes(entry.reviewStatus)) assert.ok(entry.checkedUrl && entry.checkedAt, `${id} checked without a url`);
      } else {
        assert.equal(entry.reviewStatus, 'verified', id);
      }
    }
  }
});

test('countries only declare the ages that differ from the default', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    for (const [key, value] of Object.entries(countriesById[id].ages ?? {})) {
      assert.notEqual(value, countriesById.default.ages[key], `${id} repeats default ${key}`);
    }
  }
});

test('every country has the legal status and Pew acceptance of same-sex couples, with a source', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  const expected = { BR: ['permitted', 52], US: ['permitted', 63], JP: ['not_recognized', 68], RU: ['restricted', 14], GB: ['permitted', 74] };
  for (const [id, [legal, acceptance]] of Object.entries(expected)) {
    const topic = resolveCountry(id, countriesById).topics.same_sex_relationship;
    assert.equal(topic.legal, legal, id);
    assert.equal(topic.acceptance, acceptance, id);
    assert.equal(topic.risk, null, id);
    assert.match(topic.source, /Pew Research Center/, id);
  }
  assert.match(resolveCountry('RU', countriesById).topics.same_sex_relationship.source, /2019/);
});

test('every country inherits the family allowance bands: from 6, growing with age, in money scales', () => {
  const countriesById = loadCountries(COUNTRIES_DIR);
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const bands = resolveCountry(id, countriesById).familyAllowance.ageBands;
    assert.equal(bands[0].minAge, 6, id);
    for (const [i, band] of bands.entries()) {
      assert.ok(['small', 'medium', 'large'].includes(band.scale), `${id}: ${band.scale}`);
      if (i > 0) {
        assert.ok(band.minAge > bands[i - 1].minAge, `${id}: bands in age order`);
        assert.ok(band.multiplier > bands[i - 1].multiplier, `${id}: more with age`);
      }
    }
  }
});
