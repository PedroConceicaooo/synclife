// Puts avatars on the page: people through renderAvatar (avatar.js, a pure
// SVG-string renderer), pets with their own small drawing. Turns the SVG
// markup into an element; the markup is built only from game data, never
// from text the player typed.

import { renderAvatar } from './avatar.js';
import { avatarPhase } from '../systems/appearance.js';
import { normalizeAppearance } from '../systems/appearanceCompat.js';

const INK = '#1e2940';
const COATS = ['#8a5a3b', '#d9a066', '#2f2a28', '#e8e2d6', '#9a9a9a'];
// Background in the game's own palette (light grey-blue).
const BACKGROUND = { background: '#e4eaf2', background2: '#d3dce8' };

// Dogs get floppy ears, cats pointy ones and whiskers.
function petSvg(person) {
  const coat = COATS[(person.appearance?.coat ?? 0) % COATS.length];
  const ears =
    person.species === 'cat'
      ? `<path d="M16 30 L18 12 L30 22 Z M48 30 L46 12 L34 22 Z" fill="${coat}"/>`
      : [15, 49].map((x) => `<ellipse cx="${x}" cy="30" rx="6" ry="12" fill="${coat}" opacity="0.85"/>`).join('');
  const whiskers =
    person.species === 'cat'
      ? [[24, 12], [40, 52]].map(([a, b]) => `<path d="M${a} 41 L${b} 39 M${a} 43 L${b} 44" stroke="${INK}" stroke-width="0.8"/>`).join('')
      : '';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<circle cx="32" cy="32" r="32" fill="${BACKGROUND.background2}"/>${ears}
<circle cx="32" cy="34" r="17" fill="${coat}"/>
<ellipse cx="32" cy="41" rx="8" ry="6" fill="#f3ede4" opacity="0.9"/>
<circle cx="25" cy="31" r="2" fill="${INK}"/><circle cx="39" cy="31" r="2" fill="${INK}"/>
<ellipse cx="32" cy="38.5" rx="3" ry="2.2" fill="${INK}"/>${whiskers}
</svg>`;
}

export function avatarElement(person, ageYears, size = 48) {
  const markup = person.species
    ? petSvg(person)
    : renderAvatar(normalizeAppearance(person), person.sex === 'F' ? 'F' : 'M', avatarPhase(ageYears), BACKGROUND);
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const svg = template.content.firstElementChild;
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('avatar');
  return svg;
}
