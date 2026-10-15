// src/ui/avatar.js — layered SVG avatar renderer for SyncLife.
// Pure function: appearance + sex + phase in, SVG string out. No DOM access.

import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, SHIRT_COLORS } from '../systems/appearance.js';

const PHASE = {
  baby: { rx: 28, ry: 27, eyeR: 4.4, eyeY: 56, cheeks: true, brow: false, body: 0.78 },
  child: { rx: 26.5, ry: 28, eyeR: 3.8, eyeY: 54, cheeks: true, brow: true, body: 0.86 },
  teen: { rx: 25.5, ry: 29, eyeR: 3.3, eyeY: 52, cheeks: false, brow: true, body: 0.94 },
  adult: { rx: 25, ry: 30, eyeR: 3.1, eyeY: 52, cheeks: false, brow: true, body: 1 },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const crop = () => `<path d="M34,50 C33,30 45,20 60,20 C76,20 88,30 86,50 C82,40 76,36 68,37 C60,33 48,35 40,40 C37,43 35,47 34,50Z" fill="H"/>`;
const circles = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="H"/>`).join('');
function arc(cx, cy, R, a0, a1, step) {
  const out = [];
  for (let a = a0; a <= a1; a += step) {
    const t = (a * Math.PI) / 180;
    out.push([+(cx + R * Math.cos(t)).toFixed(1), +(cy + R * Math.sin(t)).toFixed(1)]);
  }
  return out;
}

// Shapes for each id in HAIR_STYLE_IDS. "H" is replaced by the hair gradient;
// elements with class="keep" keep their own color.
const HAIR_SHAPES = {
  M: {
    short: { front: crop },
    buzz: { front: () => `<path d="M35,46 C36,30 47,22 60,22 C73,22 84,30 85,46 C78,38 68,35 60,35 C52,35 42,38 35,46Z" fill="H" opacity=".85"/>` },
    quiff: { front: () => `<path d="M34,50 C32,30 44,16 62,15 C74,14 84,20 87,30 C89,38 87,45 86,50 C82,41 75,37 67,37 C58,34 46,37 40,42 C37,44 35,47 34,50Z" fill="H"/><path d="M48,24 C54,8 76,6 82,20 C72,15 60,16 48,24Z" fill="H"/>` },
    curly: { front: () => crop() + circles(arc(60, 47, 26, 190, 350, 16), 7.5) },
    afro: { back: () => `<circle cx="60" cy="42" r="38" fill="H"/>` + circles(arc(60, 42, 37, 160, 380, 20), 8), front: crop },
  },
  F: {
    long: { back: () => `<path d="M30,50 C28,25 45,16 60,16 C76,16 92,25 90,50 L92,98 C80,102 70,100 66,96 L54,96 C50,100 40,102 28,98Z" fill="H"/>`, front: () => `<path d="M33,52 C31,30 44,19 60,19 C76,19 89,30 87,52 C83,40 74,32 64,31 C56,36 44,40 33,52Z" fill="H"/>` },
    ponytail: { back: () => `<path d="M80,30 C100,34 102,62 92,82 C90,68 86,52 79,44Z" fill="H"/><circle class="keep" cx="82" cy="34" r="3.5" fill="#E2A93B" stroke="#8A5E12" stroke-width="1.2"/>`, front: () => `<path d="M34,50 C33,29 45,19 60,19 C76,19 88,29 86,50 C83,38 74,31 60,31 C47,31 37,38 34,50Z" fill="H"/>` },
    bun: { back: () => `<circle cx="60" cy="17" r="11" fill="H"/>`, front: () => `<path d="M34,50 C33,29 45,20 60,20 C76,20 88,29 86,50 C83,38 74,31 60,31 C47,31 37,38 34,50Z" fill="H"/>` },
    curly_long: { back: () => `<path d="M28,52 C26,26 44,15 60,15 C77,15 95,26 93,52 L94,90 L26,90Z" fill="H"/>` + circles([[28, 90], [26, 76], [26, 62], [28, 48], [34, 34], [44, 24], [56, 19], [68, 19], [80, 24], [88, 34], [93, 48], [94, 62], [94, 76], [92, 90]], 9), front: () => crop() + circles([[38, 40], [46, 32], [56, 28], [66, 28], [76, 32], [84, 40]], 7.5) },
    bob: { back: () => `<path d="M30,48 C28,26 44,17 60,17 C76,17 92,26 90,48 L90,74 C84,78 76,78 72,74 L48,74 C44,78 36,78 30,74Z" fill="H"/>`, front: () => `<path d="M35,46 C35,27 46,20 60,20 C74,20 85,27 85,46 C76,41 44,41 35,46Z" fill="H"/>` },
  },
};

let counter = 0;

/**
 * @param {{skinTone:number, hairStyle:string, hairColor:string, eyeColor:string, shirtColor:number, beard?:boolean}} appearance
 * @param {'M'|'F'} sex
 * @param {'baby'|'child'|'teen'|'adult'} phase
 * @param {{background?:string, background2?:string}} [opts]
 * @returns {string} SVG markup
 */
export function renderAvatar(appearance, sex, phase, opts = {}) {
  const p = PHASE[phase] ?? PHASE.adult;
  const id = 'av' + (++counter);
  const skin = SKIN_TONES[appearance.skinTone] ?? SKIN_TONES[2];
  const hair = HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS.brown;
  const eye = EYE_COLORS[appearance.eyeColor] ?? EYE_COLORS.brown;
  const styles = HAIR_SHAPES[sex] ?? HAIR_SHAPES.M;
  const style = styles[appearance.hairStyle] ?? Object.values(styles)[0];
  const baby = phase === 'baby';
  const hl = shade(hair, -0.45), sl = shade(skin, -0.42);
  const ol = (c) => `stroke="${c}" stroke-width="1.6" stroke-linejoin="round"`;
  const paintHair = (svg) => svg.replace(/<(path|circle)(?![^>]*class="keep")([^>]*?)fill="H"/g, `<$1$2fill="url(#h${id})" ${ol(hl)}`);

  const back = !baby && style.back ? paintHair(style.back()) : '';
  const front = paintHair(baby ? `<path d="M54,26 C55,14 68,14 66,25 C63,20 59,21 54,26Z" fill="H"/>` : style.front());
  const shine = baby ? '' : `<path d="M44,30 C50,24 58,22 66,23" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`;

  const shirt = baby ? '#F4F0E6' : SHIRT_COLORS[appearance.shirtColor] ?? SHIRT_COLORS[0];
  const so = shade(shirt, -0.45);
  const collar = baby
    ? `<path d="M46,89 Q60,101 74,89" fill="#fff" stroke="#9DB7C9" stroke-width="3"/>`
    : sex === 'M'
      ? `<path d="M48,89 L55,99 L60,92 L65,99 L72,89" fill="${shade(shirt, 0.18)}" ${ol(so)}/>`
      : `<path d="M49,89 Q60,100 71,89" fill="${shade(skin, -0.05)}" ${ol(so)}/>`;
  const body = `<g transform="translate(60 120) scale(${p.body}) translate(-60 -120)"><path d="M16,124 C18,97 37,88 60,88 C83,88 102,97 104,124Z" fill="url(#b${id})" ${ol(so)}/>${collar}</g>`;
  const neckTop = baby ? 72 : 70;
  const neck = `<path d="M52,${neckTop} L52,90 Q60,95 68,90 L68,${neckTop}Z" fill="${shade(skin, -0.12)}" ${ol(sl)}/>`;

  const ears = [-1, 1].map((d) => {
    const x = 60 + d * (p.rx - 1);
    return `<ellipse cx="${x}" cy="56" rx="5" ry="6.5" fill="url(#s${id})" ${ol(sl)}/><path d="M${x - d},53 q${d * 2},3 0,6" fill="none" stroke="${sl}" stroke-width="1.2" stroke-linecap="round"/>`;
  }).join('');
  const head = `${ears}<ellipse cx="60" cy="52" rx="${p.rx}" ry="${p.ry}" fill="url(#s${id})" ${ol(sl)}/>`;

  const ew = p.eyeR * 1.55, eh = p.eyeR * 1.75;
  const fem = sex === 'F' && !baby;
  const eyes = [-10, 10].map((dx) => {
    const x = 60 + dx, y = p.eyeY, ix = x + (dx > 0 ? -0.6 : 0.6);
    return `<ellipse cx="${x}" cy="${y}" rx="${ew}" ry="${eh}" fill="#fff" stroke="#3A2A24" stroke-width="1.1"/>
      <circle cx="${ix}" cy="${y + 0.5}" r="${p.eyeR * 1.05}" fill="${eye}"/>
      <circle cx="${ix}" cy="${y + 0.5}" r="${p.eyeR * 0.5}" fill="#141414"/>
      <circle cx="${ix + p.eyeR * 0.4}" cy="${y - p.eyeR * 0.35}" r="${p.eyeR * 0.33}" fill="#fff"/>
      <path d="M${x - ew - 0.4},${y - 0.5} Q${x},${y - eh - 1.8} ${x + ew + 0.4},${y - 0.5}" fill="none" stroke="#2A1D18" stroke-width="${fem ? 2.3 : 1.6}" stroke-linecap="round"/>
      ${fem ? `<path d="M${x + (dx > 0 ? ew : -ew)},${y - 1} l${dx > 0 ? 2.4 : -2.4},-2" stroke="#2A1D18" stroke-width="1.6" stroke-linecap="round"/>` : ''}`;
  }).join('');

  // Glasses (ótica): a frame per eye, a bridge, the temples to the ears.
  const lens = Math.max(ew, eh) + 2.6;
  const frame = '#2B2B33';
  const glassesSvg =
    !baby && appearance.glasses
      ? [-10, 10]
          .map((dx) => {
            const x = 60 + dx, y = p.eyeY;
            const shape =
              appearance.glasses === 'square'
                ? `<rect x="${x - lens}" y="${y - lens * 0.85}" width="${lens * 2}" height="${lens * 1.7}" rx="2.5"`
                : `<circle cx="${x}" cy="${y}" r="${lens}"`;
            return `${shape} fill="#fff" fill-opacity=".18" stroke="${frame}" stroke-width="1.7"/>`;
          })
          .join('') +
        `<path d="M${50 + lens},${p.eyeY - 1} Q60,${p.eyeY - 3.5} ${70 - lens},${p.eyeY - 1}" fill="none" stroke="${frame}" stroke-width="1.6"/>` +
        `<path d="M${50 - lens},${p.eyeY - 1} L${60 - p.rx + 1},${p.eyeY - 2} M${70 + lens},${p.eyeY - 1} L${60 + p.rx - 1},${p.eyeY - 2}" stroke="${frame}" stroke-width="1.5"/>`
      : '';

  const browColor = shade(appearance.hairColor === 'gray' ? '#8A8A8A' : hair, -0.25);
  const brows = p.brow ? [-10, 10].map((dx) => `<path d="M${60 + dx - 6},${p.eyeY - eh - 3.2} Q${60 + dx},${p.eyeY - eh - 6} ${60 + dx + 6},${p.eyeY - eh - 3.6}" fill="none" stroke="${browColor}" stroke-width="${sex === 'M' && phase !== 'child' ? 3 : 2.1}" stroke-linecap="round"/>`).join('') : '';

  const ny = p.eyeY + 9;
  const nose = `<path d="M57.5,${ny} Q60,${ny + 3.2} 62.5,${ny}" fill="none" stroke="${sl}" stroke-width="1.5" stroke-linecap="round"/>`;
  const beard = sex === 'M' && phase === 'adult' && appearance.beard;
  const my = p.eyeY + (beard ? 17 : 16);
  const lip = sex === 'F' && (phase === 'adult' || phase === 'teen');
  const mouth = baby
    ? `<path d="M55,${my} Q60,${my + 6} 65,${my} Z" fill="#B5525A" stroke="#6E2A31" stroke-width="1.1" stroke-linejoin="round"/>`
    : `<path d="M52,${my} Q60,${my + 9} 68,${my} Z" fill="#7E2633" stroke="#5A1A24" stroke-width="1.2" stroke-linejoin="round"/>
       <path d="M53.5,${my + 0.3} L66.5,${my + 0.3} Q60,${my + 3} 53.5,${my + 0.3}Z" fill="#fff"/>
       ${lip ? `<path d="M52,${my} Q60,${my + 9} 68,${my}" fill="none" stroke="#C04A63" stroke-width="1.8"/>` : ''}`;
  const cheekOp = lip ? 0.22 : 0.45;
  const cheeks = (p.cheeks || lip) ? `<ellipse cx="45" cy="${p.eyeY + 9}" rx="4.6" ry="3" fill="#F07C7C" opacity="${cheekOp}"/><ellipse cx="75" cy="${p.eyeY + 9}" rx="4.6" ry="3" fill="#F07C7C" opacity="${cheekOp}"/>` : '';
  const beardSvg = beard ? paintHair(`<path d="M35,56 C36,79 46,91 60,91 C74,91 84,79 85,56 C82,68 74,75 60,75 C46,75 38,68 35,56Z" fill="H"/><path d="M49,${my - 3} Q60,${my - 8} 71,${my - 3} Q60,${my} 49,${my - 3}Z" fill="H"/>`) : '';

  const bg1 = opts.background ?? '#D7EAE4', bg2 = opts.background2 ?? '#B9D6CD';
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
<defs>
<clipPath id="c${id}"><circle cx="60" cy="60" r="58"/></clipPath>
<radialGradient id="s${id}" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${shade(skin, 0.12)}"/><stop offset=".6" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.1)}"/></radialGradient>
<linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hair, 0.22)}"/><stop offset="1" stop-color="${shade(hair, -0.12)}"/></linearGradient>
<linearGradient id="b${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(shirt, 0.12)}"/><stop offset="1" stop-color="${shade(shirt, -0.15)}"/></linearGradient>
<radialGradient id="g${id}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>
</defs>
<circle cx="60" cy="60" r="58" fill="url(#g${id})"/>
<g clip-path="url(#c${id})">${back}${body}${neck}${head}${cheeks}${eyes}${brows}${glassesSvg}${nose}${beardSvg}${mouth}${front}${shine}</g>
</svg>`;
}

/** Small ♂/♀ icon. Colors come from CSS variables --male and --female. */
export function renderSexIcon(sex) {
  return sex === 'M'
    ? `<svg class="sex-icon" viewBox="0 0 24 24" role="img" aria-label="Masculino"><circle cx="10" cy="14" r="6" fill="none" stroke="var(--male, #2E6FB7)" stroke-width="2.6"/><path d="M14.5 9.5 L20 4 M14 4 H20 V10" fill="none" stroke="var(--male, #2E6FB7)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg class="sex-icon" viewBox="0 0 24 24" role="img" aria-label="Feminino"><circle cx="12" cy="9" r="6" fill="none" stroke="var(--female, #C2477A)" stroke-width="2.6"/><path d="M12 15 V22 M8.5 19 H15.5" fill="none" stroke="var(--female, #C2477A)" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}
