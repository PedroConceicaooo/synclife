import { loadGameData, loadLocale } from './data.js';
import { createLocale } from '../i18n/locale.js';
import { createGameState, advanceStep, resolveDecision, attemptPlayerInteraction, attemptPlayerActivity } from './gameState.js';
import { renderStatus, renderProfile, renderActivities, renderDecisionModal } from './render.js';

const dom = {
  statusScreen: document.getElementById('status-screen'),
  statusTitle: document.getElementById('status-title'),
  statusFields: document.getElementById('status-fields'),
  statusStats: document.getElementById('status-stats'),
  statusPeople: document.getElementById('status-people'),
  statusAdvance: document.getElementById('status-advance'),
  statusNav: document.getElementById('status-nav'),
  profileScreen: document.getElementById('profile-screen'),
  profileBack: document.getElementById('profile-back'),
  profileTitle: document.getElementById('profile-title'),
  profileAffinity: document.getElementById('profile-affinity'),
  profileInteractions: document.getElementById('profile-interactions'),
  profileResult: document.getElementById('profile-result'),
  activitiesScreen: document.getElementById('activities-screen'),
  activitiesBack: document.getElementById('activities-back'),
  activitiesTitle: document.getElementById('activities-title'),
  activitiesResult: document.getElementById('activities-result'),
  activitiesList: document.getElementById('activities-list'),
  decisionModal: document.getElementById('decision-modal'),
  decisionPrompt: document.getElementById('decision-prompt'),
  decisionOptions: document.getElementById('decision-options'),
};

async function main() {
  const [gameData, localeEntries] = await Promise.all([loadGameData(), loadLocale()]);
  const locale = createLocale(localeEntries);

  let state = createGameState({ seed: Date.now(), ...gameData });
  let view = { screen: 'status' };

  function render() {
    dom.statusScreen.hidden = view.screen !== 'status';
    dom.profileScreen.hidden = view.screen !== 'profile';
    dom.activitiesScreen.hidden = view.screen !== 'activities';

    if (view.screen === 'status') {
      renderStatus(dom, state, locale, {
        onAdvance: (months) => {
          state = advanceStep(state, months);
          render();
        },
        onOpenProfile: (personId) => {
          view = { screen: 'profile', personId, category: null };
          render();
        },
        onOpenActivities: () => {
          state = { ...state, lastActivityResult: null };
          view = { screen: 'activities' };
          render();
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
      },
    });
  }

  for (const backButton of [dom.profileBack, dom.activitiesBack]) {
    backButton.addEventListener('click', () => {
      view = { screen: 'status' };
      render();
    });
  }

  render();
}

main();
