// DOM rendering. Reads state, never changes it; every action goes back to
// app.js through a callback.

import { ageAt } from '../engine/time.js';
import { affinityBand } from './affinityColor.js';
import { fullName } from '../systems/naming.js';
import { describeHistory } from './diary.js';
import { isAdult, lifePhase, availableInteractions, availableActivities, closePeople } from './gameState.js';
import { lifeSummary } from '../systems/lifeEnd.js';

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

// "Mãe", "Amiga", "Professor": some roles change with the person's sex.
function roleLabel(locale, role, person) {
  return locale.format(`role.${role}`, {}, { self: person.sex });
}

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

function personAge(state, locale, personId) {
  return locale.plural('age.years', ageAt(state.people[personId].birth, state.currentMonthIndex));
}

export function renderControls(dom, state, locale, view, { onAdvance, onTab, onNewLife, onContinueAs }) {
  clearChildren(dom.advance);
  if (isAdult(state)) {
    // Design doc: at 18, a new life or carrying on as a younger sibling.
    dom.advance.appendChild(el('p', { text: locale.t('ui.end_prompt') }));
    for (const siblingId of lifeSummary(state).successors) {
      const button = el('button', {
        text: locale.format('ui.continue_as', { name: state.people[siblingId].firstName, age: personAge(state, locale, siblingId) }),
      });
      button.type = 'button';
      button.addEventListener('click', () => onContinueAs(siblingId));
      dom.advance.appendChild(button);
    }
    const newLife = el('button', { className: 'secondary', text: locale.t('ui.new_life') });
    newLife.type = 'button';
    newLife.addEventListener('click', onNewLife);
    dom.advance.appendChild(newLife);
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

// Shown under the diary once the player is 18 (design doc: main events,
// final stats, strongest relationships).
export function renderSummary(dom, state, locale) {
  dom.summary.hidden = !isAdult(state);
  if (dom.summary.hidden) return;

  const summary = lifeSummary(state);
  const player = state.people[state.player.id];
  dom.summaryTitle.textContent = locale.t('ui.summary_title');
  dom.summaryStatsTitle.textContent = locale.t('ui.summary_stats');
  dom.summaryMilestonesTitle.textContent = locale.t('ui.summary_milestones');
  dom.summaryRelationsTitle.textContent = locale.t('ui.summary_relations');

  clearChildren(dom.summaryStats);
  for (const stat of STATS) dom.summaryStats.appendChild(meter(locale.t(`ui.stat_${stat}`), summary.stats[stat]));

  // Each milestone once, at the first time it happened.
  clearChildren(dom.summaryMilestones);
  const seen = new Set();
  for (const milestone of summary.milestones) {
    if (seen.has(milestone.eventId)) continue;
    seen.add(milestone.eventId);
    const text = locale.format('ui.summary_milestone', {
      age: locale.age(milestone.month - player.birth),
      text: locale.t(`milestone.${milestone.eventId}`),
    });
    dom.summaryMilestones.appendChild(el('li', { text }));
  }

  clearChildren(dom.summaryRelations);
  for (const { personId, role, strength } of summary.strongestRelationships) {
    const item = el('li', { className: 'row' });
    item.append(
      el('strong', { text: fullName(state.people[personId], state.country) }),
      el('span', { className: 'detail', text: roleLabel(locale, role, state.people[personId]) }),
      meter(locale.t('ui.relation_strength'), strength),
    );
    dom.summaryRelations.appendChild(item);
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
          role: roleLabel(locale, role, person),
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
    role: roleLabel(locale, role, person),
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

// Design doc, "Início": a random life or a custom one (name, sex, country,
// city), with the warning that the game is a simulation.
export function renderStart(dom, locale, countries, form, { onRandom, onOpenCustom, onBack, onFormChange, onBegin }) {
  dom.startTagline.textContent = locale.t('start.tagline');
  dom.startRandom.textContent = locale.t('start.random');
  dom.startRandom.onclick = onRandom;
  dom.startCustom.textContent = locale.t('start.custom');
  dom.startCustom.onclick = onOpenCustom;
  dom.disclaimer.textContent = locale.t('ui.disclaimer');

  dom.startChoice.hidden = form.open;
  dom.startForm.hidden = !form.open;
  if (!form.open) return;

  dom.startNameLabel.textContent = locale.t('start.name_label');
  dom.startName.placeholder = locale.t('start.name_hint');
  dom.startName.value = form.firstName;
  dom.startName.oninput = () => onFormChange({ firstName: dom.startName.value }, { rerender: false });

  function radioGroup(fieldset, legendKey, name, options) {
    clearChildren(fieldset);
    fieldset.appendChild(el('legend', { text: locale.t(legendKey) }));
    for (const { value, label, image } of options) {
      const option = el('label', { className: 'choice-option' });
      const input = el('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      input.checked = form[name] === value;
      input.addEventListener('change', () => onFormChange({ [name]: value }));
      option.appendChild(input);
      if (image) {
        const flag = el('img');
        flag.src = image;
        flag.alt = '';
        flag.width = 30;
        flag.height = 20;
        option.appendChild(flag);
      }
      option.appendChild(el('span', { text: label }));
      fieldset.appendChild(option);
    }
  }

  radioGroup(dom.startSex, 'start.sex_label', 'sex', ['F', 'M'].map((value) => ({ value, label: locale.t(`start.sex.${value}`) })));
  radioGroup(
    dom.startCountry,
    'start.country_label',
    'countryId',
    countries
      .map((c) => ({ value: c.id, label: locale.t(`country.${c.id}`), image: `/src/ui/flags/${c.id}.svg` }))
      .sort((a, b) => a.label.localeCompare(b.label, locale.language)),
  );

  const country = countries.find((c) => c.id === form.countryId);
  dom.startCityLabel.textContent = locale.t('start.city_label');
  clearChildren(dom.startCity);
  for (const cityId of country.cities) {
    const option = el('option', { text: locale.t(`city.${cityId}`) });
    option.value = cityId;
    option.selected = cityId === form.cityId;
    dom.startCity.appendChild(option);
  }
  dom.startCity.onchange = () => onFormChange({ cityId: dom.startCity.value }, { rerender: false });

  dom.startBegin.textContent = locale.t('start.begin');
  dom.startBack.textContent = locale.t('start.back');
  dom.startBack.onclick = onBack;
  dom.startForm.onsubmit = (event) => {
    event.preventDefault();
    onBegin();
  };
}
