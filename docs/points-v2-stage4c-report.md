# Stage 4C implementation report

**COMPLETE — DEV.2 FRONTEND AND CHROMIUM QA VERIFIED**

Repository: `DCAP-GW2/dcap-gw2.github.io`. Branch: `feat/points-v2-website`. Existing PR: [#16](https://github.com/DCAP-GW2/dcap-gw2.github.io/pull/16), retained open, draft and unmerged. The implementation is the Stage 4C commit containing this report; its exact SHA is reported in the delivery response and can be inspected in the PR head.

Main/base commit: `2a0a25ee9089ed478f2831bf6bc02a84b337f98e`. Starting feature/PR head: `11436717acf26c266d0a5bb76368d444af2ca53f`. Both remote heads matched the supplied references before work. The only open PR found was #16; there were no overlapping open PRs or unrelated local edits.

## Implementation

- Added an exact, loopback-only preview dispatcher, preserving production v1 as default and the original `pointsPreview=synthetic` DEV.1 path. New `pointsPreview=ratified` selects DEV.2; no public-host URL parameter can activate either preview.
- Ported the accepted `2.0.0-dev.2` closed schema and semantic validator, adding bounds before WebCrypto processing and reusing the accepted pure serializer/rule inventory/aggregate helpers. Async integrity checks finish before rendering or cache admission. Invalid DEV.2 cannot fall through to another contract.
- Added a DEV.2-only loader/cache with 60-second freshness, 15-second request timeout, abort, bounded JSON decoding, validation of cache/network data, compatible expired fallback and late-response suppression.
- Bound reviewed immutable fictional fixtures to revision/checksum pairs and retained that context in session pins, URLs, reload/Back, page/profile navigation and shared Points links. Conflicts and corrupt context fail closed. When storage cannot be used, immutable bindings and URLs remain authoritative; failed fetches without verified matching cache produce no numerical rows.
- Adapted Overview, Leaderboard, Members, Profiles, Statistics/Recent Contributions, Rules and Rewards. Actual exception event labels and exact provenance are preserved; ineligible/pending records never become awards. Missing IDs have no fabricated routes. Historical/withheld/partial controls are explicit, general Other Commander remains TBD, and rewards stay gated.
- Added accessible captions/headers, labelled keyboard-scrollable table regions, visible focus, current-page navigation, five/ten Show more/less with retained focus and ARIA state, plus loading/unavailable states. Corrected inherited narrow first-column sizing only for DEV.2.

Changed file groups: seven existing page dispatcher imports; `js/points/preview.js`; five DEV.2 modules under `js/points/dev2/`; scoped CSS; the accepted JSON Schema and five unchanged reviewed fictional fixtures; Node/browser tests; development-only Playwright/axe dependencies and lockfile; architecture, production handoff and executed evidence documents. v1 API/configuration/validator/member-link helper, all original Points HTML and all DEV.1 modules remain byte-identical to the starting PR.

## Executed results

| Group | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| v1 regression tests | 9 | 0 | 0 |
| DEV.1 regression tests | 9 | 0 | 0 |
| DEV.2 contract/cache/version/privacy tests | 19 | 0 | 0 |
| Real Chromium cases | 256 | 0 | 0 |
| Independent JSON Schema fixture checks | 5 | 0 | 0 |

Chromium `151.0.7922.173` executed the actual seven pages and recent-history surfaces, five fixture states, all five requested widths, 200% text, real keyboard interactions/navigation, profile entry-limit variants, loading/error/empty states, revision/cache failures, storage faults and no-JavaScript navigation. Seven axe WCAG scans reported zero violations. Zero uncaught JavaScript errors occurred; seven expected console HTTP 503 messages came from deliberate feed failures. See the [complete matrix and reproduction instructions](points-v2-stage4c-qa.md), [machine-readable per-case evidence](evidence/stage4c/chromium-results.json), and screenshots linked there.

## Privacy and preservation

The five fixtures equal their reviewed bundle copies byte-for-byte. The accepted schema equals the supplied schema byte-for-byte. The complete public diff was scanned against private historical member names/IDs, award IDs, revision/checksum tokens and credential patterns with no matches. No private source bundle, decision overlay, identity map or historical feed is committed. Application rendering uses text nodes; no telemetry, dynamic evaluation or new third-party runtime packages were added.

No backend connector was used. No Google Sheet, Activity Ledger, scoring engine, rule registry, DEV revision, Apps Script source/property/trigger/deployment, production feed, live website or Pages setting was modified. The only authorized remote writes are the feature-branch commit and existing draft PR description. No replacement PR, main push, ready-for-review transition, merge, public preview or deployment occurs.

The owner's supplied Pages configuration is `main` at `/(root)`. There is no tracked feature-branch deployment workflow. Live administrative Pages settings were not independently readable through the available repository tools; recheck them at the eventual production release gate.

## Limits and next task

These results verify local frontend behavior using fictional data. They do not establish current production totals, live source freshness, current seasons or reward rights. Storage-disabled consistency is proven only for immutable reviewed fictional sources; a future mutable production endpoint needs its own authenticated immutable revision-selection design and separate production contract/cache. Storage failures were injected into real Chromium; native browser privacy-setting permutations and screen-reader certification are not claimed. The 200% coverage is text enlargement, not native browser zoom.

Next: prepare a fresh complete source-ledger snapshot and independently reconcile all cutover entries, late changes and identities, then define the final production contract/endpoint and exact release artifacts. Follow the [15-step production integration handoff](points-v2-production-handoff.md), including Version 4 review, independent restore and coordinated rollback, one supervised operator window and separate final release approval. Stage 4C performs none of those production actions.
