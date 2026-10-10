// Bridges the appearance module (appearance.js) and the rest of the game:
// the game's rng is an object, appearance.js wants a function; and people
// created before it (saves, lives in progress) have the older shape
// { skin, hair, hairStyle } with numbers. No DOM here: the engine uses it too.

import {
  SKIN_TONES,
  NATURAL_HAIR,
  SHIRT_COLORS,
  HAIR_STYLE_IDS,
  randomAppearance,
  inheritAppearance,
} from './appearance.js';

const asFunction = (rng) => () => rng.next();

export function rollAppearance(rng, sex) {
  return randomAppearance(asFunction(rng), sex);
}

export function inheritFrom(rng, mother, father, sex) {
  return inheritAppearance(asFunction(rng), normalizeAppearance(mother), normalizeAppearance(father), sex);
}

// Stable numbers from an id, for people who never had an appearance.
function hashOf(id) {
  return [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

// Always returns the current shape, whatever the person has stored.
export function normalizeAppearance(person) {
  const sex = person.sex === 'F' ? 'F' : 'M';
  const stored = person.appearance;
  if (stored && 'skinTone' in stored) return stored;

  const old = stored && 'skin' in stored ? stored : null;
  const n = hashOf(person.id ?? 'p');
  const skin = old ? old.skin : n % SKIN_TONES.length;
  const hair = old ? old.hair : (n >> 3) % NATURAL_HAIR.length;
  const style = old ? old.hairStyle : (n >> 6) % HAIR_STYLE_IDS[sex].length;
  return {
    skinTone: skin % SKIN_TONES.length,
    hairStyle: HAIR_STYLE_IDS[sex][style % HAIR_STYLE_IDS[sex].length],
    hairColor: NATURAL_HAIR[hair % NATURAL_HAIR.length],
    naturalHairColor: null,
    eyeColor: 'brown',
    shirtColor: (skin + hair) % SHIRT_COLORS.length,
    beard: false,
  };
}
