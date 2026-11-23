import { nextEvents, formatDay, formatTime } from "./schedule.mjs";

// This board is a chronological preview, not a curated set of categories.
// Read from the same UTC recurrence rules as the full Events page.
export function upcomingHomepageEvents(now = new Date()) {
  return nextEvents(now, 3);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const board = document.querySelector("[data-home-events]");
let refreshTimer = null;

function renderHomepageEvents() {
  if (!board) return;
  const now = new Date();
  const choices = upcomingHomepageEvents(now);
  board.replaceChildren(...choices.map(event => {
    const article = element("article");
    const badge = element("div", "date-badge");
    badge.append(
      element("strong", "", new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(event.start).toUpperCase()),
      element("span", "", formatTime(event.start)),
    );
    const detail = element("div");
    detail.append(
      element("h3", "", event.label),
      element("p", "", `${formatDay(event.start)} · ${formatTime(event.start)} local`),
      element("span", "", event.category),
    );
    article.append(badge, detail);
    return article;
  }));

  // Update on the first event start, so a page left open doesn't stay stale.
  window.clearTimeout(refreshTimer);
  if (choices.length) {
    refreshTimer = window.setTimeout(renderHomepageEvents,
      Math.max(50, choices[0].start.getTime() - now.getTime() + 100));
  }
}

if (board) {
  renderHomepageEvents();
  // Background tabs can throttle timers; catch up when the tab is revisited.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderHomepageEvents();
  });
  window.addEventListener("focus", renderHomepageEvents);
}
