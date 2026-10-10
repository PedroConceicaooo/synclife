import { loadGameData, loadLocale } from './data.js';
import { createLocale } from '../i18n/locale.js';
import {
  createGameState,
  advanceStep,
  resolveDecision,
  attemptPlayerInteraction,
  attemptPlayerActivity,
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
  summary: byId('summary'),
  summaryTitle: byId('summary-title'),
  summaryStatsTitle: byId('summary-stats-title'),
  summaryStats: byId('summary-stats'),
  summaryMilestonesTitle: byId('summary-milestones-title'),
  summaryMilestones: byId('summary-milestones'),
  summaryRelationsTitle: byId('summary-relations-title'),
  summaryRelations: byId('summary-relations'),
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
  const [gameData, localeEntries] = await Promise.all([loadGameData(), loadLocale()]);
  const locale = createLocale(localeEntries);

  const newLife = () => createGameState({ seed: Date.now(), ...gameData });
  let state = readSave(gameData) ?? newLife();
  let view = { screen: 'life' };

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
    for (const [screen, key] of Object.entries(SCREENS)) dom[key].hidden = view.screen !== screen;

    renderHeader(dom, state, locale);
    renderStats(dom, state, locale);
    renderControls(dom, state, locale, view, {
      onAdvance: (months) => {
        update(advanceStep(state, months), { screen: 'life' });
        scrollDiaryToEnd();
      },
      onTab: (tab) => {
        const next = tab === 'activities' ? { ...state, lastActivityResult: null } : state;
        update(next, { screen: tab });
        if (tab === 'life') scrollDiaryToEnd();
        else dom.screens.scrollTo({ top: 0 });
      },
      onNewLife: () => {
        update(newLife(), { screen: 'life' });
        dom.screens.scrollTo({ top: 0 });
      },
      onContinueAs: (siblingId) => {
        update(continueAsSibling(state, siblingId), { screen: 'life' });
        dom.screens.scrollTo({ top: 0 });
      },
    });

    if (view.screen === 'life') {
      renderDiary(dom, state, locale);
      renderSummary(dom, state, locale);
    } else if (view.screen === 'relations') {
      renderRelations(dom, state, locale, {
        onOpenProfile: (personId) => {
          update(state, { screen: 'profile', personId, category: null });
          dom.screens.scrollTo({ top: 0 });
        },
      });
    } else if (view.screen === 'activities') {
      renderActivities(dom, state, locale, {
        onDoActivity: (activityId) => update(attemptPlayerActivity(state, activityId)),
      });
    } else {
      renderProfile(dom, state, locale, view.personId, view.category, {
        onBack: () => update(state, { screen: 'relations' }),
        onInteract: (interactionId, targetPersonId) => update(attemptPlayerInteraction(state, interactionId, targetPersonId)),
        onSelectCategory: (category) => update(state, { ...view, category }),
      });
    }

    renderDecisionModal(dom, state, locale, {
      onChoose: (optionId) => {
        update(resolveDecision(state, optionId));
        if (view.screen === 'life') scrollDiaryToEnd();
      },
    });
  }

  render();
  scrollDiaryToEnd();
}

main();
