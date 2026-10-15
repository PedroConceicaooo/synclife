import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { applyEffects } from '../src/engine/effects.js';
import { resolveChance } from '../src/systems/interactions.js';
import { processRelationshipEvents } from '../src/systems/events.js';
import { payAllowance } from '../src/systems/money.js';
import {
  defaultMood,
  moodOf,
  setEmotion,
  expireEmotions,
  addTendency,
  relaxStress,
  RESTING_STRESS,
  TRAIT_FIX_AT,
} from '../src/systems/personality.js';
import { createGameState, advanceStep, resolveDecision, playerEmotion } from '../src/systems/game.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const DATA = {
  countriesById: loadCountries(dir('countries')),
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
};
const person = (extra = {}) => ({ id: 'p_1', sex: 'F', traits: [], traitTendencies: {}, stats: { happiness: 70 }, emotion: null, ...extra });

test('default mood follows the happiness bands of the design doc', () => {
  assert.deepEqual([90, 65, 45, 25, 10].map(defaultMood), ['radiant', 'happy', 'neutral', 'sad', 'depressed']);
});

test('a temporary emotion overrides the mood until it wears off', () => {
  const inLove = setEmotion(person(), 'in_love', { month: 100, months: 6 });
  assert.equal(moodOf(inLove, 105), 'in_love');
  assert.equal(moodOf(inLove, 106), 'happy');
  assert.equal(expireEmotions({ p_1: inLove }, 106).p_1.emotion, null);
  assert.deepEqual(expireEmotions({ p_1: inLove }, 105).p_1.emotion, inLove.emotion);
  assert.throws(() => setEmotion(person(), 'bored', { month: 0, months: 1 }));
});

test('a tendency becomes a trait at the threshold, never next to its opposite, and at most three', () => {
  let p = person();
  for (let i = 0; i < TRAIT_FIX_AT - 1; i++) p = addTendency(p, 'stubborn', 1);
  assert.deepEqual(p.traits, []);
  p = addTendency(p, 'stubborn', 1);
  assert.deepEqual(p.traits, ['stubborn']);
  assert.equal(p.traitTendencies.stubborn, undefined);

  let calm = person({ traits: ['patient'] });
  for (let i = 0; i < 5; i++) calm = addTendency(calm, 'explosive', 1);
  assert.deepEqual(calm.traits, ['patient']);

  let full = person({ traits: ['shy', 'rigid', 'generous'] });
  for (let i = 0; i < 5; i++) full = addTendency(full, 'stubborn', 1);
  assert.equal(full.traits.length, 3);
});

test('stress drifts back toward its resting level and the stress effect is clamped', () => {
  const relaxed = relaxStress({ p_2: { id: 'p_2', stress: 90 }, p_3: { id: 'p_3', stress: null } }, 12);
  assert.ok(relaxed.p_2.stress < 90 && relaxed.p_2.stress > RESTING_STRESS);
  assert.equal(relaxed.p_3.stress, null);

  const peopleById = { p_1: person(), p_2: { id: 'p_2', stress: 95 } };
  const relationshipsById = { r_1: { id: 'r_1', roles: { p_2: 'mother', p_1: 'daughter' }, affinity: { p_1: 50, p_2: 50 }, since: 0 } };
  const result = applyEffects([{ op: 'stress', targetRole: ['mother'], delta: 20 }], { relationship: null, relationshipsById, peopleById, playerId: 'p_1' });
  assert.equal(result.peopleById.p_2.stress, 100);
});

test('stressed parents fight more, give less allowance and say no more often', () => {
  const marriage = { id: 'r_m', type: 'romantic', state: 'married', roles: { a: 'wife', b: 'husband' }, affinity: { a: 60, b: 60 } };
  const chanceSeen = (stress) => {
    let seen;
    processRelationshipEvents({ parents_fight: DATA.eventsById.parents_fight }, { r_m: marriage }, {
      currentMonthIndex: 0,
      step: 12,
      rng: { chance: (p) => ((seen = p), false) },
      playerId: 'p_x',
      peopleById: { a: { id: 'a', stress }, b: { id: 'b', stress } },
    });
    return seen;
  };
  assert.ok(chanceSeen(90) > chanceSeen(50));
  assert.ok(chanceSeen(50) > chanceSeen(10));

  const country = { currency: { scale: { small: 10, medium: 50, large: 200 } }, familyAllowance: { ageBands: [{ minAge: 6, scale: 'small', multiplier: 2 }] } };
  const relationship = { affinity: { p: 50 } };
  const child = { id: 'c', birth: 0, allowance: { since: 0, factor: 1 } };
  const allowance = (stress) =>
    payAllowance({ parent: { id: 'p', traits: [], money: 60 * 200, stress }, relationship, child, country, fromMonth: 120, toMonth: 132 });
  assert.ok(allowance(100) < allowance(30));

  const askMoney = DATA.interactionsById.ask_money.chance;
  const ctx = (target) => ({ relationship: { affinity: { p: 60 } }, targetPersonId: 'p', target: { id: 'p', traits: [], ...target } });
  assert.ok(resolveChance(askMoney, ctx({ stress: 90 })) < resolveChance(askMoney, ctx({ stress: 30 })));
  assert.ok(resolveChance(askMoney, ctx({ emotion: { type: 'angry', until: 99 } })) < resolveChance(askMoney, ctx({})));
});

test('repeated childhood choices form a trait, and the diary says so', () => {
  let state = createGameState({ seed: 2, ...DATA });
  state = { ...state, eventsById: { fight_bedtime: DATA.eventsById.fight_bedtime } };
  for (let i = 0; i < TRAIT_FIX_AT; i++) {
    state = { ...state, pendingDecisions: [{ trigger: 'fight_bedtime', firingRelationship: null }] };
    state = resolveDecision(state, 'cry_all_night');
  }
  assert.ok(state.people[state.player.id].traits.includes('stubborn'));
  const entries = state.history.flatMap((b) => b.entries);
  assert.ok(entries.some((e) => e.type === 'traitFormed' && e.trait === 'stubborn'));
  assert.ok(state.people[state.mother.id].stress > createGameState({ seed: 2, ...DATA }).mother.stress);
});

test('an emotion shows in the diary and wears off with time', () => {
  let state = createGameState({ seed: 2, ...DATA });
  state = { ...state, eventsById: { school_fight: DATA.eventsById.school_fight }, currentMonthIndex: state.player.birth + 13 * 12 };
  state = { ...state, pendingDecisions: [{ trigger: 'school_fight', firingRelationship: null }] };
  state = resolveDecision(state, 'fight_back');
  assert.equal(playerEmotion(state), 'angry');
  assert.ok(state.history.at(-1).entries.some((e) => e.type === 'emotion' && e.emotion === 'angry'));

  state = advanceStep({ ...state, eventsById: {} }, 12);
  assert.equal(playerEmotion(state), null);
});
