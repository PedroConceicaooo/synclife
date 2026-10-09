import { fileURLToPath } from 'node:url';
import { createRng } from './engine/random.js';
import { fromMonthIndex, ageAt } from './engine/time.js';
import { loadCountries } from './engine/countriesLoader.js';
import { loadEvents } from './systems/eventsLoader.js';
import { loadInteractions } from './systems/interactionsLoader.js';
import { loadActivities } from './systems/activitiesLoader.js';
import { createGameState, advanceStep, resolveDecision, isAdult } from './systems/game.js';

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

function formatStats(person) {
  return Object.entries(person.stats)
    .map(([stat, value]) => `${stat}=${Math.round(value)}`)
    .join(' ');
}

function formatPerson(person) {
  return `${person.id} money=${person.money} traits=[${person.traits.join(', ')}] ${formatStats(person)}`;
}

// Console output is a developer view of the diary entries (ids, not texts).
function formatEntry(entry) {
  switch (entry.type) {
    case 'birth':
      return 'born';
    case 'birthday':
      return `turned ${entry.age} (${formatDate(entry.month)})`;
    case 'event':
      return entry.optionId ? `event ${entry.eventId} -> chose ${entry.optionId}` : `event ${entry.eventId}`;
    case 'worldEvent':
      return `world event ${entry.eventId} on ${entry.relationshipId}`;
    case 'money':
      return `money ${entry.amount > 0 ? '+' : ''}${entry.amount} (${entry.source}${entry.fromId ? ` from ${entry.fromId}` : ''})`;
    case 'stat':
      return `${entry.stat} ${entry.delta > 0 ? '+' : ''}${entry.delta}`;
    case 'interaction':
      return `interaction ${entry.interactionId} -> ${entry.targetId} ${entry.succeeded ? 'succeeded' : 'failed'}`;
    default:
      return JSON.stringify(entry);
  }
}

function printBlock(state, block) {
  console.log(`[${formatDate(block.month)}] age ${ageAt(state.player.birth, block.month)}`);
  for (const entry of block.entries) console.log(`  ${formatEntry(entry)}`);
}

function main() {
  const seed = readSeedFromArgs();
  console.log(`Seed: ${seed}`);

  let state = createGameState({
    seed,
    countriesById: loadCountries(COUNTRIES_DIR),
    eventsById: loadEvents(EVENTS_DIR),
    interactionsById: loadInteractions(INTERACTIONS_DIR),
    activitiesById: loadActivities(ACTIVITIES_DIR),
  });

  console.log(`Born: ${formatPerson(state.player)} sex=${state.player.sex} country=${state.country.id}`);
  console.log(`Mother: ${formatPerson(state.mother)}`);
  console.log(`Father: ${formatPerson(state.father)}`);

  // Step choice is separate from the game's rng so it doesn't shift the life's
  // draws; same seed still means the same life.
  const stepRng = createRng(seed ^ 0x5eed);

  while (!isAdult(state)) {
    state = advanceStep(state, stepRng.chance(0.5) ? 6 : 12);
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
    printBlock(state, state.history[state.history.length - 1]);
  }

  const player = state.people[state.player.id];
  console.log(`Done: ${formatPerson(player)} age=${ageAt(player.birth, state.currentMonthIndex)} date=${formatDate(state.currentMonthIndex)}`);
  for (const relationship of Object.values(state.relationships)) {
    const sides = Object.entries(relationship.affinity)
      .map(([personId, value]) => `${personId}=${value.toFixed(1)}`)
      .join(', ');
    console.log(`  ${relationship.id} ${relationship.type}${relationship.state ? `/${relationship.state}` : ''} {${sides}}`);
  }
}

main();
