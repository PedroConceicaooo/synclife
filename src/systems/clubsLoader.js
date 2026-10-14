// Node-only: reads data/clubs/*.json and data/leagues/*.json from disk. Kept
// out of clubs.js so that file stays free of `node:fs` and can be imported
// from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexClubs, indexLeagues } from './clubs.js';

function readAll(dir) {
  return readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));
}

export function loadClubs(dir) {
  return indexClubs(readAll(dir));
}

export function loadLeagues(dir) {
  return indexLeagues(readAll(dir));
}
