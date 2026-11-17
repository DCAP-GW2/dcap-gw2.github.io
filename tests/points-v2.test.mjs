import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateV2 } from '../js/points/v2/validation.js';
import { DCAP_V2 } from '../js/points/v2/engine.js';
import { DCAP_FEED_V2 } from '../js/points/v2/feed.js';
import { createV2Loader, V2_CACHE } from '../js/points/v2/cache.js';
import { cycleRanking, previewAllowed, recentForMember } from '../js/points/v2/page.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/schema-v2-synthetic.json', import.meta.url)));
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(value).digest('hex');
function rehash(payload) {
  payload.validation.contentHash = DCAP_FEED_V2.contentHash(payload, sha);
  return payload;
}
function storage() {
  const items = new Map();
  return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}
const response = value => new Response(JSON.stringify(value), { status: 200 });

test('accepted synthetic fixture regenerates, validates, and reconciles numerical totals', async () => {
  assert.equal(await validateV2(fixture), true);
  assert.deepEqual(DCAP_FEED_V2.validate(fixture, sha), { valid: true });
  assert.equal(fixture.population.sourceCount, 25);
  assert.equal(fixture.population.awardCandidateCount, 24);
  assert.equal(fixture.population.unresolvedCount, 1);
  assert.equal(fixture.population.candidatePoints, 82);
  for (const key of ['eventTotals', 'roleTotals', 'eventRoleTotals', 'dailyTotals', 'cycleTotals']) {
    assert.equal(fixture[key].reduce((sum, item) => sum + item.candidatePoints, 0), 82, key);
  }
  assert.equal(fixture.members.reduce((sum, item) => sum + item.candidatePoints, 0), 82);
});

test('strict contract rejects wrong versions, missing fields, private fields, and malformed dates', async () => {
  for (const change of [
    p => { p.schemaVersion = 1; },
    p => { p.contractVersion = '2.0.0'; },
    p => { delete p.population; },
    p => { p.privateSourceHash = 'secret'; },
    p => { p.members[0].member_key = 'private'; },
    p => { p.awards[0].eventDate = '2026-02-30'; },
    p => { p.publication.complete = true; },
  ]) {
    const p = clone(fixture); change(p);
    assert.equal(await validateV2(rehash(p)), false);
  }
});

test('rejects duplicates, bad references, wrong aggregates, hashes and oversized payloads', async () => {
  for (const change of [
    p => { p.members.push(clone(p.members[0])); p.population.observedPublicIdCount++; p.population.canonicalMemberCount++; },
    p => { p.awards[1].id = p.awards[0].id; },
    p => { p.awards[0].memberId = 'm-ffffffffffffffff'; },
    p => { p.eventTotals[0].candidatePoints++; },
    p => { p.awards[0].points = null; },
  ]) {
    const p = clone(fixture); change(p);
    assert.equal(await validateV2(rehash(p)), false);
  }
  const wrongHash = clone(fixture); wrongHash.validation.contentHash = '0'.repeat(64);
  assert.equal(await validateV2(wrongHash), false);
  const tooLarge = clone(fixture); tooLarge.padding = 'x'.repeat(2_100_000);
  assert.equal(await validateV2(tooLarge), false);
});

test('rules include 24 numeric definitions, pending Other Commander, and distinct roles', () => {
  assert.equal(fixture.rules.filter(rule => Number.isInteger(rule.points)).length, 24);
  assert.deepEqual(fixture.rules.find(rule => rule.roleId === 'other-commander').points, null);
  assert.equal(fixture.rules.find(rule => rule.eventId === 'triple-trouble' && rule.roleId === 'setup').points, 3);
  assert.equal(fixture.rules.find(rule => rule.roleId === 'derv-escort').points, 2);
  assert.equal(fixture.rules.find(rule => rule.roleId === 'doordash-feed').points, 2);
  assert.equal(fixture.rules.filter(rule => rule.roleId === 'sub-lane-lead').length, 3);
  assert.equal(fixture.awards.every(award => Number.isInteger(award.points)), true);
  assert.equal(fixture.recentAwardIds.length, 10);
});

