# Pro Cycling Results AI Handoff

Updated: 2026-09-27 (split into this map and `handoff-journal.md`; finish-video backlog, calendar and feed, ETag, fonts, assets out of the template, on-demand fragments). Earlier: 2026-09-12 (news-line refresh, jersey swatch hover target, full-results links to PCS; 2026-09-10 jersey contenders card; 2026-09-08 one spelling per rider; 2026-09-07 live-card day line and Rest day pill; 2026-09-06 refresh button and `/api/data-status`; 2026-09-05 live-race timer, news line, source review; 2026-09-04 season calendar, championships almanac and map, editable pages, share previews)

This file accompanies `README.md` and `AGENTS.md`. It is the durable map: where things are, how they fit, and the traps that are still live. The dated record of what each session found, measured and decided is `handoff-journal.md`, one section per session, oldest first; append there, and lift into this map only what every future session needs.

## How To Use This Handoff

1. Read `AGENTS.md` first for operating rules.
2. Read `README.md` for durable architecture, runbook, data sources, and design intent.
3. Use this file to jump to the right local files, understand the current folder state, and avoid known traps.

This file intentionally repeats a few critical facts from the README because future agents often start from a single file. If README and this handoff disagree, inspect the code and update both docs.

## Current Product Scope

Active product scope:

- Men's WorldTour
- Women's WorldTour
- Elite road National Championships
- UCI Road World Championships, the four elite events: upcoming cards, then results with finish video and news (added 2026-09-07; see "Data Source Cross-Reference")

Retired scope:

- UCI ProSeries
- Europe Tour Spotlight

The retired ProSeries and Europe Tour sections were implemented previously and retired on 2026-06-22. Their restoration reference is preserved in `archive/proseries-europe-tour-sections.js`. Do not reactivate them unless the user explicitly asks.

## Local Audit Snapshot

Observed local path:

```text
/Users/tcs16/AgenticAI/ProCyclingResults
```

Earlier revisions of this file recorded the path with a `Desktop/` segment that does
not exist. If a handoff prompt fails at `cd`, this is why — check the real location
before assuming the checkout is missing.

Observed remote:

```text
origin https://github.com/streamrD/ProCyclingResults.git
```

Git state:

- Active development happens directly on `main`, which is what deploys.
- Local `main` tracks `origin/main` and was last left in sync after pushing.
- SHAs intentionally omitted here because they move every commit; run `git log --oneline -1` for the current HEAD.

The previously noted stale `ProCyclingResults-main` worktree record and the stray `assets/.DS_Store` were cleaned up; `git worktree list` should now show a single worktree.

No `node_modules`, package lockfile, database, build output, or hidden frontend app exists in the project folder.

## Repository Map

```text
.
├── AGENTS.md
├── README.md
├── handoff.md
├── package.json
├── server.js
├── archive/
│   └── proseries-europe-tour-sections.js
├── assets/
│   ├── favicon.svg
│   ├── og-default.jpg
│   ├── og-calendar.jpg
│   ├── og-championships.jpg
│   └── fonts/
├── data/
│   ├── about.md
│   ├── release-notes.md
│   ├── continent-map.json
│   ├── stage-profiles.json
│   └── static-stage-race-snapshots.json
├── design-comps/
│   ├── favicon-directions.html
│   ├── marks/
│   └── README.md
├── scripts/
│   ├── benchmark-load.js
│   ├── build-continent-map.js
│   └── refresh-stage-profiles.js
└── test/
    ├── browser-smoke.test.js
    ├── parser-regressions.test.js
    └── fixtures/
```

Primary file responsibilities:

- `server.js`: all runtime logic, data fetching, parsing, caching, rendering, routing, and server startup.
- `test/parser-regressions.test.js`: Node test suite plus VM-based export harness for testing internal functions without starting the server.
- `data/static-stage-race-snapshots.json`: bounded fallback snapshots for selected stage races when upstream live data is sparse.
- `data/stage-profiles.json`: committed elevation traces (see "Stage profiles").
- `data/continent-map.json`: the championships world map, built by `scripts/build-continent-map.js` (see "National Championships UX State").
- `data/about.md`, `data/release-notes.md`: the two editable site pages. The maintainer edits these on the live site, and every save is a commit to `main` by the GitHub token — pull before touching them by hand (see "Editable Site Pages").
- `archive/proseries-europe-tour-sections.js`: archived configs for retired ProSeries and Europe Tour sections.
- `scripts/benchmark-load.js`: cold-readiness and warmed endpoint timing checks.
- `assets/fonts/*`: local Manrope and Barlow Semi Condensed font files.
- `assets/og-default.jpg`, `assets/og-calendar.jpg`, `assets/og-championships.jpg`: link-preview images (1200×630) for `/`, `/calendar` and `/championships`, rendered from the site's own visuals. `SHARE_VIEWS` in `server.js` maps paths to them.
- `assets/favicon.svg`: site favicon (the cyclist-emoji pose in the site palette, on a blue plate, since 2026-09-04), linked from every document head with `?v=2`. A replacement at the same path needs a new version query because assets are cached for a year.
- `design-comps/`: design explorations kept with the code — the favicon comparison page and all six marks (the shipping `cyclist.svg` plus five earlier candidates). See its README before swapping the favicon; assets are served immutable for a year, so a replacement at the same path needs a version query.
- `README.md`: durable architecture and runbook.
- `AGENTS.md`: fast-start operating guide for agents.
- `handoff.md`: this cross-reference and audit snapshot.

## Runtime Shape

The app is intentionally minimal:

- Node.js only
- Built-in modules only
- No third-party npm dependencies
- No build step
- No database
- Server-rendered HTML plus JSON endpoints
- In-memory caches only

Run locally:

```bash
npm start
```

Default URL:

```text
http://localhost:3000
```

Useful scripts:

```bash
npm test
npm run benchmark:homepage-ready
npm run benchmark:ready
npm run benchmark:load -- --runs=5
```

## Endpoint Cross-Reference

- `/`: server-rendered homepage. During cold warmup it can return a warmup page.
- `/api/homepage-data`: active homepage JSON payload. During cold warmup it can return `202`.
  Carries `seasonCalendar` alongside the race buckets and `nationalChampionships`.
- `/api/races`: active race JSON payload. Use `?debug=1` for additional timing/debug payload.
- `/api/build-info`: `BUILD_INFO` from `server.js`, filled from Railway's env on deploy (commit, branch, deployment id) with a hardcoded fallback locally. Since 2026-09-05 it also reports `sourceContact: "configured" | "not set"` — whether `SOURCE_CONTACT` rides on the outbound user agent — as a yes/no only.
- `/api/data-status`: since 2026-09-06, what the hero's "Refresh results" button (`bindRefreshButton`) asks first. `{ fetchedAt, ageMs, ttlMs, nextRebuildDueMs, rebuilding }` from `buildDataStatusPayload`; a different `fetchedAt` from the page's `data-fetched-at` means reload, `rebuilding` means wait up to 45 s for it, otherwise the page says it already has the latest copy. Reads through `loadRaceData`, so it triggers nothing a page view would not. `202` during warm-up.
- `/api/competition-section?group=<id>`: retained hook for deferred sections. Retired `proseries` and `europe-tour` return `410`; unknown groups return `404`.
- `/api/race-news?race=<race id>`: one race's "Latest news" line, rendered from its article pool. Unknown race `404`, upstream failure `502`. The old `/api/competition-coverage` was retired on 2026-09-05 with the coverage block (`archive/race-coverage-block.js`).
- `/api/race-stages?race=<race id>`: reads a finished stage race's companion stage articles on request and returns `{ raceId, html }` with a re-rendered stage switcher. The id must resolve through `findStageRaceById` against the current homepage payload, so it cannot be pointed at an arbitrary Wikipedia page; anything else returns `404`.
- `/calendar`, `/championships`: the results page with its own link preview and a jump to the section (`SHARE_VIEWS`, `getShareView`, `buildShareMetaTags`, `bindShareJump`). Fragments never reach the server, which is why these exist.
- `/release-notes`, `/about`: editable site pages rendered from `data/*.md`; see "Editable Site Pages".
- `POST /api/site-content`: saves one of those pages; bearer `SITE_EDIT_TOKEN`, optional GitHub commit.
- `/assets/*`: static asset serving from `assets/`.

## Server.js Landmarks

Line numbers are approximate and can drift. Prefer searching function names with `rg`.

```bash
rg -n "function loadRaceData|function buildHtmlPage|NATIONAL_CHAMPIONSHIP|OFFICIAL_STAGE_RACE|http.createServer" server.js
```

Major areas (anchored to symbols rather than line numbers, which drift on every change — `rg -n "<symbol>" server.js`):

