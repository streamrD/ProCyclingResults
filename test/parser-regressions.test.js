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

  // The sandbox has to carry the timer globals: server.js uses them for fetch retry
  // backoff and for the official-snapshot blocking budget, and a missing setTimeout
  // surfaces as a ReferenceError from inside the VM rather than anything obvious.
  const sandbox = {
    require,
    console,
    process,
    URL,
    fetch: global.fetch,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    AbortController,
    AbortSignal,
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${executableSource}\n;globalThis.__PCR_TEST__ = {
      extractStageRaceSnapshot,
      applyKnownStageRaceCorrections,
      buildLaVueltaFemeninaOfficialSnapshot,
      extractLaVueltaFemeninaGeneralAjaxUrl,
      extractLaVueltaFemeninaStageAjaxUrl,
      fetchGiroDItaliaOfficialSnapshot,
      fetchGiroDItaliaWomenOfficialSnapshot,
      extractGiroDItaliaFinishVideoUrl,
      extractGiroDItaliaLatestCompletedStageNumber,
      extractGiroDItaliaWomenEmbeddedStageNumber,
      extractGiroDItaliaWomenLatestCompletedStageNumber,
      resolveGiroDItaliaCompletedStageNumber,
      resolveGiroDItaliaLivefeedStageNumber,
      parseSpanishStageNumber,
      isVueltaABurgosFeminasRace,
      parseGiroDItaliaGeneralClassificationStandings,
      parseGiroDItaliaLivefeedStageStandings,
      parseGiroDItaliaStageClassificationStandings,
      extractVueltaABurgosFeminasStageStandings,
      extractVueltaABurgosFeminasLiveblogEndpoint,
      extractVueltaABurgosFeminasLatestMetaUpdateText,
      getKnownVueltaABurgosFeminasGcStandings,
      fetchVueltaABurgosFeminasOfficialSnapshot,
      fetchTourAuvergneRhoneAlpesOfficialSnapshot,
      parseLetourOfficialStandings,
      resolveLetourStageStandings,
      extractTourDeFranceOfficialStageInfo,
      extractTourDeFranceStageAjaxUrl,
      extractTourDeFranceGeneralAjaxUrl,
      buildTourDeFranceOfficialSnapshot,
      fetchTourDeFranceOfficialSnapshot,
      fetchTourDeFranceFemmesOfficialSnapshot,
      fetchVueltaAEspanaOfficialSnapshot,
      extractClassificationTableGcSnapshots,
      parseAthleteDetails,
      cleanWikiText,
      buildRaceArticleQueries,
      scoreRaceArticle,
      selectRaceArticles,
      isCurrentEditionRaceArticle,
      buildFinishVideoQuery,
      parseYouTubeSearchVideos,
      isLikelyFinishVideo,
      selectFinishVideo,
      parseTourOfGreeceOfficialStandings,
      extractTourOfGreeceLatestStageNumber,
      buildRaceCard,
      buildStageRaceCard,
      getRaceFinishVideoUrl,
      isMultiDayRace,
      isRaceWithinScheduledLiveWindow,
      getStaticStageRaceSnapshot,
      partitionRaceBuckets,
      selectPreferredStageRaceSnapshot,
      hasFreshnessSensitiveRaceData,
      getRaceDataCacheTtlMs,
      parseNationalChampionshipsIndex,
      getCountryFlagEmojiByName,
      buildNationalChampionshipEventCard,
      buildNationalChampionshipsSection,
      getCompetitionGroups,
      buildRecentResultsBlock,
      extractStageArticleTitles,
      buildStageSwitcherMarkup,
      mergeStageRaceSnapshots,
      findStageRaceById,
      getStageFinishVideoUrl,
      enrichStageFinishVideos,
      BUILD_INFO,
      applyLateOfficialSnapshots,
      mergeLatestStageIntoHistory,
      extractRouteStages,
      parseStageCourseEnds,
      extractKomootTourReference,
      buildStageProfileFromKomoot,
      enrichStageProfiles,
      attachCachedStageProfiles,
      stageProfileCache,
      applyRouteDetails,
      buildStageProfileMarkup,
      parseStageType,
      parseStageDistanceKm,
      parseTeamReference,
      collectTeamReferences,
      normalizeSearchText,
      extractCyclingResultBlocks,
      parseCyclingResultStandings,
      loadOfficialStageRaceSnapshotWithinBudget,
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

test("extractStageRaceSnapshot treats a not-yet-raced schedule table as zero completed stages", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  // A Grand Tour route table before the race has empty winner cells and a
  // "|- class=sortbottom" Total footer whose spanning "colspan" cell would otherwise
  // merge into the final stage row and read as a fake winner.
  const rawText = [
    "{{Infobox cycling race report",
    "|name = 2026 Tour de France",
    "|stages = 21",
    "}}",
    "",
    '{| class="wikitable sortable"',
    "|+Stage characteristics",
    '! scope="col" |Stage',
    '! scope="col" |Date',
    '! scope="col" |Course',
    '! scope="col" |Distance',
    '! colspan="2" scope="col" |Type',
    '! scope="col" |Winner',
    "|-",
    '! scope="row" |[[2026 Tour de France, Stage 1 to Stage 11#Stage 1|1]]',
    '| style="text-align:right" |4 July',
    "| [[Barcelona]] (Spain)",
    '| style="text-align:center;" |{{convert|19.6|km|abbr=on}}',
    "| [[File:Team Time Trial Stage.svg|20px|alt=|link=]]",
    "| [[Team time trial]]",
    "|",
    "|-",
    '! scope="row" |[[2026 Tour de France, Stage 12 to Stage 21#Stage 21|21]]',
    '| style="text-align:right" |26 July',
    "| [[Thoiry, Yvelines|Thoiry]] to [[Paris]]",
    '| style="text-align:center;" |{{convert|133|km|abbr=on}}',
    "| [[File:Plainstage.svg|link=|alt=|20x20px]]",
    "| Flat stage",
    "|",
    "|- class=sortbottom",
    '! colspan="3" |Total',
    '| style="text-align:center" |{{convert|3321|km|abbr=on}}',
    '| colspan="3" |',
    "|}",
  ].join("\n");

  const snapshot = extractStageRaceSnapshot(rawText);

  assert.equal(snapshot.totalStages, 21);
  assert.equal(snapshot.completedStages, 0);
  assert.equal(snapshot.latestStage, null);
  assert.equal(snapshot.generalClassification, null);
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

test("applyKnownStageRaceCorrections expands Giro d'Italia Women stage 2 fallback to top five", () => {
  const { applyKnownStageRaceCorrections } = loadParserExports();
  const corrected = JSON.parse(
    JSON.stringify(
      applyKnownStageRaceCorrections(
        { pageTitle: "2026 Giro d'Italia Women" },
        {
          totalStages: 9,
          completedStages: 2,
          latestStage: {
            number: 2,
            label: "Stage 2",
            standings: [{ place: "1", rider: "Elisa Balsamo" }],
            winner: "Elisa Balsamo",
          },
          generalClassification: {
            stageNumber: 2,
            standings: [{ place: "1", rider: "Elisa Balsamo" }],
            leader: "Elisa Balsamo",
          },
          overallResult: [],
        },
      ),
    ),
  );

  assert.deepEqual(corrected.latestStage.standings, [
    { place: "1", rider: "Elisa Balsamo", countryCode: "ITA" },
    { place: "2", rider: "Lara Gillespie" },
    { place: "3", rider: "Chiara Consonni", countryCode: "ITA" },
    { place: "4", rider: "Charlotte Kool" },
    { place: "5", rider: "Barbara Guarischi" },
  ]);
  assert.deepEqual(corrected.generalClassification.standings, [
    { place: "1", rider: "Elisa Balsamo", countryCode: "ITA" },
    { place: "2", rider: "Lara Gillespie", gap: "+0:08" },
    { place: "3", rider: "Chiara Consonni", countryCode: "ITA", gap: "+0:12" },
    { place: "4", rider: "Charlotte Kool", gap: "+0:20" },
    { place: "5", rider: "Linda Zanetti", gap: "+0:20" },
  ]);
});

test("buildLaVueltaFemeninaOfficialSnapshot parses the current official stage and GC standings", () => {
  const { buildLaVueltaFemeninaOfficialSnapshot } = loadParserExports();
  const rankingsPath = path.join(__dirname, "fixtures", "la-vuelta-femenina-rankings-stage4.html");
  const stagePath = path.join(__dirname, "fixtures", "la-vuelta-femenina-stage4.html");
  const gcPath = path.join(__dirname, "fixtures", "la-vuelta-femenina-gc-stage4.html");
  const rankingsHtml = fs.readFileSync(rankingsPath, "utf8");
  const stageHtml = fs.readFileSync(stagePath, "utf8");
  const gcHtml = fs.readFileSync(gcPath, "utf8");

  const snapshot = JSON.parse(
    JSON.stringify(
      buildLaVueltaFemeninaOfficialSnapshot(rankingsHtml, stageHtml, gcHtml, {
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

test("extractLaVueltaFemeninaGeneralAjaxUrl prefers the nested general-tab ajax URL", () => {
  const { extractLaVueltaFemeninaGeneralAjaxUrl } = loadParserExports();
  const html = `
    <button
      class="tabs__link js-tabs-ranking"
      data-ajax-stack="{&quot;itg&quot;:&quot;\\/en\\/ajax\\/ranking\\/7\\/itg\\/stage-table-hash\\/none&quot;}"
    ></button>
    <button
      class="tabs__link js-tabs-ranking-nested general"
      data-tabs-ajax="/en/ajax/ranking/7/itg/gc-table-hash/subtab"
      data-type="itg"
    ></button>
  `;

  assert.equal(
    extractLaVueltaFemeninaGeneralAjaxUrl(html),
    "https://www.lavueltafemenina.es/en/ajax/ranking/7/itg/gc-table-hash/subtab",
  );
});

test("extractLaVueltaFemeninaStageAjaxUrl extracts the stage-tab ajax URL", () => {
  const { extractLaVueltaFemeninaStageAjaxUrl } = loadParserExports();
  const html = `
    <button
      class="tabs__link js-tabs-ranking"
      data-ajax-stack="{&quot;ite&quot;:&quot;\\/en\\/ajax\\/ranking\\/7\\/ite\\/stage-table-hash\\/none&quot;,&quot;itg&quot;:&quot;\\/en\\/ajax\\/ranking\\/7\\/itg\\/gc-table-hash\\/none&quot;}"
    ></button>
  `;

  assert.equal(
    extractLaVueltaFemeninaStageAjaxUrl(html),
    "https://www.lavueltafemenina.es/en/ajax/ranking/7/ite/stage-table-hash/none",
  );
});

test("parseGiroDItaliaStageClassificationStandings parses the official Stage 1 top five", () => {
  const { parseGiroDItaliaStageClassificationStandings } = loadParserExports();
  const html = `
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="table type-1">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/fra.png"></div><div class="atleta-info"><div class="name p-3">Paul</div><div class="surname p-3 is-bold">MAGNIER</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/den.png"></div><div class="atleta-info"><div class="name p-3">Tobias Lund</div><div class="surname p-3 is-bold">ANDRESEN</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">3</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/gbr.png"></div><div class="atleta-info"><div class="name p-3">Ethan</div><div class="surname p-3 is-bold">VERNON</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">4</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Jonathan</div><div class="surname p-3 is-bold">MILAN</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">5</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/est.png"></div><div class="atleta-info"><div class="name p-3">Madis</div><div class="surname p-3 is-bold">MIHKELS</div></div></div>
        </div>
      </div>
    </div>
  `;

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaStageClassificationStandings(html)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Paul Magnier", countryCode: "FRA" },
    { place: "2", rider: "Tobias Lund Andresen", countryCode: "DEN" },
    { place: "3", rider: "Ethan Vernon", countryCode: "GBR" },
    { place: "4", rider: "Jonathan Milan", countryCode: "ITA" },
    { place: "5", rider: "Madis Mihkels", countryCode: "EST" },
  ]);
});

test("parseGiroDItaliaStageClassificationStandings accepts the current type-4 stage rankings table", () => {
  const { parseGiroDItaliaStageClassificationStandings } = loadParserExports();
  const html = `
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/fra.png"></div><div class="atleta-info"><div class="name p-3">Paul</div><div class="surname p-3 is-bold">MAGNIER</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Jonathan</div><div class="surname p-3 is-bold">MILAN</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">3</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Dylan</div><div class="surname p-3 is-bold">GROENEWEGEN</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">4</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/est.png"></div><div class="atleta-info"><div class="name p-3">Madis</div><div class="surname p-3 is-bold">MIHKELS</div></div></div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">5</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Matteo</div><div class="surname p-3 is-bold">MALUCELLI</div></div></div>
        </div>
      </div>
    </div>
  `;

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaStageClassificationStandings(html)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Paul Magnier", countryCode: "FRA" },
    { place: "2", rider: "Jonathan Milan", countryCode: "ITA" },
    { place: "3", rider: "Dylan Groenewegen", countryCode: "NED" },
    { place: "4", rider: "Madis Mihkels", countryCode: "EST" },
    { place: "5", rider: "Matteo Malucelli", countryCode: "ITA" },
  ]);
});

test("buildRaceArticleQueries adds stage-specific Giro coverage searches", () => {
  const { buildRaceArticleQueries, scoreRaceArticle, selectRaceArticles } = loadParserExports();
  const race = {
    title: "Giro d'Italia",
    pageTitle: "2026 Giro d'Italia",
    endDate: new Date("2026-06-01T00:00:00Z"),
    startDate: new Date("2026-05-09T00:00:00Z"),
    stageRace: {
      totalStages: 21,
      completedStages: 10,
      latestStage: {
        number: 10,
        winner: "Filippo Ganna",
      },
    },
  };

  const queries = JSON.parse(JSON.stringify(buildRaceArticleQueries(race)));

  assert.ok(queries.includes(`"Giro d'Italia" 2026 stage 10 results`));
  assert.ok(queries.includes(`"Giro d'Italia" "Filippo Ganna" stage 10`));

  const genericScore = scoreRaceArticle(
    {
      title: "Giro d'Italia preview and standings update",
      description: "",
      publisher: "Cycling Weekly",
      publishedAt: new Date().toISOString(),
    },
    race,
  );
  const stageScore = scoreRaceArticle(
    {
      title: "Filippo Ganna wins Giro d'Italia stage 10 in dramatic finish",
      description: "",
      publisher: "Cycling Weekly",
      publishedAt: new Date().toISOString(),
    },
    race,
  );

  assert.ok(stageScore > genericScore);

  const selectedArticles = selectRaceArticles(
    [
      {
        title: "Filippo Ganna wins Giro d'Italia stage 10 in dramatic finish",
        description: "",
        publisher: "Cycling Weekly",
        url: "https://example.com/stage-a",
        score: 300,
      },
      {
        title: "Giro d'Italia stage 10 results and highlights",
        description: "",
        publisher: "Cyclingnews",
        url: "https://example.com/stage-b",
        score: 290,
      },
      {
        title: "Afonso Eulalio keeps Giro d'Italia lead after tough day",
        description: "General classification story",
        publisher: "Reuters",
        url: "https://example.com/general-a",
        score: 280,
      },
      {
        title: "What stage 10 means for the Giro d'Italia overall battle",
        description: "",
        publisher: "Velo",
        url: "https://example.com/general-b",
        score: 270,
      },
      {
        title: "Giro d'Italia transfer news and team notes",
        description: "",
        publisher: "Road.cc",
        url: "https://example.com/general-c",
        score: 260,
      },
    ],
    0,
    race,
  );

  assert.ok(selectedArticles.some((article) => article.url === "https://example.com/stage-a"));
  assert.ok(selectedArticles.some((article) => article.url === "https://example.com/general-a"));
});

test("selectRaceArticles shows the most recent day first, best article within a day", () => {
  const { selectRaceArticles } = loadParserExports();
  const order = selectRaceArticles(
    [
      { title: "Older but high-scored tactics piece", url: "u/b", publishedAt: "2026-05-20T10:00:00Z", score: 300 },
      { title: "Result A same day high score", url: "u/a", publishedAt: "2026-05-31T09:00:00Z", score: 250 },
      { title: "Result C same day low score", url: "u/c", publishedAt: "2026-05-31T20:00:00Z", score: 200 },
      { title: "Most recent day", url: "u/d", publishedAt: "2026-06-02T08:00:00Z", score: 150 },
    ],
    0,
    { pageTitle: "2026 Giro d'Italia", title: "Giro d'Italia" },
  ).map((article) => article.url);

  // Most recent day leads; within 05-31 the higher score wins; the older (higher
  // scored) tactics article sinks to the bottom.
  assert.deepEqual([...order], ["u/d", "u/a", "u/c", "u/b"]);
});

test("isCurrentEditionRaceArticle trusts an in-window publish date over past-year mentions", () => {
  const { isCurrentEditionRaceArticle } = loadParserExports();
  const race = {
    pageTitle: "2026 Paris–Roubaix",
    title: "Paris–Roubaix",
    startDate: new Date("2026-04-12T00:00:00Z"),
    endDate: new Date("2026-04-12T00:00:00Z"),
  };
  // Result article published on race day, referencing past attempts (2019/2022) but
  // not "2026" — must still be accepted because its date is in this edition's window.
  assert.equal(
    isCurrentEditionRaceArticle(
      {
        title: "Wout van Aert finally wins Paris–Roubaix after years of chasing since 2019",
        description: "His 2022 runner-up finish is behind him.",
        publishedAt: "2026-04-12T16:30:00Z",
      },
      race,
    ),
    true,
  );
  // An article published months after the window is rejected.
  assert.equal(
    isCurrentEditionRaceArticle(
      { title: "Van Aert's Paris-Roubaix celebrations", description: "", publishedAt: "2026-06-08T00:00:00Z" },
      race,
    ),
    false,
  );
});

test("scoreRaceArticle sinks stale previews below result coverage once a race is over", () => {
  const { scoreRaceArticle } = loadParserExports();
  const race = {
    pageTitle: "2026 Copenhagen Sprint",
    title: "Copenhagen Sprint",
    startDate: new Date("2026-06-14T00:00:00Z"),
    endDate: new Date("2026-06-14T00:00:00Z"),
    winner: "Jasper Philipsen",
  };
  const result = scoreRaceArticle(
    { title: "Jasper Philipsen wins Copenhagen Sprint", description: "", publisher: "Cyclingnews", publishedAt: "2026-06-14T16:00:00Z" },
    race,
  );
  const preview = scoreRaceArticle(
    { title: "Copenhagen Sprint contenders preview: Wiebes and Meeus", description: "", publisher: "Cyclingnews", publishedAt: "2026-06-11T08:00:00Z" },
    race,
  );
  assert.ok(result > preview, `expected result (${result}) to outrank stale preview (${preview})`);
});

test("buildRaceArticleQueries adds result and winner searches for a race with a known winner", () => {
  const { buildRaceArticleQueries } = loadParserExports();
  const queries = JSON.parse(
    JSON.stringify(
      buildRaceArticleQueries({
        pageTitle: "2026 Paris–Roubaix",
        title: "Paris–Roubaix",
        startDate: new Date("2026-04-12T00:00:00Z"),
        endDate: new Date("2026-04-12T00:00:00Z"),
        winner: "Wout van Aert",
      }),
    ),
  );
  assert.ok(queries.some((query) => /results report/.test(query)));
  assert.ok(queries.some((query) => query.includes("Wout van Aert")));
});

test("parseGiroDItaliaLivefeedStageStandings parses the official Stage 2 top five", () => {
  const { parseGiroDItaliaLivefeedStageStandings } = loadParserExports();
  const json = JSON.stringify({
    cronaca_sintesi: {
      entries: [
        {
          titolo: "Here's today's Top 10",
          abstract:
            "1. Guillermo Thomas Silva (XDS Astana) 5h39’25”<br />\n" +
            "2. Florian Stork (Tudor) s.t.<br />\n" +
            "3. Giulio Ciccone (Lidl-Trek) s.t.<br />\n" +
            "4. Christian Scaroni (XDS Astana) s.t.<br />\n" +
            "5. Giulio Pellizzari (Red Bull-BORA-hansgrohe) s.t.\n",
        },
      ],
    },
  });

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaLivefeedStageStandings(json)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Guillermo Thomas Silva" },
    { place: "2", rider: "Florian Stork" },
    { place: "3", rider: "Giulio Ciccone" },
    { place: "4", rider: "Christian Scaroni" },
    { place: "5", rider: "Giulio Pellizzari", countryCode: "ITA" },
  ]);
});

test("parseGiroDItaliaLivefeedStageStandings accepts alternate finished-stage result titles", () => {
  const { parseGiroDItaliaLivefeedStageStandings } = loadParserExports();
  const json = JSON.stringify({
    cronaca_sintesi: {
      entries: [
        {
          titolo: "No changes in the general classification",
          abstract: "Jonas Vingegaard remains in pink.",
        },
        {
          titolo: "Order of arrival",
          abstract:
            "1. Sepp Kuss (Team Visma | Lease a Bike) 4h28’12”<br />\n" +
            "2. Derek Gee (Lidl-Trek) +29”<br />\n" +
            "3. Afonso Eulalio (Bahrain Victorious) +1:00<br />\n" +
            "4. Felix Gall (Decathlon CMA CGM Team) +1:00<br />\n" +
            "5. Jai Hindley (Red Bull-BORA-hansgrohe) +1:00\n",
        },
      ],
    },
  });

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaLivefeedStageStandings(json)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Sepp Kuss" },
    { place: "2", rider: "Derek Gee" },
    { place: "3", rider: "Afonso Eulalio" },
    { place: "4", rider: "Felix Gall", countryCode: "AUT" },
    { place: "5", rider: "Jai Hindley" },
  ]);
});

test("extractGiroDItaliaFinishVideoUrl finds the official post-stage Last Km clip", () => {
  const { extractGiroDItaliaFinishVideoUrl } = loadParserExports();
  const json = JSON.stringify({
    cronaca_sintesi: {
      entries: [
        {
          categoria: "VIDEO",
          titolo: "A relentless up-and-down stage today, with Montagna Grande di Viggiano as the final judge (Video)",
          url_media: "https://video.giroditalia.it/video/127057425",
        },
        {
          categoria: "VIDEO",
          titolo: "Let's enjoy the Last Km of this jaw-dropping Stage again (Video)",
          url_media: "https://video.giroditalia.it/video/127169105",
        },
      ],
    },
  });

  assert.equal(
    extractGiroDItaliaFinishVideoUrl(json),
    "https://video.giroditalia.it/video/127169105",
  );
});

test("parseGiroDItaliaGeneralClassificationStandings parses the official Maglia Rosa top five", () => {
  const { parseGiroDItaliaGeneralClassificationStandings } = loadParserExports();
  const html = `
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-1">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/fra.png"></div><div class="atleta-info"><div class="name p-3">Paul</div><div class="surname p-3 is-bold">MAGNIER</div></div></div>
          <div class="team p-3">SOUDAL QUICK-STEP</div>
          <div class="tempo p-3 is-text-right">3:20:58</div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/den.png"></div><div class="atleta-info"><div class="name p-3">Tobias Lund</div><div class="surname p-3 is-bold">ANDRESEN</div></div></div>
          <div class="team p-3">DECATHLON CMA CGM TEAM</div>
          <div class="tempo p-3 is-text-right">3:21:02</div>
          <div class="distacco p-3 is-text-right">0:04</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">3</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Manuele</div><div class="surname p-3 is-bold">TAROZZI</div></div></div>
          <div class="team p-3">BARDIANI CSF 7 SABER</div>
          <div class="tempo p-3 is-text-right">3:21:02</div>
          <div class="distacco p-3 is-text-right">0:04</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">4</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/gbr.png"></div><div class="atleta-info"><div class="name p-3">Ethan</div><div class="surname p-3 is-bold">VERNON</div></div></div>
          <div class="team p-3">NSN CYCLING TEAM</div>
          <div class="tempo p-3 is-text-right">3:21:04</div>
          <div class="distacco p-3 is-text-right">0:06</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">5</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/esp.png"></div><div class="atleta-info"><div class="name p-3">Diego Pablo</div><div class="surname p-3 is-bold">SEVILLA</div></div></div>
          <div class="team p-3">TEAM POLTI VISITMALTA</div>
          <div class="tempo p-3 is-text-right">3:21:04</div>
          <div class="distacco p-3 is-text-right">0:06</div>
        </div>
      </div>
    </div>
  `;

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaGeneralClassificationStandings(html)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Paul Magnier", countryCode: "FRA", time: "3:20:58" },
    { place: "2", rider: "Tobias Lund Andresen", countryCode: "DEN", gap: "+0:04", time: "3:21:02" },
    { place: "3", rider: "Manuele Tarozzi", countryCode: "ITA", gap: "+0:04", time: "3:21:02" },
    { place: "4", rider: "Ethan Vernon", countryCode: "GBR", gap: "+0:06", time: "3:21:04" },
    { place: "5", rider: "Diego Pablo Sevilla", countryCode: "ESP", gap: "+0:06", time: "3:21:04" },
  ]);
});

