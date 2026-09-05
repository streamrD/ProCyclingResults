# Pro Cycling Results

This repository is a small, self-contained Node.js application that serves a server-rendered web page for current professional cycling coverage. It combines race schedule/results data with race-specific news coverage and exposes both an HTML UI and a JSON API.

The codebase is intentionally minimal:

- No frontend framework
- No backend framework
- No database
- No third-party npm dependencies
- One runtime entrypoint: `server.js`

This README is written as a technical handoff for a future engineer or LLM agent that needs enough context to extend or debug the project without relying on prior chat history.

## Companion Handoff File

Use `handoff.md` alongside this README when transferring the project to another AI or engineer. This README is the durable architecture and runbook reference; `handoff.md` is the current cross-reference map with local audit notes, code landmarks, known sharp edges, and suggested first checks for a new agent.

## Product Purpose

The app is a live race desk for selected 2026 UCI calendars. It surfaces:

- Recent one-day race results
- Live multi-stage race standings
- Finalized stage-race classifications
- Upcoming races
- A season calendar: every WorldTour race drawn to scale on one timeline
- Elite road national champions by country, grouped by continent
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
- Small inline browser script for stage chips, unit and profile preferences, and the news line on each race card
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
│   ├── favicon.svg
│   ├── og-default.jpg
│   ├── og-calendar.jpg
│   ├── og-championships.jpg
│   └── fonts/
├── archive/
│   └── proseries-europe-tour-sections.js
├── data/
│   ├── about.md
│   ├── release-notes.md
│   ├── continent-map.json
│   ├── stage-profiles.json
│   └── static-stage-race-snapshots.json
├── design-comps/
│   ├── favicon-directions.html
│   ├── marks/            (cyclist.svg ships; five earlier candidates kept)
│   └── README.md
├── handoff.md
├── package.json
├── README.md
├── scripts/
│   ├── benchmark-load.js
│   ├── build-continent-map.js
│   └── refresh-stage-profiles.js
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
- `/api/build-info`
  Returns the deployment marker from `BUILD_INFO` in `server.js`. On Railway it reflects the deployed commit, branch and message from `RAILWAY_GIT_*` environment variables; elsewhere it falls back to hardcoded values. The `source` field says which — `railway-env` or `hardcoded-fallback` — so a fallback marker is never mistaken for the live commit.
- `/api/competition-section?group=<id>`
  Reserved for deferred section fragments. No deferred groups are active right now; retired `proseries` and `europe-tour` requests return `410`.
- `/api/race-news?race=<race id>`
  Returns the "Latest news" line for one live or recent race, rendered from its article pool. The page fills placeholder lines from it as cards scroll into view.
- `/api/race-stages?race=<race id>`
  Returns `{ raceId, html }` with a re-rendered stage switcher for one finished stage race, after reading its companion stage articles. The id must match a race already in the homepage payload (`findStageRaceById`), so it cannot be used to fetch an arbitrary Wikipedia page; anything else returns `404`.
- `/calendar` and `/championships`

  Share paths. Each serves the same results page as `/` (and the same warm-up page while data loads) with its own link-preview image and description from `SHARE_VIEWS`, then jumps to its section once the page loads and settles on the `/#section` URL. They exist because a URL fragment never reaches the server, so `/#season-calendar` cannot get a different preview from `/`. Previews: `/assets/og-default.jpg` (a Vuelta stage profile), `/assets/og-calendar.jpg` (the timeline) and `/assets/og-championships.jpg` (the map), all 1200×630, all rendered from the site's real visuals; `buildShareMetaTags()` writes the Open Graph and Twitter tags on every page.

- `/release-notes` and `/about`

  Server-rendered pages built from `data/release-notes.md` and `data/about.md` through a small in-house Markdown renderer (`renderMarkdown`: headings, paragraphs, bullets, rules, bold, italics, inline code and http(s) or site-relative links; everything HTML-escaped first). When `SITE_EDIT_TOKEN` is set the page carries an "Edit this page" control.

