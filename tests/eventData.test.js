import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEvents } from '../src/systems/eventsLoader.js';

const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const UI_DATA = readFileSync(new URL('../src/ui/data.js', import.meta.url), 'utf8');

const EVENTS = Object.values(loadEvents(EVENTS_DIR));
const ROLLED_PLAYER_EVENTS = EVENTS.filter((e) => e.subject === 'player' && e.yearlyChance !== undefined);
const KNOWN_OPS = ['stat', 'affinity', 'transferMoney', 'relationshipState'];

test('every rolled player event declares minAge (CLAUDE.md rule 8)', () => {
  for (const event of ROLLED_PLAYER_EVENTS) {
    assert.equal(typeof event.conditions?.minAge, 'number', event.id);
  }
});

test('every player event effect uses a known op', () => {
  for (const event of ROLLED_PLAYER_EVENTS) {
    const effects = [...(event.effects ?? []), ...(event.options ?? []).flatMap((o) => o.effects)];
    for (const effect of effects) assert.ok(KNOWN_OPS.includes(effect.op), `${event.id}: ${effect.op}`);
  }
});

test('every player event has its texts in pt-BR', () => {
  for (const event of EVENTS.filter((e) => e.subject === 'player')) {
    if (event.options) {
      assert.ok(LOCALE[`event.${event.id}.prompt`], `${event.id}.prompt`);
      for (const option of event.options) assert.ok(LOCALE[`event.${event.id}.option.${option.id}`], `${event.id}.${option.id}`);
    } else {
      assert.ok(LOCALE[`event.${event.id}.text`], `${event.id}.text`);
    }
  }
});

test('every age from 0 to 17 has at least one rolled decision event', () => {
  for (let age = 0; age <= 17; age++) {
    const found = ROLLED_PLAYER_EVENTS.some(
      (e) => e.options && e.conditions.minAge <= age && (e.conditions.maxAge ?? Infinity) >= age,
    );
    assert.ok(found, `age ${age}`);
  }
});

test('the browser manifest lists every event file', () => {
  for (const fileName of readdirSync(EVENTS_DIR).filter((f) => f.endsWith('.json'))) {
    assert.ok(UI_DATA.includes(`'${fileName}'`), fileName);
  }
});
