// Browser-side data loading via fetch — the Node-only *Loader.js files read
// from disk instead. The file list is hardcoded on purpose: M5's data set is
// small and fixed. Revisit with a generated manifest once
// M8+ content makes this list long or frequently changing.

import { indexCountries } from '../engine/countries.js';
import { indexEvents } from '../systems/events.js';
import { indexInteractions } from '../systems/interactions.js';
import { indexActivities } from '../systems/activities.js';
import { indexAssets } from '../systems/assets.js';
import { FALLBACK_LANGUAGE } from '../i18n/locale.js';

const MANIFEST = {
  countries: ['default.json', 'BR.json', 'US.json', 'JP.json', 'RU.json', 'GB.json'],
  events: [
    'divorce.json',
    'parents_fight.json',
    'parents_make_up.json',
    'new_baby.json',
    'new_sibling.json',
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
    'new_school.json',
    'entrance_exam.json',
    'school_report.json',
    'school_warning.json',
    'recess_friend.json',
    'secret_dating_discovered.json',
    'caught_by_parents.json',
    'caught_by_police.json',
    'babysitter.json',
    'neighbor_extra_tip.json',
    'teacher_confiscates.json',
    'dog_runs_away.json',
    'first_steps.json',
    'first_word.json',
    'pull_tablecloth.json',
    'bath_time.json',
    'ear_infection.json',
    'learn_to_ride_bike.json',
    'broken_vase.json',
    'school_play.json',
    'chickenpox.json',
    'homework.json',
    'first_crush.json',
    'growth_spurt.json',
    'join_sports_team.json',
    'curfew.json',
    'argument_with_parents.json',
  ],
  interactions: [
    'ask_money.json',
    'chat.json',
    'compliment.json',
    'vent.json',
    'ask_advice.json',
    'play_together.json',
    'go_for_walk.json',
    'go_to_movies.json',
    'ask_for_something.json',
    'give_gift.json',
    'give_money.json',
    'argue.json',
    'yell.json',
    'insult.json',
    'help_at_home.json',
    'tease.json',
    'fight_sibling.json',
    'ask_sibling_help.json',
    'tattle.json',
    'study_together.json',
    'ask_homework_help.json',
    'gossip.json',
    'invite_home.json',
    'drift_apart.json',
    'ask_question.json',
    'ask_extra_credit.json',
    'joke_in_class.json',
    'annoy_teacher.json',
    'complain.json',
    'ask_out.json',
    'send_note.json',
    'go_on_date.json',
    'hold_hands.json',
    'introduce_to_parents.json',
    'break_up.json',
    'ask_for_dog.json',
    'ask_for_cat.json',
    'pet_animal.json',
    'play_with_pet.json',
    'walk_dog.json',
  ],
  assets: [
    'bicycle.json',
    'skateboard.json',
    'car.json',
    'video_game.json',
    'smartphone.json',
    'computer.json',
    'photo_social.json',
    'video_social.json',
  ],
  activities: [
    'shoplift.json',
    'steal_package.json',
    'pickpocket.json',
    'carry_groceries.json',
    'wash_cars.json',
    'walk_dogs.json',
    'mow_lawn.json',
    'sell_at_recess.json',
    'babysit.json',
    'amusement_park.json',
    'buy_book.json',
    'buy_clothes.json',
    'gym.json',
  ],
};

async function fetchAll(dir, files) {
  return Promise.all(files.map((fileName) => fetch(`/data/${dir}/${fileName}`).then((response) => response.json())));
}

export async function loadGameData() {
  const [countries, events, interactions, activities, assets] = await Promise.all([
    fetchAll('countries', MANIFEST.countries),
    fetchAll('events', MANIFEST.events),
    fetchAll('interactions', MANIFEST.interactions),
    fetchAll('activities', MANIFEST.activities),
    fetchAll('assets', MANIFEST.assets),
  ]);

  const countriesWithNames = await Promise.all(
    countries.map(async (country) =>
      country.names ? { ...country, nameList: await (await fetch(`/data/${country.names}`)).json() } : country,
    ),
  );

  return {
    countriesById: indexCountries(countriesWithNames),
    eventsById: indexEvents(events),
    interactionsById: indexInteractions(interactions),
    activitiesById: indexActivities(activities),
    assetsById: indexAssets(assets),
  };
}

// The chosen language plus Portuguese as the fallback (only pt-BR exists so
// far, so both are the same file today).
export async function loadLocale(language = FALLBACK_LANGUAGE) {
  const load = async (lang) => (await fetch(`/locales/${lang}/ui.json`)).json();
  const fallback = await load(FALLBACK_LANGUAGE);
  const entries = language === FALLBACK_LANGUAGE ? fallback : await load(language).catch(() => ({}));
  return { language, entries, fallback };
}
