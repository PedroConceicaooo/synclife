// Minimal person shape. Field names match the full design-doc shape so later
// milestones can add fields (stats, aptitudes, ...) without renaming.

// The flat-50 stats default only exists for tests and hand-built fixtures;
// real lives roll their stats with rollStats (see life.js / family.js). The
// literal is re-evaluated per call so people never share a stats object.
export function createPerson({
  id,
  sex,
  birth,
  countryId,
  money = 0,
  traits = [],
  stats = { happiness: 50, health: 50, intelligence: 50, looks: 50 },
  aptitudes = null,
  firstName = null,
  lastName = null,
  cityId = null,
  occupation = null,
  appearance = null,
  stress = null,
}) {
  return {
    id,
    firstName,
    lastName,
    sex,
    birth,
    countryId,
    cityId,
    money,
    traits,
    traitTendencies: {},
    stats,
    aptitudes,
    occupation,
    appearance,
    emotion: null,
    stress,
  };
}

// [min, maxExclusive] per stat, as rng.nextInt takes them. A newborn starts
// happy and with low intelligence, which grows through childhood (growth.js).
export const NEWBORN_STAT_RANGES = {
  happiness: [60, 91],
  health: [55, 91],
  intelligence: [10, 31],
  looks: [20, 81],
};

export const ADULT_STAT_RANGES = {
  happiness: [30, 81],
  health: [50, 91],
  intelligence: [30, 81],
  looks: [20, 81],
};

export function rollStats(rng, ranges) {
  return Object.fromEntries(Object.entries(ranges).map(([stat, range]) => [stat, rng.nextInt(...range)]));
}

// Hidden 0..1 values (design doc: cognitive, physical, social), two decimals.
export function rollAptitudes(rng) {
  const roll = () => rng.nextInt(0, 101) / 100;
  return { cognitive: roll(), physical: roll(), social: roll() };
}

export function pickRandomCountry(rng, countries) {
  return countries[rng.nextInt(0, countries.length)];
}

export function pickRandomBirthMonth(rng) {
  return rng.nextInt(1, 13);
}

// Fixed, NPC-only in M4 — the player's traits are formed by childhood
// choices instead (a future milestone), so the player keeps traits: [].
const TRAIT_POOL = ['patient', 'explosive', 'shy', 'sociable', 'generous', 'rigid', 'stubborn'];

export function pickRandomTraits(rng, count = 2) {
  const pool = [...TRAIT_POOL];
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(pool.splice(rng.nextInt(0, pool.length), 1)[0]);
  }
  return picked;
}