test('local preview gate, historical cycle ranking, and opaque recent history', () => {
  assert.equal(previewAllowed(new URL('http://localhost:8000/points/?pointsPreview=synthetic')), true);
  assert.equal(previewAllowed(new URL('https://dcap-gw2.github.io/points/?pointsPreview=synthetic')), false);
  assert.equal(previewAllowed(new URL('http://localhost:8000/points/')), false);
  assert.equal(cycleRanking(fixture, 0)[0].candidatePoints, 36);
  assert.equal(cycleRanking(fixture, 1)[0].candidatePoints, 46);
  assert.equal(recentForMember(fixture, fixture.members[0].id).length, 10);
  assert.deepEqual(fixture.members.map(member => member.id), ['m-0123456789abcdef']);
  assert.equal(fixture.population.missingPublicIdCount, 1);
});

test('historical cycle ranks use competition ties with stable public-ID ordering', () => {
  const data = {
    members: ['m-0000000000000003', 'm-0000000000000002', 'm-0000000000000001']
      .map(id => ({ id, displayName: 'Fictional' })),
    awards: [
      { memberId: 'm-0000000000000003', cycleId: 7, points: 2 },
      { memberId: 'm-0000000000000002', cycleId: 7, points: 5 },
      { memberId: 'm-0000000000000001', cycleId: 7, points: 5 },
    ],
  };
  assert.deepEqual(cycleRanking(data, 7).map(row => [row.id, row.partialRank]), [
    ['m-0000000000000001', 1], ['m-0000000000000002', 1], ['m-0000000000000003', 3],
  ]);
  assert.deepEqual(cycleRanking(data, 8), []);
});

test('v2 cache is isolated, fresh for 60 seconds, and rejects corrupted or v1 records', async () => {
  const store = storage(); let now = 1_000; let requests = 0;
  const loader = createV2Loader({ storage: store, now: () => now, fetcher: async () => { requests++; return response(fixture); } });
  assert.equal((await loader.load()).state, 'live');
  assert.equal((await loader.load()).state, 'cached');
  assert.equal(requests, 1);
  assert.equal(store.items.has(V2_CACHE.storageKey), true);
  assert.equal(store.items.has('dcap.points.public.v1'), false);
  now += 60_000;
  assert.equal((await loader.load()).state, 'live');
  assert.equal(requests, 2);
  for (const bad of ['broken', JSON.stringify({ version: 1, cachedAt: now, data: fixture }),
    JSON.stringify({ version: V2_CACHE.cacheVersion, cachedAt: now + 1, data: fixture })]) {
    store.setItem(V2_CACHE.storageKey, bad);
    const freshLoader = createV2Loader({ storage: store, now: () => now, fetcher: async () => response(fixture) });
    assert.equal((await freshLoader.load()).state, 'live');
  }
});

test('invalid responses, HTTP failures, and timeout cannot replace last-known-good', async () => {
  const store = storage(); let now = 1_000;
  const live = createV2Loader({ storage: store, now: () => now, fetcher: async () => response(fixture) });
  await live.load(); now += 60_000;
  const bad = clone(fixture); bad.population.candidatePoints++;
  const failure = createV2Loader({ storage: store, now: () => now, fetcher: async () => response(bad) });
  assert.equal((await failure.load()).state, 'fallback');
  const http = createV2Loader({ storage: store, now: () => now, fetcher: async () => new Response('', { status: 500 }) });
  assert.equal((await http.load()).state, 'fallback');
  let resolveLate;
  const late = createV2Loader({ storage: store, now: () => now,
    fetcher: () => new Promise(resolve => { resolveLate = resolve; }),
    schedule: callback => { queueMicrotask(callback); return 1; }, cancel: () => {} });
  assert.equal((await late.load()).state, 'fallback');
  resolveLate(response(fixture)); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(JSON.parse(store.getItem(V2_CACHE.storageKey)).cachedAt, 1_000);
});

test('malformed, oversized, network and storage failures remain unavailable or use memory', async () => {
  for (const fetcher of [
    async () => new Response('{bad json', { status: 200 }),
    async () => new Response('x'.repeat(2_100_000), { status: 200 }),
    async () => { throw new Error('network'); },
  ]) {
    const loader = createV2Loader({ storage: storage(), fetcher });
    assert.equal((await loader.load()).state, 'unavailable');
  }
  const brokenStorage = { getItem: () => { throw new Error('storage'); }, setItem: () => { throw new Error('storage'); } };
  const loader = createV2Loader({ storage: brokenStorage, fetcher: async () => response(fixture) });
  assert.equal((await loader.load()).state, 'live');
  assert.equal((await loader.load()).state, 'cached');
});
