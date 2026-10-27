import { validateV2, MAX_V2_BYTES } from './validation.js';

export const V2_CACHE = Object.freeze({
  storageKey: 'dcap.points.public.v2.preview.dev.1',
  cacheVersion: '2.0.0-dev.1',
  cacheDurationMs: 60_000,
  requestTimeoutMs: 15_000,
});

const copy = value => JSON.parse(JSON.stringify(value));

export async function boundedJson(response) {
  if (!response?.ok) throw new Error('unavailable');
  const chunks = [];
  let size = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_V2_BYTES) throw new Error('unavailable');
        chunks.push(value);
      }
    } catch (error) {
      try { await reader.cancel(); } catch { /* response already closed */ }
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAX_V2_BYTES) throw new Error('unavailable');
  return JSON.parse(body);
}

/** Dedicated preview cache. Invalid data never becomes a last-known-good value. */
export function createV2Loader({
  storage, fetcher, validate = validateV2, now = Date.now,
  schedule = setTimeout, cancel = clearTimeout,
}) {
  let lastKnownGood = null;
  let pending = null;
  async function stored() {
    try {
      const record = JSON.parse(storage.getItem(V2_CACHE.storageKey));
      if (record?.version !== V2_CACHE.cacheVersion || !Number.isFinite(record.cachedAt) ||
          record.cachedAt < 0 || record.cachedAt > now() || !await validate(record.data)) return null;
      return record;
    } catch { return null; }
  }
  function remember(data) {
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
        if (!await validate(result)) throw new Error('unavailable');
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
      if (lastKnownGood && await validate(lastKnownGood.data)) {
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

const fixtureUrl = new URL('../../../tests/fixtures/schema-v2-synthetic.json', import.meta.url);
let previewLoader;
export function getV2PreviewData() {
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
  previewLoader ??= createV2Loader({
    storage,
    fetcher: ({ signal }) => fetch(fixtureUrl, { signal, cache: 'no-store', credentials: 'omit' }),
  });
  return previewLoader.load();
}
