// No fs here — this file must stay loadable from a browser; see
// assetsLoader.js for the Node-only reader.
//
// Assets (design: "Bens"): things the player owns — a bike, a phone, a
// social media account — and the shop to get them. Each has a price in the
// country's money scale and a yearly effect while owned.

import { evaluateConditions } from '../engine/conditions.js';
import { applyEffects } from '../engine/effects.js';
import { resolveAmount } from './money.js';

export function indexAssets(assets) {
  return Object.fromEntries(assets.map((asset) => [asset.id, asset]));
}

// Display order of the shop.
export const ASSET_CATEGORIES = ['vehicle', 'electronics', 'social'];

// What you get back when selling (accounts are free and just get deleted).
export const RESALE_SHARE = 0.5;

// "price": { "scale": "medium", "times": 4 }, or no price for free things.
export function assetPrice(asset, country) {
  return asset.price ? resolveAmount(asset.price.scale, country) * asset.price.times : 0;
}

export function resalePrice(asset, country) {
  return Math.floor(assetPrice(asset, country) * RESALE_SHARE);
}

export const ownedAssetIds = (person) => (person.assets ?? []).map((a) => a.assetId);

// Why the player can't get this asset now, or null if they can.
export function assetBlocker(asset, { player, country, currentMonthIndex }) {
  const owned = ownedAssetIds(player);
  if (owned.includes(asset.id)) return 'owned';
  if (!evaluateConditions(asset.conditions, player, { currentMonthIndex, country })) return 'conditions';
  if ((asset.requires ?? []).some((id) => !owned.includes(id))) return 'requires';
  if (player.money < assetPrice(asset, country)) return 'money';
  return null;
}

// Shop by category, cheapest first. Things the player is too young for are
// listed too (with the reason) so a child can see what comes later.
export function listShop(assetsById, { player, country, currentMonthIndex }) {
  const items = Object.values(assetsById)
    .map((asset) => ({ id: asset.id, category: asset.category, price: assetPrice(asset, country), blocker: assetBlocker(asset, { player, country, currentMonthIndex }) }))
    .filter((item) => item.blocker !== 'owned')
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  return ASSET_CATEGORIES.map((category) => ({ category, items: items.filter((i) => i.category === category) })).filter((g) => g.items.length > 0);
}

export function buyAsset(asset, { player, peopleById, relationshipsById, country, currentMonthIndex }) {
  const blocker = assetBlocker(asset, { player, country, currentMonthIndex });
  if (blocker) return { bought: false, reason: blocker, peopleById };

  const price = assetPrice(asset, country);
  const owner = { ...player, money: player.money - price, assets: [...(player.assets ?? []), { assetId: asset.id, since: currentMonthIndex }] };
  const people = { ...peopleById, [player.id]: owner };
  const result = applyEffects(asset.onBuy ?? [], { relationship: null, relationshipsById, peopleById: people, playerId: player.id, country });
  return { bought: true, price, peopleById: result.peopleById };
}

// Selling also drops anything that needed it (no phone, no accounts).
export function sellAsset(asset, assetsById, { player, peopleById, country }) {
  if (!ownedAssetIds(player).includes(asset.id)) return { sold: false, reason: 'not_owned', peopleById };
  const dropped = new Set([asset.id]);
  for (const owned of player.assets) {
    if ((assetsById[owned.assetId]?.requires ?? []).includes(asset.id)) dropped.add(owned.assetId);
  }
  const amount = resalePrice(asset, country);
  const owner = { ...player, money: player.money + amount, assets: player.assets.filter((a) => !dropped.has(a.assetId)) };
  return { sold: true, amount, dropped: [...dropped], peopleById: { ...peopleById, [player.id]: owner } };
}

// Yearly effects of everything owned, scaled to the months that passed
// (a 6-month advance gets half).
export function applyAssetUpkeep(assetsById, { player, peopleById, relationshipsById, country, months }) {
  const effects = (player.assets ?? []).flatMap(({ assetId }) =>
    (assetsById[assetId]?.yearly ?? []).map((effect) => ({ ...effect, delta: (effect.delta * months) / 12 })),
  );
  return applyEffects(effects, { relationship: null, relationshipsById, peopleById, playerId: player.id, country }).peopleById;
}
