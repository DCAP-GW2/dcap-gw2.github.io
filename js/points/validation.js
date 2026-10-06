/**
 * Reserved validation boundary. Phase 1 does not validate a live payload.
 *
 * Before accepting data in Phase 2, confirm the public contract and check:
 * - required top-level fields and the configured schemaVersion;
 * - meta.totalPoints against member totals;
 * - each member's total against their category sum;
 * - sourceUpdatedAt and freshness metadata.
 *
 * Failed validation must preserve lastKnownGoodData (or an honest empty state).
 * Keep public-data-only checks here; preferred display names belong in rendering.
 * No validation result is reported until these checks are implemented.
 */
export {};
