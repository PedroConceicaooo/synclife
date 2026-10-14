import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { createPerson } from '../src/engine/person.js';
import { createRelationship } from '../src/systems/relationship.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import {
  createGameState,
  advanceStep,
  resolveDecision,
  attemptPlayerInteraction,
  attemptPlayerActivity,
  enrollPlayer,
  leavePlayerEnrollment,
  competePlayer,
  availableActivities,
  availableInteractions,
  closePeople,
  lifePhase,
  playableCountries,
  playerOccupation,
  isAdult,
} from '../src/systems/game.js';

const EVENTS_DIR = fileURLToPath(new URL('../data/events/', import.meta.url));
const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));

const COUNTRY = { id: 'BR', currency: { scale: { small: 25, medium: 125, large: 500 } }, education: { schoolYearStartMonth: 2, stages: [] } };
const COUNTRIES_BY_ID = loadCountries(fileURLToPath(new URL('../data/countries/', import.meta.url)));

const EVENTS_BY_ID = loadEvents(EVENTS_DIR);
const INTERACTIONS_BY_ID = loadInteractions(INTERACTIONS_DIR);
const ACTIVITIES_BY_ID = loadActivities(ACTIVITIES_DIR);

function baseArgs(seed) {
  return { seed, countriesById: COUNTRIES_BY_ID, eventsById: EVENTS_BY_ID, interactionsById: INTERACTIONS_BY_ID, activitiesById: ACTIVITIES_BY_ID };
}

test('advanceStep is deterministic for a fixed seed', () => {
  const run = () => advanceStep(createGameState(baseArgs(7)), 12);
  const a = run();
  const b = run();
  assert.deepEqual(a.people, b.people);
  assert.deepEqual(a.relationships, b.relationships);
  assert.equal(a.currentMonthIndex, b.currentMonthIndex);
});

function buildDivorceReadyState() {
  const player = createPerson({ id: 'p_player', sex: 'M', birth: -72, countryId: 'BR' }); // age 6 at month 0, satisfies ask_money's minAge:5
  const mother = createPerson({ id: 'p_mother', sex: 'F', birth: -300, countryId: 'BR', traits: ['sociable', 'patient'] });
  const father = createPerson({ id: 'p_father', sex: 'M', birth: -320, countryId: 'BR', traits: ['sociable', 'patient'] });

  const motherChild = createRelationship({
    id: 'r_mother_child',
    roles: { p_mother: 'mother', p_player: 'son' },
    type: 'family',
    affinity: { p_mother: 80, p_player: 75 },
    since: 0,
  });
  const fatherChild = createRelationship({
    id: 'r_father_child',
    roles: { p_father: 'father', p_player: 'son' },
    type: 'family',
    affinity: { p_father: 80, p_player: 75 },
    since: 0,
  });
  const marriage = createRelationship({
    id: 'r_marriage',
    roles: { p_mother: 'wife', p_father: 'husband' },
    type: 'romantic',
    state: 'married',
    affinity: { p_mother: 10, p_father: 10 },
    since: 0,
  });

  return {
    rng: { chance: () => true, nextInt: () => 0, next: () => 0 },
    player,
    mother,
    father,
    country: COUNTRY,
    people: { [player.id]: player, [mother.id]: mother, [father.id]: father },
    relationships: { [motherChild.id]: motherChild, [fatherChild.id]: fatherChild, [marriage.id]: marriage },
    motherChildId: motherChild.id,
    fatherChildId: fatherChild.id,
    marriageId: marriage.id,
    currentMonthIndex: 0,
    // Only the divorce pair, so these tests stay about world events.
    eventsById: { divorce: EVENTS_BY_ID.divorce, choose_who_to_live_with: EVENTS_BY_ID.choose_who_to_live_with },
    interactionsById: INTERACTIONS_BY_ID,
    activitiesById: ACTIVITIES_BY_ID,
    pendingDecisions: [],
    firedEvents: [],
    history: [{ month: 0, entries: [] }],
    lastInteractionResult: null,
  };
}

test('advanceStep surfaces a pending decision when divorce fires and involves the player', () => {
  const state = buildDivorceReadyState();
  const afterAdvance = advanceStep(state, 12);

  assert.equal(afterAdvance.relationships[state.marriageId].state, 'divorced');
  assert.equal(afterAdvance.pendingDecisions.length, 1);
  assert.equal(afterAdvance.pendingDecisions[0].trigger, 'choose_who_to_live_with');
});

