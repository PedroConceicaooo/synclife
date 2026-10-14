import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  aptitudeFactor,
  ageFactor,
  trainingGain,
  trainSkill,
  techniquesLearned,
  nextLevel,
  newSkillEntry,
  examChance,
  stripesEarned,
  isInjured,
  decaySkill,
  decayAllSkills,
} from '../src/systems/training.js';
import { attemptActivity, listActivities, indexActivities } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createRng } from '../src/engine/random.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } } };

const TRAINING = {
  aptitude: 'physical',
  levels: [{ id: 'white' }, { id: 'blue', minAge: 16, minSkill: 20, minMonths: 12 }],
  techniques: ['a', 'b', 'c'],
};

// rng.next() = 0.5 gives luck 1.0, so the gain is the formula without luck.
const MID_RNG = { next: () => 0.5, chance: () => false };

// Same luck, but every chance roll comes out as `roll` (exam, injury).
const rolls = (roll, nextInt = (min) => min) => ({ next: () => 0.5, chance: () => roll, nextInt });

function person({ physical = 0.5 } = {}) {
  return { id: 'p_player', birth: 0, money: 0, aptitudes: { physical }, stats: { happiness: 50, health: 50, intelligence: 50, looks: 50 } };
}

test('aptitudeFactor maps the hidden 0..1 aptitude to 0.8..1.2', () => {
  assert.equal(aptitudeFactor(0), 0.8);
  assert.equal(aptitudeFactor(0.5), 1);
  assert.ok(Math.abs(aptitudeFactor(1) - 1.2) < 1e-9);
});

test('ageFactor grows with age, whole from 16, never below 0.25', () => {
  assert.equal(ageFactor(2), 0.25);
  assert.equal(ageFactor(8), 0.5);
  assert.equal(ageFactor(16), 1);
  assert.equal(ageFactor(30), 1);
});

test('children gain less per session than teenagers from 16 on', () => {
  assert.equal(trainingGain(0, 0.5, MID_RNG, 8), 3); // 5 × 0.5, rounded
  assert.equal(trainingGain(0, 0.5, MID_RNG, 16), 5);
  assert.equal(trainingGain(90, 0, { next: () => 0 }, 4), 1); // still at least 1
});

test('a child who trains from 4 ends far from the top: about 80% at 16', () => {
  let total = 0;
  const lives = 300;
  for (let seed = 1; seed <= lives; seed++) {
    const rng = createRng(seed);
    let skill = 0;
    for (let month = 48; month < 192; month += 6) {
      for (let i = 0; i < 2; i++) skill += trainingGain(skill, 0.5, rng, Math.floor(month / 12));
    }
    total += skill;
  }
  const average = total / lives;
  assert.ok(average >= 70 && average <= 88, `average skill at 16: ${average.toFixed(1)}`);
});

test('trainingGain follows 5 × (1 − skill/110) × aptitude × luck, at least 1 point', () => {
  assert.equal(trainingGain(0, 0.5, MID_RNG), 5);
  assert.equal(trainingGain(0, 1, { next: () => 0.999 }), 8); // 5 × 1.2 × ~1.3
  assert.equal(trainingGain(99, 0, { next: () => 0 }), 1);
  assert.equal(trainingGain(100, 1, MID_RNG), 0);
});

test('the skill never goes past 100', () => {
  const entry = { ...newSkillEntry(0), skill: 99, peak: 99 };
  const { entry: trained } = trainSkill(TRAINING, entry, { person: person(), monthIndex: 200, rng: { next: () => 0.999 } });
  assert.equal(trained.skill, 100);
});