test("parseGiroDItaliaGeneralClassificationStandings accepts mixed position classes", () => {
  const { parseGiroDItaliaGeneralClassificationStandings } = loadParserExports();
  const html = `
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/den.png"></div><div class="atleta-info"><div class="name p-3">Jonas</div><div class="surname p-3 is-bold">VINGEGAARD</div></div></div>
          <div class="tempo p-3 is-text-right">59:12:56</div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/por.png"></div><div class="atleta-info"><div class="name p-3">Afonso</div><div class="surname p-3 is-bold">EULALIO</div></div></div>
          <div class="tempo p-3 is-text-right">59:15:22</div>
          <div class="distacco p-3 is-text-right">2:26</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-dark">3</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/aut.png"></div><div class="atleta-info"><div class="name p-3">Felix</div><div class="surname p-3 is-bold">GALL</div></div></div>
          <div class="tempo p-3 is-text-right">59:15:46</div>
          <div class="distacco p-3 is-text-right">2:50</div>
        </div>
      </div>
    </div>
  `;

  const standings = JSON.parse(JSON.stringify(parseGiroDItaliaGeneralClassificationStandings(html)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Jonas Vingegaard", countryCode: "DEN", time: "59:12:56" },
    { place: "2", rider: "Afonso Eulalio", countryCode: "POR", gap: "+2:26", time: "59:15:22" },
    { place: "3", rider: "Felix Gall", countryCode: "AUT", gap: "+2:50", time: "59:15:46" },
  ]);
});

test("fetchGiroDItaliaWomenOfficialSnapshot parses the current official rankings and stage standings", async () => {
  const {
    fetchGiroDItaliaWomenOfficialSnapshot,
    extractGiroDItaliaWomenLatestCompletedStageNumber,
  } = loadParserExports();
  const rankingsHtml = `
    <a class="single-tab-controller label-4 is-uppercase" href="https://www.giroditaliawomen.it/en/rankings/di-tappa/4" data-tab="classifiche-di-tappa">stage</a>
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-1">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">2</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/sui.png"></div><div class="atleta-info"><div class="name p-3">Marlen</div><div class="surname p-3 is-bold">REUSSER</div></div></div>
          <div class="distacco p-3 is-text-right">01:04</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">3</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Demi</div><div class="surname p-3 is-bold">VOLLERING</div></div></div>
          <div class="distacco p-3 is-text-right">01:10</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">4</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ger.png"></div><div class="atleta-info"><div class="name p-3">Antonia</div><div class="surname p-3 is-bold">NIEDERMAIER</div></div></div>
          <div class="distacco p-3 is-text-right">01:26</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">5</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Monica</div><div class="surname p-3 is-bold">TRINCA COLONEL</div></div></div>
          <div class="distacco p-3 is-text-right">01:31</div>
        </div>
      </div>
    </div>
  `;
  const stageHtml = `
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">2</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/sui.png"></div><div class="atleta-info"><div class="name p-3">Marlen</div><div class="surname p-3 is-bold">REUSSER</div></div></div>
          <div class="distacco p-3 is-text-right">01:04</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">3</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Demi</div><div class="surname p-3 is-bold">VOLLERING</div></div></div>
          <div class="distacco p-3 is-text-right">01:10</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">4</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ger.png"></div><div class="atleta-info"><div class="name p-3">Antonia</div><div class="surname p-3 is-bold">NIEDERMAIER</div></div></div>
          <div class="distacco p-3 is-text-right">01:26</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">5</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Monica</div><div class="surname p-3 is-bold">TRINCA COLONEL</div></div></div>
          <div class="distacco p-3 is-text-right">01:31</div>
        </div>
      </div>
    </div>
  `;

  assert.equal(extractGiroDItaliaWomenLatestCompletedStageNumber(rankingsHtml), 4);

  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchGiroDItaliaWomenOfficialSnapshot(
        {
          pageTitle: "2026 Giro d'Italia Women",
          startDate: new Date("2026-06-18T00:00:00Z"),
          endDate: new Date("2026-06-26T00:00:00Z"),
        },
        async (url) => (url.includes("/di-tappa/") ? stageHtml : rankingsHtml),
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 4);
  assert.deepEqual(snapshot.latestStage, {
    number: 4,
    label: "Stage 4",
    standings: [
      { place: "1", rider: "Anna Van Der Breggen", countryCode: "NED" },
      { place: "2", rider: "Marlen Reusser", countryCode: "SUI", gap: "+01:04" },
      { place: "3", rider: "Demi Vollering", countryCode: "NED", gap: "+01:10" },
      { place: "4", rider: "Antonia Niedermaier", countryCode: "GER", gap: "+01:26" },
      { place: "5", rider: "Monica Trinca Colonel", countryCode: "ITA", gap: "+01:31" },
    ],
    finishVideoUrl: "",
    winner: "Anna Van Der Breggen",
    winnerCountryCode: "NED",
  });
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 4,
    standings: [
      { place: "1", rider: "Anna Van Der Breggen", countryCode: "NED" },
      { place: "2", rider: "Marlen Reusser", countryCode: "SUI", gap: "+01:04" },
      { place: "3", rider: "Demi Vollering", countryCode: "NED", gap: "+01:10" },
      { place: "4", rider: "Antonia Niedermaier", countryCode: "GER", gap: "+01:26" },
      { place: "5", rider: "Monica Trinca Colonel", countryCode: "ITA", gap: "+01:31" },
    ],
    leader: "Anna Van Der Breggen",
    leaderCountryCode: "NED",
  });
});

test("fetchGiroDItaliaWomenOfficialSnapshot prefers the current stage Last KM video", async () => {
  const { fetchGiroDItaliaWomenOfficialSnapshot } = loadParserExports();
  const rankingsHtml = `
    <a class="single-tab-controller label-4 is-uppercase" href="https://www.giroditaliawomen.it/en/rankings/di-tappa/4" data-tab="classifiche-di-tappa">stage</a>
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-1">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
      </div>
    </div>
  `;
  const stageHtml = `
    <div class="label-3">Stage <span class="label-3 js-n-stage">4</span></div>
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
      </div>
    </div>
  `;
  const videoHubHtml = `
    <div class="single-slide">
      <div class="videoHighlights__item">
        <div class="videoHighlights__btn btnVideo js-btn-modal-media" data-media="https://video.giroditaliawomen.it/video/127978989"></div>
        <span class="videoHighlights__info is-pink outline-pink">Stage 4</span>
        <div class="videoHighlights__bottom">
          <p class="videoHighlights__txt">Giro d'Italia Women 2026 | Stage 4 | Highlights</p>
        </div>
      </div>
    </div>
    <div class="single-slide sliderType__slide">
      <div class="sliderType__item">
        <div class="sliderType__btn btnVideo js-btn-modal-media" data-media="https://video.giroditaliawomen.it/video/127976169"></div>
        <span class="sliderType__info is-pink outline-pink">Stage 4</span>
        <div class="sliderType__bottom">
          <p class="sliderType__txt">Giro d'Italia Women 2026 | Stage 4 | Last KM</p>
        </div>
      </div>
    </div>
  `;

  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchGiroDItaliaWomenOfficialSnapshot(
        {
          pageTitle: "2026 Giro d'Italia Women",
          startDate: new Date("2026-05-27T00:00:00Z"),
          endDate: new Date("2026-06-04T00:00:00Z"),
        },
        async (url) => {
          if (url.includes("/en/video/")) {
            return videoHubHtml;
          }

          return url.includes("/di-tappa/") ? stageHtml : rankingsHtml;
        },
      ),
    ),
  );

  assert.equal(snapshot.latestStage.finishVideoUrl, "https://video.giroditaliawomen.it/video/127976169");
});

test("fetchGiroDItaliaWomenOfficialSnapshot ignores stale stage-page content served under a newer stage URL", async () => {
  const {
    fetchGiroDItaliaWomenOfficialSnapshot,
    extractGiroDItaliaWomenEmbeddedStageNumber,
  } = loadParserExports();
  const rankingsHtml = `
    <a class="single-tab-controller label-4 is-uppercase" href="https://www.giroditaliawomen.it/en/rankings/di-tappa/5" data-tab="classifiche-di-tappa">stage</a>
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-1">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">2</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/sui.png"></div><div class="atleta-info"><div class="name p-3">Marlen</div><div class="surname p-3 is-bold">REUSSER</div></div></div>
          <div class="distacco p-3 is-text-right">01:04</div>
        </div>
      </div>
    </div>
  `;
  const staleStageHtml = `
    <div class="label-3">Stage <span class="label-3 js-n-stage">4</span></div>
    <h4 class="is-pink is-uppercase mb-2 js-nometappa">Belluno - Nevegal Tudor ITT</h4>
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="title-leaderboard"><h4 class="is-uppercase mb-0"><span class="is-pink">Stage&nbsp;4</span> Order <br/> of Arrival</h4></div>
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">1</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Anna</div><div class="surname p-3 is-bold">VAN DER BREGGEN</div></div></div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><div class="position is-pink">2</div><div class="flag"><img src="https://components2.rcsobjects.it/rcs_sport_classiche2021-layout/v0/assets/img/ext/athletes-flags/sui.png"></div><div class="atleta-info"><div class="name p-3">Marlen</div><div class="surname p-3 is-bold">REUSSER</div></div></div>
          <div class="distacco p-3 is-text-right">01:04</div>
        </div>
      </div>
    </div>
  `;

  assert.equal(extractGiroDItaliaWomenEmbeddedStageNumber(staleStageHtml), 4);

  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchGiroDItaliaWomenOfficialSnapshot(
        {
          pageTitle: "2026 Giro d'Italia Women",
          startDate: new Date("2026-06-18T00:00:00Z"),
          endDate: new Date("2026-06-26T00:00:00Z"),
        },
        async (url) => (url.includes("/di-tappa/") ? staleStageHtml : rankingsHtml),
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 5);
  assert.equal(snapshot.latestStage, null);
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 5,
    standings: [
      { place: "1", rider: "Anna Van Der Breggen", countryCode: "NED" },
      { place: "2", rider: "Marlen Reusser", countryCode: "SUI", gap: "+01:04" },
    ],
    leader: "Anna Van Der Breggen",
    leaderCountryCode: "NED",
  });
});

test("fetchGiroDItaliaWomenOfficialSnapshot still uses the official source after the race end date", async () => {
  const { fetchGiroDItaliaWomenOfficialSnapshot } = loadParserExports();
  const rankingsHtml = `
    <a class="single-tab-controller label-4 is-uppercase" href="https://www.giroditaliawomen.it/en/rankings/di-tappa/9" data-tab="classifiche-di-tappa">stage</a>
    <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Demi</div><div class="surname p-3 is-bold">VOLLERING</div></div></div>
          <div class="tempo p-3 is-text-right">24:18:11</div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ger.png"></div><div class="atleta-info"><div class="name p-3">Antonia</div><div class="surname p-3 is-bold">NIEDERMAIER</div></div></div>
          <div class="tempo p-3 is-text-right">24:18:49</div>
          <div class="distacco p-3 is-text-right">0:38</div>
        </div>
      </div>
    </div>
  `;
  const stageHtml = `
    <div class="label-3">Stage <span class="label-3 js-n-stage">9</span></div>
    <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
      <div class="table type-4">
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Elisa</div><div class="surname p-3 is-bold">LONGO BORGHINI</div></div></div>
          <div class="tempo p-3 is-text-right">3:47:12</div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
        <div class="line-table">
          <div class="corridore p-3"><h5 class="position is-pink">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ned.png"></div><div class="atleta-info"><div class="name p-3">Demi</div><div class="surname p-3 is-bold">VOLLERING</div></div></div>
          <div class="tempo p-3 is-text-right">3:47:12</div>
          <div class="distacco p-3 is-text-right">0:00</div>
        </div>
      </div>
    </div>
  `;
  const videoHubHtml = `
    <div class="single-slide sliderType__slide">
      <div class="sliderType__item">
        <div class="sliderType__btn btnVideo js-btn-modal-media" data-media="https://video.giroditaliawomen.it/video/128999999"></div>
        <span class="sliderType__info is-pink outline-pink">Stage 9</span>
        <div class="sliderType__bottom">
          <p class="sliderType__txt">Giro d'Italia Women 2026 | Stage 9 | Last KM</p>
        </div>
      </div>
    </div>
  `;

  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchGiroDItaliaWomenOfficialSnapshot(
        {
          pageTitle: "2026 Giro d'Italia Women",
          startDate: new Date("2026-05-30T00:00:00Z"),
          endDate: new Date("2026-06-07T00:00:00Z"),
        },
        async (url) => {
          if (url.includes("/en/video/")) {
            return videoHubHtml;
          }

          return url.includes("/di-tappa/") ? stageHtml : rankingsHtml;
        },
        new Date("2026-06-08T12:00:00Z"),
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 9);
  assert.equal(snapshot.latestStage.number, 9);
  assert.equal(snapshot.latestStage.finishVideoUrl, "https://video.giroditaliawomen.it/video/128999999");
  assert.deepEqual(snapshot.latestStage.standings, [
    { place: "1", rider: "Elisa Longo Borghini", countryCode: "ITA", time: "3:47:12" },
    { place: "2", rider: "Demi Vollering", countryCode: "NED", time: "3:47:12" },
  ]);
  assert.deepEqual(snapshot.generalClassification.standings, [
    { place: "1", rider: "Demi Vollering", countryCode: "NED", time: "24:18:11" },
    { place: "2", rider: "Antonia Niedermaier", countryCode: "GER", gap: "+0:38", time: "24:18:49" },
  ]);
});

