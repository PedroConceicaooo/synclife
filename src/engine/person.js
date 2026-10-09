// Minimal person shape. Field names match the full design-doc shape so later
// milestones can add fields (stats, aptitudes, ...) without renaming.

export function createPerson({ id, sex, birth, countryId, money = 0, traits = [] }) {
  return { id, sex, birth, countryId, money, traits };
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
