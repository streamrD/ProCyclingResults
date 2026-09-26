# Area 8: Maintainability and Operability

Assessed commit: `9dc326f` (2026-09-26). Assessor worktree: `the repository root`. All file paths below are relative to that root unless absolute. Scratch scripts and raw outputs are under `assessments/tools/area8/`.

## 1. Summary

**Grade: C+** (maintainability B-, operability D+). The project is unusually well remembered for a one-person, evenings-only effort: `AGENTS.md`, `README.md`, `handoff.md` and `DATA-SOURCES.md` are current enough that the last ten commits each left the trail the rules ask for, 198 tests pass in nine seconds, a CI workflow exists (the brief said there was none; it was added on 2026-09-03), and production is verifiably on HEAD. What drags the grade down is that nothing in the running system can tell anyone it is broken: `server.js` logs exactly one line (the startup message), every background rebuild failure is rethrown into a `.catch(() => {})`, there is no `unhandledRejection` handler, `/api/data-status` cannot say that a section went empty, and a cold-start build that throws leaves the site on the warm-up page for ever with no trace. CI is advisory only: on 2026-09-15 five consecutive pushes failed the same calendar-dependent test and every one of them deployed to production anyway, and the failure was not fixed for four days. The biggest risk to the site staying up and changeable over the next year is therefore the combination of a silent failure mode, an unenforced test gate, one 17,113-line file whose largest function is 4,306 lines, and a bus factor of one: the single author holds the Railway account, both site tokens and the analytics instance, and no document says what any of them cost or how to rotate them. The season rollover around 9 January 2027 is the scheduled version of this risk: nine of the thirteen official providers are keyed to literal "2026 …" page titles and will silently stop matching, which is by design but needs a person in the loop that week.

## 2. Method

- Read `AGENTS.md` in full; `README.md` sections Repository Layout, Runbook, Endpoints, Caching Model, Operational Assumptions, Failure Modes, Security, Development Workflow, Recommended Workflow, Testing and Gaps, Suggested Near-Term Improvements, Practical Notes, Current Project Facts; `handoff.md` sections Current Product Scope, Repository Map, Runtime Shape, Endpoint Cross-Reference, Server.js Landmarks, Testing Cross-Reference, Editable Site Pages, Open Threads, Known Sharp Edges, every "Process Lessons" section, Suggested First Checks; `DATA-SOURCES.md` in full.
- Measured `server.js` with `area8-scratch/analyze.js` (function boundaries by top-level `function` / `const x = () =>` declarations closed by a column-0 `}`; preceding-comment detection; constant counts) and `area8-scratch/seams.js` (name-based seam classification, cross-seam call edges, cache-state touches). Duplication measured by line-level identity after renaming the race token (node one-liner, output recorded below).
- Ran `npm test` once (`area8-scratch/npm-test.log`), read both test harness headers, mapped every file in `test/fixtures/` to the tests and functions that read it, grepped tests for `new Date()`/`Date.now()`/`fetch`, and checked which provider and source functions have zero test references.
- Read `.github/workflows/test.yml`, `package.json`, `.gitignore`; confirmed no `railway.json`, `nixpacks.toml`, `.nvmrc`, `.node-version`, `Procfile` or `Dockerfile`. Pulled the last twelve GitHub Actions runs with `gh run list` and the failing log of two of them with `gh run view --log-failed`.
- One production GET each of `/api/build-info` and `/api/data-status`.
- Read the HTTP handler (`server.js:16872-17113`), `BUILD_INFO` (13-23), `buildDataStatusPayload` (8652), `buildRaceDataDebugPayload` (8603), warm-up gate and warm function (8584-8601), the live refresh timer (8407-8436), the metadata/data refresh catch blocks (8351-8363), all `new Map()` caches and their `.set`/`.delete` sites, and the provider registry (6492-6580).
- Checked the last ten commits (`git log --stat`) against `data/release-notes.md` and dated entries in `handoff.md`/`AGENTS.md`.

## 3. Measurements

### 3.1 Code structure (`server.js`)

| Measure | Value | Source |
|---|---|---|
| Lines / bytes | 17,113 / 637,112 (~159k tokens at 4 B/token) | `wc` |
| Top-level functions | 464 (462 `function`, 2 arrow) | analyze.js |
| Top-level `const` (non-function) | 165 | analyze.js |
| Functions with a preceding comment | 105 of 464 (23%) | analyze.js |
| Comment lines / blank lines | 1,036 / 1,773 | analyze.js |
| Median function length | 13 lines | analyze.js |
| Functions > 50 / > 100 / > 200 lines | 47 / 11 / 2 | analyze.js |
| `console.*` calls | 1 (`console.log` at 17111, startup) | grep |
| `catch` blocks | 63; 0 log anything | grep |
| `process.on(...)` handlers | 0 | grep |
| `process.memoryUsage` | 0 | grep |
| In-process caches | 10 `Map`s + 5 mutable state objects (1313-1340, 2194, 2346, 2763, 2891, 6581, 6816, 7898, 9162) | grep |
| Longest line | 501 chars at 11109 | analyze.js |