test("fetchTourAuvergneRhoneAlpesOfficialSnapshot keeps GC during a team time trial stage without individual stage standings", async () => {
  const { fetchTourAuvergneRhoneAlpesOfficialSnapshot } = loadParserExports();
  const rankingsHtml = `
    <title>Official classifications of Tour Auvergne-Rhône-Alpes - Stage 3</title>
    <span class="stage-select__option__stage">Stage 1</span>
    <span class="stage-select__option__stage">Stage 2</span>
    <span class="stage-select__option__stage">Stage 3</span>
    <button data-ajax-stack = {&quot;itg&quot;:&quot;\\/en\\/ajax\\/ranking\\/3\\/itg\\/hash-gc\\/none&quot;}></button>
    <button data-ajax-stack = {&quot;ite&quot;:&quot;\\/en\\/ajax\\/ranking\\/3\\/ite\\/hash-stage\\/none&quot;}></button>
    <button data-ajax-stack = {&quot;ete&quot;:&quot;\\/en\\/ajax\\/ranking\\/3\\/ete\\/hash-team-stage\\/none&quot;}></button>
  `;
  const generalHtml = `
    <table class="rankingTable">
      <tbody>
        <tr>
          <td class="is-alignCenter">1</td>
          <td class="runner is-sticky"><span class="flag js-display-lazy" data-class="flag--fra"></span><a href="/en/rider/72">ALEX BAUDIN</a></td>
          <td class="is-alignCenter">72</td>
          <td class="break-line team"><a href="/en/team/EFE">EF EDUCATION - EASYPOST</a></td>
          <td class="is-alignCenter time">10h 01' 01''</td>
          <td class="is-alignCenter time">-</td>
        </tr>
        <tr>
          <td class="is-alignCenter">2</td>
          <td class="runner is-sticky"><span class="flag js-display-lazy" data-class="flag--fra"></span><a href="/en/rider/36">KÉVIN VAUQUELIN</a></td>
          <td class="is-alignCenter">36</td>
          <td class="break-line team"><a href="/en/team/NCI">NETCOMPANY INEOS CYCLING TEAM</a></td>
          <td class="is-alignCenter time">10h 01' 13''</td>
          <td class="is-alignCenter time">+ 00h 00' 12''</td>
        </tr>
        <tr>
          <td class="is-alignCenter">3</td>
          <td class="runner is-sticky"><span class="flag js-display-lazy" data-class="flag--gbr"></span><a href="/en/rider/31">OSCAR ONLEY</a></td>
          <td class="is-alignCenter">31</td>
          <td class="break-line team"><a href="/en/team/NCI">NETCOMPANY INEOS CYCLING TEAM</a></td>
          <td class="is-alignCenter time">10h 01' 13''</td>
          <td class="is-alignCenter time">+ 00h 00' 12''</td>
        </tr>
      </tbody>
    </table>
  `;
  const stageHtml = `<p class="noRanking la">No edition of individual classification during a Team Time Trial</p>`;
  const teamStageHtml = `
    <table class="rankingTable">
      <tbody>
        <tr>
          <td class="is-alignCenter">1</td>
          <td class="break-line is-sticky team"><a href="/en/team/TVL">TEAM VISMA | LEASE A BIKE</a></td>
          <td class="is-alignCenter time">00h 32' 52''</td>
          <td class="is-alignCenter time">-</td>
        </tr>
        <tr>
          <td class="is-alignCenter">2</td>
          <td class="break-line is-sticky team"><a href="/en/team/NCI">NETCOMPANY INEOS CYCLING TEAM</a></td>
          <td class="is-alignCenter time">00h 33' 01''</td>
          <td class="is-alignCenter time">+ 00h 00' 09''</td>
        </tr>
        <tr>
          <td class="is-alignCenter">3</td>
          <td class="break-line is-sticky team"><a href="/en/team/EFE">EF EDUCATION - EASYPOST</a></td>
          <td class="is-alignCenter time">00h 33' 21''</td>
          <td class="is-alignCenter time">+ 00h 00' 29''</td>
        </tr>
      </tbody>
    </table>
  `;

  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchTourAuvergneRhoneAlpesOfficialSnapshot(
        {
          pageTitle: "2026 Tour Auvergne-Rhône-Alpes",
          startDate: new Date("2026-06-07T00:00:00Z"),
          endDate: new Date("2026-06-14T00:00:00Z"),
        },
        async (url) => {
          if (url.includes("/itg/")) {
            return generalHtml;
          }

          if (url.includes("/ite/")) {
            return stageHtml;
          }

          if (url.includes("/ete/")) {
            return teamStageHtml;
          }

          return rankingsHtml;
        },
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 3);
  assert.deepEqual(snapshot.latestStage, {
    number: 3,
    label: "Stage 3",
    standings: [
      { place: "1", rider: "Team Visma | Lease A Bike", time: "32:52" },
      { place: "2", rider: "Netcompany Ineos Cycling Team", gap: "+00:09", time: "33:01" },
      { place: "3", rider: "Ef Education - Easypost", gap: "+00:29", time: "33:21" },
    ],
    winner: "Team Visma | Lease A Bike",
  });
  assert.deepEqual(snapshot.generalClassification.standings, [
    { place: "1", rider: "Alex Baudin", countryCode: "FRA", time: "10:01:01" },
    { place: "2", rider: "Kévin Vauquelin", countryCode: "FRA", gap: "+00:12", time: "10:01:13" },
    { place: "3", rider: "Oscar Onley", countryCode: "GBR", gap: "+00:12", time: "10:01:13" },
  ]);
});

test("parseLetourOfficialStandings reads the full Tour de France top five with names from rider links", () => {
  const { parseLetourOfficialStandings } = loadParserExports();
  const stageHtml = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-stage21-ite.html"),
    "utf8",
  );

  const standings = parseLetourOfficialStandings(stageHtml);

  assert.equal(standings.length, 5);
  assert.deepEqual(
    [...standings].map((entry) => `${entry.place}:${entry.rider}`),
    ["1:Wout Van Aert", "2:Davide Ballerini", "3:Matej Mohoric", "4:Tadej Pogacar", "5:Matteo Jorgenson"],
  );
  // Country and stage time are carried through for the winner.
  assert.equal(standings[0].countryCode, "BEL");
  assert.equal(standings[0].time, "3:07:30");
});

const LETOUR_TEAM_TTT_HTML = `
  <table class="rankingTable  rankingTables--with-pict  rtable js-extend-target">
    <tbody>
      <tr class="rankingTables__row rankingTables__row--emphase has-shadowsep">
        <td class="rankingTables__row__position is-alignCenter"><span>1</span></td>
        <td class="rankingTables__row__profile break-line team">
          <a href="/en/team/TVL/team-visma-lease-a-bike" data-xtclick="rankingTable::ETE">TEAM VISMA | LEASE A BIKE</a>
        </td>
        <td class="is-alignCenter time">00h 21&#039; 47&#039;&#039;</td>
        <td class="is-alignCenter time"> - </td>
        <td class="is-alignCenter time">-</td>
      </tr>
      <tr class="rankingTables__row rankingTables__row--second has-shadowsep">
        <td class="rankingTables__row__position is-alignCenter"><span>2</span></td>
        <td class="rankingTables__row__profile break-line team">
          <a href="/en/team/IGD/netcompany-ineos" data-xtclick="rankingTable::ETE">NETCOMPANY INEOS CYCLING TEAM</a>
        </td>
        <td class="is-alignCenter time">00h 21&#039; 55&#039;&#039;</td>
        <td class="is-alignCenter time">+ 0h 00&#039; 08&#039;&#039;</td>
        <td class="is-alignCenter time">-</td>
      </tr>
    </tbody>
  </table>`;

test("parseLetourOfficialStandings reads team rows for a team time trial classification", () => {
  const { parseLetourOfficialStandings } = loadParserExports();
  const standings = parseLetourOfficialStandings(LETOUR_TEAM_TTT_HTML);

  assert.equal(standings.length, 2);
  assert.equal(standings[0].rider, "Team Visma | Lease A Bike");
  assert.equal(standings[0].time, "21:47");
  assert.equal(standings[1].rider, "Netcompany Ineos Cycling Team");
  assert.equal(standings[1].gap, "+00:08");
});

test("resolveLetourStageStandings falls back to team standings when there is no individual stage", () => {
  const { resolveLetourStageStandings } = loadParserExports();
  // Stage 1 of the 2026 Tour is a team time trial: letour.fr exposes no "ite" tab,
  // so the individual stage HTML is empty and the team classification is the result.
  const standings = resolveLetourStageStandings("", LETOUR_TEAM_TTT_HTML);

  assert.equal(standings.length, 2);
  assert.equal(standings[0].rider, "Team Visma | Lease A Bike");
});

test("extractTourDeFranceOfficialStageInfo uses the stage menu, not rest-day calendar inference", () => {
  const { extractTourDeFranceOfficialStageInfo } = loadParserExports();
  const rankingsHtml = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-rankings-stage21.html"),
    "utf8",
  );

  const info = extractTourDeFranceOfficialStageInfo(rankingsHtml, {
    startDate: new Date("2026-07-04T00:00:00Z"),
    endDate: new Date("2026-07-26T00:00:00Z"),
  });

  assert.equal(info.stageNumber, 21);
  assert.equal(info.totalStages, 21);
});

test("buildTourDeFranceOfficialSnapshot builds a full stage + GC snapshot from letour.fr", () => {
  const { buildTourDeFranceOfficialSnapshot } = loadParserExports();
  const rankingsHtml = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-rankings-stage21.html"),
    "utf8",
  );
  const stageHtml = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-stage21-ite.html"),
    "utf8",
  );

  const snapshot = JSON.parse(
    JSON.stringify(
      buildTourDeFranceOfficialSnapshot(rankingsHtml, stageHtml, "", rankingsHtml, {
        pageTitle: "2026 Tour de France",
        startDate: new Date("2026-07-04T00:00:00Z"),
        endDate: new Date("2026-07-26T00:00:00Z"),
      }),
    ),
  );

  assert.equal(snapshot.totalStages, 21);
  assert.equal(snapshot.completedStages, 21);
  assert.equal(snapshot.latestStage.winner, "Wout Van Aert");
  assert.equal(snapshot.latestStage.standings.length, 5);
  assert.equal(snapshot.generalClassification.leader, "Tadej Pogacar");
  assert.equal(snapshot.generalClassification.standings.length, 5);
});

const LETOUR_STAGE4_STAGE_TABLE_HTML = `
  <table class="rankingTable rankingTables--with-pict rtable">
    <tbody>
      <tr class="rankingTables__row rankingTables__row--emphase has-shadowsep">
        <td class="rankingTables__row__position is-alignCenter"><span>1</span></td>
        <td class="rankingTables__row__profile runner">
          <span data-bib="#33" class="flag flag--with-bib js-display-lazy" data-class="flag--den"></span>
          <a class="rankingTables__row__profile--name" href="/en/rider/33/lidl-trek/mads-pedersen"
             data-xtclick="rankingTable::ITE" data-clicktype="N">M. PEDERSEN</a>
        </td>
        <td class="is-alignCenter time">04h 10&#039; 45&#039;&#039;</td>
        <td class="is-alignCenter time">-</td>
      </tr>
      <tr class="rankingTables__row rankingTables__row--second has-shadowsep">
        <td class="rankingTables__row__position is-alignCenter"><span>2</span></td>
        <td class="rankingTables__row__profile runner">
          <span data-bib="#34" class="flag flag--with-bib js-display-lazy" data-class="flag--usa"></span>
          <a class="rankingTables__row__profile--name" href="/en/rider/34/lidl-trek/quinn-simmons"
             data-xtclick="rankingTable::ITE" data-clicktype="N">Q. SIMMONS</a>
        </td>
        <td class="is-alignCenter time">04h 10&#039; 45&#039;&#039;</td>
        <td class="is-alignCenter time">-</td>
      </tr>
    </tbody>
  </table>`;

const LETOUR_STAGE4_ACTIVE_RANKINGS_HTML = `
  <!doctype html>
  <title>Official classifications of Tour de France 2026 - Stage 4</title>
  <h2 class="heading heading--3">2026 Rankings - Stage 4</h2>
  <span class="stage-select__option__stage">Stage 4</span>
  <span class="js-tabs-ranking"
        data-ajax-stack = {&quot;itg&quot;:&quot;\/en\/ajax\/ranking\/4\/itg\/gc-shell\/none&quot;}
        data-type="g" data-xtclick="ranking::tab::overall">General ranking</span>
  <span class="js-tabs-ranking"
        data-ajax-stack = {&quot;ite&quot;:&quot;\/en\/ajax\/ranking\/4\/ite\/stage-shell\/none&quot;}
        data-type="e" data-xtclick="ranking::tab::stage">Stage ranking</span>
  ${LETOUR_STAGE4_STAGE_TABLE_HTML}`;

const LETOUR_STAGE4_NO_GC_HTML = `
  <span class="js-tabs-ranking-nested general"
        data-tabs-ajax="/en/ajax/ranking/4/itg/gc-subtab/subtab"
        data-type="itg"></span>
  <p class="noRanking" data-tpl="ranking">No rank available in this section</p>`;

const LETOUR_STAGE4_GC_TABLE_HTML = `
  <table class="rankingTable rankingTables--with-pict rtable">
    <tbody>
      <tr class="rankingTables__row rankingTables__row--emphase has-shadowsep">
        <td class="rankingTables__row__position is-alignCenter"><span>1</span></td>
        <td class="rankingTables__row__profile runner">
          <span data-bib="#1" class="flag flag--with-bib js-display-lazy" data-class="flag--slo"></span>
          <a class="rankingTables__row__profile--name" href="/en/rider/1/uae-team-emirates-xrg/tadej-pogacar"
             data-xtclick="rankingTable::ITG" data-clicktype="N">T. POGACAR</a>
        </td>
        <td class="is-alignCenter time">14h 35&#039; 10&#039;&#039;</td>
        <td class="is-alignCenter time">-</td>
      </tr>
    </tbody>
  </table>`;

test("buildTourDeFranceOfficialSnapshot does not reuse active stage rows as GC fallback", () => {
  const { buildTourDeFranceOfficialSnapshot } = loadParserExports();
  const snapshot = JSON.parse(
    JSON.stringify(
      buildTourDeFranceOfficialSnapshot(
        LETOUR_STAGE4_ACTIVE_RANKINGS_HTML,
        LETOUR_STAGE4_STAGE_TABLE_HTML,
        "",
        LETOUR_STAGE4_NO_GC_HTML,
        {
          pageTitle: "2026 Tour de France",
          startDate: new Date("2026-07-04T00:00:00Z"),
          endDate: new Date("2026-07-26T00:00:00Z"),
        },
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 4);
  assert.equal(snapshot.latestStage.winner, "Mads Pedersen");
  assert.equal(snapshot.generalClassification, null);
});

test("fetchTourDeFranceOfficialSnapshot follows the nested ASO GC subtab", async () => {
  const { fetchTourDeFranceOfficialSnapshot } = loadParserExports();
  const fetchedUrls = [];
  const snapshot = await fetchTourDeFranceOfficialSnapshot(
    {
      pageTitle: "2026 Tour de France",
      startDate: new Date("2000-01-01T00:00:00Z"),
      endDate: new Date("2026-07-26T00:00:00Z"),
    },
    async (url) => {
      fetchedUrls.push(url);
      if (url === "https://www.letour.fr/en/rankings") {
        return LETOUR_STAGE4_ACTIVE_RANKINGS_HTML;
      }

      if (url.endsWith("/stage-shell/none")) {
        return LETOUR_STAGE4_STAGE_TABLE_HTML;
      }

      if (url.endsWith("/gc-shell/none")) {
        return LETOUR_STAGE4_NO_GC_HTML;
      }

      if (url.endsWith("/gc-subtab/subtab")) {
        return LETOUR_STAGE4_GC_TABLE_HTML;
      }

      return "";
    },
  );

  assert.equal(snapshot.latestStage.winner, "Mads Pedersen");
  assert.equal(snapshot.generalClassification.leader, "Tadej Pogacar");
  assert.ok(fetchedUrls.some((url) => url.endsWith("/gc-subtab/subtab")));
});

test("parseAthleteDetails reads every {{flagathlete}} redirect spelling", () => {
  const { parseAthleteDetails } = loadParserExports();

  for (const template of ["flagathlete", "Flagathlete", "Flag athlete", "flag_athlete"]) {
    const details = parseAthleteDetails(`{{${template}|[[Marlen Reusser]]|SUI}}`);
    assert.equal(details.rider, "Marlen Reusser", `expected {{${template}}} to resolve a rider`);
    assert.equal(details.countryCode, "SUI", `expected {{${template}}} to resolve a country`);
  }
});

test("extractStageRaceSnapshot reads a live Tour de France Femmes stage and GC from wikitables", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  // This page uses the spaced "{{Flag athlete}}" template and publishes its standings
  // as plain wikitables rather than {{cycling result start}} blocks, so before both
  // were supported the whole race rendered with no stage, GC or completed-stage count.
  const rawText = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-femmes-stage6.wikitext"),
    "utf8",
  );

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText)));

  assert.equal(snapshot.totalStages, 9);
  assert.equal(snapshot.completedStages, 6);
  assert.equal(snapshot.latestStage.number, 6);
  assert.equal(snapshot.latestStage.winner, "Kimberley Le Court");
  assert.equal(snapshot.generalClassification.stageNumber, 6);
  assert.equal(snapshot.generalClassification.leader, "Marlen Reusser");
  assert.equal(snapshot.generalClassification.leaderCountryCode, "SUI");
  assert.deepEqual(snapshot.generalClassification.standings.slice(0, 3), [
    { place: "1", rider: "Marlen Reusser", countryCode: "SUI", time: "19:43:34" },
    { place: "2", rider: "Demi Vollering", countryCode: "NED", gap: "+00:12" },
    { place: "3", rider: "Katarzyna Niewiadoma-Phinney", countryCode: "POL", gap: "+01:17" },
  ]);
});

test("cleanWikiText resolves every {{flagathlete}} redirect spelling", () => {
  const { cleanWikiText } = loadParserExports();
  // Kept in step with parseAthleteDetails: an unmatched spelling falls through to the
  // generic "{{...}} -> space" rule, which silently erases the rider's name.
  for (const template of ["flagathlete", "Flagathlete", "Flag athlete", "flag_athlete"]) {
    assert.equal(cleanWikiText(`{{${template}|Tadej Pogačar|SLO}}`), "Tadej Pogačar");
  }
});

test("extractClassificationTableGcSnapshots keeps sub-ten-second GC gaps", () => {
  const { extractClassificationTableGcSnapshots } = loadParserExports();
  // "+ 4"" has neither the two-digit seconds nor the minutes field the shared gap
  // normalizer needs, so without padding it normalized to "" and the rider rendered
  // as level with the leader. Single-digit gaps are routine early in a Grand Tour.
  const table = `
{| class="wikitable"
|+ General classification after Stage 2 (1–10)
|-
! scope="col" | Rank
! scope="col" | Rider
! scope="col" | Team
! scope="col" | Time
|-
! scope="row" | 1
| {{Flag athlete|[[Marlen Reusser]]|SUI}}
| {{UCI team code|MOV women|2026}}
| align="right" | 4h 10' 45"
|-
! scope="row" | 2
| {{Flag athlete|[[Demi Vollering]]|NED}}
| {{UCI team code|FSF|2026}}
| align="right" | + 4"
|-
! scope="row" | 3
| {{Flag athlete|[[Puck Pieterse]]|NED}}
| {{UCI team code|FEN|2026}}
| align="right" | + 1' 7"
|}`;

  const [snapshot] = extractClassificationTableGcSnapshots(table);

  assert.equal(snapshot.stageNumber, 2);
  assert.equal(snapshot.standings[0].time, "4:10:45");
  assert.equal(snapshot.standings[1].gap, "+00:04");
  assert.equal(snapshot.standings[2].gap, "+01:07");
});

test("extractClassificationTableGcSnapshots reads unquoted cell attributes", () => {
  const { extractClassificationTableGcSnapshots } = loadParserExports();
  // Wikipedia writes both `scope="row" |` and the bare `scope=row |`; only handling
  // the quoted form made every row fail to parse and dropped the whole table.
  const table = `
{| class="wikitable"
|+ General classification after Stage 6 (1–10)
|-
! scope=row | 1
| {{Flag athlete|[[Marlen Reusser]]|SUI}}
| {{UCI team code|MOV women|2026}}
| align=right | 19h 43' 34"
|-
! scope=row | 2
| {{Flag athlete|[[Demi Vollering]]|NED}}
| {{UCI team code|FSF|2026}}
| align=right | + 12"
|}`;

  const [snapshot] = extractClassificationTableGcSnapshots(table);

  assert.equal(snapshot.standings.length, 2);
  assert.equal(snapshot.standings[0].rider, "Marlen Reusser");
  assert.equal(snapshot.standings[0].time, "19:43:34");
  assert.equal(snapshot.standings[1].gap, "+00:12");
});

test("extractClassificationTableGcSnapshots ignores the other jersey classification tables", () => {
  const { extractClassificationTableGcSnapshots } = loadParserExports();
  const rawText = fs.readFileSync(
    path.join(__dirname, "fixtures", "tour-de-france-femmes-stage6.wikitext"),
    "utf8",
  );
  const pointsTable = `
{| class="wikitable"
|+ Points classification after Stage 6 (1–10)
|-
! scope="row" | 1
| {{Flag athlete|[[Lorena Wiebes]]|NED}}
| {{UCI team code|SDW|2026}}
| align="right" | 210
|}`;

  const snapshots = extractClassificationTableGcSnapshots(rawText + pointsTable);

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].stageNumber, 6);
  assert.equal(snapshots[0].standings[0].rider, "Marlen Reusser");
});

