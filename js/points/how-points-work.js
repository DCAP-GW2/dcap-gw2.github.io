import { getPointsData } from './api.js';

const numberFormat = new Intl.NumberFormat('en-NZ', { maximumSignificantDigits: 21 });
// Calendar dates must not shift with the visitor's timezone.
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
const unavailableMessage = 'Points rules are temporarily unavailable.';

function setText(root, selector, value) {
  root.querySelector(selector).textContent = value;
}

function calendarTime(value) {
  const time = document.createElement('time');
  time.dateTime = value;
  const format = /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarFormat : dateFormat;
  time.textContent = format.format(new Date(value));
  return time;
}

function renderMetadata(root, meta, version) {
  setText(root, '[data-points-season]', `Season ${numberFormat.format(meta.currentSeason)} — ${meta.seasonLabel}`);
  setText(root, '[data-points-rule-version]', version);
  root.querySelector('[data-points-period]').replaceChildren(
    calendarTime(meta.periodStart), ' – ', calendarTime(meta.periodEnd));
  root.querySelector('[data-rules-meta]').hidden = false;
}

function renderStatus(root, result) {
  root.dataset.pointsState = result.data ? result.state : 'unavailable';
  setText(root, '[data-points-status]', result.data
    ? (result.state === 'fallback' ? 'Showing the most recently available data.' : 'Live data')
    : unavailableMessage);
  const updated = root.querySelector('[data-points-updated]');
  updated.replaceChildren();
  if (result.data) {
    const time = document.createElement('time');
    time.dateTime = result.data.meta.sourceUpdatedAt;
    time.textContent = updatedFormat.format(new Date(result.data.meta.sourceUpdatedAt));
    updated.append('Last updated ', time, ' (Auckland)');
  }
}

// The feed defines both axes and every display string. Do not sort or score them.
function renderRules(root, rules) {
  const columns = document.createDocumentFragment();
  for (const label of ['Event Type', ...rules.roles]) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    columns.append(heading);
  }
  const rows = document.createDocumentFragment();
  for (const event of rules.eventTypes) {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = event.eventType;
    row.append(heading);
    for (const role of rules.roles) {
      const cell = document.createElement('td');
      cell.textContent = event.values[role];
      row.append(cell);
    }
    rows.append(row);
  }
  root.querySelector('[data-rules-columns]').replaceChildren(columns);
  root.querySelector('[data-rules-rows]').replaceChildren(rows);
  setText(root, '[data-rules-note]', rules.note);
}

function renderUnavailableState(root) {
  root.querySelector('[data-rules-content]').hidden = true;
  root.querySelector('[data-rules-meta]').hidden = true;
  root.querySelector('[data-rules-state]').hidden = false;
  root.querySelector('[data-rules-links]').hidden = false;
  setText(root, '[data-rules-message]', unavailableMessage);
  renderStatus(root, { state: 'unavailable', data: null });
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

async function initialiseRules() {
  const root = document.querySelector('[data-points-rules]');
  if (!root) return;
  const results = root.querySelector('[data-rules-results]');
  try {
    enhanceNavigation();
    results.setAttribute('aria-busy', 'true');
    root.querySelector('[data-rules-links]').hidden = true;
    setText(root, '[data-rules-message]', 'Loading Points rules…');
    setText(root, '[data-points-status]', 'Loading Points rules…');
    const result = await getPointsData();
    if (!result.data) {
      renderUnavailableState(root);
      return;
    }
    renderMetadata(root, result.data.meta, result.data.rules.version);
    renderRules(root, result.data.rules);
    renderStatus(root, result);
    root.querySelector('[data-rules-state]').hidden = true;
    root.querySelector('[data-rules-content]').hidden = false;
  } catch {
    // Hide partial output and never expose raw page errors or an endless loader.
    renderUnavailableState(root);
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

initialiseRules();
