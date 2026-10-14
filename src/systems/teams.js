// Team membership for team sports (docs/atividades.md 7.3 and 7.4). A team
// is part of the person, kept in the save:
//   person.teams   = [{ activityId, teamKey, clubId?, teamLevelId, since }]
//   person.tryouts = [{ activityId, teamKey, season }]   (one try per season)
//   person.tryoutSignups = [{ activityId, clubId, month }] (club tryouts ahead)
// teamKey is 'school' or the club id. One can be on several teams of the
// same sport at once (the school team and a club academy).
//
// At the end of each school year every team is looked at again: a club
// player whose age calls for the next category is promoted if the score
// still meets it, someone who stays in the same category is kept with a
// little slack (KEEP_MARGIN), and anyone else is released. Leaving school
// ends the school team.

import { ageAt } from '../engine/time.js';
import { schoolStageAt } from './school.js';
import {
  tryoutBlocker,
  tryoutTeamLevel,
  inMonthWindow,
  runTryout,
  teamKey,
  seasonOf,
  clubTeamLevel,
  requiredScore,
  tryoutScore,
  passChance,
} from './tryouts.js';

// Staying on a team is a bit easier than getting in.
export const KEEP_MARGIN = 5;

export function isOnTeam(person, activityId, key) {
  return (person.teams ?? []).some((team) => team.activityId === activityId && team.teamKey === key);
}

export function isOnClubTeam(person, activityId) {
  return (person.teams ?? []).some((team) => team.activityId === activityId && team.clubId);
}

// On any team of this sport: its training comes with the team, free
// (docs/atividades.md 7.5: the club charges no fee for team training).
export function isOnAnyTeam(person, activityId) {
  return (person.teams ?? []).some((team) => team.activityId === activityId);
}

// Why this person can't try out now, or null (tryoutBlocker, plus being on
// that team already, or on another club's team of the same sport: one club
// at a time, besides the school team).
export function teamTryoutBlocker(activity, target, { person, monthIndex, country }) {
  if (isOnTeam(person, activity.id, teamKey(target))) return 'onTeam';
  if (target.kind === 'club' && isOnClubTeam(person, activity.id)) return 'otherClub';
  return tryoutBlocker(activity, target, { person, monthIndex, country, attempts: person.tryouts ?? [] });
}

// One tryout: records the attempt and, if it went well, the new team.
// Returns { person, blocker, entry } — entry is the diary line's data.
export function tryOut(person, activity, target, { monthIndex, country, rng, leaguesById = {} }) {
  const blocker = teamTryoutBlocker(activity, target, { person, monthIndex, country });
  if (blocker) return { person, blocker, entry: null };

  const result = runTryout(activity, target, { person, monthIndex, rng, leaguesById });
  const key = teamKey(target);
  const clubId = target.kind === 'club' ? target.club.id : undefined;
  const attempt = { activityId: activity.id, teamKey: key, season: seasonOf(monthIndex, country.education.schoolYearStartMonth) };
  const team = { activityId: activity.id, teamKey: key, ...(clubId ? { clubId } : {}), teamLevelId: result.teamLevelId, since: monthIndex };
  const updated = {
    ...person,
    tryouts: [...(person.tryouts ?? []), attempt],
    teams: result.passed ? [...(person.teams ?? []), team] : person.teams ?? [],
  };
  const entry = {
    type: 'tryout',
    activityId: activity.id,
    ...(clubId ? { clubId } : {}),
    teamLevelId: result.teamLevelId,
    passed: result.passed,
    praise: result.feedback.praise,
    critique: result.feedback.critique,
  };
  return { person: updated, blocker: null, entry };
}

// The first month of the next school year after monthIndex (where the
// country's year ends a month or two before the next one starts, the gap
// still belongs to the old year).
export function nextSeasonStart(monthIndex, schoolYearStartMonth) {
  const offset = (((schoolYearStartMonth - 1 - (monthIndex % 12)) % 12) + 12) % 12;
  return monthIndex + (offset === 0 ? 12 : offset);
}

// Club tryouts happen in the club's window (tryoutMonths); the player signs
// up before, and the tryout runs when time reaches it. The first month at
// or after fromMonth inside the window.
export function nextTryoutMonth(window, fromMonth) {
  for (let month = fromMonth; month < fromMonth + 12; month++) {
    if (inMonthWindow(window, (month % 12) + 1)) return month;
  }
  return null;
}

export function isSignedUp(person, activityId, clubId) {
  return (person.tryoutSignups ?? []).some((s) => s.activityId === activityId && s.clubId === clubId);
}

