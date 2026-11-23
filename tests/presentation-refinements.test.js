import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("homepage uses stable, approved programme highlights", () => {
  const html = read("index.html");
  const script = read("js/events/home.mjs");
  assert.ok(html.includes('<h2 id="week-title">Programme Highlights</h2>'));
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
