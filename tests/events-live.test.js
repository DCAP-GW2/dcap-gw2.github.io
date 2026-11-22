import test from "node:test";
import assert from "node:assert/strict";

// Minimal DOM and controlled clock: execute the actual Events page module,
// including its click handlers and timers, without adding a browser dependency.
class Element {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn(); }
  querySelectorAll(selector) {
    if (selector !== "button") throw new Error("Unexpected selector: " + selector);
    return this.children.filter(node => node.tagName === "button");
  }
}
test("Events page refreshes at an event start and reconciles a stale-week click", async () => {
  const realDate = globalThis.Date;
  const realDocument = globalThis.document;
  const realWindow = globalThis.window;
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  let clock = realDate.parse("2026-11-13T11:59:50Z");
  const timers = new Map();
  let timerId = 0;

  class ClockDate extends realDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const selectors = [
    "[data-week-days]", "[data-day-events]", "[data-day-title]",
    "[data-day-count]", "[data-next-event]", "[data-zone-label]",
    "[data-seven-day-list]", "[data-seven-day-toggle]", "[data-seven-day-zone]",
    "[data-prev-week]", "[data-next-week]", "[data-today]",
  ];
  const nodes = Object.fromEntries(selectors.map(key => [key, new Element()]));
  const local = new Element("button");
  local.dataset.zone = "local";
  const utc = new Element("button");
  utc.dataset.zone = "utc";
  const docListeners = {};
  const winListeners = {};
  globalThis.Date = ClockDate;
  globalThis.document = {
    querySelector: selector => nodes[selector],
    querySelectorAll: selector => selector === "[data-zone]" ? [local, utc] : [],
    createElement: tag => new Element(tag),
    hidden: false,
    addEventListener(name, fn) { docListeners[name] = fn; },
  };
  globalThis.window = {
    setTimeout(fn, ms) {
      const id = ++timerId;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { winListeners[name] = fn; },
  };
  const setClock = iso => { clock = realDate.parse(iso); };
  const runDueTimers = () => {
    for (let i = 0; i < 15; i += 1) {
      const due = [...timers.entries()].filter(([, value]) => value.at <= clock)
        .sort((a, b) => a[1].at - b[1].at);
      if (!due.length) return;
      const [id, timer] = due[0];
      timers.delete(id);
      timer.fn();
    }
    throw new Error("Timer loop did not settle");
  };

  try {
    await import("../js/events/page.mjs?rollover-regression=1");
    assert.equal(nodes["[data-seven-day-list]"].children.length, 7);
    assert.equal(nodes["[data-seven-day-list]"].children.filter(card => !card.hidden).length, 3);
    assert.equal(nodes["[data-seven-day-toggle]"].getAttribute("aria-expanded"), "false");
    nodes["[data-seven-day-toggle]"].click();
    assert.equal(nodes["[data-seven-day-list]"].children.filter(card => !card.hidden).length, 7);
    assert.equal(nodes["[data-seven-day-toggle]"].getAttribute("aria-expanded"), "true");
    nodes["[data-seven-day-toggle]"].click();
    assert.equal(nodes["[data-seven-day-list]"].children.filter(card => !card.hidden).length, 3);

    utc.click();
    assert.match(nodes["[data-seven-day-zone]"].textContent, /UTC/);
    assert.match(nodes["[data-next-event]"].children[0].textContent, /Triple Trouble/);
    setClock("2026-11-13T12:00:01Z");
    runDueTimers();
    assert.match(nodes["[data-next-event]"].children[0].textContent, /Death-Branded Shatterer/);

    // Focus recovery after missed timer while hidden.
    setClock("2026-11-13T13:01:00Z");
    winListeners.focus();
    assert.match(nodes["[data-next-event]"].children[0].textContent, /Guild Missions/);
    assert.equal(typeof docListeners.visibilitychange, "function");

    // Switch to Auckland local weekdays; capture an old week's Monday button.
    setClock("2026-11-22T10:59:50Z"); // Auckland Sunday 23:59:50.
    local.click();
    const oldFirstDay = nodes["[data-week-days]"].children[0];
    assert.equal(oldFirstDay.dataset.day, "2026-11-19");
    assert.equal(nodes["[data-week-days]"].children[3].dataset.day, "2026-11-22");
    assert.equal(nodes["[data-week-days]"].children[3].getAttribute("aria-pressed"), "true");
    assert.equal(nodes["[data-seven-day-list]"].children[0].children[0].textContent.startsWith("Today"), true);

    // A stale day button from the old window must not select an outdated agenda.
    setClock("2026-11-22T11:00:01Z"); // Auckland Monday 00:00:01.
    oldFirstDay.click();
    const currentWindow = nodes["[data-week-days]"].children;
    assert.equal(currentWindow[0].dataset.day, "2026-11-20");
    assert.equal(currentWindow[3].dataset.day, "2026-11-23");
    assert.equal(currentWindow[3].getAttribute("aria-pressed"), "true");
    assert.match(nodes["[data-day-title]"].textContent, /Monday/);
    assert.equal(nodes["[data-seven-day-list]"].children[0].children[0].textContent.startsWith("Today"), true);
    assert.equal(nodes["[data-seven-day-list]"].children[0].dataset.day, "2026-11-23");
    const agenda = nodes["[data-day-events]"].children
      .map(row => row.children[2].children[0].textContent);
    assert(agenda.includes("CM Convergence"), "Local Monday must include UTC Sunday follow-up");

    // Now verify an automatic midnight refresh, without a manual click.
    setClock("2026-11-29T10:59:50Z"); // Auckland Sunday.
    winListeners.focus();
    assert.equal(nodes["[data-week-days]"].children[0].dataset.day, "2026-11-26");
    setClock("2026-11-29T11:00:01Z");
    runDueTimers();
    assert.equal(nodes["[data-week-days]"].children[0].dataset.day, "2026-11-27");
    assert.equal(nodes["[data-week-days]"].children[3].dataset.day, "2026-11-30");
    assert.equal(nodes["[data-week-days]"].children[3].getAttribute("aria-pressed"), "true");
    assert.match(nodes["[data-day-title]"].textContent, /Monday/);
    assert.equal(nodes["[data-seven-day-list]"].children.filter(card => !card.hidden).length, 3);

    // Browse a shifted window and return directly to today.
    nodes["[data-next-week]"].click();
    assert.equal(nodes["[data-week-days]"].children[3].dataset.day, "2026-12-07");
    assert.equal(nodes["[data-week-days]"].children[3].getAttribute("aria-pressed"), "true");
    assert.equal(nodes["[data-seven-day-list]"].children[0].dataset.day, "2026-11-30");
    nodes["[data-prev-week]"].click();
    assert.equal(nodes["[data-week-days]"].children[3].dataset.day, "2026-11-30");
    nodes["[data-today]"].click();
    assert.equal(nodes["[data-week-days]"].children[3].dataset.day, "2026-11-30");
    assert.equal(nodes["[data-seven-day-toggle]"].getAttribute("aria-expanded"), "false");
  } finally {
    globalThis.Date = realDate;
    if (realDocument === undefined) delete globalThis.document;
    else globalThis.document = realDocument;
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});
