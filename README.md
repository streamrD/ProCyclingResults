# Pro Cycling Results

This repository is a small, self-contained Node.js application that serves a server-rendered web page for current professional cycling coverage. It combines race schedule/results data with race-specific news coverage and exposes both an HTML UI and a JSON API.

The codebase is intentionally minimal:

- No frontend framework
- No backend framework
- No database
- No third-party npm dependencies
- One runtime entrypoint: `server.js`

This README is written as a technical handoff for a future engineer or LLM agent that needs enough context to extend or debug the project without relying on prior chat history.

## Product Purpose

The app is a live race desk for selected 2026 UCI calendars. It surfaces:

- Recent one-day race results
- Live multi-stage race standings
- Finalized stage-race classifications
- Upcoming races
- Race-specific article coverage

The current content model is split into four competition sections:

- Men's WorldTour
- Women's WorldTour
- UCI ProSeries
- Europe Tour Spotlight

Europe Tour coverage is intentionally narrower than the other calendars. It only includes selected races from the broader season page, currently filtered to specific entries such as `Vuelta Asturias`.

## Stack

### Runtime

- Node.js
- Built-in modules only: `http`, `fs/promises`, `path`, `url`
- Uses the global `fetch` API available in modern Node versions

Practical implication: use Node 18+ at minimum. Current local runtime was `v24.14.0`.

### Frontend

- Server-rendered HTML assembled as template strings in `server.js`
- Inline CSS in the HTML response
- Small inline browser script for coverage selector and refresh interactions
- Local font assets served from `assets/fonts`

### Deployment

- Starts with `npm start`
- Default port is `3000`
- Honors `PORT` from environment
- Existing project history and previous README indicate Railway deployment
- Umami analytics is injected via a hard-coded script tag

## Repository Layout

```text
.
├── assets/
│   └── fonts/
├── data/
│   └── static-stage-race-snapshots.json
├── package.json
├── README.md
├── scripts/
│   └── benchmark-load.js
├── server.js
└── test/
    ├── parser-regressions.test.js
    └── fixtures/
```

Important consequence: almost all application logic, data fetching, parsing, caching, ranking, routing, and rendering live in `server.js`.

## Runbook

### Install / Start

There are no dependencies to install beyond Node itself.

```bash
npm start
```

Then open `http://localhost:3000`.

### Scripts

`package.json` currently defines:

- `start`: `node server.js`
- `test`: `node --test`
- `benchmark:load`: benchmark warmed endpoint response times
- `benchmark:ready`: measure cold-start readiness for `/api/races`
- `benchmark:homepage-ready`: measure cold-start readiness for `/api/homepage-data`

There is currently:

- No build script
- No lint script
- No formatter config in-repo

## Endpoints

- `/`
  Returns the server-rendered HTML shell. On cold start, this can initially render a warmup state while homepage WorldTour data loads.
- `/api/homepage-data`
  Returns the lighter homepage payload used by `/`. This contains only the WorldTour-first data needed for the initial page experience.
- `/api/races`
  Returns the full aggregated race payload as JSON, including deferred competition sections.
- `/api/competition-section?group=<id>`
  Returns a lazily loaded section payload for deferred groups such as `proseries` and `europe-tour`.
- `/api/competition-coverage?group=<id>`
  Returns article coverage for a specific competition group. Coverage is loaded on demand rather than during the initial page render.
- `/assets/*`
  Serves static assets from the local `assets` directory.

Any other route returns a simple 404 HTML page.

## High-Level Architecture

The app follows a single-process request/response model:

1. An incoming request reaches the Node `http` server.
2. If the request is for `/assets/*`, the file is served directly.
3. The homepage path and the full-data path are intentionally split.
4. `/api/homepage-data` loads or reuses a lighter WorldTour-first payload used to bring the initial page out of warming state faster.
5. `/api/races` loads or reuses the fuller payload that includes deferred sections and broader enrichment work.
6. `/api/competition-section` loads deferred competition sections on demand.
7. `/api/competition-coverage` loads article coverage on demand for the requested section.
8. `/` renders the shell plus inline client JS that warms the homepage payload, loads deferred sections when clicked, and lazy-loads article coverage.

