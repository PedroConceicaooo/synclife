import { fileURLToPath } from 'node:url';
import { createRng } from './engine/random.js';
import { toMonthIndex, fromMonthIndex, ageAt, advance } from './engine/time.js';
import { createPerson, pickRandomCountry, pickRandomBirthMonth } from './engine/person.js';
import { loadCountries, resolveCountry } from './engine/countries.js';

const START_YEAR = 2000;
const ADULT_AGE = 18;
const COUNTRIES_DIR = fileURLToPath(new URL('../data/countries/', import.meta.url));

function readSeedFromArgs() {
  const arg = process.argv.find((a) => a.startsWith('--seed='));
  return arg ? Number(arg.slice('--seed='.length)) : Date.now();
}

function formatDate(monthIndex) {
  const { year, month } = fromMonthIndex(monthIndex);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function main() {
  const seed = readSeedFromArgs();
  console.log(`Seed: ${seed}`);

  const rng = createRng(seed);

  const countriesById = loadCountries(COUNTRIES_DIR);
  const playableCountryIds = Object.keys(countriesById).filter((id) => id !== 'default');
  const countries = playableCountryIds.map((id) => resolveCountry(id, countriesById));

  const country = pickRandomCountry(rng, countries);
  const birthMonthIndex = toMonthIndex({ year: START_YEAR, month: pickRandomBirthMonth(rng) });
  const sex = rng.chance(0.5) ? 'F' : 'M';

  const person = createPerson({ id: 'p_0001', sex, birth: birthMonthIndex, countryId: country.id });

  console.log(`Born: ${person.id} sex=${person.sex} country=${person.countryId} date=${formatDate(person.birth)}`);

  let currentMonth = person.birth;

  while (ageAt(person.birth, currentMonth) < ADULT_AGE) {
    const step = rng.chance(0.5) ? 6 : 12;
    const { nextMonthIndex, birthdays } = advance(currentMonth, step, person.birth);
    currentMonth = nextMonthIndex;

    for (const birthday of birthdays) {
      console.log(`Turned ${birthday.age} (${formatDate(birthday.monthIndex)})`);
    }
  }

  console.log(
    `Done: ${person.id} age=${ageAt(person.birth, currentMonth)} date=${formatDate(currentMonth)} country=${person.countryId}`,
  );
}

main();
