import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENTS, occurrencesAround, programmeDayKey, calendarKey, formatProgrammeTime,
  upcomingDayProgramme, overviewDates, weekDates,
} from "../js/events/schedule.mjs";

function inZone(zone, fn) {
  const original = process.env.TZ;
  process.env.TZ = zone;
  try { fn(); }
  finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

const monday = new Date("2026-11-23T11:00:00Z");
const mondayIds = ["setup-1", "tt-1", "dbs-1", "mon-late"];
function mondayRun() {
  return occurrencesAround(monday, 1, 1).filter(event =>
    mondayIds.includes(event.id) && calendarKey(event.start, "utc") === "2026-11-23"
  );
}

test("UTC programme and individual occurrence instants remain unchanged", () => {
  assert.equal(EVENTS.length, 29);
  const run = mondayRun();
  assert.deepEqual(run.map(event => event.id), mondayIds);
  assert.deepEqual(run.map(event => event.start.toISOString()), [
    "2026-11-23T11:30:00.000Z",
    "2026-11-23T12:00:00.000Z",
    "2026-11-23T13:00:00.000Z",
    "2026-11-23T13:30:00.000Z",
  ]);
  assert(run.every(event => event.sessionStart.toISOString() === "2026-11-23T11:30:00.000Z"));
  assert(run.every(event => programmeDayKey(event, "utc") === "2026-11-23"));
  assert(run.every(event => !formatProgrammeTime(event, "utc").includes("\n")));
});

test("Sydney: Monday TT run remains a four-activity Monday programme across midnight", () => {
  inZone("Australia/Sydney", () => {
    const run = mondayRun();
    assert(run.every(event => programmeDayKey(event) === "2026-11-23"));
    assert.deepEqual(run.map(event => calendarKey(event.start)), [
      "2026-11-23", "2026-11-23", "2026-11-24", "2026-11-24",
    ]);
    assert(!formatProgrammeTime(run[0]).includes("\n"));
    assert.match(formatProgrammeTime(run[2]), /^Tue\n12:00\s?am$/i);
    assert.match(formatProgrammeTime(run[3]), /^Tue\n12:30\s?am$/i);
    const all = occurrencesAround(monday, 1, 2);
    const mondayCard = all.filter(event => programmeDayKey(event) === "2026-11-23");
    assert.deepEqual(mondayCard.map(event => event.id), mondayIds);
    assert(!mondayCard.some(event => event.id === "sun-late"));
    assert.equal(calendarKey(overviewDates(monday)[0]), "2026-11-23");
    assert.equal(calendarKey(weekDates(monday)[3]), "2026-11-23");
  });
});

test("Sydney: Upcoming Activities preserves Monday until Tuesday 02:00 AEDT, exactly", () => {
  inZone("Australia/Sydney", () => {
    const samples = [
      ["2026-11-23T12:59:59Z", "2026-11-23", 0],
      ["2026-11-23T13:00:00Z", "2026-11-23", -1],
      ["2026-11-23T14:59:59.999Z", "2026-11-23", -1],
      ["2026-11-23T15:00:00.000Z", "2026-11-24", 0],
    ];
    for (const [instant, expectedKey, expectedOffset] of samples) {
      const view = upcomingDayProgramme(new Date(instant));
      assert.equal(view.dayKey, expectedKey, instant);
      assert.equal(view.dayOffset, expectedOffset, instant);
      assert.equal(view.events.length, 4, instant);
      assert(view.events.every(event => programmeDayKey(event) === view.dayKey));
    }
    const ongoing = upcomingDayProgramme(new Date("2026-11-23T13:00:00Z"));
    assert.equal(ongoing.events.at(-1).id, "mon-late");
    assert.equal(ongoing.cutoff.toISOString(), "2026-11-23T15:00:00.000Z");
    assert.equal(ongoing.events[ongoing.highlightedIndex].id, "mon-late");
  });
});

test("Auckland: UTC Monday run belongs to Tuesday, while Friday Gyala stands alone", () => {
  inZone("Pacific/Auckland", () => {
    assert(mondayRun().every(event => programmeDayKey(event) === "2026-11-24"));
    const all = occurrencesAround(new Date("2026-11-13T12:00:00Z"), 1, 1);
    const gyala = all.find(event =>
      event.id === "fri-gyala" && calendarKey(event.start, "utc") === "2026-11-13");
    const fridayTT = all.find(event =>
      event.id === "setup-5" && calendarKey(event.start, "utc") === "2026-11-13");
    assert.equal(programmeDayKey(gyala), "2026-11-13");
    assert.equal(programmeDayKey(fridayTT), "2026-11-14");
    assert.equal(gyala.sessionStart.getTime(), gyala.start.getTime());
    assert(!formatProgrammeTime(gyala).includes("\n"));
  });
});

test("Extreme offsets anchor all four daily events to the local session start date", () => {
  inZone("Etc/GMT+12", () => {
    const run = mondayRun();
    assert(run.every(event => programmeDayKey(event) === "2026-11-22"));
    assert.deepEqual(run.map(event => calendarKey(event.start)), [
      "2026-11-22", "2026-11-23", "2026-11-23", "2026-11-23",
    ]);
    assert(formatProgrammeTime(run[1]).startsWith("Mon\n"));
  });
  inZone("Pacific/Kiritimati", () => {
    const run = mondayRun();
    assert(run.every(event => programmeDayKey(event) === "2026-11-24"));
    assert(run.every(event => calendarKey(event.start) === "2026-11-24"));
    assert(run.every(event => !formatProgrammeTime(event).includes("\n")));
  });
});

test("DST changes local clock times, not programme membership or UTC instants", () => {
  const winter = occurrencesAround(new Date("2027-06-07T11:30:00Z"), 0, 0)
    .find(event => event.id === "setup-1");
  const summer = mondayRun()[0];
  inZone("Australia/Sydney", () => {
    assert.equal(winter.start.getHours(), 21);
    assert.equal(summer.start.getHours(), 22);
    assert.equal(programmeDayKey(winter), "2027-06-07");
    assert.equal(programmeDayKey(summer), "2026-11-23");
  });
  inZone("Europe/London", () => {
    assert.equal(winter.start.getHours(), 12);
    assert.equal(summer.start.getHours(), 11);
    assert.equal(programmeDayKey(winter), "2027-06-07");
    assert.equal(programmeDayKey(summer), "2026-11-23");
  });
});

test("Year boundary and UTC mode remain stable", () => {
  inZone("Australia/Sydney", () => {
    const run = occurrencesAround(new Date("2026-12-31T12:00:00Z"), 0, 1)
      .filter(event => event.id === "setup-4" && calendarKey(event.start, "utc") === "2026-12-31");
    assert.equal(run.length, 1);
    assert.equal(programmeDayKey(run[0]), "2026-12-31");
    assert.equal(programmeDayKey(run[0], "utc"), "2026-12-31");
    assert.equal(calendarKey(overviewDates(new Date("2026-12-31T12:00:00Z"))[1]), "2027-01-01");
  });
});
