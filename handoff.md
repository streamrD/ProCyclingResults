# Pro Cycling Results AI Handoff

Updated: 2026-09-07 (live-card day line and Rest day pill; 2026-09-06 refresh button and `/api/data-status`; 2026-09-05 live-race timer, news line, source review; 2026-09-04 season calendar, championships almanac and map, editable pages, share previews)

This file accompanies `README.md` and `AGENTS.md`. Use it as a cross-reference and audit snapshot for handing the project to another AI or engineer.

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
- Tour of Greece
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
(with a "New" badge, `data-season-open`) or a `#season-calendar` link reveals it and
scrolls to it, and a "Close calendar" button in its header hides it again. The product
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

Known gap: the hero and page already overflow a 390px viewport in headless Chrome on
production; this section did not cause it and does not fix it.

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
├── tour-of-greece-results-2026-stage1.html
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
`test/browser-smoke.test.js` runs a second Chrome pass at 390px to guard this. A stage without one gets the `STAGE_TYPE_GLYPHS` icon for its type — the
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

## Open Threads

Live as of 2026-08-23. Verify against production before acting — these move.

- **`2026 Tour of Britain Women` renders empty.** Live race, `completedStages: 0`, no
  stage result and no GC, `stages: []`. Its Wikipedia page is unfilled, so there is
  nothing to parse; this is not caused by the stage-results work. Same shape as the
  Femmes outage, so if the page is still bare well into the race, check whether an
  official provider exists for it before touching shared parsers.

- **One provider still needs ~11s on a cold start.** The Giro d'Italia Women lookup
  trips the blocking budget on the first build and is applied late. *Resolved for warm
  rebuilds on 2026-09-05:* `loadOfficialSnapshotThroughCache` keeps settled races'
  official snapshots for six hours, so it is asked once per process rather than every
  refresh. The cold start still pays it once.
- **Per-stage video backlog fills 4 per refresh.** Invisible during a race, since one
  stage arrives per day. Only noticeable if the process restarts late in a Grand Tour
  with a cold `finishVideoCache`.
- **Finished races get no per-stage videos at all.** `enrichStageFinishVideos` is gated
  to live races. `/api/race-stages` could resolve them on demand too, at the cost of
  endpoint latency; not done because nobody asked.
- **`BUILD_INFO` was not touched** by this work and remains manual.

### Added 2026-09-04

- **Championship dates.** Confirmed dates exist for two federations. Wikipedia's
  "2026 national road cycling championships" page appears to list dates and venues per
  federation; if its table checks out, a small parser there would fill the schedule
  strip and let championships appear on the season calendar. Unverified.
- **Championships map on phones.** Hidden under 720px; the grouped list stands alone.
  A tap-friendly version was not attempted.
- **Phone-width overflow** (see Known Sharp Edges) predates today's work.
- **Season calendar teaser.** The compact strip was cut; `buildSeasonCalendarSvg`
  keeps its `compact` option in case a small under-hero teaser ever earns its place.
- **Link previews are cached** by Slack, iMessage and X. After changing an image,
  expect old previews to linger unless the platform's debugger is used.

### Added 2026-09-05

- **Racing-hours time zones are a short table.** `RACE_HOST_TIME_ZONES` covers the
  WorldTour host countries seen this season; anything else falls back to Europe/Paris.
  A race in an unlisted far-away country (a hypothetical Tour of Colombia is listed;
  a Tour of Taiwan is not) would poll on Paris hours. Add the code when a race appears.
- **`liveRaceDataTtlMs` in `/api/races?debug=1` is the constant, not the clock-aware
  TTL.** `raceDataCacheAgeMs` advancing at ~65s inside racing hours and ~15min outside
  is the real signal.
- **The refresh timer serves the active (non-deferred) cache only.** The deferred
  caches are legacy restoration hooks with no live groups, so nothing is lost, but if a
  deferred group ever comes back it will not self-refresh.
- **`wikiRawCache` is unbounded within a day.** It prunes titles unused for 24h at each
  index refresh; a season's worth of tracked pages is a few MB of wikitext, which is
  fine on Railway's memory, but it is worth remembering if page tracking ever widens.
- **News-line prefetch on a page of 26 cards** issues one `/api/race-news` request per
  card as it scrolls within 240px; each is one Bing sweep per race per cache window.
  Fine at current traffic; a busy day with a cold article cache would fan out to Bing.
- **`SOURCE_CONTACT` is set on Railway** (confirmed `configured` on 2026-09-05). It is
  deliberately not printed in `DATA-SOURCES.md`; the maintainer can add it there if a
  public address is wanted.
- **The "Race Coverage" block is archived**, not deleted: `archive/race-coverage-block.js`
  holds the builders, endpoint and client code with a header explaining what was lost
  (Refresh paging, summaries). Do not restore it unless asked.
