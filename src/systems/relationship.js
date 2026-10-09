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

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function findRelationshipBetween(idA, idB, relationshipsById) {
  return (
    Object.values(relationshipsById).find((relationship) => idA in relationship.roles && idB in relationship.roles) ??
    null
  );
}

// Passive decay stops at a floor that depends on the person's role: parents
// do not stop loving a child just because time passes, a child keeps a
// baseline bond with them, and spouses drift apart only so far — below that,
// it takes fights (parents_fight) to reach divorce. Events and interactions can still push affinity
// below the floor; decay just never does, and never raises it back either.
export const DECAY_FLOOR_BY_ROLE = { mother: 60, father: 60, son: 40, daughter: 40, wife: 35, husband: 35 };

// Linear decay proportional to elapsed months (not the yearly-chance formula
// from random.js — that's for probabilistic events, this is a continuous stat).
export function decayAffinity(relationship, months, ratePerMonth = DEFAULT_AFFINITY_DECAY_RATE_PER_MONTH) {
  const delta = ratePerMonth * months;
  const affinity = {};
  for (const [personId, value] of Object.entries(relationship.affinity)) {
    const floor = DECAY_FLOOR_BY_ROLE[relationship.roles[personId]] ?? 0;
    affinity[personId] = value <= floor ? value : clamp(Math.max(floor, value - delta), 0, 100);
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

export function resetInteractionsThisPeriod(relationshipsById) {
  const next = {};
  for (const [id, relationship] of Object.entries(relationshipsById)) {
    next[id] = { ...relationship, interactionsThisPeriod: 0 };
  }
  return next;
}