There is no persistence layer. All state is in memory and rebuilt from live upstream sources when caches expire.

## Data Sources

The app depends on live external content. This is the most important operational fact about the project.

### Primary source: Wikipedia raw wikitext

The main race schedule/results pipeline reads raw wikitext from season pages such as:

- `2026_UCI_World_Tour`
- `2026_UCI_Women's_World_Tour`
- `2026_UCI_ProSeries`
- `2026_UCI_Women's_ProSeries`
- `2026_UCI_Europe_Tour`

The application fetches raw page content via:

- `https://en.wikipedia.org/w/index.php?title=<PAGE>&action=raw`

It parses season tables, race pages, infobox fields, result templates, and stage-race sections directly from raw wiki markup using regular expressions and string heuristics.

### Secondary source: Bing News RSS

Race coverage articles are pulled from Bing News RSS search feeds, using several search queries per race name variant. The app then filters, deduplicates, and scores those results.

For live stage races, the query builder also adds stage-aware searches derived from the current snapshot, including the current stage number and latest stage winner. That helps races like the Giro surface same-stage result stories more reliably than a generic race-name search alone.

Used for:

- Article title
- Source / publisher
- Description
- Link
- Publication date

### Special official sources

Some races use official race-site providers because Wikipedia is not sufficient for live or timely stage detail.

Current special cases:

- Tour de Romandie
  Hard-coded prologue snapshot logic for the first day only
- La Vuelta Femenina
  Pulls the official rankings page plus its GC AJAX partial to recover current stage and GC standings
- Tour of Greece
  Pulls the official `results-2026` page and parses the current General Classification / Stage tables directly
- Giro d'Italia
  Uses the official livefeed plus the official classifications page for stage / GC coverage when Wikipedia is still sparse. Giro finish-video links are sourced first from official livefeed `Last Km` video entries, with a small explicit fallback map retained for resilience.
- Vuelta Asturias
  Pulls posts from the official WordPress JSON API and extracts stage / GC information from Spanish-language text
- Eschborn-Frankfurt
  Pulls the official rankings page to recover top-five one-day results when the current-edition Wikipedia race page is missing
- Selected 2026 Europe Tour stage races
  Use static snapshot data from `data/static-stage-race-snapshots.json` when the current upstream race pages do not expose complete stage / GC result blocks
- Grande Prémio Anicolor
  Uses a date-bounded live fallback snapshot while the current edition is in progress and upstream live stage data is still sparse

This source logic is centralized behind provider registries plus `loadOfficialStageRaceSnapshot()` and `loadOfficialOneDayResultStandings()`.

## Data Model and Aggregation Flow

The central pipeline is `loadRaceData()`, but it now operates in two important modes:

- `includeDeferred: false`
  Homepage mode. This powers `/api/homepage-data` and the initial `/` experience. It only loads the WorldTour-first data needed for the initial page, keeps location enrichment non-blocking, and limits recent-standings enrichment so cold-start readiness is materially faster.
- `includeDeferred: true`
  Full mode. This powers `/api/races` and the deferred sections. It includes the broader competition set plus the heavier enrichment paths.

At a high level it does the following:

1. Fetch the configured season pages from Wikipedia.
2. Parse the season tables into normalized race objects.
3. Remove cancelled or malformed rows.
4. Split races into display buckets based on date and category.
5. Enrich selected races with better location data.
6. Enrich recent or live races with standings and stage-race snapshots.
   Official and Wikipedia-derived stage-race data are merged field-by-field rather than treated as all-or-nothing snapshots.
   Wikipedia fetches are rate-limited and retried because fresh live-race refreshes can otherwise hit upstream `429` responses during busy race windows.
   Cold-cache latency is therefore mostly an upstream-fetch problem rather than a rendering problem: live race rebuilds can touch multiple Wikipedia and official race pages, and the Wikipedia throttling guard intentionally trades speed for safer refresh behavior.
