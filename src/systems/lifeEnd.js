// The end of a life at 18 (design doc, "Fim aos 18 e continuação"): a
// summary, and either a new life or carrying on as a younger sibling in the
// same world.

import { ageAt } from '../engine/time.js';
import { ADULT_AGE, closePeople, focusOnPlayer } from './game.js';

const SIBLING_ROLES = ['brother', 'sister'];
const STRONGEST_COUNT = 3;

// Milestone events (marked in data) in the order they happened.
function milestones(state) {
  const found = [];
  for (const block of state.history) {
    for (const entry of block.entries) {
      if ((entry.type === 'event' || entry.type === 'worldEvent') && state.eventsById[entry.eventId]?.milestone) {
        found.push({ eventId: entry.eventId, optionId: entry.optionId ?? null, month: block.month });
      }
    }
  }
  return found;
}

// Strongest by the average of both sides.
function strongestRelationships(state) {
  const playerId = state.player.id;
  return closePeople(state)
    .map(({ personId, role }) => {
      const relationship = Object.values(state.relationships).find((r) => personId in r.roles && playerId in r.roles);
      const strength = (relationship.affinity[personId] + relationship.affinity[playerId]) / 2;
      return { personId, role, strength: Math.round(strength) };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, STRONGEST_COUNT);
}

// Living siblings under 18 (design doc: half-siblings too, once they exist).
export function eligibleSuccessors(state) {
  return closePeople(state)
    .filter(({ role }) => SIBLING_ROLES.includes(role))
    .filter(({ personId }) => ageAt(state.people[personId].birth, state.currentMonthIndex) < ADULT_AGE)
    .map(({ personId }) => personId);
}

export function lifeSummary(state) {
  const player = state.people[state.player.id];
  return {
    playerId: player.id,
    stats: player.stats,
    money: player.money,
    milestones: milestones(state),
    strongestRelationships: strongestRelationships(state),
    successors: eligibleSuccessors(state),
  };
}

// The old player becomes an ordinary NPC; playerId moves to the sibling and
// the finished life goes to pastLives with its diary.
export function continueAsSibling(state, siblingId) {
  if (!eligibleSuccessors(state).includes(siblingId)) throw new Error(`Not an eligible sibling: ${siblingId}`);
  const previousId = state.player.id;
  const next = focusOnPlayer(
    {
      ...state,
      pastLives: [...state.pastLives, { playerId: previousId, endedAt: state.currentMonthIndex, history: state.history }],
      history: [{ month: state.currentMonthIndex, entries: [{ type: 'continue', previousId }] }],
      pendingDecisions: [],
      activityUsesThisPeriod: {},
      lastInteractionResult: null,
      lastActivityResult: null,
    },
    siblingId,
  );
  return next;
}
