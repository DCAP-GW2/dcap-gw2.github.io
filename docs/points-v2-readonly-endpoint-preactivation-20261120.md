# DCAP Points v2 — Read-only Google Apps Script Web App Pre-activation

**Stage:** One-time isolated v2 endpoint, **NOT** the website cutover.
**Date:** 20 November 2026 (NZDT). **Production website and v1 V4/V9 unchanged.**

## Why this is the v1 approach

The points website fetches one approved public JSON feed when opened, caches valid results for 60 seconds, and retains the last validated copy when unreachable. No new r001/r002 release is needed for new approved points. The writer remains separate: ChatGPT uses the already connected Google Sheets tools to append owner-final records; the web endpoint **only reads and sanitises**.

## Files (only these two)

From this branch, install in a **NEW standalone Google Apps Script project**:
- [backend/points-v2-owner-registry/Code.gs](../backend/points-v2-owner-registry/Code.gs) — read-only doGet, sanitised public feed, private test.
- [backend/points-v2-owner-registry/appsscript.json](../backend/points-v2-owner-registry/appsscript.json) — read-only Google Sheets OAuth scope, Apps Script storage scope, Google Sheets API v4 advanced service.

Do not install OwnerWriter.gs, NativeDisposableAcceptance.gs, BridgeProbe.gs, a doPost handler, or any other files from test branches in this public web app. Do not reuse or modify either v1 V4/V9 project/deployment, the existing owner-only writer, or the earlier fictional test projects.

## Owner actions — single isolated deployment

1. Sign in to the authorised owner Google account and visit https://script.google.com/home/projects/create. Name the new standalone project **DCAP Points v2 — Public Read-Only Feed — PREACT**.
2. Replace the default Code.gs with the **complete** read-only Code.gs in this branch. In Project Settings, enable the appsscript.json manifest display and replace it with the **read-only** appsscript.json from this branch. Enable the **Google Sheets API v4** Advanced Service under Services if not already added.
3. Add **three private Script Properties** (do not publish values to GitHub):
   - `DCAP_V2_JOURNAL_ID` — existing real N5 approved journal Sheet ID, source READ ONLY.
   - `DCAP_V2_REGISTRY_ID` — real owner-private registry workbook ID, currently empty, source READ ONLY. **Not** any fictional disposable copy.
   - `DCAP_V2_PUBLIC_IDS_JSON` — the exact one-line 37-member JSON allowlist, available at [public-ids-allowlist.json](../backend/points-v2-live-feed/public-ids-allowlist.json).
4. In the new script's function dropdown, select **testPrivateOwnerFeed** and Run. The function's expected current receipt is:
   ```json
   {"stage":"DCAP_V2_OWNER_REGISTRY_PREFLIGHT","state":"PASS","awards":60,"points":192,"publicNewMembers":0,"manualCommanderAwards":0,"throughEventDate":"2026-10-26","rewardsEnabled":false}
   ```
   This preview counts only the **continuing** journal/registry. With immutable historical r000, the combined user-facing view is 611 contributions, 1,886 v2 points, 37 profiles.
5. If step 4 passes, use **Deploy > New deployment > Web app** (not API Executable). Set **Execute as: Me** (the owner) and **Who has access: Anyone**. This is the only permitted public exposure: the read-only code, which explicitly excludes private source details. Approve only the manifest's read-only Sheets scopes. Copy the new unique `https://script.google.com/macros/s/.../exec` URL. **Do not deploy the owner-only writer or the disposable native test script.**
6. Keep `points/v2/live-config.mjs` disabled and its URL blank. Share the newly deployed public **read-only** `/exec` URL and the aggregate preflight receipt with ChatGPT for independent inspection. The endpoint is intended to be public; never share private OAuth tokens, Script Properties, raw journal evidence or an Apps Script editor link.

## External acceptance tests — must pass BEFORE website cutover

- Anonymous HTTPS GET of `/exec` must yield parseable JSON (after any Google ContentService redirect), `kind="CONTINUING_PUBLIC_OWNER_FEED"`, `schemaVersion=2`, and valid historical SHA/contract.
- **All private fields absent** (source message IDs, spreadsheet IDs, owner email, original journal digests, approvals, internal source references).
- Validate public 60 continuing awards / 192 points; combined 611 awards / 1,886 v2 points / 37 profiles; original v1 historical total retained as 2,371; rewards disabled; season Test Run.
- Test **cross-origin browser fetch** from the intended HTTPS website domain, not only direct `/exec` navigation. Google ContentService redirects JSON to a short-lived `script.googleusercontent.com` URL, and browser CORS behaviour must be verified in a real browser.
- Verify fallback on a blocked or malformed endpoint; last validated public payload must remain visible without changing historical r000.
- Do not claim success for anonymous browser delivery or CORS until actually tested. Any inaccessible HTML/sign-in page or blocked CORS request is **NOT A PASS**.

## What is already independently checked

At the start of this stage the owner-private registry's four tabs contained **0/0/0/0** data rows and the original N5 approved journal contained **60 awards / 192 points**. These sources were read-only; no changes were made. A separate fictional Sheets test passed in the prior stage.

The candidate's mock projection and browser test suite run on GitHub Actions in an **isolated, nonpublishing** branch. They are not proof of actual Google HTTP connectivity. No public endpoint deployment or website change is performed by GitHub Actions.

**Gate:** Candidate implementation/browser tests, then owner-only separate READ-ONLY deployment, then independent real HTTPS/CORS verification, then **separately authorised website cutover**. Keep historical r000 and all v1 records unchanged; rewards disabled.
