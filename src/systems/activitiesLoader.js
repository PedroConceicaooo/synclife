// Node-only: reads data/activities/*.json from disk. Kept out of
// activities.js so that file stays free of `node:fs` and can be imported
// from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexActivities } from './activities.js';

export function loadActivities(dir) {
  const activities = readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));

  return indexActivities(activities);
}
