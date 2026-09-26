// Area 1 robustness harness: feed the main parsers bad input and classify the outcome.
// Run from the repo root (server.js reads data/ relative to process.cwd()).
// Outcome classes: THROW, EMPTY, OK (same as baseline), WRONG-PLAUSIBLE (non-empty and
// different from baseline in a way a reader could mistake for real data), DEGRADED (less
// data than baseline but nothing wrong).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO = "/Users/tcs16/AgenticAI/ProCyclingResults/.claude/worktrees/agent-a780fde43237f01d3";
const FIX = path.join(REPO, "test", "fixtures");
const fixture = (name) => fs.readFileSync(path.join(FIX, name), "utf8");

const NAMES = [
  "extractStageRaceSnapshot", "extractCyclingResultBlocks", "findOverallRaceResult",
  "parseWorldChampionshipEventResult", "parseWorldChampionshipMedalSummary", "parseWorldChampionshipEliteEvents",
  "parseNationalChampionshipsIndex", "isLikelyRaceArticle", "selectRaceArticles", "extractFeedItems",
  "buildArticleItem", "scoreRaceArticle", "isCurrentEditionRaceArticle", "parseSeasonRows", "SEASONS",
  "WORLD_CHAMPIONSHIPS", "parseLetourOfficialStandings", "parseAsoOfficialStandings",
  "parseTourOfGreeceOfficialStandings", "parseGiroDItaliaGeneralClassificationStandings",
  "extractClassificationLeadership", "extractClassificationStandings", "parseWikiTableGrid", "cleanWikiText",
  "parseAthleteDetails", "extractRouteStages", "buildStandingEntry", "parseEschbornFrankfurtOfficialStandings",
  "extractClassificationTableGcSnapshots", "resolveLetourStageStandings", "getRaceId",
];

