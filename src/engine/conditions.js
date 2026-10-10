// Closed vocabulary for event conditions (rule 4 — no code in data). Each
// key is interpreted by the engine; an implicit AND holds over present keys.

import { ageAt } from './time.js';
import { resolveAmount } from '../systems/money.js';
import { childrenOf } from '../systems/birth.js';
import { schoolStageAt } from '../systems/school.js';

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
    // Relationship conditions that look at the people in it.
    // maxChildren: the couple can still have a child without going over it.
    case 'maxChildren': {
      const parentIds = Object.keys(target.roles);
      const children = new Set(parentIds.flatMap((id) => childrenOf(id, context.relationshipsById)));
      return children.size < expected;
    }
    // roleMaxAge: { wife: 42 } — whoever holds that role is at most that age.
    case 'roleMaxAge':
      return Object.entries(expected).every(([role, maxAge]) =>
        Object.entries(target.roles)
          .filter(([, r]) => r === role)
          .every(([personId]) => ageAt(context.peopleById[personId].birth, context.currentMonthIndex) <= maxAge),
      );
    // Interactions: the other person's age (a newborn sibling can't chat).
    case 'targetMinAge':
      return ageAt(context.target.birth, context.currentMonthIndex) >= expected;
    // School by the country calendar (needs context.country).
    case 'inSchool':
      return (schoolStageAt(target.birth, context.currentMonthIndex, context.country.education) !== null) === expected;
    // minLegalAge: "driving" -> at least the country's legal age for it.
    case 'minLegalAge':
      return ageAt(target.birth, context.currentMonthIndex) >= context.country.ages[expected];
    case 'belowLegalAge':
      return ageAt(target.birth, context.currentMonthIndex) < context.country.ages[expected];
    // State of the relationship an interaction is about (e.g. "dating").
    case 'relationshipState':
      return [].concat(expected).includes(context.relationship?.state ?? null);
    // The player has (or lacks) someone in that role: a pet, a sibling.
    case 'hasRole':
      return holdsRole(expected, target, context);
    case 'lacksRole':
      return !holdsRole(expected, target, context);
    case 'targetSpecies':
      return context.target?.species === expected;
    case 'minMoney':
      return target.money >= resolveAmount(expected, context.country);
    case 'targetRole':
      return expected.includes(context.relationship.roles[context.targetPersonId]);
    default:
      throw new Error(`Unknown condition: ${key}`);
  }
}

function holdsRole(roles, player, context) {
  const wanted = [].concat(roles);
  return Object.values(context.relationshipsById ?? {}).some(
    (r) => player.id in r.roles && Object.entries(r.roles).some(([id, role]) => id !== player.id && wanted.includes(role)),
  );
}