7. Mark races that finished today.
8. Assign stable `id` values from page titles.
9. Return the aggregate payload and cache it in memory.

The returned JSON shape currently contains:

- `fetchedAt`
- `recentResults`
- `finalizedStageRaces`
- `liveStageRaces`
- `upcomingRaces`
- `europeTourRecentResults`
- `europeTourLiveStageRaces`
- `europeTourUpcomingRaces`

The homepage payload returned by `/api/homepage-data` is intentionally narrower than `/api/races`. It omits deferred section data so the first user-visible render is not blocked on ProSeries and Europe Tour work.

## Core Race Object Shape

Parsed race entries generally include:

- `id`
- `pageTitle`
- `title`
- `series`
- `date`
- `location`
- `winner`
- `second`
- `third`
- `startDate`
- `endDate`
- `finishedToday`
- `stageRace` when applicable
- `resultStandings` when richer standings are available

These objects are plain JS objects, not instances or schemas.

## Season Configuration

The `SEASONS` constant is the main content configuration layer. Each entry declares:

- Wikipedia page title
- Human label used as `series`
- Whether results are parsed as single-winner or podium data
- Table column indexes for date / winner / podium
- Optional inclusion filters for partial season pages

If future seasons or calendars are added, this is the first place to inspect.

## Parsing Strategy

The project is parser-heavy. Most of the complexity is in turning semi-structured text into usable race objects.

### Wikitext cleaning

Utilities such as `cleanWikiText()`, `decodeHtml()`, `parseAthlete()`, and `parseRaceCell()` strip:

- HTML entities
- wiki links
- templates
- flag templates
- comments
- refs
- inline markup

This is intentionally heuristic, not a full wiki parser.

Location enrichment is also heuristic. Before replacing the season-table fallback location, the app now sanitizes extracted lead / infobox text and rejects values that look like citation residue, article headlines, raw URLs, or other non-location content.

### Date handling

Dates are parsed from season-table text into UTC `Date` objects. The app compares race boundaries using UTC calendar dates to decide whether a race is:

- recent
- live
- upcoming

Display timestamps for page freshness and articles are formatted in `America/New_York`.

Important distinction:

- Race classification logic uses UTC day boundaries
- User-facing "Updated" labels use Eastern Time

### One-day vs multi-day race logic

The app distinguishes:

- one-day races: `startDate === endDate`
- multi-day races: `startDate !== endDate`

That distinction drives which section a race appears in and whether stage-race enrichment is attempted.

### Stage-race extraction

For multi-day races, the app tries to derive:

- total number of stages
- latest completed stage
- latest stage winner
- latest general classification
- final overall result

It does this from Wikipedia race pages when possible by parsing:

- `{{cyclingresult ...}}` blocks
- stage result sections
- GC sections
- route/stage winner tables
- infobox first/second/third fields

If a race has official provider logic, it is loaded alongside the parsed Wikipedia snapshot and the fresher stage, GC, and overall fields are merged independently. Live stage races also apply a simple date-based freshness floor so obviously stale progress is deprioritized.

One practical complication: live Wikipedia race pages can be only partially updated. A stage result block may be current while the general-classification block is still from the previous stage. When that happens, prefer a narrow correction layer for the affected race over loosening the global parser in a way that could degrade other races.

### Location enrichment

Season tables sometimes give weak or coded locations, so the app fetches the individual race page and tries to improve `location` by reading:

- infobox `location`
- lead paragraph phrasing

If the extracted string looks implausible, it falls back to the season-table-derived location.

## Article Coverage Workflow

Article coverage is race-specific and separate from the main race-data cache. It is also lazy-loaded now: the initial homepage render does not fetch article pools for the visible competitions until a user clicks `Load Race Coverage`.

For a requested competition group:

