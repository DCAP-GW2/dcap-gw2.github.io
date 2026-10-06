import { pointsConfig } from './config.js';

/**
 * Future boundary for read-only public Points JSON.
 * Phase 1 always returns no data and performs no network or cache operations.
 * Changing configuration alone must not accidentally enable a live connection.
 * Phase 2 will add retrieval, validation, a 60-second cache and last-known-good fallback.
 */
export async function getPointsData() {
  return {
    state: pointsConfig.apiEnabled ? 'unavailable' : 'disabled',
    data: null,
  };
}
