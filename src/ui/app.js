import { loadGameData, loadLocale } from './data.js';
import { createLocale } from '../i18n/locale.js';
import {
  createGameState,
  advanceStep,
  resolveDecision,
  attemptPlayerInteraction,
  attemptPlayerActivity,
  enrollPlayer,
  leavePlayerEnrollment,
  continueAdvance,
  playableCountries,
  buyPlayerAsset,
  sellPlayerAsset,
} from './gameState.js';
import { toSave, fromSave } from '../systems/save.js';
import { continueAsSibling } from '../systems/lifeEnd.js';
import {
  renderHeader,
  renderStats,
  renderDiary,
  renderSummary,
  renderControls,
  renderRelations,
  renderSchool,
  renderProfile,
  renderActivities,
  renderAssets,
  renderDecisionModal,
  renderStart,
} from './render.js';

const byId = (id) => document.getElementById(id);

const dom = {
  topAvatar: byId('top-avatar'),
  topName: byId('top-name'),
  topPhase: byId('top-phase'),
  topMoney: byId('top-money'),
  topMoneyLabel: byId('top-money-label'),
  screens: byId('screens'),
  lifeScreen: byId('life-screen'),
  diary: byId('diary'),
  app: byId('app'),
  startScreen: byId('start-screen'),
  startTagline: byId('start-tagline'),
  startChoice: byId('start-choice'),
  startRandom: byId('start-random'),
  startCustom: byId('start-custom'),
  startForm: byId('start-form'),
  startNameLabel: byId('start-name-label'),
  startName: byId('start-name'),
  startSex: byId('start-sex'),
  startCountry: byId('start-country'),
  startCityLabel: byId('start-city-label'),
  startCity: byId('start-city'),
  startBegin: byId('start-begin'),
  startBack: byId('start-back'),
  disclaimer: byId('disclaimer'),
  summary: byId('summary'),
  summaryTitle: byId('summary-title'),
  summaryStatsTitle: byId('summary-stats-title'),
  summaryStats: byId('summary-stats'),
  summaryMilestonesTitle: byId('summary-milestones-title'),
  summaryMilestones: byId('summary-milestones'),
  summaryRelationsTitle: byId('summary-relations-title'),
  summaryRelations: byId('summary-relations'),
  schoolScreen: byId('school-screen'),
  schoolTitle: byId('school-title'),
  schoolEmpty: byId('school-empty'),
  schoolClassmatesTitle: byId('school-classmates-title'),
  schoolClassmates: byId('school-classmates'),
  schoolTeachersTitle: byId('school-teachers-title'),
  schoolTeachers: byId('school-teachers'),
  relationsScreen: byId('relations-screen'),
  relationsTitle: byId('relations-title'),
  relationsList: byId('relations-list'),
  profileScreen: byId('profile-screen'),
  profileBack: byId('profile-back'),
  profileTitle: byId('profile-title'),
  profileSubtitle: byId('profile-subtitle'),
  profileAffinity: byId('profile-affinity'),
  profileInteractions: byId('profile-interactions'),
  profileResult: byId('profile-result'),
  activitiesScreen: byId('activities-screen'),
  activitiesTitle: byId('activities-title'),
  activitiesResult: byId('activities-result'),
  activitiesList: byId('activities-list'),
  advance: byId('advance'),
  tabbar: byId('tabbar'),
  assetsScreen: byId('assets-screen'),
  assetsTitle: byId('assets-title'),
  assetsResult: byId('assets-result'),
  assetsOwned: byId('assets-owned'),
  assetsShop: byId('assets-shop'),
  stats: byId('stats'),
  mood: byId('mood'),
  profileTraits: byId('profile-traits'),
  summaryPersonality: byId('summary-personality'),
  decisionModal: byId('decision-modal'),
  decisionPrompt: byId('decision-prompt'),
  decisionOptions: byId('decision-options'),
};

const SCREENS = {
  life: 'lifeScreen',
  relations: 'relationsScreen',
  school: 'schoolScreen',
  assets: 'assetsScreen',
  profile: 'profileScreen',
  activities: 'activitiesScreen',
};

// One save slot in this browser. Storage can be missing or full (private
// mode, blocked site data): the game still runs, it just won't remember.
const SAVE_KEY = 'synclife.save';

function readSave(gameData) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? fromSave(JSON.parse(raw), gameData) : null;
  } catch (error) {
    console.warn('Ignoring unreadable save:', error);
    return null;
  }
}

function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(state)));
  } catch (error) {
    console.warn('Could not save the game:', error);
  }
}

