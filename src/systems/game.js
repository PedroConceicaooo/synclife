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
import {
  processRelationshipEvents,
  processPlayerEvents,
  firePlayerEvent,
  resolveDecision as resolveDecisionEvent,
} from './events.js';
import { evaluateConditions } from '../engine/conditions.js';
import { calendarPoints, calendarEventsAt, firstDecisionPoint } from './calendar.js';
import { startClass, promoteFriendships } from './schoolmates.js';
import { schoolStageAt, schoolEntryMonth } from './school.js';
import { expireEmotions, relaxStress, activeEmotion } from './personality.js';
import { attemptInteraction, listAvailableInteractions } from './interactions.js';
import { attemptActivity, listActivities } from './activities.js';
import { buyAsset, sellAsset, listShop, applyAssetUpkeep } from './assets.js';
import { isAllowanceAge, payAllowance, transferMoney } from './money.js';
import { growStats } from './growth.js';
import { decayAllSkills } from './training.js';
import { requestEnrollment, leaveEnrollment, chargeEnrollments, askParentPermission } from './enrollment.js';
import { compete, competitionBlocker } from './competitions.js';
import { tryOut, endSeason, signUpForTryout, runDueTryouts } from './teams.js';
import { payStipends, mergeStipendEntries } from './stipend.js';

const START_YEAR = 2000;
export const ADULT_AGE = 18;

// Smaller stat changes are still applied, just not worth a diary line.
const MIN_LOGGED_STAT_DELTA = 1;

// choices: see createNewLife (custom name, sex, country and city).
export function createGameState({
  seed,
  countriesById,
  eventsById,
  interactionsById,
  activitiesById,
  assetsById = {},
  clubsById = {},
  leaguesById = {},
  choices,
}) {
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
  } = createNewLife(rng, { countries, nextPersonId, nextRelationshipId, startYear: START_YEAR, choices });

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
    assetsById,
    clubsById,
    leaguesById,
    pendingDecisions: [],
    firedEvents: [],
    activityUsesThisPeriod: {},
    enrollmentAskedThisPeriod: {},
    tryoutAskedThisPeriod: {},
    competedThisPeriod: {},
    remainingMonths: 0,
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