Ten longest functions:

| Function | Lines | Range | Why-comment |
|---|---|---|---|
| `buildHtmlPage` | 4,306 | 11693-15998 (CSS 11774-14905 = 3,132; client JS 14921-15995 = 1,075) | no |
| `buildSiteContentPage` | 361 | 16510-16870 | no |
| `mergeStageRaceSnapshots` | 179 | 5224-5402 | no |
| `buildRaceData` | 174 | 8026-8199 | no |
| `buildWarmupPage` | 156 | 16000-16155 | no |
| `buildStageProfileMarkup` | 149 | 9748-9896 | yes |
| `buildStageRaceCard` | 129 | 10068-10196 | no |
| `buildCompetitionGroupRaceData` | 127 | 8201-8327 | no |
| `extractStageRaceSnapshot` | 126 | 4066-4191 | no |
| `applyKnownStageRaceCorrections` | 119 | 4193-4311 | no |

Seams (name-based classification by `seams.js`; approximate):

| Seam | Functions | Lines | Notes |
|---|---|---|---|
| parsers (`parse*`, `extract*`, `clean*`, `is*`, `merge*`, `apply*`, …) | 176 | 3,173 | 0 calls into render helpers (checked: no `parse/extract/fetch/load/merge/apply/resolve/enrich` function calls a `build*Markup/Section/Card/Page` or `escapeHtml`) |
| rendering (`build*`, `escapeHtml`, `send*`) | 93 | 7,690 | includes `buildHtmlPage`; 82 distinct calls into parser/format helpers (mostly `format*`/`select*`), 1 call into sources: `buildStageRaceCard` → `warmRaceArticlePool` at 10184 starts Bing fetches during a render |
| sources (`fetch*`, `load*`, `refresh*`, `probe*`, `warm*`) | 51 | 1,236 | 16 functions touch cache state directly; the intended gate |
| official providers (`*Official*`, `*Aso*`, `*Letour*`, `*Livefeed*`, `*Ajax*`) | 39 | 938 | 0 touch cache state directly (`loadOfficialSnapshotThroughCache` is the only gate) |
| http | 2 | 43 | plus the inline handler at 16932-17109 |
| other / aggregation | 103 | 1,585 | `buildRaceData`, `partitionRaceBuckets`, rider index |

Tangles found: (1) `buildStageRaceCard` (rendering) has a network side effect via `warmRaceArticlePool` (`server.js:10182-10185`, documented in a comment); (2) `buildDataStatusPayload` and `buildRaceDataDebugPayload` read cache globals directly (8603-8664); (3) two parser-seam functions touch caches (`resolveTeamNames` → `teamNameCache` 2919, `resolveRaceFinishVideoUrl` → `finishVideoCache` 9036-9042). Everything else respects the seam.

Duplication (race-specific code): 81 functions carry a race name, 1,675 lines total. The ASO family is the clearest copy-paste:

| Pair | Lines A / B | Identical after renaming the race token |
|---|---|---|
| `extractLaVueltaFemeninaOfficialStageInfo` / `extractTourAuvergneRhoneAlpesOfficialStageInfo` | 21 / 21 | 20 |
| `buildLaVueltaFemeninaOfficialSnapshot` / `buildTourAuvergneRhoneAlpesOfficialSnapshot` | 32 / 32 | 29 |
| `fetchGiroDItaliaOfficialSnapshot` / `fetchGiroDItaliaWomenOfficialSnapshot` | 67 / 64 | 38 |
| `buildTourDeFranceOfficialSnapshot` / `buildLaVueltaFemeninaOfficialSnapshot` | 59 / 32 | 26 |

Plus twelve 3-line wrappers of the form `extract<Race>(General|Stage|TeamStage)AjaxUrl` / `parse<Race>OfficialStandings` / `fetch<Race>OfficialSnapshot` across Tour de France, Femmes, La Vuelta Femenina, Tour Auvergne-Rhône-Alpes and Vuelta a España. `OFFICIAL_STAGE_RACE_PROVIDERS` (6492-6580) has 13 entries; 9 match a literal `"2026 <title>"`. The Worlds feature is 22 functions / 406 lines, all prefixed `WorldChampionship`, which is the tidiest race-specific cluster in the file.

### 3.2 Test suite

