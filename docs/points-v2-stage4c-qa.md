# Stage 4C executed Chromium QA

**COMPLETE — DEV.2 FRONTEND AND CHROMIUM QA VERIFIED**

Executed 27 October 2026 (Pacific/Auckland) with system Chromium **151.0.7922.173**, headless on Debian Linux, using Playwright Core and a loopback-only HTTP server. These are real Chromium tests, not DOM emulation. Production v1 responses were intercepted with the existing fictional v1 fixture; no real production feed was fetched. The public-host gate test served local repository bytes under an intercepted public hostname; it did not deploy or alter that website.

## Results

| Validation | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Existing v1 regressions (identity links and contribution/API tests) | 9 | 0 | 0 |
| Existing DEV.1 tests | 9 | 0 | 0 |
| DEV.2 contract, accounting, provenance, privacy, cache and version tests | 19 | 0 | 0 |
| **Node total: `npm test`** | **37** | **0** | **0** |
| Real Chromium cases: `npm run test:browser` | **256** | **0** | **0** |
| Independent Python JSON Schema validation of reviewed fixtures | 5 | 0 | 0 |

The executable schema matches the accepted JSON Schema; that JSON file equals the supplied schema byte-for-byte. All five fictional fixtures equal the reviewed source bundle byte-for-byte.

## Browser matrix

| Executed scope | Cases | Result |
| --- | ---: | --- |
| Seven actual Points pages × five reviewed fixtures × 320/390/768/1024/1440 px | 175 | Pass |
| Seven pages × five fixtures at 200% root text size, 320 px viewport | 35 | Pass |
| Axe WCAG 2 A/AA, 2.1 AA, 2.2 AA and best-practice scan, seven pages | 7 | Zero violations |
| v1/DEV.1 seven-page regressions and public-host preview gate | 3 grouped | Pass |
| Normal, absent storage, throwing getters, throwing methods: navigation/reload/Back/network failure | 4 grouped | Pass |
| Remaining interactions, failure states, profile limits, loading, numerical rendering, no-JS and console/network checks | 32 | Pass |
| **Total browser cases** | **256** | **Pass** |

The seven pages are Overview, Leaderboard, Members, Member Profile, Statistics, How Points Work and Rewards. Recent Contributions is exercised in Statistics and member profiles, rather than invented as an eighth route. Fixture states are complete, pending, missing IDs/withheld awards, ties/multiple cycles, and incomplete source.

## Revision consistency and failure evidence

Normal storage persisted the exact validated session pin. Cross-page tests navigated Overview → Leaderboard → Members → Profile, then reload and Back, checking the fixture/revision/checksum in the URL on every page. Both absent storage properties and throwing storage getters/methods were exercised inside real Chromium via init-script fault injection. The same immutable fixture binding remained selected. Navigation with unavailable fixture responses used a verified matching cache when present, and otherwise displayed unavailable with no numerical rows.

Separate browser cases rejected corrupt session metadata, conflicting session revision, conflicting session hash, invalid URL binding, unknown fixture, invalid feed, unavailable feed, wrong contract, bad checksum, different revision and same revision/different content. Invalid URL context and duplicate fixture parameters stayed unavailable through both Points navigation and shared header links. Mid-session changed revision/hash candidates retained only the verified matching fallback. Corrupt cache, wrong cached revision, expired compatible fallback, timeout/abort and late-response suppression all passed. The timeout test accelerates the 15-second timer to 30 ms and delivers a delayed response to exercise the actual race and cache admission boundary.

## Accessibility, layout and interactions

- Actual Tab navigation and Enter traversed every Points view, profile/Back and shared header/footer Points links while retaining the selected binding.
- Enter/Space activated Show more/less, preserved focus, updated `aria-expanded`, and enforced five/ten limits. Validated fictional test-only variants exercised 0/1/5/6/10/12 entries and an 80-character name; the application validator remained enabled. Only the test harness's fictional manifest binding was changed for those variants.
- Named table regions accepted keyboard focus, showed a visible outline and scrolled horizontally with ArrowRight. Tables retained captions and scoped row/column headers. Search, empty results, cycle controls, tied ranks and unknown/missing member IDs passed.
- All five requested viewport widths passed document-overflow and row-label-width checks. The 200% test uses root font enlargement, not a claim about native browser zoom controls. No-JavaScript navigation/unavailable copy passed on all seven pages.
- Screenshot review found inherited v1 rank widths squeezing DEV.2 row labels. Scoped DEV.2 widths corrected this; the full affected matrix and screenshots were rerun. Loading also suppresses live placeholders until async integrity validation completes.

## Console, privacy and scope

There were **zero uncaught JavaScript errors** and **zero unexpected console errors**. Seven console HTTP 503 messages were expected from deliberately failed fixture requests. Preview operation required no external origins; the only external origin seen across the complete suite was the intercepted existing v1 Apps Script URL.

Privacy review found no private historical names/IDs/revision/checksum tokens or credential patterns in the complete public change set. Only fictional fixtures were copied. Runtime code renders text nodes, uses an allowlisted relative fixture source and introduces no telemetry or runtime dependencies. v1 API/configuration/validator/member routing, all original Points HTML and DEV.1 modules remain byte-identical to the starting PR.

The owner-supplied Pages setting is branch `main`, root folder. Both inspected remote heads matched the supplied baseline before work; no tracked workflow publishes feature branches. No publishing settings were changed. The connected repository tools do not expose a current Pages settings read; independently rechecking that administrative setting remains a production release gate, not a browser QA claim.

## Evidence and reproduction

Full per-case records: [Chromium results](evidence/stage4c/chromium-results.json). Node output: [unit results](evidence/stage4c/unit-tests.txt). Seven axe violation files alongside the results each contain an empty violation list. Screenshots: [Profile 390 px](evidence/stage4c/profile-390.png), [Statistics 1440 px](evidence/stage4c/statistics-1440.png), [Statistics 320 px](evidence/stage4c/statistics-320.png), and [no-JavaScript 390 px](evidence/stage4c/no-javascript-390.png). The completed screenshots were visually inspected.

Run from repository root:

```sh
npm ci
npm test
CHROMIUM_PATH=/usr/bin/chromium QA_OUTPUT_DIR=work/chromium npm run test:browser
```

Use an installed compatible Chromium binary. No public HTTP server, GitHub Pages deployment, Google credentials or backend installation is needed. Browser evidence and fixtures establish local frontend behavior only; actual cutover data, authenticated production publication and a separate final production contract remain subject to the [production handoff](points-v2-production-handoff.md).
