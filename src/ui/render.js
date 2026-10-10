// DOM rendering. Reads state, never changes it; every action goes back to
// app.js through a callback.

import { ageAt } from '../engine/time.js';
import { affinityBand } from './affinityColor.js';
import { fullName } from '../systems/naming.js';
import { describeHistory } from './diary.js';
import { isAdult, availableInteractions, availableActivities, closePeople, playerOccupation } from './gameState.js';
import { avatarElement } from './avatar.js';
import { lifeSummary } from '../systems/lifeEnd.js';
import { schoolPeople } from '../systems/schoolmates.js';
import { schoolStageAt } from '../systems/school.js';

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

function schoolStageName(locale, countryId, stageId) {
  const localKey = `school.${countryId}.${stageId}`;
  return locale.t(locale.has(localKey) ? localKey : `school.${stageId}`);
}

const capitalize = (text, language) => text[0].toLocaleUpperCase(language) + text.slice(1);

// Under the name (design: "Bebê", "Ensino fundamental I", later a job).
function occupationLabel(state, locale) {
  const occupation = playerOccupation(state);
  if (occupation.type === 'school') {
    // Short and in the player's language; the school tab shows the local name.
    const countryKey = `status.school.${state.country.id}.${occupation.stageId}`;
    const stage = locale.t(locale.has(countryKey) ? countryKey : `status.school.${occupation.stageId}`);
    return locale.format('status.school', { stage, grade: occupation.grade });
  }
  return locale.t(`status.${occupation.type}`);
}

const ageOf = (state, person) => ageAt(person.birth, state.currentMonthIndex);

export function renderHeader(dom, state, locale) {
  const player = state.people[state.player.id];
  const countryName = locale.t(`country.${state.country.id}`);
  clearChildren(dom.topAvatar);
  dom.topAvatar.appendChild(avatarElement(player, ageOf(state, player), 52));
  dom.topNameText.textContent = fullName(player, state.country);
  dom.topFlag.src = `/src/ui/flags/${state.country.id}.svg`;
  dom.topFlag.alt = locale.format('ui.flag_alt', { country: countryName });
  dom.topPhase.textContent = occupationLabel(state, locale);
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

// Simple line icons for the tab bar (24 x 24, stroked with currentColor).
const TAB_ICONS = {
  school: 'M3 9l9-5 9 5-9 5-9-5z M7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5',
  assets: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  relations: 'M12 20s-7-4.4-7-9.8A4 4 0 0 1 12 7.6a4 4 0 0 1 7 2.6C19 15.6 12 20 12 20z',
  activities: 'M12 3l2.5 5.4 5.9.7-4.4 4 1.2 5.9L12 16.1 6.8 19l1.2-5.9-4.4-4 5.9-.7z',
};

function tabIcon(name) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', TAB_ICONS[name]);
  icon.appendChild(path);
  return icon;
}

// The school tab follows the stage of life: daycare, school, then a job.
function schoolTabLabel(state, locale) {
  const { type } = playerOccupation(state);
  if (type === 'adult') return locale.t('ui.tab_job');
  if (type === 'baby' || type === 'preschool') return locale.t('ui.tab_daycare');
  return locale.t('ui.tab_school');
}

