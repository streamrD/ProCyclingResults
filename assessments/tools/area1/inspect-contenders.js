// Does the jersey hover card hold a deeper GC than the podium on the thin finished cards?
const d = require("/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area1-scratch/prod-races-debug.json");
for (const title of ["2026 La Vuelta Femenina", "2026 Tour de Suisse", "2026 Tour de France"]) {
  const r = d.finalizedStageRaces.find((x) => x.pageTitle === title);
  const general = (r.stageRace.classificationLeaders?.entries || []).find((e) => e.key === "general");
  console.log(title, "| podium depth on card (richest of resultStandings/overallResult/GC):", Math.max((r.resultStandings || []).length, (r.stageRace.overallResult || []).length, (r.stageRace.generalClassification?.standings || []).length));
  console.log("   general contenders:", general?.contenders ? `${general.contenders.entries.length} rows, stage ${general.contenders.stageNumber ?? (general.contenders.final ? "final" : "?")}, metric ${general.contenders.metric}: ${general.contenders.entries.map((e) => e.rider).join(", ")}` : "none");
}