- **The news-line comps** live on a design canvas
  (https://claude.ai/code/artifact/5b2f654d-0e7d-43a2-a31e-bb4d203ca07a): page 1 the
  chosen line under the GC, page 2 the four directions A–D at desktop and phone width.

### Added 2026-09-07 (Worlds session)

- **What shipped.** The UCI Road World Championships (Montréal, 20–27 September 2026)
  now have their own section below the two WorldTour sections: upcoming cards for the
  four elite events (men's first), then a Results block as each event's Wikipedia page
  fills in. Commits `73f1ccc` (schedule + upcoming cards) and `4a52625` (results,
  finish video, news, race-day pacing). Both verified on production. The user chose
  "Option B, men first" from a comp; the canvas with both options and the results
  block rendered from the 2025 Kigali pages is
  https://claude.ai/code/artifact/9d6216f4-92dd-48b1-806c-34feb554a6fc.
- **Why it was missing.** The race list comes only from the two WorldTour season
  tables on Wikipedia, and the Worlds are a UCI championship, not a WorldTour event.
  Production went from GP de Montréal (13 Sept) straight to Il Lombardia (10 Oct).
  The project started in April 2026, so there was no earlier Worlds to learn from.
- **The one thing left to check.** The 2026 event pages returned 404 on 2026-09-07,
  so `parseWorldChampionshipEventResult` has only ever run against the 2025 layout
  (fixtures under `test/fixtures/uci-road-world-championships-2025-*`). On the
  evening of 20 September, confirm the two time trials appear in `recentResults` on
  production; if they are still "Today" upcoming cards, fetch the 2026 page's wikitext
  and run it through the parser. Everything else — the "Today" state, the ten-minute
  miss retry, the live cadence on race days, the video filter — is covered by tests.
- **Scope decisions the user made.** Elite events only (no under-23, junior or mixed
  relay). Upcoming cards, then results, in a separate section rather than inside the
  WorldTour lanes. Men's cards before women's. Not on the season calendar.
- **Where the details live.** "World Championships" under "Data Source Cross-Reference"
  above; the scope line in `AGENTS.md`; two entries in `data/release-notes.md`; two
  review-log lines in `DATA-SOURCES.md`.

### Added 2026-09-07, later (rider hover card)

- **Phase two of rider links, compact form** (chosen from comps:
  https://claude.ai/code/artifact/78d3c7d0-757b-48e8-b1e9-883c6da2ad51). `buildRiderSeasonIndex`
  runs in `buildRaceData` over `allRaces` (season-table podiums, complete for the
  year, Worlds included) and the stage histories of the races in the payload (stage
  wins, so only what the page holds), keyed on `foldRiderKey` (accent-folded,
  lower-case) because the ASO provider writes "Tadej Pogacar" and Wikipedia "Tadej
  Pogačar". The payload carries it as `riderSeasons`; `buildRiderSeasonsScript`
  embeds it as `<script type="application/json" id="rider-seasons">` before the
  client script, with `<` escaped. Each rider link carries `data-rider-key`.
- **Tally shown:** "N wins" is `wins + stageWins` (one-day, overall and stage wins together, as PCS counts), "N podiums" is `podiums + stagePodiums` on the same basis (a stage second place counts; Alessandro Romele's did not until 2026-09-08). The index keeps race and stage counts apart in case that changes.
- **Client:** `bindRiderCards` (pointer devices only, `(hover: hover)`): 250 ms
  hover or focus opens a fixed-positioned `.rider-card` on the body (the result
  cards clip overflow), flipped above the name when it would not fit below; mouse-out
  from link and card, Escape, scroll and resize close it. The card's PCS link is the
  name's own href; Wikipedia is the go-to-title search for the name. Rider names with
  no entry get "No WorldTour podium on this site this season." The client script must
  stay free of `${` (smoke test), hence the string concatenation.
- **Wikipedia link:** `parseAthleteDetails` now returns `pageTitle`, the cell's own
  link target ("Ben Healy (cyclist)"), and `buildStandingEntry` keeps it on the entry;
  season rows carry `winnerPageTitle`/`secondPageTitle`/`thirdPageTitle`, the Worlds
  parsers carry it too. `buildRiderSeasonIndex` records a `wikiTitle`
  (podiums, stage rows, top fives and GC rows all count; a top-five-only rider gets a
  title and a zero tally) — the first title it met, until 2026-09-08 made it the one
  the page links most, which is not the same thing for a rider Wikipedia has renamed. The card links to the article when a title is
  known and to Wikipedia's go-to-title search otherwise, which is the case for rows
  that arrive from an official provider (plain names) for riders who never appear in
  a Wikipedia-sourced row.
- **Not built:** the race list under the tally (the "full" comp).

### Added 2026-09-08 (one spelling per rider)

- **The problem the card exposed.** The Vuelta's general classification comes from
  the organiser's rankings provider and its stage tables from Wikipedia, and the two
  name a rider differently. `foldRiderKey` folds accents but not surnames, so
  "Enric Mas Nicolau" (GC) and "Enric Mas" (stage results) were two entries in
  `riderSeasons`. The GC row's `data-rider-key` pointed at the empty one, and the
  hover card told the race leader he had no win or podium this season while the same
  page had him winning stage 9. Seven riders were split that way in the 2026-09-08
  payload; the worst, Isaac del Toro, was hiding 6 wins and 11 podiums.
- **`mergeRiderNameVariants`** joins keys that are one name plus a single extra name,
  matched as a subsequence sharing a first or last token, so `enric mas` ⊂ `enric mas
  nicolau` and `oscar onley` ⊂ `edgar oscar onley` both catch (the second position was
  added by the evening's pass below, along with joining on a shared article title).
  Grouping is union-find (`groupRiderNameVariants`) so a three-spelling chain lands in
  one group.
  The merged tally is written back under **every** spelling, which keeps the client
  lookup a plain key hit and means a page cached before the fix still resolves. The
  rule needs at least two tokens and a matching first name, so "Juan García" and
  "Juan" never join.
- **`pickRiderSpelling` + `applyCanonicalRiderNames`** settle what the page prints.
  `buildRiderSeasonIndex` now counts every spelling it meets per key and picks one:
  the Wikipedia article title, then the spelling that kept its accents, then the one
  the page prints most. `applyCanonicalRiderNames` runs in `buildRaceData` before
  anything renders and rewrites the rows the race itself named — stage standings and
  `stage.winner`, `generalClassification.standings` and `.leader`,
  `classificationLeaders.entries`, `route[].winner`, `resultStandings`. Season rows
  are deliberately untouched: Wikipedia wrote them and they are the spelling this
  settles on. 74 rows changed on the day it shipped, leaving 0 riders of 280 spelled
  two ways.
- **What the article-title rule decides.** It cuts both ways and that is the point:
  Wikipedia keeps "Tobias Halland Johannessen" and "Derek Gee-West" (the longer
  names) and keeps "Enric Mas", "Isaac del Toro", "Magnus Cort", "Paula Blasi" and
  "Katarzyna Niewiadoma" (the shorter ones). A "prefer the shortest" heuristic would
  have got Gee-West and Johannessen wrong. Note that Niewiadoma races as
  Niewiadoma-Phinney; the article title we hold wins over the racing name, which is a
  choice, not a fact. A disambiguated title ("Ben Healy (cyclist)") matches no row and
  falls through to the next rule.
- **Also settled by the same pass:** six riders split by accent or casing alone, where
  the provider flattens what Wikipedia keeps — Tadej Pogacar, Primoz Roglic, Anna Van
  Der Breggen, Niamh Fisher-black, Kim Le Court Pienaar. Folding made those one entry
  in the index already; it never made them one name on the page.
- **Left alone on purpose:** teams in a team time trial row and a route table's
  "Stage cancelled" cell are not riders, never enter the index, and so are never
  renamed. Both are asserted in the tests.
- Tests: "a rider spelled with an extra surname in the GC keeps one tally" and "one
  spelling of a rider's name reaches every table on the card", both in
  `test/parser-regressions.test.js`, with `buildCanonicalRiderNames` and
  `applyCanonicalRiderNames` exported through the harness.
- **Verification trap that hid the rest.** A sweep grouping rendered names by
  `foldRiderKey` cannot see this class of split, because the two spellings fold to
  different keys — which is the whole reason `mergeRiderNameVariants` exists. The
  first "0 riders spelled two ways" check was blind to exactly the case it was meant
  to prove. **Group rendered names by PCS address** (`getRiderProfileUrl`), which is
  one per rider however a name folds. Doing that found three more defects:
  - `wikiTitle` took the **first** article title it met, not the one the page links
    most. Wikipedia links a rider under more than one title after a rename, so
    Niewiadoma-Phinney settled on a title carried by two rows over one carried by
    sixteen. `pickMostLinkedTitle` now decides.
  - Riders are also joined when **two spellings link the same article**, the only
    signal that catches a shortened first name ("Kim" beside "Kimberley"
    Le Court-Pienaar) — no name-shape rule can. A title with a digit in it is a
    mis-parsed link target and joins nobody.
  - The extra name can sit at the **front**, not only behind: "Edgar Oscar Onley",
    "James Matthew Brennan". `isRiderNameVariant` accepts a shared first *or* last
    token. Four more riders had been splitting their season two ways.
- **Season rows are settled too, and the reasoning for holding them back was wrong.**
  The first pass skipped `race.winner/second/third` on the theory that Wikipedia wrote
  them and they were already the settled spelling. Its season tables carry "Anna Van
  Der Breggen" and "Niamh Fisher-black" over stage tables that have both right, so
  three riders were printed two ways with the rename reaching half the page.
- **`applyLateOfficialSnapshots` has to re-settle what it lands.** It replaces
  `race.stageRace` and `race.resultStandings` wholesale *after* the page is built, so
  a provider spelling overwrote a settled one and survived two rounds of fixes. The
  index is now built before the late lookups are wired up and handed to them; each
  snapshot re-settles the race it lands on. `stageRace.latestStage` carries its own
  copy of the last stage's standings and is walked as well. **Anything that mutates a
  race after `buildRaceData` returns must go through `applyCanonicalRiderNames`, or it
  will undo this.**
- **Verified:** 288 riders on production, 0 rendered under more than one name, checked
  twice with the late snapshots landed.
- **Coupling handled:** `getRiderProfileUrl` matches `RIDER_PROFILE_URLS` on the folded
  key as well as the exact name, so settling a spelling cannot silently orphan a
  hand-checked address; a folded key claimed by two different addresses is dropped
  rather than guessed at. PCS addresses still cannot be checked from the server —
  Cloudflare blocks it; use `scripts/pcs-rider-links.browser.js` from a PCS tab.
- **Left open:** nothing on the page, but the rule that decides *which* name wins is
  worth knowing: the most-linked Wikipedia article title, then the spelling that kept
  its accents, then the one the page prints most. That is why Niewiadoma-Phinney and
  Gee-West keep their longer names while Enric Mas and Magnus Cort keep their shorter
  ones. If the site should prefer the name a rider races under over the one Wikipedia
  files them under, that is a one-line change in `buildCanonicalRiderNames` and a
  product decision, not a parser one.

### Added 2026-09-07, later (cancelled stages)

- **A cancelled stage in the route table** ("Stage cancelled{{efn|...}}" in the winner
  column, 2026 Vuelta stage 3) was read as a rider called "Stage cancelled" and, once
  rider links shipped, linked to a PCS search for the phrase. `extractRouteStages`
  now returns `winner: null, cancelled: true, cancellationNote` for such a row
  (`parseRouteStageCancellation`, `ROUTE_STAGE_CANCELLED_CELL`), the route entry
  carries both, the strip draws a struck-through chip with the reason as its title,
  and `getNextRouteStage` skips it. `isPlausibleRiderName` rejects the phrase too,
  so the same words from any other source never become a rider. Fixture:
  `test/fixtures/vuelta-a-espana-route-cancelled-stage3.wikitext`.

### Added 2026-09-07, later (rider links)

- **Rider names link to ProCyclingStats** through `buildRiderLinkMarkup`, used by
  `buildRiderMarkup` (podiums, stage winners, GC rows, jersey holders) and by the
  national championship podium. Direction A ("Quiet": same ink, dotted underline) was
  chosen from three comps: https://claude.ai/code/artifact/d1323357-44d7-47cf-af26-2bc18bf45ac3.
- **Direct addresses, checked from a browser.** PCS addresses are name slugs
  (`buildRiderSlug`: accents folded, every non-letter a hyphen, so "ben-o-connor"),
  right for about five riders in six. The rest carry a second surname there
  ("juan-ayuso-pesquera") or a spelling of their own, and PCS blocks our server
  (Cloudflare 403), so nothing can be verified from code. On 2026-09-07 every name on
  the site (517) was checked from the user's Chrome with
  `scripts/pcs-rider-links.browser.js` (paste into the console on any PCS page, call
  `checkRiderLinks(names)`); 86 names missed or landed on a differently-titled page; 51 got a corrected direct address in `RIDER_PROFILE_URLS`, 22 that PCS search could not place (small-federation champions, source oddities, three team names) are mapped to the search page, and the rest were the same rider under a longer title. A rider new
  to the site gets the slug guess. A miss shows PCS's own "Page not found", so when a
  reader reports one, add the address to the map. Team names (team time trials) and
  lone surnames go to the PCS search page (`isDirectRiderLinkCandidate`). To list
  today's names: walk `/api/races` and `/api/homepage-data` for every `rider`,
  `winner`, `second`, `third`, `champion` and `podium[]` string. Phase two (a "season so far" line built from our own
  cards, plus a Wikipedia link from the wikitext's rider link, which `cleanWikiText`
  currently discards) was discussed and not started.

### Added 2026-09-06

- **The refresh button compares `fetchedAt` only.** Late official snapshots
  (`applyLateOfficialSnapshots`) are folded into the cached payload in place without
  changing its timestamp, so for the few seconds between a rebuild and a slow
  provider landing, the button reports "already the latest" while a reload would in
  fact show more. Harmless during a live race (the next rebuild is under a minute
  away); if it ever matters, stamp a `lateAppliedAt` on the payload and include it in
  `/api/data-status`.
- **`/api/data-status` is unauthenticated and cheap by construction.** It reads
  through `loadRaceData`, which returns the cached payload immediately and at most
  starts the background rebuild a page view would have started. Keep it that way: a
  variant that forced a rebuild would hand every visitor a lever on our sources and
  break the cadence promised in `DATA-SOURCES.md`.
- **The refresh-button comps** live on a design canvas
  (https://claude.ai/code/artifact/9ed1996b-2344-46a1-b37a-04f3fa55347f): A inline
  link, B pill beside the timestamp (chosen), C fifth menu item, each at desktop and
  phone width, plus a board of the four states the button moves through.

## Live-Race Freshness, Measured 2026-09-05

Stage 14 of the Vuelta: the riders finished at about 15:48 UTC (13:33 real start plus
the winner's 4:15:09). lavuelta.es published the stage classification between 15:50 and
15:52; production showed it at 15:51:42 from the `vuelta-a-espana-rankings` provider;
Wikipedia's main article was edited a few minutes after that. The pipeline was ~4
minutes behind the finish line and ~1 minute behind the fastest source. Two things were
changed on the back of that:

- The payload used to be rebuilt only when a request found it expired, and during a
  live race that request *waited* for the rebuild while everyone else got the warm-up
  page (`shouldServeHomepageWarmup` treated "live and expired" as cold). Now
  `scheduleLiveRaceRefresh` arms a timer one live TTL after every build that carries a
  live or just-finished race, the expired payload is always served as it stands, and
  the warm-up page is for an empty cache only. The timer re-arms itself from the payload
  it just built, so it stops on its own when the race ends, and `unref()`s so tests and
  shutdown are not held open.
- `mergeStageRaceSnapshots` used to drop a general classification that trailed the stage
  result by any amount, which left the card saying "not available yet" for the minutes
  between an official provider's stage table and its GC table (and for the day
  Wikipedia's tables lag its stage result). One stage behind is now kept, labelled
  "Overall after stage N" by the card; two or more behind is still dropped.

Not worth doing, checked: a TTL under 60s (lavuelta.es itself caches its rankings page
for 60s), and a race-center live feed (racecenter.lavuelta.es is a JS app whose bundle
exposes no public data endpoint).

## Being A Considerate Consumer Of Our Sources (2026-09-05)

`DATA-SOURCES.md` at the repo root is the public face of this: who runs the site, what
it reads, how often, and how to reach us. It is the URL in `FETCH_USER_AGENT`;
`SOURCE_CONTACT` (an email, set on Railway) is appended when present; `/api/build-info`
reports `sourceContact: "configured"` or `"not set"` so a deploy can be checked without
exposing the address. Keep its table and review log current whenever fetch behaviour
changes.

The machinery behind it, all in `server.js`:

- `FETCH_USER_AGENT` replaces the old string whose "contact" was `+https://wikipedia.org`.
- `loadOfficialSnapshotThroughCache` caches official stage-race and one-day lookups for
  six hours once a race ended before today (`hasRaceEndedDaysAgo(race, 1)`); live and
  just-finished races are never cached there.
- `fetchWikiRaw` keeps every page it has fetched with the revision id it was fetched
  under; `getWikiRevision` refreshes a revisions index (`prop=revisions&rvprop=ids`,
  50 titles a query, `maxlag=5`) at most every 45s and only changed pages are fetched
  again. A page first seen without a known revision is refetched once when the index
  supplies one, so text fetched just before an edit is never pinned. The index refresh
  also drops pages unused for a day.
- `getRaceDataCacheTtlMs(data, now)` gives the 60s live TTL only while a freshness-
  sensitive race is inside racing hours (10:00–21:00 in the host country, from
  `RACE_HOST_TIME_ZONES` by `countryCode`, default Europe/Paris); otherwise 15 minutes.
  The refresh timer follows the same clock.
- `loadNationalChampionships` caches the Cyclingnews index for an hour.
- `buildRaceArticleQueries` caps at 12 searches instead of 32 (a typical race builds
  9–11, so this rarely binds), and `getArticleCacheTtlMs` keeps the pool six hours,
  once a race has been over for two days.
- Stage-profile misses are kept for the week once the race is over.

Measured with the counting harness (`scratchpad/count3.js` pattern: run the build in a
VM with a `fetch` that logs hosts): steady-state rebuild inside racing hours went from
58 requests (27 Wikipedia, 12 letour.fr, …) to 5 (1 Wikipedia revisions query, 4
lavuelta.es) once the one-time sweep of stage-profile lookups (8 per rebuild, each
stage asked once per process) has run. The cold build is unchanged at ~117 because
nothing is cached yet.

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

## Parser Traps Learned On 2026-08-06

The 2026 Tour de France Femmes rendered as a live race with zero completed stages, no
stage result and no GC, for the first six days of the race. Every item below is a
distinct cause or near-miss found while fixing it. They are recorded because each one
fails *silently* — the page still renders, it just renders empty.

**Wikipedia rider cells use three interchangeable template spellings.**
`{{flagathlete}}`, `{{Flagathlete}}` and `{{Flag athlete}}` are all redirects to the
same template. The spaced form is now the most common on Tour de France pages (200
occurrences vs 7 on the men's page; the Femmes page uses it exclusively). Matching only
the unspaced form made every rider parse as an empty string. `parseAthleteDetails` and
`cleanWikiText` both match these and must be kept in step — they were not, and the
second was found only by review.

**Grand Tour pages do not use `{{cycling result start}}` blocks.**
They publish standings as plain wikitables captioned `General classification after
Stage N`. `extractClassificationTableGcSnapshots` reads these. Smaller races still use
the template blocks, so both paths matter.

**Read the classification-leadership table only through the grid.**
Its columns carry `rowspan`, so on any row after the first, cell index 2 is not the GC
leader — an index-based reader reported the wrong rider. `parseWikiTableGrid` expands
the spans first and `extractClassificationLeadershipRows` reads the resolved columns;
since 2026-09-04 that is what the card's jersey list and the leader-only GC fallback use.
For the GC itself still prefer the captioned wikitable, which gives full standings.

**Sub-minute time cells need padding before the shared normalizers.**
`normalizeStandingGap`/`normalizeStandingTime` require a two-digit seconds field *and* a
minutes field. A wiki gap of `+ 4"` normalized to `""`, which renders as level with the
leader — wrong data, not missing data. `normalizeWikiTimeCell` pads both. Real pages do
carry single-digit gaps (Tour de Pologne has `+ 2"`, `+ 4"`, `+ 6"`, `+ 8"`).

**The ASO `rankingTable::<TYPE>` marker lives in the rider/team profile anchor.**
Filtering rows by ranking type is the correct fix for ASO serving the wrong tab's rows,
but some ASO markup variants render rows with no anchor at all (see the comment above
`parseLetourOfficialStandings`). An unconditional type filter would drop every row on
those pages and blank the race. Both filters are therefore gated on the table carrying
markers at all, falling back to unfiltered parsing when it does not.

**Do not trade a good ASO response for a nested one.**
The rankings shell often already contains the table *and* advertises a nested subtab.
Following that subtab unconditionally cost a redundant ~518KB fetch per refresh, and
would have replaced a valid GC with a "no rank available" stub. `fetchResolvedAsoRankingsAjaxHtml`
now only follows when the first response has no usable rows, and keeps the original if
the subtab is empty too.

**letour.fr and letourfemmes.fr are one codebase.**
They are the same ASO deployment. Both races share `fetchAsoTourRankingsSnapshot` and
differ only in entry point, expected page title and default stage count. Fix a parser
bug once, not twice — but note the men's title pattern is anchored so it cannot match a
Femmes page, and vice versa.

## Parser Traps Learned On 2026-08-23

The 2026 Vuelta a España card rendered with a stage podium one rider deep. The race was
never missing — production had it in Live Multi-Stage the whole time — but the stage
section carried only a winner, which reads as "no results". Both causes below are in
shared code, so both were latent on every page using the same markup.

**`{{cyclingresult}}` keeps the country and the time in positional arguments.**
The template is `{{cyclingresult|rank|rider|ESP|{{UCI team code|...}}|4h 47' 47"}}`.
`parseCyclingResultLine` passed only the rider cell to `parseAthleteDetails`, which
looks for an inline `{{flagathlete|[[Rider]]|ESP}}`. The positional country and the
time were both discarded — every flag and every time on these pages. The fix matches by
shape, not index: among the trailing arguments the country is the only bare alpha token
(team and jersey cells are templates) and the time the only clock-shaped one, so an
absent jersey or team argument does not shift them. The blast radius of the fix was
visible in an `/api/races` diff: times and gaps appeared on ten races that had silently
been rendering without them, and no rider name or ordering changed anywhere.

**Wikitext writes seconds with a real double quote, ASO writes two apostrophes.**
`normalizeStandingTime` / `normalizeStandingGap` matched `12' 34''` only. Wikitext uses
`12' 34"`, and a sprint gap is often seconds-only (`+ 9"`) with no minutes part. Both
normalizers now accept either marker and an optional minutes group.

**Longer stage races publish podiums on companion articles.**
The main article's route table has a winner column and nothing else. The real per-stage
results live on `2026 Vuelta a España, Stage 1 to Stage 11`, which the route table
links from each stage number — so `extractStageArticleTitles` reads the titles off the
page instead of guessing a naming convention, and a race that publishes inline costs no
extra fetch. This is not a Grand Tour convention; La Vuelta Femenina links them too.

**Companion articles are trustworthy for stage results and not for anything else.**
They repeat a `General classification after Stage N` block, but those are hand-copied:
on the 2026 Vuelta the stage 2 GC block still carried the stage 1 leader time (10:57
instead of 4:58:40), which would have contradicted the gaps rendered directly beneath
it. Folding companion blocks into the shared block list regressed the GC on the first
attempt. They now feed `stageResults` only, and `findOverallRaceResult` never sees them
— otherwise a `Stage 1 Result` block gets read as the race's overall result.

**Deep stage history was once budgeted to live races only (no longer).**
Reading companion articles for every recent race too added ~2s to a ~20s cold start.
Since 2026-08-23 the official providers are budgeted and the build is ~6s, so companion
articles are read for every stage race again — item 3 of the feature map is current;
this paragraph is history.
The split that survived: live races read them during the build, finished races render
the route table's winner-per-stage history and offer `/api/race-stages` on demand,
cached six hours and written back onto the cached race so the next page render already
has it. The endpoint resolves its race through `findStageRaceById` against the current
payload, so a race id cannot be turned into an arbitrary Wikipedia fetch. Worth knowing
before optimizing further: many shorter stage races publish podiums inline on the main
article and were already deep without any companion fetch at all.

**Per-stage finish videos fall out of the stage subject, not a refactor.**
The finish-video pipeline reads the stage off the race object in four places. Rather
than thread a stage argument through the query builder, the cache key, the curated-map
lookup and the title matcher, `buildStageFinishVideoSubject` presents an earlier stage
as the current one. Two traps: the subject must drop `finishVideoUrl`, or
`shouldSearchFinishVideo` sees the race's headline video and suppresses the search; and
`isFinalizedStageRace` on a subject compares that stage against the total, so a
finished race's early stages read as live — gate on the real race, not the subject.

**A team time trial names teams the wikitext never spells out.**
`{{UCI team code|TVL men|2026}}` is all a race page ever carries — the result row, the
route table and the article's own Teams section are codes end to end, and `cleanWikiText`
reduces them to an empty string, which is why those stages rendered as an unraced chip.
Rather than hardcode a table that goes stale every season, `resolveTeamNames` asks
Wikipedia's `action=expandtemplates` API to expand the codes in one batched request and
caches the answers. Collection is scoped to `{{cyclingresult}}` rows and the route
table's winner column, so a race that merely lists its teams never triggers a lookup.

**Two block-extraction traps found underneath that, both silent.**
`extractCyclingResultBlocks` assumed `title=` was the first parameter of the start tag
and that the tag sat on one line. A team time trial writes
`{{Cyclingresult start|rider=no|title=…}}`, and a wrapped citation puts the closing
braces on the next line. Each failure dropped a start tag, and a dropped start is worse
than a dropped block: the next block's title then paired with a later block's body, so
the 2026 Tour's stage 3 and 4 results vanished while their rows were served under a
general-classification title. Blocks now end at their own `end` tag *or* at the next
start, whichever comes first, so a missing `end` — which the live page also has — costs
nothing. If stage results ever go missing in a band rather than individually, suspect
this pairing.

**A stage strip is the shape that survives a three-week race.**
`stageRace.stages` holds one entry per raced stage and the card renders a numbered
strip over the whole route with future stages disabled, swapping one panel in place.
A 21-stage card is the same height as a 5-stage one. Two details that are easy to get
wrong: `parseTotalStages` counts a prologue as a stage, so a prologue race needs one
fewer numbered chip or the strip grows a phantom; and a gap *below* the current stage
is a stage with no rider result (the 2026 Tour opened with a team time trial), not a
stage that has not happened, so the two carry different titles.

## Process Lessons From The 2026-08-23 Session

- **"Not showing up" can mean "showing but empty."** The report was that the Vuelta was
  missing. It was on production the whole time, second card in Live Multi-Stage; what
  was missing was places 2-5 of its stage podium. Fetching the deployed page and
  screenshotting it settled in one step what re-reading parsers would not have. Confirm
  what the user is actually looking at before diagnosing a cause.
- **The before/after `/api/races` diff earns its keep.** Folding companion-article
  blocks into the shared block list silently replaced the Vuelta's GC leader time
  (4:58:40) with a stale copy from the companion page (10:57). Nothing failed, no test
  caught it, and the card still rendered. The per-race diff surfaced it immediately.
  Diff names separately from times: a name-only projection proves no rider or ordering
  moved, which is the regression that actually matters.
- **Measure a performance claim against a stashed baseline.** `git stash push -- server.js`,
  benchmark, `git stash pop` gives a real before/after on the same machine and network.
  Cold start is noisy — one run in five came back 10s slow — so take a median over
  several rather than trusting a single number.
- **Verify a resolved video, do not just check that one exists.** Both Vuelta stage
  videos were confirmed by fetching the watch page and reading title, channel and
  upload date. This repo has prior commits fixing finish videos that pointed at the
  wrong race.

## Process Lessons From The 2026-08-06 Session


- **Local green does not mean the product is fixed.** The fix worked locally for two
  rounds while the user was looking at the deployed site, which was still on old code.
  When a user reports the product is wrong, query the deployed instance first;
  `stageRace.provenance.snapshot` and `git log origin/main..HEAD` settle it in seconds.
- **Ship when the user has delegated.** Waiting for a second confirmation after being
  told to proceed cost a full round trip and left production broken during a live race.
- **An inline SVG's `<style>` is document-scoped, not element-scoped.** Rendering several
  inlined SVGs on one comparison page let the last `<style>` repaint all of them, which
  briefly produced a confident but wrong conclusion about a `prefers-color-scheme` rule
  working. Test icon files loaded through `<img>`, which is also how a browser fetches a
  favicon. Marks that style via presentation attributes rather than classes are immune.
- **Review findings need verifying, not applying.** Of six findings from a review pass,
  three were real, one was overstated (claimed a markup form that appears zero times
  across four live race pages), one proposed an unsafe fix (splitting table rows on `||`
  would have corrupted a `{{font colour|white||link=}}` cell), and one needed a guard the
  review had not considered before it was safe to apply.

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
- The hero and page overflow a 390px viewport in headless Chrome, on production as well as locally. Noticed on 2026-09-04 while checking the season calendar's phone layout; not caused by it and not yet fixed.
- Every save from the site editor is a commit to `main` and therefore a Railway redeploy (about 30s, then a short warm-up during which `/` serves the warm-up page and `/api/homepage-data` returns 202). Two saves within seconds can make the second one hit a GitHub 409; the server re-reads the file version and retries once.
- When you push, another commit may already be on `origin/main` from the site editor. Always `git pull --rebase origin main` before `git push`; a hand edit to `data/release-notes.md` can conflict with an edit the maintainer made on the site.
- CI runs `npm test` on every push and pull request (`.github/workflows/test.yml`), including the headless-Chrome smoke test in `test/browser-smoke.test.js`, which drives the real client script (stage chips, km/mi toggle, expand control, late-markup observer, the refresh button against a stubbed fetch) and skips only when no Chrome is found. `package.json` pins `engines.node >= 20`. There is still no lint script, formatter config, or lockfile — the app has no dependencies, so a lockfile would be empty.

## Process Lessons From The 2026-09-04 Session

The day added the season calendar, the championships almanac and map, the editable
site pages, share paths with link previews and a new favicon. What made it go well:

- **Mock before building, with real data and the real stylesheet.** Every visual
  feature started as an artboard on a design canvas rendered from the live payload
  (https://claude.ai/code/artifact/b690e73e-e87a-4e6e-a7a2-e1883bb8698c). The
  maintainer chose from comps and refined ("group by continent", "close it unless
  clicked"), and implementation then had no open design questions. Low-fi sketches
  would not have earned the same decisions; a fake-looking comp would have been
  rejected outright (see the honest-graphics rule under "Stage profiles").
- **Measure the problem before redesigning it.** The championships section was 98 rows
  of cards, about 29 screens, and 290 of 293 cards carried one name and "TBD". Those
  numbers, not taste, justified the almanac.
- **Results first, always.** The calendar strip under the hero was cut the same day it
  shipped because it pushed the day's results down. Anything new that is not a result
  should be closed until asked for.
- **Verify on production after every push.** `git push` → poll `/api/build-info` for
  the SHA (about 30s) → poll `/` until it is past warm-up (about 10s more) → `curl` the
  thing you changed. Railway deploys straight from `main`, so a green test run is not
  the finish line.
- **Fragments never reach the server.** `/#season-calendar` cannot get its own link
  preview; that is why `/calendar` and `/championships` exist.

Traps that cost time:

- The VM test harness runs `server.js` without `__dirname` or `Buffer`. Resolve data
  paths lazily inside functions (`getSiteContentDir`) and hash before
  `crypto.timingSafeEqual` instead of comparing `Buffer`s; a top-level
  `path.join(__dirname, …)` breaks every test at load.
- The homepage client script lives inside a server template literal, and
  `test/browser-smoke.test.js` fails the build if it contains any `${`. Write client
  code with string concatenation and data attributes; put server values on elements,
  never inline into the script.
- The smoke test takes the *first* `<style>` block in `server.js` as the site stylesheet.
  Any new page builder with its own `<style>` must sit after `buildHtmlPage`.
- `SVGElement` has no `.click()` in Chrome. To exercise an SVG control from a headless
  check, dispatch `new MouseEvent("click", { bubbles: true })`.
- A cheap way to test a client behaviour without the browser extension: save the
  rendered page, `sed` a `<script>` into `</head>` that performs the interaction and
  writes the outcome into `document.title`, then `--dump-dom` and grep the title.
- Natural Earth rings close on their first point, so a plain Douglas–Peucker pass
  collapses every polygon to nothing; split each ring at the point farthest from its
  start before simplifying.
- The Cyclingnews index writes "postponed" / "cancelled" into a champion cell; the
  parser now treats those as no result.

## Process Lessons From The 2026-09-05 Session

The day shipped, in order: stage profiles no longer expand on phones; a "Latest news"
line at the foot of every race card (chosen from four comps, then the coverage block
retired as redundant); the news line fixed for narrow columns; live-race data rebuilt on
a timer with the trailing GC kept; and a full review of how much we ask of our sources,
with `DATA-SOURCES.md` as the public statement and the user agent pointing at it. Nine
pushes, each verified on production. What made it go well:

- **Comps again, and the maintainer picked something none of the four proposed.**
  The four directions (in the card, own block, rail beside the card, one line at the
  top that opens in place) were built from the live Vuelta card, the real stylesheet
  and the eight real stories. The pick was "D, but under the overall classification,
  and the same treatment everywhere news is offered". Genuinely different options
  produced a decision the mock-ups themselves did not contain; five shades of one idea
  would not have.
- **"Is it redundant?" was answered by listing what would be lost.** Before retiring
  the coverage block the drawer was widened to the same eight stories in the same
  order, and the two things not carried over (Refresh paging, summaries) were named in
  the archive header and the reply. Retiring with a stated cost is easy to reverse and
  easy to defend; retiring quietly is neither.
- **Measure the source, not the symptom.** "Stage 13 results are in but we are not
  picking them up" was investigated by polling every source and production every two
  minutes and logging the first moment each carried the stage. The riders were still
  racing when the message arrived (expected 17:19, actual ~17:48), the official site
  published at ~17:51 and production had it at 17:51:42. That timeline turned "make it
  faster" into two precise changes (timer, trailing GC) and two things explicitly not
  worth doing (sub-60s TTL, race-center scraping).
- **Count requests per host before answering "could our sources object".** A VM
  harness with a counting `fetch` (see "Being A Considerate Consumer Of Our Sources")
  showed 58 requests a minute, twelve of them to letour.fr for a race that ended in
  July, and a user agent that named Wikipedia as our contact. The answer to the
  question was honest because the numbers came first; the fixes were obvious once the
  table existed.
- **Verify the client path in a real browser, not only the markup.** The news line's
  scroll-into-view loading was proven with a 5000px-tall headless window against the
  local server (five pills filled themselves), and the narrow-card overflow was caught
  by rendering the line inside a 300px card in the smoke test and asserting no
  overflow — a guard that was shown to fail on the previous stylesheet before it was
  trusted.
- **A yes/no flag beats a secret in a response.** `SOURCE_CONTACT` needed confirming
  after the maintainer set it; `/api/build-info` now says "configured" or "not set"
  rather than echoing anything.

Traps that cost time:

- `sed -n 'N,+Mp' | grep -v '^$'` strips blank lines, so a patch anchored on that
  output will not match the file. Print the exact region (`cat -vet` if in doubt)
  before writing a multi-line replacement.
- Node's test reporter prints `ℹ pass 164`, not `# pass 164`; a `grep -E "^# pass"`
  in a `&&` chain silently fails the whole chain. Grep for `ℹ (pass|fail)`.
- The Vuelta's official rankings page shows *some* table inline before the stage
  classification is published — on stage 14 it was the mountain points (`rankingTable::IME`).
  `parseLetourOfficialStandings` filters by type for exactly this reason; do not relax it.
- `getRaceDataCacheTtlMs` now takes `now`; the old TTL test had to be given a clock
  inside racing hours or it becomes time-of-day dependent. Any new test around the
  live TTL or the refresh delay must pass a fixed `Date`.
- A `.dc.html` artboard fed from server markup needs every bare attribute quoted
  (`hidden="hidden"`, `data-x=""`) and hidden stage panels stripped by balanced-div
  scanning, not regex; the generator in the session scratchpad did both.
- Headless Chrome's default window is 800×600, so a phone-width smoke check needs
  `--window-size=390,844`, and an anchor to a `hidden` element does not scroll.

## Process Lessons From The 2026-09-06 Session

A short session, one feature: a "Refresh results" button beside the hero timestamp,
backed by `/api/data-status`. One push, verified on production, with the release note,
README, this file and the `DATA-SOURCES.md` review log in the same commit.

- **The question was answered before the button was designed.** "A refresh button for
  when someone sees a cached page" first needed "cached where?". The HTML and the JSON
  already go out `no-store`, so the browser is not the culprit; the two real cases are
  a phone restoring an old tab (never asks the server) and the server's own single
  in-memory copy (a reload can return the identical payload). That analysis is what
  made the button honest: check first, reload only when there is something newer,
  otherwise say so and when the next rebuild is due.
- **"Fetch the freshest data" was deliberately not taken literally.** A button that
  forced an upstream rebuild would let any visitor set our request rate to the sources.
  The endpoint reads through `loadRaceData` and does nothing a page view would not;
  the review log in `DATA-SOURCES.md` says so, so the next reader of that document
  does not have to rediscover it.
- **Three placements, one recommendation, tradeoffs named.** Comps were built from the
  live hero markup and the production stylesheet (curl the page, cut `<style>` and the
  hero section, Google Fonts for Barlow/Manrope), rendered with headless Chrome before
  publishing, and put on a canvas with desktop and phone frames plus a states board.
  The maintainer answered "b. thank you" in one line, which is the point of comps.
- **The client path got a real-browser test the same day.** `buildPage` in
  `test/browser-smoke.test.js` now takes `markup`, and the new test stubs
  `window.fetch`, clicks the button and asserts the busy label, the single
  `no-store` request, the "already the latest" sentence and that the button is
  handed back. It cannot observe `location.reload`, so the reload branches are covered
  by the local server run and the production check instead.
- **Verification on production was the same loop as before**: poll `/api/build-info`
  for the SHA (six polls at 6s), wait for `/api/data-status` to answer `200` past
  warm-up, then grep the live page for the button and its `data-fetched-at`.

Traps that cost time:

- Headless Chrome will not open a window narrower than about 500px in the old headless
  mode; a `--window-size=390,…` screenshot comes out 390 wide but laid out at ~500 and
  looks clipped. `--headless=new` honours the width. The smoke test's phone run was
  already on the new mode and is fine.
- `git pull --rebase` refuses with unstaged changes; commit first, then pull, then push
  (the site editor may have committed to `main` in the meantime).

## Process Lessons From The 2026-09-07 Session

A long session, four features, thirteen pushes, every one verified on production before
the next was started: the Montréal Worlds (upcoming cards, then results), rider names
linked to ProCyclingStats, a cancelled-stage fix, and a rider hover card. The detail of
each lives under "Open Threads › Added 2026-09-07…" above and in "Data Source
Cross-Reference"; this section is about how the work went.

- **Start by measuring the gap on production, not in the code.** "Will we have
  problems with the Worlds?" was answered by curling `/api/races` on the live site and
  seeing the upcoming list jump from GP de Montréal (13 Sept) to Il Lombardia (10 Oct).
  The cause was then one grep away (the race list is the two WorldTour season tables and
  nothing else). The same order, production first, found the "Stage cancelled" rider.
- **When the source does not exist yet, build against last year's and say so.** The
  2026 Worlds event pages were 404 all day, so the results parser was written against
  the 2025 Kigali pages, saved as fixtures, and the handoff, AGENTS.md and a memory note
  all carry the 20 September check. A test that passes on 2025 markup is a promise
  about layout, not about the future; naming that plainly is part of the deliverable.
- **The user decides scope in short answers; comps are how they can.** "Upcoming cards,
  yes, but only the four elite events" / "option b, put the men first" / "compact" /
  "a". Each came back within a minute of a canvas built from the production stylesheet
  and real data (`prod-index.html` for the CSS, `/api/races` for the rows, the VM
  harness for the real builders). Three canvases were made today:
  Worlds cards https://claude.ai/code/artifact/9d6216f4-92dd-48b1-806c-34feb554a6fc,
  rider links https://claude.ai/code/artifact/d1323357-44d7-47cf-af26-2bc18bf45ac3,
  hover card https://claude.ai/code/artifact/78d3c7d0-757b-48e8-b1e9-883c6da2ad51.
- **Some checks can only run in the user's browser.** ProCyclingStats answers the
  server with a Cloudflare challenge (403), so the 517 rider addresses were verified
  from a PCS tab in the user's Chrome: same-origin `fetch` of each `/rider/<slug>`,
  reading the `<title>`, with the PCS search page consulted for misses. That became
  `scripts/pcs-rider-links.browser.js`. Two traps: the JavaScript tool's 45 s cap
  (run the loop as a background job on `window` and poll it), and a `fetch` with no
  timeout that hung the whole run (use `AbortSignal.timeout`). Reading results back is
  limited to ~1 KB per call, so return compact rows in slices; a POST to a local
  receiver from the PCS page did not get through.
- **A first answer can be right and still wrong for the reader.** "1 win, 3 podiums,
  3 stage wins" for Van Aert was correct by our definitions and read as an error to the
  maintainer, twice ("Wout has more than 1 win", then Romele's stage second place).
  The fix was the definition, not the data: wins and podiums now each count one-day,
  overall and stage results together, as PCS does. When a figure has a narrow
  definition, either say the definition on the card or use the one readers expect.
- **Never build a `$`-pattern into a `String.replace` replacement.** A code-editing
  script wrote `(.+)$\`` into `server.js` and JavaScript's replace expanded `` $` `` to
  the whole file prefix, producing a 14,000-line syntax error. Every edit script since
  passes a function as the replacement (`s.replace(a, () => b)`).
- **Escaping across three layers bites.** Bash single quotes cannot hold an apostrophe
  ("Men's"), a JS template literal cannot hold `${`, and the smoke test refuses any
  `${` in the client script. Edit scripts went into files via quoted heredocs, the
  client code is string concatenation, and `\\s*` after `=` in an infobox regex once
  swallowed the newline and read the next line's value (`[ \\t]*` fixed it).
- **VM-sandbox values are not `deepStrictEqual` to host values.** Arrays built inside
  the test harness's `vm` context have a different `Array` prototype; compare through
  `JSON.parse(JSON.stringify(...))`, as the older tests already did.
- **Same rider, two spellings, one card.** The ASO provider writes "Tadej Pogacar",
  Wikipedia "Tadej Pogačar". Anything keyed by rider name must fold accents
  (`foldRiderKey`), or a rider's season splits in two. The rider index does; the finish
  video map and `RIDER_PROFILE_URLS` are keyed by the name as rendered, on purpose.
  (Half the rule, as 2026-09-08 found out: folding accents does not fold a second
  surname, and folding fixes lookup but never what the page prints.)
- **Verification loop, unchanged and worth repeating:** commit, `git pull --rebase`,
  push, poll `/api/build-info` for the SHA, wait for the page past warm-up, then grep
  the live HTML or JSON for the exact thing that changed. Every push today went through
  it; the one time a check script looked for the wrong string, a direct `curl | grep`
  settled it.

## Process Lessons From The 2026-09-08 Session

One question — "can you confirm our Vuelta leader really has no wins or podiums, as the
hover card says?" — and three pushes. The answer was no, and the detail is under
"Open Threads › Added 2026-09-08" above. This section is about how the work went.

- **Answer a "can you confirm" by going to the payload, not the code.** Reading
  `buildRiderSeasonIndex` would have shown a correct-looking function. Curling
  `/api/homepage-data` for the GC leader's name, then pulling the `rider-seasons`
  JSON out of the live HTML and looking him up, showed two entries for one rider in
  about four minutes. Production first, again; that is now three sessions running.
- **The reported symptom is one instance, not the shape.** The first sweep looked for
  index entries with a zero tally, because a zero was what the user saw — five riders.
  The real rule was "two keys, one rider", and re-running the search that way found
  seven: Niewiadoma and Gee-West had results on both sides, so each card showed a real
  but partial count. An undercount nobody would ever report is the same bug, and it
  only surfaced because the second search asked the general question.
- **Fix the lookup and the display separately, and say so.** Merging the keys made the
  tally right while the card still read "Enric Mas Nicolau" over a stage table saying
  "Enric Mas". Flagging that as a display question left over, in one line, got a
  one-word go-ahead. Shipping it silently inside the first fix would have widened a
  narrow, verifiable change into one that touched every rendered name.
- **But do not ship half a normalization.** Once "settle the spelling" was the task,
  stopping at surnames would have left the same Vuelta card calling third place
  "Primoz Roglic" in the GC and "Primož Roglič" in the stage table — the identical
  defect from the identical cause, one row apart. Measuring first (six more riders
  split by accent or casing, listed before writing any code) is what made that call
  cheap rather than speculative.
- **A canonical name needs an authority, not a heuristic.** "Prefer the shortest
  spelling" is the obvious rule and it is wrong for Derek Gee-West and Tobias Halland
  Johannessen; "prefer the longest" is wrong for Enric Mas and Magnus Cort. The
  Wikipedia article title is the only thing in the payload with a claim to be right,
  and it happens to be where the rest of the site's names come from. When two
  heuristics disagree in both directions, neither is the rule — find the source.
- **Keep the old key answering.** The merged tally is published under every spelling
  rather than collapsed to one, so a browser holding a page rendered before the deploy
  still finds the rider it asks for. Cheap insurance whenever a key that a client
  already holds changes shape.
- **Verify by asking the payload the question the bug asked.** Not "did the SHA
  deploy" but "how many riders does production now spell two ways?" — a sweep over
  every name-bearing field, before and after, printing the count.
- **…but check that the sweep can see the bug.** The first sweep grouped names by
  `foldRiderKey` and reported 0 of 280 riders split. It was structurally incapable of
  finding this class of split, because the two spellings fold to different keys —
  the whole reason the merge exists. Three more defects and two more deploys came out
  of re-running it grouped by PCS address instead. A verification that shares an
  assumption with the code it checks is not a verification. Ask what the check would
  do if the bug were still there, and if the answer is "pass", change the check.
- **The last one only showed up on production.** `applyLateOfficialSnapshots` mutates
  races after `buildRaceData` returns, so two riders kept a provider's spelling
  through two rounds of fixes that were correct in every local test. When a pass has
  to settle data, find everything that writes that data afterwards — grep for
  assignments to the field, not just for the builders.

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