- `POST /api/site-content`

  Saves one of those pages. Requires `Authorization: Bearer <SITE_EDIT_TOKEN>` (compared in constant time), a JSON body `{ page, markdown }` under 256 KB, writes `data/<page>.md` so the change is live at once, and, when `GITHUB_CONTENT_TOKEN` is set, commits the file to `GITHUB_CONTENT_REPO` (default `streamrD/ProCyclingResults`) on `GITHUB_CONTENT_BRANCH` (default `main`) through the GitHub Contents API so the next deploy carries it. Without the GitHub token the response says the edit will not survive the next deploy. With no `SITE_EDIT_TOKEN` at all the endpoint answers `403` and the pages render read-only.

- `/assets/*`
  Serves static assets from the local `assets` directory.

Any other route returns a simple 404 HTML page.

## High-Level Architecture

The app follows a single-process request/response model:

1. An incoming request reaches the Node `http` server.
2. If the request is for `/assets/*`, the file is served directly.
3. `/api/homepage-data` and `/api/races` load or reuse the active WorldTour plus national championship payload.
4. `/api/competition-section` is retained for future deferred sections, but there are no active deferred sections currently.
5. `/api/race-news` renders one race's news line on demand; the page asks for it as each card scrolls into view.
6. `/` renders the shell plus inline client JS that warms the homepage payload and fills the news lines.

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

The parser reads the `2026 Elite Road National Champions` table and extracts country-level elite men's and women's individual time trial and road race winners. Empty placeholder cells are treated as missing results. The app then expands each country row into four event-level records; `groupNationalChampionshipsByContinent()` folds those back into one row per federation, bucketed by `CONTINENT_BY_ALPHA2` (geographic continents, so the Americas split the way their championship windows do).

Above the continent groups sits a world map (`buildNationalChampionshipMapMarkup`): every country outline from `data/continent-map.json`, shaded by the same groups the tables use (blue for a recorded champion, hatched for a federation without a result, pale for countries not in the index, a dot for the ten federations too small to draw). Hovering a continent shows its count; clicking opens its group. The shape file is built by `npm run refresh:continent-map` from Natural Earth's public-domain 1:110m countries, projected and simplified, and committed like the stage profiles. A test fails if any federation in the index lacks a shape or a dot.

The index carries no dates. The schedule strip therefore draws two hatched "typical" windows from `NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS` (southern hemisphere in January–February, Europe and North America in late June) and plots confirmed dates only where `NATIONAL_CHAMPIONSHIP_EVENT_METADATA` has them. The hatching and the "typical, not confirmed" wording are deliberate: a band that looked like measured data would mislead.

Some championship event records have small local metadata overrides for known date, location, podium, source report, or finish-video information. Keep these narrow and source-backed; the broad winner list should continue to come from the Cyclingnews index.

### How we treat our sources

`DATA-SOURCES.md` is the public statement of what the site reads, how often, and how to reach us. It is the URL in the server's user agent (`FETCH_USER_AGENT`); set `SOURCE_CONTACT` in the deployment environment to an email address and it is appended so a site operator can reach a person. Keep that document's table current whenever fetch frequency or caching changes, and add a dated line to its review log.

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
- Tour de France
  Pulls the official letour.fr rankings page (same ASO platform as the Tour Auvergne / La Vuelta Femenina providers) to recover the full stage top five and general classification within minutes of a stage finish, well ahead of Wikipedia. letour.fr's current markup keeps the rank inside a `<span>` and the rider's full name only in the profile-link slug, so it uses a dedicated `parseLetourOfficialStandings` rather than the shared ASO parser. Gated to the 2026 edition from its start date onward.
- Tour de France Femmes
  `letourfemmes.fr` is the same ASO rankings deployment as `letour.fr`, so it reuses every Tour de France parser through a shared `fetchAsoTourRankingsSnapshot`; the two differ only in entry point, expected page title and default stage count (9 vs 21). Gated to the 2026 edition from its start date onward.
