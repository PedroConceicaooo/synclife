import { loadGameData, loadLocale } from './data.js';
import { createLocale } from '../i18n/locale.js';
import {
  createGameState,
  advanceStep,
  resolveDecision,
  attemptPlayerInteraction,
  attemptPlayerActivity,
} from './gameState.js';
import {
  renderHeader,
  renderStats,
  renderDiary,
  renderControls,
  renderRelations,
  renderProfile,
  renderActivities,
  renderDecisionModal,
} from './render.js';

const byId = (id) => document.getElementById(id);

const dom = {
  topFlag: byId('top-flag'),
  topName: byId('top-name'),
  topPhase: byId('top-phase'),
  topMoney: byId('top-money'),
  topMoneyLabel: byId('top-money-label'),
  screens: byId('screens'),
  lifeScreen: byId('life-screen'),
  diary: byId('diary'),
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
  tabs: byId('tabs'),
  stats: byId('stats'),
  decisionModal: byId('decision-modal'),
  decisionPrompt: byId('decision-prompt'),
  decisionOptions: byId('decision-options'),
};

const SCREENS = { life: 'lifeScreen', relations: 'relationsScreen', profile: 'profileScreen', activities: 'activitiesScreen' };

async function main() {
  const [gameData, localeEntries] = await Promise.all([loadGameData(), loadLocale()]);
  const locale = createLocale(localeEntries);

  let state = createGameState({ seed: Date.now(), ...gameData });
  let view = { screen: 'life' };

  // The newest diary block sits at the bottom; show it after each change.
  function scrollDiaryToEnd() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    dom.screens.scrollTo({ top: dom.screens.scrollHeight, behavior });
  }

  function render() {
    for (const [screen, key] of Object.entries(SCREENS)) dom[key].hidden = view.screen !== screen;

    renderHeader(dom, state, locale);
    renderStats(dom, state, locale);
    renderControls(dom, state, locale, view, {
      onAdvance: (months) => {
        state = advanceStep(state, months);
        view = { screen: 'life' };
        render();
        scrollDiaryToEnd();
      },
      onTab: (tab) => {
        if (tab === 'activities') state = { ...state, lastActivityResult: null };
        view = { screen: tab };
        render();
        if (tab === 'life') scrollDiaryToEnd();
        else dom.screens.scrollTo({ top: 0 });
      },
    });

    if (view.screen === 'life') {
      renderDiary(dom, state, locale);
    } else if (view.screen === 'relations') {
      renderRelations(dom, state, locale, {
        onOpenProfile: (personId) => {
          view = { screen: 'profile', personId, category: null };
          render();
          dom.screens.scrollTo({ top: 0 });
        },
      });
    } else if (view.screen === 'activities') {
      renderActivities(dom, state, locale, {
        onDoActivity: (activityId) => {
          state = attemptPlayerActivity(state, activityId);
          render();
        },
      });
    } else {
      renderProfile(dom, state, locale, view.personId, view.category, {
        onBack: () => {
          view = { screen: 'relations' };
          render();
        },
        onInteract: (interactionId, targetPersonId) => {
          state = attemptPlayerInteraction(state, interactionId, targetPersonId);
          render();
        },
        onSelectCategory: (category) => {
          view = { ...view, category };
          render();
        },
      });
    }

    renderDecisionModal(dom, state, locale, {
      onChoose: (optionId) => {
        state = resolveDecision(state, optionId);
        render();
        if (view.screen === 'life') scrollDiaryToEnd();
      },
    });
  }

  render();
}

main();
