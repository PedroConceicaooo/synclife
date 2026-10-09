// Countries inherit from a default country and only declare what differs (rule 10).
// The engine never branches on a specific country id. No fs here — this file
// must stay loadable from a browser; see countriesLoader.js for the Node-only reader.

export function indexCountries(countries) {
  return Object.fromEntries(countries.map((country) => [country.id, country]));
}

export function resolveCountry(id, countriesById) {
  const country = countriesById[id];
  const base = country.inherits ? countriesById[country.inherits] : null;
  return base ? { ...base, ...country } : { ...country };
}
