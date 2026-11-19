# DCAP v2 — Isolated Apps Script installation

**Status:** OWNER-PRIVATE TEST ONLY. Not installed or deployed by ChatGPT.
**Isolation:** Do not modify the existing V4/V9 deployments, N5E journal writer, private Google Sheet, live website, or frozen historical r000 release.

## Three source files

Copy these public-only files into a newly created *standalone* Apps Script project, not the existing journal/writer script:

- [Code.gs](./Code.gs) — complete read-only feed source; includes the private aggregate test function.
- [appsscript.json](./appsscript.json) — explicit Sheets READONLY and Script Properties scopes; Advanced Sheets v4 enabled.
- [public-ids-allowlist.json](./public-ids-allowlist.json) — exactly the 37 already approved public member IDs. This is a *Script Property value*, not a source file.

## Owner actions (one-time)

1. Sign in as the journal owner at https://script.google.com/home/projects/create and create a *new standalone project*, named: DCAP Points v2 — Isolated Read-Only Live Feed — TEST. Do not modify or create a deployment in an existing DCAP Apps Script project.
2. Replace the new default Code.gs with the linked complete Code.gs source. Save.
3. Under Project Settings, enable Show appsscript.json manifest file in editor. Replace that manifest with the linked appsscript.json source. Ensure the Google Sheets API v4 advanced service appears under Services; if needed, add it via Services > Add a service > Google Sheets API.
4. Under Project Settings > Script Properties, add exactly TWO values:
   - DCAP_V2_JOURNAL_ID: the raw file ID from the existing private N5E journal Sheet URL. Never store this ID in the public repository.
   - DCAP_V2_PUBLIC_IDS_JSON: the full one-line JSON array contents of public-ids-allowlist.json. Paste the actual JSON array, not its URL or file name.
5. From the function dropdown, select testPrivateReadOnlyFeed and click Run. Authorise the Sheets READONLY and script-properties permissions. Inspect the resulting Execution log.

There is no publishing trigger, timer, writing function or spreadsheet mutation in this code. Do not add triggers or manually edit the journal during testing.

## Expected aggregate-only private preflight receipt

For the 60 currently reviewed journal rows, expect:

    stage: DCAP_V2_ISOLATED_READONLY_PREFLIGHT
    result: PASS
    approvedAwards: 60
    continuingPoints: 192
    knownContributors: 18
    throughEventDate: 2026-10-26
    rewardsEnabled: false
    historicalBaseline: r000
    continuingReleasesRequired: false

The counts may rise after new *approved* contributions are added. Investigate mismatches before publication.

The preflight logs only public aggregate fields: no private emails, member IDs, source evidence, journal audit receipts or cryptographic chain values. On invalid source/configuration, the feed returns generic UNAVAILABLE.

## Private web-app test, not yet public

From the **new** script only, choose Deploy > Test deployments > Web app. This produces an editor-only URL ending in /dev. Open it signed into the journal-owner Google account and inspect the JSON.

Expect kind CONTINUING_PUBLIC_AWARDS_FEED, 60 awards / 192 new points (if the journal has not changed), unchanged r000 baseline digest, rewards disabled, and no revision field or private source fields. The /dev URL cannot demonstrate access by a visitor who lacks editor access.

## Later anonymous /exec browser test — separate approval

After the private preflight is accepted, a separate owner decision is required to publish a **new isolated read-only web app** configured Execute as Me and access Anyone. The /exec URL will expose the *sanitised* points and identities publicly and must not be created as an accidental side effect of private testing.

An anonymous Chrome test must follow the Google Content Service redirect to script.googleusercontent.com, confirm cross-origin fetch access from a different origin, validate the exact public JSON and try incognito. Google provides no unrestricted general-purpose CORS header settings for Content Service. If browser CORS/auth fails, stop; do not make the private journal public or remove source-validation checks.

The v2 website live-feed switch remains disabled until its own separately authorised cutover. No r002 or subsequent numbered GitHub releases are required for routine points updates after activation.

## Confirmed offline evidence

- Existing 58/58 Node and mocked-browser tests were successful.
- The real 60-entry private Sheet was read-only inspected, then the current Code.gs public projection was evaluated against its rows: 60/60 matching awards, 192 points, 18 contributors, zero award mismatches and zero private audit fields.
- These are NOT evidence that a native Apps Script project has been created, a /dev endpoint works, or a public /exec web app is available.

## Official Google documentation

- https://developers.google.com/apps-script/guides/standalone
- https://developers.google.com/apps-script/concepts/manifests
- https://developers.google.com/apps-script/advanced/sheets
- https://developers.google.com/apps-script/guides/properties
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content

**Next evidence for a private installation acceptance:** the new isolated Script ID and the aggregate private preflight receipt. No production, public website, or reward changes are authorised.
