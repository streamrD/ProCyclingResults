# Pro Cycling Results Handoff Journal

The dated record behind `handoff.md` (the map): what each session measured, learned and
decided, in the order it happened, oldest first. Split out of `handoff.md` on
2026-09-27 when that file passed 2,000 lines; nothing here was rewritten. Append a
section for a session at the end; when a lesson becomes a standing rule, put the rule
in `AGENTS.md` or the map and leave the story here.

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

### Added 2026-09-12 (news line refresh, jersey targets)

- **The news line froze at the first fetch.** "News coverage stopped on 9/10" was the
  report; the Vuelta card's line led with stage 18 on the evening of stage 20, while
  the Québec card was current. Two facts explained it. `peekRaceArticlePool` returned
  any cached pool, however old, so the card rendered "ready" and the client had
  nothing to ask for; and `warmRaceArticlePool` only called `loadRaceArticlePool`
  when the pool was empty. So a live race's pool was built once — at the 2026-09-10
  deploy, which restarted the process — and nothing ever refreshed it. Québec was fine
  only because its pool was first built on 2026-09-11. Bing had the stage 19 and 20
  stories the whole time; one direct call to `/api/race-news` from the terminal
  triggered the refresh and proved it.
- **The fix is one definition.** A pool older than `getArticleCacheTtlMs` (15 minutes
  live, six hours two days after the finish) now counts as cold in `peek`, which makes
  the live card refresh it at the next rebuild through the unchanged `warm` call and
  the recent card render a placeholder for the client. `/api/race-news` passes
  `waitForRefresh: true` so it answers with the refreshed pool rather than the stale
  one, falling back to the stale pool only if the refresh fails. The refresh-failure
  path still deletes the pool; retry cadence is unchanged. `DATA-SOURCES.md` already
  stated a 15-minute cadence for live races; the requests now match it.
- **Jersey hover cards "updated for a few, not all".** Not ours. Wikipedia's editors
  updated the Vuelta's stage 20 standings tables in two passes (general and points at
  16:57 UTC, mountains, young rider and team at 21:26 UTC), and the cards are dated by
  their own captions, as item 7a says. The revision history (`prop=revisions`, then
  `action=raw&oldid=`) settled it in two requests. No change made.
- **The jersey swatch opens the card.** The classification label was the only hover
  target, one short word in a stack of five. `buildJerseySwatchMarkup` now takes
  `{ contenders }` and stamps `data-jersey-contenders-swatch`; `bindHoverCards` gained
  a fourth argument, `resolveTarget`, which maps the swatch onto its label so the card
  is anchored in one place and moving between the two keeps it open. Under
  `(hover: hover)` the label also stretches to its row's height. The user's own reading
  of why it works: the card opens to the right of the jersey column, so the jerseys
  stay uncovered and the pointer steps straight down the list. Keep that column clear
  of any future card.

### Added 2026-09-13 (a stage race's last day, jerseys on finished cards)

- **The Vuelta showed under Live and Completed on its final day, and the Completed
  card had no winner.** The homepage's recent list is `selectedHomepageRecentCandidates`
  unfiltered, and `partitionRaceBuckets` admits a multi-day race to it as soon as
  `endDate <= today`, before the last stage is run. Meanwhile the live list kept it
  through `isRaceWithinScheduledLiveWindow` (added 2026-05-17 so a mid-race snapshot
  that wrongly reads complete cannot drop a Giro out of Live). At 16:15 UTC the payload
  had `completedStages: 20` of 21 in both lists. The user read the empty card as
  "results for today are not in"; the stage had simply not finished (18:15 in Madrid).
- **The fix is two predicates** beside `isRaceWithinScheduledLiveWindow`:
  `isStageRaceAwaitingFinalStage` drops a stage race ending today and not yet finalized
  from the homepage recent list, and `isStageRaceShownLive` stops the live window from
  keeping a finalized race on its end date. Result: live until the last stage is in,
  then completed, never both. The mid-race protection is unchanged. Commit `3187cb3`;
  on production the Vuelta was Live-only at 16:40 UTC (a before/after diff of
  `/api/races` moved nothing else) and Completed-only with 21 stages at 19:14 UTC.
  The `includeDeferred` path already filtered recent stage races through
  `isFinalizedStageRace` and only needed the live half.
