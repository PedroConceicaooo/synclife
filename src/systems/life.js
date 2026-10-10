// Bootstraps a brand new life: picks a country, creates the player, generates
// parents and the family relationships. Shared by the console entry point
// and the UI so both start a life the exact same way.

import { toMonthIndex } from '../engine/time.js';
import {
  createPerson,
  pickRandomCountry,
  pickRandomBirthMonth,
  rollStats,
  rollAptitudes,
  NEWBORN_STAT_RANGES,
} from '../engine/person.js';
import { generateParents, createFamilyRelationships } from './family.js';
import { nameParents, nameChild } from './naming.js';

export function createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear }) {
  const country = pickRandomCountry(rng, countries);
  const birthMonthIndex = toMonthIndex({ year: startYear, month: pickRandomBirthMonth(rng) });
  const sex = rng.chance(0.5) ? 'F' : 'M';

  const stats = rollStats(rng, NEWBORN_STAT_RANGES);
  const aptitudes = rollAptitudes(rng);

  const unnamedPlayer = createPerson({ id: nextPersonId(), sex, birth: birthMonthIndex, countryId: country.id, stats, aptitudes });
  const parents = generateParents(rng, unnamedPlayer, nextPersonId, country);


  const [motherChild, fatherChild, marriage] = createFamilyRelationships(
    rng,
    { child: unnamedPlayer, ...parents },
    nextRelationshipId,
    unnamedPlayer.birth,
  );

  // Names, home city and jobs are rolled after everything else so adding
  // them did not reshuffle the earlier draws.
  const cityId = country.cities[rng.nextInt(0, country.cities.length)];
  const pickOccupation = () => ({ type: 'job', title: country.occupations[rng.nextInt(0, country.occupations.length)] });
  const named = nameParents(rng, { ...parents, country });
  const mother = { ...named.mother, cityId, occupation: pickOccupation() };
  const father = { ...named.father, cityId, occupation: pickOccupation() };
  const player = { ...nameChild(rng, unnamedPlayer, { mother, father, country }), cityId };

  return { player, mother, father, country, relationships: { motherChild, fatherChild, marriage } };
}
