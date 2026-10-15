// Money is always expressed in country-relative scales ("small"/"medium"/
// "large"), resolved through the country's currency — never a fixed number
// (rule 10: no branching on country id).

import { ageAt } from '../engine/time.js';

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

// Allowance (design doc, "Mesada"): it only starts after the parents offer
// it (the allowance_offer event sets person.allowance = { since, factor }).
// The family amount grows with the child's age, in bands from the default
// country (familyAllowance), and is split between the parents; affinity,
// trait, wealth and stress move each parent's share.

const ALLOWANCE_PAYERS = 2;
export const WEALTH_REFERENCE_IN_LARGE = 60; // parents start with 20..100x "large"

export function receivesAllowance(person) {
  return person.allowance?.since !== undefined;
}

// A cut as a punishment (allowance.cut = { from, until }) holds back the
// months after `from` up to `until`.
export function isAllowanceCut(person, month) {
  const cut = person.allowance?.cut;
  return Boolean(cut) && month > cut.from && month <= cut.until;
}

// Asking for a raise annoys when done again and again: the asks of the
// last year count (person.allowance.raiseAsks = [month, ...]).
export const RAISE_ASKS_MEMORY_MONTHS = 12;

export function recentRaiseAsks(person, monthIndex) {
  return (person.allowance?.raiseAsks ?? []).filter((month) => monthIndex - month < RAISE_ASKS_MEMORY_MONTHS);
}

// The family's monthly amount at an age. Younger than the first band only
// happens in old saves (allowance from 3 on), which keep the first band.
export function familyAllowanceAt(age, country) {
  const bands = country.familyAllowance.ageBands;
  const band = bands.filter((b) => age >= b.minAge).at(-1) ?? bands[0];
  return resolveAmount(band.scale, country) * band.multiplier;
}

// What one parent pays the child for months in (fromMonth, toMonth], only
// the months after the allowance started and outside a cut.
export function payAllowance({ parent, relationship, child, country, fromMonth, toMonth }) {
  if (!receivesAllowance(child)) return 0;
  const affinityFactor = Math.min(1.5, Math.max(0.5, relationship.affinity[parent.id] / 50));
  const traitFactor = parent.traits.includes('generous') ? 1.3 : parent.traits.includes('rigid') ? 0.7 : 1;
  const wealthFactor = Math.min(1.5, Math.max(0.5, parent.money / (resolveAmount('large', country) * WEALTH_REFERENCE_IN_LARGE)));
  // Stress 50 or less changes nothing; a fully stressed parent gives 25% less.
  const stressFactor = 1 - Math.max(0, (parent.stress ?? 0) - 50) / 200;
  const factor = affinityFactor * traitFactor * wealthFactor * stressFactor * (child.allowance.factor ?? 1);
  let total = 0;
  for (let month = Math.max(fromMonth, child.allowance.since) + 1; month <= toMonth; month++) {
    if (isAllowanceCut(child, month)) continue;
    total += Math.round((familyAllowanceAt(ageAt(child.birth, month), country) / ALLOWANCE_PAYERS) * factor);
  }
  return total;
}
