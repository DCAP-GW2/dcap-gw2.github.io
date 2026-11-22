import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENTS, WEEKDAYS, calendarKey, weekDates, occurrencesAround, nextEvents,
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
    const monday = weekDates(now, "local")[0];
    assert.equal(calendarKey(monday), "2026-11-23");
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
