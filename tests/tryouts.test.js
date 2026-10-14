import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  tryoutParts,
  tryoutScore,
  requiredScore,
  passChance,
  seasonOf,
  inMonthWindow,
  clubTeamLevel,
  tryoutTeamLevel,
  tryoutBlocker,
  coachFeedback,
  runTryout,
} from '../src/systems/tryouts.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadLeagues } from '../src/systems/clubsLoader.js';
import { createRng } from '../src/engine/random.js';
import { createLocale } from '../src/i18n/locale.js';
import { tryoutLine, clubName, teamSeasonLine, tryoutSignupLine } from '../src/ui/diary.js';

const dir = (path) => fileURLToPath(new URL(`../data/${path}/`, import.meta.url));
const FOOTBALL = loadActivities(dir('activities')).football;
const LEAGUES = loadLeagues(dir('leagues'));
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
// School from 6 to 18, years starting in February (like Brazil).
const COUNTRY = { education: { schoolYearStartMonth: 2, stages: [{ id: 'elementary', startAge: 6, years: 12 }] } };

const CLUB = {
  id: 'cl_br_recife_1',
  countryId: 'BR',
  cityId: 'recife',
  namePattern: 'tucanos',
  sports: { football: { proLeague: 'br_football_pro_3', youthLeague: 'football_youth_regional', teamLevels: ['youth_u15', 'youth_u17', 'youth_u20'], tryoutMonths: [10, 1] } },
};
const ELITE = { ...CLUB, id: 'cl_br_recife_2', sports: { football: { ...CLUB.sports.football, youthLeague: 'football_youth_elite' } } };

function person({ ageYears = 13, skill = 40, health = 70, physical = 0.5 } = {}) {
  return {
    id: 'p_kid',
    birth: 0,
    stats: { happiness: 50, health, intelligence: 50, looks: 50 },
    aptitudes: { physical },
    skills: { football: { skill } },
    month: ageYears * 12 + 2, // a March, inside the school year
  };
}

const at = (p) => p.month;

test('tryoutParts and tryoutScore follow the formula: skill ×0.5, health ×0.2, aptitude ×100 ×0.2, luck 0..10', () => {
  const p = person({ skill: 60, health: 80, physical: 0.7 });
  assert.deepEqual(tryoutParts(p, 'football'), { skill: 30, health: 16, aptitude: 14 });
  assert.equal(tryoutScore(p, 'football', { next: () => 0 }), 60);
  assert.equal(tryoutScore(p, 'football', { next: () => 0.5 }), 65);
  assert.equal(tryoutParts({ ...p, skills: {} }, 'football').skill, 0);
});

test('requiredScore adds the league offset to the category minimum', () => {
  const u15 = FOOTBALL.teamLevels.find((l) => l.id === 'youth_u15');
  assert.equal(requiredScore(u15, null), 55);
  assert.equal(requiredScore(u15, LEAGUES.football_youth_regional), 50);
  assert.equal(requiredScore(u15, LEAGUES.football_youth_elite), 65);
});

test('passChance: half at the requirement, near sure well above, near zero well below', () => {
  assert.equal(passChance(50, 50), 0.5);
  assert.ok(passChance(60, 50) > 0.95);
  assert.ok(passChance(40, 50) < 0.05);
  assert.ok(passChance(52, 50) > passChance(51, 50));
});

test('seasonOf counts school years; inMonthWindow handles windows across the new year', () => {
  // School year from February: January still belongs to the year before.
  assert.equal(seasonOf(24 + 1, 2), 2);
  assert.equal(seasonOf(24 + 0, 2), 1);
  assert.equal(seasonOf(24 + 11, 2), 2);
  assert.equal(inMonthWindow([10, 1], 12), true);
  assert.equal(inMonthWindow([10, 1], 1), true);
  assert.equal(inMonthWindow([10, 1], 2), false);
  assert.equal(inMonthWindow([3, 5], 4), true);
  assert.equal(inMonthWindow([3, 5], 6), false);
});

test('clubTeamLevel picks the category for the age, the younger where two overlap, only ones the club runs', () => {
  const all = { teamLevels: ['youth_u11', 'youth_u15', 'youth_u17', 'youth_u20'] };
  assert.equal(clubTeamLevel(FOOTBALL, all, 6).id, 'youth_u11');
  assert.equal(clubTeamLevel(FOOTBALL, all, 12).id, 'youth_u15');
  assert.equal(clubTeamLevel(FOOTBALL, all, 15).id, 'youth_u15');
  assert.equal(clubTeamLevel(FOOTBALL, all, 16).id, 'youth_u17');
  assert.equal(clubTeamLevel(FOOTBALL, all, 17).id, 'youth_u17');
  assert.equal(clubTeamLevel(FOOTBALL, all, 5), null);
  assert.equal(clubTeamLevel(FOOTBALL, CLUB.sports.football, 9), null, 'this club starts at under-15');
  assert.equal(tryoutTeamLevel(FOOTBALL, { kind: 'school' }, person(), at(person())).id, 'school');
});

test('tryoutBlocker: the sport, school, age and one try per team and season', () => {
  const kid = person({ ageYears: 13 });
  const args = { person: kid, monthIndex: at(kid), country: COUNTRY };
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: CLUB }, args), null);
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'school' }, args), null);
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: { ...CLUB, sports: {} } }, args), 'noSport');
  const young = person({ ageYears: 9 });
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: CLUB }, { ...args, person: young, monthIndex: at(young) }), 'age');
  const preschool = person({ ageYears: 5 });
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'school' }, { ...args, person: preschool, monthIndex: at(preschool) }), 'notInSchool');

  const season = seasonOf(at(kid), 2);
  const attempts = [{ activityId: 'football', teamKey: CLUB.id, season }];
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: CLUB }, { ...args, attempts }), 'alreadyTried');
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: ELITE }, { ...args, attempts }), null, 'another club is fine');
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'school' }, { ...args, attempts }), null);
  const nextSeason = { ...args, monthIndex: at(kid) + 12, person: kid };
  assert.equal(tryoutBlocker(FOOTBALL, { kind: 'club', club: CLUB }, { ...nextSeason, attempts }), null);
});

