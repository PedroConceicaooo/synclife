// Closed vocabulary for event/interaction effects (rule 4 — no code in data).

import { clamp, findRelationshipBetween } from '../systems/relationship.js';
import { resolveAmount, transferMoney } from '../systems/money.js';

// targetRole names the role a participant of the firing relationship holds
// in THEIR OWN relationship with the player (e.g. "mother"), not a role
// within the firing relationship itself (which may be "wife"/"husband").
function resolveTargetRelationship(targetRole, context) {
  if (!targetRole) return context.relationship;

  // Player events have no firing relationship: find the player's own
  // relationship whose other side holds targetRole.
  if (!context.relationship) {
    return (
      Object.values(context.relationshipsById).find(
        (r) =>
          context.playerId in r.roles &&
          Object.entries(r.roles).some(([personId, role]) => personId !== context.playerId && role === targetRole),
      ) ?? null
    );
  }

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
  if (!target) return { relationshipsById: context.relationshipsById, peopleById: context.peopleById };

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

  return {
    relationshipsById: { ...context.relationshipsById, [target.id]: { ...target, affinity } },
    peopleById: context.peopleById,
  };
}

function otherParticipant(relationship, playerId) {
  return Object.keys(relationship.roles).find((personId) => personId !== playerId);
}

function applyTransferMoneyEffect(effect, context) {
  const resolveSide = (side) => (side === 'player' ? context.playerId : otherParticipant(context.relationship, context.playerId));
  const fromId = resolveSide(effect.from);
  const toId = resolveSide(effect.to);
  const amount = resolveAmount(effect.amount, context.country);

  return {
    relationshipsById: context.relationshipsById,
    peopleById: transferMoney(context.peopleById, fromId, toId, amount),
  };
}

const STATS = ['happiness', 'health', 'intelligence', 'looks'];

// target "player" works without a firing relationship (player events);
// "target" means the other participant of the firing relationship.
function applyStatEffect(effect, context) {
  if (!STATS.includes(effect.stat)) throw new Error(`Unknown stat: ${effect.stat}`);
  const personId = effect.target === 'player' ? context.playerId : otherParticipant(context.relationship, context.playerId);
  const person = context.peopleById[personId];
  const stats = { ...person.stats, [effect.stat]: clamp(person.stats[effect.stat] + effect.delta, 0, 100) };

  return {
    relationshipsById: context.relationshipsById,
    peopleById: { ...context.peopleById, [personId]: { ...person, stats } },
  };
}

function applyEffect(effect, context) {
  switch (effect.op) {
    case 'relationshipState':
      return {
        relationshipsById: {
          ...context.relationshipsById,
          [context.relationship.id]: { ...context.relationship, state: effect.value },
        },
        peopleById: context.peopleById,
      };
    case 'affinity':
      return applyAffinityEffect(effect, context);
    case 'transferMoney':
      return applyTransferMoneyEffect(effect, context);
    case 'stat':
      return applyStatEffect(effect, context);
    default:
      throw new Error(`Unknown effect op: ${effect.op}`);
  }
}

export function applyEffects(effects, context) {
  let relationshipsById = context.relationshipsById;
  let peopleById = context.peopleById;

  for (const effect of effects) {
    const relationship = context.relationship ? relationshipsById[context.relationship.id] : null;
    const result = applyEffect(effect, { ...context, relationship, relationshipsById, peopleById });
    relationshipsById = result.relationshipsById;
    peopleById = result.peopleById;
  }

  return { relationshipsById, peopleById };
}
