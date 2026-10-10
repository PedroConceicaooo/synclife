import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The UI files need a browser to run, so they never execute under node:test;
// at least make sure each one parses (duplicate declarations, typos).
const UI_DIR = fileURLToPath(new URL('../src/ui/', import.meta.url));

test('every UI module parses', () => {
  for (const file of readdirSync(UI_DIR).filter((f) => f.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${UI_DIR}${file}`], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('the service worker parses', () => {
  const sw = fileURLToPath(new URL('../sw.js', import.meta.url));
  const result = spawnSync(process.execPath, ['--check', sw], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
