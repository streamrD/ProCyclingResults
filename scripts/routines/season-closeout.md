# Season close-out routine

The closing note ("Thank you, <year>") switches itself on: once the UTC date is past the
last day of the season's last WorldTour race, `buildSeasonCloseout` returns the note's
figures and `buildSeasonCloseoutHero` replaces the header, on the first payload rebuild
after midnight UTC. What it cannot do is check itself or write its release note. This
file is a one-time Claude Code cloud routine that does both, the morning after.

Written 2026-10-17 for the first close-out. See "Season Close-Out Routine" in
`handoff.md` for what the 2026 run showed.

## Before scheduling it

1. **Network.** The Default cloud environment uses "Trusted" network access, an
   allowlist of package registries, GitHub and Anthropic hosts. Railway is not on it, so
   the production checks fail unless the environment allows the site. In the routine's
   Edit form, open the environment (cloud icon below the instructions) → gear →
   Network access → **Custom**, keep the defaults, add
   `procyclingresults.up.railway.app`, save.
2. **GitHub.** Cloud sessions need GitHub access to clone and push: the Claude GitHub
   App installed on `streamrD/ProCyclingResults` (https://github.com/apps/claude), or
   `/web-setup` run once in a terminal session. Without it the run is skipped.
3. **`main` must accept the push.** It had no branch protection or rulesets on
   2026-10-17, and the cloud git proxy does not limit branches. If protection is added,
   the routine pushes to a `claude/` branch instead and says so.

## Scheduling it

- **When:** once, at 13:00 UTC (9 am New York) the day after the last WorldTour race
  ends. That race is the latest `endDate` in `seasonCalendar.races` from
  `/api/homepage-data`; in 2026 it was the Tour of Guangxi, 13–18 October.
- **How:** from a Claude Code session, `/schedule` with this file, or
  https://claude.ai/code/routines. Model: Sonnet is enough. Repository:
  `https://github.com/streamrD/ProCyclingResults`. Tools: Bash, Read, Write, Edit, Glob,
  Grep, WebFetch.
- **Connectors:** the routines API attaches every claude.ai connector on the account
  (Gmail, Drive, Docs) by default. This routine needs none; remove them
  (`clear_mcp_connections: true` through the API).

## The prompt

Paste everything below the line as the routine's instructions. It reads the year, the
last race and the count from production, so it needs no editing from one season to the
next.

---

You are working in the ProCyclingResults repo (github.com/streamrD/ProCyclingResults), a no-dependency Node.js site deployed to Railway from `main`. Production is https://procyclingresults.up.railway.app. Read AGENTS.md first (only the parts about release notes, pushing and verify:deploy are relevant); do not explore the rest of the repo.

Background: once the UTC date is past the last day of the season's last WorldTour race, with nothing live or upcoming, the site replaces its header with the Grupetto Committee's closing note, headlined "Thank you, <year>" (`buildSeasonCloseout` / `buildSeasonCloseoutHero` in server.js). That happens by itself on the first rebuild after midnight UTC. Your job is to confirm it is live and correct, then ship one release-note line for it.

STEP 1 - Check production (read-only). Use curl; if the sandbox cannot reach the host, use WebFetch and ask it for the exact raw values.
- GET /api/build-info : note the commit.
- GET /api/data-status : expect HTTP 200, sections.liveStageRaces = 0, sections.upcomingRaces = 0, lastBuildError = null.
- GET /api/homepage-data : let R be `seasonCalendar.races` without the ones whose status is "cancelled". Expect `seasonCalendar.liveCount` = 0 and `upcomingCount` = 0, and `seasonCloseout` non-null with `year` = `seasonCalendar.year`, `lastRace.endDate` = the latest `endDate` in R and `lastRace.title` = that race's title. `raceCount` must equal the number of races in R whose status is "finished" (only 2026 counted from launch day instead, and read 27). Report `seasonCloseout.nextSeasonOpening` too (null is fine; the note then gives the month).
- GET / : the HTML must contain "Thank you, <year>".
If ANY of these fails or differs, STOP: change nothing, push nothing, and finish with a short report of exactly what you saw (the values and HTTP codes). Do not try to fix code.

STEP 2 - Add the release note (only if every check in step 1 passed).
- Run `git pull --rebase origin main` first: the maintainer edits data/release-notes.md on the live site, which commits to main.
- In data/release-notes.md, entries are grouped under `## <day> <Month> <year>` headings (for example `## 19 October 2026`), newest first, directly below the one-line intro paragraph. Use today's UTC date. If today's heading already exists, add the bullet under it; if any existing bullet already announces the closing note, add nothing and say so. Otherwise insert a new section for today immediately above the current first `## ` heading, with one blank line before and after, holding this one bullet (fill in the year, the next year and the last race's name, with "the" where the name takes one, as in "the Tour of Guangxi"):

- **Thank you, <year>.** The season ended with <last race>, so the top of the page is now the Grupetto Committee's closing note. All of the season's results stay below it until the site moves to <next year> in January.

- Change no other file and no other line. Run `npm test` and confirm it passes (report its summary line; if it fails, stop and report without pushing).
- Commit with the message `Add the release note for the season's closing note`, plus your usual attribution line.

STEP 3 - Ship and verify.
- `git pull --rebase origin main` again, then `git push origin HEAD:main`. If pushing to main is refused, push to a branch named `claude/release-note-season-closeout` instead and say clearly in your final message that it still needs merging to main. Never force-push.
- If you pushed to main, run `npm run verify:deploy -- --sha=<first 7 chars of your commit>`. If the sandbox cannot reach production, use WebFetch on /api/build-info every couple of minutes (up to ~15 minutes) until it shows your commit.
- Then GET /release-notes and confirm it contains "Thank you, <year>."

Finish with a short report: what each check in step 1 returned, the commit SHA, where it was pushed, and whether the deploy and the /release-notes page were confirmed.
