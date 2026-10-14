// Writes, for every playable country, data/clubs/<country>.json — fictional
// clubs for each of its cities (docs/atividades.md 7.6) — and its pro
// leagues, data/leagues/<country>_<sport>_pro_<division>.json (Série A to
// D). Only ids and attributes: club names come from a pattern id and league
// names from the league id, both with their texts in locales/pt-BR. Seeded
// by the country id, so running it again gives the same clubs.
// Usage: node scripts/generate-clubs.js

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { createRng } from '../src/engine/random.js';

const CLUBS_DIR = fileURLToPath(new URL('../data/clubs/', import.meta.url));
const LEAGUES_DIR = fileURLToPath(new URL('../data/leagues/', import.meta.url));
const countriesById = loadCountries(fileURLToPath(new URL('../data/countries/', import.meta.url)));

const SPORTS = ['football', 'basketball'];
const YOUTH_LEVELS = ['youth_u11', 'youth_u15', 'youth_u17', 'youth_u20'];
const DIVISIONS = 4; // Série A to D, in each sport and country
const BIG_CITIES = 2; // the first cities of each country get one club more
const BASKETBALL_SHARE = 0.5;

function seedOf(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function shuffled(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

const proLeagueId = (countryId, activity, division) => `${countryId.toLowerCase()}_${activity}_pro_${division}`;

// Calendar month 1..12, `offset` months from `month`.
const monthFrom = (month, offset) => ((((month - 1 + offset) % 12) + 12) % 12) + 1;

// Elite academies hold short tryouts two to three months before the season;
// smaller clubs keep theirs open longer, up to the month before it starts.
function tryoutMonths(elite, seasonStart) {
  return elite ? [monthFrom(seasonStart, -3), monthFrom(seasonStart, -2)] : [monthFrom(seasonStart, -4), monthFrom(seasonStart, -1)];
}

// Big clubs (Série A and B) run elite academies with every category; the
// rest are regional, and half of those only start at under-15.
function sport(rng, countryId, activity, division, seasonStart) {
  const elite = division <= 2;
  const teamLevels = elite || rng.chance(0.5) ? YOUTH_LEVELS : YOUTH_LEVELS.slice(1);
  return {
    proLeague: proLeagueId(countryId, activity, division),
    youthLeague: `${activity}_youth_${elite ? 'elite' : 'regional'}`,
    teamLevels,
    tryoutMonths: tryoutMonths(elite, seasonStart),
  };
}

mkdirSync(CLUBS_DIR, { recursive: true });
mkdirSync(LEAGUES_DIR, { recursive: true });
for (const id of Object.keys(countriesById).filter((id) => id !== 'default').sort()) {
  const country = resolveCountry(id, countriesById);
  const rng = createRng(seedOf(`clubs:${id}`));
  const seasonStart = country.education.schoolYearStartMonth;
  const clubs = [];

  country.cities.forEach((cityId, cityIndex) => {
    const count = cityIndex < BIG_CITIES ? 3 : 2;
    const patterns = shuffled(rng, country.clubNamePatterns).slice(0, count);
    // At least one basketball club per city.
    const basketballAnyway = rng.nextInt(0, count);
    patterns.forEach((namePattern, index) => {
      // The first club of a big city plays in Série A or B.
      const division = cityIndex < BIG_CITIES && index === 0 ? rng.nextInt(1, 3) : rng.nextInt(1, DIVISIONS + 1);
      const sports = { football: sport(rng, id, 'football', division, seasonStart) };
      if (index === basketballAnyway || rng.chance(BASKETBALL_SHARE)) {
        sports.basketball = sport(rng, id, 'basketball', rng.nextInt(1, DIVISIONS + 1), seasonStart);
      }
      clubs.push({ id: `cl_${id.toLowerCase()}_${cityId}_${index + 1}`, countryId: id, cityId, namePattern, sports });
    });
  });

  writeJson(`${CLUBS_DIR}${id}.json`, { countryId: id, clubs });
  for (const activity of SPORTS) {
    for (let division = 1; division <= DIVISIONS; division++) {
      const leagueId = proLeagueId(id, activity, division);
      writeJson(`${LEAGUES_DIR}${leagueId}.json`, { id: leagueId, countryId: id, activity, kind: 'pro', division });
    }
  }
  console.log(`data/clubs/${id}.json: ${clubs.length} clubs; Série A to D in ${SPORTS.join(' and ')}`);
}
