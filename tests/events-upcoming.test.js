import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarKey, programmeDayKey, occurrencesAround, upcomingDayProgramme, UPCOMING_DAY_GRACE_MS,
} from "../js/events/schedule.mjs";

test("90-minute cutoff uses last scheduled start, not an invented end time", () => {
  assert.equal(UPCOMING_DAY_GRACE_MS, 5_400_000);
  // Friday UTC: Gyala at 07:00, daily run at 11:30–13:00, then 13:30 Guild Missions/raids.
  const before = upcomingDayProgramme(new Date("2026-11-13T06:59:59Z"), "utc");
  assert.equal(before.dayKey, "2026-11-13");
  assert.equal(before.events[0].id, "fri-gyala");
  assert.equal(before.nextIndex, 0);
  const started = upcomingDayProgramme(new Date("2026-11-13T13:30:01Z"), "utc");
  assert.equal(started.dayOffset, 0);
  assert.equal(started.nextIndex, -1);
  assert.equal(started.events.at(-1).id, "fri-late");
  assert.equal(started.highlightedIndex, started.events.length - 1);
  assert.equal(started.cutoff.toISOString(), "2026-11-13T15:00:00.000Z");
  const almost = upcomingDayProgramme(new Date("2026-11-13T14:59:59.999Z"), "utc");
  assert.equal(almost.dayOffset, 0);
  const switched = upcomingDayProgramme(new Date("2026-11-13T15:00:00.000Z"), "utc");
  assert.equal(switched.dayOffset, 1);
  assert.equal(switched.dayKey, "2026-11-14");
  assert.equal(switched.events[0].id, "setup-6");
  assert.equal(switched.highlightedIndex, 0);
  assert.equal(switched.cutoff, null);
});

test("Auckland local calendar has tomorrow after cutoff even while the UTC date differs", () => {
  const original = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    // Monday 13:30 UTC is Tuesday 02:30 NZDT. Cutoff is Tuesday 04:00 local.
    const before = upcomingDayProgramme(new Date("2026-11-23T14:59:59Z"), "local");
    assert.equal(before.dayKey, "2026-11-24");
    assert.equal(before.dayOffset, 0);
    assert.equal(before.events.at(-1).id, "mon-late");
    assert.equal(before.cutoff.toISOString(), "2026-11-23T15:00:00.000Z");
    const after = upcomingDayProgramme(new Date("2026-11-23T15:00:00Z"), "local");
    assert.equal(after.dayKey, "2026-11-25");
    assert.equal(after.dayOffset, 1);
    assert.equal(after.events[0].id, "setup-2");
    // The same instant in UTC mode is still Monday until UTC's own cutoff.
    const utc = upcomingDayProgramme(new Date("2026-11-23T10:00:00Z"), "utc");
    const local = upcomingDayProgramme(new Date("2026-11-23T10:00:00Z"), "local");
    assert.equal(utc.dayKey, "2026-11-23");
    assert.equal(local.dayKey, "2026-11-24");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("session-day assignment stays grounded to real instants across Auckland DST changes", () => {
  const original = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    for (const iso of ["2027-04-03T13:35:00Z", "2027-09-25T13:35:00Z"]) {
      const now = new Date(iso);
      const plan = upcomingDayProgramme(now, "local");
      assert(plan.events.length > 0);
      assert(plan.events.every(event => programmeDayKey(event, "local") === plan.dayKey));
      assert(plan.events.every(event => Number.isFinite(event.start.getTime())));
      const expected = occurrencesAround(now, 1, 2)
        .filter(event => programmeDayKey(event, "local") === plan.dayKey);
      assert.deepEqual(plan.events.map(event => event.start.getTime()), expected.map(event => event.start.getTime()));
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});


test("Brisbane retains yesterday's programme across midnight until exactly 01:00 AEST", () => {
  const original = process.env.TZ;
  process.env.TZ = "Australia/Brisbane";
  try {
    const samples = [
      ["2026-11-23T13:45:00Z", "2026-11-23", 0],  // Monday 23:45 AEST
      ["2026-11-23T13:59:59Z", "2026-11-23", 0],  // Monday 23:59:59
      ["2026-11-23T14:00:00Z", "2026-11-23", -1], // Tuesday 00:00
      ["2026-11-23T14:59:59.999Z", "2026-11-23", -1], // Tuesday 00:59:59.999
      ["2026-11-23T15:00:00.000Z", "2026-11-24", 0], // Tuesday 01:00 precisely
    ];
    for (const [instant, key, offset] of samples) {
      const plan = upcomingDayProgramme(new Date(instant), "local");
      assert.equal(plan.dayKey, key, instant);
      assert.equal(plan.dayOffset, offset, instant);
      if (offset === -1) {
        assert.equal(plan.events.at(-1).id, "mon-late");
        assert.equal(plan.cutoff?.toISOString(), "2026-11-23T15:00:00.000Z");
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("UTC and Auckland cutoff change at precisely 90 minutes, without 100 ms delay", () => {
  const original = process.env.TZ;
  process.env.TZ = "Pacific/Auckland";
  try {
    const justBefore = upcomingDayProgramme(new Date("2026-11-23T14:59:59.999Z"), "local");
    const exact = upcomingDayProgramme(new Date("2026-11-23T15:00:00.000Z"), "local");
    assert.equal(justBefore.dayKey, "2026-11-24");
    assert.equal(justBefore.dayOffset, 0);
    assert.equal(exact.dayKey, "2026-11-25");
    assert.equal(exact.dayOffset, 1);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
