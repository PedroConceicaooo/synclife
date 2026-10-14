// Youth stipend (bolsa de formação, docs/atividades.md 7.5): a club pays a
// monthly stipend to its youth players within the country's age range,
// by category, in the country's money scales (rules 8 and 10). School
// teams and classes pay nothing, and categories missing from the table
// (under-11) neither.

import { ageAt } from '../engine/time.js';
import { resolveAmount } from './money.js';

export function stipendPerMonth(team, country) {
  const amount = team.clubId ? country.youthStipend?.teamLevels[team.teamLevelId] : null;
  return amount ? Math.round(resolveAmount(amount.scale, country) * amount.multiplier) : 0;
}

// What each club owes for months in (fromMonth, toMonth]: one month for
// each month on the team at an eligible age. Returns [{ clubId, amount }].
export function stipendsFor(person, fromMonth, toMonth, country) {
  const stipend = country.youthStipend;
  if (!stipend) return [];
  const owed = [];
  for (const team of person.teams ?? []) {
    const perMonth = stipendPerMonth(team, country);
    if (perMonth === 0) continue;
    let months = 0;
    for (let month = Math.max(fromMonth + 1, team.since); month <= toMonth; month++) {
      const age = ageAt(person.birth, month);
      if (age >= stipend.minAge && age <= stipend.maxAge) months++;
    }
    if (months > 0) owed.push({ clubId: team.clubId, amount: perMonth * months });
  }
  return owed;
}

// Several payments of one advance (before and after a season review) as
// one entry per club, where the first one was.
export function mergeStipendEntries(entries) {
  const merged = [];
  for (const entry of entries) {
    const earlier = entry.source === 'stipend' && merged.find((e) => e.source === 'stipend' && e.clubId === entry.clubId);
    if (earlier) earlier.amount += entry.amount;
    else merged.push(entry.source === 'stipend' ? { ...entry } : entry);
  }
  return merged;
}

// Pays them (clubs are outside the people, so the money just arrives).
// Returns { person, entries } with one money entry per club.
export function payStipends(person, fromMonth, toMonth, country) {
  const owed = stipendsFor(person, fromMonth, toMonth, country);
  if (owed.length === 0) return { person, entries: [] };
  const total = owed.reduce((sum, o) => sum + o.amount, 0);
  return {
    person: { ...person, money: person.money + total },
    entries: owed.map((o) => ({ type: 'money', source: 'stipend', clubId: o.clubId, amount: o.amount })),
  };
}
