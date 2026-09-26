// Inspect the thin cards in the saved production payload.
const d = require("/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area1-scratch/prod-races-debug.json");
const all = [...d.recentResults, ...d.finalizedStageRaces];
for (const title of ["2026 Tour de Suisse", "2026 La Vuelta Femenina", "2026 Bretagne Classic", "2026 Hamburg Cyclassics", "2026 UCI Road World Championships – Women's road race"]) {
  const r = all.find((x) => x.pageTitle === title);
  if (!r) { console.log("MISSING", title); continue; }
  console.log("\n###", title, "| id:", r.id, "| winner/second/third:", r.winner, "/", r.second, "/", r.third);
  console.log("resultStandings:", JSON.stringify((r.resultStandings || []).map((e) => [e.place, e.rider, e.time, e.gap])));
  if (r.stageRace) {
    const sr = r.stageRace;
    console.log("GC:", JSON.stringify({ stage: sr.generalClassification?.stageNumber, label: sr.generalClassification?.label, n: (sr.generalClassification?.standings || []).length, rows: (sr.generalClassification?.standings || []).map((e) => [e.place, e.rider, e.time, e.gap]) }));
    console.log("overallResult n:", (sr.overallResult || []).length, "provenance:", JSON.stringify(sr.provenance));
    console.log("latestStage:", sr.latestStage?.number, "n:", (sr.latestStage?.standings || []).length, "history depth:", (sr.stages || []).map((s) => `${s.number}:${(s.standings || []).length}`).join(" "));
    console.log("jerseys:", (sr.classificationLeaders?.entries || []).map((e) => `${e.key}=${e.rider}`).join(", "));
  }
  console.log("finishVideoUrl:", r.finishVideoUrl || "-", "| resultSource:", r.resultSource || "-", "| finishedToday:", r.finishedToday);
}
// Count one-day recent results by standings depth.
const oneDay = d.recentResults.filter((r) => !r.stageRace);
console.log("\none-day recent cards:", oneDay.length, "with 5:", oneDay.filter((r) => (r.resultStandings || []).length >= 5).length, "with 0:", oneDay.filter((r) => !(r.resultStandings || []).length).length);
console.log("one-day cards with 0 standings:", oneDay.filter((r) => !(r.resultStandings || []).length).map((r) => r.pageTitle).join("; "));
