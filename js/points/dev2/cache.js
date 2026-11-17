import { validateAsync as validateV2 } from './feed.mjs';
import { boundedJson } from '../v2/cache.js';

export const V2_CACHE = Object.freeze({
  storageKey: 'dcap.points.public.v2.preview.dev.2',
  cacheVersion: '2.0.0-dev.2',
  cacheDurationMs: 60_000,
  requestTimeoutMs: 15_000,
});

const copy = value => JSON.parse(JSON.stringify(value));

/** Dedicated preview cache. Invalid data never becomes a last-known-good value. */
export function createV2Loader({
  storage, fetcher, validate = validateV2, now = Date.now,
  schedule = setTimeout, cancel = clearTimeout, expectedRevision = null, expectedHash = null,
}) {
  let pin = expectedRevision && expectedHash ? { revision: expectedRevision, hash: expectedHash } : null;
  const completePin = Boolean(expectedRevision) === Boolean(expectedHash);
  const accepted = async data => completePin && await validate(data) && (!pin ||
    (data.migration.revision === pin.revision && data.validation.contentHash === pin.hash));
  let lastKnownGood = null;
  let pending = null;
  async function stored() {
    try {
      const record = JSON.parse(storage.getItem(V2_CACHE.storageKey));
      if (record?.version !== V2_CACHE.cacheVersion || !Number.isFinite(record.cachedAt) ||
          record.cachedAt < 0 || record.cachedAt > now() || !await accepted(record.data)) return null;
      return record;
    } catch { return null; }
  }
  function remember(data) {
    pin ??= { revision: data.migration.revision, hash: data.validation.contentHash };
    lastKnownGood = { version: V2_CACHE.cacheVersion, cachedAt: now(), data: copy(data) };
    try { storage.setItem(V2_CACHE.storageKey, JSON.stringify(lastKnownGood)); } catch { /* in-memory LKG */ }
  }
  async function refresh() {
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = schedule(() => { controller.abort(); reject(new Error('unavailable')); }, V2_CACHE.requestTimeoutMs);
      });
      const candidate = await Promise.race([(async () => {
        const result = await boundedJson(await fetcher({ signal: controller.signal }));
        if (!await accepted(result)) throw new Error('unavailable');
        return result;
      })(), timeout]);
      remember(candidate);
      return { state: 'live', data: copy(candidate), sourceStale: true };
    } catch {
      return { state: lastKnownGood ? 'fallback' : 'unavailable',
        data: lastKnownGood ? copy(lastKnownGood.data) : null, sourceStale: true };
    } finally { cancel(timer); }
  }
  async function load() {
    if (pending) return pending;
    pending = (async () => {
      lastKnownGood ??= await stored();
      if (lastKnownGood && await accepted(lastKnownGood.data)) {
        pin ??= { revision: lastKnownGood.data.migration.revision, hash: lastKnownGood.data.validation.contentHash };
        const age = now() - lastKnownGood.cachedAt;
        if (age >= 0 && age < V2_CACHE.cacheDurationMs) {
          return { state: 'cached', data: copy(lastKnownGood.data), sourceStale: true };
        }
      } else lastKnownGood = null;
      return refresh();
    })();
    try { return await pending; } finally { pending = null; }
  }
  return { load };
}


const emptyStorage = { getItem: () => null, setItem: () => {} };
const unavailable = () => ({state:'unavailable', data:null, sourceStale:true});
export async function getV2PreviewData(context) {
 if (!context) return unavailable();
 let storage = emptyStorage, session = emptyStorage;
 try { storage = window.localStorage ?? emptyStorage; } catch { /* immutable fixture + URL pin remains */ }
 try { session = window.sessionStorage ?? emptyStorage; } catch { /* immutable fixture + URL pin remains */ }
 const sessionKey = 'dcap.points.dev2.session.' + context.name;
 let raw;
 try { raw = session.getItem(sessionKey); } catch { /* storage disabled */ }
 if (raw !== undefined && raw !== null) {
   try {
     const pin = JSON.parse(raw);
     if (!pin || Object.keys(pin).sort().join(',') !== 'hash,revision' ||
         pin.revision !== context.revision || pin.hash !== context.hash) return unavailable();
   } catch { return unavailable(); }
 }
 const scopedStorage = {
   getItem: key => storage.getItem(key + '|' + context.name),
   setItem: (key, value) => storage.setItem(key + '|' + context.name, value),
 };
 const url = new URL('../../../tests/fixtures/dev2/' + context.name + '.json', import.meta.url);
 const result = await createV2Loader({storage:scopedStorage,
   expectedRevision:context.revision, expectedHash:context.hash,
   fetcher: ({signal}) => fetch(url, {signal, cache:'no-store', credentials:'omit'}),
 }).load();
 if (result.data) {
   try { session.setItem(sessionKey, JSON.stringify({revision:context.revision, hash:context.hash})); }
   catch { /* URL and immutable manifest enforce the same binding */ }
 }
 return result;
}
