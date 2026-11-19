# DCAP v2 — Native disposable writer acceptance

**Status:** PRIVATE TEST ONLY. Native Apps Script execution has not been performed by ChatGPT.

## Isolated test environment

A new, empty, owner-only Google Sheet has been created: **DCAP v2 — Native Writer Acceptance — Disposable Fictional — 2026-11-20**. This is NOT the real owner registry and NOT the older disposable test copy.

## Install in a NEW standalone Apps Script test project

Do not edit the existing installed DCAP v2 Owner Registry script.

Create a new private project at https://script.google.com/home/projects/create and call it **DCAP v2 — Native Writer Acceptance TEST**. Copy Code.gs, OwnerWriter.gs, and NativeDisposableAcceptance.gs from this folder into three script files. Copy writer-appsscript.json into the project's appsscript.json, and enable the Google Sheets API v4 advanced service.

Set these **seven private Script Properties**:
- DCAP_V2_JOURNAL_ID: existing protected real N5 award journal ID (read-only)
- DCAP_V2_REGISTRY_ID: NEW disposable acceptance workbook ID, not the real registry
- DCAP_V2_PUBLIC_IDS_JSON: the 37-item historical public ID JSON array in ../points-v2-live-feed/public-ids-allowlist.json
- DCAP_V2_OWNER_EMAIL: exact authorised owner Google account email
- DCAP_V2_TEST_REGISTRY_ID: identical to NEW disposable acceptance workbook ID
- DCAP_V2_REAL_REGISTRY_ID: real owner registry workbook ID, which must differ from the disposable one
- DCAP_V2_ACCEPTANCE_MODE: FICTIONAL_TEST_ONLY

Do not put private IDs, owner email or credentials in this public repository. Leave the existing writer project's properties untouched.

## Run 1 — dry run, NO writes

In the NEW TEST project, run function **testDisposableWriterDryRun**.

Expected receipt:
- stage: DCAP_V2_NATIVE_DISPOSABLE_DRY_RUN
- state: PASS
- proposedTransactions: 3
- continuingAwards: 61
- continuingPoints: 196
- sheetWritesPerformed: 0
- disposableRegistryRows: members 0, events 0, rules 0, awards 0

The 61/196 counts include one *fictional preview* on top of the actual 60/192 journal. This is not a production increase. If the preflight fails, STOP.

## Run 2 — one fictional native write and identical retry

Only after the dry run passes, run **testDisposableWriterCommitAndRetry** once in the NEW TEST project.

It writes three fictional transactions ONLY to the new disposable registry: one new member, one new event, and one case-specific 4-point Other Commander award. It immediately retries the same transaction; the duplicate must not be appended.

Expected receipt:
- stage: DCAP_V2_NATIVE_DISPOSABLE_COMMIT_RETRY
- state: PASS
- firstOperation: APPLIED
- retryOperation: ALREADY_APPLIED
- continuingAwards: 61
- continuingPoints: 196
- newPublicMembers: 1
- manualCommanderAwards: 1
- disposableRegistryRows: members 1, events 1, rules 0, awards 1
- realRegistryWrites: 0
- historicalJournalWrites: 0

Running it again must return ALREADY_APPLIED without new writes. Do not change candidate IDs to make a second award.

## Independent verification

Read back both workbooks: the disposable workbook must show exactly 1/1/0/1 data rows, while the real owner registry must remain 0/0/0/0. Confirm the historical journal still has 60 approved rows / 192 points.

The fictional combined result 1,890 points / 612 contributions / 38 profiles must exist only in the disposable environment. The real proposed combined totals remain 1,886 / 611 / 37.

Keep rewards disabled, the public website on r000, and public/writer production deployment on HOLD. Share only safe aggregate receipts and new test Script ID for the acceptance review; never share OAuth tokens or full private logs.

Official documentation:
- https://developers.google.com/apps-script/reference/lock/lock-service
- https://developers.google.com/workspace/sheets/api/guides/batchupdate
- https://developers.google.com/apps-script/guides/services/authorization
