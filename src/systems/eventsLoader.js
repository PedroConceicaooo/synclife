// Node-only: reads data/events/*.json from disk. Kept out of events.js so
// that file stays free of `node:fs` and can be imported from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { indexEvents } from './events.js';

export function loadEvents(dir) {
  const events = readdirSync(dir)
    .sort()
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')));

  return indexEvents(events);
}
