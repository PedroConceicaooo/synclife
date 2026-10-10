// No fs here — this file must stay loadable from a browser; see
// eventsLoader.js for the Node-only reader.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { yearlyChanceToPeriod } from '../engine/random.js';
import { findRelationshipBetween } from './relationship.js';
import { resolveChance } from './interactions.js';
import { RESTING_STRESS } from './personality.js';

export function indexEvents(events) {
  return Object.fromEntries(events.map((event) => [event.id, event]));
}

export function involvesPlayer(relationship, playerId, relationshipsById) {
  if (playerId in relationship.roles) return true;

  return Object.keys(relationship.roles).some(
    (personId) => findRelationshipBetween(personId, playerId, relationshipsById) !== null,
  );
}

// peopleById/country are optional so relationship-only callers keep working;
// they are threaded through so effects on people (stat, money) are not lost.
// "chanceModifiers": [{ "factor": "participantsStress", "weight": 1 }] makes
// a world event likelier when the people in it are stressed (design doc:
// stressed couples fight more). Resting stress is neutral.
const MAX_YEARLY_CHANCE = 0.95;

function scaledYearlyChance(event, relationship, peopleById) {
  let yearly = event.yearlyChance;
  for (const modifier of event.chanceModifiers ?? []) {
    if (modifier.factor !== 'participantsStress') throw new Error(`Unknown event chance factor: ${modifier.factor}`);
    const stresses = Object.keys(relationship.roles).map((id) => peopleById[id]?.stress ?? RESTING_STRESS);
    const average = stresses.reduce((sum, v) => sum + v, 0) / stresses.length;
    yearly *= 1 + (modifier.weight * (average - RESTING_STRESS)) / 50;
  }
  return Math.min(MAX_YEARLY_CHANCE, Math.max(0, yearly));
}

export function processRelationshipEvents(
  eventsById,
  relationshipsById,
  { currentMonthIndex, step, rng, playerId, peopleById = {}, country },
) {
  const relationshipEvents = Object.values(eventsById).filter((event) => event.subject === 'relationship');

  let accumulator = relationshipsById;
  let people = peopleById;
  const fired = [];
  const pendingDecisions = [];

  for (const relationshipId of Object.keys(relationshipsById)) {
    for (const event of relationshipEvents) {
      const relationship = accumulator[relationshipId];

      const conditionContext = { currentMonthIndex, peopleById: people, relationshipsById: accumulator };
      if (!evaluateConditions(event.conditions, relationship, conditionContext)) continue;

      const chance = yearlyChanceToPeriod(scaledYearlyChance(event, relationship, people), step);
      if (!rng.chance(chance)) continue;

      const result = applyEffects(event.effects, {
        relationship,
        relationshipsById: accumulator,
        peopleById: people,
        playerId,
        country,
        rng,
        currentMonthIndex,
      });
      accumulator = result.relationshipsById;
      people = result.peopleById;
      fired.push({ eventId: event.id, relationshipId });

      if (event.ifInvolvesPlayer && involvesPlayer(accumulator[relationshipId], playerId, accumulator)) {
        pendingDecisions.push({ trigger: event.ifInvolvesPlayer.trigger, firingRelationship: accumulator[relationshipId] });
      }
    }
  }

  return { relationshipsById: accumulator, peopleById: people, fired, pendingDecisions };
}

// optionId lets a real player choice override the rng pick (M5); omitting it
// keeps the old auto-resolve behavior (M3's console demo, still used there).
// firingRelationship is null for player events.
export function resolveDecision(
  decisionEvent,
  firingRelationship,
  { rng, playerId, relationshipsById, peopleById = {}, country, optionId, currentMonthIndex },
) {
  const option = optionId
    ? decisionEvent.options.find((o) => o.id === optionId)
    : decisionEvent.options[rng.nextInt(0, decisionEvent.options.length)];

  if (!option) throw new Error(`Unknown option: ${optionId}`);

  const result = applyEffects(option.effects, {
    relationship: firingRelationship,
    relationshipsById,
    peopleById,
    playerId,
    country,
    rng,
    currentMonthIndex,
  });

  return { optionId: option.id, relationshipsById: result.relationshipsById, peopleById: result.peopleById };
}