test("fetchTourDeFranceFemmesOfficialSnapshot builds a stage + GC snapshot from letourfemmes.fr", async () => {
  const { fetchTourDeFranceFemmesOfficialSnapshot } = loadParserExports();
  const readFixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  const fetchedUrls = [];

  const snapshot = await fetchTourDeFranceFemmesOfficialSnapshot(
    {
      pageTitle: "2026 Tour de France Femmes",
      startDate: new Date("2026-08-01T00:00:00Z"),
      endDate: new Date("2026-08-09T00:00:00Z"),
    },
    async (url) => {
      fetchedUrls.push(url);
      if (url === "https://www.letourfemmes.fr/en/rankings") {
        return readFixture("tour-de-france-femmes-rankings-stage6.html");
      }

      if (url.includes("/ite/")) {
        return readFixture("tour-de-france-femmes-stage6-ite.html");
      }

      if (url.includes("/itg/")) {
        return readFixture("tour-de-france-femmes-stage6-itg.html");
      }

      return "";
    },
  );

  // The men's providers must not leak in: every request has to stay on letourfemmes.fr.
  assert.ok(fetchedUrls.every((url) => url.startsWith("https://www.letourfemmes.fr/")));
  assert.equal(snapshot.totalStages, 9);
  assert.equal(snapshot.completedStages, 6);
  assert.equal(snapshot.latestStage.number, 6);
  assert.equal(snapshot.latestStage.winner, "Kim Le Court De Billot Pienaar");
  assert.equal(snapshot.latestStage.winnerCountryCode, "MRI");
  assert.equal(snapshot.generalClassification.leader, "Marlen Reusser");
  assert.equal(snapshot.generalClassification.standings[1].rider, "Demi Vollering");
  assert.equal(snapshot.generalClassification.standings[1].gap, "+00:12");
});

test("fetchTourDeFranceFemmesOfficialSnapshot ignores races it does not serve", async () => {
  const { fetchTourDeFranceFemmesOfficialSnapshot } = loadParserExports();
  const snapshot = await fetchTourDeFranceFemmesOfficialSnapshot(
    {
      pageTitle: "2026 Tour de France",
      startDate: new Date("2026-07-04T00:00:00Z"),
      endDate: new Date("2026-07-26T00:00:00Z"),
    },
    async () => {
      throw new Error("must not fetch for the men's race");
    },
  );

  assert.equal(snapshot, null);
});

test("fetchVueltaAEspanaOfficialSnapshot builds a stage + GC snapshot from lavuelta.es", async () => {
  const { fetchVueltaAEspanaOfficialSnapshot } = loadParserExports();
  const readFixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  const fetchedUrls = [];

  const snapshot = await fetchVueltaAEspanaOfficialSnapshot(
    {
      pageTitle: "2026 Vuelta a España",
      startDate: new Date("2026-08-22T00:00:00Z"),
      endDate: new Date("2026-09-13T00:00:00Z"),
    },
    async (url) => {
      fetchedUrls.push(url);
      if (url === "https://www.lavuelta.es/en/rankings") {
        return readFixture("vuelta-a-espana-rankings-stage5.html");
      }

      if (url.includes("/itg/")) {
        return readFixture("vuelta-a-espana-stage5-itg.html");
      }

      if (url.includes("/ite/")) {
        return readFixture("vuelta-a-espana-stage5-ite.html");
      }

      return "";
    },
  );

  assert.ok(fetchedUrls.every((url) => url.startsWith("https://www.lavuelta.es/")));
  // The stage menu, not the calendar span, is authoritative: the Vuelta has rest days.
  assert.equal(snapshot.totalStages, 21);
  assert.equal(snapshot.completedStages, 5);
  assert.equal(snapshot.latestStage.number, 5);
  assert.equal(snapshot.latestStage.winner, "James Matthew Brennan");
  assert.equal(snapshot.latestStage.winnerCountryCode, "GBR");
  // The point of this provider: the GC is current with the stage. The Vuelta's
  // Wikipedia article was still publishing "after stage 4" standings at this moment.
  assert.equal(snapshot.generalClassification.stageNumber, 5);
  assert.equal(snapshot.generalClassification.leader, "Tadej Pogacar");
  assert.equal(snapshot.generalClassification.standings[1].rider, "Primoz Roglic");
  assert.equal(snapshot.generalClassification.standings[1].gap, "+03:21");
});

test("fetchVueltaAEspanaOfficialSnapshot ignores races it does not serve", async () => {
  const { fetchVueltaAEspanaOfficialSnapshot } = loadParserExports();
  // La Vuelta Femenina has its own provider and its own rankings host; the men's
  // entry point must never claim it.
  const snapshot = await fetchVueltaAEspanaOfficialSnapshot(
    {
      pageTitle: "2026 La Vuelta Femenina",
      startDate: new Date("2026-05-04T00:00:00Z"),
      endDate: new Date("2026-05-10T00:00:00Z"),
    },
    async () => {
      throw new Error("must not fetch for the women's race");
    },
  );

  assert.equal(snapshot, null);
});

test("fetchTourDeFranceOfficialSnapshot keeps a good GC shell instead of an empty subtab", async () => {
  const { fetchTourDeFranceOfficialSnapshot } = loadParserExports();
  // The shell response can carry the ITG table and still advertise a nested subtab.
  // Following it unconditionally traded a valid GC for a "no rank available" stub.
  const gcShellWithNestedLink = `
    <span class="js-tabs-ranking-nested general"
          data-tabs-ajax="/en/ajax/ranking/4/itg/gc-subtab/subtab"
          data-type="itg"></span>
    ${LETOUR_STAGE4_GC_TABLE_HTML}`;
  const fetchedUrls = [];

  const snapshot = await fetchTourDeFranceOfficialSnapshot(
    {
      pageTitle: "2026 Tour de France",
      startDate: new Date("2000-01-01T00:00:00Z"),
      endDate: new Date("2026-07-26T00:00:00Z"),
    },
    async (url) => {
      fetchedUrls.push(url);
      if (url === "https://www.letour.fr/en/rankings") {
        return LETOUR_STAGE4_ACTIVE_RANKINGS_HTML;
      }

      if (url.endsWith("/stage-shell/none")) {
        return LETOUR_STAGE4_STAGE_TABLE_HTML;
      }

      if (url.endsWith("/gc-shell/none")) {
        return gcShellWithNestedLink;
      }

      if (url.endsWith("/gc-subtab/subtab")) {
        return `<p class="noRanking" data-tpl="ranking">No rank available in this section</p>`;
      }

      return "";
    },
  );

  assert.equal(snapshot.generalClassification.leader, "Tadej Pogacar");
  // The usable shell makes the second request unnecessary in the first place.
  assert.ok(!fetchedUrls.some((url) => url.endsWith("/gc-subtab/subtab")));
});

test("resolveLetourStageStandings rejects general rows served by the stage endpoint", () => {
  const { resolveLetourStageStandings } = loadParserExports();
  // Mirror of the inline-GC bug: if the "ite" endpoint serves the rankings shell, its
  // ITG rows must not be surfaced as the stage result.
  const standings = resolveLetourStageStandings(LETOUR_STAGE4_GC_TABLE_HTML, "");

  assert.equal(standings.length, 0);
});

test("parseLetourOfficialStandings keeps untagged rows when a table carries no type markers", () => {
  const { parseLetourOfficialStandings } = loadParserExports();
  // Older ASO markup renders rows without the profile anchor that carries the
  // "rankingTable::<TYPE>" marker, so the type filter must not blank those tables out.
  const untaggedHtml = `
    <table class="rankingTable">
      <tbody>
        <tr>
          <td class="rankingTables__row__position"><span>1</span></td>
          <td class="runner">
            <span class="flag flag--slo"></span>
            <img alt="Tadej POGACAR">
          </td>
          <td class="is-alignCenter time">14h 35' 10''</td>
        </tr>
      </tbody>
    </table>`;

  const standings = parseLetourOfficialStandings(untaggedHtml, { rankingType: "ITG" });

  assert.equal(standings.length, 1);
  assert.equal(standings[0].rider, "Tadej Pogacar");
});

test("buildTourDeFranceOfficialSnapshot rejects a stale previous-edition rankings page", () => {
  const { buildTourDeFranceOfficialSnapshot } = loadParserExports();
  // letour.fr keeps showing last year's final GC (with a "<year> Rankings - Stage N"
  // header for the previous edition) until the new edition's first stage posts. The
  // meta title still references the current edition, so the year header is the signal
  // that this is stale data we must not surface as the current Tour result.
  const staleRankingsHtml = `
    <title>Official classifications of Tour de France 2026 - Stage 21</title>
    <div class="ranking__header-title"><h2 class="heading heading--3">2025 Rankings - Stage 21</h2></div>
    <table class="rankingTable">
      <tbody>
        <tr>
          <td class="rankingTables__row__position"><span>1</span></td>
          <td class="runner"><a href="/en/rider/123/team/tadej-pogacar">T. Pogacar</a></td>
          <td class="is-alignCenter time">80:00:00</td>
        </tr>
      </tbody>
    </table>`;

  const snapshot = buildTourDeFranceOfficialSnapshot(staleRankingsHtml, "", "", staleRankingsHtml, {
    pageTitle: "2026 Tour de France",
    startDate: new Date("2026-07-04T00:00:00Z"),
    endDate: new Date("2026-07-26T00:00:00Z"),
  });

  assert.equal(snapshot, null);
});

test("fetchTourDeFranceOfficialSnapshot is gated to the current edition before the race starts", async () => {
  const { fetchTourDeFranceOfficialSnapshot } = loadParserExports();

  const snapshot = await fetchTourDeFranceOfficialSnapshot(
    {
      pageTitle: "2026 Tour de France",
      startDate: new Date("2099-07-04T00:00:00Z"),
      endDate: new Date("2099-07-26T00:00:00Z"),
    },
    async () => {
      throw new Error("should not fetch before the race window");
    },
  );

  assert.equal(snapshot, null);
});

const TDF_STAGE21_RACE = {
  pageTitle: "2026 Tour de France",
  title: "Tour de France",
  endDate: new Date("2026-07-26T00:00:00Z"),
  stageRace: { completedStages: 21, latestStage: { number: 21, standings: [{ place: "1", rider: "x" }] } },
};

function loadYouTubeFixtureVideos() {
  const { parseYouTubeSearchVideos } = loadParserExports();
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "youtube-search-tdf-stage21.html"), "utf8");
  return { parseYouTubeSearchVideos, videos: parseYouTubeSearchVideos(html) };
}

test("buildFinishVideoQuery includes the race name, year, stage, and highlights", () => {
  const { buildFinishVideoQuery } = loadParserExports();
  assert.equal(buildFinishVideoQuery(TDF_STAGE21_RACE), "Tour de France 2026 stage 21 highlights");
  assert.equal(
    buildFinishVideoQuery({
      pageTitle: "2026 Paris–Roubaix",
      title: "Paris–Roubaix",
      endDate: new Date("2026-04-12T00:00:00Z"),
    }),
    "Paris–Roubaix 2026 highlights",
  );
});

test("parseYouTubeSearchVideos reads videoId, title, channel, length, and verified badge from ytInitialData", () => {
  const { videos } = loadYouTubeFixtureVideos();
  assert.equal(videos.length, 8);
  const official = videos.find((video) => video.id === "tdfOfficial21");
  assert.equal(official.channel, "Tour de France");
  assert.equal(official.lengthSeconds, 616);
  assert.equal(official.verified, true);
});

test("selectFinishVideo prefers the official race channel over region-locked broadcasters", () => {
  const { parseYouTubeSearchVideos, videos } = loadYouTubeFixtureVideos();
  void parseYouTubeSearchVideos;
  const { selectFinishVideo } = loadParserExports();
  const best = selectFinishVideo(videos, TDF_STAGE21_RACE);
  assert.equal(best.id, "tdfOfficial21");
});

test("isLikelyFinishVideo rejects wrong stage, wrong year, previews, and unrelated races", () => {
  const { isLikelyFinishVideo } = loadParserExports();
  const { videos } = loadYouTubeFixtureVideos();
  const byId = Object.fromEntries(videos.map((video) => [video.id, video]));

  assert.equal(isLikelyFinishVideo(byId.tdfOfficial21, TDF_STAGE21_RACE), true);
  assert.equal(isLikelyFinishVideo(byId.gcnWrongStage, TDF_STAGE21_RACE), false); // stage 20
  assert.equal(isLikelyFinishVideo(byId.nbcWrongYear, TDF_STAGE21_RACE), false); // 2025
  assert.equal(isLikelyFinishVideo(byId.euroPreview, TDF_STAGE21_RACE), false); // preview
  assert.equal(isLikelyFinishVideo(byId.giroUnrelated, TDF_STAGE21_RACE), false); // different race
});

test("isLikelyFinishVideo rejects another ASO race posted on the official Tour de France channel", () => {
  const { isLikelyFinishVideo } = loadParserExports();
  // The official ASO channel is literally named "Tour de France" but also uploads
  // highlights for the other races it organises. The race token ("france") only
  // appears in the channel, not the title, so this must not pass for the Tour.
  const wrongRaceOnOfficialChannel = {
    id: "auvergne1",
    title: "Tour Auvergne-Rhône-Alpes 2026 - Stage 1 - Extended Highlights",
    channel: "Tour de France",
    verified: true,
    lengthSeconds: 300,
    ageText: "3 weeks ago",
  };
  const tdfStage1Race = {
    pageTitle: "2026 Tour de France",
    title: "Tour de France",
    endDate: new Date("2026-07-26T00:00:00Z"),
    stageRace: { completedStages: 1, latestStage: { number: 1, standings: [{ place: "1", rider: "x" }] } },
  };
  // Correct-race title from a trusted broadcaster is accepted.
  const trustedTdfStage1 = {
    id: "gcn1",
    title: "Tour de France 2026 Stage 1 Highlights",
    channel: "Global Cycling Network",
    verified: true,
    lengthSeconds: 300,
    ageText: "2 hours ago",
  };

  assert.equal(isLikelyFinishVideo(wrongRaceOnOfficialChannel, tdfStage1Race), false);
  assert.equal(isLikelyFinishVideo(trustedTdfStage1, tdfStage1Race), true);
});

test("isLikelyFinishVideo gates unrecognized channels on the verified badge and a sensible length", () => {
  const { isLikelyFinishVideo } = loadParserExports();
  const tdfStage1Race = {
    pageTitle: "2026 Tour de France",
    title: "Tour de France",
    endDate: new Date("2026-07-26T00:00:00Z"),
    stageRace: { completedStages: 1, latestStage: { number: 1, standings: [{ place: "1", rider: "x" }] } },
  };
  const base = {
    id: "unknown1",
    title: "Tour de France 2026 Stage 1 Highlights",
    channel: "Some Cycling Channel",
    lengthSeconds: 300,
    ageText: "2 hours ago",
  };

  // Unverified channel with a correct-looking title is still clickbait -> rejected.
  assert.equal(isLikelyFinishVideo({ ...base, verified: false }, tdfStage1Race), false);
  // Verified channel with a sensible highlights length -> allowed (middle ground).
  assert.equal(isLikelyFinishVideo({ ...base, verified: true }, tdfStage1Race), true);
  // Verified but a 40s clip/Short -> rejected on length.
  assert.equal(isLikelyFinishVideo({ ...base, verified: true, lengthSeconds: 40 }, tdfStage1Race), false);
  // Verified but a 90-minute replay/VOD -> rejected on length.
  assert.equal(isLikelyFinishVideo({ ...base, verified: true, lengthSeconds: 90 * 60 }, tdfStage1Race), false);
});

test("isLikelyFinishVideo rejects preview/analysis talk clips that are not race finishes", () => {
  const { isLikelyFinishVideo } = loadParserExports();
  // Stage number matches the race, so the only disqualifier is the preview/talk wording.
  const storylines = {
    id: "nbc1",
    title: "Key storylines entering Stage 21 of 2026 Tour De France | Beyond the Podium | NBC Sports",
    channel: "NBC Sports",
    verified: true,
    lengthSeconds: 400,
    ageText: "1 day ago",
  };

  assert.equal(isLikelyFinishVideo(storylines, TDF_STAGE21_RACE), false);
});

test("selectFinishVideo will not show a men's video for a women's race", () => {
  const { selectFinishVideo } = loadParserExports();
  const { videos } = loadYouTubeFixtureVideos();
  const womensRace = {
    pageTitle: "2026 Paris–Roubaix Femmes",
    title: "Paris–Roubaix Femmes",
    endDate: new Date("2026-04-12T00:00:00Z"),
  };
  // The fixture only contains men's / neutral clips, so the women's division
  // filter should reject all of them rather than surface a men's video.
  assert.equal(selectFinishVideo(videos, womensRace), null);
});

test("extractGiroDItaliaLatestCompletedStageNumber finds the latest stage rankings link", () => {
  const {
    extractGiroDItaliaLatestCompletedStageNumber,
    resolveGiroDItaliaCompletedStageNumber,
    resolveGiroDItaliaLivefeedStageNumber,
  } = loadParserExports();
  const html = `
    <a href="https://www.giroditalia.it/en/classifiche/di-tappa/1">Stage 1</a>
    <a href="https://www.giroditalia.it/en/classifiche/di-tappa/2/">Stage 2</a>
    <a href="https://www.giroditalia.it/en/classifiche/di-tappa/10/">Stage 10</a>
  `;

  assert.equal(extractGiroDItaliaLatestCompletedStageNumber(html), 10);

  const race = {
    startDate: new Date("2026-05-08T00:00:00.000Z"),
    endDate: new Date("2026-05-31T00:00:00.000Z"),
  };
  const inferredStageNumber = resolveGiroDItaliaLivefeedStageNumber(
    0,
    race,
    new Date("2026-05-14T18:30:00.000Z"),
  );

  assert.equal(inferredStageNumber, 7);
  assert.equal(
    resolveGiroDItaliaLivefeedStageNumber(6, race, new Date("2026-05-14T18:30:00.000Z")),
    6,
  );
  assert.equal(resolveGiroDItaliaCompletedStageNumber(6, 7, []), 6);
  assert.equal(
    resolveGiroDItaliaCompletedStageNumber(0, 6, [
      { place: "1", rider: "Davide Ballerini" },
      { place: "2", rider: "Jasper Stuyven" },
    ]),
    6,
  );
});

test("parseTourOfGreeceOfficialStandings parses official stage 1 and GC standings", () => {
  const { parseTourOfGreeceOfficialStandings } = loadParserExports();
  const fixturePath = path.join(__dirname, "fixtures", "tour-of-greece-results-2026-stage1.html");
  const html = fs.readFileSync(fixturePath, "utf8");

  const stageStandings = JSON.parse(JSON.stringify(parseTourOfGreeceOfficialStandings(html, "Stage 1")));
  const gcStandings = JSON.parse(JSON.stringify(parseTourOfGreeceOfficialStandings(html, "General Classification")));

  assert.deepEqual(stageStandings, [
    { place: "1", rider: "Mathis Avondts", countryCode: "BEL" },
    { place: "2", rider: "Georgios Bouglas", countryCode: "GRE" },
    { place: "3", rider: "Kristians Belohvosciks", countryCode: "LAT" },
    { place: "4", rider: "Matthew Walls", countryCode: "GBR" },
    { place: "5", rider: "Nahom Efriem", countryCode: "ERI" },
  ]);
  assert.deepEqual(gcStandings, stageStandings);
});

