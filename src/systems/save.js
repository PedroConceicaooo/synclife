// Save format (design doc, "Save"): plain JSON, ids and numbers only. Game
// data (events, interactions, activities, countries) is not saved — it is
// loaded again and joined by id, so content fixes reach old saves.

import { createRng } from '../engine/random.js';
import { resolveCountry } from '../engine/countries.js';
import { focusOnPlayer } from './game.js';

export const SAVE_VERSION = 1;

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
  };
}

// Older versions get converted here when the format changes.
function migrate(save) {
  if (save.saveVersion === SAVE_VERSION) return save;
  throw new Error(`Unsupported save version: ${save.saveVersion}`);
}

export function fromSave(rawSave, { countriesById, eventsById, interactionsById, activitiesById }) {
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
    pendingDecisions: save.pendingDecisions,
    firedEvents: save.firedEvents,
    activityUsesThisPeriod: save.activityUsesThisPeriod,
    pastLives: save.pastLives,
    history: save.history,
    lastInteractionResult: null,
    lastActivityResult: null,
  };
  return focusOnPlayer(base, save.playerId);
}
