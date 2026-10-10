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
const KNOWN_OPS = ['stat', 'affinity', 'transferMoney', 'relationshipState', 'money', 'roles', 'haveChild', 'emotion', 'tendency', 'stress'];

test('every rolled player event declares minAge (CLAUDE.md rule 8)', () => {
  for (const event of ROLLED_PLAYER_EVENTS) {
    assert.equal(typeof event.conditions?.minAge, 'number', event.id);
  }
});

test('every player event effect uses a known op', () => {
  for (const event of EVENTS.filter((e) => e.subject === 'player')) {
    const effects = [
      ...(event.effects ?? []),
      ...(event.options ?? []).flatMap((o) => o.effects),
      ...(event.success ?? []),
      ...(event.failure ?? []),
    ];
    for (const effect of effects) assert.ok(KNOWN_OPS.includes(effect.op), `${event.id}: ${effect.op}`);
  }
});

test('every player event has its texts in pt-BR', () => {
  for (const event of EVENTS.filter((e) => e.subject === 'player')) {
    if (event.check) {
      assert.ok(LOCALE[`event.${event.id}.success`] && LOCALE[`event.${event.id}.failure`], `${event.id} outcomes`);
    } else if (event.options) {
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

test('every world event has a diary text in pt-BR', () => {
  for (const event of EVENTS.filter((e) => e.subject === 'relationship')) {
    assert.ok(LOCALE[`event.${event.id}.text`], `${event.id}.text`);
  }
});

test('every milestone event has a short summary text in pt-BR', () => {
  for (const event of EVENTS.filter((e) => e.milestone)) {
    assert.ok(LOCALE[`milestone.${event.id}`], event.id);
  }
});

test('calendar events declare minAge and a known calendar point, and are never rolled', () => {
  for (const event of EVENTS.filter((e) => e.calendar)) {
    assert.equal(typeof event.conditions?.minAge, 'number', event.id);
    assert.ok(['stageStart', 'schoolYearEnd'].includes(event.calendar.on), event.id);
    assert.equal(event.yearlyChance, undefined, event.id);
  }
});

test('every school stage of every country has a local name or a generic one', () => {
  for (const stage of ['elementary', 'middle', 'high']) assert.ok(LOCALE[`school.${stage}`], stage);
});

test('texts with variants are non-empty lists of strings', () => {
  for (const [key, value] of Object.entries(LOCALE)) {
    if (!Array.isArray(value)) continue;
    assert.ok(value.length > 1 && value.every((v) => typeof v === 'string' && v.length > 0), key);
  }
});