- Top-level constants and product config: `PORT`, `BUILD_INFO`, the cache-TTL constants, `SEASONS`
- Country, rider, and video lookup tables: `COUNTRY_NAMES`, `COUNTRY_FLAG_CODES`, `COUNTRY_NAME_ALPHA2`, `RACE_FINISH_VIDEO_URLS`, `RIDER_PROFILE_URLS` (verified direct ProCyclingStats addresses; everyone else links to the PCS search page for their name through `getRiderProfileUrl`)
- HTML escaping, wiki cleaning, and athlete parsing helpers: `escapeHtml`, `cleanWikiText`, `decodeHtml`, `parseAthleteDetails`
- Season table parsing and upstream fetch helpers: `parseSeasonRows`, `fetchText`, `fetchWikiRaw`
- National Championships parser and event expansion: `parseNationalChampionshipsIndex`, `buildNationalChampionshipEventRecords`
- Wiki stage-race extraction: `extractStageRaceSnapshot`
- Per-stage history and companion stage articles: `buildStageHistory`, `extractStageArticleTitles`, `loadStageArticleTexts`, `loadRequestedStageHistory`, `findStageRaceById`
- Stage strip rendering: `buildStageSwitcherMarkup`, `buildStagePanelMarkup`, `.stage-strip` / `.stage-chip` / `.stage-panel` CSS, and the delegated `[data-stage-target]` and `[data-load-stage-results]` click handlers in the inline script
- Freshness and cache TTL helpers: `hasFreshnessSensitiveRaceData`, `getRaceDataCacheTtlMs`
- Official race providers and parsers: `OFFICIAL_STAGE_RACE_PROVIDERS`, `parseAsoOfficialStandings`, `parseLetourOfficialStandings`, `fetchTourDeFranceOfficialSnapshot`
- Static snapshot hydration: `getStaticStageRaceSnapshot`
- Location enrichment: `enrichLocations`, `extractLeadLocation`
- Race bucketing and aggregation pipeline: `partitionRaceBuckets`, `buildRaceData`
- Rider season index and name settling: `foldRiderKey`, `buildRiderSeasonIndex`, `groupRiderNameVariants`, `mergeRiderNameVariants`, `pickRiderSpelling`, `buildCanonicalRiderNames`, `applyCanonicalRiderNames`
- Metadata and data cache loaders: `loadRaceMetadata`, `loadRaceData`, `refreshRaceDataInBackground`
- API/debug payload builders: `buildRaceDataDebugPayload`, `buildHomepageDataPayload`
- Race cards, standings, and rendering: `buildRaceCard`, `buildStageRaceCard`
- Finish-video resolution and YouTube search: `getRaceFinishVideoUrl`, `getStageFinishVideoUrl`, `enrichFinishVideos`, `enrichStageFinishVideos`, `buildStageFinishVideoSubject`, `parseYouTubeSearchVideos`, `selectFinishVideo`
- Recent-results row reveal: `buildRecentResultsBlock`, `.recent-race-slot`, `revealMoreRecentRaces` in the inline script — shows 3 by default, "Load more races" reveals up to `WORLDTOUR_RECENT_RESULTS` (12) and then removes itself once all rows are shown; revealed races feed the coverage dropdown via the `<group>-shown` query param and client-side option sync. Finished stage races are enriched even when not in the most-recent few and are never dropped for lacking a snapshot, so Grand Tours like the Giro stay in the grid. Note: both `.recent-race-slot` and `.load-more-races` set `display` in CSS, so each needs an explicit `[hidden]` rule for the JS `hidden` toggle to take effect
- National Championships rendering and header flags: `buildNationalChampionshipsSection`, `getCountryFlagEmojiByName`
- Season calendar: `buildSeasonCalendar`, `packSeasonCalendarRows`, `buildSeasonCalendarSvg`, `buildSeasonCalendarSection`, `createRaceAnchorId`, and `bindSeasonCalendar` in the inline script
- Competition group definitions: `getCompetitionGroups`
- Full HTML page, inline CSS, and inline browser JS: `buildHtmlPage`
- Warmup page: `buildWarmupPage`
- Response helpers, static file serving, and routes: `http.createServer`

## Data Source Cross-Reference

Primary race calendar and result source:

- Wikipedia raw wikitext season pages
- Active pages: `2026_UCI_World_Tour`, `2026_UCI_Women's_World_Tour`
- Raw URL shape: `https://en.wikipedia.org/w/index.php?title=<PAGE>&action=raw`

World Championships (added 2026-09-07):

- `2026_UCI_Road_World_Championships` (`WORLD_CHAMPIONSHIPS.pageTitle`), read once per rebuild through the same revision index
- `parseWorldChampionshipEliteEvents()` reads the "Schedule" section's tables with `parseWikiTableGrid` (the date and distance cells span rows) and keeps the four rows whose link target ends in "Men's/Women's road race/time trial"; under-23, junior and mixed-relay rows sit in the same tables
- Events carry `series: "UCI Road World Championships"`, `lane` (`mens`/`womens`), `startTimeLocal`, `distanceKm`, `laps` and `locationFromSchedule: true`, which makes `enrichLocations` skip them (their event pages 404 until race week and must not be asked for every rebuild)
- They render in the `world-championships` competition group: an Upcoming block and a Results block, both men's events first (`compareWorldChampionshipEvents`), all four result cards visible (`recentStep: 4`). The section disappears when both blocks are empty. They are not in the season calendar (`isWorldTourRace`)
- Results: `enrichWorldChampionshipResults` runs at the top of `buildRaceData` (metadata is cached for an hour, results have to ride the live cadence). From an event's race day it loads the event page through `loadWorldChampionshipEventPage` (a missing page is remembered for ten minutes) and `parseWorldChampionshipEventResult` reads the infobox podium (`{{flagUCIRoadathlete}}`, now accepted by `parseAthleteDetails`) and the "Final classification" table (medal templates in the rank column, `{{FlagUCIRoad|XXX}}` country column, a road race's gaps in the time column, a time trial's in a "Diff." column with hundredths kept). Filling `winner` is what moves the event from `upcomingRaces` into `recentOneDayResults`; `enrichRecentResultStandings` skips Worlds races so the shared parser cannot overwrite the standings
- Race day: an event with no result yet stays upcoming (`isWorldChampionshipEventAwaitingResult`), its card says "Today", and `getFreshnessSensitiveRaces` counts it so the rebuild runs on the live TTL in Montréal racing hours
- Searches: `getRaceArticleVariants` returns championship-named variants ("UCI Road World Championships men's road race", ...) for the news queries and the finish-video query; `isLikelyWorldChampionshipEventVideo` rejects clips for the other events of the week (wrong discipline, relay, under-23, junior) and `getRaceTokens` returns ["championships", "worlds"]. A hand-picked video still goes in `RACE_FINISH_VIDEO_URLS` under the event's page title
- Fixtures: `test/fixtures/uci-road-world-championships-2026.wikitext` (schedule), `...-2025-mens-road-race.wikitext` and `...-2025-womens-time-trial.wikitext` (results, Kigali layout). Check the 2026 event pages against the parser on the evening of 20 September
- Race-week prominence (2026-09-19): `isWorldChampionshipWeek` moves the section and its hero-menu button to the front, with a "This week" badge, from 7 days before the first elite event to 3 days after the last (`WORLD_CHAMPIONSHIP_LEAD_IN_DAYS`, `WORLD_CHAMPIONSHIP_AFTERGLOW_DAYS`); `getCompetitionGroups` takes `now` so tests can pin the date. The user asked for this the day before the time trials
- Parser hardening (2026-09-19): run against every elite event page from 2019 to 2025 before the 2026 pages existed. The 2019-23 layout (`{{gold01}}` medal templates, rider and nation inside one `{{flagUCIRoadathlete}}` cell, Tissot times like `1h 05' 05.35"` and `+ 12.28"`) used to yield the podium but no top five; all 24 pages now give both. Fixture: `...-2023-mens-time-trial.wikitext`
- Race day, first contact with a real 2026 page (2026-09-20). Two things the earlier editions did not show:
  - **The event page does not exist on race day.** The women's time trial page was created within hours; the men's was still a red link at 23:00 UTC, nine hours after the finish, so its card sat in Upcoming all evening. The podium was on the championship article the whole time, in the "Medal summary" table, whose rows name the event by the page it will live on (`{{DetailsLink|2026 UCI Road World Championships – Men's time trial}}`). `parseWorldChampionshipMedalSummary` reads that table and `enrichWorldChampionshipResults` falls back to it, setting `resultSource: "wikipedia-medal-summary"`; the event page takes over on the next rebuild after someone creates it, because `buildRaceData` re-clones the races from metadata every time and the enrichment runs again from empty. The medal row is a podium and nothing more, so no `resultStandings` are invented from it. The table is read out of the section text, not through `parseWikiTableGrid`: the event cell's `{{nowrap}}` is left unclosed on the live article. Fixture: `...-2026-time-trial-medals.wikitext`
  - **The news line was empty on every Worlds card, and always had been.** Two causes, both from treating a championship event like a race name. The queries quoted the card's own phrase (`"World Championships women's time trial" 2026 results report`), which no headline contains — fifteen searches returned two articles between them. And `isLikelyRaceArticle` demanded two of `getRaceTokens`' `["championships", "worlds"]`, while a headline writes one or the other, so both survivors were thrown away. `buildWorldChampionshipArticleQueries` now makes five loose searches naming the championship, the discipline and the winner, and `isLikelyRaceArticle` has a Worlds branch that matches the discipline through the shared `matchesWorldChampionshipEvent` (also used by the finish-video check now) and settles the division on the card's gender marker or its winner's name. Both time-trial cards went from nothing to eight real stories, correctly split
  - The section header (`buildWorldChampionshipTag`) read only `upcomingRaces`, so it shrank as the week went on — "Montreal, 26–27 September" on the evening of the time trials. It reads both blocks now
