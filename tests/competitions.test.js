import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  COMPETITION_TIERS,
  competitionTier,
  placeFor,
  prizeFor,
  competitionBlocker,
  compete,
  medalCounts,
} from '../src/systems/competitions.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createRng } from '../src/engine/random.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };

const ACTIVITY = {
  id: 'judo',
  competitions: true,
  enrollment: { monthlyFee: 'small' },
  training: { aptitude: 'physical', levels: [{ id: 'white' }], injury: { chance: 0.1, health: -6, months: [3, 10] } },
};

function player({ skill = 60, physical = 0.5, enrolled = true } = {}) {
  return {
    id: 'p_kid',
    birth: 0,
    money: 0,
    stats: { ...STATS },
    aptitudes: { physical },
    skills: { judo: { skill } },
    ...(enrolled ? { enrollments: { judo: { since: 0, payerId: 'p_mom' } } } : {}),
  };
}

// rng.next() = 0.5 is no luck either way; chance() decides the injury.
const rng = ({ luck = 0.5, injured = false } = {}) => ({ next: () => luck, chance: () => injured, nextInt: (min) => min });

function args(person, options) {
  return { playerId: person.id, peopleById: { [person.id]: person }, country: COUNTRY, currentMonthIndex: 150, rng: rng(options) };
}

test('competitionTier is the highest tier the skill reaches', () => {
  assert.equal(competitionTier(0).id, 'school');
  assert.equal(competitionTier(29).id, 'school');
  assert.equal(competitionTier(30).id, 'regional');
  assert.equal(competitionTier(50).id, 'state');
  assert.equal(competitionTier(70).id, 'national');
  assert.equal(competitionTier(100).id, 'international');
});

test('placeFor: gold 12+ above the opponents, silver 4+, bronze from −4, else out', () => {
  assert.equal(placeFor(67, 55), 'gold');
  assert.equal(placeFor(66, 55), 'silver');
  assert.equal(placeFor(59, 55), 'silver');
  assert.equal(placeFor(51, 55), 'bronze');
  assert.equal(placeFor(50, 55), 'out');
});

test('prizeFor pays from the state tier up: gold in full, silver half', () => {
  const [school, , state, national] = COMPETITION_TIERS;
  assert.equal(prizeFor(school, 'gold', COUNTRY), 0);
  assert.equal(prizeFor(state, 'gold', COUNTRY), 10);
  assert.equal(prizeFor(state, 'silver', COUNTRY), 5);
  assert.equal(prizeFor(national, 'bronze', COUNTRY), 0);
});

test('competitionBlocker: needs the activity to compete, an enrollment and some training; once per period', () => {
  assert.equal(competitionBlocker({ ...ACTIVITY, competitions: undefined }, player(), 150), 'none');
  assert.equal(competitionBlocker(ACTIVITY, player({ enrolled: false }), 150), 'none');
  assert.equal(competitionBlocker(ACTIVITY, { ...player(), skills: {} }, 150), 'none');
  assert.equal(competitionBlocker(ACTIVITY, { ...player(), injuredUntil: 151 }, 150), 'injured');
  assert.equal(competitionBlocker(ACTIVITY, player(), 150, true), 'competed');
  assert.equal(competitionBlocker(ACTIVITY, player(), 150), null);
});

test('a podium place pays the prize, makes the player happier and goes on the shelf', () => {
  // Skill 70 at the national tier (opponents 72), aptitude 1 (+10), max luck (+15): 95 − 72 = 23, gold.
  const result = compete(ACTIVITY, args(player({ skill: 70, physical: 1 }), { luck: 1 }));
  assert.equal(result.tier, 'national');
  assert.equal(result.place, 'gold');
  assert.equal(result.prize, 50);
  const after = result.peopleById.p_kid;
  assert.equal(after.money, 50);
  assert.equal(after.stats.happiness, 58);
  assert.deepEqual(after.achievements, [{ activityId: 'judo', tier: 'national', place: 'gold', month: 150 }]);
  assert.deepEqual(medalCounts(after, 'judo'), { gold: 1, silver: 0, bronze: 0 });
  assert.deepEqual(medalCounts(after, 'karate'), { gold: 0, silver: 0, bronze: 0 });
});

test('being knocked out costs happiness and leaves the shelf alone', () => {
  // Skill 50 at the state tier (opponents 55), no luck: 50 − 55 = −5, out.
  const result = compete(ACTIVITY, args(player({ skill: 50 })));
  assert.equal(result.place, 'out');
  assert.equal(result.peopleById.p_kid.stats.happiness, 47);
  assert.equal(result.peopleById.p_kid.achievements, undefined);
});

test('a competition can injure, with the activity injury chance tripled', () => {
  let rolled = null;
  const watching = { next: () => 0.5, chance: (p) => ((rolled = p), true), nextInt: (min) => min };
  const result = compete(ACTIVITY, { ...args(player()), rng: watching });
  assert.ok(Math.abs(rolled - 0.3) < 1e-9);
  assert.equal(result.injuredMonths, 3);
  assert.equal(result.peopleById.p_kid.injuredUntil, 153);
  assert.equal(result.peopleById.p_kid.stats.health, 44);
});

test('at the bottom of a tier, a player of average aptitude reaches the podium about half the time', () => {
  for (const tier of COMPETITION_TIERS.slice(1)) {
    const random = createRng(7);
    let podiums = 0;
    for (let i = 0; i < 2000; i++) {
      const person = player({ skill: tier.minSkill });
      if (compete(ACTIVITY, { ...args(person), rng: random }).place !== 'out') podiums++;
    }
    const share = podiums / 2000;
    assert.ok(share > 0.3 && share < 0.7, `${tier.id}: ${share}`);
  }
});

test('competition data: self-defence systems and the gym have none; texts exist', () => {
  const activities = Object.values(loadActivities(ACTIVITIES_DIR));
  for (const id of ['krav_maga', 'systema', 'gym']) assert.ok(!activities.find((a) => a.id === id).competitions, id);
  for (const activity of activities.filter((a) => a.competitions)) {
    assert.ok(activity.training && activity.enrollment, `${activity.id}: competing needs training and enrollment`);
  }
  for (const tier of COMPETITION_TIERS) assert.ok(LOCALE[`competitionTier.${tier.id}`], tier.id);
  for (const place of ['gold', 'silver', 'bronze', 'out']) assert.ok(LOCALE[`diary.competition.${place}`], place);
  for (const key of ['ui.compete', 'ui.activity_competed', 'ui.medals', 'ui.medal.gold.other', 'ui.medal.silver.other', 'ui.medal.bronze.other']) {
    assert.ok(LOCALE[key], key);
  }
});
