Every change to the site, in plain language, newest first. Dates are the day the change went live.

## 4 September 2026

- **Link previews for every page.** Sharing the About or Release Notes pages now shows a proper title, description and image, like the results page.
- **Release notes and an About page.** This page and the About page added. The footer of the results page links to them. The About page introduces the Grupetto Committee, the five people who keep the site.
- **A season calendar.** Timeline view of the men's and women's WorldTour race year. Grand Tours and Monuments labelled, finished races filled in, the live race filling up day by day, and a hover for each winner. On phones it becomes a month-by-month list.
- **National Championships rebuilt as an almanac.** Instead of nearly three hundred cards, the section now shows when the championships happen, whether the season is over, a handful of featured titles with full podiums, and one searchable row per federation grouped by continent. Type a country or a rider to find a champion.
- **Jersey holders.** Each stage race's general classification now lists who holds every jersey, drawn from the race's classification leadership table.
- **A new tag line** for the top of the page.
- **A new favicon.** The browser-tab icon is now a cyclist in the site's colours, in the pose of the cyclist emoji.
- **A championship map.** The continent groups now sit under a world map drawn from real geography. Countries are shaded by whether a 2026 champion is recorded, a hover shows each continent's count, and a click opens its champions. Pick a category and the map re-shades to the countries holding that title.
- **Cleaner championship data.** A title the index marks as postponed or cancelled no longer shows those words where a champion's name belongs.

## 3 September 2026

- **Stage profiles.** Every stage panel opens with the stage's profile, distance and climbing. Where the organiser publishes a real elevation trace (the Vuelta, via komoot) it is drawn in the site's own colours and can expand to a full chart with axes. Where no trace exists, a plain pictogram is shown.
- **Kilometres or miles.** A toggle on the profile switches units and remembers your choice.
- **Tomorrow's stage.** During a live race the stage strip shows a "next" chip with a preview of tomorrow's course and profile.
- **Gaps to the winner** now appear beside every stage finishing time.
- **Stricter checks** stop a stage or overall standing from claiming a stage the calendar has not reached yet.
- **Continuous integration** and a headless-browser test of the page script now guard every change.

## 26 August 2026

- **Vuelta a España** now reads the official race site, so its overall standings stop disappearing each evening.

## 23 August 2026

- **Every stage, not just today's.** Stage race cards carry a numbered strip covering the whole route, so you can flick back to any stage already raced.
- **A finish video for each stage**, not only the latest one.
- **Team time trials** render properly as team results.
- **Faster first load.** Official race sources are given a time budget instead of holding the whole page, which brought the cold start from around twenty seconds to about six.
- **Build information** on the site now tracks the actual deploy.

## 6 August 2026

- **Tour de France Femmes** stage and overall standings, fixed after a parsing change on the source page had emptied the card.
- **A cyclist favicon** for the browser tab.

## 4 July 2026

- **Tour de France** coverage tuned for the opening weekend: last year's results no longer appear before stage 1 has been raced, the team time trial shows as the stage 1 result, and the stage 1 finish video is pinned.
- **Finish videos** are only taken from trusted or official channels, or from unknown channels when the title and length clearly match the race.

## 22 June 2026

- **Focus on the top tier.** The site now covers the men's WorldTour, the women's WorldTour and the elite national championships. The ProSeries and Europe Tour sections were retired.
- **Tour de France** gets a live official data source, and every upstream request now has a timeout.
- **Finish videos found automatically** through a YouTube search when no curated link exists.
- **National flags** on each National Championship card.
- **"Load more races."** Recent results appear three at a time, up to twelve, and finished stage races stay in the list.
- **Race coverage** articles are ordered newest first and filtered less aggressively.

## 9–11 June 2026

- **Tour Auvergne-Rhône-Alpes** gets official standings and a finish video.
- **Team time trial stages** show team standings.

## 2–8 June 2026

- **Giro d'Italia and Giro d'Italia Women** keep their official data after the race ends, and several parsing problems in the official standings were fixed.
- **Stage times and overall gaps** are shown separately so a stage result never borrows a gap from the general classification.
- **Giro Women finish videos** added.
- **Build information** is exposed at `/api/build-info` for deploy debugging.

## 22–31 May 2026

- **Vuelta a Burgos Feminas** live results, read from the race's liveblog, including the top five overall with gaps.
- **Just-finished races** refresh sooner.
- **Giro** livefeed parsing broadened and several stage videos pinned.
- The warm-up screen returns while live data is refreshing, instead of a half-empty page.

## 16–19 May 2026

- **Live overall gaps** for the Giro, aligned properly on phones.
- **Live stage data** refreshes more often, and article coverage for live races improved.
- **Flèche du Sud** results restored for the Europe Tour section.

## 13–14 May 2026

- **Giro finish videos** detected automatically from the official livefeed.
- Project documentation updated for the split data architecture.

## 8–12 May 2026

- **Live Giro d'Italia** coverage, with a friendlier warm-up screen while data loads.
- **Split caches** for race metadata and live data, and deferred loading for secondary sections, so the page is ready sooner.
- **Tour of Greece** official stage results and final classification.

## 4–7 May 2026

- **Finalized stage races** appear in recent results.
- **La Vuelta Femenina** live results stabilised and read from the official rankings.
- **Rider country flags** beside names in every podium.
- **Finish highlight links** on race cards.

## 1 May 2026

- **Official one-day results** used as a fallback when the encyclopedia page is behind.
- **Europe Tour** stage-race snapshots backfilled for 2026.
- **Open Graph tags** so shared links show a proper preview.
- **Race news feeds** restored through an RSS source.
- **Analytics** added to see which sections people use.

## 15–29 April 2026

- **Launch.** The first version of the site: a results desk with top-five podiums for the season's races, race coverage links, and an Europe Tour spotlight.
- **Deployed on Railway** so the site is reachable to everyone.
