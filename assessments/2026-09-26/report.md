# Project assessment, September 2026

The first full check-in on Pro Cycling Results: nine areas assessed independently on 26 September 2026 against commit `9dc326f`, the evening of the Worlds women's road race, then brought together here with one remediation plan. Read this document first; each area's full findings, evidence and recheck procedure are in `areas/`, and the scripts that produced the measurements are in `assessments/tools/`.

## 1. Verdict

The site keeps its central promise. On a race day the podium is on the front page with no tap, no advertisement and no consent banner, within minutes of the finish on the live Grand Tour path, and it says only what it can show. That combination is rare and it is the thing to protect. Around that core, four problems recur across the nine areas, and each of them was found this season by a reader rather than by the site itself:

- **Nobody is told when it breaks.** One log line in seventeen thousand, sixty-three silent catch blocks, no build error recorded anywhere, and a continuous-integration run that Railway ignores. All thirty-one incidents recorded this season were found by a person; none by a test or a monitor. Today, on production, ten finished one-day cards show three names instead of five, a finished Women's WorldTour Grand Tour shows a three-deep classification, and no finished race carries a finish video. Nothing flagged any of it.
- **One-day race days ride the slow path.** A one-day WorldTour race has no card on its own race day and its winner arrives through an hourly cache. Il Lombardia on 10 October, the last Monument of the year, will be off the page from its start until more than an hour after Wikipedia names the winner. The Worlds got the fix this month; the classics did not.
- **The first phone screen serves none of the three reader jobs, and the page is heavy.** The masthead fills the whole first screen and says nothing about today. The homepage is one 1.36 MB document sent without compression, when compressed it would be 157 KB. The National Championships section is clipped at phone width.
- **Three sources are read against their own terms.** The finish-video search scrapes a page YouTube disallows, and it is not working in production anyway. The organiser rankings partials are disallowed by the organisers' robots files. The national champions index is read against its publisher's no-scraping terms. The public data-sources page, which is the site's best defence, understates one figure by three times and is not linked from the site.

Two further findings are strategic rather than defects. Nothing on the site or in the repository defines the reader, so the product has no yardstick; this report proposes one and the maintainer has approved its substance. And the site cannot be found: a search for its name returns ProCyclingStats. Whether that matters is a decision, not a bug.

Security is sound. The editor token is compared in constant time, feed content is escaped everywhere, request-driven fetches cannot be aimed at arbitrary hosts, and no secret is in the history. What remains is housekeeping: response headers, a token scope check, and a rate limit on a single instance.

| Area | Grade | One line |
|---|---|---|
| 1. Data pipeline reliability | C+ | Live Grand Tours B; one-day race days and detection D |
| 2. Speed of results and pages | C | Server fast, page heavy, first result below the fold on phones |
| 3. Audience definition and fit | B- | Results job well served; landscape and anticipation jobs are not; reader undefined |
| 4. Creativity of idea and execution | B+ / B+ | Candour is the identity; the hero is the one generic screen |
| 5. Feature opportunities | n/a | Three small features would fix the weakest job before Il Lombardia |
| 6. Competitive positioning | Holds in part | Calm and zero taps are real; findability is nil; two rivals unverified |
| 7. Security and privacy | B | Fundamentals right; headers, rate limit and token scope to do |
| 8. Maintainability and operability | C+ | Memory discipline strong; operability D+ because failures are invisible |
| 9. Sourcing and legal footing | Medium risk | Public sourcing statement is a real strength; three reads breach terms |

## 2. Who the site is for

The maintainer's definition, adopted as the yardstick for this and future assessments:

> The reader is a recreational road cyclist who rides at weekends, watches the Tour and a few classics on television, and follows a handful of riders by name. They know the big races and the big names but not every jersey, abbreviation or series. They visit on a phone, in a spare minute, most days during a Grand Tour or the Worlds and once or twice a week otherwise. They want three things: a picture of the race landscape ahead (Job 1), today's result as soon as it is available (Job 2), and a reason to look forward to what is next (Job 3).

