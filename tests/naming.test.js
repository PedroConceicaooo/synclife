import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { surnameForm, nameParents, nameChild, fullName, pickFirstName } from '../src/systems/naming.js';

const COUNTRIES_BY_ID = loadCountries(fileURLToPath(new URL('../data/countries/', import.meta.url)));
const country = (id) => resolveCountry(id, COUNTRIES_BY_ID);

const MOTHER = { id: 'p_0002', sex: 'F' };
const FATHER = { id: 'p_0003', sex: 'M' };

test('surnameForm handles plain and sex-dependent family names', () => {
  assert.equal(surnameForm('Silva', 'F'), 'Silva');
  assert.equal(surnameForm({ M: 'Ivanov', F: 'Ivanova' }, 'F'), 'Ivanova');
});

test('a wife takes the husband family name where the country says so, in her own form', () => {
  const ru = country('RU');
  for (let seed = 1; seed <= 20; seed++) {
    const { mother, father } = nameParents(createRng(seed), { mother: MOTHER, father: FATHER, country: ru });
    const entry = ru.nameList.last.find((e) => e.M === father.lastName);
    assert.ok(entry, father.lastName);
    assert.equal(mother.lastName, entry.F);
  }
});

test('Russian children take the father family name in their own form', () => {
  const ru = country('RU');
  const { mother, father } = nameParents(createRng(3), { mother: MOTHER, father: FATHER, country: ru });
  const daughter = nameChild(createRng(4), { id: 'p_0001', sex: 'F' }, { mother, father, country: ru });
  const son = nameChild(createRng(4), { id: 'p_0004', sex: 'M' }, { mother, father, country: ru });
  assert.equal(son.lastName, father.lastName);
  assert.equal(daughter.lastName, mother.lastName);
});

test('Brazilian parents keep their names and children carry mother then father', () => {
  const br = country('BR');
  const { mother, father } = nameParents(createRng(1), { mother: MOTHER, father: FATHER, country: br });
  const child = nameChild(createRng(2), { id: 'p_0001', sex: 'M' }, { mother, father, country: br });
  assert.equal(child.lastName, `${mother.lastName} ${father.lastName}`);
});

test('fullName follows the country display order', () => {
  const person = { firstName: 'Akemi', lastName: 'Tanaka' };
  assert.equal(fullName(person, country('JP')), 'Tanaka Akemi');
  assert.equal(fullName(person, country('US')), 'Akemi Tanaka');
});

test('siblings do not repeat first names while the list allows it', () => {
  const us = country('US');
  const taken = us.nameList.first.F.slice(0, -1);
  assert.equal(pickFirstName(createRng(1), us.nameList, 'F', taken), us.nameList.first.F.at(-1));
});
