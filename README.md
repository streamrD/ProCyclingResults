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
- Elite road national champions by country
- Race-specific article coverage

The current content model is intentionally focused on three sections:

- Men's WorldTour
- Women's WorldTour
- National Championships

The app previously included UCI ProSeries and Europe Tour Spotlight sections. Those sections were retired from the active UI and API on 2026-06-22 so the project can focus on the highest-value coverage: men's WorldTour, women's WorldTour, and national championships. Their restoration reference is kept in `archive/proseries-europe-tour-sections.js`.

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
├── archive/
│   └── proseries-europe-tour-sections.js
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
  Returns the active homepage payload used by `/`. This contains WorldTour race data plus national championships.
- `/api/races`
  Returns the active aggregated race payload as JSON. It currently mirrors the WorldTour plus national championship product scope.
- `/api/competition-section?group=<id>`
  Reserved for deferred section fragments. No deferred groups are active right now; retired `proseries` and `europe-tour` requests return `410`.
- `/api/competition-coverage?group=<id>`
  Returns article coverage for a specific competition group. Coverage is loaded on demand rather than during the initial page render.
- `/assets/*`
  Serves static assets from the local `assets` directory.

Any other route returns a simple 404 HTML page.

## High-Level Architecture

The app follows a single-process request/response model:

1. An incoming request reaches the Node `http` server.
2. If the request is for `/assets/*`, the file is served directly.
3. `/api/homepage-data` and `/api/races` load or reuse the active WorldTour plus national championship payload.
4. `/api/competition-section` is retained for future deferred sections, but there are no active deferred sections currently.
5. `/api/competition-coverage` loads article coverage on demand for the requested active WorldTour section.
6. `/` renders the shell plus inline client JS that warms the homepage payload and lazy-loads article coverage.

There is no persistence layer. All state is in memory and rebuilt from live upstream sources when caches expire.

## Data Sources

The app depends on live external content. This is the most important operational fact about the project.

### Primary source: Wikipedia raw wikitext

The main race schedule/results pipeline reads raw wikitext from season pages such as:

- `2026_UCI_World_Tour`
- `2026_UCI_Women's_World_Tour`

The application fetches raw page content via:

- `https://en.wikipedia.org/w/index.php?title=<PAGE>&action=raw`

It parses season tables, race pages, infobox fields, result templates, and stage-race sections directly from raw wiki markup using regular expressions and string heuristics.

Retired ProSeries and Europe Tour season configuration is archived in `archive/proseries-europe-tour-sections.js`; it is not part of the active season fetch list.

### National championships source

National championship results are parsed from the Cyclingnews 2026 Road National Champions index:

- `https://www.cyclingnews.com/pro-cycling/racing/2026-road-national-champions-index/`

The parser reads the `2026 Elite Road National Champions` table and extracts country-level elite men's and women's individual time trial and road race winners. Empty placeholder cells are treated as missing results. The app then expands each country row into four event-level records so the UI can prioritize completed results and filter by country or category.

Some championship event records have small local metadata overrides for known date, location, podium, source report, or finish-video information. Keep these narrow and source-backed; the broad winner list should continue to come from the Cyclingnews index.

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
  Uses the official livefeed plus the official classifications page for stage / GC coverage when Wikipedia is still sparse. Giro finish-video links are sourced first from official livefeed `Last Km` video entries, with a small explicit fallback map retained for resilience. The shared Giro standings parser now accepts both the older `h5.position` row markup and the newer `div.position` variant used by current official pages.
- Giro d'Italia Women
  Pulls the official rankings page plus the current stage rankings page from `giroditaliawomen.it` to recover live GC and stage standings when Wikipedia is sparse or only partially updated.
- Vuelta Asturias
  Pulls posts from the official WordPress JSON API and extracts stage / GC information from Spanish-language text
- Vuelta a Burgos Feminas
  Pulls the official WordPress post feed plus the linked liveblog JSON endpoint to recover current stage results and a bounded GC fallback when upstream race pages are thin
- Eschborn-Frankfurt
  Pulls the official rankings page to recover top-five one-day results when the current-edition Wikipedia race page is missing
- Grande Prémio Anicolor
  Uses a date-bounded live fallback snapshot while the current edition is in progress and upstream live stage data is still sparse

This source logic is centralized behind provider registries plus `loadOfficialStageRaceSnapshot()` and `loadOfficialOneDayResultStandings()`.

## Data Model and Aggregation Flow

The central pipeline is `loadRaceData()`. The active path powers `/`, `/api/homepage-data`, and `/api/races` with WorldTour race data plus national championships. The older `includeDeferred` option remains in code as a restoration hook for previously deferred sections, but no deferred groups are active.