| Job | Success measure | Standing today |
|---|---|---|
| 1. Landscape ahead | Within one tap of the first screen, any day of the year, the reader can name the next three races and the next Grand Tour or Monument | The calendar does this well but is hidden behind the fifth button; the off-season has one date |
| 2. Results today | Today's result on the first screen, marked as today's, within ten minutes of the finish | Minutes on the live Grand Tour path; up to seventy-five minutes and no card on a one-day race day; first result below the fold on phones |
| 3. Anticipation | The next race's card gives a countdown, why it matters, distance, and something to read or watch | An upcoming WorldTour card is a name, a date and a country |

This statement belongs in `README.md` under Product Purpose so every future change can be judged against it.

## 3. What we found, by theme

### Detection: the site cannot tell anyone it is broken

Every failure path ends in silence. The four background rebuild paths swallow their errors, there is no handler for unhandled promise rejections, `/api/data-status` reports cache age but not whether a section went empty, and a cold-start build that throws leaves the warm-up page up indefinitely with no trace, which the handoff records happening locally on 15 September. The continuous-integration workflow added on 3 September runs on every push but does not gate Railway: five consecutive red pushes on 15 September all deployed, and the failing test stayed red for four days. The incident record makes the cost concrete: the Tour de France Femmes card was empty for six days, the Worlds cards lacked places four and five for six days, the news line was frozen for two days, and each was noticed by a reader or on a manual check. (Area 8 M1, M2, M3; area 1 R3.)

### Reliability: the live Grand Tour path is good, the rest is uneven

The official-provider path is measured and tested: a stage result on the card about four minutes after the finish, a self-arming timer inside racing hours, a bounded blocking budget. The robustness harness fed nine parsers garbage two hundred and thirty-six times and they returned empty rather than throwing or inventing riders. But the one-day path, which is half the calendar, has no race-day card and an hourly cadence (R1). Two parsers are wrong-but-plausible or site-emptying under realistic drift: the nationals parser reads columns by position and would mislabel every champion if a column moved (R2), and the season-table parser is anchored to an exact table class and column order, so five of seven realistic variants empty the whole site silently (R4), and the January rollover depends on it against pages nobody has seen. Twelve official providers are pinned to "2026" titles and expire at the rollover by design (R8). On production today: La Vuelta Femenina's finished card shows a three-name classification because its final table is captioned in a form the classification reader does not accept (R5); ten of fourteen finished one-day cards stop at three names because a six-race enrichment limit set in the twenty-second cold-start era now counts Worlds events it then skips (R6); and no finished WorldTour race has a finish video (R7, and see sourcing).

### Speed: fast server, heavy page, wrong first screen

The server renders a warm page in about 34 ms and production's median time to first byte is 0.30 s; the payload was 56 s old during a live race. Everything after the first byte lets a phone reader down: 1.36 MB of HTML with no `content-encoding` (157 KB gzipped, measured), 11,283 elements of which a handful are visible, 550 KB of TTF fonts, and on a true 390 px phone the first result card starts at 1,032 px, below a full screen. Everything a phone needs to paint the first result is in the first 190 KB of the document. The two cheapest fixes are independent of the parsers: compress responses with the built-in module, and put today's result on the first screen. A third change, shipping hidden cards and the calendar's SVGs on demand, brings the page to a size that stays fast on a slow day. The build also starts on the first request rather than at boot, so every deploy costs the first reader about seven seconds, and every site-editor save is a deploy. (Area 2 S1 to S5.)

### The reader: Job 2 nearly right, Jobs 1 and 3 barely served

