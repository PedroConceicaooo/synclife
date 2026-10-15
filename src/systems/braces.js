// Orthodontic braces (docs/atividades.md 2): a teenage landmark. The
// "braces" effect (effects.js) puts them on for some months, naming the
// activity that did it. While they last the avatar shows them and events
// that need them (condition hasBraces) can happen; when the time is up an
// advance takes them off and applies that activity's finishEffects.
//
// person.braces = { until, activityId }   (null or absent: no braces)

import { applyEffects } from '../engine/effects.js';
import { normalizeAppearance } from './appearanceCompat.js';

// Takes off braces whose time ended by toMonth. Returns { peopleById,
// relationshipsById, entries }.
export function takeOffBraces(peopleById, playerId, toMonth, { activitiesById, relationshipsById, country, rng }) {
  const player = peopleById[playerId];
  if (!player.braces || player.braces.until > toMonth) return { peopleById, relationshipsById, entries: [] };
  const { braces, ...rest } = player;
  const appearance = normalizeAppearance(player);
  const without = { ...rest, appearance: { ...appearance, braces: false } };
  const result = applyEffects(activitiesById[braces.activityId]?.finishEffects ?? [], {
    relationship: null,
    relationshipsById,
    peopleById: { ...peopleById, [playerId]: without },
    playerId,
    country,
    rng,
    currentMonthIndex: braces.until,
  });
  return { peopleById: result.peopleById, relationshipsById: result.relationshipsById, entries: [{ type: 'bracesOff', activityId: braces.activityId }] };
}
