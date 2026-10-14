// League games of team sports (docs/atividades.md 7.4). Each league plays
// gamesPerMonth games in the months of the school year (the season), not in
// the holidays. Playing time comes from how the player does: the tryout
// score without luck, against what the team asks, makes a starter, a
// rotation player or a bench player. Results are rolled with the seeded rng;
// a demanding academy wins a little more, a starter helps a bit, and only
// sports with draws (teamGames.draws) have them.

import { inMonthWindow, tryoutParts, requiredScore, TRYOUT_LUCK } from './tryouts.js';

export const STARTER_MARGIN = 8;
export const DRAW_SHARE = 0.25;
const BASE_WIN = { accessible: 0.45, demanding: 0.55, school: 0.5 };
const ROLE_HELP = { starter: 0.05, rotation: 0.02, bench: 0 };
const ROLE_HAPPINESS = { starter: 2, rotation: 1, bench: -1 };

// The league a team plays in: the school league of the sport, or the
// club's youth league.
export function teamLeague(team, { clubsById, leaguesById }) {
  if (team.teamKey === 'school') return leaguesById[`${team.activityId}_school`] ?? null;
  const clubSport = clubsById[team.clubId]?.sports[team.activityId];
  return clubSport ? leaguesById[clubSport.youthLeague] ?? null : null;
}

export function playingRole(person, activity, team, league) {
  const parts = tryoutParts(person, activity.id);
  const typical = parts.skill + parts.health + parts.aptitude + TRYOUT_LUCK / 2;
  const level = activity.teamLevels.find((l) => l.id === team.teamLevelId);
  const margin = typical - requiredScore(level, team.teamKey === 'school' ? null : league);
  if (margin >= STARTER_MARGIN) return 'starter';
  return margin >= 0 ? 'rotation' : 'bench';
}

// Months of the season in (fromMonth, toMonth] on this team.
export function seasonMonths(team, fromMonth, toMonth, education) {
  const season = [education.schoolYearStartMonth, education.schoolYearEndMonth ?? ((education.schoolYearStartMonth + 10) % 12) + 1];
  let months = 0;
  for (let month = Math.max(fromMonth + 1, team.since); month <= toMonth; month++) {
    if (inMonthWindow(season, (month % 12) + 1)) months++;
  }
  return months;
}

// The games of (fromMonth, toMonth] for each of the person's teams.
// Returns { person, entries }: one teamGames entry per team that played,
// and the happiness of how much they played.
export function playGames(person, fromMonth, toMonth, { activitiesById, clubsById, leaguesById, country, rng }) {
  let current = person;
  const entries = [];
  for (const team of person.teams ?? []) {
    const activity = activitiesById[team.activityId];
    const league = teamLeague(team, { clubsById, leaguesById });
    if (!activity || !league?.gamesPerMonth) continue;
    const played = Math.round(seasonMonths(team, fromMonth, toMonth, country.education) * league.gamesPerMonth);
    if (played === 0) continue;

    const role = playingRole(person, activity, team, league);
    const winChance = (BASE_WIN[league.requirement ?? 'school'] ?? 0.5) + ROLE_HELP[role];
    const result = { won: 0, drawn: 0, lost: 0 };
    for (let game = 0; game < played; game++) {
      if (activity.teamGames?.draws && rng.chance(DRAW_SHARE)) result.drawn++;
      else if (rng.chance(winChance)) result.won++;
      else result.lost++;
    }
    entries.push({
      type: 'teamGames',
      activityId: team.activityId,
      ...(team.clubId ? { clubId: team.clubId } : {}),
      teamLevelId: team.teamLevelId,
      played,
      ...result,
      role,
    });
    const happiness = Math.min(100, Math.max(0, current.stats.happiness + ROLE_HAPPINESS[role]));
    current = { ...current, stats: { ...current.stats, happiness } };
  }
  return { person: current, entries };
}

// One advance may run the season in two stretches (before and after the
// season review): their athlete allowances join in one entry per club, and
// the games of one team in one entry with the last playing time, where the
// first one was.
const sameAllowance = (a, b) => a.source === 'athleteAllowance' && b.source === 'athleteAllowance' && a.clubId === b.clubId;
const sameGames = (a, b) =>
  a.type === 'teamGames' && b.type === 'teamGames' && a.activityId === b.activityId && a.clubId === b.clubId && a.teamLevelId === b.teamLevelId;

export function mergeSeasonEntries(entries) {
  const merged = [];
  for (const entry of entries) {
    const earlier = merged.find((e) => sameAllowance(e, entry) || sameGames(e, entry));
    if (earlier && entry.type === 'teamGames') {
      for (const key of ['played', 'won', 'drawn', 'lost']) earlier[key] += entry[key];
      earlier.role = entry.role;
    } else if (earlier) {
      earlier.amount += entry.amount;
    } else {
      merged.push(entry.source === 'athleteAllowance' || entry.type === 'teamGames' ? { ...entry } : entry);
    }
  }
  return merged;
}