- Vuelta a España
  `lavuelta.es` is the same ASO rankings deployment again, so it reuses every Tour de France parser through `fetchAsoTourRankingsSnapshot` and differs only in entry point, expected page title and stage count. It exists because the Vuelta's Wikipedia article routinely publishes a stage result a day before it refreshes the classification tables: with only Wikipedia to go on, the GC trails the latest stage, `mergeStageRaceSnapshots` drops it as stale, and the card renders a stage with no overall standings behind it. Note the page titles itself "La Vuelta", so the stage-number pattern is anchored on the dash to avoid matching the Femenina edition. Gated to the 2026 edition from its start date onward.
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

- Stage profiles (komoot via ASO race sites)

  Live ASO stage races (Vuelta a España, Tour de France, Tour de France Femmes, La Vuelta Femenina) get a per-stage lookup of the organiser's stage page; where it embeds a komoot tour, komoot's public API supplies the distance, climbing total and altitude trace that draws the card's stage profile. Only lavuelta.es embeds komoot at the time of writing; the others fall back to an obviously schematic pictogram for the Wikipedia route table's stage type, with a note that no profile is available. Generic must look generic — never a plausible fake profile. Budgeted per build, cached for a week, current edition only. See "Stage Results Feature Map" in `handoff.md`.

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
   Every `fetchText` request also carries a per-attempt timeout (`FETCH_TIMEOUT_MS`), so a hung upstream is aborted and retried rather than stalling a synchronous live-race rebuild indefinitely.
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
- `seasonCalendar` — every WorldTour race of the season with ISO `startDate`/`endDate`, `status` (`finished`, `live`, `upcoming`, `cancelled`), `tier` (`grand-tour`, `monument`, `stage-race`, `one-day`), winner and the `anchor` id of its card; built by `buildSeasonCalendar()` from `metadata.allRaces`, so it costs no extra fetch

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
- `stageRace` when applicable, including `stages` for multi-day races and `classificationLeaders` (the jersey holders after the latest stage: `{ stageNumber, stageLabel, entries: [{ key, label, jersey?, rider, countryCode? }] }`)
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
- the leader of every classification after the latest stage (the jersey holders)
- final overall result
- a per-stage history in `stageRace.stages` (see below)

It does this from Wikipedia race pages when possible by parsing:

- `{{cyclingresult ...}}` blocks
- stage result sections
- GC sections
- classification standings wikitables captioned `General classification after Stage N`
- the "Classification leadership" table, one row per stage and one column per jersey, read through a rowspan-aware grid
- route/stage winner tables
- infobox first/second/third fields

Four page-shape variations are worth knowing about, because each silently produced an empty or shallow snapshot until it was handled:

- Grand Tour pages (Tour de France, Tour de France Femmes) publish in-progress standings as plain wikitables rather than `{{cycling result start}}` blocks, which is what `extractClassificationTableGcSnapshots` reads. Prefer it over the classification-leadership table for the GC, because it carries full standings where the leadership table names only the leader.
- The "Classification leadership" table (one row per stage, one column per jersey) is read by `extractClassificationLeadershipRows` through `parseWikiTableGrid`, which expands its `rowspan`/`colspan` cells into a positional grid first. Reading that table's cells by index — the earlier approach — returns a neighbouring column on any row after the first, which is how it once reported the wrong GC leader. It now feeds `stageRace.classificationLeaders` (the jersey holders the card lists under the GC) and, leader-only, the GC fallback.
- Rider cells use several redirects of the same template interchangeably — `{{flagathlete}}`, `{{Flagathlete}}` and `{{Flag athlete}}`. The spaced spelling is now the most common one on Tour de France pages, so `parseAthleteDetails` matches all of them; a name-only match drops every rider on those pages.
- A team time trial classifies teams, not riders, and the page carries only a team code (`{{UCI team code|TVL men|2026}}`) — in the result row, the route table and the Teams section alike. `resolveTeamNames()` expands those codes through Wikipedia's `action=expandtemplates` API in one batched, cached request rather than through a hardcoded table that would go stale each season, and the resolved name occupies the rider slot so the existing podium markup renders it unchanged.
- The `{{cyclingresult start}}` tag does not always put `title=` first (`|rider=no|title=…` on team time trials), does not always fit on one line (a wrapped citation), and does not always have a matching `{{cyclingresult end}}`. `extractCyclingResultBlocks()` handles all three; before it did, a dropped start tag paired the next block's title with a later block's body and whole stages disappeared.
- `{{cyclingresult|1|[[Rider]]|ESP|{{UCI team code|...}}|4h 47' 47"}}` keeps the country and the finishing time in their own positional arguments, not inside the rider cell. `parseCyclingResultLine` reads them by shape rather than by index — the country is the only bare alpha token among the trailing arguments and the time the only clock-shaped one — so an absent team or jersey argument does not shift them. Reading only the rider cell dropped every flag and every time on these pages.
- Longer stage races publish only a winner column on the main article and put the real stage podiums on companion articles (`2026 Vuelta a España, Stage 1 to Stage 11`). The route table links them, so `extractStageArticleTitles` reads the titles off the page rather than guessing a naming convention, and `loadStageArticleTexts` fetches them (capped by `MAX_STAGE_ARTICLES`, failures degrade to the main article alone). This is not a Grand Tour convention: La Vuelta Femenina links them too, and any race that does gets a deep history for free.