| Measure | Value | Source |
|---|---|---|
| `npm test` result | 198 tests, 198 pass, 0 fail, 0 skipped, 0 suites | `npm-test.log` |
| Duration | 8,976 ms reported, 9,315 ms wall (Node v25.9.0, Chrome present so the smoke test ran) | `npm-test.log` |
| `test/parser-regressions.test.js` | 6,666 lines, 310,516 B (~78k tokens), 193 `test(` calls, flat list (no `describe`), 4 top-level comment lines | `wc`, grep |
| `test/browser-smoke.test.js` | 500 lines, 25,023 B, 5 tests, real headless Chrome | `wc`, grep |
| Test names by subject | 81 parser functions, 34 render functions, 18 source functions, 39 other functions, 19 prose | grep |
| Harness | `loadParserExports()` (lines 7-60+) runs `server.js` minus `server.listen` in a `vm` context and exposes ~200 internals on `__PCR_TEST__`; sandbox passes `fetch: global.fetch` (line 23) so network is reachable in principle | test file |
| Tests reading the real clock | 6 sites: lines 566, 575 (`publishedAt: new Date()`), 6495-6511 (`Date.now()` in the stale-article-pool test) | grep |
| Clock-taking functions in `server.js` | `partitionRaceBuckets`, `buildSeasonCalendar`, `resolveSeasonYear`, `describeLiveRaceDay`, `getCompetitionGroups`, `isWorldChampionshipWeek`, `getArticleCacheTtlMs`, `buildDataStatusPayload` all default `now = new Date()` (7660, 7783, 7933, 9311, 10573, 10654, 7547, 8652); 112 `new Date()`/`Date.now()` in total | grep |
| Calendar-drift test that already broke | "a stale article pool renders as a placeholder…" (6479): pinned to `2026-09-12` until 2026-09-19, failed CI on all five 2026-09-15 pushes (runs 34982258680 … 34992693604, `not ok 189`), fixed in `4fb203e` by reading the real clock on both sides (6490-6492). Still real-clock dependent but now consistent with the code | `gh run view`, `git diff 777f524 4fb203e` |
| Tests calling `getCompetitionGroups`/`partitionRaceBuckets` without `now` | 1619, 1941, 3358 — safe today because their fixtures carry no Worlds events, so `isWorldChampionshipWeek` short-circuits (10655-10662) | read |
| VM constraints (`__dirname`, `Buffer` absent) | Documented in `AGENTS.md` (the "template literal" bullet) and `handoff.md:1545-1548`; **not** in the test file header (lines 15-17 mention timers only), not in `handoff.md` "Testing Cross-Reference", not in `README.md` "Testing and Gaps". `server.js:16412` uses `Buffer.from` inside `commitSiteContentToGitHub`, unreachable by tests today | grep |

Fixture coverage (27 files, all used):

| Fixture | Tests | Parser exercised |
|---|---|---|
| `la-vuelta-femenina-{gc,rankings,stage}4.html` | 1 | `buildLaVueltaFemeninaOfficialSnapshot`, `extractLaVueltaFemenina*AjaxUrl` |
| `la-vuelta-femenina-stage1.wikitext` | 3 | `extractStageRaceSnapshot`, `extractStageArticleTitles`, jersey holders |
| `tour-de-france-femmes-{rankings,stage6-ite,stage6-itg}.html` | 1 | `fetchTourDeFranceFemmesOfficialSnapshot` |
| `tour-de-france-femmes-stage6.wikitext` | 2 | `extractStageRaceSnapshot`, `extractClassificationTableGcSnapshots` |
| `tour-de-france-rankings-stage21.html`, `tour-de-france-stage21-ite.html` | 2 each | `extractTourDeFranceOfficialStageInfo`, `parseLetourOfficialStandings`, `buildTourDeFranceOfficialSnapshot` |
| `tour-de-france-ttt-stage1.wikitext` | 1 | `mergeLatestStageIntoHistory`, `parseTeamReference`, `parseCyclingResultStandings` |
| `tour-of-greece-results-2026-stage1.html` | 1 | `parseTourOfGreeceOfficialStandings` |
| `uci-road-world-championships-2023-mens-time-trial.wikitext` | 1 | `parseWorldChampionshipEventResult` (2019-23 layout) |
| `uci-road-world-championships-2025-mens-road-race.wikitext` | 3 | `parseWorldChampionshipEventResult`, `enrichWorldChampionshipResults` |
| `uci-road-world-championships-2025-womens-time-trial.wikitext` | 1 | `parseWorldChampionshipEventResult` |
| `uci-road-world-championships-2026-mens-time-trial.wikitext`, `…-under-23-road-race.wikitext` | 1 each | `parseWorldChampionshipEventResult` (2026 "Athlete" column) |
| `uci-road-world-championships-2026-time-trial-medals.wikitext` | 1 | `parseWorldChampionshipMedalSummary`, `buildWorldChampionshipTag` |
| `uci-road-world-championships-2026.wikitext` | 2 | `parseWorldChampionshipEliteEvents`, `getCompetitionGroups` |
| `vuelta-a-espana-leadership-stage13.wikitext` | 1 | `extractClassificationLeadership`, `parseWikiTableGrid` |
| `vuelta-a-espana-rankings-stage5.html`, `…-stage5-ite.html`, `…-stage5-itg.html` | 1 | `fetchVueltaAEspanaOfficialSnapshot` |
| `vuelta-a-espana-route-cancelled-stage3.wikitext` | 1 | `extractRouteStages`, `buildStageSwitcherMarkup`, rider index |
| `vuelta-a-espana-stage2.wikitext` | 4 | `extractStageArticleTitles`, `extractStageRaceSnapshot`, `extractRouteStages` |
| `vuelta-a-espana-stages-1-11.wikitext` | 3 | `extractStageRaceSnapshot`, `parseCyclingResultLine` |
| `youtube-search-tdf-stage21.html` | 1 | `parseYouTubeSearchVideos`, `selectFinishVideo` |

