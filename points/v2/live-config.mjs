/**
 * Deployment switch is deliberately disabled in the unpublished review branch.
 * Set URL to a separately approved, read-only v2 Google Apps Script web app
 * ONLY at the supervised website cutover. Never use existing v1 V4/V9 deployments.
 */
export const LIVE_FEED_ENABLED = false;
export const LIVE_FEED_URL = '';
export const LIVE_CACHE_MS = 60_000;
export const LIVE_TIMEOUT_MS = 15_000;
export const LIVE_MAX_BYTES = 2_000_000;