- **"We don't display who won the jerseys" on the finished card.** They were
  displayed: "Final jersey winners" sits under the GC top five, and 14 finished races
  carry `classificationLeaders`. At desktop width the three-across card's content box
  is 336px, 4px under the `.gc-columns` 340px container query, so the list stacks
  rather than sitting beside the podium. Lowering it to 330px (and a variant with
  smaller place badges and times on their own line) was comped on the live Vuelta
  card; both break rider names mid-name in a ~170px column. The user chose stacked as
  correct. No change made; leave the threshold alone.

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
README, this journal and the `DATA-SOURCES.md` review log in the same commit.

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

- Headless Chrome will not open a window narrower than about 500px; a
  `--window-size=390,…` screenshot comes out 390 wide but laid out at ~500 and looks
  clipped. Measured 2026-09-26 on Chrome 153: `--headless=new` and `--headless` both
  report `innerWidth` 500 at that size, so the smoke test's phone pass is a 500px pass.
  For a true 390px layout host the saved page in a 390px iframe
  (`assessments/tools/area2/frame.sh`, `assessments/tools/area3/frame390.html`).
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

## Process Lessons From The 2026-09-12 Session

Three reports in one evening: "news coverage stopped on 9/10", "today's jersey points on
hovers only are updated for a few", and "could we make the jerseys themselves
hoverable?". One was a bug, one was upstream, one was a small change. Details are under
"Open Threads › Added 2026-09-12" above.

- **A date in the report is a clue, not a coincidence.** "Stopped on 9/10" was the
  day of the last deploy. A process restart rebuilds every in-memory cache once; a
  cache that is then never refreshed shows its age from exactly that day. When a
  symptom starts on a deploy day and the deploy did not touch the feature, look for a
  cache that only fills when empty.
- **Compare a broken card with a working one.** The Vuelta line was stale and the
  Québec line was current, on the same server, from the same Bing feeds. The difference
  was when each pool was first built, which pointed straight at "built once, never
  refreshed" and away from Bing, filters and scoring.
- **Hit the endpoint yourself before reading the code for the answer.** One curl to
  `/api/race-news` returned the stale set; the second, a minute later, returned stage
  20. That proved the refresh path worked and only the trigger was missing, which
  turned a scoring-and-filters investigation into a one-definition fix.
- **Two of three reports were not bugs in the code.** The hover-card lag was
  Wikipedia's editors working in two passes; the fix would have been to fabricate
  standings, so there was none. Checking the article's revision history took two
  requests and settled it with a table of times. Say "not ours" with the evidence,
  and stop.
- **A doc that states a cadence is a promise.** `DATA-SOURCES.md` had said "cached for
  15 minutes" since 2026-09-05; the code had never once refetched a live race's pool.
  When a fix makes the requests match the document, log that in its review log rather
  than treating it as a no-change.
- **The client script is inside a template literal.** A backtick in a comment ended it
  and every test failed at once. The smoke test's `${` guard did not catch it because
  the break was a backtick, not a dollar brace. Use plain quotes in that block.
- **Headless `--screenshot` does not paint a card opened by script.** The DOM dump
  showed the fixed-position card at the right coordinates; three screenshot attempts
  showed the list without it. The smoke test, which asserts on the DOM in the same
  headless Chrome, is the proof for hover work; do not burn time trying to picture it.
- **Ask why it worked.** The user's explanation of the jersey fix — the jersey pokes
  out beside the card, so the pointer never has to leave — is a layout rule worth more
  than the change itself. It is saved in memory and in item 7a.
- **"PCS blocks the server" is not new, and it is not only the server.** It has been
  in `AGENTS.md` since the rider links shipped on 2026-09-07. What this session added:
  a plain `curl` from the maintainer's laptop gets the same Cloudflare wall (HTTP 403,
  a "Just a moment" challenge page), so the block is on anything that is not a real
  browser, not on Railway's address. A signed-in Chrome loads the pages normally,
  which is why both check scripts (`pcs-rider-links.browser.js`,
  `pcs-race-links.browser.js`) run pasted into a PCS tab, and why this session drove
  the race-address check through the Chrome extension: 65 same-origin fetches from
  one tab, results parked on `window` and read back in batches, because one call
  holding the tab for the whole run timed out at 45 s. None of this touches what the
  site does — it links to PCS and never reads it — it only decides how the links get
  verified.