1. The server builds a list of article-eligible races from live races plus recent results.
2. A selected race is chosen from query params or defaults to the first race in the group.
3. The app loads or reuses an article pool for that race.
4. It picks up to 8 articles for display.
5. A refresh token rotates to a different batch of articles from the ranked pool.

### Race article query generation

The app generates multiple search variants from race titles and page titles. It normalizes punctuation, removes year prefixes where appropriate, and handles women-specific naming variants such as `Women` and `Femmes`.

For live multi-stage races with a current stage snapshot, it also adds targeted stage-result variants such as:

- `"<race>" <year> stage <n>`
- `"<race>" stage <n> results`
- `"<race>" "<latest winner>" stage <n>`

### Filtering and ranking

Articles are scored using several signals:

- Publisher reputation
- Whether the title/description matches race tokens
- Whether it looks like results / victory / preview coverage
- Recency
- For live stage races, whether it mentions the current stage number or latest stage winner

It also filters out:

- wrong-edition articles
- articles that mention conflicting years
- likely women's articles for men's races
- likely men's articles for women's races
- duplicate title/publisher combinations

Recognized top-tier publishers have manually assigned scores. If any top-tier coverage exists for a race, lower-tier coverage is suppressed from the final pool.

For active stage races, the final 8 articles are also intentionally blended:

- current-stage reports are favored first
- broader race-context stories are still retained when available
- remaining slots are filled from the best overall articles

### Article rotation

If more than 8 strong articles exist, the app does not simply take the top 8. It uses deterministic seeded ordering plus a `refresh` counter so the user can rotate through multiple batches without introducing full randomness on every page load.

## Caching Model

There are several independent in-memory caches.

### Race metadata caches

- `raceMetadataCache` for homepage metadata
- `deferredRaceMetadataCache` for the full/deferred metadata path
- TTL: 60 minutes
- Store `updatedAt`, `data`, and `promise`

Homepage metadata is intentionally lighter than the deferred/full metadata path. The homepage metadata builder only parses the WorldTour pages and lets some location enrichment continue in the background.

### Race data caches

- `raceDataCache` for homepage data
- `deferredRaceDataCache` for full `/api/races`
- group-specific deferred section caches for `proseries` and `europe-tour`
- Live-race TTL: 60 seconds
- Store `updatedAt`, `data`, and `promise`

The `promise` field prevents duplicate upstream fetch work when concurrent requests arrive during a refresh.
Once any race payload has been built, expired payloads without active live races can still use stale-while-revalidate behavior. For active live-race payloads, the app now rebuilds immediately once the cache expires so today’s stage results are less likely to lag behind official publication.
True cold starts are the expensive case. They can be noticeably slower because the app may need to rebuild race data from several live upstream sources while also respecting Wikipedia retry and throttling behavior.

### Article cache

- Map: `articleCache`
- Keyed by race id / page title
- TTL: 15 minutes
- Stores the same `updatedAt` / `data` / `promise` pattern

Expired article-cache entries also refresh in the background once prior article data exists.

Operational implications:

- Cache is per-process only
- Cache disappears on restart/redeploy
- Multi-instance deployments do not share cache state
- First request after a true cold start can be slower
- The homepage and full API now have different cold-start profiles. `/api/homepage-data` is the user-visible readiness path for the initial page, while `/api/races` may still take longer because it includes deferred sections.
- Active stage-race updates are intentionally fresher than before because live data now revalidates on a shorter cadence and does not always serve stale results first.
- The slowdown is usually dominated by upstream fetch latency and Wikipedia rate limiting, not server-side HTML rendering
- The warmup screen on `/` exists specifically to make cold starts feel intentional instead of looking hung

### Benchmarking

The repo now includes `scripts/benchmark-load.js` so performance changes can be measured rather than guessed.

Useful commands:

- `npm run benchmark:homepage-ready`
  Measures cold-start readiness for `/api/homepage-data`, which is the key metric for the main page experience.
