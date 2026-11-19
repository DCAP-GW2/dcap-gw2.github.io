# DCAP Points v2.0 — r001 Continuing-Season Integration QA
**Date:** 19 November 2026 (Pacific/Auckland)  
**Status:** PRE-PUBLICATION QA — HOLD for Node and real-browser acceptance  
**Branch:** `dcap-v2-continuing-r001-20261119` (non-publishing)  
**Production:** `main` remains pinned to `r000`

## Scope and invariant totals

| Source | Scored contributions | v2 points |
|---|---:|---:|
| Immutable historical `r000` | 551 | 1,694 |
| Continuing-season additive `r001` | 60 | 192 |
| **Combined website view** | **611** | **1,886** |

- Existing public profiles: **37**; canonical members: **43**; missing-public-ID states: **6**.
- New awards represent **18** existing public members, with no duplicate IDs or invalid member references.
- Five new DBS Commander awards use the already approved, specifically scoped 2-point amendment `N5E-DBS-COMMANDER-2`; this review did not change the committee-approved base rules.
- Cycle 0 retains **Test Run**; rewards remain **disabled**.
- The continuing release is an **additive, date-only public delta**, not a replacement for the historical snapshot. Its owner-attested date range is 22–26 October 2026.
- Original v1 point records and historical `r000` release bytes remain unchanged.

## Integrity evidence

- `r000` SHA-256: `2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73` — matched.
- `r001` SHA-256: `c7f3478b530e589807a10aeb2501b8543036d7ed8227f61cbbe4f4549ce060f4` — matched.
- `main/points/data/v2/selection.json` still selects `r000`.
- This branch's selector selects `r001`, with `r000` as last-known-good. **Merging this branch would be a publication action; do not merge without explicit owner approval.**

## Changes in this QA continuation

- Added `tests/points-v2-continuing.test.js`, containing **14 Node tests** covering release hashes, reconciliation, identities, ranks, grains, source metadata, amendment immutability, privacy fields, altered/invalid inputs, release selection, cache fallback, corruption, and controlled rollback.
- Hardened `points/v2/continuing-loader.mjs`:
  1. A valid current HTTPS selection of `r000` is authoritative for deliberate rollback, rather than allowing a previously cached `r001` to override it.
  2. When the selection is unavailable, cached `r001` is accepted only if its digest matches the reviewed, pinned `r001` digest. A self-declared cache digest is not a trust anchor.
  3. Cache timestamps must be finite and not in the future.
  4. Responses with a stream are bounded while reading, avoiding unbounded buffering of oversized responses.
- At each subsequent public revision, add the newly approved digest to the offline trust list and update the selection under the same controlled publication procedure.

## Checks actually executed

**27/27 focused source-and-data checks passed** in an isolated JavaScript harness that loaded the actual GitHub source strings and the actual release JSON:

- **18 validation/aggregation/tamper checks:** existing historical validator, continuing validator, totals, source-accounting, identities, ranks, event/day grains, rewards, and nine invalid-data mutations.
- **9 hash/loader checks:** SHA-256 checks for both files, successful `r001` loading, explicit `r000` rollback, missing `r001` payload, manifest outage with pinned cached `r001`, forged cache rejection, stale verified cache fallback, and tampered-cache rejection.
- The new Node test file was also checked for JavaScript parse validity.

**Not claimed as executed:** the complete `npm test` suite, Chrome/Playwright testing, accessibility audit, mobile viewport tests, real Pages delivery of `r001`, or a live cutover/rollback rehearsal. These remain acceptance gates.

## Remaining QA and release gates

1. In a checkout of `dcap-v2-continuing-r001-20261119`, execute `npm test` and capture results; resolve any failures.
2. Run real-browser tests for all seven Points views, profile navigation, 37 visible profiles, ranking ties, date labels, disabled rewards, and 1,886/611 totals.
3. Check browser fallback with missing, corrupt, mismatched-hash, oversized and old/new selection states, and rehearse `r001` → `r000` rollback with a populated `r001` browser cache.
4. Validate that public release content contains no private journal audit fields, raw Discord evidence, owner credentials or unapproved identity mappings.
5. Inspect the exact release diff, verify Pages source and current production revision, and obtain **separate explicit owner approval** for public publication and activation.

**Release state: HOLD.** No `main` push, PR merge, Pages update, Apps Script or Google Sheets mutation, new triggers, or reward activation was performed in this QA continuation.
