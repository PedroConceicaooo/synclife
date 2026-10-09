import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { yearlyChanceToPeriod } from '../engine/random.js';
import { findRelationshipBetween } from './relationship.js';

export function loadEvents(dir) {
  const eventsById = {};

  for (const fileName of readdirSync(dir).sort()) {
    if (!fileName.endsWith('.json')) continue;
    const event = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
    eventsById[event.id] = event;
  }

  return eventsById;
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

export function resolveDecision(decisionEvent, firingRelationship, { rng, playerId, relationshipsById }) {
  const optionIndex = rng.nextInt(0, decisionEvent.options.length);
  const option = decisionEvent.options[optionIndex];

  const nextRelationshipsById = applyEffects(option.effects, {
    relationship: firingRelationship,
    relationshipsById,
    playerId,
  }).relationshipsById;

  return { optionId: option.id, relationshipsById: nextRelationshipsById };
}
