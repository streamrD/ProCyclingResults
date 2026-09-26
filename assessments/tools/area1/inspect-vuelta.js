// Why does the finished Vuelta show 21/21 with a 20-entry strip? Check for the cancelled stage.
const d = require("/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area1-scratch/prod-races-debug.json");
const r = d.finalizedStageRaces.find((x) => x.pageTitle === "2026 Vuelta a España");
const sr = r.stageRace;
console.log("stages in history:", sr.stages.map((s) => s.number).join(","));
console.log("route cancelled entries:", (sr.route || []).filter((s) => s.cancelled).map((s) => `${s.number}:${s.cancellationNote || ""}`));
console.log("route length:", (sr.route || []).length, "totalStages:", sr.totalStages, "completedStages:", sr.completedStages);
console.log("history depth:", sr.stages.map((s) => `${s.number}:${(s.standings || []).length}`).join(" "));
console.log("videos per stage:", sr.stages.filter((s) => s.finishVideoUrl).map((s) => s.number).join(",") || "none");
console.log("GC n:", (sr.generalClassification?.standings || []).length, "jerseys:", (sr.classificationLeaders?.entries || []).length);
