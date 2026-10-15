// Save format (design doc, "Save"): plain JSON, ids and numbers only. Game
// data (events, interactions, activities, countries) is not saved — it is
// loaded again and joined by id, so content fixes reach old saves.

import { createRng } from '../engine/random.js';
import { resolveCountry } from '../engine/countries.js';
import { focusOnPlayer } from './game.js';

// 2: people carry teams, tryouts and tryoutSignups (team sports).
export const SAVE_VERSION = 2;

export function toSave(state) {
  return {
    saveVersion: SAVE_VERSION,
    seed: state.seed,
    rngState: state.rng.getState(),
    currentMonth: state.currentMonthIndex,
    playerId: state.player.id,
    countryId: state.country.id,
    pastLives: state.pastLives,
    people: state.people,
    relationships: state.relationships,
    firedEvents: state.firedEvents,
    history: state.history,
    pendingDecisions: state.pendingDecisions,
    activityUsesThisPeriod: state.activityUsesThisPeriod,
    enrollmentAskedThisPeriod: state.enrollmentAskedThisPeriod,
    tryoutAskedThisPeriod: state.tryoutAskedThisPeriod,
    parentPayAskedThisPeriod: state.parentPayAskedThisPeriod,
    competedThisPeriod: state.competedThisPeriod,
    clubSeasons: state.clubSeasons,
    remainingMonths: state.remainingMonths,
  };
}

// Older versions get converted here, one version at a time.
const MIGRATIONS = {
  // 1 -> 2: nobody was on a team yet.
  1: (save) => ({
    ...save,
    saveVersion: 2,
    people: Object.fromEntries(
      Object.entries(save.people).map(([id, person]) => [id, { teams: [], tryouts: [], tryoutSignups: [], ...person }]),
    ),
  }),
};

export function migrate(save) {
  let current = save;
  while (current.saveVersion !== SAVE_VERSION) {
    const step = MIGRATIONS[current.saveVersion];
    if (!step) throw new Error(`Unsupported save version: ${current.saveVersion}`);
    current = step(current);
  }
  return current;
}

export function fromSave(
  rawSave,
  { countriesById, eventsById, interactionsById, activitiesById, assetsById = {}, clubsById = {}, leaguesById = {}, requestsById = {} },
) {
  const save = migrate(rawSave);
  const base = {
    seed: save.seed,
    rng: createRng(save.seed, save.rngState),
    country: resolveCountry(save.countryId, countriesById),
    people: save.people,
    relationships: save.relationships,
    currentMonthIndex: save.currentMonth,
    eventsById,
    interactionsById,
    activitiesById,
    assetsById,
    clubsById,
    leaguesById,
    requestsById,
    pendingDecisions: save.pendingDecisions,
    firedEvents: save.firedEvents,
    activityUsesThisPeriod: save.activityUsesThisPeriod,
    enrollmentAskedThisPeriod: save.enrollmentAskedThisPeriod ?? {},
    tryoutAskedThisPeriod: save.tryoutAskedThisPeriod ?? {},
    parentPayAskedThisPeriod: save.parentPayAskedThisPeriod ?? {},
    competedThisPeriod: save.competedThisPeriod ?? {},
    clubSeasons: save.clubSeasons ?? {},
    remainingMonths: save.remainingMonths ?? 0,
    pastLives: save.pastLives,
    history: save.history,
    lastInteractionResult: null,
    lastActivityResult: null,
  };
  return focusOnPlayer(base, save.playerId);
}
