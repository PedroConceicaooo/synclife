// Club history (docs/atividades.md 7.6): every pro league of the player's
// country plays one season a year, ending in the month the country's
// school year ends. Its table orders the league's clubs by a seeded roll,
// where a club that finished higher the year before keeps a little of it.
//
// state.clubSeasons = { [leagueId]: [{ season, table: [clubId, ...] }] }
// season is the calendar year the season ended in; table goes from first
// to last.

export const MOMENTUM = 0.3;

// Calendar month (1..12) a season ends in: the school year's last month.
function endMonthOf(education) {
  return education.schoolYearEndMonth ?? ((education.schoolYearStartMonth + 10) % 12) + 1;
}

// Season ends in (fromMonth, toMonth].
export function seasonEndsBetween(fromMonth, toMonth, education) {
  const end = endMonthOf(education);
  const ends = [];
  for (let month = fromMonth + 1; month <= toMonth; month++) if ((month % 12) + 1 === end) ends.push(month);
  return ends;
}

export function leagueClubs(league, clubsById) {
  return Object.values(clubsById)
    .filter((club) => club.sports[league.activity]?.proLeague === league.id)
    .map((club) => club.id)
    .sort();
}

// One season's table: a roll per club plus momentum from last season's
// place (none in the first season but a neutral half).
export function playLeagueSeason(clubIds, previousTable, rng) {
  const lastPlace = (id) => {
    if (!previousTable) return 0.5;
    const index = previousTable.indexOf(id);
    return index === -1 ? 0.5 : 1 - index / Math.max(1, previousTable.length - 1);
  };
  return clubIds
    .map((id) => ({ id, score: rng.next() + MOMENTUM * lastPlace(id) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}

// Every season of the country's pro leagues that ends in (fromMonth,
// toMonth]. Returns { clubSeasons, ended: [{ leagueId, season, table }] }.
export function playClubSeasons(clubSeasons, { leaguesById, clubsById, country, fromMonth, toMonth, rng }) {
  const leagues = Object.values(leaguesById)
    .filter((league) => league.kind === 'pro' && league.countryId === country.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  let history = clubSeasons;
  const ended = [];
  for (const month of seasonEndsBetween(fromMonth, toMonth, country.education)) {
    const season = Math.floor(month / 12);
    for (const league of leagues) {
      const clubIds = leagueClubs(league, clubsById);
      if (clubIds.length === 0) continue;
      const table = playLeagueSeason(clubIds, history[league.id]?.at(-1)?.table, rng);
      history = { ...history, [league.id]: [...(history[league.id] ?? []), { season, table }] };
      ended.push({ leagueId: league.id, season, table });
    }
  }
  return { clubSeasons: history, ended };
}

// A club's place in its league's last season: { leagueId, season,
// position, size }, or null before its first season.
export function lastStanding(clubSeasons, club, activityId) {
  const leagueId = club.sports[activityId]?.proLeague;
  const last = clubSeasons?.[leagueId]?.at(-1);
  if (!last) return null;
  const index = last.table.indexOf(club.id);
  return index === -1 ? null : { leagueId, season: last.season, position: index + 1, size: last.table.length };
}