- **Release notes are two sentences, not five.** The full-results entry ran to five
  sentences (what, where, how many were checked, what the fallback does) and the user
  asked for it to be cut and for the rule to be kept: "these should always be concise".
  An entry is a bold lead of a few words and one or two sentences on what changed for
  the reader; the diagnosis, the counts and the fallback belong in this journal. Three
  sessions have now trimmed notes after the fact ("Cut the contenders release note to
  one sentence", "Shorten today's release notes", today), so the rule is in `AGENTS.md`
  and in memory. Write the entry last, from the reader's side.

## Process Lessons From The 2026-09-13 Session

Two reports: "vuelta today is showing in both live and completed, but results for today
are not in", then "now that the vuelta is finalized and the cell collapsed, we don't
display who won the jerseys". The first was a bug, the second was not. Details are under
"Open Threads › Added 2026-09-13" above.

- **Check the clock before the parser.** "Results for today are not in" at 16:15 UTC on
  a Grand Tour's final day meant the Madrid stage had not finished. The real defect was
  the other half of the report: a Completed card that should not have existed yet. Say
  which half is a bug and which is just the time of day.
- **Look at what production renders before proposing a fix.** The second report asked
  for suggestions to show the jersey winners; a headless screenshot of the live card
  showed they were already there, below the top five. Saying so first, with the
  screenshot, reframed the request from "missing" to "easy to miss".
- **Comp a CSS tweak too.** Moving the jerseys beside the podium looked like a
  one-number change (340px to 330px). Rendered on the real card it broke "Enric Mas"
  across two lines, and the user kept the current layout. Five minutes of screenshots
  saved a push and a revert. Both previews were built by editing a saved copy of the
  live homepage (`<base href>` pointed at production so fonts and assets load), not
  the server, which is the fastest way to trial CSS against real data. A measuring
  script appended to that copy and read back with `--dump-dom` gave the container
  widths at several window sizes.
- **Pull before editing the release notes, not after.** `git pull --rebase` refused to
  run because `data/release-notes.md` was already modified, and the push went through
  only because `main` had not moved. The site editor commits there; pull first.

## Process Lessons From The 2026-09-15 Session

- **Season calendar full screen.** A "Full screen" button beside "Close calendar" pins the section over the window (`is-fullscreen`); only `.season-body` scrolls, so the tooltip still positions against the fixed section. Escape, the button, closing the calendar, or clicking a bar to jump to a card all exit. The hero's "New" badge came off the calendar link; the badge mechanism is left in `heroMenu` for the next new thing.
- **Season close-out and rollover.** Designed on a mockup first (https://claude.ai/artifact/QjRhoAiczyxkSpAmaskg8N, layout B chosen: the header becomes the note). The maintainer wrote the letter, set the headline to "Thank you, 2026" and added "Thank you for coming along for the ride." to the first paragraph; the counts and race names in it are computed. Full description under "Season Year And Close-Out" in `README.md`. See the two AGENTS.md bullets on `SEASON_YEAR` and `seasonCloseout` for how it hangs together.
- **What the unit tests did not catch.** The first cut called `isWorldTourRace` from `buildRaceMetadata`, but that helper is a local inside `buildRaceData`. Every test passed and the local server sat on the warm-up page forever, because the warm-up swallows build errors. Running `buildRaceMetadata` + `buildRaceData` directly in a VM (as the tests load server.js) surfaced the ReferenceError in one step. Do that before trusting a change to the metadata build.
- **Wikipedia answers a missing season page with 200 and a redirect stub**, not a 404, so `probeSeasonOpening` sees an empty parse and caches a miss for a day (two requests). A thrown error is retried after ten minutes instead.
- **Still to do by hand:** a release-notes line when the note first appears (19 October 2026, the morning after the Tour of Guangxi), and a look at the site the week of the rollover (around 9 January 2027): the Cyclingnews nationals address is a guess from the pattern, the Worlds parser has only met the 2026 article, and the 2026 race-specific fixes will have stepped aside.

## Process Lessons From The 2026-09-26 Session

- The Worlds women's road race day. The medal-summary fallback worked (podium, video and eight stories while the event page was a red link), and it exposed that every 2026 event page heads the rider column "Athlete"; fixed in `9dc326f` (see "World Championships" above).
- The first full project assessment was run the same evening: nine areas in parallel, read-only, against `9dc326f`. The report, the per-area findings with evidence, the recheck tools and the cadence are under `assessments/` (start at `assessments/README.md`). Findings keep their IDs from one report to the next; the plan's Phase 0 is due before Il Lombardia on 10 October.
- Three things from it that the next race-day session should know before it is reported: a one-day WorldTour race has no card on its own race day and its winner arrives on the hourly metadata cadence (finding R1; the Worlds-only exception is `isWorldChampionshipEventAwaitingResult`); on production that evening 3 of 44 cards carried a finish video, all Worlds, and no WorldTour card or stage did (R7, and the YouTube search is a robots-disallowed scrape, L1); ten of fourteen finished one-day cards showed three names because `HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT` counts Worlds events it then skips (R6).
- CI is advisory: the five red runs on 2026-09-15 all deployed. Until Railway's wait-for-CI is on, `npm test` before pushing is the only gate.
- The "hero overflows at 390px" note was a headless-Chrome artefact (both headless modes lay out at 500px on this machine); the nationals grid clipping is real. Corrected above.

### The remediation batch, same evening

Seven workstreams from the assessment's plan ran in parallel as agents in isolated worktrees, each owning line ranges of `server.js`; the branches were merged onto `main` one at a time. Four agents were cut off by the account's spend limit before committing and their work was finished by hand from the worktrees. What the next agent needs to know, by change:

- **Every failure now logs one JSON line** (`logEvent`, near the top of the file) and both caches carry `lastBuildAt`/`lastBuildError`; `/api/data-status` reports per-section counts and the last build error (`describeDataStatus`). `upstream-fetch-failed` with a Wikipedia 404 is often an expected probe of an unwritten page, not an outage. Test traps: objects made inside the VM fail `deepEqual` against test-realm literals (spread them first); `instanceof Error` is false across realms; `stubFunctionForTest` replaces a top-level function through the sandbox global.
- **The build starts at boot** (listen callback), not on the first request. `npm run verify:deploy` polls build-info for a SHA, waits for data-status 200 and checks a card rendered.
- **Responses are compressed** (brotli, then gzip) in the send helpers; API JSON is minified unless `?pretty=1`; `/` and the API bodies are cached per (view, fetchedAt, UTC minute), so a late official snapshot applied to the cached payload can lag on the page by up to 60 s; `/api/*` has a per-address token bucket (60 burst, 1/s), with `/`, `/assets`, build-info, data-status and warm-up 202s exempt. Security headers ride on every response; HSTS is on because Railway redirects http to https. **`?debug=1` now needs `Authorization: Bearer <SITE_EDIT_TOKEN>` or `DEBUG_PAYLOAD=1`**; the assessment recheck procedures must send it. The editor keeps its key in sessionStorage with a "Forget key" button and throttles failed attempts. A report-only CSP was deferred: it needs a per-request nonce on every inline `<script>` in `buildHtmlPage`.
- **A one-day race stays on the page on its race day** (`isOneDayRaceAwaitingResult`, generalised from the Worlds rule) and its own article is read on the live cadence that day and the next through the existing one-day path; `buildRaceData` takes `options.now`. `HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT` counts only one-day WorldTour races and covers both sections' recent cards (cold build 5.9 s with 24 targets). A table captioned "Final general classification" is accepted as the GC after the last stage.
- **A zero gap is a fact, not a blank**: `buildStandingEntry` sets `sameTime: true` when the source wrote `+ 0"`, `+0:00`, "s.t." or "same time" (`isSameTimeMarker`), and the card prints "same time" with a tooltip. `normalizeStandingGap` still returns "" for it, so nothing that computes on gaps changed. One-day cards get a "Finished today"/"Yesterday" pill on the host-country day (`describeOneDayRecency`; `buildRaceCard` takes a clock). The classification label under the jerseys is a `<button>`: hover opens the floating card on a pointer device, a click or tap opens the top five inline under the list (`.jersey-inline-card`), Escape closes. The nationals clipping at 390px (A2) was NOT the almanac grid's own rule: the cause was `.competition-stack`'s implicit `auto` grid track, which let a block with an intrinsic width (the schedule strip, the status grid) widen past the section; it now has `grid-template-columns: minmax(0, 1fr)`, and the one long chip ("Include 22 federations without…") wraps its words. The smoke test's framed-390px probe (`runFramedProbe`) now guards it: no element in the section may pass the right edge, the sideways-scrolling results table excepted. Verify phone widths that way, never with a bare `--window-size=390`. The rider index records `bestPlacing` for riders with an empty tally; team names carry no `data-rider-key`, so no card. The hero eyebrow is "An independent race desk", the subtitle one sentence, the footer names the sources and the non-affiliation, and About opens with the same paragraph and a privacy note.
- **Providers are keyed by season, not by a literal year** (`seasonEditionProvider`, `matchesSeasonEdition`: the title without its leading year plus `getRaceYear(race) === SEASON_YEAR`, read live); the eight `!== 2026` gates went with it. `parseSeasonRows` accepts any `wikitable … plainrowheaders` class order, attributes on row separators, and maps columns by the header row (positional only when there is no header). `buildRaceMetadata` refuses to replace a populated build with an empty one (`lastPopulatedRaceMetadata`, marked `rejectedEmptyBuildAt`; not yet surfaced in the debug payload). `fetchText` no longer retries a definitive 4xx. A failed revision query advances `checkedAt` and records `lastIndexError` on the index instead of refetching every page. `findOverallRaceResult` skips a block titled with another year and prefers the block under the Result heading. Article helpers tolerate null input. `clearSeasonCaches` runs inside `resolveSeasonYear` the moment the year moves. A finished race's stories are grouped result-first (`orderRaceArticlesForDisplay`). The medal summary accepts Medallists/Medalists headings, `{{Main}}` and `{{FlagIOCmedalist}}`.
- **Sourcing**: news-search caps are 10 live / 8 settled (measured 5-10 per race); the YouTube Data API path is wired behind `YOUTUBE_API_KEY` (search, videos and channels calls, about 102 quota units a lookup) and takes over the moment the key is set, the search-page scrape remaining until then; the nationals parser maps columns by header text (real page as a fixture); OFL licence texts sit beside the fonts; `DATA-SOURCES.md` was brought into line with a dated review-log entry.
- **Merging lesson**: every branch appended tests at the end of `test/parser-regressions.test.js` and several extended the harness export block, so each merge conflicted there; resolving by keeping both sides needs the closing `});` and `},` lines checked by hand, because git treats a shared trailing closer as common and a naive dedupe drops repeated `},` lines. `node -c` on the test file after every resolution.
- **The first screen, later the same evening (comp B).** The hero's subtitle is now the season status line (`buildSeasonStatusLine`, shared with the calendar header so the two never disagree) whose "next" is Worlds-aware (`describeNextRace`: the WorldTour calendar's next race or the next Worlds event, whichever is sooner, "today"/"tomorrow" when it is); under the timestamp a Today/Yesterday pill and the day's headline (`buildHeroHeadline`: the newest one-day, finalized or live-stage result on the host-country day; older results get no line). The sentence written earlier that evening stays as the fallback for a payload with no calendar. On phones the menu is a flex row of chips; three entries carry a short label in a second span (`HERO_MENU_SHORT_LABELS`, `buildHeroMenuLabel`) that the ≤720px rules swap in. Upcoming cards (`buildUpcomingCard(race, now)`, the call site must not pass `map`'s index as the clock) carry a tier chip (`UPCOMING_TIER_CHIPS` from `getSeasonCalendarTier`, never for the Worlds), "Saturday, in 14 days" or "Tuesday to Sunday, in 17 days · 6 days" (`describeUpcomingWhen`, host-country day), and "Last year: 🇸🇮 Tadej Pogačar" from `race.previousWinner`, which `attachPreviousSeasonWinners` sets in `buildRaceMetadata` from `loadPreviousSeasonWinners(SEASON_YEAR - 1)`: the previous season's two WorldTour pages, parsed by the same `parseSeasonRows`, cached per process (a failure is cached as empty and logged), joined by series and title, and settled by `applyCanonicalRiderNames`. The calendar: `buildCalendarChampionships(data, today)` builds the four Worlds rows at render time (their winners arrive with the payload's enrichment, not the metadata), drawn as a "World Championships" lane on the "both" timeline with a rainbow gradient per view id and listed among the months with a rainbow dot; they are never counted among the WorldTour races. The phone month list folds the finished months into one native `<details class="season-months-past">` (summary "January to August · 56 races run · Open"), so the list opens at this month; the old per-month `season-month-folded` is gone. `buildSeasonCalendarSection` takes a clock as its third argument; the existing test passes one, because the "next" line says "tomorrow" on the right day.
- **Still open from the plan**: the CSP; the ETag on `/`; an external uptime monitor and Railway's wait-for-CI (maintainer settings); the YouTube key or curated-only decision; the ASO email; nationals from Wikipedia; persisting found finish videos; the first-screen comps (hero "Today" strip, upcoming cards) awaiting the maintainer's choice; the `rejectedEmptyBuildAt` flag in the debug payload; the revision-index backoff has no test.

