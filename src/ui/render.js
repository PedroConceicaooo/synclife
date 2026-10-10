// DOM rendering. Reads state, never changes it; every action goes back to
// app.js through a callback.

import { ageAt } from '../engine/time.js';
import { affinityBand } from './affinityColor.js';
import { fullName } from '../systems/naming.js';
import { describeHistory } from './diary.js';
import { isAdult, lifePhase, availableInteractions, availableActivities, closePeople } from './gameState.js';

const STATS = ['happiness', 'health', 'intelligence', 'looks'];

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function el(tag, { className, text } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Label and percentage on one line, a thin bar under it.
function meter(label, value) {
  const wrapper = el('div', { className: 'meter' });
  const head = el('div', { className: 'meter-head' });
  head.append(el('span', { text: label }), el('span', { text: `${Math.round(value)}%` }));
  const track = el('div', { className: 'bar-track' });
  const fill = el('div', { className: `bar-fill ${affinityBand(value)}` });
  fill.style.width = `${value}%`;
  track.appendChild(fill);
  wrapper.append(head, track);
  return wrapper;
}

function relationshipWith(state, personId) {
  return Object.values(state.relationships).find((r) => personId in r.roles && state.player.id in r.roles);
}

const sexesOf = (state) => ({ player: state.player.sex });

export function renderHeader(dom, state, locale) {
  const player = state.people[state.player.id];
  const countryName = locale.t(`country.${state.country.id}`);
  dom.topFlag.src = `/src/ui/flags/${state.country.id}.svg`;
  dom.topFlag.alt = locale.format('ui.flag_alt', { country: countryName });
  dom.topName.textContent = fullName(player, state.country);
  dom.topPhase.textContent = locale.t(`phase.${lifePhase(state)}`);
  dom.topMoney.textContent = locale.money(player.money, state.country.currency.code);
  dom.topMoneyLabel.textContent = locale.t('ui.balance');
}

export function renderStats(dom, state, locale) {
  const player = state.people[state.player.id];
  clearChildren(dom.stats);
  for (const stat of STATS) dom.stats.appendChild(meter(locale.t(`ui.stat_${stat}`), player.stats[stat]));
}

export function renderDiary(dom, state, locale) {
  clearChildren(dom.diary);
  for (const { header, lines } of describeHistory(state, locale)) {
    const block = el('li', { className: 'diary-block' });
    block.appendChild(el('h2', { text: header }));
    for (const { kind, text } of lines) block.appendChild(el('p', { className: kind, text }));
    dom.diary.appendChild(block);
  }
}

export function renderControls(dom, state, locale, view, { onAdvance, onTab }) {
  clearChildren(dom.advance);
  if (isAdult(state)) {
    dom.advance.appendChild(el('p', { text: locale.t('ui.adulthood_placeholder') }));
  } else {
    for (const [months, key] of [
      [6, 'ui.advance_6_months'],
      [12, 'ui.advance_1_year'],
    ]) {
      const button = el('button', { text: locale.t(key) });
      button.type = 'button';
      button.disabled = state.pendingDecisions.length > 0;
      button.addEventListener('click', () => onAdvance(months));
      dom.advance.appendChild(button);
    }
  }

  // Design doc: tabs for the current phase, relationships and activities.
  clearChildren(dom.tabs);
  const activeTab = view.screen === 'profile' ? 'relations' : view.screen;
  for (const [tab, label] of [
    ['life', locale.t(`phase.${lifePhase(state)}`)],
    ['relations', locale.t('ui.tab_relations')],
    ['activities', locale.t('ui.tab_activities')],
  ]) {
    const button = el('button', { text: label });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab === activeTab));
    button.addEventListener('click', () => onTab(tab));
    dom.tabs.appendChild(button);
  }
}

export function renderRelations(dom, state, locale, { onOpenProfile }) {
  dom.relationsTitle.textContent = locale.t('ui.relations_title');
  clearChildren(dom.relationsList);
  for (const { personId, role } of closePeople(state)) {
    const person = state.people[personId];
    const relationship = relationshipWith(state, personId);
    const item = el('li');
    const button = el('button', { className: 'row' });
    button.type = 'button';
    button.append(
      el('strong', { text: fullName(person, state.country) }),
      el('span', {
        className: 'detail',
        text: locale.format('ui.person_subtitle', {
          role: locale.t(`role.${role}`),
          age: locale.plural('age.years', ageAt(person.birth, state.currentMonthIndex)),
        }),
      }),
      meter(locale.t('ui.affinity_they_feel'), relationship.affinity[personId]),
    );
    button.addEventListener('click', () => onOpenProfile(personId));
    item.appendChild(button);
    dom.relationsList.appendChild(item);
  }
}

function interactionResultText(result, locale, sexes) {
  if (!result.attempted) return result.reason === 'limit' ? locale.t('ui.interaction_limit') : '';
  return locale.format(`interaction.${result.interactionId}.${result.succeeded ? 'success' : 'failure'}`, {}, sexes);
}

