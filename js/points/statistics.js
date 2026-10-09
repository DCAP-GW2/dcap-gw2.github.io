import { getPointsData } from './api.js';
import { communityRecentContributions, renderRecentContributions } from './recent-contributions.js';

const numberFormat = new Intl.NumberFormat('en-NZ', { maximumSignificantDigits: 21 });
const shareFormat = new Intl.NumberFormat('en-NZ', { style: 'percent', maximumFractionDigits: 1 });
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
const unavailableMessage = 'Statistics data is temporarily unavailable.';

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

function renderMetadata(root, meta) {
  setText(root, '[data-points-season]', `Season ${numberFormat.format(meta.currentSeason)} — ${meta.seasonLabel}`);
  setText(root, '[data-points-rule-version]', meta.ruleVersion);
  root.querySelector('[data-points-period]').replaceChildren(
    calendarTime(meta.periodStart), ' – ', calendarTime(meta.periodEnd));
  root.querySelector('[data-statistics-meta]').hidden = false;
  setText(root, '[data-points-total]', numberFormat.format(meta.totalPoints));
  setText(root, '[data-points-contributors]', numberFormat.format(meta.uniqueContributors));
  setText(root, '[data-points-active-days]', numberFormat.format(meta.activeDays));
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

// Presentation geometry only. The shared validator owns data reconciliation.
function proportion(value, total) {
  if (total === 0) return 0;
  return Math.min(1, Math.max(0, value / total));
}

function renderContributions(root, key, items, total) {
  const rows = document.createDocumentFragment();
  for (const item of items) {
    const share = proportion(item.value, total);
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    // Feed labels are authoritative text; never interpret them as markup or mappings.
    label.textContent = item.label;
    const track = document.createElement('span');
    track.className = 'points-stat-bar-track';
    track.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('span');
    bar.className = 'points-stat-bar-fill';
    bar.style.width = `${share * 100}%`;
    track.append(bar);
    label.append(track);
    const points = document.createElement('td');
    points.textContent = numberFormat.format(item.value);
    const percentage = document.createElement('td');
    percentage.textContent = shareFormat.format(share);
    row.append(label, points, percentage);
    rows.append(row);
  }
  root.querySelector(`[data-${key}-rows]`).replaceChildren(rows);
  root.querySelector(`[data-${key}-table]`).hidden = !items.length;
  root.querySelector(`[data-${key}-empty]`).hidden = Boolean(items.length);
}

function renderRecentPoints(root, members) {
  const records = communityRecentContributions(members);
  const list = root.querySelector('[data-recent-points-list]');
  const message = root.querySelector('[data-recent-points-message]');
  list.hidden = !records?.length;
  message.hidden = Boolean(records?.length);
  if (records?.length) {
    renderRecentContributions(list, records, new URL('../members/profile/', window.location.href));
  } else {
    list.replaceChildren();
    message.textContent = records === null ? 'Recent contribution detail is unavailable.'
      : 'No contributions have been recorded for this season yet.';
  }
}

function svgElement(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderDailyChart(root, days) {
  const container = root.querySelector('[data-daily-chart]');
  container.replaceChildren();
  container.hidden = !days.length;
  if (!days.length) return;
  // A reduction avoids argument-count limits on long seasons. Divide before
  // multiplying so even large finite published values yield finite coordinates.
  const maximum = days.reduce((peak, day) => Math.max(peak, day.points), 0);
  const scale = document.createElement('p');
  scale.className = 'points-daily-scale';
  scale.textContent = maximum === 0 ? 'All recorded values are 0 Points.'
    : `Scale: 0 – ${numberFormat.format(maximum)} Points`;
  const chart = svgElement('svg', { viewBox: '0 0 800 240', focusable: 'false' });
  chart.append(svgElement('path', { d: 'M12 12H788 M12 120H788 M12 228H788', class: 'points-daily-grid' }));
  // Evenly spaced observations, not a continuous calendar series. No dates added.
  const coordinates = days.map((day, index) => [
    days.length === 1 ? 400 : 12 + (index / (days.length - 1)) * 776,
    228 - proportion(day.points, maximum) * 216,
  ]);
  if (days.length === 1) {
    chart.append(svgElement('circle', { cx: coordinates[0][0], cy: coordinates[0][1], r: 5, class: 'points-daily-point' }));
  } else {
    chart.append(svgElement('polyline', {
      points: coordinates.map(point => point.join(',')).join(' '),
      class: 'points-daily-line', 'vector-effect': 'non-scaling-stroke',
    }));
  }
  const dates = document.createElement('div');
  dates.className = 'points-daily-dates';
  dates.append(calendarTime(days[0].date));
  if (days.length > 1) dates.append(calendarTime(days[days.length - 1].date));
  container.append(scale, chart, dates);
}

function renderDailyTotals(root, days) {
  const rows = document.createDocumentFragment();
  for (const day of days) {
    const row = document.createElement('tr');
    const date = document.createElement('th');
    date.scope = 'row';
    date.append(calendarTime(day.date));
    const points = document.createElement('td');
    points.textContent = numberFormat.format(day.points);
    row.append(date, points);
    rows.append(row);
  }
  root.querySelector('[data-daily-rows]').replaceChildren(rows);
  root.querySelector('[data-daily-table]').hidden = !days.length;
  root.querySelector('[data-daily-empty]').hidden = Boolean(days.length);
  renderDailyChart(root, days);
}

function renderUnavailableState(root) {
  root.querySelector('[data-statistics-content]').hidden = true;
  root.querySelector('[data-statistics-meta]').hidden = true;
  root.querySelector('[data-statistics-state]').hidden = false;
  root.querySelector('[data-statistics-links]').hidden = false;
  setText(root, '[data-statistics-message]', unavailableMessage);
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

async function initialiseStatistics() {
  const root = document.querySelector('[data-points-statistics]');
  if (!root) return;
  const results = root.querySelector('[data-statistics-results]');
  try {
    enhanceNavigation();
    results.setAttribute('aria-busy', 'true');
    root.querySelector('[data-statistics-links]').hidden = true;
    setText(root, '[data-statistics-message]', 'Loading statistics…');
    setText(root, '[data-points-status]', 'Loading statistics…');
    const result = await getPointsData();
    if (!result.data) {
      renderUnavailableState(root);
      return;
    }
    const { meta, members, roleTotals, eventTotals, dailyTotals } = result.data;
    renderMetadata(root, meta);
    renderRecentPoints(root, members);
    renderContributions(root, 'role', roleTotals, meta.totalPoints);
    renderContributions(root, 'event', eventTotals, meta.totalPoints);
    renderDailyTotals(root, dailyTotals);
    renderStatus(root, result);
    root.querySelector('[data-statistics-state]').hidden = true;
    root.querySelector('[data-statistics-content]').hidden = false;
  } catch {
    // Hide partial output and never expose raw page errors or an endless loader.
    renderUnavailableState(root);
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

initialiseStatistics();