function load() {
  const serverSource = fs.readFileSync(path.join(REPO, "server.js"), "utf8");
  const listenMarker = "\nserver.listen(PORT, () => {";
  const executableSource = serverSource.slice(0, serverSource.indexOf(listenMarker));
  const sandbox = { require, console, process, URL, fetch: global.fetch, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, AbortController, AbortSignal };
  vm.createContext(sandbox);
  const exportsSrc = NAMES.map((n) => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(",\n");
  vm.runInContext(`${executableSource}\n;globalThis.__X = {\n${exportsSrc}\n};`, sandbox);
  return sandbox.__X;
}

const X = load();
const J = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

// ---- bad inputs -------------------------------------------------------------
const BAD = {
  EMPTY: "",
  NULL: null,
  UNDEFINED: undefined,
  WIKIMEDIA_ERROR_HTML: `<!DOCTYPE html>\n<html lang=en>\n<meta charset=utf-8>\n<title>Wikimedia Error</title>\n<body><h1>Error</h1><p>Our servers are currently under maintenance or experiencing a technical problem. Please <a href="">try again</a> in a few minutes.</p><p>Request from 1.2.3.4 via cp3066, ATS/9.1.4</p></body></html>`,
  LOWERCASE_DOCTYPE_HTML: `<!doctype html><html><head><title>Rate limited</title></head><body><h1>429 Too Many Requests</h1><table><tr><th>Rank</th><th>Rider</th><th>Time</th></tr><tr><td>1</td><td>Nobody</td><td>0:00</td></tr></table></body></html>`,
  CLOUDFLARE_HTML: `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body class="no-js"><div class="main-wrapper"><h1>www.example.com</h1><p>Verifying you are human. This may take a few seconds.</p></div></body></html>`,
  GATEWAY_502_HTML: `<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>railway</center>\r\n</body>\r\n</html>`,
  BINARY_JUNK: Buffer.from([0xff, 0xfe, 0x00, 0x7b, 0x7c, 0x0a, 0x21, 0x00]).toString("latin1"),
};

const results = [];
function record(parser, input, fn, classify) {
  let outcome, note = "";
  try {
    const value = fn();
    const c = classify(value);
    outcome = c.outcome; note = c.note || "";
  } catch (error) {
    outcome = "THROW"; note = `${error.constructor.name}: ${String(error.message).slice(0, 90)}`;
  }
  results.push({ parser, input, outcome, note });
}

function truncate(text, fraction) { return text.slice(0, Math.floor(text.length * fraction)); }

// ---- 1. extractStageRaceSnapshot -------------------------------------------
{
  const summarise = (s) => ({
    total: s?.totalStages || 0, done: s?.completedStages || 0, hist: (s?.stages || []).length,
    gcStage: s?.generalClassification?.stageNumber ?? null, gcN: (s?.generalClassification?.standings || []).length,
    gcLeader: s?.generalClassification?.standings?.[0]?.rider || "", latest: s?.latestStage?.number ?? null,
    latestN: (s?.latestStage?.standings || []).length, latestWinner: s?.latestStage?.standings?.[0]?.rider || "",
    jerseys: (s?.classificationLeaders?.entries || []).length,
  });
  const isEmpty = (v) => !v || (!v.completedStages && !v.totalStages && !(v.stages || []).length && !v.generalClassification);
  for (const [name, input] of Object.entries(BAD)) {
    record("extractStageRaceSnapshot", name, () => X.extractStageRaceSnapshot(input, [], new Map()), (v) =>
      isEmpty(v) ? { outcome: "EMPTY", note: JSON.stringify(summarise(v)) } : { outcome: "WRONG-PLAUSIBLE", note: JSON.stringify(summarise(v)) });
  }
  const pages = {
    "vuelta-main(cancelled-stage3)": fixture("vuelta-a-espana-route-cancelled-stage3.wikitext"),
    "tdf-femmes-stage6(live)": fixture("tour-de-france-femmes-stage6.wikitext"),
    "vuelta-femenina-stage1": fixture("la-vuelta-femenina-stage1.wikitext"),
    "vuelta-stage2": fixture("vuelta-a-espana-stage2.wikitext"),
  };
  for (const [page, text] of Object.entries(pages)) {
    const base = summarise(X.extractStageRaceSnapshot(text, [], new Map()));
    results.push({ parser: "extractStageRaceSnapshot", input: `${page} BASELINE`, outcome: "BASE", note: JSON.stringify(base) });
    for (const f of [0.75, 0.5, 0.25, 0.1]) {
      record("extractStageRaceSnapshot", `${page} truncated@${f}`, () => X.extractStageRaceSnapshot(truncate(text, f), [], new Map()), (v) => {
        const s = summarise(v);
        if (isEmpty(v)) return { outcome: "EMPTY", note: JSON.stringify(s) };
        const wrong = (s.total && base.total && s.total !== base.total) || (s.gcLeader && base.gcLeader && s.gcLeader !== base.gcLeader) || (s.latestWinner && base.latestWinner && s.latestWinner !== base.latestWinner) || (s.gcStage && s.latest && s.gcStage > s.latest);
        return { outcome: wrong ? "WRONG-PLAUSIBLE" : (JSON.stringify(s) === JSON.stringify(base) ? "OK" : "DEGRADED"), note: JSON.stringify(s) };
      });
    }
    // Renamed headers in the classification wikitables and the route table.
    const renamed = text
      .replace(/!\s*Rider\b/g, "! Cyclist").replace(/!\s*Team\b/g, "! Squad").replace(/!\s*Time\b/g, "! Result").replace(/!\s*Rank\b/g, "! Pos.")
      .replace(/!\s*Winner\b/g, "! Stage winner");
    record("extractStageRaceSnapshot", `${page} renamed-headers(Rider/Team/Time/Rank/Winner)`, () => X.extractStageRaceSnapshot(renamed, [], new Map()), (v) => {
      const s = summarise(v);
      if (isEmpty(v)) return { outcome: "EMPTY", note: JSON.stringify(s) };
      const wrong = (s.gcLeader && base.gcLeader && s.gcLeader !== base.gcLeader) || (s.latestWinner && base.latestWinner && s.latestWinner !== base.latestWinner);
      return { outcome: wrong ? "WRONG-PLAUSIBLE" : (JSON.stringify(s) === JSON.stringify(base) ? "OK" : "DEGRADED"), note: JSON.stringify(s) };
    });
    // Renamed GC caption.
    const recaptioned = text.replace(/General classification after Stage/gi, "Overall standings after Stage");
    record("extractStageRaceSnapshot", `${page} recaptioned-GC('Overall standings after Stage')`, () => X.extractStageRaceSnapshot(recaptioned, [], new Map()), (v) => {
      const s = summarise(v);
      if (isEmpty(v)) return { outcome: "EMPTY", note: JSON.stringify(s) };
      return { outcome: JSON.stringify(s) === JSON.stringify(base) ? "OK" : "DEGRADED", note: JSON.stringify(s) };
    });
  }
  // Companion article truncated / HTML: must degrade to the main article alone.
  const main = fixture("vuelta-a-espana-stage2.wikitext");
  const comp = fixture("vuelta-a-espana-stages-1-11.wikitext");
  const base = summarise(X.extractStageRaceSnapshot(main, [comp], new Map()));
  results.push({ parser: "extractStageRaceSnapshot", input: "vuelta-stage2 + companion BASELINE", outcome: "BASE", note: JSON.stringify(base) });
  for (const [name, bad] of [["companion truncated@0.5", truncate(comp, 0.5)], ["companion WIKIMEDIA_ERROR_HTML", BAD.WIKIMEDIA_ERROR_HTML], ["companion EMPTY", ""]]) {
    record("extractStageRaceSnapshot", `vuelta-stage2 + ${name}`, () => X.extractStageRaceSnapshot(main, [bad], new Map()), (v) => {
      const s = summarise(v);
      const wrong = (s.latestWinner && base.latestWinner && s.latestWinner !== base.latestWinner) || (s.gcLeader && base.gcLeader && s.gcLeader !== base.gcLeader);
      return { outcome: wrong ? "WRONG-PLAUSIBLE" : (JSON.stringify(s) === JSON.stringify(base) ? "OK" : "DEGRADED"), note: JSON.stringify(s) };
    });
  }
}

// ---- 2. One-day result parser (extractCyclingResultBlocks + findOverallRaceResult) ---
{
  const oneDay = `{{Infobox cycling race report\n| name = 2026 Milan–San Remo\n}}\n'''The 2026 Milan–San Remo''' was a race.\n\n== Result ==\n{{Cyclingresult start|title=Result|rider=yes}}\n{{cyclingresult|1|{{flagathlete|[[Tadej Pogačar]]|SLO}}|{{UCI team code|UAD|2026}}|6h 20' 47"}}\n{{cyclingresult|2|{{flagathlete|[[Mathieu van der Poel]]|NED}}|{{UCI team code|ADC|2026}}|s.t.}}\n{{cyclingresult|3|{{flagathlete|[[Filippo Ganna]]|ITA}}|{{UCI team code|IGD|2026}}|+ 3"}}\n{{cyclingresult|4|{{flagathlete|[[Michael Matthews]]|AUS}}|{{UCI team code|JAY|2026}}|+ 41"}}\n{{cyclingresult|5|{{flagathlete|[[Tom Pidcock]]|GBR}}|{{UCI team code|Q36|2026}}|+ 41"}}\n{{Cyclingresult end}}\n\n== References ==\n{{reflist}}\n`;
  const run = (text) => X.findOverallRaceResult(X.extractCyclingResultBlocks(text));
  const summarise = (v) => (v || []).map((e) => `${e.place}:${e.rider}`).join(",");
  const base = summarise(run(oneDay));
  results.push({ parser: "one-day(findOverallRaceResult)", input: "crafted BASELINE", outcome: "BASE", note: base });
  for (const [name, input] of Object.entries(BAD)) {
    record("one-day(findOverallRaceResult)", name, () => run(input), (v) => ((v || []).length ? { outcome: "WRONG-PLAUSIBLE", note: summarise(v) } : { outcome: "EMPTY" }));
  }
  const variants = {
    "title=Final result": oneDay.replace("title=Result", "title=Final result"),
    "title=Results": oneDay.replace("title=Result", "title=Results"),
    "title=Classement": oneDay.replace("title=Result", "title=Classement"),
    "no end tag (truncated)": oneDay.slice(0, oneDay.indexOf("{{Cyclingresult end}}")),
    "truncated mid-row": oneDay.slice(0, oneDay.indexOf("{{cyclingresult|4")).replace(/\n$/, "") + "\n{{cyclingresult|4|{{flagathlete|[[Mich",
    "spaced template {{cycling result|": oneDay.replace(/\{\{cyclingresult\|/g, "{{cycling result|"),
    "rider column as plain link (no flagathlete)": oneDay.replace(/\{\{flagathlete\|(\[\[[^\]]+\]\])\|[A-Z]{3}\}\}/g, "$1"),
    "two blocks: 'Previous edition' first": oneDay.replace("== Result ==", "== Previous edition ==\n{{Cyclingresult start|title=2025 Result|rider=yes}}\n{{cyclingresult|1|{{flagathlete|[[Jasper Philipsen]]|BEL}}|{{UCI team code|ADC|2025}}|6h 22' 00\"}}\n{{Cyclingresult end}}\n\n== Result =="),
    "block titled 'Teams' before result": oneDay.replace("== Result ==", "== Teams ==\n{{Cyclingresult start|title=Teams|rider=no}}\n{{cyclingresult|1|{{UCI team code|UAD|2026}}}}\n{{Cyclingresult end}}\n\n== Result =="),
  };
  for (const [name, text] of Object.entries(variants)) {
    record("one-day(findOverallRaceResult)", name, () => run(text), (v) => {
      const s = summarise(v);
      if (!s) return { outcome: "EMPTY" };
      if (s === base) return { outcome: "OK", note: s };
      const firstMatches = s.split(",")[0] === base.split(",")[0];
      return { outcome: firstMatches ? "DEGRADED" : "WRONG-PLAUSIBLE", note: s };
    });
  }
}

// ---- 3. parseWorldChampionshipEventResult ---------------------------------
{
  const summarise = (v) => ({ podium: (v?.podium || []).map((e) => e.rider).join("/"), n: (v?.standings || []).length, top: (v?.standings || []).map((e) => `${e.place}:${e.rider}:${e.countryCode}:${e.time || ""}:${e.gap || ""}`).join(" | ") });
  const isEmpty = (v) => !(v?.podium || []).length && !(v?.standings || []).length;
  for (const [name, input] of Object.entries(BAD)) {
    record("parseWorldChampionshipEventResult", name, () => X.parseWorldChampionshipEventResult(input), (v) => (isEmpty(v) ? { outcome: "EMPTY" } : { outcome: "WRONG-PLAUSIBLE", note: JSON.stringify(summarise(v)) }));
  }
  const pages = {
    "2026-mens-tt": fixture("uci-road-world-championships-2026-mens-time-trial.wikitext"),
    "2026-u23-rr": fixture("uci-road-world-championships-2026-mens-under-23-road-race.wikitext"),
    "2025-mens-rr": fixture("uci-road-world-championships-2025-mens-road-race.wikitext"),
  };
  for (const [page, text] of Object.entries(pages)) {
    const base = summarise(X.parseWorldChampionshipEventResult(text));
    results.push({ parser: "parseWorldChampionshipEventResult", input: `${page} BASELINE`, outcome: "BASE", note: JSON.stringify(base) });
    const classify = (v) => {
      const s = summarise(v);
      if (isEmpty(v)) return { outcome: "EMPTY" };
      if (JSON.stringify(s) === JSON.stringify(base)) return { outcome: "OK" };
      const podiumOk = s.podium === base.podium;
      const namesOk = s.top.split(" | ").every((row, i) => !row || row.split(":")[1] === (base.top.split(" | ")[i] || "").split(":")[1]);
      const wrong = !podiumOk || !namesOk;
      return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: JSON.stringify(s) };
    };
    for (const f of [0.75, 0.5, 0.25]) record("parseWorldChampionshipEventResult", `${page} truncated@${f}`, () => X.parseWorldChampionshipEventResult(truncate(text, f)), classify);
    const renames = {
      "Athlete/Rider->Competitor": text.replace(/!\s*(Athlete|Rider)\b/g, "! Competitor"),
      "Rank->Pos.": text.replace(/!\s*Rank\b/g, "! Pos."),
      "Time->Result": text.replace(/!\s*Time\b/g, "! Result"),
      "Nation/Country->Team": text.replace(/!\s*(Nation|Country)\b/g, "! Team"),
      "columns reordered (Nation before Athlete)": text.replace(/!\s*(Athlete|Rider)\s*!!\s*(Nation|Country)/g, "! $2 !! $1"),
      "section 'Final classification'->'Results'": text.replace(/==\s*Final classification\s*==/gi, "== Results =="),
      "section 'Final classification'->'Classification'": text.replace(/==\s*Final classification\s*==/gi, "== Classification =="),
      "infobox podium removed": text.replace(/^\|\s*(first|second|third|gold|silver|bronze)\s*=.*$/gim, ""),
    };
    for (const [name, mutated] of Object.entries(renames)) record("parseWorldChampionshipEventResult", `${page} ${name}`, () => X.parseWorldChampionshipEventResult(mutated), classify);
  }
}

// ---- 4. parseWorldChampionshipMedalSummary --------------------------------
{
  const text = fixture("uci-road-world-championships-2026-time-trial-medals.wikitext");
  const summarise = (m) => [...(m || new Map()).entries()].map(([k, v]) => `${k} => ${v.map((e) => e.rider).join("/")}`).join(" ; ");
  const base = summarise(X.parseWorldChampionshipMedalSummary(text));
  results.push({ parser: "parseWorldChampionshipMedalSummary", input: "2026 fixture BASELINE", outcome: "BASE", note: base });
  for (const [name, input] of Object.entries(BAD)) record("parseWorldChampionshipMedalSummary", name, () => X.parseWorldChampionshipMedalSummary(input), (m) => (m.size ? { outcome: "WRONG-PLAUSIBLE", note: summarise(m) } : { outcome: "EMPTY" }));
  const variants = {
    "section 'Medal summary'->'Medallists'": text.replace(/==\s*Medal summary\s*==/gi, "== Medallists =="),
    "section 'Medal summary'->'Medal table'": text.replace(/==\s*Medal summary\s*==/gi, "== Medal table =="),
    "section 'Medal summary'->'Medalists'": text.replace(/==\s*Medal summary\s*==/gi, "== Medalists =="),
    "{{DetailsLink}}->{{Main}}": text.replace(/\{\{\s*DetailsLink\s*\|/g, "{{Main|"),
    "{{Flag medalist}}->{{FlagIOCmedalist}}": text.replace(/\{\{\s*Flag[\s_]*medalist\s*\|/gi, "{{FlagIOCmedalist|"),
    "truncated@0.5": truncate(text, 0.5),
    "rows separated by '|-\\n' with attributes": text.replace(/\n\|-\s*\n/g, "\n|- style=\"background:#fff\"\n"),
  };
  for (const [name, mutated] of Object.entries(variants)) record("parseWorldChampionshipMedalSummary", name, () => X.parseWorldChampionshipMedalSummary(mutated), (m) => {
    const s = summarise(m);
    if (!m.size) return { outcome: "EMPTY" };
    if (s === base) return { outcome: "OK" };
    const wrong = [...m.entries()].some(([k, v]) => { const b = X.parseWorldChampionshipMedalSummary(text).get(k); return b && b[0].rider !== v[0].rider; });
    return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: s };
  });
}

// ---- 5. parseWorldChampionshipEliteEvents ----------------------------------
{
  const text = fixture("uci-road-world-championships-2026.wikitext");
  const summarise = (v) => (v || []).map((e) => `${e.title}@${e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : "?"}`).join(" | ");
  const base = summarise(X.parseWorldChampionshipEliteEvents(text, X.WORLD_CHAMPIONSHIPS, 2026));
  results.push({ parser: "parseWorldChampionshipEliteEvents", input: "2026 fixture BASELINE", outcome: "BASE", note: base });
  for (const [name, input] of Object.entries(BAD)) record("parseWorldChampionshipEliteEvents", name, () => X.parseWorldChampionshipEliteEvents(input, X.WORLD_CHAMPIONSHIPS, 2026), (v) => ((v || []).length ? { outcome: "WRONG-PLAUSIBLE", note: summarise(v) } : { outcome: "EMPTY" }));
  const variants = {
    "section 'Schedule'->'Programme'": text.replace(/==\s*Schedule\s*==/gi, "== Programme =="),
    "section 'Schedule'->'Events'": text.replace(/==\s*Schedule\s*==/gi, "== Events =="),
    "truncated@0.5": truncate(text, 0.5),
    "truncated@0.25": truncate(text, 0.25),
    "Date header->'Day'": text.replace(/!\s*Date\b/g, "! Day"),
  };
  for (const [name, mutated] of Object.entries(variants)) record("parseWorldChampionshipEliteEvents", name, () => X.parseWorldChampionshipEliteEvents(mutated, X.WORLD_CHAMPIONSHIPS, 2026), (v) => {
    const s = summarise(v);
    if (!s) return { outcome: "EMPTY" };
    if (s === base) return { outcome: "OK" };
    const baseDates = Object.fromEntries(base.split(" | ").map((x) => x.split("@")));
    const wrong = s.split(" | ").some((x) => { const [t, d] = x.split("@"); return baseDates[t] && baseDates[t] !== d; });
    return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: s };
  });
}

// ---- 6. parseNationalChampionshipsIndex ------------------------------------
{
  const html = `<html><head><script type="application/ld+json">{"dateModified":"2026-06-21T22:58:07+00:00"}</script></head><body>
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>
      <tr><th>Australia</th><td>Luke Plapp</td><td>Axel K&auml;llberg</td><td>Grace Brown</td><td>Ruby Roseman-Gannon</td></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
      <tr><th>Great Britain</th><td></td><td></td><td></td><td></td></tr>
      <tr><th>Canada</th><td></td><td>Alison Jackson</td><td></td><td></td></tr>
    </table></body></html>`;
  const summarise = (v) => ({ error: v?.error || "", rows: v?.totalCountryCount ?? -1, aus: v?.rows?.find((r) => r.country === "Australia") || null, first: v?.rows?.[0]?.country || "" });
  const base = summarise(X.parseNationalChampionshipsIndex(html));
  results.push({ parser: "parseNationalChampionshipsIndex", input: "crafted BASELINE", outcome: "BASE", note: JSON.stringify(base) });
  for (const [name, input] of Object.entries(BAD)) record("parseNationalChampionshipsIndex", name, () => X.parseNationalChampionshipsIndex(input), (v) => (v?.error ? { outcome: "EMPTY(error set)", note: v.error } : v?.totalCountryCount ? { outcome: "WRONG-PLAUSIBLE", note: JSON.stringify(summarise(v)) } : { outcome: "EMPTY(no error!)" }));
  const variants = {
    "caption '2026 Elite Road National Champions (updated)'": html.replace("<caption>2026 Elite Road National Champions</caption>", "<caption>2026 Elite Road National Champions (updated)</caption>"),
    "caption '2026 National Road Champions – Elite'": html.replace("<caption>2026 Elite Road National Champions</caption>", "<caption>2026 National Road Champions – Elite</caption>"),
    "caption moved to <h2> above table": html.replace("<caption>2026 Elite Road National Champions</caption>", "").replace("<table>", "<h2>2026 Elite Road National Champions</h2><table>"),
    "extra column 'Code' inserted after Country": html.replace(/<th>Country<\/th>/, "<th>Country</th><th>Code</th>").replace(/<th>Australia<\/th>/, "<th>Australia</th><td>AUS</td>").replace(/<th>United States<\/th>/, "<th>United States</th><td>USA</td>").replace(/<th>Great Britain<\/th>/, "<th>Great Britain</th><td>GBR</td>").replace(/<th>Canada<\/th>/, "<th>Canada</th><td>CAN</td>"),
    "columns swapped: WE before ME": html.replace("<th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th>", "<th>WE ITT</th><th>WE Road Race</th><th>ME ITT</th><th>ME Road Race</th>").replace("<td>Luke Plapp</td><td>Axel K&auml;llberg</td><td>Grace Brown</td><td>Ruby Roseman-Gannon</td>", "<td>Grace Brown</td><td>Ruby Roseman-Gannon</td><td>Luke Plapp</td><td>Axel K&auml;llberg</td>"),
    "columns swapped: RR before ITT": html.replace("<th>ME ITT</th><th>ME Road Race</th>", "<th>ME Road Race</th><th>ME ITT</th>").replace("<td>Luke Plapp</td><td>Axel K&auml;llberg</td>", "<td>Axel K&auml;llberg</td><td>Luke Plapp</td>"),
    "no header row (first data row is Australia)": html.replace("<tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>", ""),
    "thead/tbody wrappers": html.replace("<tr><th>Country</th>", "<thead><tr><th>Country</th>").replace("<th>WE Road Race</th></tr>", "<th>WE Road Race</th></tr></thead><tbody>").replace("</table>", "</tbody></table>"),
    "truncated@0.5": truncate(html, 0.5),
    "cells carry <a> links": html.replace(/<td>([^<]+)<\/td>/g, '<td><a href="/x">$1</a></td>'),
  };
  for (const [name, mutated] of Object.entries(variants)) record("parseNationalChampionshipsIndex", name, () => X.parseNationalChampionshipsIndex(mutated), (v) => {
    const s = summarise(v);
    if (v?.error) return { outcome: "EMPTY(error set)", note: v.error };
    if (!v?.totalCountryCount) return { outcome: "EMPTY(no error!)" };
    if (JSON.stringify(s) === JSON.stringify(base)) return { outcome: "OK" };
    const aus = s.aus; const b = base.aus;
    const wrong = aus && b && (aus.meItt !== b.meItt || aus.meRoadRace !== b.meRoadRace || aus.weItt !== b.weItt || aus.weRoadRace !== b.weRoadRace);
    return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: JSON.stringify(s) };
  });
}

// ---- 7. parseSeasonRows -----------------------------------------------------
{
  const season = X.SEASONS[0];
  results.push({ parser: "parseSeasonRows", input: "SEASONS[0]", outcome: "INFO", note: JSON.stringify(season) });
  const page = `== Events ==\n{| class="wikitable plainrowheaders"\n|-\n! scope="col" | Race\n! scope="col" | Date\n! scope="col" | Winner\n! scope="col" | Second\n! scope="col" | Third\n|-\n! scope="row" | {{flagicon|AUS}} [[2026 Tour Down Under|Tour Down Under]]\n| 20–25 January\n| {{flagathlete|[[Jhonatan Narváez]]|ECU}}\n| {{flagathlete|[[Javier Romo]]|ESP}}\n| {{flagathlete|[[Eddie Dunbar]]|IRL}}\n|-\n! scope="row" | {{flagicon|ITA}} [[2026 Milan–San Remo|Milan–San Remo]]\n| 21 March\n| {{flagathlete|[[Tadej Pogačar]]|SLO}}\n| {{flagathlete|[[Mathieu van der Poel]]|NED}}\n| {{flagathlete|[[Filippo Ganna]]|ITA}}\n|-\n! scope="row" | {{flagicon|ITA}} [[2026 Il Lombardia|Il Lombardia]]\n| 10 October\n|\n|\n|\n|}\n`;
  const summarise = (v) => (v || []).filter((r) => r.pageTitle).map((r) => `${r.pageTitle}@${r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "?"}..${r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "?"}:${r.winner || "-"}${r.isCancelled ? ":CANCELLED" : ""}`).join(" | ");
  const base = summarise(X.parseSeasonRows(page, season, 2026));
  results.push({ parser: "parseSeasonRows", input: "crafted BASELINE", outcome: "BASE", note: base });
  for (const [name, input] of Object.entries(BAD)) record("parseSeasonRows", name, () => X.parseSeasonRows(input, season, 2026), (v) => (summarise(v) ? { outcome: "WRONG-PLAUSIBLE", note: summarise(v) } : { outcome: "EMPTY" }));
  const variants = {
    "table class 'wikitable sortable plainrowheaders'": page.replace('class="wikitable plainrowheaders"', 'class="wikitable sortable plainrowheaders"'),
    "table class 'wikitable plainrowheaders sortable'": page.replace('class="wikitable plainrowheaders"', 'class="wikitable plainrowheaders sortable"'),
    "table class with style attr first": page.replace('{| class="wikitable plainrowheaders"', '{| style="font-size:95%" class="wikitable plainrowheaders"'),
    "row separators '|- style=...'": page.replace(/\n\|-\n/g, '\n|- style="background:#fff"\n'),
    "Date column moved after Winner": page.replace("! scope=\"col\" | Date\n! scope=\"col\" | Winner", "! scope=\"col\" | Winner\n! scope=\"col\" | Date").replace(/\n\| (20–25 January|21 March|10 October)\n\| (.*)\n/g, "\n| $2\n| $1\n"),
    "extra 'Country' column after Race": page.replace("! scope=\"col\" | Race\n", "! scope=\"col\" | Race\n! scope=\"col\" | Country\n").replace(/(\[\[2026 [^\]]+\]\])\n/g, "$1\n| {{AUS}}\n"),
    "truncated@0.5": truncate(page, 0.5),
    "cells written inline with ||": page.replace(/\n\| \{\{flagathlete\|\[\[Javier Romo\]\]\|ESP\}\}\n\| \{\{flagathlete\|\[\[Eddie Dunbar\]\]\|IRL\}\}/, " || {{flagathlete|[[Javier Romo]]|ESP}} || {{flagathlete|[[Eddie Dunbar]]|IRL}}"),
  };
  for (const [name, mutated] of Object.entries(variants)) record("parseSeasonRows", name, () => X.parseSeasonRows(mutated, season, 2026), (v) => {
    const s = summarise(v);
    if (!s) return { outcome: "EMPTY" };
    if (s === base) return { outcome: "OK" };
    const baseMap = Object.fromEntries(base.split(" | ").map((x) => [x.split("@")[0], x]));
    const wrong = s.split(" | ").some((x) => { const t = x.split("@")[0]; return baseMap[t] && baseMap[t] !== x; });
    return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: s };
  });
}