// One player event, however it was triggered: with options it becomes a
// decision; with a check it rolls success or failure (e.g. on intelligence);
// otherwise its effects apply.
export function firePlayerEvent(event, { player, peopleById, relationshipsById, country, rng, currentMonthIndex }) {
  if (event.options) {
    return { peopleById, relationshipsById, decision: { trigger: event.id, firingRelationship: null }, succeeded: null };
  }
  let effects = event.effects ?? [];
  let succeeded = null;
  if (event.check) {
    succeeded = rng.chance(resolveChance(event.check, { player, relationshipsById, playerId: player.id }));
    effects = succeeded ? event.success : event.failure;
  }
  const result = applyEffects(effects, { relationship: null, relationshipsById, peopleById, playerId: player.id, country, rng, currentMonthIndex });
  return { peopleById: result.peopleById, relationshipsById: result.relationshipsById, decision: null, succeeded };
}

// Player events: subject "player" with a yearlyChance. Decision events that
// are only triggered by world events (no yearlyChance) are never rolled here.
export const MAX_PLAYER_EVENTS_PER_PERIOD = 3;

function isOnCooldown(event, firedEvents, currentMonthIndex) {
  if (!event.cooldownMonths) return false;
  return firedEvents.some((f) => f.eventId === event.id && currentMonthIndex - f.month < event.cooldownMonths);
}

// Fisher-Yates through the seeded rng, so the per-period cap does not always
// favor the same events.
function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickWeighted(events, rng) {
  const total = events.reduce((sum, e) => sum + e.yearlyChance, 0);
  let roll = rng.next() * total;
  for (const event of events) {
    roll -= event.yearlyChance;
    if (roll < 0) return event;
  }
  return events[events.length - 1];
}

// hasDecision: whether this period already has a decision (e.g. from a world
// event). If not, one decision event is forced so every advance asks the
// player something (design doc: "todo avanço tem pelo menos uma decisão").
export function processPlayerEvents(
  eventsById,
  { player, peopleById, relationshipsById, currentMonthIndex, step, rng, country, firedEvents = [], hasDecision = false, alreadyFired = 0 },
) {
  const ageEligible = Object.values(eventsById)
    .filter((event) => event.subject === 'player' && event.yearlyChance !== undefined)
    .filter((event) => evaluateConditions(event.conditions, player, { currentMonthIndex, country, relationshipsById }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const available = ageEligible.filter((event) => !isOnCooldown(event, firedEvents, currentMonthIndex));

  let people = peopleById;
  let relationships = relationshipsById;
  const fired = [];
  const pendingDecisions = [];

  function fire(event) {
    const result = firePlayerEvent(event, { player: people[player.id], peopleById: people, relationshipsById: relationships, country, rng, currentMonthIndex });
    people = result.peopleById;
    relationships = result.relationshipsById;
    if (result.decision) pendingDecisions.push(result.decision);
    fired.push({ eventId: event.id, month: currentMonthIndex, ...(result.succeeded === null ? {} : { succeeded: result.succeeded }) });
  }

  for (const event of shuffle(available, rng)) {
    // alreadyFired: dated events of this period count toward the same cap.
    if (fired.length + alreadyFired >= MAX_PLAYER_EVENTS_PER_PERIOD) break;
    if (rng.chance(yearlyChanceToPeriod(event.yearlyChance, step))) fire(event);
  }

  if (!hasDecision && pendingDecisions.length === 0) {
    const firedIds = new Set(fired.map((f) => f.eventId));
    const decisionsOffCooldown = available.filter((e) => e.options && !firedIds.has(e.id));
    // Cooldowns yield before the one-decision rule does.
    const pool = decisionsOffCooldown.length > 0 ? decisionsOffCooldown : ageEligible.filter((e) => e.options && !firedIds.has(e.id));
    if (pool.length > 0) fire(pickWeighted(pool, rng));
  }

  return { peopleById: people, relationshipsById: relationships, fired, pendingDecisions };
}
