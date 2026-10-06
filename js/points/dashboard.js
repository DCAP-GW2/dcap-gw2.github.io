import { getPointsData } from './api.js';
import './validation.js';

/** Keep the static reference markup intact until validated rendering is available. */
function renderDataStatus(root, result) {
  root.dataset.pointsState = result.state;
  root.querySelector('[data-points-status]').textContent = 'Static migration preview';
}

/** Reuse the canonical rule value rather than maintaining a second snapshot. */
function renderSeasonMetadata(root) {
  root.querySelector('[data-points-rule-reference]').textContent =
    root.querySelector('[data-points-rule-version]').textContent;
}

/** Supplement the shared menu without changing homepage behaviour. */
function enhanceNavigation() {
  const button = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.primary-nav');

  // Run before the shared Escape handler hides the focused navigation link.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      button.focus();
    }
  }, { capture: true });

  // The shared menu locks scrolling; keep keyboard focus inside it while open.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || button.getAttribute('aria-expanded') !== 'true') return;
    const lastLink = navigation.querySelector('a:last-child.button');
    if (event.shiftKey && document.activeElement === button) {
      event.preventDefault();
      lastLink.focus();
    } else if (!event.shiftKey && document.activeElement === lastLink) {
      event.preventDefault();
      button.focus();
    }
  });
}

async function initialiseDashboard() {
  const root = document.querySelector('[data-points-dashboard]');
  if (!root) return;
  renderSeasonMetadata(root);
  enhanceNavigation();
  renderDataStatus(root, await getPointsData());
}

initialiseDashboard();