The results card is close to right: top five with times, video, full-results link, news line, live rebuild, an honest timestamp. But today's result is not marked as today's, Worlds results sort men-first rather than newest-first, a rider on the winner's time shows a blank instead of "same time", and the classification top fives are hover-only, so no phone reader and no keyboard user ever sees them. The National Championships almanac grid computes wider than a phone section and is clipped, cutting text mid-word; this is a real defect, and it is not the "hero overflows at 390 px" note in the handoff, which is a headless-Chrome artefact (Chrome will not lay out narrower than 500 px, which also means the smoke test's 390 px pass is really a 500 px pass). The upcoming card is the least designed element on the page: name, date, country. From 19 October to about 9 January the site has no next race at all. (Area 3 A1 to A15; area 4 C3; area 5.)

### Identity: candour is the brand, and the page speaks in three voices

The distinctive things are real: the to-scale season calendar, the close-out letter, the honest-graphics rule with its visible consequences, the almanac, the release notes written to the reader. What defines the site is candour. The hero is the one screen that does not share it: "UCI-Inspired Race Desk" plus a feature list, when the sentence that answers the reader's first question ("58 of 61 WorldTour races run, next: Il Lombardia, 10 Oct") already exists one click away. The results page speaks marketing in the hero, engineer in the section copy ("arranged in a three-column grid on larger screens"), and committee only on About. Nothing on the page says where results come from, that there are no ads, or that the site is not affiliated with the UCI whose rainbow bands it borrows. (Area 4 C1, C2; area 6 P2, P3; area 3 A8, A9.)

### Positioning: the hypothesis holds where it could be tested

Against Cyclingnews (one tap into a 2.3 MB live blog with nine ad units and a consent manager), Flashscore (a JavaScript shell with twenty ad containers) and the UCI (results in a tab named `results0`), this is the only front page that does all three jobs at once with nothing to navigate, for men and women equally. ProCyclingStats and FirstCycling, the two sites the hypothesis names, block automated fetches, so the comparison against them is unverified and needs a phone and ten minutes. The site cannot be found: its name search returns ProCyclingStats, the domain is a platform subdomain, and the obvious social handle belongs to someone else. Whether discoverability is a goal is the first decision in section 5. (Area 6.)

### Sourcing: a considerate guest with three exceptions

The public data-sources page, the policy address in the user agent, the revision-index reads of Wikipedia with `maxlag`, the six-hour cadence on finished races: this is better hygiene than most hobby sites and the reason the risk is medium rather than high. The exceptions: the YouTube results page is disallowed by robots and by terms, and the search appears not to work from production anyway (three of forty-four cards carry a video, all Worlds); the organisers' rankings partials are disallowed by their robots files and their conditions forbid extraction; the Cyclingnews index is read hourly against Future plc's no-scraping terms. The data-sources page says "about ten" news searches per race while the code caps at thirty-two, and the site never shows the reader a sources or licence line. (Area 9 L1 to L6.)

### Security: right fundamentals, housekeeping due

Escaping is consistent, request-driven fetches are keyed to known race ids and answer 404 in 0.2 s otherwise, the editor uses a bearer header with a constant-time compare and a body cap, and the history holds no secrets. Production sends no security headers at all; the editor keeps its key in browser storage on a page that also loads the analytics script; failed authentications are not throttled; the GitHub token behind the editor can write any path on `main`, which deploys, and its scope is not knowable from the code. There is no rate limit and the page is re-rendered per request, so one looping client can pin the single instance. (Area 7 X1 to X5.)

### Maintainability: the memory is strong, the file is at its ceiling

The documentation-as-memory practice works: every commit since 15 September left a release note and a handoff line, and production is verifiably on HEAD. The costs are now visible: `server.js` is 17,113 lines, its largest function is 4,306 lines because the stylesheet and client script live inside one template literal, the ASO providers are copy-pasted in twenty-line pairs, README is stale on continuous integration, Node version, security and secrets, and the handoff at 1,930 lines is becoming hard to navigate. Node is 20 on production, 22 in continuous integration and 25 locally. One person holds every account and token and no document says what they cost or how to rotate them. (Area 8 M4, M7 to M13.)

---

## 4. Remediation plan

Effort: S is under a day, M a few days, L a week or more. "Decision" marks items that need an answer from section 5 first. Each item names the findings it closes; their evidence and fix details are in the area files.

