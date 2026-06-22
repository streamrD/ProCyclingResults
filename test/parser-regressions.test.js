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
      extractTourDeFranceOfficialStageInfo,
      extractTourDeFranceStageAjaxUrl,
      extractTourDeFranceGeneralAjaxUrl,
      buildTourDeFranceOfficialSnapshot,
      fetchTourDeFranceOfficialSnapshot,
      buildRaceArticleQueries,
      scoreRaceArticle,
      selectRaceArticles,
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
