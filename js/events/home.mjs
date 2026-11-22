import { occurrencesAround, formatDay, formatTime } from "./schedule.mjs";

const now = new Date();
const upcoming = occurrencesAround(now, 0, 2).filter(event => event.start > now);
const choices = [
  upcoming.find(event => event.category === "Daily programme"),
  upcoming.find(event => event.category === "Follow-up" || event.category === "Alternative activities"),
  upcoming.find(event => event.id === "fri-gyala"),
].filter(Boolean).sort((a, b) => a.start - b.start);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const list = document.querySelector("[data-event-list]");
if (list) {
  list.replaceChildren(...choices.map(event => {
    const article = element("article", "event-brief");
    const icon = element("span", "event-icon", event.icon);
    icon.setAttribute("aria-hidden", "true");
    const text = element("div");
    text.append(
      element("h3", "", event.label),
      element("p", "event-time", `${formatDay(event.start)} · ${formatTime(event.start)} local`),
      element("p", "", event.category),
    );
    article.append(icon, text);
    return article;
  }));
}

const board = document.querySelector("[data-home-events]");
if (board) {
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
}