test('resolveDecision honors the player\'s explicit choice even when the rng would have picked differently', () => {
  const state = buildDivorceReadyState();
  const afterAdvance = advanceStep(state, 12);

  // rng.nextInt always returns 0 (live_with_mother) in this fixture — proving
  // the explicit choice below is not just coincidentally matching the rng.
  const afterDecision = resolveDecision(afterAdvance, 'live_with_father');

  // 12 months of decay (rate 0.2/month) already dropped 80 to 77.6 before the
  // decision's +5/-5 effects apply.
  assert.equal(afterDecision.pendingDecisions.length, 0);
  assert.equal(afterDecision.relationships[state.fatherChildId].affinity.p_father, 82.6);
  assert.equal(afterDecision.relationships[state.motherChildId].affinity.p_mother, 72.6);
});

test('attemptPlayerInteraction success path transfers money and adjusts affinity', () => {
  const state = buildDivorceReadyState();
  const result = attemptPlayerInteraction(state, 'ask_money', 'p_mother');

  assert.equal(result.lastInteractionResult.attempted, true);
  assert.equal(result.lastInteractionResult.succeeded, true);
  assert.equal(result.people.p_player.money, 25);
  assert.equal(result.relationships[state.motherChildId].affinity.p_mother, 78);
});

test('attemptPlayerInteraction failure path only adjusts affinity', () => {
  const state = { ...buildDivorceReadyState(), rng: { chance: () => false, nextInt: () => 0, next: () => 0 } };
  const result = attemptPlayerInteraction(state, 'ask_money', 'p_mother');

  assert.equal(result.lastInteractionResult.succeeded, false);
  assert.equal(result.people.p_player.money, 0);
  assert.equal(result.relationships[state.motherChildId].affinity.p_mother, 76);
  assert.equal(result.relationships[state.motherChildId].affinity.p_player, 71);
});

test('a short sequence of advanceStep and attemptPlayerInteraction is deterministic for a fixed seed', () => {
  function run(seed) {
    let state = createGameState(baseArgs(seed));
    state = advanceStep(state, 6);
    while (state.pendingDecisions.length > 0) {
      state = resolveDecision(state);
    }
    state = attemptPlayerInteraction(state, 'ask_money', state.mother.id);
    state = advanceStep(state, 12);
    return { people: state.people, relationships: state.relationships, currentMonthIndex: state.currentMonthIndex };
  }

  assert.deepEqual(run(2024), run(2024));
});

function playFullLife(seed) {
  let state = createGameState(baseArgs(seed));
  const initialMoney = state.people[state.player.id].money;
  const advances = [];
  let step = 6;
  while (!isAdult(state)) {
    state = advanceStep(state, step);
    advances.push({ decisions: state.pendingDecisions.length, adult: isAdult(state) });
    while (state.pendingDecisions.length > 0) state = resolveDecision(state);
    step = step === 6 ? 12 : 6;
  }
  return { state, initialMoney, advances };
}

// The advance that reaches 18 is excluded: v1 has no adult events, and the
// choice at 18 is M6's decision point.
test('a full life asks at least one decision on every advance before 18', () => {
  for (const seed of [1, 2, 3, 42]) {
    const { advances } = playFullLife(seed);
    assert.ok(advances.filter((a) => !a.adult).every((a) => a.decisions >= 1), `seed ${seed}`);
  }
});

test('a full life ends with stats that moved away from their starting values', () => {
  const { state } = playFullLife(42);
  const start = createGameState(baseArgs(42)).people[state.player.id].stats;
  const end = state.people[state.player.id].stats;
  assert.notDeepEqual(end, start);
  assert.ok(end.intelligence > start.intelligence + 20);
});

test('every money change of the player is in the diary', () => {
  for (const seed of [1, 2, 3, 42]) {
    let { state, initialMoney } = playFullLife(seed);
    state = attemptPlayerInteraction(state, 'ask_money', state.mother.id);

    const logged = state.history.flatMap((block) => block.entries).filter((e) => e.type === 'money').reduce((sum, e) => sum + e.amount, 0);
    assert.equal(state.people[state.player.id].money - initialMoney, logged, `seed ${seed}`);
  }
});