Zero test references: `fetchTourDeRomandieOfficialSnapshot`, `fetchGrandePremioAnicolorLiveSnapshot`, `fetchVueltaAsturiasOfficialSnapshot`, `fetchEschbornFrankfurtOfficialStandings`, `fetchTourOfGreeceOfficialSnapshot` (its parser is tested), `fetchRaceArticles` (the Bing RSS parse; no `<item>` XML anywhere in the tests), `enrichLocations`, `probeSeasonOpening`, `fetchWikiRevisionIndex`. `parseSeasonRows` (the WorldTour season table, the root of everything) has 3 references but no fixture file; Giro/Giro Women/nationals index are tested against inline HTML in the test file.

### 3.3 Documentation sizes

| File | Lines | Bytes | ~Tokens | Headings | Last code-relevant staleness found |
|---|---|---|---|---|---|
| `AGENTS.md` | 150 | 21,774 | 5.4k | 8 | none |
| `README.md` | 829 | 65,051 | 16k | 63 | "No CI config in-repo", "No explicit Node engine declaration" (Testing and Gaps) — false since `1d45670` 2026-09-03; "Node 18+" vs `engines >=20`; Security notes predate the site editor; layout omits 6 files; Scripts lists 3 of 5 |
| `handoff.md` | 1,930 | 139,384 | 35k | 45 | "Open Threads … Live as of 2026-08-23" says `BUILD_INFO` "remains manual" (contradicted by `server.js:13-23` and its own Known Sharp Edges); fixture list shows 14 of 27; Repository Map omits `DATA-SOURCES.md`, `archive/race-coverage-block.js`, `scripts/pcs-*.browser.js` |
| `DATA-SOURCES.md` | 143 | 10,640 | 2.7k | 6 | none; review log has 12 dated entries, last 2026-09-20 |
| Total docs | 3,052 | 236,849 | ~59k | | |
| `server.js` for scale | 17,113 | 637,112 | ~159k | | |

Cost of a safe change: `AGENTS.md` (5.4k) + the relevant `README.md` sections (3-5k) + the target function and its tests (2-10k) ≈ 12-25k tokens. `README.md` "Recommended Workflow for Future Changes" item 1 ("Read `server.js` end-to-end before making structural changes") costs ~159k tokens and contradicts the token guidance in `AGENTS.md`.

Five-fact cross-check:

| Fact | AGENTS.md | README.md | handoff.md | DATA-SOURCES.md | Code |
|---|---|---|---|---|---|
| Cache TTLs (15 min default, 60 s live, 6 h settled, 60 min metadata) | consistent | consistent (503-547) but documents 3 of 15 caches | consistent (1232-1238) | consistent | `server.js:24,60,61,108,111` |
| Endpoints | 4 named | 12 routes incl. share paths and site pages | 12 routes | n/a | 10 `pathname` branches + 2 share paths |
| Season scope (WT men, WT women, nationals, 4 Worlds events) | yes | Product Purpose yes | Current Product Scope yes | yes | `getCompetitionGroups` |
| CI / Node engine | not mentioned | **"No CI", "No engine"** | CI + `>=20` (Known Sharp Edges) | n/a | `.github/workflows/test.yml`, `engines >=20` |
| Security / secrets | tokens named | **"No form input persistence", "No secrets are required"** | `SITE_EDIT_TOKEN`, `GITHUB_CONTENT_TOKEN` in 8 places | contact email in UA | `POST /api/site-content` writes `data/*.md` and commits |

### 3.4 Delivery and runtime facts

