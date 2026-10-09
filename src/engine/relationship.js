// Relationship between two people. Affinity is per-side: affinity[personId]
// is how much that person likes the other side (rule 9).

export function createRelationship({ id, roles, type, affinity, since, state = null }) {
  return {
    id,
    roles,
    type,
    affinity: { ...affinity },
    state,
    since,
    lastInteraction: null,
    interactionsThisPeriod: 0,
  };
}

export const DEFAULT_AFFINITY_DECAY_RATE_PER_MONTH = 0.2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Linear decay proportional to elapsed months (not the yearly-chance formula
// from random.js — that's for probabilistic events, this is a continuous stat).
export function decayAffinity(relationship, months, ratePerMonth = DEFAULT_AFFINITY_DECAY_RATE_PER_MONTH) {
  const delta = ratePerMonth * months;
  const affinity = {};
  for (const [personId, value] of Object.entries(relationship.affinity)) {
    affinity[personId] = clamp(value - delta, 0, 100);
  }
  return { ...relationship, affinity };
}

export function decayAll(relationshipsById, months, ratePerMonth = DEFAULT_AFFINITY_DECAY_RATE_PER_MONTH) {
  const next = {};
  for (const [id, relationship] of Object.entries(relationshipsById)) {
    next[id] = decayAffinity(relationship, months, ratePerMonth);
  }
  return next;
}
