import {
  WEEKDAYS, RAID_CHANNEL_URL, calendarKey, weekDates,
  occurrencesAround, nextEvents, formatDay, formatTime, formattedTimeZone,
  currentWeekSelection, nextDisplayMidnight,
} from "./schedule.mjs";

const dayButtons = document.querySelector("[data-week-days]");
const dayEvents = document.querySelector("[data-day-events]");
const dayTitle = document.querySelector("[data-day-title]");
const dayCount = document.querySelector("[data-day-count]");
const nextContainer = document.querySelector("[data-next-event]");
const zoneLabel = document.querySelector("[data-zone-label]");
const zoneButtons = [...document.querySelectorAll("[data-zone]")];

let mode = "local";
let selectedDateKey = calendarKey(new Date(), mode);
let displayedWeekKey = null;
let displayedTodayKey = null;
let activityTimer = null;
let midnightTimer = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function utcReference(event) {
  const hour = String(Math.floor(event.minute / 60)).padStart(2, "0");
  const minute = String(event.minute % 60).padStart(2, "0");
  return `UTC ${WEEKDAYS[event.weekday]} ${hour}:${minute}`;
}

function renderNext(now) {
  const event = nextEvents(now, 1)[0];
  if (!event) return null;
  const name = element("p", "events-next-name", `${event.icon} ${event.label}`);
  const time = element("p", "events-next-time", `${formatDay(event.start, mode)} · ${formatTime(event.start, mode)}`);
  const source = element("p", "events-row-utc", utcReference(event));
  nextContainer.replaceChildren(name, time, source);
  return event;
}

function renderDayContents(now) {
  const dayDate = weekDates(now, mode).find(date => calendarKey(date, mode) === selectedDateKey);
  if (!dayDate) {
    // Defensive fallback: never show an old agenda under a newly-selected day.
    selectedDateKey = calendarKey(now, mode);
    refreshSelectedButton();
    return renderDayContents(now);
  }
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", timeZone: mode === "utc" ? "UTC" : undefined,
  }).format(dayDate);
  dayTitle.textContent = formatted;

  // Include the prior UTC week so events crossing midnight into Monday are present.
  const matches = occurrencesAround(now, 1, 2).filter(event => calendarKey(event.start, mode) === selectedDateKey);
  dayCount.textContent = `${matches.length} planned ${matches.length === 1 ? "activity" : "activities"}`;

  const rows = matches.map(event => {
    const row = element("article", "events-row");
    const time = element("time", "events-row-time", formatTime(event.start, mode));
    time.dateTime = event.start.toISOString();
    const icon = element("span", "events-row-icon", event.icon);
    icon.setAttribute("aria-hidden", "true");
    const body = element("div", "events-row-body");
    body.append(
      element("h4", "", event.label),
      element("span", "events-row-kind", event.category),
      element("p", "", event.detail),
      element("p", "events-row-utc", utcReference(event)),
    );
    if (event.raidLink) {
      const p = element("p", "");
      const link = element("a", "", "Raids discussion");
      link.href = RAID_CHANNEL_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(element("span", "sr-only", " (opens in a new tab)"));
      p.append(link);
      body.append(p);
    }
    row.append(time, icon, body);
    return row;
  });
  dayEvents.replaceChildren(...(rows.length ? rows : [element("p", "events-state-message", "No activities planned for this day.")]));
}

function refreshSelectedButton() {
  for (const button of dayButtons.querySelectorAll("button")) {
    const selected = button.dataset.day === selectedDateKey;
    button.setAttribute("aria-pressed", String(selected));
  }
}

function renderWeek(now) {
  const todayKey = calendarKey(now, mode);
  const buttons = weekDates(now, mode).map(day => {
    const key = calendarKey(day, mode);
    const button = element("button", "");
    button.type = "button";
    button.dataset.day = key;
    button.setAttribute("aria-pressed", String(key === selectedDateKey));
    button.setAttribute("aria-label", `View ${formatDay(day, mode)} events`);
    button.append(
      element("span", "events-tab-day", new Intl.DateTimeFormat(undefined, {
        weekday: "short", timeZone: mode === "utc" ? "UTC" : undefined,
      }).format(day)),
      element("span", "events-tab-date", new Intl.DateTimeFormat(undefined, {
        month: "short", day: "numeric", timeZone: mode === "utc" ? "UTC" : undefined,
      }).format(day)),
    );
    if (key === todayKey) button.append(element("span", "events-today", "Today"));
    button.addEventListener("click", () => {
      const now = new Date();
      // A suspended tab may still have buttons from the previous week.
      reconcileWeek(now);
      if (currentWeekSelection(now, mode, key).selectedKey !== key) return;
      selectedDateKey = key;
      refreshSelectedButton();
      renderDayContents(now);
    });
    return button;
  });
  dayButtons.replaceChildren(...buttons);
}

function reconcileWeek(now, force = false) {
  const { weekKey, todayKey, selectedKey } = currentWeekSelection(now, mode, selectedDateKey);
  const dayChanged = todayKey !== displayedTodayKey;
  const weekChanged = weekKey !== displayedWeekKey;
  const selectionChanged = selectedKey !== selectedDateKey;
  selectedDateKey = selectedKey;

  if (force || dayChanged || weekChanged || selectionChanged) {
    displayedWeekKey = weekKey;
    displayedTodayKey = todayKey;
    renderWeek(now);
    renderDayContents(now);
  }
}

function refreshClock() {
  const now = new Date();
  const next = renderNext(now);
  reconcileWeek(now);

  // A delayed timer (e.g. in a background tab) is corrected on visibility/focus.
  window.clearTimeout(activityTimer);
  if (next) {
    activityTimer = window.setTimeout(
      refreshClock, Math.max(50, next.start.getTime() - now.getTime() + 100)
    );
  }
  window.clearTimeout(midnightTimer);
  midnightTimer = window.setTimeout(
    refreshClock, Math.max(50, nextDisplayMidnight(now, mode).getTime() - now.getTime() + 100)
  );
}

function render() {
  zoneButtons.forEach(button => {
    const active = button.dataset.zone === mode;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-selected", active);
  });
  zoneLabel.textContent = mode === "utc"
    ? "Showing UTC weekdays and clock times"
    : `Showing local dates and times (${formattedTimeZone()})`;
  reconcileWeek(new Date(), true);
  refreshClock();
}

zoneButtons.forEach(button => button.addEventListener("click", () => {
  mode = button.dataset.zone;
  selectedDateKey = calendarKey(new Date(), mode);
  render();
}));

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshClock();
});
window.addEventListener("focus", refreshClock);

render();
