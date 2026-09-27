# Data sources and how we use them

Pro Cycling Results is a hobby project. It was built by an amateur cyclist so that he
and a few friends could see the day's results, the stage profile and the overall
standings on one page without wading through everything else. It is not a business,
it carries no advertising, and it does not sell or redistribute the data it shows.

Everything on the page comes from somewhere else, and we are grateful for it. This
document says where, what we take, how often we ask, and what we do to stay a
considerate guest. It is also the address in our user agent, so that anyone who
operates one of these sites and sees us in their logs can find out who we are and how
to reach us.

## Who to contact

- Open an issue on this repository: https://github.com/streamrD/ProCyclingResults/issues
- Or write to the address in our user agent, when one is set for the deployment.

If you run one of the sites below and would like us to fetch less, fetch differently,
or stop, tell us and we will. We would rather lose a feature than be a nuisance.

## How we identify ourselves

Every request the server makes carries this user agent:

```
Mozilla/5.0 (compatible; ProCyclingResults/1.0; +https://github.com/streamrD/ProCyclingResults/blob/main/DATA-SOURCES.md; <contact email>)
```

The one exception among the sources is the YouTube search for finish highlights, which
carries the same string without the contact email. YouTube answers any agent string
with a token after the policy URL by serving its mobile site, which the highlights
parser cannot read. The policy URL still identifies us there.

One request is not to a source at all: when the maintainer saves the site's own
"About" or "Release notes" page, the server commits that file to this repository
through the GitHub API, authenticated with the maintainer's token and introduced as
"ProCyclingResults site editor".

The site runs as a single small process. There is no crawler, no parallel fleet and
no scraping of pages we do not show.

## What we read, and how often

| Source | What we take | When we ask |
|---|---|---|
| Wikipedia (English) | Race articles and their companion stage articles, the previous season's two WorldTour season pages (read once per process, for the "Last year" line on upcoming cards), plus the season's World Championships article for its schedule and, while an elite event that has been ridden is still waiting on a result, its medal summary, and, from each race day, the page of that elite Worlds event for its result, read as wikitext; one template-expansion call for team names. Between one season's last race and the next one's first, the next season's two WorldTour pages, for the date it opens | Once per rebuild we ask the API which of the pages we track have a new revision (one query per 50 titles, so one or two queries: in season the tracked set, some 66 race pages plus their companion stage articles and the season, Worlds and event pages, runs past 50). Only changed pages are fetched again. Team names are fetched once per process. Next season's pages are asked for at most once a day while they do not exist, once an hour after that, and, if the check itself fails, again after ten minutes. |
| Official race sites. ASO platform: letour.fr, letourfemmes.fr, lavuelta.es, lavueltafemenina.es, tour-auvergne-rhone-alpes.fr and eschborn-frankfurt.de (`/en/rankings` and `/en/rankings/stage-N`, or `/de/klassements` in Frankfurt; during a race also the general-classification partial the rankings page names under `/en/ajax/ranking/`, which their robots.txt disallows and which we have asked ASO about, plus the stage partial on the evening of a race's last stage and the team partial on a team time trial; for the Tour, Tour Femmes, Vuelta and Vuelta Femenina also `/en/stage-N`, for the profile embed). RCS: giroditalia.it (`/en/classifiche/`, `/en/classifiche/di-tappa/N/`, `/en/livefeed/tappa/N/`) and giroditaliawomen.it (`/en/rankings/`, `/en/rankings/di-tappa/N/` and `/en/video/`, for the stage's finish video). Vuelta a Burgos: vueltaburgos.com (`/feminas/wp-json/wp/v2/posts` and the liveblog feed a post names). Dormant, kept in the code but outside the races we show: lavueltaasturias.com (`/wp-json/wp/v2/posts`) | The published stage and general classifications, the stage profile embed the organiser links to, and on the Giro Women site the link to its own finish video | A race in progress is asked once per rebuild (an ASO race at most once every two minutes). A race that ended before today is asked once every six hours. A stage profile is fetched once and kept for a week; a stage with no profile is asked about again once an hour while the race runs and once a week after it. |
| Bing News RSS | Headlines about a race | On demand, when a race card scrolls into view: at most ten searches per race while it is live or finished less than two days ago, at most eight once it is older than that, and five for a World Championships event (most races build fewer: five to nine), then cached for 15 minutes. For a race that finished two or more days ago the cache lasts six hours. A live race's headlines are refreshed on the same 15-minute cadence while it runs. |
| Cyclingnews | The national championships index page | At most once an hour. |
| YouTube | A search for the finish highlights of a race or stage, through the YouTube Data API since 2026-09-26 (`search.list`, then `videos.list` for the runtime and `channels.list` for the channel size, 102 quota units per lookup within the free daily 10,000). The search results page (`/results`, read without the contact email as described above) is the path taken only when no API key is set, and then only for races finished in the last six days. The result is a link to the video; nothing is embedded or downloaded | A stage is first searched once it has a result. A found video is kept for six hours; a stage with no video yet is retried every 20 minutes for its first six hours, then every six hours. A stage stays in that search set for six days after its race ends, so it is asked about at most four times a day after those first hours, and at most six stages are searched per rebuild (plus four earlier stages of a live race). Older finished races and their stages are a backlog searched only through the API, newest first, at most six per rebuild: a found video is never searched again and a miss waits a week. No more than 90 lookups are made in a quota day (from midnight Pacific, when Google resets it), 60 of them backlog, and a refusal from the API stops every lookup until the quota day turns. The videos found are committed to this repository (`data/finish-videos.json`), so a restart does not search for them again. |
| komoot | The elevation trace an organiser embeds | Once per stage, kept for a week; a stage with no trace is asked again once an hour while the race runs and once a week after it. The traces we have are committed to this repository so they are not fetched again after a restart. |

