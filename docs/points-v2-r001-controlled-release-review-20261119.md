# DCAP Points v2.0 — r001 Controlled Release Review

**Date:** 19 November 2026 (Pacific/Auckland)  
**Status:** STAGED HOLD — no authorisation for any production push, merge, publication, selected-revision change or rewards enablement.  
**Review branch:** `release/points-v2-r001-staged-hold-20261119`  
**Historical production base:** `main` at `8fff889c7cd223fecf88cfd2dac30119cc801981`

## 1. Data and confidentiality reconciliation

A fresh owner-private journal read was compared with the public-only `r001` candidate, field by field, without copying private journal or review-queue audit columns to the public repository.

| Check | Evidence |
|---|---|
| Approved continuing rows | 60 of 60 `REAL_APPROVED` |
| Unique private candidate keys / public award IDs | 60 / 60 |
| New points / existing member profiles represented | 192 / 18 |
| Exact journal-to-public matches | **60 of 60**, zero mismatches |
| Source fields matched | event date, event, role, member, rule, points, approved-cycle status |
| Duplicate/colliding public award IDs | 0 |
| Private review queue | 0 cases |
| Journal sequence | 1–60 continuous |
| Recorded digest predecessor links | 60/60 consistent, starting at GENESIS |
| Additional stored journal rows beyond 60 | 0 within currently configured 1,000-row grid |
| Additional stored review cases | 0 within currently configured 1,000-row grid |
| Source evidence | Owner-attested, **date only**; no independent Discord API reconciliation |
| Event-date range in public delta | 22–26 October 2026 |
| Private audit columns copied into `r001` | 0 (closed public schema) |

**Scope limitation:** This verifies the journal's recorded awards, not that all Discord work after 26 October has been submitted. A current owner source-completeness attestation remains required.

## 2. Immutable release totals and hashes

- `r000`: 551 scored contributions, **1,694** historical v2 points.
- `r001`: 60 additional scored contributions, **192** continuing-season v2 points.
- Combined: **611** scored contributions, **1,886** v2 points, **37** existing public profiles.
- Canonical membership remains 43, including 6 missing-public-ID states.
- Original v1 historical awarded points remain **2,371**; v1 records/scores are unchanged.
- Cycle 0 label remains **Test Run**, with no automatic reset; rewards remain disabled.
- The five DBS Commander entries use the previously owner-approved 2-point `N5E-DBS-COMMANDER-2` amendment. No committee-approved rule score was changed.
- Historical `r000` SHA-256: `2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73`.
- Continuing `r001` SHA-256: `c7f3478b530e589807a10aeb2501b8543036d7ed8227f61cbbe4f4549ce060f4`.

## 3. Staged-hold website state

This release branch was copied from the previously browser-tested `r001` integration and then its **actual `points/data/v2/selection.json` was restored byte-for-byte from `main`**. Therefore:

- Branch-local static website defaults to **`r000`**, not `r001`.
- The `r001` payload and continuing client code are present but cannot be promoted by the actual staged selector.
- Candidate `r001` selection is simulated only inside isolated automated tests; it is **not** checked in as the staged production selection.
- The browser loader honours explicit `r001` → `r000` selection rollback even with an older verified r001 browser cache.
- `main` and its selector have not been changed.
- No Google Sheet, Apps Script, triggers, public API, source ledger, scores, production reward settings, Pages configuration, or real publication has been changed.

**Caution:** The GitHub repository and review branches are public; public-only `r001` data is already browsable in the review branch. The private journal columns, audit links, approval digests and raw evidence are *not* part of this public dataset.

## 4. QA evidence

- Original candidate integration: 23/23 Node cases and 24/24 Chromium scenarios passed on branch `dcap-v2-continuing-r001-20261119`; GitHub Actions run: https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44468084301
- Staged-hold validation workflow (actual r000 selection plus browser-simulated r001): https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44472158785
- The staged workflow has **read-only `contents: read` permissions, no deployment stage or backend permissions**, and must be green before any publication approval.
- Tests of the isolated localhost HTML do not independently prove the final GitHub Pages live HTTPS site or the source settings.

## 5. Two separately authorised publication steps

**Step A — Public payload/client staging (NOT authorised):**
1. Obtain the owner's current source-completeness confirmation and approval to publish the exact public-only `r001` payload.
2. Recheck production `main` and the Pages source/commit, preserve a verified rollback snapshot.
3. Review the staged-hold diff and exact hashes. Confirm `points/data/v2/selection.json` still selects `r000`.
4. Only on explicit approval, merge the reviewed *staged-hold* files into `main`, with `r000` selector unchanged.
5. Verify live HTTPS still displays the historical `r000` release; ensure newly staged `r001` bytes match the exact hash.

**Step B — Public selection/activation (NOT authorised):**
1. Obtain another explicit owner approval for the exact `r001` selection edit.
2. Change only `points/data/v2/selection.json` to `revision: r001`, `path: /points/data/v2/releases/r001.json`, `sha256: c7f3478b530e589807a10aeb2501b8543036d7ed8227f61cbbe4f4549ce060f4`, with lastKnownGood remaining the exact immutable `r000` revision/path/hash.
3. Verify GitHub Pages HTTPS and all seven Points views, 1,886/611/37 totals, Test Run cycle, disabled rewards and no private journal fields.
4. If verification fails, restore the exact `r000` selection. Confirm after reload with a prior r001 browser cache that r000 is selected.
5. Keep `r000.json` immutable and do not overwrite v1 or edit original award scores.

**GO/NO-GO:** Technical data/public payload reconciliation passed. Current cross-source completeness beyond 26 October is *not* independently established. Both public staging and activation remain **HOLD** until separately and explicitly approved.
