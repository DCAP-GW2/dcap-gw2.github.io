import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("homepage uses stable, approved activity highlights", () => {
  const html = read("index.html");
  const script = read("js/events/home.mjs");
  assert.ok(html.includes('<h2 id="week-title">Activity Highlights</h2>'));
  for (const label of ["Daily Triple Trouble &amp; Death-Branded Shatterer", "Daily Meta Events", "WvW &amp; Raid Training"]) {
    assert.ok(html.includes(label));
  }
  assert.ok(html.includes("player development, and collaborations."));
  assert.doesNotMatch(script, /data-event-list/);
  assert.match(script, /data-home-events/);
});

test("event presentation uses clear setup label and four-day preview", () => {
  const schedule = read("js/events/schedule.mjs");
  const script = read("js/events/page.mjs");
  const html = read("events/index.html");
  assert.match(schedule, /label: "Triple Trouble Setup"/);
  assert.ok(script.includes("card.hidden = !overviewExpanded && index >= 4;"));
  assert.match(html, /Show all 7 days/);
  assert.doesNotMatch(html, /Planned, not live availability/);
});

test("v2 public leaderboard and profile history are simplified", () => {
  const source = read("points/v2/page.mjs");
  assert.ok(source.includes("table(['Rank','Member','Points','Contributions']"));
  assert.ok(source.includes("table(['Date','Event','Role','Points'],personal.slice("));
  assert.doesNotMatch(source, /Partial rank|['"]Provenance['"]/);
  assert.ok(source.includes('member.awardCandidateCount === 1 ? "contribution" : "contributions"'));
});

test("time-zone explanation precedes the selector, with copy for both display modes", () => {
  const html = read("events/index.html");
  const css = read("css/events.css");
  const script = read("js/events/page.mjs");
  const info = html.indexOf('<div class="events-zone-info">');
  const label = html.indexOf('data-zone-label', info);
  const note = html.indexOf('data-zone-note', label);
  const selector = html.indexOf('<fieldset class="events-zone-buttons">', note);
  assert.ok(info >= 0 && label > info && note > label && selector > note);
  assert.ok(html.includes("All times are shown in your local time zone, including daylight saving changes."));
  assert.ok(script.includes('zoneNote.textContent = mode === "utc"'));
  assert.ok(script.includes("All times are shown in UTC, without daylight saving changes."));
  assert.ok(script.includes("All times are shown in your local time zone, including daylight saving changes."));
  assert.ok(css.includes(".events-zone-control { display: grid; grid-template-columns: minmax(0,1fr) max-content; align-items: center;"));
  assert.ok(css.includes(".events-zone-control { grid-template-columns: minmax(0,1fr); justify-items: start; align-self: flex-start; gap: 8px; text-align: left; }"));
  assert.ok(!css.includes(".events-zone-note { display: none;"));
});
