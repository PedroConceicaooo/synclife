import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askParentsToPay, recentAsks, RECENT_MONTHS } from '../src/systems/parentPayment.js';
import { resolveChance, PRICE_SHARE_REFERENCE } from '../src/systems/interactions.js';
import { loadRequests } from '../src/systems/requestsLoader.js';
import { createLocale } from '../src/i18n/locale.js';
import { enrollmentLine } from '../src/ui/diary.js';

const REQUESTS_DIR = fileURLToPath(new URL('../data/requests/', import.meta.url));
const REQUEST = loadRequests(REQUESTS_DIR).parents_pay;
const LOCALE_ENTRIES = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 100 } } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };

function family({ momMoney = 5000 } = {}) {
  const person = (id, money) => ({ id, birth: 0, money, traits: [], stats: { ...STATS }, stress: 50 });
  const peopleById = { p_kid: person('p_kid', 0), p_mom: person('p_mom', momMoney) };
  const relationshipsById = { r_1: { id: 'r_1', roles: { p_mom: 'mother', p_kid: 'daughter' }, affinity: { p_mom: 70, p_kid: 60 } } };
  return { playerId: 'p_kid', peopleById, relationshipsById, country: COUNTRY, currentMonthIndex: 120 };
}

test('priceVsWealth takes a weight off at PRICE_SHARE_REFERENCE of the money, at most 1.5 weights', () => {
  const chance = { base: 0.5, modifiers: [{ factor: 'priceVsWealth', weight: 0.2 }] };
  const target = { money: 1000 };
  assert.equal(resolveChance(chance, { target, price: 0 }), 0.5);
  assert.ok(Math.abs(resolveChance(chance, { target, price: 1000 * PRICE_SHARE_REFERENCE }) - 0.3) < 1e-9);
  assert.ok(Math.abs(resolveChance(chance, { target, price: 1e9 }) - 0.2) < 1e-9);
});

test('recentRequests lowers the chance per recent ask', () => {
  const chance = { base: 0.5, modifiers: [{ factor: 'recentRequests', adjust: -0.1 }] };
  assert.equal(resolveChance(chance, { recentRequests: 0 }), 0.5);
  assert.ok(Math.abs(resolveChance(chance, { recentRequests: 3 }) - 0.2) < 1e-9);
});

test('recentAsks keeps the asks of the last RECENT_MONTHS', () => {
  assert.deepEqual(recentAsks({ parentAsks: [100, 110, 119] }, 100 + RECENT_MONTHS), [110, 119]);
  assert.deepEqual(recentAsks({}, 5), []);
});

test('askParentsToPay: a yes hands the money over; every ask is remembered', () => {
  const yes = askParentsToPay(REQUEST, { ...family(), price: 30, rng: { chance: () => true } });
  assert.deepEqual([yes.paid, yes.reason, yes.parentId], [true, null, 'p_mom']);
  assert.equal(yes.peopleById.p_kid.money, 30);
  assert.equal(yes.peopleById.p_mom.money, 4970);
  assert.deepEqual(yes.peopleById.p_kid.parentAsks, [120]);
});

test('askParentsToPay: a no applies the failure effects; a parent short of money says no without rolling', () => {
  const no = askParentsToPay(REQUEST, { ...family(), price: 30, rng: { chance: () => false } });
  assert.deepEqual([no.paid, no.reason], [false, 'refused']);
  assert.equal(no.peopleById.p_kid.money, 0);
  assert.equal(no.relationshipsById.r_1.affinity.p_kid, 59);

  let rolled = false;
  const broke = askParentsToPay(REQUEST, { ...family({ momMoney: 10 }), price: 30, rng: { chance: () => (rolled = true) } });
  assert.deepEqual([broke.paid, broke.reason, rolled], [false, 'parentNoMoney', false]);
  assert.deepEqual(broke.peopleById.p_kid.parentAsks, [120]);
});

test('asking often makes a yes less likely', () => {
  const chances = [];
  const watching = { chance: (c) => (chances.push(c), false) };
  askParentsToPay(REQUEST, { ...family(), price: 30, rng: watching });
  const often = family();
  often.peopleById.p_kid = { ...often.peopleById.p_kid, parentAsks: [110, 112, 115] };
  askParentsToPay(REQUEST, { ...often, price: 30, rng: watching });
  assert.ok(chances[1] < chances[0]);
});

test('request data: known chance factors and the browser manifest', () => {
  const uiData = readFileSync(new URL('../src/ui/data.js', import.meta.url), 'utf8');
  for (const fileName of readdirSync(REQUESTS_DIR).filter((f) => f.endsWith('.json'))) assert.ok(uiData.includes(`'${fileName}'`), fileName);
  assert.equal(typeof REQUEST.conditions.minAge, 'number');
  assert.doesNotThrow(() => resolveChance(REQUEST.chance, { ...family(), target: family().peopleById.p_mom, relationship: family().relationshipsById.r_1, targetPersonId: 'p_mom', price: 10 }));
});

test('the diary tells how the ask went', () => {
  const locale = createLocale(LOCALE_ENTRIES);
  const state = { player: { id: 'p_kid' }, people: { p_mom: { id: 'p_mom', firstName: 'Ana', sex: 'F' } }, relationships: { r_1: { roles: { p_mom: 'mother', p_kid: 'daughter' } } } };
  const line = (entry) => enrollmentLine(state, locale, { activityId: 'gym', parentId: 'p_mom', ...entry });
  assert.equal(line({ type: 'parentsPaid' }), 'Academia: pedi para minha mãe pagar, e deu certo.');
  assert.equal(line({ type: 'parentsDidNotPay', reason: 'refused' }), 'Academia: pedi para minha mãe pagar, mas não rolou.');
  assert.equal(line({ type: 'parentsDidNotPay', reason: 'parentNoMoney' }), 'Academia: pedi para minha mãe pagar, mas o dinheiro está curto em casa.');
});
