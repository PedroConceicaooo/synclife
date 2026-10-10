import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomAppearance, inheritAppearance, avatarPhase } from '../src/systems/appearance.js';
import { renderAvatar } from '../src/ui/avatar.js';

function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('same seed gives same appearance', () => {
  assert.deepEqual(randomAppearance(seeded(7), 'F'), randomAppearance(seeded(7), 'F'));
});

test('child skin tone stays within one step of parents average', () => {
  const rng = seeded(42);
  const mom = { ...randomAppearance(rng, 'F'), skinTone: 0 };
  const dad = { ...randomAppearance(rng, 'M'), skinTone: 4 };
  for (let i = 0; i < 50; i++) {
    const kid = inheritAppearance(rng, mom, dad, 'M');
    assert.ok(kid.skinTone >= 1 && kid.skinTone <= 3);
  }
});

test('dyed hair is not inherited', () => {
  const rng = seeded(3);
  const mom = { ...randomAppearance(rng, 'F'), hairColor: 'pink', naturalHairColor: 'black' };
  const dad = { ...randomAppearance(rng, 'M'), hairColor: 'black' };
  for (let i = 0; i < 50; i++) assert.notEqual(inheritAppearance(rng, mom, dad, 'F').hairColor, 'pink');
});

test('avatar phase by age', () => {
  assert.equal(avatarPhase(0), 'baby');
  assert.equal(avatarPhase(7), 'child');
  assert.equal(avatarPhase(15), 'teen');
  assert.equal(avatarPhase(30), 'adult');
});

test('renderAvatar returns svg for every sex and phase', () => {
  const rng = seeded(1);
  for (const sex of ['M', 'F']) for (const phase of ['baby', 'child', 'teen', 'adult']) {
    const svg = renderAvatar(randomAppearance(rng, sex), sex, phase);
    assert.match(svg, /^<svg/);
    assert.ok(!svg.includes('fill="H"'));
  }
});
