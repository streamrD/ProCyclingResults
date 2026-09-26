// ONE confirmatory request to Wikipedia: why does the finished 2026 La Vuelta Femenina
// card carry a one-rider general classification on production? Saves the wikitext and
// runs the same parser the server runs.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const REPO = "/Users/tcs16/AgenticAI/ProCyclingResults/.claude/worktrees/agent-a780fde43237f01d3";
const OUT = "/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area1-scratch/la-vuelta-femenina-2026.wikitext";

function load() {
  const serverSource = fs.readFileSync(path.join(REPO, "server.js"), "utf8");
  const listenMarker = "\nserver.listen(PORT, () => {";
  const executableSource = serverSource.slice(0, serverSource.indexOf(listenMarker));
  const sandbox = { require, console, process, URL, fetch: global.fetch, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, AbortController, AbortSignal };
  vm.createContext(sandbox);
  vm.runInContext(`${executableSource}\n;globalThis.__X = { extractStageRaceSnapshot, extractClassificationTableGcSnapshots, extractStageLeadershipGcSnapshots, extractCyclingResultBlocks, extractWikiTables, FETCH_USER_AGENT_WITHOUT_CONTACT };`, sandbox);
  return sandbox.__X;
}

(async () => {
  const X = load();
  let text;
  if (fs.existsSync(OUT)) {
    text = fs.readFileSync(OUT, "utf8");
    console.log("using saved copy");
  } else {
    const url = "https://en.wikipedia.org/w/index.php?title=" + encodeURIComponent("2026 La Vuelta Femenina") + "&action=raw";
    const response = await fetch(url, { headers: { "user-agent": X.FETCH_USER_AGENT_WITHOUT_CONTACT + " (assessment, single request)" }, signal: AbortSignal.timeout(15000) });
    console.log("HTTP", response.status);
    text = await response.text();
    fs.writeFileSync(OUT, text);
  }
  console.log("bytes:", text.length);
  const snap = X.extractStageRaceSnapshot(text, [], new Map());
  console.log("completed/total:", snap.completedStages, "/", snap.totalStages);
  console.log("GC:", JSON.stringify({ stage: snap.generalClassification?.stageNumber, n: (snap.generalClassification?.standings || []).length, rows: (snap.generalClassification?.standings || []).slice(0, 5).map((e) => [e.place, e.rider, e.time, e.gap]) }));
  console.log("overallResult n:", (snap.overallResult || []).length);
  const gcTables = X.extractClassificationTableGcSnapshots(text);
  console.log("captioned GC tables found:", gcTables.map((t) => `stage ${t.stageNumber}: ${t.standings.length} rows`).join(" | ") || "none");
  const leadership = X.extractStageLeadershipGcSnapshots(text);
  console.log("leadership-derived GC rows:", leadership.map((t) => `stage ${t.stageNumber}`).join(",") || "none");
  const blocks = X.extractCyclingResultBlocks(text);
  console.log("cyclingresult blocks:", blocks.map((b) => `${b.title} (${(b.lines || b.rows || []).length})`).slice(0, 30).join(" | "));
  // What does the page actually write for the final GC? Show captions containing 'classification'.
  const captions = [...text.matchAll(/\|\+\s*(.*)/g)].map((m) => m[1].trim()).filter((c) => /classification/i.test(c));
  console.log("table captions mentioning classification:", captions.slice(0, 20).join(" | ") || "none");
  const headings = [...text.matchAll(/^(={2,4})\s*(.+?)\s*\1\s*$/gm)].map((m) => m[2]).filter((h) => /classification|standing|result/i.test(h));
  console.log("headings:", headings.join(" | "));
  const startTags = [...text.matchAll(/\{\{\s*cyclingresult start[^}]*\}\}/gi)].map((m) => m[0]).slice(0, 12);
  console.log("cyclingresult start tags:", startTags.join("\n  "));
})();
