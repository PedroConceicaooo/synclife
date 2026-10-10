import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { SKIN_TONES, HAIR_STYLE_IDS, NATURAL_HAIR } from '../src/systems/appearance.js';
import { normalizeAppearance, rollAppearance, inheritFrom } from '../src/systems/appearanceCompat.js';
import { renderAvatar, renderSexIcon } from '../src/ui/avatar.js';

test('the old { skin, hair, hairStyle } shape becomes the current one', () => {
  const old = { id: 'p_0002', sex: 'F', appearance: { skin: 3, hair: 1, hairStyle: 2 } };
  const now = normalizeAppearance(old);
  assert.equal(now.skinTone, 3);
  assert.equal(now.hairColor, NATURAL_HAIR[1]);
  assert.equal(now.hairStyle, HAIR_STYLE_IDS.F[2]);
  assert.ok(renderAvatar(now, 'F', 'adult').startsWith('<svg'));
});

test('people without an appearance get a stable one from their id', () => {
  const a = normalizeAppearance({ id: 'p_0042', sex: 'M', appearance: null });
  assert.deepEqual(a, normalizeAppearance({ id: 'p_0042', sex: 'M' }));
  assert.ok(a.skinTone >= 0 && a.skinTone < SKIN_TONES.length);
  assert.ok(HAIR_STYLE_IDS.M.includes(a.hairStyle));
});

test('current appearances pass through untouched', () => {
  const appearance = rollAppearance(createRng(1), 'M');
  assert.equal(normalizeAppearance({ id: 'p_1', sex: 'M', appearance }), appearance);
});

test('a baby of parents saved with the old shape is born with a valid appearance', () => {
  const mother = { id: 'p_0002', sex: 'F', appearance: { skin: 0, hair: 4, hairStyle: 0 } };
  const father = { id: 'p_0003', sex: 'M', appearance: { skin: 4, hair: 0, hairStyle: 1 } };
  for (let seed = 1; seed <= 20; seed++) {
    const baby = inheritFrom(createRng(seed), mother, father, seed % 2 ? 'F' : 'M');
    assert.ok(Number.isInteger(baby.skinTone) && baby.skinTone >= 1 && baby.skinTone <= 3, `seed ${seed}`);
    assert.ok(NATURAL_HAIR.includes(baby.hairColor), `seed ${seed}`);
  }
});

test('the same seed gives the same appearance through the game rng', () => {
  assert.deepEqual(rollAppearance(createRng(9), 'F'), rollAppearance(createRng(9), 'F'));
});

test('renderSexIcon draws a labelled icon for each sex, coloured by the CSS variables', () => {
  assert.match(renderSexIcon('M'), /aria-label="Masculino"/);
  assert.match(renderSexIcon('M'), /var\(--male/);
  assert.match(renderSexIcon('F'), /aria-label="Feminino"/);
  assert.match(renderSexIcon('F'), /var\(--female/);
});
