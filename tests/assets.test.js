import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { loadEvents } from '../src/systems/eventsLoader.js';
import { loadInteractions } from '../src/systems/interactionsLoader.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { loadAssets } from '../src/systems/assetsLoader.js';
import { assetPrice, assetBlocker, buyAsset, sellAsset, applyAssetUpkeep, listShop, ASSET_CATEGORIES } from '../src/systems/assets.js';
import { createGameState, buyPlayerAsset, sellPlayerAsset, assetShop } from '../src/systems/game.js';
import { toSave, fromSave } from '../src/systems/save.js';

const dir = (d) => fileURLToPath(new URL(`../data/${d}/`, import.meta.url));
const COUNTRIES = loadCountries(dir('countries'));
const ASSETS = loadAssets(dir('assets'));
const DATA = {
  countriesById: COUNTRIES,
  eventsById: loadEvents(dir('events')),
  interactionsById: loadInteractions(dir('interactions')),
  activitiesById: loadActivities(dir('activities')),
  assetsById: ASSETS,
};
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const UI_DATA = readFileSync(new URL('../src/ui/data.js', import.meta.url), 'utf8');
const country = (id) => resolveCountry(id, COUNTRIES);

const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };
const kid = ({ ageYears, money = 0, assets = [] }) => ({ id: 'p_0001', birth: 0, money, stats: { ...STATS }, assets, ageYears });
const ctx = (player, countryId = 'BR') => ({ player, peopleById: { [player.id]: player }, relationshipsById: {}, country: country(countryId), currentMonthIndex: player.ageYears * 12 });

test('prices follow the country money scale', () => {
  assert.equal(assetPrice(ASSETS.bicycle, country('BR')), 125 * 4);
  assert.equal(assetPrice(ASSETS.bicycle, country('US')), 25 * 4);
  assert.equal(assetPrice(ASSETS.photo_social, country('BR')), 0);
});

test('age, legal driving age, requirements and money block a purchase', () => {
  const rich = (ageYears, assets = []) => kid({ ageYears, money: 1e9, assets });
  assert.equal(assetBlocker(ASSETS.bicycle, ctx(rich(3))), 'conditions');
  assert.equal(assetBlocker(ASSETS.bicycle, ctx(rich(4))), null);
  // Driving age comes from the country: 16 in the US, 18 in Brazil.
  assert.equal(assetBlocker(ASSETS.car, ctx(rich(16), 'US')), null);
  assert.equal(assetBlocker(ASSETS.car, ctx(rich(16), 'BR')), 'conditions');
  assert.equal(assetBlocker(ASSETS.photo_social, ctx(rich(13))), 'requires');
  assert.equal(assetBlocker(ASSETS.photo_social, ctx(rich(13, [{ assetId: 'smartphone', since: 0 }]))), null);
  assert.equal(assetBlocker(ASSETS.bicycle, ctx(kid({ ageYears: 8, money: 10 }))), 'money');
  assert.equal(assetBlocker(ASSETS.bicycle, ctx(rich(8, [{ assetId: 'bicycle', since: 0 }]))), 'owned');
});

test('buying takes the money, keeps the item and applies its first effect', () => {
  const player = kid({ ageYears: 8, money: 1000 });
  const result = buyAsset(ASSETS.bicycle, ctx(player));
  const owner = result.peopleById.p_0001;
  assert.equal(result.bought, true);
  assert.equal(owner.money, 500);
  assert.deepEqual(owner.assets, [{ assetId: 'bicycle', since: 96 }]);
  assert.equal(owner.stats.happiness, 53);
});

test('selling the phone pays half back and closes the accounts that needed it', () => {
  const player = kid({ ageYears: 14, money: 0, assets: [{ assetId: 'smartphone', since: 0 }, { assetId: 'photo_social', since: 0 }, { assetId: 'bicycle', since: 0 }] });
  const result = sellAsset(ASSETS.smartphone, ASSETS, ctx(player));
  assert.equal(result.amount, Math.floor(125 * 12 * 0.5));
  assert.deepEqual(result.dropped.sort(), ['photo_social', 'smartphone']);
  assert.deepEqual(result.peopleById.p_0001.assets.map((a) => a.assetId), ['bicycle']);
});

test('yearly effects scale with the months that passed', () => {
  const player = kid({ ageYears: 10, assets: [{ assetId: 'computer', since: 0 }] });
  const half = applyAssetUpkeep(ASSETS, { ...ctx(player), months: 6 }).p_0001;
  const full = applyAssetUpkeep(ASSETS, { ...ctx(player), months: 12 }).p_0001;
  assert.equal(half.stats.intelligence, 51);
  assert.equal(full.stats.intelligence, 52);
});

test('the shop groups by category, cheapest first, and hides what is owned', () => {
  const player = kid({ ageYears: 10, money: 0, assets: [{ assetId: 'bicycle', since: 0 }] });
  const shop = listShop(ASSETS, ctx(player));
  assert.deepEqual(shop.map((g) => g.category), ASSET_CATEGORIES.filter((c) => shop.some((g) => g.category === c)));
  const items = shop.flatMap((g) => g.items);
  assert.ok(!items.some((i) => i.id === 'bicycle'));
  for (const group of shop) {
    const prices = group.items.map((i) => i.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  }
});

test('buying and selling through the game is in the diary and survives a save', () => {
  let state = createGameState({ seed: 4, ...DATA, choices: { countryId: 'BR' } });
  state = { ...state, currentMonthIndex: state.player.birth + 10 * 12, people: { ...state.people, [state.player.id]: { ...state.people[state.player.id], money: 5000 } } };

  state = buyPlayerAsset(state, 'bicycle');
  assert.equal(state.lastAssetResult.done, true);
  assert.equal(state.people[state.player.id].money, 4500);
  assert.ok(!assetShop(state).flatMap((g) => g.items).some((i) => i.id === 'bicycle'));

  state = sellPlayerAsset(state, 'bicycle');
  assert.equal(state.people[state.player.id].money, 4750);
  const entries = state.history.at(-1).entries;
  assert.ok(entries.some((e) => e.type === 'assetBought' && e.assetId === 'bicycle'));
  assert.ok(entries.some((e) => e.type === 'assetSold' && e.assetId === 'bicycle'));
  assert.equal(entries.filter((e) => e.type === 'money').reduce((sum, e) => sum + e.amount, 0), -250);

  state = buyPlayerAsset(state, 'computer');
  const loaded = fromSave(JSON.parse(JSON.stringify(toSave(state))), DATA);
  assert.deepEqual(loaded.people[state.player.id].assets, state.people[state.player.id].assets);
});

test('asset data: minAge, known category, texts in pt-BR, listed for the browser', () => {
  for (const asset of Object.values(ASSETS)) {
    assert.equal(typeof asset.conditions.minAge, 'number', asset.id);
    assert.ok(ASSET_CATEGORIES.includes(asset.category), asset.id);
    for (const key of ['title', 'description']) assert.ok(LOCALE[`asset.${asset.id}.${key}`], `${asset.id}.${key}`);
    for (const required of asset.requires ?? []) assert.ok(ASSETS[required], `${asset.id} requires ${required}`);
  }
  for (const fileName of readdirSync(dir('assets')).filter((f) => f.endsWith('.json'))) {
    assert.ok(UI_DATA.includes(`'${fileName}'`), fileName);
  }
});
