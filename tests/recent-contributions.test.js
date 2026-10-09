import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePointsData } from '../js/points/validation.js';
import { communityRecentContributions, memberRecentContributions, memberRecentView } from '../js/points/recent-contributions.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/points-v1.json', import.meta.url)));
const payload = () => structuredClone(fixture);
const entry = (eventDate = '2026-10-08', points = 5) =>
  ({ eventDate, eventType: 'Triple Trouble', role: 'Commander', points });

test('optional v1 history distinguishes missing, empty, and populated detail', () => {
  const data = payload();
  for (const count of [0, 1, 5, 6, 10]) {
    data.members[0].recentContributions = Array.from({ length: count }, () => entry());
    assert.equal(validatePointsData(data).valid, true, `count ${count}`);
    assert.equal(memberRecentContributions(data.members[0]).length, count);
  }
  delete data.members[0].recentContributions;
  assert.equal(validatePointsData(data).valid, true);
  assert.equal(memberRecentContributions(data.members[0]), null);
  data.members[0].recentContributions = [];
  assert.deepEqual(memberRecentContributions(data.members[0]), []);
});

test('profile view starts at five, expands to at most ten, and hides unnecessary controls', () => {
  for (const count of [0, 1, 5, 6, 10, 12]) {
    const records = Array.from({ length: count }, (_, index) => index);
    const collapsed = memberRecentView(records, false);
    const expanded = memberRecentView(records, true);
    assert.deepEqual(collapsed.visible, records.slice(0, 5));
    assert.deepEqual(expanded.visible, records.slice(0, 10));
    assert.equal(collapsed.showToggle, count > 5);
    assert.equal(collapsed.label, 'Show more');
    assert.equal(expanded.label, 'Show less');
  }
});

test('rejects excess, malformed, out-of-season, and ascending history', () => {
  const cases = [
    Array.from({ length: 11 }, () => entry()),
    [entry('2026-02-30')],
    [entry('2026-10-09')],
    [entry('2026-09-30')],
    [entry('2026-10-08T12:00:00Z')],
    [entry('2026-10-08', Infinity)],
    [entry('2026-10-08', -1)],
    [{ ...entry(), note: 'private' }],
    [{ ...entry(), eventType: '' }],
    [entry('2026-10-07'), entry('2026-10-08')],
  ];
  for (const recentContributions of cases) {
    const data = payload();
    data.members[0].recentContributions = recentContributions;
    assert.equal(validatePointsData(data).reason, 'recent-contributions');
  }
});

test('identical-looking entries remain separate and capped lists do not replace aggregate checks', () => {
  const data = payload();
  data.members[0].recentContributions = [entry(), entry()];
  assert.equal(validatePointsData(data).valid, true);
  assert.equal(memberRecentContributions(data.members[0]).length, 2);
  data.roleTotals[0].value = 14;
  assert.equal(validatePointsData(data).reason, 'role-totals');
});

test('global latest ten use public member IDs and preserve same-day feed order', () => {
  const data = payload();
  const first = data.members[0];
  first.displayName = 'Renamed Member';
  first.recentContributions = [entry('2026-10-08', 1), entry('2026-10-08', 2),
    ...Array.from({ length: 8 }, () => entry('2026-10-02', 1))];
  const second = { ...first, id: 'public-b', displayName: 'Other Member',
    recentContributions: [entry('2026-10-08', 3), entry('2026-10-07', 4),
      ...Array.from({ length: 8 }, () => entry('2026-10-01', 1))] };
  const records = communityRecentContributions([second, first]);
  assert.equal(records.length, 10);
  assert.deepEqual(records.slice(0, 4).map(({ member, contribution }) =>
    [member.id, member.displayName, contribution.points]), [
    ['public-a', 'Renamed Member', 1],
    ['public-a', 'Renamed Member', 2],
    ['public-b', 'Other Member', 3],
    ['public-b', 'Other Member', 4],
  ]);
  assert.equal(communityRecentContributions([first, { ...second, recentContributions: undefined }]), null);
  assert.deepEqual(communityRecentContributions([{ ...first, recentContributions: [] }]), []);
});

test('API retains v1 cache and last-known-good behaviour for optional detail', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  try {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return { ok: true, json: async () => payload() };
    };
    const { getPointsData } = await import('../js/points/api.js?live-test');
    assert.equal((await getPointsData()).state, 'live');
    assert.equal((await getPointsData()).state, 'cached');
    assert.equal(fetchCount, 1);

    const old = payload();
    delete old.members[0].recentContributions;
    storage.set('dcap.points.public.v1', JSON.stringify({ version: 1,
      cachedAt: Date.now() - 120_000, data: old }));
    globalThis.fetch = async () => { throw new Error('offline'); };
    const fallback = await import('../js/points/api.js?fallback-test');
    const result = await fallback.getPointsData();
    assert.equal(result.state, 'fallback');
    assert.equal(memberRecentContributions(result.data.members[0]), null);

    const invalid = payload();
    invalid.members[0].recentContributions[0].points = -1;
    globalThis.fetch = async () => ({ ok: true, json: async () => invalid });
    const rejected = await import('../js/points/api.js?invalid-history-test');
    assert.equal((await rejected.getPointsData()).state, 'fallback');

    storage.clear();
    const unavailable = await import('../js/points/api.js?unavailable-test');
    assert.equal((await unavailable.getPointsData()).state, 'unavailable');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});