test('advanceStep adds one diary block per advance with birthdays and allowance', () => {
  const { state } = playFullLife(7);
  const entries = state.history.flatMap((block) => block.entries);

  assert.equal(state.history[0].entries[0].type, 'birth');
  assert.equal(entries.filter((e) => e.type === 'birthday').length, 18);
  assert.ok(entries.some((e) => e.type === 'money' && e.source === 'allowance'));
  assert.ok(entries.some((e) => e.type === 'event' && e.optionId));
  assert.ok(entries.some((e) => e.type === 'stat'));
});

test('advanceStep no longer earns money from activities on its own', () => {
  const { state } = playFullLife(3);
  const sources = new Set(state.history.flatMap((b) => b.entries).filter((e) => e.type === 'money').map((e) => e.source));
  assert.deepEqual([...sources], ['allowance']);
});

test('a full life is deterministic for a fixed seed', () => {
  const a = playFullLife(2024).state;
  const b = playFullLife(2024).state;
  assert.deepEqual(a.history, b.history);
  assert.deepEqual(a.people, b.people);
});

const ACTIVITY_FIXTURE = {
  odd_job: { id: 'odd_job', category: 'odd_jobs', conditions: { minAge: 5 }, earnings: 'medium', randomEvents: [{ event: 'tip', chance: 1 }] },
  risky_job: { id: 'risky_job', category: 'odd_jobs', conditions: { minAge: 5 }, earnings: 'small', randomEvents: [{ event: 'dilemma', chance: 1 }] },
  park: { id: 'park', category: 'leisure', conditions: { minAge: 5 }, cost: 'medium', effects: [{ op: 'stat', target: 'player', stat: 'happiness', delta: 5 }] },
};
const ACTIVITY_EVENTS = {
  tip: { id: 'tip', subject: 'player', effects: [{ op: 'money', target: 'player', gain: 'small' }] },
  dilemma: { id: 'dilemma', subject: 'player', options: [{ id: 'ok', effects: [] }] },
};

function activityState() {
  const state = buildDivorceReadyState();
  return { ...state, activitiesById: ACTIVITY_FIXTURE, eventsById: { ...state.eventsById, ...ACTIVITY_EVENTS }, activityUsesThisPeriod: {} };
}

test('attemptPlayerActivity pays, applies triggered events and logs everything in the current block', () => {
  const after = attemptPlayerActivity(activityState(), 'odd_job');

  // medium (125) + tip (small, 25) in the BR fixture currency
  assert.equal(after.people.p_player.money, 150);
  assert.deepEqual(after.history[0].entries, [
    { type: 'activity', activityId: 'odd_job' },
    { type: 'event', eventId: 'tip' },
    { type: 'money', amount: 150, source: 'activity', activityId: 'odd_job' },
  ]);
});

test('attemptPlayerActivity allows each activity once per period and resets on advance', () => {
  const once = attemptPlayerActivity(activityState(), 'odd_job');
  const twice = attemptPlayerActivity(once, 'odd_job');

  assert.equal(twice.lastActivityResult.reason, 'limit');
  assert.equal(twice.people.p_player.money, 150);

  const nextPeriod = advanceStep(twice, 6);
  assert.deepEqual(nextPeriod.activityUsesThisPeriod, {});
});

test('attemptPlayerActivity spends money on leisure and blocks it without money', () => {
  const state = activityState();
  assert.equal(attemptPlayerActivity(state, 'park').lastActivityResult.reason, 'money');

  const rich = { ...state, people: { ...state.people, p_player: { ...state.people.p_player, money: 200 } } };
  const after = attemptPlayerActivity(rich, 'park');
  assert.equal(after.people.p_player.money, 75);
  assert.equal(after.people.p_player.stats.happiness, 55);
});

test('an activity event with options becomes a pending decision', () => {
  const after = attemptPlayerActivity(activityState(), 'risky_job');
  assert.deepEqual(after.pendingDecisions, [{ trigger: 'dilemma', firingRelationship: null }]);
});