// ---- 8. Article filter ------------------------------------------------------
{
  const race = { id: "2026-milan-san-remo", title: "Milan–San Remo", pageTitle: "2026 Milan–San Remo", date: "21 March", startDate: new Date("2026-03-21T00:00:00Z"), endDate: new Date("2026-03-21T00:00:00Z"), winner: "Tadej Pogačar", series: "Men's WorldTour" };
  for (const [name, input] of Object.entries(BAD)) {
    record("extractFeedItems", name, () => X.extractFeedItems(input), (v) => ((v || []).length ? { outcome: "WRONG-PLAUSIBLE", note: `${v.length} items` } : { outcome: "EMPTY" }));
  }
  const rss = `<?xml version="1.0"?><rss><channel><item><title>Pogacar wins Milan-San Remo 2026</title><link>https://example.com/a</link><description>Result report</description><pubDate>Sat, 21 Mar 2026 16:00:00 GMT</pubDate><News:Source>Cyclingnews</News:Source></item><item><title>Weather in Milan</title><link>https://example.com/b</link><description>Rain</description><pubDate>Sat, 21 Mar 2026 16:00:00 GMT</pubDate></item></channel></rss>`;
  record("extractFeedItems", "well-formed rss", () => X.extractFeedItems(rss), (v) => ({ outcome: v.length === 2 ? "OK" : "DEGRADED", note: `${v.length} items` }));
  record("extractFeedItems", "rss truncated mid-item", () => X.extractFeedItems(truncate(rss, 0.6)), (v) => ({ outcome: v.length <= 1 ? "DEGRADED" : "OK", note: `${v.length} items` }));
  for (const [name, article] of [["null", null], ["{}", {}], ["{title:null}", { title: null, description: null, publisher: null, url: null }], ["numbers", { title: 42, description: 7, publisher: 1, url: 2 }]]) {
    record("isLikelyRaceArticle", name, () => X.isLikelyRaceArticle(article, race), (v) => ({ outcome: v ? "WRONG-PLAUSIBLE" : "EMPTY", note: String(v) }));
    record("isCurrentEditionRaceArticle", name, () => X.isCurrentEditionRaceArticle(article, race), (v) => ({ outcome: "returned", note: String(v) }));
    record("scoreRaceArticle", name, () => X.scoreRaceArticle(article, race), (v) => ({ outcome: Number.isFinite(v) ? "returned" : "NaN!", note: String(v) }));
  }
  for (const [name, pool] of [["null pool", null], ["[] pool", []], ["[null] pool", [null]], ["[{}] pool", [{}]]]) {
    record("selectRaceArticles", name, () => X.selectRaceArticles(pool, 0, race), (v) => ({ outcome: (v || []).length ? "returned" : "EMPTY", note: `${(v || []).length}` }));
  }
  record("isLikelyRaceArticle", "race=null, good article", () => X.isLikelyRaceArticle({ title: "Pogacar wins Milan-San Remo", description: "", publisher: "x", url: "u" }, null), (v) => ({ outcome: "returned", note: String(v) }));
}

