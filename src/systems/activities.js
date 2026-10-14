// No fs here — this file must stay loadable from a browser; see
// activitiesLoader.js for the Node-only reader.
//
// Activities are things the player does alone (design doc: "Atividades"):
// odd jobs that earn money, leisure that spends it, and petty crimes that
// can go wrong. Each one can be done once per period, and may trigger a
// small event by chance. Activities with a `training` block are skills
// (training.js): two sessions per period, each one raising the skill.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { addMoney, resolveAmount } from './money.js';
import { resolveChance } from './interactions.js';
import { trainSkill, techniquesLearned, isInjured } from './training.js';

export function indexActivities(activities) {
  return Object.fromEntries(activities.map((activity) => [activity.id, activity]));
}

// Display order of the Activities screen.
export const ACTIVITY_CATEGORIES = ['odd_jobs', 'physical', 'leisure', 'crime'];

export const ACTIVITY_USES_PER_PERIOD = 1;
export const TRAINING_USES_PER_PERIOD = 2;

export function usesPerPeriod(activity) {
  return activity.usesPerPeriod ?? (activity.training ? TRAINING_USES_PER_PERIOD : ACTIVITY_USES_PER_PERIOD);
}

function cost(activity, country) {
  return activity.cost ? resolveAmount(activity.cost, country) : 0;
}

// Why an activity can't be done right now, or null if it can.
export function activityBlocker(activity, { player, country, currentMonthIndex, usesThisPeriod = 0 }) {
  if (!evaluateConditions(activity.conditions, player, { currentMonthIndex, country })) return 'conditions';
  if (activity.training?.aptitude === 'physical' && isInjured(player, currentMonthIndex)) return 'injured';
  if (usesThisPeriod >= usesPerPeriod(activity)) return 'limit';
  if (player.money < cost(activity, country)) return 'money';
  return null;
}

// What the Activities screen shows of a skill: sessions left, bar, level
// and techniques.
function trainingStatus(activity, player, uses) {
  const entry = player.skills?.[activity.id];
  return {
    usesLeft: Math.max(0, usesPerPeriod(activity) - uses),
    skill: entry?.skill ?? 0,
    levelId: activity.training.levels[entry?.level ?? 0].id,
    stripes: entry?.stripes ?? 0,
    techniques: techniquesLearned(activity.training, entry),
  };
}

// Activities the player is old enough for, grouped by category in display
// order. Ones blocked only by the limit or by money stay listed (with their
// blocker) so the UI can show them disabled instead of making them vanish.
export function listActivities(activitiesById, { player, country, currentMonthIndex, usesById = {} }) {
  const visible = Object.values(activitiesById)
    .map((activity) => ({
      id: activity.id,
      category: activity.category,
      minAge: activity.conditions.minAge,
      blocker: activityBlocker(activity, { player, country, currentMonthIndex, usesThisPeriod: usesById[activity.id] ?? 0 }),
      ...(activity.training ? trainingStatus(activity, player, usesById[activity.id] ?? 0) : {}),
    }))
    .filter((a) => a.blocker !== 'conditions')
    .sort((a, b) => a.minAge - b.minAge || a.id.localeCompare(b.id));

  return ACTIVITY_CATEGORIES.map((category) => ({
    category,
    activities: visible.filter((a) => a.category === category).map(({ category: _category, minAge: _minAge, ...item }) => item),
  })).filter((group) => group.activities.length > 0);
}

// rng is only needed for activities with randomEvents, a check or
// training. Returns the ids of the events triggered; the caller fires them
// (they may need a decision).
export function attemptActivity(
  activity,
  { player, peopleById, relationshipsById = {}, country, currentMonthIndex, rng, usesThisPeriod = 0 },
) {
  const blocker = activityBlocker(activity, { player: peopleById[player.id], country, currentMonthIndex, usesThisPeriod });
  if (blocker) return { attempted: false, reason: blocker, peopleById, relationshipsById, triggeredEvents: [] };

  // Risky activities (crimes) roll a check: earnings and success effects
  // only when it works; randomEvents can follow "success" or "failure".
  const succeeded = activity.check ? rng.chance(resolveChance(activity.check, { player: peopleById[player.id] })) : true;

  let people = addMoney(peopleById, player.id, -cost(activity, country));
  if (activity.earnings && succeeded) people = addMoney(people, player.id, resolveAmount(activity.earnings, country));

  const effects = activity.check ? (succeeded ? activity.success : activity.failure) ?? [] : activity.effects ?? [];
  const result = applyEffects(effects, {
    relationship: null,
    relationshipsById,
    peopleById: people,
    playerId: player.id,
    country,
    rng,
    currentMonthIndex,
  });

  let peopleAfter = result.peopleById;
  let training = null;
  if (activity.training) {
    const person = peopleAfter[player.id];
    training = trainSkill(activity.training, person.skills?.[activity.id], { person, monthIndex: currentMonthIndex, rng });
    peopleAfter = { ...peopleAfter, [player.id]: { ...person, skills: { ...person.skills, [activity.id]: training.entry } } };
    if (training.injuredMonths) {
      const injured = { ...peopleAfter[player.id], injuredUntil: currentMonthIndex + training.injuredMonths };
      const effect = { op: 'stat', target: 'player', stat: 'health', delta: activity.training.injury.health };
      peopleAfter = applyEffects([effect], {
        relationship: null,
        relationshipsById: result.relationshipsById,
        peopleById: { ...peopleAfter, [player.id]: injured },
        playerId: player.id,
        country,
        rng,
        currentMonthIndex,
      }).peopleById;
    }
  }

  const outcome = succeeded ? 'success' : 'failure';
  const triggeredEvents = (activity.randomEvents ?? [])
    .filter((r) => (r.on ?? 'any') === 'any' || r.on === outcome)
    .filter((r) => rng.chance(r.chance))
    .map((r) => r.event);

  return {
    attempted: true,
    succeeded,
    peopleById: peopleAfter,
    relationshipsById: result.relationshipsById,
    triggeredEvents,
    training: training && {
      gain: training.gain,
      technique: training.technique,
      levelId: training.levelId,
      failedLevelId: training.failedLevelId,
      stripe: training.stripe,
      currentLevelId: activity.training.levels[training.entry.level].id,
      injuredMonths: training.injuredMonths,
      skill: training.entry.skill,
    },
  };
}
