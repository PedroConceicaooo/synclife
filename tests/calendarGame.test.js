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

test('a dated decision whose conditions fail does not cut the advance short', () => {
  const state = newLifeIn('BR');
  const yearly = (conditions) => ({
    id: 'yearly_question',
    subject: 'player',
    calendar: { on: 'schoolYearStart' },
    conditions,
    options: [{ id: 'yes', effects: [] }],
  });
  const atSchool = { ...state, currentMonthIndex: schoolEntryMonth(state.player.birth, state.country.education) + 1 };

  const never = advanceStep({ ...atSchool, eventsById: { yearly_question: yearly({ minAge: 99 }) } }, 12);
  assert.equal(never.currentMonthIndex, atSchool.currentMonthIndex + 12);
  assert.equal(never.remainingMonths, 0);
  assert.deepEqual(never.pendingDecisions, []);

  const always = advanceStep({ ...atSchool, eventsById: { yearly_question: yearly({ minAge: 0 }) } }, 12);
  assert.ok(always.currentMonthIndex < atSchool.currentMonthIndex + 12);
  assert.deepEqual(always.pendingDecisions.map((d) => d.trigger), ['yearly_question']);
});

test('a player who trains football is asked about the school team each school year until on it', () => {
  const base = newLifeIn('BR');
  const playerId = base.player.id;
  // Ten years old, a month before a school year starts, with some football.
  const entry = schoolEntryMonth(base.player.birth, base.country.education);
  const month = entry + 4 * 12 - 1;
  const trained = { ...base.people[playerId], skills: { football: { skill: 60, peak: 60, sessions: 10, lastTrainedMonth: month, level: 0, levelSince: month } } };
  const state = { ...base, currentMonthIndex: month, people: { ...base.people, [playerId]: trained } };

  const asked = advanceStep(state, 6);
  assert.equal(asked.currentMonthIndex, entry + 4 * 12, 'the advance stops at the school year start');
  assert.deepEqual(asked.pendingDecisions.map((d) => d.trigger), ['school_tryout_football']);

  const signed = resolveDecision({ ...asked, rng: { ...asked.rng, chance: () => true } }, 'sign_up');
  const lines = signed.history.at(-1).entries;
  assert.equal(lines.at(-1).type, 'tryout');
  assert.equal(lines.at(-1).passed, true);
  assert.deepEqual(signed.people[playerId].teams.map((t) => t.teamKey), ['school']);

  // At the end of the school year (December) the team is reviewed; next year
  // no question.
  const yearEnd = advanceStep(continueAdvance(signed), 6);
  const review = yearEnd.history.flatMap((b) => b.entries).find((e) => e.type === 'teamSeason');
  assert.equal(review?.activityId, 'football');
  const nextYear = advanceStep({ ...yearEnd, rng: { ...yearEnd.rng, chance: () => true } }, 12);
  const kept = nextYear.people[playerId].teams.some((t) => t.teamKey === 'school');
  assert.equal(nextYear.pendingDecisions.some((d) => d.trigger === 'school_tryout_football'), !kept);

  // Without football, nobody asks.
  const quiet = advanceStep({ ...state, people: base.people }, 6);
  assert.equal(quiet.pendingDecisions.some((d) => d.trigger === 'school_tryout_football'), false);
});