test('availableActivities reflects uses this period', () => {
  const after = attemptPlayerActivity(activityState(), 'odd_job');
  const jobs = availableActivities(after).find((g) => g.category === 'odd_jobs').activities;
  assert.deepEqual(jobs.find((a) => a.id === 'odd_job'), { id: 'odd_job', blocker: 'limit' });
});

test('a new baby joins the family and the player reaction sets the sibling affinity', () => {
  const base = buildDivorceReadyState();
  const marriage = { ...base.relationships.r_marriage, affinity: { p_mother: 80, p_father: 80 } };
  const state = {
    ...base,
    relationships: { ...base.relationships, r_marriage: marriage },
    eventsById: { new_baby: EVENTS_BY_ID.new_baby, new_sibling: EVENTS_BY_ID.new_sibling },
    rng: createRng(3),
  };
  // Forces every roll above 10% (the new_baby roll among them); smaller ones use the seeded rng.
  const forced = { ...state, rng: { ...state.rng, chance: (p) => (p < 1 && p > 0.1 ? true : state.rng.chance(p)) } };

  const afterAdvance = advanceStep(forced, 12);
  const babyId = Object.keys(afterAdvance.people).find((id) => !(id in state.people));
  assert.ok(babyId);
  assert.deepEqual(afterAdvance.pendingDecisions.map((d) => d.trigger), ['new_sibling']);
  assert.ok(afterAdvance.history.at(-1).entries.some((e) => e.type === 'worldEvent' && e.eventId === 'new_baby'));

  const cuddled = resolveDecision(afterAdvance, 'cuddle');
  const siblingRelationship = Object.values(cuddled.relationships).find((r) => babyId in r.roles && 'p_player' in r.roles);
  assert.equal(siblingRelationship.roles.p_player, 'brother');
  assert.deepEqual(siblingRelationship.affinity, { p_player: 65, [babyId]: 65 });

  assert.deepEqual(closePeople(cuddled).map((p) => p.role), ['mother', 'father', siblingRelationship.roles[babyId]]);

  // A newborn sibling can't chat yet; four years later most options open up,
  // and parent-only ones (ask_money, help_at_home) never show for a sibling.
  const idsFor = (s) => availableInteractions(s, babyId).flatMap((g) => g.interactionIds);
  assert.deepEqual(idsFor(cuddled), []);
  const fourYearsLater = { ...cuddled, currentMonthIndex: cuddled.currentMonthIndex + 48 };
  const ids = idsFor(fourYearsLater);
  for (const id of ['chat', 'play_together', 'tease', 'fight_sibling', 'tattle']) assert.ok(ids.includes(id), id);
  for (const id of ['ask_money', 'help_at_home', 'ask_sibling_help']) assert.ok(!ids.includes(id), id);
});

test('a new life has a named family with a home city and parents with jobs', () => {
  const state = createGameState(baseArgs(77));
  for (const person of [state.player, state.mother, state.father]) {
    assert.ok(person.firstName && person.lastName, person.id);
    assert.ok(state.country.cities.includes(person.cityId), person.id);
  }
  for (const parent of [state.mother, state.father]) {
    assert.ok(state.country.occupations.includes(parent.occupation.title), parent.id);
  }
  assert.equal(state.player.occupation, null);
});

test('babies born mid-life get names that differ from their siblings', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { state } = playFullLife(seed);
    const siblingIds = closePeople(state).filter((p) => ['brother', 'sister'].includes(p.role)).map((p) => p.personId);
    const children = [state.player.id, ...siblingIds].map((id) => state.people[id]);
    for (const child of children) assert.ok(child.firstName && child.lastName, `${seed} ${child.id}`);
    const sameSex = (sex) => children.filter((c) => c.sex === sex).map((c) => c.firstName);
    for (const sex of ['M', 'F']) assert.equal(new Set(sameSex(sex)).size, sameSex(sex).length, `seed ${seed}`);
  }
});

test('lifePhase follows the design doc age bands', () => {
  const state = createGameState(baseArgs(1));
  const at = (years, months = 0) => lifePhase({ ...state, currentMonthIndex: state.player.birth + years * 12 + months });
  assert.equal(at(0), 'baby');
  assert.equal(at(2, 11), 'baby');
  assert.equal(at(3), 'child');
  assert.equal(at(11, 11), 'child');
  assert.equal(at(12), 'teen');
  assert.equal(at(17, 11), 'teen');
  assert.equal(at(18), 'adult');
});