Companion articles are read at build time for live and finished stage races alike. They were briefly restricted to live races when the cold start was ~20s and their ~2s mattered; budgeting the official-provider lookups took the build to ~6s, so finished Grand Tours now render their stage podiums directly. `/api/race-stages` remains as an on-demand fallback, cached for six hours and written back onto the cached race; its "Load full stage results" control only appears when a card's history is still winner-only. Note that many shorter stage races publish their podiums inline on the main article and are already deep without any of this.

`mergeLatestStageIntoHistory()` folds an official provider's current stage into `stageRace.stages` during the snapshot merge. This is load-bearing rather than tidying: providers report only the current stage but report it better than the route table — the 2026 Tour's route table stops at stage 20 while letour.fr has stage 21 five riders deep — and the stage strip renders `stages` alone, so anything not folded in is silently discarded.

Companion articles feed **stage results only**. They also repeat a `General classification after Stage N` block, but those are hand-copied and drift — on the 2026 Vuelta the stage 2 GC block still carried the stage 1 leader time, which would contradict the gaps rendered beneath it. The main article's classification wikitable stays authoritative for GC, and `findOverallRaceResult` never sees companion blocks, so a `Stage 1 Result` block can never be mistaken for the race's overall result.

`stageRace.stages` is the resulting per-stage history: one entry per stage actually raced, each with `number`, `order`, `label`, optional `date` / `course` from the route table, and `standings`. Entries prefer a companion-article podium and fall back to the route table's winner-only row, so a race with neither still renders as before. `latestStage` is simply the last entry, which keeps the card's headline stage and its stage selector from ever disagreeing. `mergeStageRaceSnapshots` carries the deeper history across the official/parsed merge, since official providers report only the current stage.

If a race has official provider logic, it is loaded alongside the parsed Wikipedia snapshot and the fresher stage, GC, and overall fields are merged independently. On the homepage path that lookup runs against `OFFICIAL_SNAPSHOT_BLOCKING_BUDGET_MS`: a provider slower than the budget stops blocking first paint and is applied by `applyLateOfficialSnapshots()` when it resolves, reusing the in-flight request rather than re-issuing it. Providers are load-bearing for finished races rather than a mere refinement — without one, several Grand Tours render only one to three riders deep and Tour de Romandie drops out of the finalized grid — so they are budgeted, never skipped. Live stage races also apply a simple date-based freshness floor so obviously stale progress is deprioritized, and the mirror-image plausibility bound: a stage or GC claiming a stage number the calendar has not reached (more stages than days elapsed, or a route-table stage dated after today) ranks below any real one and is dropped when it is the only candidate, because Wikipedia editors do caption a table "after stage 13" the evening stage 12 finishes.

One practical complication: live Wikipedia race pages can be only partially updated. A stage result block may be current while the general-classification block is still from the previous stage. When that happens, prefer a narrow correction layer for the affected race over loosening the global parser in a way that could degrade other races.

