// No fs here — this file must stay loadable from a browser; see
// clubsLoader.js for the Node-only reader.
//
// Clubs and leagues for team sports (docs/atividades.md 7). Clubs are
// fictional, one file per country (scripts/generate-clubs.js); their names
// come from a pattern id whose text lives in the locale.

export function indexLeagues(leagues) {
  return Object.fromEntries(leagues.map((league) => [league.id, league]));
}

// countryFiles: the contents of data/clubs/*.json ({ countryId, clubs }).
export function indexClubs(countryFiles) {
  return Object.fromEntries(countryFiles.flatMap((file) => file.clubs).map((club) => [club.id, club]));
}
