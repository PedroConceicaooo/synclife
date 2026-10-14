import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scoutYearlyChance, scoutClubs, rollScoutInvites, SCOUT_BASE_CHANCE, SCOUT_MAX_CHANCE } from '../src/systems/scout.js';
import { joinClubTeam } from '../src/systems/teams.js';
import { evaluateConditions } from '../src/engine/conditions.js';
import { yearlyChanceToPeriod } from '../src/engine/random.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadClubs, loadLeagues } from '../src/systems/clubsLoader.js';
import { createGameState, advanceStep, resolveDecision } from '../src/systems/game.js';
import { createLocale } from '../src/i18n/locale.js';
import { describeBlock } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const EVENTS = loadEvents(dir('events'));
const ACTIVITIES = loadActivities(dir('activities'));
const CLUBS = loadClubs(dir('clubs'));
const FOOTBALL = ACTIVITIES.football;
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
const COUNTRY = { education: { schoolYearStartMonth: 2, stages: [{ id: 'elementary', startAge: 6, years: 12 }] } };

function kid({ ageYears = 12, skill = 40, teams = [], cityId = 'recife' } = {}) {
  return { id: 'p_kid', birth: 0, countryId: 'BR', cityId, money: 0, stats: { happiness: 50, health: 70, intelligence: 50, looks: 50 }, skills: { football: { skill } }, teams, month: ageYears * 12 + 2 };
}

test('scoutYearlyChance: a little for anyone, more with skill past 40 and on the school team, capped', () => {
  assert.equal(scoutYearlyChance(kid({ skill: 30 }), 'football'), SCOUT_BASE_CHANCE);
  assert.ok(Math.abs(scoutYearlyChance(kid({ skill: 70 }), 'football') - (SCOUT_BASE_CHANCE + 30 * 0.006)) < 1e-9);
  const onSchoolTeam = kid({ skill: 70, teams: [{ activityId: 'football', teamKey: 'school' }] });
  assert.ok(scoutYearlyChance(onSchoolTeam, 'football') > scoutYearlyChance(kid({ skill: 70 }), 'football'));
  assert.equal(scoutYearlyChance(kid({ skill: 1000 }), 'football'), SCOUT_MAX_CHANCE);
});

test("scoutClubs: clubs with a category for the age, from the player's city when it has one", () => {
  const p = kid();
  const local = scoutClubs(p, FOOTBALL, CLUBS, p.month);
  assert.ok(local.length > 0);
  assert.ok(local.every((c) => c.cityId === 'recife' && c.countryId === 'BR'));
  const noClubCity = scoutClubs(kid({ cityId: 'nowhere' }), FOOTBALL, CLUBS, p.month);
  assert.ok(noClubCity.length > local.length && noClubCity.every((c) => c.countryId === 'BR'));
  assert.deepEqual(scoutClubs(kid({ ageYears: 3 }), FOOTBALL, CLUBS, 3 * 12), []);
});

test('rollScoutInvites: scaled to the months advanced, only where the event conditions hold', () => {
  const p = kid({ skill: 70 });
  const chances = [];
  const rng = { chance: (c) => (chances.push(c), true), nextInt: (min) => min };
  const args = { person: p, activitiesById: ACTIVITIES, clubsById: CLUBS, country: COUNTRY, relationshipsById: {}, monthIndex: p.month, months: 6, rng };
  const invites = rollScoutInvites(EVENTS, args);
  assert.deepEqual(invites.map((d) => d.trigger), ['scout_invite_football']);
  assert.ok(CLUBS[invites[0].clubId].sports.football);
  assert.ok(Math.abs(chances[0] - yearlyChanceToPeriod(scoutYearlyChance(p, 'football'), 6)) < 1e-9);

  const inClub = { ...p, teams: [{ activityId: 'football', teamKey: 'cl_x', clubId: 'cl_x' }] };
  assert.deepEqual(rollScoutInvites(EVENTS, { ...args, person: inClub }), [], 'already in a club');
  assert.deepEqual(rollScoutInvites(EVENTS, { ...args, person: { ...p, skills: {} } }), [], 'never played');
  assert.deepEqual(rollScoutInvites(EVENTS, { ...args, rng: { ...rng, chance: () => false } }), []);
});

test('notOnClubTeam ignores the school team', () => {
  const school = kid({ teams: [{ activityId: 'football', teamKey: 'school' }] });
  assert.equal(evaluateConditions({ notOnClubTeam: 'football' }, school), true);
  const club = kid({ teams: [{ activityId: 'football', teamKey: 'cl_x', clubId: 'cl_x' }] });
  assert.equal(evaluateConditions({ notOnClubTeam: 'football' }, club), false);
});

test('joinClubTeam puts the player in the category for the age, unless already in a club', () => {
  const club = Object.values(CLUBS).find((c) => c.cityId === 'recife' && c.sports.football.teamLevels.includes('youth_u15'));
  const joined = joinClubTeam(kid(), FOOTBALL, club, kid().month);
  assert.deepEqual(joined.entry, { type: 'teamJoined', activityId: 'football', clubId: club.id, teamLevelId: 'youth_u15' });
  assert.equal(joined.person.teams[0].clubId, club.id);
  const again = joinClubTeam(joined.person, FOOTBALL, club, kid().month);
  assert.equal(again.entry, null);
  assert.equal(again.person, joined.person);
});

test('in the game: an invitation names the club, and accepting needs the parents of a minor', () => {
  let state = createGameState({
    seed: 2,
    countriesById: loadCountries(dir('countries')),
    eventsById: EVENTS,
    interactionsById: loadInteractions(dir('interactions')),
    activitiesById: ACTIVITIES,
    clubsById: CLUBS,
    leaguesById: loadLeagues(dir('leagues')),
  });
  const playerId = state.player.id;
  const month = state.player.birth + 12 * 12;
  const player = { ...state.people[playerId], skills: { football: { skill: 70, peak: 70, sessions: 20, lastTrainedMonth: month, level: 0, levelSince: month } } };
  // Only the scout events, and every roll says yes.
  const scoutEvents = { scout_invite_football: EVENTS.scout_invite_football };
  state = { ...state, eventsById: scoutEvents, currentMonthIndex: month, people: { ...state.people, [playerId]: player }, rng: { ...state.rng, chance: () => true } };

  const invited = advanceStep(state, 6);
  const decision = invited.pendingDecisions.find((d) => d.trigger === 'scout_invite_football');
  assert.ok(decision?.clubId, 'an invitation with its club');

  const accepted = resolveDecision(invited, 'accept');
  const joined = accepted.history.at(-1).entries.find((e) => e.type === 'teamJoined');
  assert.equal(joined.clubId, decision.clubId);
  assert.ok(joined.parentId);
  assert.ok(accepted.people[playerId].teams.some((t) => t.clubId === decision.clubId));

  const refused = resolveDecision({ ...invited, rng: { ...invited.rng, chance: () => false } }, 'accept');
  assert.ok(refused.history.at(-1).entries.some((e) => e.type === 'scoutRefused'));
  assert.ok(!refused.people[playerId].teams?.length);

  const declined = resolveDecision(invited, 'decline');
  assert.ok(!declined.people[playerId].teams?.length);

  const lines = describeBlock(accepted.history.at(-1), accepted, LOCALE).lines.map((l) => l.text);
  assert.ok(lines.some((l) => l.startsWith('Um olheiro do ') && !l.includes('{club}')), lines.join('\n'));
  assert.ok(lines.some((l) => /deixou, e entrei no sub-/.test(l)), lines.join('\n'));
});
