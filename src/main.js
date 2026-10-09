import { fileURLToPath } from 'node:url';
import { createRng } from './engine/random.js';
import { fromMonthIndex, ageAt, advance } from './engine/time.js';
import { resolveCountry } from './engine/countries.js';
import { loadCountries } from './engine/countriesLoader.js';
import { createIdGenerator } from './engine/id.js';
import { createNewLife } from './systems/life.js';
import { decayAll, resetInteractionsThisPeriod } from './systems/relationship.js';
import { processRelationshipEvents, resolveDecision } from './systems/events.js';
import { loadEvents } from './systems/eventsLoader.js';
import { attemptInteraction } from './systems/interactions.js';
import { loadInteractions } from './systems/interactionsLoader.js';
import { attemptActivity } from './systems/activities.js';
import { loadActivities } from './systems/activitiesLoader.js';
import { isAllowanceAge, payAllowance, transferMoney } from './systems/money.js';

const START_YEAR = 2000;
const ADULT_AGE = 18;
const COUNTRIES_DIR = fileURLToPath(new URL('../data/countries/', import.meta.url));
const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));
const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));

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

function formatPerson(person) {
  return `${person.id} money=${person.money.toFixed(2)} traits=[${person.traits.join(', ')}]`;
}

function main() {
  const seed = readSeedFromArgs();
  console.log(`Seed: ${seed}`);

  const rng = createRng(seed);
  const nextPersonId = createIdGenerator('p');
  const nextRelationshipId = createIdGenerator('r');

  const eventsById = loadEvents(EVENTS_DIR);
  const interactionsById = loadInteractions(INTERACTIONS_DIR);
  const activitiesById = loadActivities(ACTIVITIES_DIR);
  const askMoney = interactionsById.ask_money;
  const mowLawn = activitiesById.mow_lawn;

  const countriesById = loadCountries(COUNTRIES_DIR);
  const playableCountryIds = Object.keys(countriesById).filter((id) => id !== 'default');
  const countries = playableCountryIds.map((id) => resolveCountry(id, countriesById));

  const {
    player: person,
    mother,
    father,
    country,
    relationships: { motherChild, fatherChild, marriage },
  } = createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear: START_YEAR });

  console.log(`Born: ${person.id} sex=${person.sex} country=${person.countryId} date=${formatDate(person.birth)}`);
  console.log(`Mother: ${formatPerson(mother)} date=${formatDate(mother.birth)}`);
  console.log(`Father: ${formatPerson(father)} date=${formatDate(father.birth)}`);

  let people = { [person.id]: person, [mother.id]: mother, [father.id]: father };
  let relationships = Object.fromEntries([motherChild, fatherChild, marriage].map((r) => [r.id, r]));

  let currentMonth = person.birth;

  while (ageAt(person.birth, currentMonth) < ADULT_AGE) {
    const step = rng.chance(0.5) ? 6 : 12;
    const { nextMonthIndex, birthdays } = advance(currentMonth, step, person.birth);
    currentMonth = nextMonthIndex;
    relationships = decayAll(relationships, step);
    relationships = resetInteractionsThisPeriod(relationships);

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

    for (const [parent, relationship] of [
      [mother, relationships[motherChild.id]],
      [father, relationships[fatherChild.id]],
    ]) {
      const result = attemptInteraction(askMoney, {
        relationship,
        player: person,
        target: parent,
        peopleById: people,
        relationshipsById: relationships,
        country,
        currentMonthIndex: currentMonth,
        rng,
      });
      relationships = result.relationshipsById;
      people = result.peopleById;
      if (result.attempted) {
        console.log(`Interaction: ask_money -> ${parent.id} ${result.succeeded ? 'succeeded' : 'failed'}`);
      }
    }

    const activityResult = attemptActivity(mowLawn, {
      player: person,
      peopleById: people,
      country,
      currentMonthIndex: currentMonth,
    });
    people = activityResult.peopleById;
    if (activityResult.attempted) {
      console.log(`Activity: mow_lawn -> earned money`);
    }

    if (isAllowanceAge(ageAt(person.birth, currentMonth))) {
      for (const [parent, relationship] of [
        [mother, relationships[motherChild.id]],
        [father, relationships[fatherChild.id]],
      ]) {
        const amount = payAllowance({ parent: people[parent.id], relationship, country, step });
        people = transferMoney(people, parent.id, person.id, amount);
        console.log(`Allowance from ${parent.id}: ${amount.toFixed(2)}`);
      }
    }

    for (const birthday of birthdays) {
      console.log(`Turned ${birthday.age} (${formatDate(birthday.monthIndex)})`);
    }
  }

  console.log(
    `Done: ${formatPerson(people[person.id])} age=${ageAt(person.birth, currentMonth)} date=${formatDate(currentMonth)} country=${person.countryId}`,
  );

  console.log('Family summary:');
  for (const relationship of Object.values(relationships)) {
    console.log(`  ${formatAffinity(relationship)}`);
  }
  for (const id of [mother.id, father.id]) {
    console.log(`  ${formatPerson(people[id])}`);
  }
}

main();
