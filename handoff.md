# Pro Cycling Results AI Handoff

Updated: 2026-06-22

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

Retired scope:

- UCI ProSeries
- Europe Tour Spotlight

The retired ProSeries and Europe Tour sections were implemented previously and retired on 2026-06-22. Their restoration reference is preserved in `archive/proseries-europe-tour-sections.js`. Do not reactivate them unless the user explicitly asks.

## Local Audit Snapshot

Observed local path:

```text
/Users/tcs16/Desktop/AgenticAI/FullStackApp/ProCyclingResults
```

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
│   ├── og-image.jpg
│   └── fonts/
├── data/
│   └── static-stage-race-snapshots.json
├── scripts/
│   └── benchmark-load.js
└── test/
    ├── parser-regressions.test.js
    └── fixtures/
```

Primary file responsibilities:

- `server.js`: all runtime logic, data fetching, parsing, caching, rendering, routing, and server startup.
- `test/parser-regressions.test.js`: Node test suite plus VM-based export harness for testing internal functions without starting the server.
- `data/static-stage-race-snapshots.json`: bounded fallback snapshots for selected stage races when upstream live data is sparse.
- `archive/proseries-europe-tour-sections.js`: archived configs for retired ProSeries and Europe Tour sections.
- `scripts/benchmark-load.js`: cold-readiness and warmed endpoint timing checks.
- `assets/fonts/*`: local Manrope and Barlow Semi Condensed font files.
- `assets/og-image.jpg`: Open Graph image.
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
npm run benchmark:load -- --runs=5 --include-coverage
```

## Endpoint Cross-Reference

- `/`: server-rendered homepage. During cold warmup it can return a warmup page.
- `/api/homepage-data`: active homepage JSON payload. During cold warmup it can return `202`.
- `/api/races`: active race JSON payload. Use `?debug=1` for additional timing/debug payload.
- `/api/build-info`: manual `BUILD_INFO` payload from `server.js`. It is not automatically tied to the current commit.
- `/api/competition-section?group=<id>`: retained hook for deferred sections. Retired `proseries` and `europe-tour` return `410`; unknown groups return `404`.
- `/api/competition-coverage?group=<id>`: lazy article coverage for active groups. Retired groups return `410`.
- `/assets/*`: static asset serving from `assets/`.

## Server.js Landmarks

Line numbers are approximate and can drift. Prefer searching function names with `rg`.

```bash
rg -n "function loadRaceData|function buildHtmlPage|NATIONAL_CHAMPIONSHIP|OFFICIAL_STAGE_RACE|http.createServer" server.js
```

Major areas (anchored to symbols rather than line numbers, which drift on every change — `rg -n "<symbol>" server.js`):

- Top-level constants and product config: `PORT`, `BUILD_INFO`, the cache-TTL constants, `SEASONS`
- Country, rider, and video lookup tables: `COUNTRY_NAMES`, `COUNTRY_FLAG_CODES`, `COUNTRY_NAME_ALPHA2`, `RACE_FINISH_VIDEO_URLS`
- HTML escaping, wiki cleaning, and athlete parsing helpers: `escapeHtml`, `cleanWikiText`, `decodeHtml`, `parseAthleteDetails`
- Season table parsing and upstream fetch helpers: `parseSeasonRows`, `fetchText`, `fetchWikiRaw`
- National Championships parser and event expansion: `parseNationalChampionshipsIndex`, `buildNationalChampionshipEventRecords`
- Wiki stage-race extraction: `extractStageRaceSnapshot`
- Freshness and cache TTL helpers: `hasFreshnessSensitiveRaceData`, `getRaceDataCacheTtlMs`
- Official race providers and parsers: `OFFICIAL_STAGE_RACE_PROVIDERS`, `parseAsoOfficialStandings`, `parseLetourOfficialStandings`, `fetchTourDeFranceOfficialSnapshot`
- Static snapshot hydration: `getStaticStageRaceSnapshot`
- Location enrichment: `enrichLocations`, `extractLeadLocation`
- Race bucketing and aggregation pipeline: `partitionRaceBuckets`, `buildRaceData`
- Metadata and data cache loaders: `loadRaceMetadata`, `loadRaceData`, `refreshRaceDataInBackground`
- API/debug payload builders: `buildRaceDataDebugPayload`, `buildHomepageDataPayload`
- Race cards, standings, and rendering: `buildRaceCard`, `buildStageRaceCard`
- Finish-video resolution and YouTube search: `getRaceFinishVideoUrl`, `enrichFinishVideos`, `parseYouTubeSearchVideos`, `selectFinishVideo`
- Recent-results row reveal: `buildRecentResultsBlock`, `.recent-race-slot`, `revealMoreRecentRaces`/`syncCoverageRaceOptions` in the inline script — shows 3 by default, "Load more races" reveals up to `WORLDTOUR_RECENT_RESULTS` (12) and then removes itself once all rows are shown; revealed races feed the coverage dropdown via the `<group>-shown` query param and client-side option sync. Finished stage races are enriched even when not in the most-recent few and are never dropped for lacking a snapshot, so Grand Tours like the Giro stay in the grid. Note: both `.recent-race-slot` and `.load-more-races` set `display` in CSS, so each needs an explicit `[hidden]` rule for the JS `hidden` toggle to take effect
- National Championships rendering and header flags: `buildNationalChampionshipsSection`, `getCountryFlagEmojiByName`
- Competition group definitions: `getCompetitionGroups`
- Full HTML page, inline CSS, and inline browser JS: `buildHtmlPage`
- Warmup page: `buildWarmupPage`
- Response helpers, static file serving, and routes: `http.createServer`

## Data Source Cross-Reference

Primary race calendar and result source:

- Wikipedia raw wikitext season pages
- Active pages: `2026_UCI_World_Tour`, `2026_UCI_Women's_World_Tour`
- Raw URL shape: `https://en.wikipedia.org/w/index.php?title=<PAGE>&action=raw`

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
- Tour Auvergne-Rhône-Alpes
- Tour of Greece
- Giro d'Italia
- Giro d'Italia Women
- Vuelta Asturias
- Vuelta a Burgos Feminas
- Eschborn-Frankfurt
- Grande Prémio Anicolor

## National Championships UX State

Current behavior:

- Default UI prioritizes completed National Championship events.
- Completed events sort ahead of upcoming or pending events.
- More recent known dates appear first.
- Country and category dropdowns filter the event cards.
- Selecting a country can reveal upcoming or TBD events for that country.
- Completed events show top three places when known.
- Each country card header shows a national flag (larger than the rider flags used in the WorldTour sections); individual podium riders are intentionally left flag-free since the header flag covers the whole card.
- Known event dates, locations, podiums, source reports, and finish videos are metadata overrides, not broad replacement data.

Country-header flags come from `getCountryFlagEmojiByName()`, backed by `COUNTRY_NAME_ALPHA2`, which covers every federation name in the Cyclingnews index (the rider `COUNTRY_FLAG_CODES` table only covers race nations). Styling: `.national-title` / `.national-flag`.

Key functions/constants:

- `NATIONAL_CHAMPIONSHIP_EVENT_KEYS`
- `NATIONAL_CHAMPIONSHIP_EVENT_METADATA`
- `parseNationalChampionshipsIndex()`
- `buildNationalChampionshipEventRecords()`
- `sortNationalChampionshipEvents()`
- `buildNationalChampionshipsSection()`
- `bindNationalChampionshipFilters()` inside the inline browser script

Known current video override:

- USA men's road race finish: `https://www.youtube.com/watch?v=hSVSHs9lPPI`

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
├── tour-de-france-rankings-stage21.html
├── tour-de-france-stage21-ite.html
├── tour-of-greece-results-2026-stage1.html
└── youtube-search-tdf-stage21.html
```

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

## Known Sharp Edges

- `server.js` is large. Most changes should still be narrow, but cross-file refactors need extra caution because unrelated behavior is co-located.
- External data drift is the dominant bug source.
- Wikipedia live race pages often update unevenly; stage results and GC can be out of sync.
- Official race pages can expose current data under stale metadata or stale URLs.
- Article scoring is heuristic and division-sensitive; changes can improve one race and hurt another.
- `BUILD_INFO` is manual and can be stale. Do not treat `/api/build-info` as a guaranteed current Git SHA unless the code was deliberately updated.
- Retired section support still exists as hooks and archived config, but there are no active deferred groups.
- YouTube finish-video search and official providers (e.g. letour.fr) depend on third-party page structure; expect occasional parser drift there too.
- There is no schema validation for upstream payloads.
- There is no CI config, lint script, formatter config, lockfile, or explicit Node engine declaration.

## Suggested First Checks For A New Agent

Run these before making changes:

```bash
git status --short
git branch --show-current
git log --oneline --decorate --max-count=5
git worktree list --porcelain
rg --files -g '!node_modules' -g '!.git'
```

Then choose the smallest relevant read path:

- Product scope or docs: `AGENTS.md`, `README.md`, `handoff.md`
- Parser or data issue: search `server.js` for the target race/provider, then inspect relevant tests
- National Championships issue: search `NATIONAL_CHAMPIONSHIP` in `server.js`
- Finish video issue: search `RACE_FINISH_VIDEO_URLS` and `getRaceFinishVideoUrl`
- Article issue: search `buildRaceArticleQueries`, `scoreRaceArticle`, and `selectRaceArticles`
- Performance or cold-start issue: inspect cache loaders plus `scripts/benchmark-load.js`

## Handoff Prompt For Another AI

Use a prompt like this:

```text
Project: /Users/tcs16/Desktop/AgenticAI/FullStackApp/ProCyclingResults

Read AGENTS.md first, then README.md and handoff.md. Treat README.md as durable architecture and handoff.md as the current cross-reference/audit snapshot. Verify git status, branch, remote refs, and worktrees before editing. The active product scope is Men's WorldTour, Women's WorldTour, and National Championships. ProSeries and Europe Tour are retired and archived unless explicitly requested. Keep changes narrow, preserve the no-dependency Node architecture, and run node -c server.js plus npm test for code changes.

Task: <task here>
```

