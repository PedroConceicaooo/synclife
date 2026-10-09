// Childhood stat growth per period. Pure and rng-free: randomness already
// lives in the rolled aptitudes and in events, so growth only follows them.

import { clamp } from './relationship.js';

const CHILDHOOD_END_MONTHS = 18 * 12;

// Intelligence gained per month: aptitude 0 adds ~26 over a childhood,
// aptitude 1 adds ~65.
const INTELLIGENCE_BASE_PER_MONTH = 0.12;
const INTELLIGENCE_APTITUDE_PER_MONTH = 0.18;

// Health and happiness drift toward a target instead of growing forever:
// each month closes this fraction of the remaining gap.
const HEALTH_PULL_PER_MONTH = 0.03;
const HAPPINESS_PULL_PER_MONTH = 0.05;
const HEALTH_TARGET_BASE = 50;
const HEALTH_TARGET_APTITUDE = 40;

function pull(value, target, ratePerMonth, months) {
  return (target - value) * (1 - (1 - ratePerMonth) ** months);
}

const roundTenth = (value) => Math.round(value * 10) / 10;

// familyAffinity: how much the parents like the player on average (0..100),
// or null when there is no one to pull happiness toward.
export function growStats(person, { months, ageMonths, familyAffinity = null }) {
  const stats = { ...person.stats };
  const deltas = {};

  function change(stat, delta) {
    const next = roundTenth(clamp(stats[stat] + delta, 0, 100));
    if (next !== stats[stat]) deltas[stat] = roundTenth(next - stats[stat]);
    stats[stat] = next;
  }

  if (person.aptitudes) {
    const childhoodMonths = Math.max(0, Math.min(months, CHILDHOOD_END_MONTHS - ageMonths));
    const perMonth = INTELLIGENCE_BASE_PER_MONTH + INTELLIGENCE_APTITUDE_PER_MONTH * person.aptitudes.cognitive;
    change('intelligence', perMonth * childhoodMonths);

    const healthTarget = HEALTH_TARGET_BASE + HEALTH_TARGET_APTITUDE * person.aptitudes.physical;
    change('health', pull(stats.health, healthTarget, HEALTH_PULL_PER_MONTH, months));
  }

  if (familyAffinity !== null) {
    change('happiness', pull(stats.happiness, familyAffinity, HAPPINESS_PULL_PER_MONTH, months));
  }

  return { person: { ...person, stats }, deltas };
}