- `npm run benchmark:ready`
  Measures cold-start readiness for `/api/races`.
- `npm run benchmark:load -- --runs=5 --include-deferred --include-coverage`
  Measures warmed response times for the homepage, full API, deferred section endpoints, and coverage endpoints.

The script can also target another environment via `--base-url=<url>`.

## Rendering Model

The UI is server-rendered from string builders. There is no client-side app state beyond form submission behavior.

Major rendering helpers include:

- `buildHtmlPage()`
- `buildCompetitionSection()`
- `buildCoverageBlock()`
- `buildRaceCard()`
- `buildStageRaceCard()`
- `buildUpcomingCard()`
- `buildArticleCard()`

Result and stage-race cards now render rider names with country-flag emoji when a normalized rider country code is available. Recent-result and stage-race cards can also show a race-specific external finish/highlights link via `getRaceFinishVideoUrl()` and `buildRaceFinishLink()`.

The design system is encoded directly in the inline `<style>` block:

- UCI-inspired blue/yellow/red palette
- `Manrope` and `Barlow Semi Condensed` served locally
- card-based layouts
- responsive grid breakpoints

## Browser Interactivity

Client-side JS is still intentionally small, but it now does more than simple form submission:

- Polls `/api/homepage-data` while the homepage is warming
- Loads `UCI ProSeries` and `Europe Tour Spotlight` on demand from hero and in-page buttons
- Shows a loading state for deferred sections before their payload returns
- Loads race coverage on demand for each competition group
- Changing a race selector submits the coverage request
- Clicking refresh increments a hidden refresh token and reloads the coverage block

There is still no frontend framework and no SPA state model. The browser only fetches server-rendered fragments and JSON payloads for these targeted interactions.

## Static Assets

The only committed static assets are font files under `assets/fonts`.

Static file serving has a basic path traversal guard:

- Request path is normalized
- Resolved path must remain inside the `assets` directory

Supported content types are manually mapped by extension.

## Operational Assumptions

These assumptions matter when extending the project:

- External network access is required for useful page loads
- Wikipedia page structures are assumed to remain similar to current raw markup
- Bing News RSS remains accessible and query-compatible
- Official special-case endpoints remain available
- The app is optimized for a small number of concurrent requests, not large-scale throughput
- Failures in upstream sources can degrade or break parts of the page

## Failure Modes

Likely breakpoints:

- Wikipedia changes table or template structure
- Wikipedia updates a live race page unevenly, leaving stage and GC blocks temporarily out of sync
- A race page uses unusual wording or missing fields
- Bing News RSS returns weak or noisy race matches
- Women's / men's name disambiguation misses edge cases
- Official special-case text patterns stop matching
- Deployment environment blocks outbound HTTP requests

Current failure behavior:

- Static asset misses fall through to normal routing
- Upstream fetch/parsing errors in enrichment paths are often swallowed and downgraded to partial data
- Top-level request errors return a 500 HTML error page

## Security / Privacy Notes

- No user accounts
- No form input persistence
- No cookies or sessions
- No database
- No secrets are required by current code
- Umami analytics script is loaded from an external host

Because article links are rendered directly from feed content, keep HTML escaping intact. The server currently escapes display text and inserts URLs into anchor attributes after cleaning.

## Development Workflow

Given the repo structure, changes usually fall into one of these categories:

### 1. Change displayed race scope

Typical files/areas:

- `SEASONS`
- competition-group definitions in `getCompetitionGroups()`
- section copy / labels in render helpers

Examples:

- adding a new calendar
- changing Europe Tour filters
- adjusting max counts for sections

### 2. Improve parsing fidelity

Typical files/areas:

- wikitext cleaning helpers
- date parsing helpers
- stage-race extraction helpers
- official race-provider parsers
- static snapshot data in `data/static-stage-race-snapshots.json`

This is the most brittle and highest-value area for correctness work.

