import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  isOnTeam,
  teamTryoutBlocker,
  tryOut,
  endSeason,
  nextSeasonStart,
  nextTryoutMonth,
  signUpForTryout,
  runDueTryouts,
  windowEnd,
  listClubTryouts,
  KEEP_MARGIN,
} from '../src/systems/teams.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { activityBlocker, listActivities } from '../src/systems/activities.js';
import { loadLeagues } from '../src/systems/clubsLoader.js';

const dir = (path) => fileURLToPath(new URL(`../data/${path}/`, import.meta.url));
const ACTIVITIES = loadActivities(dir('activities'));
const FOOTBALL = ACTIVITIES.football;
const LEAGUES = loadLeagues(dir('leagues'));
// School from 6 to 18, years from February to December (like Brazil).
const COUNTRY = { education: { schoolYearStartMonth: 2, schoolYearEndMonth: 12, stages: [{ id: 'elementary', startAge: 6, years: 12 }] } };
const CLUB = {
  id: 'cl_br_recife_1',
  countryId: 'BR',
  cityId: 'recife',
  namePattern: 'tucanos',
  sports: { football: { proLeague: 'br_football_pro_3', youthLeague: 'football_youth_regional', teamLevels: ['youth_u11', 'youth_u15', 'youth_u17'], tryoutMonths: [10, 1] } },
};
const CONTEXT = { activitiesById: ACTIVITIES, clubsById: { [CLUB.id]: CLUB }, leaguesById: LEAGUES, country: COUNTRY };

// Born in January of year 0: the school year starting in February of year
// N is the one at age N; December of year N ends it.
const march = (age) => age * 12 + 2;
const december = (age) => age * 12 + 11;

function person({ skill = 60, health = 70, teams = [], tryouts = [] } = {}) {
  return {
    id: 'p_kid',
    birth: 0,
    stats: { happiness: 50, health, intelligence: 50, looks: 50 },
    aptitudes: { physical: 0.5 },
    skills: { football: { skill } },
    teams,
    tryouts,
  };
}

const passes = { next: () => 0.5, chance: () => true };
const fails = { next: () => 0.5, chance: () => false };

test('tryOut: passing joins the team; the attempt is kept either way', () => {
  const school = { kind: 'school' };
  const joined = tryOut(person(), FOOTBALL, school, { monthIndex: march(10), country: COUNTRY, rng: passes });
  assert.equal(joined.blocker, null);
  assert.deepEqual(joined.person.teams, [{ activityId: 'football', teamKey: 'school', teamLevelId: 'school', since: march(10) }]);
  assert.deepEqual(joined.person.tryouts, [{ activityId: 'football', teamKey: 'school', season: 10 }]);
  assert.equal(joined.entry.type, 'tryout');
  assert.equal(joined.entry.passed, true);
  assert.equal(isOnTeam(joined.person, 'football', 'school'), true);

  const club = { kind: 'club', club: CLUB };
  const failed = tryOut(person(), FOOTBALL, club, { monthIndex: march(13), country: COUNTRY, rng: fails, leaguesById: LEAGUES });
  assert.deepEqual(failed.person.teams, []);
  assert.deepEqual(failed.person.tryouts, [{ activityId: 'football', teamKey: CLUB.id, season: 13 }]);
  assert.equal(failed.entry.passed, false);
  assert.equal(failed.entry.clubId, CLUB.id);
  assert.equal(failed.entry.teamLevelId, 'youth_u15');
  assert.ok(failed.entry.critique);
  assert.equal('score' in failed.entry, false);
});

test('a second try at the same team waits for the next season; being on it blocks a tryout', () => {
  const club = { kind: 'club', club: CLUB };
  const first = tryOut(person(), FOOTBALL, club, { monthIndex: march(13), country: COUNTRY, rng: fails, leaguesById: LEAGUES });
  const again = tryOut(first.person, FOOTBALL, club, { monthIndex: march(13) + 3, country: COUNTRY, rng: passes, leaguesById: LEAGUES });
  assert.equal(again.blocker, 'alreadyTried');
  assert.equal(again.person, first.person);
  const nextYear = tryOut(first.person, FOOTBALL, club, { monthIndex: march(14), country: COUNTRY, rng: passes, leaguesById: LEAGUES });
  assert.equal(nextYear.blocker, null);
  assert.equal(teamTryoutBlocker(FOOTBALL, club, { person: nextYear.person, monthIndex: march(15), country: COUNTRY }), 'onTeam');
});

