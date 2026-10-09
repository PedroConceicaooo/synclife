// Minimal person shape for M1. Field names match the full design-doc shape
// so later milestones can add fields (stats, aptitudes, ...) without renaming.

export function createPerson({ id, sex, birth, countryId }) {
  return { id, sex, birth, countryId };
}

export function pickRandomCountry(rng, countries) {
  return countries[rng.nextInt(0, countries.length)];
}

export function pickRandomBirthMonth(rng) {
  return rng.nextInt(1, 13);
}
