// "Pedir para os pais pagarem" (docs/atividades.md 4): a player short of
// money for something with a price asks the parent who likes them most.
// The request's data (data/requests/parents_pay.json) holds the chance in
// the closed vocabulary — price against the parent's money, affinity,
// traits, stress, and how often the player asked lately — plus the effects
// of a yes and a no. A yes hands the money to the player, who then pays as
// usual.
//
// person.parentAsks = [month, ...] — the asks of the last RECENT_MONTHS.

import { applyEffects } from '../engine/effects.js';
import { resolveChance } from './interactions.js';
import { parentToAsk } from './enrollment.js';
import { transferMoney } from './money.js';

export const RECENT_MONTHS = 12;

export function recentAsks(person, monthIndex) {
  return (person.parentAsks ?? []).filter((month) => monthIndex - month < RECENT_MONTHS);
}

// Returns { paid, reason, parentId, peopleById, relationshipsById }; reason
// is null when paid, 'refused', 'parentNoMoney' or 'noParent'.
export function askParentsToPay(request, { playerId, price, peopleById, relationshipsById, country, currentMonthIndex, rng }) {
  const player = peopleById[playerId];
  const asked = parentToAsk(playerId, relationshipsById);
  if (!asked) return { paid: false, reason: 'noParent', parentId: null, peopleById, relationshipsById };
  const parent = peopleById[asked.parentId];
  const asks = recentAsks(player, currentMonthIndex);
  const withAsk = { ...peopleById, [playerId]: { ...player, parentAsks: [...asks, currentMonthIndex] } };
  if (parent.money < price) return { paid: false, reason: 'parentNoMoney', parentId: parent.id, peopleById: withAsk, relationshipsById };

  const paid = rng.chance(
    resolveChance(request.chance, {
      relationship: asked.relationship,
      targetPersonId: parent.id,
      target: parent,
      player,
      relationshipsById,
      peopleById,
      playerId,
      country,
      price,
      recentRequests: asks.length,
    }),
  );
  const result = applyEffects((paid ? request.success : request.failure) ?? [], {
    relationship: asked.relationship,
    relationshipsById,
    peopleById: withAsk,
    playerId,
    country,
    rng,
    currentMonthIndex,
  });
  const people = paid ? transferMoney(result.peopleById, parent.id, playerId, price) : result.peopleById;
  return { paid, reason: paid ? null : 'refused', parentId: parent.id, peopleById: people, relationshipsById: result.relationshipsById };
}
