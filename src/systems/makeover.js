// Makeovers (docs/atividades.md 2): services that change how the person
// looks on their avatar — the barber and the hairdresser change the cut,
// the hairdresser the color too (dyes included), shaving the beard. The
// activity's data says what may change:
//   "makeover": { "hairStyle": true, "hairColors": [...], "beard": true,
//                 "glasses": ["round", "square", "none"], "earrings": [...] }
// appearance.glasses is the frame worn, or null ("none": contact lenses);
// appearance.earrings the earrings of a pierced ear, or null.
// The player picks; the engine only checks the pick against the data and
// the person's sex, and applies it. A dyed color keeps the natural one in
// naturalHairColor, so children still inherit the real color.

import { HAIR_STYLE_IDS } from './appearance.js';
import { normalizeAppearance } from './appearanceCompat.js';

const sexOf = (person) => (person.sex === 'F' ? 'F' : 'M');

// What the player may pick here: { hairStyles, hairColors, beard, glasses, earrings }.
export function makeoverOptions(activity, person) {
  const rules = activity.makeover ?? {};
  return {
    hairStyles: rules.hairStyle ? HAIR_STYLE_IDS[sexOf(person)] : [],
    hairColors: rules.hairColors ?? [],
    beard: Boolean(rules.beard),
    glasses: rules.glasses ?? [],
    earrings: rules.earrings ?? [],
  };
}

// The look the person has now, as a choice (a plain trim keeps it).
export function currentChoice(person) {
  const appearance = normalizeAppearance(person);
  return {
    hairStyle: appearance.hairStyle,
    hairColor: appearance.hairColor,
    beard: appearance.beard,
    glasses: appearance.glasses ?? 'none',
    earrings: appearance.earrings ?? null,
  };
}

// Whether a choice only uses what this service offers (anything left out
// stays as it is).
export function isValidChoice(activity, person, choice = {}) {
  const options = makeoverOptions(activity, person);
  if (choice.hairStyle !== undefined && !options.hairStyles.includes(choice.hairStyle)) return false;
  if (choice.hairColor !== undefined && !options.hairColors.includes(choice.hairColor)) return false;
  if (choice.beard !== undefined && (!options.beard || typeof choice.beard !== 'boolean')) return false;
  if (choice.glasses !== undefined && !options.glasses.includes(choice.glasses)) return false;
  if (choice.earrings !== undefined && !options.earrings.includes(choice.earrings)) return false;
  return true;
}

// The person with the new look. Call isValidChoice first.
export function applyMakeover(person, choice = {}) {
  const appearance = normalizeAppearance(person);
  const natural = appearance.naturalHairColor ?? appearance.hairColor;
  const next = { ...appearance };
  if (choice.hairStyle !== undefined) next.hairStyle = choice.hairStyle;
  if (choice.hairColor !== undefined) {
    next.hairColor = choice.hairColor;
    next.naturalHairColor = choice.hairColor === natural ? null : natural;
  }
  if (choice.beard !== undefined) next.beard = choice.beard;
  if (choice.glasses !== undefined) next.glasses = choice.glasses === 'none' ? null : choice.glasses;
  if (choice.earrings !== undefined) next.earrings = choice.earrings;
  return { ...person, appearance: next };
}
