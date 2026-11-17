# Points v2.0 Stage 4C: architecture and compatibility

This is an **inactive, local-only fictional preview** of contract `2.0.0-dev.2`. It supersedes the release-readiness discussion in the Stage 3 document. Production still uses v1. No production or DEV backend changes, public preview, deployment or scoring changes are included.

## Run and select a contract

Serve the repository root over loopback HTTP, then open `/points/?pointsPreview=ratified`. Optional `fixture=complete|pending|missing|ties|incomplete` selects one of the five reviewed fictional datasets. `/points/?pointsPreview=synthetic` retains the original DEV.1 preview. No selector defaults to v1, including on the public DCAP hostname. Only exact loopback hostnames (`localhost`, `127.0.0.1`, `[::1]`) and exact, non-duplicated preview selectors activate a preview. No production v2 URL or activation flag exists.

`js/points/preview.js` dispatches to separate DEV.1 and DEV.2 entrypoints. Each uses its own full contract-version validator and cache. Invalid DEV.2 data is never retried through the DEV.1 or v1 parser. The seven existing page bodies retain their v1 implementation; their only JavaScript change is the preview dispatcher import. The v1 API, configuration, validator, cache, member-link helper, HTML and DEV.1 modules are unchanged.

## Validation boundary

`js/points/dev2/schema.mjs` is the supplied closed schema as an executable constant; `docs/schema-v2-dev2.schema.json` is byte-identical to the accepted supplied JSON Schema. `feed.mjs` ports the accepted Stage 4B schema interpreter and semantic validator, reusing the existing pure rule inventory, canonical serializer and aggregate helpers. It excludes private generators and backend scoring logic.

Validation checks required fields/types, exact rules/events/version, recursively closed objects, dates, source accounting, projected/withheld accounting, every aggregate grain, competition ranking, unique IDs/tuples, member references, canonical array order, all three non-stacking restrictions, provenance, exception consumption, completeness flags and SHA-256. Hashes are integrity checks, not proof of independent authority.

An explicit object-processing guard runs before hashing: at most 2 MiB encoded JSON, depth 32 and 200,000 visited values, plus the schema's array limits (normally 10,000). HTTP decoding streams with a byte limit and fatal UTF-8 decoding. WebCrypto digests are awaited for both canonical content and accepted public award tuples. The synchronous semantic validator receives only resolved digests; unexpected digest requests fail. No dynamic evaluation or HTML interpolation is used in the application.

Ratified exceptions require exact, unique historical provenance bindings. Their actual event names appear in event totals, profiles and recent history. Confirmed ineligible and suppressed sources have no award objects. Pending summaries remain separate from all numerical totals. General Other Commander remains TBD; no frontend rescoring occurs.

## Cache and revision selection

| Path | Cache namespace | Contract |
| --- | --- | --- |
| Production | `dcap.points.public.v1` | v1 |
| Original synthetic preview | `dcap.points.public.v2.preview.dev.1` | DEV.1 |
| Ratified fictional preview | `dcap.points.public.v2.preview.dev.2\|<fixture>` | DEV.2 |

DEV.2 validates both stored and fetched payloads before accepting or caching them. A receipt timestamp must be finite, nonnegative and no later than the local clock. Freshness is 60 seconds; a request has a 15-second timeout with abort. Concurrent calls on a loader share one request. A response completing after timeout cannot cache or promote data. Expired but validated, correctly bound data may be shown as explicitly labelled fallback. Wrong versions, malformed caches or unrelated revisions are never fallback data. Source freshness remains pinned historical regardless of cache age.

`fixtures.js` binds each reviewed **fictional** fixture to its exact public migration revision and checksum. The loader always requires both. The first successful render adds `fixture`, `previewRevision` and `previewHash` to the current history entry. Every generated Points/profile/Back link and shared header/footer Points link carries that context; profile IDs remain opaque and are never derived from names. An invalid fixture, duplicate selection parameter, partial binding, unknown revision or changed checksum fails closed. Invalid context remains invalid across generated navigation links until explicitly exited/reselected.

When session storage works, a fixture-specific session pin must also match that binding. Corrupt or conflicting session metadata fails closed. If storage is absent, throws on access, throws on methods, or cannot retain writes, the immutable fixture manifest and URL binding still enforce the same revision. Local storage may provide an already verified compatible snapshot; without it, a failed navigation fetch displays unavailable with no numerical rows. URL context is retained for reload and Back. Switching revision requires an explicit new reviewed binding/context, never automatic promotion.

**Limit:** this mechanism is deliberately limited to the five immutable fictional local sources. It is not a solution for a mutable production endpoint. A future production contract needs authenticated publication, immutable source addressing/revision selection, a new cache namespace and coordinated release handling. Browser URL/history are navigation context, not an authentication boundary.

## Rendering and accessibility

All seven Points views use the same validated DEV.2 snapshot: Overview, Leaderboard, Members, Profile, Statistics (including Recent Contributions), How Points Work and Rewards. Statistics supports dynamic event/role/pair/day/cycle aggregates. Identity-withheld totals and partial rankings are explicitly labelled. Missing public identities never receive generated profile links. Rewards remain unavailable for this inactive historical preview; there is no current season or entitlement assertion.

Profiles initially show five recent awards, expand to at most ten and return to five. The toggle is omitted when unnecessary; focus remains on it, `aria-expanded` and `aria-controls` track state. Table captions, column/row headers, named keyboard-scrollable regions, focus rings, labelled search and current-page navigation are provided. DEV.2-specific table sizing avoids inheriting v1's narrow rank column. Loading suppresses live-data placeholders until asynchronous validation finishes. With JavaScript disabled the original HTML navigation and unavailable copy remain usable.

## Verification and release handoff

See [executed Chromium QA](points-v2-stage4c-qa.md), the reproducible browser runner in `tests/browser/run.mjs`, and [production integration gates](points-v2-production-handoff.md). `npm test` runs contract/cache/privacy/regression tests. `npm ci && npm run test:browser` runs a loopback server and system Chromium (`CHROMIUM_PATH` may override `/usr/bin/chromium`); `QA_OUTPUT_DIR` selects the evidence directory. Playwright and axe are development dependencies only; the public site receives no additional runtime packages.
