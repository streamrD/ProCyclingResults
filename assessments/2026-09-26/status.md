# Status of the 2026-09-26 findings

Every finding from the report's register (section 6), with what happened to it. Update this file as items close; the next monthly report starts from it. Commits are on `main`. "Partial" means the reader-visible part shipped and something named remains. "Deferred" means the maintainer chose to wait.

| ID | Status | Closed by / what remains |
|---|---|---|
| M1 | closed | 51770de: `logEvent`, `lastBuildError` on both caches, unhandled-rejection hook |
| R1 | closed | b644062: one-day race stays on the page on race day, article read on the live cadence |
| R2 | closed | fc66a6b: nationals columns mapped by header text, real page as fixture |
| R3 | partial | 51770de: logging and `/api/data-status` counts. Open: an external uptime monitor (maintainer account) |
| R4 | closed | 8c564a5: header-mapped season parser, real fixture, empty build refused |
| S1 | closed | aee8018: brotli/gzip on every response |
| S2 | partial | 295f14e: first rider name 1,180px → 1,076px on a phone; 885px in headless Chrome at its 500px minimum width on 2026-09-27, unchanged by S3 and the deferred panels (bytes, not position). Still below the fold: the hero is 521px |
| A1 | closed | 295f14e: status line and Today headline in the hero, chips on phones |
| A2 | closed | 295f14e: the competition stack's grid track (the real cause) and the long chip; smoke test guards a true 390px |
| A3 | closed | 295f14e: tier chip, weekday and countdown, duration, last year's winner |
| C1 | closed | 013cc62: one register across hero, sections, pills, warm-up |
| P1 | deferred | Discoverability last, by the maintainer's decision (2026-09-26) |
| M2 | partial | 51770de: `scripts/verify-deploy.js`, Node pinned. Open: Railway's wait-for-CI setting (maintainer) |
| M3 | closed | 51770de: section counts and last build error in `/api/data-status` |
| M4 | closed | 51770de: README "Accounts and secrets" section (costs still to be filled in by the maintainer) |
| M5 | closed | 8c564a5: providers keyed by season, rollover guard test |
| L1 | closed | fc66a6b wired the Data API path; the maintainer set `YOUTUBE_API_KEY` on Railway on 2026-09-26 and the fresh process found the three Worlds videos through it. The search-page scrape no longer runs while the key is set |
| L2 | open | Email to ASO (maintainer); code half (prefer the public rankings page) untouched |
| R5 | closed | b644062 |
| R6 | closed | b644062 |
| R7 | closed | 2026-09-27: backlog search of every finished race and stage under per-rebuild and daily caps, `data/finish-videos.json` seeded at boot, `npm run refresh:finish-videos`, `/api/finish-videos` |
| R8 | closed | 8c564a5 |
| S3 | closed | 2026-09-27: rows behind "Load more", the almanac and the calendar are fragments; a finished stage race's stage results load on first open (`/api/stage-results`). The page is 254 KB raw / 41 KB brotli with 693 elements (was 1,432 KB / 14,113 before S3, 561 KB / 3,467 after it); target 400 KB met |
| S4 | closed | 2026-09-27: six faces as woff2 (192 KB, was 550 KB), the two hero faces preloaded |
| S5 | closed | 51770de: build at boot |
| A4 | closed | 013cc62: Finished today / Yesterday pills on one-day cards |
| A5 | closed | 013cc62 + 8c564a5: `sameTime` kept by the parser, "same time" printed |
| A6 | closed | 013cc62: classification label is a button; inline top five on phones |
| A7 | partial | 295f14e: calendar opens at this month, Worlds in the calendar, status line in the hero. Open: nothing pressing |
| A8 | closed | 013cc62: footer and About say where results come from |
| A9 | closed | 013cc62 |
| A10 | closed | 2026-09-27: finished cards fold the jersey winners and stage results behind their headers (GC open); comped on the real Vuelta card at phone and desktop widths, chosen by the maintainer |
| C2 | closed | 295f14e |
| C3 | closed | 013cc62 + 8c564a5 |
| P2 | closed | 013cc62 |
| P3 | closed | 013cc62: "An independent race desk", not-affiliated line |
| P4 | closed | aee8018 |
| P5 | closed | 2026-09-27: `/feed.xml`, one entry per finished race and raced stage, linked from the head and footer |
| P6 | closed | duplicate of A2 |
| X1 | closed | aee8018: render cache and token bucket |
| X2 | closed | aee8018 caps and bucket; 2026-09-27 in-flight promise shared in `stageHistoryCache` |
| X3 | closed | aee8018 |
| X4 | open | GitHub token scope check (maintainer, five minutes) |
| X5 | closed | aee8018 |
| M6 | closed | 2026-09-27: `peekRaceArticlePool`/`loadRaceArticlePool` take `now` and their test holds the clock still; a guard test (`CLOCK_ARGUMENT_POSITION`) fails any call in the test file that leaves a calendar-sensitive function (`getCompetitionGroups` and 14 more) on the real clock; three `getCompetitionGroups` calls were given one. The card builders are not in the list (their tests mostly assert on clock-independent markup) |
| M7 | closed | 2026-09-27: `assets/site.css` and `assets/site.js`, inlined from disk at startup; the deferred groups are a JSON element |
| M8 | closed | 51770de README pass; 2026-09-27 `handoff.md` split into the map (1,100 lines) and `handoff-journal.md` (980 lines, dated, oldest first) |
| M9 | open | When an ASO provider next needs a change |
| M10 | closed | 8c564a5: season page and RSS fixtures |
| L3 | open | Nationals from Wikipedia (maintainer decision 7) |
| L4 | closed | fc66a6b: caps 10 live / 8 settled, page corrected |
| L5 | closed | 013cc62 |
| L6 | open | Ask komoot or ASO about the derived traces (maintainer) |
| R9 | closed | 8c564a5 |
| R10 | closed | 8c564a5 |
| R11 | closed | 8c564a5 |
| R12 | closed | 8c564a5: backoff and `lastIndexError`; 2026-09-27: test (a maxlag answer costs one query and no page reads for the index window, then is retried; shown to fail without the backoff) |
| R13 | closed | 8c564a5 |
| S6 | closed | aee8018 |
| S7 | closed | 2026-09-27: the index is parsed on the first rider card a pointer opens; phones never parse it (smoke test counts the parses) |
| S8 | closed | 2026-09-27: strong ETag (content hash, `-br`/`-gzip` per representation) with `cache-control: no-cache`, 304 on `if-none-match` |
| S9 | closed | 2026-09-27: metric-matched local fallback faces (`size-adjust` calibrated in headless Chrome) |
| S10 | closed | 77674e9: notes corrected; framed probe in the smoke test since 295f14e |
| A11 | partial | 013cc62: chips and unit toggles have 44px hit areas; rider links unchanged |
| A12 | closed | 013cc62 |
| A13 | closed | 2026-09-27: a WorldTour section with no upcoming race says when the next season opens (`buildSeasonOpeningCard`) |
| A14 | closed | 013cc62: `<footer>`. 2026-09-27: "Skip to results" link (hidden until focused), card titles h4 under the block h3, `aria-hidden` on the last two unmarked svgs (stage pictogram, almanac chevron); a test fails on any new unlabelled svg |
| A15 | closed | 013cc62 |
| C4 | closed | 013cc62 |
| C5 | open | Maintainer decision 5 |
| C6 | closed | 8c564a5: result stories lead a finished race's news |
| C7 | closed | 77674e9 |
| C8 | closed | 2026-09-27: one km/mi control in the header beside "Refresh results" (and in the close-out header), none in the stage panels; chosen by the maintainer from a comp, with the note that per-panel toggles may come back if they read better (the weight they cost is gone since the stage panels load on open) |
| C9 | closed | 2026-09-27, re-measured after S3 and the deferred stage panels: 254 KB raw at first paint (was 1.36 MB), 693 elements; opening the Vuelta's stage results costs 19 KB brotli |
| P7 | open | Maintainer decision 4 (Worlds ordering) |
| P8 | closed | 013cc62 |
| P9 | deferred | With P1 |
| X6 | closed | aee8018 |
| X7 | closed | aee8018 |
| X8 | closed | aee8018 |
| X9 | closed | aee8018 |
| X10 | closed | 51770de |
| X11 | closed | 013cc62: privacy note; analytics tag still on error pages |
| X12 | closed | 2026-09-27: `readResponseText` caps every upstream body (8 MB, Wikipedia 4 MB; the largest real one, YouTube's search page, is ~1.5 MB), streamed and cancelled at the cap, logged once and never retried. Nested-quantifier audit of `server.js`: two exponential wiki cell-attribute strippers (`splitSeasonTableRow`, `stripWikiCellAttributes`; 81 characters took ~40 s) now match the bare value atomically; the other nested quantifiers are disjoint or bounded. Not audited: `assets/site.js` and single-quantifier quadratic scans |
| M11 | open | Maintainer decision 11 (editor saves redeploy) |
| M12 | closed | 8c564a5 |
| M13 | closed | 51770de |
| M14 | closed | 51770de |
| L7 | closed | 2026-09-27: `fetchWikiPageContent` reads `api.php?action=query&prop=revisions&rvprop=ids\|content` (redirects not followed, as `action=raw` did not); the revision comes with the text, so a restart no longer reads every page twice. Wikipedia requests one at a time, 250 ms apart (was three at once, 32/s measured), team-name expansion included. Counted in the harness: cold build 138 → 115 requests, rebuild after the index window 46 → 11 (Wikipedia 38 → 3). Cost: cold build ~9 s longer (`WIKI_MIN_REQUEST_INTERVAL_MS` is the knob) |
| L8 | closed | 2026-09-27: provider and helpers archived to `archive/tour-of-greece-provider.js`, fixture and tests removed |
| L9 | closed | 013cc62 |
| L10 | closed | fc66a6b |
| L11 | deferred | With P1 |
| L12 | closed | fc66a6b |
| L13 | keep | Nothing to do unless cards link to organiser pages |
| CSP | partial | 2026-09-27: report-only policy on the results page, the client script allowed by hash, reports logged from `/api/csp-report`. Open: read the reports, then make it enforcing; the other pages |
| F1, F5, F24 | closed | 295f14e, 013cc62 |
| F2, F3, F23 | closed | 2026-09-27: `/calendar.ics` (whole season or `?race=<anchor>`), "Add to calendar" on upcoming cards, the winter line |
| F9 | open | Guide page |
