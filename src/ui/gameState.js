// UI-side orchestration: calls only pure engine/systems functions, touches
// no DOM. This is the browser's equivalent of main.js's console loop, except
// it stops and waits for the player instead of resolving everything by rng.

import { createRng } from '../engine/random.js';
import { ageAt, advance } from '../engine/time.js';
import { createIdGenerator } from '../engine/id.js';
import { resolveCountry } from '../engine/countries.js';
import { createNewLife } from '../systems/life.js';
import { decayAll, resetInteractionsThisPeriod, findRelationshipBetween } from '../systems/relationship.js';
import { processRelationshipEvents, resolveDecision as resolveDecisionEvent } from '../systems/events.js';
import { attemptInteraction } from '../systems/interactions.js';
import { attemptActivity } from '../systems/activities.js';
import { isAllowanceAge, payAllowance, transferMoney } from '../systems/money.js';

const START_YEAR = 2000;
export const ADULT_AGE = 18;

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
    lastInteractionResult: null,
  };
}

export function isAdult(state) {
  return ageAt(state.player.birth, state.currentMonthIndex) >= ADULT_AGE;
}

export function advanceStep(state, months) {
  const { nextMonthIndex, birthdays } = advance(state.currentMonthIndex, months, state.player.birth);
  let relationships = decayAll(state.relationships, months);
  relationships = resetInteractionsThisPeriod(relationships);

  const { relationshipsById: afterEvents, fired, pendingDecisions } = processRelationshipEvents(
    state.eventsById,
    relationships,
    { currentMonthIndex: nextMonthIndex, step: months, rng: state.rng, playerId: state.player.id },
  );
  relationships = afterEvents;

  let people = state.people;
  const mowLawn = state.activitiesById.mow_lawn;
  const activityResult = attemptActivity(mowLawn, {
    player: people[state.player.id],
    peopleById: people,
    country: state.country,
    currentMonthIndex: nextMonthIndex,
  });
  people = activityResult.peopleById;

  if (isAllowanceAge(ageAt(state.player.birth, nextMonthIndex))) {
    for (const [parentId, relationshipId] of [
      [state.mother.id, state.motherChildId],
      [state.father.id, state.fatherChildId],
    ]) {
      const amount = payAllowance({ parent: people[parentId], relationship: relationships[relationshipId], country: state.country, step: months });
      people = transferMoney(people, parentId, state.player.id, amount);
    }
  }

  return {
    ...state,
    currentMonthIndex: nextMonthIndex,
    relationships,
    people,
    birthdays,
    fired,
    pendingDecisions,
  };
}

export function resolveDecision(state, optionId) {
  const decision = state.pendingDecisions[0];
  const decisionEvent = state.eventsById[decision.trigger];

  const { relationshipsById } = resolveDecisionEvent(decisionEvent, decision.firingRelationship, {
    rng: state.rng,
    playerId: state.player.id,
    relationshipsById: state.relationships,
    optionId,
  });

  return {
    ...state,
    relationships: relationshipsById,
    pendingDecisions: state.pendingDecisions.slice(1),
  };
}

export function attemptPlayerInteraction(state, interactionId, targetPersonId) {
  const interaction = state.interactionsById[interactionId];
  const relationship = findRelationshipBetween(state.player.id, targetPersonId, state.relationships);

  const result = attemptInteraction(interaction, {
    relationship,
    player: state.people[state.player.id],
    target: state.people[targetPersonId],
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });

  return {
    ...state,
    relationships: result.relationshipsById,
    people: result.peopleById,
    lastInteractionResult: result,
  };
}
