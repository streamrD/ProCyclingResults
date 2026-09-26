# Area 2: Speed of results and pages

Assessed commit `9dc326f`, 2026-09-26, 21:02–21:20 UTC (Worlds race week: the women's road race finished earlier today, so production was in its live 60-second cache mode). Production host: `https://procyclingresults.up.railway.app` (Railway edge `yul1`). Local runs: the assessment worktree on an Apple-silicon Mac, Node 20+, Chrome 153 headless.

## 1. Summary

Grade for a phone reader: **C**. The server itself is fast — a warm request renders the whole page in about 34 ms locally and production answers with a median time to first byte of 0.30 s from the same continent — and a cold start reaches a ready homepage in 6–8 s, so the promise of "results as soon as they are available" is met on the data side (the payload was 56 s old during a live race). What lets a phone reader down is everything after the first byte: the homepage is 1.36 MB of HTML sent with **no compression** (gzip would make it 157 KB, measured), it carries 58 race cards and 11,283 DOM elements of which only a handful are visible at first, and it links six TTF font files totalling 550 KB. On a 390-px phone the hero alone is 720 px tall, so the first result card starts at 1,032 px and the first rider's name at 1,180 px: **no result is above the fold**, and the reader scrolls more than a full screen before seeing one. The two fixes that matter most are cheap and independent of the parsers: compress responses (built-in `zlib`, no dependency) and shrink the phone hero so the day's top result is the first thing on screen. A third, medium-sized change — stop shipping hidden cards and the hidden calendar SVGs in the initial HTML — would bring the page to a size that stays fast even on a slow 4G day. Nothing render-blocking beyond the 80 KB of inline CSS was found, and the client script's load-time work is small (20 ms on a Mac).

## 2. Method

- Production: 9 read-only GETs (cap was 15), three each of `/`, `/api/homepage-data`, `/api/races`, with a phone User-Agent and `Accept-Encoding: gzip, deflate, br`, timed with `curl -w` (`time_starttransfer`, `time_total`), bodies and headers saved. Script: `area2-scratch/prod-timing.sh`, log: `area2-scratch/prod-timing.log`. No other production endpoint was touched and no load test was run.
- Page composition: one saved copy of the homepage (`area2-scratch/body-home-1.out`) analysed with two small Node scripts (`compose.js`, `sectionmap.js`) plus `gzip`/`brotli` for compressibility and a `JSON.parse`/`stringify` round trip for the minified JSON size.
- Client script: read from `server.js` lines 14921–15995 (the template literal after `buildRiderSeasonsScript`).
- Rendering: the saved HTML, with `/assets/` font URLs re-pointed at the worktree's font files and a probe script injected into `<head>` that measures the DOM after `load` and writes JSON into `<title>` (`instrument.js`, the pattern handoff.md recommends), rendered in headless Chrome with `--dump-dom` and `--screenshot`. Headless Chrome will not open a window narrower than 500 px, so a true 390-px layout was measured by hosting the page in a 390×844 iframe (`frame.sh`). Screenshots: `home-390.png` (500-px layout cropped to 390, as `--window-size=390,844` really produces), `home-390-true.png` (true 390-px layout in the iframe), `home-1280.png`.
- Cold start and warm load: `bench.sh` starts a fresh `node server.js` from the worktree on port 3111 and runs the repo's own `scripts/benchmark-load.js` once per mode (`homepage-ready`, `ready`, `load --runs=5`); each cold mode is a new process with an empty cache fetching live upstream sources. Logs: `bench-homepage-ready.log`, `bench-ready.log`, `bench-load.log`.
- All scratch files: `assessments/tools/area2/`.

## 3. Measurements

### 3a. Production timings (9 GETs, 21:02:39–21:02:44 UTC)

Command (one line per request, in `prod-timing.sh`):
`curl -sS --compressed -A "<iPhone UA>" -H 'Accept-Encoding: gzip, deflate, br' -o body -D headers -w 'ttfb=%{time_starttransfer} total=%{time_total} size_download=%{size_download}' https://procyclingresults.up.railway.app<path>`

| Path | Run | HTTP | TTFB (s) | Total (s) | TCP connect (s) | TLS done (s) | Bytes on the wire | Bytes on disk |
|---|---|---|---|---|---|---|---|---|
| `/` | 1 | 200 | 0.370 | 0.767 | 0.075 | 0.120 | 1,360,391 | 1,360,391 |
| `/` | 2 | 200 | 0.302 | 0.564 | 0.043 | 0.092 | 1,360,391 | 1,360,391 |
| `/` | 3 | 200 | 0.295 | 0.547 | 0.041 | 0.086 | 1,360,391 | 1,360,391 |
| `/api/homepage-data` | 1 | 200 | 0.320 | 0.660 | 0.128 | 0.176 | 1,358,134 | 1,358,134 |
| `/api/homepage-data` | 2 | 200 | 0.187 | 0.355 | 0.029 | 0.060 | 1,358,134 | 1,358,134 |
| `/api/homepage-data` | 3 | 200 | 0.253 | 0.415 | 0.101 | 0.132 | 1,358,134 | 1,358,134 |
| `/api/races` | 1 | 200 | 0.253 | 0.425 | 0.027 | 0.061 | 1,410,226 | 1,410,226 |
| `/api/races` | 2 | 200 | 0.202 | 0.384 | 0.028 | 0.058 | 1,410,226 | 1,410,226 |
| `/api/races` | 3 | 200 | 0.305 | 0.576 | 0.043 | 0.087 | 1,410,226 | 1,410,226 |

Medians: `/` TTFB 0.302 s, total 0.564 s; `/api/homepage-data` TTFB 0.253 s, total 0.415 s; `/api/races` TTFB 0.253 s, total 0.425 s. Wire bytes equal disk bytes on every request: nothing was compressed.

Response headers (identical shape on all nine; from `headers-home-1.txt`):

| Header | `/` | `/api/*` |
|---|---|---|
| `content-encoding` | absent | absent |
| `cache-control` | `no-store` | `no-store` |
| `content-length` / `etag` / `last-modified` | absent | absent |
| `content-type` | `text/html; charset=utf-8` | `application/json; charset=utf-8` |
| protocol / edge | HTTP/2, `server: railway-hikari`, `x-railway-edge: yul1` | same |

Freshness during a live race: the payload's `fetchedAt` was `21:01:44Z` on a request at `21:02:40Z` (56 s old), and the page said "Updated Sep 26, 2026, 5:01 PM Eastern Time". (`head -c 300 body-_api_homepage-data-1.out`)

Compressibility of the saved bodies (`gzip -6 -c FILE | wc -c`, `brotli -c -q 5 FILE | wc -c`, `node -e` round trip):

| Body | Raw bytes | gzip -6 | gzip -9 | brotli q5 | Minified JSON |
|---|---|---|---|---|---|
| `/` HTML | 1,360,391 | 156,785 (11.5%) | 154,341 | 119,061 (8.8%) | n/a |
| `/api/homepage-data` | 1,358,134 | 112,255 (8.3%) | 104,145 | — | 561,386 (41%) |
| `/api/races` | 1,410,226 | 119,076 (8.4%) | 110,681 | — | 597,145 (42%) |

### 3b. Page composition (`node compose.js body-home-1.out`, `node sectionmap.js body-home-1.out`, Chrome probe)

| Item | Value |
|---|---|
| Total HTML bytes | 1,360,391 |
| `<head>` bytes (all before `</head>`) | 82,120 |
| Inline CSS (one `<style>`) | 80,185 bytes |
| Inline JavaScript (one `<script>` at the end of `<body>`) | 43,673 bytes |
| Embedded JSON (`<script type="application/json" id="rider-seasons">`) | 35,207 bytes, 240 rider keys |
| Other embedded data | 378 `data-tip-*` attributes on calendar bars, 13,544 bytes; `deferredGroups` payload inline in the script (tiny) |
| Inline SVG | 237 elements, 332,851 bytes (24% of the page) |
| DOM elements (Chrome, after load) | 11,283 (regex estimate on the source: 13,147) |
| Race cards (`id="race-…"`) | 58 (Worlds 7, Men's WorldTour 26, Women's WorldTour 25) |
| Elements with `hidden` at load | 169 (154 `hidden` attributes in the source) |
| Rider links (`data-rider-key`) | 832 |
| Anchors / buttons / tables / table rows | 1,107 / 386 / 6 / 111 |
| `<img>` elements | 0 |
| Fonts | 6 `@font-face` rules, all TTF, `font-display: swap`: Manrope 500/700/800, Barlow Semi Condensed 600/700/800 = 549,812 bytes on disk (`ls -l assets/fonts/*.ttf`) |
| External scripts | 1: `https://todd-umami.up.railway.app/script.js` (`defer`, in `<head>`) |
| External stylesheets | 0 |
| News placeholders | 27 `data-race-news` blocks, 25 `pending` (filled by `/api/race-news` on scroll) |

Bytes by top-level section inside `<main>` (`sectionmap.js`):

| Section | Bytes | of which inline SVG | Race cards | Hidden at load | Byte offset in page |
|---|---|---|---|---|---|
| hero | 1,631 | 245 | 0 | no | 82,168 |
| `#season-calendar` | 82,798 | 72,691 | 0 | **yes** | 83,812 |
| `#world-championships` | 22,872 | 0 | 7 | no | 166,622 |
| `#mens-worldtour` | 567,453 | 121,896 (stage profiles) | 26 | no (3 of the recent cards shown, rest behind "Load more") | 189,499 |
| `#womens-worldtour` | 322,467 | 28,853 | 25 | no (same) | 756,957 |
| `#national-championships` | 201,479 | 109,166 (world map) | 0 | no (groups collapsed) | 1,079,436 |
| rider-seasons JSON | 35,240 | — | — | — | 1,281,443 |
| client `<script>` | 43,701 | — | — | — | 1,316,683 |

Before the first result: the first race card begins at byte 167,610 (12.3% of the page) and the Worlds section, which holds the three visible results, ends at byte 189,499 (13.9%). Everything a phone needs to paint the first result is in the first 190 KB; the remaining 1.17 MB (86%) is cards behind "Load more", the hidden calendar with three pre-rendered SVGs, the nationals almanac and map, the rider index and the script. The only render-blocking resource is the 80 KB inline stylesheet; the analytics script is `defer` and the site script is at the end of `<body>`; fonts use `swap` so they never block paint (they do cause a reflow when they land, see S9).

Rendering probe (`frame.sh`, headless Chrome on the saved page, fonts loaded from disk):

| Viewport | DOM elements | `scrollWidth` | Page overflows horizontally | Hero height (px) | First race card top (px) | First rider name top (px) | Page height (px) | `domInteractive` (ms) | DCL handler (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 390×844 (true, iframe) | 11,283 | 390 | no | 720 | 1,032 | 1,180 | 15,337 | 428 | 20 |
| 500×757 (what `--window-size=390,844` really gives) | 11,283 | 500 | no | 750 | 984 | 1,113 | 13,339 | 373 | 22 |
| 1280×1313 | 11,283 | 1,280 | no | 411 | 672 | 802 | 8,199 | — | — |

At a true 390 px the page itself does not overflow, but `.national-almanac-grid` and the schedule block inside it extend to x=452 (62 px past the viewport) and are clipped; the hero fits. The "hero and page overflow a 390px viewport" note in `handoff.md` reproduces only at the 500-px minimum window that headless Chrome silently substitutes (`home-390.png` shows the crop). The `domInteractive` numbers are the Mac's HTML parse + style time for 1.36 MB; a mid-range phone is roughly four to five times slower on this work.

### 3c. Local cold start (`bench.sh homepage-ready`, `bench.sh ready`; each a fresh process, empty cache, live upstream)

| Command | Metric | Value |
|---|---|---|
| `npm run benchmark:homepage-ready -- --base-url=http://localhost:3111 --ready-timeout-ms=240000 --runs=3` | `/api/homepage-data` ready (202 → 200) | **7,617.5 ms**, 16 polls |
| same run, warmed | `/` p50 / max | 36.2 ms / 48.0 ms (1,350,028 bytes) |
| same run, warmed | `/api/homepage-data` p50 | 12.9 ms |
| `npm run benchmark:ready -- --base-url=http://localhost:3111 --ready-timeout-ms=240000 --runs=3` | `/api/races` ready | **6,284.0 ms**, 1 attempt (the first request waited on the build) |
| same run, warmed | `/` p50 / max | 39.5 ms / 50.5 ms |

Note: `server.listen` does nothing but log (server.js 17110); the build starts on the first request (`shouldServeHomepageWarmup` → `warmRaceDataInBackground`, 16940–16941). Neither benchmark took more than 10 s wall time.

### 3d. Warm load (`bench.sh load` → `npm run benchmark:load -- --base-url=http://localhost:3111 --runs=5`, after one warming request)

| Endpoint | Bytes | min | avg | p50 | p95 | max |
|---|---|---|---|---|---|---|
| Homepage HTML `/` | 1,350,028 | 31.9 ms | 45.4 ms | 33.6 ms | 34.9 ms | 93.4 ms |
| `/api/homepage-data` | 1,354,380 | 9.8 ms | 11.6 ms | 10.6 ms | 11.4 ms | 15.9 ms |
| `/api/races` | 1,406,476 | 10.0 ms | 10.7 ms | 10.4 ms | 10.4 ms | 12.9 ms |
| `/api/races?debug=1` | 1,407,913 | 10.3 ms | 11.8 ms | 11.8 ms | 12.1 ms | 13.2 ms |

Every `/` request re-renders the full page from the cached payload (`buildHtmlPage` in the handler at 17083–17089); at ~34 ms each that is fine for this audience but is the single-instance ceiling (~30 pages/s).

### 3e. Client script: what runs when (server.js 14921–15995)

| Phase | Work | Cost |
|---|---|---|
| Parse (before script) | 1.36 MB HTML → 11,283 elements, 237 inline SVGs, 80 KB CSS | Mac: 373–428 ms to `domInteractive`; the dominant client cost |
| Script end-of-body, synchronous | `bindLoadMoreRaces` (querySelectorAll buttons), `bindRaceNews` (delegated click + `IntersectionObserver` with 240 px margin over 25 pending pills + a body-wide `MutationObserver`), `bindRiderCards` (**`JSON.parse` of the 35 KB rider index, then bails on phones because `(hover: hover)` is false**), `bindJerseyContenderCards`, `bindNationalChampionshipFilters` (rows/chips listeners), `bindNationalChampionshipMap` (per-continent listeners), `bindSeasonCalendar` (four listeners on each calendar bar, 378 `data-tip-*` reads), `bindShareJump`, `bindRefreshButton`; plus `applyUnitPreference`/`applyProfileView` (two `querySelectorAll` sweeps, `localStorage` reads) and a second body-wide `MutationObserver` | Mac: DCL handler 20–22 ms; expect ~80–120 ms on a mid-range phone |
| On scroll | Each pending news pill within 240 px of the viewport fetches `/api/race-news?race=…` and swaps the pill in place (`block.replaceWith(fresh)`) | one small JSON per card; same-height replacement |
| On tap | Load more races (unhides pre-shipped rows), stage chips, km/mi, profile expand, calendar open, nationals filters, refresh button (polls `/api/data-status`) | delegated at `document`; cheap |
| Never on phones | Hover cards (rider and jersey) | — |

Layout-shift risks: (1) the six `swap` fonts — the hero `h1` is Barlow Semi Condensed 800 at `clamp(2.7rem,14vw,4.4rem)`, so the fallback-to-webfont swap reflows the first screen on a first visit; (2) `applyUnitPreference` rewrites distance text in place for imperial users only; (3) the news pill swap is same-size. Nothing is inserted above the results after load.

## 4. Targets and standing

| Metric | Proposed target | Measured | Standing |
|---|---|---|---|
| First result visible without scrolling on a 390×844 phone | Yes (first podium row within 844 px) | First card at 1,032 px, first name at 1,180 px | **Fail** |
| Homepage bytes on the wire | ≤ 250 KB (gzip/brotli on) | 1,360,391 (identity); 157 KB if gzipped | **Fail** |
| Response compression on `/` and `/api/*` | `content-encoding: gzip` or `br` | none | **Fail** |
| Homepage HTML size before compression | ≤ 400 KB (ship only what is visible plus a small margin) | 1,360 KB; ~190 KB up to the end of the visible results | **Fail** |
| DOM elements at load | ≤ 4,000 | 11,283 | **Fail** |
| Web-font bytes (first visit) | ≤ 150 KB, woff2, only weights used above the fold preloaded | 549,812 bytes, 6 TTF | **Fail** |
| Warm TTFB, production, same continent | ≤ 300 ms median | `/` 302 ms, APIs 253 ms | Borderline pass |
| Warm total for `/`, production, wired | ≤ 600 ms median | 564 ms | Pass (would be ~1.2–1.5 s on 4G at this size) |
| Server render time per warm `/` | ≤ 50 ms p50 | 33.6–39.5 ms | Pass |
| Cold start to `/api/homepage-data` ready | ≤ 10 s | 7.6 s (local) | Pass |
| First visitor after a deploy never sees the warm-up page | Build starts on boot | Build starts on first request | **Fail** |
| Live-race payload age | ≤ 2 min inside racing hours | 56 s | Pass |
| Client script work at load (phone estimate) | ≤ 100 ms | 20–22 ms on Mac (~80–120 ms phone) | Pass/marginal |
| Render-blocking resources besides inline CSS | 0 | 0 (analytics is `defer`) | Pass |
| Horizontal overflow at 390 px | none | none at page level; nationals grid overflows its box by 62 px (clipped) | Pass with a note |

## 5. Findings

| ID | Severity | Title | Evidence | Impact on the reader | Recommended fix | Effort |
|---|---|---|---|---|---|---|
| S1 | High | No response compression | All 9 production responses: no `content-encoding`; wire bytes = disk bytes (1,360,391 for `/`). `grep -i zlib\|gzip server.js` finds nothing. `gzip -6` of the same body: 156,785 bytes; brotli q5: 119,061. | A phone on 4G downloads 1.36 MB for one page and 1.36 MB again for a refresh (`no-store`); at ~1.5 MB/s that is ~0.9 s of pure transfer after TTFB, and it grows with every race added. | In `sendHtml`/`sendJson` (server.js 16873–16886), check `accept-encoding` and pipe through `zlib.createGzip()` (or `createBrotliCompress` for `br`); set `content-encoding` and `vary: accept-encoding`. Built-in module, no dependency. Compress the font files the same way is unnecessary (see S4). | S |
| S2 | High | First result is below the fold on phones | True-390 probe: hero 720 px tall; first race card top 1,032 px; first rider name 1,180 px (`probe-390-true.json`, `home-390-true.png`). Hero at 390 shows: tag pill, two-line H1, three-line tagline, updated line, refresh button, five stacked menu buttons. | The site's promise is the result; a phone reader gets the masthead and a menu and must scroll 1.2 screens before any podium. | On `max-width: 720px`: collapse the five menu buttons into one compact row of chips (or a single "Sections" toggle), drop the tagline below the first results, and put the newest result (race name, winner, time) in the hero as a one-line "Latest" strip that links to its card. Comp it with the real payload first, per the repo's rule. | M |
| S3 | Medium | The page ships everything, visible or not | 58 cards, 1,199 KB inside `<main>`, 11,283 elements; Men's WorldTour 567 KB and Women's 322 KB with 3 recent cards visible per section and the rest behind "Load more"; the hidden `#season-calendar` is 83 KB (73 KB of SVG); the nationals map is 109 KB of SVG; 333 KB of inline SVG in all. | Parse + style of 11k elements is the main client cost (Mac 428 ms → ~2 s on a mid-range phone) and it is paid before the script binds anything, on every visit, even when the reader only wants today's result. | Serve the hidden recent-result rows, the calendar section and the nationals almanac as fragments from existing-style endpoints (`/api/competition-section` and the `deferred-section-mount` machinery already exist), fetched when "Load more" / "Season Calendar" / the nationals button is tapped. Keep the stage-race switcher panels as they are (they are what the strip needs). Target ≤ 400 KB uncompressed. | M |
| S4 | Medium | 550 KB of TTF fonts, six weights | `@font-face` ×6 (server.js 11775–11815), all `.ttf`, `font-display: swap`; `assets/fonts` totals 549,812 bytes. Served immutable (good) but a first visit pays it all. | On a first visit the fonts are the largest download after the HTML; the swap reflows the hero. | Convert to woff2 (typically 40–60% smaller), subset to Latin, drop weights not used on the homepage, `<link rel="preload" as="font">` the two hero faces, and add `size-adjust`/`ascent-override` on the fallback to limit the swap shift. Bump the `?v=` query per the static-asset rule. | S |
| S5 | Medium | Cold build starts on the first request, not on boot | `server.listen` callback only logs (17110); `warmRaceDataInBackground` is called from the request handler (16941). Cold readiness measured 6.3–7.6 s. Every site-editor save is a commit and therefore a Railway redeploy (handoff.md 1514). | The first reader after each deploy sees the warm-up page for ~7 s; on a race day a maintainer editing the about page makes the next reader wait. | Call `warmRaceDataInBackground().catch(() => {})` inside the `listen` callback. Requests per rebuild are unchanged, so `DATA-SOURCES.md` stays true; add a dated review-log line anyway. | S |
| S6 | Low | API JSON is pretty-printed | `sendJson` uses `JSON.stringify(payload, null, 2)` (16879). Minified: 561,386 vs 1,358,134 bytes for `/api/homepage-data` (41%). | Doubles the bytes for the refresh button's status polls' big siblings and for anyone using the API; irrelevant to the HTML page. | Minify by default; honour `?pretty=1` for humans. Moot for the wire once S1 lands, but still halves memory and CPU per response. | S |
| S7 | Low | Rider index parsed on phones that never use it | `bindRiderCards` (15933–15938) `JSON.parse`s the 35 KB `#rider-seasons` block before `bindHoverCards` returns early on `(hover: hover)` devices (15822). | ~5–10 ms of wasted main-thread work per phone visit; trivial today, grows with the index. | Move the `(hover: hover)` check ahead of the parse, or parse lazily on the first hover. | S |
| S8 | Low | `no-store` and no validator on the HTML | `cache-control: no-store`, no `etag`/`last-modified` on `/`. | Back-navigation, tab restore and the refresh button each refetch the full 1.36 MB even when `fetchedAt` has not changed. | Send `cache-control: no-cache` with `etag: "<fetchedAt>"` (or a hash of the payload) and answer `304` on `if-none-match`; live-race semantics are preserved because the ETag changes with every rebuild. | S |
| S9 | Low | Font swap reflows the first screen | Six `swap` fonts; the H1 is Barlow 800 at up to `14vw`; probe shows `document.fonts.size` = 6 loaded from disk, so no shift was observed locally, but on a first network visit the fallback renders first. | A visible jump of the hero and the first card on first visit. | Covered by S4's preload and fallback metrics. | S |
| S10 | Low | Headless Chrome cannot go narrower than 500 px | `--window-size=390,844` reported `innerWidth` 500, `innerHeight` 757, and the screenshot is that layout cropped to 390 (`home-390.png`). At a true 390 (iframe) the page does not overflow (`scrollWidth` 390) and the hero fits; only `.national-almanac-grid` extends to x=452 and is clipped. | Not a reader-facing bug: it explains the handoff's "known overflow at 390 px" and it means past phone checks were made at 500 px. | Record the 500-px minimum in `handoff.md` and use the iframe host (`frame.sh`) or Chrome's `--remote-debugging` device emulation for phone checks; fix the almanac grid's min-width at 390. | S |

## 6. Strengths

- Server-side rendering from one cached payload: a warm `/` renders in ~34 ms locally and production TTFB is ~0.3 s from the same continent, with HTTP/2 at the edge.
- Requests never wait on a rebuild once the cache exists; during a live race the payload was 56 s old, matching the 60-s live TTL. Cold start is 6–8 s, well under the benchmark's timeout, thanks to the official-provider budget described in `handoff.md`.
- No render-blocking external resources: the stylesheet is inline, the analytics script is `defer`, the site script is at the end of `<body>`, fonts are `swap`.
- Everything a phone needs to paint the first results is in the first 190 KB of the document, so progressive rendering can show the hero and the Worlds cards before the rest streams in.
- News is loaded per card on scroll through an `IntersectionObserver`, never at build time, and the swap is same-size. Deferred-section and load-more machinery already exists for S3.
- Static assets are immutable-cached; the repo ships its own benchmark script and the numbers it reports match what curl sees.

## 7. Open questions for the maintainer

1. Is there any reason compression was never enabled (Railway edge expectations, memory on the single instance)? Node's `zlib` streams would add no dependency; is a `vary`/`content-encoding` change acceptable under the "preserve cache behaviour" rule?
2. On the phone hero: would you accept a single compact "Latest result" line above the menu, or should the menu itself collapse? The repo's rule is "results first, always" (handoff.md, 2026-09-04) and the current phone hero is the one screen that does not follow it.
3. Is the full set of 51 WorldTour cards in the initial HTML deliberate (for anchor links from the calendar, `#race-…`), or would on-demand fragments for rows behind "Load more" be acceptable if the calendar's jump first triggers the load?
4. Should the build start on boot? It changes nothing about request counts per rebuild but does mean every deploy fetches upstream once even with no visitor.
5. Is `Umami` on a Railway free instance? Its response time was not measured (production request cap); if that app sleeps, `defer` keeps it off the critical path but it may still delay `load`.

## 8. Recheck procedure (under 30 minutes, monthly)

All scripts live in `assessments/tools/area2/`; copy them somewhere durable (e.g. `scripts/perf/`) if this is to be repeated.

```bash
S=assessments/tools/area2/
# 1. Production (9 GETs, ~10 s): timings, headers, bodies. Check content-encoding and size_download.
bash $S/prod-timing.sh | tee $S/prod-timing.log
grep -i "content-encoding\|cache-control" $S/headers-home-1.txt

# 2. Page composition (~2 s)
node $S/compose.js $S/body-home-1.out | tee $S/compose.json
node $S/sectionmap.js $S/body-home-1.out | tee $S/sectionmap.json
gzip -6 -c $S/body-home-1.out | wc -c

# 3. Phone render (~30 s): true 390-px probe and screenshots; read probe-390-true.json for
#    firstCardTop, scrollWidth, overflowingElements, timing.domInteractiveMs
bash $S/frame.sh
bash $S/chrome.sh        # 500-px and 1280-px probes and screenshots

# 4. Local cold start and warm load (~1 min, three fresh processes; each cold run hits upstream once)
bash $S/bench.sh homepage-ready
bash $S/bench.sh ready
bash $S/bench.sh load
```

Compare against the tables above; the four numbers to watch are `content-encoding` on `/`, `size_download` for `/`, `firstCardTop` at 390 px, and "ready in" from `benchmark:homepage-ready`.
