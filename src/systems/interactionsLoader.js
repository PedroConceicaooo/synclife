// Node-only: reads data/interactions/*.json from disk. Kept out of
// interactions.js so that file stays free of `node:fs` and can be imported
// from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexInteractions } from './interactions.js';

export function loadInteractions(dir) {
  const interactions = readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));

  return indexInteractions(interactions);
}
