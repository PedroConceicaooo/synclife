// Node-only: reads data/assets/*.json from disk. Kept out of assets.js so
// that file stays free of `node:fs` and can be imported from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexAssets } from './assets.js';

export function loadAssets(dir) {
  const assets = readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));

  return indexAssets(assets);
}
