import { getPointsData } from './api.js';
import { memberNameNode } from './member-link.js';

const numberFormat = new Intl.NumberFormat('en-NZ');
const nameOrder = new Intl.Collator('en-NZ');
// Date-only metadata denotes calendar days, not instants in the visitor's zone.
const calendarFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland',
});
const updatedFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  hour12: true, timeZone: 'Pacific/Auckland',
});
const views = {
  current: {
    title: 'Current Season leaderboard', rank: 'currentRank', points: 'currentPoints',
    columns: ['Rank', 'Contributor', 'Points', 'Active Days', 'Role Diversity'],
    empty: 'No contributions have been recorded for this season yet.',
  },
  'all-time': {
    title: 'All-Time Leaderboard', rank: 'allTimeRank', points: 'allTimePoints',
    columns: ['Rank', 'Contributor', 'All-Time Points'],
    empty: 'No all-time leaderboard data is available yet.',
  },
};

function setText(root, selector, value) {
  root.querySelector(selector).textContent = value;
}

function renderMetadata(root, meta) {
  setText(root, '[data-points-season]', `Season ${meta.currentSeason} — ${meta.seasonLabel}`);
  setText(root, '[data-points-rule-version]', meta.ruleVersion);
  setText(root, '[data-points-total]', numberFormat.format(meta.totalPoints));
  setText(root, '[data-points-contributors]', numberFormat.format(meta.uniqueContributors));
  setText(root, '[data-points-active-days]', numberFormat.format(meta.activeDays));
  const dates = [meta.periodStart, meta.periodEnd].map(value => {
    const time = document.createElement('time');
    time.dateTime = value;
    const format = /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarFormat : dateFormat;
    time.textContent = format.format(new Date(value));
    return time;
  });
  root.querySelector('[data-points-period]').replaceChildren(dates[0], ' – ', dates[1]);
  root.querySelector('[data-leaderboard-meta]').hidden = false;
}

function renderStatus(root, result) {
  root.dataset.pointsState = result.data ? result.state : 'unavailable';
  setText(root, '[data-points-status]', result.data
    ? (result.state === 'fallback' ? 'Showing the most recently available data.' : 'Live data')
    : 'Leaderboard data is temporarily unavailable.');
  const updated = root.querySelector('[data-points-updated]');
  updated.replaceChildren();
  if (result.data) {
    const time = document.createElement('time');
    time.dateTime = result.data.meta.sourceUpdatedAt;
    time.textContent = updatedFormat.format(new Date(result.data.meta.sourceUpdatedAt));
    updated.append('Last updated ', time, ' (Auckland)');
  }
}

function renderView(root, view, members) {
  const definition = views[view];
  const current = view === 'current';
  setText(root, '#leaderboard-title', definition.title);
  setText(root, '[data-leaderboard-caption]', `${definition.title}, using published ranks`);
  root.querySelector('[data-current-summary]').hidden = !current;
  root.querySelector('[data-all-time-summary]').hidden = current;
  root.querySelector('[data-mobile-note]').hidden = !current || !members.length;
  for (const button of root.querySelectorAll('[data-leaderboard-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.leaderboardView === view));
  }

  const headings = definition.columns.map((label, index) => {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    if (index > 2) heading.className = 'points-leaderboard-secondary';
    return heading;
  });
  root.querySelector('[data-leaderboard-columns]').replaceChildren(...headings);
  const rows = document.createDocumentFragment();
  for (const member of members) {
    const row = document.createElement('tr');
    const rankCell = document.createElement('td');
    const rank = document.createElement('span');
    rank.className = `points-rank${member[definition.rank] === 1 ? ' points-rank-first' : ''}`;
    // Preserve published ranks, including ties, gaps, and zero; never renumber.
    rank.textContent = String(member[definition.rank]);
    rankCell.append(rank);
    const name = document.createElement('th');
    name.scope = 'row';
    name.append(memberNameNode(member, '../members/profile/'));
    const points = document.createElement('td');
    points.textContent = numberFormat.format(member[definition.points]);
    row.append(rankCell, name, points);
    if (current) {
      for (const key of ['activeDays', 'roleDiversity']) {
        const cell = document.createElement('td');
        cell.className = 'points-leaderboard-secondary';
        cell.textContent = numberFormat.format(member[key]);
        row.append(cell);
      }
    }
    rows.append(row);
  }
  root.querySelector('[data-leaderboard-rows]').replaceChildren(rows);
  root.querySelector('.points-leaderboard-table').hidden = !members.length;
  root.querySelector('[data-leaderboard-state]').hidden = Boolean(members.length);
  setText(root, '[data-leaderboard-message]', members.length ? '' : definition.empty);
}

/** Keep the shared mobile menu's keyboard behaviour consistent with Overview. */
function enhanceNavigation() {
  // If the shared script fails, retain the visible, usable HTML navigation.
  if (typeof closeMenu !== 'function') return;
  const button = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.primary-nav');
  document.body.classList.add('points-navigation-ready');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      button.focus();
    }
  }, { capture: true });
  document.addEventListener('keydown', event => {
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

async function initialiseLeaderboard() {
  const root = document.querySelector('[data-points-full-leaderboard]');
  if (!root) return;
  enhanceNavigation();
  const results = root.querySelector('#leaderboard-results');
  results.setAttribute('aria-busy', 'true');
  root.querySelector('[data-leaderboard-links]').hidden = true;
  setText(root, '[data-leaderboard-message]', 'Loading leaderboard…');
  setText(root, '[data-points-status]', 'Loading leaderboard…');

  try {
    const result = await getPointsData();
    renderStatus(root, result);
    if (!result.data) {
      setText(root, '[data-leaderboard-message]', 'Leaderboard data is temporarily unavailable.');
      root.querySelector('[data-leaderboard-links]').hidden = false;
      return;
    }
    renderMetadata(root, result.data.meta);
    // Prepare both complete lists once; switching views never requests data.
    const membersByView = {};
    for (const [view, definition] of Object.entries(views)) {
      membersByView[view] = result.data.members.filter(member => member[definition.points] > 0)
        .sort((a, b) => a[definition.rank] - b[definition.rank] ||
          nameOrder.compare(a.displayName, b.displayName));
    }
    setText(root, '[data-ranked-members]', numberFormat.format(membersByView['all-time'].length));
    root.querySelector('[data-leaderboard-summary]').hidden = false;
    let activeView = 'current';
    renderView(root, activeView, membersByView[activeView]);
    for (const button of root.querySelectorAll('[data-leaderboard-view]')) {
      button.disabled = false;
      button.addEventListener('click', () => {
        const view = button.dataset.leaderboardView;
        if (view === activeView) return;
        activeView = view;
        renderView(root, view, membersByView[view]);
      });
    }
  } catch {
    // An unexpected page error must not leave an endless loading state or raw error.
    renderStatus(root, { state: 'unavailable', data: null });
    root.querySelector('.points-leaderboard-table').hidden = true;
    root.querySelector('[data-leaderboard-summary]').hidden = true;
    root.querySelector('[data-leaderboard-state]').hidden = false;
    root.querySelector('[data-leaderboard-links]').hidden = false;
    setText(root, '[data-leaderboard-message]', 'Leaderboard data is temporarily unavailable.');
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

initialiseLeaderboard();
