import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { teamLeague, playingRole, seasonMonths, playGames, mergeSeasonEntries, STARTER_MARGIN } from '../src/systems/games.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadLeagues } from '../src/systems/clubsLoader.js';
import { createLocale } from '../src/i18n/locale.js';
import { teamEntryLine } from '../src/ui/diary.js';

const dir = (path) => fileURLToPath(new URL(`../data/${path}/`, import.meta.url));
const ACTIVITIES = loadActivities(dir('activities'));
const LEAGUES = loadLeagues(dir('leagues'));
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
// School year from February to December (like Brazil): January is holiday.
const COUNTRY = { education: { schoolYearStartMonth: 2, schoolYearEndMonth: 12, stages: [] } };
const CLUB = {
  id: 'cl_br_recife_1',
  countryId: 'BR',
  cityId: 'recife',
  namePattern: 'tucanos',
  sports: { football: { proLeague: 'br_football_pro_3', youthLeague: 'football_youth_regional', teamLevels: ['youth_u15'], tryoutMonths: [10, 1] } },
};
const CONTEXT = { activitiesById: ACTIVITIES, clubsById: { [CLUB.id]: CLUB }, leaguesById: LEAGUES, country: COUNTRY };

const clubTeam = { activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u15', since: 0 };
const schoolTeam = (activityId) => ({ activityId, teamKey: 'school', teamLevelId: 'school', since: 0 });
const person = ({ skill = 60, teams = [clubTeam] } = {}) => ({
  id: 'p_kid',
  birth: 0,
  stats: { happiness: 50, health: 70, intelligence: 50, looks: 50 },
  aptitudes: { physical: 0.5 },
  skills: { football: { skill }, basketball: { skill } },
  teams,
});

test('teamLeague: the school league of the sport, or the club youth league', () => {
  assert.equal(teamLeague(schoolTeam('basketball'), CONTEXT).id, 'basketball_school');
  assert.equal(teamLeague(clubTeam, CONTEXT).id, 'football_youth_regional');
  assert.equal(teamLeague({ ...clubTeam, clubId: 'gone' }, CONTEXT), null);
});

test('playingRole: a starter with STARTER_MARGIN to spare, rotation above the requirement, else the bench', () => {
  // Regional under-15 asks 50; health 70 and aptitude 0.5 give 24 plus 5 of average luck.
  const league = LEAGUES.football_youth_regional;
  const at = (skill) => playingRole(person({ skill }), ACTIVITIES.football, clubTeam, league);
  assert.equal(at(2 * (50 - 29 + STARTER_MARGIN)), 'starter');
  assert.equal(at(2 * (50 - 29 + STARTER_MARGIN) - 2), 'rotation');
  assert.equal(at(2 * (50 - 29)), 'rotation');
  assert.equal(at(2 * (50 - 29) - 2), 'bench');
});

test('seasonMonths counts the school year months on the team, not the holidays', () => {
  // A year from December of year 0 to December of year 1: January is out.
  assert.equal(seasonMonths(clubTeam, 11, 23, COUNTRY.education), 11);
  assert.equal(seasonMonths({ ...clubTeam, since: 20 }, 11, 23, COUNTRY.education), 4, 'from the month joined');
  assert.equal(seasonMonths(clubTeam, 11, 12, COUNTRY.education), 0);
});

test('playGames: games per month of the league, results that add up, draws only where the sport has them', () => {
  const rng = { chance: () => false };
  const football = playGames(person(), 11, 23, { ...CONTEXT, rng });
  assert.deepEqual(football.entries, [
    { type: 'teamGames', activityId: 'football', clubId: CLUB.id, teamLevelId: 'youth_u15', played: 22, won: 0, drawn: 0, lost: 22, role: 'starter' },
  ]);

  const always = { chance: () => true };
  const draws = playGames(person(), 11, 23, { ...CONTEXT, rng: always }).entries[0];
  assert.equal(draws.drawn, 22, 'football: the draw roll comes first');
  const basketball = playGames(person({ teams: [schoolTeam('basketball')] }), 11, 23, { ...CONTEXT, rng: always }).entries[0];
  assert.deepEqual([basketball.played, basketball.won, basketball.drawn], [11, 11, 0]);
});

test('playGames: playing time moves happiness; no team, no games', () => {
  const rng = { chance: () => false };
  assert.equal(playGames(person({ skill: 100 }), 11, 23, { ...CONTEXT, rng }).person.stats.happiness, 52);
  assert.equal(playGames(person({ skill: 0 }), 11, 23, { ...CONTEXT, rng }).person.stats.happiness, 49);
  const nobody = person({ teams: [] });
  assert.equal(playGames(nobody, 11, 23, { ...CONTEXT, rng }).person, nobody);
});

test('mergeSeasonEntries joins the games of one team, keeping the last playing time', () => {
  const games = (played, role) => ({ type: 'teamGames', activityId: 'football', clubId: 'cl_a', teamLevelId: 'youth_u15', played, won: played, drawn: 0, lost: 0, role });
  const merged = mergeSeasonEntries([games(4, 'bench'), { type: 'event', eventId: 'x' }, games(6, 'starter')]);
  assert.deepEqual(merged, [{ ...games(10, 'starter') }, { type: 'event', eventId: 'x' }]);
});

test('the diary sums up the games of an advance', () => {
  const state = { activitiesById: ACTIVITIES, clubsById: { [CLUB.id]: CLUB } };
  const football = { type: 'teamGames', activityId: 'football', clubId: CLUB.id, teamLevelId: 'youth_u15', played: 8, won: 5, drawn: 1, lost: 2, role: 'starter' };
  assert.equal(teamEntryLine(state, LOCALE, football), 'Futebol: 8 jogos pelo sub-15 do Tucanos de Recife (5 vitórias, 1 empate, 2 derrotas). Fui titular.');
  const basketball = { type: 'teamGames', activityId: 'basketball', teamLevelId: 'school', played: 1, won: 0, drawn: 0, lost: 1, role: 'bench' };
  assert.equal(teamEntryLine(state, LOCALE, basketball), 'Basquete: 1 jogo pelo time da escola (0 vitórias, 1 derrota). Fiquei mais no banco.');
});

test('school and youth leagues have games per month; team sports say whether they draw', () => {
  for (const league of Object.values(LEAGUES).filter((l) => ['school', 'youth'].includes(l.kind))) {
    assert.ok(league.gamesPerMonth > 0, league.id);
  }
  for (const activity of Object.values(ACTIVITIES).filter((a) => a.teamLevels)) {
    assert.equal(typeof activity.teamGames?.draws, 'boolean', activity.id);
  }
});