### Phase 0: before Il Lombardia on 10 October

The race-day path, the detection gap, and the cheapest speed and phone fixes. All small; none needs a decision.

| # | Change | Closes | Effort |
|---|---|---|---|
| 1 | Keep a one-day race on the page on its race day (upcoming card marked "Today") and read its article on the live cadence, as the Worlds already do | R1 | S-M |
| 2 | A `logEvent` helper writing JSON lines to stdout, called from every rebuild catch, the 500 handler and an unhandled-rejection hook; record `lastBuildError` on the cache and expose it with per-section counts in `/api/data-status`; point a free uptime monitor at it | M1, M3, R3 | S |
| 3 | Compress HTML and JSON responses with the built-in `zlib` module; drop pretty-printing on the API | S1, S6, P4 | S |
| 4 | Start the data build at boot, not on the first request | S5 | S |
| 5 | Fix the National Championships grid at phone width and add a true-390 px overflow assertion to the smoke test; correct the handoff's 390 px note | A2, P6, S10, C7 | S |
| 6 | Count only one-day WorldTour races toward the recent-results enrichment limit and raise it to cover the cards shown | R6 | S |
| 7 | Accept "Final general classification" captions in the classification reader | R5 | S |
| 8 | Turn on Railway's wait-for-CI gating; add `scripts/verify-deploy.js` encoding the poll-and-check loop; pin Node 20 in `engines`, `.nvmrc` and the workflow | M2, M13, X10 | S |
| 9 | Security headers in one helper (HSTS after confirming the redirect, CSP report-only first, nosniff, frame-ancestors, referrer policy); keep the editor key in memory for the page; check the GitHub token is fine-grained, one repository, contents only | X3, X4, header table | S |
| 10 | Lower the news-search caps to match the data-sources page, or correct the page; add the review-log line | L4, X2 | S |

### Phase 1: October and November, through the close-out on 19 October

The reader-facing changes. Items 11 and 12 touch the first screen and should be comped with real data first, as the repository's own rule asks.

| # | Change | Closes | Effort |
|---|---|---|---|
| 11 | A one-line "Today" strip in the hero from data already in the payload: today's headline result and what is next; shrink the feature list; collapse the five phone buttons | A1, S2, C2, F5 | M, decision 2 |
| 12 | Upcoming cards that sell the race: tier chip, weekday and countdown, duration, last year's winner from the previous season's two pages | A3, F1 | S-M, decision 3 |
| 13 | "Today" and "Yesterday" pills on one-day cards; newest-first ordering of Worlds results; "same time" where a gap of zero is known | A4, A5, C3, F24, P7 | S, decision 4 |
| 14 | One voice: rewrite the ten reader-facing strings on the results and warm-up pages in the release-notes register; drop "UCI-Inspired"; stop describing the layout | C1, A9, P3 | S |
| 15 | A footer line and an About paragraph: where results come from, no ads, no tracking beyond a page counter, not affiliated with the UCI or any organiser, links to the data-sources page; a two-sentence privacy note; label outbound "Full results" links with their destination | P2, L5, A8, X11, L9, P8 | S |
| 16 | Replace the YouTube results-page scrape with the Data API or curated links only; persist found videos the way stage profiles are so finished races keep theirs | L1, R7 | M, decision 6 |
| 17 | Write to ASO about reading the public rankings page during a Grand Tour, and prefer that page over the ajax partials where it carries the table; record the answer | L2 | S plus M |
| 18 | Read the national champions from a Wikipedia list article instead of Cyclingnews, mapping columns by header text; keep the outbound links | L3, R2 | M, decision 7 |
| 19 | README pass: correct the six stale statements, add an "Accounts and secrets" section with scope, rotation and monthly cost, replace "read server.js end to end" with the fast-start guidance | M8, M4, README corrections in area 7 | S |
| 20 | Throttle failed editor authentications; scheme allow-list on feed URLs; gate the debug query behind the token | X5, X6, X7 | S |
| 21 | Release note for the close-out the week it goes live, and a read-through of the letter with the calendar's numbers | area 4 recheck | S |