// What changed in the player, for the diary: stats, a new trait, a new
// emotion.
function statEntries(before, after) {
  const entries = [];
  for (const stat of Object.keys(after.stats)) {
    const delta = Math.round((after.stats[stat] - before.stats[stat]) * 10) / 10;
    if (Math.abs(delta) >= MIN_LOGGED_STAT_DELTA) entries.push({ type: 'stat', stat, delta });
  }
  for (const trait of after.traits.filter((t) => !before.traits.includes(t))) entries.push({ type: 'traitFormed', trait });
  const emotion = after.emotion?.type;
  if (emotion && (emotion !== before.emotion?.type || after.emotion.until !== before.emotion?.until)) {
    entries.push({ type: 'emotion', emotion });
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

// The 18th birthday is a decision point (design doc): an advance that would
// cross it stops right there.
export function monthsUntilAdulthood(state) {
  return state.player.birth + ADULT_AGE * 12 - state.currentMonthIndex;
}

// Fires the calendar events of each point the advance went through.
function processCalendar(state, points, { people, relationships }) {
  const entries = [];
  const fired = [];
  const pendingDecisions = [];
  let peopleNow = people;
  let relationshipsNow = relationships;
  // Youth stipends are paid up to each season review with the teams held
  // until then; advanceStep pays what is left after it.
  let stipendsPaidUntil = state.currentMonthIndex;

  for (const point of points) {
    // The school year is the teams' season (teams.js).
    if (point.on === 'schoolYearEnd') {
      const paid = payStipends(peopleNow[state.player.id], stipendsPaidUntil, point.month, state.country);
      entries.push(...paid.entries);
      stipendsPaidUntil = point.month;
      const season = endSeason(paid.person, {
        activitiesById: state.activitiesById,
        clubsById: state.clubsById ?? {},
        leaguesById: state.leaguesById ?? {},
        monthIndex: point.month,
        country: state.country,
        rng: state.rng,
      });
      peopleNow = { ...peopleNow, [state.player.id]: season.person };
      entries.push(...season.entries);
    }
    if (point.on === 'stageStart') {
      entries.push({ type: 'schoolStage', stageId: point.stageId });
      const school = startClass(state.rng, {
        people: peopleNow,
        relationships: relationshipsNow,
        playerId: state.player.id,
        country: state.country,
        month: point.month,
      });
      peopleNow = school.people;
      relationshipsNow = school.relationships;
      entries.push(school.entry);
    }
    for (const event of calendarEventsAt(state.eventsById, point)) {
      const player = peopleNow[state.player.id];
      if (!evaluateConditions(event.conditions, player, { currentMonthIndex: point.month, country: state.country, relationshipsById: relationshipsNow })) continue;
      const result = firePlayerEvent(event, {
        player,
        peopleById: peopleNow,
        relationshipsById: relationshipsNow,
        country: state.country,
        rng: state.rng,
        currentMonthIndex: point.month,
      });
      peopleNow = result.peopleById;
      relationshipsNow = result.relationshipsById;
      fired.push({ eventId: event.id, month: point.month, playerId: state.player.id });
      if (result.decision) pendingDecisions.push(result.decision);
      else entries.push({ type: 'event', eventId: event.id, ...(result.succeeded === null ? {} : { succeeded: result.succeeded }) });
    }
  }
  return { people: peopleNow, relationships: relationshipsNow, entries, fired, pendingDecisions, stipendsPaidUntil };
}

// An advance stops at the 18th birthday and at a dated decision (design
// doc: "O jogo para ali, pergunta e só depois segue o tempo restante");
// what is left goes to remainingMonths for continueAdvance.
export function advanceStep(state, requestedMonths) {
  const untilAdult = monthsUntilAdulthood(state);
  let months = untilAdult > 0 ? Math.min(requestedMonths, untilAdult) : requestedMonths;
  const education = state.country.education;
  const applies = (event, point) =>
    evaluateConditions(event.conditions, state.people[state.player.id], {
      currentMonthIndex: point.month,
      country: state.country,
      relationshipsById: state.relationships,
    });
  const stop = firstDecisionPoint(
    state.eventsById,
    calendarPoints(state.player.birth, state.currentMonthIndex, state.currentMonthIndex + months, education),
    applies,
  );
  if (stop) months = stop.month - state.currentMonthIndex;
  const reachesAdulthood = untilAdult > 0 && months >= untilAdult;
  const remainingMonths = reachesAdulthood ? 0 : requestedMonths - months;
  const points = calendarPoints(state.player.birth, state.currentMonthIndex, state.currentMonthIndex + months, education);
  const playerId = state.player.id;
  const playerBefore = state.people[playerId];
  const { nextMonthIndex, birthdays } = advance(state.currentMonthIndex, months, state.player.birth);
  const entries = birthdays.map((b) => ({ type: 'birthday', age: b.age, month: b.monthIndex }));

  let relationships = decayAll(state.relationships, months);
  relationships = resetInteractionsThisPeriod(relationships);
  let people = relaxStress(expireEmotions(state.people, nextMonthIndex), months);
  people = decayAllSkills(people, state.currentMonthIndex, nextMonthIndex);

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
  people = applyAssetUpkeep(state.assetsById ?? {}, { player: people[playerId], peopleById: people, relationshipsById: relationships, country: state.country, months });

  const calendar = processCalendar(state, points, { people, relationships });
  people = calendar.people;
  relationships = calendar.relationships;
  entries.push(...calendar.entries);

  // Club tryouts signed up for whose window came in this advance (after the
  // season review, so a newcomer isn't reviewed the month they join).
  const tryouts = runDueTryouts(people[playerId], nextMonthIndex, {
    activitiesById: state.activitiesById,
    clubsById: state.clubsById ?? {},
    leaguesById: state.leaguesById ?? {},
    country: state.country,
    rng: state.rng,
  });
  people = { ...people, [playerId]: tryouts.person };
  entries.push(...tryouts.entries);

  const stipends = payStipends(people[playerId], calendar.stipendsPaidUntil, nextMonthIndex, state.country);
  people = { ...people, [playerId]: stipends.person };
  entries.push(...stipends.entries);

  const playerEvents = processPlayerEvents(state.eventsById, {
    player: people[playerId],
    peopleById: people,
    relationshipsById: relationships,
    currentMonthIndex: nextMonthIndex,
    step: months,
    rng: state.rng,
    country: state.country,
    // Cooldowns belong to whoever lived the event, so a sibling who takes
    // over at 18 doesn't inherit them.
    firedEvents: state.firedEvents.filter((f) => !f.playerId || f.playerId === playerId),
    hasDecision: world.pendingDecisions.length + calendar.pendingDecisions.length > 0,
    alreadyFired: calendar.fired.length,
  });
  relationships = playerEvents.relationshipsById;
  people = playerEvents.peopleById;
  // Events with options are logged when the player chooses (resolveDecision).
  for (const f of playerEvents.fired) {
    if (!state.eventsById[f.eventId].options) {
      entries.push({ type: 'event', eventId: f.eventId, ...(f.succeeded === undefined ? {} : { succeeded: f.succeeded }) });
    }
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

  // After the allowance, so a child can pay the month with it.
  const fees = chargeEnrollments(people, state.activitiesById, { country: state.country, months });
  people = fees.peopleById;
  for (const f of fees.paid.filter((f) => f.payerId === playerId)) entries.push({ type: 'money', source: 'enrollment', activityId: f.activityId, amount: -f.amount });
  for (const f of fees.ended.filter((f) => f.personId === playerId)) entries.push({ type: 'enrollmentEnded', activityId: f.activityId });

  entries.push(...statEntries(playerBefore, people[playerId]));

  const friendships = promoteFriendships(relationships, playerId);
  relationships = friendships.relationships;
  entries.push(...friendships.newFriendIds.map((personId) => ({ type: 'newFriend', personId })));

  return {
    ...state,
    currentMonthIndex: nextMonthIndex,
    relationships,
    people,
    birthdays,
    fired: world.fired,
    pendingDecisions: [...world.pendingDecisions, ...calendar.pendingDecisions, ...playerEvents.pendingDecisions],
    remainingMonths,
    activityUsesThisPeriod: {},
    enrollmentAskedThisPeriod: {},
    tryoutAskedThisPeriod: {},
    competedThisPeriod: {},
    lastActivityResult: null,
    firedEvents: [
      ...state.firedEvents,
      ...world.fired.map((f) => ({ eventId: f.eventId, month: nextMonthIndex })),
      ...calendar.fired,
      ...playerEvents.fired.map((f) => ({ ...f, playerId })),
    ],
    history: [...state.history, { month: nextMonthIndex, entries: mergeStipendEntries(entries) }],
  };
}

// After the decisions of an interrupted advance, the rest of the time.
export function canContinueAdvance(state) {
  return state.remainingMonths > 0 && state.pendingDecisions.length === 0;
}

export function continueAdvance(state) {
  return canContinueAdvance(state) ? advanceStep(state, state.remainingMonths) : state;
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
    currentMonthIndex: state.currentMonthIndex,
  });
  // An option may hold a tryout (school teams): { activity, team }.
  const option = decisionEvent.options.find((o) => o.id === result.optionId);
  let people = result.peopleById;
  const tryoutEntries = [];
  if (option.tryout) {
    const tried = tryOut(people[state.player.id], state.activitiesById[option.tryout.activity], { kind: option.tryout.team }, {
      monthIndex: state.currentMonthIndex,
      country: state.country,
      rng: state.rng,
      leaguesById: state.leaguesById ?? {},
    });
    people = { ...people, [state.player.id]: tried.person };
    if (tried.entry) tryoutEntries.push(tried.entry);
  }
  const playerAfter = people[state.player.id];

  return {
    ...state,
    relationships: result.relationshipsById,
    people,
    pendingDecisions: state.pendingDecisions.slice(1),
    history: appendToCurrentBlock(state.history, [
      { type: 'event', eventId: decisionEvent.id, optionId: result.optionId },
      ...tryoutEntries,
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

  if (!result.attempted) {
    return { ...state, lastInteractionResult: { ...result, interactionId, targetId: targetPersonId } };
  }

  const triggered = fireTriggeredEvents(state, result.triggeredEvents, { people: result.peopleById, relationships: result.relationshipsById });
  const friendships = promoteFriendships(triggered.relationships, state.player.id);
  const playerAfter = triggered.people[state.player.id];
  const entries = [
    { type: 'interaction', interactionId, targetId: targetPersonId, succeeded: result.succeeded },
    ...triggered.entries,
    ...friendships.newFriendIds.map((personId) => ({ type: 'newFriend', personId })),
    ...moneyEntries(playerBefore, playerAfter, { source: 'interaction', interactionId, fromId: targetPersonId }),
    ...statEntries(playerBefore, playerAfter),
  ];

  return {
    ...state,
    relationships: friendships.relationships,
    people: triggered.people,
    pendingDecisions: [...state.pendingDecisions, ...triggered.pendingDecisions],
    firedEvents: [...state.firedEvents, ...triggered.fired],
    lastInteractionResult: { ...result, interactionId, targetId: targetPersonId },
    history: appendToCurrentBlock(state.history, entries),
  };
}

export function availableInteractions(state, targetPersonId) {
  return listAvailableInteractions(state.interactionsById, {
    relationship: findRelationshipBetween(state.player.id, targetPersonId, state.relationships),
    player: state.people[state.player.id],
    target: state.people[targetPersonId],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    relationshipsById: state.relationships,
  });
}

// Events set off by an activity or an interaction: ones with options become
// a decision, the rest happen right away.
function fireTriggeredEvents(state, eventIds, { people, relationships }) {
  let peopleNow = people;
  let relationshipsNow = relationships;
  const entries = [];
  const pendingDecisions = [];
  const firedIds = [];
  for (const eventId of eventIds) {
    const event = state.eventsById[eventId];
    const conditionContext = { currentMonthIndex: state.currentMonthIndex, country: state.country, relationshipsById: relationshipsNow };
    if (!evaluateConditions(event.conditions, peopleNow[state.player.id], conditionContext)) continue;
    firedIds.push(eventId);
    const result = firePlayerEvent(event, {
      player: peopleNow[state.player.id],
      peopleById: peopleNow,
      relationshipsById: relationshipsNow,
      country: state.country,
      rng: state.rng,
      currentMonthIndex: state.currentMonthIndex,
    });
    peopleNow = result.peopleById;
    relationshipsNow = result.relationshipsById;
    if (result.decision) pendingDecisions.push(result.decision);
    else entries.push({ type: 'event', eventId, ...(result.succeeded === null ? {} : { succeeded: result.succeeded }) });
  }
  const fired = firedIds.map((eventId) => ({ eventId, month: state.currentMonthIndex, playerId: state.player.id }));
  return { people: peopleNow, relationships: relationshipsNow, entries, pendingDecisions, fired };
}

export function availableActivities(state) {
  const asked = state.enrollmentAskedThisPeriod ?? {};
  return listActivities(state.activitiesById, {
    player: state.people[state.player.id],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    usesById: state.activityUsesThisPeriod ?? {},
    competedById: state.competedThisPeriod ?? {},
  }).map((group) => ({
    ...group,
    activities: group.activities.map((a) => (a.enrollment && asked[a.id] ? { ...a, enrollment: { ...a.enrollment, askedThisPeriod: true } } : a)),
  }));
}

// payer: 'parents' or 'self'. The parents are asked once per activity and
// period (asking again and again annoys them — design doc).
export function enrollPlayer(state, activityId, payer) {
  const activity = state.activitiesById[activityId];
  const asked = state.enrollmentAskedThisPeriod ?? {};
  if (asked[activityId]) return { ...state, lastActivityResult: { attempted: false, reason: 'asked', activityId } };

  const playerId = state.player.id;
  const result = requestEnrollment(activity, {
    payer,
    playerId,
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });
  const askedParents = result.askedParentId !== null && result.reason !== 'money';
  const entry = result.enrolled
    ? { type: 'enrolled', activityId, payer, ...(result.askedParentId ? { parentId: result.askedParentId } : {}) }
    : result.reason === 'refused'
      ? { type: 'enrollmentRefused', activityId, parentId: result.askedParentId }
      : null;

  return {
    ...state,
    people: result.peopleById,
    relationships: result.relationshipsById,
    enrollmentAskedThisPeriod: askedParents ? { ...asked, [activityId]: true } : asked,
    history: entry ? appendToCurrentBlock(state.history, [entry]) : state.history,
    lastActivityResult: { attempted: false, activityId, reason: result.reason, parentAsked: result.askedParentId !== null, enrollmentEntry: entry },
  };
}

// One competition per activity and period (competitions.js).
export function competePlayer(state, activityId) {
  const activity = state.activitiesById[activityId];
  const playerId = state.player.id;
  const competed = state.competedThisPeriod ?? {};
  const blocker = competitionBlocker(activity, state.people[playerId], state.currentMonthIndex, competed[activityId]);
  if (blocker) return { ...state, lastActivityResult: { attempted: false, activityId, reason: blocker } };

  const playerBefore = state.people[playerId];
  const result = compete(activity, {
    playerId,
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });
  const entries = [
    { type: 'competition', activityId, tier: result.tier, place: result.place },
    ...(result.injuredMonths ? [{ type: 'injury', activityId, months: result.injuredMonths }] : []),
    ...moneyEntries(playerBefore, result.peopleById[playerId], { source: 'competition', activityId }),
    ...statEntries(playerBefore, result.peopleById[playerId]),
  ];
  return {
    ...state,
    people: result.peopleById,
    competedThisPeriod: { ...competed, [activityId]: true },
    history: appendToCurrentBlock(state.history, entries),
    lastActivityResult: { attempted: false, activityId, competitionEntries: entries.filter((e) => e.type !== 'stat') },
  };
}

// Signs the player up for a club's next tryout (Atividades → modalidade →
// Clubes e peneiras). A minor asks the parents first, once per club and
// period. Inside the club's window it runs right away; otherwise when an
// advance reaches it.
export function signUpPlayerForTryout(state, activityId, clubId) {
  const playerId = state.player.id;
  const activity = state.activitiesById[activityId];
  const askedKey = `${activityId}:${clubId}`;
  const asked = state.tryoutAskedThisPeriod ?? {};
  if (asked[askedKey]) return { ...state, lastActivityResult: { attempted: false, activityId, reason: 'asked' } };
  const signed = signUpForTryout(state.people[playerId], activity, state.clubsById[clubId], {
    monthIndex: state.currentMonthIndex,
    country: state.country,
  });
  if (signed.blocker) return { ...state, lastActivityResult: { attempted: false, activityId, reason: signed.blocker } };

  const permission = askParentPermission(activity, {
    playerId,
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
    rng: state.rng,
  });
  if (!permission.allowed) {
    const entry = { type: 'tryoutRefused', activityId, clubId, parentId: permission.parentId };
    return {
      ...state,
      people: permission.peopleById,
      relationships: permission.relationshipsById,
      tryoutAskedThisPeriod: { ...asked, [askedKey]: true },
      history: appendToCurrentBlock(state.history, [entry]),
      lastActivityResult: { attempted: false, activityId, tryoutEntries: [entry] },
    };
  }

  const now = runDueTryouts(signed.person, state.currentMonthIndex, {
    activitiesById: state.activitiesById,
    clubsById: state.clubsById,
    leaguesById: state.leaguesById ?? {},
    country: state.country,
    rng: state.rng,
  });
  const entries = [{ type: 'tryoutSignup', ...signed.signup, ...(permission.parentId ? { parentId: permission.parentId } : {}) }, ...now.entries];
  return {
    ...state,
    people: { ...state.people, [playerId]: now.person },
    tryoutAskedThisPeriod: { ...asked, [askedKey]: true },
    history: appendToCurrentBlock(state.history, entries),
    lastActivityResult: { attempted: false, activityId, tryoutEntries: entries },
  };
}

export function leavePlayerEnrollment(state, activityId) {
  return {
    ...state,
    people: leaveEnrollment(state.people, state.player.id, activityId),
    history: appendToCurrentBlock(state.history, [{ type: 'enrollmentLeft', activityId }]),
    lastActivityResult: null,
  };
}

// Diary entries of a session besides the training line itself.
function trainingEntries(activityId, training) {
  if (!training) return [];
  const entries = [];
  if (training.levelId) entries.push({ type: 'levelUp', activityId, levelId: training.levelId });
  if (training.failedLevelId) entries.push({ type: 'examFailed', activityId, levelId: training.failedLevelId });
  if (training.stripe) entries.push({ type: 'stripe', activityId, stripe: training.stripe, levelId: training.currentLevelId });
  if (training.injuredMonths) entries.push({ type: 'injury', activityId, months: training.injuredMonths });
  return entries;
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

  const triggered = fireTriggeredEvents(state, result.triggeredEvents, { people: result.peopleById, relationships: result.relationshipsById });
  const { people, relationships } = triggered;
  const entries = [
    result.training
      ? { type: 'training', activityId, gain: result.training.gain, technique: result.training.technique }
      : { type: 'activity', activityId, ...(activity.check ? { succeeded: result.succeeded } : {}) },
    ...trainingEntries(activityId, result.training),
    ...triggered.entries,
    ...moneyEntries(playerBefore, people[playerId], { source: 'activity', activityId }),
    ...statEntries(playerBefore, people[playerId]),
  ];

  return {
    ...state,
    people,
    relationships,
    activityUsesThisPeriod: { ...uses, [activityId]: (uses[activityId] ?? 0) + 1 },
    pendingDecisions: [...state.pendingDecisions, ...triggered.pendingDecisions],
    firedEvents: [...state.firedEvents, ...triggered.fired],
    history: appendToCurrentBlock(state.history, entries),
    lastActivityResult: {
      attempted: true,
      activityId,
      succeeded: result.succeeded,
      triggeredEvents: triggered.fired.map((f) => f.eventId),
      training: result.training,
      trainingEvents: trainingEntries(activityId, result.training),
    },
  };
}

// People close to the player (design: every bond — family, partner,
// friends, pets, exes), parents first, each group oldest first.
const CLOSE_ROLE_RANK = { mother: 0, father: 1, brother: 2, sister: 2, partner: 3, friend: 4, pet: 5, ex: 6 };

export function closePeople(state) {
  const playerId = state.player.id;
  return Object.values(state.relationships)
    .filter((r) => playerId in r.roles)
    .map((r) => {
      const personId = Object.keys(r.roles).find((id) => id !== playerId);
      return { personId, role: r.roles[personId] };
    })
    .filter(({ role }) => role in CLOSE_ROLE_RANK)
    .sort(
      (a, b) =>
        CLOSE_ROLE_RANK[a.role] - CLOSE_ROLE_RANK[b.role] || state.people[a.personId].birth - state.people[b.personId].birth,
    );
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

// Countries a life can start in (all but the default template).
export function playableCountries(countriesById) {
  return Object.keys(countriesById)
    .filter((id) => id !== 'default')
    .sort()
    .map((id) => resolveCountry(id, countriesById));
}

// What the player "does" right now, shown under the name (design: baby,
// a school stage, later a job). Adult jobs come after version 1.
const BABY_UNTIL_AGE = 3;

export function playerOccupation(state) {
  const { birth } = state.player;
  const month = state.currentMonthIndex;
  const age = ageAt(birth, month);
  if (age >= ADULT_AGE) return { type: 'adult' };
  const stage = schoolStageAt(birth, month, state.country.education);
  if (stage) return { type: 'school', stageId: stage.stageId, grade: stage.grade };
  const entry = schoolEntryMonth(birth, state.country.education);
  if (entry !== null && month >= entry) return { type: 'graduated' };
  return { type: age < BABY_UNTIL_AGE ? 'baby' : 'preschool' };
}

export function assetShop(state) {
  return listShop(state.assetsById ?? {}, {
    player: state.people[state.player.id],
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
  });
}

export function buyPlayerAsset(state, assetId) {
  const asset = state.assetsById[assetId];
  const playerBefore = state.people[state.player.id];
  const result = buyAsset(asset, {
    player: playerBefore,
    peopleById: state.people,
    relationshipsById: state.relationships,
    country: state.country,
    currentMonthIndex: state.currentMonthIndex,
  });
  if (!result.bought) return { ...state, lastAssetResult: { done: false, reason: result.reason, assetId } };

  const playerAfter = result.peopleById[state.player.id];
  return {
    ...state,
    people: result.peopleById,
    lastAssetResult: { done: true, action: 'bought', assetId },
    history: appendToCurrentBlock(state.history, [
      { type: 'assetBought', assetId },
      ...moneyEntries(playerBefore, playerAfter, { source: 'asset', assetId }),
      ...statEntries(playerBefore, playerAfter),
    ]),
  };
}

export function sellPlayerAsset(state, assetId) {
  const asset = state.assetsById[assetId];
  const playerBefore = state.people[state.player.id];
  const result = sellAsset(asset, state.assetsById, { player: playerBefore, peopleById: state.people, country: state.country });
  if (!result.sold) return { ...state, lastAssetResult: { done: false, reason: result.reason, assetId } };

  return {
    ...state,
    people: result.peopleById,
    lastAssetResult: { done: true, action: 'sold', assetId, dropped: result.dropped },
    history: appendToCurrentBlock(state.history, [
      ...result.dropped.map((id) => ({ type: 'assetSold', assetId: id })),
      ...moneyEntries(playerBefore, result.peopleById[state.player.id], { source: 'asset', assetId }),
    ]),
  };
}

// The player's temporary emotion right now, if any.
export function playerEmotion(state) {
  return activeEmotion(state.people[state.player.id], state.currentMonthIndex);
}
