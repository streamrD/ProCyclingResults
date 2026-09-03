# Pro Cycling Results AI Handoff

Updated: 2026-08-23

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
/Users/tcs16/AgenticAI/FullStackApp/ProCyclingResults
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
│   ├── og-image.jpg
│   └── fonts/
├── data/
│   └── static-stage-race-snapshots.json
├── design-comps/
│   ├── favicon-directions.html
│   ├── marks/
│   └── README.md
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
- `assets/favicon.svg`: site favicon, linked from both document heads. Carries its own `prefers-color-scheme` rule because it has no background plate.
- `design-comps/`: design explorations kept with the code — the favicon comparison page and all five candidate marks. See its README before swapping the favicon; assets are served immutable for a year, so a replacement at the same path needs a version query.
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
- `/api/race-stages?race=<race id>`: reads a finished stage race's companion stage articles on request and returns `{ raceId, html }` with a re-rendered stage switcher. The id must resolve through `findStageRaceById` against the current homepage payload, so it cannot be pointed at an arbitrary Wikipedia page; anything else returns `404`.
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
- Per-stage history and companion stage articles: `buildStageHistory`, `extractStageArticleTitles`, `loadStageArticleTexts`, `loadRequestedStageHistory`, `findStageRaceById`
- Stage strip rendering: `buildStageSwitcherMarkup`, `buildStagePanelMarkup`, `.stage-strip` / `.stage-chip` / `.stage-panel` CSS, and the delegated `[data-stage-target]` and `[data-load-stage-results]` click handlers in the inline script
- Freshness and cache TTL helpers: `hasFreshnessSensitiveRaceData`, `getRaceDataCacheTtlMs`
- Official race providers and parsers: `OFFICIAL_STAGE_RACE_PROVIDERS`, `parseAsoOfficialStandings`, `parseLetourOfficialStandings`, `fetchTourDeFranceOfficialSnapshot`
- Static snapshot hydration: `getStaticStageRaceSnapshot`
- Location enrichment: `enrichLocations`, `extractLeadLocation`
- Race bucketing and aggregation pipeline: `partitionRaceBuckets`, `buildRaceData`
- Metadata and data cache loaders: `loadRaceMetadata`, `loadRaceData`, `refreshRaceDataInBackground`
- API/debug payload builders: `buildRaceDataDebugPayload`, `buildHomepageDataPayload`
- Race cards, standings, and rendering: `buildRaceCard`, `buildStageRaceCard`
- Finish-video resolution and YouTube search: `getRaceFinishVideoUrl`, `getStageFinishVideoUrl`, `enrichFinishVideos`, `enrichStageFinishVideos`, `buildStageFinishVideoSubject`, `parseYouTubeSearchVideos`, `selectFinishVideo`
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
  fall through to the pictogram. Current edition only, live races only, budgeted like
  the official providers (`STAGE_PROFILE_BLOCKING_BUDGET_MS`, `STAGE_PROFILE_LOOKUP_LIMIT`),
  and cached for a week in `stageProfileCache` because a published profile never
  changes. Late arrivals write onto the cached race, so the next render has them.

`buildStageProfileMarkup` prefers the measured trace, scaled to its own altitude range
but never less than 1,000 m of it so a flat stage stays low, and labels it "Elevation
data: komoot". It renders compact by default — a thumbnail of the trace beside the
caption — and "Expand profile" swaps the same SVG into a tall chart with an
altitude-coloured fill, gridlines, km ticks and start/finish markers (towns parsed from
the course cell by `parseStageCourseEnds`). One markup, two CSS states; the axes and
markers are simply hidden while compact. The client keeps the choice in `localStorage`
under `pcr-profile-view` and applies it to every measured profile on the page. A stage without one gets the `STAGE_TYPE_GLYPHS` icon for its type — the
same icon for every stage of that type, in a dashed box, with the note "no elevation
profile is available" — because a plausible-looking silhouette was tried first and read
as a real profile (the user spotted three Tour mountain stages drawn nearly alike). Do
not make the generic case look more realistic; make it look more generic. Both unit systems render
into `data-unit-metric` / `data-unit-imperial`; the client swaps text and remembers the
choice in `localStorage` under `pcr-units`, re-applying it to any markup that lands later.
No source publishes categorised-climb markers or a climbing total for the non-ASO races;
the race centre (racecenter.lavuelta.es) draws them from an API its bundle obscures.

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
- The strip renders `stageRace.stages` and nothing else, so anything the card should
  show has to be *in* that array. `latestStage` is not consulted separately.