test('with 4 sessions a year, average years to each skill match docs/atividades.md', () => {
  // Doc table (aptitude média): 25% in 1.5 years, 50% in 3.4, 75% in 6.3.
  const expected = { 25: 1.5, 50: 3.4, 75: 6.3 };
  const totals = { 25: 0, 50: 0, 75: 0 };
  const lives = 500;
  for (let seed = 1; seed <= lives; seed++) {
    const rng = createRng(seed);
    let skill = 0;
    let sessions = 0;
    const reached = {};
    while (skill < 75) {
      skill += trainingGain(skill, 0.5, rng);
      sessions++;
      for (const t of Object.keys(totals)) if (skill >= t && !reached[t]) reached[t] = sessions;
    }
    for (const t of Object.keys(totals)) totals[t] += reached[t];
  }
  for (const [t, years] of Object.entries(expected)) {
    const average = totals[t] / lives / 4;
    assert.ok(Math.abs(average - years) <= 0.3, `${t}%: ${average.toFixed(2)} years, expected ~${years}`);
  }
});

test('a technique is learned every 2 sessions, in order, until the list ends', () => {
  let entry;
  const learned = [];
  for (let i = 0; i < 8; i++) {
    const result = trainSkill(TRAINING, entry, { person: person(), monthIndex: 200 + i * 6, rng: MID_RNG });
    entry = result.entry;
    learned.push(result.technique);
  }
  assert.deepEqual(learned, [null, 'a', null, 'b', null, 'c', null, null]);
  assert.deepEqual(techniquesLearned(TRAINING, entry), ['a', 'b', 'c']);
  assert.equal(entry.sessions, 8);
});

test('nextLevel needs the skill, the months at the current level and the age', () => {
  const ready = { ...newSkillEntry(0), skill: 20, levelSince: 180 };
  const at16 = 16 * 12;
  assert.equal(nextLevel(TRAINING, ready, person(), at16).id, 'blue');
  assert.equal(nextLevel(TRAINING, { ...ready, skill: 19 }, person(), at16), null);
  assert.equal(nextLevel(TRAINING, { ...ready, levelSince: at16 - 11 }, person(), at16), null);
  assert.equal(nextLevel(TRAINING, ready, person(), 15 * 12 + 11), null);
  assert.equal(nextLevel(TRAINING, { ...ready, level: 1 }, person(), at16), null);
});

test('trainSkill promotes one level when the session makes the person eligible', () => {
  const entry = { ...newSkillEntry(0), skill: 18, peak: 18, levelSince: 0 };
  const result = trainSkill(TRAINING, entry, { person: person(), monthIndex: 16 * 12, rng: MID_RNG });
  assert.equal(result.levelId, 'blue');
  assert.equal(result.entry.level, 1);
  assert.equal(result.entry.levelSince, 16 * 12);
});

test('decaySkill: nothing for a year, then 1 point every 6 months, down to half the peak', () => {
  const entry = { ...newSkillEntry(0), skill: 40, peak: 40, lastTrainedMonth: 0 };
  assert.equal(decaySkill(entry, 0, 12), entry);
  assert.equal(decaySkill(entry, 12, 18).skill, 39);
  assert.equal(decaySkill(entry, 0, 24).skill, 38);
  assert.equal(decaySkill(entry, 0, 1000).skill, 20);
  assert.equal(decaySkill({ ...entry, skill: 20 }, 0, 1000).skill, 20);
});

test('decayAllSkills only touches people whose skills changed', () => {
  const idle = { id: 'p_1', skills: { bjj: { ...newSkillEntry(0), skill: 30, peak: 30 } } };
  const fresh = { id: 'p_2', skills: { bjj: { ...newSkillEntry(20), skill: 30, peak: 30 } } };
  const none = { id: 'p_3' };
  const people = decayAllSkills({ p_1: idle, p_2: fresh, p_3: none }, 12, 24);
  assert.equal(people.p_1.skills.bjj.skill, 28);
  assert.equal(people.p_2, fresh);
  assert.equal(people.p_3, none);
  const untouched = { p_2: fresh };
  assert.equal(decayAllSkills(untouched, 20, 26), untouched);
});