// ---- 9. Official providers (HTML parsers) -----------------------------------
{
  const tdf = fixture("tour-de-france-stage21-ite.html");
  const greece = fixture("tour-of-greece-results-2026-stage1.html");
  const summarise = (v) => (Array.isArray(v) ? v.map((e) => `${e.place}:${e.rider}`).join(",") : JSON.stringify(v).slice(0, 120));
  const greeceFn = X.parseTourOfGreeceOfficialStandings ? (html) => X.parseTourOfGreeceOfficialStandings(html, "General Classification") : undefined;
  for (const [pname, fn, fixtureText] of [["parseLetourOfficialStandings", X.parseLetourOfficialStandings, tdf], ["parseTourOfGreeceOfficialStandings(html,'General Classification')", greeceFn, greece], ["parseGiroDItaliaGeneralClassificationStandings", X.parseGiroDItaliaGeneralClassificationStandings, ""], ["parseEschbornFrankfurtOfficialStandings", X.parseEschbornFrankfurtOfficialStandings, ""]]) {
    if (!fn) { results.push({ parser: pname, input: "-", outcome: "NOT-EXPORTED" }); continue; }
    for (const [name, input] of Object.entries(BAD)) record(pname, name, () => fn(input), (v) => { const s = summarise(v); const n = Array.isArray(v) ? v.length : (v && typeof v === "object" ? Object.values(v).flat().length : 0); return n ? { outcome: "WRONG-PLAUSIBLE", note: s } : { outcome: "EMPTY", note: s }; });
    if (fixtureText) {
      let base;
      try { base = summarise(fn(fixtureText)); } catch (error) { results.push({ parser: pname, input: "fixture BASELINE", outcome: "THROW", note: String(error.message).slice(0, 90) }); continue; }
      results.push({ parser: pname, input: "fixture BASELINE", outcome: "BASE", note: base });
      for (const f of [0.5, 0.25]) record(pname, `fixture truncated@${f}`, () => fn(truncate(fixtureText, f)), (v) => { const s = summarise(v); if (!s || s === "[]" ) return { outcome: "EMPTY" }; if (s === base) return { outcome: "OK" }; const wrong = Array.isArray(v) && v.length && base.split(",")[0] !== s.split(",")[0]; return { outcome: wrong ? "WRONG-PLAUSIBLE" : "DEGRADED", note: s }; });
      record(pname, "class names renamed (rankingTable->resultsTable, runner->rider)", () => fn(fixtureText.replace(/rankingTable/g, "resultsTable").replace(/\brunner\b/g, "rider")), (v) => { const s = summarise(v); if (!s || s === "[]") return { outcome: "EMPTY" }; return { outcome: s === base ? "OK" : "DEGRADED", note: s }; });
    }
  }
}

// ---- report -----------------------------------------------------------------
const byOutcome = {};
for (const r of results) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;
console.log("OUTCOME COUNTS", JSON.stringify(byOutcome));
console.log("");
for (const r of results) console.log(`${r.outcome.padEnd(18)} ${r.parser.padEnd(40)} ${r.input.padEnd(55)} ${r.note || ""}`);
fs.writeFileSync(path.join(__dirname, "robustness-results.json"), JSON.stringify(results, null, 1));
