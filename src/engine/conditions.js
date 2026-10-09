// Closed vocabulary for event conditions (rule 4 — no code in data). Each
// key is interpreted by the engine; an implicit AND holds over present keys.

import { ageAt } from './time.js';

export function evaluateConditions(conditions = {}, target, context = {}) {
  for (const [key, expected] of Object.entries(conditions)) {
    if (!evaluateCondition(key, expected, target, context)) return false;
  }
  return true;
}

function evaluateCondition(key, expected, target, context) {
  switch (key) {
    case 'type':
      return target.type === expected;
    case 'state':
      return target.state === expected;
    case 'maxAffinity':
      return Math.min(...Object.values(target.affinity)) <= expected;
    case 'minAge':
      return ageAt(target.birth, context.currentMonthIndex) >= expected;
    case 'maxAge':
      return ageAt(target.birth, context.currentMonthIndex) <= expected;
    case 'targetRole':
      return expected.includes(context.relationship.roles[context.targetPersonId]);
    default:
      throw new Error(`Unknown condition: ${key}`);
  }
}