At a high level it does the following:

1. Fetch the active WorldTour season pages from Wikipedia.
2. Parse the season tables into normalized race objects.
3. Remove cancelled or malformed rows.
4. Split races into display buckets based on date and category.
5. Enrich selected races with better location data.
6. Enrich recent or live races with standings and stage-race snapshots.
   Official and Wikipedia-derived stage-race data are merged field-by-field rather than treated as all-or-nothing snapshots.
   Wikipedia fetches are rate-limited and retried because fresh live-race refreshes can otherwise hit upstream `429` responses during busy race windows.
   Cold-cache latency is therefore mostly an upstream-fetch problem rather than a rendering problem: live race rebuilds can touch multiple Wikipedia and official race pages, and the Wikipedia throttling guard intentionally trades speed for safer refresh behavior.
7. Fetch and parse the national championship index, then expand rows into event-level records.
8. Mark races that finished today.
9. Assign stable `id` values from page titles.
10. Return the aggregate payload and cache it in memory.

The returned JSON shape currently contains:

- `fetchedAt`
- `metadataFetchedAt`
- `recentResults`
- `finalizedStageRaces`
- `liveStageRaces`
- `upcomingRaces`
- `nationalChampionships`

Legacy `europeTour*` keys may still appear internally as empty backward-compatible fields while the retired code is being preserved, but they are not active UI sections.

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

- `raceMetadataCache` for active WorldTour metadata
- `deferredRaceMetadataCache` retained as a legacy restoration hook
- TTL: 60 minutes
- Store `updatedAt`, `data`, and `promise`

The active metadata builder parses the WorldTour pages and lets some location enrichment continue in the background.

### Race data caches

- `raceDataCache` for the active homepage/API payload
- `deferredRaceDataCache` and group-specific deferred section caches retained as legacy restoration hooks
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
- `/api/homepage-data` is the user-visible readiness path for the initial page; `/api/races` currently uses the same active scope.
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
  Measures warmed response times for the homepage, full API, optional deferred section endpoints, and coverage endpoints. With no active deferred groups, deferred section measurements are mostly useful when restoring archived sections.

The script can also target another environment via `--base-url=<url>`.

## Rendering Model

The UI is server-rendered from string builders. There is no client-side app state beyond form submission behavior.

Major rendering helpers include:

- `buildHtmlPage()`
- `buildCompetitionSection()`
- `buildCoverageBlock()`
- `buildRaceCard()`
- `buildStageRaceCard()`
- `buildNationalChampionshipsSection()`
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
- Filters National Championships cards by country and category; the default view shows completed events first, while country-specific selections can reveal scheduled or TBD events.
- Keeps deferred-section loading utilities available for future sections, though none are active right now
- Loads race coverage on demand for each active competition group
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

- `ACTIVE_SEASONS`
- competition-group definitions in `getCompetitionGroups()`
- section copy / labels in render helpers
- national championship parser/render helpers when changing championship coverage
- `NATIONAL_CHAMPIONSHIP_EVENT_METADATA` for narrow date, location, podium, source-report, and finish-video overrides

Examples:

- adding a new calendar
- restoring an archived ProSeries or Europe Tour section from `archive/proseries-europe-tour-sections.js`
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

### Retired sections

The UCI ProSeries and Europe Tour Spotlight sections were implemented previously and retired from the active app on 2026-06-22. The archived config lives in `archive/proseries-europe-tour-sections.js`. To restore those sections, reintroduce the archived season configs into the active season list, re-enable deferred group IDs, review the old group-data builder paths, update docs, and rerun the parser regression suite plus endpoint checks.

## Recommended Workflow for Future Changes

1. Read `server.js` end-to-end before making structural changes.
2. Identify whether the change is in parsing, grouping, or rendering.
3. Preserve current cache semantics unless there is a clear need to change them.
4. If adding new race-specific exceptions, add them through the provider registries or static snapshot data rather than scattering conditionals across render code.
5. When changing article matching, test both men's and women's races because division filtering is heuristic.
6. When changing date logic, verify both UTC race classification and Eastern display formatting.

## Testing and Gaps

There is now a small built-in Node test suite under `test/` that covers parser regressions, official race-source parsing, national championship parsing/rendering, snapshot merging, cache-TTL behavior, and stage-race card rendering. Current fixtures include La Vuelta Femenina official rankings HTML, Tour of Greece official results HTML, Giro and Giro Women official standings markup variants, and static snapshot coverage for Grande Prémio Anicolor.

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
- national championship source drift beyond the current table fixture
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
