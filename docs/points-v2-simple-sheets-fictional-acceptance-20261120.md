# DCAP Points v2.0 — Simplified Sheets Fictional Write Acceptance

**Date:** 20 November 2026 (NZDT)
**Stage:** Simplified v1-style connected Sheets write, independent readback and duplicate check
**Outcome:** PASS — isolated, fictional-only. Production HOLD.

## Evidence and operation

The owner authorised a fictional test in a separate private Google Sheet, copied from the real owner registry (separate file ID, preserved four-tab schema). The copy was verified owner-only and empty before any write. The connected Google Sheets tool, **not the native Apps Script writer nor Google Cloud OAuth bridge**, performed the single appendCells operation.

Fictional fixture:
- Date: 2026-11-20
- Event: Triple Trouble
- Historical roster member: Seb (existing public member ID, used as a **fictional** contribution only)
- Instance: `fictional-simple-20261120-001`
- Role: Blocker
- Frozen rule: `V2-03`, **3 points** (unchanged)
- Candidate key: `0000000000000000000000ba`
- Award status: `OWNER_FINAL`, award type `APPROVED_RULE`
- Test approval reference: `owner-fictional-simple-20261120`

Before writing, the script and source record checks confirmed an existing roster identity, event and frozen rule; the live journal held 60 approved awards / 192 points; there were no matching candidate keys or event/member/instance/role tuples in that journal; and the disposable private registry was empty.

The Google Sheets API returned one successful batchUpdate reply for **one** `appendCells` request writing **one 13-column award row** to the disposable `N5 Owner Awards` sheet (ID `18306103`).

Independent post-write readback verified the row fields and point value. Sheets returned one intentionally blank `ruleVersionId` cell as `null`, semantically equivalent to an empty field. Normalising blank cells gave an exact match.

On a proposed identical repeat, the duplicate lookup found the candidate key exactly once and returned `POSSIBLE_DUPLICATE`; **no second append was attempted**. This confirms a sequential duplicate warning, not an atomic concurrent compare-and-swap.

## Independent final state

| Workbook / tab group | Members | Events | Rule versions | Owner awards |
| --- | ---: | ---: | ---: | ---: |
| Disposable test copy | 0 | 0 | 0 | 1 fictional award |
| Real owner registry | 0 | 0 | 0 | 0 |

Historical N5 real journal: **60 rows, 192 points**, unchanged. No change to v1 ledger, original frozen `r000`, V4/V9, live site or rewards.

If the disposable award were included in the combined view, the hypothetical total would be **612 contributions, 1,889 points and 37 profiles**. This is NOT production. Real approved totals remain **611 contributions, 1,886 points and 37 profiles**.

## Scope and next steps

- **Closed PASSED:** One fictional, prevalidated normal-rule award, connected Sheets append, row readback, and sequential duplicate warning.
- **Not established:** Native concurrent writers, changing Sheets between check and append, actual production write activation, or public site cutover. Keep one single operator.
- Continue with a separate **read-only** v2 endpoint deployment and public browser/HTTPS/CORS checks, following owner approval. A website cutover is a further independent gate.
- No custom OAuth, Apps Script Execution API, MCP server, committee approval or per-award r00x release needed.
- Production remains HOLD.

**Output:** Successful isolated Sheets workflow acceptance; no modification to production data.
