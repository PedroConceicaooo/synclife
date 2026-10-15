import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

test('the web app uses relative paths, so it works from a subfolder (GitHub Pages)', () => {
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', ...readdirSync(UI_DIR).filter((f) => f.endsWith('.js') && f !== 'server.js').map((f) => `src/ui/${f}`)];
  const absolute = /(["'`(])\/(src|data|locales|icons|manifest\.webmanifest|sw\.js|index\.html)\b/;
  for (const file of files) {
    const text = readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(text, absolute, file);
  }
});

test('every playable country has a flag, kept by the service worker at install', () => {
  const sw = readFileSync(fileURLToPath(new URL('../sw.js', import.meta.url)), 'utf8');
  const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const path of shell.filter((p) => p !== './')) {
    assert.ok(existsSync(fileURLToPath(new URL(`../${path}`, import.meta.url))), `SHELL lists a missing file: ${path}`);
  }
  const countries = readdirSync(fileURLToPath(new URL('../data/countries/', import.meta.url)))
    .filter((f) => f.endsWith('.json') && f !== 'default.json')
    .map((f) => f.replace('.json', ''));
  assert.ok(countries.length >= 5);
  for (const id of countries) {
    const flag = `src/ui/flags/${id}.svg`;
    assert.ok(existsSync(fileURLToPath(new URL(`../${flag}`, import.meta.url))), `${id}: no flag`);
    assert.ok(shell.includes(flag), `${id}: flag not in the service worker SHELL`);
  }
});
