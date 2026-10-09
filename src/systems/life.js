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

export function createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear }) {
  const country = pickRandomCountry(rng, countries);
  const birthMonthIndex = toMonthIndex({ year: startYear, month: pickRandomBirthMonth(rng) });
  const sex = rng.chance(0.5) ? 'F' : 'M';

  const stats = rollStats(rng, NEWBORN_STAT_RANGES);
  const aptitudes = rollAptitudes(rng);

  const player = createPerson({ id: nextPersonId(), sex, birth: birthMonthIndex, countryId: country.id, stats, aptitudes });
  const { mother, father } = generateParents(rng, player, nextPersonId, country);

  const [motherChild, fatherChild, marriage] = createFamilyRelationships(
    rng,
    { child: player, mother, father },
    nextRelationshipId,
    player.birth,
  );

  return { player, mother, father, country, relationships: { motherChild, fatherChild, marriage } };
}
