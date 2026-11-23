import {
  WEEKDAYS, RAID_CHANNEL_URL, calendarKey, weekDates,
  occurrencesAround, nextEvents, formatDay, formatTime, formattedTimeZone,
  currentWeekSelection, nextDisplayMidnight, overviewDates,
} from "./schedule.mjs";

const dayButtons = document.querySelector("[data-week-days]");
const dayEvents = document.querySelector("[data-day-events]");
const dayTitle = document.querySelector("[data-day-title]");
const dayCount = document.querySelector("[data-day-count]");
const nextContainer = document.querySelector("[data-next-event]");
const zoneLabel = document.querySelector("[data-zone-label]");
const zoneButtons = [...document.querySelectorAll("[data-zone]")];
const overviewList = document.querySelector("[data-seven-day-list]");
const overviewToggle = document.querySelector("[data-seven-day-toggle]");
const overviewZone = document.querySelector("[data-seven-day-zone]");
const previousButton = document.querySelector("[data-prev-week]");
const nextButton = document.querySelector("[data-next-week]");
const todayButton = document.querySelector("[data-today]");

let mode = "local";
let viewOffset = 0; // Whole seven-day pages relative to today's centred window.
let overviewExpanded = false;
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
  const dates = weekDates(now, mode, viewOffset);
  const dayDate = dates.find(date => calendarKey(date, mode) === selectedDateKey) || dates[3];
  if (selectedDateKey !== calendarKey(dayDate, mode)) {
    selectedDateKey = calendarKey(dayDate, mode);
    refreshSelectedButton();
  }
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", timeZone: mode === "utc" ? "UTC" : undefined,
  }).format(dayDate);
  dayTitle.textContent = formatted;

  // Include the prior UTC week so events crossing midnight into Monday are present.
  const matches = occurrencesAround(dayDate, 1, 2).filter(event => calendarKey(event.start, mode) === selectedDateKey);
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
  const buttons = weekDates(now, mode, viewOffset).map(day => {
    const key = calendarKey(day, mode);
    const button = element("button", "");
    button.type = "button";
    button.dataset.day = key;
    button.setAttribute("aria-pressed", String(key === selectedDateKey));
    // Use the button’s visible weekday, date and Today text as its native accessible name.
    // A separate aria-label can differ from the visible label and fail label-in-name checks.
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
      if (currentWeekSelection(now, mode, key, viewOffset).selectedKey !== key) return;
      selectedDateKey = key;
      refreshSelectedButton();
      renderDayContents(now);
    });
    return button;
  });
  dayButtons.replaceChildren(...buttons);
  // Keep the central day visible inside the narrow-screen scroller without
  // scrolling the whole page vertically.
  if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches) {
    dayButtons.scrollLeft = Math.max(0,
      buttons[3].offsetLeft - buttons[0].offsetLeft -
      (dayButtons.clientWidth - buttons[3].clientWidth) / 2
    );
  }
}

function renderOverview(now) {
  const dates = overviewDates(now, mode);
  const events = occurrencesAround(now, 1, 2);
  const cards = dates.map((day, index) => {
    const key = calendarKey(day, mode);
    const matches = events.filter(event => calendarKey(event.start, mode) === key);
    const card = element("article", "events-seven-day-card");
    card.dataset.day = key;
    card.hidden = !overviewExpanded && index >= 3;
    const heading = element("h3", "", new Intl.DateTimeFormat(undefined, {
      weekday: "long", day: "numeric", month: "short",
      timeZone: mode === "utc" ? "UTC" : undefined,
    }).format(day));
    if (index === 0) heading.textContent = `Today · ${heading.textContent}`;
    card.append(heading, element("p", "events-seven-day-count",
      `${matches.length} planned ${matches.length === 1 ? "activity" : "activities"}`));
    const items = element("ul", "events-seven-day-events");
    for (const event of matches) {
      const item = element("li", "");
      const time = element("time", "", formatTime(event.start, mode));
      time.dateTime = event.start.toISOString();
      item.append(time, element("span", "events-seven-day-icon", event.icon),
        element("span", "", event.label));
      items.append(item);
    }
    card.append(items);
    return card;
  });
  overviewList.replaceChildren(...cards);
  overviewZone.textContent = `Next 7 calendar days · ${formatDay(dates[0], mode)}–${formatDay(dates[6], mode)} · ${mode === "utc" ? "UTC" : formattedTimeZone()}`;
  overviewToggle.hidden = false;
  overviewToggle.setAttribute("aria-expanded", String(overviewExpanded));
  overviewToggle.textContent = overviewExpanded ? "Show fewer days ↑" : "Show all 7 days ↓";
}

function reconcileWeek(now, force = false) {
  // Follow today across midnight only when the visitor had selected today.
  const todayKey = calendarKey(now, mode);
  const dayChanged = todayKey !== displayedTodayKey;
  if (dayChanged && viewOffset === 0 && selectedDateKey === displayedTodayKey) {
    selectedDateKey = todayKey;
  }
  const selection = currentWeekSelection(now, mode, selectedDateKey, viewOffset);
  const weekChanged = selection.weekKey !== displayedWeekKey;
  const selectionChanged = selection.selectedKey !== selectedDateKey;
  selectedDateKey = selection.selectedKey;

  if (force || dayChanged || weekChanged || selectionChanged) {
    displayedWeekKey = selection.weekKey;
    displayedTodayKey = selection.todayKey;
    renderWeek(now);
    renderDayContents(now);
    if (force || dayChanged) renderOverview(now);
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
  viewOffset = 0;
  selectedDateKey = calendarKey(new Date(), mode);
  render();
}));

function browse(offset) {
  const now = new Date();
  viewOffset += offset;
  selectedDateKey = calendarKey(weekDates(now, mode, viewOffset)[3], mode);
  reconcileWeek(now, true);
}
previousButton.addEventListener("click", () => browse(-7));
nextButton.addEventListener("click", () => browse(7));
todayButton.addEventListener("click", () => {
  viewOffset = 0;
  selectedDateKey = calendarKey(new Date(), mode);
  reconcileWeek(new Date(), true);
});
overviewToggle.addEventListener("click", () => {
  overviewExpanded = !overviewExpanded;
  refreshClock();
  renderOverview(new Date());
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshClock();
});
window.addEventListener("focus", refreshClock);

render();