When a single live race is wrong because an upstream page is stale or internally inconsistent, first prefer improving the shared merge / freshness path or adding an official provider before resorting to a tightly scoped correction step. The remaining Romandie GC correction is the current example of a last-resort race-specific patch.

### 3. Improve article relevance

Typical files/areas:

- race name variant generation
- token matching logic
- publisher scoring
- edition/date filtering
- refresh batching

### 4. Change layout or presentation

Typical files/areas:

- inline CSS in `buildHtmlPage()`
- section/card builders
- hero copy and competition descriptions

### 5. Add API consumers or automation

Current API is simple because the UI and API share the same aggregated payload. Any future consumer should start with `/api/races` unless it needs finer-grained endpoints.

## Recommended Workflow for Future Changes

1. Read `server.js` end-to-end before making structural changes.
2. Identify whether the change is in parsing, grouping, or rendering.
3. Preserve current cache semantics unless there is a clear need to change them.
4. If adding new race-specific exceptions, add them through the provider registries or static snapshot data rather than scattering conditionals across render code.
5. When changing article matching, test both men's and women's races because division filtering is heuristic.
6. When changing date logic, verify both UTC race classification and Eastern display formatting.

## Testing and Gaps

There is now a small built-in Node test suite under `test/` that covers parser regressions, official race-source parsing, snapshot merging, cache-TTL behavior, and stage-race card rendering. Current fixtures include La Vuelta Femenina official rankings HTML, Tour of Greece official results HTML, and static snapshot coverage for Grande Prémio Anicolor.

Run it with:

```bash
npm test
```

The project still lacks several safeguards:

- Limited fixture coverage beyond the current parser regressions
- No schema validation for external data
- No typed interfaces
- No CI config in-repo
- No explicit Node engine declaration
- No structured logging beyond startup message

If the project grows, the best next quality investment would be fixture-driven tests for:

- season page parsing
- stage-race extraction
- Vuelta Asturias official parsing
- one-day result rendering fallbacks
- article filtering/ranking behavior

## Suggested Near-Term Improvements

If another agent is taking over development, these are strong candidates:

1. Split `server.js` into modules:
   `data-sources`, `parsers`, `articles`, `render`, and `server`
2. Add parser fixtures so Wikipedia changes can be detected quickly.
3. Add an explicit Node engine and a minimal lockfile policy.
4. Add health-oriented logging around upstream fetch failures and cache refreshes.
5. Externalize season/year configuration so rolling to a new season is safer.
6. Move inline HTML/CSS/JS into template/static modules if the app becomes larger.

## Practical Notes for an LLM Taking Over

- Do not assume there is a frontend app hidden elsewhere. There is not.
- Do not assume there is a database or ORM. There is not.
- Do not assume npm packages are available for parsing or routing. The current design deliberately avoids them.
- Most bugs will come from upstream content drift, not from complex internal state.
- The fastest way to make safe changes is usually to preserve the existing pipeline and improve a narrow parser or grouping rule.
- When debugging data issues, inspect the upstream raw Wikipedia page or official race result page first.
- Be alert to stale-but-parseable official pages. The Giro classifications page can expose current rows even when its metadata still references the previous edition.
- One-day races should never render through the stage-race card path, even if upstream content exposes a `stages = 1` field.
- Empty standings arrays should be treated as missing data. Result selection and rendering intentionally prefer the first non-empty standings list and otherwise fall back to the stored winner / podium fields.
- Some race-specific snapshots are intentionally time- or season-bounded. Before reusing them for a new edition, confirm that the page title, race year, and live window checks still match the current calendar.
- When adding exceptions for a race, prefer a contained special-case function over weakening global heuristics.

## Current Project Facts

- Entrypoint: `server.js`
- Package manager usage: effectively none beyond `npm start`
- Dependency count: zero third-party packages
- Runtime state: in-memory only
- Primary transport: server-rendered HTML plus one JSON API
- Deployment style: suitable for a simple single-process container/service

This summary should be treated as the baseline mental model for future development unless the repo structure changes substantially.
