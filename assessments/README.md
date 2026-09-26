# Project assessments

A recurring check-in on the whole project, written for the maintainer and for the next agent session. Each assessment is a dated folder holding a synthesis report with a remediation plan (`report.md`, built to `report.pdf`) and the nine per-area reports with their evidence and recheck procedures (`areas/`). The scripts and probe pages the assessors wrote live under `tools/` so the measurements can be repeated.

## Assessments so far

| Date | Commit | Report | Headline |
|---|---|---|---|
| 2026-09-26 | `9dc326f` | [`2026-09-26/report.pdf`](2026-09-26/report.pdf) ([source](2026-09-26/report.md)) | Core promise kept; failures invisible; one-day race days slow; first phone screen and page weight; three sources read against terms |

## Cadence

- **Monthly during the racing season** (January to October): a full check-in on the last Tuesday of the month, the day the committee meets. About a day of agent time across the nine areas, run in parallel.
- **Quarterly over the winter** (November to January): reliability, maintainability, sourcing and positioning only, unless something shipped that touches the others.
- **Event-triggered**, whatever the calendar says: the week the season close-out goes live (19 October), the week of the season rollover (about 9 January), Worlds week, and any change to what the server fetches or how often (which also requires a `DATA-SOURCES.md` review-log line).

## The nine areas

Each area has a recheck procedure in section 8 of its report, with the commands, the request caps and the numbers to compare against. Use the latest report's file as the starting point.

| # | Area | Recheck time | Tools |
|---|---|---|---|
| 1 | Data pipeline reliability | 40 min | `tools/area1/robustness.js` (VM harness feeding parsers bad input), `summarise-prod.js`, `inspect-*.js` |
| 2 | Speed of results and pages | 30 min | `tools/area2/prod-timing.sh`, `compose.js`, `sectionmap.js`, `frame.sh` (true 390 px render), `bench.sh` |
| 3 | Audience definition and fit | 60 min | `tools/area3/probe.html`, `frame390.html` and the `frame-*.html` phone frames |
| 4 | Creativity of idea and execution | 45 min | screenshots as in the area's section 8 |
| 5 | Feature opportunities | 60 min | none; the checklist in the area's section 8 |
| 6 | Competitive positioning | 60 min, quarterly | `tools/area6/fetch.sh`, `fetch2.sh`, `ours-probe.html` |
| 7 | Security and privacy | 30 min | `tools/area7/guard-check.js`; six production probes listed in the area's section 8 |
| 8 | Maintainability and operability | 45 min | `tools/area8/analyze.js`, `seams.js` |
| 9 | Sourcing and legal footing | 30 min, quarterly | robots and terms fetches listed in the area's section 8 |

## Rules every assessor follows

- **Read-only.** Nothing is edited, committed or pushed during an assessment. Code that runs (harnesses, benchmarks, tests) runs in an isolated worktree.
- **Production probes are read-only and capped**: at most fifteen requests per area, none destructive, no load tests, no auth guessing. Upstream sources (Wikipedia, organisers, Bing, YouTube, Cyclingnews) are not fetched by assessors except where a single request is essential to confirm a claim; the site has a public sourcing statement and its request volume matters.
- **Every finding cites evidence**: a file and line, a measurement with the command that produced it, a screenshot, or a quoted line. Anything unverifiable is marked as such.
- **Headless Chrome will not lay out narrower than 500 px.** A `--window-size=390` screenshot is a 500 px layout cropped. For a real phone width, host the saved page in a 390 px iframe (`tools/area2/frame.sh`, `tools/area3/frame390.html`) or use device emulation.
- **The yardstick is the reader statement** in the latest report's section 2, and its three jobs: the landscape ahead, today's result, and what is next.

## Writing it up

1. Each area writes its report to `areas/areaN-<name>.md` with the same eight sections as the first assessment: Summary with a grade, Method, the area's own table (dependency map, measurements, walkthrough, and so on), Findings, Strengths, Open questions, Recheck procedure.
2. Findings keep their IDs across assessments (R for reliability, S speed, A audience, C creativity, F features, P positioning, X security, M maintainability, L sourcing). A closed finding stays in the register marked closed with the commit that closed it; a new one takes the next number.
3. The synthesis (`report.md`) has the sections of the first one: Verdict with the grades table, Who the site is for, What we found by theme, Remediation plan in phases, Decisions only the maintainer can make, Findings register, Method and confidence, How to repeat this. Say what closed since last time before saying what is new.
4. Severity: Critical means readers see wrong data or no site now; High means missing or wrong data on a predictable occasion, or site-wide loss one upstream edit away with no detection; Medium means degraded today or a scheduled loss; Low is bounded. Effort: S under a day, M a few days, L a week or more.
5. Build the PDF: `npm run assessment:pdf -- assessments/<date>/report.md`. The script (`scripts/build-assessment-pdf.js`) needs only Node and a local Chrome; it writes `report.pdf` beside the Markdown in the site's palette.
6. Add the row to the table above, a dated line to `handoff.md`, and, if a plan item shipped, its release note.