test('coachFeedback praises the strongest part and, after a failure, asks for the weakest', () => {
  // skill 30/100, health 90/100, aptitude 0.6.
  const p = person({ skill: 30, health: 90, physical: 0.6 });
  assert.deepEqual(coachFeedback(p, 'football', false), { praise: 'health', critique: 'skill' });
  assert.deepEqual(coachFeedback(p, 'football', true), { praise: 'health', critique: null });
});

test('runTryout reports the result and the coach, never the score', () => {
  const p = person({ ageYears: 13, skill: 70 });
  const passed = runTryout(FOOTBALL, { kind: 'club', club: CLUB }, { person: p, monthIndex: at(p), rng: { next: () => 0.5, chance: () => true }, leaguesById: LEAGUES });
  assert.deepEqual(Object.keys(passed).sort(), ['feedback', 'passed', 'teamLevelId']);
  assert.equal(passed.passed, true);
  assert.equal(passed.teamLevelId, 'youth_u15');

  // The rng's chance gets the pass chance: higher at a regional academy than at an elite one.
  const chances = [];
  const watching = { next: () => 0.5, chance: (c) => (chances.push(c), false) };
  runTryout(FOOTBALL, { kind: 'club', club: CLUB }, { person: p, monthIndex: at(p), rng: watching, leaguesById: LEAGUES });
  runTryout(FOOTBALL, { kind: 'club', club: ELITE }, { person: p, monthIndex: at(p), rng: watching, leaguesById: LEAGUES });
  assert.ok(chances[0] > chances[1]);
});

test('calibration: an untrained average child usually makes the school team; club categories need training', () => {
  const rate = (p, target) => {
    const rng = createRng(11);
    let passes = 0;
    for (let i = 0; i < 2000; i++) if (runTryout(FOOTBALL, target, { person: p, monthIndex: at(p), rng, leaguesById: LEAGUES }).passed) passes++;
    return passes / 2000;
  };
  const school = { kind: 'school' };
  const regional = { kind: 'club', club: CLUB };
  const elite = { kind: 'club', club: ELITE };
  assert.ok(rate(person({ ageYears: 10, skill: 0 }), school) > 0.6);
  assert.ok(rate(person({ ageYears: 13, skill: 10 }), regional) < 0.05, 'under-15 is out of reach without training');
  assert.ok(rate(person({ ageYears: 13, skill: 50 }), regional) > 0.4);
  assert.ok(rate(person({ ageYears: 13, skill: 50 }), elite) < 0.1);
  assert.ok(rate(person({ ageYears: 13, skill: 75 }), elite) > 0.4);
});

test('the diary shows the coach, not the score; club names use the pattern and the city', () => {
  assert.equal(clubName(LOCALE, CLUB), 'Tucanos de Recife');
  assert.equal(clubName(LOCALE, { cityId: 'london', namePattern: 'lanterns' }), 'London Lanterns');
  const failed = tryoutLine(LOCALE, { activityId: 'football', teamLevelId: 'youth_u15', passed: false, praise: 'aptitude', critique: 'health' }, CLUB);
  assert.equal(failed, 'Futebol, peneira do sub-15 do Tucanos de Recife: o técnico gostou da minha velocidade, mas pediu mais preparo físico. Não passei desta vez.');
  const passed = tryoutLine(LOCALE, { activityId: 'football', teamLevelId: 'school', passed: true, praise: 'skill', critique: null }, null);
  assert.equal(passed, 'Futebol, peneira do time da escola: o técnico gostou da minha técnica. Passei!');
  // No number besides the category's own name.
  assert.doesNotMatch((failed + passed).replace('sub-15', ''), /\d/);
});

test('the diary tells each end-of-year team review', () => {
  const entry = (outcome, teamLevelId) => ({ type: 'teamSeason', activityId: 'football', teamLevelId, outcome });
  assert.equal(teamSeasonLine(LOCALE, entry('kept', 'school'), null, 'M'), 'Futebol: continuo no time da escola.');
  assert.equal(teamSeasonLine(LOCALE, entry('promoted', 'youth_u17'), CLUB, 'F'), 'Futebol: fui promovida para o sub-17 do Tucanos de Recife!');
  assert.equal(teamSeasonLine(LOCALE, entry('released', 'youth_u15'), CLUB, 'M'), 'Futebol: fui dispensado do sub-15 do Tucanos de Recife.');
  assert.equal(teamSeasonLine(LOCALE, entry('left', 'school'), null, 'F'), 'Futebol: terminei a escola e me despedi do time da escola.');
});

test('the diary tells a club sign-up with the tryout month', () => {
  const entry = { type: 'tryoutSignup', activityId: 'football', clubId: CLUB.id, teamLevelId: 'youth_u15', month: 13 * 12 + 9 };
  assert.equal(tryoutSignupLine(LOCALE, entry, CLUB), 'Futebol: me inscrevi na peneira do sub-15 do Tucanos de Recife, em outubro.');
  assert.equal(
    tryoutSignupLine(LOCALE, entry, CLUB, 'minha mãe'),
    'Futebol: minha mãe deixou, e me inscrevi na peneira do sub-15 do Tucanos de Recife, em outubro.',
  );
});
