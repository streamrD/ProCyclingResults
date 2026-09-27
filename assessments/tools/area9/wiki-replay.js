// Replay: what would a Wikipedia-only card have shown, and when, for each stage of the
// 2026 ASO stage races? Runs the server's own extractStageRaceSnapshot on the article
// revisions as they stood at each moment (main article + the companion stage articles
// its route table linked at that moment). Read-only, sequential, cached on disk.
// Written 2026-09-27 to answer "what would the Grand Tour cards look like without
// ASO's rankings pages?" (see "If ASO Says No" in handoff.md). Conditions per stage:
// winner, stage top five, GC leader, GC top five as the parser reads it now, from the
// main article alone, from the companion stage articles alone, and from either.
// Usage: node assessments/tools/area9/wiki-replay.js "2026 Tour de France" [more titles...]
// Revisions are cached in $REPLAY_CACHE (default: the OS temp dir); results are
// written to $OUT (default wiki-replay-results.json) in the current directory.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repo = path.resolve(__dirname, "..", "..", "..");
const outDir = process.cwd();
const cacheDir = process.env.REPLAY_CACHE || path.join(require("os").tmpdir(), "pcr-wiki-replay");
fs.mkdirSync(cacheDir, { recursive: true });
const UA = "ProCyclingResults-research/1.0 (+https://procyclingresults.up.railway.app/data-sources; one-off revision-history replay)";

const source = fs.readFileSync(path.join(repo, "server.js"), "utf8");
const marker = "\nserver.listen(PORT, () => {";
const sandbox = { require, console, process, URL, fetch: global.fetch, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, AbortController, AbortSignal };
vm.createContext(sandbox);
// server.js resolves its data files from the working directory.
process.chdir(repo);
vm.runInContext(`${source.slice(0, source.indexOf(marker))}\n;globalThis.__D = { extractStageRaceSnapshot, extractStageArticleTitles, extractCyclingResultBlocks, parseCyclingResultStandings, normalizeSearchText };`, sandbox);
const D = sandbox.__D;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let requests = 0;
async function get(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await sleep(150);
    requests += 1;
    const response = await fetch(url, { headers: { "user-agent": UA } });
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`${response.status} ${url}`);
  }
  throw new Error(`gave up ${url}`);
}
async function api(params) {
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })}`;
  return (await get(url)).json();
}

// Every revision of a title in [start, end], plus the one in force at start.
const revListCache = new Map();
async function revisionList(title, start, end) {
  const key = `${title}|${start}|${end}`;
  if (revListCache.has(key)) return revListCache.get(key);
  const file = path.join(cacheDir, `list-${Buffer.from(key).toString("base64url")}.json`);
  if (fs.existsSync(file)) { const list = JSON.parse(fs.readFileSync(file, "utf8")); revListCache.set(key, list); return list; }
  const out = [];
  const before = await api({ action: "query", prop: "revisions", titles: title, rvprop: "ids|timestamp", rvlimit: "1", rvdir: "older", rvstart: start });
  const prior = before.query?.pages?.[0]?.revisions?.[0];
  if (prior) out.push({ revid: prior.revid, ts: Date.parse(prior.timestamp) });
  let cont = {};
  do {
    const page = await api({ action: "query", prop: "revisions", titles: title, rvprop: "ids|timestamp", rvlimit: "max", rvdir: "newer", rvstart: start, rvend: end, ...cont });
    (page.query?.pages?.[0]?.revisions || []).forEach((rev) => out.push({ revid: rev.revid, ts: Date.parse(rev.timestamp) }));
    cont = page.continue || null;
  } while (cont);
  fs.writeFileSync(file, JSON.stringify(out));
  revListCache.set(key, out);
  return out;
}

const textMemo = new Map();
async function revisionText(revid) {
  if (textMemo.has(revid)) return textMemo.get(revid);
  const file = path.join(cacheDir, `${revid}.txt`);
  let text;
  if (fs.existsSync(file)) text = fs.readFileSync(file, "utf8");
  else {
    text = await (await get(`https://en.wikipedia.org/w/index.php?oldid=${revid}&action=raw`)).text();
    fs.writeFileSync(file, text);
  }
  if (textMemo.size > 60) textMemo.delete(textMemo.keys().next().value);
  textMemo.set(revid, text);
  return text;
}

const atOrBefore = (list, t) => { let found = null; for (const rev of list) { if (rev.ts <= t) found = rev; else break; } return found; };

