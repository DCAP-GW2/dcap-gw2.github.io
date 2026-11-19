# DCAP Points v2.0 — Continuous Read-Only Feed Handoff
Date: 19 November 2026 (NZDT)

## Decision and scope

Owner approved replacing routine numbered GitHub public releases (`r001`, `r002`, etc.) with the same practical model used by v1: **approve privately, expose one sanitized read-only public API, fetch when a visitor opens/refeshes the page**. The historical `r000` release remains an immutable baseline and emergency fallback, not the basis of monthly release ceremonies.

This is an **offline implementation branch**, not an activated deployment. `main`, public Pages selection, production Apps Script V4/V9, private journal and v1 score records are unchanged. The v2 live endpoint is deliberately **disabled** in `points/v2/live-config.mjs`, with its URL empty.

## Architecture

- Baseline: immutable local `points/data/v2/releases/r000.json`, SHA-256 `2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73`.
- Backend (offline source): `backend/points-v2-live-feed/Code.gs` and `appsscript.json`. It reads approved rows from the owner-private N5E award journal via the **Advanced Sheets API** with an explicit **spreadsheets.readonly** OAuth scope. No writes, no `doPost`, no triggers, no API tokens in its responses.
- Owner-only script properties to supply during a separately authorised installation:
  - `DCAP_V2_JOURNAL_ID`: approved owner-private journal spreadsheet ID; never place it in public frontend config.
  - `DCAP_V2_PUBLIC_IDS_JSON`: JSON array containing the 37 existing approved `r000` public member IDs. Identity whitelist must be reviewed before deployment.
- Public contract: `CONTINUING_PUBLIC_AWARDS_FEED` with the frozen `r000` baseline SHA-256, source event dates, Test Run cycle 0, rewards disabled, exact approved rules and **only** public fields for approved awards. A date-only `source.throughDate` is the most recent contributing event date, not a claim that every Discord post through that date has been submitted.
- Browser: `points/v2/live-loader.mjs` validates the complete public feed and combines it with verified `r000` to render all existing v2 pages; `points/v2/page.mjs` no longer displays a numbered publication release. The 60-second browser cache and last-valid-data fallback follow v1's simple operational model.
- Once the feed is enabled and verified, submitting more approved rows into the private journal automatically updates subsequent website requests after cache expiry: **no GitHub commits, new JSON release or manifest changes are required for routine awards**.
- A new public member ID not in the owner-approved roster is **not silently invented or omitted**; publication of the entire new feed fails closed until the identity is properly approved. This is an identity-governance exception, not a routine points release.
- Previously published awards must remain present and unchanged in later cumulative responses; changes/corrections need a separately approved mechanism. Otherwise the browser retains its last valid result.

## Data starting point

Historical `r000` has 551 v2 awards / 1,694 v2 points; the private journal currently has 60 approved new awards / 192 points involving 18 existing members. Proposed display totals are **611 scored awards / 1,886 points / 37 public profiles**. Original v1 total **2,371** and scoring records stay unchanged. Test Run continues; rewards remain disabled.

The previous `r001.json` candidate is retained only as test input and audit/reference evidence in the isolated GitHub branch, not as a required continuing-release mechanism. The installed web API must **read the journal directly** rather than importing the old static `r001.json` into production.

## Security and outage behaviour

1. The public endpoint returns **no source message IDs, private evidence references, approval names/emails, approval digests, digest chain, journal sheet IDs or script IDs**. Server errors return a generic invalid-schema marker, never the private exception.
2. Only exact statuses `REAL_APPROVED`, numeric committee-approved rules, known public IDs, valid predecessor links and valid event dates can pass. No rescoring or reward grants occur.
3. The frontend rejects malformed/oversized/nonmonotonic feeds, duplicate award IDs, unsupported roles, unknown public members, mismatched totals or changed season/reward metadata.
4. With an unavailable endpoint, serve only the browser's previously schema-validated public feed or the pinned immutable `r000` baseline. Browser cache is not cryptographically signed; this simpler v1-style trust model relies on the authenticated HTTPS endpoint and strict client validation.
5. Google Apps Script's ContentService redirects JSON to `script.googleusercontent.com`; an **actual deployed endpoint + browser CORS/redirect test** is mandatory before production cutover. A mocked browser response does **not** prove live CORS or authentication behaviour.
6. A full public-client build may still be deployed once during the initial migration; subsequent daily award approvals do not require re-publishing the site.

## Offline QA

- Node tests cover exact baseline and 60 approved awards, 125 continuing awards without `r002`, 37 profiles, historical v1 preservation, exception/TBD rules and malformed/private rows.
- The read-only backend is exercised offline with fictional journal records using Node's VM, including >60 accepted entries and generic-error fail-closed responses.
- Browser QA mocks the new CORS-enabled endpoint *only inside localhost*, exercising all six main views, member-profile navigation, cache expiry, >60 updates, outages, invalid data, fallback and accessibility. **No real endpoint is contacted.**
- **Executed:** 35/35 repository Node, 3/3 additional Node, and 20/20 Chromium browser scenarios PASSED (58/58 total; no test failures). GitHub Actions run: https://github.com/DCAP-GW2/dcap-gw2.github.io/actions/runs/44476675980. Browser tests include 30 responsive page/viewport combinations and six axe serious/critical accessibility scans with zero such violations.
- Reference workflow: `.github/workflows/points-v2-live-feed-qa.yml` has `contents: read` and no deployment step.

## Remaining one-time release gates — NOT AUTHORISED

1. Owner and committee confirm the exact public contract and 37-person identity whitelist; leave existing approved scores unchanged.
2. Install/verify a **separate read-only v2 Apps Script project** with the scoped manifest and private properties; do not modify or replace existing V4/V9 production deployments or the N5E writer.
3. Inspect an owner-only `/dev` endpoint, then separately authorise a public read-only `/exec` test. Verify real browser cross-origin fetch, ContentService redirects, anonymous access, quotas and generic failure behaviour without revealing private source columns.
4. Review and approve the exact frontend endpoint URL and enable switch, verify seven Points views and historical fallback.
5. Only on separate explicit owner approval, deploy the one-time website update, verify live 611/1,886/37 (or a freshly reconciled total if more approvals have been journaled), and preserve one-click rollback to historical `r000`.

**Production activation: HOLD. No private journal writes or live-site changes were made by this offline work.**
