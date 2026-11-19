# DCAP Points v2.0 — Isolated Owner-Only Writer

**Stage:** PRIVATE REGISTRY CREATED / WRITER CODE TESTED OFFLINE / WRITER NOT INSTALLED  
**Date:** 19 November 2026 (NZDT)  
**Release state:** HOLD (production v1, frozen `r000`, rewards and N5 journal remain untouched).

## Private registry

The owner-approved native Google Sheet, created separately from the existing 60-entry N5 private journal, has the four exact schema tabs:

- `N5 Public Members` — 5 header columns
- `N5 Events` — 4 header columns
- `N5 Rule Versions` — 8 header columns
- `N5 Owner Awards` — 13 header columns

It was verified with 0 data rows, frozen headers, consistent readable formatting and dropdown status validation. Google Drive metadata showed **owner-only access** (not shared). **Do not place its private Sheet ID in this public GitHub repository.**

All scoring, identity and governance data remains source-of-truth in the original 37-person historical baseline and the private 60-award journal until the owner writer is installed and specifically used.

## One-time owner writer project (not yet deployed)

The writer is `OwnerWriter.gs`; it deliberately defines **no public HTTP `doPost` endpoint** and no triggers. Its only mutation is an append to the separate private registry workbook, never the old N5 journal or the historical v1 ledger.

For a **separate standalone PRIVATE writer Apps Script project only**, include:
- `Code.gs` from this folder (shared pure schema/validation and read-only projection).
- `OwnerWriter.gs` from this folder.
- `writer-appsscript.json` copied into that project's `appsscript.json` (write-capable Sheets scope, required **only in this private writer**, never the public read-only endpoint).
- Enable Advanced Google Sheets API v4.
- Set PRIVATE Script Properties `DCAP_V2_JOURNAL_ID`, `DCAP_V2_REGISTRY_ID`, `DCAP_V2_PUBLIC_IDS_JSON` (the original 37 public IDs), and `DCAP_V2_OWNER_EMAIL`. Do not put actual values in public source.
- The authenticated caller must be the same owner identified by `DCAP_V2_OWNER_EMAIL`; unknown effective-user emails are rejected.
- Do **not** publish the writer as an anonymously accessible web app. A future ChatGPT integration requires a separately approved authenticated execution mechanism (for example, the Google Apps Script Execution API with appropriate OAuth), which is **not yet connected**.

**Important:** Do not copy the old fixed-37 read-only `Code.gs` or its read-only manifest into the writer project. The new owner-registry public API and the owner-only writer have different OAuth scopes and must remain separated at deployment.

## Transaction behaviour

The owner may issue a **final instruction once**, without a second committee/owner approval roundtrip.

The writer `ownerApplyApprovedBatch_(requests)` accepts up to 250 prepared records per supervised call, verifies the owner email, takes an Apps Script script lock, reads the existing private journal and private registry, validates **the whole proposed public state**, then commits all new rows with a **single Google Sheets batchUpdate**. Repeated identical requests are idempotent; mismatches or duplicate contributions fail closed.

Supported transactions:
- `MEMBER`: add one owner-approved new public ID and display name.
- `EVENT`: register an additional event for future awards.
- `RULE_VERSION`: prospective owner-approved numeric rule point change with effective date. No retroactive rescoring.
- `PENDING_OTHER_COMMANDER`: store a pending Commander without points (not included in the public feed). Each individual case requires the owner's numerical decision.
- `AWARD`: owner-final normal rule award or case-specific Other Commander amount. A final award may follow a pending row **by appending a final record**, not overwriting history.

The existing approved committee scores are treated as immutable historical values; the new owner is the sole final authority for subsequent changes. Other Commander has **no default score**. One example Other Commander award does not set the points for future instances.

The writer returns a **safe aggregate receipt**, not private source IDs, names, emails, journal hashes or evidence references. It can process 60+ entries in one supervised batch; the 250-record cap is an implementation/runtime safeguard, not a points or governance limit.

## Verification completed

- Native private registry created and checked against the exact tab/header schema.
- Metadata confirmed only the owner has access; no public sharing.
- 66 Node tests, including the writer regression, plus 3 ESM tests passed on the isolated review branch (GitHub Actions CI).
- The writer tests covered private owner identity, all-or-nothing multi-tab writes, idempotent retries, conflicting replays, a pending-to-final Other Commander case, prospective rules, 60 approved awards in one batch, no historical journal mutation, and dry runs without a write.
- These tests used **fictional records and mocked Apps Script/Sheets services**. **No native writer deployment, authenticated Execution API call or real registry data write was performed.**

## Required before approving a real writer

1. Owner verifies the new registry workbook is located in the correct private account.
2. Review exact `Code.gs`, `OwnerWriter.gs`, and the *writer-specific* OAuth scopes.
3. Install an isolated owner-only Apps Script writer project, with no public deployment. Run a read-only dry run against the real blank registry and 60-item journal.
4. Test one **disposable fictional** transaction in another isolated test workbook, including retry and rollback/evidence. Never use real member awards as a smoke test.
5. Separately authorise the authenticated ChatGPT-to-writer transport; do not use a public webhook or bare unauthenticated `/exec` POST.
6. Approve production activation only after verified read-only public API CORS, privacy, and seven-page browser acceptance. Original historical v1 data and rewards remain unchanged.

**Result:** The new private registry is ready and empty; the writer is a tested offline candidate, **not installed or operational**. Routine future awards do not require `r002` or GitHub releases once the approved pipeline is live.