### Location enrichment

Season tables sometimes give weak or coded locations, so the app fetches the individual race page and tries to improve `location` by reading:

- infobox `location`
- lead paragraph phrasing

If the extracted string looks implausible, it falls back to the season-table-derived location.

## Article Coverage Workflow

Article coverage is race-specific and separate from the main race-data cache, and it is never fetched during the initial page render for recent races: each results card carries a "Latest news" line that is filled on demand. The "Race Coverage" block that used to sit at the foot of each competition section (Load button, race dropdown, Refresh paging, eight article cards) was retired on 2026-09-05 and is archived in `archive/race-coverage-block.js`.

For one race:

1. The card renders its news line from the article cache if that race's pool is already warm, otherwise as a placeholder. Live races start warming their pool at render.
2. The client requests `/api/race-news?race=<id>` when a placeholder scrolls within 240px of the viewport or is tapped.
3. The server loads or reuses the article pool for that race and picks up to 8 articles.
4. The line shows the leading story; opening it lists all eight.

### Race article query generation

The app generates multiple search variants from race titles and page titles. It normalizes punctuation, removes year prefixes where appropriate, and handles women-specific naming variants such as `Women` and `Femmes`.

It also builds result-oriented searches first (so they survive the 32-query cap): for any race with a known winner it adds `"<race>" <year> results report` and winner queries like `"<race>" <year> <winner>`, across the top few name-spelling variants (e.g. `Paris–Roubaix` and `Paris-Roubaix`). A bare `"<race>" <year> cycling` query tends to surface previews/guides; naming the winner is what surfaces the actual result coverage. For live multi-stage races it also adds stage-result variants such as `"<race>" stage <n> results` and `"<race>" "<latest winner>" stage <n>`.

### Filtering and ranking

Articles are scored using several signals:

- Publisher reputation
- Whether the title/description matches race tokens
- Whether it looks like result / victory / report coverage
- Recency (a continuous decay, so newer articles always rank above older ones)
- For live stage races, whether it mentions the current stage number or latest stage winner

Once a race is over, previews, guides, start lists, and "how to watch" pieces are penalized so they sink below actual result coverage.

It also filters out:

- wrong-edition articles (but an article whose publish date falls inside the edition window is trusted even if it references previous editions, e.g. "finally wins after years")
- likely women's articles for men's races
- likely men's articles for women's races
- duplicate title/publisher combinations

Recognized top-tier publishers have manually assigned scores and are listed first in the pool, but they no longer suppress lower-tier coverage entirely — otherwise a single evergreen top-tier "guide" page could crowd out the real result articles, which often come from wire/aggregator sources.

For active stage races, the final 8 articles are also intentionally blended:

- current-stage reports are favored first
- broader race-context stories are still retained when available
- remaining slots are filled from the best overall articles

### Article ordering and rotation

The displayed articles are ordered most-recent-first (bucketed by day, with the highest-scored article leading within a day), so the current result leads instead of an older but higher-scored story. When more than 8 strong articles exist, the `refresh` token pages through older batches.

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
Once any race payload has been built it is always served as it stands, and an expired payload is rebuilt behind the response rather than in front of it. While a race is live (or finished today) the server also rebuilds on a timer, one live TTL after the previous build, so the payload is never much older than a minute even with no visitors and no visitor ever waits on a rebuild. The warm-up page on `/` appears only on a cold start, before the first payload exists.
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
- `npm run benchmark:load -- --runs=5 --include-deferred`
  Measures warmed response times for the homepage, full API, optional deferred section endpoints, and coverage endpoints. With no active deferred groups, deferred section measurements are mostly useful when restoring archived sections.

The script can also target another environment via `--base-url=<url>`.

## Rendering Model

The UI is server-rendered from string builders. There is no client-side app state beyond form submission behavior.

Major rendering helpers include:

- `buildHtmlPage()`
- `buildCompetitionSection()`
- `buildRaceNewsMarkup()`
- `buildRaceCard()`
- `buildStageRaceCard()`
- `buildNationalChampionshipsSection()` (schedule strip, season status, featured cards and the continent-grouped champions table)
- `buildSeasonCalendarSection()` (compact strip, three full views, phone month list, up-next column)
- `buildUpcomingCard()`
- `buildArticleCard()`

Every race card carries `id="race-<slug>"` from `createRaceAnchorId()` so the season calendar can link to it. Result and stage-race cards now render rider names with country-flag emoji when a normalized rider country code is available. Recent-result and stage-race cards can also show a race-specific external finish/highlights link via `getRaceFinishVideoUrl()` and `buildRaceFinishLink()`. National Championships country headers render a larger national flag via `getCountryFlagEmojiByName()` (backed by `COUNTRY_NAME_ALPHA2`, which covers every federation in the Cyclingnews index); individual podium riders in that section are intentionally left flag-free.

Finish-video links resolve in priority order: curated `RACE_FINISH_VIDEO_URLS` overrides, then an official-provider video on the race (e.g. the Giro livefeed `Last Km`), then an automatic YouTube search. The YouTube step runs during the data build (`enrichFinishVideos()`): for recently finished races and the latest stage of a live stage race that lack a curated/official video, it searches `youtube.com/results`, parses the `ytInitialData` JSON (no API key or dependency), and attaches the best match. Selection enforces the exact stage, race year, and division, prefers the race's own official channel and trusted broadcasters, and caches results so the lookup stays cheap. It is strictly additive — it never overrides a curated or official link and degrades silently to no link on failure.

Each stage of a live stage race can carry its own video, so clicking back to stage 1 of a Grand Tour offers that stage's finish rather than nothing. Every helper in this pipeline — the query builder, the cache key, the curated-map lookup, the title matcher — reads the stage off the race object, so `buildStageFinishVideoSubject()` asks about an earlier stage by presenting it as the current one instead of threading a stage argument through all of them. `enrichStageFinishVideos()` runs as a separate bounded pass (`STAGE_FINISH_VIDEO_LOOKUP_LIMIT`) so earlier stages never compete with other races' current stages for `FINISH_VIDEO_LOOKUP_LIMIT`, and it is restricted to live races for the same reason companion stage articles are — a three-week race would otherwise fire twenty searches on one cold start. Results cache per `(race, stage)`, so the backlog fills in over successive refreshes, newest stage first. `getStageFinishVideoUrl()` deliberately ignores a whole-race string entry in `RACE_FINISH_VIDEO_URLS`: that is the video of the race finishing, which belongs to the final stage, not to stage 1.

The design system is encoded directly in the inline `<style>` block:

- UCI-inspired blue/yellow/red palette
- `Manrope` and `Barlow Semi Condensed` served locally
- card-based layouts
- responsive grid breakpoints

### Stage podium times

Stage results show each rider's finishing time and, beside it, the gap to the stage winner. Official providers give both; Wikipedia gives the winner's time and everyone else's gap; a few rows carry times alone. Whichever half is missing is derived from the winner's time (`getStageStandingMetrics`), the gap is recomputed from the two times whenever both exist so a provider's GC gap never lands on a stage row, and a rider on the winner's time reads "s.t.". The general classification keeps its leader-time-then-gaps form. The full rule set is item 6 of "Stage Results Feature Map" in `handoff.md`.

### Stage profiles

Every stage panel opens with a profile block. A stage with a measured trace (see "Stage profiles" under Data Sources) renders compact by default — a colour thumbnail beside type, distance, climbing, source and the km/mi toggle — and expands to a tall chart with an altitude-coloured fill, gridlines, km ticks and start/finish towns. The fill is the site's rainbow strip mapped to height: green valley floor, blue lower slopes, yellow high ground, red summit. A stage without a trace shows a schematic pictogram for its Wikipedia stage type and says so; generic must look generic. Fetched traces are committed to `data/stage-profiles.json` (refresh with `npm run refresh:stage-profiles -- --race "<page title>"`) so deploys and finished races keep them, and a live race gives tomorrow's stage a selectable "next" chip in the strip, a one-line "Up next" row above it, and a preview panel with its course and profile. Full rationale, gaps and the comp history live in `handoff.md` under "Stage Results Feature Map".

