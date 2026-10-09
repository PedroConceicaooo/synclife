// No fs here — this file must stay loadable from a browser; see
// activitiesLoader.js for the Node-only reader.

import { evaluateConditions } from '../engine/conditions.js';
import { addMoney, resolveAmount } from './money.js';

export function indexActivities(activities) {
  return Object.fromEntries(activities.map((activity) => [activity.id, activity]));
}

// No success roll — the design doc's one worked example (mow_lawn) has no
// `chance`. Attempting an activity this period means it happens and pays
// `earnings`, period.
export function attemptActivity(activity, { player, peopleById, country, currentMonthIndex }) {
  const conditionsMet = evaluateConditions(activity.conditions, player, { currentMonthIndex });
  if (!conditionsMet) {
    return { attempted: false, peopleById };
  }

  return { attempted: true, peopleById: addMoney(peopleById, player.id, resolveAmount(activity.earnings, country)) };
}
