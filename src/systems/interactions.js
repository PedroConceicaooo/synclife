// No fs here — this file must stay loadable from a browser; see
// interactionsLoader.js for the Node-only reader.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { resolveAmount, WEALTH_REFERENCE_IN_LARGE } from './money.js';

// A price this share of someone's money counts as a big ask (priceVsWealth).
export const PRICE_SHARE_REFERENCE = 0.02;

export function indexInteractions(interactions) {
  return Object.fromEntries(interactions.map((interaction) => [interaction.id, interaction]));
}

// Average of how much the people holding `role` toward the player like the
// player (e.g. their teachers), or null when nobody holds it.
function roleAffinity(role, relationshipsById, playerId) {
  const values = Object.values(relationshipsById)
    .filter((r) => playerId in r.roles)
    .map((r) => [Object.keys(r.roles).find((id) => id !== playerId), r])
    .filter(([otherId, r]) => r.roles[otherId] === role)
    .map(([otherId, r]) => r.affinity[otherId]);
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

// player is only needed for playerStat modifiers, relationshipsById and
// playerId for roleAffinity (event checks).
// The player's parents (for factors about them).
function parentsOf(playerId, relationshipsById, peopleById) {
  return Object.values(relationshipsById)
    .filter((r) => playerId in r.roles && ['son', 'daughter'].includes(r.roles[playerId]))
    .map((r) => peopleById[Object.keys(r.roles).find((id) => id !== playerId)])
    .filter(Boolean);
}

export function resolveChance(
  chance,
  { relationship, targetPersonId, target, player, relationshipsById, peopleById, playerId, country, parentPays = false, price = 0, recentRequests = 0 },
) {
  let p = chance.base;

  for (const modifier of chance.modifiers) {
    switch (modifier.factor) {
      case 'affinity':
        p += ((relationship.affinity[targetPersonId] - 50) / 100) * modifier.weight;
        break;
      case 'targetTrait':
        if (target.traits.includes(modifier.value)) p += modifier.adjust;
        break;
      case 'playerStat':
        p += ((player.stats[modifier.stat] - 50) / 100) * modifier.weight;
        break;
      // Any of the player's parents has the trait (e.g. rigid parents).
      case 'parentsTrait':
        if (parentsOf(playerId, relationshipsById, peopleById).some((p) => p.traits.includes(modifier.value))) p += modifier.adjust;
        break;
      // Same-sex pairs: the country's social acceptance of the topic moves
      // the chance (design doc: "aceitação social"). Unknown -> neutral 50.
      case 'sameSexAcceptance':
        if (player.sex === target.sex) {
          const acceptance = country.topics?.[modifier.topic]?.acceptance ?? 50;
          p += ((acceptance - 50) / 100) * modifier.weight;
        }
        break;
      case 'targetEmotion':
        if (target.emotion?.type === modifier.value) p += modifier.adjust;
        break;
      case 'playerEmotion':
        if (player.emotion?.type === modifier.value) p += modifier.adjust;
        break;
      // A stressed parent says no more often (design doc).
      case 'targetStress':
        p += (((target.stress ?? 50) - 50) / 100) * modifier.weight;
        break;
      case 'playerTrait':
        if (player.traits.includes(modifier.value)) p += modifier.adjust;
        break;
      case 'roleAffinity': {
        const value = roleAffinity(modifier.role, relationshipsById, playerId);
        if (value !== null) p += ((value - 50) / 100) * modifier.weight;
        break;
      }
      // Richer than average (the allowance's reference) says yes more
      // often, poorer less: -1..+1 × weight.
      case 'targetWealth': {
        const wealth = target.money / (resolveAmount('large', country) * WEALTH_REFERENCE_IN_LARGE);
        p += (Math.min(2, wealth) - 1) * modifier.weight;
        break;
      }
      // Requests where the parents would pay (enrollment.js).
      case 'parentPays':
        if (parentPays) p += modifier.adjust;
        break;
      // The price against the target's money: something costing
      // PRICE_SHARE_REFERENCE of it takes a whole weight off, at most 1.5.
      case 'priceVsWealth': {
        const share = price / Math.max(1, target.money * PRICE_SHARE_REFERENCE);
        p -= Math.min(1.5, share) * modifier.weight;
        break;
      }
      // Asking again and again annoys (parentPayment.js): adjust per ask lately.
      case 'recentRequests':
        p += recentRequests * modifier.adjust;
        break;
      default:
        throw new Error(`Unknown chance factor: ${modifier.factor}`);
    }
  }

  return Math.min(1, Math.max(0, p));
}

export const DEFAULT_INTERACTIONS_PER_PERIOD_LIMIT = 3;

export function attemptInteraction(
  interaction,
  { relationship, player, target, peopleById, relationshipsById, country, currentMonthIndex, rng },
) {
  if (relationship.interactionsThisPeriod >= DEFAULT_INTERACTIONS_PER_PERIOD_LIMIT) {
    return { attempted: false, reason: 'limit', relationshipsById, peopleById };
  }

  const conditionsMet = evaluateConditions(interaction.conditions, player, {
    currentMonthIndex,
    relationship,
    targetPersonId: target.id,
    target,
    country,
    relationshipsById,
    playerId: player.id,
  });
  if (!conditionsMet) {
    return { attempted: false, reason: 'conditions', relationshipsById, peopleById };
  }

  const chance = resolveChance(interaction.chance, {
    relationship,
    targetPersonId: target.id,
    target,
    player,
    relationshipsById,
    peopleById,
    playerId: player.id,
    country,
  });
  const succeeded = rng.chance(chance);

  const touched = {
    ...relationship,
    interactionsThisPeriod: relationship.interactionsThisPeriod + 1,
    lastInteraction: currentMonthIndex,
  };
  const relationshipsWithCounter = { ...relationshipsById, [relationship.id]: touched };

  const { relationshipsById: nextRelationshipsById, peopleById: nextPeopleById } = applyEffects(
    succeeded ? interaction.success : interaction.failure,
    {
      relationship: touched,
      relationshipsById: relationshipsWithCounter,
      peopleById,
      playerId: player.id,
      country,
      rng,
      currentMonthIndex,
      diminishingAffinityGains: true,
    },
  );

  // Consequences that may come later (design doc: annoying a teacher can
  // bring a warning). on: "success", "failure" or "any" (the default).
  const outcome = succeeded ? 'success' : 'failure';
  const triggeredEvents = (interaction.randomEvents ?? [])
    .filter((r) => (r.on ?? 'any') === 'any' || r.on === outcome)
    .filter((r) => rng.chance(r.chance))
    .map((r) => r.event);

  return { attempted: true, succeeded, relationshipsById: nextRelationshipsById, peopleById: nextPeopleById, triggeredEvents };
}

// Display order of the profile's categories (design doc: up to six).
export const INTERACTION_CATEGORIES = ['talk', 'spend_time', 'ask', 'give', 'conflict', 'relationship'];

// Interactions whose conditions pass for this target, grouped by category in
// display order. Categories with no available option are left out, so the UI
// only shows what the player can actually do.
export function listAvailableInteractions(interactionsById, { relationship, player, target, country, currentMonthIndex, relationshipsById = {} }) {
  const context = { currentMonthIndex, relationship, targetPersonId: target.id, target, country, relationshipsById, playerId: player.id };
  const available = Object.values(interactionsById)
    .filter((interaction) => evaluateConditions(interaction.conditions, player, context))
    // Simplest first: by minimum age, then id for a stable order.
    .sort((a, b) => a.conditions.minAge - b.conditions.minAge || a.id.localeCompare(b.id));

  return INTERACTION_CATEGORIES.map((category) => ({
    category,
    interactionIds: available.filter((i) => i.category === category).map((i) => i.id),
  })).filter((group) => group.interactionIds.length > 0);
}
