# AGENTS.md

This file is the fast-start guide for new Codex sessions working in this repository. Read this first to stay efficient with tokens and to avoid unnecessary repo exploration.

## Session Start Strategy

For most tasks, start with this order:

1. Read `AGENTS.md`.
2. Read only the code and tests directly related to the task.
3. Read `README.md` only if the task touches architecture, parsing behavior, data sourcing, caching, rendering structure, or race-specific exceptions.

Do not assume prior chat history is available or needed. Treat `README.md` as the durable project handoff and this file as the low-token operating guide.

## Project Shape

- Minimal Node.js app with no third-party dependencies
- Main runtime entrypoint: `server.js`
- Server-rendered HTML plus `/api/homepage-data`, `/api/races`, national championships, and coverage endpoints
- Parser-heavy logic with live upstream dependencies
- Tests live under `test/`

## Files To Read First

- `server.js`: all core app logic
- `README.md`: full technical handoff
- `test/parser-regressions.test.js`: existing regression coverage
- `data/static-stage-race-snapshots.json`: bounded fallback data for selected stage races
- `scripts/benchmark-load.js`: readiness and warmed-response benchmarking

## When You Must Read README.md

Read `README.md` before making changes that involve:

- Wikipedia parsing or cleaning heuristics
- official race-source providers
- stage-race snapshot merging
- article ranking/filtering behavior
- cache semantics
- competition grouping or season scope
- date logic or timezone-sensitive behavior
- architectural refactors

For narrow UI copy tweaks or tightly scoped fixes, you can often skip the full README and inspect only the relevant code path.

## Working Rules

- Keep the architecture minimal and consistent with the current no-framework approach.
- Prefer narrow fixes over broad rewrites.
- Do not add third-party packages unless explicitly requested.
- Do not assume there is a frontend framework, database, ORM, or hidden client app.
- Prefer adding contained race-specific provider logic over weakening shared parsing heuristics when a single race is wrong.
- Preserve current cache behavior unless the task clearly requires changing it. Live stage races intentionally use a shorter cache TTL than the default background race-data refresh.
- Remember that cold-start load delay is mainly an upstream-fetch issue amplified by Wikipedia rate limiting, not usually a page-rendering problem.
- Remember that the active product scope is Men's WorldTour, Women's WorldTour, and National Championships.
- UCI ProSeries and Europe Tour sections were implemented previously, retired on 2026-06-22, and archived in `archive/proseries-europe-tour-sections.js`. Do not reactivate them unless the user asks for that explicitly.
- National Championships should prioritize completed event records in the UI. Use `NATIONAL_CHAMPIONSHIP_EVENT_METADATA` only for narrow, source-backed date/location/podium/video overrides.
- `/api/homepage-data` is the main KPI for initial page readiness; `/api/races` currently uses the same active scope.
- Giro finish-video links now prefer official livefeed-derived URLs before falling back to the static map.
- Companion stage articles are read at build time for live stage races only; reading them for recent races too cost roughly 2s of a ~20s cold start. Finished races render a winner-per-stage history and offer `/api/race-stages` on demand. Keep that split unless the cold-start budget changes.
- A fix only reaches the product when it is pushed to `main`; Railway deploys from there. If the user reports the site is wrong, check what the deployed instance returns before re-debugging local code — they are usually looking at production, not your working tree.

## Validation

For code changes, usually do the following:

1. Run `npm test`.
2. Manually check `/`, `/api/homepage-data`, and `/api/races` if the change affects rendering, aggregation, or live-data behavior.
3. If parsing changed, verify against the relevant fixture or upstream source pattern, including the national championships table when applicable.

When performance behavior changes, also consider:

1. `npm run benchmark:homepage-ready`
2. `npm run benchmark:ready`
3. `npm run benchmark:load -- --runs=5 --include-coverage`

Two techniques worth reusing:

- To prove a data fix did not regress other races, capture `/api/races` before and after
  and diff a per-race summary rather than eyeballing one card. Silent collateral damage
  in shared parsers is the main risk in this repo.
- For anything visual, headless Chrome renders without needing a browser extension:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot=out.png --window-size=1000,1400 --hide-scrollbars "file://$PWD/page.html"`.
  Do not trust hand-authored SVG or CSS until you have looked at the render.

## Token Efficiency Guidance

- Do not reread the whole repo by default.
- Do not summarize large files unless needed for the task.
- Read `README.md` once when broader context is necessary, then work from code and tests.
- Keep prompts task-specific: identify the target race, parser, section, or rendering path.
- After meaningful architecture or workflow changes, update `README.md` or this file so future sessions can start fresh.

## Recommended Opening Prompt For New Sessions

Use something close to this:

```text
Project: ~/Desktop/AgenticAI/FullStackApp/ProCyclingResults

Please read AGENTS.md first. Read README.md only if the task requires broader architectural or parser context. Inspect only the relevant code and tests, keep token usage lean, make the requested change, and run npm test when appropriate.

Task: <your task here>
```

## Notes For Future Agents

Most bugs here come from upstream content drift rather than complex internal state. When race data looks wrong, inspect the relevant parser/provider path before considering broader refactors.
During live races, distinguish between sparse Wikipedia coverage, official-provider gaps, stale cached responses, national championship source drift, and upstream rate limiting before assuming the parser is wrong.
Giro d'Italia and Giro d'Italia Women now use separate official standings sources, so check the correct provider path before changing shared Giro parsing heuristics.

A stage race whose card shows only the stage winner and no places 2-5 is usually not a parser bug on the main article: longer races publish just a winner column there and keep the real podiums on companion articles (`2026 Vuelta a España, Stage 1 to Stage 11`), linked from the route table. `extractStageArticleTitles` / `loadStageArticleTexts` fetch those, and they feed stage results only — never GC or `overallResult`, whose companion copies drift from the main article. `stageRace.stages` is the per-stage history this produces, and it is what the card's stage-number strip renders. If the shallow race is a finished one, that is by design: only live races read companion articles during a build, and the card carries a "Load full stage results" button that calls `/api/race-stages`.

A race that renders as live but totally empty usually means every source failed at once, not that one is stale. Check what `stageRace.provenance.snapshot` says: `wikipedia-raw` with `completedStages: 0` means the Wikipedia parse returned nothing *and* no official provider matched. Confirm by running the raw wikitext through `extractStageRaceSnapshot` directly before touching anything.

The repo-wide preference for narrow, race-specific fixes has one exception: when a shared heuristic is genuinely wrong for most pages, fix the heuristic. The 2026-08-06 Tour de France Femmes outage was caused by `parseAthleteDetails` matching only one of three interchangeable Wikipedia template spellings — a per-race workaround would have left the same bug latent on every other page. See `handoff.md` for the parser traps that emerged from it.