| Item | Finding |
|---|---|
| CI | `.github/workflows/test.yml`: on push to `main` and PRs; Node 22; `node -c server.js`; `npm test` with `CHROME_PATH=/usr/bin/google-chrome`. Added `1d45670` 2026-09-03 |
| CI enforcement | none; Railway deploys from `main` on push independently. Runs 34982258680, 34987371375, 34990135419, 34990507149, 34992693604 (all 2026-09-15) failed on `not ok 189`; all five commits deployed; green again from `4fb203e` 2026-09-19 |
| Node versions | production `v20.20.2` (`/api/build-info`); CI 22; local 25.9.0; `engines >=20`; README says 18+ and "local v24.14.0". No `.nvmrc`/`.node-version`/`railway.json`/`nixpacks.toml` in repo |
| Deploy config in repo | none (no healthcheck path, restart policy or build command committed) |
| Site editor | `POST /api/site-content` → `writeSiteContent` → `commitSiteContentToGitHub` (16381-16456) → PUT to GitHub Contents API on `main` → Railway redeploy. 3 editor commits in history (`streamrD`, 2026-09-04/05), 204 by the maintainer, one email |
| Production probes | `/api/build-info` → commit `9dc326f`, `source: railway-env`, `sourceContact: configured`; `/api/data-status` → `ttlMs: 60000` (live cadence, Worlds weekend), `ageMs: 16578`, `rebuilding: false` |
| Warm-up | `shouldServeHomepageWarmup` = `!raceDataCache.data` (8599); `warmRaceDataInBackground` is called only from a request (16941), not at startup; `resetOnFailure: true` on the warm path leaves `data: null` on a thrown build, so the warm-up page persists silently (confirmed by `handoff.md:1881`) |
| Live refresh | `scheduleLiveRaceRefresh` (8407) re-arms after every build; a failed tick keeps the last payload and re-arms (8431-8435); timer is `unref`'d |
| Bounded caches | `stageHistoryCache` (40 entries, 6818/6834), `wikiRawCache` (24 h idle eviction, but only inside the revision-index refresh, 2404-2405) |
| Unbounded caches | `articleCache`, `finishVideoCache`, `officialSnapshotCache`, `stageProfileCache`, `teamNameCache`, `seasonOpeningCache`, `worldChampionshipMissingPages`, `deferredGroupDataCaches`, `nationalChampionshipsCache`; all keyed by race/stage/team/year so growth is calendar-sized (hundreds of entries), never cleared across a rollover |

## 4. Risk register

