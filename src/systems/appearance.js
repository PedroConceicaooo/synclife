// src/systems/appearance.js — random appearance and inheritance.
// Engine side: no DOM. Uses the seeded rng (a function returning a number in [0, 1)); never Math.random().
// Colors live here so the engine and the UI share one source of truth.

export const SKIN_TONES = ['#F6D7C3', '#EEC1A0', '#D9A27C', '#B97D57', '#8D5A3B', '#5E3B26'];
export const HAIR_COLORS = {
  black: '#1E1A1A', dark_brown: '#3B2A20', brown: '#6B4429', blonde: '#D9B25F',
  red: '#B3471F', gray: '#A9A9A9', blue: '#3D5BC9', pink: '#E06AA3',
};
export const NATURAL_HAIR = ['black', 'dark_brown', 'brown', 'blonde', 'red'];
export const EYE_COLORS = {
  black: '#1B1B1B', brown: '#5A3A22', hazel: '#A7742B', green: '#4C7A3D', gray: '#7C8A93', blue: '#3E77B8',
};
// Darkest first: used by inheritance (darker tends to win).
export const EYE_ORDER = ['black', 'brown', 'hazel', 'green', 'gray', 'blue'];
export const SHIRT_COLORS = ['#2F6F8F', '#E2A93B', '#7A5BA8', '#3E8E5E', '#C9503E', '#3A3F4A'];
export const HAIR_STYLE_IDS = {
  M: ['short', 'buzz', 'quiff', 'curly', 'afro'],
  F: ['long', 'ponytail', 'bun', 'curly_long', 'bob'],
};

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function randomAppearance(rng, sex) {
  return {
    skinTone: Math.floor(rng() * SKIN_TONES.length),
    hairStyle: pick(rng, HAIR_STYLE_IDS[sex]),
    hairColor: pick(rng, NATURAL_HAIR),
    naturalHairColor: null,
    eyeColor: pick(rng, EYE_ORDER),
    shirtColor: Math.floor(rng() * SHIRT_COLORS.length),
    beard: sex === 'M' && rng() < 0.4,
  };
}

/** Natural color: dyed hair (salon) is not inherited. */
const natural = (a) => a.naturalHairColor ?? a.hairColor;

export function inheritAppearance(rng, mother, father, sex) {
  const skinTone = clamp(Math.round((mother.skinTone + father.skinTone) / 2 + pick(rng, [-1, 0, 0, 0, 1])), 0, SKIN_TONES.length - 1);
  const hairColor = rng() < 0.85 ? pick(rng, [natural(mother), natural(father)]) : pick(rng, NATURAL_HAIR);
  const darker = EYE_ORDER.indexOf(mother.eyeColor) <= EYE_ORDER.indexOf(father.eyeColor) ? mother.eyeColor : father.eyeColor;
  const eyeColor = rng() < 0.65 ? darker : pick(rng, [mother.eyeColor, father.eyeColor]);
  return {
    skinTone,
    hairStyle: pick(rng, HAIR_STYLE_IDS[sex]),
    hairColor,
    naturalHairColor: null,
    eyeColor,
    shirtColor: Math.floor(rng() * SHIRT_COLORS.length),
    beard: false,
  };
}

/** Maps age in years to the avatar phase. */
export function avatarPhase(ageYears) {
  if (ageYears < 3) return 'baby';
  if (ageYears < 12) return 'child';
  if (ageYears < 18) return 'teen';
  return 'adult';
}
