import { pointsConfig } from './config.js';

const roleFields = ['commander', 'blocker', 'mapSpammer', 'defenseSetup', 'taxi', 'student'];
const memberNumbers = ['allTimePoints', 'allTimeRank', 'currentPoints', 'currentRank',
  'activeDays', 'roleDiversity', ...roleFields, 'ttPoints', 'otherPoints'];
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const plainObject = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const sameTotal = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9;
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);

function validDate(value) {
  if (!nonblank(value) || !Number.isFinite(Date.parse(value))) return false;
  // Date.parse normalises impossible ISO calendar dates such as 30 February.
  const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1];
  if (isoDate) {
    return new Date(`${isoDate}T00:00:00.000Z`).toISOString().slice(0, 10) === isoDate;
  }
  return true;
}
const calendarDay = value => new Date(value).toISOString().slice(0, 10);
const reject = reason => ({ valid: false, reason });
const contributionFields = ['eventDate', 'eventType', 'role', 'points'];

function validRecentContributions(entries, periodStart, periodEnd) {
  if (!Array.isArray(entries) || entries.length > 10) return false;
  let previousDate = null;
  for (const entry of entries) {
    if (!plainObject(entry) || Object.keys(entry).length !== contributionFields.length ||
        !contributionFields.every(key => Object.hasOwn(entry, key)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.eventDate) || !validDate(entry.eventDate) ||
        entry.eventDate < periodStart || entry.eventDate > periodEnd ||
        !nonblank(entry.eventType) || !nonblank(entry.role) || !nonnegative(entry.points) ||
        (previousDate !== null && entry.eventDate > previousDate)) return false;
    previousDate = entry.eventDate;
  }
  return true;
}

function validTotals(items, total) {
  const labels = new Set();
  for (const item of items) {
    if (!plainObject(item) || !nonblank(item.label) || !nonnegative(item.value)) return false;
    const label = item.label.trim();
    if (labels.has(label)) return false;
    labels.add(label);
  }
  return sameTotal(sum(items, 'value'), total);
}

// Rules are display strings, including the bridge's em dash for unscored roles.
// Validate their structure without interpreting or calculating any award.
function validRules(rules, version) {
  if (!plainObject(rules) || !nonblank(rules.version) || rules.version !== version ||
      !nonblank(rules.note) || !Array.isArray(rules.roles) || !rules.roles.length ||
      !rules.roles.every(nonblank) || new Set(rules.roles.map(role => role.trim())).size !== rules.roles.length ||
      !Array.isArray(rules.eventTypes) || !rules.eventTypes.length) return false;
  const eventTypes = new Set();
  for (const event of rules.eventTypes) {
    if (!plainObject(event) || !nonblank(event.eventType) || !plainObject(event.values) ||
        !rules.roles.every(role => Object.hasOwn(event.values, role) && nonblank(event.values[role]))) return false;
    const label = event.eventType.trim();
    if (eventTypes.has(label)) return false;
    eventTypes.add(label);
  }
  return true;
}

/** Reject the entire candidate. Reason codes contain no source data or identities. */
export function validatePointsData(payload) {
  if (!plainObject(payload) || payload.schemaVersion !== pointsConfig.expectedSchemaVersion) {
    return reject('schema');
  }
  const { meta, members, roleTotals, eventTotals, dailyTotals, rules } = payload;
  if (!plainObject(meta) || ![members, roleTotals, eventTotals, dailyTotals].every(Array.isArray)) {
    return reject('structure');
  }
  if (!['feedStatus', 'seasonLabel', 'ruleVersion', 'rewardsStatus'].every(key => nonblank(meta[key])) ||
      !['currentSeason', 'totalPoints', 'uniqueContributors', 'activeDays'].every(key => nonnegative(meta[key])) ||
      !['periodStart', 'periodEnd', 'sourceUpdatedAt'].every(key => validDate(meta[key])) ||
      Date.parse(meta.periodStart) > Date.parse(meta.periodEnd)) return reject('metadata');

  const ids = new Set();
  for (const member of members) {
    if (!plainObject(member) || !nonblank(member.id) || !nonblank(member.displayName) ||
        !memberNumbers.every(key => nonnegative(member[key]))) return reject('member');
    const id = member.id.trim();
    if (ids.has(id)) return reject('duplicate-member');
    ids.add(id);
    if (member.allTimePoints < member.currentPoints ||
        !sameTotal(roleFields.reduce((total, key) => total + member[key], 0), member.currentPoints) ||
        !sameTotal(member.ttPoints + member.otherPoints, member.currentPoints)) return reject('member-totals');
    if (Object.hasOwn(member, 'recentContributions') &&
        !validRecentContributions(member.recentContributions,
          calendarDay(meta.periodStart), calendarDay(meta.periodEnd))) return reject('recent-contributions');
  }
  if (!sameTotal(sum(members, 'currentPoints'), meta.totalPoints) ||
      members.filter(member => member.currentPoints > 0).length !== meta.uniqueContributors) {
    return reject('member-reconciliation');
  }
  // Production role/event aggregates use { label, value }; daily entries use { date, points }.
  if (!validTotals(roleTotals, meta.totalPoints)) return reject('role-totals');
  if (!validTotals(eventTotals, meta.totalPoints)) return reject('event-totals');
  let previousDay = null;
  for (const day of dailyTotals) {
    if (!plainObject(day) || !validDate(day.date) || !nonnegative(day.points)) return reject('daily-entry');
    const date = calendarDay(day.date);
    if ((previousDay !== null && date <= previousDay) ||
        date < calendarDay(meta.periodStart) || date > calendarDay(meta.periodEnd)) return reject('daily-order');
    previousDay = date;
  }
  if (dailyTotals.length !== meta.activeDays || !sameTotal(sum(dailyTotals, 'points'), meta.totalPoints) ||
      (previousDay !== null && previousDay !== calendarDay(meta.periodEnd))) return reject('daily-reconciliation');
  if (!validRules(rules, meta.ruleVersion)) return reject('rules');
  // Additional bridge fields stay on the original payload; validation does not rewrite it.
  return { valid: true };
}
