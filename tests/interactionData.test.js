import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { INTERACTION_CATEGORIES } from '../src/systems/interactions.js';

const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const UI_DATA = readFileSync(new URL('../src/ui/data.js', import.meta.url), 'utf8');

const INTERACTIONS = Object.values(loadInteractions(INTERACTIONS_DIR));
const KNOWN_OPS = ['stat', 'affinity', 'transferMoney', 'roles'];
const KNOWN_FACTORS = ['affinity', 'targetTrait'];

test('every interaction declares minAge (CLAUDE.md rule 8) and a known category', () => {
  for (const interaction of INTERACTIONS) {
    assert.equal(typeof interaction.conditions?.minAge, 'number', interaction.id);
    assert.ok(INTERACTION_CATEGORIES.includes(interaction.category), interaction.id);
  }
});

test('every interaction uses only known ops and chance factors', () => {
  for (const interaction of INTERACTIONS) {
    for (const effect of [...interaction.success, ...interaction.failure]) {
      assert.ok(KNOWN_OPS.includes(effect.op), `${interaction.id}: ${effect.op}`);
    }
    for (const modifier of interaction.chance.modifiers) {
      assert.ok(KNOWN_FACTORS.includes(modifier.factor), `${interaction.id}: ${modifier.factor}`);
    }
  }
});

test('interactions that spend the player money require having it', () => {
  for (const interaction of INTERACTIONS) {
    const spends = [...interaction.success, ...interaction.failure].some((e) => e.op === 'transferMoney' && e.from === 'player');
    if (spends) assert.ok(interaction.conditions.minMoney, interaction.id);
  }
});

test('every interaction and category has its texts in pt-BR', () => {
  for (const interaction of INTERACTIONS) {
    for (const key of ['label', 'success', 'failure']) {
      assert.ok(LOCALE[`interaction.${interaction.id}.${key}`], `${interaction.id}.${key}`);
    }
    assert.ok(LOCALE[`interactionCategory.${interaction.category}`], interaction.category);
  }
});

test('the browser manifest lists every interaction file', () => {
  for (const fileName of readdirSync(INTERACTIONS_DIR).filter((f) => f.endsWith('.json'))) {
    assert.ok(UI_DATA.includes(`'${fileName}'`), fileName);
  }
});