test("parseTourOfGreeceOfficialStandings handles the current GC and final-stage table layouts", () => {
  const { parseTourOfGreeceOfficialStandings, extractTourOfGreeceLatestStageNumber } = loadParserExports();
  const html = `
    <h1>Results 2026</h1>
    <h4>General Classification</h4>
    <table>
      <thead>
        <tr>
          <th>&nbsp;Rank</th>
          <th>&nbsp;</th>
          <th>Name</th>
          <th>Nation</th>
          <th>Bib</th>
          <th>Team</th>
          <th>Jersey</th>
          <th>&nbsp;Time</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1.</td>
          <td>&nbsp;</td>
          <td>Odd Christian EIKING</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/no_black.png" alt="" /></td>
          <td>1</td>
          <td>Uno-X</td>
          <td>&nbsp;</td>
          <td>20h27'34''</td>
        </tr>
        <tr>
          <td>2.</td>
          <td>&nbsp;</td>
          <td>Alessandro VERRE</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/it_black.png" alt="" /></td>
          <td>2</td>
          <td>Arkea</td>
          <td>&nbsp;</td>
          <td>20h27'40''</td>
        </tr>
        <tr>
          <td>3.</td>
          <td>&nbsp;</td>
          <td>Matteo FABBRO</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/it_black.png" alt="" /></td>
          <td>3</td>
          <td>Polti</td>
          <td>&nbsp;</td>
          <td>20h27'44''</td>
        </tr>
        <tr>
          <td>4.</td>
          <td>&nbsp;</td>
          <td>Jose Manuel DIAZ GALLEGO</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/es_black.png" alt="" /></td>
          <td>4</td>
          <td>Burgos</td>
          <td>&nbsp;</td>
          <td>20h27'48''</td>
        </tr>
        <tr>
          <td>5.</td>
          <td>&nbsp;</td>
          <td>Piotr PĘKALA</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/pl_black.png" alt="" /></td>
          <td>5</td>
          <td>Mazowsze</td>
          <td>&nbsp;</td>
          <td>20h27'55''</td>
        </tr>
      </tbody>
    </table>
    <h4>Stage 4</h4>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Nation</th>
          <th>Bib</th>
          <th>Team</th>
          <th>Jersey</th>
          <th>Bon.</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1.</td>
          <td>Old Stage Winner</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/gr_black.png" alt="" /></td>
          <td>44</td>
          <td>Greek Team</td>
          <td>&nbsp;</td>
          <td>-10</td>
          <td>3h00'00''</td>
        </tr>
      </tbody>
    </table>
    <h4>Stage 5</h4>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Nation</th>
          <th>Bib</th>
          <th>Team</th>
          <th>Jersey</th>
          <th>Bon.</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1.</td>
          <td>Mads ANDERSEN</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/dk_black.png" alt="" /></td>
          <td>131</td>
          <td>SWATT CLUB</td>
          <td>&nbsp;</td>
          <td>-10</td>
          <td>3h09'24''</td>
        </tr>
        <tr>
          <td>2.</td>
          <td>Dušan RAJOVIĆ</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/rs_black.png" alt="" /></td>
          <td>36</td>
          <td>SOLUTION TECH</td>
          <td>&nbsp;</td>
          <td>-9</td>
          <td>&nbsp;</td>
        </tr>
        <tr>
          <td>3.</td>
          <td>Nikiforos ARVANITOU</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/gr_black.png" alt="" /></td>
          <td>151</td>
          <td>TEAM UNITED SHIPPING</td>
          <td>&nbsp;</td>
          <td>-4</td>
          <td>&nbsp;</td>
        </tr>
        <tr>
          <td>4.</td>
          <td>Kasper ANDERSEN</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/dk_black.png" alt="" /></td>
          <td>132</td>
          <td>SWATT CLUB</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
        <tr>
          <td>5.</td>
          <td>Axel VAN DER TUUK</td>
          <td><img src="https://timit.pro/events/graphics/flags/png/nl_black.png" alt="" /></td>
          <td>23</td>
          <td>Metec</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  `;

  const gcStandings = JSON.parse(JSON.stringify(parseTourOfGreeceOfficialStandings(html, "General Classification")));
  const stageStandings = JSON.parse(JSON.stringify(parseTourOfGreeceOfficialStandings(html, "Stage 5")));

  assert.equal(extractTourOfGreeceLatestStageNumber(html), 5);
  assert.deepEqual(gcStandings, [
    { place: "1", rider: "Odd Christian Eiking", countryCode: "NOR" },
    { place: "2", rider: "Alessandro Verre", countryCode: "ITA" },
    { place: "3", rider: "Matteo Fabbro", countryCode: "ITA" },
    { place: "4", rider: "Jose Manuel Diaz Gallego", countryCode: "ESP" },
    { place: "5", rider: "Piotr Pękala", countryCode: "POL" },
  ]);
  assert.deepEqual(stageStandings, [
    { place: "1", rider: "Mads Andersen", countryCode: "DEN" },
    { place: "2", rider: "Dušan Rajović", countryCode: "SRB" },
    { place: "3", rider: "Nikiforos Arvanitou", countryCode: "GRE" },
    { place: "4", rider: "Kasper Andersen", countryCode: "DEN" },
    { place: "5", rider: "Axel Van Der Tuuk", countryCode: "NED" },
  ]);
});

test("extractVueltaABurgosFeminasStageStandings parses the official liveblog finish line", () => {
  const {
    extractVueltaABurgosFeminasStageStandings,
    extractVueltaABurgosFeminasLiveblogEndpoint,
    extractVueltaABurgosFeminasLatestMetaUpdateText,
  } = loadParserExports();
  const text =
    "Película de la 1ª etapa – 2026 Burgos Eclipsa: Burgos (Catedral) – Burgos (Gamonal). Km 127 BURGOS. META: 1ª 16 WIEBES (SDW), 2ª 51 CONSONNI (CSZ), 3ª 112 BAKER (LIV), 4ª 112 BAKER (LIV) y 5ª 85 BOSSUYT (AGS)";
  const contentHtml =
    '<div id="elb-liveblog" data-endpoint="https://www.vueltaburgos.com/feminas/wp-json/easy-liveblogs/v1/liveblog/10729"></div>';
  const liveblogPayload = {
    updates: [
      {
        content:
          "<p><strong>BODEGAS VIÑA PEDROSA. META:</strong> 1ª 16 WIEBES (SDW), 2ª 21 BALSAMO (LTK), 3ª 36 WOLLASTON (TFS), 4ª 54 SKALNIAK-SOJKA (CSZ) y 5ª 51 CONSONNI (CSZ), todas en el mismo tiempo</p>",
      },
    ],
  };

  const standings = JSON.parse(JSON.stringify(extractVueltaABurgosFeminasStageStandings(text)));
  const endpoint = extractVueltaABurgosFeminasLiveblogEndpoint(contentHtml);
  const updateText = extractVueltaABurgosFeminasLatestMetaUpdateText(liveblogPayload);

  assert.deepEqual(standings, [
    { place: "1", rider: "Lorena Wiebes", countryCode: "NED" },
    { place: "2", rider: "Chiara Consonni", countryCode: "ITA" },
    { place: "3", rider: "Baker" },
    { place: "5", rider: "Shari Bossuyt", countryCode: "BEL" },
  ]);
  assert.equal(endpoint, "https://www.vueltaburgos.com/feminas/wp-json/easy-liveblogs/v1/liveblog/10729");
  assert.match(updateText, /BALSAMO/);
});

test("parseSpanishStageNumber recognizes ordinal-digit Spanish stage titles", () => {
  const { parseSpanishStageNumber } = loadParserExports();

  assert.equal(parseSpanishStageNumber("Película de la 1ª etapa – 2026"), 1);
  assert.equal(parseSpanishStageNumber("Película de la 2ª etapa – 2026"), 2);
  assert.equal(parseSpanishStageNumber("Película de la 3ª etapa – 2026"), 3);
});

test("isVueltaABurgosFeminasRace matches accented and unaccented page titles", () => {
  const { isVueltaABurgosFeminasRace } = loadParserExports();

  assert.equal(
    isVueltaABurgosFeminasRace({ pageTitle: "2026 Vuelta a Burgos Féminas", title: "Vuelta a Burgos Féminas" }),
    true,
  );
  assert.equal(
    isVueltaABurgosFeminasRace({ pageTitle: "2026 Vuelta a Burgos Feminas", title: "Vuelta a Burgos Feminas" }),
    true,
  );
});

test("getKnownVueltaABurgosFeminasGcStandings returns stage 2 top five with gaps", () => {
  const { getKnownVueltaABurgosFeminasGcStandings } = loadParserExports();
  const standings = JSON.parse(JSON.stringify(getKnownVueltaABurgosFeminasGcStandings(2)));

  assert.deepEqual(standings, [
    { place: "1", rider: "Lorena Wiebes", countryCode: "NED" },
    { place: "2", rider: "Chiara Consonni", countryCode: "ITA", gap: "+0:14" },
    { place: "3", rider: "Elisa Balsamo", countryCode: "ITA", gap: "+0:14" },
    { place: "4", rider: "Ally Wollaston", gap: "+0:16" },
    { place: "5", rider: "Dominika Wlodarczyk", gap: "+0:17" },
  ]);
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

test("getStaticStageRaceSnapshot returns the 2026 Flèche du Sud fallback", () => {
  const { getStaticStageRaceSnapshotForTest } = loadParserExports();
  const snapshot = JSON.parse(
    JSON.stringify(
      getStaticStageRaceSnapshotForTest("Flèche du Sud", "2026-05-17T00:00:00Z"),
    ),
  );

  assert.equal(snapshot.totalStages, 5);
  assert.equal(snapshot.completedStages, 5);
  assert.deepEqual(snapshot.latestStage, {
    number: 5,
    label: "Stage 5",
    standings: [{ place: "1", rider: "Matthew Brennan" }],
    winner: "Matthew Brennan",
  });
  assert.deepEqual(snapshot.generalClassification, {
    stageNumber: 5,
    standings: [
      { place: "1", rider: "Matisse Van Kerckhove" },
      { place: "2", rider: "Mats Wenzel" },
      { place: "3", rider: "Arno Wallenborn" },
      { place: "4", rider: "Anton Schiffer", countryCode: "GER" },
      { place: "5", rider: "Toralf Rydningen Martinsen" },
    ],
    leader: "Matisse Van Kerckhove",
  });
});

test("partitionRaceBuckets keeps completed Europe Tour stage races even when the season table winner is blank", () => {
  const { partitionRaceBuckets } = loadParserExports();
  const buckets = partitionRaceBuckets(
    [
      {
        pageTitle: "Flèche du Sud",
        title: "Flèche du Sud",
        series: "Men's Europe Tour",
        winner: "",
        startDate: new Date("2026-05-13T00:00:00Z"),
        endDate: new Date("2026-05-17T00:00:00Z"),
      },
    ],
    new Date("2026-05-19T12:00:00Z"),
  );

  assert.equal(buckets.europeTourRecentResults.length, 1);
  assert.equal(buckets.europeTourRecentResults[0].title, "Flèche du Sud");
});

test("parseNationalChampionshipsIndex extracts national champions and cleans placeholder cells", () => {
  const { parseNationalChampionshipsIndex } = loadParserExports();
  const html = `
    <script type="application/ld+json">{"dateModified":"2026-06-21T22:58:07+00:00"}</script>
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr>
        <th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th>
      </tr>
      <tr>
        <th>Australia</th><td>Luke Plapp</td><td>Axel K&auml;llberg</td><td>Grace Brown</td><td>Ruby Roseman-Gannon</td>
      </tr>
      <tr>
        <th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td>
      </tr>
      <tr>
        <th>Blankovia</th><td>Row 12 - Cell 2</td><td></td><td> </td><td>Row 12 - Cell 5</td>
      </tr>
      <tr>
        <th>Great Britain</th><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <th>Canada</th><td></td><td>Alison Jackson</td><td></td><td></td>
      </tr>
    </table>`;

  const parsed = parseNationalChampionshipsIndex(html);
  const australia = parsed.rows.find((row) => row.country === "Australia");
  const unitedStates = parsed.rows.find((row) => row.country === "United States");
  const blankovia = parsed.rows.find((row) => row.country === "Blankovia");
  const usMensRoadRace = parsed.events.find(
    (event) => event.country === "United States" && event.eventKey === "meRoadRace",
  );
  const usWomensRoadRace = parsed.events.find(
    (event) => event.country === "United States" && event.eventKey === "weRoadRace",
  );
  const britishMensTimeTrial = parsed.events.find(
    (event) => event.country === "Great Britain" && event.eventKey === "meItt",
  );

  assert.equal(parsed.sourceLastModified, "2026-06-21T22:58:07+00:00");
  assert.equal(parsed.totalCountryCount, 5);
  assert.equal(parsed.reportingCountryCount, 3);
  assert.equal(parsed.completeCountryCount, 2);
  assert.equal(parsed.completedEventCount, 9);
  assert.equal(parsed.events.length, 20);
  assert.equal(australia.meRoadRace, "Axel Källberg");
  assert.equal(unitedStates.meItt, "Artem Shmidt");
  assert.equal(unitedStates.meRoadRace, "Quinn Simmons");
  assert.equal(parsed.events[0].country, "United States");
  assert.equal(parsed.events[0].eventKey, "meRoadRace");
  assert.equal(usMensRoadRace.dateLabel, "Jun 21, 2026");
  assert.equal(usMensRoadRace.location, "Charleston, West Virginia");
  assert.equal(usMensRoadRace.finishVideoUrl, "https://www.youtube.com/watch?v=hSVSHs9lPPI");
  assert.deepEqual(JSON.parse(JSON.stringify(usWomensRoadRace.podium)), [
    { place: "1", rider: "Kate Courtney" },
    { place: "2", rider: "Lauren Stephens" },
    { place: "3", rider: "Grace Arlandson" },
  ]);
  assert.equal(britishMensTimeTrial.dateLabel, "Jun 25, 2026");
  assert.equal(britishMensTimeTrial.location, "Lampeter, Wales");
  assert.deepEqual(JSON.parse(JSON.stringify(blankovia)), {
    country: "Blankovia",
    meItt: "",
    meRoadRace: "",
    weItt: "",
    weRoadRace: "",
  });
  assert.equal(parsed.highlights[0].country, "United States");
});

test("buildNationalChampionshipsSection renders source-backed champion table", () => {
  const { parseNationalChampionshipsIndex, buildNationalChampionshipsSection } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <script type="application/ld+json">{"dateModified":"2026-06-21T22:58:07+00:00"}</script>
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
      <tr><th>Sweden</th><td>Axel K&auml;llberg</td><td></td><td>Zo&euml; Andersson</td><td></td></tr>
      <tr><th>Great Britain</th><td></td><td></td><td></td><td></td></tr>
    </table>`);
  const markup = buildNationalChampionshipsSection(parsed);

  assert.match(markup, /National Championships/);
  assert.match(markup, /Quinn Simmons/);
  assert.match(markup, /Axel Källberg/);
  assert.match(markup, /Zoë Andersson/);
  assert.match(markup, /Taylor Knibb/);
  assert.match(markup, /Lauren Stephens/);
  assert.match(markup, /Watch race finish/);
  assert.match(markup, /national-country-filter/);
  assert.match(markup, /national-event-filter/);
  assert.match(markup, /Great Britain/);
  assert.match(markup, /hidden/);
  assert.match(markup, /Cyclingnews/);
  assert.match(markup, /2026-road-national-champions-index/);
  assert.doesNotMatch(markup, /All Countries/);
});

test("getCountryFlagEmojiByName maps source spellings and aliases, and ignores unknowns", () => {
  const { getCountryFlagEmojiByName } = loadParserExports();
  assert.equal(getCountryFlagEmojiByName("United States"), "🇺🇸");
  assert.equal(getCountryFlagEmojiByName("Great Britain"), "🇬🇧");
  assert.equal(getCountryFlagEmojiByName("Czechia"), "🇨🇿");
  assert.equal(getCountryFlagEmojiByName("Türkiye"), "🇹🇷");
  assert.equal(getCountryFlagEmojiByName("Korea"), "🇰🇷");
  assert.equal(getCountryFlagEmojiByName("hong kong, china"), "🇭🇰");
  assert.equal(getCountryFlagEmojiByName("Atlantis"), "");
  assert.equal(getCountryFlagEmojiByName(""), "");
});

test("National Championships country headers carry a flag, but podium riders do not", () => {
  const { buildNationalChampionshipsSection, parseNationalChampionshipsIndex } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
    </table>`);
  const markup = buildNationalChampionshipsSection(parsed);

  // Flag sits in the country header.
  assert.match(markup, /<h3 class="national-title"><span class="national-flag"[^>]*>🇺🇸<\/span><span>United States<\/span>/);
  // A single podium list renders its riders without an inline flag.
  const podiumMatch = markup.match(/<ol class="national-podium-list">[\s\S]*?<\/ol>/);
  assert.ok(podiumMatch, "expected a rendered podium list");
  assert.doesNotMatch(podiumMatch[0], /country-flag|national-flag/);
  assert.match(markup, /Quinn Simmons/);
});

test("getCompetitionGroups keeps retired ProSeries and Europe Tour sections out of the active UI", () => {
  const { getCompetitionGroups } = loadParserExports();
  const groups = getCompetitionGroups({
    recentResults: [
      { series: "Men's WorldTour" },
      { series: "Women's WorldTour" },
      { series: "Men's ProSeries" },
      { series: "Men's Europe Tour" },
    ],
    liveStageRaces: [],
    upcomingRaces: [],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(groups.map((group) => group.id))), [
    "mens-worldtour",
    "womens-worldtour",
  ]);
  assert.equal(groups.some((group) => group.deferred), false);
});

test("buildRecentResultsBlock reveals the first three races and hides the rest behind a button", () => {
  const { buildRecentResultsBlock } = loadParserExports();
  const makeRace = (n) => ({
    id: `race-${n}`,
    series: "Men's WorldTour",
    title: `Race ${n}`,
    date: `June ${n}, 2026`,
    location: "Somewhere",
    winner: `Winner ${n}`,
  });
  const markup = buildRecentResultsBlock({
    id: "mens-worldtour",
    recentResults: [1, 2, 3, 4, 5].map(makeRace),
    recentGridClass: "competition-grid-three",
  });

  const slots = [...markup.matchAll(/<div\s+class="recent-race-slot"[\s\S]*?data-recent-race-id="([^"]+)"([\s\S]*?)>/g)];
  assert.equal(slots.length, 5);
  // First three visible, last two hidden.
  assert.equal(slots.filter((slot) => /\bhidden\b/.test(slot[2])).length, 2);
  assert.match(slots[0][2], /^(?!.*\bhidden\b)/);
  assert.match(slots[2][2], /^(?!.*\bhidden\b)/);
  assert.match(slots[3][2], /\bhidden\b/);
  // Reveal button present, carrying the race metadata for the dropdown sync.
  assert.match(markup, /data-load-more-races="mens-worldtour"/);
  assert.match(markup, /data-recent-race-title="Race 4"/);
  assert.match(markup, /data-recent-race-date="June 4, 2026"/);
});

test("buildRecentResultsBlock omits the load-more button when there is only one row", () => {
  const { buildRecentResultsBlock } = loadParserExports();
  const makeRace = (n) => ({ id: `r${n}`, series: "Men's WorldTour", title: `Race ${n}`, date: "June 2026", location: "X", winner: "W" });
  const markup = buildRecentResultsBlock({ id: "mens-worldtour", recentResults: [1, 2, 3].map(makeRace) });
  assert.doesNotMatch(markup, /data-load-more-races/);
  assert.equal([...markup.matchAll(/data-recent-slot/g)].length, 3);
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

test("selectPreferredStageRaceSnapshot merges the freshest stage and GC independently", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 7,
          completedStages: 4,
          _sourceId: "official-stage",
          latestStage: {
            number: 4,
            label: "Stage 4",
            standings: [{ place: "1", rider: "Lotte Kopecky" }],
          },
          generalClassification: {
            stageNumber: 2,
            standings: [{ place: "1", rider: "Marianne Vos" }],
          },
          overallResult: [],
        },
        {
          totalStages: 7,
          completedStages: 4,
          _sourceId: "wikipedia-raw",
          latestStage: {
            number: 3,
            label: "Stage 3",
            standings: [{ place: "1", rider: "Anna Van Der Breggen" }],
          },
          generalClassification: {
            stageNumber: 4,
            standings: [
              { place: "1", rider: "Lotte Kopecky" },
              { place: "2", rider: "Franziska Koch" },
            ],
          },
          overallResult: [],
        },
        {
          pageTitle: "2026 La Vuelta Femenina",
          startDate: new Date("2026-05-03T00:00:00Z"),
          endDate: new Date("2026-05-09T00:00:00Z"),
        },
        new Date("2026-05-06T20:00:00Z"),
      ),
    ),
  );

  assert.equal(preferred.completedStages, 4);
  assert.equal(preferred.latestStage.number, 4);
  assert.equal(preferred.generalClassification.stageNumber, 4);
  assert.equal(preferred.latestStage.winner || preferred.latestStage.standings[0].rider, "Lotte Kopecky");
  assert.equal(
    preferred.generalClassification.leader || preferred.generalClassification.standings[0].rider,
    "Lotte Kopecky",
  );
  assert.deepEqual(preferred.provenance, {
    snapshot: "wikipedia-raw",
    latestStage: "official-stage",
    generalClassification: "wikipedia-raw",
    overallResult: "official-stage",
  });
});

