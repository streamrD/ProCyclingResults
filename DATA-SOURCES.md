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

The one exception is the YouTube search for finish highlights, which carries the same
string without the contact email. YouTube answers any agent string with a token after
the policy URL by serving its mobile site, which the highlights parser cannot read.
The policy URL still identifies us there.

The site runs as a single small process. There is no crawler, no parallel fleet and
no scraping of pages we do not show.

## What we read, and how often

| Source | What we take | When we ask |
|---|---|---|
| Wikipedia (English) | Race articles and their companion stage articles, read as wikitext; one template-expansion call for team names | Once per rebuild we ask the API which of the pages we track have a new revision (one query per 50 titles). Only changed pages are fetched again. Team names are fetched once per process. |
| Official race sites (ASO: letour.fr, letourfemmes.fr, lavuelta.es; RCS: giroditalia.it, giroditaliawomen.it; a few smaller organisers) | The published stage and general classifications, and the stage profile embed the organiser links to | A race in progress is asked once per rebuild. A race that ended before today is asked once every six hours. A stage profile is fetched once and kept for a week, and a stage with no profile is not asked about again once the race is over. |
| Bing News RSS | Headlines about a race | On demand, when a race card scrolls into view: about ten searches per race, then cached for 15 minutes. For a race that finished two or more days ago the cache lasts six hours. |
| Cyclingnews | The national championships index page | At most once an hour. |
| YouTube | A search for the finish highlights of a stage | Once per stage, cached for six hours (or 20 minutes for a miss). |
| komoot | The elevation trace an organiser embeds | Once per stage, kept for a week; the traces we have are committed to this repository so they are not fetched again after a restart. |

"Rebuild" means the server refreshing its one in-memory copy of the results. While a
race is live it rebuilds once a minute during racing hours in the host country (10:00
to 21:00 local) and once every 15 minutes otherwise, including rest days. With no live
race it rebuilds every 15 minutes at most, and only when someone visits.

Measured on 5 September 2026, mid-Vuelta, a steady-state rebuild inside racing hours
makes 5 requests in total: one revisions query to Wikipedia and four to lavuelta.es for
the live race. After a restart there is also a one-time sweep of stage-profile lookups,
eight per rebuild until every stage of the current races has been asked about once.
Before that day's review a rebuild made 58 requests, every minute, around the clock.

## What we do not do

- We do not fetch anything a visitor cannot see on our page.
- We do not fetch on a schedule finer than the source itself refreshes (the ASO
  rankings pages, for example, are cached by their CDN for 60 seconds).
- We do not retry aggressively: a failed request waits and retries twice, then gives
  up until the next rebuild.
- We do not use more than three concurrent connections to Wikipedia, and our revision
  query sets `maxlag` so it steps aside when their servers are busy.
- We do not store personal data about anyone.

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
