// Save format (design doc, "Save"): plain JSON, ids and numbers only. Game
// data (events, interactions, activities, countries) is not saved — it is
// loaded again and joined by id, so content fixes reach old saves.

import { createRng } from '../engine/random.js';
import { resolveCountry } from '../engine/countries.js';
import { ageAt } from '../engine/time.js';
import { focusOnPlayer } from './game.js';

// 2: people carry teams, tryouts and tryoutSignups (team sports).
// 3: the allowance starts with the parents' offer (person.allowance).
export const SAVE_VERSION = 3;

// Version 2 paid the allowance from this age on, without asking.
const OLD_ALLOWANCE_AGE = 3;

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
    permissionRefusedThisPeriod: state.permissionRefusedThisPeriod,
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
  // 2 -> 3: a player already getting the allowance keeps it, as it was.
  2: (save) => {
    const player = save.people[save.playerId];
    const receiving = ageAt(player.birth, save.currentMonth) >= OLD_ALLOWANCE_AGE;
    return {
      ...save,
      saveVersion: 3,
      people: receiving ? { ...save.people, [player.id]: { ...player, allowance: { since: save.currentMonth, factor: 1 } } } : save.people,
    };
  },
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
    permissionRefusedThisPeriod: save.permissionRefusedThisPeriod ?? {},
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
