// Game loop shared by the console (main.js) and the UI: pure, no DOM. The UI
// stops and waits for the player on pending decisions; the console resolves
// them by rng.
//
// `history` is the life diary as data: one block per period, each with
// entries made only of ids and numbers (texts come from locales). Anything
// that changes the player during a period lands in that period's block.

import { createRng } from '../engine/random.js';
import { ageAt, advance } from '../engine/time.js';
import { createIdGenerator } from '../engine/id.js';
import { resolveCountry } from '../engine/countries.js';
import { createNewLife } from './life.js';
import { decayAll, resetInteractionsThisPeriod, findRelationshipBetween } from './relationship.js';
import { processRelationshipEvents, processPlayerEvents, resolveDecision as resolveDecisionEvent } from './events.js';
import { attemptInteraction, listAvailableInteractions } from './interactions.js';
import { isAllowanceAge, payAllowance, transferMoney } from './money.js';
import { growStats } from './growth.js';

const START_YEAR = 2000;
export const ADULT_AGE = 18;

// Smaller stat changes are still applied, just not worth a diary line.
const MIN_LOGGED_STAT_DELTA = 1;

export function createGameState({ seed, countriesById, eventsById, interactionsById, activitiesById }) {
  const rng = createRng(seed);
  const nextPersonId = createIdGenerator('p');
  const nextRelationshipId = createIdGenerator('r');

  const playableCountryIds = Object.keys(countriesById).filter((id) => id !== 'default');
  const countries = playableCountryIds.map((id) => resolveCountry(id, countriesById));

  const {
    player,
    mother,
    father,
    country,
    relationships: { motherChild, fatherChild, marriage },
  } = createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear: START_YEAR });

  return {
    rng,
    player,
    mother,
    father,
    country,
    people: { [player.id]: player, [mother.id]: mother, [father.id]: father },
    relationships: Object.fromEntries([motherChild, fatherChild, marriage].map((r) => [r.id, r])),
    motherChildId: motherChild.id,
    fatherChildId: fatherChild.id,
    marriageId: marriage.id,
    currentMonthIndex: player.birth,
    eventsById,
    interactionsById,
    activitiesById,
    pendingDecisions: [],
    firedEvents: [],
    history: [{ month: player.birth, entries: [{ type: 'birth' }] }],
    lastInteractionResult: null,
  };
}

export function isAdult(state) {
  return ageAt(state.player.birth, state.currentMonthIndex) >= ADULT_AGE;
}

function statEntries(before, after) {
  const entries = [];
  for (const stat of Object.keys(after.stats)) {
    const delta = Math.round((after.stats[stat] - before.stats[stat]) * 10) / 10;
    if (Math.abs(delta) >= MIN_LOGGED_STAT_DELTA) entries.push({ type: 'stat', stat, delta });
  }
  return entries;
}

function moneyEntries(before, after, details) {
  const amount = after.money - before.money;
  return amount === 0 ? [] : [{ type: 'money', amount, ...details }];
}

function appendToCurrentBlock(history, entries) {
  const last = history[history.length - 1];
  return [...history.slice(0, -1), { ...last, entries: [...last.entries, ...entries] }];
}

// Average of how much each parent likes the player.
function familyAffinity(state, relationships) {
  const sides = [
    relationships[state.motherChildId].affinity[state.mother.id],
    relationships[state.fatherChildId].affinity[state.father.id],
  ];
  return sides.reduce((sum, value) => sum + value, 0) / sides.length;
}

