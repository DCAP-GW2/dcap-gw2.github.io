import { pointsConfig } from './config.js';
import { validatePointsData } from './validation.js';

let lastKnownGoodData = null;
let pendingRequest = null;

// One atomic record serves as fresh cache for 60 seconds, then as LKG.
// Cache time is delivery metadata; it must never become the source timestamp.
function readStoredData() {
  try {
    const record = JSON.parse(localStorage.getItem(pointsConfig.storageKey));
    if (record?.version !== pointsConfig.cacheVersion ||
        !Number.isFinite(record.cachedAt) || record.cachedAt < 0 ||
        !validatePointsData(record.data).valid) return null;
    return record;
  } catch {
    // Storage may be unavailable, full or corrupted. In-memory data still works.
    return null;
  }
}

function remember(data) {
  lastKnownGoodData = { version: pointsConfig.cacheVersion, cachedAt: Date.now(), data };
  try {
    localStorage.setItem(pointsConfig.storageKey, JSON.stringify(lastKnownGoodData));
  } catch {
    // A storage failure must not discard a successfully validated response.
  }
}

async function fetchPointsData() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pointsConfig.requestTimeoutMs);
  try {
    const response = await fetch(pointsConfig.apiUrl, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('request');
    const candidate = await response.json();
    if (!validatePointsData(candidate).valid) throw new Error('validation');
    remember(candidate);
    return { state: 'live', data: candidate };
  } catch {
    // Never log payloads, names, URLs, response bodies or raw exception messages.
    console.warn('DCAP Points: refresh unavailable; retaining available data.');
    return {
      state: lastKnownGoodData ? 'fallback' : 'unavailable',
      data: lastKnownGoodData?.data ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Only validated public payloads may cross this boundary into rendering. */
export async function getPointsData() {
  if (!pointsConfig.apiEnabled) return { state: 'disabled', data: null };
  if (pendingRequest) return pendingRequest;
  lastKnownGoodData ??= readStoredData();
  if (lastKnownGoodData) {
    const age = Date.now() - lastKnownGoodData.cachedAt;
    if (age >= 0 && age < pointsConfig.cacheDurationMs) {
      return { state: 'cached', data: lastKnownGoodData.data };
    }
  }
  pendingRequest = fetchPointsData();
  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}
