// No fs here — this file must stay loadable from a browser; see
// interactionsLoader.js for the Node-only reader.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';

export function indexInteractions(interactions) {
  return Object.fromEntries(interactions.map((interaction) => [interaction.id, interaction]));
}

export function resolveChance(chance, { relationship, targetPersonId, target }) {
  let p = chance.base;

  for (const modifier of chance.modifiers) {
    switch (modifier.factor) {
      case 'affinity':
        p += ((relationship.affinity[targetPersonId] - 50) / 100) * modifier.weight;
        break;
      case 'targetTrait':
        if (target.traits.includes(modifier.value)) p += modifier.adjust;
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
    country,
  });
  if (!conditionsMet) {
    return { attempted: false, reason: 'conditions', relationshipsById, peopleById };
  }

  const chance = resolveChance(interaction.chance, { relationship, targetPersonId: target.id, target });
  const succeeded = rng.chance(chance);

  const touched = {
    ...relationship,
    interactionsThisPeriod: relationship.interactionsThisPeriod + 1,
    lastInteraction: currentMonthIndex,
  };
  const relationshipsWithCounter = { ...relationshipsById, [relationship.id]: touched };

  const { relationshipsById: nextRelationshipsById, peopleById: nextPeopleById } = applyEffects(
    succeeded ? interaction.success : interaction.failure,
    { relationship: touched, relationshipsById: relationshipsWithCounter, peopleById, playerId: player.id, country },
  );

  return { attempted: true, succeeded, relationshipsById: nextRelationshipsById, peopleById: nextPeopleById };
}

// Display order of the profile's categories (design doc: up to six).
export const INTERACTION_CATEGORIES = ['talk', 'spend_time', 'ask', 'give', 'conflict', 'relationship'];

// Interactions whose conditions pass for this target, grouped by category in
// display order. Categories with no available option are left out, so the UI
// only shows what the player can actually do.
export function listAvailableInteractions(interactionsById, { relationship, player, target, country, currentMonthIndex }) {
  const context = { currentMonthIndex, relationship, targetPersonId: target.id, country };
  const available = Object.values(interactionsById)
    .filter((interaction) => evaluateConditions(interaction.conditions, player, context))
    .sort((a, b) => a.id.localeCompare(b.id));

  return INTERACTION_CATEGORIES.map((category) => ({
    category,
    interactionIds: available.filter((i) => i.category === category).map((i) => i.id),
  })).filter((group) => group.interactionIds.length > 0);
}
