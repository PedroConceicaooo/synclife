// Pets (design: a dog, a cat — anyone you have a bond with is in
// Relationships). A pet is a person-like record with a species.

import { nextIdAfter } from '../engine/id.js';
import { createPerson } from '../engine/person.js';
import { createRelationship } from './relationship.js';

export const PET_SPECIES = ['dog', 'cat'];
export const PET_COATS = 5;
const PET_AFFINITY = [60, 81];
const PET_AGE_MONTHS = [2, 25];

export function adoptPet(rng, { species, peopleById, relationshipsById, playerId, monthIndex, country }) {
  if (!PET_SPECIES.includes(species)) throw new Error(`Unknown pet species: ${species}`);
  const names = country.petNames[species];
  const pet = createPerson({
    id: nextIdAfter('p', Object.keys(peopleById)),
    sex: rng.chance(0.5) ? 'F' : 'M',
    birth: monthIndex - rng.nextInt(...PET_AGE_MONTHS),
    countryId: country.id,
    firstName: names[rng.nextInt(0, names.length)],
    appearance: { coat: rng.nextInt(0, PET_COATS) },
  });
  const withSpecies = { ...pet, species };
  const relationship = createRelationship({
    id: nextIdAfter('r', Object.keys(relationshipsById)),
    type: 'pet',
    roles: { [playerId]: 'owner', [pet.id]: 'pet' },
    affinity: { [playerId]: rng.nextInt(...PET_AFFINITY), [pet.id]: rng.nextInt(...PET_AFFINITY) },
    since: monthIndex,
  });
  return {
    peopleById: { ...peopleById, [pet.id]: withSpecies },
    relationshipsById: { ...relationshipsById, [relationship.id]: relationship },
    petId: pet.id,
  };
}