## Process Lessons From The 2026-09-27 Session

The remediation queue written at 00:00 UTC, taken in one session of about 40
minutes of wall clock with four agents in parallel (commits 1ac9f2f → 0532b1e).

What shipped, with the numbers measured:

- **Finish videos (R7).** Every finished race and stage is searched through the
  YouTube Data API, six per rebuild and sixty a day, newest first; hits are final,
  misses wait a week, errors 20 minutes with the backlog paused an hour. The finds
  persist in `data/finish-videos.json` (`npm run refresh:finish-videos`,
  `/api/finish-videos`). Production had found four (Montréal, Vuelta 10, 20, 21) by
  00:40 UTC, over three deploys. The in-memory daily counter restarts with every
  deploy: six deploys today each spent up to seven lookups, so the quota, not the
  counter, is the backstop on a busy day.
- **Feeds and winter states (P5, F2/F3, A13/F23).** `/calendar.ics` (65 events, no
  line over 75 octets) and `/feed.xml` (135 entries), the winter "season opens" card.
- **ETag (S8) and dedupe (X2).** A content-hash ETag with `-br`/`-gzip` per
  representation; one in-flight promise per race in `stageHistoryCache`.
- **Fonts (S4, S9).** 550 KB of TTF → 192 KB of woff2; `size-adjust` calibrated in
  headless Chrome because the font-table average ran 5 to 10% wide.