test('siblings grow up too, not only the player', () => {
  const lives = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => playFullLife(seed).state);
  const siblingsOf = (s) => closePeople(s).filter((p) => ['brother', 'sister'].includes(p.role)).map((p) => s.people[p.personId]);
  const state = lives.find((s) => siblingsOf(s).length > 0);
  assert.ok(state, 'some seed should have a sibling');
  const siblings = siblingsOf(state);
  for (const sibling of siblings) {
    const ageYears = (state.currentMonthIndex - sibling.birth) / 12;
    if (ageYears >= 3) assert.ok(sibling.stats.intelligence > 30, `${sibling.id} at ${ageYears}: ${sibling.stats.intelligence}`);
  }
});

test('a custom life uses the chosen name, sex, country and city', () => {
  const state = createGameState({ ...baseArgs(5), choices: { firstName: '  Bia  ', sex: 'F', countryId: 'JP', cityId: 'kyoto' } });
  assert.equal(state.player.firstName, 'Bia');
  assert.equal(state.player.sex, 'F');
  assert.equal(state.country.id, 'JP');
  assert.equal(state.player.cityId, 'kyoto');
  assert.equal(state.mother.cityId, 'kyoto');
  assert.equal(state.player.lastName, state.father.lastName);
});

test('invalid or empty choices fall back to the rolled values', () => {
  const rolled = createGameState(baseArgs(5));
  const state = createGameState({ ...baseArgs(5), choices: { firstName: '   ', sex: 'X', countryId: 'ZZ', cityId: 'atlantis' } });
  assert.deepEqual(state.player, rolled.player);
  assert.equal(state.country.id, rolled.country.id);
});

test('a city from another country is ignored', () => {
  const state = createGameState({ ...baseArgs(5), choices: { countryId: 'BR', cityId: 'kyoto' } });
  assert.ok(state.country.cities.includes(state.player.cityId));
});

test('playableCountries lists the five countries, resolved', () => {
  const countries = playableCountries(COUNTRIES_BY_ID);
  assert.deepEqual(countries.map((c) => c.id), ['BR', 'GB', 'JP', 'RU', 'US']);
  assert.ok(countries.every((c) => c.cities.length > 0));
});

test('playerOccupation follows age and the country school calendar', () => {
  const state = createGameState({ ...baseArgs(5), choices: { countryId: 'JP' } });
  const at = (months) => playerOccupation({ ...state, currentMonthIndex: state.player.birth + months });
  assert.deepEqual(at(0), { type: 'baby' });
  assert.deepEqual(at(3 * 12), { type: 'preschool' });
  assert.equal(at(8 * 12).type, 'school');
  assert.equal(at(8 * 12).stageId, 'elementary');
  assert.equal(at(13 * 12 + 6).stageId, 'middle');
  assert.deepEqual(at(18 * 12), { type: 'adult' });
});

test('everyone in a new life has an appearance, and the player takes after the parents', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { player, mother, father } = createGameState(baseArgs(seed));
    for (const person of [player, mother, father]) assert.ok('skinTone' in person.appearance, `${seed} ${person.id}`);
    // appearance.js: skin is the parents' average, one step either way at most.
    const average = (mother.appearance.skinTone + father.appearance.skinTone) / 2;
    assert.ok(Math.abs(player.appearance.skinTone - average) <= 1.5, `${seed} skin`);
  }
});

test('taking the blame for a sibling wins the sibling over and costs with the parents', () => {
  const lives = Array.from({ length: 20 }, (_, i) => i + 1).map((seed) => playFullLife(seed).state);
  // Exactly one sibling: the event names no sibling, so with two the effect
  // may go to the other one.
  const withSibling = lives.find((s) => closePeople(s).filter((p) => ['brother', 'sister'].includes(p.role)).length === 1);
  const sibling = closePeople(withSibling).find((p) => ['brother', 'sister'].includes(p.role)).personId;
  const relationshipWith = (s) => Object.values(s.relationships).find((r) => sibling in r.roles && s.player.id in r.roles);
  const before = { ...withSibling, pendingDecisions: [{ trigger: 'sibling_mischief', firingRelationship: null }] };
  const after = resolveDecision(before, 'take_the_blame');
  assert.ok(relationshipWith(after).affinity[sibling] > relationshipWith(before).affinity[sibling]);
  assert.ok(after.relationships[before.motherChildId].affinity[before.mother.id] < before.relationships[before.motherChildId].affinity[before.mother.id]);
});