test('endSeason: same category next year is kept with KEEP_MARGIN of slack, else released', () => {
  const team = { activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u15', since: march(13) };
  const chances = [];
  const watching = { next: () => 0.5, chance: (c) => (chances.push(c), true) };
  const kept = endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(13), rng: watching });
  assert.deepEqual(kept.person.teams, [team]);
  assert.deepEqual(kept.entries, [{ type: 'teamSeason', activityId: 'football', clubId: CLUB.id, teamLevelId: 'youth_u15', outcome: 'kept' }]);

  // The same person facing the entry requirement would have a lower chance.
  const entering = endSeason(person({ teams: [{ ...team, teamLevelId: 'youth_u11' }] }), { ...CONTEXT, monthIndex: december(13), rng: watching });
  assert.equal(entering.entries[0].outcome, 'promoted');
  assert.ok(chances[0] > chances[1], `keeping (${chances[0]}) is easier than moving up (${chances[1]}) by ${KEEP_MARGIN} points`);

  const released = endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(13), rng: fails });
  assert.deepEqual(released.person.teams, []);
  assert.equal(released.entries[0].outcome, 'released');
});

test('endSeason: an age that calls for the next category promotes, from the next season on', () => {
  // 15 in under-15; next season at 16 is under-17.
  const team = { activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u15', since: march(14) };
  const result = endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(15), rng: passes });
  assert.deepEqual(result.person.teams, [{ ...team, teamLevelId: 'youth_u17', since: march(16) - 1 }]);
  assert.equal(result.entries[0].outcome, 'promoted');
  assert.equal(result.entries[0].teamLevelId, 'youth_u17');
});

test('endSeason: a club without the next category, or a club gone, releases', () => {
  // This club stops at under-17: at 18 there is no category.
  const team = { activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u17', since: march(16) };
  assert.equal(endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(17), rng: passes }).entries[0].outcome, 'released');
  const gone = endSeason(person({ teams: [team] }), { ...CONTEXT, clubsById: {}, monthIndex: december(16), rng: passes });
  assert.equal(gone.entries[0].outcome, 'released');
});

test('endSeason: leaving school ends the school team; people without teams are untouched', () => {
  const team = { activityId: 'football', teamKey: 'school', teamLevelId: 'school', since: march(17) };
  const left = endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(17), rng: passes });
  assert.deepEqual(left.person.teams, []);
  assert.equal(left.entries[0].outcome, 'left');
  const kept = endSeason(person({ teams: [team] }), { ...CONTEXT, monthIndex: december(12), rng: passes });
  assert.equal(kept.entries[0].outcome, 'kept');

  const nobody = person();
  assert.equal(endSeason(nobody, { ...CONTEXT, monthIndex: december(12), rng: passes }).person, nobody);
});

test('nextSeasonStart is the first month of the next school year', () => {
  assert.equal(nextSeasonStart(december(13), 2), march(14) - 1); // Brazil: December, then February
  assert.equal(nextSeasonStart(13 * 12 + 1, 2), march(14) - 1); // February itself: the following one
  assert.equal(nextSeasonStart(13 * 12 + 6, 9), 13 * 12 + 8); // July, start in September
});

test('nextTryoutMonth finds the first month inside the club window, wrapping the new year', () => {
  assert.equal(nextTryoutMonth([10, 1], 13 * 12 + 2), 13 * 12 + 9); // March -> October
  assert.equal(nextTryoutMonth([10, 1], 13 * 12 + 11), 13 * 12 + 11); // December is inside
  assert.equal(nextTryoutMonth([10, 1], 14 * 12 + 0), 14 * 12 + 0); // so is January
  assert.equal(nextTryoutMonth([10, 1], 14 * 12 + 1), 14 * 12 + 9); // February waits for October
});

test('signUpForTryout books the next window, checked for that month, once per club', () => {
  const kid = person();
  const signed = signUpForTryout(kid, FOOTBALL, CLUB, { monthIndex: march(13), country: COUNTRY });
  assert.equal(signed.blocker, null);
  assert.deepEqual(signed.signup, { activityId: 'football', clubId: CLUB.id, month: 13 * 12 + 9, teamLevelId: 'youth_u15' });
  assert.deepEqual(signed.person.tryoutSignups, [{ activityId: 'football', clubId: CLUB.id, month: 13 * 12 + 9 }]);
  assert.equal(signUpForTryout(signed.person, FOOTBALL, CLUB, { monthIndex: march(13), country: COUNTRY }).blocker, 'signedUp');
  // January at 5 is inside the window, and no category takes a 5-year-old.
  assert.equal(signUpForTryout(kid, FOOTBALL, CLUB, { monthIndex: march(5) - 2, country: COUNTRY }).blocker, 'age');
  assert.equal(signUpForTryout(kid, ACTIVITIES.basketball, CLUB, { monthIndex: march(13), country: COUNTRY }).blocker, 'noSport');
});

