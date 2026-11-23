import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { upcomingHomepageEvents } from "../js/events/home.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("homepage Upcoming Events copy stays distinct from Programme Highlights", () => {
  assert.match(html, /<h2 id="week-title">Programme Highlights<\/h2>/);
  assert.match(html, /<h2 id="events-title">Upcoming Events<\/h2>/);
  assert.match(html, /See what's coming up next at DCAP\. All times are shown in your local time zone\./);
  assert.doesNotMatch(html, /Happening at DCAP|Join the action/);
});

test("homepage picks the next three event starts chronologically, without category skipping", () => {
  const at = new Date("2026-11-23T11:00:00Z"); // Monday 11:00 UTC
  const events = upcomingHomepageEvents(at);
  assert.deepEqual(events.map(event => event.id), ["setup-1", "tt-1", "dbs-1"]);
  assert(events.every(event => event.start > at));
  assert(events.every((event, index) => index === 0 || event.start > events[index-1].start));
});

test("homepage advances on the event start, with UTC-to-local calendar rollover preserved", () => {
  const previous = new Date("2026-11-23T11:29:59.999Z");
  const atStart = new Date("2026-11-23T11:30:00.000Z");
  assert.equal(upcomingHomepageEvents(previous)[0].id, "setup-1");
  assert.equal(upcomingHomepageEvents(atStart)[0].id, "tt-1");
  const afterFollowUp = upcomingHomepageEvents(new Date("2026-11-23T13:30:00Z"));
  assert.deepEqual(afterFollowUp.map(event => event.id), ["setup-2", "tt-2", "dbs-2"]);
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    assert.equal(afterFollowUp[0].start.getDate(), 25);
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});
