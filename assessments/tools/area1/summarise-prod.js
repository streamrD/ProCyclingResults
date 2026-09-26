// Summarise the saved /api/races?debug=1 payload: provenance and depth of every card.
const d = require("/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area1-scratch/prod-races-debug.json");
console.log("fetchedAt", d.fetchedAt, "metadataFetchedAt", d.metadataFetchedAt);
console.log("debug", JSON.stringify(d.debug, null, 1).slice(0, 3000));
const buckets = ["liveStageRaces", "recentResults", "finalizedStageRaces", "upcomingRaces"];
for (const b of buckets) {
  console.log("\n==", b, (d[b] || []).length);
  for (const r of d[b] || []) {
    const sr = r.stageRace;
    console.log(
      " -", r.pageTitle || r.title, "|", r.series, "|", r.date,
      "| winner:", r.winner || "-",
      "| standings:", (r.resultStandings || []).length,
      sr ? ("| stages:" + (sr.completedStages || 0) + "/" + (sr.totalStages || 0) + " hist:" + ((sr.stages || []).length) + " src:" + JSON.stringify(sr.provenance || {}).slice(0, 140)) : "",
      r.resultSource ? ("| resultSource:" + r.resultSource) : "",
      r.finishVideoUrl ? "| video" : "| NO-VIDEO",
    );
  }
}
const n = d.nationalChampionships;
console.log("\nnationals:", n && { error: n.error, rows: n.totalCountryCount, reporting: n.reportingCountryCount, fetchedAt: n.fetchedAt, lastMod: n.sourceLastModified });
console.log("seasonCloseout:", d.seasonCloseout);
console.log("seasonCalendar:", d.seasonCalendar && { year: d.seasonCalendar.year, finished: d.seasonCalendar.finishedCount, live: d.seasonCalendar.liveCount, upcoming: d.seasonCalendar.upcomingCount, races: d.seasonCalendar.races.length });
