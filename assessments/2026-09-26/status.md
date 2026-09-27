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
| S2 | partial | 295f14e: first rider name 1,180px → 1,076px on a phone. Still below the fold; S3 shipped 2026-09-27 (bytes, not position); A10 is the next lever |
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
| S3 | partial | 2026-09-27: rows behind "Load more", the almanac and the calendar are fragments (`/api/recent-races`, `/api/national-championships`, `/api/season-calendar`); the page is 555 KB / 22 cards / 3,846 elements, was 1,432 KB / 58 / 14,113. Open: the 400 KB target needs A10 (finished stage-race cards) |
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
| M6 | partial | The one clock-dependent test was fixed on 2026-09-19; no lint added |
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
| R12 | partial | 8c564a5: backoff and `lastIndexError`. No test |
| R13 | closed | 8c564a5 |
| S6 | closed | aee8018 |
| S7 | open | Parse the rider index only on hover devices |
| S8 | closed | 2026-09-27: strong ETag (content hash, `-br`/`-gzip` per representation) with `cache-control: no-cache`, 304 on `if-none-match` |
| S9 | closed | 2026-09-27: metric-matched local fallback faces (`size-adjust` calibrated in headless Chrome) |
| S10 | closed | 77674e9: notes corrected; framed probe in the smoke test since 295f14e |
| A11 | partial | 013cc62: chips and unit toggles have 44px hit areas; rider links unchanged |
| A12 | closed | 013cc62 |
| A13 | closed | 2026-09-27: a WorldTour section with no upcoming race says when the next season opens (`buildSeasonOpeningCard`) |
| A14 | partial | 013cc62: `<footer>`. Open: skip link, heading depth, icon `aria-hidden` |
| A15 | closed | 013cc62 |
| C4 | closed | 013cc62 |
| C5 | open | Maintainer decision 5 |
| C6 | closed | 8c564a5: result stories lead a finished race's news |
| C7 | closed | 77674e9 |
| C8 | open | Per-panel unit toggles |
| C9 | open | S3 shipped 2026-09-27; re-measure |
| P7 | open | Maintainer decision 4 (Worlds ordering) |
| P8 | closed | 013cc62 |
| P9 | deferred | With P1 |
| X6 | closed | aee8018 |
| X7 | closed | aee8018 |
| X8 | closed | aee8018 |
| X9 | closed | aee8018 |
| X10 | closed | 51770de |
| X11 | closed | 013cc62: privacy note; analytics tag still on error pages |
| X12 | open | Cap upstream body size before parsing |
| M11 | open | Maintainer decision 11 (editor saves redeploy) |
| M12 | closed | 8c564a5 |
| M13 | closed | 51770de |
| M14 | closed | 51770de |
| L7 | open | Wikitext through the API instead of `action=raw` |
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