// A real life at 8, with only jiu-jitsu and no events, so advances are quiet.
function bjjState(rngChance) {
  let state = createGameState({ ...baseArgs(5), eventsById: {}, activitiesById: { bjj: ACTIVITIES_BY_ID.bjj } });
  state = { ...state, currentMonthIndex: state.player.birth + 8 * 12 };
  return rngChance ? { ...state, rng: { ...state.rng, chance: rngChance } } : state;
}

test('enrollPlayer: the parents are asked once per activity and period', () => {
  const refused = enrollPlayer(bjjState(() => false), 'bjj', 'parents');
  assert.equal(refused.history.at(-1).entries.at(-1).type, 'enrollmentRefused');
  assert.equal(availableActivities(refused)[0].activities[0].enrollment.askedThisPeriod, true);

  const again = enrollPlayer({ ...refused, rng: { ...refused.rng, chance: () => true } }, 'bjj', 'parents');
  assert.equal(again.lastActivityResult.reason, 'asked');
  assert.equal(again.people[again.player.id].enrollments, undefined);

  const nextPeriod = enrollPlayer({ ...advanceStep(refused, 6), rng: { ...refused.rng, chance: () => true } }, 'bjj', 'parents');
  assert.equal(nextPeriod.history.at(-1).entries.at(-1).type, 'enrolled');
});

test('an enrolled player trains, the payer is charged every advance, and leaving stops it', () => {
  const enrolled = enrollPlayer(bjjState(() => true), 'bjj', 'parents');
  const playerId = enrolled.player.id;
  const payerId = enrolled.people[playerId].enrollments.bjj.payerId;
  assert.ok([enrolled.mother.id, enrolled.father.id].includes(payerId));

  const trained = attemptPlayerActivity(enrolled, 'bjj');
  assert.ok(trained.history.at(-1).entries.some((e) => e.type === 'training'));

  const fee = enrolled.country.currency.scale.small;
  const paidBefore = enrolled.people[payerId].money;
  const advanced = advanceStep(trained, 6);
  // The allowance moves money too, so compare against what the payer gave as allowance.
  const allowanceFrom = (state) =>
    state.history.at(-1).entries.filter((e) => e.type === 'money' && e.source === 'allowance' && e.fromId === payerId).reduce((sum, e) => sum + e.amount, 0);
  assert.equal(advanced.people[payerId].money, paidBefore - allowanceFrom(advanced) - fee * 6);

  const left = leavePlayerEnrollment(advanced, 'bjj');
  assert.equal(left.history.at(-1).entries.at(-1).type, 'enrollmentLeft');
  assert.equal(availableActivities(left)[0].activities[0].blocker, 'notEnrolled');
  const later = advanceStep(left, 6);
  assert.equal(later.people[payerId].money, advanced.people[payerId].money - allowanceFrom(later));
});

test('competePlayer: once per activity and period, logged in the diary, free again after an advance', () => {
  // Parents always agree; no injury, in training or competing (tested in competitions.test.js).
  const enrolled = enrollPlayer(bjjState(() => true), 'bjj', 'parents');
  const trained = attemptPlayerActivity({ ...enrolled, rng: { ...createRng(1), chance: () => false } }, 'bjj');
  const before = availableActivities(trained)[0].activities[0].competition;
  assert.equal(before.blocker, null);
  assert.equal(before.tier, 'school');

  const competed = competePlayer(trained, 'bjj');
  const entry = competed.history.at(-1).entries.find((e) => e.type === 'competition');
  assert.equal(entry.tier, 'school');
  assert.ok(['gold', 'silver', 'bronze', 'out'].includes(entry.place));
  assert.equal(availableActivities(competed)[0].activities[0].competition.blocker, 'competed');
  assert.equal(competePlayer(competed, 'bjj').lastActivityResult.reason, 'competed');

  const advanced = advanceStep(competed, 6);
  assert.equal(availableActivities(advanced)[0].activities[0].competition.blocker, null);
});