"Rebuild" means the server refreshing its one in-memory copy of the results. While a
race is live it rebuilds once a minute during racing hours in the host country (10:00
to 21:00 local) and once every 15 minutes otherwise, including rest days. With no live
race it rebuilds every 15 minutes at most, and only when someone visits.

Measured on 5 September 2026, mid-Vuelta, a steady-state rebuild inside racing hours
makes 5 requests in total: one revisions query to Wikipedia and four to lavuelta.es for
the live race. After a restart there is also a one-time sweep of stage-profile lookups,
eight per rebuild until every stage of the current races has been asked about once.
Before that day's review a rebuild made 58 requests, every minute, around the clock.

## What we publish

Two of the site's addresses are for programs rather than people, and neither asks any
source for anything: `/calendar.ics` is the season calendar as an iCalendar file (one
all-day event per WorldTour race and per elite Worlds event; the whole season, or one
race with `?race=`), and `/feed.xml` is an Atom feed of results, one entry per finished
race and per raced stage. Both are written from the copy of the results the server
already holds in memory, so a calendar or feed reader polling them costs the sources
above nothing.

## What we do not do

- We do not fetch anything a visitor cannot see on our page.
- We do not fetch on a schedule finer than the source itself refreshes (the ASO
  rankings pages, for example, are cached by their CDN for 60 seconds).
- We do not retry aggressively: a failed request waits and retries twice, then gives
  up until the next rebuild.
- We do not use more than three concurrent connections to Wikipedia, and our revision
  query sets `maxlag` so it steps aside when their servers are busy.
- We do not store personal data about anyone, beyond anonymised page-view counts in
  our own analytics (self-hosted, no cookies, no addresses kept).

## How we keep ourselves honest

We count what the server actually requests, per host, and review it whenever we change
how the site fetches. The review log below is updated each time.

### Review log

- **2026-09-05.** First full count of requests per rebuild. Found that finished races
  were being asked about every minute during a live race (letour.fr twelve times a
  minute for a Tour that ended in July), that every tracked Wikipedia page was fetched
  every minute whether or not it had changed, and that the user agent named Wikipedia
  as our contact instead of ourselves. Fixed all three, added racing-hours pacing, and
  cut the steady-state rebuild from 58 requests to 5. Started this document.
- **2026-09-05, later.** Adding the contact email to the user agent cost every Vuelta
  stage its finish video: YouTube serves its mobile site to any agent string with a
  token after the policy URL. The YouTube search now sends the string without the
  contact. No change to request counts.