test("selectPreferredStageRaceSnapshot deprioritizes stale live progress during an active race", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 7,
          completedStages: 1,
          latestStage: {
            number: 1,
            label: "Stage 1",
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
            ],
          },
          overallResult: [],
        },
        {
          totalStages: 7,
          completedStages: 3,
          latestStage: {
            number: 3,
            label: "Stage 3",
            standings: [{ place: "1", rider: "Marianne Vos" }],
          },
          generalClassification: {
            stageNumber: 3,
            standings: [{ place: "1", rider: "Marianne Vos" }],
          },
          overallResult: [],
        },
        {
          pageTitle: "2026 La Vuelta Femenina",
          startDate: new Date("2026-05-03T00:00:00Z"),
          endDate: new Date("2026-05-09T00:00:00Z"),
        },
        new Date("2026-05-06T20:00:00Z"),
      ),
    ),
  );

  assert.equal(preferred.completedStages, 3);
  assert.equal(preferred.latestStage.number, 3);
  assert.equal(preferred.generalClassification.stageNumber, 3);
});

test("selectPreferredStageRaceSnapshot preserves explicit total stage counts over calendar-day spans", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        null,
        {
          totalStages: 21,
          completedStages: 1,
          latestStage: {
            number: 1,
            label: "Stage 1",
            standings: [{ place: "1", rider: "Paul Magnier", countryCode: "FRA" }],
          },
          generalClassification: null,
          overallResult: [],
        },
        {
          pageTitle: "2026 Giro d'Italia",
          startDate: new Date("2026-05-08T00:00:00Z"),
          endDate: new Date("2026-05-31T00:00:00Z"),
        },
        new Date("2026-05-08T20:00:00Z"),
      ),
    ),
  );

  assert.equal(preferred.totalStages, 21);
  assert.equal(preferred.completedStages, 1);
  assert.equal(preferred.latestStage.number, 1);
});

test("selectPreferredStageRaceSnapshot drops stale GC when a newer stage is known", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 21,
          completedStages: 1,
          latestStage: {
            number: 1,
            standings: [
              { place: "1", rider: "Paul Magnier" },
              { place: "2", rider: "Tobias Lund Andresen" },
            ],
          },
          generalClassification: {
            stageNumber: 1,
            standings: [
              { place: "1", rider: "Paul Magnier" },
              { place: "2", rider: "Tobias Lund Andresen" },
            ],
          },
          overallResult: [],
        },
        {
          totalStages: 21,
          completedStages: 2,
          latestStage: {
            number: 2,
            standings: [{ place: "1", rider: "Mads Pedersen" }],
          },
          generalClassification: null,
          overallResult: [],
        },
        {
          pageTitle: "2026 Giro d'Italia",
          startDate: new Date("2026-05-08T00:00:00Z"),
          endDate: new Date("2026-05-31T00:00:00Z"),
        },
        new Date("2026-05-09T18:30:00Z"),
      ),
    ),
  );

  assert.equal(preferred.completedStages, 2);
  assert.equal(preferred.latestStage.number, 2);
  assert.equal(preferred.generalClassification, null);
});

test("selectPreferredStageRaceSnapshot prefers a rich current Giro snapshot over a sparse future placeholder", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const preferred = JSON.parse(
    JSON.stringify(
      selectPreferredStageRaceSnapshot(
        {
          totalStages: 21,
          completedStages: 8,
          latestStage: {
            number: 8,
            label: "Stage 8",
            standings: [
              { place: "1", rider: "Jhonatan Narvaez" },
              { place: "2", rider: "Andreas Leknessund" },
              { place: "3", rider: "Martin Tjøtta" },
              { place: "4", rider: "Guillermo Silva" },
              { place: "5", rider: "Lorenzo Milesi" },
            ],
          },
          generalClassification: {
            stageNumber: 8,
            standings: [
              { place: "1", rider: "Afonso Eulálio" },
              { place: "2", rider: "Jonas Vingegaard" },
              { place: "3", rider: "Felix Gall" },
              { place: "4", rider: "Christian Scaroni" },
              { place: "5", rider: "Jai Hindley" },
            ],
          },
          overallResult: [],
        },
        {
          totalStages: 21,
          completedStages: 21,
          latestStage: {
            number: 21,
            label: "Stage 21",
            standings: [{ place: "1", rider: "Placeholder Winner" }],
          },
          generalClassification: null,
          overallResult: [],
        },
        {
          pageTitle: "2026 Giro d'Italia",
          startDate: new Date("2026-05-08T00:00:00Z"),
          endDate: new Date("2026-05-31T00:00:00Z"),
        },
        new Date("2026-05-17T18:00:00Z"),
      ),
    ),
  );

  assert.equal(preferred.completedStages, 8);
  assert.equal(preferred.latestStage.number, 8);
  assert.equal(preferred.generalClassification.stageNumber, 8);
});

test("fetchGiroDItaliaOfficialSnapshot still uses the official Giro source after the race end date", async () => {
  const { fetchGiroDItaliaOfficialSnapshot } = loadParserExports();
  const snapshot = JSON.parse(
    JSON.stringify(
      await fetchGiroDItaliaOfficialSnapshot(
        {
          pageTitle: "2026 Giro d'Italia",
          startDate: new Date("2026-05-08T00:00:00Z"),
          endDate: new Date("2026-05-31T00:00:00Z"),
        },
        async (url) => {
          if (url.includes("/classifiche/di-tappa/21/")) {
            return `
              <div class="single-tab js-tab-classifica-ORARR is-active" data-category="tab-classifica-ORARR">
                <div class="table type-4">
                  <div class="line-table">
                    <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Jonathan</div><div class="surname p-3 is-bold">MILAN</div></div></div>
                  </div>
                  <div class="line-table">
                    <div class="corridore p-3"><h5 class="position is-pink">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/ita.png"></div><div class="atleta-info"><div class="name p-3">Giovanni</div><div class="surname p-3 is-bold">LONARDI</div></div></div>
                  </div>
                </div>
              </div>`;
          }

          if (url.includes("/livefeed/tappa/21/")) {
            return JSON.stringify({ cronaca_sintesi: { entries: [] } });
          }

          if (url.includes("/classifiche/")) {
            return `
                <a href="/en/classifiche/di-tappa/21/">Stage 21</a>
                <div class="single-tab js-tab-classifica-CLGEN is-active" data-category="tab-classifica-CLGEN">
                  <div class="table type-4">
                    <div class="line-table">
                      <div class="corridore p-3"><h5 class="position is-pink">1</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/den.png"></div><div class="atleta-info"><div class="name p-3">Jonas</div><div class="surname p-3 is-bold">VINGEGAARD</div></div></div>
                      <div class="tempo p-3 is-text-right">83:22:51</div>
                      <div class="distacco p-3 is-text-right">0:00</div>
                    </div>
                    <div class="line-table">
                      <div class="corridore p-3"><h5 class="position">2</h5><div class="flag"><img data-src="https://components2.rcsobjects.it/rcs_sport_giro2020-layout/v0/assets/img/ext/athletes-flags/aut.png"></div><div class="atleta-info"><div class="name p-3">Felix</div><div class="surname p-3 is-bold">GALL</div></div></div>
                      <div class="tempo p-3 is-text-right">83:28:13</div>
                      <div class="distacco p-3 is-text-right">5:22</div>
                    </div>
                  </div>
                </div>`;
          }

          throw new Error(`Unexpected URL: ${url}`);
        },
        new Date("2026-06-02T12:00:00Z"),
      ),
    ),
  );

  assert.equal(snapshot.completedStages, 21);
  assert.equal(snapshot.latestStage.number, 21);
  assert.deepEqual(snapshot.latestStage.standings, [
    { place: "1", rider: "Jonathan Milan", countryCode: "ITA" },
    { place: "2", rider: "Giovanni Lonardi", countryCode: "ITA" },
  ]);
  assert.deepEqual(snapshot.generalClassification.standings, [
    { place: "1", rider: "Jonas Vingegaard", countryCode: "DEN", time: "83:22:51" },
    { place: "2", rider: "Felix Gall", countryCode: "AUT", time: "83:28:13", gap: "+5:22" },
  ]);
});

test("isRaceWithinScheduledLiveWindow keeps a scheduled live stage race visible", () => {
  const { isRaceWithinScheduledLiveWindow } = loadParserExports();
  const race = {
    pageTitle: "2026 Giro d'Italia",
    startDate: new Date("2026-05-08T00:00:00Z"),
    endDate: new Date("2026-05-31T00:00:00Z"),
    stageRace: {
      totalStages: 21,
      completedStages: 21,
    },
  };

  assert.equal(isRaceWithinScheduledLiveWindow(race, new Date("2026-05-17T00:00:00Z")), true);
  assert.equal(isRaceWithinScheduledLiveWindow(race, new Date("2026-06-01T00:00:00Z")), false);
});

test("getRaceFinishVideoUrl returns Giro video only for the mapped stage", () => {
  const { getRaceFinishVideoUrl } = loadParserExports();

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 1,
      },
    }),
    "https://www.youtube.com/watch?v=k9etTDahUFo",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 2,
      },
    }),
    "https://video.giroditalia.it/video/126977539",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 3,
      },
    }),
    "https://video.giroditalia.it/video/126996326",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 4,
      },
    }),
    "https://video.giroditalia.it/video/127117045",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 5,
        latestStage: {
          number: 5,
          finishVideoUrl: "https://video.giroditalia.it/video/127169105",
        },
      },
    }),
    "https://video.giroditalia.it/video/127169105",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 9,
      },
    }),
    "https://www.youtube.com/watch?v=ZhO3_roH_mg",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 9,
        latestStage: {
          number: 9,
          finishVideoUrl: "https://video.giroditalia.it/video/old-livefeed-url",
        },
      },
    }),
    "https://www.youtube.com/watch?v=ZhO3_roH_mg",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Giro d'Italia",
      stageRace: {
        completedStages: 13,
      },
    }),
    "https://www.youtube.com/watch?v=RUOs9YzSato",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Tour Auvergne-Rhône-Alpes",
      stageRace: {
        completedStages: 5,
      },
    }),
    "https://www.youtube.com/watch?v=4VSnvDeUO4E",
  );
});

test("getRaceFinishVideoUrl returns Tour de Suisse video only for the final completed stage", () => {
  const { getRaceFinishVideoUrl } = loadParserExports();

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Tour de Suisse",
      stageRace: {
        completedStages: 5,
      },
    }),
    "https://www.youtube.com/watch?v=f61NRl63jFg",
  );

  assert.equal(
    getRaceFinishVideoUrl({
      pageTitle: "2026 Tour de Suisse",
      stageRace: {
        completedStages: 4,
      },
    }),
    "",
  );
});

test("getRaceDataCacheTtlMs shortens cache TTL while live or just-finished races are active", () => {
  const { hasFreshnessSensitiveRaceData, getRaceDataCacheTtlMs } = loadParserExports();

  assert.equal(getRaceDataCacheTtlMs({ liveStageRaces: [], europeTourLiveStageRaces: [] }), 15 * 60 * 1000);
  assert.equal(getRaceDataCacheTtlMs({ liveStageRaces: [{ id: "giro" }], europeTourLiveStageRaces: [] }), 60 * 1000);
  assert.equal(
    getRaceDataCacheTtlMs({ liveStageRaces: [], europeTourLiveStageRaces: [{ id: "greece" }] }),
    60 * 1000,
  );
  assert.equal(
    hasFreshnessSensitiveRaceData({ recentResults: [{ title: "Race", finishedToday: true }] }),
    true,
  );
  assert.equal(
    getRaceDataCacheTtlMs({ liveStageRaces: [], europeTourLiveStageRaces: [], recentResults: [{ finishedToday: true }] }),
    60 * 1000,
  );
});

test("buildStageRaceCard prefers richer finalized standings over sparse GC data", () => {
  const { buildStageRaceCard } = loadParserExports();
  const html = buildStageRaceCard({
    series: "Men's WorldTour",
    title: "Test Stage Race",
    date: "1-7 May 2026",
    location: "Spain",
    finishedToday: false,
    resultStandings: [
      { place: "1", rider: "Rider One" },
      { place: "2", rider: "Rider Two" },
      { place: "3", rider: "Rider Three" },
      { place: "4", rider: "Rider Four" },
      { place: "5", rider: "Rider Five" },
    ],
    stageRace: {
      totalStages: 7,
      completedStages: 7,
      latestStage: null,
      generalClassification: {
        stageNumber: 7,
        standings: [{ place: "1", rider: "Rider One" }],
        leader: "Rider One",
      },
      overallResult: [{ place: "1", rider: "Rider One" }],
    },
  });

  assert.match(html, /Rider Five/);
  assert.doesNotMatch(html, /No completed stage result is available yet\./);
});

test("buildStageRaceCard shows stage time separately from cumulative GC timing when available", () => {
  const { buildStageRaceCard } = loadParserExports();
  const html = buildStageRaceCard({
    title: "Giro d'Italia Women",
    series: "Women's WorldTour",
    date: "Jun 2",
    location: "Italy",
    stageRace: {
      totalStages: 9,
      completedStages: 4,
      latestStage: {
        number: 4,
        label: "Stage 4",
        winner: "Anna Van Der Breggen",
        winnerCountryCode: "NED",
        standings: [
          { place: "1", rider: "Anna Van Der Breggen", countryCode: "NED", time: "31:38" },
          { place: "2", rider: "Marlen Reusser", countryCode: "SUI", gap: "+01:04", time: "32:42" },
          { place: "3", rider: "Demi Vollering", countryCode: "NED", gap: "+01:10", time: "32:48" },
        ],
      },
      generalClassification: {
        stageNumber: 4,
        standings: [
          { place: "1", rider: "Anna Van Der Breggen", countryCode: "NED", time: "11:31:32" },
          { place: "2", rider: "Marlen Reusser", countryCode: "SUI", gap: "+01:04", time: "11:32:36" },
          { place: "3", rider: "Demi Vollering", countryCode: "NED", gap: "+01:10", time: "11:32:42" },
        ],
      },
      overallResult: [],
    },
  });

  const [stageSection = "", gcSection = ""] = html.split("Overall after stage 4");
  assert.match(html, /stage-winner-rider[^>]*>.*31:38/s);
  assert.match(stageSection, /Marlen Reusser.*32:42/s);
  assert.doesNotMatch(stageSection, /\+01:04/);
  assert.match(html, /Overall after stage 4/);
  assert.match(gcSection, /11:31:32/);
  assert.match(gcSection, /Marlen Reusser.*\+01:04/s);
});

test("buildRaceCard does not render one-day races as stage races", () => {
  const { buildRaceCard, isMultiDayRace } = loadParserExports();
  const race = {
    series: "Men's WorldTour",
    title: "Test Classic",
    date: "6 May 2026",
    location: "Germany",
    startDate: new Date("2026-05-06T00:00:00Z"),
    endDate: new Date("2026-05-06T00:00:00Z"),
    winner: "Rider One",
    second: "Rider Two",
    third: "Rider Three",
    resultStandings: [
      { place: "1", rider: "Rider One" },
      { place: "2", rider: "Rider Two" },
      { place: "3", rider: "Rider Three" },
      { place: "4", rider: "Rider Four" },
      { place: "5", rider: "Rider Five" }
    ],
    stageRace: {
      totalStages: 1,
      completedStages: 1,
      latestStage: null,
      generalClassification: {
        stageNumber: 1,
        standings: [{ place: "1", rider: "Rider One" }],
        leader: "Rider One"
      },
      overallResult: [{ place: "1", rider: "Rider One" }]
    }
  };

  assert.equal(isMultiDayRace(race), false);

  const html = buildRaceCard(race);
  assert.match(html, /Rider Five/);
  assert.doesNotMatch(html, /Final general classification/);
  assert.doesNotMatch(html, /All 1 stages are complete\./);
});

test("buildRaceCard renders a finished stage race that lacks a snapshot from its season podium", () => {
  // A finished multi-day race whose stage-race snapshot could not be enriched
  // must still render (from winner/second/third) rather than be dropped, which is
  // what kept Grand Tours like the Giro out of the recent grid.
  const { buildRaceCard, isMultiDayRace } = loadParserExports();
  const race = {
    series: "Men's WorldTour",
    title: "Giro d'Italia",
    date: "8–31 May 2026",
    location: "Italy",
    startDate: new Date("2026-05-08T00:00:00Z"),
    endDate: new Date("2026-05-31T00:00:00Z"),
    winner: "Jonas Vingegaard",
    second: "Primož Roglič",
    third: "Juan Ayuso",
  };

  assert.equal(isMultiDayRace(race), true);

  const html = buildRaceCard(race);
  assert.match(html, /Giro d&#39;Italia/); // apostrophe is HTML-escaped
  assert.match(html, /Jonas Vingegaard/);
  assert.match(html, /Primož Roglič/);
  assert.match(html, /Juan Ayuso/);
});

test("extractStageArticleTitles reads companion stage articles off the route table", () => {
  const { extractStageArticleTitles } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-stage2.wikitext"), "utf8");

  assert.deepEqual(JSON.parse(JSON.stringify(extractStageArticleTitles(rawText))), [
    "2026 Vuelta a España, Stage 1 to Stage 11",
  ]);
});

test("extractStageArticleTitles returns nothing for a race that publishes stages inline", () => {
  const { extractStageArticleTitles } = loadParserExports();
  // A shorter stage race numbers its route table rows without linking anywhere, so
  // there is no companion article to fetch and no extra upstream request to make.
  const rawText = [
    '{| class="wikitable"',
    "|+ Stage characteristics and winners",
    "|-",
    '! scope="row" | 1',
    "| 15 May",
    "| [[Vitoria-Gasteiz]] to [[Vitoria-Gasteiz]]",
    "| {{convert|100|km|abbr=on}}",
    "| [[File:Hillystage.svg|20px]]",
    "| Hilly stage",
    "| {{flagathlete|[[Demi Vollering]]|NED}}",
    "|}",
  ].join("\n");

  assert.deepEqual(JSON.parse(JSON.stringify(extractStageArticleTitles(rawText))), []);
});

test("extractStageArticleTitles also finds companion articles for shorter stage races", () => {
  const { extractStageArticleTitles } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "la-vuelta-femenina-stage1.wikitext"), "utf8");

  // Companion stage articles are not a Grand Tour convention: any race whose route
  // table links them gets a deep stage history for free.
  assert.deepEqual(JSON.parse(JSON.stringify(extractStageArticleTitles(rawText))), [
    "2026 La Vuelta Femenina, Stage 1 to Stage 7",
  ]);
});

test("extractStageRaceSnapshot builds a stage history from companion stage articles", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-stage2.wikitext"), "utf8");
  const companionText = fs.readFileSync(
    path.join(__dirname, "fixtures", "vuelta-a-espana-stages-1-11.wikitext"),
    "utf8",
  );

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText, [companionText])));

  assert.equal(snapshot.stages.length, 2);
  assert.deepEqual(
    snapshot.stages.map((stage) => [stage.number, stage.label, stage.date, stage.course, stage.standings.length]),
    [
      [1, "Stage 1", "22 August", "Monaco to Monaco", 5],
      [2, "Stage 2", "23 August", "Monaco to Manosque (France)", 5],
    ],
  );
  // The main article alone only publishes a winner column, so the depth here is the
  // whole point of reading the companion article.
  assert.equal(extractStageRaceSnapshot(rawText).stages[1].standings.length, 1);
  assert.equal(snapshot.latestStage.number, 2);
  assert.deepEqual(snapshot.latestStage.standings[1], { place: "2", rider: "Pau Miquel", countryCode: "ESP" });
});

test("extractStageRaceSnapshot keeps the main article's general classification over a companion copy", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-stage2.wikitext"), "utf8");
  const companionText = fs.readFileSync(
    path.join(__dirname, "fixtures", "vuelta-a-espana-stages-1-11.wikitext"),
    "utf8",
  );

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText, [companionText])));

  // The companion article repeats a stage 2 GC block still carrying the stage 1
  // leader time (10:57); the main article's classification table is the one whose
  // cumulative time agrees with the gaps below it.
  assert.equal(snapshot.generalClassification.standings[0].time, "4:58:40");
  assert.equal(snapshot.generalClassification.standings[1].gap, "+00:09");
  // A companion "Stage 1 Result" block must never be mistaken for the overall result.
  assert.deepEqual(snapshot.overallResult, []);
});

