// Countries inherit from a default country and only declare what differs (rule 10).
// The engine never branches on a specific country id. No fs here — this file
// must stay loadable from a browser; see countriesLoader.js for the Node-only reader.

export function indexCountries(countries) {
  return Object.fromEntries(countries.map((country) => [country.id, country]));
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Nested objects merge key by key (a country can override one naming rule
// and keep the rest); arrays and plain values replace.
function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return result;
}

export function resolveCountry(id, countriesById) {
  const country = countriesById[id];
  const base = country.inherits ? countriesById[country.inherits] : null;
  return base ? deepMerge(base, country) : { ...country };
}
