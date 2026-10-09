// Closed vocabulary for event/decision effects (rule 4 — no code in data).

import { clamp, findRelationshipBetween } from './relationship.js';

// targetRole names the role a participant of the firing relationship holds
// in THEIR OWN relationship with the player (e.g. "mother"), not a role
// within the firing relationship itself (which may be "wife"/"husband").
function resolveTargetRelationship(targetRole, context) {
  if (!targetRole) return context.relationship;

  for (const personId of Object.keys(context.relationship.roles)) {
    const relationshipWithPlayer = findRelationshipBetween(personId, context.playerId, context.relationshipsById);
    if (relationshipWithPlayer && relationshipWithPlayer.roles[personId] === targetRole) {
      return relationshipWithPlayer;
    }
  }

  return null;
}

function applyAffinityEffect(effect, context) {
  const target = resolveTargetRelationship(effect.targetRole, context);
  if (!target) return context.relationshipsById;

  const affinity = { ...target.affinity };
  for (const personId of Object.keys(affinity)) {
    const appliesToThisSide =
      effect.side === 'both' ||
      (effect.side === 'player' && personId === context.playerId) ||
      (effect.side === 'target' && personId !== context.playerId);
    if (appliesToThisSide) {
      affinity[personId] = clamp(affinity[personId] + effect.delta, 0, 100);
    }
  }

  return { ...context.relationshipsById, [target.id]: { ...target, affinity } };
}

function applyEffect(effect, context) {
  switch (effect.op) {
    case 'relationshipState':
      return {
        ...context.relationshipsById,
        [context.relationship.id]: { ...context.relationship, state: effect.value },
      };
    case 'affinity':
      return applyAffinityEffect(effect, context);
    default:
      throw new Error(`Unknown effect op: ${effect.op}`);
  }
}

export function applyEffects(effects, context) {
  let relationshipsById = context.relationshipsById;

  for (const effect of effects) {
    const relationship = context.relationship ? relationshipsById[context.relationship.id] : null;
    relationshipsById = applyEffect(effect, { ...context, relationship, relationshipsById });
  }

  return relationshipsById;
}
