import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fromMonthIndex } from '../src/engine/time.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, continueAdvance, canContinueAdvance, isAdult } from '../src/systems/game.js';
import { schoolEntryMonth } from '../src/systems/school.js';
import { toSave, fromSave } from '../src/systems/save.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};

function newLifeIn(countryId) {
  for (let seed = 1; seed < 200; seed++) {
    const state = createGameState({ seed, ...DATA });
    if (state.country.id === countryId) return state;
  }
  throw new Error(`no seed born in ${countryId}`);
}

// Plays like the UI: 1-year clicks, choices, then the rest of the time.
function playTo18(state) {
  let s = state;
  while (!isAdult(s)) {
    s = advanceStep(s, 12);
    while (s.pendingDecisions.length > 0 || canContinueAdvance(s)) {
      while (s.pendingDecisions.length > 0) s = resolveDecision(s);
      s = continueAdvance(s);
    }
  }
  return s;
}

const entries = (state) => state.history.flatMap((block) => block.entries.map((entry) => ({ ...entry, month: block.month })));

test('the first day of school stops the advance in the school-start month, then the rest of the year follows', () => {
  let state = newLifeIn('JP');
  const entry = schoolEntryMonth(state.player.birth, state.country.education);
  while (state.currentMonthIndex + 12 < entry) {
    state = advanceStep(state, 12);
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
  }

  const before = state.currentMonthIndex;
  state = advanceStep(state, 12);
  assert.equal(state.currentMonthIndex, entry);
  assert.equal(fromMonthIndex(state.currentMonthIndex).month, 4);
  assert.equal(state.remainingMonths, 12 - (entry - before));
  assert.ok(state.pendingDecisions.some((d) => d.trigger === 'first_school_day'));
  assert.equal(canContinueAdvance(state), false);

  while (state.pendingDecisions.length > 0) state = resolveDecision(state);
  assert.equal(canContinueAdvance(state), true);
  const resumed = continueAdvance(state);
  assert.equal(resumed.currentMonthIndex, before + 12);
  assert.equal(resumed.remainingMonths, 0);
});

test('a Japanese life goes through three school stages, an entrance exam and a report every school year', () => {
  const state = playTo18(newLifeIn('JP'));
  const all = entries(state);

  assert.deepEqual(all.filter((e) => e.type === 'schoolStage').map((e) => e.stageId), ['elementary', 'middle', 'high']);
  const exams = all.filter((e) => e.eventId === 'entrance_exam');
  assert.equal(exams.length, 1);
  assert.equal(typeof exams[0].succeeded, 'boolean');

  // The diary block is dated at the end of the advance; firedEvents keeps the
  // month each report actually came out.
  const reports = state.firedEvents.filter((f) => f.eventId === 'school_report');
  assert.ok(reports.length >= 10, `${reports.length} reports`);
  assert.equal(all.filter((e) => e.eventId === 'school_report').length, reports.length);
  for (const report of reports) assert.equal(fromMonthIndex(report.month).month, 3); // school year ends in March
});

test('countries without entrance exams never hold one, and school follows their calendar', () => {
  const expectedStart = { BR: 2, US: 9, RU: 9, GB: 9 };
  for (const [countryId, month] of Object.entries(expectedStart)) {
    const state = playTo18(newLifeIn(countryId));
    const all = entries(state);
    assert.equal(all.filter((e) => e.eventId === 'entrance_exam').length, 0, countryId);
    const firstStage = all.find((e) => e.type === 'schoolStage');
    assert.equal(fromMonthIndex(firstStage.month).month, month, countryId);
  }
});

test('an interrupted advance survives a save', () => {
  let state = newLifeIn('BR');
  const entry = schoolEntryMonth(state.player.birth, state.country.education);
  while (state.currentMonthIndex + 12 < entry) {
    state = advanceStep(state, 12);
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
  }
  state = advanceStep(state, 12);
  const loaded = fromSave(JSON.parse(JSON.stringify(toSave(state))), DATA);
  assert.equal(loaded.remainingMonths, state.remainingMonths);
  assert.ok(loaded.remainingMonths > 0);
});

test('school events and school jobs never happen before the child starts school', () => {
  const schoolOnly = Object.values(DATA.eventsById).filter((e) => e.conditions?.inSchool).map((e) => e.id);
  assert.ok(schoolOnly.includes('school_play'));
  for (const countryId of ['JP', 'BR', 'RU', 'GB', 'US']) {
    const state = playTo18(newLifeIn(countryId));
    const entry = schoolEntryMonth(state.player.birth, state.country.education);
    for (const fired of state.firedEvents.filter((f) => f.playerId === state.player.id && schoolOnly.includes(f.eventId))) {
      assert.ok(fired.month >= entry, `${countryId} ${fired.eventId} at ${fired.month} before ${entry}`);
    }
  }
});
