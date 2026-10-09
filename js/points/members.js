import { getPointsData } from './api.js';
import { memberProfileUrl } from './member-link.js';

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
    : 'Members data is temporarily unavailable.');
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

function renderDirectory(root, members, total) {
  const grid = root.querySelector('#member-grid');
  const cards = document.createDocumentFragment();
  for (const member of members) {
    const card = document.createElement('li');
    card.className = 'points-member-card glass-panel';
    const name = document.createElement('h3');
    name.className = 'points-member-name';
    name.textContent = member.displayName;
    const stats = document.createElement('dl');
    stats.className = 'points-member-stats';
    for (const [label, pointsKey, rankKey] of [
      ['Current Season', 'currentPoints', 'currentRank'],
      ['All Time', 'allTimePoints', 'allTimeRank'],
    ]) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const value = document.createElement('dd');
      // Positive-point ranks are published values, including ties and zero.
      const rank = member[pointsKey] === 0 ? 'Unranked' : `Rank #${member[rankKey]}`;
      value.textContent = `${rank} · ${numberFormat.format(member[pointsKey])} pts`;
      group.append(term, value);
      stats.append(group);
    }
    card.append(name, stats);
    const href = memberProfileUrl(member, './profile/');
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.append('View profile');
      const context = document.createElement('span');
      context.className = 'sr-only';
      context.textContent = ` for ${member.displayName}`;
      link.append(context);
      card.append(link);
    }
    cards.append(card);
  }
  grid.replaceChildren(cards);
  grid.hidden = !members.length;
  root.querySelector('[data-member-state]').hidden = Boolean(members.length);
  setText(root, '[data-member-message]', total
    ? 'No members match your search' : 'No members are available yet.');
  const count = !total ? 'Showing 0 members' : !members.length ? 'No members match your search'
    : members.length === total ? `Showing ${total} ${total === 1 ? 'member' : 'members'}`
      : `Showing ${members.length} of ${total} members`;
  // Called after a short input debounce, so the polite count does not chatter.
  setText(root, '[data-member-count]', count);
}

async function initialiseMembers() {
  const root = document.querySelector('[data-points-members]');
  if (!root) return;
  enhanceNavigation();
  const results = root.querySelector('[data-member-results]');
  results.setAttribute('aria-busy', 'true');
  root.querySelector('[data-member-links]').hidden = true;
  setText(root, '[data-member-message]', 'Loading members…');
  setText(root, '[data-points-status]', 'Loading members…');
  try {
    const result = await getPointsData();
    renderStatus(root, result);
    if (!result.data) {
      setText(root, '[data-member-message]', 'Members data is temporarily unavailable.');
      root.querySelector('[data-member-links]').hidden = false;
      return;
    }
    const { members, meta } = result.data;
    renderMetadata(root, meta);
    const sorted = [...members].sort((a, b) => nameOrder.compare(a.displayName, b.displayName));
    setText(root, '[data-member-total]', numberFormat.format(members.length));
    setText(root, '[data-member-contributors]', numberFormat.format(meta.uniqueContributors));
    setText(root, '[data-member-ranked]', numberFormat.format(members.filter(member => member.allTimePoints > 0).length));
    root.querySelector('[data-members-summary]').hidden = false;
    root.querySelector('[data-member-search]').hidden = false;
    renderDirectory(root, sorted, members.length);
    const search = root.querySelector('#member-search');
    let searchTimer;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = search.value.trim().toLocaleLowerCase('en-NZ');
        renderDirectory(root, sorted.filter(member =>
          member.displayName.toLocaleLowerCase('en-NZ').includes(query)), members.length);
      }, 250);
    });
  } catch {
    renderStatus(root, { state: 'unavailable', data: null });
    root.querySelector('#member-grid').hidden = true;
    root.querySelector('[data-members-summary]').hidden = true;
    root.querySelector('[data-member-search]').hidden = true;
    root.querySelector('[data-member-state]').hidden = false;
    root.querySelector('[data-member-links]').hidden = false;
    setText(root, '[data-member-message]', 'Members data is temporarily unavailable.');
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}

initialiseMembers();
