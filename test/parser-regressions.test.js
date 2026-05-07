const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadParserExports() {
  const serverPath = path.join(__dirname, "..", "server.js");
  const serverSource = fs.readFileSync(serverPath, "utf8");
  const listenMarker = "\nserver.listen(PORT, () => {";
  const executableSource = serverSource.includes(listenMarker)
    ? serverSource.slice(0, serverSource.indexOf(listenMarker))
    : serverSource;

  const sandbox = {
    require,
    console,
    process,
    URL,
    fetch: global.fetch,
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${executableSource}\n;globalThis.__PCR_TEST__ = {
      extractStageRaceSnapshot,
      applyKnownStageRaceCorrections,
      buildLaVueltaFemeninaOfficialSnapshot,
      getStaticStageRaceSnapshot,
      selectPreferredStageRaceSnapshot,
      getStaticStageRaceSnapshotForTest: (pageTitle, endDateIso) =>
        getStaticStageRaceSnapshot({ pageTitle, endDate: new Date(endDateIso) }),
    };`,
    sandbox,
  );

  return sandbox.__PCR_TEST__;
}

test("extractStageRaceSnapshot reads stage and GC fallbacks from La Vuelta Femenina tables", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const fixturePath = path.join(__dirname, "fixtures", "la-vuelta-femenina-stage1.wikitext");
  const rawText = fs.readFileSync(fixturePath, "utf8");

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText)));

  assert.equal(snapshot.totalStages, 7);
  assert.equal(snapshot.completedStages, 1);
  assert.deepEqual(snapshot.latestStage, {
    number: 1,
    label: "Stage 1",
    standings: [{ place: "1", rider: "Noemi Rüegg", countryCode: "SUI" }],
    winner: "Noemi Rüegg",
    winnerCountryCode: "SUI",
  });
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 1,
    standings: [{ place: "1", rider: "Noemi Rüegg", countryCode: "SUI" }],
    leader: "Noemi Rüegg",
    leaderCountryCode: "SUI",
  });
});

test("applyKnownStageRaceCorrections expands La Vuelta Femenina stage 1 fallback to top five", () => {
  const { applyKnownStageRaceCorrections } = loadParserExports();
  const corrected = JSON.parse(
    JSON.stringify(
      applyKnownStageRaceCorrections(
        { pageTitle: "2026 La Vuelta Femenina" },
        {
          totalStages: 7,
          completedStages: 1,
          latestStage: {
            number: 1,
            label: "Stage 1",
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
            winner: "Noemi Rüegg",
          },
          generalClassification: {
            stageNumber: 1,
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
            leader: "Noemi Rüegg",
          },
          overallResult: [],
        },
      ),
    ),
  );

  assert.deepEqual(corrected.latestStage.standings, [
    { place: "1", rider: "Noemi Rüegg", countryCode: "SUI" },
    { place: "2", rider: "Lotte Kopecky", countryCode: "BEL" },
    { place: "3", rider: "Franziska Koch", countryCode: "GER" },
    { place: "4", rider: "Katarzyna Niewiadoma-Phinney", countryCode: "POL" },
    { place: "5", rider: "Maëva Squiban", countryCode: "FRA" },
  ]);
  assert.deepEqual(corrected.generalClassification.standings, [
    { place: "1", rider: "Noemi Rüegg", countryCode: "SUI" },
    { place: "2", rider: "Franziska Koch", countryCode: "GER" },
    { place: "3", rider: "Lotte Kopecky", countryCode: "BEL" },
    { place: "4", rider: "Loes Adegeest", countryCode: "NED" },
    { place: "5", rider: "Katarzyna Niewiadoma-Phinney", countryCode: "POL" },
  ]);
});

test("buildLaVueltaFemeninaOfficialSnapshot parses the current official stage and GC standings", () => {
  const { buildLaVueltaFemeninaOfficialSnapshot } = loadParserExports();
  const rankingsPath = path.join(__dirname, "fixtures", "la-vuelta-femenina-rankings-stage4.html");
  const gcPath = path.join(__dirname, "fixtures", "la-vuelta-femenina-gc-stage4.html");
  const rankingsHtml = fs.readFileSync(rankingsPath, "utf8");
  const gcHtml = fs.readFileSync(gcPath, "utf8");

  const snapshot = JSON.parse(
    JSON.stringify(
      buildLaVueltaFemeninaOfficialSnapshot(rankingsHtml, gcHtml, {
        pageTitle: "2026 La Vuelta Femenina",
        startDate: new Date("2026-05-03T00:00:00Z"),
        endDate: new Date("2026-05-09T00:00:00Z"),
      }),
    ),
  );

  assert.equal(snapshot.totalStages, 7);
  assert.equal(snapshot.completedStages, 4);
  assert.deepEqual(snapshot.latestStage, {
    number: 4,
    label: "Stage 4",
    standings: [
      { place: "1", rider: "Lotte Kopecky", countryCode: "BEL" },
      { place: "2", rider: "Anna Van Der Breggen", countryCode: "NED" },
      { place: "3", rider: "Letizia Paternoster", countryCode: "ITA" },
      { place: "4", rider: "Shari Bossuyt", countryCode: "BEL" },
      { place: "5", rider: "Franziska Koch", countryCode: "GER" },
    ],
    winner: "Lotte Kopecky",
    winnerCountryCode: "BEL",
  });
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 4,
    standings: [
      { place: "1", rider: "Lotte Kopecky", countryCode: "BEL" },
      { place: "2", rider: "Franziska Koch", countryCode: "GER" },
      { place: "3", rider: "Cedrine Kerbaol", countryCode: "FRA" },
      { place: "4", rider: "Anna Van Der Breggen", countryCode: "NED" },
      { place: "5", rider: "Sarah Van Dam", countryCode: "CAN" },
    ],
    leader: "Lotte Kopecky",
    leaderCountryCode: "BEL",
  });
});

test("getStaticStageRaceSnapshot returns the 2026 Grande Premio Anicolor fallback", () => {
  const { getStaticStageRaceSnapshotForTest } = loadParserExports();
  const snapshot = JSON.parse(
    JSON.stringify(
      getStaticStageRaceSnapshotForTest("Grande Prémio Anicolor", "2026-05-04T00:00:00Z"),
    ),
  );

  assert.equal(snapshot.totalStages, 3);
  assert.equal(snapshot.completedStages, 3);
  assert.deepEqual(snapshot.latestStage, {
    number: 3,
    label: "Stage 3",
    standings: [
      { place: "1", rider: "Alexis Guérin" },
      { place: "2", rider: "Javier Jamaica" },
      { place: "3", rider: "Artem Nych" },
      { place: "4", rider: "Xabier Berasategi" },
      { place: "5", rider: "Rafael Reis" },
    ],
    winner: "Alexis Guérin",
  });
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 3,
    standings: [
      { place: "1", rider: "Alexis Guérin" },
      { place: "2", rider: "Javier Jamaica" },
      { place: "3", rider: "Tiago Antunes" },
      { place: "4", rider: "Xabier Berasategi" },
      { place: "5", rider: "Joan Bou" },
    ],
    leader: "Alexis Guérin",
  });
  assert.deepEqual(snapshot.overallResult, [
    { place: "1", rider: "Alexis Guérin" },
    { place: "2", rider: "Javier Jamaica" },
    { place: "3", rider: "Tiago Antunes" },
    { place: "4", rider: "Xabier Berasategi" },
    { place: "5", rider: "Joan Bou" },
  ]);
});

test("selectPreferredStageRaceSnapshot prefers richer fallback when stage progress is tied", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 7,
          completedStages: 1,
          latestStage: {
            number: 1,
            standings: [
              { place: "1", rider: "Noemi Rüegg" },
              { place: "2", rider: "Lotte Kopecky" },
              { place: "3", rider: "Franziska Koch" },
              { place: "4", rider: "Katarzyna Niewiadoma-Phinney" },
              { place: "5", rider: "Maëva Squiban" },
            ],
          },
          generalClassification: {
            stageNumber: 1,
            standings: [
              { place: "1", rider: "Noemi Rüegg" },
              { place: "2", rider: "Franziska Koch" },
              { place: "3", rider: "Lotte Kopecky" },
              { place: "4", rider: "Loes Adegeest" },
              { place: "5", rider: "Katarzyna Niewiadoma-Phinney" },
            ],
          },
          overallResult: [],
        },
        {
          totalStages: 7,
          completedStages: 1,
          latestStage: {
            number: 1,
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
          },
          generalClassification: {
            stageNumber: 1,
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
          },
          overallResult: [],
        },
      ),
    ),
  );

  assert.equal(preferred.latestStage.standings.length, 5);
  assert.equal(preferred.generalClassification.standings.length, 5);
});

test("selectPreferredStageRaceSnapshot prefers later parsed progress over stage-1 fallback", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 7,
          completedStages: 1,
          latestStage: {
            number: 1,
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
          },
          generalClassification: {
            stageNumber: 1,
            standings: [{ place: "1", rider: "Noemi Rüegg" }],
          },
          overallResult: [],
        },
        {
          totalStages: 7,
          completedStages: 2,
          latestStage: {
            number: 2,
            standings: [{ place: "1", rider: "Marianne Vos" }],
          },
          generalClassification: {
            stageNumber: 2,
            standings: [{ place: "1", rider: "Marianne Vos" }],
          },
          overallResult: [],
        },
      ),
    ),
  );

  assert.equal(preferred.completedStages, 2);
  assert.equal(preferred.latestStage.number, 2);
  assert.equal(preferred.generalClassification.stageNumber, 2);
});