| ID | Severity | Risk | Evidence | Likelihood | Impact | Mitigation | Effort |
|---|---|---|---|---|---|---|---|
| M1 | Critical | A failed build during a live race is invisible: no log line, no error field, the site sits on the warm-up page or serves a stale payload with nothing to show why | 1 `console.*` in 17,113 lines (`server.js:17111`); 63 `catch` blocks, none log; refresh errors rethrown then swallowed at 8389, 8506, 8577, 16941; 0 `process.on`; `handoff.md:1881` records the warm-up page "forever" case | Medium (it has happened once locally; upstream drift is the dominant bug source per `AGENTS.md`) | High: outage during the only hours the site matters, diagnosed only by a reader's message | Add one `logEvent(level, event, fields)` helper writing JSON lines to stdout (Railway keeps them); call it from the four rebuild `.catch`es, the top-level 500 handler, `warmRaceDataInBackground`, and a `process.on("unhandledRejection")`. Record `lastBuildError` and `lastBuildAt` on `raceDataCache` and expose them in `/api/data-status` | S |
| M2 | High | CI is advisory; a red push deploys | Five consecutive failed runs on 2026-09-15 all deployed (`gh run list`); `.github/workflows/test.yml` has no link to Railway; no `railway.json` | High (already happened) | Medium: a broken `server.js` reaches production ~30 s after push; a syntax error would 500 every request | Turn on Railway's "Wait for CI" (check-suite gating) for the service, or add a pre-push hook that runs `node -c server.js && npm test`. Add `scripts/verify-deploy.js` that polls `/api/build-info` for the SHA, waits for `/api/data-status` 200, then asserts `/` contains at least one `id="race-"` card and the Worlds/WT section headers; run it after every push | S |
| M3 | High | `/api/data-status` cannot detect an empty section; there is no alerting at all | Payload is `{fetchedAt, ageMs, ttlMs, nextRebuildDueMs, rebuilding}` (8652-8664); `?debug=1` adds cache ages and `liveRaceCount` only (8603-8632); no uptime monitor referenced in any doc | Medium | Medium-High: a parser drift that empties recent results is detected by a human looking at the page | Add counts to `/api/data-status`: `sections: {liveStageRaces, recentResults, upcomingRaces, nationalChampionships}` and `lastBuildError`; point a free external monitor (UptimeRobot/Better Stack) at it with an alert rule on `lastBuildError != null` or `recentResults == 0` | S |
| M4 | High | Bus factor 1: one author, one Railway account, `SITE_EDIT_TOKEN`, `GITHUB_CONTENT_TOKEN`, `SOURCE_CONTACT`, the Umami instance (`todd-umami.up.railway.app`, `server.js:30`), and no doc lists what they cost, where they live, or how to rotate them | `git log`: 204 + 5 commits, one email; README Security says "No secrets are required" (675-686); no cost or account note in any doc | Low per month, certain over years | High: if the maintainer is unavailable the site cannot be deployed, edited or moved | Add a short "Accounts and secrets" section to `README.md` (names, where set, scope, rotation, monthly cost) and a recovery note (repo is public on GitHub, Railway deploy is `npm start` with `PORT`, optional env vars) | S |
| M5 | High | Season rollover (~9 Jan 2027) silently drops nine official providers and depends on a guessed Cyclingnews URL and a Worlds parser that has met three layouts | `OFFICIAL_STAGE_RACE_PROVIDERS` 6492-6580: 9 of 13 match `"2026 …"` literals; `getNationalChampionshipsSource` (128-133) templates the URL by year; `handoff.md:1883` and `AGENTS.md` both say a person must look that week | Certain (by design) | Medium: Grand Tour cards fall back to Wikipedia only, which is winner-only until companion articles exist; nationals section empty if the URL pattern changes | Add a test that fails when `SEASON_YEAR` (or a fixed future date) leaves any provider unmatched by a race in the season list, so the first January `npm test` names what to re-key; keep the memory note; write the 2027 checklist into `handoff.md` now | S |
| M6 | Medium | Tests that read the real clock break on their own when the calendar moves | Test at 6479 broke 2026-09-15 and was red for four days; `getCompetitionGroups` tests at 1619/1941/3358 pass without `now` only because their fixtures carry no Worlds dates; 112 `new Date()`/`Date.now()` in `server.js`, 8 public functions default `now` | Medium (once already) | Low-Medium: false red CI trains people to ignore CI (which is what happened) | Give `peekRaceArticlePool`/`loadRaceArticlePool` a `now` parameter like `getRaceDataCacheTtlMs` and pass a fixed clock in the test; add a one-line lint in the test harness that greps new tests for `getCompetitionGroups(` without a second argument | S |
| M7 | Medium | `buildHtmlPage` is 4,306 lines holding 3,132 lines of CSS and 1,075 lines of client JS inside one template literal; a stray backtick or `${` breaks every test at load | `server.js:11693-15998`; `handoff.md:1822-1824` (a backtick in a comment "and every test failed at once"); `handoff.md:1717` (a `$\`` replacement produced a 14,000-line syntax error) | Medium | Medium: any agent editing CSS or client code risks the whole file | Move the CSS to `assets/site.css` and the client script to `assets/site.js`, read once at startup with `fs.readFileSync` and inlined into the page (same bytes to the browser, `no-store` unchanged, smoke test reads the files instead of regexing the template). No behaviour change, and the `${` guard becomes unnecessary | M |
| M8 | Medium | README is stale in the places an agent uses to decide what is safe | "No CI", "No engine" (Testing and Gaps), "Node 18+", "one JSON API", Security notes, layout and Scripts lists; `handoff.md` Open Threads "Live as of 2026-08-23" | Certain | Low-Medium: an agent may add a CI workflow that already exists or treat `POST /api/site-content` as nonexistent | One 20-minute doc pass (list in section 3.3); add "last verified" dates to the README sections that describe delivery and security | S |
| M9 | Medium | Duplicated provider code means a fix to one ASO parser is not a fix to its siblings | 20/21, 29/32, 38/67 identical lines across pairs (3.1); twelve 3-line wrappers | Medium | Medium: the 2026-08-06 outage was the same class (one of three template spellings) | Collapse the ASO family to one `buildAsoOfficialSnapshot({host, race, urls})` parameterised by host and keep the race-specific wrappers as one-line registrations; do it only when one of them next needs a change, and diff `/api/races` before/after per `AGENTS.md` | M |
| M10 | Medium | Untested source paths: Bing RSS parse, `parseSeasonRows` has no fixture, four providers have no test | Section 3.2 zero-reference list; `README.md` "Suggested Near-Term Improvements" #2 has asked for season-page fixtures since at least May | Medium | Medium: the season table is the root of every card; a Wikipedia table change would empty the site with all tests green | Save one `2026_UCI_World_Tour` wikitext fixture and one Bing RSS response as fixtures; one test each | S |
| M11 | Low | Every site-editor save redeploys the process, wiping caches mid-race | `handoff.md` Known Sharp Edges; 3 editor commits so far; warm-up on first request after restart, official provider cold cost ~11 s (`handoff.md:861-866`) | Low | Low-Medium during a Grand Tour | Either have the editor commit without redeploy (Railway "watch paths" excluding `data/*.md`) or accept it and note "do not save site pages during racing hours" in the editor UI | S |
| M12 | Low | Unbounded caches never clear across seasons | 9 `Map`s with no eviction (3.4); 0 `memoryUsage` logging | Low (calendar-sized keys, ~hundreds) | Low: memory creep of a few MB per season | Clear the race-keyed caches inside `resolveSeasonYear` when the year moves; log `process.memoryUsage().rss` with each rebuild once M1 exists | S |
| M13 | Low | Node major mismatch between production (20), CI (22) and local (25) | `/api/build-info.node`, `test.yml`, `node --version` | Low | Low-Medium: a Node 22+ API used locally would pass CI and crash on Railway | Pin `engines` to `20.x`, add `.nvmrc` = `20`, set `node-version: 20` in CI so the three match, and commit a `railway.json` with the Nixpacks Node version | S |
| M14 | Low | The VM harness constraints live only in `AGENTS.md` and a Process Lessons paragraph | Section 3.2; `server.js:16412` already uses `Buffer.from` in a function tests do not reach | Low | Low: a top-level `__dirname` breaks every test at load, which is loud | Copy the two sentences into the harness comment at `test/parser-regressions.test.js:15` and into `handoff.md` "Testing Cross-Reference" | S |

