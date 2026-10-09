// No fs here — this file must stay loadable from a browser; see
// activitiesLoader.js for the Node-only reader.
//
// Activities are things the player does alone (design doc: "Atividades"):
// odd jobs that earn money and leisure that spends it. Each one can be done
// once per period, and may trigger a small event by chance.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { addMoney, resolveAmount } from './money.js';

export function indexActivities(activities) {
  return Object.fromEntries(activities.map((activity) => [activity.id, activity]));
}

// Display order of the Activities screen.
export const ACTIVITY_CATEGORIES = ['odd_jobs', 'leisure'];

export const ACTIVITY_USES_PER_PERIOD = 1;

function cost(activity, country) {
  return activity.cost ? resolveAmount(activity.cost, country) : 0;
}

// Why an activity can't be done right now, or null if it can.
export function activityBlocker(activity, { player, country, currentMonthIndex, usesThisPeriod = 0 }) {
  if (!evaluateConditions(activity.conditions, player, { currentMonthIndex, country })) return 'conditions';
  if (usesThisPeriod >= ACTIVITY_USES_PER_PERIOD) return 'limit';
  if (player.money < cost(activity, country)) return 'money';
  return null;
}

// Activities the player is old enough for, grouped by category in display
// order. Ones blocked only by the limit or by money stay listed (with their
// blocker) so the UI can show them disabled instead of making them vanish.
export function listActivities(activitiesById, { player, country, currentMonthIndex, usesById = {} }) {
  const visible = Object.values(activitiesById)
    .map((activity) => ({
      id: activity.id,
      category: activity.category,
      minAge: activity.conditions.minAge,
      blocker: activityBlocker(activity, { player, country, currentMonthIndex, usesThisPeriod: usesById[activity.id] ?? 0 }),
    }))
    .filter((a) => a.blocker !== 'conditions')
    .sort((a, b) => a.minAge - b.minAge || a.id.localeCompare(b.id));

  return ACTIVITY_CATEGORIES.map((category) => ({
    category,
    activities: visible.filter((a) => a.category === category).map(({ id, blocker }) => ({ id, blocker })),
  })).filter((group) => group.activities.length > 0);
}

// rng is only needed for activities with randomEvents. Returns the ids of the
// events triggered; the caller fires them (they may need a decision).
export function attemptActivity(
  activity,
  { player, peopleById, relationshipsById = {}, country, currentMonthIndex, rng, usesThisPeriod = 0 },
) {
  const blocker = activityBlocker(activity, { player: peopleById[player.id], country, currentMonthIndex, usesThisPeriod });
  if (blocker) return { attempted: false, reason: blocker, peopleById, relationshipsById, triggeredEvents: [] };

  let people = addMoney(peopleById, player.id, -cost(activity, country));
  if (activity.earnings) people = addMoney(people, player.id, resolveAmount(activity.earnings, country));

  const result = applyEffects(activity.effects ?? [], {
    relationship: null,
    relationshipsById,
    peopleById: people,
    playerId: player.id,
    country,
  });

  const triggeredEvents = (activity.randomEvents ?? []).filter((r) => rng.chance(r.chance)).map((r) => r.event);

  return { attempted: true, peopleById: result.peopleById, relationshipsById: result.relationshipsById, triggeredEvents };
}