test("parseCyclingResultLine reads the positional country and time arguments", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const companionText = fs.readFileSync(
    path.join(__dirname, "fixtures", "vuelta-a-espana-stages-1-11.wikitext"),
    "utf8",
  );

  const [stageOne] = JSON.parse(JSON.stringify(extractStageRaceSnapshot("", [companionText]))).stages;

  assert.deepEqual(stageOne.standings, [
    { place: "1", rider: "Tadej Pogačar", countryCode: "SLO", time: "10:57" },
    { place: "2", rider: "Ethan Hayter", countryCode: "GBR" },
    { place: "3", rider: "Joshua Tarling", countryCode: "GBR", gap: "+00:04" },
    { place: "4", rider: "Callum Thornley", countryCode: "GBR", gap: "+00:05" },
    { place: "5", rider: "Christophe Laporte", countryCode: "FRA", gap: "+00:06" },
  ]);
});

test("buildStageSwitcherMarkup renders the whole route with only raced stages selectable", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  const html = buildStageSwitcherMarkup({
    id: "2026 Vuelta a España",
    title: "Vuelta a España",
    stageRace: {
      totalStages: 21,
      completedStages: 2,
      stages: [
        { number: 1, order: 1, label: "Stage 1", date: "22 August", winner: "Tadej Pogačar", standings: [{ place: "1", rider: "Tadej Pogačar" }] },
        { number: 2, order: 2, label: "Stage 2", date: "23 August", winner: "Matthew Brennan", standings: [{ place: "1", rider: "Matthew Brennan" }] },
      ],
    },
  });

  assert.equal((html.match(/class="stage-chip/g) || []).length, 21);
  assert.equal((html.match(/<button type="button" class="stage-chip/g) || []).length, 2);
  // The current stage is the one selected, and it is the only visible panel.
  assert.match(html, /data-stage-target="2026-vuelta-a-espana-stage-2"/);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.equal((html.match(/data-stage-panel role="tabpanel"[^>]*hidden/g) || []).length, 1);
  assert.match(html, /title="Not raced yet"/);
});

test("buildStageSwitcherMarkup distinguishes an unraced stage from one with no published result", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  // The 2026 Tour de France opened with a team time trial, so stage 1 has no rider
  // winner even though the race is long past it.
  const html = buildStageSwitcherMarkup({
    id: "2026 Tour de France",
    title: "Tour de France",
    stageRace: {
      totalStages: 4,
      completedStages: 3,
      stages: [
        { number: 2, order: 2, label: "Stage 2", winner: "Isaac del Toro", standings: [{ place: "1", rider: "Isaac del Toro" }] },
        { number: 3, order: 3, label: "Stage 3", winner: "Jonas Vingegaard", standings: [{ place: "1", rider: "Jonas Vingegaard" }] },
      ],
    },
  });

  assert.match(html, /title="No published result">1</);
  assert.match(html, /title="Not raced yet">4</);
});

test("buildStageSwitcherMarkup stays out of the way for a race with a single stage result", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();

  assert.equal(
    buildStageSwitcherMarkup({
      id: "2026 Tour of Britain Women",
      title: "Tour of Britain Women",
      stageRace: {
        totalStages: 5,
        completedStages: 1,
        stages: [{ number: 1, order: 1, label: "Stage 1", winner: "Lorena Wiebes", standings: [{ place: "1", rider: "Lorena Wiebes" }] }],
      },
    }),
    "",
  );
});

test("buildStageRaceCard shows the finish video only on the current stage panel", () => {
  const { buildStageRaceCard } = loadParserExports();
  const html = buildStageRaceCard(
    {
      id: "2026 Vuelta a España",
      title: "Vuelta a España",
      series: "Men's WorldTour",
      date: "22 August – 13 September 2026",
      location: "Spain",
      finishVideoUrl: "https://www.youtube.com/watch?v=IKmJHpLgGC8",
      stageRace: {
        totalStages: 21,
        completedStages: 2,
        stages: [
          { number: 1, order: 1, label: "Stage 1", winner: "Tadej Pogačar", standings: [{ place: "1", rider: "Tadej Pogačar" }] },
          { number: 2, order: 2, label: "Stage 2", winner: "Matthew Brennan", standings: [{ place: "1", rider: "Matthew Brennan" }] },
        ],
        generalClassification: { stageNumber: 2, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
        overallResult: [],
      },
    },
    { live: true },
  );

  assert.equal((html.match(/race-finish-link/g) || []).length, 1);
  const [, currentStagePanel = ""] = html.split('id="2026-vuelta-a-espana-stage-2"');
  assert.match(currentStagePanel, /race-finish-link/);
});

test("mergeStageRaceSnapshots keeps the deeper stage history when an official source has none", () => {
  const { mergeStageRaceSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };
  const official = {
    totalStages: 21,
    completedStages: 2,
    latestStage: { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "Matthew Brennan" }] },
    generalClassification: { stageNumber: 2, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    overallResult: [],
  };
  const parsed = {
    totalStages: 21,
    completedStages: 2,
    stages: [
      { number: 1, order: 1, label: "Stage 1", winner: "Tadej Pogačar", standings: [{ place: "1", rider: "Tadej Pogačar" }, { place: "2", rider: "Ethan Hayter" }] },
      { number: 2, order: 2, label: "Stage 2", winner: "Matthew Brennan", standings: [{ place: "1", rider: "Matthew Brennan" }, { place: "2", rider: "Pau Miquel" }] },
    ],
    latestStage: { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "Matthew Brennan" }] },
    generalClassification: { stageNumber: 2, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    overallResult: [],
  };

  const merged = mergeStageRaceSnapshots(official, parsed, race, new Date("2026-08-23T20:00:00.000Z"));

  assert.equal(merged.stages.length, 2);
  assert.equal(merged.stages[0].standings.length, 2);
});

function buildShallowStageRace() {
  return {
    id: "2026 Tour de France",
    pageTitle: "2026 Tour de France",
    title: "Tour de France",
    stageRace: {
      totalStages: 3,
      completedStages: 2,
      stages: [
        { number: 1, order: 1, label: "Stage 1", winner: "Jonas Vingegaard", standings: [{ place: "1", rider: "Jonas Vingegaard" }] },
        { number: 2, order: 2, label: "Stage 2", winner: "Isaac del Toro", standings: [{ place: "1", rider: "Isaac del Toro" }] },
      ],
    },
  };
}

test("buildStageSwitcherMarkup offers an on-demand load when a finished race is winner-only", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  const html = buildStageSwitcherMarkup(buildShallowStageRace());

  assert.match(html, /data-load-stage-results="2026 Tour de France"/);
  assert.match(html, /Load full stage results/);
});

test("buildStageSwitcherMarkup does not offer the load control on a live race", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  // Live races read their companion articles at build time, so a shallow history means
  // the source has nothing deeper, not that it went unfetched.
  const html = buildStageSwitcherMarkup(buildShallowStageRace(), { live: true });

  assert.doesNotMatch(html, /data-load-stage-results/);
  assert.doesNotMatch(html, /No fuller stage results/);
});

test("buildStageSwitcherMarkup drops the load control once every stage is deep", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  const race = buildShallowStageRace();
  race.stageRace.stages.forEach((stage) => {
    stage.standings = [
      { place: "1", rider: stage.winner },
      { place: "2", rider: "Second Rider" },
    ];
  });

  assert.doesNotMatch(buildStageSwitcherMarkup(race), /data-load-stage-results/);
});

test("buildStageSwitcherMarkup says so when a requested load found nothing deeper", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  const html = buildStageSwitcherMarkup(buildShallowStageRace(), { stageResultsRequested: true });

  assert.doesNotMatch(html, /data-load-stage-results/);
  assert.match(html, /No fuller stage results are published for this race\./);
});

test("findStageRaceById only resolves races already on the page", () => {
  const { findStageRaceById } = loadParserExports();
  const tourDeFrance = buildShallowStageRace();
  const data = {
    recentResults: [{ id: "2026 Hamburg Cyclassics", pageTitle: "2026 Hamburg Cyclassics", title: "Hamburg Cyclassics" }],
    finalizedStageRaces: [tourDeFrance],
    liveStageRaces: [],
  };

  assert.equal(findStageRaceById(data, "2026 Tour de France")?.pageTitle, "2026 Tour de France");
  // A race id cannot be turned into an arbitrary Wikipedia fetch.
  assert.equal(findStageRaceById(data, "Barack Obama"), null);
  assert.equal(findStageRaceById(data, ""), null);
  // A one-day race carries no stage history to deepen.
  assert.equal(findStageRaceById(data, "2026 Hamburg Cyclassics"), null);
});

test("getStageFinishVideoUrl keeps a whole-race video off earlier stages", () => {
  const { getStageFinishVideoUrl } = loadParserExports();
  // "2026 La Vuelta Femenina" is mapped to a single string: the video of the race
  // finishing, which belongs to the final stage and not to stage 1.
  const race = { pageTitle: "2026 La Vuelta Femenina" };

  assert.equal(getStageFinishVideoUrl(race, { number: 1 }), "");
  assert.equal(
    getStageFinishVideoUrl(race, { number: 1, finishVideoUrl: "https://www.youtube.com/watch?v=stage1" }),
    "https://www.youtube.com/watch?v=stage1",
  );
});

test("getStageFinishVideoUrl prefers a curated per-stage entry over a searched one", () => {
  const { getStageFinishVideoUrl } = loadParserExports();
  // The 2026 Tour de France pins a stage 1 video, because its team time trial is
  // the kind of stage the automatic search gets wrong.
  const race = { pageTitle: "2026 Tour de France" };

  assert.equal(
    getStageFinishVideoUrl(race, { number: 1, finishVideoUrl: "https://www.youtube.com/watch?v=searched" }),
    "https://www.youtube.com/watch?v=U5br6kI5ha8",
  );
});

test("buildStageSwitcherMarkup links each stage to its own finish video", () => {
  const { buildStageSwitcherMarkup } = loadParserExports();
  const html = buildStageSwitcherMarkup({
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    stageRace: {
      totalStages: 21,
      completedStages: 2,
      latestStage: { number: 2, standings: [{ place: "1", rider: "Matthew Brennan" }] },
      stages: [
        {
          number: 1,
          order: 1,
          label: "Stage 1",
          winner: "Tadej Pogačar",
          finishVideoUrl: "https://www.youtube.com/watch?v=stage1",
          standings: [{ place: "1", rider: "Tadej Pogačar" }, { place: "2", rider: "Ethan Hayter" }],
        },
        {
          number: 2,
          order: 2,
          label: "Stage 2",
          winner: "Matthew Brennan",
          finishVideoUrl: "https://www.youtube.com/watch?v=stage2",
          standings: [{ place: "1", rider: "Matthew Brennan" }, { place: "2", rider: "Pau Miquel" }],
        },
      ],
    },
  });

  const [, stageOnePanel = "", stageTwoPanel = ""] = html.split(/id="2026-vuelta-a-espana-stage-\d"/);
  assert.match(stageOnePanel, /watch\?v=stage1/);
  assert.doesNotMatch(stageOnePanel, /watch\?v=stage2/);
  assert.match(stageTwoPanel, /watch\?v=stage2/);
  assert.equal((html.match(/race-finish-link/g) || []).length, 2);
});

test("enrichStageFinishVideos leaves finished races alone and fills curated stages without a search", async () => {
  const { enrichStageFinishVideos } = loadParserExports();
  const buildRace = (completedStages) => ({
    pageTitle: "2026 Tour de France",
    startDate: new Date("2026-07-04T00:00:00.000Z"),
    endDate: new Date("2026-07-26T00:00:00.000Z"),
    stageRace: {
      totalStages: 21,
      completedStages,
      stages: [{ number: 1, order: 1, label: "Stage 1", standings: [{ place: "1", rider: "Team Visma" }] }],
    },
  });

  // Finished: skipped entirely, the way companion stage articles are.
  const finished = buildRace(21);
  await enrichStageFinishVideos([finished], new Date("2026-07-27T12:00:00.000Z"));
  assert.equal(finished.stageRace.stages[0].finishVideoUrl, undefined);

  // Live: the curated stage 1 entry resolves with no network call at all.
  const live = buildRace(1);
  await enrichStageFinishVideos([live], new Date("2026-07-05T12:00:00.000Z"));
  assert.equal(live.stageRace.stages[0].finishVideoUrl, "https://www.youtube.com/watch?v=U5br6kI5ha8");
});

test("BUILD_INFO reports the deployed commit when the platform provides one", () => {
  const previous = { ...process.env };
  try {
    process.env.RAILWAY_GIT_COMMIT_SHA = "8513703aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.RAILWAY_GIT_COMMIT_MESSAGE = "Bring the handoff docs up to date";
    process.env.RAILWAY_GIT_BRANCH = "main";
    const { BUILD_INFO } = loadParserExports();

    assert.equal(BUILD_INFO.commit, "8513703");
    assert.equal(BUILD_INFO.branch, "main");
    assert.equal(BUILD_INFO.marker, "Bring the handoff docs up to date");
    // The caller has to be able to tell a real marker from the fallback.
    assert.equal(BUILD_INFO.source, "railway-env");
  } finally {
    process.env = previous;
  }
});

test("BUILD_INFO admits when it is falling back to the hardcoded marker", () => {
  const previous = { ...process.env };
  try {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.RAILWAY_GIT_COMMIT_MESSAGE;
    delete process.env.RAILWAY_GIT_BRANCH;
    const { BUILD_INFO } = loadParserExports();

    assert.equal(BUILD_INFO.source, "hardcoded-fallback");
    assert.equal(BUILD_INFO.commit, "fefa813");
  } finally {
    process.env = previous;
  }
});

test("a race with no official provider is not mistaken for a slow lookup", async () => {
  const { loadOfficialStageRaceSnapshotWithinBudget } = loadParserExports();
  // Most races have no provider and resolve to null immediately. Recording those as
  // late lookups would make the budget look like it was tripping constantly.
  const lookup = loadOfficialStageRaceSnapshotWithinBudget(
    { pageTitle: "2026 Hamburg Cyclassics", startDate: new Date("2026-08-16"), endDate: new Date("2026-08-16") },
    2500,
  );

  const settled = await lookup.settled;
  assert.equal(settled, null);
  // Specifically not the timed-out sentinel, which is what would put it on the late list.
  assert.equal(typeof settled, "object");
  assert.equal(await lookup.pending, null);
});

test("applyLateOfficialSnapshots upgrades a race whose provider missed the budget", async () => {
  const { applyLateOfficialSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Giro d'Italia Women",
    startDate: new Date("2026-05-30T00:00:00.000Z"),
    endDate: new Date("2026-06-07T00:00:00.000Z"),
    stageRace: {
      totalStages: 9,
      completedStages: 9,
      generalClassification: { stageNumber: 9, standings: [{ place: "1", rider: "Demi Vollering" }] },
      overallResult: [],
    },
    resultStandings: [{ place: "1", rider: "Demi Vollering" }],
  };
  const officialSnapshot = {
    totalStages: 9,
    completedStages: 9,
    generalClassification: {
      stageNumber: 9,
      standings: [
        { place: "1", rider: "Demi Vollering" },
        { place: "2", rider: "Antonia Niedermaier" },
        { place: "3", rider: "Anna van der Breggen" },
      ],
    },
    overallResult: [],
  };

  applyLateOfficialSnapshots([{ race, pending: Promise.resolve(officialSnapshot) }]);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(race.stageRace.generalClassification.standings.length, 3);
  assert.equal(race.resultStandings.length, 3);
});

test("applyLateOfficialSnapshots leaves a race alone when the late result is not better", async () => {
  const { applyLateOfficialSnapshots } = loadParserExports();
  const richStandings = [
    { place: "1", rider: "Demi Vollering" },
    { place: "2", rider: "Antonia Niedermaier" },
    { place: "3", rider: "Anna van der Breggen" },
  ];
  const race = {
    pageTitle: "2026 Giro d'Italia Women",
    startDate: new Date("2026-05-30T00:00:00.000Z"),
    endDate: new Date("2026-06-07T00:00:00.000Z"),
    stageRace: {
      totalStages: 9,
      completedStages: 9,
      generalClassification: { stageNumber: 9, standings: richStandings },
      overallResult: [],
    },
  };

  // A null result (provider failed after the budget elapsed) must not clear the card.
  applyLateOfficialSnapshots([{ race, pending: Promise.resolve(null) }]);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(race.stageRace.generalClassification.standings.length, 3);
});

test("applyLateOfficialSnapshots swallows a rejected lookup", async () => {
  const { applyLateOfficialSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Giro d'Italia Women",
    startDate: new Date("2026-05-30T00:00:00.000Z"),
    endDate: new Date("2026-06-07T00:00:00.000Z"),
    stageRace: { totalStages: 9, completedStages: 9, generalClassification: { stageNumber: 9, standings: [] }, overallResult: [] },
  };

  // An unhandled rejection here would take the process down, since nothing awaits it.
  assert.doesNotThrow(() => applyLateOfficialSnapshots([{ race, pending: Promise.reject(new Error("upstream down")) }]));
  await new Promise((resolve) => setImmediate(resolve));
});

test("mergeLatestStageIntoHistory adds a stage the route table never listed", () => {
  const { mergeLatestStageIntoHistory } = loadParserExports();
  // The 2026 Tour's route table stops at stage 20, but letour.fr reports stage 21 five
  // deep. Without this the card's strip contradicted its own headline stage: the
  // provider's data was fetched, then dropped on the floor.
  const history = [
    { number: 19, order: 19, label: "Stage 19", standings: [{ place: "1", rider: "Thymen Arensman" }] },
    { number: 20, order: 20, label: "Stage 20", standings: [{ place: "1", rider: "Richard Carapaz" }] },
  ];
  const latestStage = {
    number: 21,
    label: "Stage 21",
    standings: [
      { place: "1", rider: "Mathieu van der Poel", time: "1:58:49" },
      { place: "2", rider: "Jasper Philipsen" },
    ],
  };

  const merged = mergeLatestStageIntoHistory(history, latestStage);

  assert.deepEqual(JSON.parse(JSON.stringify(merged.map((stage) => stage.number))), [19, 20, 21]);
  assert.equal(merged[2].standings.length, 2);
  assert.equal(merged[2].winner, "Mathieu van der Poel");
});

test("mergeLatestStageIntoHistory deepens a stage the route table only had a winner for", () => {
  const { mergeLatestStageIntoHistory } = loadParserExports();
  const history = [
    {
      number: 21,
      order: 21,
      label: "Stage 21",
      date: "26 July",
      course: "Thoiry to Paris",
      standings: [{ place: "1", rider: "Mathieu van der Poel" }],
    },
  ];
  const latestStage = {
    number: 21,
    standings: [
      { place: "1", rider: "Mathieu van der Poel", time: "1:58:49" },
      { place: "2", rider: "Jasper Philipsen" },
      { place: "3", rider: "Mads Pedersen" },
    ],
  };

  const [stage] = mergeLatestStageIntoHistory(history, latestStage);

  assert.equal(stage.standings.length, 3);
  // The route table's date and course are the only source for those, so they survive.
  assert.equal(stage.date, "26 July");
  assert.equal(stage.course, "Thoiry to Paris");
});

test("mergeLatestStageIntoHistory leaves a richer history entry alone", () => {
  const { mergeLatestStageIntoHistory } = loadParserExports();
  const history = [
    {
      number: 2,
      order: 2,
      label: "Stage 2",
      standings: [
        { place: "1", rider: "Matthew Brennan" },
        { place: "2", rider: "Pau Miquel" },
        { place: "3", rider: "Tadej Pogačar" },
      ],
    },
  ];

  // A thinner latestStage must not overwrite a companion-article podium.
  const merged = mergeLatestStageIntoHistory(history, {
    number: 2,
    standings: [{ place: "1", rider: "Matthew Brennan" }],
  });

  assert.equal(merged[0].standings.length, 3);
});