async function main() {
  const [gameData, { language, entries, fallback }] = await Promise.all([loadGameData(), loadLocale()]);
  const locale = createLocale(entries, language, fallback);

  const countries = playableCountries(gameData.countriesById);
  const newLife = (choices) => createGameState({ seed: Date.now(), ...gameData, choices });
  let state = readSave(gameData);
  // No save yet: the game opens on the start screen.
  let view = state ? { screen: 'life' } : { screen: 'start' };
  const freshForm = () => ({ open: false, firstName: '', sex: 'F', countryId: countries[0].id, cityId: countries[0].cities[0] });
  let form = freshForm();

  function renderStartScreen() {
    renderStart(dom, locale, countries, form, {
      onRandom: () => {
        update(newLife(), { screen: 'life' });
        dom.screens.scrollTo({ top: 0 });
      },
      onOpenCustom: () => {
        form = { ...form, open: true };
        render();
      },
      onBack: () => {
        form = { ...form, open: false };
        render();
      },
      onFormChange: (changes, { rerender = true } = {}) => {
        form = { ...form, ...changes };
        // A new country brings its own cities.
        if (changes.countryId) form.cityId = countries.find((c) => c.id === changes.countryId).cities[0];
        if (rerender) render();
      },
      onBegin: () => {
        const { firstName, sex, countryId, cityId } = form;
        form = freshForm();
        update(newLife({ firstName, sex, countryId, cityId }), { screen: 'life' });
        dom.screens.scrollTo({ top: 0 });
      },
    });
  }

  // The newest diary block sits at the bottom; show it after each change.
  function scrollDiaryToEnd() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    dom.screens.scrollTo({ top: dom.screens.scrollHeight, behavior });
  }

  // Every change to the game goes through here: save, then redraw.
  function update(nextState, nextView = view) {
    state = nextState;
    view = nextView;
    writeSave(state);
    render();
  }


  function render() {
    dom.startScreen.hidden = view.screen !== 'start';
    dom.app.hidden = view.screen === 'start';
    if (view.screen === 'start') {
      renderStartScreen();
      return;
    }
    for (const [screen, key] of Object.entries(SCREENS)) dom[key].hidden = view.screen !== screen;

    renderHeader(dom, state, locale);
    renderStats(dom, state, locale);
    renderControls(dom, state, locale, view, {
      onAdvance: (months) => {
        update(advanceStep(state, months), { screen: 'life' });
        scrollDiaryToEnd();
      },
      onTab: (tab) => {
        // A tab opens without the result message of the last visit.
        const next = { ...state, lastActivityResult: null, lastAssetResult: null };
        update(next, { screen: tab });
        if (tab === 'life') scrollDiaryToEnd();
        else dom.screens.scrollTo({ top: 0 });
      },
      // The finished life stays saved until the next one actually starts.
      onNewLife: () => {
        view = { screen: 'start' };
        render();
      },
      onContinueAs: (siblingId) => {
        update(continueAsSibling(state, siblingId), { screen: 'life' });
        dom.screens.scrollTo({ top: 0 });
      },
    });

    if (view.screen === 'life') {
      renderDiary(dom, state, locale);
      renderSummary(dom, state, locale);
    } else if (view.screen === 'relations' || view.screen === 'school') {
      // The profile remembers which list it was opened from, for "Voltar".
      const from = view.screen;
      const onOpenProfile = (personId) => {
        update(state, { screen: 'profile', personId, category: null, from });
        dom.screens.scrollTo({ top: 0 });
      };
      if (from === 'relations') renderRelations(dom, state, locale, { onOpenProfile });
      else renderSchool(dom, state, locale, { onOpenProfile });
    } else if (view.screen === 'assets') {
      renderAssets(dom, state, locale, {
        onBuy: (assetId) => update(buyPlayerAsset(state, assetId)),
        onSell: (assetId) => update(sellPlayerAsset(state, assetId)),
      });
    } else if (view.screen === 'activities') {
      renderActivities(dom, state, locale, {
        onDoActivity: (activityId) => update(attemptPlayerActivity(state, activityId)),
        onEnroll: (activityId, payer) => update(enrollPlayer(state, activityId, payer)),
        onLeave: (activityId) => update(leavePlayerEnrollment(state, activityId)),
        onToggleGroup: (group) => update(state, { ...view, group }),
        openGroup: view.group ?? null,
      });
    } else {
      renderProfile(dom, state, locale, view.personId, view.category, {
        onBack: () => update(state, { screen: view.from }),
        onInteract: (interactionId, targetPersonId) => update(attemptPlayerInteraction(state, interactionId, targetPersonId)),
        onSelectCategory: (category) => update(state, { ...view, category }),
      });
    }

    renderDecisionModal(dom, state, locale, {
      // After the last choice of an interrupted advance, the rest of the time
      // passes on its own (continueAdvance does nothing otherwise).
      onChoose: (optionId) => {
        update(continueAdvance(resolveDecision(state, optionId)));
        if (view.screen === 'life') scrollDiaryToEnd();
      },
    });
  }

  render();
  if (view.screen === 'life') scrollDiaryToEnd();
}

main();

// Installable and offline (design doc: the game starts as a PWA).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service worker not registered:', error));
}
