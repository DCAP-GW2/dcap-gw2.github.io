import { getV2PreviewData } from './cache.js';
import { memberProfileUrl } from '../member-link.js';

const number = new Intl.NumberFormat('en-NZ');
const pointsBase = new URL('../../../points/', import.meta.url);
const paths = [
  ['Overview', ''], ['Leaderboard', 'leaderboard/'], ['Members', 'members/'],
  ['Statistics', 'statistics/'], ['How Points Work', 'how-points-work/'], ['Rewards', 'rewards/'],
];
const previewQuery = 'pointsPreview=synthetic';
const node = (tag, className = '', value = null) => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== null) item.textContent = String(value);
  return item;
};
const text = (tag, value) => node(tag, '', value);
const link = (label, url) => {
  const a = text('a', label);
  a.href = url;
  return a;
};
const previewUrl = path => `${new URL(path, pointsBase).href}?${previewQuery}`;
const profileUrl = member => `${memberProfileUrl(member, './members/profile/', pointsBase.href)}&${previewQuery}`;
const day = value => {
  const time = text('time', new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)));
  time.dateTime = value;
  return time;
};
const ranked = (rows, pointsKey = 'candidatePoints') => {
  const sorted = rows.filter(row => row[pointsKey] > 0).sort((a, b) =>
    b[pointsKey] - a[pointsKey] || a.id.localeCompare(b.id));
  return sorted.map((row, index) => ({ ...row, partialRank: 1 + sorted.filter(other => other[pointsKey] > row[pointsKey]).length }));
};

export function cycleRanking(data, cycleId) {
  const totals = new Map();
  for (const award of data.awards) if (award.cycleId === cycleId) {
    totals.set(award.memberId, (totals.get(award.memberId) || 0) + award.points);
  }
  return ranked(data.members.map(member => ({ ...member, candidatePoints: totals.get(member.id) || 0 })));
}

export function recentForMember(data, memberId) {
  return data.awards.filter(award => award.memberId === memberId).slice(0, 10);
}

function table(headers, rows, caption) {
  const wrapper = node('div', 'points-v2-table-scroll');
  const t = node('table', 'points-table points-v2-table');
  const c = text('caption', caption); t.append(c);
  const head = node('thead'); const hr = node('tr');
  for (const label of headers) { const th = text('th', label); th.scope = 'col'; hr.append(th); }
  head.append(hr); t.append(head);
  const body = node('tbody');
  for (const cells of rows) {
    const tr = node('tr');
    cells.forEach((cell, index) => {
      const element = node(index === 0 ? 'th' : 'td');
      if (index === 0) element.scope = 'row';
      element.append(cell instanceof Node ? cell : document.createTextNode(String(cell)));
      tr.append(element);
    });
    body.append(tr);
  }
  t.append(body); wrapper.append(t);
  return wrapper;
}

function metrics(items) {
  const dl = node('dl', 'points-kpi-grid');
  for (const [label, value] of items) {
    const card = node('div', 'points-kpi-card');
    card.append(text('dt', label), text('dd', value));
    dl.append(card);
  }
  return dl;
}

function section(title) {
  const s = node('section', 'points-v2-section'); s.append(text('h2', title)); return s;
}

function awardRows(data, awards, withMember = false) {
  const members = new Map(data.members.map(member => [member.id, member]));
  const rules = new Map(data.rules.map(rule => [rule.id, rule]));
  return awards.map(award => {
    const rule = rules.get(award.ruleId);
    const cells = [day(award.eventDate)];
    if (withMember) cells.push(link(members.get(award.memberId).displayName, profileUrl(members.get(award.memberId))));
    cells.push(rule.eventLabel, rule.roleLabel, number.format(award.points));
    return cells;
  });
}

