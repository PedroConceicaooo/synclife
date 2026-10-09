// Browser-side data loading via fetch — the Node-only *Loader.js files read
// from disk instead. The file list is hardcoded on purpose: M5's data set is
// small and fixed. Revisit with a generated manifest once
// M8+ content makes this list long or frequently changing.

import { indexCountries } from '../engine/countries.js';
import { indexEvents } from '../systems/events.js';
import { indexInteractions } from '../systems/interactions.js';
import { indexActivities } from '../systems/activities.js';

const MANIFEST = {
  countries: ['default.json', 'BR.json', 'US.json', 'JP.json', 'RU.json', 'GB.json'],
  events: [
    'divorce.json',
    'parents_fight.json',
    'parents_make_up.json',
    'choose_who_to_live_with.json',
    'refuse_baby_food.json',
    'fight_bedtime.json',
    'swallow_coin.json',
    'bite_cable.json',
    'first_school_day.json',
    'toy_tantrum.json',
    'vaccine.json',
    'hard_exam.json',
    'school_fight.json',
    'acne.json',
  ],
  interactions: ['ask_money.json'],
  activities: ['mow_lawn.json'],
};

async function fetchAll(dir, files) {
  return Promise.all(files.map((fileName) => fetch(`/data/${dir}/${fileName}`).then((response) => response.json())));
}

export async function loadGameData() {
  const [countries, events, interactions, activities] = await Promise.all([
    fetchAll('countries', MANIFEST.countries),
    fetchAll('events', MANIFEST.events),
    fetchAll('interactions', MANIFEST.interactions),
    fetchAll('activities', MANIFEST.activities),
  ]);

  return {
    countriesById: indexCountries(countries),
    eventsById: indexEvents(events),
    interactionsById: indexInteractions(interactions),
    activitiesById: indexActivities(activities),
  };
}

export async function loadLocale() {
  const response = await fetch('/locales/pt-BR/ui.json');
  return response.json();
}