- Women's road race day (2026-09-26). The medal-summary fallback did its job: the medal row was edited ten minutes after the finish and the card carried the podium, video and eight stories that evening while the event page was still a red link. What it exposed: **every 2026 event page heads the rider column "Athlete", not "Rider"**, and writes the nation as a bare `{{SUI}}` / `{{GBR2}}` template rather than `{{flagUCIRoad|SUI}}`, so `parseWorldChampionshipEventResult` matched no rider column and both time-trial cards had shown the podium alone since the 20th. The parser now takes Rider/Athlete/Name/Cyclist and either nation form; the 2026 road race layout (read from the under-23 men's page, same editors) is one `Time` column that holds the winner's time and the others' gaps, which the existing `timeIsGap` branch already handles. Fixtures: `...-2026-mens-time-trial.wikitext`, `...-2026-mens-under-23-road-race.wikitext`. The lesson repeats 2026-09-19's: a parser that has met only earlier editions is not verified until it has read the current year's page, and this year's page did not exist to read until race week.

National Championships:

- Cyclingnews 2026 Road National Champions index
- Parsed through `parseNationalChampionshipsIndex()`
- Expanded into event records through `buildNationalChampionshipEventRecords()`
- Narrow source-backed overrides live in `NATIONAL_CHAMPIONSHIP_EVENT_METADATA`

Article coverage:

- Bing News RSS
- Query construction starts at `buildRaceArticleQueries()`
- Filtering/scoring lives around `isLikelyRaceArticle()`, `isCurrentEditionRaceArticle()`, `scoreRaceArticle()`, and `selectRaceArticles()`

Official race-source providers:

- Provider registry: `OFFICIAL_STAGE_RACE_PROVIDERS`
- One-day provider registry: `OFFICIAL_ONE_DAY_RESULT_PROVIDERS`
- Loading entry points: `loadOfficialStageRaceSnapshot()` and `loadOfficialOneDayResultStandings()`

Notable official/special providers currently in code:

- Tour de Romandie
- La Vuelta Femenina
- Tour de France (letour.fr official rankings; full stage top five + GC, ASO platform, dedicated `parseLetourOfficialStandings`)
- Tour de France Femmes (letourfemmes.fr; the same ASO deployment as letour.fr, so it shares every parser through `fetchAsoTourRankingsSnapshot` and differs only in entry point, page title and stage count)
- Tour Auvergne-Rhône-Alpes
- Tour of Greece — archived 2026-09-27 (L8): hellas-tour.gr Cloudflare-challenges even `/robots.txt`; see `archive/tour-of-greece-provider.js`
- Giro d'Italia
- Giro d'Italia Women
- Vuelta Asturias
- Vuelta a Burgos Feminas
- Eschborn-Frankfurt
- Grande Prémio Anicolor

## National Championships UX State

Rebuilt on 2026-09-04 as an almanac rather than a results feed. The old view rendered
293 completed titles as a three-column card grid (about 98 rows, roughly 29 screens) with
290 of them carrying a single name and "TBD / Location TBD". Current behavior:

- A schedule strip (`buildNationalChampionshipScheduleMarkup`) draws the calendar year
  with two hatched *typical* windows from `NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS` and
  solid dots for the few confirmed dates in `NATIONAL_CHAMPIONSHIP_EVENT_METADATA`. The
  caption lists the confirmed dates by federation. Hatching means "not confirmed" on
  purpose — see the honest-graphics rule in the stage-profile notes.
- A season-status card (`buildNationalChampionshipStatusMarkup`) says whether the
  season is essentially complete, how many federations have champions, and the next
  typical window.
- Featured cards (`isFeaturedNationalChampionshipEvent`) render only titles with a full
  podium, a report or a finish video — the existing event card, unchanged, including its
  flag header and flag-free podium. Today that is the four US titles.
- Everything else is one row per federation inside a `<details>` per continent
  (`groupNationalChampionshipsByContinent`, `buildNationalChampionshipGroupMarkup`),
  collapsed by default, ordered Europe, North & Central America, South America, Asia,
  Africa, Oceania, with a per-continent "usually late June"-style hint. Federations with
  no recorded result stay in the table but are hidden by CSS until the
  "include federations without a recorded result" toggle is pressed.
- Search matches federation or rider names (`data-search` on each row); category chips
  set `data-category` on the almanac root and CSS hides the other columns.
- Fully expanded, the table is about 83 rows (~4.5 screens); collapsed it is six lines.
- A world map above the groups (`buildNationalChampionshipMapMarkup`, `bindNationalChampionshipMap`)
  draws every country from `data/continent-map.json`, shaded by the group data: `is-champion`,
  `is-listed`, `is-none`, plus `national-map-dot` for the ten federations without a shape.
  Hover shows a tooltip, click opens the group and folds every other group closed (a
  map pick means "show me this one"); a category chip re-shades via
  `data-has-<key>` attributes. Hidden under 720px. The file comes from
  `npm run refresh:continent-map` (Natural Earth 1:110m, Robinson, Douglas–Peucker at
  0.55px, ~87 KB); rerun it only when a federation appears that is not drawn — the test
  "the continent map covers every federation" says so.

Continent buckets are geographic, not UCI confederations, so the Americas split the way
their championship windows do. `CONTINENT_BY_ALPHA2` is checked by a test against
`COUNTRY_NAME_ALPHA2`; a new federation in the index needs both entries.

Key functions/constants:

- `NATIONAL_CHAMPIONSHIP_EVENT_KEYS`, `NATIONAL_CHAMPIONSHIP_TABLE_COLUMNS`
- `NATIONAL_CHAMPIONSHIP_EVENT_METADATA`
- `NATIONAL_CHAMPIONSHIP_CONTINENTS`, `CONTINENT_BY_ALPHA2`, `NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS`
- `CONTINENT_MAP_DATA`, `buildNationalChampionshipMapMarkup()`, `scripts/build-continent-map.js`
- `parseNationalChampionshipsIndex()`
- `buildNationalChampionshipEventRecords()`
- `sortNationalChampionshipEvents()`
- `groupNationalChampionshipsByContinent()`
- `buildNationalChampionshipsSection()`
- `bindNationalChampionshipFilters()` inside the inline browser script

Known current video override:

- USA men's road race finish: `https://www.youtube.com/watch?v=hSVSHs9lPPI`

The design was chosen from a mockup canvas rendered with the site's real stylesheet and
real 2026 data: https://claude.ai/code/artifact/b690e73e-e87a-4e6e-a7a2-e1883bb8698c

## Season Calendar

Added 2026-09-04. A "Season at a glance" section sits between the hero and the men's
WorldTour section but is `hidden` until opened: the hero's "Season Calendar" button
(`data-season-open`; its "New" badge came off on 2026-09-15) or a `#season-calendar` link
reveals it and scrolls to it, and a "Close calendar" button in its header hides it again.
Since 2026-09-15 a "Full screen" button beside it pins the section over the window. The product
rule behind this is that the day's results always lead and nothing calendar-related
occupies space until a reader asks for it.

- Data: `buildSeasonCalendar(allRaces, todayUtc)` in `buildRaceData` turns
  `metadata.allRaces` (both WorldTours, already fetched from the season pages) into the
  `seasonCalendar` payload field — no new upstream request. Status is by date; tier is
  duration plus the hand-curated `SEASON_CALENDAR_GRAND_TOURS` and
  `SEASON_CALENDAR_MONUMENTS` sets. Nothing else is given a tier on purpose.
- Rendering: `buildSeasonCalendarSection` draws three full views (both / men / women)
  with `buildSeasonCalendarSvg`, plus a month-grouped list for phones
  (`buildSeasonMonthListMarkup`, live races pinned once, finished months folded to one
  line) and an "Up next" column. The SVG builder's `compact` option is unused since the
  under-hero strip was dropped the same day; it stays for a future teaser. Bars are packed into
  rows by `packSeasonCalendarRows`, which reserves label width so a Grand Tour label can
  push the next race down a row instead of overlapping it. The live bar fills to today.
- Links: a bar is an SVG `<a>` to `#race-<slug>` when the race has a card on the page
  (`createRaceAnchorId`, stamped on every card), otherwise a focusable `<g>`. The inline
  `bindSeasonCalendar` handles opening and closing, series chips, the tooltip fed from
  `data-tip-*` attributes, and revealing a hidden "Load more" slot before the jump.
- Motion: bars draw in via `transform-box: fill-box` scaleX with a per-bar `--i` delay;
  the today marker pulses; both stop under `prefers-reduced-motion`.
- The hatched national-championship windows appear here too, so the two features share
  one explanation of why the championships section goes quiet by September.

Known gap, corrected 2026-09-26: the hero fits a true 390px viewport. What overflows is the
National Championships almanac grid, clipped by its section (assessment finding A2 in
`assessments/2026-09-26/`); this section did not cause it and does not fix it.

## Editable Site Pages

Added 2026-09-04. `/release-notes` and `/about` render `data/release-notes.md` and
`data/about.md` with `renderMarkdown` (a deliberate subset, HTML-escaped first) inside
`buildSiteContentPage`, which carries its own compact stylesheet in the site palette.
Both are linked from the footer of every page via `buildSiteFooterLinks`.

Editing in place: with `SITE_EDIT_TOKEN` set on the server, the page shows "Edit this
page"; the key is asked for once and kept in `localStorage` (`pcr-edit-key`). Save
POSTs to `/api/site-content` (`handleSiteContentUpdate`): `isAuthorizedSiteEdit`
compares the bearer token in constant time, `writeSiteContent` updates the file so the
change is live immediately, and `commitSiteContentToGitHub` commits it when
`GITHUB_CONTENT_TOKEN` is set (contents API: read sha, PUT with base64). Railway then
redeploys from that commit, so the edit survives. Without the GitHub token the response
`note` says the edit lives only until the next deploy. A `401` makes the page forget the
stored key and ask again.