function renderOverview(content, data) {
  const p = data.population;
  content.append(metrics([
    ['Incomplete candidate subtotal', number.format(p.candidatePoints)],
    ['Candidate contributors', number.format(data.members.filter(m => m.awardCandidateCount > 0).length)],
    ['Award candidates', number.format(p.awardCandidateCount)],
    ['Unresolved contributions', number.format(p.unresolvedCount)],
  ]));
  const events = section('Candidate points by event');
  const labels = new Map(data.rules.map(rule => [rule.eventId, rule.eventLabel]));
  events.append(table(['Event', 'Candidate points', 'Awards'], data.eventTotals.map(row =>
    [labels.get(row.eventId), number.format(row.candidatePoints), number.format(row.awardCandidateCount)]), 'Incomplete candidate event totals'));
  content.append(events);
  const leaders = section('Partial all-time ranking');
  leaders.append(table(['Rank', 'Contributor', 'Candidate points'], ranked(data.members).slice(0, 5).map(member =>
    [member.partialRank, link(member.displayName, profileUrl(member)), number.format(member.candidatePoints)]), 'Partial candidate ranking'));
  content.append(leaders);
}

function renderLeaderboard(content, data) {
  const s = section('Partial candidate leaderboard');
  const controls = node('div', 'points-view-switcher');
  const display = node('div');
  const views = [['All time', null], ...data.cycleTotals.map(row => [`Historical cycle ${row.cycleId}`, row.cycleId])];
  function show(cycleId) {
    const members = cycleId === null ? ranked(data.members) : cycleRanking(data, cycleId);
    display.replaceChildren(members.length ? table(['Partial rank', 'Contributor', 'Candidate points'],
      members.map(member => [member.partialRank, link(member.displayName, profileUrl(member)), number.format(member.candidatePoints)]),
      `Partial ${cycleId === null ? 'all-time' : `historical cycle ${cycleId}`} candidate ranking`) : text('p', 'No numerical candidates in this view.'));
    for (const button of controls.children) button.setAttribute('aria-pressed', String(button.dataset.cycle === String(cycleId)));
  }
  for (const [label, cycleId] of views) {
    const button = text('button', label); button.type = 'button'; button.dataset.cycle = String(cycleId);
    button.addEventListener('click', () => show(cycleId)); controls.append(button);
  }
  s.append(controls, display); content.append(s); show(null);
}

function renderMembers(content, data) {
  const s = section('Members with preserved public IDs');
  s.append(text('p', `${data.population.missingPublicIdCount} source identity state(s) have no public ID and no profile URL.`));
  const search = node('input'); search.type = 'search'; search.placeholder = 'Search members'; search.setAttribute('aria-label', 'Search members');
  const results = node('div'); const count = node('p'); count.setAttribute('role', 'status');
  const members = [...data.members].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  function show() {
    const filtered = members.filter(member => member.displayName.toLocaleLowerCase('en-NZ').includes(search.value.trim().toLocaleLowerCase('en-NZ')));
    results.replaceChildren(filtered.length ? table(['Member', 'Candidate points', 'Award candidates', 'Role diversity', 'Events'], filtered.map(member => {
      const awards = data.awards.filter(award => award.memberId === member.id);
      return [link(member.displayName, profileUrl(member)), number.format(member.candidatePoints), number.format(member.awardCandidateCount),
        new Set(awards.map(award => award.roleId)).size, new Set(awards.map(award => award.eventId)).size];
    }), 'Partial candidate member directory') : text('p', 'No members match your search.'));
    count.textContent = `Showing ${filtered.length} of ${members.length} members`;
  }
  search.addEventListener('input', show); s.append(search, count, results); content.append(s); show();
}