// Design (from BitLife's structure): four tabs around a big round advance
// button, split in two — one year on top, six months below.
export function renderControls(dom, state, locale, view, { onAdvance, onTab, onNewLife, onContinueAs }) {
  const adult = isAdult(state);

  clearChildren(dom.advance);
  dom.advance.hidden = !adult;
  if (adult) {
    // At 18: a new life or carrying on as a younger sibling.
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
  }

  const activeTab = view.screen === 'profile' ? view.from : view.screen;
  function tab(name, label) {
    const button = el('button', { className: 'tab' });
    button.type = 'button';
    button.setAttribute('aria-current', String(name === activeTab));
    button.append(tabIcon(name), el('span', { text: label }));
    // Tapping the open tab again goes back to the diary.
    button.addEventListener('click', () => onTab(name === activeTab ? 'life' : name));
    return button;
  }

  const circle = el('div', { className: 'advance-circle' });
  const blocked = adult || state.pendingDecisions.length > 0;
  for (const [months, labelKey, ariaKey] of [
    [12, 'ui.advance_plus_year', 'ui.advance_1_year'],
    [6, 'ui.advance_plus_half', 'ui.advance_6_months'],
  ]) {
    const button = el('button', { text: locale.t(labelKey) });
    button.type = 'button';
    button.disabled = blocked;
    button.setAttribute('aria-label', locale.t(ariaKey));
    button.addEventListener('click', () => onAdvance(months));
    circle.appendChild(button);
  }

  clearChildren(dom.tabbar);
  dom.tabbar.append(
    tab('school', schoolTabLabel(state, locale)),
    tab('assets', locale.t('ui.tab_assets')),
    circle,
    tab('relations', locale.t('ui.tab_relations')),
    tab('activities', locale.t('ui.tab_activities')),
  );
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

// One tappable row per person: name, role and age, how much they like you.
function personRow(state, locale, personId, onOpenProfile) {
  const person = state.people[personId];
  const relationship = relationshipWith(state, personId);
  const item = el('li');
  const button = el('button', { className: 'row with-avatar' });
  button.type = 'button';
  const text = el('div');
  button.append(avatarElement(person, ageOf(state, person), 44), text);
  text.append(
    el('strong', { text: fullName(person, state.country) }),
    el('span', {
      className: 'detail',
      text: locale.format('ui.person_subtitle', {
        role: roleLabel(locale, relationship.roles[personId], person),
        age: locale.plural('age.years', ageAt(person.birth, state.currentMonthIndex)),
      }),
    }),
    meter(locale.t('ui.affinity_they_feel'), relationship.affinity[personId]),
  );
  button.addEventListener('click', () => onOpenProfile(personId));
  item.appendChild(button);
  return item;
}

export function renderRelations(dom, state, locale, { onOpenProfile }) {
  dom.relationsTitle.textContent = locale.t('ui.relations_title');
  clearChildren(dom.relationsList);
  for (const { personId } of closePeople(state)) dom.relationsList.appendChild(personRow(state, locale, personId, onOpenProfile));
}

// Design doc: acquaintances live on the screen of the place they share
// with the player — classmates and teachers on the school screen.
export function renderSchool(dom, state, locale, { onOpenProfile }) {
  const stage = schoolStageAt(state.player.birth, state.currentMonthIndex, state.country.education);
  const { classmates, teachers } = schoolPeople(state.relationships, state.player.id);
  // Stage names are written for mid-sentence use; a heading starts upper case.
  dom.schoolTitle.textContent = stage
    ? capitalize(schoolStageName(locale, state.country.id, stage.stageId), locale.language)
    : schoolTabLabel(state, locale);
  dom.schoolEmpty.textContent = stage ? '' : locale.t('ui.school_none');
  dom.schoolEmpty.hidden = Boolean(stage);

  for (const [titleEl, listEl, ids, titleKey] of [
    [dom.schoolClassmatesTitle, dom.schoolClassmates, classmates, 'ui.school_classmates'],
    [dom.schoolTeachersTitle, dom.schoolTeachers, teachers, 'ui.school_teachers'],
  ]) {
    titleEl.textContent = locale.t(titleKey);
    titleEl.hidden = !stage || ids.length === 0;
    clearChildren(listEl);
    if (stage) for (const id of ids) listEl.appendChild(personRow(state, locale, id, onOpenProfile));
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
  clearChildren(dom.profileTitle);
  dom.profileTitle.append(avatarElement(person, ageOf(state, person), 56), el('span', { text: fullName(person, state.country) }));
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

// Assets: placeholder until the assets system lands.
export function renderAssets(dom, state, locale) {
  dom.assetsTitle.textContent = locale.t('ui.assets_title');
  dom.assetsResult.textContent = '';
  clearChildren(dom.assetsOwned);
  dom.assetsOwned.appendChild(el('p', { className: 'empty', text: locale.t('ui.assets_empty') }));
  clearChildren(dom.assetsShop);
}