## 5. Recommended structural changes

Smallest first. None is a rewrite; each is a contained change an agent can make in one evening with `npm test` green before and after.

1. **`logEvent` helper + `lastBuildError` on the cache (M1, ~40 lines).** One function that prints a JSON line to stdout; call it in the four rebuild `.catch`es, the 500 handler and an `unhandledRejection` hook. Buys: the first ever after-the-fact view of a failure in Railway logs, and the field `/api/data-status` needs to say "the last rebuild failed at 17:51 with …".
2. **Section counts in `/api/data-status` (M3, ~10 lines).** `sections: {live, recent, upcoming, nationals}` and `lastBuildError`. Buys: an external monitor can alert on "recentResults dropped to 0" without any code on the monitor side.
3. **`scripts/verify-deploy.js` (M2, ~60 lines).** Encodes the loop every Process Lessons section repeats by hand (poll build-info for SHA, wait for data-status 200, grep one card). Buys: the verify-on-production rule becomes one command and stops being retyped.
4. **Pin Node to 20 in `engines`, `.nvmrc`, CI (M13, 3 lines).** Buys: CI tests what production runs.
5. **Rollover guard test (M5, ~25 lines).** Fails when a provider in `OFFICIAL_STAGE_RACE_PROVIDERS` matches no race for `SEASON_YEAR + 1`'s expected titles, or simpler, asserts each `"2026 "` literal against `SEASON_YEAR`. Buys: the January session starts from a failing test that names every provider to re-key.
6. **Doc pass on README (M8, 20 minutes).** Fix the six stale statements in 3.3, replace the "read `server.js` end-to-end" advice with `AGENTS.md`'s read-path guidance, add an "Accounts and secrets" section (M4). Buys: an agent that reads README does not act on a false premise.
7. **Move CSS and client JS out of the template literal (M7, ~1 hour).** `assets/site.css` and `assets/site.js` read once at startup and inlined. Buys: `buildHtmlPage` drops from 4,306 to ~100 lines; CSS/JS edits stop being able to break the parser tests; the smoke test reads real files instead of regexing the template; the `${` and backtick traps disappear.
8. **One `handoff.md` restructure (navigability).** Split into `handoff.md` (Current scope, Repository Map, Endpoints, Landmarks, Data Sources, Feature Maps, Known Sharp Edges, Suggested First Checks, ~900 lines) and `journal.md` (every dated "Added …" and "Process Lessons …" section in chronological order, append-only). Rename "Open Threads" to hold only open threads and date each. Buys: the durable map stops growing with every session, the journal stays greppable by date, and the next agent reads ~20k tokens instead of 35k to get the map.
9. **ASO provider parameterisation (M9, when next touched).** Buys: a fix lands in five races at once; the file loses ~150 lines.

## 6. Strengths