function renderProfile(content, data) {
  const id = new URLSearchParams(location.search).get('member');
  const member = data.members.find(candidate => candidate.id === id);
  content.append(link('Back to members', previewUrl('members/')));
  if (!member) { content.append(text('p', id ? 'Member not found.' : 'Member not specified.')); return; }
  content.append(text('h2', member.displayName));
  const awards = data.awards.filter(award => award.memberId === member.id);
  content.append(metrics([
    ['Partial candidate points', number.format(member.candidatePoints)],
    ['Partial all-time rank', member.partialRank ?? 'Unranked'],
    ['Award candidates', number.format(member.awardCandidateCount)],
    ['Active days', new Set(awards.map(award => award.eventDate)).size],
  ]));
  const byPair = new Map(); const rules = new Map(data.rules.map(rule => [rule.id, rule]));
  for (const award of awards) {
    const rule = rules.get(award.ruleId); const key = `${award.eventId}/${award.roleId}`;
    const row = byPair.get(key) || { event: rule.eventLabel, role: rule.roleLabel, points: 0, count: 0 };
    row.points += award.points; row.count++; byPair.set(key, row);
  }
  const breakdown = section('Event and role breakdown');
  breakdown.append(table(['Event', 'Role', 'Candidate points', 'Awards'], [...byPair.values()].map(row =>
    [row.event, row.role, number.format(row.points), number.format(row.count)]), 'Member event and role candidate totals'));
  content.append(breakdown);
  const cycles = section('Historical cycles');
  cycles.append(table(['Cycle', 'Candidate points', 'Awards'], data.cycleTotals.map(row => {
    const inCycle = awards.filter(award => award.cycleId === row.cycleId);
    return [`Cycle ${row.cycleId}`, number.format(inCycle.reduce((sum, award) => sum + award.points, 0)), inCycle.length];
  }), 'Member historical cycle candidate totals')); content.append(cycles);
  const recent = section('Recent awarded candidates'); const list = node('div');
  const records = recentForMember(data, member.id);
  const toggle = text('button', 'Show more'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false');
  let expanded = false;
  function show() {
    list.replaceChildren(records.length ? table(['Date', 'Event', 'Role', 'Candidate points'],
      awardRows(data, records.slice(0, expanded ? 10 : 5)), 'Recent candidate awards') : text('p', 'No numerical candidates.'));
    toggle.textContent = expanded ? 'Show less' : 'Show more';
    toggle.setAttribute('aria-expanded', String(expanded));
  }
  toggle.addEventListener('click', () => { expanded = !expanded; show(); });
  recent.append(list); if (records.length > 5) recent.append(toggle);
  content.append(recent); show();
}

function renderStatistics(content, data) {
  const labels = new Map(data.rules.map(rule => [rule.eventId, rule.eventLabel]));
  const roles = new Map(data.rules.map(rule => [rule.roleId, rule.roleLabel]));
  content.append(metrics([
    ['Candidate points', number.format(data.population.candidatePoints)],
    ['Candidate contributors', number.format(data.members.filter(m => m.awardCandidateCount > 0).length)],
    ['Award candidates', number.format(data.population.awardCandidateCount)],
    ['Active days', number.format(data.dailyTotals.length)],
  ]));
  for (const [title, headers, rows] of [
    ['Roles', ['Role', 'Candidate points', 'Awards'], data.roleTotals.map(r => [roles.get(r.roleId), r.candidatePoints, r.awardCandidateCount])],
    ['Events', ['Event', 'Candidate points', 'Awards'], data.eventTotals.map(r => [labels.get(r.eventId), r.candidatePoints, r.awardCandidateCount])],
    ['Event and role', ['Event', 'Role', 'Candidate points', 'Awards'], data.eventRoleTotals.map(r => [labels.get(r.eventId), roles.get(r.roleId), r.candidatePoints, r.awardCandidateCount])],
    ['Daily activity', ['Date', 'Candidate points', 'Awards'], data.dailyTotals.map(r => [day(r.eventDate), r.candidatePoints, r.awardCandidateCount])],
    ['Historical cycles', ['Cycle', 'Candidate points', 'Awards'], data.cycleTotals.map(r => [`Cycle ${r.cycleId}`, r.candidatePoints, r.awardCandidateCount])],
  ]) {
    const s = section(title);
    s.append(rows.length ? table(headers, rows.map(row => row.map(value => typeof value === 'number' ? number.format(value) : value)), `${title} candidate totals`) : text('p', 'No numerical candidates.'));
    content.append(s);
  }
  const recent = section('Latest ten numerical candidates');
  recent.append(data.recentAwardIds.length ? table(['Date', 'Member', 'Event', 'Role', 'Candidate points'],
    awardRows(data, data.recentAwardIds.map(id => data.awards.find(award => award.id === id)), true), 'Latest ten candidate awards') : text('p', 'No numerical candidates.'));
  content.append(recent);
  const pending = section('Unresolved source records');
  pending.append(text('p', `${number.format(data.population.unresolvedCount)} remain unresolved. No numerical points have been awarded to them.`));
  content.append(pending);
}

function renderRules(content, data) {
  const s = section('Approved v2.0 rules');
  s.append(table(['Event', 'Role', 'Points', 'Status'], data.rules.map(rule =>
    [rule.eventLabel, rule.roleLabel, rule.points === null ? 'TBD' : number.format(rule.points),
      rule.status === 'PENDING' ? 'Pending: no numerical award' : 'Approved numeric']), '24 numerical rules and one pending rule'));
  s.append(text('p', 'Triple Trouble Def, Defense, Defence and Setup refer to the canonical Setup role. Eligible Student contributions receive 2 points.'));
  s.append(text('p', 'BFLA, Dragon’s End and CM Convergence Commander awards do not stack with Sub/Lane Lead awards for the same member and event instance.'));
  s.append(text('p', 'Other Commander remains TBD. Pending roles have no awarded numeric value.'));
  content.append(s);
}

function renderRewards(content) {
  const s = section('Rewards preview unavailable');
  s.append(text('p', 'Historical scoring is incomplete. Candidate totals and partial ranks cannot establish reward eligibility. Existing rewards policy remains unchanged.'));
  content.append(s);
}

const renderers = { dashboard: renderOverview, leaderboard: renderLeaderboard, members: renderMembers,
  profile: renderProfile, statistics: renderStatistics, rules: renderRules, rewards: renderRewards };

export function previewAllowed(url = location) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    new URLSearchParams(url.search).get('pointsPreview') === 'synthetic';
}

