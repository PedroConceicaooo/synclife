// Turns the engine's history (ids and numbers) into diary text. Pure — no
// DOM — so it is tested in Node; render.js only puts the result on screen.

import { fullName } from '../systems/naming.js';
import { ageAt } from '../engine/time.js';

const STAT_ORDER = ['happiness', 'health', 'intelligence', 'looks'];

function relationTo(state, personId) {
  const relationship = Object.values(state.relationships).find((r) => personId in r.roles && state.player.id in r.roles);
  return relationship ? relationship.roles[personId] : null;
}

// "minha mãe", "meu irmão Theo"
function who(state, locale, personId) {
  const person = state.people[personId];
  return locale.format(`diary.who.${relationTo(state, personId)}`, { name: person.firstName });
}

function introLines(state, locale) {
  const { player, country } = state;
  const lines = [
    locale.format(
      'diary.intro.born',
      { city: locale.t(`city.${player.cityId}`), country: locale.t(`country.${country.id}`), month: locale.monthName(player.birth), name: fullName(player, country) },
      { player: player.sex },
    ),
  ];
  for (const parent of [state.people[state.mother.id], state.people[state.father.id]]) {
    lines.push(
      locale.format(`diary.intro.${relationTo(state, parent.id)}`, {
        name: fullName(parent, country),
        occupation: locale.format(`occupation.${parent.occupation.title}`, {}, { self: parent.sex }),
        age: locale.plural('age.years', ageAt(parent.birth, player.birth)),
      }),
    );
  }
  return lines;
}

function babyBornLine(state, locale, month) {
  const baby = Object.values(state.people).find((p) => p.birth === month && p.id !== state.player.id);
  if (!baby) return locale.t('event.new_baby.text');
  return locale.format('diary.new_baby', { name: baby.firstName }, { baby: baby.sex });
}

function moneyLine(entry, state, locale) {
  const amount = locale.money(Math.abs(entry.amount), state.country.currency.code);
  if (entry.amount > 0) return locale.format('diary.money.gain', { amount });
  return locale.format(entry.source === 'activity' ? 'diary.money.spent' : 'diary.money.lost', { amount });
}

function entryLine(entry, state, locale, block) {
  // Event, activity and interaction texts may use {player|o|a}.
  const text = (key) => locale.format(key, {}, { player: state.player.sex });
  switch (entry.type) {
    case 'birthday':
      return locale.format('diary.birthday', { age: locale.plural('age.years', entry.age) });
    case 'event':
      if (!entry.optionId) return text(`event.${entry.eventId}.text`);
      return locale.format('diary.choice', {
        prompt: text(`event.${entry.eventId}.prompt`),
        option: text(`event.${entry.eventId}.option.${entry.optionId}`),
      });
    case 'worldEvent':
      return entry.eventId === 'new_baby' ? babyBornLine(state, locale, block.month) : text(`event.${entry.eventId}.text`);
    case 'activity':
      return text(`activity.${entry.activityId}.done`);
    case 'interaction':
      return locale.format('diary.interaction', {
        label: text(`interaction.${entry.interactionId}.label`),
        who: who(state, locale, entry.targetId),
        result: text(`interaction.${entry.interactionId}.${entry.succeeded ? 'success' : 'failure'}`),
      });
    case 'money':
      return entry.source === 'allowance' ? null : moneyLine(entry, state, locale);
    default:
      return null; // birth (intro), stat and allowance are summarized per block
  }
}

function allowanceLine(entries, state, locale) {
  const total = entries.filter((e) => e.type === 'money' && e.source === 'allowance').reduce((sum, e) => sum + e.amount, 0);
  return total > 0 ? locale.format('diary.allowance', { amount: locale.money(total, state.country.currency.code) }) : null;
}

function statsLine(entries, locale) {
  const totals = {};
  for (const e of entries.filter((e) => e.type === 'stat')) totals[e.stat] = (totals[e.stat] ?? 0) + e.delta;
  const parts = STAT_ORDER.filter((stat) => Math.round(totals[stat] ?? 0) !== 0).map((stat) => {
    const delta = Math.round(totals[stat]);
    return `${locale.t(`ui.stat_${stat}`)} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
  });
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function describeBlock(block, state, locale) {
  const header = locale.format('diary.header', { age: locale.age(block.month - state.player.birth) });
  const isIntro = block.entries.some((e) => e.type === 'birth');
  const lines = [
    ...(isIntro ? introLines(state, locale) : []),
    ...block.entries.map((e) => entryLine(e, state, locale, block)),
    allowanceLine(block.entries, state, locale),
    statsLine(block.entries, locale),
  ].filter(Boolean);
  return { header, lines };
}

export function describeHistory(state, locale) {
  return state.history.map((block) => describeBlock(block, state, locale));
}