## Browser Interactivity

Client-side JS is still intentionally small, but it now does more than simple form submission:

- Polls `/api/homepage-data` while the homepage is warming
- Runs the National Championships map: hovering a continent shows a tooltip with its count and usual window, clicking or pressing Enter opens that continent's group and scrolls to it, and an open group is marked on the map. A category chip re-shades the map to the countries holding that title.
- Filters the National Championships almanac: a search box matches federation or rider names across every continent group (opening the groups with matches and hiding the rest), category chips narrow the table to one title via a `data-category` attribute the CSS reads, and an "include federations without a recorded result" toggle reveals the rows the default view hides.
- Runs the season calendar: the section is hidden until the hero's "Season Calendar" button (or a `#season-calendar` link) opens it and scrolls to it, a close button in its header hides it again, series chips switch between three pre-rendered SVGs, each bar has a tooltip fed from its `data-tip-*` attributes, and clicking a bar whose card is hidden behind "Load more races" reveals it before the jump and flashes the card.
- Keeps deferred-section loading utilities available for future sections, though none are active right now
- Reveals recent results a row at a time: each WorldTour section shows the first `WORLDTOUR_RECENT_RESULTS_STEP` (3) races, and a "Load more races" button reveals the next row up to `WORLDTOUR_RECENT_RESULTS` (12), after which the button removes itself. Revealing more races also adds them to that section's coverage race selector.
- Loads the full stage podiums for a finished stage race on demand, replacing the switcher with the deeper markup returned by `/api/race-stages`. The control appears only when the card's history is winner-only, and never on a live card, whose companion articles were already read at build time.
- Swaps the stage shown on a stage-race card. Each card with two or more raced stages renders a numbered strip covering the whole route — stages not yet raced are disabled — plus one hidden panel per raced stage. A delegated `click` listener on anything carrying `data-stage-target` — the chips and, on a live race, the "Up next" row — toggles `is-active` and panel `hidden` by target, so the strip works inside deferred sections without rebinding, and a 21-stage card stays the height of a 5-stage one. The GC section below always shows the race's current overall regardless of the selected stage. Each panel links its own stage's finish video where one is known. Each panel also opens with a stage profile block — a measured altitude trace where the organiser publishes one (labelled with its source, compact by default and expandable to a tall chart with axes and start/finish markers; the choice is kept in `localStorage` under `pcr-profile-view`), otherwise a schematic stage-type pictogram with a "no elevation profile is available" note — with distance and climbing in metric or imperial. The km/mi toggle is delegated at `document`, stores the choice in `localStorage` (`pcr-units`), and a `MutationObserver` re-applies it to stage markup that arrives later.
- Fills each race card's "Latest news" line from `/api/race-news` as the card scrolls into view, and opens the list in place

There is still no frontend framework and no SPA state model. The browser only fetches server-rendered fragments and JSON payloads for these targeted interactions.

## Static Assets

Committed static assets are the font files under `assets/fonts`, the Open Graph image
the three `assets/og-*.jpg` link-preview images, and `assets/favicon.svg`.

The favicon is a single SVG (a rider and bike in UCI blue and red) linked from both
document heads — the main page and `buildWarmupPage`, which is what a cold instance
serves first. It carries no background plate, so it embeds its own
`prefers-color-scheme` rule to lift both colours against a dark tab bar; anything
replacing it either keeps that rule or brings its own background.

Two things to know before swapping it:

- Assets are served `cache-control: max-age=31536000, immutable`, so replacing a file
  at the same path never reaches anyone holding the old one. Add a version query to the
  `<link>` (`/assets/favicon.svg?v=2`) when the mark changes.