- A team time trial occupies the rider slot with the team's name, so it renders through
  the same podium markup with the team's flag. Nothing downstream needs to know.

## Open Threads

Live as of 2026-08-23. Verify against production before acting — these move.

- **`2026 Tour of Britain Women` renders empty.** Live race, `completedStages: 0`, no
  stage result and no GC, `stages: []`. Its Wikipedia page is unfilled, so there is
  nothing to parse; this is not caused by the stage-results work. Same shape as the
  Femmes outage, so if the page is still bare well into the race, check whether an
  official provider exists for it before touching shared parsers.

- **One provider still needs ~11s, it just no longer blocks.** The Giro d'Italia Women
  lookup trips the blocking budget on every build and is applied late. A per-race cache
  for settled races' official snapshots would stop re-fetching it every refresh; not
  done, because it does not help the cold start that motivated the work.
- **Per-stage video backlog fills 4 per refresh.** Invisible during a race, since one
  stage arrives per day. Only noticeable if the process restarts late in a Grand Tour
  with a cold `finishVideoCache`.
- **Finished races get no per-stage videos at all.** `enrichStageFinishVideos` is gated
  to live races. `/api/race-stages` could resolve them on demand too, at the cost of
  endpoint latency; not done because nobody asked.
- **`BUILD_INFO` was not touched** by this work and remains manual.

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

**Do not read the classification-leadership table for GC.**
It looks like an easy source and is a trap: its columns carry `rowspan`, so on any row
after the first, cell index 2 is not the GC leader. It reported the wrong rider. Prefer
the captioned wikitable, which also gives full standings rather than just a leader.

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

**Deep stage history is worth a cold-start budget only for live races.**
Reading companion articles for every recent race too added ~2s to a ~20s cold start.
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
- Companion stage articles and per-stage finish videos are fetched at build time for live races only. A finished race looking shallow is the design, not a regression — see "Stage Results Feature Map".
- Official race pages can expose current data under stale metadata or stale URLs.
- Article scoring is heuristic and division-sensitive; changes can improve one race and hurt another.
- `BUILD_INFO` now reads Railway's `RAILWAY_GIT_COMMIT_SHA` when present and falls back to a hardcoded marker otherwise. Check `source` in the payload: `railway-env` is the live commit, `hardcoded-fallback` means you are looking at a local run or the env var went missing.
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
- Stage results / stage strip issue: search `buildStageHistory`, `buildStageSwitcherMarkup`, and `extractStageArticleTitles`
- Article issue: search `buildRaceArticleQueries`, `scoreRaceArticle`, and `selectRaceArticles`
- Performance or cold-start issue: inspect cache loaders plus `scripts/benchmark-load.js`

## Handoff Prompt For Another AI

Use a prompt like this:

```text
Project: /Users/tcs16/AgenticAI/FullStackApp/ProCyclingResults

Read AGENTS.md first, then README.md and handoff.md. Treat README.md as durable architecture and handoff.md as the current cross-reference/audit snapshot. Verify git status, branch, remote refs, and worktrees before editing. The active product scope is Men's WorldTour, Women's WorldTour, and National Championships. ProSeries and Europe Tour are retired and archived unless explicitly requested. Keep changes narrow, preserve the no-dependency Node architecture, and run node -c server.js plus npm test for code changes.

Task: <task here>
```