### Phase 2: winter, before the rollover on about 9 January 2027

Structural and parser work best done when nothing is live, plus the features that fill the winter gap.

| # | Change | Closes | Effort |
|---|---|---|---|
| 22 | Loosen the season-table parser (class match, header-mapped columns), refuse to replace a non-empty metadata build with an empty one, commit a real season-page fixture | R4, M10 | S-M |
| 23 | Key official providers on the title without the year plus the season, and add a test that fails when any provider matches no race in the season list; write the January checklist into the handoff | R8, M5 | S |
| 24 | Ship less HTML: serve rows behind "Load more", the calendar section and the almanac as fragments on demand; convert fonts to woff2 and subset them | S3, S4, S9, C9 | M |
| 25 | Move the stylesheet and client script to files under `assets/` read once at boot, so `buildHtmlPage` shrinks from 4,306 lines to about a hundred and the backtick trap disappears | M7 | M, decision 12 |
| 26 | Split the handoff into a durable map and a dated journal | M8 | M, decision 12 |
| 27 | Collapse the ASO provider family into one parameterised builder when one of them next needs a change | M9 | M |
| 28 | An iCal feed with "Add to calendar" links; an Atom feed of finished races; dated winter empty states and the next season's first races once its pages carry dates | F2, F3, F23, P5, A13 | S each |
| 29 | Make classification top fives tappable and keyboard-reachable; collapse finished stage-race cards on phones; 44 px tap targets | A6, A10, A11 | S-M |
| 30 | A guide page for newer fans (Monuments, jerseys, the season's shape), linked from tier chips and jersey labels | F9 | S |
| 31 | Remaining lows: medal-summary spellings, previous-edition block guard, no retries on 4xx, revision-query backoff, null guards, cache clearing at rollover, static-guard separator, font licence files, dormant providers archived | R9 to R13, M12, X8, X9, L7, L8, L10 | S each |
| 32 | If discoverability is a goal: a custom domain, `sitemap.xml` and `robots.txt`, a decision on the brand, one post where fans read | P1, P9 | M, decision 1 |

### Phase 3: the 2027 season

Monthly check-ins on the cadence in `assessments/README.md`, with the nine recheck procedures, and a quarterly rerun of positioning and sourcing. Five analytics events (calendar open, stage chip, news line, rider card, refresh) would give the next check-in usage evidence this one lacked. Dark mode and route previews for upcoming stage races are winter candidates once the above is done.

## 5. Decisions only the maintainer can make

1. **Is being found a goal?** The data-sources page says "he and a few friends"; the hypothesis behind this assessment says "win on findability". They are different products. If yes: domain, sitemap, a brand decision (the committee is the memorable thing), and one post. If no: say so on About and stop worrying about search.
2. **May one line of "today" take space under the hero?** The 4 September rule says nothing calendar-related occupies space until asked. The calendar's compact option was kept for a teaser; the smaller ask is one line of text.
3. **Is a once-per-process read of last season's two WorldTour pages acceptable** for the "Last year: winner" line, documented with a measured count?
4. **Should Worlds results stay men-first** on a day when the women's race is the news?
5. **Should the committee's voice appear on the results page** at all? The assessment assumes results stay in the neutral register with at most one hand-written line.
6. **YouTube:** obtain a Data API key (a Google account and a quota) or drop the search and curate finish videos by hand. Either way the scrape goes.
7. **Nationals from Wikipedia rather than Cyclingnews?** It removes a terms breach and a positional parser in one change; the Wikipedia list article needs a look first.
8. **Outreach:** are you willing to email ASO, and possibly komoot and Future, with the data-sources link? One email each turns a grey area into a known position.
9. **Analytics:** can you share the Umami dashboard, and do you want five custom events added so the next check-in has usage evidence?
10. **Tokens and accounts:** what kind of token is the GitHub token and what can it reach; how was the edit key generated; who else can log into Railway and GitHub; what does the site cost per month.
11. **Delivery:** turn on Railway's wait-for-CI; accept that every site-editor save restarts the process mid-race, or exclude the two markdown files from redeploys.
12. **Structure:** move the stylesheet and client script to files under `assets/`, and split the handoff into a map and a journal, before either passes the point of no return.
13. **Scope leftovers:** trim the static-snapshot file to Romandie, archive the dormant Tour of Greece, Asturias and Anicolor providers, or leave them.

---

## 6. Findings register

Every finding from the nine areas, most severe first within each area. Severity is the assessor's; effort is S under a day, M a few days, L a week or more. Feature candidates (area 5) are ranked in that area's file rather than listed here.

| ID | Area | Severity | Finding | Effort | Plan item |
|---|---|---|---|---|---|
| M1 | 8 | Critical | A failed build is invisible: one log line, silent catches, no error recorded | S | 2 |
| R1 | 1 | High | One-day race off the page on its race day; winner on the hourly cadence | S-M | 1 |
| R2 | 1 | High | Nationals parser is positional; a column change mislabels every champion silently | S | 18 |
| R3 | 1 | High | No runtime observability; zero of thirty-one incidents detected automatically | M | 2 |
| R4 | 1 | High | Season-table parser is a single point of failure; drift empties the site silently | S-M | 22 |
| S1 | 2 | High | No response compression; 1.36 MB on the wire per page view | S | 3 |
| S2 | 2 | High | First result below the fold on phones | M | 11 |
| A1 | 3 | High | First phone screen is a masthead that says nothing about today | M | 11 |
| A2 | 3 | High | National Championships section clipped at phone width | S | 5 |
| A3 | 3 | High | Upcoming cards give Job 3 almost nothing | M | 12 |
| C1 | 4 | High | Three voices on one product; only one is the site's own | S | 14 |
| P1 | 6 | High | The site cannot be found; its name search returns ProCyclingStats | M | 32 |
| M2 | 8 | High | Continuous integration is advisory; red pushes deploy | S | 8 |
| M3 | 8 | High | Data-status cannot detect an empty section; no alerting | S | 2 |
| M4 | 8 | High | Bus factor one; no record of accounts, tokens, costs or rotation | S | 19 |
| M5 | 8 | High | Rollover silently drops nine providers; nationals address and Worlds parser are guesses | S | 23 |
| L1 | 9 | High | YouTube results page scraped against robots and terms | M | 16 |
| L2 | 9 | High | Organiser conditions forbid extraction; robots disallow the ajax partials read | S+M | 17 |
| R5 | 1 | Medium | La Vuelta Femenina finished card shows a three-name classification | S | 7 |
| R6 | 1 | Medium | Ten of fourteen finished one-day cards stop at three names | S | 6 |
| R7 | 1 | Medium | Finish videos vanish after a week or a deploy; none on finished races today | M | 16 |
| R8 | 1 | Medium | Every provider pinned to the 2026 edition | S | 23 |
| S3 | 2 | Medium | The page ships every card and hidden section | M | 24 |
| S4 | 2 | Medium | 550 KB of TTF fonts in six weights | S | 24 |
| S5 | 2 | Medium | Build starts on first request, not at boot | S | 4 |
| A4 | 3 | Medium | Today's result not marked as today's; Worlds men-first | S | 13 |
| A5 | 3 | Medium | A rider on the winner's time shows a blank | S | 13 |
| A6 | 3 | Medium | Classification top fives are hover-only | S-M | 29 |
| A7 | 3 | Medium | Calendar hidden behind the fifth button, omits the Worlds, opens at January | S-M | 11, 28 |
| A8 | 3 | Medium | The site never says where results come from or how fresh they are | S | 15 |
| A9 | 3 | Medium | Jargon and internal labels in reader-facing copy | S | 14 |
| A10 | 3 | Medium | Phone page is seventeen screens long | M | 29 |
| C2 | 4 | Medium | The hero is the most generic screen and the first one | S-M | 11 |
| C3 | 4 | Medium | Same-time rows read as missing data | M | 13 |
| P2 | 6 | Medium | Sourcing statement and ad-free stance invisible on the page | S | 15 |
| P3 | 6 | Medium | "UCI-Inspired" and rainbow bands can read as affiliation | S | 14, 15 |
| P4 | 6 | Medium | One 1.36 MB document; compression unverified (now verified absent) | S-M | 3 |
| P5 | 6 | Medium | No subscription channel for results | M | 28 |
| P6 | 6 | Medium | Nationals clipped at phone width (duplicate of A2) | S | 5 |
| X1 | 7 | Medium | No per-client limit; page re-rendered per request | S | 3, 20 |
| X2 | 7 | Medium | Upstream fan-out bounded per race, not per client; no in-flight dedupe on stages | S | 10 |
| X3 | 7 | Medium | Edit key in browser storage beside a third-party script; no CSP | S | 9 |
| X4 | 7 | Medium | GitHub token is a deploy credential of unknown scope | S | 9 |
| X5 | 7 | Medium | No throttle on failed editor authentications | S | 20 |
| M6 | 8 | Medium | Tests that read the real clock break on their own | S | 8 |
| M7 | 8 | Medium | 4,306-line render function holding CSS and client script in one literal | M | 25 |
| M8 | 8 | Medium | README stale where an agent decides what is safe | S | 19 |
| M9 | 8 | Medium | Duplicated ASO provider code | M | 27 |
| M10 | 8 | Medium | Season table and news feed parse have no fixture | S | 22 |
| L3 | 9 | Medium | Cyclingnews read hourly against no-scraping terms | M | 18 |
| L4 | 9 | Medium | News-search volume three times what the sourcing page states | S | 10 |
| L5 | 9 | Medium | No reader-visible sources or licence statement | S | 15 |
| L6 | 9 | Medium | komoot traces from an undocumented API committed publicly | S | 17 |
| R9 | 1 | Low | Medal-summary fallback hangs on three exact template spellings | S | 31 |
| R10 | 1 | Low | One-day result reader takes the first "result" block, could show last year's | S | 31 |
| R11 | 1 | Low | Definitive 4xx responses are retried | S | 31 |
| R12 | 1 | Low | A failed revision query refetches every page every rebuild | S | 31 |
| R13 | 1 | Low | Article helpers throw on a null article | S | 31 |
| S6 | 2 | Low | API JSON pretty-printed | S | 3 |
| S7 | 2 | Low | Rider index parsed on phones that never use it | S | 24 |
| S8 | 2 | Low | No validator on the HTML; every back-navigation refetches | S | 24 |
| S9 | 2 | Low | Font swap reflows the first screen | S | 24 |
| S10 | 2 | Low | Headless Chrome cannot go narrower than 500 px; phone checks were made at 500 | S | 5 |
| A11 | 3 | Low | Tap targets under phone guidance | S | 29 |
| A12 | 3 | Low | Contrast of place badges and disabled chips | S | 29 |
| A13 | 3 | Low | Off-season serves Jobs 1 and 3 with one date | S-M | 28 |
| A14 | 3 | Low | Landmarks and heading depth | S | 29 |
| A15 | 3 | Low | Fixed Eastern time zone | S | 13 |
| C4 | 4 | Low | Rider card opens for teams and says only what it does not know | S-M | 29 |
| C5 | 4 | Low | The committee is invisible on the page readers use | S | decision 5 |
| C6 | 4 | Low | A finished race's news line can lead with a pre-race story | M | 13 |
| C7 | 4 | Low | The handoff's 390 px note is a harness artefact | S | 5 |
| C8 | 4 | Low | Per-panel unit toggles repeat 216 times | S | 29 |
| C9 | 4 | Low | 1.36 MB at first paint is the ceiling of render-everything-inline | M | 24 |
| P7 | 6 | Low | Today's result third in the row on a phone | S | 13 |
| P8 | 6 | Low | Outbound links do not say where they go | S | 15 |
| P9 | 6 | Low | The address reads as a test deployment | S | 32 |
| X6 | 7 | Low | Feed URLs reach href without a scheme allow-list | S | 20 |
| X7 | 7 | Low | Debug surfaces are public | S | 20 |
| X8 | 7 | Low | Static guard compares a prefix without a separator | S | 31 |
| X9 | 7 | Low | Markdown renderer allows protocol-relative links | S | 31 |
| X10 | 7 | Low | `.env` not ignored; Node version floats | S | 8 |
| X11 | 7 | Low | No privacy line; analytics tag on error pages | S | 15 |
| X12 | 7 | Info | Large parsers unaudited for catastrophic backtracking; cap upstream body size | M | 31 |
| M11 | 8 | Low | Every editor save redeploys mid-race | S | decision 11 |
| M12 | 8 | Low | Caches never clear across seasons | S | 31 |
| M13 | 8 | Low | Node 20 in production, 22 in CI, 25 locally | S | 8 |
| M14 | 8 | Low | Harness constraints not in the test file header | S | 19 |
| L7 | 9 | Low | Wikitext read through a robots-disallowed path with concurrency three | M | 31 |
| L8 | 9 | Low | Tour of Greece provider cannot reach its source | S | 31 |
| L9 | 9 | Low | No privacy statement for analytics or browser storage | S | 15 |
| L10 | 9 | Low | Bundled fonts lack their licence files | S | 31 |
| L11 | 9 | Low | Site name sits next to ProCyclingStats | S | decision 1 |
| L12 | 9 | Low | Two data-sources statements no longer exactly true | S | 10 |
| L13 | 9 | Low | Organiser link clauses would bite if cards linked to organiser pages | S | none, keep as is |

## 7. Method and confidence

Nine assessors worked independently from the same brief: the repository at `9dc326f`, the adopted reader statement, read-only rules, and a cap on production requests (no more than fifteen per area, none destructive). Four of them ran code in isolated worktrees: the reliability harness fed nine parsers 236 malformed inputs; the speed assessor ran the repository's own benchmarks and rendered the page at a true 390 px through an iframe; the security assessor traced every query parameter to its lookup and made five probes; the maintainability assessor measured the file, the tests, the docs and the continuous-integration history. The rest worked from the code, the live pages and public sources.

The synthesis author checked the claims that drive the plan directly against production on the evening of 26 September: the number of finished cards with five names and with a finish video (from the payload), the National Championships clipping (from the assessor's screenshot at a true 390 px), the absence of `content-encoding` (one header request), the five red continuous-integration runs that deployed (from the run history), and the race-day bucket rule and enrichment limit in the code. The Worlds parser defect that opened the day (the "Athlete" column heading) was fixed and deployed before the assessment began and is not in the register.

Not verified: ProCyclingStats and FirstCycling, which answer automated fetches with a Cloudflare challenge, so the positioning claims about them rest on search titles; any usage data, because no analytics export was available; and the phone rendering on a real device, which the recheck should include once. The sourcing area is a software assessor's reading of terms pages, not legal advice; its section 7 lists six questions for a lawyer. Request caps were respected except in the sourcing area, where three hosts saw one extra request each from a guessed terms-page address that answered 404.

## 8. How to repeat this

The cadence, the per-area recheck procedures and the tools are described in `assessments/README.md`. In short: a full check-in on the last Tuesday of each month while there is racing (January to October), a lighter one each quarter over the winter, and an event-triggered check in the week of the rollover, the week of the Worlds, and the week the close-out goes live. Findings keep their IDs from one report to the next so the register in section 6 becomes the tracker: each month's report says which items closed, which moved, and what new IDs appeared. The PDF is built from this Markdown with `npm run assessment:pdf`.
