// No fs here — this file must stay loadable from a browser; see
// eventsLoader.js for the Node-only reader.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { yearlyChanceToPeriod } from '../engine/random.js';
import { findRelationshipBetween } from './relationship.js';

export function indexEvents(events) {
  return Object.fromEntries(events.map((event) => [event.id, event]));
}

export function involvesPlayer(relationship, playerId, relationshipsById) {
  if (playerId in relationship.roles) return true;

  return Object.keys(relationship.roles).some(
    (personId) => findRelationshipBetween(personId, playerId, relationshipsById) !== null,
  );
}

// peopleById/country are optional so relationship-only callers keep working;
// they are threaded through so effects on people (stat, money) are not lost.
export function processRelationshipEvents(
  eventsById,
  relationshipsById,
  { currentMonthIndex, step, rng, playerId, peopleById = {}, country },
) {
  const relationshipEvents = Object.values(eventsById).filter((event) => event.subject === 'relationship');

  let accumulator = relationshipsById;
  let people = peopleById;
  const fired = [];
  const pendingDecisions = [];

  for (const relationshipId of Object.keys(relationshipsById)) {
    for (const event of relationshipEvents) {
      const relationship = accumulator[relationshipId];

      if (!evaluateConditions(event.conditions, relationship, { currentMonthIndex })) continue;

      const chance = yearlyChanceToPeriod(event.yearlyChance, step);
      if (!rng.chance(chance)) continue;

      const result = applyEffects(event.effects, { relationship, relationshipsById: accumulator, peopleById: people, playerId, country });
      accumulator = result.relationshipsById;
      people = result.peopleById;
      fired.push({ eventId: event.id, relationshipId });

      if (event.ifInvolvesPlayer && involvesPlayer(accumulator[relationshipId], playerId, accumulator)) {
        pendingDecisions.push({ trigger: event.ifInvolvesPlayer.trigger, firingRelationship: accumulator[relationshipId] });
      }
    }
  }

  return { relationshipsById: accumulator, peopleById: people, fired, pendingDecisions };
}

// optionId lets a real player choice override the rng pick (M5); omitting it
// keeps the old auto-resolve behavior (M3's console demo, still used there).
// firingRelationship is null for player events.
export function resolveDecision(
  decisionEvent,
  firingRelationship,
  { rng, playerId, relationshipsById, peopleById = {}, country, optionId },
) {
  const option = optionId
    ? decisionEvent.options.find((o) => o.id === optionId)
    : decisionEvent.options[rng.nextInt(0, decisionEvent.options.length)];

  if (!option) throw new Error(`Unknown option: ${optionId}`);

  const result = applyEffects(option.effects, {
    relationship: firingRelationship,
    relationshipsById,
    peopleById,
    playerId,
    country,
  });

  return { optionId: option.id, relationshipsById: result.relationshipsById, peopleById: result.peopleById };
}
