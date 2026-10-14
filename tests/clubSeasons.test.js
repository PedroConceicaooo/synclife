import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seasonEndsBetween, leagueClubs, playLeagueSeason, playClubSeasons, lastStanding, MOMENTUM } from '../src/systems/clubSeasons.js';
import { loadClubs, loadLeagues } from '../src/systems/clubsLoader.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createGameState, advanceStep, clubTryouts } from '../src/systems/game.js';
import { toSave, fromSave } from '../src/systems/save.js';
import { createRng } from '../src/engine/random.js';
import { createLocale } from '../src/i18n/locale.js';
import { teamEntryLine } from '../src/ui/diary.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const CLUBS = loadClubs(dir('clubs'));
const LEAGUES = loadLeagues(dir('leagues'));
const COUNTRIES = loadCountries(dir('countries'));
const BR = resolveCountry('BR', COUNTRIES); // school year ends in December
const LOCALE = createLocale(JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8')));
const DATA = {
  countriesById: COUNTRIES,
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
  clubsById: CLUBS,
  leaguesById: LEAGUES,
};

test('seasonEndsBetween finds the school year\'s last month in range', () => {
  const december = (year) => year * 12 + 11;
  assert.deepEqual(seasonEndsBetween(december(2000) - 6, december(2000) + 6, BR.education), [december(2000)]);
  assert.deepEqual(seasonEndsBetween(december(2000), december(2002), BR.education), [december(2001), december(2002)]);
  assert.deepEqual(seasonEndsBetween(december(2000), december(2000) + 6, BR.education), []);
});

test('leagueClubs: the clubs whose pro league it is, sorted', () => {
  const clubs = leagueClubs(LEAGUES.br_football_pro_1, CLUBS);
  assert.ok(clubs.length > 0);
  assert.ok(clubs.every((id) => CLUBS[id].sports.football.proLeague === 'br_football_pro_1'));
  assert.deepEqual(clubs, [...clubs].sort());
});

test('playLeagueSeason orders by roll plus momentum from last season', () => {
  const rolls = (values) => ({ next: () => values.shift() });
  assert.deepEqual(playLeagueSeason(['a', 'b', 'c'], null, rolls([0.1, 0.9, 0.5])), ['b', 'c', 'a']);
  // With the same rolls, last season's champion keeps MOMENTUM over last place.
  const even = () => ({ next: () => 0.5 });
  assert.deepEqual(playLeagueSeason(['a', 'b', 'c'], ['c', 'b', 'a'], even()), ['c', 'b', 'a']);
  assert.ok(MOMENTUM > 0 && MOMENTUM < 1);
});

test('playClubSeasons plays each pro league of the country once per season end, and lastStanding reads it', () => {
  const year = 2005 * 12;
  const played = playClubSeasons({}, { leaguesById: LEAGUES, clubsById: CLUBS, country: BR, fromMonth: year, toMonth: year + 24, rng: createRng(4) });
  const brLeagues = Object.values(LEAGUES).filter((l) => l.kind === 'pro' && l.countryId === 'BR' && leagueClubs(l, CLUBS).length > 0);
  assert.equal(played.ended.length, brLeagues.length * 2);
  assert.ok(Object.keys(played.clubSeasons).every((id) => LEAGUES[id].countryId === 'BR'));
  const history = played.clubSeasons.br_football_pro_1;
  assert.deepEqual(history.map((s) => s.season), [2005, 2006]);
  assert.deepEqual([...history[0].table].sort(), leagueClubs(LEAGUES.br_football_pro_1, CLUBS));

  const club = CLUBS[history[1].table[0]];
  assert.deepEqual(lastStanding(played.clubSeasons, club, 'football'), { leagueId: 'br_football_pro_1', season: 2006, position: 1, size: history[1].table.length });
  assert.equal(lastStanding({}, club, 'football'), null);
});

test('in the game: seasons pile up, survive a save, show in the clubs list, and the diary tells the player\'s club', () => {
  let state = createGameState({ seed: 3, ...DATA });
  state = { ...state, eventsById: {} };
  const brLike = state.country;
  const club = Object.values(CLUBS).find((c) => c.countryId === brLike.id && c.sports.football);
  const playerId = state.player.id;
  const team = { activityId: 'football', teamKey: club.id, clubId: club.id, teamLevelId: 'youth_u11', since: state.currentMonthIndex };
  state = { ...state, people: { ...state.people, [playerId]: { ...state.people[playerId], teams: [team] } } };

  const after = advanceStep(advanceStep(state, 12), 12);
  const seasons = after.clubSeasons[club.sports.football.proLeague];
  assert.ok(seasons.length >= 1);
  const told = after.history.flatMap((b) => b.entries).filter((e) => e.type === 'clubSeason');
  assert.ok(told.length >= 1 && told.every((e) => e.clubId === club.id));
  const line = teamEntryLine(after, LOCALE, told[0]);
  assert.match(line, /: \d+º lugar na temporada \d{4} \(.+ – Série [A-D]\)\.$/);

  const reloaded = fromSave(JSON.parse(JSON.stringify(toSave(after))), DATA);
  assert.deepEqual(reloaded.clubSeasons, after.clubSeasons);
  const row = clubTryouts(after, 'football').find((r) => r.clubId === club.id);
  assert.equal(row.lastSeason.season, seasons.at(-1).season);
});