export function advanceStep(state, months) {
  const playerId = state.player.id;
  const playerBefore = state.people[playerId];
  const { nextMonthIndex, birthdays } = advance(state.currentMonthIndex, months, state.player.birth);
  const entries = birthdays.map((b) => ({ type: 'birthday', age: b.age, month: b.monthIndex }));

  let relationships = decayAll(state.relationships, months);
  relationships = resetInteractionsThisPeriod(relationships);
  let people = state.people;

  const world = processRelationshipEvents(state.eventsById, relationships, {
    currentMonthIndex: nextMonthIndex,
    step: months,
    rng: state.rng,
    playerId,
    peopleById: people,
    country: state.country,
  });
  relationships = world.relationshipsById;
  people = world.peopleById;
  for (const f of world.fired) entries.push({ type: 'worldEvent', eventId: f.eventId, relationshipId: f.relationshipId });

  const grown = growStats(people[playerId], {
    months,
    ageMonths: state.currentMonthIndex - state.player.birth,
    familyAffinity: familyAffinity(state, relationships),
  });
  people = { ...people, [playerId]: grown.person };

  const playerEvents = processPlayerEvents(state.eventsById, {
    player: people[playerId],
    peopleById: people,
    relationshipsById: relationships,
    currentMonthIndex: nextMonthIndex,
    step: months,
    rng: state.rng,
    country: state.country,
    firedEvents: state.firedEvents,
    hasDecision: world.pendingDecisions.length > 0,
  });
  relationships = playerEvents.relationshipsById;
  people = playerEvents.peopleById;
  // Events with options are logged when the player chooses (resolveDecision).
  for (const f of playerEvents.fired) {
    if (!state.eventsById[f.eventId].options) entries.push({ type: 'event', eventId: f.eventId });
  }

  if (isAllowanceAge(ageAt(state.player.birth, nextMonthIndex))) {
    for (const [parentId, relationshipId] of [
      [state.mother.id, state.motherChildId],
      [state.father.id, state.fatherChildId],
    ]) {
      const amount = payAllowance({ parent: people[parentId], relationship: relationships[relationshipId], country: state.country, step: months });
      if (amount === 0) continue;
      people = transferMoney(people, parentId, playerId, amount);
      entries.push({ type: 'money', source: 'allowance', fromId: parentId, amount });
    }
  }

  entries.push(...statEntries(playerBefore, people[playerId]));

  return {
    ...state,
    currentMonthIndex: nextMonthIndex,
    relationships,
    people,
    birthdays,
    fired: world.fired,
    pendingDecisions: [...world.pendingDecisions, ...playerEvents.pendingDecisions],
    firedEvents: [
      ...state.firedEvents,
      ...world.fired.map((f) => ({ eventId: f.eventId, month: nextMonthIndex })),
      ...playerEvents.fired,
    ],
    history: [...state.history, { month: nextMonthIndex, entries }],
  };
}

// optionId omitted -> the rng picks (console auto-play).
export function resolveDecision(state, optionId) {
  const decision = state.pendingDecisions[0];
  const decisionEvent = state.eventsById[decision.trigger];
  const playerBefore = state.people[state.player.id];

  const result = resolveDecisionEvent(decisionEvent, decision.firingRelationship, {
    rng: state.rng,
    playerId: state.player.id,
    relationshipsById: state.relationships,
    peopleById: state.people,
    country: state.country,
    optionId,
  });
  const playerAfter = result.peopleById[state.player.id];

  return {
    ...state,
    relationships: result.relationshipsById,
    people: result.peopleById,
    pendingDecisions: state.pendingDecisions.slice(1),
    history: appendToCurrentBlock(state.history, [
      { type: 'event', eventId: decisionEvent.id, optionId: result.optionId },
      ...moneyEntries(playerBefore, playerAfter, { source: 'event', eventId: decisionEvent.id }),
      ...statEntries(playerBefore, playerAfter),
    ]),
  };
}

export function attemptPlayerInteraction(state, interactionId, targetPersonId) {
  const interaction = state.interactionsById[interactionId];
  const relationship = findRelationshipBetween(state.player.id, targetPersonId, state.relationships);
  const playerBefore = state.people[state.player.id];

  const result = attemptInteraction(interaction, {
    relationship,
    player: playerBefore,
    target: state.people[targetPersonId],
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });

  const entries = result.attempted
    ? [
        { type: 'interaction', interactionId, targetId: targetPersonId, succeeded: result.succeeded },
        ...moneyEntries(playerBefore, result.peopleById[state.player.id], { source: 'interaction', interactionId, fromId: targetPersonId }),
        ...statEntries(playerBefore, result.peopleById[state.player.id]),
      ]
    : [];

  return {
    ...state,
    relationships: result.relationshipsById,
    people: result.peopleById,
    lastInteractionResult: result,
    history: entries.length > 0 ? appendToCurrentBlock(state.history, entries) : state.history,
  };
}

export function availableInteractions(state, targetPersonId) {
  return listAvailableInteractions(state.interactionsById, {
    relationship: findRelationshipBetween(state.player.id, targetPersonId, state.relationships),
    player: state.people[state.player.id],
    target: state.people[targetPersonId],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
  });
}
