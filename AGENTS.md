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
- Server-rendered HTML plus `/api/races`
- Parser-heavy logic with live upstream dependencies
- Tests live under `test/`

## Files To Read First

- `server.js`: all core app logic
- `README.md`: full technical handoff
- `test/parser-regressions.test.js`: existing regression coverage
- `data/static-stage-race-snapshots.json`: bounded fallback data for selected stage races

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

## Validation

For code changes, usually do the following:

1. Run `npm test`.
2. Manually check `/` and `/api/races` if the change affects rendering, aggregation, or live-data behavior.
3. If parsing changed, verify against the relevant fixture or upstream source pattern.

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
During live races, distinguish between sparse Wikipedia coverage, official-provider gaps, stale cached responses, and upstream rate limiting before assuming the parser is wrong.