// Categories first; tapping one opens its submenu (design doc: up to six
// categories, only those with at least one available option).
export function renderProfile(dom, state, locale, personId, openCategory, { onBack, onInteract, onSelectCategory }) {
  const person = state.people[personId];
  const relationship = relationshipWith(state, personId);
  const role = relationship.roles[personId];

  dom.profileBack.textContent = locale.t('ui.back');
  dom.profileBack.onclick = onBack;
  dom.profileTitle.textContent = fullName(person, state.country);
  dom.profileSubtitle.textContent = locale.format('ui.person_subtitle', {
    role: locale.t(`role.${role}`),
    age: locale.plural('age.years', ageAt(person.birth, state.currentMonthIndex)),
  });

  clearChildren(dom.profileAffinity);
  dom.profileAffinity.append(
    meter(locale.t('ui.affinity_they_feel'), relationship.affinity[personId]),
    meter(locale.t('ui.affinity_you_feel'), relationship.affinity[state.player.id]),
  );

  clearChildren(dom.profileInteractions);
  for (const group of availableInteractions(state, personId)) {
    const isOpen = group.category === openCategory;
    const categoryButton = el('button', { className: isOpen ? 'category open' : 'category', text: locale.t(`interactionCategory.${group.category}`) });
    categoryButton.type = 'button';
    categoryButton.setAttribute('aria-expanded', String(isOpen));
    categoryButton.addEventListener('click', () => onSelectCategory(isOpen ? null : group.category));
    dom.profileInteractions.appendChild(categoryButton);

    if (!isOpen) continue;
    const submenu = el('div', { className: 'submenu' });
    for (const interactionId of group.interactionIds) {
      const button = el('button', { text: locale.t(`interaction.${interactionId}.label`) });
      button.type = 'button';
      button.addEventListener('click', () => onInteract(interactionId, personId));
      submenu.appendChild(button);
    }
    dom.profileInteractions.appendChild(submenu);
  }

  const result = state.lastInteractionResult;
  dom.profileResult.textContent = result && result.targetId === personId ? interactionResultText(result, locale, sexesOf(state)) : '';
}

const ACTIVITY_BLOCKER_KEYS = { limit: 'ui.activity_limit', money: 'ui.activity_no_money' };

function activityResultText(result, locale, sexes) {
  if (!result.attempted) return locale.t(ACTIVITY_BLOCKER_KEYS[result.reason]);
  // Events with options open the decision pop-up; the rest are told here.
  const eventTexts = result.triggeredEvents
    .map((eventId) => `event.${eventId}.text`)
    .filter((key) => locale.has(key))
    .map((key) => locale.format(key, {}, sexes));
  return [locale.format(`activity.${result.activityId}.done`, {}, sexes), ...eventTexts].join(' ');
}

// Design doc: lists with title and a one-line description. Activities the
// player can't do right now stay visible, disabled, with the reason.
export function renderActivities(dom, state, locale, { onDoActivity }) {
  dom.activitiesTitle.textContent = locale.t('ui.activities_title');
  dom.activitiesResult.textContent = state.lastActivityResult ? activityResultText(state.lastActivityResult, locale, sexesOf(state)) : '';

  clearChildren(dom.activitiesList);
  for (const group of availableActivities(state)) {
    const section = el('div', { className: 'activities-group' });
    section.appendChild(el('h2', { text: locale.t(`activityCategory.${group.category}`) }));

    for (const { id, blocker } of group.activities) {
      const button = el('button', { className: 'row activity' });
      button.type = 'button';
      button.disabled = blocker !== null || state.pendingDecisions.length > 0;
      button.append(
        el('strong', { text: locale.t(`activity.${id}.title`) }),
        el('span', { className: 'detail', text: blocker ? locale.t(ACTIVITY_BLOCKER_KEYS[blocker]) : locale.t(`activity.${id}.description`) }),
      );
      button.addEventListener('click', () => onDoActivity(id));
      section.appendChild(button);
    }
    dom.activitiesList.appendChild(section);
  }
}

export function renderDecisionModal(dom, state, locale, { onChoose }) {
  if (state.pendingDecisions.length === 0) {
    dom.decisionModal.hidden = true;
    return;
  }

  const decision = state.pendingDecisions[0];
  const decisionEvent = state.eventsById[decision.trigger];
  const sexes = sexesOf(state);

  dom.decisionModal.hidden = false;
  dom.decisionPrompt.textContent = locale.format(`event.${decision.trigger}.prompt`, {}, sexes);

  clearChildren(dom.decisionOptions);
  for (const option of decisionEvent.options) {
    const button = el('button', { text: locale.format(`event.${decision.trigger}.option.${option.id}`, {}, sexes) });
    button.type = 'button';
    button.addEventListener('click', () => onChoose(option.id));
    dom.decisionOptions.appendChild(button);
  }
  dom.decisionOptions.firstChild?.focus();
}
