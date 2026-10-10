// Dated events (design doc: "Pontos de decisão"): events tied to the school
// calendar instead of a yearly chance. Data says when, with a closed
// vocabulary: { "on": "stageStart", "stage": [...], "entranceExam": true }
// or { "on": "schoolYearEnd" }.

import { stageStartsBetween, schoolYearEndsBetween } from './school.js';

// Calendar points in (fromMonth, toMonth], in time order.
export function calendarPoints(birth, fromMonth, toMonth, education) {
  return [
    ...stageStartsBetween(birth, fromMonth, toMonth, education).map((p) => ({ ...p, on: 'stageStart' })),
    ...schoolYearEndsBetween(birth, fromMonth, toMonth, education).map((p) => ({ ...p, on: 'schoolYearEnd' })),
  ].sort((a, b) => a.month - b.month);
}

function matches(calendar, point) {
  if (!calendar || calendar.on !== point.on) return false;
  if (calendar.stage !== undefined && ![].concat(calendar.stage).includes(point.stageId)) return false;
  if (calendar.entranceExam !== undefined && calendar.entranceExam !== point.entranceExam) return false;
  return true;
}

export function calendarEventsAt(eventsById, point) {
  return Object.values(eventsById)
    .filter((event) => event.subject === 'player' && matches(event.calendar, point))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// The first point that asks the player something: the advance stops there.
export function firstDecisionPoint(eventsById, points) {
  return points.find((point) => calendarEventsAt(eventsById, point).some((event) => event.options)) ?? null;
}