Two habits worth keeping:

- Add a dated entry to `data/release-notes.md` whenever a user-visible change ships;
  the page is the changelog readers see.
- The About biography is intentionally fictional (Ambrose Bidon) and says so in its
  last line; the opening sentence is the one true statement and should stay.

## Finish Video Links

Finish/highlight links are resolved by `getRaceFinishVideoUrl()`.

Resolution priority:

1. Curated `RACE_FINISH_VIDEO_URLS` overrides (race-level string or per-stage map).
2. Official-provider video already attached to the race (e.g. Giro livefeed `Last Km`).
3. Automatic YouTube search result attached during the data build by `enrichFinishVideos()`.

Static race and stage mappings live in `RACE_FINISH_VIDEO_URLS`.

Known current static stage links include:

- 2026 Giro d'Italia stages 1, 2, 3, 4, 5, 9, 13, 19
- 2026 Tour de Suisse stage 5: `https://www.youtube.com/watch?v=f61NRl63jFg`
- 2026 Tour Auvergne-Rhône-Alpes stage 5: `https://www.youtube.com/watch?v=4VSnvDeUO4E`
- 2026 Tour de France stage 1: `https://www.youtube.com/watch?v=U5br6kI5ha8` (a team time trial, which the automatic search gets wrong)

Giro d'Italia links prefer official livefeed-derived `Last Km` URLs before falling back to the static map.

### Automatic YouTube finish-video search

For recently finished races (and the latest stage of a live stage race) that have
no curated or official-provider video, `enrichFinishVideos()` searches YouTube and
attaches the best match. Key pieces:

- `buildFinishVideoQuery()` — race name + year + stage + `highlights`.
- `parseYouTubeSearchVideos()` — extracts `videoRenderer` entries from the page's
  `ytInitialData` JSON (no API key, no dependency).
- `isLikelyFinishVideo()` — enforces exact stage, race year, division (men/women),
  race-token match, and drops previews / start lists / livestreams.
- `scoreFinishVideo()` — prefers the race's own official channel (channel name
  carries the race tokens), then trusted broadcasters in
  `TRUSTED_FINISH_VIDEO_CHANNELS`, with bonuses for "extended highlights", verified
  badges, sensible clip length, and recency.
- Results cache in `finishVideoCache` (hits ~6h, misses ~20m so a later upload is
  still picked up); lookups per build are capped by `FINISH_VIDEO_LOOKUP_LIMIT`.

This is gated behind the curated map and official providers, so it never overrides a
hand-picked or official link, and it degrades silently to no link on failure.

The search sends `YOUTUBE_FETCH_USER_AGENT`, the site's agent string without the
`SOURCE_CONTACT` suffix, through `fetchText(url, { userAgent })`. YouTube serves its
mobile site (`m.youtube.com`, no `videoRenderer` entries, so the parser returns nothing
and the miss is cached for 20 minutes) to any agent string carrying a token after the
policy URL, email or otherwise. Found 2026-09-05, the day the contact went on the
agent: every Vuelta stage lost its video and the silent-degrade path hid the cause.
A regression test pins the YouTube agent to end at the policy URL.

### Per-stage finish videos

Each stage of a live stage race can carry its own video on `stage.finishVideoUrl`, so
clicking back to stage 1 of a Grand Tour offers that stage's finish.

- `buildStageFinishVideoSubject()` presents an earlier stage as the race's current one.
  Every helper above reads the stage off the race object, so this is what lets them be
  reused unchanged instead of taking a stage argument.
- `enrichStageFinishVideos()` is a separate bounded pass (`STAGE_FINISH_VIDEO_LOOKUP_LIMIT`,
  4) so earlier stages never consume `FINISH_VIDEO_LOOKUP_LIMIT` (6) and starve another
  race's current stage. It is restricted to live races: a three-week race would otherwise
  fire twenty searches on one cold start. Results cache per `(race, stage)`, so a backlog
  fills in over successive refreshes, newest stage first.
- `getStageFinishVideoUrl()` ignores a whole-race string entry in `RACE_FINISH_VIDEO_URLS`.
  That entry is the video of the *race* finishing and belongs to the final stage; a
  per-stage map entry still outranks a searched one.

### The backlog and the persisted file (2026-09-27)

With `YOUTUBE_API_KEY` set, `enrichFinishVideoBacklog()` (called right after the two
passes above in `buildRaceData`) covers everything the six-day window leaves out:
every settled one-day race older than the window and every stage of every finished
stage race, from `[...recentResults, ...finalizedStageRaces]`.
`listFinishVideoBacklogSubjects()` lists them newest race first, last stage first,
applies every cached hit without a search, and the pass then searches at most
`FINISH_VIDEO_BACKLOG_LOOKUP_LIMIT` (6) of the rest with `backlog: true`, which makes
a hit final and a miss wait `FINISH_VIDEO_BACKLOG_MISS_TTL_MS` (a week), under a
`FINISH_VIDEO_BACKLOG_BUDGET_MS` (4 s) wait; a slow lookup still lands in the cache
for the next rebuild. The lookups are counted in `finishVideoLookupLog` (a rolling
day) and `resolveRaceFinishVideoUrl` refuses the 91st in 24 hours
(`FINISH_VIDEO_DAILY_LOOKUP_CAP`); the backlog stops at 60
(`FINISH_VIDEO_BACKLOG_DAILY_LOOKUP_CAP`) so the live and recent passes keep their
room. The final stage of a finished stage race and the race itself share one cache
key (`getFinishVideoCacheKey`: page title plus `getRaceCoverageStageNumber`), which is
why the backlog's stage subject also writes `latestStage.finishVideoUrl`. Without a
key the backlog applies cached hits but searches nothing: the search page is not to be
read for old races.

