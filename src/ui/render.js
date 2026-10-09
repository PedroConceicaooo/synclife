import { fromMonthIndex, ageAt } from '../engine/time.js';
import { affinityBand } from './affinityColor.js';
import { isAdult, availableInteractions } from './gameState.js';

function formatDate(monthIndex) {
  const { year, month } = fromMonthIndex(monthIndex);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function appendBar(container, label, value) {
  const row = document.createElement('div');
  row.className = 'stat-bar';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  const track = document.createElement('div');
  track.className = 'bar-track';
  const fill = document.createElement('div');
  fill.className = `bar-fill ${affinityBand(value)}`;
  fill.style.width = `${value}%`;
  track.appendChild(fill);

  const valueEl = document.createElement('span');
  valueEl.textContent = Math.round(value);

  row.append(labelEl, track, valueEl);
  container.appendChild(row);
}

export function renderStatus(dom, state, locale, { onAdvance, onOpenProfile }) {
  const player = state.people[state.player.id];

  dom.statusTitle.textContent = locale.t('ui.status_title');

  clearChildren(dom.statusFields);
  const fields = [
    [locale.t('ui.age_label'), ageAt(player.birth, state.currentMonthIndex)],
    [locale.t('ui.date_label'), formatDate(state.currentMonthIndex)],
    [locale.t('ui.country_label'), state.country.id],
    [locale.t('ui.money_label'), player.money.toFixed(2)],
  ];
  for (const [label, value] of fields) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dom.statusFields.append(dt, dd);
  }

  clearChildren(dom.statusStats);
  appendBar(dom.statusStats, locale.t('ui.stat_happiness'), player.stats.happiness);
  appendBar(dom.statusStats, locale.t('ui.stat_health'), player.stats.health);
  appendBar(dom.statusStats, locale.t('ui.stat_intelligence'), player.stats.intelligence);
  appendBar(dom.statusStats, locale.t('ui.stat_looks'), player.stats.looks);

  clearChildren(dom.statusPeople);
  for (const [personId, label] of [
    [state.mother.id, locale.t('ui.mother')],
    [state.father.id, locale.t('ui.father')],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => onOpenProfile(personId));
    dom.statusPeople.appendChild(button);
  }

  clearChildren(dom.statusAdvance);
  if (isAdult(state)) {
    const p = document.createElement('p');
    p.textContent = locale.t('ui.adulthood_placeholder');
    dom.statusAdvance.appendChild(p);
  } else {
    const blocked = state.pendingDecisions.length > 0;
    for (const [months, label] of [
      [6, locale.t('ui.advance_6_months')],
      [12, locale.t('ui.advance_1_year')],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = blocked;
      button.addEventListener('click', () => onAdvance(months));
      dom.statusAdvance.appendChild(button);
    }
  }
}

function interactionResultText(result, locale) {
  if (!result.attempted) return result.reason === 'limit' ? locale.t('ui.interaction_limit') : '';
  return locale.t(`interaction.${result.interactionId}.${result.succeeded ? 'success' : 'failure'}`);
}

// Categories first; tapping one opens its submenu (design doc: up to six
// categories, only those with at least one available option).
export function renderProfile(dom, state, locale, personId, openCategory, { onInteract, onSelectCategory }) {
  const relationship = Object.values(state.relationships).find(
    (r) => personId in r.roles && state.player.id in r.roles,
  );

  const role = relationship.roles[personId];
  dom.profileBack.textContent = locale.t('ui.back');
  dom.profileTitle.textContent = `${locale.t('ui.profile_title')}: ${locale.t(`role.${role}`)}`;

  clearChildren(dom.profileAffinity);
  appendBar(dom.profileAffinity, locale.t('ui.affinity_they_feel'), relationship.affinity[personId]);
  appendBar(dom.profileAffinity, locale.t('ui.affinity_you_feel'), relationship.affinity[state.player.id]);

  clearChildren(dom.profileInteractions);
  for (const group of availableInteractions(state, personId)) {
    const isOpen = group.category === openCategory;
    const categoryButton = document.createElement('button');
    categoryButton.type = 'button';
    categoryButton.className = isOpen ? 'category open' : 'category';
    categoryButton.textContent = locale.t(`interactionCategory.${group.category}`);
    categoryButton.addEventListener('click', () => onSelectCategory(isOpen ? null : group.category));
    dom.profileInteractions.appendChild(categoryButton);

    if (!isOpen) continue;
    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    for (const interactionId of group.interactionIds) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = locale.t(`interaction.${interactionId}.label`);
      button.addEventListener('click', () => onInteract(interactionId, personId));
      submenu.appendChild(button);
    }
    dom.profileInteractions.appendChild(submenu);
  }

  const result = state.lastInteractionResult;
  dom.profileResult.textContent = result && result.targetId === personId ? interactionResultText(result, locale) : '';
}

export function renderDecisionModal(dom, state, locale, { onChoose }) {
  if (state.pendingDecisions.length === 0) {
    dom.decisionModal.hidden = true;
    return;
  }

  const decision = state.pendingDecisions[0];
  const decisionEvent = state.eventsById[decision.trigger];

  dom.decisionModal.hidden = false;
  dom.decisionPrompt.textContent = locale.t(`event.${decision.trigger}.prompt`);

  clearChildren(dom.decisionOptions);
  for (const option of decisionEvent.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = locale.t(`event.${decision.trigger}.option.${option.id}`);
    button.addEventListener('click', () => onChoose(option.id));
    dom.decisionOptions.appendChild(button);
  }
}