- **Assets out of the template (M7).** `assets/site.css` (76 KB) and
  `assets/site.js` (42 KB), inlined from disk; bytes unchanged.
- **Ship less HTML (S3, partial).** 1,432 KB / 58 cards / 14,113 elements →
  555 KB / 22 / 3,846 (62 KB brotli on production); the almanac (208 KB) and the
  calendar (121 KB) are fragments, the rows behind "Load more races" too.
- **Tour of Greece archived (L8); handoff split (M8).**
- **CSP, report-only (01:00 UTC).** `buildContentSecurityPolicy` on the results page:
  the client script by its sha256 (the script element holds exactly the file), the
  analytics host, `'unsafe-inline'` styles, reports posted to `/api/csp-report` and
  logged as `csp-report`. A nonce was ruled out because the page bodies are cached
  and shared between requests.

Traps met:

- Merging two branches that both append to the end of the test file loses the
  closing `});` at the seam (twice today). `node -c` catches it.
- `git pull --rebase` on a branch holding merge commits replays them linearly and
  re-raises their conflicts. Fetch, check origin, push.
- `assert.deepEqual` on any object built inside the VM harness fails across realms;
  compare `JSON.parse(JSON.stringify(...))`.
- `history.replaceState` throws on a file:// page, so the smoke test could never
  open the calendar until the client went through `replaceAddress`.
