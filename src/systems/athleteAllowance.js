// Athlete allowance (auxílio atleta): a game rule, the same in every
// country — a club pays its youth players a monthly allowance within the
// country's age range (14 to 19 by default), by category, in the
// country's money scales (rules 8 and 10). School teams and classes pay
// nothing, and categories missing from the table (under-11) neither.

import { ageAt } from '../engine/time.js';
import { resolveAmount } from './money.js';

export function allowancePerMonth(team, country) {
  const amount = team.clubId ? country.athleteAllowance?.teamLevels[team.teamLevelId] : null;
  return amount ? Math.round(resolveAmount(amount.scale, country) * amount.multiplier) : 0;
}

// What each club owes for months in (fromMonth, toMonth]: one month for
// each month on the team at an eligible age. Returns [{ clubId, amount }].
export function allowancesFor(person, fromMonth, toMonth, country) {
  const allowance = country.athleteAllowance;
  if (!allowance) return [];
  const owed = [];
  for (const team of person.teams ?? []) {
    const perMonth = allowancePerMonth(team, country);
    if (perMonth === 0) continue;
    let months = 0;
    for (let month = Math.max(fromMonth + 1, team.since); month <= toMonth; month++) {
      const age = ageAt(person.birth, month);
      if (age >= allowance.minAge && age <= allowance.maxAge) months++;
    }
    if (months > 0) owed.push({ clubId: team.clubId, amount: perMonth * months });
  }
  return owed;
}

// Pays them (clubs are outside the people, so the money just arrives).
// Returns { person, entries } with one money entry per club.
export function payAllowances(person, fromMonth, toMonth, country) {
  const owed = allowancesFor(person, fromMonth, toMonth, country);
  if (owed.length === 0) return { person, entries: [] };
  const total = owed.reduce((sum, o) => sum + o.amount, 0);
  return {
    person: { ...person, money: person.money + total },
    entries: owed.map((o) => ({ type: 'money', source: 'athleteAllowance', clubId: o.clubId, amount: o.amount })),
  };
}
