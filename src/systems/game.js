// Game loop shared by the console (main.js) and the UI: pure, no DOM. The UI
// stops and waits for the player on pending decisions; the console resolves
// them by rng.
//
// `history` is the life diary as data: one block per period, each with
// entries made only of ids and numbers (texts come from locales). Anything
// that changes the player during a period lands in that period's block.

import { createRng } from '../engine/random.js';
import { ageAt, advance } from '../engine/time.js';
import { createIdGenerator } from '../engine/id.js';
import { resolveCountry } from '../engine/countries.js';
import { createNewLife } from './life.js';
import { decayAll, resetInteractionsThisPeriod, findRelationshipBetween } from './relationship.js';
import { processRelationshipEvents, processPlayerEvents, resolveDecision as resolveDecisionEvent } from './events.js';
import { attemptInteraction, listAvailableInteractions } from './interactions.js';
import { attemptActivity, listActivities } from './activities.js';
import { applyEffects } from '../engine/effects.js';
import { isAllowanceAge, payAllowance, transferMoney } from './money.js';
import { growStats } from './growth.js';

const START_YEAR = 2000;
export const ADULT_AGE = 18;

// Smaller stat changes are still applied, just not worth a diary line.
const MIN_LOGGED_STAT_DELTA = 1;

export function createGameState({ seed, countriesById, eventsById, interactionsById, activitiesById }) {
  const rng = createRng(seed);
  const nextPersonId = createIdGenerator('p');
  const nextRelationshipId = createIdGenerator('r');

  const playableCountryIds = Object.keys(countriesById).filter((id) => id !== 'default');
  const countries = playableCountryIds.map((id) => resolveCountry(id, countriesById));

  const {
    player,
    mother,
    father,
    country,
    relationships: { motherChild, fatherChild, marriage },
  } = createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear: START_YEAR });

  return {
    seed,
    rng,
    player,
    mother,
    father,
    country,
    people: { [player.id]: player, [mother.id]: mother, [father.id]: father },
    relationships: Object.fromEntries([motherChild, fatherChild, marriage].map((r) => [r.id, r])),
    motherChildId: motherChild.id,
    fatherChildId: fatherChild.id,
    marriageId: marriage.id,
    currentMonthIndex: player.birth,
    eventsById,
    interactionsById,
    activitiesById,
    pendingDecisions: [],
    firedEvents: [],
    activityUsesThisPeriod: {},
    pastLives: [],
    history: [{ month: player.birth, entries: [{ type: 'birth' }] }],
    lastInteractionResult: null,
    lastActivityResult: null,
  };
}

function otherSide(relationship, personId) {
  return Object.keys(relationship.roles).find((id) => id !== personId);
}

// The player's snapshot and family pointers (mother, father, their
// relationships with the player and their marriage) are all derived from
// playerId and the relationships, so a loaded save or a new player (a
// sibling at 18) gets them the same way.
export function focusOnPlayer(state, playerId) {
  const withRole = (role) =>
    Object.values(state.relationships).find((r) => playerId in r.roles && r.roles[otherSide(r, playerId)] === role);
  const motherChild = withRole('mother');
  const fatherChild = withRole('father');
  const motherId = otherSide(motherChild, playerId);
  const fatherId = otherSide(fatherChild, playerId);
  const marriage = Object.values(state.relationships).find(
    (r) => r.type === 'romantic' && motherId in r.roles && fatherId in r.roles,
  );

  return {
    ...state,
    player: state.people[playerId],
    mother: state.people[motherId],
    father: state.people[fatherId],
    motherChildId: motherChild.id,
    fatherChildId: fatherChild.id,
    marriageId: marriage?.id ?? null,
  };
}

export function isAdult(state) {
  return ageAt(state.player.birth, state.currentMonthIndex) >= ADULT_AGE;
}

function statEntries(before, after) {
  const entries = [];
  for (const stat of Object.keys(after.stats)) {
    const delta = Math.round((after.stats[stat] - before.stats[stat]) * 10) / 10;
    if (Math.abs(delta) >= MIN_LOGGED_STAT_DELTA) entries.push({ type: 'stat', stat, delta });
  }
  return entries;
}

function moneyEntries(before, after, details) {
  const amount = after.money - before.money;
  return amount === 0 ? [] : [{ type: 'money', amount, ...details }];
}

function appendToCurrentBlock(history, entries) {
  const last = history[history.length - 1];
  return [...history.slice(0, -1), { ...last, entries: [...last.entries, ...entries] }];
}

const CHILD_ROLES = ['son', 'daughter'];

