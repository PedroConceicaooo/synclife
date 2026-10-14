// Skill training (docs/atividades.md, "Sistema de habilidade"). Any activity
// with a `training` block is a skill: each session raises a 0..100 bar,
// teaches the next technique every few sessions and can promote the person
// to the next level (belt, cord, level...). Nothing here knows which
// activity it is — jiu-jitsu, gym or dance differ only in their data.
//
// Per-person state lives in person.skills[activityId]:
//   { skill, peak, sessions, lastTrainedMonth, level, levelSince, stripes,
//     examRetryMonth }
// `level` is an index into training.levels; techniques learned are derived
// from `sessions`, so they need no storage of their own. An injury is on
// the person (injuredUntil), since it stops every physical training.

import { ageAt } from '../engine/time.js';

export const BASE_GAIN = 5;
export const SESSIONS_PER_TECHNIQUE = 2;
// Inactivity: after this long without training the skill starts to fade,
// one point per DECAY_EVERY_MONTHS, never below half of the best ever.
export const DECAY_GRACE_MONTHS = 12;
export const DECAY_EVERY_MONTHS = 6;

// Hidden aptitude 0..1 becomes the 0.8..1.2 multiplier of the formula.
export function aptitudeFactor(aptitude = 0.5) {
  return 0.8 + 0.4 * aptitude;
}

// Children learn slower: the gain grows with age and is whole from
// FULL_GAIN_AGE on, so a child who starts at 4 ends near 80% at 16 instead
// of maxing out the bar before 12. Never below MIN_AGE_FACTOR.
export const FULL_GAIN_AGE = 16;
export const MIN_AGE_FACTOR = 0.25;

export function ageFactor(ageYears = FULL_GAIN_AGE) {
  return Math.min(1, Math.max(MIN_AGE_FACTOR, ageYears / FULL_GAIN_AGE));
}

// ganho = 5 × (1 − habilidade / 110) × aptidão × idade × sorte (0,7 a 1,3),
// mínimo 1 — except at 100, where there is nothing left to gain.
export function trainingGain(skill, aptitude, rng, ageYears) {
  const luck = 0.7 + 0.6 * rng.next();
  const gain = Math.max(1, Math.round(BASE_GAIN * (1 - skill / 110) * aptitudeFactor(aptitude) * ageFactor(ageYears) * luck));
  return Math.max(0, Math.min(gain, 100 - skill));
}

export function newSkillEntry(monthIndex) {
  return { skill: 0, peak: 0, sessions: 0, lastTrainedMonth: monthIndex, level: 0, levelSince: monthIndex, stripes: 0, examRetryMonth: null };
}

export function techniquesLearned(training, entry) {
  const techniques = training.techniques ?? [];
  return techniques.slice(0, Math.min(techniques.length, Math.floor((entry?.sessions ?? 0) / SESSIONS_PER_TECHNIQUE)));
}

// The next level when the person meets all of its requirements now:
// minimum skill, months at the current level and age — and, after a failed
// exam, the wait before trying again.
export function nextLevel(training, entry, person, monthIndex) {
  const next = training.levels[entry.level + 1];
  if (!next) return null;
  if (entry.examRetryMonth != null && monthIndex < entry.examRetryMonth) return null;
  if (entry.skill < (next.minSkill ?? 0)) return null;
  if (monthIndex - entry.levelSince < (next.minMonths ?? 0)) return null;
  if (ageAt(person.birth, monthIndex) < (next.minAge ?? 0)) return null;
  return next;
}

// Exam (docs/atividades.md, "Graduação"): the more skill above the
// minimum, the likelier to pass. Never certain either way.
export function examChance(exam, skill, minSkill = 0) {
  return Math.min(0.95, Math.max(0.05, exam.chance + exam.skillWeight * (skill - minSkill)));
}