- **2026-09-06.** Added a "Refresh results" button to the page. It asks our own server
  whether it holds a newer copy than the one on screen and reloads only then; it does
  not ask any source directly, and it cannot make the server rebuild sooner than the
  cadence above. No change to request counts.
- **2026-09-07.** Added the UCI Road World Championships article to the pages we
  read, for the schedule of its four elite events. It joins the same revision query
  as the season pages, so a steady-state rebuild still makes one request to Wikipedia;
  the article itself is fetched only when it changes. The event pages it links to are
  not fetched: they do not exist before race week.
- **2026-09-07, later.** Worlds results. From the day of each elite event we also read
  that event's own Wikipedia page (four pages over the week). A page that does not exist
  yet is asked for at most once every ten minutes; once it exists it joins the revision
  query like every other page and is fetched only when it changes. A Worlds race day
  paces the rebuild like a live stage day (once a minute in Montréal racing hours), so
  the steady-state count in those hours is the same one revisions query per minute as
  during a Grand Tour, plus one YouTube search per event once it has a result.
- **2026-09-07, evening.** Rider names now link out to ProCyclingStats. This is a link
  for the reader to follow, not something we fetch: the server makes no request to
  ProCyclingStats, and the site is not in the table above. No change to request counts.
- **2026-09-10.** The jersey list now opens a card with each classification's top five.
  Those standings come from the race article we already fetch — a section further down
  the same page — so nothing new is requested. The one adjacent change is that the
  batched `{{UCI team code}}` lookup, already a single request per rebuild, now names a
  handful more codes (the teams in a team classification's top five). No change to
  request counts.
- **2026-09-12.** A live race's headlines were fetched once and then never again: a cached
  set of stories, however old, was rendered as final and nothing asked for a newer one
  (the Vuelta's news line sat on stage 18 from 10 to 12 September). A set older than its
  cache window is now treated as cold, so a live race is searched again every 15 minutes
  while it runs and a finished race at the cadence the table already stated. That is the
  cadence this document has described since 2026-09-05; the requests now match it.
- **2026-09-12, later.** Every results card and every jersey card now links out to the
  full placings on ProCyclingStats ("Full results", "Full stage results", "Full
  classification"). As with the rider links, these are links for the reader to follow:
  the server makes no request to ProCyclingStats, the 65 race addresses were checked
  once in a browser, and the site stays out of the table above. No change to request
  counts.
- **2026-09-15.** The site now closes the season by itself: after the last WorldTour
  race it shows a thank-you note and says when the next season starts. That date comes
  from next season's two WorldTour pages on Wikipedia, which we ask for only in the
  off-season: at most once a day while they do not exist yet (usually until the
  autumn), then once an hour through the revision query like any other page. A week
  before the new season's first race the site moves on to that season's pages, the same
  set of pages as before with a new year in the title. Nothing is asked while a season
  is running, so the in-season count is unchanged. Measured the same day against
  Wikipedia: while the 2027 pages are still redirects, the check is two requests, then
  nothing more for a day.
- **2026-09-20.** Two changes during Worlds week, both to pages we already read.
  Wikipedia creates an elite event's own page a day or more after the race — the men's
  time trial was ridden on the 20th and had no page that evening — so when that page is
  missing we now read the podium from the championship article's medal summary instead.
  That article is already in the tracked set; consulting it costs nothing extra while
  every ridden event has a page, and one revision check per rebuild in the gap. The
  Worlds news searches were also rewritten: they quoted a phrase no headline uses and
  found nothing, so a Worlds card now makes five searches instead of about fifteen.
  Measured the same evening against Wikipedia and the news feed.
- **2026-09-27.** A review of this document against the code, prompted by the
  project's first assessment. Three things changed in what we ask for. The news
  searches were capped at 32 per race while live or fresh and 12 once settled, three
  times the "about ten" stated here; the caps are now 10 and 8, and eight is what a
  card shows. Counted in the harness over the 65 races on the calendar: a live stage
  race builds 9 to 10 queries (median 9; 9 to 32 before), a live one-day race 5 to 10
  (median 5; 5 to 23 before), a settled race 5 to 8 (median 5 one-day, 8 stage; up to
  12 before). A stage with no finish video was retried on YouTube every 20 minutes for
  as long as it stayed in the six-day search set, up to 72 searches a day; it is now
  retried every 20 minutes for its first six hours and every six hours after that,
  four a day at most. And the YouTube Data API is wired in beside the search page,
  inactive until a key is set for the deployment; when it is switched on, the search
  page will not be read again, and this table will say so. The rest of the review is
  wording: the table now names every official host and path family we read, marks the
  two dormant ones, says that a stage without a komoot trace is asked again (hourly
  during the race, weekly after), that the revision query is one or two requests, that
  a failed check for next season's pages is repeated after ten minutes, and that the
  one request not covered by our user agent is the maintainer's own save to GitHub. The
  "no personal data" line now admits our anonymised page-view counts. Also added to
  the repository: the licence texts for the two fonts we self-host (not a fetch: the
  files are served from our own site). Three more changes the same day: the first build now starts when the server boots instead of on the first request (requests per rebuild and every cache TTL unchanged); a request that answers with a definitive 4xx is no longer retried (only 429, 5xx and network errors are); and on a one-day race's own race day, and the day after, its Wikipedia article is read on the live cadence like a stage race's, a page already among those we track. Later that night: the previous season's two WorldTour season pages joined the pages we read, for the "Last year: …" line on upcoming cards; they are fetched once per process (two raw reads at boot, then only the revision index, which a settled page never moves) and never again that process, even after a failure.
- **2026-09-27, later.** The YouTube Data API key was set for the deployment on
  2026-09-26, so the search page is no longer read while the key holds. With the API
  in place we now search for the finish videos of every finished race and stage of
  the season, not only those of the last six days: a backlog pass asks about at most
  six per rebuild, newest race first, and the whole process makes at most 90 lookups
  in any 24 hours (60 of them backlog), inside the API's free quota. A video once
  found is never searched for again, a backlog miss is retried after a week, and the
  finds are committed to the repository so a restart starts from them. Counted from
  the code: a rebuild makes at most 16 lookups (six recent, four live stages, six
  backlog), each three API requests.
- **2026-09-27, later still (L8).** Archived the Tour of Greece provider: hellas-tour.gr
  answers every request, including a plain `/robots.txt`, with a Cloudflare challenge,
  so it never once returned real results. `fetchTourOfGreeceOfficialSnapshot` and its
  helpers moved to `archive/tour-of-greece-provider.js` and its registry entry is gone;
  the host is dropped from the table above, leaving lavueltaasturias.com as the one
  dormant official source. This drops the handful of requests the provider made to a
  host that could only ever answer with a challenge page; every other request count in
  this document is unchanged.
- **2026-09-27, evening.** Added two published formats, a calendar file
  (`/calendar.ics`) and a results feed (`/feed.xml`), both built from the results the
  server already holds; while the first build after a restart is still running they
  answer 503 with a Retry-After header rather than an empty document. No request to any
  source, and no change to request counts.
- **2026-09-27, night (fewer YouTube requests).** The project behind our API key allows
  100 searches a day, and our daily count restarted with every deploy, so on a day of
  many deploys we kept searching after YouTube had said no. Now the count follows
  YouTube's own quota day (midnight Pacific), and the first refusal stops every
  finish-video search, live and backlog, until that day turns. This only removes
  requests, all of them ones YouTube was refusing; no other count changes.
- **2026-09-27, midday (ASO: public pages first).** ASO's conditions of use ask for
  written consent before their sites are read by a robot, and their robots.txt
  disallows `/*/ajax`, where the ranking partials we read live. We have written to ASO
  to ask. Meanwhile we read less, and mostly what robots.txt allows: a stage's result
  now comes from the public `/en/rankings` and `/en/rankings/stage-N` pages instead of
  the stage and team-stage partials, and a live ASO race is read at most once every
  two minutes instead of once a minute. Until ASO answers we still read the
  general-classification partial during a race (the one place it is published), the
  stage partial on the evening of the last stage (whose public page shows the final
  classification instead) and the team partial on a team time trial. Counted from the
  code: a live Grand Tour stage costs two or three requests every two minutes, where it
  cost four every minute; a finished race two every six hours, where it cost four.

