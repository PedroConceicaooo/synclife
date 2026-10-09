import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';

export function loadInteractions(dir) {
  const interactionsById = {};

  for (const fileName of readdirSync(dir).sort()) {
    if (!fileName.endsWith('.json')) continue;
    const interaction = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
    interactionsById[interaction.id] = interaction;
  }

  return interactionsById;
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
