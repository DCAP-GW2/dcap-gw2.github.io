# DCAP Points v2.0 — Simplified v1-Style Operations

**Date:** 20 November 2026 (Pacific/Auckland)
**Status:** ISOLATED OFFLINE IMPLEMENTATION — production and public website HOLD.

## Owner-approved direction

Use the original v1 operational architecture: **ChatGPT + connected private Google Sheets**, a separate sanitised read-only Apps Script endpoint, and a static website that fetches the latest valid results. No custom OAuth client, standard Cloud project, Apps Script Execution API, MCP server or routine r001/r002/r003 releases are needed for ordinary awards.

The owner is the only authority for new scoring decisions. A final owner instruction is approval; don't ask for committee ratification or a redundant second approval. Existing historic scores and the historical r000 remain unchanged. Rewards are disabled.

## Minimal checks, not a new complex release system

Before an owner-final Sheets append:

1. Read the original fixed r000 member/event/rule definitions, the private 60-award historical journal and the current private registry. The roster is not capped at 37: new owner-approved identities are added to the Members tab.
2. Check the member and event exist, the date and instance are identified and the owner-approved rule applies as of that event date.
3. For **Commander with no event-specific Commander rule**, classify as **Other Commander** and ask the owner for a positive number for **each individual contribution**. No default and no inference from prior awards.
4. Check duplicates across the preserved journal and current registry using the candidate key and member/event/date/instance/role. Same activity on separate instances may be a legitimate new award. Preserve the approved BFLA, Dragon's End and CM Convergence non-stacking groups.
5. Apply prospective rule changes by appending a dated owner-final version; no retroactive rescoring. Preserve the existing approved DBS Commander 2-point amendment.
6. Write only a **single append** to the relevant private registry tab using the already connected Google Sheets integration, then read the row back. Avoid the original journal and v1 records entirely.

A possible duplicate stops the append and prompts a review. An owner can explicitly confirm a genuinely distinct instance, but an override must use the true separate event/instance evidence, not arbitrarily change a key to defeat duplicate checking.

## Implementation files

- `backend/points-v2-simple/simple-award.mjs` — closed, pure validator/planner for normal awards and Other Commander, pending-to-final handling, duplicate warnings, rule history and one-row appendCells request preparation.
- `backend/points-v2-simple/simple-admin.mjs` — owner-final member, event and prospective rule-version append plan.
- `tests/points-v2-simple-award.test.js`, `tests/points-v2-simple-admin.test.js` — fictional offline regression cases.
- `.github/workflows/points-v2-simple-sheets-qa.yml` — read-only GitHub test runner, no deployment or Google writes.

These are **planning modules**, not an automatically connected ChatGPT plugin or native Apps Script writer. A future ChatGPT session must carry out read-check-append-readback through its authorised Google Sheets connector, and must not claim a write occurred before the connector confirms it. No Sheets production write is authorised merely by merging or testing this branch.

## Remaining one-time checks before allowing real records

1. Verify the simple writer path with a **new fictional candidate** in the disposable private workbook; confirm the append row, repeat attempt duplicate warning and that the genuine registry/journal are unchanged.
2. Verify correct behaviour on more than 60 real-world pending/approved submissions (offline batch simulation is sufficient) and ensure no accidental cross-event duplicate.
3. Accept that the simple Sheets connector workflow is **single-operator**, with short read-to-write windows and no native atomic compare-and-swap. If concurrent administrators are introduced later, retain the already tested lock-protected private writer as the fallback.
4. Install and browser-test the separately isolated v2 **read-only** Apps Script feed, validating anonymous HTTPS/CORS access. This is a **one-time** website integration; thereafter fresh awards come directly from Sheets without a release.
5. Approve the final controlled website cutover separately; keep r000 immutable, all v1 records intact, the last-valid-data fallback available and rewards disabled.

**Production status: HOLD. No private journal, real registry, production deployment, or live site has been changed in this stage.**
