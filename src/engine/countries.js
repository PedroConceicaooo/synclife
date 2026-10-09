// Countries inherit from a default country and only declare what differs (rule 10).
// The engine never branches on a specific country id.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadCountries(dir) {
  const countriesById = {};

  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.json')) continue;
    const country = JSON.parse(readFileSync(join(dir, fileName), 'utf8'));
    countriesById[country.id] = country;
  }

  return countriesById;
}

export function resolveCountry(id, countriesById) {
  const country = countriesById[id];
  const base = country.inherits ? countriesById[country.inherits] : null;
  return base ? { ...base, ...country } : { ...country };
}
