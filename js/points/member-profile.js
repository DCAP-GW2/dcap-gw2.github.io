import { getPointsData } from './api.js';
import { memberRecentContributions, memberRecentView, renderRecentContributions } from './recent-contributions.js';

const numberFormat = new Intl.NumberFormat('en-NZ');
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
function setText(root, selector, value) {
  root.querySelector(selector).textContent = value;
}

function renderMetadata(root, meta) {
  setText(root, '[data-points-season]', `Season ${meta.currentSeason} — ${meta.seasonLabel}`);
  setText(root, '[data-points-rule-version]', meta.ruleVersion);
  const dates = [meta.periodStart, meta.periodEnd].map(value => {
    const time = document.createElement('time');
    time.dateTime = value;
    const format = /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarFormat : dateFormat;
    time.textContent = format.format(new Date(value));
    return time;
  });
  root.querySelector('[data-points-period]').replaceChildren(dates[0], ' – ', dates[1]);
  root.querySelector('[data-member-meta]').hidden = false;
}

function renderStatus(root, result) {
  root.dataset.pointsState = result.data ? result.state : 'unavailable';
  setText(root, '[data-points-status]', result.data
    ? (result.state === 'fallback' ? 'Showing the most recently available data.' : 'Live data')
    : 'Member data is temporarily unavailable.');
  const updated = root.querySelector('[data-points-updated]');
  updated.replaceChildren();
  if (result.data) {
    const time = document.createElement('time');
    time.dateTime = result.data.meta.sourceUpdatedAt;
    time.textContent = updatedFormat.format(new Date(result.data.meta.sourceUpdatedAt));
    updated.append('Last updated ', time, ' (Auckland)');
  }
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

function renderMemberRecent(root, member) {
  const records = memberRecentContributions(member);
  const list = root.querySelector('[data-member-recent-list]');
  const message = root.querySelector('[data-member-recent-message]');
  const controls = root.querySelector('[data-member-recent-controls]');
  const toggle = root.querySelector('[data-member-recent-toggle]');
  list.hidden = !records?.length;
  message.hidden = Boolean(records?.length);
  controls.hidden = !records || !memberRecentView(records, false).showToggle;
  if (!records?.length) {
    list.replaceChildren();
    message.textContent = records === null ? 'Recent contribution detail is unavailable.'
      : 'No contributions have been recorded for this season yet.';
    return;
  }
  let expanded = false;
  function update() {
    const view = memberRecentView(records, expanded);
    renderRecentContributions(list, view.visible);
    toggle.textContent = view.label;
    toggle.setAttribute('aria-expanded', String(expanded));
  }
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    update();
  });
  update();
}

function renderProfile(root, member) {
  setText(root, '#points-title', member.displayName);
  document.title = `${member.displayName} | DCAP Points`;
  for (const key of ['currentPoints', 'allTimePoints', 'activeDays', 'roleDiversity', 'ttPoints', 'otherPoints']) {
    setText(root, `[data-member-${key}]`, numberFormat.format(member[key]));
  }
  for (const [points, rank] of [['currentPoints', 'currentRank'], ['allTimePoints', 'allTimeRank']]) {
    setText(root, `[data-member-${rank}]`, member[points] === 0 ? '—' : String(member[rank]));
  }
  root.querySelector('[data-current-empty]').hidden = member.currentPoints > 0;
  root.querySelector('[data-all-time-empty]').hidden = member.allTimePoints > 0;
  const rows = document.createDocumentFragment();
  for (const [key, label] of [
    ['commander', 'Commander'], ['blocker', 'Blocker'], ['mapSpammer', 'Map Spammer'],
    ['defenseSetup', 'Defense / Setup'], ['taxi', 'Taxi'], ['student', 'Student'],
  ]) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    const value = document.createElement('td');
    value.textContent = numberFormat.format(member[key]);
    row.append(heading, value);
    rows.append(row);
  }
  root.querySelector('[data-member-roles]').replaceChildren(rows);
  renderMemberRecent(root, member);
  root.querySelector('[data-member-state]').hidden = true;
  root.querySelector('[data-profile-content]').hidden = false;
}

async function initialiseProfile() {
  const root = document.querySelector('[data-points-member-profile]');
  if (!root) return;
  enhanceNavigation();
  const requestedId = new URLSearchParams(window.location.search).get('member');
  const results = root.querySelector('[data-member-results]');
  root.querySelector('[data-member-links]').hidden = true;
  if (requestedId === null || requestedId === '') {
    setText(root, '[data-member-message]', 'Member not specified.');
    setText(root, '[data-points-status]', 'Choose a member from the directory.');
    return;
  }
  results.setAttribute('aria-busy', 'true');
  setText(root, '[data-member-message]', 'Loading member…');
  setText(root, '[data-points-status]', 'Loading member…');
  try {
    // The normal full payload is retrieved. The routing value never leaves this page.
    const result = await getPointsData();
    renderStatus(root, result);
    if (!result.data) {
      setText(root, '[data-member-message]', 'Member data is temporarily unavailable.');
      root.querySelector('[data-member-links]').hidden = false;
      return;
    }
    const member = result.data.members.find(candidate => candidate.id === requestedId);
    if (!member) {
      setText(root, '[data-member-message]', 'Member not found.');
      return;
    }
    renderMetadata(root, result.data.meta);
    renderProfile(root, member);
  } catch {
    renderStatus(root, { state: 'unavailable', data: null });
    root.querySelector('[data-profile-content]').hidden = true;
    root.querySelector('[data-member-state]').hidden = false;
    root.querySelector('[data-member-links]').hidden = false;
    setText(root, '[data-member-message]', 'Member data is temporarily unavailable.');
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

initialiseProfile();
