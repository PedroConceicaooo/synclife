import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allowancePerMonth, allowancesFor, payAllowances } from '../src/systems/athleteAllowance.js';
import { mergeSeasonEntries } from '../src/systems/games.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadClubs, loadLeagues } from '../src/systems/clubsLoader.js';
import { createGameState, advanceStep } from '../src/systems/game.js';
import { createLocale } from '../src/i18n/locale.js';
import { describeBlock } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const COUNTRIES = loadCountries(dir('countries'));
const BR = resolveCountry('BR', COUNTRIES); // medium = 125
const CLUBS = loadClubs(dir('clubs'));
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));

const team = (teamLevelId, since = 0) => ({ activityId: 'football', teamKey: 'cl_x', clubId: 'cl_x', teamLevelId, since });
const school = { activityId: 'football', teamKey: 'school', teamLevelId: 'school', since: 0 };
const person = (teams) => ({ id: 'p_kid', birth: 0, money: 0, teams });

test('allowancePerMonth follows the country scale and the category; school and under-11 pay nothing', () => {
  assert.equal(allowancePerMonth(team('youth_u15'), BR), 250);
  assert.equal(allowancePerMonth(team('youth_u17'), BR), 375);
  assert.equal(allowancePerMonth(team('youth_u20'), BR), 500);
  assert.equal(allowancePerMonth(team('youth_u11'), BR), 0);
  assert.equal(allowancePerMonth(school, BR), 0);
  assert.equal(allowancePerMonth(team('youth_u15'), resolveCountry('US', COUNTRIES)), 50, 'every country inherits the default');
});

test('allowancesFor counts the months at 14 or more on the team, none at 13', () => {
  // Born in month 0: 14 from month 168.
  assert.deepEqual(allowancesFor(person([team('youth_u15')]), 150, 167, BR), []);
  assert.deepEqual(allowancesFor(person([team('youth_u15')]), 162, 174, BR), [{ clubId: 'cl_x', amount: 250 * 7 }]);
  assert.deepEqual(allowancesFor(person([team('youth_u15', 171)]), 162, 174, BR), [{ clubId: 'cl_x', amount: 250 * 4 }], 'from the month joined');
  assert.deepEqual(allowancesFor(person([school, team('youth_u11')]), 170, 180, BR), []);
  assert.deepEqual(allowancesFor(person([]), 170, 180, BR), []);
  // Up to 19: none from 20 on.
  assert.deepEqual(allowancesFor(person([team('youth_u20')]), 20 * 12 - 3, 20 * 12 + 4, BR), [{ clubId: 'cl_x', amount: 500 * 2 }]);
});

test('payAllowances adds the money and writes one entry per club', () => {
  const paid = payAllowances(person([team('youth_u15'), { ...team('youth_u17'), clubId: 'cl_y', teamKey: 'cl_y' }]), 170, 172, BR);
  assert.equal(paid.person.money, 250 * 2 + 375 * 2);
  assert.deepEqual(paid.entries, [
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_x', amount: 500 },
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_y', amount: 750 },
  ]);
  const none = person([school]);
  assert.equal(payAllowances(none, 170, 172, BR).person, none);
});

test('in the game, a club player of 14 is paid every advance, up to the review that releases them', () => {
  let state = createGameState({
    seed: 1,
    countriesById: COUNTRIES,
    eventsById: loadEvents(dir('events')),
    interactionsById: loadInteractions(dir('interactions')),
    activitiesById: loadActivities(dir('activities')),
    clubsById: CLUBS,
    leaguesById: loadLeagues(dir('leagues')),
  });
  const club = Object.values(CLUBS).find((c) => c.countryId === state.country.id && c.sports.football?.teamLevels.includes('youth_u15'));
  const start = state.player.birth + 14 * 12;
  const player = { ...state.people[state.player.id], teams: [{ ...team('youth_u15', start), clubId: club.id, teamKey: club.id }] };
  // Every keep roll fails: the player is released at the first school year end.
  state = { ...state, eventsById: {}, currentMonthIndex: start, people: { ...state.people, [player.id]: player }, rng: { ...state.rng, chance: () => false } };

  const after = advanceStep(state, 12);
  const entries = after.history.at(-1).entries;
  const review = entries.find((e) => e.type === 'teamSeason');
  assert.equal(review.outcome, 'released');
  const allowance = entries.filter((e) => e.type === 'money' && e.source === 'athleteAllowance');
  assert.equal(allowance.length, 1);
  const perMonth = allowancePerMonth({ clubId: club.id, teamLevelId: 'youth_u15' }, after.country);
  // Paid for the months up to that school year's last month, not after.
  let yearEnd = start + 1;
  while ((yearEnd % 12) + 1 !== after.country.education.schoolYearEndMonth) yearEnd++;
  assert.equal(allowance[0].amount, perMonth * (yearEnd - start));

  const lines = describeBlock(after.history.at(-1), after, LOCALE).lines.map((l) => l.text);
  assert.ok(lines.some((line) => line.startsWith('Auxílio atleta do ')), lines.join('\n'));
});

test('mergeSeasonEntries keeps one line per club, where the first payment was', () => {
  const event = { type: 'event', eventId: 'x' };
  const merged = mergeSeasonEntries([
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_a', amount: 100 },
    event,
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_b', amount: 5 },
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_a', amount: 50 },
  ]);
  assert.deepEqual(merged, [
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_a', amount: 150 },
    event,
    { type: 'money', source: 'athleteAllowance', clubId: 'cl_b', amount: 5 },
  ]);
});

test('the diary still reads allowance lines saved as "stipend" before the rename', () => {
  const club = Object.values(CLUBS)[0];
  const state = { country: BR, clubsById: CLUBS, player: { sex: 'M' }, people: {}, history: [] };
  const block = { month: 0, entries: [{ type: 'money', source: 'stipend', clubId: club.id, amount: 250 }] };
  const lines = describeBlock(block, state, LOCALE).lines.map((l) => l.text);
  assert.ok(lines.some((line) => line.startsWith('Auxílio atleta do ')), lines.join('\n'));
});
