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

export function payAllowance({ parent, relationship, country, step }) {
  const base = resolveAmount('small', country);
  const affinityFactor = Math.min(2, Math.max(0.2, relationship.affinity[parent.id] / 50));
  const traitFactor = parent.traits.includes('generous') ? 1.3 : parent.traits.includes('rigid') ? 0.7 : 1;
  const wealthFactor = Math.min(2, Math.max(0.5, parent.money / (resolveAmount('medium', country) * 20)));
  return Math.round(base * affinityFactor * traitFactor * wealthFactor) * step;
}
