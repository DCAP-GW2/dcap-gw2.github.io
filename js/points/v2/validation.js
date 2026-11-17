import { DCAP_V2 } from './engine.js';
import { DCAP_FEED_V2 } from './feed.js';

export const MAX_V2_BYTES = DCAP_FEED_V2.maxBytes;
const encoder = new TextEncoder();

async function sha256(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Prepare only the hashes requested by the accepted synchronous semantic validator. */
export async function validateV2(payload) {
  try {
    if (!globalThis.crypto?.subtle || encoder.encode(JSON.stringify(payload)).byteLength > MAX_V2_BYTES ||
        !Array.isArray(payload?.awards) || !payload?.validation) return false;
    const canonical = DCAP_V2.stable;
    const copy = JSON.parse(JSON.stringify(payload));
    delete copy.validation.contentHash;
    const strings = [canonical(copy), ...payload.awards.map(award => canonical([
      award.memberId, award.eventId, award.roleId, award.eventDate, award.cycleId, award.eventInstance,
    ]))];
    const hashes = new Map(await Promise.all(strings.map(async value => [value, await sha256(value)])));
    // An unexpected synchronous hash request is a validation failure, never a Promise.
    return DCAP_FEED_V2.validate(payload, value => {
      if (!hashes.has(value)) throw new Error('FEED_V2_INVALID');
      return hashes.get(value);
    }).valid === true;
  } catch {
    return false;
  }
}
