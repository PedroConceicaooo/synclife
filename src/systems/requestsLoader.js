// Node-only: reads data/requests/*.json from disk. Kept out of requests.js
// so that file stays free of `node:fs` and can be imported from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexRequests } from './requests.js';

export function loadRequests(dir) {
  const requests = readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));
  return indexRequests(requests);
}
