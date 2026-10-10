// Closed vocabulary for event/interaction effects (rule 4 — no code in data).

import { clamp, findRelationshipBetween } from '../systems/relationship.js';
import { resolveAmount, transferMoney, addMoney } from '../systems/money.js';
import { addChild } from '../systems/birth.js';

// targetRole (a role or a list of roles) names the role a person holds in
// THEIR OWN relationship with the player (e.g. "mother"), not a role within
// the firing relationship itself (which may be "wife"/"husband"). People in
// the firing relationship are tried first; otherwise the player's own
// relationships are searched, newest first (e.g. the sibling just born).
function resolveTargetRelationship(targetRole, context) {
  if (!targetRole) return context.relationship;
  const roles = [].concat(targetRole);
  const otherRoleMatches = (r, personId) => roles.includes(r.roles[personId]);

  if (context.relationship) {
    for (const personId of Object.keys(context.relationship.roles)) {
      const relationshipWithPlayer = findRelationshipBetween(personId, context.playerId, context.relationshipsById);
      if (relationshipWithPlayer && otherRoleMatches(relationshipWithPlayer, personId)) return relationshipWithPlayer;
    }
  }

  const candidates = Object.values(context.relationshipsById)
    .filter((r) => context.playerId in r.roles && Object.keys(r.roles).some((id) => id !== context.playerId && otherRoleMatches(r, id)))
    .sort((a, b) => b.since - a.since || b.id.localeCompare(a.id));
  return candidates[0] ?? null;
}

// Repeatable actions (interactions) get closer less and less as affinity
// rises: full gain up to this value, then linearly down to 0 at 100. Losses
// are never reduced.
const DIMINISHING_GAINS_FROM = 50;

export function diminishedGain(current, delta) {
  if (delta <= 0) return delta;
  return delta * Math.min(1, (100 - current) / (100 - DIMINISHING_GAINS_FROM));
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
      const delta = context.diminishingAffinityGains ? diminishedGain(affinity[personId], effect.delta) : effect.delta;
      affinity[personId] = clamp(affinity[personId] + delta, 0, 100);
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

// Money from or to no one in particular (a tip, a confiscation, a pricier
// babysitter): { op: "money", target: "player", gain: "small" } or
// { op: "money", targetRole: "mother", lose: "medium" }.
function moneyEffectPersonId(effect, context) {
  if (effect.targetRole) {
    const relationship = resolveTargetRelationship(effect.targetRole, context);
    return relationship ? otherParticipant(relationship, context.playerId) : null;
  }
  return effect.target === 'player' ? context.playerId : otherParticipant(context.relationship, context.playerId);
}

function applyMoneyEffect(effect, context) {
  const personId = moneyEffectPersonId(effect, context);
  if (!personId) return { relationshipsById: context.relationshipsById, peopleById: context.peopleById };
  const amount = effect.gain ? resolveAmount(effect.gain, context.country) : -resolveAmount(effect.lose, context.country);
  return { relationshipsById: context.relationshipsById, peopleById: addMoney(context.peopleById, personId, amount) };
}

// The firing relationship (a couple) has a baby. Needs rng and the month.
function applyHaveChildEffect(effect, context) {
  const result = addChild(context.rng, {
    parentIds: Object.keys(context.relationship.roles),
    peopleById: context.peopleById,
    relationshipsById: context.relationshipsById,
    monthIndex: context.currentMonthIndex,
    country: context.country,
  });
  return { relationshipsById: result.relationshipsById, peopleById: result.peopleById };
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
    case 'money':
      return applyMoneyEffect(effect, context);
    case 'haveChild':
      return applyHaveChildEffect(effect, context);
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