export async function maybeRenderV2(root, page) {
  if (!previewAllowed()) return false;
  const result = await getV2PreviewData();
  root.dataset.pointsState = result.data ? result.state : 'unavailable';
  const hero = node('section', 'points-hero'); const heroInner = node('div', 'container points-hero-inner');
  heroInner.append(text('p', 'Synthetic local development preview'), text('h1', 'DCAP Points v2.0'));
  hero.append(heroInner);
  const content = node('div', 'container points-content points-v2-content');
  const nav = node('nav', 'points-nav'); nav.setAttribute('aria-label', 'Points navigation');
  const ul = node('ul');
  for (const [label, path] of paths) { const li = node('li'); li.append(link(label, previewUrl(path))); ul.append(li); }
  nav.append(ul); content.append(nav);
  const exit = new URL(location.href);
  exit.searchParams.delete('pointsPreview');
  content.append(link('Exit local preview', exit.href));
  const banner = node('p', 'points-v2-warning', 'Development preview — historical scoring is incomplete.');
  banner.setAttribute('role', 'status'); content.append(banner);
  if (!result.data) content.append(text('p', 'Preview data is unavailable. No candidate totals are shown.'));
  else {
    const data = result.data;
    const meta = node('p', 'points-v2-meta', `Revision ${data.migration.revision} · ${data.migration.ruleVersion} · ${data.population.periodStart ?? 'No dates'} to ${data.population.periodEnd ?? 'No dates'} · ${result.state === 'fallback' ? 'Most recently validated data' : 'Validated synthetic fixture'} · Source modification time unknown`);
    content.append(meta);
    renderers[page](content, data);
  }
  root.replaceChildren(hero, content);
  return true;
}