// Stripes (graus) on the current level, spaced evenly in skill and in time
// between it and the next one: stripe k of n needs k/(n+1) of the way.
// The last level has none.
export function stripesEarned(training, entry, monthIndex) {
  const count = training.stripes ?? 0;
  const current = training.levels[entry.level];
  const next = training.levels[entry.level + 1];
  if (count === 0 || !next) return 0;
  const skillFrom = current.minSkill ?? 0;
  const skillShare = (entry.skill - skillFrom) / Math.max(1, (next.minSkill ?? 0) - skillFrom);
  const timeShare = (monthIndex - entry.levelSince) / Math.max(1, next.minMonths ?? 0);
  return Math.min(count, Math.floor(Math.min(skillShare, timeShare) * (count + 1)));
}

export function isInjured(person, monthIndex) {
  return person.injuredUntil != null && monthIndex < person.injuredUntil;
}

// One session. Returns the new entry plus what to tell the diary: the
// gain, the technique learned, the level reached or the exam failed, the
// stripe earned and the months out with an injury (each null when none).
export function trainSkill(training, entry, { person, monthIndex, rng }) {
  const current = entry ?? newSkillEntry(monthIndex);
  const aptitude = person.aptitudes?.[training.aptitude ?? 'physical'];
  const gain = trainingGain(current.skill, aptitude, rng, ageAt(person.birth, monthIndex));
  const skill = current.skill + gain;
  const sessions = current.sessions + 1;
  const before = techniquesLearned(training, current).length;
  const learned = techniquesLearned(training, { sessions });
  const technique = learned.length > before ? learned[learned.length - 1] : null;

  let updated = { stripes: 0, examRetryMonth: null, ...current, skill, peak: Math.max(current.peak, skill), sessions, lastTrainedMonth: monthIndex };
  let levelId = null;
  let failedLevelId = null;
  const level = nextLevel(training, updated, person, monthIndex);
  if (level && training.exam && !rng.chance(examChance(training.exam, skill, level.minSkill))) {
    failedLevelId = level.id;
    updated = { ...updated, examRetryMonth: monthIndex + training.exam.retryMonths };
  } else if (level) {
    levelId = level.id;
    updated = { ...updated, level: updated.level + 1, levelSince: monthIndex, stripes: 0, examRetryMonth: null };
  }

  // One stripe per session at most, so each one gets its own diary line.
  let stripe = null;
  if (!levelId && stripesEarned(training, updated, monthIndex) > updated.stripes) {
    stripe = updated.stripes + 1;
    updated = { ...updated, stripes: stripe };
  }

  const injury = training.injury;
  const injuredMonths = injury && rng.chance(injury.chance) ? rng.nextInt(...injury.months) : null;

  return { entry: updated, gain, technique, levelId, failedLevelId, stripe, injuredMonths };
}

function decayOwed(idleMonths) {
  return Math.max(0, Math.floor((idleMonths - DECAY_GRACE_MONTHS) / DECAY_EVERY_MONTHS));
}

// Called on every advance with the months before and after it.
export function decaySkill(entry, fromMonth, toMonth) {
  const loss = decayOwed(toMonth - entry.lastTrainedMonth) - decayOwed(fromMonth - entry.lastTrainedMonth);
  if (loss <= 0) return entry;
  const floor = Math.floor(entry.peak / 2);
  return { ...entry, skill: Math.max(Math.min(floor, entry.skill), entry.skill - loss) };
}

export function decayAllSkills(peopleById, fromMonth, toMonth) {
  let changed = false;
  const people = { ...peopleById };
  for (const person of Object.values(peopleById)) {
    if (!person.skills) continue;
    const skills = Object.fromEntries(Object.entries(person.skills).map(([id, entry]) => [id, decaySkill(entry, fromMonth, toMonth)]));
    if (Object.keys(skills).some((id) => skills[id] !== person.skills[id])) {
      people[person.id] = { ...person, skills };
      changed = true;
    }
  }
  return changed ? people : peopleById;
}
