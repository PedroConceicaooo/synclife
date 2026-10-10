// Money is always expressed in country-relative scales ("small"/"medium"/
// "large"), resolved through the country's currency — never a fixed number
// (rule 10: no branching on country id).

export function resolveAmount(scale, country) {
  const amount = country.currency.scale[scale];
  if (amount === undefined) throw new Error(`Unknown amount scale: ${scale}`);
  return amount;
}

export function transferMoney(peopleById, fromId, toId, amount) {
  return {
    ...peopleById,
    [fromId]: { ...peopleById[fromId], money: peopleById[fromId].money - amount },
    [toId]: { ...peopleById[toId], money: peopleById[toId].money + amount },
  };
}

export function addMoney(peopleById, personId, amount) {
  return { ...peopleById, [personId]: { ...peopleById[personId], money: peopleById[personId].money + amount } };
}

// Allowance has no JSON shape in the design doc (prose only: paid monthly by
// the parents, scaled by family money, parent personality and affinity) —
// a plain parameterized function, not data-driven, since there is no file to
// keep it consistent with.
const ALLOWANCE_MIN_AGE = 3;

export function isAllowanceAge(age) {
  return age >= ALLOWANCE_MIN_AGE;
}

// The family pays about one "small" per month in total, split between the
// parents (so each parent's base is half of it). The factors move each
// parent's share between roughly 0.25x and 1.5x "small" per month.
const ALLOWANCE_FAMILY_BASE_PER_MONTH = 1; // in "small" units
const ALLOWANCE_PAYERS = 2;
const WEALTH_REFERENCE_IN_LARGE = 60; // parents start with 20..100x "large"

export function payAllowance({ parent, relationship, country, step }) {
  const base = (resolveAmount('small', country) * ALLOWANCE_FAMILY_BASE_PER_MONTH) / ALLOWANCE_PAYERS;
  const affinityFactor = Math.min(1.5, Math.max(0.5, relationship.affinity[parent.id] / 50));
  const traitFactor = parent.traits.includes('generous') ? 1.3 : parent.traits.includes('rigid') ? 0.7 : 1;
  const wealthFactor = Math.min(1.5, Math.max(0.5, parent.money / (resolveAmount('large', country) * WEALTH_REFERENCE_IN_LARGE)));
  // Stress 50 or less changes nothing; a fully stressed parent gives 25% less.
  const stressFactor = 1 - Math.max(0, (parent.stress ?? 0) - 50) / 200;
  return Math.round(base * affinityFactor * traitFactor * wealthFactor * stressFactor) * step;
}
