# DCAP Points v2.0 — Owner Final Authority & Dynamic Registry

**Date:** 19 November 2026 (Pacific/Auckland)
**Status:** OFFLINE IMPLEMENTATION / PRODUCTION HOLD
**Branch:** feat/points-v2-owner-registry-offline-20261119

## Approved owner policy

The owner alone is the final authority for **future** scoring-rule values, effective dates, new member identities, exceptional awards and corrections. No further committee-approval step is required. An explicit final instruction given by the owner through ChatGPT counts as the policy decision; the authorised writer must validate and record its reference, but must not ask the owner to approve an unchanged decision twice.

**Other Commander:** Any contribution in the Commander role without an applicable *event-specific Commander rule* is classified as Other Commander. The assistant MUST ask for a positive integer point value **for each individual contribution**, even if the same player/event received points before. Do not infer a default or reuse previous awards. Do not post the case publicly while points are unknown. A batch with ordinary contributions and multiple unknown Other Commanders may process ordinary approved awards independently; present unresolved cases in one question set, each with its own explicit amount. The existing Other Commander base rule remains **TBD**.

Rules changes take effect prospectively by default. Each approved award retains the points actually recorded on approval; changing a rule MUST NOT recalculate previous awards. Retroactive correction is a separate, explicitly authorised compensating-record workflow and is NOT implemented in this branch.

The 37 existing public profiles and their IDs are permanent historical anchors but **not** a limit on new members. Register new people through the owner-private member registry; never create identities or reuse an existing ID automatically.

The historically ratified four exceptional items and historical source / v1 scores remain unchanged. This policy does not retroactively alter prior awards or the historical unscored Other Commander cases.

## Data sources and files

- **Frozen immutable historical \`r000\`:** 551 approved awards, 1,694 recalculated v2 points, 37 public profiles, original v1 awarded points preserved as 2,371.
- **Existing N5 real award journal:** 60 already approved post-cutoff contributions and 192 v2 points, read-only.
- **New *separate* owner-private registry workbook:** four tabs, defined in [private-registry-schema.json](./private-registry-schema.json). Start with header rows, no additional entries until authorised writer installation. This workbook is not created or modified by the offline branch.
- **New read-only endpoint candidate:** [Code.gs](./Code.gs) with [appsscript.json](./appsscript.json), entirely separate from v1 V4/V9 and the N5 writer. No public write methods, no triggers, no Discord source API calls.
- **Owner planning logic:** [owner-planner.mjs](./owner-planner.mjs), used for offline review and tests. It prepares owner-final decisions or pending questions. It does NOT itself write to Google Sheets or send ChatGPT messages.

### Private registry sheet headers

Create four tabs with these exact names and first-row headers (the schema file is authoritative):

1. \`N5 Public Members\`: \`memberId, displayName, approvedFrom, status, ownerDecisionRef\`
2. \`N5 Events\`: \`eventId, eventLabel, status, ownerDecisionRef\`
3. \`N5 Rule Versions\`: \`ruleVersionId, ruleId, eventId, roleId, points, effectiveFrom, status, ownerDecisionRef\`
4. \`N5 Owner Awards\`: \`candidateKey, eventDate, eventId, instanceId, memberId, roleId, ruleId, points, awardType, ownerDecisionRef, status, ruleVersionId, approvedAt\`

These tabs are private. Their \`ownerDecisionRef\` and other approval metadata must **never** appear in public JSON. Only rows with \`OWNER_FINAL\` status are scored. Future awards marked \`PENDING_OWNER_POINTS\` remain unscored and unpublished until the owner decides. The already-scored original journal is never rewritten.

For an approved Other Commander use \`roleId=other-commander\`, \`awardType=OWNER_MANUAL_OTHER_COMMANDER\`, a positive owner-assigned \`points\`, \`ruleId\` blank and an authenticated owner-decision reference. Never create a general default Other Commander rule.

For a rule change, append a new row with the same \`ruleId\`, a unique \`ruleVersionId\`, the new \`points\`, the new prospective \`effectiveFrom\` and \`OWNER_FINAL\` status. Old rule decisions and original awards must not be overwritten.

### One-time isolated installation — NOT YET APPROVED FOR EXECUTION

This branch is **not** an installation receipt. The prior [fixed-37 candidate](../points-v2-live-feed/README_PRIVATE_INSTALL.md) must not be installed as the final v2 system.

A future separately approved installation will:

1. Create a separate owner-private registry Google Sheet using the headers above. Preserve the private N5 journal intact.
2. Create a **new standalone** read-only Apps Script project, copy only this folder's \`Code.gs\` and \`appsscript.json\`, and add a Google Sheets API v4 advanced service with \`spreadsheets.readonly\` scope.
3. Configure exactly these private Script Properties:
   - \`DCAP_V2_JOURNAL_ID\`: the existing private N5 award journal Sheet ID
   - \`DCAP_V2_REGISTRY_ID\`: the new, separate owner-private registry workbook Sheet ID
   - \`DCAP_V2_PUBLIC_IDS_JSON\`: JSON array with the **37 original public IDs**, solely as an immutable baseline roster. New member IDs come from the Members tab without Script Property changes.
4. Run owner-only \`testPrivateOwnerFeed()\` from the script editor, then perform an editor-only \`/dev\` test. Only after private acceptance, separately authorise public \`/exec\` and actual cross-origin Chrome verification.
5. Keep public website \`points/v2/live-config.mjs\` disabled until an independently approved production cutover. The current \`r000\` selection remains unchanged.

**Authorised writer remains a separate step.** The public read-only Apps Script must **never** gain Google Sheets write permissions or a public \`doPost\`. ChatGPT will not be able to record awards or change rules through chat until an authenticated private writer is installed, its idempotency/duplicate/non-stacking checks are tested, and its operation is explicitly approved. Direct ad-hoc edits of the historical journal or production sheet are not acceptable substitutes.

## Example owner workflows

**Other Commander:**
- Owner: “PlayerABC commanded Legendary Ley-Line Anomaly on 19 Nov.”
- ChatGPT: “Other Commander — how many points for this specific contribution?”
- Owner: “4 points. Final.”
- A future authenticated writer records one owner-final award at **4** points. An identical later case asks again; no default 4-point rule is created.

**Prospective standard-rule change:**
- Owner: “From 1 December 2026, Triple Trouble Commander is 4 points. Final.”
- Append a rule version effective 2026-12-01, retaining earlier 3-point awards. No committee ratification, retroactive rescoring or website deployment is required.

**New member:**
- Owner: “Register PlayerXYZ using a new stable public ID.”
- Register that approved public ID/display name privately. The read-only feed publishes the profile; future approved awards then appear automatically with no 38th-ID code change.

## QA and production precautions

Automated checks include existing 60 awards, all historical scores, a new member and event, one-off Other Commander, prospective rule changes, duplicate/rejected/malformed decisions, privacy fields and browser fallback. The private source itself has **not** been modified.

**Production activation remains HOLD.** The script, registry workbook and authenticated private writer are not installed. No v1 / production / existing N5 journal writes are authorised by this offline work.
