// Scout invitations (docs/atividades.md 7.3): "um olheiro viu você jogar".
// Events with { "scout": { "activity": ... } } are rolled here instead of
// by a fixed yearlyChance: the chance rises with skill and with playing for
// the school team, and is scaled to the months advanced (rule 7). The
// invitation names a club with a category for the player's age, from the
// player's city when there is one.

import { yearlyChanceToPeriod } from '../engine/random.js';
import { ageAt } from '../engine/time.js';
import { evaluateConditions } from '../engine/conditions.js';
import { clubTeamLevel } from './tryouts.js';
import { isOnTeam } from './teams.js';

export const SCOUT_BASE_CHANCE = 0.02; // a year
export const SCOUT_SKILL_FROM = 40;
export const SCOUT_PER_SKILL_POINT = 0.006;
export const SCOUT_SCHOOL_TEAM_BONUS = 0.05;
export const SCOUT_MAX_CHANCE = 0.4;

export function scoutYearlyChance(person, activityId) {
  const skill = person.skills?.[activityId]?.skill ?? 0;
  const fromSkill = Math.max(0, skill - SCOUT_SKILL_FROM) * SCOUT_PER_SKILL_POINT;
  const fromSchool = isOnTeam(person, activityId, 'school') ? SCOUT_SCHOOL_TEAM_BONUS : 0;
  return Math.min(SCOUT_MAX_CHANCE, SCOUT_BASE_CHANCE + fromSkill + fromSchool);
}

// Clubs with a category for this age: the player's city first, else the
// rest of the country. Null when no club takes the player.
export function scoutClubs(person, activity, clubsById, monthIndex) {
  const age = ageAt(person.birth, monthIndex);
  const fits = Object.values(clubsById).filter(
    (club) => club.countryId === person.countryId && club.sports[activity.id] && clubTeamLevel(activity, club.sports[activity.id], age),
  );
  const local = fits.filter((club) => club.cityId === person.cityId);
  return local.length > 0 ? local : fits;
}

// The invitations of one advance, as pending decisions carrying the club.
export function rollScoutInvites(eventsById, { person, activitiesById, clubsById, country, relationshipsById, monthIndex, months, rng }) {
  const decisions = [];
  for (const event of Object.values(eventsById).filter((e) => e.scout).sort((a, b) => a.id.localeCompare(b.id))) {
    const activity = activitiesById[event.scout.activity];
    if (!evaluateConditions(event.conditions, person, { currentMonthIndex: monthIndex, country, relationshipsById })) continue;
    const clubs = scoutClubs(person, activity, clubsById, monthIndex);
    if (clubs.length === 0) continue;
    if (!rng.chance(yearlyChanceToPeriod(scoutYearlyChance(person, activity.id), months))) continue;
    decisions.push({ trigger: event.id, firingRelationship: null, clubId: clubs[rng.nextInt(0, clubs.length)].id });
  }
  return decisions;
}