- Alternative marks, and the comparison page the current one was chosen from, are kept
  in `design-comps/`. That page loads the repo's own fonts by relative path, so it only
  renders correctly from inside that folder.

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
- `CONTINENT_BY_ALPHA2` when a new federation appears in the index (a test fails if any alpha-2 code lacks a continent), and `scripts/build-continent-map.js` if it is too small to draw at 1:110m (add it to `TINY_FEDERATIONS`, rerun, commit `data/continent-map.json`)
- `SEASON_CALENDAR_GRAND_TOURS` / `SEASON_CALENDAR_MONUMENTS` for the only two emphasised tiers on the season calendar

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

There is now a small built-in Node test suite under `test/` that covers parser regressions, official race-source parsing (including the letour.fr Tour de France provider), the YouTube finish-video search/selection and per-stage video resolution, national championship parsing/rendering, continent grouping and country-header flags, the season calendar (status and tier classification, row packing, the section markup with card links and the phone month list, and the card anchors), the recent-results row reveal, snapshot merging, cache-TTL behavior, stage-race card rendering, and the per-stage history — companion-article discovery, stage-strip markup, the on-demand load control, and `findStageRaceById` rejecting anything not already on the page — plus stage profiles: route-table distance and type parsing, the komoot trace resampler, the budgeted enrichment and its persisted store, the measured/generic profile markup with both axis sets, and the next-stage chip, row and panel — and jersey holders: the rowspan-aware table grid, the leadership parser against a real 2026 Vuelta table (stage 3 cancelled, every column spanned), the merge bounds, and the card markup. `test/browser-smoke.test.js` drives the real client script in headless Chrome. Current fixtures include La Vuelta Femenina official rankings HTML, Tour of Greece official results HTML, Giro and Giro Women official standings markup variants, Tour de France (letour.fr) rankings and stage-result HTML, Tour de France Femmes (letourfemmes.fr) rankings / stage / GC HTML plus a live Femmes race wikitext page, Vuelta a España (lavuelta.es) rankings / stage / GC HTML, a trimmed 2026 Vuelta main article and its companion stage article, the 2026 Vuelta's classification leadership section as of stage 13, and a synthetic YouTube `ytInitialData` search result.

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

### Jersey holders

Beside the general classification podium, every stage-race card lists who leads each classification after the latest stage: general, points, mountains, young rider, team, and any race-specific column the article carries (the Giro's intermediate-sprint, Red Bull KM and breakaway classifications, Pologne's active-rider and Polish-rider jerseys). Each row has a jersey swatch in the colour Wikipedia's `{{cjersey}}` template names for it — polka dots drawn as dots, an unknown colour drawn as an outlined blank rather than a guess — the classification, and the rider with a flag. The combativity award is left out on purpose because it is a per-stage prize, not a jersey anyone holds.

The data is the article's "Classification leadership" table, the only place Wikipedia states the points, mountains and young-rider leaders. Its cells span rows, so `parseWikiTableGrid` expands the spans into a positional grid before `extractClassificationLeadershipRows` reads the columns; a team cell resolves through the same `{{UCI team code}}` map as team time trials. The merge keeps the field from whichever snapshot has it (only Wikipedia does), bounded by the same calendar rule as the GC; a list one stage behind the official provider is kept and labelled "Jersey holders after stage N" rather than dropped. The layout is a container query on the card: stacked below the podium on a phone, a narrow second column beside it on the usual three-across grid, and two bounded columns packed to the left on a full-width card. Item 7 of "Stage Results Feature Map" in `handoff.md` has the full rules, the layout table and the history.

## Suggested Near-Term Improvements

If another agent is taking over development, these are strong candidates:

1. Split `server.js` into modules:
   `data-sources`, `parsers`, `articles`, `render`, and `server`
2. Add parser fixtures so Wikipedia changes can be detected quickly.
3. Add an explicit Node engine and a minimal lockfile policy.
4. Add health-oriented logging around upstream fetch failures and cache refreshes.
5. Externalize season/year configuration so rolling to a new season is safer.
6. Move inline HTML/CSS/JS into template/static modules if the app becomes larger.
7. Read the points and mountains tables the ASO sites publish (lavuelta.es, letour.fr) so the jersey holders update on a live evening before Wikipedia does; today they come from Wikipedia alone.

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
