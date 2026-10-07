import { getPointsData } from './api.js';

const numberFormat = new Intl.NumberFormat('en-NZ');
const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland',
});
const updatedFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  hour12: true, timeZone: 'Pacific/Auckland',
});

function setText(root, selector, value) {
  root.querySelector(selector).textContent = value;
}

function renderDataStatus(root, result) {
  root.dataset.pointsState = result.state;
  const status = result.data
    ? (result.state === 'fallback' ? 'Showing the most recently available data.' : 'Live data')
    : 'Points data is temporarily unavailable. Please try again later.';
  setText(root, '[data-points-status]', status);
  setText(root, '[data-points-label]', result.data
    ? (result.state === 'fallback' ? 'Most recently available data' : 'Live season overview')
    : 'Data unavailable');
  if (!result.data) {
    setText(root, '#contributors-note', 'Contributor data is temporarily unavailable.');
    setText(root, '[data-points-caption]', 'Contributor data unavailable');
  }
  const updated = root.querySelector('[data-points-updated]');
  updated.replaceChildren();
  if (result.data) {
    const timestamp = result.data.meta.sourceUpdatedAt;
    const time = document.createElement('time');
    time.dateTime = timestamp;
    time.textContent = updatedFormat.format(new Date(timestamp));
    updated.append('Last updated ', time, ' (Auckland)');
  }
}

function renderDashboard(root, data) {
  const { meta, members } = data;
  root.querySelector('[data-points-season-separator]').hidden = false;
  setText(root, '[data-points-season]', `Season ${meta.currentSeason}`);
  setText(root, '[data-points-season-label]', meta.seasonLabel);
  setText(root, '[data-points-rule-version]', meta.ruleVersion);
  setText(root, '[data-points-rule-reference]', meta.ruleVersion);
  setText(root, '[data-points-total]', numberFormat.format(meta.totalPoints));
  setText(root, '[data-points-contributors]', numberFormat.format(meta.uniqueContributors));
  setText(root, '[data-points-active-days]', numberFormat.format(meta.activeDays));
  const period = root.querySelector('[data-points-period]');
  const dates = [meta.periodStart, meta.periodEnd].map(value => {
    const time = document.createElement('time');
    time.dateTime = value;
    time.textContent = dateFormat.format(new Date(value));
    return time;
  });
  period.replaceChildren(dates[0], ' – ', dates[1]);

  const contributors = members.filter(member => member.currentPoints > 0)
    .sort((a, b) => a.currentRank - b.currentRank).slice(0, 5);
  const rows = document.createDocumentFragment();
  for (const member of contributors) {
    const row = document.createElement('tr');
    const rankCell = document.createElement('td');
    const rank = document.createElement('span');
    rank.className = `points-rank${member.currentRank === 1 ? ' points-rank-first' : ''}`;
    rank.textContent = numberFormat.format(member.currentRank);
    rankCell.append(rank);
    const name = document.createElement('th');
    name.scope = 'row';
    // Display names are authoritative public text. IDs never enter the DOM.
    name.textContent = member.displayName;
    const points = document.createElement('td');
    points.textContent = numberFormat.format(member.currentPoints);
    row.append(rankCell, name, points);
    rows.append(row);
  }
  root.querySelector('[data-points-leaderboard]').replaceChildren(rows);
  setText(root, '#contributors-note', contributors.length
    ? 'Current season contributions. Tied ranks are shared.'
    : 'No contributions have been recorded for this season yet.');
  setText(root, '[data-points-caption]', `Top ${contributors.length} current contributors, using published ranks`);
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
  setText(root, '[data-points-rule-reference]', root.querySelector('[data-points-rule-version]').textContent);
  enhanceNavigation();
  // Keep neutral HTML placeholders until the shared API returns validated data.
  const result = await getPointsData();
  if (result.data) renderDashboard(root, result.data);
  renderDataStatus(root, result);
}

initialiseDashboard();
