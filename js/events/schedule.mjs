// DCAP's recurring programme is fixed to UTC, including the UTC weekday.
// Times are minutes after 00:00 UTC. Browser-local display never rewrites these rules.
export const WEEKDAYS = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
export const RAID_CHANNEL_URL = "https://discord.com/channels/730056553197207596/746527916824854659";
export const DISCORD_URL = "https://discord.gg/A2TQJNvNqa";

const events = [];
for (let weekday = 0; weekday < 7; weekday += 1) {
  events.push(
    { id: `setup-${weekday}`, weekday, minute: 11 * 60 + 30, icon: "📋", label: "Triple Trouble Setup", category: "Daily programme", detail: "Prepare the map and squad for Triple Trouble." },
    { id: `tt-${weekday}`, weekday, minute: 12 * 60, icon: "🐍", label: "Triple Trouble", category: "Daily programme", detail: "Commander, blockers, defence and support." },
    { id: `dbs-${weekday}`, weekday, minute: 13 * 60, icon: "🐉", label: "Death-Branded Shatterer", category: "Daily programme", detail: "Follow-up world boss." },
  );
}
// Sequences (→) are successive activities; alternatives (or) are not confirmed simultaneously.
events.push(
  { id: "mon-late", weekday: 1, minute: 13 * 60 + 30, icon: "🦁", label: "Battle for Lion's Arch → Twisted Marionette", category: "Follow-up", detail: "Two activities in sequence." },
  { id: "tue-late", weekday: 2, minute: 13 * 60 + 30, icon: "🐲", label: "Dragonstorm → Dragon's Stand", category: "Follow-up", detail: "Two activities in sequence." },
  { id: "wed-late", weekday: 3, minute: 13 * 60 + 30, icon: "⚔️", label: "WvW or 🆓 Free Day", category: "Alternative activities", detail: "Choice depends on commander availability." },
  { id: "thu-late", weekday: 4, minute: 13 * 60 + 30, icon: "🔥", label: "Path of Fire Meta Train", category: "Follow-up", detail: "Community meta train." },
  { id: "fri-gyala", weekday: 5, minute: 7 * 60, icon: "🪏", label: "Gyala Delve", category: "Weekly meta", detail: "End of Dragons and a Jade Bot (any tier) required." },
  { id: "fri-late", weekday: 5, minute: 13 * 60 + 30, icon: "🏰", label: "Guild Missions or ⚔️ Raids or 🆓 Free Day", category: "Alternative activities", detail: "Check Discord for the chosen activity.", raidLink: true },
  { id: "sat-late", weekday: 6, minute: 13 * 60 + 30, icon: "🏴‍☠️", label: "Aetherblade Assault → Dragon's End", category: "Follow-up", detail: "Two activities in sequence." },
  { id: "sun-late", weekday: 0, minute: 13 * 60 + 30, icon: "🌀", label: "CM Convergence", category: "Follow-up", detail: "Challenge Mode Convergence." },
);
export const EVENTS = Object.freeze(events.map(event => Object.freeze(event)));

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;
const pad = n => String(n).padStart(2, "0");

export function calendarKey(date, mode = "local") {
  const utc = mode === "utc";
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
  const day = utc ? date.getUTCDate() : date.getDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Construct calendar days at noon in the display zone so a DST midnight
// change never shortens a day or changes its local calendar key.
export function calendarDates(now = new Date(), mode = "local", firstOffset = 0, count = 7) {
  const utc = mode === "utc";
  const year = utc ? now.getUTCFullYear() : now.getFullYear();
  const month = utc ? now.getUTCMonth() : now.getMonth();
  const date = (utc ? now.getUTCDate() : now.getDate()) + firstOffset;
  return Array.from({ length: count }, (_, i) =>
    utc ? new Date(Date.UTC(year, month, date + i, 12)) : new Date(year, month, date + i, 12)
  );
}

// The picker centres on today by default; moving by seven days is optional.
export function weekDates(now = new Date(), mode = "local", viewOffset = 0) {
  return calendarDates(now, mode, viewOffset - 3, 7);
}

// The compact overview always starts today, independent of picker navigation.
export function overviewDates(now = new Date(), mode = "local") {
  return calendarDates(now, mode, 0, 7);
}

export function occurrencesAround(now = new Date(), weeksBefore = 1, weeksAfter = 2) {
  const utcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const utcSunday = utcDay - now.getUTCDay() * DAY_MS;
  const result = [];
  for (let week = -weeksBefore; week <= weeksAfter; week += 1) {
    for (const event of EVENTS) {
      const start = new Date(utcSunday + week * WEEK_MS + event.weekday * DAY_MS + event.minute * 60000);
      result.push({ ...event, start });
    }
  }
  return result.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function nextEvents(now = new Date(), count = 3) {
  return occurrencesAround(now, 0, 2).filter(event => event.start > now).slice(0, count);
}

export function formatTime(date, mode = "local") {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit", timeZone: mode === "utc" ? "UTC" : undefined,
  }).format(date);
}

export function formatDay(date, mode = "local") {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "numeric", month: "short", timeZone: mode === "utc" ? "UTC" : undefined,
  }).format(date);
}

export function formattedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "your device's time zone";
}


// Keep selection and agenda inside the same rolling seven-day window.
// With navigation, default to the centre of the currently displayed window.
export function currentWeekSelection(now, mode, requestedKey, viewOffset = 0) {
  const dates = weekDates(now, mode, viewOffset);
  const todayKey = calendarKey(now, mode);
  const weekKey = calendarKey(dates[0], mode);
  const centreKey = calendarKey(dates[3], mode);
  const selectedKey = dates.some(date => calendarKey(date, mode) === requestedKey)
    ? requestedKey : centreKey;
  return { weekKey, todayKey, selectedKey };
}

// A fixed UTC schedule can cross a visitor's local midnight on a different day.
export function nextDisplayMidnight(now, mode = "local") {
  return mode === "utc"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
