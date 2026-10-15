import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { activityBlocker, attemptActivity, listActivities, ACTIVITY_CATEGORIES } from '../src/systems/activities.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { applyEffects } from '../src/engine/effects.js';
import { trainSkill, trainingGain } from '../src/systems/training.js';

const ACTIVITIES = loadActivities(fileURLToPath(new URL('../data/activities/', import.meta.url)));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 200 } }, education: { schoolYearStartMonth: 2, stages: [] } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };
const player = (ageYears, money = 1000) => ({ id: 'p_kid', birth: 0, money, stats: { ...STATS }, month: ageYears * 12 });

test('Cuidados com o corpo comes first in the Activities screen', () => {
  assert.equal(ACTIVITY_CATEGORIES[0], 'body_care');
  const groups = listActivities(ACTIVITIES, { player: player(14), country: COUNTRY, currentMonthIndex: 14 * 12 });
  assert.equal(groups[0].category, 'body_care');
  assert.ok(groups[0].activities.some((a) => a.id === 'manicure'));
});

test('rigid parents forbid makeup up to 15; others, or from 16, may', () => {
  const makeup = ACTIVITIES.makeup;
  const at = (age, parentTraits) => activityBlocker(makeup, { player: player(age), country: COUNTRY, currentMonthIndex: age * 12, parentTraits });
  assert.equal(at(13, ['rigid', 'shy']), 'forbidden');
  assert.equal(at(15, ['rigid']), 'forbidden');
  assert.equal(at(16, ['rigid']), null);
  assert.equal(at(13, ['generous']), null);
  assert.equal(at(11, []), 'conditions', 'still too young for anyone');
  const tried = attemptActivity(makeup, { player: player(13), peopleById: { p_kid: player(13) }, country: COUNTRY, currentMonthIndex: 13 * 12, parentTraits: ['rigid'] });
  assert.equal(tried.reason, 'forbidden');
});

test('a service costs its price and applies its effects', () => {
  const kid = player(12, 100);
  const done = attemptActivity(ACTIVITIES.dermatologist, { player: kid, peopleById: { p_kid: kid }, country: COUNTRY, currentMonthIndex: 12 * 12 });
  assert.equal(done.peopleById.p_kid.money, 50);
  assert.equal(done.peopleById.p_kid.stats.looks, 53);
});

test('the nutritionist boosts training gains for six months', () => {
  const kid = player(14);
  const boosted = applyEffects([{ op: 'trainingBoost', months: 6, factor: 1.2 }], { peopleById: { p_kid: kid }, relationshipsById: {}, playerId: 'p_kid', currentMonthIndex: 168 });
  assert.deepEqual(boosted.peopleById.p_kid.trainingBoost, { until: 174, factor: 1.2 });

  const rng = { next: () => 0.5 };
  assert.equal(trainingGain(0, 0.5, rng, 16), 5);
  assert.equal(trainingGain(0, 0.5, rng, 16, 1.2), 6);
  const training = { levels: [{ id: 'a' }], techniques: [] };
  const person = { ...boosted.peopleById.p_kid, aptitudes: { physical: 0.5 }, birth: 0 };
  const gainAt = (someone, monthIndex) => trainSkill(training, null, { person: someone, monthIndex, rng }).gain;
  const without = { ...person, trainingBoost: null };
  assert.ok(gainAt(person, 172) > gainAt(without, 172), 'while it lasts');
  assert.equal(gainAt(person, 174), gainAt(without, 174), 'over at its end month');
});

test('every body care service declares minAge and a price', () => {
  const services = Object.values(ACTIVITIES).filter((a) => a.category === 'body_care');
  assert.ok(services.length >= 8);
  for (const service of services) {
    assert.equal(typeof service.conditions.minAge, 'number', service.id);
    assert.ok(['small', 'medium', 'large'].includes(service.cost), service.id);
  }
});