test('a trainable activity can be done twice per period and trains the skill', () => {
  const activity = { id: 'bjj', category: 'physical', conditions: { minAge: 4 }, training: TRAINING };
  const player = person();
  const args = { player, peopleById: { p_player: player }, country: COUNTRY, currentMonthIndex: 16 * 12, rng: MID_RNG };

  const first = attemptActivity(activity, { ...args, usesThisPeriod: 0 });
  assert.equal(first.attempted, true);
  assert.deepEqual(first.training, {
    gain: 5,
    technique: null,
    levelId: null,
    failedLevelId: null,
    stripe: null,
    currentLevelId: 'white',
    injuredMonths: null,
    skill: 5,
  });
  assert.equal(first.peopleById.p_player.skills.bjj.skill, 5);

  const second = attemptActivity(activity, { ...args, peopleById: first.peopleById, usesThisPeriod: 1 });
  assert.equal(second.training.technique, 'a');
  assert.equal(second.peopleById.p_player.skills.bjj.sessions, 2);

  assert.equal(attemptActivity(activity, { ...args, usesThisPeriod: 2 }).reason, 'limit');
});

test('listActivities shows the level, skill, techniques and sessions left of a skill', () => {
  const activitiesById = indexActivities([{ id: 'bjj', category: 'physical', conditions: { minAge: 4 }, training: TRAINING }]);
  const player = { ...person(), skills: { bjj: { ...newSkillEntry(0), skill: 25, sessions: 4, level: 1 } } };
  const [group] = listActivities(activitiesById, { player, country: COUNTRY, currentMonthIndex: 16 * 12, usesById: { bjj: 1 } });
  assert.deepEqual(group.activities[0], { id: 'bjj', blocker: null, usesLeft: 1, skill: 25, levelId: 'blue', stripes: 0, techniques: ['a', 'b'] });

  const beginner = listActivities(activitiesById, { player: person(), country: COUNTRY, currentMonthIndex: 16 * 12 });
  assert.deepEqual(beginner[0].activities[0], { id: 'bjj', blocker: null, usesLeft: 2, skill: 0, levelId: 'white', stripes: 0, techniques: [] });
});

test('trainable activities in data have levels and techniques with pt-BR texts', () => {
  const trainable = Object.values(loadActivities(ACTIVITIES_DIR)).filter((a) => a.training);
  assert.ok(trainable.some((a) => a.id === 'bjj'));
  for (const { id, training } of trainable) {
    assert.ok(training.levels.length > 0, id);
    assert.equal(training.levels[0].minSkill, undefined, `${id}: the first level is where everyone starts`);
    let lastSkill = 0;
    for (const level of training.levels) {
      assert.ok(LOCALE[`level.${id}.${level.id}`], `level.${id}.${level.id}`);
      assert.ok((level.minSkill ?? 0) >= lastSkill, `${id}.${level.id}: levels go up in skill`);
      lastSkill = level.minSkill ?? 0;
    }
    for (const technique of training.techniques) assert.ok(LOCALE[`technique.${id}.${technique}`], `technique.${id}.${technique}`);
  }
  for (const key of ['diary.training', 'diary.training_technique', 'diary.training_max', 'diary.exam_failed', 'diary.stripe', 'diary.injury', 'ui.activity_injured', 'ui.training_stripes.other', 'diary.level_up', 'ui.training_uses_left.other', 'ui.training_techniques']) {
    assert.ok(LOCALE[key], key);
  }
});

const EXAM_TRAINING = {
  ...TRAINING,
  stripes: 4,
  exam: { chance: 0.6, skillWeight: 0.03, retryMonths: 6 },
  injury: { chance: 0.03, health: -6, months: [3, 10] },
};

test('examChance grows with skill above the minimum, between 5% and 95%', () => {
  const exam = EXAM_TRAINING.exam;
  assert.equal(examChance(exam, 20, 20), 0.6);
  assert.ok(Math.abs(examChance(exam, 30, 20) - 0.9) < 1e-9);
  assert.equal(examChance(exam, 80, 20), 0.95);
  assert.equal(examChance({ ...exam, chance: 0 }, 0, 20), 0.05);
});

