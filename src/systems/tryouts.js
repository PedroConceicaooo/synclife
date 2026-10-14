// Tryouts (peneiras) for team sports (docs/atividades.md 7.2). Pure: the
// score is worked out on the spot from the person and the seeded rng and
// never leaves this file — the player only reads the coach's comment.
//
//   nota = habilidade × 0,5 + saúde × 0,2 + aptidão física × 100 × 0,2 + sorte (0 a 10)
//
// The team asks for its category's minScore plus its league's offset
// (accessible academies ask less, demanding ones more). The chance to pass
// is an S curve around that requirement: half at it, almost sure well above,
// almost nothing well below.

import { ageAt } from '../engine/time.js';
import { schoolStageAt } from './school.js';

export const TRYOUT_WEIGHTS = { skill: 0.5, health: 0.2, aptitude: 0.2 };
export const TRYOUT_LUCK = 10;
// Points around the requirement for the curve to go from ~25% to ~75%.
export const TRYOUT_SPREAD = 3;

// What each part of the person adds to the score, before luck.
export function tryoutParts(person, activityId) {
  return {
    skill: (person.skills?.[activityId]?.skill ?? 0) * TRYOUT_WEIGHTS.skill,
    health: person.stats.health * TRYOUT_WEIGHTS.health,
    aptitude: (person.aptitudes?.physical ?? 0.5) * 100 * TRYOUT_WEIGHTS.aptitude,
  };
}

export function tryoutScore(person, activityId, rng) {
  const { skill, health, aptitude } = tryoutParts(person, activityId);
  return skill + health + aptitude + rng.next() * TRYOUT_LUCK;
}

export function requiredScore(teamLevel, league) {
  return teamLevel.minScore + (league?.minScoreOffset ?? 0);
}

export function passChance(score, required) {
  return 1 / (1 + Math.exp(-(score - required) / TRYOUT_SPREAD));
}

// The season is the country's school year (youth teams follow it): its
// index for an absolute month, so "once a year" means once a season.
export function seasonOf(monthIndex, schoolYearStartMonth) {
  return Math.floor((monthIndex - (schoolYearStartMonth - 1)) / 12);
}

// Whether a calendar month (1..12) falls in a [from, to] window that may
// wrap around the new year ([11, 2] is Nov to Feb).
export function inMonthWindow([from, to], calendarMonth) {
  return from <= to ? calendarMonth >= from && calendarMonth <= to : calendarMonth >= from || calendarMonth <= to;
}

// The club category for this age among the ones the club runs: where two
// overlap (15 fits under-15 and under-17), the younger one.
export function clubTeamLevel(activity, clubSport, ageYears) {
  return (
    activity.teamLevels.find(
      (level) => level.kind === 'club' && clubSport.teamLevels.includes(level.id) && ageYears >= level.minAge && ageYears <= level.maxAge,
    ) ?? null
  );
}

// The team a tryout is for. target: { kind: 'school' } or { kind: 'club', club }.
export function tryoutTeamLevel(activity, target, person, monthIndex) {
  if (target.kind === 'school') return activity.teamLevels.find((level) => level.kind === 'school') ?? null;
  const clubSport = target.club.sports[activity.id];
  return clubSport ? clubTeamLevel(activity, clubSport, ageAt(person.birth, monthIndex)) : null;
}

export const teamKey = (target) => (target.kind === 'school' ? 'school' : target.club.id);

// Why this person can't try out for this team now, or null.
// attempts: [{ activityId, teamKey, season }] already made.
export function tryoutBlocker(activity, target, { person, monthIndex, country, attempts = [] }) {
  if (target.kind === 'club' && !target.club.sports[activity.id]) return 'noSport';
  if (target.kind === 'school' && !schoolStageAt(person.birth, monthIndex, country.education)) return 'notInSchool';
  if (!tryoutTeamLevel(activity, target, person, monthIndex)) return 'age';
  const season = seasonOf(monthIndex, country.education.schoolYearStartMonth);
  const key = teamKey(target);
  if (attempts.some((a) => a.activityId === activity.id && a.teamKey === key && a.season === season)) return 'alreadyTried';
  return null;
}

// What the coach says: the strongest part as praise and, after a failed
// tryout, the weakest as what to work on. Parts are compared on their own
// 0..1 scale, so a weight doesn't decide it.
export function coachFeedback(person, activityId, passed) {
  const parts = tryoutParts(person, activityId);
  const ranked = Object.entries(parts)
    .map(([part, value]) => [part, value / (100 * TRYOUT_WEIGHTS[part])])
    .sort((a, b) => b[1] - a[1]);
  return { praise: ranked[0][0], critique: passed ? null : ranked.at(-1)[0] };
}

// One tryout. Returns { passed, teamLevelId, feedback } — never the score.
// leaguesById is only needed for club tryouts (the academy's offset).
export function runTryout(activity, target, { person, monthIndex, rng, leaguesById = {} }) {
  const teamLevel = tryoutTeamLevel(activity, target, person, monthIndex);
  const league = target.kind === 'club' ? leaguesById[target.club.sports[activity.id].youthLeague] : null;
  const score = tryoutScore(person, activity.id, rng);
  const passed = rng.chance(passChance(score, requiredScore(teamLevel, league)));
  return { passed, teamLevelId: teamLevel.id, feedback: coachFeedback(person, activity.id, passed) };
}
