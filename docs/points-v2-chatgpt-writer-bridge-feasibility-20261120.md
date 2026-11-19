# DCAP Points v2.0 — ChatGPT-to-Private-Writer Bridge Feasibility

**Date:** 20 November 2026 (NZDT)
**Disposition:** OFFLINE MOCK FEASIBILITY ONLY / PRODUCTION HOLD

## Outcome and verified platform constraints

The **owner-only native disposable transaction has already passed**; the real registry and historic journal were independently confirmed preserved. That is not yet equivalent to ChatGPT having authenticated execution rights.

Google's official Apps Script API documentation requires all of the following for external \`scripts.run\` calls:

1. The target Apps Script project must be deployed as an **API Executable**, not as an anonymous \`/exec\` web app.
2. The caller must supply an OAuth access token covering **all scopes the script uses**, not merely the invoked function's scopes.
3. The calling application's OAuth client and the Apps Script project must share the **same standard Google Cloud project**. The default Apps Script Cloud project is not sufficient.
4. The Google Apps Script API must be enabled on that standard project; a Sheets API advanced service also requires the Sheets API enabled.
5. The user must be authorised to run the script; **never use a public webhook, shared token in chat, or an unauthenticated HTTP writer**.

Official documentation:
- https://developers.google.com/apps-script/api/how-tos/execute
- https://developers.google.com/apps-script/api/reference/rest/v1/scripts/run
- https://developers.google.com/apps-script/guides/cloud-platform-projects
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

A custom MCP application can eventually expose owner-authorised operations to ChatGPT, with OAuth handled by the connector. No suitable direct Apps Script Execution API connector is currently installed/available as a callable tool in this conversation. **This branch does not create or deploy an MCP server or Google OAuth client.**

## Test-only prototype prepared

\`BridgeProbe.gs\` is a standalone read-only Apps Script candidate (not copied into the installed writer), using **only** the read-only manifest in this folder. Its sole external function is \`probeBridgeReadOnly\`; it accepts no arguments and verifies one known, owner-private **disposable** workbook with fictional data. It checks owner identity, a dedicated \`FICTIONAL_READ_ONLY\` Script Property, the workbook title and exact fictional row contents. Output contains only aggregate counters, with zero writes.

\`offline-bridge-client.mjs\` creates a fixed \`scripts.run\` request structure for an API Executable deployment ID and rejects any request to choose another function or supply award parameters. It uses a **supplied mock transport only**; it contains no OAuth tokens, no direct \`fetch\` and no ability to update a spreadsheet.

\`tests/points-v2-bridge-feasibility.test.js\` tests the read-only Apps Script candidate in a mocked V8 environment and validates the Google API response envelope, malformed results, fake writer attempts, owner-ID mismatch and secret-free receipts.

**These tests do not make an actual Google OAuth call and do not prove that a remote MCP connector works.**

## Why the bridge probe is separate from the writer

The installed private writer needs Sheets **write** scope. Google requires an external OAuth caller to carry all scopes of the target script, even for a read-only function. Therefore, using the writer project for the first remote connectivity test would unnecessarily require write-capable OAuth credentials. The isolated read-only probe allows connectivity to be tested without any real award or rule mutation.

**Do not deploy the current owner-only writer or the prior native disposable acceptance script as a publicly accessible HTTP web app.** Never install \`BridgeProbe.gs\` into the real writer project.

## Further one-time steps — require separate owner approval

A. Establish a **new standard Google Cloud project** for the read-only feasibility probe, enable Apps Script API and Sheets API, configure the OAuth consent screen and testing user, and define the OAuth client for the actual caller. Do not change the existing v1 V4/V9 or private writer Cloud projects.

B. Install only \`BridgeProbe.gs\` and \`appsscript.json\` from this folder into a *new standalone read-only script project*. Set three **private** Script Properties:
   - \`DCAP_BRIDGE_MODE = FICTIONAL_READ_ONLY\`
   - \`DCAP_BRIDGE_DISPOSABLE_ID\`: existing isolated native fictional workbook's ID (not the production registry)
   - \`DCAP_BRIDGE_OWNER_EMAIL\`: signed-in Google owner email

C. Run \`probeBridgeReadOnly\` once **locally in the new script editor**; confirm its aggregate receipt with zero writes.

D. Separately authorise a restricted **API Executable** deployment of this read-only probe, then invoke it with a properly scoped owner-authorised OAuth client. The invocation's \`function\` must be only \`probeBridgeReadOnly\`; no parameters, no \`devMode\`, and no owner writer attached.

E. Only after that succeeds consider designing the *actual* ChatGPT custom MCP connector and owner-authorised write function, with an explicit transaction proposal, owner-final confirmation, strict request schema, idempotency and a small supervised test against the disposable registry. **Do not attach a writer endpoint to a public read-only feed.**

## Live-state preservation

- Historical \`r000\` remains the website's selected revision.
- The v2 live endpoint configuration remains disabled.
- The real owner registry and the N5 historical journal are untouched by this feasibility branch.
- No Google Cloud project, API Executable deployment, OAuth client, refresh/access token, MCP server or new public interface was created in this stage.
- The already tested fictional native workbook retains the one manual Commander award; do not mix it into live totals.
- Proposed real combined totals remain **1,886 v2 points / 611 awards / 37 profiles**; rewards disabled.

**Current gate: OFFLINE CONNECTION DESIGN AND MOCK TESTING. Authenticated Google OAuth and actual external \`scripts.run\` connectivity remain unverified. Production activation: HOLD.**
