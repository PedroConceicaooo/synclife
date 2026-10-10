import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ageAt } from '../src/engine/time.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, isAdult, closePeople } from '../src/systems/game.js';
import { lifeSummary, eligibleSuccessors, continueAsSibling } from '../src/systems/lifeEnd.js';
import { toSave, fromSave } from '../src/systems/save.js';
import { createLocale } from '../src/i18n/locale.js';
import { describeBlock } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));

function liveTo18(state) {
  let s = state;
  while (!isAdult(s)) {
    s = advanceStep(s, 12);
    while (s.pendingDecisions.length > 0) s = resolveDecision(s);
  }
  return s;
}

// First seed whose life ends with a sibling under 18.
function lifeWithSuccessor() {
  for (let seed = 1; seed < 60; seed++) {
    const state = liveTo18(createGameState({ seed, ...DATA }));
    if (eligibleSuccessors(state).length > 0) return state;
  }
  throw new Error('no seed with a younger sibling');
}

test('an advance never goes past the 18th birthday', () => {
  for (const seed of [1, 2, 3]) {
    const state = liveTo18(createGameState({ seed, ...DATA }));
    assert.equal(state.currentMonthIndex - state.player.birth, 18 * 12, `seed ${seed}`);
  }
});

test('the life summary has final stats, milestones in order and the strongest relationships', () => {
  const state = liveTo18(createGameState({ seed: 4, ...DATA }));
  const summary = lifeSummary(state);

  assert.deepEqual(summary.stats, state.people[state.player.id].stats);
  assert.ok(summary.milestones.length > 0);
  const months = summary.milestones.map((m) => m.month);
  assert.deepEqual(months, [...months].sort((a, b) => a - b));
  assert.ok(summary.milestones.every((m) => state.eventsById[m.eventId].milestone));
  assert.ok(summary.strongestRelationships.length > 0 && summary.strongestRelationships.length <= 3);
  const strengths = summary.strongestRelationships.map((r) => r.strength);
  assert.deepEqual(strengths, [...strengths].sort((a, b) => b - a));
});

test('only living siblings under 18 can carry on', () => {
  const state = lifeWithSuccessor();
  for (const id of eligibleSuccessors(state)) {
    assert.ok(ageAt(state.people[id].birth, state.currentMonthIndex) < 18);
  }
  assert.throws(() => continueAsSibling(state, state.mother.id), /Not an eligible sibling/);
});

test('continuing as a sibling keeps the world and moves the past life to pastLives', () => {
  const ended = lifeWithSuccessor();
  const siblingId = eligibleSuccessors(ended)[0];
  const next = continueAsSibling(ended, siblingId);

  assert.equal(next.player.id, siblingId);
  assert.equal(next.mother.id, ended.mother.id);
  assert.equal(next.father.id, ended.father.id);
  assert.equal(next.currentMonthIndex, ended.currentMonthIndex);
  assert.deepEqual(next.people, ended.people);
  assert.deepEqual(next.pastLives, [{ playerId: ended.player.id, endedAt: ended.currentMonthIndex, history: ended.history }]);
  assert.deepEqual(next.history, [{ month: ended.currentMonthIndex, entries: [{ type: 'continue', previousId: ended.player.id }] }]);
  assert.ok(closePeople(next).some((p) => p.personId === ended.player.id));
  assert.equal(isAdult(next), false);
});

test('the continued life plays on, survives a save, and opens its diary with who you are now', () => {
  const ended = lifeWithSuccessor();
  let next = continueAsSibling(ended, eligibleSuccessors(ended)[0]);

  const { lines } = describeBlock(next.history[0], next, LOCALE);
  assert.match(lines[0].text, /^A história continua comigo\. Meu nome é .+ e tenho \d+ anos?\.$/);
  assert.match(lines[1].text, /fez 18 anos e seguiu o próprio caminho\.$/);

  next = advanceStep(next, 6);
  assert.ok(next.pendingDecisions.length > 0);
  const loaded = fromSave(JSON.parse(JSON.stringify(toSave(next))), DATA);
  assert.equal(loaded.player.id, next.player.id);
  assert.equal(loaded.pastLives.length, 1);
});

test('event cooldowns belong to each player', () => {
  const ended = lifeWithSuccessor();
  const next = advanceStep(continueAsSibling(ended, eligibleSuccessors(ended)[0]), 6);
  const own = next.firedEvents.filter((f) => f.playerId === next.player.id);
  assert.ok(own.length > 0);
  assert.ok(ended.firedEvents.filter((f) => f.playerId).every((f) => f.playerId === ended.player.id));
});
