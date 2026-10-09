import { fileURLToPath } from 'node:url';
import { createRng } from './engine/random.js';
import { toMonthIndex, fromMonthIndex, ageAt, advance } from './engine/time.js';
import { createPerson, pickRandomCountry, pickRandomBirthMonth } from './engine/person.js';
import { loadCountries, resolveCountry } from './engine/countries.js';
import { createIdGenerator } from './engine/id.js';
import { generateParents, createFamilyRelationships } from './engine/family.js';
import { decayAll } from './engine/relationship.js';
import { loadEvents, processRelationshipEvents, resolveDecision } from './engine/events.js';

const START_YEAR = 2000;
const ADULT_AGE = 18;
const COUNTRIES_DIR = fileURLToPath(new URL('../data/countries/', import.meta.url));
const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));

function readSeedFromArgs() {
  const arg = process.argv.find((a) => a.startsWith('--seed='));
  return arg ? Number(arg.slice('--seed='.length)) : Date.now();
}

function formatDate(monthIndex) {
  const { year, month } = fromMonthIndex(monthIndex);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatAffinity(relationship) {
  const sides = Object.entries(relationship.affinity)
    .map(([personId, value]) => `${personId}=${value.toFixed(1)}`)
    .join(', ');
  return `${relationship.id} type=${relationship.type} roles=${JSON.stringify(relationship.roles)} affinity={${sides}}`;
}

function main() {
  const seed = readSeedFromArgs();
  console.log(`Seed: ${seed}`);

  const rng = createRng(seed);
  const nextPersonId = createIdGenerator('p');
  const nextRelationshipId = createIdGenerator('r');

  const eventsById = loadEvents(EVENTS_DIR);

  const countriesById = loadCountries(COUNTRIES_DIR);
  const playableCountryIds = Object.keys(countriesById).filter((id) => id !== 'default');
  const countries = playableCountryIds.map((id) => resolveCountry(id, countriesById));

  const country = pickRandomCountry(rng, countries);
  const birthMonthIndex = toMonthIndex({ year: START_YEAR, month: pickRandomBirthMonth(rng) });
  const sex = rng.chance(0.5) ? 'F' : 'M';

  const person = createPerson({ id: nextPersonId(), sex, birth: birthMonthIndex, countryId: country.id });
  console.log(`Born: ${person.id} sex=${person.sex} country=${person.countryId} date=${formatDate(person.birth)}`);

  const { mother, father } = generateParents(rng, person, nextPersonId);
  console.log(`Mother: ${mother.id} date=${formatDate(mother.birth)}`);
  console.log(`Father: ${father.id} date=${formatDate(father.birth)}`);

  const familyRelationships = createFamilyRelationships(
    rng,
    { child: person, mother, father },
    nextRelationshipId,
    person.birth,
  );

  const people = { [person.id]: person, [mother.id]: mother, [father.id]: father };
  let relationships = Object.fromEntries(familyRelationships.map((r) => [r.id, r]));

  let currentMonth = person.birth;

  while (ageAt(person.birth, currentMonth) < ADULT_AGE) {
    const step = rng.chance(0.5) ? 6 : 12;
    const { nextMonthIndex, birthdays } = advance(currentMonth, step, person.birth);
    currentMonth = nextMonthIndex;
    relationships = decayAll(relationships, step);

    const { relationshipsById: afterEvents, fired, pendingDecisions } = processRelationshipEvents(
      eventsById,
      relationships,
      { currentMonthIndex: currentMonth, step, rng, playerId: person.id },
    );
    relationships = afterEvents;

    for (const event of fired) {
      console.log(`Event fired: ${event.eventId} on ${event.relationshipId} (${formatDate(currentMonth)})`);
    }

    for (const decision of pendingDecisions) {
      const decisionEvent = eventsById[decision.trigger];
      const { optionId, relationshipsById: afterDecision } = resolveDecision(decisionEvent, decision.firingRelationship, {
        rng,
        playerId: person.id,
        relationshipsById: relationships,
      });
      relationships = afterDecision;
      console.log(`Decision triggered: ${decision.trigger} -> chose ${optionId}`);
    }

    for (const birthday of birthdays) {
      console.log(`Turned ${birthday.age} (${formatDate(birthday.monthIndex)})`);
    }
  }

  console.log(
    `Done: ${person.id} age=${ageAt(person.birth, currentMonth)} date=${formatDate(currentMonth)} country=${person.countryId}`,
  );

  console.log('Family summary:');
  for (const relationship of Object.values(relationships)) {
    console.log(`  ${formatAffinity(relationship)}`);
  }
}

main();