- **Memory discipline is real, not aspirational.** Of the ten commits since 2026-09-15, every user-visible change has a dated release-notes entry in the requested form (`data/release-notes.md`, 26/20/19/15/13 September), every session that learned something wrote to `handoff.md` or `AGENTS.md` (`9dc326f`, `dcc41ea`, `4fb203e`, `cd822c4`, `4765276`, `777f524`, `11f451f`), and `DATA-SOURCES.md` gained a dated review-log line for each fetch change (12 entries). The one omitted release note (`11f451f`) is deliberate and recorded twice (`handoff.md:1883`, memory).
- **Verify-on-production is followed.** `/api/build-info` reports `9dc326f`, `source: railway-env`; the Process Lessons sections describe the same loop eight times, and the last three sessions' handoff bullets cite what production showed that evening.
- **The test suite is fast, deterministic and fixture-driven**: 198 tests in 9 s, 27 real upstream fixtures, a real-browser smoke test that has already caught layout regressions, and a harness that tests internals without modularising the app. Provider tests inject fixture HTML by URL map (test file 450-465) so no test reaches the network.
- **Seams are cleaner than the file size suggests.** No parser or fetcher calls a render helper; providers never touch caches directly; the seam analysis found one deliberate render-side fetch and two payload builders as the only crossings.
- **Failure design in the data path is thoughtful**: stale payloads are served while rebuilding, a failed live tick re-arms, official lookups are budgeted, missing Worlds pages are retried every ten minutes at most, and `BUILD_INFO.source` admits when it is a fallback.
- **`AGENTS.md` is a genuinely good fast-start**: 5.4k tokens, task-specific read paths, the traps that actually cost time, and a standing "record what you learned" rule.
- **CI exists and is green now**, including the Chrome smoke test on the runner.

## 7. Open questions for the maintainer

1. Is Railway's "Wait for CI" (check-suite) gating enabled on the service? If not, is a red-CI deploy something you would rather block or merely be told about?
2. Where do Railway logs go today, and has anyone ever read them after an incident? (There is nothing to read yet; M1 changes that.)
3. What does the site cost per month (Railway service + Umami service), and is there a second person who can log into Railway and GitHub if you cannot?
4. Which of `SITE_EDIT_TOKEN`, `GITHUB_CONTENT_TOKEN`, `SOURCE_CONTACT` are set on production, what scope does the GitHub token have (it only needs `contents:write` on this one repo), and when were they last rotated?
5. Are you comfortable with each site-editor save restarting the process mid-race, or should saves stop redeploying (Railway watch paths)?
6. Would you accept moving CSS and the client script to two files under `assets/` that are inlined at startup, given that it changes nothing the browser receives?
7. Should `handoff.md` be split into a durable map and a dated journal before it passes 2,000 lines?
8. Who checks the site the week of 9 January 2027, and should the rollover checklist be a failing test rather than a memory note?

## 8. Recheck procedure

About 40 minutes, monthly, from a fresh worktree on `main`. Read-only.

1. **Size and shape (5 min).** `wc -l server.js AGENTS.md README.md handoff.md`; `node area8-scratch/analyze.js server.js /tmp/fns.json` and compare `FUNCTIONS`, `TOP15`, `CONSOLE`, `WITH_PRECEDING_COMMENT` with section 3.1. Flag if `buildHtmlPage` grew, if any function crossed 200 lines, or if `console` count is still 1 after M1 was meant to land.
2. **Tests (5 min).** `npm test 2>&1 | tail -12`; record `tests`, `pass`, `skipped`, `duration_ms`; confirm `skipped 0` (Chrome present). `grep -nE 'new Date\(\)|Date\.now\(\)' test/*.test.js` and check no new test calls a `now`-defaulting function without a clock.
3. **CI (3 min).** `gh run list --limit 15 --json headSha,conclusion,createdAt`; any `failure` on `main` older than one day that later deployed is an M2 recurrence; `gh run view <id> --log-failed | grep 'not ok'` names the test.
4. **Delivery config (2 min).** `ls .nvmrc railway.json nixpacks.toml`; `grep node-version .github/workflows/test.yml`; `grep '"node"' package.json`; compare with `curl -s https://procyclingresults.up.railway.app/api/build-info | grep node`.
5. **Production (3 min, two requests).** `/api/build-info` commit equals `git rev-parse --short origin/main`; `/api/data-status` returns 200 with `ageMs < ttlMs * 2`; if M3 landed, every section count is > 0 in season.
6. **Docs drift (10 min).** Re-run the five-fact table in 3.3: `grep -n 'No CI\|No explicit Node\|Node 18\|No secrets' README.md`; `grep -n 'Live as of' handoff.md`; `ls test/fixtures | wc -l` against the count in `handoff.md` Testing Cross-Reference; `ls scripts archive` against both layout trees; `grep -c '^## ' handoff.md` and the line count against the 2,000 threshold.
7. **Process (7 min).** `git log --stat --format='=== %h %ad %s' --date=short -10`; for each commit that touched `server.js`, confirm a same-day entry in `data/release-notes.md` (user-visible) and a dated line in `handoff.md` or `AGENTS.md`; for each commit that touched a fetch path, confirm a `DATA-SOURCES.md` review-log line.
8. **Scheduled items (5 min).** Before 19 Oct 2026: release note for the close-out. Before 9 Jan 2027: `grep -c '"2026 ' server.js` inside `OFFICIAL_STAGE_RACE_PROVIDERS`, `curl -sI https://www.cyclingnews.com/pro-cycling/racing/2027-road-national-champions-index/`, and the Worlds page title for 2027. Record the result in `handoff.md`.