test('passing the exam promotes and resets the stripes', () => {
  const entry = { ...newSkillEntry(0), skill: 18, peak: 18, stripes: 4 };
  const result = trainSkill(EXAM_TRAINING, entry, { person: person(), monthIndex: 16 * 12, rng: rolls(true) });
  assert.equal(result.levelId, 'blue');
  assert.equal(result.failedLevelId, null);
  assert.equal(result.entry.stripes, 0);
});

test('failing the exam keeps the level and waits retryMonths before the next try', () => {
  const at16 = 16 * 12;
  const entry = { ...newSkillEntry(0), skill: 18, peak: 18 };
  const failed = trainSkill(EXAM_TRAINING, entry, { person: person(), monthIndex: at16, rng: { ...rolls(false), chance: (p) => p > 0.9 } });
  assert.equal(failed.levelId, null);
  assert.equal(failed.failedLevelId, 'blue');
  assert.equal(failed.entry.level, 0);
  assert.equal(failed.entry.examRetryMonth, at16 + 6);
  assert.equal(nextLevel(EXAM_TRAINING, failed.entry, person(), at16 + 5), null);
  assert.equal(nextLevel(EXAM_TRAINING, failed.entry, person(), at16 + 6).id, 'blue');
});

test('stripesEarned spaces the stripes evenly in skill and in time, none on the last level', () => {
  // white -> blue: 20 points and 12 months; stripe k needs k/5 of both.
  const entry = { ...newSkillEntry(0), skill: 8 };
  assert.equal(stripesEarned(EXAM_TRAINING, entry, 12), 2);
  assert.equal(stripesEarned(EXAM_TRAINING, entry, 3), 1); // only a quarter of the time
  assert.equal(stripesEarned(EXAM_TRAINING, { ...entry, skill: 100 }, 100), 4);
  assert.equal(stripesEarned(EXAM_TRAINING, { ...entry, level: 1, skill: 100 }, 100), 0);
  assert.equal(stripesEarned(TRAINING, entry, 12), 0);
});

test('a session gives at most one stripe', () => {
  const entry = { ...newSkillEntry(0), skill: 14, peak: 14, stripes: 0 };
  // Not 16 yet, so no exam: the stripes are all the progress there is.
  const result = trainSkill(EXAM_TRAINING, entry, { person: person(), monthIndex: 15 * 12, rng: rolls(false) });
  assert.equal(result.stripe, 1);
  assert.equal(result.entry.stripes, 1);
});

test('an injury takes health and blocks physical training until it heals', () => {
  const activity = { id: 'bjj', category: 'physical', conditions: { minAge: 4 }, training: EXAM_TRAINING };
  const player = person();
  const month = 16 * 12;
  const args = { player, peopleById: { p_player: player }, country: COUNTRY, currentMonthIndex: month, usesThisPeriod: 0 };

  const hurt = attemptActivity(activity, { ...args, rng: rolls(true, () => 4) });
  assert.equal(hurt.training.injuredMonths, 4);
  const injured = hurt.peopleById.p_player;
  assert.equal(injured.injuredUntil, month + 4);
  assert.equal(injured.stats.health, 44);
  assert.equal(isInjured(injured, month + 3), true);
  assert.equal(isInjured(injured, month + 4), false);

  const blocked = attemptActivity(activity, { ...args, player: injured, peopleById: { p_player: injured }, currentMonthIndex: month + 3, rng: MID_RNG });
  assert.equal(blocked.reason, 'injured');
  const healed = attemptActivity(activity, { ...args, player: injured, peopleById: { p_player: injured }, currentMonthIndex: month + 4, rng: MID_RNG });
  assert.equal(healed.attempted, true);
});