// Average of how much each parent likes this child, or null without parents.
function familyAffinity(personId, relationships) {
  const sides = Object.values(relationships)
    .filter((r) => CHILD_ROLES.includes(r.roles[personId]))
    .map((r) => r.affinity[otherSide(r, personId)]);
  return sides.length > 0 ? sides.reduce((sum, value) => sum + value, 0) / sides.length : null;
}

// Every child under 18 grows, not only the player: NPCs live their own
// lives, and a sibling may become the player at 18.
function growChildren(people, relationships, { months, monthIndex }) {
  const next = { ...people };
  for (const person of Object.values(people)) {
    const ageMonths = monthIndex - person.birth;
    if (!person.aptitudes || ageMonths < 0 || ageMonths >= ADULT_AGE * 12) continue;
    next[person.id] = growStats(person, { months, ageMonths, familyAffinity: familyAffinity(person.id, relationships) }).person;
  }
  return next;
}

export function advanceStep(state, months) {
  const playerId = state.player.id;
  const playerBefore = state.people[playerId];
  const { nextMonthIndex, birthdays } = advance(state.currentMonthIndex, months, state.player.birth);
  const entries = birthdays.map((b) => ({ type: 'birthday', age: b.age, month: b.monthIndex }));

  let relationships = decayAll(state.relationships, months);
  relationships = resetInteractionsThisPeriod(relationships);
  let people = state.people;

  const world = processRelationshipEvents(state.eventsById, relationships, {
    currentMonthIndex: nextMonthIndex,
    step: months,
    rng: state.rng,
    playerId,
    peopleById: people,
    country: state.country,
  });
  relationships = world.relationshipsById;
  people = world.peopleById;
  for (const f of world.fired) entries.push({ type: 'worldEvent', eventId: f.eventId, relationshipId: f.relationshipId });

  people = growChildren(people, relationships, { months, monthIndex: state.currentMonthIndex });

  const playerEvents = processPlayerEvents(state.eventsById, {
    player: people[playerId],
    peopleById: people,
    relationshipsById: relationships,
    currentMonthIndex: nextMonthIndex,
    step: months,
    rng: state.rng,
    country: state.country,
    firedEvents: state.firedEvents,
    hasDecision: world.pendingDecisions.length > 0,
  });
  relationships = playerEvents.relationshipsById;
  people = playerEvents.peopleById;
  // Events with options are logged when the player chooses (resolveDecision).
  for (const f of playerEvents.fired) {
    if (!state.eventsById[f.eventId].options) entries.push({ type: 'event', eventId: f.eventId });
  }

  if (isAllowanceAge(ageAt(state.player.birth, nextMonthIndex))) {
    for (const [parentId, relationshipId] of [
      [state.mother.id, state.motherChildId],
      [state.father.id, state.fatherChildId],
    ]) {
      const amount = payAllowance({ parent: people[parentId], relationship: relationships[relationshipId], country: state.country, step: months });
      if (amount === 0) continue;
      people = transferMoney(people, parentId, playerId, amount);
      entries.push({ type: 'money', source: 'allowance', fromId: parentId, amount });
    }
  }

  entries.push(...statEntries(playerBefore, people[playerId]));

  return {
    ...state,
    currentMonthIndex: nextMonthIndex,
    relationships,
    people,
    birthdays,
    fired: world.fired,
    pendingDecisions: [...world.pendingDecisions, ...playerEvents.pendingDecisions],
    activityUsesThisPeriod: {},
    lastActivityResult: null,
    firedEvents: [
      ...state.firedEvents,
      ...world.fired.map((f) => ({ eventId: f.eventId, month: nextMonthIndex })),
      ...playerEvents.fired,
    ],
    history: [...state.history, { month: nextMonthIndex, entries }],
  };
}

// optionId omitted -> the rng picks (console auto-play).
export function resolveDecision(state, optionId) {
  const decision = state.pendingDecisions[0];
  const decisionEvent = state.eventsById[decision.trigger];
  const playerBefore = state.people[state.player.id];

  const result = resolveDecisionEvent(decisionEvent, decision.firingRelationship, {
    rng: state.rng,
    playerId: state.player.id,
    relationshipsById: state.relationships,
    peopleById: state.people,
    country: state.country,
    optionId,
  });
  const playerAfter = result.peopleById[state.player.id];

  return {
    ...state,
    relationships: result.relationshipsById,
    people: result.peopleById,
    pendingDecisions: state.pendingDecisions.slice(1),
    history: appendToCurrentBlock(state.history, [
      { type: 'event', eventId: decisionEvent.id, optionId: result.optionId },
      ...moneyEntries(playerBefore, playerAfter, { source: 'event', eventId: decisionEvent.id }),
      ...statEntries(playerBefore, playerAfter),
    ]),
  };
}

