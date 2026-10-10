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
import { rollAppearance, inheritFrom } from './appearanceCompat.js';
import { generateParents, createFamilyRelationships } from './family.js';
import { nameParents, nameChild } from './naming.js';

export const MAX_FIRST_NAME_LENGTH = 30;

// choices (design doc: "vida personalizada"): { firstName, sex, countryId,
// cityId }, each optional. The rng still draws every value, so the same
// seed lives the same life apart from what the player chose.
export function createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear, choices = {} }) {
  const rolledCountry = pickRandomCountry(rng, countries);
  const country = countries.find((c) => c.id === choices.countryId) ?? rolledCountry;
  const birthMonthIndex = toMonthIndex({ year: startYear, month: pickRandomBirthMonth(rng) });
  const rolledSex = rng.chance(0.5) ? 'F' : 'M';
  const sex = ['F', 'M'].includes(choices.sex) ? choices.sex : rolledSex;

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
  const rolledCityId = country.cities[rng.nextInt(0, country.cities.length)];
  const cityId = country.cities.includes(choices.cityId) ? choices.cityId : rolledCityId;
  const pickOccupation = () => ({ type: 'job', title: country.occupations[rng.nextInt(0, country.occupations.length)] });
  const named = nameParents(rng, { ...parents, country });
  const mother = { ...named.mother, cityId, occupation: pickOccupation(), appearance: rollAppearance(rng, 'F') };
  const father = { ...named.father, cityId, occupation: pickOccupation(), appearance: rollAppearance(rng, 'M') };
  const namedPlayer = nameChild(rng, unnamedPlayer, { mother, father, country });
  const chosenName = (choices.firstName ?? '').trim().slice(0, MAX_FIRST_NAME_LENGTH);
  // Parents start with some everyday stress (design doc: adults only).
  for (const parent of [mother, father]) parent.stress = rng.nextInt(20, 51);

  const player = {
    ...namedPlayer,
    firstName: chosenName || namedPlayer.firstName,
    cityId,
    appearance: inheritFrom(rng, mother, father, namedPlayer.sex),
  };

  return { player, mother, father, country, relationships: { motherChild, fatherChild, marriage } };
}