test('runDueTryouts runs only the sign-ups whose month came, at their month', () => {
  const signed = signUpForTryout(person(), FOOTBALL, CLUB, { monthIndex: march(13), country: COUNTRY }).person;
  const early = runDueTryouts(signed, 13 * 12 + 8, { ...CONTEXT, rng: passes });
  assert.equal(early.person, signed);
  assert.deepEqual(early.entries, []);

  const due = runDueTryouts(signed, 13 * 12 + 11, { ...CONTEXT, rng: passes });
  assert.deepEqual(due.person.tryoutSignups, []);
  assert.deepEqual(due.person.teams, [{ activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u15', since: 13 * 12 + 9 }]);
  assert.equal(due.entries[0].type, 'tryout');

  // Already on the team when the window comes: the sign-up lapses.
  const onTeam = { ...signed, teams: due.person.teams };
  const lapsed = runDueTryouts(onTeam, 13 * 12 + 11, { ...CONTEXT, rng: passes });
  assert.deepEqual(lapsed.entries, []);
  assert.deepEqual(lapsed.person.tryoutSignups, []);
});

test('a team player trains the sport without a class fee', () => {
  const country = { currency: { scale: { small: 10, medium: 50, large: 200 } } };
  const kid = { ...person(), money: 0 };
  const args = { player: kid, country, currentMonthIndex: march(12) };
  assert.equal(activityBlocker(FOOTBALL, args), 'notEnrolled');

  const onTeam = { ...kid, teams: [{ activityId: 'football', teamKey: 'school', teamLevelId: 'school', since: 0 }] };
  assert.equal(activityBlocker(FOOTBALL, { ...args, player: onTeam }), null);
  const listed = listActivities({ football: FOOTBALL }, { ...args, player: onTeam })[0].activities[0];
  assert.equal(listed.enrollment.trainsWithTeam, true);
  assert.equal(listed.blocker, null);
});

test('one club at a time per sport: on a club team, other clubs wait; the school team is fine', () => {
  const other = { ...CLUB, id: 'cl_br_recife_2' };
  const inClub = person({ teams: [{ activityId: 'football', teamKey: CLUB.id, clubId: CLUB.id, teamLevelId: 'youth_u15', since: 0 }] });
  assert.equal(teamTryoutBlocker(FOOTBALL, { kind: 'club', club: other }, { person: inClub, monthIndex: march(13), country: COUNTRY }), 'otherClub');
  assert.equal(teamTryoutBlocker(FOOTBALL, { kind: 'school' }, { person: inClub, monthIndex: march(13), country: COUNTRY }), null);
  assert.equal(signUpForTryout(inClub, FOOTBALL, other, { monthIndex: march(13), country: COUNTRY }).blocker, 'otherClub');
});

test('windowEnd is the last month of the window that starts there', () => {
  assert.equal(windowEnd([10, 1], 13 * 12 + 9), 14 * 12 + 0); // October to January
  assert.equal(windowEnd([10, 1], 14 * 12 + 0), 14 * 12 + 0);
  assert.equal(windowEnd([3, 5], 13 * 12 + 2), 13 * 12 + 4);
});

test('listClubTryouts: the city first, accessible first, with category, dates, youngest age and blocker', () => {
  const elite = { ...CLUB, id: 'cl_br_recife_2', sports: { football: { ...CLUB.sports.football, youthLeague: 'football_youth_elite', teamLevels: ['youth_u15', 'youth_u17'] } } };
  const away = { ...CLUB, id: 'cl_br_salvador_1', cityId: 'salvador' };
  const foreign = { ...CLUB, id: 'cl_us_chicago_1', countryId: 'US', cityId: 'chicago' };
  const noFootball = { ...CLUB, id: 'cl_br_recife_3', sports: {} };
  const clubsById = Object.fromEntries([away, elite, CLUB, foreign, noFootball].map((c) => [c.id, c]));
  const kid = { ...person(), countryId: 'BR', cityId: 'recife' };
  const rows = listClubTryouts(kid, FOOTBALL, { clubsById, leaguesById: LEAGUES, monthIndex: march(13), country: COUNTRY });

  assert.deepEqual(rows.map((r) => r.clubId), [CLUB.id, elite.id, away.id]);
  assert.deepEqual(rows[0], {
    clubId: CLUB.id,
    cityId: 'recife',
    local: true,
    teamLevelId: 'youth_u15',
    tryoutMonth: 13 * 12 + 9,
    deadline: 14 * 12 + 0,
    minAge: 6,
    requirement: 'accessible',
    onTeam: false,
    lastSeason: null,
    blocker: null,
  });
  assert.equal(rows[1].requirement, 'demanding');
  assert.equal(rows[1].minAge, 12);

  const signed = signUpForTryout(kid, FOOTBALL, CLUB, { monthIndex: march(13), country: COUNTRY }).person;
  assert.equal(listClubTryouts(signed, FOOTBALL, { clubsById, leaguesById: LEAGUES, monthIndex: march(13), country: COUNTRY })[0].blocker, 'signedUp');
});
