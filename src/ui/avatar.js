// Avatar drawn from a person's stored appearance (skin, hair, hair style),
// sex and age. Plain SVG built through the DOM: no images to load, works
// offline, the same person always looks the same.

const SVG_NS = 'http://www.w3.org/2000/svg';

const SKIN = ['#f9d9c3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
const HAIR = ['#2b1b10', '#4a2c17', '#7a4a24', '#b9853f', '#e3c16f', '#a0412d'];
const SHIRT = ['#2f6db5', '#3f9b7a', '#c7563d', '#7a5bb5', '#d29a2c', '#4d6a8a'];
const INK = '#1e2940';

function svg(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

// Older saves have people without an appearance: derive a stable one from
// the id so they still get a face.
function appearanceOf(person) {
  if (person.appearance) return person.appearance;
  const n = [...person.id].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) >>> 0;
  return { skin: n % SKIN.length, hair: (n >> 3) % HAIR.length, hairStyle: (n >> 6) % 3 };
}

function stageOf(ageYears) {
  if (ageYears < 3) return 'baby';
  if (ageYears < 12) return 'child';
  if (ageYears < 18) return 'teen';
  return 'adult';
}

// Head size and height per life stage, in a 64 x 64 box.
const HEAD = { baby: { r: 17, cy: 30 }, child: { r: 15, cy: 29 }, teen: { r: 14, cy: 28 }, adult: { r: 13.5, cy: 27 } };

export function avatarElement(person, ageYears, size = 48) {
  const { skin, hair, hairStyle } = appearanceOf(person);
  const stage = stageOf(ageYears);
  const { r, cy } = HEAD[stage];
  const skinColor = SKIN[skin];
  const hairColor = HAIR[hair];
  const root = svg('svg', { viewBox: '0 0 64 64', width: size, height: size, class: 'avatar', 'aria-hidden': 'true' });

  root.append(svg('circle', { cx: 32, cy: 32, r: 32, class: 'avatar-bg' }));

  const clip = svg('clipPath', { id: `clip-${person.id}` });
  clip.append(svg('circle', { cx: 32, cy: 32, r: 32 }));
  root.append(clip);
  const body = svg('g', { 'clip-path': `url(#clip-${person.id})` });
  root.append(body);

  // Long hair falls behind the shoulders.
  if (stage !== 'baby' && hairStyle === 1) {
    body.append(svg('rect', { x: 32 - r - 2, y: cy - 4, width: (r + 2) * 2, height: r + 16, rx: 8, fill: hairColor }));
  }
  // Curly hair: a cloud behind the head.
  if (stage !== 'baby' && hairStyle === 2) {
    body.append(svg('circle', { cx: 32, cy: cy - 3, r: r + 4, fill: hairColor }));
  }

  body.append(svg('ellipse', { cx: 32, cy: 66, rx: stage === 'baby' ? 18 : 22, ry: 16, fill: SHIRT[(skin + hair + hairStyle) % SHIRT.length] }));
  body.append(svg('rect', { x: 28, y: cy + r - 4, width: 8, height: 8, fill: skinColor }));
  body.append(svg('circle', { cx: 32, cy, r, fill: skinColor }));

  if (stage === 'baby') {
    // A single curl on top.
    body.append(svg('path', { d: `M30 ${cy - r + 1} q4 -6 6 0`, stroke: hairColor, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }));
    for (const x of [24, 40]) body.append(svg('circle', { cx: x, cy: cy + 5, r: 2.6, fill: '#f29a9a', opacity: 0.55 }));
  } else {
    // Hair cap over the top of the head; style 0 is short.
    const top = cy - r - 1;
    body.append(
      svg('path', {
        d: `M${32 - r - 1} ${cy - 1} Q${32 - r} ${top} 32 ${top} Q${32 + r} ${top} ${32 + r + 1} ${cy - 1} Q${32 + r / 2} ${cy - r / 2.2} 32 ${cy - r / 2.6} Q${32 - r / 2} ${cy - r / 2.2} ${32 - r - 1} ${cy - 1} Z`,
        fill: hairColor,
      }),
    );
  }

  const eyeY = cy + (stage === 'baby' ? 1 : 0);
  for (const x of [32 - r * 0.38, 32 + r * 0.38]) body.append(svg('circle', { cx: x, cy: eyeY, r: stage === 'baby' ? 1.9 : 1.6, fill: INK }));
  const mouthY = cy + r * 0.42;
  body.append(
    svg('path', { d: `M${32 - r * 0.28} ${mouthY} Q32 ${mouthY + r * 0.22} ${32 + r * 0.28} ${mouthY}`, stroke: INK, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }),
  );

  // Adults past 50 go grey at the temples.
  if (stage === 'adult' && ageYears >= 50) {
    for (const x of [32 - r + 1, 32 + r - 5]) body.append(svg('rect', { x, y: cy - 4, width: 4, height: 6, rx: 2, fill: '#c9ccd3' }));
  }

  return root;
}
