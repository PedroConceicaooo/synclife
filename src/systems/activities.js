import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateConditions } from '../engine/conditions.js';
import { addMoney, resolveAmount } from './money.js';

export function loadActivities(dir) {
  const activitiesById = {};

  for (const fileName of readdirSync(dir).sort()) {
    if (!fileName.endsWith('.json')) continue;
    const activity = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
    activitiesById[activity.id] = activity;
  }

  return activitiesById;
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