`data/finish-videos.json` is the persisted store, kept the way `stage-profiles.json`
is: `loadPersistedFinishVideos()` seeds `finishVideoCache` at load with
`persistent: true` entries that never expire, `/api/finish-videos` lists every video
the process knows in the file's shape, and `npm run refresh:finish-videos` (default
`--from https://procyclingresults.up.railway.app`) merges that into the file for the
maintainer to commit. Run it every few days while the backlog fills (roughly 170
videos at 60 a day). `/api/data-status` reports `finishVideos.known` and
`finishVideos.lookupsToday` (since midnight Pacific, when YouTube's quota resets) and
`finishVideos.quotaPausedUntil`, and each rebuild that searched logs one
`finish-video-backlog` line with what it searched, found and still has pending.

The binding limit is not the 10,000 units: the Google project behind the key allows
**100 `search.list` calls a day** (`defaultSearchListPerDayPerProject`; a raw request
answers 429 with that name). The in-memory count restarts with each deploy, so the
first 429 (or 403) sets `finishVideoQuotaPausedUntil` to the next Pacific midnight
and every lookup, live and backlog, waits for it (`finish-video-quota-refused` in the
logs, once per pause). To diagnose a video gap, `railway run node <script>` gives a
script the key without printing it; the directory is linked to the project since
2026-09-27. A higher search quota can be requested in the Google Cloud console.

## Full Results Links (2026-09-12)

The cards stop at five on purpose; the full placings are one click away on
ProCyclingStats, which is where rider names already go. `getRaceResultsUrl(race,
target)` builds `https://www.procyclingstats.com/race/<slug>/<year>/<target>` from
`RACE_RESULT_SLUGS`, keyed by the page title without its year ("Tour of Flanders
(women's race)", "UCI Road World Championships – Men's time trial"). Targets: `result`
for a one-day race, `stage-<n>` for a stage (`prologue` for stage 0), and `gc`,
`points`, `kom`, `youth` for the classifications (`PCS_CLASSIFICATION_PAGES`; the team
classification has no page there, its `teams` path is the start list). A race the map
does not know goes to the PCS search page for its title and year, as an unmatched
rider name does. Three places render it: `buildRaceLinksMarkup` puts "Full results"
beside "Watch the race finish" on a one-day card and "Full stage results" beside the
stage finish link in every stage panel (the two share a `.race-links` row; the video
keeps the filled pill, the results link is the same pill outlined), and
`buildJerseyContendersMarkup` ends the jersey card with "Full classification on
ProCyclingStats" in the rider card's link row.

All 65 slugs were verified in the user's Chrome on 2026-09-12 by fetching each
`/race/<slug>/2026` same-origin from a PCS tab (`scripts/pcs-race-links.browser.js`
is that check, written up). What the check taught: a wrong slug answers HTTP 500 with
an empty body, not a titled 404; the women's races rarely take the men's slug plus
"-we" (`strade-bianche-donne`, `milano-sanremo-donne`, `la-fleche-wallonne-feminine`,
`liege-bastogne-liege-femmes`, `gent-wevelgem-women-elite`, `santos-women-s-tour`,
`cadel-evans-great-ocean-we`, `vuelta-espana-femenina`, `tour-of-britain-women`); the
Dauphiné is `tour-auvergne-rhone-alpes`; Classic Lorient is `gp-ouest-france-plouay`;
Chongming is `tour-of-chongming-island-world-cup`; the Worlds are
`world-championship`, `-itt`, `-we`, `-itt-we`. PCS's own search page is nearly
useless for this (its results are mostly the site navigation), so guess slugs and test
them. The server never fetches PCS; `DATA-SOURCES.md` says so and must stay true.

## Testing Cross-Reference

The test harness reads `server.js`, strips the `server.listen(...)` block, runs the rest in a VM, and exposes selected internals on `globalThis.__PCR_TEST__`.

This means tests can call internal functions without converting the app to modules. If adding a test for an internal helper, export it through the harness at the top of `test/parser-regressions.test.js`.

Current fixture folder:

```text
test/fixtures/
├── la-vuelta-femenina-gc-stage4.html
├── la-vuelta-femenina-rankings-stage4.html
├── la-vuelta-femenina-stage1.wikitext
├── la-vuelta-femenina-stage4.html
├── tour-de-france-femmes-rankings-stage6.html
├── tour-de-france-femmes-stage6-ite.html
├── tour-de-france-femmes-stage6-itg.html
├── tour-de-france-femmes-stage6.wikitext
├── tour-de-france-rankings-stage21.html
├── tour-de-france-stage21-ite.html
├── vuelta-a-espana-stage2.wikitext
├── vuelta-a-espana-stages-1-11.wikitext
└── youtube-search-tdf-stage21.html
```

Harness trap: values returned from the VM sandbox are built with the sandbox's own
`Object.prototype`, so `assert.deepEqual` fails on them with "same structure but not
reference-equal" even when the contents match. Either assert scalar fields
individually, or round-trip through `JSON.parse(JSON.stringify(...))` first — several
existing tests do the latter.

When capturing an ASO fixture from a live page, collapse runs of whitespace before
committing it. The real markup is ~90% indentation; the Tour de France Femmes fixtures
went from ~23KB to ~7KB each with no change in what the parsers see.

Recommended validation for code changes:

```bash
node -c server.js
npm test
```

For rendering, aggregation, or endpoint behavior, also run the server and check:

```text
/
/api/homepage-data
/api/races
```

Avoid leaving stale local servers running. If using a manual local process, stop it before handing back.

## Stage Results Feature Map

Added 2026-08-23. Stage races render a numbered strip that swaps one stage panel in
place, so a 21-stage card stays the height of a 5-stage one. Four pieces, in the order
data flows through them.

**1. Where per-stage results come from.** `extractStageRaceSnapshot(rawText, stageArticleTexts)`
builds `stageRace.stages`: one entry per raced stage with `number`, `order`, `label`,
optional `date` / `course` from the route table, and `standings`. `buildStageHistory`
prefers a `{{cyclingresult}}` podium and falls back to the route table's winner-only
row, so a race with neither still renders as it did before. `latestStage` is just the
last entry, which is what keeps the card's headline stage and its strip from
disagreeing.

**2. Companion stage articles.** Longer races publish only a winner column on the main
article and keep real podiums on `<race>, Stage 1 to Stage 11` pages. The route table
links them, so `extractStageArticleTitles` reads the titles off the page instead of
guessing a naming convention, and `loadStageArticleTexts` fetches them (capped by
`MAX_STAGE_ARTICLES`; failures degrade to the main article alone). Not a Grand Tour
convention — La Vuelta Femenina links them too, while Pologne, Suisse, Auvergne and
Itzulia publish inline and are already deep with no companion fetch. Romandie is deep
for stages 1-5 and winner-only for its prologue, which is the usual shape when a page
publishes most stages inline but not all.

Companion articles feed **stage results only**. They repeat a
`General classification after Stage N` block, but those are hand-copied and drift; on
the 2026 Vuelta the stage 2 GC block still carried the stage 1 leader time. They are
also kept away from `findOverallRaceResult`, or a `Stage 1 Result` block gets read as
the race's overall result.

**3. Companion articles are read for live and finished races alike.** They were moved
off the finished-race path when the cold start was ~20s and their ~2s mattered;
budgeting the official providers took the build to ~6s, so that trade no longer applies
and finished Grand Tours render their stage podiums without anyone pressing a button.
`/api/race-stages` remains as the on-demand fallback for whatever this misses, cached
six hours in `stageHistoryCache` and written back onto the cached race. Its "Load full
stage results" control only surfaces when a card's history is still winner-only, which
in practice now means a race whose page has no companion article at all.

**3a. An official provider's current stage has to be folded into the history.**
`mergeLatestStageIntoHistory` does this in `mergeStageRaceSnapshots`, and it is not
optional. Providers report only the current stage, but report it better than the route
table: the 2026 Tour's route table stops at stage 20 while letour.fr has stage 21 five
deep. Without the fold, the strip rendered the Wikipedia history alone and silently
discarded data the build had already paid to fetch — the card's headline stage and its
own strip disagreed. If a stage race's final stage goes missing from the strip, look
here first.

**4. Per-stage finish videos.** See "Per-stage finish videos" above.

**5. Stage profiles (added 2026-09-03).** Each stage panel opens with a profile block:
the measured altitude trace where one exists, otherwise a deliberately schematic
pictogram for the stage type, plus the distance, the climbing total when known, and a
km/mi toggle. Two data paths feed it.

- *Route table.* `extractRouteStages` now reads every row of "Stage characteristics",
  raced or not, and adds `distanceKm` (from `{{convert|…|km}}`) and `stageType` (one of
  `flat`, `hilly`, `medium-mountain`, `mountain`, `individual-time-trial`,
  `team-time-trial`, read from the icon file name *and* the label — pages use either).
  `buildStageHistory` copies both onto raced stages, and the snapshot carries the whole
  route as `stageRace.route` so `applyRouteDetails` can fill in a stage that arrives
  from an official provider before Wikipedia has its winner. Without that the current
  stage — the one a reader most wants — would be the only one with no profile.
- *Measured trace.* `enrichStageProfiles` fetches the organiser's stage page for the
  races in `STAGE_PROFILE_SOURCES` (ASO sites: Vuelta, Tour, Tour Femmes, Vuelta
  Femenina), finds the embedded komoot tour, and pulls its distance, `elevation_up` and
  coordinate trace from komoot's public API. The trace is resampled to 120 points by
  distance and stored on the stage as `profile`. Only lavuelta.es embedded komoot when
  this was built; letour.fr and the women's sites ship static profile images, so they
  fall through to the pictogram. Current edition only — live, finished and recent races alike — budgeted like
  the official providers (`STAGE_PROFILE_BLOCKING_BUDGET_MS`, `STAGE_PROFILE_LOOKUP_LIMIT`),
  and cached for a week in `stageProfileCache` because a published profile never
  changes. Late arrivals write onto the cached race, so the next render has them.

Every results card — live, finalized stage race, one-day — ends with a "Latest news"
line (`buildRaceNewsMarkup`, decided 2026-09-05 from four comps; the user picked the
one-line-that-opens-in-place shape and asked for it under the GC and on every card
where news is offered). The line carries the race's leading story (newest day, best
score first — `selectRaceArticles` with refresh token 0) and opens all eight stories
in place. The "Race Coverage" block that used to close each section was retired the
same day as redundant (archived in `archive/race-coverage-block.js`; its Refresh paging
and story summaries were the only things not carried over). It renders ready only when `articleCache` already
holds the race and the pool is younger than its cache window (`peekRaceArticlePool`;
until 2026-09-12 any cached pool counted, so a live race's news froze at its first
fetch — the Vuelta sat on stage 18 for two days); otherwise it is a pending placeholder that the
client fills from `/api/race-news?race=<id>` when the card scrolls within 240px of the
viewport or the line is tapped, so a page of recent races fetches coverage one card at
a time instead of 12 × 32 RSS queries at build. Live cards call `warmRaceArticlePool`
so the second render carries the headline in the HTML, and the same call refreshes a
stale pool in the background on a later rebuild. `/api/race-news` asks
`loadRaceArticlePool` to wait for an in-flight refresh (`waitForRefresh`) rather than
answer with the stale pool, falling back to the stale pool only if the refresh fails. Measured before the change: on
desktop the Vuelta card ended ~1,800px above the coverage block (plus a click), on a
phone ~2,900px.

`buildStageProfileMarkup` prefers the measured trace, scaled to its own altitude range
but never less than 1,000 m of it so a flat stage stays low, and labels it "Elevation
data: komoot". It renders compact by default — a thumbnail of the trace beside the
caption — and "Expand profile" swaps the same SVG into a tall chart with an
altitude-coloured fill, gridlines, km ticks and start/finish markers (towns parsed from
the course cell by `parseStageCourseEnds`). One markup, two CSS states; the axes and
markers are simply hidden while compact. The client keeps the choice in `localStorage`
under `pcr-profile-view` and applies it to every measured profile on the page. Phones
(the 720px breakpoint) never expand: the chart is too compressed to read at that width
and the start and finish towns run into the caption, so the button is hidden there and
`applyProfileView` refuses the class while `matchMedia("(max-width: 720px)")` matches
(decided 2026-09-05). The stored choice is kept, so rotating a tablet back restores it;
`test/browser-smoke.test.js` runs a second Chrome pass at `--window-size=390,844` to guard this (which this machine's Chrome lays out at 500px, see 2026-09-26 below, so it guards the 500px layout). A stage without one gets the `STAGE_TYPE_GLYPHS` icon for its type — the
same icon for every stage of that type, in a dashed box, with the note "no elevation
profile is available" — because a plausible-looking silhouette was tried first and read
as a real profile (the user spotted three Tour mountain stages drawn nearly alike). Do
not make the generic case look more realistic; make it look more generic.

*Palette.* The measured fill maps the site's rainbow strip to height: green `#00a651`
at the valley floor, blue `#005bbb` on the lower slopes, yellow `#ffcc00` across the
high ground and red `#ef3340` held for the summit slice (stops in the `<linearGradient>`
inside `buildStageProfileMarkup`, `gradientUnits="userSpaceOnUse"` so colour follows chart
height rather than each stage's own bounding box). The warm end deliberately takes the
top third so a 2,000 m climb lights up instead of showing a red tip. Chosen from six
comps rendered in the site's own styling — topographic, house blue, UCI stripe, Vuelta
crimson, alpine, navy-to-gold; the user picked the stripe, then asked for yellow between
blue and red. Comps: https://claude.ai/code/artifact/7add321d-1e0c-4061-943b-cc9bc6eb3475.
The line stays `--uci-blue-deep`. Changing the palette is those stops and nothing else.

*Durable store.* `data/stage-profiles.json` holds every fetched trace, keyed
`<page title>#<stage>`, and `loadPersistedStageProfiles` seeds `stageProfileCache` from
it at startup with entries that never expire. Fill it with
`npm run refresh:stage-profiles -- --race "2026 Vuelta a España" --stages 21` once a
route is published (organisers post all stages before the race) and commit the result;
production then never re-fetches those stages, and a finished race keeps its charts.
Runtime fetches still cover anything the file lacks. Enrichment runs for live,
finished and recent races alike, gated to the current year and a matching source.

*Up next (revised 2026-09-03).* On a live race the following stage — `getNextRouteStage`
reads it off `stageRace.route` — gets three things from `buildStageSwitcherMarkup`: its
chip in the strip becomes selectable and wears a small "next" tag in the live-race
yellow; a one-line row above the strip (`buildNextStageRowMarkup`) names the stage,
course, type and distance and selects the same panel; and a hidden preview panel
(`buildNextStagePanelMarkup`) carries the date, course, profile (from the cache via
`getCachedStageProfile`; `enrichStageProfiles` fetches that one stage too) and a note
that results land after the finish. The card's height does not change and only one
profile is visible at a time. This replaced a separate always-visible block under the
results, which cost a full profile row and shared the expand control with the current
stage. Three placements were comped with real data —
https://claude.ai/code/artifact/2b15b13e-8da7-4973-90f3-5c5736ba0c7c — and the user chose
the chip plus the row, with the chip alone ("B") as the fallback if the row proves busy:
dropping it is deleting the `nextRow` line in `buildStageSwitcherMarkup` and nothing else.
Nothing renders once the final stage is raced or on a finished race.

*Which day it is (added 2026-09-07).* `describeLiveRaceDay(race, now)` compares the
calendar day in the host country (`getRaceLocalDate`, same zone table as the racing
hours) with the route table's dates for the last raced stage and the next one, and
returns `rest-day`, `racing-today`, `finished-today` or null. `buildStageRaceCard`
uses it on live races only: the pill reads "Rest day" on a rest day, the status line
under the title becomes a dated sentence from `buildLiveRaceDayNote` (null keeps the
old generic copy), and `buildNextStageRowMarkup` labels the row "Tomorrow" / "Today"
and adds the date. Prompted by the 2026 Vuelta's 7 September rest day, when the card
showed the previous day's stage 15 under a "Live stage race" pill and read as a stalled
pipeline. Tests pass `now` through `buildStageRaceCard(race, { live: true, now })`.
A route without dates never gets a day-specific line.

*Axes.* Gridlines and distance ticks are built twice — round metres/kilometres and round
feet/miles — tagged `data-unit-system`; the client stamps `data-units` on `<html>` and
CSS shows the matching set.

*Known gaps.* Categorised-climb markers (the race centre's PM/sprint flags) have no
reachable source. Only the Vuelta site embeds komoot; check letour.fr, letourfemmes.fr
and lavueltafemenina.es each spring — `STAGE_PROFILE_SOURCES` already lists them, so an
embed there lights up without code. Both unit systems render
into `data-unit-metric` / `data-unit-imperial`; the client swaps text and remembers the
choice in `localStorage` under `pcr-units`, re-applying it to any markup that lands later.
No source publishes categorised-climb markers or a climbing total for the non-ASO races;
the race centre (racecenter.lavuelta.es) draws them from an API its bundle obscures.

**6. Stage time gaps (added 2026-09-03).** Every stage podium row below the winner shows
the rider's finishing time and, in a small pill beside it, the gap to the stage winner.
`getStageStandingMetrics(entry, winnerSeconds)` produces the pair; `buildPodiumMarkup`
computes `winnerSeconds` from the place-1 entry when `metricContext` is `"stage"` and
hands it to `buildRiderMarkup`, which renders `.standing-gap` (time) and
`.standing-delta` (gap). Three source shapes reach it, and the rules cover all three:

| Source shape | Example | What renders |
| --- | --- | --- |
| Time and gap both given (official providers: lavuelta.es, letour.fr, Giro) | `4:31:49`, `+01:56` | Time as given; gap **recomputed from the two times** |
| Winner's time plus gaps for the rest (Wikipedia `{{cyclingresult}}`) | winner `4:12:24`, rider `+ 7"` | Time derived as winner + gap: `4:12:31`, `+00:07` |
| Times only | `31:38`, `32:42` | Gap derived as the difference: `+01:04` |

A rider on the winner's time reads `s.t.`, whether the source wrote an equal time or
"s.t." itself. A rider with neither value renders as before, name only. When the
winner's own time is missing nothing can be derived and the source values stand.
Recomputing the gap whenever both times exist is deliberate: some providers put the
*GC* gap on a stage row, and the difference of two stage times is the only figure that
cannot be wrong that way. The GC podium is untouched — leader time, then gaps — so the
two sections keep reading differently on purpose. Helpers: `parseClockSeconds`,
`formatClock`, `formatGap`. Tests: "a stage podium shows each rider's finishing time and
gap" in `test/parser-regressions.test.js`, plus the older "shows stage time separately
from cumulative GC timing" test, which now asserts the derived gap sits in its own pill.

**7. Jersey holders (added 2026-09-04).** Under the GC podium, a stage-race card lists
who leads each classification — general, points, mountains, young rider, team, plus
any race-specific column such as the Giro's intermediate-sprint or breakaway
classifications — each with a small jersey swatch in the colour Wikipedia's
`{{cjersey}}` template names in the table header. The source is the article's
"Classification leadership" table (`extractClassificationLeadership`, via
`parseWikiTableGrid`, which resolves the table's `rowspan` cells — see the parser traps
below). It is the only place Wikipedia states the points, mountains and young-rider
leaders, and every WorldTour stage race publishes one. The snapshot carries it as
`stageRace.classificationLeaders = { stageNumber, stageLabel, entries }`, each entry
`{ key, label, jersey?, rider, countryCode? }`; a team occupies the rider slot, resolved
through the same `{{UCI team code}}` map as team time trials (`collectTeamReferences`
now scans this table too), and an unresolved code is omitted rather than shown raw. The
combativity award column is deliberately left out: it is a per-stage prize, not a jersey
anyone holds. Flags come from the standings parsed elsewhere on the page or from the
official provider's GC, matched by name, because the table writes most riders as bare
links (`fillClassificationLeaderCountryCodes`, applied in the snapshot and again in
`mergeStageRaceSnapshots`).

**7a. Jersey contenders on hover (added 2026-09-10).** Resting the pointer on a
classification in that list opens a card with that classification's top five — five
teams, on the team classification — the leader of it first, not five riders chasing it. The source is the
"Classification standings" section below the leadership table, which every stage-race
article carries: one top-ten table per classification, written either as a captioned
wikitable ("Points classification after stage 17 (1–10)") on the Grand Tours or as a
`{{cyclingresult}}` block ("Final points classification (1–10)") on the smaller races.
`extractClassificationStandings` reads both and keys the result the way
`parseClassificationLeadershipColumn` keys the leadership columns, so a table joins its
jersey by key alone — including one-off columns such as Pologne's "Active rider".
`attachClassificationContenders` hangs it on the entry as `contenders =
{ stageNumber | final, metric, metricLabel?, entries }`; a classification with no table
(Pologne's "Polish rider", the Giro's "Red Bull KM") keeps its plain entry and no card
opens. Since 2026-09-12 the jersey swatch beside the label is a second way onto the same
card (`data-jersey-contenders-swatch`, resolved onto the label by `bindHoverCards`'s
`resolveTarget` so moving between the two keeps one card open), and the label fills its
row's height under `(hover: hover)` — the user found the word alone too small a target
in the stack. Four things this has to get right:

- **The metric is not always points.** Points and mountains are scored in points, the
  general, young rider and team classifications in time, and the Giro's breakaway
  classification in kilometres. `readClassificationMetric` takes it from the table's own
  last column heading (`points=yes` on the `{{cyclingresult}}` start tag), and the card
  prints the unit it was given. Do not relabel a time gap as a point total.
- **The standings trail the leadership table by a stage.** On a live evening Wikipedia
  updates the jerseys first, so the card is dated by its own caption ("Top five after
  stage 17") while the list above it says stage 18. That is correct, not a bug.
- **The newest table wins.** The smaller races write "General classification after Stage
  N" under every stage before the final table; reading the first one met left the Tour
  de Suisse and the Tour of Britain Women showing their stage 1 standings all season.
- **The card hangs off the classification, not the rider.** The rider's name already
  opens the rider card; the classification carries `data-jersey-contenders` and a
  `<template>` with the card's markup, cloned on hover by `bindJerseyContenderCards`.
  Both cards are `bindHoverCards`, which is the old rider-card body factored out — same
  frame, same 250ms delay, same fixed positioning, pointer devices only.

Two parser bugs in shared code were in the way and are fixed:
`extractCyclingResultBlocks` required the parameter list to follow `start` immediately,
so `{{cyclingresult start |title=…}}` matched nothing and every block on the 2026 Giro
d'Italia Women and Vuelta a Burgos Feminas pages — 18 of them — was dropped; and its
`title=` argument is greedy to the end of the parameter list, so a parameter written
after it (`|points=yes`) landed inside the title and `cleanWikiText` then turned the
pipe into a comma. Both have regression tests.

The merge keeps whichever side has the field — only Wikipedia does — bounded by the
same calendar rule as the GC (`isStageRaceProgressPlausible`). Unlike the GC, a list one
stage *behind* the official provider is kept and labelled "Jersey holders after stage N"
rather than dropped, because it contradicts nothing above it; when the stages match it
reads simply "Jersey holders", and "Final jersey winners" on a finished race.
`buildJerseyHoldersMarkup` renders it inside `.gc-columns` beside the podium. The card
is a size container (`container-type: inline-size`) and three widths of it get three
layouts, all measured on the card's content box:

| Card content width | Layout |
| --- | --- |
| under 340px (a phone's single column) | Stacked beneath the podium, one row per jersey: swatch, label, rider |
| 340px to 640px (the usual three-across grid) | A second column under 10rem wide beside the podium, label above each name, so the section keeps the podium's height |
| 640px and up (a lone live race, whose card spans the page) | Both columns bounded (30rem podium, 22rem jerseys) and packed to the left, with the one-row layout |

The third rule exists because the first release of the side-by-side layout let the podium
column take all the spare width, which on a full-width card pinned the jersey column to
the far edge with a gap between — the user spotted it on production the same afternoon.
Names in every layout flow inline rather than as the podium's flex row, so a flag never
sits alone on a line above a wrapped name. History: the stacked block shipped first
(71abef8), the user asked for it beside the overall leaders "instead of taking up more
row space" (d9ac1d5), and the wide-card fix followed (b6a1dfb), all on 2026-09-04.
Rendered checks were done with headless Chrome at 330px, 430px and 1400px card widths.
`buildJerseySwatchMarkup` draws the jersey, with
polka dots on white for the `polkadot` variants and an outlined, unfilled jersey for any
colour name outside `JERSEY_FILL_COLOURS` — generic on purpose, not a guess. Tests:
"extractClassificationLeadership resolves rowspan columns…" (real 2026 Vuelta fixture,
stage 3 cancelled, every column spanned), "parseWikiTableGrid expands rowspan and
colspan…", "mergeStageRaceSnapshots keeps the jersey holders…", "buildStageRaceCard lists
the jersey holders…". Not yet read: the official providers' points/mountains tables
(lavuelta.es and letour.fr publish them), which would update a few hours before Wikipedia
on a live evening.

### Rendering contract worth preserving

- The strip lists the **whole route**, with unraced stages disabled, so card height
  does not change as stages complete.
- A gap *below* the current stage means a stage with no rider result, not one that has
  not happened; the two carry different `title` text.
- `parseTotalStages` counts a prologue as a stage, so a prologue race renders one fewer
  numbered chip or the strip grows a phantom.
- The GC section always shows the race's **current** overall regardless of the selected
  stage, labelled with the stage it reflects. This is a deliberate choice, not an
  oversight — revisit it only if asked.
- Both click handlers are delegated at `document`, so markup swapped in by
  `/api/race-stages` or revealed by "Load more races" works without rebinding.
- Any control carrying `data-stage-target` selects a panel — the strip's chips and the
  "Up next" row alike — and the active state follows the *target*, so the row lights
  chip 13 and chip 13 lights the row. Only `role="tab"` controls get `aria-selected`.
- The strip renders `stageRace.stages` and nothing else, so anything the card should
  show has to be *in* that array. `latestStage` is not consulted separately.
- A team time trial occupies the rider slot with the team's name, so it renders through
  the same podium markup with the team's flag. Nothing downstream needs to know.
- A stage podium shows every rider's finishing time *and* gap to the winner
  (`getStageStandingMetrics`, added 2026-09-03). Sources rarely give both — an official
  provider does, Wikipedia gives the winner's time and everyone else's gap — so the
  missing half is derived from the winner's time, and a rider on the winner's time reads
  "s.t.". The gap is always recomputed from the two times when both exist, which is what
  keeps a provider's *GC* gap from leaking into the stage row. The GC podium is
  unchanged: leader time, then gaps.

## Where Cold Start Actually Goes

Profiled 2026-08-23. Read this before optimizing anything on the warm-up path — the
numbers in `/api/races?debug=1` were misleading until this session, and the previous
revision of this file repeated one of them as fact.

**`nationalChampionshipsMs` used to be meaningless.** The promise is started early and
awaited last, and the elapsed time was taken *after* the await, so it reported how long
the rest of the build took rather than its own work. It read `14462ms` against a
`13112 + 1349 = 14461ms` critical path. `loadNationalChampionships` actually completes
in **35-207ms**; the Cyclingnews page it fetches returns in under 0.5s. It is now timed
on settle and reports the truth. If you see a suspiciously round agreement between a
timing field and the sum of the others, suspect the same pattern.

**`recentStandingsTargetCount` undercounts.** It reports
`homepageRecentStandingsTargets.length` (6), but the work runs over
`homepageRecentEnrichTargets`, which also includes every multi-day recent candidate —
14 races in practice.

**The real cost is official-provider lookups on finished races.** Timing
`loadOfficialStageRaceSnapshot` across those 14 races, serially:

```text
  11037ms  2026 Giro d'Italia Women
   1279ms  2026 Giro d'Italia
    660ms  2026 Tour Auvergne-Rhône-Alpes
    565ms  2026 Tour de France
    400ms  2026 Tour de France Femmes
     <2ms  the other nine
```

One race is 79% of it. `giroditaliawomen.it` is simply a slow origin, and the provider
makes three *sequential* requests to it — rankings (5.7s), stage rankings (2.4s, and it
404s), video hub (3.1s). That race finished on 7 June 2026 and its result has not
changed since, yet every cold start pays for it again.

**How it was fixed, and why the obvious fix was wrong.** The first attempt was the one
recommended in an earlier revision of this section: skip the official provider for
long-settled races and enrich them in the background, the way
`enrichLocationsInBackground` works. It was measured and rejected. Official providers
are *not* merely a refinement for a finished race — Wikipedia alone leaves several
Grand Tours one to three riders deep (Tour de France's final GC dropped from five names
to three and its stage result to nothing), and Tour de Romandie fell out of
`finalizedStageRaces` entirely, which is the exact silent-disappearance failure the
comment above `homepageRecentEnrichTargets` warns about. Fourteen of sixteen races
degraded on first paint.

What works instead is a **time budget**, `OFFICIAL_SNAPSHOT_BLOCKING_BUDGET_MS` (2500).
Providers stay on the blocking path; one that overruns stops blocking and is applied by
`applyLateOfficialSnapshots` when it lands. Because the overrunning lookup is handed
back rather than re-issued, a slow origin is still asked only once per build. Only the
Giro d'Italia Women lookup trips the budget, so exactly one card is briefly thin instead
of fourteen, and it repairs itself within seconds.

Measured: homepage readiness went from ~18.7s to ~5.7s (median of three runs each),
`recentStandingsMs` from 14413ms to ~2700ms. A full `/api/races` diff of the converged
state against the pre-change baseline is byte-identical, times and gaps included.

Two things to preserve if you touch this. `OFFICIAL_SNAPSHOT_TIMED_OUT` is a distinct
sentinel because most races have no provider and resolve to `null` instantly — using
`null` for both would put every such race on the late list and make the budget look
like it was tripping constantly. And `applyLateOfficialSnapshots` merges through
`selectPreferredStageRaceSnapshot` rather than assigning, so a late result never
overwrites something better that Wikipedia already supplied.

## Known Sharp Edges

- `server.js` is large. Most changes should still be narrow, but cross-file refactors need extra caution because unrelated behavior is co-located.
- External data drift is the dominant bug source.
- Wikipedia live race pages often update unevenly; stage results and GC can be out of sync.
- Wikipedia page *shape* varies as much as page freshness. Grand Tours, smaller stage races, and women's editions of the same race do not all use the same templates or table layouts, and a shape the parsers do not know about yields an empty race rather than an error. See "Parser Traps Learned On 2026-08-06".
- A stage race's per-stage history depends on the main article's route table, which is not uniform: a team time trial has no rider winner (2026 Tour stage 1), and some tables drop the final stage row (2026 Tour stage 21). Both recover when the companion stage articles are read; until then those chips render disabled.
- Per-stage finish videos are fetched at build time for live races only; companion stage articles are read for live and finished races alike. A finished race that is still winner-only has no companion article on Wikipedia — see "Stage Results Feature Map".
- Official race pages can expose current data under stale metadata or stale URLs.
- Article scoring is heuristic and division-sensitive; changes can improve one race and hurt another.
- `BUILD_INFO` now reads Railway's `RAILWAY_GIT_COMMIT_SHA` when present and falls back to a hardcoded marker otherwise. Check `source` in the payload: `railway-env` is the live commit, `hardcoded-fallback` means you are looking at a local run or the env var went missing.
- Retired section support still exists as hooks and archived config, but there are no active deferred groups.
- YouTube finish-video search and official providers (e.g. letour.fr) depend on third-party page structure; expect occasional parser drift there too.
- There is no schema validation for upstream payloads.
- Corrected 2026-09-26: the hero does not overflow a true 390px viewport; the earlier note came from headless Chrome's 500px minimum window. The National Championships almanac grid does overflow at 390px and is clipped (assessment finding A2), not yet fixed.
- Every save from the site editor is a commit to `main` and therefore a Railway redeploy (about 30s, then a short warm-up during which `/` serves the warm-up page and `/api/homepage-data` returns 202). Two saves within seconds can make the second one hit a GitHub 409; the server re-reads the file version and retries once.
- When you push, another commit may already be on `origin/main` from the site editor. Always `git pull --rebase origin main` before `git push`; a hand edit to `data/release-notes.md` can conflict with an edit the maintainer made on the site.
- CI runs `npm test` on every push and pull request (`.github/workflows/test.yml`), including the headless-Chrome smoke test in `test/browser-smoke.test.js`, which drives the real client script (stage chips, km/mi toggle, expand control, late-markup observer, the refresh button against a stubbed fetch) and skips only when no Chrome is found. `package.json` pins `engines.node >= 20`. There is still no lint script, formatter config, or lockfile — the app has no dependencies, so a lockfile would be empty.

## The Journal

The dated sections that used to follow here ("Open Threads" with its "Added <date>"
entries, the measured freshness and source review of 2026-09-05, the parser traps of
2026-08-06 and 2026-08-23, and every "Process Lessons From The <date> Session") are in
`handoff-journal.md` since 2026-09-27, in their original order. Search there for a
date or a function name when a rule in `AGENTS.md` cites one of them. A session's
closing notes go at the end of the journal; this map changes only when the shape of
the project does.

## Next Session Starts Here (written 2026-09-27, 01:30 UTC)

The state of play at the close of the 2026-09-27 session, which took every item of
the queue written at 00:00 UTC and then A10 at the maintainer's request (commits
1ac9f2f → 6f44500, all on `main`, each deploy verified live).
`assessments/2026-09-26/status.md` is the complete list; closed today: R7, S8, X2,
L8, P5, A13, F2/F3/F23, S4, S9, M7, M8, A10; partial: S3 and the CSP. The session's
notes are the last section of `handoff-journal.md`. Start by reading this section,
then the status file, and take the queue below in order.

**First, on 27 September (race day):** the Worlds men's road race is 09:00–15:40
Montréal (13:00–19:40 UTC). Nothing to push in those hours. Check in the evening: the
hero's status line should read "next: Worlds men's road race, today" during the day
and the headline "X wins the men's road race" after the finish; the card should carry
the podium from the medal summary within minutes of Wikipedia's edit
(`resultSource: wikipedia-medal-summary`), then the top five once the event page
exists (`wikipedia-event-page`). `curl -s https://procyclingresults.up.railway.app/api/data-status`
says whether the last build succeeded. If a page is wrong, check production before
local code. The last session ended at 00:45 UTC, before the race, so nobody has done
this check yet.

**Then the queue (no maintainer decision needed):**

1. **Keep the finish-video file growing.** The backlog fills at 60 a day (about 170
   to find from empty); run `npm run refresh:finish-videos` and commit
   `data/finish-videos.json` at the start of each session until
   `/api/data-status` → `finishVideos.known` stops rising (at the close of this
   session production reported 4 known, 7 lookups in this process; the file holds four). Watch for
   `finish-video-lookup-failed` in Railway's logs: it means the API refused (most
   likely the day's quota, which every deploy's fresh counter can overrun), and the
   backlog pauses an hour. If deploys stay frequent, persist the day's count or lower
   `FINISH_VIDEO_BACKLOG_LOOKUP_LIMIT`.
2. **Bytes, after A10.** A10 shipped on 2026-09-27 (finished cards fold their
   jerseys and stage results, GC open; the maintainer chose the default from a comp),
   which fixes the height but not the bytes: the folded stage panels still travel
   with the page (555 KB after S3, target 400 KB; 13 cards, the true count since
   the deploy checker and `compose.js` learned to count `<article>`s rather than
   every `race-` id, which the news drawers and now the panels share). The next lever is to
   serve a finished card's folded stage results on first open (`/api/race-stages`
   already renders a switcher; the folded panel could hold only the strip until the
   header is tapped). Re-measure S2 (first rider name on a phone) after that.
3. **The CSP, from report-only to enforcing.** The results page sends
   `Content-Security-Policy-Report-Only` (`buildContentSecurityPolicy`: the client
   script by hash, the analytics host, `'unsafe-inline'` styles, `report-uri
   /api/csp-report`) since 2026-09-27 at 01:00 UTC. Read Railway's logs for
   `csp-report` lines over a few days of real browsers; if none, switch the header
   name to `content-security-policy`, then give the about and warm-up pages the same
   treatment (their scripts are still inline template literals).
4. Smaller items from the register: S7 (parse the rider index only on hover
   devices), C8 (per-panel unit toggles), A14's remainder (skip link, heading depth,
   `aria-hidden` on icons), X12 (cap upstream body size before parsing), L7
   (wikitext through the API instead of `action=raw`), R12 (a test for the backoff),
   M6 (the clock-dependent-test lint), C9 (re-measure after S3).
5. Item 27, the ASO provider parameterisation, only when one of them next needs a
   change. The deferred-group machinery (`/api/competition-section`,
   `DEFERRED_COMPETITION_GROUP_IDS`) is still unused; S3 built its own fragment
   endpoints beside it.

**Waiting on the maintainer** (section 5 of the report, still open): the ASO email
about the rankings partials; nationals from Wikipedia instead of Cyclingnews;
Railway's wait-for-CI setting; the GitHub token's scope and who else can reach
Railway; an uptime monitor pointed at `/api/data-status`; Worlds results ordering
(men-first stays until told otherwise); the committee's one line on the results
page; analytics access; komoot/ASO about the derived traces. Discoverability is
deliberately last. The YouTube key question is settled: the key is set and the
search page is no longer read.

**Dates to keep:** the season close-out note goes live on 19 October 2026 (add its
release note that day); the site moves to 2027 about 9 January 2027 (check the
nationals source, the Worlds parser and the cards that week); the next monthly
assessment is due 27 October 2026.

**How the last session worked, for the next one:** four parallel agents in isolated
worktrees (feeds and winter states, ETag and dedupe, fonts, Greece archive), each
owning named regions of `server.js`, merged onto `main` one at a time while the
orchestrator did the finish-video work, then M7 and S3 alone. The agents cost 100 to
175 thousand tokens each and the spend limit did not bite. Every branch appended
tests to `test/parser-regressions.test.js`, and on two of the three conflicting
merges git dropped the shared closing `});` at the seam: run `node -c` on the test
file after every merge and put the brace back. `git pull --rebase` with local merge
commits replays and re-conflicts them; fetch, confirm origin has not moved, and push.
The agents' worktrees and `worktree-agent-*` branches were merged and deleted at
the close. The second half of the session was the maintainer's own request (A10),
done the standing way: build it, render the real card in both states at phone and
desktop widths, ask which default to ship, push on the answer. After pushing,
`npm run verify:deploy`.

## Suggested First Checks For A New Agent

Run these before making changes (and read `DATA-SOURCES.md` before changing anything
that fetches — its table and review log must stay true):

```bash
git status --short
git branch --show-current
git log --oneline --decorate --max-count=5
git worktree list --porcelain
rg --files -g '!node_modules' -g '!.git'
```

If the report is "the site is wrong" rather than "this code is wrong", establish which
instance is being described before reading any parser:

```bash
git log --oneline origin/main..HEAD          # unpushed work means production is behind
curl -s https://procyclingresults.up.railway.app/api/homepage-data | head -c 200
```

Then choose the smallest relevant read path:

- Product scope or docs: `AGENTS.md`, `README.md`, `handoff.md`
- Parser or data issue: search `server.js` for the target race/provider, then inspect relevant tests
- National Championships issue: search `NATIONAL_CHAMPIONSHIP` in `server.js`
- Finish video issue: search `RACE_FINISH_VIDEO_URLS`, `getRaceFinishVideoUrl`, and `getStageFinishVideoUrl`
- Rider link or hover card issue: search `getRiderProfileUrl`, `RIDER_PROFILE_URLS`, `buildRiderSeasonIndex`, and `bindRiderCards`; verify PCS addresses only from a browser (`scripts/pcs-rider-links.browser.js`)
- World Championships issue: search `WORLD_CHAMPIONSHIPS`, `parseWorldChampionshipEliteEvents`, and `enrichWorldChampionshipResults`; the 2026 event pages were first expected to exist on 20 September 2026
- Stage results / stage strip issue: search `buildStageHistory`, `buildStageSwitcherMarkup`, and `extractStageArticleTitles`
- Stage profile issue: search `buildStageProfileMarkup`, `enrichStageProfiles`, `extractRouteStages`, and `STAGE_PROFILE_SOURCES`
- Article issue: search `buildRaceArticleQueries`, `scoreRaceArticle`, and `selectRaceArticles`
- Performance or cold-start issue: inspect cache loaders plus `scripts/benchmark-load.js`

## Handoff Prompt For Another AI

Use a prompt like this:

```text
Project: /Users/tcs16/AgenticAI/ProCyclingResults

Read AGENTS.md first, then README.md and handoff.md. Treat README.md as durable architecture and handoff.md as the current cross-reference/audit snapshot. Verify git status, branch, remote refs, and worktrees before editing. The active product scope is Men's WorldTour, Women's WorldTour, and National Championships. ProSeries and Europe Tour are retired and archived unless explicitly requested. Keep changes narrow, preserve the no-dependency Node architecture, and run node -c server.js plus npm test for code changes.

Task: <task here>
```

