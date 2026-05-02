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
├── package.json
├── README.md
└── server.js
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

`package.json` defines only one script:

- `start`: `node server.js`

There is currently:

- No test script
- No build script
- No lint script
- No formatter config in-repo

## Endpoints

- `/`
  Returns the fully rendered HTML application.
- `/api/races`
  Returns the aggregated race payload as JSON.
- `/assets/*`
  Serves static assets from the local `assets` directory.

Any other route returns a simple 404 HTML page.

## High-Level Architecture

The app follows a single-process request/response model:

1. An incoming request reaches the Node `http` server.
2. If the request is for `/assets/*`, the file is served directly.
3. Otherwise the server loads or reuses cached race data.
4. For `/api/races`, it returns the cached aggregated JSON.
5. For `/`, it additionally loads article coverage for the selected race in each competition group, renders the page, and returns HTML.

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

### Secondary source: Google News RSS

Race coverage articles are pulled from Google News RSS search feeds, using several search queries per race name variant. The app then filters, deduplicates, and scores those results.

Used for:

- Article title
- Source / publisher
- Description
- Link
- Publication date

### Special official sources

Some races use race-specific fallback logic because Wikipedia is not sufficient for live or timely stage detail.

Current special cases:

- Tour de Romandie
  Hard-coded prologue snapshot logic for the first day only
- Vuelta Asturias
  Pulls posts from the official WordPress JSON API and extracts stage / GC information from Spanish-language text
- Eschborn-Frankfurt
  Pulls the official rankings page to recover top-five one-day results when the current-edition Wikipedia race page is missing
- Selected 2026 Europe Tour stage races
  Use bounded fallback snapshots when the current upstream race pages do not expose complete stage / GC result blocks
- Grande Prémio Anicolor
  Uses a date-bounded live fallback snapshot while the current edition is in progress and upstream live stage data is still sparse

This special-case logic is centralized behind `getOfficialStageRaceSource()`, `loadOfficialStageRaceSnapshot()`, `getOfficialOneDayResultSource()`, and `loadOfficialOneDayResultStandings()`.

## Data Model and Aggregation Flow

The central pipeline is `loadRaceData()`.

At a high level it does the following:

1. Fetch each configured season page from Wikipedia.
2. Parse the season tables into normalized race objects.
3. Remove cancelled or malformed rows.
4. Split races into display buckets based on date and category.
5. Enrich selected races with better location data.
6. Enrich recent or live races with standings and stage-race snapshots.
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

If a race has official special-case logic, that is attempted first.

One practical complication: live Wikipedia race pages can be only partially updated. A stage result block may be current while the general-classification block is still from the previous stage. When that happens, prefer a narrow correction layer for the affected race over loosening the global parser in a way that could degrade other races.

### Location enrichment

Season tables sometimes give weak or coded locations, so the app fetches the individual race page and tries to improve `location` by reading:

- infobox `location`
- lead paragraph phrasing

If the extracted string looks implausible, it falls back to the season-table-derived location.

## Article Coverage Workflow

Article coverage is race-specific and separate from the main race-data cache.

For each competition group on the HTML page:

1. The server builds a list of article-eligible races from live races plus recent results.
2. A selected race is chosen from query params or defaults to the first race in the group.
3. The app loads or reuses an article pool for that race.
4. It picks up to 8 articles for display.
5. A refresh token rotates to a different batch of articles from the ranked pool.

### Race article query generation

The app generates multiple search variants from race titles and page titles. It normalizes punctuation, removes year prefixes where appropriate, and handles women-specific naming variants such as `Women` and `Femmes`.

### Filtering and ranking

Articles are scored using several signals:

- Publisher reputation
- Whether the title/description matches race tokens
- Whether it looks like results / victory / preview coverage
- Recency

It also filters out:

- wrong-edition articles
- articles that mention conflicting years
- likely women's articles for men's races
- likely men's articles for women's races
- duplicate title/publisher combinations

Recognized top-tier publishers have manually assigned scores. If any top-tier coverage exists for a race, lower-tier coverage is suppressed from the final pool.

### Article rotation

If more than 8 strong articles exist, the app does not simply take the top 8. It uses deterministic seeded ordering plus a `refresh` counter so the user can rotate through multiple batches without introducing full randomness on every page load.

## Caching Model

There are two independent in-memory caches.

### Race data cache

- Global object: `cache`
- TTL: 15 minutes
- Stores `updatedAt`, `data`, and `promise`

The `promise` field prevents duplicate upstream fetch work when concurrent requests arrive during a refresh.

### Article cache

- Map: `articleCache`
- Keyed by race id / page title
- TTL: 15 minutes
- Stores the same `updatedAt` / `data` / `promise` pattern

Operational implications:

- Cache is per-process only
- Cache disappears on restart/redeploy
- Multi-instance deployments do not share cache state
- First request after cache expiry can be slower

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

The design system is encoded directly in the inline `<style>` block:

- UCI-inspired blue/yellow/red palette
- `Manrope` and `Barlow Semi Condensed` served locally
- card-based layouts
- responsive grid breakpoints

## Browser Interactivity

Client-side JS is minimal and only handles coverage form behavior:

- Changing a race selector submits the form
- Clicking refresh increments a hidden refresh token and submits the form

There is no SPA behavior, no hydration, and no XHR/fetch from the browser.

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
- Google News RSS remains accessible and query-compatible
- Official special-case endpoints remain available
- The app is optimized for a small number of concurrent requests, not large-scale throughput
- Failures in upstream sources can degrade or break parts of the page

## Failure Modes

Likely breakpoints:

- Wikipedia changes table or template structure
- Wikipedia updates a live race page unevenly, leaving stage and GC blocks temporarily out of sync
- A race page uses unusual wording or missing fields
- Google News RSS returns weak or noisy race matches
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
- official race-specific snapshot functions

This is the most brittle and highest-value area for correctness work.

When a single live race is wrong because an upstream page is stale or internally inconsistent, prefer adding a tightly scoped correction step for that race rather than weakening shared parsing heuristics. The 2026 Tour de Romandie Stage 3 GC correction is the model for that approach.

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
4. If adding new race-specific exceptions, keep them behind `loadOfficialStageRaceSnapshot()` rather than scattering conditionals across render code.
5. When changing article matching, test both men's and women's races because division filtering is heuristic.
6. When changing date logic, verify both UTC race classification and Eastern display formatting.

## Missing Tooling / Gaps

The project currently lacks several safeguards:

- No automated tests
- No fixture-based parser tests
- No schema validation for external data
- No typed interfaces
- No CI config in-repo
- No explicit Node engine declaration
- No structured logging beyond startup message

If the project grows, the best next quality investment would be fixture-driven tests for:

- season page parsing
- stage-race extraction
- Vuelta Asturias official parsing
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
- When debugging data issues, inspect the upstream raw Wikipedia page or feed content first.
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
