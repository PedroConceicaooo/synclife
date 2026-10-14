import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexClubs, indexLeagues } from '../src/systems/clubs.js';
import { loadClubs, loadLeagues } from '../src/systems/clubsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';

const dir = (path) => fileURLToPath(new URL(`../data/${path}/`, import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const CLUBS = loadClubs(dir('clubs'));
const LEAGUES = loadLeagues(dir('leagues'));
const ACTIVITIES = loadActivities(dir('activities'));
const COUNTRIES = loadCountries(dir('countries'));
const PLAYABLE = Object.keys(COUNTRIES).filter((id) => id !== 'default');
const TEAM_SPORTS = Object.values(ACTIVITIES).filter((a) => a.teamLevels);
const SCALES = ['small', 'medium', 'large'];

test('indexClubs joins the clubs of every country file by id; indexLeagues indexes by id', () => {
  const clubs = indexClubs([{ countryId: 'BR', clubs: [{ id: 'cl_a' }] }, { countryId: 'US', clubs: [{ id: 'cl_b' }] }]);
  assert.deepEqual(Object.keys(clubs), ['cl_a', 'cl_b']);
  assert.deepEqual(indexLeagues([{ id: 'l_1' }]), { l_1: { id: 'l_1' } });
});

test('football and basketball are paid classes (rule 8 minAge) with team levels', () => {
  assert.deepEqual(TEAM_SPORTS.map((a) => a.id).sort(), ['basketball', 'football']);
  for (const activity of TEAM_SPORTS) {
    assert.equal(typeof activity.conditions.minAge, 'number', activity.id);
    assert.ok(activity.enrollment && activity.training, `${activity.id}: the class is paid and trains`);
    assert.ok(!activity.competitions, `${activity.id}: team sports compete through leagues, not alone`);
    const ids = activity.teamLevels.map((level) => level.id);
    assert.equal(new Set(ids).size, ids.length, activity.id);
    for (const level of activity.teamLevels) {
      assert.ok(['school', 'college', 'club'].includes(level.kind), `${activity.id}.${level.id}`);
      assert.equal(typeof level.minScore, 'number', `${activity.id}.${level.id}`);
      if (level.kind === 'club') assert.ok(level.minAge <= level.maxAge, `${activity.id}.${level.id}: ages`);
      if (level.next) assert.ok(ids.includes(level.next), `${activity.id}.${level.id} -> ${level.next}`);
      assert.ok(LOCALE[`teamLevel.${level.id}`], `teamLevel.${level.id}`);
    }
  }
});

test('leagues: known kind and activity, team levels that exist, names in pt-BR', () => {
  for (const league of Object.values(LEAGUES)) {
    const activity = ACTIVITIES[league.activity];
    assert.ok(activity?.teamLevels, league.id);
    assert.ok(['school', 'college', 'youth', 'pro'].includes(league.kind), league.id);
    for (const levelId of league.teamLevels ?? []) assert.ok(activity.teamLevels.some((l) => l.id === levelId), `${league.id}: ${levelId}`);
    if (league.kind === 'youth') {
      assert.ok(['accessible', 'demanding'].includes(league.requirement), league.id);
      assert.equal(typeof league.minScoreOffset, 'number', league.id);
    }
    if (league.kind === 'pro') assert.ok(Number.isInteger(league.division) && league.division >= 1, league.id);
    assert.ok(LOCALE[`league.${league.id}`], `league.${league.id}`);
  }
});

test('clubs: ids and attributes only, in a real city of their country, pointing at matching leagues', () => {
  for (const club of Object.values(CLUBS)) {
    assert.match(club.id, /^cl_[a-z]{2}_[a-z_]+_\d+$/);
    const country = resolveCountry(club.countryId, COUNTRIES);
    assert.ok(country.cities.includes(club.cityId), `${club.id}: city`);
    assert.ok(country.clubNamePatterns.includes(club.namePattern), `${club.id}: pattern`);
    assert.deepEqual(Object.keys(club).sort(), ['cityId', 'countryId', 'id', 'namePattern', 'sports']);
    for (const [activityId, sport] of Object.entries(club.sports)) {
      const clubLevels = ACTIVITIES[activityId].teamLevels.filter((l) => l.kind === 'club').map((l) => l.id);
      assert.equal(LEAGUES[sport.proLeague]?.kind, 'pro', `${club.id}: ${sport.proLeague}`);
      assert.equal(LEAGUES[sport.proLeague].activity, activityId);
      const youth = LEAGUES[sport.youthLeague];
      assert.equal(youth?.kind, 'youth', `${club.id}: ${sport.youthLeague}`);
      assert.equal(youth.activity, activityId);
      assert.ok(sport.teamLevels.length > 0, club.id);
      for (const levelId of sport.teamLevels) {
        assert.ok(clubLevels.includes(levelId) && youth.teamLevels.includes(levelId), `${club.id}: ${levelId}`);
      }
      assert.equal(sport.tryoutMonths.length, 2, club.id);
      for (const month of sport.tryoutMonths) assert.ok(Number.isInteger(month) && month >= 1 && month <= 12, club.id);
    }
  }
});

test('every city of every playable country has football and basketball clubs, each name used once per city', () => {
  for (const id of PLAYABLE) {
    const country = resolveCountry(id, COUNTRIES);
    for (const cityId of country.cities) {
      const clubs = Object.values(CLUBS).filter((c) => c.countryId === id && c.cityId === cityId);
      assert.ok(clubs.some((c) => c.sports.football), `${id} ${cityId}: football`);
      assert.ok(clubs.some((c) => c.sports.basketball), `${id} ${cityId}: basketball`);
      const patterns = clubs.map((c) => c.namePattern);
      assert.equal(new Set(patterns).size, patterns.length, `${id} ${cityId}: repeated name`);
    }
  }
});

test('every club name pattern has a pt-BR text with the city in it', () => {
  for (const id of PLAYABLE) {
    for (const pattern of resolveCountry(id, COUNTRIES).clubNamePatterns) {
      assert.match(LOCALE[`clubPattern.${pattern}`] ?? '', /\{city\}/, `${id}: clubPattern.${pattern}`);
    }
  }
});

test('youth stipend: from 14 to 19 in the default country, a money scale per club category, a source for Brazil', () => {
  const stipend = COUNTRIES.default.youthStipend;
  assert.equal(stipend.minAge, 14);
  assert.equal(stipend.maxAge, 19);
  const clubLevels = TEAM_SPORTS.flatMap((a) => a.teamLevels.filter((l) => l.kind === 'club').map((l) => l.id));
  let last = 0;
  for (const [levelId, amount] of Object.entries(stipend.teamLevels)) {
    assert.ok(clubLevels.includes(levelId), levelId);
    assert.ok(SCALES.includes(amount.scale), levelId);
    assert.ok(amount.multiplier > 0, levelId);
    const value = resolveCountry('BR', COUNTRIES).currency.scale[amount.scale] * amount.multiplier;
    assert.ok(value > last, `${levelId}: the stipend goes up with the category`);
    last = value;
  }
  for (const id of PLAYABLE) assert.deepEqual(resolveCountry(id, COUNTRIES).youthStipend, stipend, `${id} inherits it`);
  assert.ok(resolveCountry('BR', COUNTRIES).legalSources.youthStipend?.source);
});
