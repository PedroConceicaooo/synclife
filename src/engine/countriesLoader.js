// Node-only: reads data/countries/*.json from disk. Kept out of countries.js
// so that file stays free of `node:fs` and can be imported from a browser.

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { indexCountries } from './countries.js';

export function loadCountries(dir) {
  const countries = readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(join(dir, fileName), 'utf8')))
    // `names` is a path relative to data/ (design doc), loaded alongside.
    .map((country) =>
      country.names ? { ...country, nameList: JSON.parse(readFileSync(join(dirname(dir), country.names), 'utf8')) } : country,
    );

  return indexCountries(countries);
}