async function replayRace(title) {
  // The window: from the article's state now, read the stage dates.
  const now = new Date().toISOString();
  const latest = await api({ action: "query", prop: "revisions", titles: title, rvprop: "ids|timestamp", rvlimit: "1" });
  const latestRev = latest.query.pages[0].revisions[0].revid;
  const finalSnapshot = D.extractStageRaceSnapshot(await revisionText(latestRev), [], new Map());
  const route = (finalSnapshot.route || []).filter((entry) => entry.date && !entry.cancelled);
  const year = title.match(/^(\d{4})/)[1];
  const dateOf = (entry) => new Date(`${entry.date} ${year} 00:00 UTC`);
  const first = Math.min(...route.map((entry) => dateOf(entry).getTime()));
  const last = Math.max(...route.map((entry) => dateOf(entry).getTime()));
  const start = new Date(first - 24 * 3600e3).toISOString();
  const end = new Date(Math.min(Date.parse(now), last + 4 * 24 * 3600e3)).toISOString();
  const mainList = await revisionList(title, start, end);
  console.error(`${title}: ${route.length} stages, ${mainList.length} main revisions in window`);

  const snapshotMemo = new Map();
  async function snapshotAt(t) {
    const mainRev = atOrBefore(mainList, t);
    if (!mainRev) return null;
    const mainText = await revisionText(mainRev.revid);
    const companionTitles = D.extractStageArticleTitles(mainText);
    const companionRevs = [];
    for (const companion of companionTitles) {
      const list = await revisionList(companion, start, end);
      const rev = atOrBefore(list, t);
      if (rev) companionRevs.push(rev.revid);
    }
    const key = [mainRev.revid, ...companionRevs].join(",");
    if (snapshotMemo.has(key)) return snapshotMemo.get(key);
    const texts = [];
    for (const revid of companionRevs) texts.push(await revisionText(revid));
    const snapshot = D.extractStageRaceSnapshot(mainText, texts, new Map());
    // What the main article alone gives, for comparison with the companion fallback.
    snapshot.mainOnlyGc = D.extractStageRaceSnapshot(mainText, [], new Map()).generalClassification;
    snapshot.companionGc = new Map();
    texts.flatMap((text) => D.extractCyclingResultBlocks(text)).forEach((block) => {
      const match = D.normalizeSearchText(block.title).match(/\bgeneral classification after stage\s+(\d+)\b/);
      if (match) snapshot.companionGc.set(Number(match[1]), D.parseCyclingResultStandings(block.body, 5, new Map()).length);
    });
    snapshotMemo.set(key, snapshot);
    return snapshot;
  }

  // Moments at which anything the card reads changed: main revisions plus the companion
  // revisions (lists are fetched lazily as their titles appear).
  async function timeline(lo, hi) {
    const points = new Set(mainList.filter((rev) => rev.ts > lo && rev.ts <= hi).map((rev) => rev.ts));
    for (const key of revListCache.keys()) {
      if (key.startsWith(`${title}|`)) continue;
      revListCache.get(key).filter((rev) => rev.ts > lo && rev.ts <= hi).forEach((rev) => points.add(rev.ts));
    }
    return [lo, ...[...points].sort((a, b) => a - b)];
  }

  const conditions = {
    winner: (s, n) => (s?.stages || []).some((stage) => stage.number === n && stage.standings.length >= 1),
    top5: (s, n) => (s?.stages || []).some((stage) => stage.number === n && stage.standings.length >= 5),
    gcLeader: (s, n) => (s?.generalClassification?.stageNumber || 0) >= n && s.generalClassification.standings.length >= 1,
    companionGcTop5: (s, n) => (s?.companionGc?.get(n) || 0) >= 5,
    mainGcTop5: (s, n) => (s?.mainOnlyGc?.stageNumber || 0) >= n && s.mainOnlyGc.standings.length >= 5,
    eitherGcTop5: (s, n) => (s?.companionGc?.get(n) || 0) >= 5 || ((s?.mainOnlyGc?.stageNumber || 0) >= n && s.mainOnlyGc.standings.length >= 5),
    gcTop5: (s, n) => (s?.generalClassification?.stageNumber || 0) >= n && s.generalClassification.standings.length >= 5,
  };

  const rows = [];
  for (const entry of route) {
    const n = entry.number;
    const day = dateOf(entry).getTime();
    const lo = day + 9 * 3600e3; // 11:00 CEST, before any finish
    const hi = Math.min(Date.parse(end), day + 3 * 24 * 3600e3);
    await snapshotAt(hi); // pulls in the companion titles linked by then
    const points = await timeline(lo, hi);
    const row = { stage: n, date: entry.date };
    for (const [name, test] of Object.entries(conditions)) {
      // The first moment the condition holds, scanning every revision in order. Not a
      // binary search: edits remove a table and restore it later often enough that a
      // bisection lands on a later reappearance (it put a stage 24 hours late whose
      // table was there 30 minutes after the finish).
      if (test(await snapshotAt(points[0]), n)) { row[name] = "before"; continue; }
      row[name] = null;
      for (const point of points.slice(1)) {
        if (test(await snapshotAt(point), n)) { row[name] = new Date(point).toISOString(); break; }
      }
    }
    const finalAtHi = await snapshotAt(hi);
    row.depthAt72h = (finalAtHi?.stages || []).find((stage) => stage.number === n)?.standings.length || 0;
    rows.push(row);
    console.error(`  stage ${n}: ${JSON.stringify(row)} (${requests} requests so far)`);
  }
  return { title, windowStart: start, windowEnd: end, rows };
}

(async () => {
  const titles = process.argv.slice(2);
  const results = [];
  for (const title of titles) results.push(await replayRace(title));
  const outFile = path.join(outDir, process.env.OUT || "wiki-replay-results.json");
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
  results.forEach((result) => { existing[result.title] = result; });
  fs.writeFileSync(outFile, JSON.stringify(existing, null, 1));
  console.error(`done, ${requests} requests`);
})().catch((error) => { console.error(error); process.exit(1); });
