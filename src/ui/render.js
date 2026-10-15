// DOM rendering. Reads state, never changes it; every action goes back to
// app.js through a callback.

import { ageAt } from '../engine/time.js';
import { affinityBand } from './affinityColor.js';
import { fullName } from '../systems/naming.js';
import { describeHistory, trainingLine, trainingEventLine, enrollmentLine, clubName, teamName, teamEntryLine } from './diary.js';
import { isAdult, availableInteractions, availableActivities, closePeople, playerOccupation, assetShop, clubTryouts, playerTeams } from './gameState.js';
import { nextSeasonStart } from '../systems/teams.js';
import { assetPrice, resalePrice } from '../systems/assets.js';
import { avatarElement, sexIconElement, nameElement } from './avatarElement.js';
import { lifeSummary } from '../systems/lifeEnd.js';
import { schoolPeople } from '../systems/schoolmates.js';
import { schoolStageAt } from '../systems/school.js';
import { moodOf } from '../systems/personality.js';

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

// Label and percentage on one line, a thin bar under it. The bar is coloured
// by how good the value is, unless a fixed band is given (a skill at 3% is
// just a beginning, not bad news).
function meter(label, value, band = affinityBand(value)) {
  const wrapper = el('div', { className: 'meter' });
  const head = el('div', { className: 'meter-head' });
  head.append(el('span', { text: label }), el('span', { text: `${Math.round(value)}%` }));
  const track = el('div', { className: 'bar-track' });
  const fill = el('div', { className: `bar-fill ${band}` });
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
  const key = person.species ? `role.pet.${person.species}` : `role.${role}`;
  return locale.format(key, {}, { self: person.sex });
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

// Babies and puppies in months ("8 meses"), everyone else in years.
function ageText(state, locale, person) {
  const months = state.currentMonthIndex - person.birth;
  return months < 24 ? locale.age(months) : locale.plural('age.years', ageAt(person.birth, state.currentMonthIndex));
}

export function renderHeader(dom, state, locale) {
  const player = state.people[state.player.id];
  const countryName = locale.t(`country.${state.country.id}`);
  clearChildren(dom.topAvatar);
  dom.topAvatar.appendChild(avatarElement(player, ageOf(state, player), 52));
  // ♂/♀ before the name, the country flag after it.
  const flag = el('img', { className: 'flag' });
  flag.src = `src/ui/flags/${state.country.id}.svg`;
  flag.alt = locale.format('ui.flag_alt', { country: countryName });
  flag.width = 21;
  flag.height = 14;
  clearChildren(dom.topName);
  dom.topName.appendChild(nameElement(fullName(player, state.country), { before: sexIconElement(player.sex), after: flag }));
  dom.topPhase.textContent = occupationLabel(state, locale);
  dom.topMoney.textContent = locale.money(player.money, state.country.currency.code, state.country.currency.display);
  dom.topMoneyLabel.textContent = locale.t('ui.balance');
}

function moodLabel(locale, person, month) {
  return locale.format(`mood.${moodOf(person, month)}`, {}, { self: person.sex });
}

// "paciente, generosa"
function traitsLabel(locale, person) {
  return locale.list(person.traits.map((trait) => locale.format(`trait.${trait}`, {}, { self: person.sex })));
}

export function renderStats(dom, state, locale) {
  const player = state.people[state.player.id];
  dom.mood.textContent = locale.format('ui.mood', { mood: moodLabel(locale, player, state.currentMonthIndex) });
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
  dom.summaryPersonality.textContent = player.traits.length > 0 ? locale.format('ui.personality', { traits: traitsLabel(locale, player) }) : '';
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
    nameElement(fullName(person, state.country), { before: sexIconElement(person.sex) }),
    el('span', {
      className: 'detail',
      text: locale.format('ui.person_subtitle', {
        role: roleLabel(locale, relationship.roles[personId], person),
        age: ageText(state, locale, person),
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
  renderSchoolTeams(dom, state, locale, stage);
}

// Team sports the player trains or plays: the school team (whose tryout
// comes at the start of each school year) and any club team.
function renderSchoolTeams(dom, state, locale, stage) {
  const sports = playerTeams(state);
  dom.schoolTeamsTitle.textContent = locale.t('ui.school_teams');
  dom.schoolTeamsTitle.hidden = !stage || sports.length === 0;
  clearChildren(dom.schoolTeams);
  if (!stage) return;
  const nextTryout = locale.monthName(nextSeasonStart(state.currentMonthIndex, state.country.education.schoolYearStartMonth));
  for (const { activityId, teams, onSchoolTeam } of sports) {
    const row = el('div', { className: 'row' });
    row.append(
      el('strong', { text: locale.t(`activity.${activityId}.title`) }),
      el('span', { className: 'detail', text: onSchoolTeam ? locale.t('ui.school_team_member') : locale.format('ui.school_team_next', { month: nextTryout }) }),
    );
    for (const team of teams.filter((t) => t.clubId)) {
      row.append(el('span', { className: 'detail', text: locale.format('ui.school_team_club', { team: teamName(locale, team.teamLevelId, state.clubsById[team.clubId]) }) }));
    }
    dom.schoolTeams.appendChild(row);
  }
}

// Same variant as the diary line it matches (see diary.js).
function lastLineSeed(state, type) {
  const block = state.history.at(-1);
  const index = block.entries.map((e) => e.type).lastIndexOf(type);
  return `${block.month}:${index}`;
}

function interactionResultText(state, result, locale, sexes) {
  if (!result.attempted) return result.reason === 'limit' ? locale.t('ui.interaction_limit') : '';
  return locale.format(`interaction.${result.interactionId}.${result.succeeded ? 'success' : 'failure'}`, {}, sexes, lastLineSeed(state, 'interaction'));
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
  dom.profileTitle.append(avatarElement(person, ageOf(state, person), 56), nameElement(fullName(person, state.country)));
  dom.profileSubtitle.textContent = locale.format('ui.person_subtitle', {
    role: roleLabel(locale, role, person),
    age: ageText(state, locale, person),
  });

  // Mood and personality help the player guess how an interaction will go.
  const details = person.species ? [] : [locale.format('ui.mood', { mood: moodLabel(locale, person, state.currentMonthIndex) })];
  if (person.traits.length > 0) details.push(locale.format('ui.personality', { traits: traitsLabel(locale, person) }));
  dom.profileTraits.textContent = details.join('. ');

  clearChildren(dom.profileAffinity);
  dom.profileAffinity.append(
    meter(locale.t('ui.affinity_they_feel'), relationship.affinity[personId]),
    meter(locale.t('ui.affinity_you_feel'), relationship.affinity[state.player.id]),
  );
  if (typeof person.stress === 'number') dom.profileAffinity.append(meter(locale.t('ui.stress'), person.stress));

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
  dom.profileResult.textContent = result && result.targetId === personId ? interactionResultText(state, result, locale, sexesOf(state)) : '';
}

const ACTIVITY_BLOCKER_KEYS = {
  limit: 'ui.activity_limit',
  money: 'ui.activity_no_money',
  injured: 'ui.activity_injured',
  notEnrolled: 'ui.activity_notEnrolled',
  competed: 'ui.activity_competed',
};

// Why asking for an enrollment did nothing (enrollPlayer).
const ENROLLMENT_REASON_KEYS = { asked: 'ui.enroll_asked', noParent: 'ui.enroll_no_parent' };

function enrollmentResultText(state, result, locale, sexes) {
  if (result.enrollmentEntry) return enrollmentLine(state, locale, result.enrollmentEntry);
  if (result.reason === 'money') return locale.t(result.parentAsked ? 'ui.enroll_parents_no_money' : 'ui.enroll_no_money');
  return locale.format(ENROLLMENT_REASON_KEYS[result.reason], {}, sexes);
}

// A competition's lines: the result, an injury, the prize.
function competitionResultText(state, result, locale) {
  const { code, display } = state.country.currency;
  return result.competitionEntries
    .map((entry) =>
      entry.type === 'money'
        ? locale.format('diary.money.gain', { amount: locale.money(entry.amount, code, display) })
        : trainingEventLine(locale, entry, state.player.sex),
    )
    .join(' ');
}

// Why a club tryout couldn't be signed up for (teams.js, game.js).
const TRYOUT_BLOCKERS = ['asked', 'signedUp', 'onTeam', 'otherClub', 'alreadyTried', 'age', 'noSport', 'notInSchool'];

function activityResultText(state, result, locale, sexes) {
  if (result.parentPayEntry && !result.attempted) return enrollmentLine(state, locale, result.parentPayEntry);
  if (result.reason === 'asked' && !('enrollmentEntry' in result) && !result.tryoutEntries) return locale.t('ui.parents_pay_asked');
  if (result.tryoutEntries) return result.tryoutEntries.map((entry) => teamEntryLine(state, locale, entry)).join(' ');
  if (TRYOUT_BLOCKERS.includes(result.reason)) return locale.t(`ui.tryout_blocked.${result.reason}`);
  if (result.competitionEntries) return competitionResultText(state, result, locale);
  if ('enrollmentEntry' in result) return enrollmentResultText(state, result, locale, sexes);
  if (!result.attempted) return locale.format(ACTIVITY_BLOCKER_KEYS[result.reason], {}, sexes);
  // Events with options open the decision pop-up; the rest are told here.
  const eventTexts = result.triggeredEvents
    .map((eventId) => `event.${eventId}.text`)
    .filter((key) => locale.has(key))
    .map((key) => locale.format(key, {}, sexes));
  // When the parents paid for it, that comes first.
  const paidBy = result.parentPayEntry ? [enrollmentLine(state, locale, result.parentPayEntry)] : [];
  if (result.training) {
    const events = result.trainingEvents.map((entry) => trainingEventLine(locale, entry, state.player.sex));
    return [...paidBy, trainingLine(locale, result.activityId, result.training), ...events, ...eventTexts].join(' ');
  }
  const outcome = result.succeeded === false ? 'failed' : 'done';
  return [...paidBy, locale.format(`activity.${result.activityId}.${outcome}`, {}, sexes, lastLineSeed(state, 'activity')), ...eventTexts].join(' ');
}

// Skills (training.js): level and skill bar, sessions left in the period
// and the techniques learned so far.
// The trophy shelf of one activity: "Medalhas: 2 ouros e 1 bronze".
function medalsLine(medals, locale) {
  const parts = ['gold', 'silver', 'bronze'].filter((place) => medals[place] > 0).map((place) => locale.plural(`ui.medal.${place}`, medals[place]));
  return parts.length > 0 ? locale.format('ui.medals', { list: locale.list(parts) }) : null;
}

function trainingDetails({ id, skill, levelId, stripes, techniques, usesLeft, competition }, locale) {
  const name = locale.t(`level.${id}.${levelId}`);
  const level = stripes > 0 ? locale.plural('ui.training_stripes', stripes, { level: name }) : name;
  const nodes = [
    meter(level.charAt(0).toLocaleUpperCase(locale.language) + level.slice(1), skill, 'skill'),
    el('span', { className: 'detail', text: locale.plural('ui.training_uses_left', usesLeft) }),
  ];
  if (techniques.length > 0) {
    const list = locale.list(techniques.map((t) => locale.t(`technique.${id}.${t}`)));
    nodes.push(el('span', { className: 'detail', text: locale.format('ui.training_techniques', { list }) }));
  }
  const medals = competition && medalsLine(competition.medals, locale);
  if (medals) nodes.push(el('span', { className: 'detail', text: medals }));
  return nodes;
}

// Design doc: lists with title and a one-line description. Activities the
// player can't do right now stay visible, disabled, with the reason.
// Enrollment line inside the row, and the buttons to ask or leave under it.
function enrollmentDetail({ enrollment }, state, locale) {
  const amount = locale.money(enrollment.fee, state.country.currency.code, state.country.currency.display);
  if (enrollment.enrolled) {
    const line = locale.format(`ui.enrolled_${enrollment.paidBy}`, { amount }, sexesOf(state));
    return enrollment.owedMonths ? `${line} ${locale.format('ui.enrollment_late', { months: locale.plural('age.months', enrollment.owedMonths) })}` : line;
  }
  if (enrollment.trainsWithTeam) return locale.t('ui.trains_with_team');
  return locale.format('ui.enroll_fee', { amount });
}

function enrollmentButtons({ id, enrollment, competition, teamSport }, state, locale, { onEnroll, onLeave, onCompete, onOpenClubs }) {
  const submenu = el('div', { className: 'submenu' });
  const busy = state.pendingDecisions.length > 0;
  const add = (key, onClick, disabled = false) => {
    const button = el('button', { text: locale.format(key, {}, sexesOf(state)) });
    button.type = 'button';
    button.disabled = busy || disabled;
    button.addEventListener('click', onClick);
    submenu.appendChild(button);
  };
  // Team sports: the clubs and their tryouts, enrolled in the class or not.
  if (teamSport) add('ui.clubs_open', () => onOpenClubs(id));
  if (enrollment.enrolled) {
    // The tier the skill allows; disabled after competing or while injured.
    if (competition && competition.blocker !== 'none') {
      const tier = locale.t(`competitionTier.${competition.tier}`);
      const button = el('button', { text: locale.format('ui.compete', { tier }) });
      button.type = 'button';
      button.disabled = busy || competition.blocker !== null;
      button.addEventListener('click', () => onCompete(id));
      submenu.appendChild(button);
    }
    add('ui.enroll_leave', () => onLeave(id));
  } else {
    for (const payer of enrollment.payerOptions) {
      add(payer === 'parents' ? 'ui.enroll_ask_parents' : 'ui.enroll_self', () => onEnroll(id, payer), enrollment.askedThisPeriod);
    }
  }
  return submenu;
}

function activityRow(item, state, locale, { onDoActivity, onEnroll, onLeave, onCompete, onOpenClubs, onAskParentsToPay }) {
  const { id, blocker } = item;
  const nodes = [];
  const button = el('button', { className: 'row activity' });
  button.type = 'button';
  button.disabled = blocker !== null || state.pendingDecisions.length > 0;
  button.append(
    el('strong', { text: locale.t(`activity.${id}.title`) }),
    el('span', { className: 'detail', text: blocker ? locale.format(ACTIVITY_BLOCKER_KEYS[blocker], {}, sexesOf(state)) : locale.t(`activity.${id}.description`) }),
  );
  if (item.enrollment) button.append(el('span', { className: 'detail', text: enrollmentDetail(item, state, locale) }));
  if (item.levelId && blocker !== 'notEnrolled') button.append(...trainingDetails(item, locale));
  for (const team of item.teamSport ? (state.people[state.player.id].teams ?? []).filter((t) => t.activityId === id) : []) {
    const club = team.clubId ? state.clubsById[team.clubId] : null;
    button.append(el('span', { className: 'detail', text: locale.format('ui.team_on', { team: teamName(locale, team.teamLevelId, club) }) }));
  }
  button.addEventListener('click', () => onDoActivity(id));
  nodes.push(button);
  if (item.enrollment) nodes.push(enrollmentButtons(item, state, locale, { onEnroll, onLeave, onCompete, onOpenClubs }));
  // Short of money: ask the parents to pay (once per period).
  if (item.askParents !== undefined) {
    const submenu = el('div', { className: 'submenu' });
    const ask = el('button', { text: locale.t('ui.ask_parents_pay') });
    ask.type = 'button';
    ask.disabled = !item.askParents || state.pendingDecisions.length > 0;
    ask.addEventListener('click', () => onAskParentsToPay(id));
    submenu.appendChild(ask);
    nodes.push(submenu);
  }
  return nodes;
}

// Activities with a `group` (martial arts, dances) sit behind one row that
// opens them, so twenty sports don't bury the rest of the screen.
function groupRow(group, items, open, locale, onToggleGroup) {
  const button = el('button', { className: `row activity-group${open ? ' open' : ''}` });
  button.type = 'button';
  button.setAttribute('aria-expanded', String(open));
  const enrolled = items.filter((a) => a.enrollment?.enrolled).length;
  button.append(
    el('strong', { text: locale.t(`activityGroup.${group}`) }),
    el('span', { className: 'detail', text: locale.plural(enrolled > 0 ? 'ui.activity_group_enrolled' : 'ui.activity_group_count', enrolled > 0 ? enrolled : items.length) }),
  );
  button.addEventListener('click', () => onToggleGroup(open ? null : group));
  return button;
}

// Design doc: lists with title and a one-line description. Activities the
// player can't do right now stay visible, disabled, with the reason.
// Atividades → modalidade → Clubes e peneiras (docs/atividades.md 7.3):
// the clubs of the player's city, then the rest of the country, each with
// category, tryout month and deadline, youngest age and requirement.
function clubRow(row, state, locale, activityId, onSignUp) {
  const nodes = [];
  const box = el('div', { className: 'row' });
  box.appendChild(el('strong', { text: clubName(locale, state.clubsById[row.clubId]) }));
  const dates = row.teamLevelId
    ? locale.format('ui.club_tryout', {
        level: locale.t(`teamLevel.${row.teamLevelId}`),
        month: locale.monthName(row.tryoutMonth),
        deadline: locale.monthName(row.deadline),
      })
    : locale.t('ui.club_no_level');
  const info = locale.format(row.local ? 'ui.club_info' : 'ui.club_info_city', {
    city: locale.t(`city.${row.cityId}`),
    age: row.minAge,
    requirement: locale.t(`ui.requirement.${row.requirement}`),
  });
  box.append(el('span', { className: 'detail', text: dates }), el('span', { className: 'detail', text: info }));
  if (row.lastSeason) {
    const { season, position, leagueId } = row.lastSeason;
    box.appendChild(el('span', { className: 'detail', text: locale.format('ui.club_last_season', { season, position, league: locale.t(`league.${leagueId}`) }) }));
  }
  if (row.onTeam) box.appendChild(el('span', { className: 'detail', text: locale.t('ui.club_on_team') }));
  else if (row.blocker) box.appendChild(el('span', { className: 'detail', text: locale.t(`ui.tryout_blocked.${row.blocker}`) }));
  nodes.push(box);
  if (!row.onTeam && !row.blocker) {
    const submenu = el('div', { className: 'submenu' });
    const button = el('button', { text: locale.t('ui.club_sign_up') });
    button.type = 'button';
    button.disabled = state.pendingDecisions.length > 0;
    button.addEventListener('click', () => onSignUp(activityId, row.clubId));
    submenu.appendChild(button);
    nodes.push(submenu);
  }
  return nodes;
}

function renderClubTryouts(dom, state, locale, activityId, { onCloseClubs, onSignUp }) {
  dom.activitiesBack.hidden = false;
  dom.activitiesBack.textContent = locale.t('ui.back');
  dom.activitiesBack.onclick = onCloseClubs;
  dom.activitiesTitle.textContent = locale.format('ui.clubs_title', { activity: locale.t(`activity.${activityId}.title`) });
  dom.activitiesResult.textContent = state.lastActivityResult ? activityResultText(state, state.lastActivityResult, locale, sexesOf(state)) : '';
  clearChildren(dom.activitiesList);
  const rows = clubTryouts(state, activityId);
  for (const [key, group] of [
    ['ui.clubs_local', rows.filter((r) => r.local)],
    ['ui.clubs_elsewhere', rows.filter((r) => !r.local)],
  ]) {
    if (group.length === 0) continue;
    const section = el('div', { className: 'activities-group' });
    section.appendChild(el('h2', { text: locale.t(key) }));
    for (const row of group) section.append(...clubRow(row, state, locale, activityId, onSignUp));
    dom.activitiesList.appendChild(section);
  }
}

export function renderActivities(dom, state, locale, callbacksAndView) {
  const { onDoActivity, onEnroll, onLeave, onCompete, onToggleGroup, onOpenClubs, onAskParentsToPay, openGroup = null, openClubs = null } = callbacksAndView;
  if (openClubs) {
    renderClubTryouts(dom, state, locale, openClubs, callbacksAndView);
    return;
  }
  dom.activitiesBack.hidden = true;
  dom.activitiesTitle.textContent = locale.t('ui.activities_title');
  dom.activitiesResult.textContent = state.lastActivityResult ? activityResultText(state, state.lastActivityResult, locale, sexesOf(state)) : '';
  const callbacks = { onDoActivity, onEnroll, onLeave, onCompete, onOpenClubs, onAskParentsToPay };

  clearChildren(dom.activitiesList);
  for (const group of availableActivities(state)) {
    const section = el('div', { className: 'activities-group' });
    section.appendChild(el('h2', { text: locale.t(`activityCategory.${group.category}`) }));

    const seenGroups = new Set();
    for (const item of group.activities) {
      if (!item.group) {
        section.append(...activityRow(item, state, locale, callbacks));
        continue;
      }
      if (seenGroups.has(item.group)) continue;
      seenGroups.add(item.group);
      const members = group.activities.filter((a) => a.group === item.group);
      const open = openGroup === item.group;
      section.appendChild(groupRow(item.group, members, open, locale, onToggleGroup));
      if (open) {
        const inner = el('div', { className: 'activity-group-items' });
        for (const member of members) inner.append(...activityRow(member, state, locale, callbacks));
        section.appendChild(inner);
      }
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
  const params = decision.clubId ? { club: clubName(locale, state.clubsById[decision.clubId]) } : {};
  dom.decisionPrompt.textContent = locale.format(`event.${decision.trigger}.prompt`, params, sexes);

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
      .map((c) => ({ value: c.id, label: locale.t(`country.${c.id}`), image: `src/ui/flags/${c.id}.svg` }))
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

function assetResultText(state, locale) {
  const result = state.lastAssetResult;
  if (!result) return '';
  const title = (id) => locale.t(`asset.${id}.title`);
  if (!result.done) return locale.format(`ui.asset_blocked.${result.reason}`, { items: '' });
  if (result.action === 'bought') return locale.format('ui.asset_bought', { item: title(result.assetId) });
  return locale.format('ui.asset_sold', { items: locale.list(result.dropped.map(title)) });
}

// Design: everything the player owns, and where to get more.
export function renderAssets(dom, state, locale, { onBuy, onSell }) {
  const player = state.people[state.player.id];
  const money = (amount) => locale.money(amount, state.country.currency.code, state.country.currency.display);
  const title = (id) => locale.t(`asset.${id}.title`);
  dom.assetsTitle.textContent = locale.t('ui.assets_title');
  dom.assetsResult.textContent = assetResultText(state, locale);

  clearChildren(dom.assetsOwned);
  dom.assetsOwned.appendChild(el('h2', { text: locale.t('ui.assets_owned') }));
  const owned = player.assets ?? [];
  if (owned.length === 0) dom.assetsOwned.appendChild(el('p', { className: 'empty', text: locale.t('ui.assets_empty') }));
  for (const { assetId } of owned) {
    const asset = state.assetsById[assetId];
    const row = el('div', { className: 'row asset-owned' });
    const text = el('div');
    text.append(el('strong', { text: title(assetId) }), el('span', { className: 'detail', text: locale.t(`asset.${assetId}.description`) }));
    const free = assetPrice(asset, state.country) === 0;
    const sell = el('button', {
      className: 'small-action',
      text: free ? locale.t('ui.asset_delete') : locale.format('ui.asset_sell', { price: money(resalePrice(asset, state.country)) }),
    });
    sell.type = 'button';
    sell.addEventListener('click', () => onSell(assetId));
    row.append(text, sell);
    dom.assetsOwned.appendChild(row);
  }

  clearChildren(dom.assetsShop);
  dom.assetsShop.appendChild(el('h2', { text: locale.t('ui.assets_shop') }));
  for (const group of assetShop(state)) {
    const section = el('div', { className: 'activities-group' });
    section.appendChild(el('h3', { text: locale.t(`assetCategory.${group.category}`) }));
    for (const { id, price, blocker } of group.items) {
      const button = el('button', { className: 'row activity' });
      button.type = 'button';
      button.disabled = blocker !== null;
      const requires = (state.assetsById[id].requires ?? []).map(title);
      const detail = blocker
        ? locale.format(`ui.asset_blocked.${blocker}`, { items: locale.list(requires) })
        : locale.t(`asset.${id}.description`);
      button.append(
        el('strong', { text: title(id) }),
        el('span', { className: 'price', text: price === 0 ? locale.t('ui.asset_get_free') : locale.format('ui.asset_buy', { price: money(price) }) }),
        el('span', { className: 'detail', text: detail }),
      );
      button.addEventListener('click', () => onBuy(id));
      section.appendChild(button);
    }
    dom.assetsShop.appendChild(section);
  }
}
