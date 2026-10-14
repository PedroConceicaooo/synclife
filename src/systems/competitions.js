// Competitions (docs/atividades.md, "Competições"): a trainable activity
// with `competitions` lets an enrolled player sign up once per period. The
// tier is the highest the skill allows; the result comes from
//   performance = skill + aptitude + luck − the tier's opponents
// and gives a place (gold, silver, bronze or out), happiness, prize money
// from the state tier up, and a higher injury risk than training.
//
// Podium places are kept on the person — the trophy shelf:
//   person.achievements = [{ activityId, tier, place, month }]

import { applyEffects } from '../engine/effects.js';
import { addMoney, resolveAmount } from './money.js';
import { isEnrolled } from './enrollment.js';
import { isInjured } from './training.js';

// minSkill to sign up, the level of the opponents and the prize scale for
// first place (second place gets half).
export const COMPETITION_TIERS = [
  { id: 'school', minSkill: 0, opponents: 15, prize: null },
  { id: 'regional', minSkill: 30, opponents: 35, prize: null },
  { id: 'state', minSkill: 50, opponents: 55, prize: 'small' },
  { id: 'national', minSkill: 70, opponents: 72, prize: 'medium' },
  { id: 'international', minSkill: 85, opponents: 87, prize: 'large' },
];

// How far above the opponents each place needs; anything lower is out.
const PLACES = [
  { id: 'gold', margin: 12 },
  { id: 'silver', margin: 4 },
  { id: 'bronze', margin: -4 },
];

const HAPPINESS = { gold: 8, silver: 5, bronze: 3, out: -3 };
export const LUCK_RANGE = 15; // ± points of performance
const APTITUDE_POINTS = 20; // aptitude 0..1 moves performance by ±10
// Competing hurts more than training (docs: "risco de lesão maior").
export const COMPETITION_INJURY_FACTOR = 3;

export function competitionTier(skill) {
  return [...COMPETITION_TIERS].reverse().find((tier) => skill >= tier.minSkill);
}

export function placeFor(performance, opponents) {
  return PLACES.find((place) => performance - opponents >= place.margin)?.id ?? 'out';
}

// Why the player can't compete in this activity now, or null.
export function competitionBlocker(activity, person, monthIndex, competedThisPeriod = false) {
  if (!activity.competitions) return 'none';
  if (!isEnrolled(person, activity.id) || !person.skills?.[activity.id]) return 'none';
  if (activity.training?.aptitude === 'physical' && isInjured(person, monthIndex)) return 'injured';
  if (competedThisPeriod) return 'competed';
  return null;
}

export function prizeFor(tier, place, country) {
  if (!tier.prize || (place !== 'gold' && place !== 'silver')) return 0;
  const full = resolveAmount(tier.prize, country);
  return place === 'gold' ? full : Math.round(full / 2);
}

export function compete(activity, { playerId, peopleById, relationshipsById = {}, country, currentMonthIndex, rng }) {
  const person = peopleById[playerId];
  const skill = person.skills[activity.id].skill;
  const tier = competitionTier(skill);
  const aptitude = person.aptitudes?.[activity.training.aptitude ?? 'physical'] ?? 0.5;
  const luck = (rng.next() * 2 - 1) * LUCK_RANGE;
  const performance = skill + (aptitude - 0.5) * APTITUDE_POINTS + luck;
  const place = placeFor(performance, tier.opponents);
  const prize = prizeFor(tier, place, country);

  let people = prize > 0 ? addMoney(peopleById, playerId, prize) : peopleById;
  if (place !== 'out') {
    const achievement = { activityId: activity.id, tier: tier.id, place, month: currentMonthIndex };
    people = { ...people, [playerId]: { ...people[playerId], achievements: [...(people[playerId].achievements ?? []), achievement] } };
  }

  const effects = [{ op: 'stat', target: 'player', stat: 'happiness', delta: HAPPINESS[place] }];
  const injury = activity.training.injury;
  const injuredMonths = injury && rng.chance(Math.min(1, injury.chance * COMPETITION_INJURY_FACTOR)) ? rng.nextInt(...injury.months) : null;
  if (injuredMonths) {
    people = { ...people, [playerId]: { ...people[playerId], injuredUntil: currentMonthIndex + injuredMonths } };
    effects.push({ op: 'stat', target: 'player', stat: 'health', delta: injury.health });
  }
  people = applyEffects(effects, { relationship: null, relationshipsById, peopleById: people, playerId, country, rng, currentMonthIndex }).peopleById;

  return { tier: tier.id, place, prize, injuredMonths, peopleById: people };
}

// Medal counts per place for one activity (the shelf on the screen).
export function medalCounts(person, activityId) {
  const counts = { gold: 0, silver: 0, bronze: 0 };
  for (const a of person.achievements ?? []) if (a.activityId === activityId) counts[a.place]++;
  return counts;
}
