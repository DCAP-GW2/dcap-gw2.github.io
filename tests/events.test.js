import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENTS, WEEKDAYS, calendarKey, weekDates, overviewDates,
  currentWeekSelection, occurrencesAround, nextEvents,
} from "../js/events/schedule.mjs";

test("UTC schedule covers all days, with the approved changes", () => {
  assert.equal(EVENTS.length, 29);
  for (let weekday = 0; weekday < 7; weekday += 1) {
    assert.equal(EVENTS.find(e => e.id === `setup-${weekday}`).minute, 690);
    assert.equal(EVENTS.find(e => e.id === `tt-${weekday}`).minute, 720);
    assert.equal(EVENTS.find(e => e.id === `dbs-${weekday}`).minute, 780);
  }
  assert.equal(EVENTS.find(e => e.id === "fri-gyala").minute, 420);
  assert.equal(EVENTS.find(e => e.id === "wed-late").label, "WvW or 🆓 Free Day");
  assert.equal(EVENTS.find(e => e.id === "sun-late").label, "CM Convergence");
  assert.equal(EVENTS.filter(e => e.id.endsWith("-late")).length, 7);
  assert.equal(WEEKDAYS[0], "Sunday");
});

test("UTC instants are exact, not based on the test runner's local clock", () => {
  const occurrences = occurrencesAround(new Date("2026-11-13T00:00:00Z"), 0, 0);
  const gyala = occurrences.find(e => e.id === "fri-gyala");
  const tt = occurrences.find(e => e.id === "tt-5");
  const late = occurrences.find(e => e.id === "fri-late");
  assert.equal(gyala.start.toISOString(), "2026-11-13T07:00:00.000Z");
  assert.equal(tt.start.toISOString(), "2026-11-13T12:00:00.000Z");
  assert.equal(late.start.toISOString(), "2026-11-13T13:30:00.000Z");
  assert.equal(calendarKey(tt.start, "utc"), "2026-11-13");
  assert.equal(nextEvents(new Date("2026-11-13T06:59:59Z"), 1)[0].id, "fri-gyala");
});

test("Auckland sees UTC Sunday events on local Monday and the local week groups them correctly", () => {
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const now = new Date("2026-11-22T11:00:00Z"); // NZDT Monday 00:00
    const centred = weekDates(now, "local");
    assert.equal(calendarKey(centred[0]), "2026-11-20");
    assert.equal(calendarKey(centred[3]), "2026-11-23");
    assert.equal(calendarKey(centred[6]), "2026-11-26");
    const mondayEvents = occurrencesAround(now, 1, 2)
      .filter(e => calendarKey(e.start, "local") === "2026-11-23");
    assert(mondayEvents.some(e => e.id === "setup-0"));
    assert(mondayEvents.some(e => e.id === "sun-late"));
    assert.equal(new Date("2026-11-13T12:00:00Z").getHours(), 1);
    assert.equal(new Date("2026-11-13T12:00:00Z").getDate(), 14);
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});

test("fixed UTC Friday Gyala shifts from 20:00 NZDT to 19:00 NZST", () => {
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    assert.equal(new Date("2027-01-01T07:00:00Z").getHours(), 20);
    assert.equal(new Date("2027-06-04T07:00:00Z").getHours(), 19);
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});

test("rolling day picker centres today and compact overview starts today", () => {
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const sunday = new Date("2026-11-22T06:00:00Z"); // Sun 19:00 NZDT
    assert.deepEqual(weekDates(sunday).map(calendarKey), [
      "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
      "2026-11-23", "2026-11-24", "2026-11-25",
    ]);
    assert.deepEqual(overviewDates(sunday).map(calendarKey), [
      "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25",
      "2026-11-26", "2026-11-27", "2026-11-28",
    ]);
    assert.deepEqual(weekDates(sunday, "local", 7).map(calendarKey).slice(0, 2),
      ["2026-11-26", "2026-11-27"]);
    const rollover = new Date("2026-11-22T11:00:01Z"); // Mon 00:00 NZDT
    assert.equal(currentWeekSelection(rollover, "local", "2026-11-19").selectedKey,
      "2026-11-23");
    assert.equal(currentWeekSelection(rollover, "local", "2026-11-23").selectedKey,
      "2026-11-23");
    assert.equal(currentWeekSelection(rollover, "local", "2026-12-09", 7).selectedKey,
      "2026-11-30");
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});

test("rolling local dates stay consecutive across Auckland daylight saving", () => {
  const oldTZ = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const beforeSpring = new Date("2027-09-25T05:00:00Z");
    const dates = overviewDates(beforeSpring, "local");
    assert.deepEqual(dates.map(calendarKey), [
      "2027-09-25", "2027-09-26", "2027-09-27", "2027-09-28",
      "2027-09-29", "2027-09-30", "2027-10-01",
    ]);
    const beforeFall = new Date("2027-04-03T05:00:00Z");
    assert.deepEqual(overviewDates(beforeFall, "local").map(calendarKey).slice(0, 3),
      ["2027-04-03", "2027-04-04", "2027-04-05"]);
    assert.equal(calendarKey(overviewDates(beforeSpring, "utc")[0], "utc"),
      "2027-09-25");
  } finally {
    if (oldTZ === undefined) delete process.env.TZ;
    else process.env.TZ = oldTZ;
  }
});