- Race ids that already start with "race-" get the anchor prefix again
  (`race-race-1`): fixtures should use realistic ids.
- The Railway CLI is installed and logged in but the project is not linked, so
  production logs were not readable from the session; `railway link` is interactive.

### What each item left behind (2026-09-27)

- Item 0 (R7): see "The backlog and the persisted file" under "Finish Video Links".
- Item 1 (P5, F2/F3, A13/F23): `/calendar.ics` and `/feed.xml` are built per request from
  the cached payload and never touch the response-body LRU; UIDs and Atom ids are the
  card anchors (`createRaceAnchorId`), so renaming a race's page title changes its id in
  subscribers' calendars: keep anchors stable. Feed entries are dated at midnight of the
  race or stage day in the host zone (`formatDayInZoneRfc3339`); a stage with no
  route-table date is placed by its number from the start date. iCalendar folding is
  done by hand (`foldIcsLine`) because the VM harness has no `TextEncoder`/`Buffer`.
  `buildCompetitionSection(group, data, now)` now takes the payload; the winter
  "season opens" card appears only for the two WorldTour groups when `seasonCloseout`
  exists, with the hero's month-only wording when `nextSeasonOpening` is null.
- Item 2 (S8): the ETag on `/` and the payload endpoints is a hash of the cached bytes,
  not `fetchedAt`, because the response cache re-renders per UTC minute and
  `/api/race-stages` clears it; either can change the body under one `fetchedAt`, and
  a 304 for a changed page is the one bug an ETag must never have. Compressed bodies
  get a `-br`/`-gzip` suffix (strong tags are per representation). `sendPreparedBody`
  reads `response.req.headers["if-none-match"]`; only bodies from
  `getCachedResponseBody` carry a tag, so 404/500, `/api/race-news`, `?debug=1` and
  the static assets are unchanged.
