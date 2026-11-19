# DCAP Points v2.0 — r001 Offline Acceptance Report
**Date:** 19 November 2026, Pacific/Auckland  
**Result:** PASS — isolated automated Node and Chromium acceptance. **PUBLICATION HOLD remains in force.**  
**Candidate branch:** `dcap-v2-continuing-r001-20261119`  
**Successful test commit:** `963ed25162863ff23a92cd67aa9d4936368c15b5`  
**GitHub Actions run:** https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44468084301  
**Browser evidence artifact:** https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44468084301/artifacts/14502698721

## Recorded automated results

| Test area | Passed | Failed | Notes |
|---|---:|---:|---|
| Repository Node tests (`npm test`) | 20 | 0 | Includes the 14-case r001 reconciliation/loader regression module |
| Additional Node module tests | 3 | 0 | `node --test tests/*.test.mjs` |
| Real Chromium acceptance scenarios | 24 | 0 | All browser scenarios passed after correcting one test-only expectation |
| **All executed cases** | **47** | **0** | Successful GitHub Actions conclusion |

Browser scope: all six non-profile Points pages at **320, 390, 768, 1024 and 1440 px** (30 view/viewport combinations); overview totals, original-v1 value, cycle date label and rewards guard; 37-row leaderboard with tied partial ranks; 37-member directory search; profile hyperlink and history; retained Other Commander TBD and approved DBS Commander 2-point amendment; disabled rewards; missing r001 payload, stale valid cache, missing selector, explicit r001→r000 rollback, mismatched release digest, forged r999 cache and tampered-cache rejection; axe serious/critical checks on all six primary views, **zero serious/critical** findings. Separate profile browser navigation was checked, but the profile was not included in axe scanning.

**First run:** https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44467933936 ended with 23/24 browser cases passing because the test incorrectly expected 1,694 as the original v1 points total. The immutable historical `r000` snapshot identifies 1,694 as the *recalculated historical v2* points; the original v1 historical total is **2,371**. The browser assertion now obtains that original-v1 value from `r000` rather than hard-coding the wrong number. The corrected run passed 24/24 browser cases.

## Real release integrity (read-only)

| Item | Value |
|---|---|
| Historical v2 `r000` | 551 scored awards, 1,694 points |
| Continuing `r001` additive delta | 60 scored awards, 192 points, 18 existing contributors |
| Combined displayed results | **611 awards, 1,886 points, 37 public profiles** |
| Historical original v1 scores | 2,371 points retained as immutable historical metadata |
| Published profiles / missing-ID states | 37 / 6 |
| Season and rewards | Cycle 0 Test Run, no reset; rewards disabled |
| Historical `r000` SHA-256 | `2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73` |
| Delta `r001` SHA-256 | `c7f3478b530e589807a10aeb2501b8543036d7ed8227f61cbbe4f4549ce060f4` |

Both SHA-256 digests were independently calculated over release bytes and matched their pinned values. The closed validators and mutation cases rejected changed or duplicated award IDs, unapproved rule amounts, incorrect member references, rule mismatches, extra private fields, invalid season/reward settings and invalid selection metadata.

## Production and repository preservation

- The `main` branch's `points/data/v2/selection.json` **still selects `r000`**, with `r000` also last-known-good.
- The test branch's selection file selects `r001`. **Do not merge this branch wholesale without the separate controlled publication approval.**
- Existing draft PR #16 (`feat/points-v2-website`) remains open, draft and unmerged. This acceptance pertains to the production-shaped `r001` integration branch, not PR #16.
- GitHub Actions workflow `.github/workflows/points-v2-r001-qa.yml` is restricted to this branch and uses only `contents: read`. It has **no Pages deployment, write-back, backend access, secret dependencies, Google Sheet, Apps Script or reward action**.
- No production `main` code/selection change, actual Pages deployment, Sheets journal write, scoring-rule change or reward activation was authorised or made.
- A public HTTPS check through the browser was **not** performed; the acceptance browser exercised an isolated local static HTTP server and branch bytes.

## Controlled release review — remaining explicit gates

1. **Freshness/source attestation:** Confirm that the date-only 60 awards dated 22–26 October 2026 represent the complete owner-approved unpublished contribution set at release time. Verify this read-only against the private journal, without exporting its audit fields to the public repository.
2. **Final artefact review:** Confirm owner acceptance of the exact immutable `r001` digest, 1,886/611/37 totals, public-only schema, preserved original v1 scores and the existing approved DBS Commander amendment.
3. **Pages source/backup:** Independently confirm current GitHub Pages publishing source, retain a known-good `main` commit and the `r000` selector as rollback material.
4. **Safe two-step publication plan:** Publish the reviewed `r001` payload and validated client without changing the live selection initially; check the historical `r000` website remains functional. Only after that, publish the exact approved `r001` selection in a separate authorised release step, verify live HTTPS delivery and visitor UI, and rehearse explicit `r000` rollback.
5. **Independent owner approval:** Obtain separate written authorisation for any `main` mutation, Pages-visible release selection, merge or cutover.

**Disposition: OFFLINE ACCEPTANCE PASSED; PRODUCTION ACTIVATION NOT AUTHORISED.**