export function attemptPlayerInteraction(state, interactionId, targetPersonId) {
  const interaction = state.interactionsById[interactionId];
  const relationship = findRelationshipBetween(state.player.id, targetPersonId, state.relationships);
  const playerBefore = state.people[state.player.id];

  const result = attemptInteraction(interaction, {
    relationship,
    player: playerBefore,
    target: state.people[targetPersonId],
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });

  const entries = result.attempted
    ? [
        { type: 'interaction', interactionId, targetId: targetPersonId, succeeded: result.succeeded },
        ...moneyEntries(playerBefore, result.peopleById[state.player.id], { source: 'interaction', interactionId, fromId: targetPersonId }),
        ...statEntries(playerBefore, result.peopleById[state.player.id]),
      ]
    : [];

  return {
    ...state,
    relationships: result.relationshipsById,
    people: result.peopleById,
    lastInteractionResult: { ...result, interactionId, targetId: targetPersonId },
    history: entries.length > 0 ? appendToCurrentBlock(state.history, entries) : state.history,
  };
}

export function availableInteractions(state, targetPersonId) {
  return listAvailableInteractions(state.interactionsById, {
    relationship: findRelationshipBetween(state.player.id, targetPersonId, state.relationships),
    player: state.people[state.player.id],
    target: state.people[targetPersonId],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
  });
}

export function availableActivities(state) {
  return listActivities(state.activitiesById, {
    player: state.people[state.player.id],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    usesById: state.activityUsesThisPeriod ?? {},
  });
}

// Events triggered by an activity have no yearlyChance of their own: ones
// with options become a decision, the rest apply right away.
export function attemptPlayerActivity(state, activityId) {
  const activity = state.activitiesById[activityId];
  const playerId = state.player.id;
  const playerBefore = state.people[playerId];
  const uses = state.activityUsesThisPeriod ?? {};

  const result = attemptActivity(activity, {
    player: playerBefore,
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
    usesThisPeriod: uses[activityId] ?? 0,
  });

  if (!result.attempted) {
    return { ...state, lastActivityResult: { attempted: false, reason: result.reason, activityId } };
  }

  let people = result.peopleById;
  let relationships = result.relationshipsById;
  const entries = [{ type: 'activity', activityId }];
  const eventEntries = [];
  const pendingDecisions = [];

  for (const eventId of result.triggeredEvents) {
    const event = state.eventsById[eventId];
    if (event.options) {
      pendingDecisions.push({ trigger: eventId, firingRelationship: null });
      continue;
    }
    const applied = applyEffects(event.effects ?? [], {
      relationship: null,
      relationshipsById: relationships,
      peopleById: people,
      playerId,
      country: state.country,
    });
    people = applied.peopleById;
    relationships = applied.relationshipsById;
    eventEntries.push({ type: 'event', eventId });
  }

  entries.push(
    ...eventEntries,
    ...moneyEntries(playerBefore, people[playerId], { source: 'activity', activityId }),
    ...statEntries(playerBefore, people[playerId]),
  );

  return {
    ...state,
    people,
    relationships,
    activityUsesThisPeriod: { ...uses, [activityId]: (uses[activityId] ?? 0) + 1 },
    pendingDecisions: [...state.pendingDecisions, ...pendingDecisions],
    firedEvents: [...state.firedEvents, ...result.triggeredEvents.map((eventId) => ({ eventId, month: state.currentMonthIndex }))],
    history: appendToCurrentBlock(state.history, entries),
    lastActivityResult: { attempted: true, activityId, triggeredEvents: result.triggeredEvents },
  };
}

// People close to the player (design doc: "Relacionamentos" lists only close
// people). For now that is the family: parents first, then siblings oldest
// first.
const CLOSE_ROLE_ORDER = ['mother', 'father', 'brother', 'sister'];

export function closePeople(state) {
  const playerId = state.player.id;
  return Object.values(state.relationships)
    .filter((r) => playerId in r.roles && r.type === 'family')
    .map((r) => {
      const personId = Object.keys(r.roles).find((id) => id !== playerId);
      return { personId, role: r.roles[personId] };
    })
    .filter(({ role }) => CLOSE_ROLE_ORDER.includes(role))
    .sort((a, b) => {
      const rank = (role) => (['mother', 'father'].includes(role) ? CLOSE_ROLE_ORDER.indexOf(role) : 2);
      return rank(a.role) - rank(b.role) || state.people[a.personId].birth - state.people[b.personId].birth;
    });
}

// Design doc, "Fases da vida": baby 0-2, child 3-11, teen 12-17, adult 18+.
const PHASES = [
  ['baby', 0],
  ['child', 3],
  ['teen', 12],
  ['adult', ADULT_AGE],
];

export function lifePhase(state) {
  const age = ageAt(state.player.birth, state.currentMonthIndex);
  return PHASES.filter(([, minAge]) => age >= minAge).at(-1)[0];
}