// Signs up for a club's next tryout. Returns { person, blocker, signup };
// the blocker is checked for the tryout's month (age and season then).
export function signUpForTryout(person, activity, club, { monthIndex, country }) {
  const clubSport = club.sports[activity.id];
  if (!clubSport) return { person, blocker: 'noSport', signup: null };
  if (isSignedUp(person, activity.id, club.id)) return { person, blocker: 'signedUp', signup: null };
  const month = nextTryoutMonth(clubSport.tryoutMonths, monthIndex);
  const blocker = teamTryoutBlocker(activity, { kind: 'club', club }, { person, monthIndex: month, country });
  if (blocker) return { person, blocker, signup: null };
  const teamLevelId = tryoutTeamLevel(activity, { kind: 'club', club }, person, month).id;
  const signup = { activityId: activity.id, clubId: club.id, month };
  return { person: { ...person, tryoutSignups: [...(person.tryoutSignups ?? []), signup] }, blocker: null, signup: { ...signup, teamLevelId } };
}

// Runs the sign-ups whose month has come (month <= untilMonth), each at its
// own month, in time order. A sign-up that no longer applies (the person
// got on the team meanwhile) just lapses. Returns { person, entries }.
export function runDueTryouts(person, untilMonth, { activitiesById, clubsById, leaguesById = {}, country, rng }) {
  const due = (person.tryoutSignups ?? []).filter((s) => s.month <= untilMonth).sort((a, b) => a.month - b.month);
  if (due.length === 0) return { person, entries: [] };
  let current = { ...person, tryoutSignups: (person.tryoutSignups ?? []).filter((s) => s.month > untilMonth) };
  const entries = [];
  for (const signup of due) {
    const club = clubsById[signup.clubId];
    if (!club) continue;
    const result = tryOut(current, activitiesById[signup.activityId], { kind: 'club', club }, { monthIndex: signup.month, country, rng, leaguesById });
    current = result.person;
    if (result.entry) entries.push(result.entry);
  }
  return { person: current, entries };
}

// A scout's invitation, accepted: straight onto the club's team in the
// category for the age, no tryout. Returns { person, entry }, or a null
// entry when it no longer applies (already in a club, no category).
export function joinClubTeam(person, activity, club, monthIndex) {
  const clubSport = club.sports[activity.id];
  const level = clubSport && clubTeamLevel(activity, clubSport, ageAt(person.birth, monthIndex));
  if (!level || isOnClubTeam(person, activity.id)) return { person, entry: null };
  const team = { activityId: activity.id, teamKey: club.id, clubId: club.id, teamLevelId: level.id, since: monthIndex };
  return {
    person: { ...person, teams: [...(person.teams ?? []), team] },
    entry: { type: 'teamJoined', activityId: activity.id, clubId: club.id, teamLevelId: level.id },
  };
}

// What happens to one team at the end of a school year: { outcome, team }.
// outcome: 'kept', 'promoted', 'released' or 'left' (school is over).
function reviewTeam(team, person, { activitiesById, clubsById, leaguesById, monthIndex, country, rng }) {
  const activity = activitiesById[team.activityId];
  const nextSeason = nextSeasonStart(monthIndex, country.education.schoolYearStartMonth);
  const keep = (level, league) => rng.chance(passChance(tryoutScore(person, activity.id, rng), requiredScore(level, league) - KEEP_MARGIN));

  if (team.teamKey === 'school') {
    if (!schoolStageAt(person.birth, nextSeason, country.education)) return { outcome: 'left', team };
    const level = activity.teamLevels.find((l) => l.id === team.teamLevelId);
    return { outcome: keep(level, null) ? 'kept' : 'released', team };
  }

  const clubSport = clubsById[team.clubId]?.sports[activity.id];
  if (!clubSport) return { outcome: 'released', team };
  const league = leaguesById[clubSport.youthLeague];
  const level = clubTeamLevel(activity, clubSport, ageAt(person.birth, nextSeason));
  if (!level) return { outcome: 'released', team };
  if (level.id === team.teamLevelId) return { outcome: keep(level, league) ? 'kept' : 'released', team };
  const promoted = rng.chance(passChance(tryoutScore(person, activity.id, rng), requiredScore(level, league)));
  return promoted ? { outcome: 'promoted', team: { ...team, teamLevelId: level.id, since: nextSeason } } : { outcome: 'released', team };
}

// The end of a school year for one person. Returns { person, entries }.
export function endSeason(person, context) {
  const teams = [];
  const entries = [];
  for (const team of person.teams ?? []) {
    const { outcome, team: reviewed } = reviewTeam(team, person, context);
    if (outcome === 'kept' || outcome === 'promoted') teams.push(reviewed);
    entries.push({
      type: 'teamSeason',
      activityId: team.activityId,
      ...(team.clubId ? { clubId: team.clubId } : {}),
      teamLevelId: reviewed.teamLevelId,
      outcome,
    });
  }
  return { person: entries.length > 0 ? { ...person, teams } : person, entries };
}
