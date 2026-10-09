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

export function processRelationshipEvents(eventsById, relationshipsById, { currentMonthIndex, step, rng, playerId }) {
  const relationshipEvents = Object.values(eventsById).filter((event) => event.subject === 'relationship');

  let accumulator = relationshipsById;
  const fired = [];
  const pendingDecisions = [];

  for (const relationshipId of Object.keys(relationshipsById)) {
    for (const event of relationshipEvents) {
      const relationship = accumulator[relationshipId];

      if (!evaluateConditions(event.conditions, relationship, { currentMonthIndex })) continue;

      const chance = yearlyChanceToPeriod(event.yearlyChance, step);
      if (!rng.chance(chance)) continue;

      accumulator = applyEffects(event.effects, { relationship, relationshipsById: accumulator, playerId }).relationshipsById;
      fired.push({ eventId: event.id, relationshipId });

      if (event.ifInvolvesPlayer && involvesPlayer(accumulator[relationshipId], playerId, accumulator)) {
        pendingDecisions.push({ trigger: event.ifInvolvesPlayer.trigger, firingRelationship: accumulator[relationshipId] });
      }
    }
  }

  return { relationshipsById: accumulator, fired, pendingDecisions };
}

// optionId lets a real player choice override the rng pick (M5); omitting it
// keeps the old auto-resolve behavior (M3's console demo, still used there).
export function resolveDecision(decisionEvent, firingRelationship, { rng, playerId, relationshipsById, optionId }) {
  const option = optionId
    ? decisionEvent.options.find((o) => o.id === optionId)
    : decisionEvent.options[rng.nextInt(0, decisionEvent.options.length)];

  if (!option) throw new Error(`Unknown option: ${optionId}`);

  const nextRelationshipsById = applyEffects(option.effects, {
    relationship: firingRelationship,
    relationshipsById,
    playerId,
  }).relationshipsById;

  return { optionId: option.id, relationshipsById: nextRelationshipsById };
}
