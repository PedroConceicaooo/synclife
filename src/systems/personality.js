// Emotions and personality (design doc: "Status, estado emocional e
// personalidade").
//
// Mood has two layers: a default one from happiness, and a temporary
// emotion (angry, anxious, in love, ashamed) that lasts a few months.
// The player's traits form from childhood choices: each choice adds to a
// tendency, and a tendency that reaches TRAIT_FIX_AT becomes a trait.

export const TEMPORARY_EMOTIONS = ['angry', 'anxious', 'in_love', 'ashamed'];
export const TRAIT_FIX_AT = 3;
export const MAX_TRAITS = 3;

// Traits that cannot live together in one person.
const OPPOSITES = { patient: 'explosive', explosive: 'patient', shy: 'sociable', sociable: 'shy' };

// Design doc table: 80-100 radiant, 60-79 happy, 40-59 neutral, 20-39 sad,
// 0-19 depressed.
export function defaultMood(happiness) {
  if (happiness >= 80) return 'radiant';
  if (happiness >= 60) return 'happy';
  if (happiness >= 40) return 'neutral';
  if (happiness >= 20) return 'sad';
  return 'depressed';
}

export function activeEmotion(person, month) {
  return person.emotion && person.emotion.until > month ? person.emotion.type : null;
}

export function moodOf(person, month) {
  return activeEmotion(person, month) ?? defaultMood(person.stats.happiness);
}

export function setEmotion(person, type, { month, months }) {
  if (!TEMPORARY_EMOTIONS.includes(type)) throw new Error(`Unknown emotion: ${type}`);
  return { ...person, emotion: { type, until: month + months } };
}

// Emotions wear off; everyone goes back to their default mood.
export function expireEmotions(peopleById, month) {
  const next = { ...peopleById };
  for (const person of Object.values(peopleById)) {
    if (person.emotion && person.emotion.until <= month) next[person.id] = { ...person, emotion: null };
  }
  return next;
}

export function addTendency(person, trait, delta) {
  const tendencies = { ...(person.traitTendencies ?? {}) };
  tendencies[trait] = (tendencies[trait] ?? 0) + delta;

  const canFix =
    tendencies[trait] >= TRAIT_FIX_AT &&
    !person.traits.includes(trait) &&
    person.traits.length < MAX_TRAITS &&
    !person.traits.includes(OPPOSITES[trait]);
  if (!canFix) return { ...person, traitTendencies: tendencies };

  delete tendencies[trait];
  if (OPPOSITES[trait]) delete tendencies[OPPOSITES[trait]];
  return { ...person, traits: [...person.traits, trait], traitTendencies: tendencies };
}

// Parents' stress (0-100) drifts back toward a resting level each month.
export const RESTING_STRESS = 30;
const STRESS_PULL_PER_MONTH = 0.08;

export function relaxStress(peopleById, months) {
  const next = { ...peopleById };
  for (const person of Object.values(peopleById)) {
    if (typeof person.stress !== 'number') continue;
    const stress = person.stress + (RESTING_STRESS - person.stress) * (1 - (1 - STRESS_PULL_PER_MONTH) ** months);
    next[person.id] = { ...person, stress: Math.round(stress * 10) / 10 };
  }
  return next;
}