- Item 3 (X2): `loadRequestedStageHistory` keeps the in-flight promise in
  `stageHistoryCache` (`{ fetchedAt, stages, promise }`) the way `articleCache` does;
  a failure deletes the entry so the next call retries.
- Item 4 (S4, S9): fonts ship as woff2 (192 KB for six faces, was 550 KB of TTF);
  both heads preload Barlow Semi Condensed 800 and Manrope 500; local Arial and Arial
  Narrow fallback faces are metric-matched. `size-adjust` was calibrated in headless
  Chrome on the site's own strings because the font-table average ran 5 to 10% wide
  (Arial's capitals against Barlow's): re-measure in a browser, not from tables, if a
  face changes. The about page's `@font-face` block is a one-line copy of the results
  page's; keep the two in step (they had drifted).
- Item 5 (M7): the stylesheet and homepage client script are `assets/site.css` and
  `assets/site.js`, read by `readSiteAsset` (from `process.cwd()`, the harness has no
  `__dirname`) into `HOMEPAGE_STYLESHEET` / `HOMEPAGE_CLIENT_SCRIPT` once per process
  and inlined unchanged, so the page's bytes did not change. The script's one
  interpolation, the deferred-group list, is now `buildDeferredGroupsScript` (a JSON
  element, id `deferred-groups`) read on load. `test/browser-smoke.test.js` reads the
  two files instead of slicing `server.js`. The about page's stylesheet and the warm-up
  page's script are still inline template literals. The CSP nonce (next item) can now
  wrap the two inline blocks in `buildHtmlPage` without touching the files.
- Item 6 (S3): the page carries only the first row of each section's recent results
  (`buildRecentResultsBlock`, with `data-recent-anchors`, the anchors of every race in
  order) and stubs for the almanac and the calendar (`buildNationalChampionshipsStub`,
  `buildSeasonCalendarStub`, both keeping the section id and naming
  `data-fragment-src`). `/api/recent-races?group=&after=<anchor>&until=<anchor>`
  (`buildRecentRacesFragment`) answers the next row or every row through a linked
  card; `/api/national-championships` and `/api/season-calendar` answer `{ html }`
  through the response LRU. On the client `loadRecentRaces` appends rows (skipping a
  card already present), `revealRaceCard` fetches a card's row for calendar bars, feed
  links and `#race-…` hashes (`bindRaceHashJump`), `bindFragmentSections` swaps the
  almanac in as it scrolls near (900 px) and `bindSeasonCalendar` fetches the calendar
  when opened and binds it (`bindSeasonCalendarSection`) then. Measured locally with
  `assessments/tools/area2/compose.js`: 1,432 KB / 58 cards / 14,113 elements before,
  555 KB / 22 / 3,846 after (62 KB brotli); the almanac is 208 KB and the calendar
  121 KB on demand. The 400 KB target needs A10 next. `history.replaceState` throws on
  a file:// page, so the client goes through `replaceAddress`; the smoke test now opens
  the calendar. The deferred-group machinery (`/api/competition-section`) is still
  unused (`DEFERRED_COMPETITION_GROUP_IDS` is empty).
- Item 7 (L8): `fetchTourOfGreeceOfficialSnapshot` and its helpers are in
  `archive/tour-of-greece-provider.js`; the fixture and its two tests are gone.
- Test trap: `assert.deepEqual([], vmArray)` and `deepEqual` on any object built inside
  the VM harness fail because the sandbox's prototypes are another realm's; compare
  `JSON.parse(JSON.stringify(...))` copies.