test("mergeLatestStageIntoHistory ignores an empty or unnumbered latest stage", () => {
  const { mergeLatestStageIntoHistory } = loadParserExports();
  const history = [{ number: 1, order: 1, label: "Stage 1", standings: [{ place: "1", rider: "Tadej Pogačar" }] }];

  assert.equal(mergeLatestStageIntoHistory(history, null).length, 1);
  assert.equal(mergeLatestStageIntoHistory(history, { number: 2, standings: [] }).length, 1);
  assert.equal(mergeLatestStageIntoHistory(history, { standings: [{ place: "1", rider: "X" }] }).length, 1);
});

function loadTttFixture() {
  return fs.readFileSync(path.join(__dirname, "fixtures", "tour-de-france-ttt-stage1.wikitext"), "utf8");
}

test("parseTeamReference reads the team code, edition and flag from a result cell", () => {
  const { parseTeamReference } = loadParserExports();
  const reference = parseTeamReference('{{flagicon|NED}} {{UCI team code|TVL men|2026}}');

  assert.equal(reference.code, "TVL men");
  assert.equal(reference.edition, "2026");
  assert.equal(reference.countryCode, "NED");
  assert.equal(parseTeamReference("[[Tadej Pogačar]]"), null);
});

test("extractCyclingResultBlocks survives a start tag that is not just title=", () => {
  const { extractCyclingResultBlocks, normalizeSearchText } = loadParserExports();
  // A team time trial writes {{Cyclingresult start|rider=no|title=...}}. Requiring
  // title= first dropped every TTT result on every race page.
  const titles = extractCyclingResultBlocks(loadTttFixture()).map((block) => normalizeSearchText(block.title));

  assert.ok(titles.some((title) => title.startsWith("stage 1 result")));
});

test("extractCyclingResultBlocks survives a start tag whose citation wraps onto a second line", () => {
  const { extractCyclingResultBlocks, normalizeSearchText } = loadParserExports();
  // Stage 2's citation contains a newline, so the closing braces are not on the same
  // line as the tag; the 2026 Tour lost two stages this way.
  const titles = extractCyclingResultBlocks(loadTttFixture()).map((block) => normalizeSearchText(block.title));

  assert.ok(titles.some((title) => title.startsWith("stage 2 result")));
});

test("extractCyclingResultBlocks bounds a block at the next start when its end tag is missing", () => {
  const { extractCyclingResultBlocks, parseCyclingResultStandings, normalizeSearchText } = loadParserExports();
  // The GC block after stage 2 in the fixture has no {{Cyclingresult end}}, exactly as
  // the live page does. Running it into the following block would serve stage 3's rows
  // under a general-classification title.
  const blocks = extractCyclingResultBlocks(loadTttFixture());
  const gc = blocks.find((block) => normalizeSearchText(block.title).startsWith("general classification after stage 2"));
  const standings = parseCyclingResultStandings(gc.body);

  assert.equal(standings.length, 2);
  assert.equal(standings[0].rider, "Jonas Vingegaard");
  // ...and stage 3 still parses as its own block rather than being swallowed.
  const stageThree = blocks.find((block) => normalizeSearchText(block.title).startsWith("stage 3 result"));
  assert.equal(parseCyclingResultStandings(stageThree.body)[0].rider, "Tadej Pogačar");
});

test("collectTeamReferences finds only teams that can actually be rendered", () => {
  const { collectTeamReferences } = loadParserExports();
  const references = collectTeamReferences(loadTttFixture());
  const codes = references.map((reference) => reference.code);

  assert.deepEqual(JSON.parse(JSON.stringify([...new Set(codes)].sort())), ["NCI", "TVL men", "UEX"]);
});

test("a team time trial renders team names once they are resolved, and is skipped when they are not", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const rawText = loadTttFixture();
  const teamNames = new Map([
    ["TVL men|2026", "Visma–Lease a Bike"],
    ["NCI|2026b", "Netcompany INEOS"],
    ["UEX|2026", "UAE Team Emirates XRG"],
  ]);

  const resolved = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText, [], teamNames)));
  const stageOne = resolved.stages.find((stage) => stage.number === 1);
  assert.deepEqual(stageOne.standings.map((entry) => entry.rider), [
    "Visma–Lease a Bike",
    "Netcompany INEOS",
    "UAE Team Emirates XRG",
  ]);
  assert.equal(stageOne.standings[0].countryCode, "NED");
  assert.equal(stageOne.standings[0].time, "21:47");
  assert.equal(stageOne.standings[1].gap, "+00:08");

  // Without resolved names there is only a team code, which is not worth rendering.
  const unresolved = extractStageRaceSnapshot(rawText);
  assert.equal(unresolved.stages.some((stage) => stage.number === 1), false);
});

test("extractRouteStages reads distance and stage type off every route row, raced or not", () => {
  const { extractRouteStages, extractStageRaceSnapshot } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-stage2.wikitext"), "utf8");

  const route = JSON.parse(JSON.stringify(extractRouteStages(rawText)));
  assert.equal(route.length, 3);
  assert.equal(route[0].distanceKm, 9);
  assert.equal(route[0].stageType, "individual-time-trial");
  assert.equal(route[1].distanceKm, 215.5);
  assert.equal(route[1].stageType, "hilly");
  // Stage 3 has not been raced: no winner, but its course is still described.
  assert.equal(route[2].winner, null);
  assert.equal(route[2].distanceKm, 166.7);
  assert.equal(route[2].stageType, "medium-mountain");

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText)));
  assert.equal(snapshot.stages.length, 2);
  assert.equal(snapshot.stages[1].distanceKm, 215.5);
  assert.equal(snapshot.stages[1].stageType, "hilly");
  assert.deepEqual(
    snapshot.route.map((entry) => [entry.number, entry.stageType, entry.distanceKm]),
    [[1, "individual-time-trial", 9], [2, "hilly", 215.5], [3, "medium-mountain", 166.7]],
  );
});

test("parseStageType reads the icon file name or the label, whichever a page provides", () => {
  const { parseStageType, parseStageDistanceKm } = loadParserExports();
  assert.equal(parseStageType(["[[File:Mountainstage.svg|20px|alt=|link=]]", ""]), "mountain");
  assert.equal(parseStageType(["[[File:Mediummountainstage.svg|20px]]", "Medium-mountain stage"]), "medium-mountain");
  assert.equal(parseStageType(["[[File:Plainstage.svg|link=|alt=|20x20px]]", "Flat stage"]), "flat");
  assert.equal(parseStageType(["", "[[Team time trial]]"]), "team-time-trial");
  assert.equal(parseStageType(["[[File:Time Trial.svg|20px]]", "[[Individual time trial]]"]), "individual-time-trial");
  assert.equal(parseStageType(["", "Hilly stage"]), "hilly");
  assert.equal(parseStageType(["", "Rest day"]), "");

  assert.equal(parseStageDistanceKm("{{convert|215.5|km|abbr=on}}"), 215.5);
  assert.equal(parseStageDistanceKm("166,7 km"), 166.7);
  assert.equal(parseStageDistanceKm("{{cvt|100|mi}}"), 160.9);
  assert.equal(parseStageDistanceKm("—"), null);
});

test("mergeStageRaceSnapshots gives a provider-supplied stage its route details", () => {
  const { mergeStageRaceSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };
  // lavuelta.es reports stage 3 before Wikipedia's route table has its winner, so the
  // stage arrives with standings only and has to pick up its distance and type.
  const official = {
    totalStages: 21,
    completedStages: 3,
    latestStage: { number: 3, label: "Stage 3", standings: [{ place: "1", rider: "Jakob Omrzel" }, { place: "2", rider: "Urko Berrade" }] },
    generalClassification: { stageNumber: 3, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    overallResult: [],
  };
  const parsed = {
    totalStages: 21,
    completedStages: 2,
    stages: [
      { number: 1, order: 1, label: "Stage 1", distanceKm: 9, stageType: "individual-time-trial", winner: "Tadej Pogačar", standings: [{ place: "1", rider: "Tadej Pogačar" }, { place: "2", rider: "Ethan Hayter" }] },
      { number: 2, order: 2, label: "Stage 2", distanceKm: 215.5, stageType: "hilly", winner: "Matthew Brennan", standings: [{ place: "1", rider: "Matthew Brennan" }, { place: "2", rider: "Pau Miquel" }] },
    ],
    route: [
      { number: 1, order: 1, label: "Stage 1", distanceKm: 9, stageType: "individual-time-trial" },
      { number: 2, order: 2, label: "Stage 2", distanceKm: 215.5, stageType: "hilly" },
      { number: 3, order: 3, label: "Stage 3", date: "24 August", course: "Gruissan to Font Romeu", distanceKm: 166.7, stageType: "medium-mountain" },
    ],
    latestStage: { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "Matthew Brennan" }] },
    generalClassification: { stageNumber: 2, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    overallResult: [],
  };

  const merged = JSON.parse(JSON.stringify(mergeStageRaceSnapshots(official, parsed, race, new Date("2026-08-24T20:00:00.000Z"))));

  assert.deepEqual(merged.stages.map((stage) => stage.number), [1, 2, 3]);
  assert.equal(merged.stages[2].distanceKm, 166.7);
  assert.equal(merged.stages[2].stageType, "medium-mountain");
  assert.equal(merged.stages[2].course, "Gruissan to Font Romeu");
  assert.equal(merged.stages[2].standings.length, 2);
  assert.equal(merged.latestStage.stageType, "medium-mountain");
  assert.equal(merged.route.length, 3);
});

test("buildStageProfileMarkup shows an obviously generic pictogram when no trace is known", () => {
  const { buildStageProfileMarkup } = loadParserExports();
  const html = buildStageProfileMarkup({ number: 5, stageType: "mountain", distanceKm: 155.9 });

  assert.match(html, /stage-profile is-generic/);
  assert.match(html, /data-stage-type="mountain"/);
  assert.match(html, /Mountain stage/);
  assert.match(html, /stage-profile-glyph/);
  assert.match(html, /no elevation profile is available/);
  assert.match(html, /data-unit-metric="155.9 km" data-unit-imperial="96.9 mi"/);
  assert.match(html, /data-unit-option="imperial"/);
  assert.doesNotMatch(html, /climbing/);
  assert.doesNotMatch(html, /stage-profile-area|stage-profile-peak|Elevation data|data-profile-toggle/);
  // Two stages of the same type draw the identical icon: nothing generic may look
  // like a real profile that happens to differ between days.
  const other = buildStageProfileMarkup({ number: 18, stageType: "mountain", distanceKm: 171 });
  assert.equal(html.match(/<svg[\s\S]*?<\/svg>/)[0], other.match(/<svg[\s\S]*?<\/svg>/)[0]);

  assert.match(buildStageProfileMarkup({ number: 1, stageType: "individual-time-trial", distanceKm: 9 }), /stage-profile-badge is-inline">ITT</);
  assert.match(buildStageProfileMarkup({ number: 6, stageType: "team-time-trial", distanceKm: 24.1 }), /stage-profile-badge is-inline">TTT</);
  // Nothing known about the course: no block at all, so the panel reads as before.
  assert.equal(buildStageProfileMarkup({ number: 2 }), "");
  // Distance alone still renders, just without a pictogram.
  const distanceOnly = buildStageProfileMarkup({ number: 2, distanceKm: 120 });
  assert.match(distanceOnly, /120 km/);
  assert.doesNotMatch(distanceOnly, /<svg/);
});

test("buildStageProfileMarkup prefers a measured trace and labels its summit and climbing", () => {
  const { buildStageProfileMarkup, buildStageSwitcherMarkup } = loadParserExports();
  const profile = {
    source: "komoot",
    distanceKm: 166.6,
    elevationGainM: 4527,
    minAltM: 113,
    maxAltM: 2137,
    points: [[0, 113], [40, 400], [80, 900], [120, 700], [166.6, 2137]],
  };
  const stage = { number: 12, stageType: "mountain", distanceKm: 166.6, profile };
  const html = buildStageProfileMarkup(stage);

  assert.match(html, /stage-profile is-measured/);
  assert.match(html, /Elevation data: komoot/);
  assert.match(html, /data-profile-toggle aria-expanded="false"/);
  // Axes: 500 m gridlines for a 2 km range, 50 km ticks for a 166 km stage, and the
  // finish altitude on the right-hand end marker.
  assert.match(html, /stage-profile-gridlabel[^>]*data-unit-metric="500 m"/);
  assert.match(html, /stage-profile-gridlabel[^>]*data-unit-metric="2,000 m"/);
  assert.match(html, /stage-profile-tick[^>]*data-unit-metric="100 km" data-unit-imperial="62.1 mi"/);
  // A tick that would collide with the finish marker is dropped.
  assert.doesNotMatch(html, /stage-profile-tick[^>]*data-unit-metric="150 km"/);
  assert.match(html, /stage-profile-end is-finish">Finish/);
  assert.match(html, /is-finish">Finish <span class="stage-profile-end-altitude"[^>]*data-unit-metric="2,137 m"/);
  assert.match(html, /<stop offset="0" stop-color="#c8102e">/);
  assert.match(html, /stage-profile-area" style="fill: url\(#stage-profile-gradient-12-1666\);"/);
  const named = buildStageProfileMarkup({ ...stage, course: "Vera to Calar Alto" });
  assert.match(named, /is-start"><strong>Vera<\/strong>/);
  assert.match(named, /is-finish"><strong>Calar Alto<\/strong>/);
  assert.doesNotMatch(html, /no elevation profile is available/);
  assert.match(html, /stage-profile-peak[^>]*data-unit-metric="2,137 m" data-unit-imperial="7,011 ft"/);
  assert.match(html, /data-unit-metric="4,527 m climbing" data-unit-imperial="14,852 ft climbing"/);
  // The summit is at the finish, so its label is clamped inside the canvas.
  assert.match(html, /left: 94\.0%/);

  const switcher = buildStageSwitcherMarkup({
    id: "2026 Vuelta a España",
    title: "Vuelta a España",
    stageRace: {
      totalStages: 21,
      stages: [
        { number: 11, order: 11, label: "Stage 11", stageType: "flat", distanceKm: 180, winner: "A", standings: [{ place: "1", rider: "A" }] },
        { ...stage, order: 12, label: "Stage 12", winner: "Jakob Omrzel", standings: [{ place: "1", rider: "Jakob Omrzel" }] },
      ],
    },
  }, { live: true });
  // The profile sits inside the stage panel, above the winner label.
  const firstFigure = switcher.indexOf('<figure class="stage-profile ');
  assert.ok(firstFigure >= 0 && firstFigure < switcher.indexOf("Stage 11 winner"));
  assert.equal((switcher.match(/<figure class="stage-profile /g) || []).length, 2);
});

test("buildStageProfileFromKomoot resamples a trace by distance and keeps its summit", () => {
  const { buildStageProfileFromKomoot, extractKomootTourReference } = loadParserExports();
  // Four fixes roughly 1.1 km apart along a meridian, climbing to a summit and back.
  const coordinates = {
    items: [
      { lat: 40, lng: -3, alt: 100.4 },
      { lat: 40.01, lng: -3, alt: 350 },
      { lat: 40.02, lng: -3, alt: 900.2 },
      { lat: 40.03, lng: -3, alt: 420 },
    ],
  };
  const profile = buildStageProfileFromKomoot({ distance: 3400, elevation_up: 1050.6, elevation_down: 730.2 }, coordinates);

  assert.equal(profile.source, "komoot");
  assert.equal(profile.distanceKm, 3.4);
  assert.equal(profile.elevationGainM, 1051);
  assert.equal(profile.elevationLossM, 730);
  assert.equal(profile.points.length, 120);
  assert.deepEqual(JSON.parse(JSON.stringify(profile.points[0])), [0, 100]);
  const { parseStageCourseEnds } = loadParserExports();
  assert.deepEqual(JSON.parse(JSON.stringify(parseStageCourseEnds("Vera to Calar Alto"))), { start: "Vera", finish: "Calar Alto" });
  assert.deepEqual(JSON.parse(JSON.stringify(parseStageCourseEnds("Monaco to Monaco"))), { start: "Monaco", finish: "Monaco" });
  assert.equal(parseStageCourseEnds("Barcelona"), null);
  assert.deepEqual(JSON.parse(JSON.stringify(profile.points[119])), [3.4, 420]);
  assert.equal(profile.maxAltM, 900);
  assert.equal(profile.minAltM, 100);
  assert.equal(buildStageProfileFromKomoot({}, { items: [] }), null);

  assert.deepEqual(
    JSON.parse(JSON.stringify(extractKomootTourReference('<iframe src="https://www.komoot.com/tour/3034130062/embed?share_token=aWHYO5Ej_tQ-9&amp;layout=lavuelta"></iframe>'))),
    { tourId: "3034130062", shareToken: "aWHYO5Ej_tQ-9" },
  );
  assert.equal(extractKomootTourReference("<html>no embed</html>"), null);
});

test("enrichStageProfiles fetches the organiser's trace for the current edition only, once", async () => {
  const { enrichStageProfiles, attachCachedStageProfiles, stageProfileCache } = loadParserExports();
  stageProfileCache.clear();
  const requested = [];
  const loadProfile = async (url) => {
    requested.push(url);
    return url.endsWith("/stage-2") ? null : { source: "komoot", distanceKm: 9, elevationGainM: 80, points: [[0, 10], [9, 40]] };
  };
  const buildRace = (pageTitle, year) => ({
    id: pageTitle,
    pageTitle,
    startDate: new Date(`${year}-08-22T00:00:00.000Z`),
    endDate: new Date(`${year}-09-13T00:00:00.000Z`),
    stageRace: {
      totalStages: 21,
      stages: [
        { number: 1, order: 1, label: "Stage 1", standings: [{ place: "1", rider: "A" }] },
        { number: 2, order: 2, label: "Stage 2", standings: [{ place: "1", rider: "B" }] },
        { number: 3, order: 3, label: "Stage 3", standings: [] },
      ],
    },
  });
  const now = new Date("2026-09-03T18:00:00.000Z");
  const vuelta = buildRace("2026 Vuelta a España", 2026);
  const lastYear = buildRace("2025 Vuelta a España", 2025);
  const other = buildRace("2026 Tour de Pologne", 2026);

  await enrichStageProfiles([vuelta, lastYear, other], now, { loadProfile });

  // Raced stages only, newest first; the site describes this year's race alone.
  assert.deepEqual(requested, ["https://www.lavuelta.es/en/stage-2", "https://www.lavuelta.es/en/stage-1"]);
  assert.equal(vuelta.stageRace.stages[0].profile.elevationGainM, 80);
  assert.equal(vuelta.stageRace.stages[1].profile, undefined);
  assert.equal(lastYear.stageRace.stages[0].profile, undefined);
  assert.equal(other.stageRace.stages[0].profile, undefined);

  // A second build is served from the cache: the hit is re-attached, the miss waits
  // out its retry window, and nothing is fetched.
  const rebuilt = buildRace("2026 Vuelta a España", 2026);
  await enrichStageProfiles([rebuilt], now, { loadProfile });
  assert.equal(requested.length, 2);
  assert.equal(rebuilt.stageRace.stages[0].profile.elevationGainM, 80);

  const reparsed = buildRace("2026 Vuelta a España", 2026);
  attachCachedStageProfiles(reparsed);
  assert.equal(reparsed.stageRace.stages[0].profile.elevationGainM, 80);
  stageProfileCache.clear();
});

test("enrichStageProfiles stops blocking at its budget and still applies a late trace", async () => {
  const { enrichStageProfiles, stageProfileCache } = loadParserExports();
  stageProfileCache.clear();
  let release;
  const loadProfile = () => new Promise((resolve) => { release = resolve; });
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
    stageRace: { totalStages: 21, stages: [{ number: 1, order: 1, label: "Stage 1", standings: [{ place: "1", rider: "A" }] }] },
  };

  await enrichStageProfiles([race], new Date("2026-09-03T18:00:00.000Z"), { loadProfile, budgetMs: 10 });
  assert.equal(race.stageRace.stages[0].profile, undefined);

  release({ source: "komoot", distanceKm: 9, elevationGainM: 80, points: [[0, 10], [9, 40]] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(race.stageRace.stages[0].profile.elevationGainM, 80);
  assert.equal(stageProfileCache.get("2026 Vuelta a España#1").profile.elevationGainM, 80);
  stageProfileCache.clear();
});
