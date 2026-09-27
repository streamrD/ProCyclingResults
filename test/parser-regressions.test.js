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
  // It also lacks `__dirname` and `Buffer`, on purpose: resolve data paths inside
  // functions (from `process.cwd()`) and avoid `Buffer` in code the tests reach, or
  // the whole suite fails at load with a ReferenceError from inside the VM.
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
      extractStageLeadershipGcSnapshots,
      extractClassificationLeadership,
      parseWikiTableGrid,
      buildJerseyHoldersMarkup,
      extractClassificationStandings,
      extractCyclingResultBlocks,
      attachClassificationContenders,
      parseClassificationStandingsCaption,
      parseAthleteDetails,
      parseWorldChampionshipEliteEvents,
      parseWorldChampionshipMedalSummary,
      buildUpcomingCard,
      getCompetitionGroups,
      parseWorldChampionshipEventResult,
      enrichWorldChampionshipResults,
      partitionRaceBuckets,
      enrichOneDayRaceDayResults,
      isOneDayRaceAwaitingResult,
      selectHomepageWorldTourRecentCandidates,
      selectHomepageRecentStandingsTargets,
      HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT,
      WORLDTOUR_RECENT_RESULTS,
      buildRaceCard,
      buildRecentResultsBlock,
      buildContentSecurityPolicy,
      HOMEPAGE_CLIENT_SCRIPT,
      buildRecentRacesFragment,
      buildNationalChampionshipsStub,
      buildSeasonCalendarStub,
      getRaceArticleVariants,
      buildFinishVideoQuery,
      isLikelyFinishVideo,
      getFreshnessSensitiveRaces,
      buildRiderSeasonIndex,
      buildRiderSeasonsScript,
      buildCanonicalRiderNames,
      applyCanonicalRiderNames,
      foldRiderKey,
      extractRiderPageTitle,
      buildStandingEntry,
      buildHeroStatus,
      buildHeroMenuLabel,
      describeNextRace,
      buildSeasonStatusLine,
      loadPreviousSeasonWinners,
      attachPreviousSeasonWinners,
      buildCalendarChampionships,
      parseCyclingResultLine,
      isSameTimeMarker,
      parseSeasonRows,
      buildRiderMarkup,
      getRiderProfileUrl,
      buildRiderSlug,
      buildNationalChampionshipPodium,
      cleanWikiText,
      buildRaceArticleQueries,
      isLikelyRaceArticle,
      buildWorldChampionshipTag,
      scoreRaceArticle,
      selectRaceArticles,
      isCurrentEditionRaceArticle,
      buildFinishVideoQuery,
      parseYouTubeSearchVideos,
      isLikelyFinishVideo,
      selectFinishVideo,
      buildRaceCard,
      buildUpcomingCard,
      buildStageRaceCard,
      buildRaceNewsMarkup,
      getRaceFinishVideoUrl,
      isMultiDayRace,
      isRaceWithinScheduledLiveWindow,
      isStageRaceAwaitingFinalStage,
      isStageRaceShownLive,
      getStaticStageRaceSnapshot,
      partitionRaceBuckets,
      selectPreferredStageRaceSnapshot,
      hasFreshnessSensitiveRaceData,
      getRaceDataCacheTtlMs,
      getLiveRaceRefreshDelayMs,
      scheduleLiveRaceRefresh,
      shouldServeHomepageWarmup,
      isRaceWithinRacingHours,
      hasRaceEndedDaysAgo,
      getArticleCacheTtlMs,
      articleCache,
      peekRaceArticlePool,
      loadRaceArticlePool,
      getRaceResultsUrl,
      RACE_RESULT_SLUGS,
      indexWikiRevisions,
      FETCH_USER_AGENT,
      YOUTUBE_FETCH_USER_AGENT,
      parseNationalChampionshipsIndex,
      getCountryFlagEmojiByName,
      buildNationalChampionshipEventCard,
      buildNationalChampionshipsSection,
      groupNationalChampionshipsByContinent,
      getNationalChampionshipContinent,
      buildSeasonCalendar,
      buildSeasonCalendarSection,
      buildSeasonCloseout,
      buildSeasonCloseoutHero,
      describeCloseoutSeason,
      findSeasonOpening,
      resolveSeasonYear,
      getSeasonSources,
      renderMarkdown,
      getShareView,
      buildShareMetaTags,
      SHARE_VIEWS,
      buildNationalChampionshipMapMarkup,
      CONTINENT_MAP_DATA,
      cleanNationalChampionCell,
      isAuthorizedSiteEdit,
      buildSiteContentPage,
      buildSiteFooterLinks,
      SITE_CONTENT_PAGES,
      createRaceAnchorId,
      packSeasonCalendarRows,
      COUNTRY_NAME_ALPHA2,
      CONTINENT_BY_ALPHA2,
      getCompetitionGroups,
      buildRecentResultsBlock,
      extractStageArticleTitles,
      buildStageSwitcherMarkup,
      mergeStageRaceSnapshots,
      isStageRaceProgressPlausible,
      parseRouteStageDate,
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
      loadPersistedStageProfiles,
      getStageProfileSource,
      buildNextStageRowMarkup,
      buildPodiumMarkup,
      getStageStandingMetrics,
      buildNextStagePanelMarkup,
      getNextRouteStage,
      describeLiveRaceDay,
      buildLiveRaceDayNote,
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
      safeHttpUrl,
      normalizeArticleUrl,
      buildArticleItem,
      extractFeedItems,
      securityHeaders,
      sendJson,
      sendHtml,
      sendStaticFile,
      serializeJson,
      parseAcceptEncoding,
      chooseResponseEncoding,
      getCachedResponseBody,
      buildResponseCacheKey,
      takeApiRateToken,
      isRateLimitedApiPath,
      getClientAddress,
      isDebugPayloadAllowed,
      recordSiteEditFailure,

      fetchYouTubeFinishVideoUrl,
      fetchYouTubeApiSearchVideos,
      parseYouTubeIsoDurationSeconds,
      describeYouTubePublishedAge,
      resolveRaceFinishVideoUrl,
      finishVideoCache,
      finishVideoLookupLog,
      isFinishVideoLookupDue,
      loadPersistedFinishVideos,
      listFoundFinishVideos,
      listFinishVideoBacklogSubjects,
      enrichFinishVideoBacklog,
      getYouTubeQuotaDayStartMs,
      getStaticStageRaceSnapshotForTest: (pageTitle, endDateIso) =>
        getStaticStageRaceSnapshot({ pageTitle, endDate: new Date(endDateIso) }),
      logEvent,
      describeDataStatus,
      describeBuildFailure,
      refreshRaceDataInBackground,
      refreshRaceMetadataInBackground,
      getRaceDataCacheForTest: () => raceDataCache,
      getRaceMetadataCacheForTest: () => raceMetadataCache,
      // Function declarations are properties of the VM's global object, so a test can
      // stand in for a builder (buildRaceData, buildRaceMetadata) with no seam in
      // server.js; every loadParserExports() call is a fresh sandbox, so nothing leaks.
      stubFunctionForTest: (name, fn) => {
        globalThis[name] = fn;
      },
      findOverallRaceResult,
      extractFeedItems,
      fetchRaceArticles,
      fetchText,
      getWikiRevision,
      wikiRawCache,
      wikiRevisionIndex,
      OFFICIAL_STAGE_RACE_PROVIDERS,
      OFFICIAL_ONE_DAY_RESULT_PROVIDERS,
      findOfficialRaceProvider,
      matchesSeasonEdition,
      clearSeasonCaches,
      isArticleOnOrAfterRaceDay,
      buildRaceMetadata,
      SEASONS,
      seasonCaches: {
        articleCache,
        finishVideoCache,
        officialSnapshotCache,
        teamNameCache,
        worldChampionshipMissingPages,
        deferredGroupDataCaches,
        stageHistoryCache,
        stageProfileCache,
        seasonOpeningCache,
      },
      getSeasonYearForTest: () => SEASON_YEAR,
      setSeasonYearForTest: (year) => {
        SEASON_YEAR = year;
      },
      // The sandbox's fetch is what fetchText calls; swapping it lets a test feed a
      // fixture through the real request path without touching the network.
      setFetchForTest: (fetchImpl) => {
        globalThis.fetch = fetchImpl;
      },
      prepareResponseBody,
      getCachedResponseBody,
      sendPreparedBody,
      loadRequestedStageHistory,
      buildSeasonCalendarIcs,
      buildResultsAtomFeed,
      foldIcsLine,
      buildSeasonOpeningLine,
      buildCompetitionSection,
      buildHtmlPage,
    };`,
    sandbox,
  );

  return sandbox.__PCR_TEST__;
}

// Wikipedia-sourced rows now carry the rider's article title; the older expectations
// below describe the rest of the row and leave that field out.
function stripPageTitles(value) {
  return JSON.parse(JSON.stringify(value, (key, entry) => (key === "pageTitle" ? undefined : entry)));
}

test("extractStageRaceSnapshot reads stage and GC fallbacks from La Vuelta Femenina tables", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const fixturePath = path.join(__dirname, "fixtures", "la-vuelta-femenina-stage1.wikitext");
  const rawText = fs.readFileSync(fixturePath, "utf8");

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText)));

  assert.equal(snapshot.totalStages, 7);
  assert.equal(snapshot.completedStages, 1);
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
    number: 1,
    label: "Stage 1",
    standings: [{ place: "1", rider: "Noemi Rüegg", countryCode: "SUI" }],
    winner: "Noemi Rüegg",
    winnerCountryCode: "SUI",
  });
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
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
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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
  // A race in progress, dated against the real clock because buildRaceArticleQueries
  // reads it: the stage-winner query is the ninth and survives only the live cap (10),
  // not the settled one (8), so a fixed June date would fail once the race is over.
  const now = Date.now();
  const race = {
    title: "Giro d'Italia",
    pageTitle: "2026 Giro d'Italia",
    endDate: new Date(now + 10 * 24 * 60 * 60 * 1000),
    startDate: new Date(now - 10 * 24 * 60 * 60 * 1000),
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
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
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
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

test("parseWorldChampionshipEliteEvents reads the four elite events from the schedule tables", () => {
  const { parseWorldChampionshipEliteEvents, buildUpcomingCard } = loadParserExports();
  const raw = fs.readFileSync(path.join(__dirname, "fixtures", "uci-road-world-championships-2026.wikitext"), "utf8");
  const events = parseWorldChampionshipEliteEvents(
    raw,
    { pageTitle: "2026_UCI_Road_World_Championships", label: "UCI Road World Championships" },
    2026,
  );

  // The events are built inside the VM sandbox, so compare values, not prototypes.
  assert.deepEqual(
    JSON.parse(JSON.stringify(events.map((event) => [
      event.title,
      event.lane,
      event.startDate.toISOString().slice(0, 10),
      event.startTimeLocal,
      event.distanceKm,
      event.laps,
    ]))),
    [
      ["Elite women's time trial", "womens", "2026-09-20", "09:00", 39.2, 0],
      ["Elite men's time trial", "mens", "2026-09-20", "12:45", 39.2, 0],
      ["Elite women's road race", "womens", "2026-09-26", "09:00", 180.1, 8],
      ["Elite men's road race", "mens", "2026-09-27", "09:00", 273.4, 12],
    ],
  );
  // Under-23, junior and mixed-relay rows sit in the same tables and must not leak in.
  assert.equal(events.length, 4);
  assert.ok(events.every((event) => event.series === "UCI Road World Championships"));
  assert.ok(events.every((event) => event.countryCode === "CAN" && event.location === "Montreal, Canada"));
  assert.ok(events.every((event) => event.locationFromSchedule === true));
  assert.equal(events[3].pageTitle, "2026 UCI Road World Championships – Men's road race");

  const card = buildUpcomingCard(events[3]);
  assert.match(card, /data-championship="worlds"/);
  assert.match(card, /Start 09:00 local · 273.4\u00a0km · 12\u00a0laps/);
  assert.match(card, /27 September 2026 • Montreal, Canada/);
  assert.doesNotMatch(buildUpcomingCard(events[0]), /laps/);
});

test("getCompetitionGroups gives the Worlds their own section, men's events first", () => {
  const { parseWorldChampionshipEliteEvents, getCompetitionGroups } = loadParserExports();
  const raw = fs.readFileSync(path.join(__dirname, "fixtures", "uci-road-world-championships-2026.wikitext"), "utf8");
  const events = parseWorldChampionshipEliteEvents(raw, undefined, 2026);
  const worldTourRace = {
    pageTitle: "2026 Il Lombardia",
    title: "Il Lombardia",
    series: "Men's WorldTour",
    startDate: new Date("2026-10-10T00:00:00Z"),
    endDate: new Date("2026-10-10T00:00:00Z"),
  };
  const data = { upcomingRaces: [...events, worldTourRace], recentResults: [], liveStageRaces: [] };
  const groups = getCompetitionGroups(data, new Date("2026-09-07T12:00:00Z"));

  assert.deepEqual(
    JSON.parse(JSON.stringify(groups.map((group) => group.id))),
    ["mens-worldtour", "womens-worldtour", "world-championships"],
  );
  assert.equal(groups[2].badge, undefined);

  // From a week before the first elite event to three days after the last, the Worlds
  // lead the page and their menu button carries a badge.
  const order = (iso) => JSON.parse(JSON.stringify(getCompetitionGroups(data, new Date(iso)).map((group) => group.id)));
  assert.deepEqual(order("2026-09-13T12:00:00Z"), ["world-championships", "mens-worldtour", "womens-worldtour"]);
  assert.equal(getCompetitionGroups(data, new Date("2026-09-20T12:00:00Z"))[0].badge, "This week");
  assert.deepEqual(order("2026-09-30T12:00:00Z"), ["world-championships", "mens-worldtour", "womens-worldtour"]);
  assert.deepEqual(order("2026-10-01T12:00:00Z"), ["mens-worldtour", "womens-worldtour", "world-championships"]);
  const worlds = groups[2];
  assert.equal(worlds.tag, "Montreal, 20–27 September");
  assert.deepEqual(
    JSON.parse(JSON.stringify(worlds.upcomingRaces.map((race) => race.title))),
    ["Elite men's time trial", "Elite men's road race", "Elite women's time trial", "Elite women's road race"],
  );
  // The WorldTour lanes keep only their own races.
  assert.deepEqual(JSON.parse(JSON.stringify(groups[0].upcomingRaces.map((race) => race.title))), ["Il Lombardia"]);
  assert.equal(groups[1].upcomingRaces.length, 0);
  // With the events raced, the group is empty and its section is not rendered.
  const after = getCompetitionGroups({ upcomingRaces: [worldTourRace], recentResults: [], liveStageRaces: [] })[2];
  assert.equal(after.upcomingRaces.length, 0);
  assert.equal(after.tag, "");
});

function loadWorldsFixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function worldsEvent(overrides = {}) {
  return {
    pageTitle: "2026 UCI Road World Championships – Men's road race",
    title: "Elite men's road race",
    series: "UCI Road World Championships",
    lane: "mens",
    countryCode: "CAN",
    location: "Montreal, Canada",
    locationFromSchedule: true,
    date: "27 September 2026",
    startTimeLocal: "09:00",
    distanceKm: 273.4,
    laps: 12,
    winner: "",
    winnerCountryCode: "",
    second: "",
    secondCountryCode: "",
    third: "",
    thirdCountryCode: "",
    startDate: new Date("2026-09-27T00:00:00Z"),
    endDate: new Date("2026-09-27T00:00:00Z"),
    isCancelled: false,
    ...overrides,
  };
}

test("parseWorldChampionshipEventResult reads a road race podium and top five with gaps", () => {
  const { parseWorldChampionshipEventResult } = loadParserExports();
  const result = parseWorldChampionshipEventResult(loadWorldsFixture("uci-road-world-championships-2025-mens-road-race.wikitext"));

  assert.deepEqual(stripPageTitles(result.podium), [
    { rider: "Tadej Pogačar", countryCode: "SLO" },
    { rider: "Remco Evenepoel", countryCode: "BEL" },
    { rider: "Ben Healy", countryCode: "IRL" },
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.standings.map((entry) => [entry.place, entry.rider, entry.countryCode, entry.time, entry.gap]))),
    [
      ["1", "Tadej Pogačar", "SLO", "6:21:20", ""],
      ["2", "Remco Evenepoel", "BEL", "", "+01:28"],
      ["3", "Ben Healy", "IRL", "", "+02:16"],
      ["4", "Mattias Skjelmose", "DEN", "", "+02:53"],
      ["5", "Toms Skujiņš", "LAT", "", "+06:41"],
    ],
  );
});

test("parseWorldChampionshipEventResult keeps time-trial hundredths and the Diff column", () => {
  const { parseWorldChampionshipEventResult } = loadParserExports();
  const result = parseWorldChampionshipEventResult(loadWorldsFixture("uci-road-world-championships-2025-womens-time-trial.wikitext"));

  assert.equal(result.podium[0].rider, "Marlen Reusser");
  assert.equal(result.podium[0].countryCode, "SUI");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.standings.slice(0, 3).map((entry) => [entry.place, entry.rider, entry.time, entry.gap]))),
    [
      ["1", "Marlen Reusser", "43:09.34", ""],
      ["2", "Anna van der Breggen", "44:01.23", "+0:51.89"],
      ["3", "Demi Vollering", "44:14.07", "+1:04.73"],
    ],
  );
  assert.equal(result.standings.length, 5);
  // A page created before the race, with an empty infobox and no table, yields nothing.
  const empty = parseWorldChampionshipEventResult("{{Infobox cycling race report\n| first = \n| second = \n}}\n==Final classification==\n");
  assert.equal(empty.podium.length, 0);
  assert.equal(empty.standings.length, 0);
});

test("parseWorldChampionshipEventResult reads the 2019-23 layout: numbered medal templates, athlete-template riders, Tissot times", () => {
  const { parseWorldChampionshipEventResult } = loadParserExports();
  const result = parseWorldChampionshipEventResult(loadWorldsFixture("uci-road-world-championships-2023-mens-time-trial.wikitext"));

  assert.equal(result.podium[0].rider, "Remco Evenepoel");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.standings.map((entry) => [entry.place, entry.rider, entry.countryCode, entry.time, entry.gap]))),
    [
      ["1", "Remco Evenepoel", "BEL", "55:19.23", ""],
      ["2", "Filippo Ganna", "ITA", "", "+0:12.28"],
      ["3", "Josh Tarling", "GBR", "", "+0:48.20"],
      ["4", "Brandon McNulty", "USA", "", "+1:26.91"],
      ["5", "Wout van Aert", "BEL", "", "+1:37.23"],
    ],
  );
});

test("parseWorldChampionshipEventResult reads the 2026 layout: an Athlete column, bare nation templates, one Time column on road races", () => {
  const { parseWorldChampionshipEventResult } = loadParserExports();
  const rows = (result) =>
    JSON.parse(JSON.stringify(result.standings.map((entry) => [entry.place, entry.rider, entry.countryCode, entry.time, entry.gap])));

  // Time trial: "Rank !! Athlete !! Nation !! Time !! Time Gap", nations as {{BEL}} / {{GBR2}}.
  const timeTrial = parseWorldChampionshipEventResult(loadWorldsFixture("uci-road-world-championships-2026-mens-time-trial.wikitext"));
  assert.deepEqual(stripPageTitles(timeTrial.podium), [
    { rider: "Remco Evenepoel", countryCode: "BEL" },
    { rider: "Filippo Ganna", countryCode: "ITA" },
    { rider: "Paul Seixas", countryCode: "FRA" },
  ]);
  assert.deepEqual(rows(timeTrial), [
    ["1", "Remco Evenepoel", "BEL", "44:53.13", ""],
    ["2", "Filippo Ganna", "ITA", "45:50.44", "+0:57.31"],
    ["3", "Paul Seixas", "FRA", "46:06.17", "+1:13.04"],
    ["4", "Brandon McNulty", "USA", "46:18.40", "+1:25.27"],
    ["5", "Jakob Söderqvist", "SWE", "46:19.31", "+1:26.18"],
  ]);

  // Road race, same editors: a single Time column holding the winner's time and the
  // others' gaps, and a second table of DNFs beside it that must not be read.
  const roadRace = parseWorldChampionshipEventResult(loadWorldsFixture("uci-road-world-championships-2026-mens-under-23-road-race.wikitext"));
  assert.deepEqual(rows(roadRace), [
    ["1", "Ashlin Barry", "USA", "4:17:35", ""],
    ["2", "Héctor Álvarez", "ESP", "", "+00:53"],
    ["3", "Jesper Stiansen", "NOR", "", "s.t."],
    ["4", "Aubin Sparfel", "FRA", "", "s.t."],
    ["5", "Niels Driesen", "BEL", "", "+00:55"],
  ]);
  assert.equal(roadRace.standings[1].pageTitle, "Héctor Álvarez (cyclist)");
});

test("enrichWorldChampionshipResults asks for an event page from race day only and fills the podium", async () => {
  const { enrichWorldChampionshipResults, partitionRaceBuckets } = loadParserExports();
  const page = loadWorldsFixture("uci-road-world-championships-2025-mens-road-race.wikitext");
  const calls = [];
  const loader = async (title) => {
    calls.push(title);
    if (/Women's time trial/.test(title)) {
      throw new Error("Request failed: 404 Not Found");
    }
    return page;
  };
  const roadRace = worldsEvent();
  const timeTrial = worldsEvent({
    pageTitle: "2026 UCI Road World Championships – Women's time trial",
    title: "Elite women's time trial",
    lane: "womens",
    startDate: new Date("2026-09-20T00:00:00Z"),
    endDate: new Date("2026-09-20T00:00:00Z"),
  });

  // The day before: nothing is asked for.
  await enrichWorldChampionshipResults([roadRace, timeTrial], loader, new Date("2026-09-19T12:00:00Z"));
  assert.equal(calls.length, 0);
  assert.equal(roadRace.winner, "");

  // Race day for the time trial: it is asked for, misses, the championship article is
  // consulted for a medal row that is not there yet, and it stays upcoming as "today".
  await enrichWorldChampionshipResults([roadRace, timeTrial], loader, new Date("2026-09-20T15:00:00Z"));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    "2026 UCI Road World Championships – Women's time trial",
    "2026_UCI_Road_World_Championships",
  ]);
  assert.equal(timeTrial.winner, "");
  const buckets = partitionRaceBuckets([roadRace, timeTrial], new Date("2026-09-20T15:00:00Z"));
  assert.deepEqual(JSON.parse(JSON.stringify(buckets.upcomingRaces.map((race) => race.title))), ["Elite women's time trial", "Elite men's road race"]);
  assert.equal(buckets.recentOneDayResults.length, 0);

  // A missing page is not asked for again straight away; the championship article is,
  // because a medal row can appear on it minutes after the finish.
  await enrichWorldChampionshipResults([roadRace, timeTrial], loader, new Date("2026-09-20T15:05:00Z"));
  assert.deepEqual(
    JSON.parse(JSON.stringify(calls.filter((title) => /Women's time trial/.test(title)))),
    ["2026 UCI Road World Championships – Women's time trial"],
  );

  // Race day for the road race: the page exists and the podium lands.
  await enrichWorldChampionshipResults([roadRace, timeTrial], loader, new Date("2026-09-27T20:00:00Z"));
  assert.equal(roadRace.winner, "Tadej Pogačar");
  assert.equal(roadRace.winnerCountryCode, "SLO");
  assert.equal(roadRace.third, "Ben Healy");
  assert.equal(roadRace.resultStandings.length, 5);
  const later = partitionRaceBuckets([roadRace, timeTrial], new Date("2026-09-27T20:00:00Z"));
  assert.deepEqual(JSON.parse(JSON.stringify(later.recentOneDayResults.map((race) => race.title))), ["Elite men's road race"]);
  assert.equal(later.upcomingRaces.length, 0);
  // Once filled in, the page is not asked for again by this enrichment.
  await enrichWorldChampionshipResults([roadRace, timeTrial], loader, new Date("2026-09-28T09:00:00Z"));
  assert.ok(calls.every((title) => !/Men's road race/.test(title) || calls.filter((entry) => entry === title).length === 1));
});

test("a one-day race keeps a Today card on race day and takes its result from its own article", async () => {
  const { enrichOneDayRaceDayResults, isOneDayRaceAwaitingResult, partitionRaceBuckets, getFreshnessSensitiveRaces, buildUpcomingCard } =
    loadParserExports();
  const article = (withResult) => `{{Infobox cycling race report
| name = 2026 Il Lombardia
| date = 10 October 2026
}}
== Route ==
The race starts in Como.
${
  withResult
    ? `== Result ==
{{Cycling result start|title=Result}}
{{cyclingresult|1|[[Tadej Pogačar]]|SLO|{{UCI team code|UAD|2026}}|5h 58' 32"}}
{{cyclingresult|2|[[Remco Evenepoel]]|BEL|{{UCI team code|RBH|2026}}|+ 1' 22"}}
{{cyclingresult|3|[[Isaac del Toro]]|MEX|{{UCI team code|UAD|2026}}|+ 1' 22"}}
{{cyclingresult|4|[[Tom Pidcock]]|GBR|{{UCI team code|Q36|2026}}|+ 2' 05"}}
{{cyclingresult|5|[[Ben Healy]]|IRL|{{UCI team code|EFE|2026}}|+ 2' 05"}}
{{cyclingresult|6|[[Primož Roglič]]|SLO|{{UCI team code|RBH|2026}}|+ 2' 40"}}
{{Cycling result end}}`
    : ""
}
`;
  const oneDay = (title, iso, overrides = {}) => ({
    pageTitle: `2026 ${title}`,
    title,
    series: "Men's WorldTour",
    countryCode: "ITA",
    location: "Como to Bergamo",
    date: "10 October 2026",
    winner: "",
    winnerCountryCode: "",
    second: "",
    secondCountryCode: "",
    third: "",
    thirdCountryCode: "",
    startDate: new Date(`${iso}T00:00:00Z`),
    endDate: new Date(`${iso}T00:00:00Z`),
    ...overrides,
  });
  const lombardia = oneDay("Il Lombardia", "2026-10-10");
  const emilia = oneDay("Giro dell'Emilia", "2026-10-03", { winner: "Tadej Pogačar", winnerCountryCode: "SLO" });
  const guangxi = oneDay("Tour of Guangxi", "2026-10-13", { endDate: new Date("2026-10-18T00:00:00Z"), countryCode: "CHN" });
  const worlds = worldsEvent({ startDate: new Date("2026-10-10T00:00:00Z"), endDate: new Date("2026-10-10T00:00:00Z") });
  const races = [lombardia, emilia, guangxi, worlds];
  const calls = [];
  let page = article(false);
  const loader = async (title) => {
    calls.push(title);
    return page;
  };
  const titles = (list) => JSON.parse(JSON.stringify(list.map((race) => race.title)));

  // The day before: nothing is read; the race is simply upcoming.
  await enrichOneDayRaceDayResults(races, loader, new Date("2026-10-09T12:00:00Z"));
  assert.equal(calls.length, 0);
  let buckets = partitionRaceBuckets(races, new Date("2026-10-09T12:00:00Z"));
  assert.deepEqual(titles(buckets.upcomingRaces), ["Il Lombardia", "Elite men's road race", "Tour of Guangxi"]);
  assert.deepEqual(titles(buckets.recentOneDayResults), ["Giro dell'Emilia"]);

  // Race day, no result on the article yet: it is read (the Worlds event is left to its
  // own reader), the race keeps its upcoming card marked "Today", and the page stays on
  // the live cadence while it waits.
  const raceDay = new Date("2026-10-10T14:00:00Z");
  await enrichOneDayRaceDayResults(races, loader, raceDay);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), ["2026 Il Lombardia"]);
  assert.equal(lombardia.winner, "");
  buckets = partitionRaceBuckets(races, raceDay);
  assert.deepEqual(titles(buckets.upcomingRaces), ["Il Lombardia", "Elite men's road race", "Tour of Guangxi"]);
  assert.deepEqual(titles(buckets.recentOneDayResults), ["Giro dell'Emilia"]);
  assert.equal(isOneDayRaceAwaitingResult(lombardia, buckets.todayUtc, raceDay), true);
  assert.match(buildUpcomingCard({ ...lombardia, finishedToday: true }), /Today/);
  assert.equal(getFreshnessSensitiveRaces({ upcomingRaces: [{ ...lombardia, finishedToday: true }] }).length, 1);
  assert.equal(getFreshnessSensitiveRaces({ upcomingRaces: [{ ...lombardia, finishedToday: false }] }).length, 0);

  // Race day, the article now carries the result: the podium and top five land and
  // the race moves to the results.
  page = article(true);
  await enrichOneDayRaceDayResults(races, loader, new Date("2026-10-10T16:30:00Z"));
  assert.equal(lombardia.winner, "Tadej Pogačar");
  assert.equal(lombardia.winnerCountryCode, "SLO");
  assert.equal(lombardia.second, "Remco Evenepoel");
  assert.equal(lombardia.third, "Isaac del Toro");
  assert.equal(lombardia.resultStandings.length, 5);
  assert.equal(lombardia.resultSource, "wikipedia-race-article");
  buckets = partitionRaceBuckets(races, new Date("2026-10-10T16:30:00Z"));
  assert.deepEqual(titles(buckets.recentOneDayResults), ["Il Lombardia", "Giro dell'Emilia"]);
  assert.deepEqual(titles(buckets.upcomingRaces), ["Elite men's road race", "Tour of Guangxi"]);

  // The day after: nothing more is read, and the race stays in the results.
  const readSoFar = calls.length;
  await enrichOneDayRaceDayResults(races, loader, new Date("2026-10-11T09:00:00Z"));
  assert.equal(calls.length, readSoFar);
  buckets = partitionRaceBuckets(races, new Date("2026-10-11T09:00:00Z"));
  assert.deepEqual(titles(buckets.recentOneDayResults), ["Il Lombardia", "Giro dell'Emilia"]);

  // Had the season table still not named the winner the next morning, the article is
  // read once more so the card does not vanish; two days on it is left to the table.
  const lagging = oneDay("Il Lombardia", "2026-10-10");
  await enrichOneDayRaceDayResults([lagging], loader, new Date("2026-10-11T09:00:00Z"));
  assert.equal(calls.length, readSoFar + 1);
  assert.equal(lagging.winner, "Tadej Pogačar");
  assert.deepEqual(titles(partitionRaceBuckets([lagging], new Date("2026-10-11T09:00:00Z")).recentOneDayResults), ["Il Lombardia"]);
  await enrichOneDayRaceDayResults([oneDay("Il Lombardia", "2026-10-10")], loader, new Date("2026-10-12T09:00:00Z"));
  assert.equal(calls.length, readSoFar + 1);

  // Race day is the host country's: a race in Montreal is still today at 01:00 UTC the
  // next morning, and a race in Italy stays today until UTC midnight.
  const montreal = oneDay("Grand Prix Cycliste de Montréal", "2026-09-13", { countryCode: "CAN" });
  assert.deepEqual(titles(partitionRaceBuckets([montreal], new Date("2026-09-14T01:00:00Z")).upcomingRaces), ["Grand Prix Cycliste de Montréal"]);
  assert.deepEqual(titles(partitionRaceBuckets([montreal], new Date("2026-09-14T05:00:00Z")).upcomingRaces), []);
  assert.deepEqual(titles(partitionRaceBuckets([oneDay("Il Lombardia", "2026-10-10")], new Date("2026-10-10T22:30:00Z")).upcomingRaces), ["Il Lombardia"]);
});

test("homepage top-five reads count only one-day WorldTour races toward their limit", () => {
  const { selectHomepageWorldTourRecentCandidates, selectHomepageRecentStandingsTargets, HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT, WORLDTOUR_RECENT_RESULTS } =
    loadParserExports();
  const race = (title, series, start, end) => ({
    pageTitle: `2026 ${title}`,
    title,
    series,
    winner: "x",
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
  });
  const oneDay = (title, series, day) => race(title, series, day, day);
  const worlds = ["27", "26", "20"].map((day) => oneDay(`Worlds ${day}`, "UCI Road World Championships", `2026-09-${day}`));
  const stageRaces = [
    race("Vuelta a España", "Men's WorldTour", "2026-08-22", "2026-09-13"),
    race("Tour de Romandie Féminin", "Women's WorldTour", "2026-09-04", "2026-09-06"),
  ];
  const oneDays = [];
  for (let day = 1; day <= 14; day += 1) {
    oneDays.push(oneDay(`Men ${day}`, "Men's WorldTour", `2026-08-${String(day).padStart(2, "0")}`));
    oneDays.push(oneDay(`Women ${day}`, "Women's WorldTour", `2026-08-${String(day).padStart(2, "0")}`));
  }
  const candidates = selectHomepageWorldTourRecentCandidates([...worlds, ...oneDays], stageRaces);
  const targets = selectHomepageRecentStandingsTargets(candidates);

  // Twelve cards per section. The Worlds (their own reader) and the stage races
  // (enriched regardless) take none of the one-day races' places: at the old limit of
  // six those five left a single one-day race with a top five.
  assert.equal(HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT, 2 * WORLDTOUR_RECENT_RESULTS);
  assert.equal(candidates.length, 27);
  assert.equal(targets.length, 22);
  assert.ok(targets.every((entry) => entry.series !== "UCI Road World Championships" && entry.startDate.getTime() === entry.endDate.getTime()));
  assert.equal(targets[0].title, "Men 14");
  assert.equal(targets[targets.length - 1].title, "Women 4");
});

test("the championship article's medal summary stands in until an event gets its own page", async () => {
  const { parseWorldChampionshipMedalSummary, enrichWorldChampionshipResults } = loadParserExports();
  const championship = loadWorldsFixture("uci-road-world-championships-2026-time-trial-medals.wikitext");

  // Only the two time trials had been ridden; every other row is still empty.
  const summary = parseWorldChampionshipMedalSummary(championship);
  assert.deepEqual([...summary.keys()], [
    "2026 uci road world championships - men's time trial",
    "2026 uci road world championships - women's time trial",
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(summary.get("2026 uci road world championships - men's time trial"))),
    [
      { rider: "Remco Evenepoel", countryCode: "BEL", pageTitle: "Remco Evenepoel" },
      { rider: "Filippo Ganna", countryCode: "ITA", pageTitle: "Filippo Ganna" },
      { rider: "Paul Seixas", countryCode: "FRA", pageTitle: "Paul Seixas" },
    ],
  );
  // A piped medallist link keeps the article title, not the printed name.
  assert.equal(
    summary.get("2026 uci road world championships - women's time trial")[2].pageTitle,
    "Franziska Koch (cyclist)",
  );

  // Wikipedia had not created the men's time trial page by the evening of the race.
  const timeTrial = worldsEvent({
    pageTitle: "2026 UCI Road World Championships – Men's time trial",
    title: "Elite men's time trial",
    startDate: new Date("2026-09-20T00:00:00Z"),
    endDate: new Date("2026-09-20T00:00:00Z"),
  });
  const roadRace = worldsEvent();
  const loader = async (title) => {
    if (/Championships$/.test(title)) {
      return championship;
    }
    throw new Error("Request failed: 404 Not Found");
  };

  await enrichWorldChampionshipResults([timeTrial, roadRace], loader, new Date("2026-09-20T23:00:00Z"));
  assert.equal(timeTrial.winner, "Remco Evenepoel");
  assert.equal(timeTrial.winnerCountryCode, "BEL");
  assert.equal(timeTrial.third, "Paul Seixas");
  assert.equal(timeTrial.resultSource, "wikipedia-medal-summary");
  // The medal row is a podium, not a classification: no places 4-5 are invented.
  assert.equal(timeTrial.resultStandings, undefined);
  // A race that has not been ridden stays empty.
  assert.equal(roadRace.winner, "");
});

test("the Worlds header keeps the whole championship week as events are ridden", () => {
  const { buildWorldChampionshipTag } = loadParserExports();
  const event = (title, day) =>
    worldsEvent({
      pageTitle: `2026 UCI Road World Championships – ${title}`,
      title: `Elite ${title.toLowerCase()}`,
      startDate: new Date(`2026-09-${day}T00:00:00Z`),
      endDate: new Date(`2026-09-${day}T00:00:00Z`),
    });

  assert.equal(
    buildWorldChampionshipTag({
      recentResults: [event("Men's time trial", "20"), event("Women's time trial", "20")],
      upcomingRaces: [event("Women's road race", "26"), event("Men's road race", "27")],
    }),
    "Montreal, 20–27 September",
  );
  // Still right once everything has been ridden and nothing is upcoming.
  assert.equal(
    buildWorldChampionshipTag({
      recentResults: [event("Men's time trial", "20"), event("Men's road race", "27")],
      upcomingRaces: [],
    }),
    "Montreal, 20–27 September",
  );
});

test("a Worlds card searches and filters on its own event, not on the championship name", () => {
  const { buildRaceArticleQueries, isLikelyRaceArticle } = loadParserExports();
  const mensTimeTrial = worldsEvent({
    pageTitle: "2026 UCI Road World Championships – Men's time trial",
    title: "Elite men's time trial",
    winner: "Remco Evenepoel",
    startDate: new Date("2026-09-20T00:00:00Z"),
    endDate: new Date("2026-09-20T00:00:00Z"),
  });
  const womensTimeTrial = worldsEvent({
    pageTitle: "2026 UCI Road World Championships – Women's time trial",
    title: "Elite women's time trial",
    lane: "womens",
    winner: "Marlen Reusser",
    startDate: new Date("2026-09-20T00:00:00Z"),
    endDate: new Date("2026-09-20T00:00:00Z"),
  });

  // No query quotes the card's own phrase: "World Championships men's time trial"
  // appears in no headline, and the feed answered every such search with nothing.
  const queries = JSON.parse(JSON.stringify(buildRaceArticleQueries(mensTimeTrial)));
  assert.ok(queries.length > 0);
  assert.ok(queries.every((query) => !/"[^"]*championships[^"]*(time trial|road race)/i.test(query)));
  assert.ok(queries.some((query) => query.includes("Remco Evenepoel")));

  const article = (title) => ({ title, description: "", publisher: "Cyclingnews" });

  // Real headlines from the day, which the shared two-token rule had rejected.
  assert.equal(isLikelyRaceArticle(article("Who Won The Men Elite Individual Time Trial At The 2026 UCI Road Worlds? Full Results Here"), mensTimeTrial), true);
  assert.equal(isLikelyRaceArticle(article("Road World Championships: Peerless Remco Evenepoel makes it four in a row as Seixas takes impressive third in time trial"), mensTimeTrial), true);
  assert.equal(isLikelyRaceArticle(article("Road World Championships: Marlen Reusser storms to victory in elite women's time trial"), womensTimeTrial), true);

  // The other events of the same week are other cards.
  assert.equal(isLikelyRaceArticle(article("Road World Championships: Marlen Reusser storms to victory in elite women's time trial"), mensTimeTrial), false);
  assert.equal(isLikelyRaceArticle(article("Road World Championships: Pogacar solos clear to win the elite men's road race"), mensTimeTrial), false);
  assert.equal(isLikelyRaceArticle(article("Junior men's time trial at the World Championships goes to the home rider"), mensTimeTrial), false);
  assert.equal(isLikelyRaceArticle(article("Mixed team relay opens the World Championships time trial week"), mensTimeTrial), false);
  assert.equal(isLikelyRaceArticle(article("Evenepoel wins the Renewi Tour time trial"), mensTimeTrial), false);
});

test("Worlds results render in their section, men first, all four cards visible", () => {
  const { getCompetitionGroups, buildRaceCard, buildRecentResultsBlock, getFreshnessSensitiveRaces } = loadParserExports();
  const make = (title, lane, day, winner, code) =>
    worldsEvent({
      pageTitle: `2026 UCI Road World Championships – ${title}`,
      title: `Elite ${title.toLowerCase()}`,
      lane,
      winner,
      winnerCountryCode: code,
      startDate: new Date(`2026-09-${day}T00:00:00Z`),
      endDate: new Date(`2026-09-${day}T00:00:00Z`),
      resultStandings: [{ place: "1", rider: winner, countryCode: code, time: "6:21:20", gap: "" }],
    });
  const recentResults = [
    make("Men's road race", "mens", "27", "Tadej Pogačar", "SLO"),
    make("Women's road race", "womens", "26", "Pauline Ferrand-Prévot", "FRA"),
    make("Men's time trial", "mens", "20", "Remco Evenepoel", "BEL"),
    make("Women's time trial", "womens", "20", "Marlen Reusser", "SUI"),
  ];
  const worlds = getCompetitionGroups({ recentResults, liveStageRaces: [], upcomingRaces: [] }).find((group) => group.id === "world-championships");

  assert.deepEqual(
    JSON.parse(JSON.stringify(worlds.recentResults.map((race) => race.title))),
    ["Elite men's time trial", "Elite men's road race", "Elite women's time trial", "Elite women's road race"],
  );
  const block = buildRecentResultsBlock(worlds);
  assert.equal((block.match(/data-recent-slot/g) || []).length, 4);
  assert.doesNotMatch(block, /load-more-races/);
  assert.match(block, /<h3>Results<\/h3>/);

  const card = buildRaceCard(recentResults[0]);
  assert.match(card, /data-championship="worlds"/);
  assert.match(card, /🇸🇮/);
  assert.match(card, /Tadej Pogačar/);
  assert.match(card, /6:21:20/);

  // A race-day event still waiting for its result keeps the page on the live cadence.
  const awaiting = worldsEvent({ finishedToday: true });
  assert.equal(getFreshnessSensitiveRaces({ upcomingRaces: [awaiting] }).length, 1);
  assert.equal(getFreshnessSensitiveRaces({ upcomingRaces: [worldsEvent()] }).length, 0);
});

test("Worlds searches name the championship and reject the week's other events", () => {
  const { getRaceArticleVariants, buildFinishVideoQuery, isLikelyFinishVideo } = loadParserExports();
  const roadRace = worldsEvent({ winner: "Tadej Pogačar" });
  const timeTrial = worldsEvent({ title: "Elite women's time trial", pageTitle: "2026 UCI Road World Championships – Women's time trial", lane: "womens" });

  assert.deepEqual(JSON.parse(JSON.stringify(getRaceArticleVariants(roadRace))), [
    "UCI Road World Championships men's road race",
    "Road World Championships men's road race",
    "World Championships men's road race",
    "Worlds men's road race",
  ]);
  assert.equal(buildFinishVideoQuery(roadRace), "UCI Road World Championships men's road race 2026 highlights");
  assert.equal(buildFinishVideoQuery(timeTrial), "UCI Road World Championships women's time trial 2026 highlights");

  const video = (title) => ({ id: "x", title, channel: "Eurosport Cycling", verified: true, lengthSeconds: 480 });
  assert.equal(isLikelyFinishVideo(video("Men's Road Race Highlights | 2026 UCI Road World Championships Montréal"), roadRace), true);
  assert.equal(isLikelyFinishVideo(video("Men's Time Trial Highlights | 2026 UCI Road World Championships"), roadRace), false);
  assert.equal(isLikelyFinishVideo(video("Women's Road Race Highlights | 2026 UCI Road World Championships"), roadRace), false);
  assert.equal(isLikelyFinishVideo(video("Mixed Team Relay Highlights | 2026 UCI Road World Championships"), roadRace), false);
  assert.equal(isLikelyFinishVideo(video("Men's Road Race Highlights | 2025 UCI Road World Championships Kigali"), roadRace), false);
  assert.equal(isLikelyFinishVideo(video("Il Lombardia 2026 Highlights"), roadRace), false);
  assert.equal(isLikelyFinishVideo(video("Women's Elite Time Trial Highlights | 2026 UCI Road World Championships"), timeTrial), true);
  assert.equal(isLikelyFinishVideo(video("Men's Elite Time Trial Highlights | 2026 UCI Road World Championships"), timeTrial), false);
});

test("rider names link to ProCyclingStats, search by default and direct when verified", () => {
  const { buildRiderMarkup, getRiderProfileUrl, buildPodiumMarkup, buildNationalChampionshipPodium } = loadParserExports();

  const { buildRiderSlug } = loadParserExports();
  // The slug rule, checked against PCS from a browser: accents folded, every
  // non-letter a hyphen (so O'Connor is "o-connor"), Nordic and Polish letters mapped.
  assert.equal(buildRiderSlug("Tadej Pogačar"), "tadej-pogacar");
  assert.equal(buildRiderSlug("Ben O'Connor"), "ben-o-connor");
  assert.equal(buildRiderSlug("Jørgen Nordhagen"), "jorgen-nordhagen");
  assert.equal(buildRiderSlug("Felix Großschartner"), "felix-grossschartner");
  assert.equal(buildRiderSlug("Michał Kwiatkowski"), "michal-kwiatkowski");
  assert.equal(buildRiderSlug("Mathieu van der Poel"), "mathieu-van-der-poel");
  assert.equal(buildRiderSlug("Toms Skujiņš"), "toms-skujins");

  assert.equal(getRiderProfileUrl("Wout van Aert"), "https://www.procyclingstats.com/rider/wout-van-aert");
  assert.equal(getRiderProfileUrl("Tadej Pogačar"), "https://www.procyclingstats.com/rider/tadej-pogacar");
  // A corrected address wins over the rule.
  assert.equal(getRiderProfileUrl("Juan Ayuso"), "https://www.procyclingstats.com/rider/juan-ayuso-pesquera");
  // A hand-checked address survives the spelling being settled a different way:
  // the map is keyed by the rendered name, so it is matched on the folded key too.
  assert.equal(getRiderProfileUrl("Katarzyna Niewiadoma-Phinney"), "https://www.procyclingstats.com/rider/katarzyna-niewiadoma");
  assert.equal(getRiderProfileUrl("Katarzyna Niewiadoma Phinney"), "https://www.procyclingstats.com/rider/katarzyna-niewiadoma");
  assert.equal(getRiderProfileUrl("KATARZYNA NIEWIADOMA-PHINNEY"), "https://www.procyclingstats.com/rider/katarzyna-niewiadoma");
  // A name the map has never heard of still builds its address from the slug.
  assert.equal(getRiderProfileUrl("Enric Mas"), "https://www.procyclingstats.com/rider/enric-mas");
  // A team in a team time trial, or a lone surname, has no address to guess.
  // A dash in a team name makes PCS search return nothing; a space finds the team.
  assert.equal(getRiderProfileUrl("Visma–Lease a Bike"), "https://www.procyclingstats.com/search.php?term=Visma%20Lease%20a%20Bike");
  assert.equal(getRiderProfileUrl("Red Bull–Bora–Hansgrohe"), "https://www.procyclingstats.com/search.php?term=Red%20Bull%20Bora%20Hansgrohe");
  assert.equal(getRiderProfileUrl("UAE Team Emirates XRG"), "https://www.procyclingstats.com/search.php?term=UAE%20Team%20Emirates%20XRG");
  assert.equal(getRiderProfileUrl("Bredewold"), "https://www.procyclingstats.com/search.php?term=Bredewold");
  assert.equal(getRiderProfileUrl(""), "");

  const markup = buildRiderMarkup({ place: "2", rider: "Juan Ayuso", countryCode: "ESP", gap: "+01:28" });
  assert.match(markup, /<a class="rider-text rider-link" href="https:\/\/www\.procyclingstats\.com\/rider\/juan-ayuso-pesquera" target="_blank" rel="noreferrer" title="Juan Ayuso on ProCyclingStats" data-rider-key="juan ayuso">Juan Ayuso<\/a>/);
  assert.match(markup, /🇪🇸/);
  assert.match(markup, /standing-gap">\+01:28/);
  // Names are escaped inside the link as they were in the span.
  assert.match(buildRiderMarkup({ rider: "Ben O'Connor" }), /Ben O&#39;Connor<\/a>/);
  // A podium row and a national championship row carry the same link.
  assert.match(buildPodiumMarkup([{ place: "1", rider: "Tadej Pogačar", countryCode: "SLO" }]), /href="https:\/\/www\.procyclingstats\.com\/rider\/tadej-pogacar"/);
  assert.match(buildNationalChampionshipPodium({ podium: [{ place: "1", rider: "Artem Shmidt" }] }), /rider-link" href="https:\/\/www\.procyclingstats\.com\/rider\/artem-shmidt"/);
});

test("a cancelled stage in the route table is not a rider", () => {
  const { extractRouteStages, extractStageRaceSnapshot, buildStageSwitcherMarkup, getNextRouteStage } = loadParserExports();
  const raw = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-route-cancelled-stage3.wikitext"), "utf8");
  const route = extractRouteStages(raw);
  const stage3 = route.find((entry) => entry.stageNumber === 3);
  assert.equal(stage3.winner, null);
  assert.equal(stage3.cancelled, true);
  assert.match(stage3.cancellationNote, /^The stage was cancelled due to the weather conditions/);
  assert.equal(route.find((entry) => entry.stageNumber === 4).winner.rider, "Tadej Pogačar");

  const snapshot = extractStageRaceSnapshot(raw);
  assert.ok(!snapshot.stages.some((stage) => stage.number === 3));
  assert.ok(!JSON.stringify(snapshot.stages).includes("Stage cancelled"));
  assert.equal(snapshot.route.find((entry) => entry.number === 3).cancelled, true);
  assert.ok(snapshot.completedStages >= 4);

  const race = { id: "2026 Vuelta a España", title: "Vuelta a España", stageRace: snapshot };
  const markup = buildStageSwitcherMarkup(race, { live: true });
  assert.match(markup, /<span class="stage-chip is-cancelled" title="Stage 3 cancelled: The stage was cancelled due to the weather[^"]*"><s>3<\/s><\/span>/);
  assert.doesNotMatch(markup, /Stage cancelled<\/a>/);

  // Had stage 2 been the last one raced, the next stage would be 4, not the cancelled 3.
  const afterStage2 = { stageRace: { stages: snapshot.stages.filter((stage) => stage.number <= 2), route: snapshot.route } };
  assert.equal(getNextRouteStage(afterStage2).number, 4);
});

test("buildRiderSeasonIndex tallies podiums and stage wins under one accent-folded key", () => {
  const { buildRiderSeasonIndex, buildRiderSeasonsScript, foldRiderKey, buildRiderMarkup } = loadParserExports();
  const allRaces = [
    { winner: "Tadej Pogačar", winnerCountryCode: "SLO", second: "Remco Evenepoel", secondCountryCode: "BEL", third: "Ben Healy", thirdCountryCode: "IRL" },
    { winner: "Tadej Pogačar", winnerCountryCode: "SLO", second: "Jonas Vingegaard", secondCountryCode: "DEN", third: "", thirdCountryCode: "" },
    { winner: "", second: "", third: "" },
  ];
  const stageRaces = [
    {
      pageTitle: "2026 Tour de France",
      stageRace: { stages: [{ standings: [{ place: "1", rider: "Tadej Pogacar", countryCode: "SLO" }, { place: "2", rider: "Alessandro Romele", countryCode: "ITA" }] }, { standings: [{ rider: "Visma–Lease a Bike" }] }, { standings: [] }] },
    },
    { pageTitle: "2026 Tour de France", stageRace: { stages: [{ standings: [{ rider: "Tadej Pogacar" }] }] } },
  ];
  const index = buildRiderSeasonIndex(allRaces, stageRaces);

  assert.equal(foldRiderKey("Tadej Pogačar"), "tadej pogacar");
  assert.equal(foldRiderKey("Tadej Pogacar"), foldRiderKey("Tadej Pogačar"));
  assert.deepEqual(JSON.parse(JSON.stringify(index["tadej pogacar"])), { name: "Tadej Pogačar", countryCode: "SLO", wins: 2, podiums: 2, stageWins: 1, stagePodiums: 1, wikiTitle: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(index["remco evenepoel"])), { name: "Remco Evenepoel", countryCode: "BEL", wins: 0, podiums: 1, stageWins: 0, stagePodiums: 0, wikiTitle: "" });
  // A stage second place is a podium with no win.
  assert.deepEqual(JSON.parse(JSON.stringify(index["alessandro romele"])), { name: "Alessandro Romele", countryCode: "ITA", wins: 0, podiums: 0, stageWins: 0, stagePodiums: 1, wikiTitle: "" });
  // A team in a team time trial row is not a rider, and a race is counted once.
  assert.equal(Object.keys(index).some((key) => /visma/.test(key)), false);

  const script = buildRiderSeasonsScript({ "a b": { name: "A </script> B", wins: 1 } });
  assert.match(script, /^<script type="application\/json" id="rider-seasons">/);
  assert.doesNotMatch(script.slice(50), /<\/script>[\s\S]+<\/script>/);
  assert.match(script, /\\u003c\/script> B/);

  assert.match(buildRiderMarkup({ rider: "Tadej Pogačar", countryCode: "SLO" }), /data-rider-key="tadej pogacar"/);
});

test("a rider spelled with an extra surname in the GC keeps one tally", () => {
  const { buildRiderSeasonIndex } = loadParserExports();

  // The Vuelta's stage results said "Enric Mas" while its general classification
  // said "Enric Mas Nicolau", which used to leave the race leader's card empty.
  const index = buildRiderSeasonIndex(
    [{ winner: "Isaac del Toro", winnerCountryCode: "MEX", second: "Magnus Cort", secondCountryCode: "DEN", third: "" }],
    [
      {
        pageTitle: "2026 Vuelta a España",
        stageRace: {
          stages: [
            { standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP", pageTitle: "Enric Mas" }, { place: "2", rider: "Oscar Onley", countryCode: "GBR" }] },
            { standings: [{ place: "1", rider: "Tadej Pogačar", countryCode: "SLO" }, { place: "2", rider: "Enric Mas", countryCode: "ESP" }] },
          ],
          generalClassification: { standings: [{ place: "1", rider: "Enric Mas Nicolau", countryCode: "ESP" }, { place: "2", rider: "Isaac del Toro Romero", countryCode: "MEX" }] },
        },
      },
    ],
  );

  const leader = { name: "Enric Mas Nicolau", countryCode: "ESP", wins: 0, podiums: 0, stageWins: 1, stagePodiums: 2, wikiTitle: "Enric Mas" };
  assert.deepEqual(JSON.parse(JSON.stringify(index["enric mas nicolau"])), leader);
  // Both spellings answer with the same tally, each under the name its own row used.
  assert.deepEqual(JSON.parse(JSON.stringify(index["enric mas"])), { ...leader, name: "Enric Mas" });
  // A win recorded under the short spelling reaches the long one and is not doubled.
  assert.equal(index["isaac del toro romero"].wins, 1);
  assert.equal(index["isaac del toro"].wins, 1);
  // A rider with no longer spelling on the page is untouched, and neither is a
  // different rider who merely shares a first name.
  assert.equal(index["magnus cort"].podiums, 1);
  assert.equal("magnus cort nielsen" in index, false);
  assert.equal(index["oscar onley"].stagePodiums, 1);
  assert.equal(index["tadej pogacar"].stageWins, 1);
});

test("a rider the sources link to one article is one rider whatever they call them", () => {
  const { buildRiderSeasonIndex, buildCanonicalRiderNames } = loadParserExports();

  const index = buildRiderSeasonIndex(
    [],
    [
      {
        pageTitle: "2026 Tour de Suisse",
        stageRace: {
          stages: [
            {
              standings: [
                // Wikipedia links her twice under the name she races with now and
                // once under the old one; the classification shortens her first name.
                { place: "1", rider: "Kimberley Le Court-Pienaar", countryCode: "MRI", pageTitle: "Kimberley Le Court" },
                { place: "2", rider: "Oscar Onley", countryCode: "GBR", pageTitle: "Oscar Onley" },
                { place: "3", rider: "Ganna Filippo", countryCode: "ITA", pageTitle: "2026 Tour de Suisse – Stage 3" },
              ],
            },
            {
              standings: [
                { place: "1", rider: "Kim Le Court-Pienaar", countryCode: "MRI", pageTitle: "Kimberley Le Court" },
                { place: "2", rider: "Filippo Ganna", countryCode: "ITA", pageTitle: "2026 Tour de Suisse – Stage 3" },
              ],
            },
          ],
          generalClassification: {
            standings: [
              { place: "1", rider: "Kim Le Court-Pienaar", countryCode: "MRI", pageTitle: "Kim Le Court" },
              // The provider puts a first name in front of the one she races under.
              { place: "2", rider: "Edgar Oscar Onley", countryCode: "GBR" },
            ],
          },
        },
      },
    ],
  );
  const canonical = buildCanonicalRiderNames(index);

  // A shared article title joins two spellings no name rule could: "Kim" and
  // "Kimberley" share no first name, so only the link tells us it is one rider.
  assert.equal(canonical.get("kimberley le court pienaar"), "Kim Le Court-Pienaar");
  assert.equal(canonical.get("kim le court pienaar"), "Kim Le Court-Pienaar");
  assert.equal(index["kimberley le court pienaar"].stageWins, index["kim le court pienaar"].stageWins);
  assert.equal(index["kim le court pienaar"].stageWins, 2);
  // Wikipedia linked "Kimberley Le Court" twice and "Kim Le Court" once, and the
  // one it links most is the one to trust, not the first the build happened to meet.
  assert.equal(index["kim le court pienaar"].wikiTitle, "Kimberley Le Court");

  // An extra first name in front joins the same way an extra surname behind does.
  assert.equal(canonical.get("edgar oscar onley"), "Oscar Onley");
  assert.equal(index["edgar oscar onley"].stagePodiums, 1);

  // A mis-parsed link target with a digit in it is not a person and joins nobody,
  // so two riders who happen to share one stay apart.
  assert.equal(canonical.get("filippo ganna"), "Filippo Ganna");
  assert.equal(canonical.get("ganna filippo"), "Ganna Filippo");
  assert.notEqual(index["filippo ganna"], index["ganna filippo"]);
});

test("one spelling of a rider's name reaches every table on the card", () => {
  const { buildRiderSeasonIndex, buildCanonicalRiderNames, applyCanonicalRiderNames, foldRiderKey } = loadParserExports();
  const stageRaceOf = (race) => race.stageRace;

  const vuelta = {
    pageTitle: "2026 Vuelta a España",
    stageRace: {
      stages: [
        { label: "Stage 9", winner: "Enric Mas", standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP", pageTitle: "Enric Mas" }, { place: "2", rider: "Oscar Onley", countryCode: "GBR" }, { place: "3", rider: "Tadej Pogačar", countryCode: "SLO", pageTitle: "Tadej Pogačar" }] },
      ],
      route: [{ number: 3, winner: "Stage cancelled", cancelled: true }, { number: 9, winner: "Enric Mas" }],
      // A provider's snapshot puts its own copy of the last stage here, and it
      // arrives after the page is built, so it has to be settled too.
      latestStage: { label: "Stage 9", winner: "Enric Mas Nicolau", standings: [{ place: "1", rider: "Enric Mas Nicolau", countryCode: "ESP" }] },
      generalClassification: {
        leader: "Enric Mas Nicolau",
        standings: [
          { place: "1", rider: "Enric Mas Nicolau", countryCode: "ESP" },
          { place: "2", rider: "Tobias Johannessen", countryCode: "NOR", pageTitle: "Tobias Halland Johannessen" },
          // The official provider strips the accents that Wikipedia keeps.
          { place: "3", rider: "Tadej Pogacar", countryCode: "SLO" },
        ],
      },
      classificationLeaders: { entries: [{ key: "general", rider: "Enric Mas Nicolau", countryCode: "ESP" }, { key: "team", rider: "Decathlon CMA CGM" }] },
    },
  };
  const races = [vuelta, { pageTitle: "2026 Tour de France", stageRace: { stages: [{ standings: [{ place: "1", rider: "Tobias Halland Johannessen", countryCode: "NOR" }] }] } }];
  // Wikipedia's own season tables carry a mangled spelling too, so they are settled
  // with the rest rather than trusted as they are.
  const seasonRow = { winner: "Tadej Pogacar", second: "Enric Mas Nicolau", third: "Oscar Onley" };
  const index = buildRiderSeasonIndex([], races);

  // The article title decides, so the longer spelling wins where that is the name
  // Wikipedia carries and loses where it is not.
  const canonical = buildCanonicalRiderNames(index);
  assert.equal(canonical.get("enric mas nicolau"), "Enric Mas");
  assert.equal(canonical.get("enric mas"), "Enric Mas");
  assert.equal(canonical.get("tobias johannessen"), "Tobias Halland Johannessen");
  assert.equal(canonical.get("tadej pogacar"), "Tadej Pogačar");
  // A rider the page spells one way is in the map reading the way he already does.
  assert.equal(canonical.get("oscar onley"), "Oscar Onley");

  assert.equal(applyCanonicalRiderNames(index, races, [seasonRow]), 9);
  assert.equal(stageRaceOf(vuelta).latestStage.winner, "Enric Mas");
  assert.equal(stageRaceOf(vuelta).latestStage.standings[0].rider, "Enric Mas");
  assert.equal(seasonRow.winner, "Tadej Pogačar");
  assert.equal(seasonRow.second, "Enric Mas");
  assert.equal(seasonRow.third, "Oscar Onley");
  const { stageRace } = vuelta;
  assert.equal(stageRace.generalClassification.leader, "Enric Mas");
  assert.equal(stageRace.generalClassification.standings[0].rider, "Enric Mas");
  assert.equal(stageRace.generalClassification.standings[1].rider, "Tobias Halland Johannessen");
  assert.equal(stageRace.classificationLeaders.entries[0].rider, "Enric Mas");
  assert.equal(stageRace.generalClassification.standings[2].rider, "Tadej Pogačar");
  // Rows that already read the settled way, a team, and a cancelled stage's winner
  // cell are all left as they are.
  assert.equal(stageRace.stages[0].winner, "Enric Mas");
  assert.equal(stageRace.stages[0].standings[1].rider, "Oscar Onley");
  assert.equal(stageRace.classificationLeaders.entries[1].rider, "Decathlon CMA CGM");
  assert.equal(stageRace.route[0].winner, "Stage cancelled");
  assert.equal(stageRace.route[1].winner, "Enric Mas");

  // Both keys still answer, so a card opened from a page rendered before the
  // rename still finds the tally.
  assert.equal(foldRiderKey(stageRace.generalClassification.leader), "enric mas");
  assert.equal(index["enric mas nicolau"].stageWins, 1);
  assert.equal(applyCanonicalRiderNames(index, races, [seasonRow]), 0);
});

test("the rider's Wikipedia article title travels from the wikitext to the rider index", () => {
  const { parseAthleteDetails, extractRiderPageTitle, buildStandingEntry, parseSeasonRows, buildRiderSeasonIndex, parseWorldChampionshipEventResult } =
    loadParserExports();

  assert.equal(parseAthleteDetails("{{flagathlete|[[Ben Healy (cyclist)|Ben Healy]]|IRL}}").pageTitle, "Ben Healy (cyclist)");
  assert.equal(parseAthleteDetails("{{flagathlete|[[Tadej Pogačar]]|SLO}}").pageTitle, "Tadej Pogačar");
  assert.equal(parseAthleteDetails("Tadej Pogacar").pageTitle, "");
  assert.equal(extractRiderPageTitle("[[File:Flag.svg|20px]] [[Wout van Aert|W. van Aert]]"), "Wout van Aert");
  assert.equal(extractRiderPageTitle("[[2026 Tour de France&nbsp;– Stage 1#Result|1]]"), "2026 Tour de France – Stage 1");

  const entry = buildStandingEntry(2, { rider: "Ben Healy", countryCode: "IRL", pageTitle: "Ben Healy (cyclist)", gap: "+ 1' 28\"" });
  assert.equal(entry.pageTitle, "Ben Healy (cyclist)");
  assert.equal("pageTitle" in buildStandingEntry(1, "Tadej Pogačar", "SLO"), false);

  const seasonTable = [
    '{| class="wikitable plainrowheaders"',
    "|-",
    "! Race !! Date !! Winner !! Second !! Third",
    "|-",
    "! scope=\"row\" |{{Flagicon|BEL}} [[2026 Liège–Bastogne–Liège|Liège–Bastogne–Liège]]",
    "| 26 April",
    "| {{flagathlete|[[Tadej Pogačar]]|SLO}}",
    "| {{flagathlete|[[Ben Healy (cyclist)|Ben Healy]]|IRL}}",
    "| {{flagathlete|[[Tom Pidcock]]|GBR}}",
    "|}",
  ].join("\n");
  const [race] = parseSeasonRows(seasonTable, { pageTitle: "2026_UCI_World_Tour", label: "Men's WorldTour", winnerMode: "podium", dateIndex: 1, winnerIndex: 2, secondIndex: 3, thirdIndex: 4, statusStartIndex: 2 }, 2026);
  assert.equal(race.second, "Ben Healy");
  assert.equal(race.secondPageTitle, "Ben Healy (cyclist)");
  assert.equal(race.winnerPageTitle, "Tadej Pogačar");

  const index = buildRiderSeasonIndex([race], [
    { pageTitle: "2026 Tour de France", resultStandings: [{ place: "4", rider: "Paul Seixas", countryCode: "FRA", pageTitle: "Paul Seixas" }] },
  ]);
  assert.equal(index["ben healy"].wikiTitle, "Ben Healy (cyclist)");
  assert.equal(index["ben healy"].podiums, 1);
  // A rider seen only in a top five gets a title and no tally.
  assert.deepEqual(JSON.parse(JSON.stringify(index["paul seixas"])), { name: "Paul Seixas", countryCode: "FRA", wins: 0, podiums: 0, stageWins: 0, stagePodiums: 0, wikiTitle: "Paul Seixas" });

  const worlds = parseWorldChampionshipEventResult(fs.readFileSync(path.join(__dirname, "fixtures", "uci-road-world-championships-2025-mens-road-race.wikitext"), "utf8"));
  assert.equal(worlds.podium[2].pageTitle, "Ben Healy (cyclist)");
  assert.equal(worlds.standings[2].pageTitle, "Ben Healy (cyclist)");
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
  assert.deepEqual(stripPageTitles(snapshot.generalClassification.standings.slice(0, 3)), [
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

test("a finished race's 'Final general classification' table is the GC after the last stage", () => {
  const { extractClassificationTableGcSnapshots, extractStageRaceSnapshot } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "la-vuelta-femenina-2026-final-gc.wikitext"), "utf8");

  // The live article as captured on 2026-09-26: its only GC table is captioned "Final
  // general classification (1–10)", which the reader skipped, so the finished card fell
  // back to the leadership table's leader alone and showed three names.
  const snapshots = extractClassificationTableGcSnapshots(rawText);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].stageNumber, 7);
  assert.equal(snapshots[0].standings.length, 5);

  const snapshot = extractStageRaceSnapshot(rawText);
  assert.equal(snapshot.totalStages, 7);
  assert.equal(snapshot.completedStages, 7);
  assert.equal(snapshot.generalClassification.stageNumber, 7);
  assert.deepEqual(
    JSON.parse(JSON.stringify(snapshot.generalClassification.standings.map((entry) => [entry.place, entry.rider, entry.gap || entry.time]))),
    [
      ["1", "Paula Blasi", "22:17:03"],
      ["2", "Anna van der Breggen", "+00:24"],
      ["3", "Marion Bunel", "+00:49"],
      ["4", "Usoa Ostolaza", "+02:31"],
      ["5", "Juliette Berthet", "+02:36"],
    ],
  );
  // Without a stage count the caption cannot be placed on the race and is left alone.
  assert.equal(extractClassificationTableGcSnapshots(rawText.replace(/\|stages\s*=\s*7/, "|stages = ")).length, 0);
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
  const official = videos.find((video) => video.id === "tdfOffici21");
  assert.equal(official.channel, "Tour de France");
  assert.equal(official.lengthSeconds, 616);
  assert.equal(official.verified, true);
});

test("selectFinishVideo prefers the official race channel over region-locked broadcasters", () => {
  const { parseYouTubeSearchVideos, videos } = loadYouTubeFixtureVideos();
  void parseYouTubeSearchVideos;
  const { selectFinishVideo } = loadParserExports();
  const best = selectFinishVideo(videos, TDF_STAGE21_RACE);
  assert.equal(best.id, "tdfOffici21");
});

// The Data API fixtures describe the same eight videos as the search-page fixture, with
// publish dates relative to this clock so the derived "1 day ago" phrasing matches.
const TDF_STAGE21_API_NOW = new Date("2026-07-27T20:00:00Z");

function loadYouTubeApiFixtures() {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8"));
  return {
    search: read("youtube-api-search-tdf-stage21.json"),
    videos: read("youtube-api-videos-tdf-stage21.json"),
    channels: read("youtube-api-channels-tdf-stage21.json"),
  };
}

// Answers the three Data API endpoints from the fixtures and records every URL asked.
function createYouTubeApiStub(fixtures) {
  const urls = [];
  const fetchJson = async (url) => {
    urls.push(url);
    const { pathname } = new URL(url);
    if (pathname.endsWith("/search")) return fixtures.search;
    if (pathname.endsWith("/videos")) return fixtures.videos;
    if (pathname.endsWith("/channels")) return fixtures.channels;
    throw new Error(`Unexpected Data API path ${pathname}`);
  };
  return { fetchJson, urls };
}

test("fetchYouTubeApiSearchVideos maps Data API responses to the shape the search page yields", async () => {
  const { fetchYouTubeApiSearchVideos } = loadParserExports();
  const { videos: scraped } = loadYouTubeFixtureVideos();
  const stub = createYouTubeApiStub(loadYouTubeApiFixtures());

  const mapped = await fetchYouTubeApiSearchVideos("Tour de France 2026 stage 21 highlights", "test-api-key", stub.fetchJson, TDF_STAGE21_API_NOW);

  // Same id, decoded title, channel, runtime, age phrasing and verified flag for every video.
  const withoutPublishedAt = mapped.map(({ publishedAt, ...video }) => {
    assert.match(publishedAt, /^\d{4}-\d{2}-\d{2}T/);
    return video;
  });
  assert.deepEqual(JSON.parse(JSON.stringify(withoutPublishedAt)), JSON.parse(JSON.stringify(scraped)));
  assert.equal(mapped.find((video) => video.id === "tntStage210").title, "EPIC FINALE! | Men's Tour de France 2026 Stage 21 Race Highlights");
  assert.equal(mapped.find((video) => video.id === "shortClip00").verified, false);
});

test("fetchYouTubeFinishVideoUrl on the Data API selects the video the search page selects", async () => {
  const { fetchYouTubeFinishVideoUrl, selectFinishVideo } = loadParserExports();
  const { videos: scraped } = loadYouTubeFixtureVideos();
  const stub = createYouTubeApiStub(loadYouTubeApiFixtures());

  const url = await fetchYouTubeFinishVideoUrl(TDF_STAGE21_RACE, {
    apiKey: "test-api-key",
    fetchJson: stub.fetchJson,
    now: TDF_STAGE21_API_NOW,
  });

  assert.equal(url, `https://www.youtube.com/watch?v=${selectFinishVideo(scraped, TDF_STAGE21_RACE).id}`);
  assert.equal(url, "https://www.youtube.com/watch?v=tdfOffici21");
  // search.list first, then the two one-unit follow-ups; the key rides only as a query parameter.
  assert.deepEqual(
    stub.urls.map((requested) => new URL(requested).pathname),
    ["/youtube/v3/search", "/youtube/v3/videos", "/youtube/v3/channels"],
  );
  const search = new URL(stub.urls[0]);
  assert.equal(search.hostname, "www.googleapis.com");
  assert.equal(search.searchParams.get("q"), "Tour de France 2026 stage 21 highlights");
  assert.equal(search.searchParams.get("part"), "snippet");
  assert.equal(search.searchParams.get("type"), "video");
  assert.equal(search.searchParams.get("maxResults"), "10");
  stub.urls.forEach((requested) => assert.equal(new URL(requested).searchParams.get("key"), "test-api-key"));
});

test("fetchYouTubeFinishVideoUrl on the Data API still returns broadcaster videos when the follow-ups fail", async () => {
  const { fetchYouTubeFinishVideoUrl } = loadParserExports();
  const fixtures = loadYouTubeApiFixtures();
  const fetchJson = async (url) => {
    if (new URL(url).pathname.endsWith("/search")) return fixtures.search;
    throw new Error("Request failed: 403 Forbidden");
  };

  const url = await fetchYouTubeFinishVideoUrl(TDF_STAGE21_RACE, { apiKey: "test-api-key", fetchJson, now: TDF_STAGE21_API_NOW });

  // No runtime and no subscriber count, so the official channel cannot be vouched for
  // and the best trusted broadcaster wins instead of nothing.
  assert.equal(url, "https://www.youtube.com/watch?v=tntStage210");
});

test("parseYouTubeIsoDurationSeconds and describeYouTubePublishedAge read the API's formats", () => {
  const { parseYouTubeIsoDurationSeconds, describeYouTubePublishedAge } = loadParserExports();
  assert.equal(parseYouTubeIsoDurationSeconds("PT10M16S"), 616);
  assert.equal(parseYouTubeIsoDurationSeconds("PT1H2M3S"), 3723);
  assert.equal(parseYouTubeIsoDurationSeconds("P1DT2H"), 93600);
  assert.equal(parseYouTubeIsoDurationSeconds("PT48S"), 48);
  assert.equal(parseYouTubeIsoDurationSeconds("10:16"), 0);
  assert.equal(parseYouTubeIsoDurationSeconds(""), 0);

  const now = new Date("2026-07-27T20:00:00Z");
  assert.equal(describeYouTubePublishedAge("2026-07-27T19:30:00Z", now), "30 minutes ago");
  assert.equal(describeYouTubePublishedAge("2026-07-27T17:00:00Z", now), "3 hours ago");
  assert.equal(describeYouTubePublishedAge("2026-07-26T18:03:12Z", now), "1 day ago");
  assert.equal(describeYouTubePublishedAge("2026-07-10T18:00:00Z", now), "2 weeks ago");
  assert.equal(describeYouTubePublishedAge("2025-08-20T18:00:00Z", now), "11 months ago");
  assert.equal(describeYouTubePublishedAge("not a date", now), "");
});

test("resolveRaceFinishVideoUrl retries a miss every 20 minutes for six hours, then every six hours", async () => {
  const { resolveRaceFinishVideoUrl, finishVideoCache } = loadParserExports();
  finishVideoCache.clear();
  const start = Date.parse("2026-07-26T17:00:00Z");
  const minute = 60 * 1000;
  let calls = 0;
  let answer = "";
  const lookup = async () => {
    calls += 1;
    return answer;
  };
  const at = (minutes) => resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now: start + minutes * minute, lookup });

  assert.equal(await at(0), "");
  assert.equal(calls, 1);
  await at(10);
  assert.equal(calls, 1, "a miss ten minutes old is not searched again");
  await at(20);
  assert.equal(calls, 2, "a miss is retried after 20 minutes");
  for (let minutes = 40; minutes < 360; minutes += 20) {
    await at(minutes);
  }
  assert.equal(calls, 18, "18 searches in the first six hours");
  await at(360);
  await at(500);
  await at(699);
  assert.equal(calls, 18, "after six hours a miss waits six hours");
  await at(700);
  assert.equal(calls, 19);
  await at(1000);
  assert.equal(calls, 19);

  answer = "https://www.youtube.com/watch?v=tdfOffici21";
  assert.equal(await at(1060), answer);
  assert.equal(calls, 20);
  assert.equal(await at(1300), answer, "a hit is served from the cache");
  assert.equal(calls, 20);
  await at(1420);
  assert.equal(calls, 21, "a hit is searched again after six hours");
});

test("isLikelyFinishVideo rejects wrong stage, wrong year, previews, and unrelated races", () => {
  const { isLikelyFinishVideo } = loadParserExports();
  const { videos } = loadYouTubeFixtureVideos();
  const byId = Object.fromEntries(videos.map((video) => [video.id, video]));

  assert.equal(isLikelyFinishVideo(byId.tdfOffici21, TDF_STAGE21_RACE), true);
  assert.equal(isLikelyFinishVideo(byId.gcnWrongStg, TDF_STAGE21_RACE), false); // stage 20
  assert.equal(isLikelyFinishVideo(byId.nbcWrongYr0, TDF_STAGE21_RACE), false); // 2025
  assert.equal(isLikelyFinishVideo(byId.euroPreview, TDF_STAGE21_RACE), false); // preview
  assert.equal(isLikelyFinishVideo(byId.giroUnrelat, TDF_STAGE21_RACE), false); // different race
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
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
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage), {
    number: 5,
    label: "Stage 5",
    standings: [{ place: "1", rider: "Matthew Brennan" }],
    winner: "Matthew Brennan",
  });
  assert.deepEqual(stripPageTitles(snapshot.generalClassification), {
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

test("parseNationalChampionshipsIndex reads the Cyclingnews index as published", () => {
  const { parseNationalChampionshipsIndex } = loadParserExports();
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "cyclingnews-2026-road-national-champions-index.html"), "utf8");

  const parsed = parseNationalChampionshipsIndex(html);

  // The counts the live almanac showed on 2026-09-27, the day the page was captured.
  assert.equal(parsed.error, "");
  assert.equal(parsed.totalCountryCount, 105);
  assert.equal(parsed.reportingCountryCount, 83);
  assert.equal(parsed.completeCountryCount, 62);
  assert.equal(parsed.completedEventCount, 291);
  assert.equal(parsed.sourceLastModified, "2026-06-29T09:15:58+00:00");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows.find((row) => row.country === "Algeria"))), {
    country: "Algeria",
    meItt: "Yacine Hamza",
    meRoadRace: "Hamza Amari",
    weItt: "Nesrine Houili",
    weRoadRace: "Nesrine Houili",
  });
  // The page pads empty cells with a byte-order mark, which must read as "no champion".
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows.find((row) => row.country === "Afghanistan"))), {
    country: "Afghanistan",
    meItt: "",
    meRoadRace: "",
    weItt: "Fariba Hashimi",
    weRoadRace: "Fariba Hashimi",
  });
});

test("parseNationalChampionshipsIndex maps columns by the header row, not by position", () => {
  const { parseNationalChampionshipsIndex } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>WE Road Race</th><th>Country</th><th>Code</th><th>ME Road Race</th><th>WE ITT</th><th>ME ITT</th></tr>
      <tr><td>Kate Courtney</td><td>United States</td><td>USA</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Artem Schmidt</td></tr>
      <tr><td></td><td>Canada</td><td>CAN</td><td>Alison Jackson</td><td></td><td></td></tr>
    </table>`);

  assert.equal(parsed.error, "");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows)), [
    { country: "United States", meItt: "Artem Shmidt", meRoadRace: "Quinn Simmons", weItt: "Taylor Knibb", weRoadRace: "Kate Courtney" },
    { country: "Canada", meItt: "", meRoadRace: "Alison Jackson", weItt: "", weRoadRace: "" },
  ]);
});

test("parseNationalChampionshipsIndex reports a header row that lost a title column instead of guessing", () => {
  const { parseNationalChampionshipsIndex } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE Road Race</th></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Kate Courtney</td></tr>
    </table>`);

  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.totalCountryCount, 0);
  assert.equal(parsed.error, "National championships table is missing the WE ITT column.");
});

test("parseNationalChampionshipsIndex trusts position only for a headerless five-column table", () => {
  const { parseNationalChampionshipsIndex } = loadParserExports();
  const headerless = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><td>United States</td><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
    </table>`);
  assert.equal(headerless.error, "");
  assert.deepEqual(JSON.parse(JSON.stringify(headerless.rows)), [
    { country: "United States", meItt: "Artem Shmidt", meRoadRace: "Quinn Simmons", weItt: "Taylor Knibb", weRoadRace: "Kate Courtney" },
  ]);

  const sixColumns = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><td>United States</td><td>USA</td><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
    </table>`);
  assert.equal(sixColumns.rows.length, 0);
  assert.equal(sixColumns.error, "National championships table has no header row naming its columns.");
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
  assert.match(markup, /data-national-search/);
  assert.match(markup, /data-national-category="meRoadRace"/);
  assert.match(markup, /data-national-group-id="europe"/);
  assert.match(markup, /data-national-group-id="north-america"/);
  assert.doesNotMatch(markup, /data-national-group-id="asia"/);
  assert.match(markup, /Great Britain/);
  assert.match(markup, /data-champions=""/);
  assert.match(markup, /Confirmed dates for 2 of 3 federations/);
  assert.match(markup, /Next window: January 2027|Next window: June 2026/);
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
    "world-championships",
  ]);
  assert.equal(groups.some((group) => group.deferred), false);
  // The Worlds group exists for its upcoming cards only; with none it renders nothing.
  assert.equal(groups[2].upcomingRaces.length, 0);
  assert.equal(groups[2].recentResults.length, 0);
});

test("buildRecentResultsBlock ships the first row and lists the anchors of the rest for /api/recent-races", () => {
  const { buildRecentResultsBlock, buildRecentRacesFragment } = loadParserExports();
  const makeRace = (n) => ({
    id: `race-${n}`,
    series: "Men's WorldTour",
    title: `Race ${n}`,
    date: `June ${n}, 2026`,
    location: "Somewhere",
    winner: `Winner ${n}`,
  });
  const group = {
    id: "mens-worldtour",
    recentResults: [1, 2, 3, 4, 5, 6, 7].map(makeRace),
    recentGridClass: "competition-grid-three",
  };
  const markup = buildRecentResultsBlock(group);

  // Only the first row is in the page (S3, 2026-09-27); nothing is carried hidden.
  const slots = [...markup.matchAll(/<div\s+class="recent-race-slot"[\s\S]*?data-recent-race-id="([^"]+)"([\s\S]*?)>/g)];
  assert.deepEqual(slots.map((slot) => slot[1]), ["race-1", "race-2", "race-3"]);
  assert.ok(slots.every((slot) => !/\bhidden\b/.test(slot[2])), "no slot is carried hidden");
  assert.match(markup, /data-recent-anchor="race-race-1"/);
  assert.match(markup, /data-recent-total="7"/);
  assert.match(markup, /data-recent-anchors="\[&quot;race-race-1&quot;,&quot;race-race-2&quot;,&quot;race-race-3&quot;,&quot;race-race-4&quot;,&quot;race-race-5&quot;,&quot;race-race-6&quot;,&quot;race-race-7&quot;\]"/);
  assert.match(markup, /data-load-more-races="mens-worldtour"/);
  assert.doesNotMatch(markup, /data-recent-race-title="Race 4"/);

  // The next row after the last card the page holds.
  const next = buildRecentRacesFragment(group, { after: "race-race-3" });
  assert.deepEqual([next.from, next.to, next.total, next.done], [3, 6, 7, false]);
  assert.deepEqual([...next.html.matchAll(/data-recent-anchor="([^"]+)"/g)].map((m) => m[1]), ["race-race-4", "race-race-5", "race-race-6"]);
  const last = buildRecentRacesFragment(group, { after: "race-race-6" });
  assert.deepEqual([last.from, last.to, last.done], [6, 7, true]);
  // Every row through the one holding a linked card.
  const until = buildRecentRacesFragment(group, { after: "race-race-3", until: "race-race-7" });
  assert.deepEqual([until.from, until.to, until.done], [3, 7, true]);
  // An anchor the payload no longer has starts from the top; the client skips duplicates.
  const stale = buildRecentRacesFragment(group, { after: "race-gone" });
  assert.deepEqual([stale.from, stale.to], [0, 3]);
});

test("the report-only CSP allows the inlined client script by the hash of exactly what the page inlines", () => {
  const { buildContentSecurityPolicy, buildHtmlPage, HOMEPAGE_CLIENT_SCRIPT } = loadParserExports();
  const policy = buildContentSecurityPolicy();
  const file = fs.readFileSync(path.join(__dirname, "..", "assets", "site.js"), "utf8");
  assert.equal(HOMEPAGE_CLIENT_SCRIPT, file);
  const hash = require("crypto").createHash("sha256").update(file, "utf8").digest("base64");
  assert.match(policy, new RegExp("script-src 'self' 'sha256-" + hash.replace(/[+/=]/g, (c) => "\\" + c) + "' https://todd-umami\\.up\\.railway\\.app(;|$)"));
  // The element holds the file and nothing else, or the hash would not match.
  assert.match(String(buildHtmlPage), /<script>\$\{HOMEPAGE_CLIENT_SCRIPT\}<\/script>/);
  assert.match(policy, /report-uri \/api\/csp-report/);
  assert.match(policy, /style-src 'self' 'unsafe-inline'/);
  assert.match(policy, /connect-src 'self' https:\/\/todd-umami\.up\.railway\.app/);
});

test("the almanac and the calendar travel as stubs that keep their ids and name their fragment", () => {
  const { buildNationalChampionshipsStub, buildSeasonCalendarStub } = loadParserExports();
  const almanac = buildNationalChampionshipsStub();
  assert.match(almanac, /<section class="section national-section" id="national-championships" data-fragment-src="\/api\/national-championships">/);
  assert.match(almanac, /<h2>National Championships<\/h2>/);
  assert.doesNotMatch(almanac, /data-national-almanac/, "the binders wait for the real section");
  const calendar = buildSeasonCalendarStub();
  assert.match(calendar, /id="season-calendar" data-season-calendar data-fragment-src="\/api\/season-calendar" hidden>/);
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

const VUELTA_2026_RACE = {
  pageTitle: "2026 Vuelta a España",
  startDate: new Date("2026-08-22T00:00:00Z"),
  endDate: new Date("2026-09-13T00:00:00Z"),
};
const VUELTA_2026_ROUTE = [
  { number: 11, label: "Stage 11", date: "2 September" },
  { number: 12, label: "Stage 12", date: "3 September" },
  { number: 13, label: "Stage 13", date: "4 September" },
];

function buildVueltaStage12OfficialSnapshot() {
  return {
    totalStages: 21,
    completedStages: 12,
    _sourceId: "vuelta-a-espana-rankings",
    latestStage: {
      number: 12,
      label: "Stage 12",
      standings: [
        { place: "1", rider: "Jakob Omrzel" },
        { place: "2", rider: "Enric Mas" },
      ],
    },
    generalClassification: {
      stageNumber: 12,
      standings: [
        { place: "1", rider: "Enric Mas" },
        { place: "2", rider: "Primož Roglič" },
      ],
    },
    overallResult: [],
  };
}

// The evening stage 12 finished, the article's GC table was captioned "after stage 13"
// while its route table still dated stage 13 to the next day.
function buildVueltaMiscaptionedWikipediaSnapshot() {
  return {
    totalStages: 21,
    completedStages: 13,
    _sourceId: "wikipedia-raw",
    stages: [
      { number: 11, order: 11, label: "Stage 11", standings: [{ place: "1", rider: "Bryan Coquard" }] },
      { number: 12, order: 12, label: "Stage 12", standings: [{ place: "1", rider: "Jakob Omrzel" }] },
    ],
    route: VUELTA_2026_ROUTE,
    latestStage: {
      number: 12,
      label: "Stage 12",
      standings: [{ place: "1", rider: "Jakob Omrzel" }],
    },
    generalClassification: {
      stageNumber: 13,
      standings: [
        { place: "1", rider: "Enric Mas" },
        { place: "2", rider: "Primož Roglič" },
        { place: "3", rider: "Felix Gall" },
      ],
    },
    overallResult: [],
  };
}

test("selectPreferredStageRaceSnapshot rejects a GC captioned after a stage the calendar has not reached", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const merged = selectPreferredStageRaceSnapshot(
    buildVueltaStage12OfficialSnapshot(),
    buildVueltaMiscaptionedWikipediaSnapshot(),
    VUELTA_2026_RACE,
    new Date("2026-09-03T18:00:00Z"),
  );

  assert.equal(merged.completedStages, 12);
  assert.equal(merged.latestStage.number, 12);
  assert.equal(merged.generalClassification.stageNumber, 12);
  assert.equal(merged.generalClassification.leader, "Enric Mas");
  assert.equal(merged.provenance.snapshot, "vuelta-a-espana-rankings");
  assert.equal(merged.provenance.generalClassification, "vuelta-a-espana-rankings");
  assert.equal(merged.provenance.latestStage, "vuelta-a-espana-rankings");
  // The Wikipedia history and route still ride along; only the bogus claim is refused.
  assert.equal(merged.stages.map((stage) => stage.number).join(","), "11,12");
});

test("selectPreferredStageRaceSnapshot drops a mis-captioned GC rather than announce it when it is the only one", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const merged = selectPreferredStageRaceSnapshot(
    null,
    buildVueltaMiscaptionedWikipediaSnapshot(),
    VUELTA_2026_RACE,
    new Date("2026-09-03T18:00:00Z"),
  );

  assert.equal(merged.completedStages, 12);
  assert.equal(merged.latestStage.number, 12);
  assert.equal(merged.generalClassification, null);
});

test("selectPreferredStageRaceSnapshot accepts the same GC once its stage day arrives and the race ends", () => {
  const { selectPreferredStageRaceSnapshot } = loadParserExports();
  const onStageDay = selectPreferredStageRaceSnapshot(
    null,
    buildVueltaMiscaptionedWikipediaSnapshot(),
    VUELTA_2026_RACE,
    new Date("2026-09-04T16:00:00Z"),
  );
  assert.equal(onStageDay.generalClassification.stageNumber, 13);
  assert.equal(onStageDay.completedStages, 13);

  const afterTheRace = selectPreferredStageRaceSnapshot(
    null,
    { ...buildVueltaMiscaptionedWikipediaSnapshot(), generalClassification: { stageNumber: 21, standings: [{ place: "1", rider: "Enric Mas" }] } },
    VUELTA_2026_RACE,
    new Date("2026-09-20T12:00:00Z"),
  );
  assert.equal(afterTheRace.generalClassification.stageNumber, 21);
});

test("a final stage the route table omits is still plausible on its own day", () => {
  const { isStageRaceProgressPlausible, parseRouteStageDate } = loadParserExports();
  const race = {
    pageTitle: "2026 Tour de France",
    startDate: new Date("2026-07-04T00:00:00Z"),
    endDate: new Date("2026-07-26T00:00:00Z"),
  };
  const route = [{ number: 20, label: "Stage 20", date: "25 July" }];
  const finalDay = new Date("2026-07-26T17:00:00Z");

  assert.equal(isStageRaceProgressPlausible(21, race, route, finalDay), true);
  assert.equal(isStageRaceProgressPlausible(20, race, route, new Date("2026-07-24T17:00:00Z")), false);
  // Days elapsed bound a stage even without a dated route: stage 3 cannot exist on day 2.
  assert.equal(isStageRaceProgressPlausible(3, race, [], new Date("2026-07-05T17:00:00Z")), false);
  assert.equal(isStageRaceProgressPlausible(2, race, [], new Date("2026-07-05T17:00:00Z")), true);
  // A prologue is progress 0.5 and is fine on the opening day.
  assert.equal(isStageRaceProgressPlausible(0.5, race, [{ number: 0, label: "Prologue", date: "4 July" }], new Date("2026-07-04T17:00:00Z")), true);
  // Nothing has been raced before the start, and a one-day race is never bounded.
  assert.equal(isStageRaceProgressPlausible(1, race, [], new Date("2026-07-03T17:00:00Z")), false);
  assert.equal(
    isStageRaceProgressPlausible(1, { startDate: race.startDate, endDate: race.startDate }, [], new Date("2026-07-03T17:00:00Z")),
    true,
  );

  assert.equal(parseRouteStageDate("3 September", 2026)?.toISOString(), "2026-09-03T00:00:00.000Z");
  assert.equal(parseRouteStageDate("Saturday 4 July", 2026)?.toISOString(), "2026-07-04T00:00:00.000Z");
  assert.equal(parseRouteStageDate("July 5", 2026)?.toISOString(), "2026-07-05T00:00:00.000Z");
  assert.equal(parseRouteStageDate("6 Sept 2025", 2026)?.toISOString(), "2025-09-06T00:00:00.000Z");
  assert.equal(parseRouteStageDate("TBA", 2026), null);
  assert.equal(parseRouteStageDate("", 2026), null);
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

test("selectPreferredStageRaceSnapshot keeps a GC one stage behind a newer stage, labelled by its own stage", () => {
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
  // Stage 2 is in but its GC is not yet: the stage-1 GC stays (the card labels it
  // "Overall after stage 1") instead of the card saying nothing is available.
  assert.equal(preferred.generalClassification.stageNumber, 1);
  assert.equal(preferred.generalClassification.standings.length, 2);
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

test("a stage race on its last day is live until the final stage is in, then completed", () => {
  const { isStageRaceAwaitingFinalStage, isStageRaceShownLive } = loadParserExports();
  const race = (completedStages) => ({
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00Z"),
    endDate: new Date("2026-09-13T00:00:00Z"),
    stageRace: { totalStages: 21, completedStages },
  });
  const lastDay = new Date("2026-09-13T00:00:00Z");

  assert.equal(isStageRaceShownLive(race(20), lastDay), true);
  assert.equal(isStageRaceAwaitingFinalStage(race(20), lastDay), true);
  assert.equal(isStageRaceShownLive(race(21), lastDay), false);
  assert.equal(isStageRaceAwaitingFinalStage(race(21), lastDay), false);
  // Mid-race the scheduled window still keeps it live, and the day after it is only completed.
  assert.equal(isStageRaceShownLive(race(21), new Date("2026-09-10T00:00:00Z")), true);
  assert.equal(isStageRaceAwaitingFinalStage(race(20), new Date("2026-09-14T00:00:00Z")), false);
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
  const { hasFreshnessSensitiveRaceData, getRaceDataCacheTtlMs: getTtlAt } = loadParserExports();
  // Racing hours in the host country: 15:00 in Paris for races without a country.
  const afternoon = new Date("2026-05-10T13:00:00.000Z");
  const getRaceDataCacheTtlMs = (data) => getTtlAt(data, afternoon);

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
  // The stage section shows the stage time, with the stage gap derived from the two
  // times beside it — not the GC gap, even though the two happen to agree here.
  assert.match(stageSection, /Marlen Reusser.*32:42<\/span><span class="standing-delta">\+01:04<\/span>/s);
  assert.doesNotMatch(stageSection, /standing-gap">\+01:04/);
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
  assert.deepEqual(stripPageTitles(snapshot.latestStage.standings[1]), { place: "2", rider: "Pau Miquel", countryCode: "ESP", sameTime: true });
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

  assert.deepEqual(stripPageTitles(stageOne.standings), [
    { place: "1", rider: "Tadej Pogačar", countryCode: "SLO", time: "10:57" },
    { place: "2", rider: "Ethan Hayter", countryCode: "GBR", sameTime: true },
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

test("resolveRaceFinishVideoUrl stops searching at the daily cap and keeps what it has", async () => {
  const { resolveRaceFinishVideoUrl, finishVideoCache, finishVideoLookupLog } = loadParserExports();
  finishVideoCache.clear();
  const now = Date.parse("2026-07-26T17:00:00Z");
  let calls = 0;
  const lookup = async () => {
    calls += 1;
    return "https://www.youtube.com/watch?v=found";
  };
  for (let index = 0; index < 90; index += 1) {
    finishVideoLookupLog.push(now - index * 60 * 1000);
  }
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now, lookup }), "");
  assert.equal(calls, 0, "the 91st lookup of the day is not made");
  // A day later the window has rolled on.
  const later = now + 25 * 60 * 60 * 1000;
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now: later, lookup }), "https://www.youtube.com/watch?v=found");
  assert.equal(calls, 1);
  assert.equal(finishVideoLookupLog.length, 1, "the log forgets lookups older than a day");
});

test("a failed lookup is retried after 20 minutes in the backlog too, and pauses the backlog for an hour", async () => {
  const { resolveRaceFinishVideoUrl, enrichFinishVideoBacklog, isFinishVideoLookupDue, finishVideoCache, finishVideoLookupLog } =
    loadParserExports();
  finishVideoCache.clear();
  finishVideoLookupLog.length = 0;
  const now = Date.parse("2026-09-27T12:00:00Z");
  const minute = 60 * 1000;
  let calls = 0;
  // A network failure; a quota refusal (429/403) pauses until the quota day turns.
  const failing = async () => {
    calls += 1;
    throw new Error("socket hang up");
  };
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now, lookup: failing, backlog: true }), "");
  const cached = finishVideoCache.get("2026 Tour de France|21");
  assert.equal(cached.error, true);
  assert.equal(isFinishVideoLookupDue(cached, now + 10 * minute, true), false);
  assert.equal(isFinishVideoLookupDue(cached, now + 20 * minute, true), true, "an error is not a week-long miss");
  assert.equal(isFinishVideoLookupDue(cached, now + 20 * minute, false), true);

  // The backlog pass waits an hour after a failure before asking about anything.
  const race = {
    pageTitle: "2026 Tour de Pologne",
    title: "Tour de Pologne",
    startDate: new Date("2026-08-24T00:00:00Z"),
    endDate: new Date("2026-08-30T00:00:00Z"),
    stageRace: { totalStages: 2, completedStages: 2, latestStage: { number: 2 }, stages: [1, 2].map((n) => ({ number: n, label: `Stage ${n}`, standings: [{ place: "1", rider: "R" }] })) },
  };
  let summary = await enrichFinishVideoBacklog([race], new Date(now + 21 * minute), { apiKey: "test", lookup: failing });
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), { known: 0, pending: 2, searched: 0, found: 0 });
  summary = await enrichFinishVideoBacklog([race], new Date(now + 61 * minute), { apiKey: "test", lookup: failing });
  assert.equal(summary.searched, 2);
  assert.equal(calls, 3);
});

test("the YouTube quota day starts at midnight Pacific", () => {
  const { getYouTubeQuotaDayStartMs } = loadParserExports();
  // Summer: midnight PDT is 07:00 UTC; a moment before it belongs to the day before.
  assert.equal(new Date(getYouTubeQuotaDayStartMs(Date.parse("2026-09-27T04:07:13.500Z"))).toISOString(), "2026-09-26T07:00:00.000Z");
  assert.equal(new Date(getYouTubeQuotaDayStartMs(Date.parse("2026-09-27T07:00:00Z"))).toISOString(), "2026-09-27T07:00:00.000Z");
  // Winter: midnight PST is 08:00 UTC.
  assert.equal(new Date(getYouTubeQuotaDayStartMs(Date.parse("2027-01-10T20:00:00Z"))).toISOString(), "2027-01-10T08:00:00.000Z");
});

test("a quota refusal stops every finish-video lookup until the quota day turns", async () => {
  const { resolveRaceFinishVideoUrl, enrichFinishVideoBacklog, finishVideoCache, finishVideoLookupLog, describeDataStatus } =
    loadParserExports();
  finishVideoCache.clear();
  finishVideoLookupLog.length = 0;
  // 04:00 UTC on 27 September is 21:00 Pacific on the 26th; the quota turns at 07:00 UTC.
  const now = Date.parse("2026-09-27T04:00:00Z");
  const hour = 60 * 60 * 1000;
  let calls = 0;
  const refused = async () => {
    calls += 1;
    throw new Error("Request failed: 429 Too Many Requests");
  };
  const found = async () => {
    calls += 1;
    return "https://www.youtube.com/watch?v=found";
  };
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now, lookup: refused }), "");
  assert.equal(calls, 1);
  const status = describeDataStatus({}, { now: now + hour, raceCache: {}, metadataCache: {} });
  assert.equal(status.finishVideos.quotaPausedUntil, "2026-09-27T07:00:00.000Z");

  // A live stage asking again an hour later does not search, and neither does the backlog.
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now: now + hour, lookup: found }), "");
  const race = {
    pageTitle: "2026 Tour de Pologne",
    title: "Tour de Pologne",
    startDate: new Date("2026-08-24T00:00:00Z"),
    endDate: new Date("2026-08-30T00:00:00Z"),
    stageRace: { totalStages: 1, completedStages: 1, latestStage: { number: 1 }, stages: [{ number: 1, label: "Stage 1", standings: [{ place: "1", rider: "R" }] }] },
  };
  const summary = await enrichFinishVideoBacklog([race], new Date(now + 2 * hour), { apiKey: "test", lookup: found });
  assert.equal(summary.searched, 0);
  assert.equal(calls, 1, "no search is made while the quota is spent");

  // After midnight Pacific both search again.
  const turned = Date.parse("2026-09-27T07:01:00Z");
  assert.equal(await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, { now: turned, lookup: found }), "https://www.youtube.com/watch?v=found");
  assert.equal((await enrichFinishVideoBacklog([race], new Date(turned), { apiKey: "test", lookup: found })).found, 1);
  assert.equal(calls, 3);
});

test("loadPersistedFinishVideos seeds the cache with entries that never expire", async () => {
  const { loadPersistedFinishVideos, listFoundFinishVideos, isFinishVideoLookupDue, resolveRaceFinishVideoUrl, finishVideoCache } =
    loadParserExports();
  finishVideoCache.clear();
  const filePath = path.join(require("os").tmpdir(), `finish-videos-${process.pid}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      videos: {
        "2026 Tour de France|21": { url: "https://www.youtube.com/watch?v=seeded", foundAt: "2026-07-26T20:00:00.000Z" },
        "2026 Tour de France|20": { url: "javascript:alert(1)", foundAt: "2026-07-25T20:00:00.000Z" },
        "not a key": { url: "https://www.youtube.com/watch?v=stray" },
      },
    }),
  );
  try {
    assert.equal(loadPersistedFinishVideos(filePath), 1, "only a well-formed key with an http(s) address is seeded");
    assert.equal(loadPersistedFinishVideos(path.join(require("os").tmpdir(), "missing-finish-videos.json")), 0);
  } finally {
    fs.unlinkSync(filePath);
  }
  const seeded = finishVideoCache.get("2026 Tour de France|21");
  assert.equal(seeded.url, "https://www.youtube.com/watch?v=seeded");
  assert.equal(isFinishVideoLookupDue(seeded, Date.now() + 365 * 24 * 60 * 60 * 1000), false, "a seeded hit is never searched again");
  let calls = 0;
  const url = await resolveRaceFinishVideoUrl(TDF_STAGE21_RACE, {
    now: Date.now() + 365 * 24 * 60 * 60 * 1000,
    lookup: async () => {
      calls += 1;
      return "";
    },
  });
  assert.equal(url, "https://www.youtube.com/watch?v=seeded");
  assert.equal(calls, 0);
  // The VM realm has its own Object, so compare plain copies.
  assert.deepEqual(JSON.parse(JSON.stringify(listFoundFinishVideos())), {
    videos: { "2026 Tour de France|21": { url: "https://www.youtube.com/watch?v=seeded", foundAt: "2026-07-26T20:00:00.000Z" } },
  });
});

test("enrichFinishVideoBacklog applies known videos to every finished stage and searches the rest newest first within the caps", async () => {
  const { enrichFinishVideoBacklog, buildFinishVideoQuery, finishVideoCache, finishVideoLookupLog } = loadParserExports();
  finishVideoCache.clear();
  finishVideoLookupLog.length = 0;
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const stage = (number) => ({ number, order: number, label: `Stage ${number}`, standings: [{ place: "1", rider: "Rider" }] });
  const stageRaceOf = (pageTitle, start, end, stageCount) => ({
    pageTitle,
    title: pageTitle.slice(5),
    startDate: new Date(start),
    endDate: new Date(end),
    stageRace: {
      totalStages: stageCount,
      completedStages: stageCount,
      latestStage: { number: stageCount, standings: [{ place: "1", rider: "Rider" }] },
      stages: Array.from({ length: stageCount }, (_, index) => stage(index + 1)),
    },
  });
  const oneDayOf = (pageTitle, day) => ({ pageTitle, title: pageTitle.slice(5), startDate: new Date(day), endDate: new Date(day) });
  const pologne = stageRaceOf("2026 Tour de Pologne", "2026-08-24T00:00:00Z", "2026-08-30T00:00:00Z", 3);
  const basque = stageRaceOf("2026 Tour of the Basque Country", "2026-04-06T00:00:00Z", "2026-04-11T00:00:00Z", 4);
  const bretagne = oneDayOf("2026 Bretagne Classic", "2026-09-05T00:00:00Z");
  const recent = oneDayOf("2026 Clásica de San Sebastián", "2026-09-24T00:00:00Z");
  const live = stageRaceOf("2026 Tour of Britain", "2026-09-22T00:00:00Z", "2026-09-28T00:00:00Z", 6);
  live.stageRace.completedStages = 4;
  const now = new Date("2026-09-27T12:00:00Z");
  finishVideoCache.set("2026 Tour de Pologne|3", { updatedAt: 0, url: "https://www.youtube.com/watch?v=known", persistent: true });

  const queries = [];
  const lookup = async (subject) => {
    const query = buildFinishVideoQuery(subject);
    queries.push(query);
    return /stage 2/.test(query) ? `https://www.youtube.com/watch?v=${queries.length}` : "";
  };

  // No key: known videos are applied, nothing is searched.
  let summary = await enrichFinishVideoBacklog([pologne, basque, bretagne, recent, live], now, { apiKey: "", lookup });
  assert.equal(pologne.stageRace.stages[2].finishVideoUrl, "https://www.youtube.com/watch?v=known");
  assert.equal(pologne.stageRace.latestStage.finishVideoUrl, "https://www.youtube.com/watch?v=known", "the final stage is the race's video too");
  assert.deepEqual(queries, []);
  assert.deepEqual(plain(summary), { known: 1, pending: 7, searched: 0, found: 0 });

  // With the key: six per rebuild, newest race first, last stage first; the recent
  // race and the live race belong to the other passes.
  summary = await enrichFinishVideoBacklog([pologne, basque, bretagne, recent, live], now, { apiKey: "test", lookup });
  assert.deepEqual(queries, [
    "Bretagne Classic 2026 highlights",
    "Tour de Pologne 2026 stage 2 highlights",
    "Tour de Pologne 2026 stage 1 highlights",
    "Tour of the Basque Country 2026 stage 4 highlights",
    "Tour of the Basque Country 2026 stage 3 highlights",
    "Tour of the Basque Country 2026 stage 2 highlights",
  ]);
  // "known" counts what this call applied; stage 3 already carried its video.
  assert.deepEqual(plain(summary), { known: 0, pending: 7, searched: 6, found: 2 });
  assert.equal(pologne.stageRace.stages[1].finishVideoUrl, "https://www.youtube.com/watch?v=2");
  assert.equal(basque.stageRace.stages[1].finishVideoUrl, "https://www.youtube.com/watch?v=6");
  assert.equal(basque.stageRace.stages[0].finishVideoUrl, undefined, "the seventh waits for the next rebuild");
  assert.equal(bretagne.finishVideoUrl, undefined);
  assert.equal(recent.finishVideoUrl, undefined);
  assert.equal(live.stageRace.stages[3].finishVideoUrl, undefined);
  assert.equal(finishVideoLookupLog.length, 6);

  // The next rebuild searches only the one left over: a backlog hit is final and a
  // miss waits a week.
  queries.length = 0;
  summary = await enrichFinishVideoBacklog([pologne, basque, bretagne, recent, live], now, { apiKey: "test", lookup });
  assert.deepEqual(queries, ["Tour of the Basque Country 2026 stage 1 highlights"]);
  assert.deepEqual(plain(summary), { known: 0, pending: 1, searched: 1, found: 0 });
  queries.length = 0;
  const weekLater = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  await enrichFinishVideoBacklog([pologne, basque, bretagne, recent, live], weekLater, { apiKey: "test", lookup });
  // The five misses again, plus the one-day race that has aged out of the recent window.
  assert.equal(queries.length, 6, "the misses are asked about again after a week");
  assert.ok(queries.includes("Clásica de San Sebastián 2026 highlights"));

  // The daily backlog cap: with sixty lookups in the last day nothing more is searched.
  queries.length = 0;
  finishVideoLookupLog.length = 0;
  for (let index = 0; index < 60; index += 1) {
    finishVideoLookupLog.push(now.getTime() - index * 1000);
  }
  const fresh = stageRaceOf("2026 Tour de Pologne", "2026-08-24T00:00:00Z", "2026-08-30T00:00:00Z", 3);
  finishVideoCache.clear();
  summary = await enrichFinishVideoBacklog([fresh], now, { apiKey: "test", lookup });
  assert.deepEqual(queries, []);
  assert.deepEqual(plain(summary), { known: 0, pending: 3, searched: 0, found: 0 });
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
  assert.match(html, /stage-profile-gridlabel" data-unit-system="metric"[^>]*>500 m</);
  assert.match(html, /stage-profile-gridlabel" data-unit-system="metric"[^>]*>2,000 m</);
  assert.match(html, /stage-profile-tick" data-unit-system="metric"[^>]*>100 km</);
  // A tick that would collide with the finish marker is dropped.
  assert.doesNotMatch(html, />150 km</);
  // The imperial axes are round in their own units, not converted metres.
  assert.match(html, /stage-profile-gridlabel" data-unit-system="imperial"[^>]*>6,000 ft</);
  assert.match(html, /stage-profile-tick" data-unit-system="imperial"[^>]*>50 mi</);
  assert.doesNotMatch(html, /6,562 ft/);
  assert.match(html, /stage-profile-end is-finish">Finish/);
  assert.match(html, /is-finish">Finish <span class="stage-profile-end-altitude"[^>]*data-unit-metric="2,137 m"/);
  assert.match(html, /<stop offset="0" stop-color="#ef3340">[\s\S]*<stop offset="0.3" stop-color="#ffcc00">[\s\S]*<stop offset="0.62" stop-color="#005bbb">[\s\S]*<stop offset="1" stop-color="#00a651">/);
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

test("a persisted stage profile seeds the cache and is never re-fetched", async () => {
  const { loadPersistedStageProfiles, enrichStageProfiles, stageProfileCache } = loadParserExports();
  stageProfileCache.clear();
  const file = path.join(__dirname, "fixtures", "stage-profiles.tmp.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      profiles: {
        "2026 Vuelta a España#1": { fetchedAt: "2026-08-01T00:00:00.000Z", profile: { source: "komoot", distanceKm: 9, elevationGainM: 80, points: [[0, 10], [9, 40]] } },
        "2026 Vuelta a España#2": { fetchedAt: "2026-08-01T00:00:00.000Z", profile: { source: "komoot", points: [] } },
      },
    }),
  );
  try {
    assert.equal(loadPersistedStageProfiles(file), 1);
    // The seeded entry is older than any TTL and must still count.
    stageProfileCache.get("2026 Vuelta a España#1").fetchedAt = 0;

    const requested = [];
    const race = {
      id: "2026 Vuelta a España",
      pageTitle: "2026 Vuelta a España",
      startDate: new Date("2026-08-22T00:00:00.000Z"),
      endDate: new Date("2026-09-13T00:00:00.000Z"),
      stageRace: { totalStages: 21, stages: [{ number: 1, order: 1, label: "Stage 1", standings: [{ place: "1", rider: "A" }] }] },
    };
    await enrichStageProfiles([race], new Date("2026-12-01T00:00:00.000Z"), { loadProfile: async (url) => { requested.push(url); return null; } });
    assert.deepEqual(requested, []);
    assert.equal(race.stageRace.stages[0].profile.elevationGainM, 80);
    assert.equal(loadPersistedStageProfiles(path.join(__dirname, "fixtures", "does-not-exist.json")), 0);
  } finally {
    fs.unlinkSync(file);
    stageProfileCache.clear();
  }
});

test("a live race gives tomorrow's stage a chip, a nudge row and a preview panel", async () => {
  const { buildStageSwitcherMarkup, stageProfileCache, enrichStageProfiles } = loadParserExports();
  stageProfileCache.clear();
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
    stageRace: {
      totalStages: 21,
      stages: [
        { number: 11, order: 11, label: "Stage 11", stageType: "flat", distanceKm: 156.1, winner: "A", standings: [{ place: "1", rider: "A" }] },
        { number: 12, order: 12, label: "Stage 12", stageType: "mountain", distanceKm: 166.5, winner: "B", standings: [{ place: "1", rider: "B" }] },
      ],
      route: [
        { number: 12, order: 12, label: "Stage 12", stageType: "mountain", distanceKm: 166.5 },
        { number: 13, order: 13, label: "Stage 13", date: "4 September", course: "Almuñécar to Loja", stageType: "medium-mountain", distanceKm: 192.8 },
      ],
    },
  };

  const live = buildStageSwitcherMarkup(race, { live: true });
  // Chip 13 is a selectable "next" chip rather than a disabled upcoming one.
  assert.match(live, /<button type="button" class="stage-chip is-next"[^>]*data-stage-target="2026-vuelta-a-espana-stage-13"[^>]*title="Up next: Stage 13 — Almuñécar to Loja">13<span class="stage-chip-next-tag">next<\/span><\/button>/);
  assert.doesNotMatch(live, /title="Not raced yet">13</);
  assert.match(live, /title="Not raced yet">14</);
  // The nudge row sits above the strip and targets the same panel.
  const row = live.indexOf('class="stage-next-row"');
  assert.ok(row >= 0 && row < live.indexOf('class="stage-strip"'));
  assert.match(live, /stage-next-row" data-stage-target="2026-vuelta-a-espana-stage-13"/);
  assert.match(live, /stage-next-row-text">Stage 13 · Almuñécar to Loja · Medium mountain · <span data-unit-metric="192.8 km" data-unit-imperial="119.8 mi">192.8 km<\/span></);
  // The preview panel is hidden until chosen, carries the course, and says when results land.
  assert.match(live, /<div class="stage-panel stage-panel-next" id="2026-vuelta-a-espana-stage-13"[^>]*hidden>[\s\S]*Up next · Stage 13[\s\S]*4 September • Almuñécar to Loja[\s\S]*stage-profile is-generic[\s\S]*Results will appear here once the stage finishes on 4 September\./);
  // Stage 12 stays the selected stage.
  assert.match(live, /class="stage-chip is-active" role="tab" aria-selected="true" aria-controls="2026-vuelta-a-espana-stage-12"/);
  assert.doesNotMatch(live, /stage-upnext/);

  // A finished race has no "next": chip 13 is the usual disabled chip and nothing else renders.
  const finished = buildStageSwitcherMarkup(race);
  assert.match(finished, /title="Not raced yet">13</);
  assert.doesNotMatch(finished, /stage-next-row|stage-panel-next|is-next/);

  // The enrichment fetches tomorrow's stage into the cache; the preview then draws it.
  const requested = [];
  await enrichStageProfiles([race], new Date("2026-09-03T18:00:00.000Z"), {
    loadProfile: async (url) => {
      requested.push(url);
      return url.endsWith("/stage-13") ? { source: "komoot", distanceKm: 192.8, elevationGainM: 3414, points: [[0, 10], [100, 900], [192.8, 480]] } : null;
    },
  });
  assert.ok(requested.includes("https://www.lavuelta.es/en/stage-13"));
  const measured = buildStageSwitcherMarkup(race, { live: true });
  assert.match(measured, /stage-panel-next[\s\S]*stage-profile is-measured[\s\S]*3,414 m climbing/);
  stageProfileCache.clear();
});

test("a stage podium shows each rider's finishing time and gap, deriving whichever is missing", () => {
  const { buildPodiumMarkup, getStageStandingMetrics: rawMetrics } = loadParserExports();
  const getStageStandingMetrics = (entry, winnerSeconds) => JSON.parse(JSON.stringify(rawMetrics(entry, winnerSeconds)));
  const winnerSeconds = 4 * 3600 + 29 * 60 + 53;

  // Both known (official provider): shown as given.
  assert.deepEqual(getStageStandingMetrics({ place: "2", time: "4:31:49", gap: "+01:56" }, winnerSeconds), { time: "4:31:49", gap: "+01:56" });
  // Gap only (Wikipedia): the time is the winner's plus the gap.
  assert.deepEqual(getStageStandingMetrics({ place: "3", gap: "+ 2' 13\"" }, winnerSeconds), { time: "4:32:06", gap: "+02:13" });
  // Time only: the gap is the difference.
  assert.deepEqual(getStageStandingMetrics({ place: "4", time: "4:32:42" }, winnerSeconds), { time: "4:32:42", gap: "+02:49" });
  // Same time as the winner, whether written as a time or as "s.t.".
  assert.deepEqual(getStageStandingMetrics({ place: "2", time: "4:29:53" }, winnerSeconds), { time: "4:29:53", gap: "s.t." });
  assert.deepEqual(getStageStandingMetrics({ place: "2", gap: "s.t." }, winnerSeconds), { time: "4:29:53", gap: "s.t." });
  // The winner shows the time alone; a rider with nothing shows nothing.
  assert.deepEqual(getStageStandingMetrics({ place: "1", time: "4:29:53" }, winnerSeconds), { time: "4:29:53", gap: "" });
  assert.deepEqual(getStageStandingMetrics({ place: "5" }, winnerSeconds), { time: "", gap: "" });
  // No winner time: nothing can be derived, so the source values stand.
  assert.deepEqual(getStageStandingMetrics({ place: "2", gap: "+00:07" }, null), { time: "", gap: "+00:07" });

  const html = buildPodiumMarkup(
    [
      { place: "1", rider: "Jakob Omrzel", time: "4:29:53" },
      { place: "2", rider: "Urko Berrade", gap: "+01:56" },
      { place: "3", rider: "Santiago Buitrago", time: "4:32:06" },
    ],
    { metricContext: "stage" },
  );
  assert.match(html, /Jakob Omrzel<\/a><span class="standing-gap">4:29:53<\/span><\/span>/);
  assert.match(html, /Urko Berrade<\/a><span class="standing-gap">4:31:49<\/span><span class="standing-delta">\+01:56<\/span>/);
  assert.match(html, /Santiago Buitrago<\/a><span class="standing-gap">4:32:06<\/span><span class="standing-delta">\+02:13<\/span>/);

  // The GC podium is untouched: leader time, then gaps.
  const gc = buildPodiumMarkup(
    [
      { place: "1", rider: "Enric Mas", time: "40:31:51" },
      { place: "2", rider: "Primož Roglič", gap: "+01:45" },
    ],
    { metricContext: "gc" },
  );
  assert.match(gc, /Enric Mas<\/a><span class="standing-gap">40:31:51<\/span>/);
  assert.match(gc, /Roglič<\/a><span class="standing-gap">\+01:45<\/span>/);
  assert.doesNotMatch(gc, /standing-delta/);
});

test("extractClassificationLeadership resolves rowspan columns to the jersey holders after the latest stage", () => {
  const { extractClassificationLeadership, extractStageLeadershipGcSnapshots } = loadParserExports();
  // The live 2026 Vuelta page as fetched on 2026-09-04: stages 1-13 raced, stage 3
  // cancelled, and every classification column written with rowspan.
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "vuelta-a-espana-leadership-stage13.wikitext"), "utf8");
  const teamNames = new Map([["DCT|2026", "Decathlon CMA CGM"]]);

  const leaders = JSON.parse(JSON.stringify(extractClassificationLeadership(rawText, teamNames)));

  assert.equal(leaders.stageNumber, 13);
  assert.equal(leaders.stageLabel, "Stage 13");
  assert.deepEqual(
    leaders.entries.map((entry) => [entry.key, entry.label, entry.jersey, entry.rider]),
    [
      ["general", "General", "red", "Enric Mas"],
      ["points", "Points", "dark green", "Wout van Aert"],
      ["mountains", "Mountains", "blue polkadot", "Santiago Buitrago"],
      ["young", "Young rider", "white", "Oscar Onley"],
      ["team", "Team", "red number", "Decathlon CMA CGM"],
    ],
  );
  // The combativity award is a per-stage prize, not a jersey.
  assert.ok(!leaders.entries.some((entry) => /combativ/i.test(entry.label)));

  // Every row resolves to the right column: on stage 2 the cell at index 2 is Koen
  // Bouwman's mountains lead, while the GC is Pogačar's rowspan from stage 1.
  const gcLeaders = JSON.parse(JSON.stringify(extractStageLeadershipGcSnapshots(rawText).map((entry) => [entry.stageNumber, entry.standings[0].rider])));
  assert.deepEqual(gcLeaders.slice(0, 3), [
    [1, "Tadej Pogačar"],
    [2, "Tadej Pogačar"],
    [3, "Tadej Pogačar"],
  ]);
  assert.deepEqual(gcLeaders[gcLeaders.length - 1], [13, "Enric Mas"]);
  assert.equal(gcLeaders.length, 13);

  // A team code the name map cannot resolve is left out rather than shown raw.
  const unresolved = extractClassificationLeadership(rawText);
  assert.ok(!unresolved.entries.some((entry) => entry.key === "team"));
  assert.equal(unresolved.entries.length, 4);
});

test("extractStageRaceSnapshot carries the jersey holders with flags borrowed from the standings", () => {
  const { extractStageRaceSnapshot } = loadParserExports();
  const rawText = fs.readFileSync(path.join(__dirname, "fixtures", "la-vuelta-femenina-stage1.wikitext"), "utf8");

  const snapshot = JSON.parse(JSON.stringify(extractStageRaceSnapshot(rawText)));

  assert.equal(snapshot.classificationLeaders.stageNumber, 1);
  assert.deepEqual(snapshot.classificationLeaders.entries, [
    { key: "general", label: "General", jersey: "red", rider: "Noemi Rüegg", countryCode: "SUI" },
    { key: "points", label: "Points", jersey: "dark green", rider: "Noemi Rüegg", countryCode: "SUI" },
    { key: "mountains", label: "Mountains", jersey: "blue polkadot", rider: "Maëva Squiban", countryCode: "FRA" },
    { key: "young", label: "Young rider", jersey: "white", rider: "Eleonora Ciabocco" },
  ]);
});

test("parseWikiTableGrid expands rowspan and colspan into a positional grid", () => {
  const { parseWikiTableGrid } = loadParserExports();
  const grid = parseWikiTableGrid(`{| class="wikitable"
|-
! A !! B !! C
|-
| rowspan="2" | a1
| b1 || c1
|-
| b2
| c2
|-
! colspan="2" | Final
| c3
|}`);

  assert.deepEqual(
    JSON.parse(JSON.stringify(grid.map((row) => row.map((cell) => `${cell.content}${cell.spanned ? "*" : ""}`)))),
    [
      ["A", "B", "C"],
      ["a1", "b1", "c1"],
      ["a1*", "b2", "c2"],
      ["Final", "Final", "c3"],
    ],
  );
});

test("mergeStageRaceSnapshots keeps the jersey holders and bounds them by the calendar", () => {
  const { mergeStageRaceSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };
  const official = {
    totalStages: 21,
    completedStages: 2,
    latestStage: { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "Matthew Brennan", countryCode: "GBR" }] },
    generalClassification: {
      stageNumber: 2,
      standings: [{ place: "1", rider: "Tadej Pogačar", countryCode: "SLO" }],
    },
    overallResult: [],
  };
  const parsed = {
    totalStages: 21,
    completedStages: 1,
    stages: [{ number: 1, order: 1, label: "Stage 1", winner: "Tadej Pogačar", standings: [{ place: "1", rider: "Tadej Pogačar" }] }],
    latestStage: { number: 1, label: "Stage 1", standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    generalClassification: { stageNumber: 1, standings: [{ place: "1", rider: "Tadej Pogačar" }] },
    overallResult: [],
    classificationLeaders: {
      stageNumber: 1,
      stageLabel: "Stage 1",
      entries: [
        { key: "general", label: "General", jersey: "red", rider: "Tadej Pogačar" },
        { key: "young", label: "Young rider", jersey: "white", rider: "Joshua Tarling", countryCode: "GBR" },
      ],
    },
  };

  // Wikipedia one stage behind the provider: kept, labelled by its own stage, and the
  // leader picks up the flag the provider's GC carries.
  const merged = JSON.parse(JSON.stringify(mergeStageRaceSnapshots(official, parsed, race, new Date("2026-08-23T20:00:00.000Z"))));
  assert.equal(merged.generalClassification.stageNumber, 2);
  assert.equal(merged.classificationLeaders.stageNumber, 1);
  assert.deepEqual(merged.classificationLeaders.entries[0], {
    key: "general",
    label: "General",
    jersey: "red",
    rider: "Tadej Pogačar",
    countryCode: "SLO",
  });

  // A table claiming a stage the calendar has not reached is dropped outright.
  const early = mergeStageRaceSnapshots(
    official,
    { ...parsed, classificationLeaders: { ...parsed.classificationLeaders, stageNumber: 5, stageLabel: "Stage 5" } },
    race,
    new Date("2026-08-23T20:00:00.000Z"),
  );
  assert.equal(early.classificationLeaders, undefined);
});

test("a finished stage-race card folds its jerseys and stages behind their headers and keeps the GC open", () => {
  const { buildStageRaceCard } = loadParserExports();
  const stage = (n) => ({ number: n, order: n, label: `Stage ${n}`, winner: "Rider " + n, standings: [{ place: "1", rider: "Rider " + n }] });
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    date: "22 August – 13 September 2026",
    location: "Spain",
    startDate: new Date("2026-08-22T00:00:00Z"),
    endDate: new Date("2026-09-13T00:00:00Z"),
    stageRace: {
      totalStages: 21,
      completedStages: 21,
      stages: [19, 20, 21].map(stage),
      latestStage: stage(21),
      generalClassification: { stageNumber: 21, standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP" }] },
      overallResult: [],
      classificationLeaders: {
        stageNumber: 21,
        stageLabel: "Stage 21",
        entries: [{ key: "general", label: "General", jersey: "red", rider: "Enric Mas", countryCode: "ESP" }],
      },
    },
  };
  const finished = buildStageRaceCard(race);
  assert.match(finished, /<button type="button" class="detail-label detail-toggle" data-detail-toggle aria-expanded="true" aria-controls="race-2026-vuelta-a-espana-gc">Final general classification</);
  assert.match(finished, /<div class="detail-panel" id="race-2026-vuelta-a-espana-gc">/);
  assert.match(finished, /aria-expanded="false" aria-controls="race-2026-vuelta-a-espana-jerseys">Final jersey winners</);
  assert.match(finished, /<ul class="jersey-list detail-panel" id="race-2026-vuelta-a-espana-jerseys" hidden>/);
  assert.match(finished, /aria-expanded="false" aria-controls="race-2026-vuelta-a-espana-stages">Stage results \(21 stages\)</);
  assert.match(finished, /<div class="detail-panel" id="race-2026-vuelta-a-espana-stages" hidden>/);
  // The folded jerseys stack under the podium rather than sharing its row.
  assert.doesNotMatch(finished, /gc-columns/);

  // A live card keeps plain labels, everything open, and the two-column row.
  const live = buildStageRaceCard({ ...race, stageRace: { ...race.stageRace, completedStages: 20 } }, { live: true });
  assert.doesNotMatch(live, /data-detail-toggle/);
  assert.match(live, /<div class="detail-label">Stage results<\/div>/);
  assert.match(live, /gc-columns/);
});

test("buildStageRaceCard lists the jersey holders under the general classification", () => {
  const { buildStageRaceCard, buildJerseyHoldersMarkup } = loadParserExports();
  const race = {
    id: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    date: "22 August – 13 September 2026",
    location: "Spain",
    stageRace: {
      totalStages: 21,
      completedStages: 13,
      stages: [{ number: 13, order: 13, label: "Stage 13", winner: "Wout van Aert", standings: [{ place: "1", rider: "Wout van Aert" }] }],
      latestStage: { number: 13, label: "Stage 13", winner: "Wout van Aert", standings: [{ place: "1", rider: "Wout van Aert" }] },
      generalClassification: { stageNumber: 13, standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP" }] },
      overallResult: [],
      classificationLeaders: {
        stageNumber: 13,
        stageLabel: "Stage 13",
        entries: [
          { key: "general", label: "General", jersey: "red", rider: "Enric Mas", countryCode: "ESP" },
          { key: "points", label: "Points", jersey: "dark green", rider: "Wout van Aert", countryCode: "BEL" },
          { key: "mountains", label: "Mountains", jersey: "blue polkadot", rider: "Santiago Buitrago" },
          { key: "breakaway", label: "Breakaway", rider: "Diego Pablo Sevilla" },
        ],
      },
    },
  };

  const html = buildStageRaceCard(race, { live: true });
  const [, gcSection = ""] = html.split("Overall after stage 13");
  assert.match(gcSection, /class="jersey-holders"/);
  assert.match(gcSection, /Jersey holders</);
  assert.equal((gcSection.match(/class="jersey-item"/g) || []).length, 4);
  assert.match(gcSection, /<span class="jersey-classification" title="Points: sprint and intermediate points">Points<\/span>\s*<span class="jersey-holder rider-name"><span class="country-flag" title="Belgium"/);
  assert.match(gcSection, /aria-label="dark green jersey"/);
  // Polka dots are drawn as dots on white; an unnamed jersey is an outlined blank.
  assert.match(gcSection, /aria-label="blue polkadot jersey"[^]*?fill="#ffffff"[^]*?<circle[^>]*fill="#0a63c9"/);
  assert.match(gcSection, /aria-label="jersey"[^]*?fill="none"[^>]*stroke-dasharray/);

  // Labelled by stage only when it lags the GC, and as final once the race is over.
  race.stageRace.classificationLeaders.stageNumber = 12;
  race.stageRace.classificationLeaders.stageLabel = "Stage 12";
  assert.match(buildJerseyHoldersMarkup(race), /Jersey holders after stage 12/);
  assert.match(buildJerseyHoldersMarkup(race, { finalized: true }), /Final jersey winners/);
  assert.equal(buildJerseyHoldersMarkup({ stageRace: { ...race.stageRace, classificationLeaders: null } }), "");
  assert.ok(!buildStageRaceCard({ ...race, stageRace: { ...race.stageRace, classificationLeaders: null } }).includes("jersey-holders"));
});

test("every federation in the flag map has a continent for the championships almanac", () => {
  const { COUNTRY_NAME_ALPHA2, CONTINENT_BY_ALPHA2, getNationalChampionshipContinent } = loadParserExports();
  const missing = [...new Set(Object.values(COUNTRY_NAME_ALPHA2))].filter((alpha2) => !CONTINENT_BY_ALPHA2[alpha2]);
  assert.equal(missing.join(","), "");
  assert.equal(getNationalChampionshipContinent("United States"), "north-america");
  assert.equal(getNationalChampionshipContinent("Colombia"), "south-america");
  assert.equal(getNationalChampionshipContinent("Hong Kong, China"), "asia");
  assert.equal(getNationalChampionshipContinent("Atlantis"), "");
});

test("groupNationalChampionshipsByContinent buckets federations in continent order with counts and confirmed dates", () => {
  const { parseNationalChampionshipsIndex, groupNationalChampionshipsByContinent } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
      <tr><th>Sweden</th><td>Axel K&auml;llberg</td><td></td><td>Zo&euml; Andersson</td><td></td></tr>
      <tr><th>Great Britain</th><td></td><td></td><td></td><td></td></tr>
      <tr><th>Australia</th><td>Jay Vine</td><td>Patrick Eddy</td><td></td><td></td></tr>
    </table>`);
  const groups = groupNationalChampionshipsByContinent(parsed.events);

  assert.deepEqual([...groups.map((group) => group.id)], ["europe", "north-america", "oceania"]);
  const europe = groups[0];
  assert.equal(europe.federationCount, 2);
  assert.equal(europe.reportingCount, 1);
  assert.deepEqual([...europe.federations.map((federation) => federation.country)], ["Great Britain", "Sweden"]);
  assert.deepEqual([...europe.federations[1].championKeys], ["meItt", "weItt"]);
  assert.equal(europe.federations[1].champions.meItt, "Axel Källberg");
  assert.equal(europe.federations[1].flag, "🇸🇪");
  // Hand-entered metadata gives Great Britain and the US a date line even without a champion.
  assert.match(europe.federations[0].detail, /Jun 25, 2026 – Jun 28, 2026 · Lampeter, Wales \/ Aberystwyth, Wales/);
  assert.match(groups[1].federations[0].detail, /Jun 17, 2026 – Jun 21, 2026 · Charleston, West Virginia/);
  assert.equal(groups[2].championCount, 2);
});

test("createRaceAnchorId slugs the race id without accents", () => {
  const { createRaceAnchorId } = loadParserExports();
  assert.equal(createRaceAnchorId({ id: "2026 Vuelta a España" }), "race-2026-vuelta-a-espana");
  assert.equal(createRaceAnchorId({ title: "Liège–Bastogne–Liège" }), "race-liege-bastogne-liege");
  assert.equal(createRaceAnchorId({}), "");
});

function buildCalendarFixture() {
  const race = (title, series, start, end, extra = {}) => ({
    id: `2026 ${title}`,
    pageTitle: `2026 ${title}`,
    title,
    series,
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
    date: start === end ? start : `${start} – ${end}`,
    location: "Somewhere",
    countryCode: "ESP",
    ...extra,
  });
  return [
    race("Tour Down Under", "Men's WorldTour", "2026-01-20", "2026-01-25", { winner: "Jay Vine", winnerCountryCode: "AUS" }),
    race("Milan–San Remo", "Men's WorldTour", "2026-03-21", "2026-03-21", { winner: "Tadej Pogačar", winnerCountryCode: "SLO" }),
    race("Tour de France", "Men's WorldTour", "2026-07-04", "2026-07-26", { winner: "Tadej Pogačar", winnerCountryCode: "SLO" }),
    race("Vuelta a España", "Men's WorldTour", "2026-08-22", "2026-09-13"),
    race("Il Lombardia", "Men's WorldTour", "2026-10-10", "2026-10-10"),
    race("Tour de France Femmes", "Women's WorldTour", "2026-08-01", "2026-08-09", { winner: "Demi Vollering", winnerCountryCode: "NED" }),
    race("Tour of Chongming Island", "Women's WorldTour", "2026-10-13", "2026-10-15"),
    race("Tour of Greece", "Men's Europe Tour", "2026-05-01", "2026-05-05"),
  ];
}

test("buildSeasonCalendar classifies WorldTour races by status and tier and pads the range to whole months", () => {
  const { buildSeasonCalendar } = loadParserExports();
  const calendar = buildSeasonCalendar(buildCalendarFixture(), new Date("2026-09-04T12:00:00Z"));

  assert.equal(calendar.year, 2026);
  assert.equal(calendar.today, "2026-09-04");
  assert.equal(calendar.rangeStart, "2026-01-01");
  assert.equal(calendar.rangeEnd, "2026-10-31");
  assert.equal(calendar.races.length, 7, "the Europe Tour race is out of scope");
  assert.deepEqual(
    [...calendar.races.map((race) => `${race.title}:${race.status}:${race.tier}`)],
    [
      "Tour Down Under:finished:stage-race",
      "Milan–San Remo:finished:monument",
      "Tour de France:finished:grand-tour",
      "Tour de France Femmes:finished:grand-tour",
      "Vuelta a España:live:grand-tour",
      "Il Lombardia:upcoming:monument",
      "Tour of Chongming Island:upcoming:stage-race",
    ],
  );
  assert.equal(calendar.finishedCount, 4);
  assert.equal(calendar.liveCount, 1);
  assert.equal(calendar.upcomingCount, 2);
  assert.equal(calendar.races[4].anchor, "race-2026-vuelta-a-espana");
  assert.equal(calendar.races[0].seriesId, "mens");
  assert.equal(calendar.races[3].seriesId, "womens");
  assert.equal(buildSeasonCalendar([], new Date("2026-09-04T00:00:00Z")).races.length, 0);
});

test("packSeasonCalendarRows keeps overlapping bars on separate rows", () => {
  const { buildSeasonCalendar, packSeasonCalendarRows } = loadParserExports();
  const calendar = buildSeasonCalendar(buildCalendarFixture(), new Date("2026-09-04T00:00:00Z"));
  const scale = 4;
  const X = (isoDay) => Math.round((Date.parse(`${isoDay}T00:00:00Z`) - Date.parse("2026-01-01T00:00:00Z")) / 86400000) * scale;
  const { placed, rowCount } = packSeasonCalendarRows(
    calendar.races.filter((race) => race.seriesId === "mens"),
    X,
    scale,
    (race) => (race.tier === "grand-tour" ? race.title : ""),
  );
  assert.equal(placed.length, 5);
  // The Tour de France label runs past the Vuelta's start, so the Vuelta drops a row.
  const tour = placed.find((entry) => entry.race.title === "Tour de France");
  const vuelta = placed.find((entry) => entry.race.title === "Vuelta a España");
  assert.equal(tour.row, 0);
  assert.equal(vuelta.row, 1);
  assert.ok(rowCount >= 2);
  for (const entry of placed) {
    for (const other of placed) {
      if (entry === other || entry.row !== other.row) continue;
      const apart = entry.x + entry.width <= other.x || other.x + other.width <= entry.x;
      assert.ok(apart, `${entry.race.title} overlaps ${other.race.title}`);
    }
  }
});

test("buildSeasonCalendarSection links bars to cards on the page, pins live races on the phone list and lists what is next", () => {
  const { buildSeasonCalendar, buildSeasonCalendarSection } = loadParserExports();
  const fixture = buildCalendarFixture();
  const calendar = buildSeasonCalendar(fixture, new Date("2026-09-04T00:00:00Z"));
  const markup = buildSeasonCalendarSection(
    calendar,
    {
      liveStageRaces: [fixture[3]],
      upcomingRaces: [fixture[4]],
      recentResults: [],
      finalizedStageRaces: [],
    },
    new Date("2026-09-04T00:00:00Z"),
  );

  assert.match(markup, /id="season-calendar"/);
  assert.match(markup, /Vuelta a España in progress · 4 of 7 WorldTour races run · next: Il Lombardia, 10 Oct/);
  // A race with a card on the page is a link; one without is a focusable group.
  assert.match(markup, /<a class="season-bar" href="#race-2026-vuelta-a-espana"/);
  assert.match(markup, /<g class="season-bar" tabindex="0" data-season-bar data-tip-title="Tour de France"/);
  assert.match(markup, /data-tip-detail="Tadej Pogačar 🇸🇮"/);
  assert.match(markup, /data-tip-detail="In progress"/);
  assert.match(markup, /season-bar-progress/);
  assert.match(markup, /TODAY/);
  assert.match(markup, /Nationals week · Europe &amp; N\. America/);
  // Three full views plus the compact strip.
  assert.equal((markup.match(/data-season-view="/g) || []).length, 3);
  // Hidden until opened from the hero button, closable from its own header.
  assert.match(markup, /data-season-calendar hidden>/);
  assert.match(markup, /data-season-close/);
  assert.doesNotMatch(markup, /data-season-compact/);
  // Phone list: live pinned once; the months already run fold into one block that
  // opens on request, so the list starts at this month; October stays open.
  const monthList = markup.slice(markup.indexOf("data-season-months"), markup.indexOf("</section>"));
  assert.equal((monthList.match(/Vuelta a España/g) || []).length, 1);
  assert.match(monthList, /<h3>Live now<\/h3>/);
  const folded = monthList.slice(monthList.indexOf('<details class="season-months-past"'), monthList.indexOf("</details>"));
  assert.match(folded, /<summary>[\s\S]*?season-months-past-title">[A-Za-z]+(?: to August)?<\/span>[\s\S]*?races? run<\/span>[\s\S]*?Open/);
  assert.match(folded, /<h3>August<\/h3>/);
  assert.doesNotMatch(folded, /<h3>October<\/h3>/);
  assert.match(monthList.slice(monthList.indexOf("</details>")), /<h3>October<\/h3>/);
  assert.doesNotMatch(monthList, /season-month-folded/);
  assert.match(markup, /Up next[\s\S]*?Il Lombardia[\s\S]*?Tour of Chongming Island/);
  assert.equal(buildSeasonCalendarSection({ races: [] }, {}), "");
});

test("race cards carry the anchor the season calendar links to", () => {
  const { buildRaceCard, buildUpcomingCard } = loadParserExports();
  const race = { id: "2026 Il Lombardia", title: "Il Lombardia", series: "Men's WorldTour", date: "10 October 2026", location: "Italy", winner: "" };
  assert.match(buildUpcomingCard(race), /<article class="card upcoming-card" id="race-2026-il-lombardia">/);
  assert.match(buildRaceCard(race), /<article class="card result-card" id="race-2026-il-lombardia">/);
});

test("renderMarkdown handles the small subset the site pages use and escapes everything else", () => {
  const { renderMarkdown } = loadParserExports();
  const html = renderMarkdown([
    "Intro line with **bold**, *italics*, `code` and a [link](https://example.com/a?b=1&c=2).",
    "",
    "## 4 September 2026",
    "",
    "- **First.** One <script>alert(1)</script> item",
    "- Second item with a [site link](/about)",
    "",
    "---",
    "",
    "[bad](javascript:alert(1)) stays text",
    "",
    "> A lead line in larger type",
    "",
    "![A committee, <script>alert(1)</script> and all](/assets/gruppetto.jpg)",
    "",
    "*The caption under it.*",
    "",
    "![nowhere](javascript:alert(1))",
  ].join("\n"));

  assert.match(html, /<p>Intro line with <strong>bold<\/strong>, <em>italics<\/em>, <code>code<\/code> and a <a href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noreferrer">link<\/a>\.<\/p>/);
  assert.match(html, /<h3>4 September 2026<\/h3>/);
  assert.match(html, /<ul><li><strong>First\.<\/strong> One &lt;script&gt;alert\(1\)&lt;\/script&gt; item<\/li><li>Second item with a <a href="\/about">site link<\/a><\/li><\/ul>/);
  assert.match(html, /<hr \/>/);
  assert.match(html, /\[bad\]\(javascript:alert\(1\)\) stays text/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<p class="site-lead">A lead line in larger type<\/p>/);
  // An image alone on its line is a figure; the italic line under it is its caption by
  // the page's own convention, so it stays an ordinary paragraph.
  assert.match(
    html,
    /<figure class="site-figure"><img src="\/assets\/gruppetto\.jpg" alt="A committee, &lt;script&gt;alert\(1\)&lt;\/script&gt; and all" loading="lazy" decoding="async" \/><\/figure>\n<p><em>The caption under it\.<\/em><\/p>/,
  );
  // An address that is neither ours nor https is not an image, and not a link either.
  assert.match(html, /!\[nowhere\]\(javascript:alert\(1\)\)/);
  assert.doesNotMatch(html, /javascript:alert\(1\)"/);
  assert.equal(renderMarkdown(""), "");
});

test("isAuthorizedSiteEdit accepts only the exact bearer token and refuses when none is configured", () => {
  const { isAuthorizedSiteEdit } = loadParserExports();
  assert.equal(isAuthorizedSiteEdit("Bearer secret-key", "secret-key"), true);
  assert.equal(isAuthorizedSiteEdit("bearer secret-key", "secret-key"), true);
  assert.equal(isAuthorizedSiteEdit("Bearer secret-ke", "secret-key"), false);
  assert.equal(isAuthorizedSiteEdit("Bearer secret-key-longer", "secret-key"), false);
  assert.equal(isAuthorizedSiteEdit("secret-key", "secret-key"), false);
  assert.equal(isAuthorizedSiteEdit("", "secret-key"), false);
  assert.equal(isAuthorizedSiteEdit("Bearer anything", ""), false);
});

test("the release notes and about pages render from their committed markdown, with the editor only when enabled", () => {
  const { buildSiteContentPage, SITE_CONTENT_PAGES, buildSiteFooterLinks } = loadParserExports();
  for (const pageId of Object.keys(SITE_CONTENT_PAGES)) {
    const markdown = fs.readFileSync(path.join(__dirname, "..", "data", SITE_CONTENT_PAGES[pageId].file), "utf8");
    assert.ok(markdown.trim().length > 200, `${pageId} markdown should have content`);
    const readOnly = buildSiteContentPage(pageId, markdown, { editable: false });
    assert.match(readOnly, new RegExp(`<title>${SITE_CONTENT_PAGES[pageId].title} · Pro Cycling Results</title>`));
    assert.match(readOnly, /data-site-prose/);
    assert.match(readOnly, /property="og:image" content="https:\/\/procyclingresults\.up\.railway\.app\/assets\/og-default\.jpg"/);
    assert.match(readOnly, /property="og:url" content="https:\/\/procyclingresults\.up\.railway\.app\/(about|release-notes)"/);
    assert.doesNotMatch(readOnly, /data-site-editor|\/api\/site-content/);
    const editable = buildSiteContentPage(pageId, markdown, { editable: true });
    assert.match(editable, /data-site-editor/);
    assert.match(editable, /\/api\/site-content/);
    assert.match(editable, /<textarea id="site-editor-text"/);
  }
  const notes = buildSiteContentPage("release-notes", fs.readFileSync(path.join(__dirname, "..", "data", "release-notes.md"), "utf8"), { editable: false });
  assert.match(notes, /<h3>4 September 2026<\/h3>/);
  assert.match(notes, /<h3>15–29 April 2026<\/h3>/);
  const about = buildSiteContentPage("about", fs.readFileSync(path.join(__dirname, "..", "data", "about.md"), "utf8"), { editable: false });
  assert.match(about, /<p class="site-lead">This site was developed and is being maintained by the Grupetto Committee purely for the love of the sport/);
  for (const member of ["Ambrose Bidon", "Marguerite Lanterne", "Cornelius Sprocket", "Old Tom Chainwhip", "Isadora Échappée"]) {
    assert.match(about, new RegExp(member));
  }
  assert.equal(buildSiteContentPage("nope", "x"), "");
  // Footer links mark the current page and link the others.
  const footer = buildSiteFooterLinks("/about");
  assert.match(footer, /<a href="\/">Results<\/a>/);
  assert.match(footer, /<a href="\/release-notes">Release Notes<\/a>/);
  assert.match(footer, /<span aria-current="page">About<\/span>/);
});

test("cleanNationalChampionCell drops status words the index writes into undecided cells", () => {
  const { cleanNationalChampionCell } = loadParserExports();
  assert.equal(cleanNationalChampionCell("postponed"), "");
  assert.equal(cleanNationalChampionCell("Cancelled"), "");
  assert.equal(cleanNationalChampionCell("TBC"), "");
  assert.equal(cleanNationalChampionCell("Filippo Ganna"), "Filippo Ganna");
  assert.equal(cleanNationalChampionCell("Artem Schmidt"), "Artem Shmidt");
});

test("the continent map covers every federation in the index with a shape or a dot", () => {
  const { CONTINENT_MAP_DATA, COUNTRY_NAME_ALPHA2, CONTINENT_BY_ALPHA2 } = loadParserExports();
  assert.ok(CONTINENT_MAP_DATA && CONTINENT_MAP_DATA.countries.length > 150, "data/continent-map.json should be committed");
  const drawn = new Set([
    ...CONTINENT_MAP_DATA.countries.map((country) => country.alpha2),
    ...CONTINENT_MAP_DATA.dots.map((dot) => dot.alpha2),
  ]);
  const missing = [...new Set(Object.values(COUNTRY_NAME_ALPHA2))].filter((alpha2) => !drawn.has(alpha2));
  assert.equal(missing.join(","), "");
  // Every drawn federation sits in the continent the almanac files it under.
  const misplaced = CONTINENT_MAP_DATA.countries
    .filter((country) => CONTINENT_BY_ALPHA2[country.alpha2] && CONTINENT_BY_ALPHA2[country.alpha2] !== country.continent)
    .map((country) => country.alpha2);
  assert.equal(misplaced.join(","), "");
  assert.ok(Object.keys(CONTINENT_MAP_DATA.labels).length === 6);
});

test("buildNationalChampionshipMapMarkup shades countries by the almanac's own status and links each continent to its group", () => {
  const { parseNationalChampionshipsIndex, groupNationalChampionshipsByContinent, buildNationalChampionshipMapMarkup } = loadParserExports();
  const parsed = parseNationalChampionshipsIndex(`
    <table>
      <caption>2026 Elite Road National Champions</caption>
      <tr><th>Country</th><th>ME ITT</th><th>ME Road Race</th><th>WE ITT</th><th>WE Road Race</th></tr>
      <tr><th>United States</th><td>Artem Schmidt</td><td>Quinn Simmons</td><td>Taylor Knibb</td><td>Kate Courtney</td></tr>
      <tr><th>Sweden</th><td>Axel K&auml;llberg</td><td></td><td>Zo&euml; Andersson</td><td></td></tr>
      <tr><th>Great Britain</th><td></td><td></td><td></td><td></td></tr>
      <tr><th>Bermuda</th><td>Someone Fast</td><td></td><td></td><td></td></tr>
    </table>`);
  const markup = buildNationalChampionshipMapMarkup(groupNationalChampionshipsByContinent(parsed.events));

  assert.equal((markup.match(/data-national-map-continent="/g) || []).length, 6);
  assert.match(markup, /data-national-map-continent="europe"[^>]*data-tip-detail="1 of 2 federations with champions · usually the last week of June"/);
  // Sweden has two titles, Great Britain none, France is not in this index at all.
  assert.match(markup, /class="national-map-country is-champion" data-has-meitt="1" data-has-weitt="1" d="[^"]+"><title>Sweden<\/title>/);
  assert.match(markup, /class="national-map-country is-listed" d="[^"]+"><title>United Kingdom<\/title>/);
  assert.match(markup, /class="national-map-country is-none" d="[^"]+"><title>France<\/title>/);
  // Bermuda has no shape at this scale and is drawn as a dot.
  assert.match(markup, /<circle class="national-map-dot is-champion" data-has-meitt="1" cx="[\d.]+" cy="[\d.]+" r="4"><title>Bermuda<\/title>/);
  assert.match(markup, /data-national-map-tooltip/);
  assert.equal(buildNationalChampionshipMapMarkup([], null), "");
});

test("share paths carry their own link preview and jump, and the tags describe a 1200×630 image that exists", () => {
  const { getShareView, buildShareMetaTags, SHARE_VIEWS } = loadParserExports();
  assert.equal(getShareView("/").image, "/assets/og-default.jpg");
  assert.equal(getShareView("/calendar").jump, "season-calendar");
  assert.equal(getShareView("/championships").jump, "national-championships");
  assert.equal(getShareView("/nope"), null);
  assert.equal(getShareView("/#season-calendar"), null, "fragments never reach the server");
  for (const view of Object.values(SHARE_VIEWS)) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", path.basename(view.image))), `${view.image} should be committed`);
    const tags = buildShareMetaTags(view);
    assert.match(tags, new RegExp(`property="og:url" content="https://procyclingresults\\.up\\.railway\\.app${view.path.replace("/", "\\/")}"`));
    assert.match(tags, new RegExp(`property="og:image" content="https://procyclingresults\\.up\\.railway\\.app${view.image.replace(/\//g, "\\/")}"`));
    assert.match(tags, /og:image:width" content="1200"/);
    assert.match(tags, /og:image:height" content="630"/);
    assert.match(tags, /twitter:card" content="summary_large_image"/);
  }
});

test("every results card ends with a news line that opens the race's stories in place", () => {
  const { buildRaceNewsMarkup, buildStageRaceCard, buildRaceCard, buildUpcomingCard } = loadParserExports();
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    date: "22 August – 13 September 2026",
    location: "Spain",
    stageRace: {
      totalStages: 21,
      completedStages: 13,
      stages: [{ number: 13, order: 13, label: "Stage 13", winner: "Wout van Aert", standings: [{ place: "1", rider: "Wout van Aert" }] }],
      latestStage: { number: 13, label: "Stage 13", winner: "Wout van Aert", standings: [{ place: "1", rider: "Wout van Aert" }] },
      generalClassification: { stageNumber: 13, standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP" }] },
      overallResult: [],
    },
  };

  // Nothing cached: a pending line the client fills in, under the GC on a live card.
  const live = buildStageRaceCard(race, { live: true });
  const [, afterGc = ""] = live.split("Overall after stage 13");
  assert.match(afterGc, /data-race-news="2026 Vuelta a España" data-race-news-state="pending"/);
  assert.match(afterGc, /Loading the latest stories/);
  assert.match(afterGc, /aria-controls="race-2026-vuelta-a-espana-news"/);

  // With stories, the leading one is the line and the drawer lists up to eight — the
  // same set and order the retired coverage block showed: newest day first,
  // best-scored story leading within the day.
  const story = (hours, title, publisher = "Reuters", score = 50) => ({
    title,
    publisher,
    url: `https://example.com/${hours}`,
    publishedAt: `Fri, 04 Sep 2026 ${String(hours).padStart(2, "0")}:38:00 GMT`,
    description: "",
    score,
  });
  const articles = [
    story(8, "Van Aert wins Vuelta stage 13, Mas retains red jersey"),
    story(9, "Van Aert powers to victory on stage 13 of Vuelta", "BBC", 70),
    story(7, "Vuelta a España: Wout van Aert finally takes a victory on stage 13", "Cyclingnews"),
    story(6, "Where to watch Vuelta a España 2026", "Sporting News"),
    story(5, "Results Vuelta a España 2026 stage 12", "CyclingUpToDate"),
    story(4, "Cycling-Van Aert wins Vuelta stage 13, Mas retains red"),
    story(3, "Older story"),
    story(2, "Eighth story"),
    story(1, "Ninth story"),
  ];
  const ready = buildRaceNewsMarkup(race, { articles });
  assert.match(ready, /data-race-news-state="ready"/);
  assert.match(ready, /<span class="race-news-ticker-text"><strong>Van Aert powers to victory on stage 13 of Vuelta<\/strong> · BBC, Sep 4, 5:38 AM<\/span>/);
  assert.equal((ready.match(/<li>/g) || []).length, 8);
  assert.match(ready, /Eighth story/);
  assert.doesNotMatch(ready, /Ninth story/);
  assert.match(ready, /<div class="race-news-drawer" id="race-2026-vuelta-a-espana-news" hidden>/);

  // No stories is said plainly, and the line cannot open.
  const empty = buildRaceNewsMarkup(race, { articles: [] });
  assert.match(empty, /data-race-news-state="empty"/);
  assert.match(empty, /No stories found yet/);
  assert.match(empty, / disabled>/);

  // One-day results carry the same line; upcoming races do not.
  assert.match(buildRaceCard({ ...race, stageRace: null, winner: "A" }), /data-race-news="2026 Vuelta a España"/);
  assert.doesNotMatch(buildUpcomingCard(race), /data-race-news/);
});

test("a live race rebuilds itself on a timer and never sends visitors back to the warm-up page", () => {
  const { getLiveRaceRefreshDelayMs, scheduleLiveRaceRefresh, shouldServeHomepageWarmup } = loadParserExports();
  // Mid-afternoon in the host country. The delay follows racing hours, so a run on the
  // wall clock passed by day and failed after 21:00 Paris time (CI, 2026-09-07).
  const afternoon = new Date("2026-09-05T15:00:00.000Z");

  // One TTL after a build that carries a live or just-finished race; nothing otherwise.
  assert.equal(getLiveRaceRefreshDelayMs({ liveStageRaces: [{ id: "vuelta" }] }, afternoon), 60 * 1000);
  assert.equal(getLiveRaceRefreshDelayMs({ liveStageRaces: [], recentResults: [{ finishedToday: true }] }, afternoon), 60 * 1000);
  assert.equal(getLiveRaceRefreshDelayMs({ liveStageRaces: [], recentResults: [{ finishedToday: false }] }, afternoon), 0);

  // The scheduler arms a single timer for that delay and none off-season; the timer
  // must not hold the process open.
  const armed = scheduleLiveRaceRefresh({ liveStageRaces: [{ id: "vuelta" }] }, () => {}, afternoon);
  assert.ok(armed, "a live payload arms the refresh timer");
  assert.equal(typeof armed.unref, "function");
  clearTimeout(armed);
  assert.equal(scheduleLiveRaceRefresh({ liveStageRaces: [] }, () => {}, afternoon), null);

  // Warm-up is for an empty cache only: an expired live payload is served as it is.
  assert.equal(shouldServeHomepageWarmup({ data: null, updatedAt: 0, promise: null }), true);
  assert.equal(shouldServeHomepageWarmup({ data: { liveStageRaces: [{ id: "vuelta" }] }, updatedAt: 0, promise: Promise.resolve() }), false);
});

test("mergeStageRaceSnapshots keeps a general classification one stage behind the stage result", () => {
  const { mergeStageRaceSnapshots } = loadParserExports();
  const race = {
    pageTitle: "2026 Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
  };
  const now = new Date("2026-09-05T16:00:00.000Z");
  const gc = (stageNumber) => ({ stageNumber, standings: [{ place: "1", rider: "Enric Mas", countryCode: "ESP" }] });
  const stages = [12, 13].map((number) => ({ number, order: number, label: `Stage ${number}`, winner: "A", standings: [{ place: "1", rider: "A" }] }));
  // The official site has just published stage 14 and not yet its GC; Wikipedia still
  // has the GC after stage 13. That GC stays, labelled by its own stage.
  const official = {
    totalStages: 21,
    completedStages: 14,
    latestStage: { number: 14, label: "Stage 14", standings: [{ place: "1", rider: "Marco Brenner", countryCode: "GER" }] },
    generalClassification: null,
    overallResult: [],
  };
  const parsed = { totalStages: 21, completedStages: 13, stages, latestStage: stages[1], generalClassification: gc(13), overallResult: [] };
  const merged = mergeStageRaceSnapshots(official, parsed, race, now);
  assert.equal(merged.completedStages, 14);
  assert.equal(merged.latestStage.number, 14);
  assert.equal(merged.generalClassification.stageNumber, 13);

  // Two or more stages behind is stale and still dropped.
  const staleParsed = { ...parsed, generalClassification: gc(12) };
  assert.equal(mergeStageRaceSnapshots(official, staleParsed, race, now).generalClassification, null);
});

test("live polling follows the host country's racing hours and settles down for finished races", () => {
  const { isRaceWithinRacingHours, getRaceDataCacheTtlMs, getLiveRaceRefreshDelayMs, hasRaceEndedDaysAgo, getArticleCacheTtlMs, buildRaceArticleQueries, FETCH_USER_AGENT, YOUTUBE_FETCH_USER_AGENT } = loadParserExports();

  // 05:00 UTC is 13:00 in Guangxi and 07:00 in Paris.
  const early = new Date("2026-10-15T05:00:00.000Z");
  assert.equal(isRaceWithinRacingHours({ countryCode: "CHN" }, early), true);
  assert.equal(isRaceWithinRacingHours({ countryCode: "FRA" }, early), false);
  assert.equal(isRaceWithinRacingHours({}, early), false);
  // 20:30 UTC is 22:30 in Madrid, 16:30 in Montréal.
  const evening = new Date("2026-09-05T20:30:00.000Z");
  assert.equal(isRaceWithinRacingHours({ countryCode: "ESP" }, evening), false);
  assert.equal(isRaceWithinRacingHours({ countryCode: "CAN" }, evening), true);

  // The live TTL and the refresh timer apply only inside those hours.
  const vuelta = { liveStageRaces: [{ id: "vuelta", countryCode: "ESP" }] };
  assert.equal(getRaceDataCacheTtlMs(vuelta, new Date("2026-09-05T15:00:00.000Z")), 60 * 1000);
  assert.equal(getRaceDataCacheTtlMs(vuelta, new Date("2026-09-05T02:00:00.000Z")), 15 * 60 * 1000);
  assert.equal(getLiveRaceRefreshDelayMs(vuelta, new Date("2026-09-05T15:00:00.000Z")), 60 * 1000);
  assert.equal(getLiveRaceRefreshDelayMs(vuelta, new Date("2026-09-05T02:00:00.000Z")), 15 * 60 * 1000);
  assert.equal(getLiveRaceRefreshDelayMs({ liveStageRaces: [] }, new Date("2026-09-05T15:00:00.000Z")), 0);

  // A race that ended yesterday has settled; one ending today has not.
  const today = new Date("2026-09-05T16:00:00.000Z");
  assert.equal(hasRaceEndedDaysAgo({ endDate: new Date("2026-09-04T00:00:00.000Z") }, 1, today), true);
  assert.equal(hasRaceEndedDaysAgo({ endDate: new Date("2026-09-05T00:00:00.000Z") }, 1, today), false);
  assert.equal(hasRaceEndedDaysAgo({ endDate: new Date("2026-09-04T00:00:00.000Z") }, 2, today), false);
  assert.equal(hasRaceEndedDaysAgo({}, 1, today), false);

  // News about a race two days gone: at most a dozen searches, kept six hours. (A
  // typical race builds nine to eleven queries, so the cap mostly guards the odd race
  // with many name variants.)
  const settled = { id: "2026 Tour de Pologne", pageTitle: "2026 Tour de Pologne", title: "Tour de Pologne", winner: "A", endDate: new Date("2026-08-10T00:00:00.000Z"), stageRace: { latestStage: { number: 7, winner: "B" }, completedStages: 7, totalStages: 7 } };
  assert.ok(buildRaceArticleQueries(settled).length <= 12);
  assert.equal(getArticleCacheTtlMs(settled, today), 6 * 60 * 60 * 1000);
  const fresh = { ...settled, endDate: new Date("2026-09-13T00:00:00.000Z") };
  assert.equal(getArticleCacheTtlMs(fresh, today), 15 * 60 * 1000);

  // We say who we are and where to read about it, not "contact Wikipedia".
  assert.match(FETCH_USER_AGENT, /ProCyclingResults\/1\.0; \+https:\/\/github\.com\/streamrD\/ProCyclingResults\/blob\/main\/DATA-SOURCES\.md/);
  assert.doesNotMatch(FETCH_USER_AGENT, /\+https:\/\/wikipedia\.org/);
  // YouTube serves its mobile page, with no videoRenderer entries, to any agent string
  // that carries a token after the policy URL; the finish-video search must end there.
  assert.match(
    YOUTUBE_FETCH_USER_AGENT,
    /^Mozilla\/5\.0 \(compatible; ProCyclingResults\/1\.0; \+https:\/\/github\.com\/streamrD\/ProCyclingResults\/blob\/main\/DATA-SOURCES\.md\)$/,
  );
});

test("indexWikiRevisions maps requested titles through normalization, redirects and missing pages", () => {
  const { indexWikiRevisions } = loadParserExports();
  const payload = {
    query: {
      normalized: [{ from: "2026_Vuelta_a_España", to: "2026 Vuelta a España" }],
      redirects: [{ from: "2026 Vuelta", to: "2026 Vuelta a España" }],
      pages: [
        { title: "2026 Vuelta a España", revisions: [{ revid: 1234 }] },
        { title: "2026 Tour de France", revisions: [{ revid: 99 }] },
        { title: "No Such Race", missing: true },
      ],
    },
  };
  const revids = indexWikiRevisions(payload, ["2026_Vuelta_a_España", "2026 Vuelta", "2026 Tour de France", "No Such Race", "Unasked"]);
  assert.equal(revids.get("2026_Vuelta_a_España"), 1234);
  assert.equal(revids.get("2026 Vuelta"), 1234);
  assert.equal(revids.get("2026 Tour de France"), 99);
  assert.equal(revids.get("No Such Race"), 0);
  assert.equal(revids.has("Unasked"), false);
});

test("describeLiveRaceDay reads rest days, stage days and finish days off the route dates", () => {
  const { describeLiveRaceDay, buildLiveRaceDayNote } = loadParserExports();
  const race = {
    id: "2026 Vuelta a España",
    title: "Vuelta a España",
    countryCode: "ESP",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
    stageRace: {
      totalStages: 21,
      stages: [
        { number: 14, label: "Stage 14", date: "5 September", standings: [{ place: "1", rider: "A" }] },
        { number: 15, label: "Stage 15", date: "6 September", standings: [{ place: "1", rider: "Wout van Aert" }] },
      ],
      route: [
        { number: 15, label: "Stage 15", date: "6 September", course: "Palma del Río to Córdoba" },
        { number: 16, label: "Stage 16", date: "8 September", course: "Cortegana to Palos de la Frontera" },
      ],
    },
  };

  // 7 September, mid-afternoon in Spain: the rest day between stages 15 and 16.
  const rest = describeLiveRaceDay(race, new Date("2026-09-07T14:00:00.000Z"));
  assert.equal(rest.kind, "rest-day");
  assert.equal(buildLiveRaceDayNote(rest).lead, "Rest day, Monday 7 September.");
  assert.equal(buildLiveRaceDayNote(rest).text, "Stage 15 was raced yesterday; racing resumes tomorrow with Stage 16, Cortegana to Palos de la Frontera.");

  // Late on 6 September UTC is still 6 September in Madrid: the stage finished today.
  const finished = describeLiveRaceDay(race, new Date("2026-09-06T21:30:00.000Z"));
  assert.equal(finished.kind, "finished-today");
  assert.equal(buildLiveRaceDayNote(finished).lead, "Stage 15 finished today.");
  assert.equal(buildLiveRaceDayNote(finished).text, "Stage 16 follows on Tuesday 8 September, Cortegana to Palos de la Frontera.");

  // 22:30 UTC on 7 September is already 8 September in Madrid: stage 16 is today and
  // the headline result is from two days back, so it is dated rather than "yesterday".
  const racing = describeLiveRaceDay(race, new Date("2026-09-07T22:30:00.000Z"));
  assert.equal(racing.kind, "racing-today");
  assert.equal(buildLiveRaceDayNote(racing).lead, "Stage 16 is today: Cortegana to Palos de la Frontera.");
  assert.equal(buildLiveRaceDayNote(racing).text, "Results land here after the finish. Stage 15 was raced on Sunday 6 September.");

  // A route without dates, or a day the dates do not explain, gives nothing.
  assert.equal(describeLiveRaceDay(race, new Date("2026-09-10T12:00:00.000Z")), null);
  const undated = { ...race, stageRace: { ...race.stageRace, stages: race.stageRace.stages.map(({ date, ...stage }) => stage), route: [] } };
  assert.equal(describeLiveRaceDay(undated, new Date("2026-09-07T14:00:00.000Z")), null);
  assert.equal(buildLiveRaceDayNote(null), null);
});

test("a live card wears a Rest day pill and dates the Up next row on a rest day", () => {
  const { buildStageRaceCard } = loadParserExports();
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    date: "22 August – 13 September 2026",
    location: "Spain",
    countryCode: "ESP",
    startDate: new Date("2026-08-22T00:00:00.000Z"),
    endDate: new Date("2026-09-13T00:00:00.000Z"),
    stageRace: {
      totalStages: 21,
      completedStages: 15,
      stages: [
        { number: 14, order: 14, label: "Stage 14", date: "5 September", winner: "A", standings: [{ place: "1", rider: "A" }] },
        { number: 15, order: 15, label: "Stage 15", date: "6 September", winner: "Wout van Aert", standings: [{ place: "1", rider: "Wout van Aert" }] },
      ],
      route: [
        { number: 15, label: "Stage 15", date: "6 September", course: "Palma del Río to Córdoba" },
        { number: 16, label: "Stage 16", date: "8 September", course: "Cortegana to Palos de la Frontera", stageType: "flat", distanceKm: 186 },
      ],
    },
  };

  const rest = buildStageRaceCard(race, { live: true, now: new Date("2026-09-07T14:00:00.000Z") });
  assert.match(rest, /<span class="status-pill">Rest day<\/span>/);
  assert.match(
    rest,
    /<p class="stage-status-note"><strong>Rest day, Monday 7 September\.<\/strong> Stage 15 was raced yesterday; racing resumes tomorrow with Stage 16, Cortegana to Palos de la Frontera\.<\/p>/,
  );
  assert.match(rest, /stage-next-row-label">Tomorrow<\/span>\s*<span class="stage-next-row-text">Stage 16 · Tue 8 September · Cortegana to Palos de la Frontera · Flat · /);

  // On a day the dates do not explain the card keeps its usual pill, copy and row label.
  const generic = buildStageRaceCard(race, { live: true, now: new Date("2026-09-10T12:00:00.000Z") });
  assert.match(generic, /<span class="status-pill">Live stage race<\/span>/);
  assert.match(generic, /Live classifications refresh as stage and GC data become available\./);
  assert.match(generic, /stage-next-row-label">Up next<\/span>/);
});

test("the classification standings tables give each jersey its five closest chasers", () => {
  const { extractClassificationStandings, extractCyclingResultBlocks, attachClassificationContenders } =
    loadParserExports();

  // A Grand Tour writes its standings as captioned wikitables, one per classification,
  // and updates them a stage behind the leadership table.
  const grandTour = `
== Classification standings ==

=== Points classification ===
{| class="wikitable"
|+ Points classification after stage 17 (1–10)<ref name="class" />
|-
! scope="col" | Rank
! scope="col" | Rider
! scope="col" | Team
! scope="col" | Points
|-
! scope="row" | 1
| {{Flag athlete|[[Wout van Aert]]|BEL}} {{cjersey|dark green}}
| {{UCI team code|TVL men|2026}}
| align="right" | 295
|-
! scope="row" | 2
| {{Flag athlete|[[Matthew Brennan (cyclist)|Matthew Brennan]]|GBR}}
| {{UCI team code|TVL men|2026}}
| align="right" | 239
|-
! scope="row" | 3
| {{Flag athlete|[[Alessandro Romele]]|ITA}}
| {{UCI team code|XAT|2026}}
| align="right" | 171
|}

=== Young rider classification ===
{| class="wikitable"
|+ Young rider classification after stage 17 (1–10)
|-
! scope="col" | Rank
! scope="col" | Rider
! scope="col" | Team
! scope="col" | Time
|-
! scope="row" | 1
| {{Flag athlete|[[Oscar Onley]]|GBR}} {{cjersey|white}}
| {{UCI team code|NCI|2026b}}
| align="right" | 60h 15' 28"
|-
! scope="row" | 2
| {{Flag athlete|[[Jakob Omrzel]]|SLO}}
| {{UCI team code|TBV|2026}}
| align="right" | + 30"
|}

=== Team classification ===
{| class="wikitable"
|+ Team classification after stage 17 (1–10)
|-
! scope="col" | Rank
! scope="col" | Team
! scope="col" | Time
|-
! scope="row" | 1
| {{flagicon|FRA}} {{UCI team code|DCT|2026}} {{cjersey|red number}}
| align="right" | 180h 49' 41"
|-
! scope="row" | 2
| {{flagicon|KAZ}} {{UCI team code|XAT|2026}}
| align="right" | + 57' 32"
|}
`;
  const teamNames = new Map([
    ["DCT|2026", "Decathlon CMA CGM"],
    ["XAT|2026", "XDS Astana Team"],
  ]);
  const standings = extractClassificationStandings(grandTour, teamNames, []);

  assert.deepEqual(JSON.parse(JSON.stringify(standings.get("points"))), {
    key: "points",
    stageNumber: 17,
    metric: "count",
    metricLabel: "Points",
    entries: [
      { place: "1", rider: "Wout van Aert", countryCode: "BEL", pageTitle: "Wout van Aert", value: "295" },
      {
        place: "2",
        rider: "Matthew Brennan",
        countryCode: "GBR",
        pageTitle: "Matthew Brennan (cyclist)",
        value: "239",
      },
      { place: "3", rider: "Alessandro Romele", countryCode: "ITA", pageTitle: "Alessandro Romele", value: "171" },
    ],
  });
  // The young rider classification is scored in time, not points: the leader carries an
  // elapsed time and everyone below a gap to it.
  assert.deepEqual(JSON.parse(JSON.stringify(standings.get("young"))), {
    key: "young",
    stageNumber: 17,
    metric: "time",
    entries: [
      { place: "1", rider: "Oscar Onley", countryCode: "GBR", pageTitle: "Oscar Onley", time: "60:15:28" },
      { place: "2", rider: "Jakob Omrzel", countryCode: "SLO", pageTitle: "Jakob Omrzel", gap: "+00:30" },
    ],
  });
  // The team classification names teams, resolved through the same map the stage
  // results use, and a code with no name is left out rather than shown raw.
  assert.deepEqual(
    JSON.parse(JSON.stringify(standings.get("team").entries.map((entry) => [entry.rider, entry.time || entry.gap]))),
    [
      ["Decathlon CMA CGM", "180:49:41"],
      ["XDS Astana Team", "+57:32"],
    ],
  );

  // The smaller races write the same standings as {{cyclingresult}} blocks instead,
  // flagging a points classification on the start tag.
  const blockRace = `
{{cyclingresult start|title=General classification after stage 1}}
{{cyclingresult|1|[[Tadej Pogačar]]|SLO|{{UCI team code|UAD men|2026}}|4h 00' 27"|{{cjersey|yellow}}}}
{{cyclingresult end}}

{{cyclingresult start |title=Final points classification (1–10) |points=yes}}
{{cyclingresult|1|[[Tadej Pogačar]]|SLO|{{UCI team code|UAD men|2026}}|203|{{cjersey|yellow}}{{cjersey|orange}}}}
{{cyclingresult|2|[[Dorian Godon]]|FRA|{{UCI team code|IGD|2026a}}|110}}
{{cyclingresult end}}

{{cyclingresult start|title=Final general classification (1–10)}}
{{cyclingresult|1|[[Tadej Pogačar]]|SLO|{{UCI team code|UAD men|2026}}|20h 05' 42"|{{cjersey|yellow}}}}
{{cyclingresult|2|[[Florian Lipowitz]]|GER|{{UCI team code|RBH|2026}}|+ 42"}}
{{cyclingresult end}}
`;
  const blockStandings = extractClassificationStandings(blockRace, new Map(), extractCyclingResultBlocks(blockRace));

  // "|points=yes" lands inside the greedy title= argument, and cleanWikiText turns its
  // pipe into a comma; the block was invisible until the parameter was cut off first.
  assert.deepEqual(JSON.parse(JSON.stringify(blockStandings.get("points"))), {
    key: "points",
    final: true,
    metric: "count",
    metricLabel: "Points",
    entries: [
      { place: "1", rider: "Tadej Pogačar", countryCode: "SLO", pageTitle: "Tadej Pogačar", value: "203" },
      { place: "2", rider: "Dorian Godon", countryCode: "FRA", pageTitle: "Dorian Godon", value: "110" },
    ],
  });
  // A race writes "General classification after stage N" under every stage before its
  // final table, so the newest wins — reading the first one met showed stage 1 all week.
  assert.equal(blockStandings.get("general").final, true);
  assert.equal(blockStandings.get("general").entries[1].gap, "+00:42");

  // A classification with no standings table keeps its plain entry.
  const leaders = attachClassificationContenders(
    {
      stageNumber: 18,
      entries: [
        { key: "points", label: "Points", rider: "Wout van Aert" },
        { key: "polish-rider", label: "Polish rider", rider: "Filip Gruszczyński" },
      ],
    },
    standings,
  );
  assert.equal(leaders.entries[0].contenders.entries.length, 3);
  assert.equal("contenders" in leaders.entries[1], false);
});

test("a caption keeps its own stage even when a citation swallowed the braces after it", () => {
  const { parseClassificationStandingsCaption, extractCyclingResultBlocks } = loadParserExports();

  const caption = (value) => JSON.parse(JSON.stringify(parseClassificationStandingsCaption(value) || null));
  assert.deepEqual(caption("Mountains classification after stage 4 (1–10)"), {
    key: "mountains",
    stageNumber: 4,
  });
  assert.deepEqual(caption("FInal general classification (1–10)"), {
    key: "general",
    final: true,
  });
  assert.deepEqual(caption("General classification after prologue"), {
    key: "general",
    stageNumber: 0,
  });
  // Not a classification standings table, and never to be read as one.
  assert.equal(parseClassificationStandingsCaption("Classification leadership by stage"), null);
  assert.equal(parseClassificationStandingsCaption("Stage characteristics and winners"), null);

  // The block regex stops at the first "}}", which on a cited title is the one closing
  // the citation's own {{cite web}}: the caption arrives with half a reference trailing
  // it, and requiring it to end cleanly put the race a stage behind.
  const cited = `{{cyclingresult start|title=General classification after Stage 5<ref name="gc">{{cite web |title=Results |url=https://example.com |access-date=22 June 2026}}</ref>}}
{{cyclingresult|1|[[Marlen Reusser]]|SUI|{{UCI team code|MOV women|2026}}|11h 58' 35"}}
{{cyclingresult end}}`;
  assert.equal(parseClassificationStandingsCaption(extractCyclingResultBlocks(cited)[0].title).stageNumber, 5);
});

test("a spaced {{cyclingresult start |title=…}} still yields its block", () => {
  const { extractCyclingResultBlocks } = loadParserExports();

  // Every block on the 2026 Giro d'Italia Women and Vuelta a Burgos Feminas pages is
  // written with a space before the parameter list, and all 18 of them were dropped.
  const spaced = `{{cyclingresult start |title=Final general classification (1–10)}}
{{cyclingresult|1|[[Demi Vollering]]|NED|{{UCI team code|FSF|2026}} | 29h 54' 19"| {{cjersey|pink}}}}
{{cyclingresult end}}`;
  const blocks = extractCyclingResultBlocks(spaced);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].title, "Final general classification (1–10)");
});

test("the jersey list carries its contenders card, priced in whatever the classification is scored in", () => {
  const { buildJerseyHoldersMarkup } = loadParserExports();
  const race = {
    stageRace: {
      generalClassification: { stageNumber: 18, standings: [{ place: "1", rider: "Enric Mas" }] },
      classificationLeaders: {
        stageNumber: 18,
        stageLabel: "Stage 18",
        entries: [
          {
            key: "points",
            label: "Points",
            jersey: "dark green",
            rider: "Wout van Aert",
            countryCode: "BEL",
            contenders: {
              stageNumber: 17,
              metric: "count",
              metricLabel: "Points",
              entries: [
                { place: "1", rider: "Wout van Aert", countryCode: "BEL", value: "295" },
                { place: "2", rider: "Matthew Brennan", countryCode: "GBR", value: "239" },
              ],
            },
          },
          {
            key: "young",
            label: "Young rider",
            jersey: "white",
            rider: "Oscar Onley",
            contenders: {
              stageNumber: 17,
              metric: "time",
              entries: [
                { place: "1", rider: "Oscar Onley", countryCode: "GBR", time: "60:15:28" },
                { place: "2", rider: "Jakob Omrzel", countryCode: "SLO", gap: "+00:30" },
                { place: "3", rider: "Léo Bisiaux", countryCode: "FRA" },
              ],
            },
          },
          { key: "polish-rider", label: "Polish rider", rider: "Filip Gruszczyński" },
        ],
      },
    },
  };

  const html = buildJerseyHoldersMarkup(race);

  // The classification carries the card, not the rider beside it: the rider's name
  // already opens the rider card.
  assert.equal((html.match(/<template class="jersey-card-source">/g) || []).length, 2);
  // With a card the label is a button (a tap or Enter opens the top five too, since
  // 2026-09-26) with a one-line gloss of what the classification is scored on.
  assert.match(html, /<button type="button" class="jersey-classification has-contenders" data-jersey-contenders aria-expanded="false" title="Points: sprint and intermediate points">Points<\/button>/);
  assert.match(html, /<span class="jersey-classification">Polish rider<\/span>/);
  // The swatch beside a classification with a card is a second way onto it; beside
  // one without, it stays a plain swatch.
  assert.match(html, /<svg class="jersey-swatch has-contenders" data-jersey-contenders-swatch [^>]*aria-label="dark green jersey">[\s\S]*?<button type="button" class="jersey-classification has-contenders" data-jersey-contenders[^>]*>Points<\/button>/);
  assert.match(html, /<svg class="jersey-swatch" viewBox[^>]*>[\s\S]*?<span class="jersey-classification">Polish rider<\/span>/);
  assert.ok(!/Polish rider<\/span>[\s\S]*?<template/.test(html));

  const [, points = "", young = ""] = html.split("<template class=\"jersey-card-source\">");
  assert.match(points, /<span class="jersey-card-name">Points classification<\/span>/);
  // The card is dated by its own table, which trails the leadership table by a stage.
  assert.match(points, /<span>Top five after stage 17<\/span><span>Points<\/span>/);
  assert.match(points, /<span class="contender-value">295<\/span>/);
  assert.match(young, /<span>Top five after stage 17<\/span><span>Time<\/span>/);
  assert.match(young, /<span class="contender-value">60:15:28<\/span>/);
  assert.match(young, /<span class="contender-value">\+00:30<\/span>/);
  // A gap of nothing behind the leader is the same time, not missing data.
  assert.match(young, /Léo Bisiaux<\/span><span class="contender-value" title="Same time as the leader">same time<\/span>/);
});

test("a stale article pool renders as a placeholder and the news endpoint waits for its refresh", async () => {
  const { articleCache, peekRaceArticlePool, loadRaceArticlePool, getArticleCacheTtlMs } = loadParserExports();
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    startDate: new Date("2026-08-22T00:00:00Z"),
    endDate: new Date("2026-09-13T00:00:00Z"),
  };
  const stale = [{ title: "Küng wins stage 18", publisher: "Reuters", url: "https://example.com/18" }];
  const fresh = [{ title: "Landa wins stage 20", publisher: "Cycling Weekly", url: "https://example.com/20" }];
  // The code reads the window against the real clock, so the test must too: a fixed
  // date inside the race stopped matching once the Vuelta was two days finished.
  const ttl = getArticleCacheTtlMs(race);

  // Warm and inside its window: the card renders ready from it.
  articleCache.set(race.pageTitle, { updatedAt: Date.now() - 1000, data: stale, promise: null });
  assert.equal(peekRaceArticlePool(race), stale);

  // Older than its window: the card renders a placeholder so the client asks for it.
  articleCache.set(race.pageTitle, { updatedAt: Date.now() - ttl - 1000, data: stale, promise: null });
  assert.equal(peekRaceArticlePool(race), null);

  // A refresh already in flight: the endpoint waits for it rather than serving the
  // old stories, and a caller that did not ask to wait still gets the old pool now.
  articleCache.set(race.pageTitle, { updatedAt: Date.now() - ttl - 1000, data: stale, promise: Promise.resolve(fresh) });
  assert.equal(await loadRaceArticlePool(race), stale);
  assert.equal(await loadRaceArticlePool(race, { waitForRefresh: true }), fresh);

  // A refresh that fails leaves the waiting caller with the old pool, not an error.
  const failing = Promise.reject(new Error("bing down"));
  failing.catch(() => {});
  articleCache.set(race.pageTitle, { updatedAt: Date.now() - ttl - 1000, data: stale, promise: failing });
  assert.equal(await loadRaceArticlePool(race, { waitForRefresh: true }), stale);
  articleCache.delete(race.pageTitle);
});

test("every card links out to the full placings on ProCyclingStats", () => {
  const { getRaceResultsUrl, RACE_RESULT_SLUGS, buildRaceCard, buildStageRaceCard, buildJerseyHoldersMarkup } = loadParserExports();

  // One verified address per race in scope, keyed by the page title without its year.
  assert.equal(Object.keys(RACE_RESULT_SLUGS).length, 65);
  const vuelta = { pageTitle: "2026 Vuelta a España", title: "Vuelta a España" };
  assert.equal(getRaceResultsUrl(vuelta, "stage-20"), "https://www.procyclingstats.com/race/vuelta-a-espana/2026/stage-20");
  assert.equal(getRaceResultsUrl(vuelta, "gc"), "https://www.procyclingstats.com/race/vuelta-a-espana/2026/gc");
  assert.equal(
    getRaceResultsUrl({ pageTitle: "2026 Grand Prix Cycliste de Québec", title: "Grand Prix Cycliste de Québec" }),
    "https://www.procyclingstats.com/race/gp-quebec/2026/result",
  );
  // A race the map does not know goes to the PCS search page, dashes as spaces.
  assert.equal(
    getRaceResultsUrl({ pageTitle: "2026 Tour de Nowhere–Sur-Mer", title: "Tour de Nowhere–Sur-Mer" }),
    "https://www.procyclingstats.com/search.php?term=Tour%20de%20Nowhere%20Sur%20Mer%202026",
  );
  assert.equal(getRaceResultsUrl({}), "");

  // A one-day card: the results link beside the finish video, in one row.
  const oneDay = buildRaceCard({
    id: "2026 Grand Prix Cycliste de Québec",
    pageTitle: "2026 Grand Prix Cycliste de Québec",
    title: "Grand Prix Cycliste de Québec",
    series: "Men's WorldTour",
    date: "11 September 2026",
    location: "Canada",
    winner: "Remco Evenepoel",
    finishVideoUrl: "https://www.youtube.com/watch?v=quebec",
  });
  assert.match(oneDay, /<div class="race-links">\s*<a class="race-finish-link" href="https:\/\/www\.youtube\.com\/watch\?v=quebec"[\s\S]*?<a class="race-results-link" href="https:\/\/www\.procyclingstats\.com\/race\/gp-quebec\/2026\/result" target="_blank" rel="noreferrer">Full results on ProCyclingStats ↗<\/a><\/div>/);

  // A stage panel links its own stage.
  const stageRace = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    date: "22 August – 13 September 2026",
    location: "Spain",
    stageRace: {
      totalStages: 21,
      completedStages: 2,
      stages: [
        { number: 1, order: 1, label: "Stage 1", winner: "A", standings: [{ place: "1", rider: "A" }] },
        { number: 2, order: 2, label: "Stage 2", winner: "B", standings: [{ place: "1", rider: "B" }] },
      ],
      latestStage: { number: 2, label: "Stage 2", winner: "B", standings: [{ place: "1", rider: "B" }] },
      generalClassification: { stageNumber: 2, standings: [{ place: "1", rider: "B" }] },
      classificationLeaders: {
        stageNumber: 2,
        entries: [
          {
            key: "general",
            label: "General",
            jersey: "red",
            rider: "B",
            contenders: { key: "general", stageNumber: 2, metric: "time", entries: [{ place: "1", rider: "B", time: "5:00:00" }] },
          },
          {
            key: "team",
            label: "Team",
            jersey: "red number",
            rider: "Team X",
            contenders: { key: "team", stageNumber: 2, metric: "time", entries: [{ place: "1", rider: "Team X", time: "15:00:00" }] },
          },
        ],
      },
    },
  };
  const card = buildStageRaceCard(stageRace, { live: true });
  const [, stageOnePanel = "", stageTwoPanel = ""] = card.split(/id="2026-vuelta-a-espana-stage-\d"/);
  // The button names where it goes: every one leaves the page for ProCyclingStats.
  assert.match(stageOnePanel, /race\/vuelta-a-espana\/2026\/stage-1" target="_blank" rel="noreferrer">Full stage results on ProCyclingStats ↗</);
  assert.match(stageTwoPanel, /race\/vuelta-a-espana\/2026\/stage-2" target="_blank" rel="noreferrer">Full stage results on ProCyclingStats ↗</);

  // The jersey card ends with the classification's PCS page; the team jersey, whose
  // classification has no page there, carries no link.
  const jerseys = buildJerseyHoldersMarkup(stageRace);
  const [, general = "", team = ""] = jerseys.split('<template class="jersey-card-source">');
  assert.match(general, /<div class="rider-card-links"><a href="https:\/\/www\.procyclingstats\.com\/race\/vuelta-a-espana\/2026\/gc" target="_blank" rel="noreferrer">Full classification on ProCyclingStats \u2197<\/a><\/div><\/template>/);
  assert.doesNotMatch(team, /rider-card-links/);
});


test("buildSeasonCloseout waits for the last race, then counts the first season from launch day", () => {
  const { buildSeasonCalendar, buildSeasonCloseout, describeCloseoutSeason } = loadParserExports();
  const races = buildCalendarFixture();
  assert.equal(buildSeasonCloseout(buildSeasonCalendar(races, new Date("2026-10-15T12:00:00Z")), null), null);

  const closeout = buildSeasonCloseout(buildSeasonCalendar(races, new Date("2026-10-19T08:00:00Z")), null);
  assert.equal(closeout.year, 2026);
  assert.equal(closeout.nextYear, 2027);
  // Launch was 29 April: the Tour Down Under and Milan–San Remo came before it.
  assert.equal(closeout.raceCount, 5);
  assert.equal(closeout.lastRace.title, "Tour of Chongming Island");
  assert.equal(
    describeCloseoutSeason(closeout),
    "ProCyclingResults launched at the end of April, 2026, in the middle of the Tour de Romandie. From then until the last stage of the Tour of Chongming Island on 15 October, we recorded the results for 5 WorldTour races and had a great deal of fun doing so. Thank you for coming along for the ride.",
  );
});

test("buildSeasonCloseoutHero shows the next season's first day only once its calendar has one", () => {
  const { buildSeasonCalendar, buildSeasonCloseout, buildSeasonCloseoutHero } = loadParserExports();
  const calendar = buildSeasonCalendar(buildCalendarFixture(), new Date("2026-11-02T08:00:00Z"));

  const waiting = buildSeasonCloseoutHero(buildSeasonCloseout(calendar, null), "");
  assert.match(waiting, /<h1 id="closeout-title">Thank you, 2026<\/h1>/);
  assert.match(waiting, /<span>First results<\/span>January 2027/);
  assert.match(waiting, /once the 2027 WorldTour calendar is published/);
  assert.match(waiting, /welcoming you back for the 2027 racing season/);

  const opening = { year: 2027, date: "2027-01-16", title: "Women's Tour Down Under" };
  const known = buildSeasonCloseoutHero(buildSeasonCloseout(calendar, opening), "");
  assert.match(known, /<span>First results<\/span>16 January 2027/);
  assert.match(known, /The Women&#39;s Tour Down Under opens the 2027 season\./);

  // A probe answer for some other season is never printed as next season's date.
  const stale = buildSeasonCloseout(calendar, { ...opening, year: 2026 });
  assert.equal(stale.nextSeasonOpening, null);
});

test("resolveSeasonYear moves to the new season a week before its first race and never back", async () => {
  const { resolveSeasonYear, findSeasonOpening, getSeasonSources } = loadParserExports();
  const opening = { year: 2027, date: "2027-01-16", title: "Women's Tour Down Under" };
  const probe = async (year) => (year === 2027 ? opening : null);
  const missing = async () => null;

  assert.equal(await resolveSeasonYear(new Date("2026-11-20T00:00:00Z"), probe, 2026), 2026);
  assert.equal(await resolveSeasonYear(new Date("2027-01-08T23:00:00Z"), probe, 2026), 2026);
  assert.equal(await resolveSeasonYear(new Date("2027-01-09T00:00:00Z"), probe, 2026), 2027);
  // No 2027 pages yet: stay on the closed season rather than show an empty one.
  assert.equal(await resolveSeasonYear(new Date("2027-01-20T00:00:00Z"), missing, 2026), 2026);
  // Once moved on, a failed probe does not flip the site back.
  assert.equal(await resolveSeasonYear(new Date("2027-01-20T00:00:00Z"), missing, 2027), 2027);

  assert.deepEqual(
    // Spread out of the VM's realm so deepStrictEqual compares values, not prototypes.
    [...getSeasonSources(2027).map((season) => season.pageTitle)],
    ["2027_UCI_World_Tour", "2027_UCI_Women's_World_Tour"],
  );
  assert.deepEqual({
    ...findSeasonOpening(
      [
        { title: "Tour Down Under", startDate: new Date("2027-01-19T00:00:00Z") },
        { title: "Women's Tour Down Under", startDate: new Date("2027-01-16T00:00:00Z") },
        { title: "Cancelled", startDate: new Date("2027-01-02T00:00:00Z"), isCancelled: true },
      ],
      2027,
    ),
  }, opening);
});

// Captures the JSON lines logEvent writes during `run` and lets everything else
// (the test reporter's own output) through to the real stdout.
async function captureLogLines(run) {
  const lines = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk, ...rest) => {
    const text = String(chunk);
    if (text.startsWith('{"time":')) {
      lines.push(text);
      return true;
    }
    return originalWrite.call(process.stdout, chunk, ...rest);
  };
  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }
  return lines;
}

test("logEvent writes one JSON line per call and never throws", async () => {
  const { logEvent } = loadParserExports();
  const circular = {};
  circular.self = circular;
  const lines = await captureLogLines(() => {
    logEvent("error", "race-data-build-failed", { includeDeferred: false, error: new Error("Wikipedia answered 503"), skipped: undefined });
    logEvent("warn", "circular", { circular });
    logEvent("info", "long", { message: "x".repeat(2000) });
    logEvent("info", "no-fields");
    logEvent(undefined, undefined, null);
  });

  assert.equal(lines.length, 5, "one line per call, including the ones that could not be serialised");
  lines.forEach((line) => {
    assert.ok(line.endsWith("\n"));
    assert.equal(line.trim().split("\n").length, 1, "never more than one line per event");
  });

  const failed = JSON.parse(lines[0]);
  assert.equal(failed.level, "error");
  assert.equal(failed.event, "race-data-build-failed");
  assert.match(failed.time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(failed.includeDeferred, false);
  assert.equal(failed.error.name, "Error");
  assert.equal(failed.error.message, "Wikipedia answered 503");
  assert.equal(typeof failed.error.stack, "string");
  assert.ok(!("skipped" in failed), "undefined fields are left out rather than written as null");

  // A value JSON cannot serialise still produces a line, and never an exception.
  assert.equal(JSON.parse(lines[1]).event, "log-failed");
  const long = JSON.parse(lines[2]);
  assert.ok(long.message.length <= 601 && long.message.endsWith("…"), "long strings are clipped");
  assert.deepEqual(Object.keys(JSON.parse(lines[3])), ["time", "level", "event"]);
  assert.equal(JSON.parse(lines[4]).level, "info");
});

test("describeDataStatus counts every section and repeats the last build outcome", () => {
  const { describeDataStatus } = loadParserExports();
  const now = Date.parse("2026-09-27T10:00:00.000Z");
  const data = {
    fetchedAt: "2026-09-27T09:58:00.000Z",
    liveStageRaces: [{ id: "a" }],
    recentResults: [{ id: "b" }, { id: "c" }],
    finalizedStageRaces: [],
    upcomingRaces: [{ id: "d" }, { id: "e" }, { id: "f" }],
    nationalChampionships: { rows: [{}, {}, {}, {}], error: "" },
  };
  const raceCache = { updatedAt: now - 120000, data, promise: null, lastBuildAt: "2026-09-27T09:58:00.000Z", lastBuildError: null };
  const metadataCache = {
    updatedAt: now - 300000,
    data: { allRaces: new Array(70).fill({}), fetchedAt: "2026-09-27T09:55:00.000Z" },
    promise: null,
    lastBuildError: null,
  };

  // Objects built inside the VM carry its Object.prototype, which strict deep equality
  // compares; spreading them into this realm keeps the comparison about the values.
  const status = describeDataStatus(data, { now, raceCache, metadataCache });
  assert.deepEqual({ ...status.sections }, { liveStageRaces: 1, recentResults: 2, finalizedStageRaces: 0, upcomingRaces: 3, nationalChampionships: 4 });
  assert.equal(status.nationalsError, null);
  assert.equal(status.lastBuildAt, "2026-09-27T09:58:00.000Z");
  assert.equal(status.lastBuildError, null);
  assert.deepEqual({ ...status.metadata }, { allRaceCount: 70, fetchedAt: "2026-09-27T09:55:00.000Z", lastError: null });
  // The freshness fields the page's refresh button reads are unchanged.
  assert.equal(status.fetchedAt, data.fetchedAt);
  assert.equal(status.ageMs, 120000);
  assert.equal(typeof status.ttlMs, "number");
  assert.equal(status.nextRebuildDueMs, Math.max(0, status.ttlMs - 120000));
  assert.equal(status.rebuilding, false);

  // A payload whose nationals source failed, from a cache whose last rebuild failed
  // while another is running: every one of those is visible without the page.
  const lastBuildError = { message: "buildRaceData is not a function", at: "2026-09-27T09:59:30.000Z" };
  const failed = describeDataStatus(
    { ...data, nationalChampionships: { rows: [], error: "Request failed: 503 Service Unavailable" } },
    {
      now,
      raceCache: { ...raceCache, promise: Promise.resolve(), lastBuildAt: lastBuildError.at, lastBuildError },
      metadataCache: { ...metadataCache, lastBuildError: { message: "Request failed: 429 Too Many Requests", at: "2026-09-27T09:59:00.000Z" } },
    },
  );
  assert.equal(failed.sections.nationalChampionships, 0);
  assert.equal(failed.nationalsError, "Request failed: 503 Service Unavailable");
  assert.equal(failed.lastBuildError, lastBuildError, "the cache's own record is passed through untouched");
  assert.equal(failed.lastBuildAt, lastBuildError.at);
  assert.equal(failed.rebuilding, true);
  assert.equal(failed.metadata.lastError.message, "Request failed: 429 Too Many Requests");

  // An empty or missing section counts as zero rather than throwing.
  assert.deepEqual({ ...describeDataStatus({}, { now, raceCache: { updatedAt: 0, data: null, promise: null }, metadataCache: { data: null } }).sections }, {
    liveStageRaces: 0,
    recentResults: 0,
    finalizedStageRaces: 0,
    upcomingRaces: 0,
    nationalChampionships: 0,
  });
});

test("a failed rebuild records lastBuildError on the cache and logs one line; the next success clears it", async () => {
  const { refreshRaceDataInBackground, describeDataStatus, getRaceDataCacheForTest, stubFunctionForTest } = loadParserExports();
  const metadata = { allRaces: [], fetchedAt: "2026-09-27T09:55:00.000Z" };

  // A cold start whose build throws: no payload, no promise left behind, the error kept.
  stubFunctionForTest("buildRaceData", async () => {
    throw new Error("Wikipedia answered 503");
  });
  const failureLines = await captureLogLines(() =>
    assert.rejects(refreshRaceDataInBackground(metadata, { includeDeferred: false, resetOnFailure: true }), /503/),
  );
  const failedCache = getRaceDataCacheForTest();
  assert.equal(failedCache.data, null);
  assert.equal(failedCache.promise, null);
  assert.equal(failedCache.lastBuildError.message, "Wikipedia answered 503");
  assert.match(failedCache.lastBuildError.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(failedCache.lastBuildAt, failedCache.lastBuildError.at);
  const failureEvents = failureLines.map((line) => JSON.parse(line));
  assert.deepEqual(failureEvents.map((event) => event.event), ["race-data-build-failed"]);
  assert.equal(failureEvents[0].error.message, "Wikipedia answered 503");
  assert.equal(failureEvents[0].resetOnFailure, true);
  assert.equal(failureEvents[0].keptPreviousPayload, false);

  // A build that succeeds clears the error and stamps the attempt.
  const payload = {
    fetchedAt: "2026-09-27T10:00:00.000Z",
    liveStageRaces: [],
    recentResults: [],
    finalizedStageRaces: [],
    upcomingRaces: [],
    nationalChampionships: { rows: [{}], error: "" },
  };
  stubFunctionForTest("buildRaceData", async () => payload);
  const successLines = await captureLogLines(() => refreshRaceDataInBackground(metadata, { includeDeferred: false, resetOnFailure: false }));
  const okCache = getRaceDataCacheForTest();
  assert.equal(okCache.data, payload);
  assert.equal(okCache.lastBuildError, null);
  assert.ok(okCache.updatedAt > 0);
  assert.match(okCache.lastBuildAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(successLines, [], "a successful build is quiet");

  // A later failure with resetOnFailure: false keeps the payload and its age, and
  // /api/data-status says both: the payload it serves and the rebuild that failed.
  stubFunctionForTest("buildRaceData", async () => {
    throw new Error("The operation was aborted due to timeout");
  });
  const keptLines = await captureLogLines(() =>
    assert.rejects(refreshRaceDataInBackground(metadata, { includeDeferred: false, resetOnFailure: false }), /timeout/),
  );
  const keptCache = getRaceDataCacheForTest();
  assert.equal(keptCache.data, payload);
  assert.equal(keptCache.updatedAt, okCache.updatedAt);
  assert.equal(keptCache.lastBuildError.message, "The operation was aborted due to timeout");
  assert.equal(JSON.parse(keptLines[0]).keptPreviousPayload, true);
  const status = describeDataStatus(payload, { raceCache: keptCache, metadataCache: { data: metadata, lastBuildError: null } });
  assert.equal(status.fetchedAt, payload.fetchedAt);
  assert.equal(status.sections.nationalChampionships, 1);
  assert.equal(status.lastBuildError.message, "The operation was aborted due to timeout");
  assert.equal(status.metadata.allRaceCount, 0);
});

test("verify-deploy parses its arguments, defaults to production and summarises the status", () => {
  const { parseArgs, describeStatus, DEFAULT_BASE_URL, SECTION_HEADING_MARKERS, RACE_CARD_MARKER } = require("../scripts/verify-deploy.js");
  assert.equal(DEFAULT_BASE_URL, "https://procyclingresults.up.railway.app");
  assert.deepEqual(parseArgs([]), { sha: "", baseUrl: DEFAULT_BASE_URL, pollIntervalMs: 10000, help: false });
  assert.equal(parseArgs(["--sha=77674E9"]).sha, "77674e9");
  assert.equal(parseArgs(["--sha", "77674e9abcdef"]).sha, "77674e9", "a full sha is cut to the seven characters build-info reports");
  assert.equal(parseArgs(["--base-url=http://localhost:3000/"]).baseUrl, "http://localhost:3000");
  assert.equal(parseArgs(["--poll-interval-ms=500"]).pollIntervalMs, 500);
  assert.equal(parseArgs(["--help"]).help, true);
  assert.throws(() => parseArgs(["--sha=zz"]), /seven hex/);
  assert.throws(() => parseArgs(["--base-url=ftp://example.org"]), /http/);
  assert.throws(() => parseArgs(["--poll-interval-ms=1"]), /250 or more/);
  assert.throws(() => parseArgs(["--bogus"]), /Unknown option/);
  assert.throws(() => parseArgs(["extra"]), /Unexpected argument/);

  // The markers it greps the page for are what buildHtmlPage writes: the card anchors
  // the season calendar links to, and the section headings.
  // Cards only: a finished card's folded panels and every news drawer carry race- ids too.
  const sample = '<article class="card" id="race-a"><div id="race-a-news"></div><div class="detail-panel" id="race-a-gc"></div></article><article class="card" id="race-b"></article>';
  assert.equal((sample.match(RACE_CARD_MARKER) || []).length, 2);
  assert.ok(SECTION_HEADING_MARKERS.includes("WorldTour</h2>"));
  assert.ok(SECTION_HEADING_MARKERS.includes("National Championships</h2>"));

  assert.equal(
    describeStatus({
      sections: { liveStageRaces: 1, recentResults: 12, finalizedStageRaces: 3, upcomingRaces: 8, nationalChampionships: 90 },
      nationalsError: null,
      lastBuildError: null,
    }),
    "live 1, recent 12, finalized 3, upcoming 8, nationals 90 federations, last build error: none",
  );
  assert.match(
    describeStatus({ sections: {}, nationalsError: "Request failed: 503", lastBuildError: { message: "boom", at: "2026-09-27T10:00:00.000Z" } }),
    /nationals \? federations \(error: Request failed: 503\), last build error: boom at 2026-09-27T10:00:00\.000Z$/,
  );
});

// ---------------------------------------------------------------------------------
// The HTTP layer (2026-09-26): compression, minified JSON, the render cache, the API
// token bucket, the scheme allow-list, the static guard, the debug gate and the
// editor's failure throttle. A fake response records what the helpers send; the
// helpers read the request through response.req, as Node's ServerResponse exposes it.
// ---------------------------------------------------------------------------------
function makeFakeResponse(headers = {}) {
  const out = { statusCode: 0, headers: null, body: null };
  return {
    out,
    req: { headers },
    writeHead(statusCode, responseHeaders) {
      out.statusCode = statusCode;
      out.headers = responseHeaders;
    },
    end(body) {
      out.body = body;
    },
  };
}

test("sendHtml and sendJson negotiate br, then gzip, then identity, and carry the security headers", () => {
  const { sendHtml, sendJson, securityHeaders, parseAcceptEncoding, chooseResponseEncoding } = loadParserExports();
  const zlib = require("zlib");
  const html = "<!doctype html><p>" + "race ".repeat(2000) + "</p>";

  const brotli = makeFakeResponse({ "accept-encoding": "gzip, deflate, br" });
  sendHtml(brotli, 200, html);
  assert.equal(brotli.out.statusCode, 200);
  assert.equal(brotli.out.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(brotli.out.headers["content-encoding"], "br");
  assert.equal(brotli.out.headers.vary, "accept-encoding");
  assert.equal(brotli.out.headers["cache-control"], "no-store");
  assert.equal(brotli.out.headers["content-length"], brotli.out.body.length);
  assert.ok(brotli.out.body.length < html.length / 4);
  assert.equal(zlib.brotliDecompressSync(brotli.out.body).toString("utf8"), html);

  // A weight of zero is a refusal, so this client gets gzip.
  const gzip = makeFakeResponse({ "accept-encoding": "gzip;q=1.0, br;q=0" });
  sendHtml(gzip, 200, html);
  assert.equal(gzip.out.headers["content-encoding"], "gzip");
  assert.equal(zlib.gunzipSync(gzip.out.body).toString("utf8"), html);

  const plain = makeFakeResponse({});
  sendHtml(plain, 404, html);
  assert.equal(plain.out.statusCode, 404);
  assert.equal(plain.out.headers["content-encoding"], undefined);
  assert.equal(plain.out.headers["content-length"], Buffer.byteLength(html));
  assert.equal(plain.out.body.toString("utf8"), html);

  // Bodies under a kilobyte go as they are, whatever the client accepts.
  const small = makeFakeResponse({ "accept-encoding": "br" });
  sendJson(small, 200, { ok: true });
  assert.equal(small.out.headers["content-encoding"], undefined);
  assert.equal(small.out.body.toString("utf8"), '{"ok":true}');

  const expected = securityHeaders();
  assert.equal(expected["x-content-type-options"], "nosniff");
  assert.equal(expected["x-frame-options"], "DENY");
  assert.equal(expected["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(expected["strict-transport-security"], /max-age=31536000; includeSubDomains/);
  assert.match(expected["permissions-policy"], /camera=\(\)/);
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(brotli.out.headers[name], value);
    assert.equal(plain.out.headers[name], value);
    assert.equal(small.out.headers[name], value);
  }

  assert.deepEqual([...parseAcceptEncoding("br;q=0.8, gzip;q=0, identity")], ["br", "identity"]);
  assert.equal(chooseResponseEncoding({ headers: { "accept-encoding": "deflate" } }), "identity");
  assert.equal(chooseResponseEncoding({ headers: {} }), "identity");
  assert.equal(chooseResponseEncoding(undefined), "identity");
});

test("API JSON is minified unless ?pretty=1 asks for the indented form", () => {
  const { sendJson, serializeJson } = loadParserExports();
  const payload = { fetchedAt: "2026-09-26T10:00:00.000Z", recentResults: [{ id: "a", winner: "B" }] };
  assert.equal(serializeJson(payload), JSON.stringify(payload));
  assert.equal(serializeJson(payload, true), JSON.stringify(payload, null, 2));

  const compact = makeFakeResponse({});
  sendJson(compact, 200, payload);
  assert.equal(compact.out.body.toString("utf8"), JSON.stringify(payload));
  assert.equal(compact.out.headers["content-type"], "application/json; charset=utf-8");

  const pretty = makeFakeResponse({});
  sendJson(pretty, 200, payload, { pretty: true });
  assert.equal(pretty.out.body.toString("utf8"), JSON.stringify(payload, null, 2));

  const limited = makeFakeResponse({});
  sendJson(limited, 429, { error: "slow down" }, { headers: { "retry-after": "3" } });
  assert.equal(limited.out.statusCode, 429);
  assert.equal(limited.out.headers["retry-after"], "3");
});

test("getCachedResponseBody renders once per payload, view and minute, and stays small", () => {
  const { getCachedResponseBody, buildResponseCacheKey } = loadParserExports();
  const cache = new Map();
  let renders = 0;
  const build = () => {
    renders += 1;
    return "<p>" + "x".repeat(2000) + "</p>";
  };
  const data = { fetchedAt: "2026-09-26T10:00:00.000Z" };
  const at = Date.UTC(2026, 8, 26, 10, 5, 30);

  const key = buildResponseCacheKey(data, "page:/", at);
  const first = getCachedResponseBody(key, build, cache);
  const second = getCachedResponseBody(key, build, cache);
  assert.equal(renders, 1);
  assert.equal(first, second);
  // Same minute, different second: still the same copy.
  assert.equal(getCachedResponseBody(buildResponseCacheKey(data, "page:/", at + 20000), build, cache), first);

  // A new minute, a new payload or another view each render again.
  getCachedResponseBody(buildResponseCacheKey(data, "page:/", at + 60000), build, cache);
  getCachedResponseBody(buildResponseCacheKey({ fetchedAt: "2026-09-26T10:15:00.000Z" }, "page:/", at), build, cache);
  getCachedResponseBody(buildResponseCacheKey(data, "page:/calendar", at), build, cache);
  assert.equal(renders, 4);
  assert.notEqual(buildResponseCacheKey(data, "races", at), buildResponseCacheKey(data, "races:pretty", at));

  for (let index = 0; index < 20; index += 1) {
    getCachedResponseBody("view" + index + "|" + index, build, cache);
  }
  assert.ok(cache.size <= 8);
});

test("the API token bucket allows a burst of sixty, refills one a second, and spares the polls", () => {
  const { takeApiRateToken, isRateLimitedApiPath, getClientAddress } = loadParserExports();
  const buckets = new Map();
  const limit = { capacity: 60, refillPerSecond: 1 };
  const start = Date.UTC(2026, 8, 26, 10, 0, 0);

  for (let index = 0; index < 60; index += 1) {
    assert.equal(takeApiRateToken("203.0.113.9", start, limit, buckets).allowed, true);
  }
  const refused = takeApiRateToken("203.0.113.9", start, limit, buckets);
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 1);
  // Another client has its own bucket.
  assert.equal(takeApiRateToken("198.51.100.4", start, limit, buckets).allowed, true);
  // A second later one token is back, and only one.
  assert.equal(takeApiRateToken("203.0.113.9", start + 1000, limit, buckets).allowed, true);
  assert.equal(takeApiRateToken("203.0.113.9", start + 1000, limit, buckets).allowed, false);
  // A minute idle restores the whole burst.
  assert.equal(takeApiRateToken("203.0.113.9", start + 61000, limit, buckets).allowed, true);
  assert.equal(buckets.get("203.0.113.9").tokens, 59);

  assert.equal(isRateLimitedApiPath("/api/race-news"), true);
  assert.equal(isRateLimitedApiPath("/api/races"), true);
  assert.equal(isRateLimitedApiPath("/api/site-content"), true);
  assert.equal(isRateLimitedApiPath("/api/data-status"), false);
  assert.equal(isRateLimitedApiPath("/api/build-info"), false);
  assert.equal(isRateLimitedApiPath("/"), false);
  assert.equal(isRateLimitedApiPath("/assets/favicon.svg"), false);

  assert.equal(
    getClientAddress({ headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }, socket: { remoteAddress: "10.0.0.2" } }),
    "203.0.113.9",
  );
  assert.equal(getClientAddress({ headers: {}, socket: { remoteAddress: "10.0.0.2" } }), "10.0.0.2");
});

test("feed links that are not http(s) are dropped before they reach an href", () => {
  const { safeHttpUrl, normalizeArticleUrl, buildArticleItem, extractFeedItems } = loadParserExports();
  assert.equal(safeHttpUrl("https://www.cyclingnews.com/news/a-story/"), "https://www.cyclingnews.com/news/a-story/");
  assert.equal(safeHttpUrl("http://example.com/x?y=1"), "http://example.com/x?y=1");
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("data:text/html;base64,PHNjcmlwdD4="), "");
  assert.equal(safeHttpUrl("//example.com/x"), "");
  assert.equal(safeHttpUrl("not a url"), "");
  assert.equal(safeHttpUrl(""), "");
  // The Bing redirect is unwrapped, and its target gets the same rule.
  assert.equal(
    normalizeArticleUrl("https://www.bing.com/news/apiclick.aspx?ref=FexRss&url=https%3A%2F%2Fexample.com%2Fstory"),
    "https://example.com/story",
  );
  assert.equal(normalizeArticleUrl("https://www.bing.com/news/apiclick.aspx?ref=FexRss&url=javascript%3Aalert(1)"), "");

  const race = { id: "2026 Tour de France", title: "Tour de France", date: "2026-07-05" };
  const feed = [
    "<rss><channel>",
    "<item><title>Pogačar wins - Cyclingnews</title><link>javascript:alert(1)</link><description>Stage story</description><News:Source>Cyclingnews</News:Source></item>",
    "<item><title>Vingegaard answers - Cyclingnews</title><link>data:text/html,hi</link><description>Stage story</description><News:Source>Cyclingnews</News:Source></item>",
    "<item><title>Evenepoel holds on - Cyclingnews</title><link>https://www.cyclingnews.com/news/evenepoel/</link><description>Stage story</description><News:Source>Cyclingnews</News:Source></item>",
    "</channel></rss>",
  ].join("");
  const items = extractFeedItems(feed).map((block) => buildArticleItem(block, race));
  assert.deepEqual(
    [...items.map((item) => item.url)],
    ["", "", "https://www.cyclingnews.com/news/evenepoel/"],
  );
  // The pool keeps only items with an address, so the two hostile links never render.
  const kept = items.filter((item) => item.url && item.title);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].url, "https://www.cyclingnews.com/news/evenepoel/");
});

test("finish video addresses that are not http(s) are dropped, and a YouTube id must look like one", () => {
  const { getStageFinishVideoUrl, getRaceFinishVideoUrl, parseYouTubeSearchVideos } = loadParserExports();
  const race = {
    id: "2026 Nowhere Tour",
    title: "Nowhere Tour",
    stageRace: { completedStages: 2, latestStage: { number: 2, finishVideoUrl: "javascript:alert(1)" } },
  };
  assert.equal(getStageFinishVideoUrl(race, { number: 2, finishVideoUrl: "data:text/html,x" }), "");
  assert.equal(
    getStageFinishVideoUrl(race, { number: 2, finishVideoUrl: "https://www.youtube.com/watch?v=abcdefghijk" }),
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
  assert.equal(getRaceFinishVideoUrl(race), "");
  assert.equal(
    getRaceFinishVideoUrl({ ...race, stageRace: null, finishVideoUrl: "https://youtu.be/abcdefghijk" }),
    "https://youtu.be/abcdefghijk",
  );
  // The curated map still answers, unchanged.
  assert.equal(
    getStageFinishVideoUrl({ pageTitle: "2026 Giro d'Italia", title: "Giro d'Italia" }, { number: 1 }),
    "https://www.youtube.com/watch?v=k9etTDahUFo",
  );

  const html = fs.readFileSync(path.join(__dirname, "fixtures", "youtube-search-tdf-stage21.html"), "utf8");
  assert.equal(parseYouTubeSearchVideos(html).length, 8);
  const tampered = html.replace('"videoId": "tntStage210"', '"videoId": "x"');
  assert.notEqual(tampered, html);
  const videos = parseYouTubeSearchVideos(tampered);
  assert.equal(videos.length, 7);
  assert.ok(videos.every((video) => /^[A-Za-z0-9_-]{11}$/.test(video.id)));
});

test("the static file guard needs the assets directory plus a separator, and only text assets are compressed", async () => {
  const { sendStaticFile } = loadParserExports();
  const sibling = makeFakeResponse({});
  assert.equal(await sendStaticFile(sibling, "/assets/../assets-other/x"), true);
  assert.equal(sibling.out.statusCode, 403);
  const escaped = makeFakeResponse({});
  assert.equal(await sendStaticFile(escaped, "/assets/../server.js"), true);
  assert.equal(escaped.out.statusCode, 403);
  const missing = makeFakeResponse({});
  assert.equal(await sendStaticFile(missing, "/assets/no-such-file.svg"), false);

  const svg = makeFakeResponse({ "accept-encoding": "br" });
  assert.equal(await sendStaticFile(svg, "/assets/favicon.svg"), true);
  assert.equal(svg.out.statusCode, 200);
  assert.equal(svg.out.headers["content-type"], "image/svg+xml; charset=utf-8");
  assert.equal(svg.out.headers["content-encoding"], "br");
  assert.equal(svg.out.headers["cache-control"], "public, max-age=31536000, immutable");
  assert.equal(svg.out.headers["x-content-type-options"], "nosniff");

  const font = makeFakeResponse({ "accept-encoding": "br" });
  assert.equal(await sendStaticFile(font, "/assets/fonts/manrope-500.woff2"), true);
  assert.equal(font.out.headers["content-type"], "font/woff2");
  assert.equal(font.out.headers["content-encoding"], undefined);
  assert.equal(font.out.headers["content-length"], font.out.body.length);
  assert.equal(font.out.headers["x-frame-options"], "DENY");
});

test("renderMarkdown refuses protocol-relative addresses, and a figure only from /assets or https", () => {
  const { renderMarkdown } = loadParserExports();
  const html = renderMarkdown([
    "[elsewhere](//evil.example/x) and [home](/about) and [http](http://example.com/x)",
    "",
    "![leaves](//evil.example/x.png)",
    "",
    "![plain](http://example.com/x.png)",
    "",
    "![ours](/assets/grupetto.jpg)",
    "",
    "![theirs](https://example.com/x.png)",
  ].join("\n"));

  assert.match(html, /\[elsewhere\]\(\/\/evil\.example\/x\)/);
  assert.doesNotMatch(html, /href="\/\/evil/);
  assert.match(html, /<a href="\/about">home<\/a>/);
  assert.match(html, /<a href="http:\/\/example\.com\/x" target="_blank" rel="noreferrer">http<\/a>/);
  assert.match(html, /<p>!\[leaves\]\(\/\/evil\.example\/x\.png\)<\/p>/);
  // A plain-http picture is not a figure; the address is still a link, but no image loads.
  assert.match(html, /<p>!<a href="http:\/\/example\.com\/x\.png"/);
  assert.match(html, /<img src="\/assets\/grupetto\.jpg"/);
  assert.match(html, /<img src="https:\/\/example\.com\/x\.png"/);
  assert.doesNotMatch(html, /src="\/\/evil/);
  assert.doesNotMatch(html, /src="http:/);
});

test("?debug=1 payloads need the editor token or DEBUG_PAYLOAD=1, and the build marker has no Node version", () => {
  const { isDebugPayloadAllowed, BUILD_INFO } = loadParserExports();
  assert.equal(isDebugPayloadAllowed({ headers: {} }, { token: "secret-key", envFlag: "" }), false);
  assert.equal(isDebugPayloadAllowed({ headers: { authorization: "Bearer wrong" } }, { token: "secret-key", envFlag: "" }), false);
  assert.equal(isDebugPayloadAllowed({ headers: { authorization: "Bearer secret-key" } }, { token: "secret-key", envFlag: "" }), true);
  assert.equal(isDebugPayloadAllowed({ headers: {} }, { token: "", envFlag: "1" }), true);
  assert.equal(isDebugPayloadAllowed({ headers: {} }, { token: "", envFlag: "" }), false);
  assert.equal(isDebugPayloadAllowed(undefined, { token: "", envFlag: "" }), false);

  assert.equal("node" in BUILD_INFO, false);
  assert.ok(["configured", "not set"].includes(BUILD_INFO.sourceContact));
});

test("failed edit keys are free three times, then wait longer each time, then lock out for the window", () => {
  const { recordSiteEditFailure } = loadParserExports();
  const failures = new Map();
  const start = Date.UTC(2026, 8, 26, 10, 0, 0);
  const delays = [];
  for (let index = 0; index < 9; index += 1) {
    delays.push(recordSiteEditFailure("203.0.113.9", start + index * 1000, failures).delayMs);
  }
  assert.deepEqual(delays, [0, 0, 0, 1000, 2000, 4000, 8000, 16000, 30000]);
  // Another client starts fresh.
  assert.equal(recordSiteEditFailure("198.51.100.4", start, failures).delayMs, 0);

  let last;
  for (let index = 9; index < 21; index += 1) {
    last = recordSiteEditFailure("203.0.113.9", start + index * 1000, failures);
  }
  assert.equal(last.count, 21);
  assert.equal(last.lockedOut, true);
  assert.ok(last.retryAfterSeconds > 0 && last.retryAfterSeconds <= 600);

  // Ten minutes after the first miss the slate is clean.
  const later = recordSiteEditFailure("203.0.113.9", start + 10 * 60 * 1000, failures);
  assert.equal(later.count, 1);
  assert.equal(later.delayMs, 0);
  assert.equal(later.lockedOut, false);
});

// A one-day card says when it is today's, on the host country's calendar day, the way
// a stage-race card already did (audience assessment A4, 2026-09-26).
test("a one-day card wears a Finished today or Yesterday pill judged on the host country's day", () => {
  const { buildRaceCard } = loadParserExports();
  const montreal = {
    id: "2026 Grand Prix Cycliste de Montréal",
    pageTitle: "2026 Grand Prix Cycliste de Montréal",
    title: "Grand Prix Cycliste de Montréal",
    series: "Men's WorldTour",
    date: "13 September 2026",
    location: "Canada",
    countryCode: "CAN",
    endDate: new Date("2026-09-13T00:00:00Z"),
    winner: "Tadej Pogačar",
  };
  const pill = /<span class="status-pill status-pill-finished">([^<]*)<\/span>/;

  // 23:30 in Montréal on race day is 03:30 UTC the next day: still today's result there.
  assert.equal(buildRaceCard(montreal, new Date("2026-09-14T03:30:00Z")).match(pill)[1], "Finished today");
  assert.equal(buildRaceCard(montreal, new Date("2026-09-13T21:00:00Z")).match(pill)[1], "Finished today");
  assert.equal(buildRaceCard(montreal, new Date("2026-09-14T15:00:00Z")).match(pill)[1], "Yesterday");
  assert.doesNotMatch(buildRaceCard(montreal, new Date("2026-09-15T15:00:00Z")), pill);
  assert.doesNotMatch(buildRaceCard(montreal, new Date("2026-09-12T15:00:00Z")), pill);
  // The pill sits in the kicker line, after the series.
  assert.match(buildRaceCard(montreal, new Date("2026-09-13T21:00:00Z")), /<div class="card-kicker">Men&#39;s WorldTour <span class="status-pill status-pill-finished">Finished today<\/span><\/div>/);
  // A Worlds card gets the same pill.
  assert.match(
    buildRaceCard({ ...montreal, series: "UCI Road World Championships", title: "Elite women's road race", countryCode: "CAN" }, new Date("2026-09-13T21:00:00Z")),
    /data-championship="worlds"[\s\S]*?Finished today/,
  );
  // With no end date the flag the build computed stands in; without either, no pill.
  assert.match(buildRaceCard({ ...montreal, endDate: undefined, finishedToday: true }), /Finished today/);
  assert.doesNotMatch(buildRaceCard({ ...montreal, endDate: undefined }), pill);
});

// A rider on the winner's time reads "same time", spelled out with a tooltip, wherever
// the zero gap is known; a row with no time at all still shows nothing (A5/C3).
test("a rider on the winner's time reads same time, spelled out, and an unknown time stays blank", () => {
  const { buildPodiumMarkup, buildRiderMarkup } = loadParserExports();
  const sameTime = /<span class="standing-delta standing-same-time" title="Same time as the winner">same time<\/span>/;

  // Stage rows: the row's time equals the winner's, or the source's marker survived.
  const stage = buildPodiumMarkup(
    [
      { place: "1", rider: "Jasper Philipsen", time: "4:29:53" },
      { place: "2", rider: "Mads Pedersen", time: "4:29:53" },
      { place: "3", rider: "Biniam Girmay", sameTime: true },
      { place: "4", rider: "Arnaud De Lie" },
    ],
    { metricContext: "stage" },
  );
  assert.match(stage, /Mads Pedersen<\/a><span class="standing-gap">4:29:53<\/span><span class="standing-delta standing-same-time" title="Same time as the winner">same time<\/span>/);
  assert.match(stage, /Biniam Girmay<\/a><span class="standing-gap">4:29:53<\/span><span class="standing-delta standing-same-time"/);
  assert.match(stage, /Arnaud De Lie<\/a><\/span>/);
  assert.doesNotMatch(stage, /s\.t\./);
  // Never for the winner, whose row carries the time alone.
  assert.match(stage, /Jasper Philipsen<\/a><span class="standing-gap">4:29:53<\/span><\/span>/);

  // A one-day podium (default context) honours the marker and otherwise stays blank.
  assert.match(buildRiderMarkup({ place: "2", rider: "Paul Seixas", sameTime: true }), sameTime);
  assert.match(buildRiderMarkup({ place: "2", rider: "Paul Seixas" }), /Paul Seixas<\/a><\/span>$/);
  assert.match(buildRiderMarkup({ place: "3", rider: "Julian Alaphilippe", gap: "+00:27" }), /standing-gap">\+00:27</);
  assert.doesNotMatch(buildRiderMarkup({ place: "1", rider: "Tadej Pogačar", sameTime: true }), sameTime);
});

// A team name in a team-classification row links to a PCS search and opens no rider
// card; a rider the page placed but never counted keeps the best placing it saw (C4).
test("the rider index records a best placing for riders with no tally, and team links carry no rider key", () => {
  const { buildRiderSeasonIndex, buildRiderMarkup } = loadParserExports();

  assert.match(buildRiderMarkup({ rider: "Tadej Pogačar", countryCode: "SLO" }), /data-rider-key="tadej pogacar"/);
  assert.doesNotMatch(buildRiderMarkup({ rider: "Lidl–Trek" }), /data-rider-key/);
  assert.doesNotMatch(buildRiderMarkup({ rider: "UAE Team Emirates XRG" }), /data-rider-key/);
  assert.match(buildRiderMarkup({ rider: "Lidl–Trek" }), /search\.php\?term=Lidl%20Trek/);

  const vuelta = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    resultStandings: [
      { place: "1", rider: "Enric Mas", countryCode: "ESP" },
      { place: "5", rider: "Giulio Pellizzari", countryCode: "ITA" },
    ],
    stageRace: {
      stages: [
        { number: 21, label: "Stage 21", standings: [{ place: "1", rider: "Enric Mas" }, { place: "4", rider: "Paul Seixas", countryCode: "FRA" }, { place: "5", rider: "Giulio Pellizzari" }] },
        { number: 3, label: "Stage 3", standings: [{ place: "1", rider: "Enric Mas" }, { place: "6", rider: "Paul Seixas" }] },
      ],
    },
  };
  const index = buildRiderSeasonIndex([{ title: "Il Lombardia", winner: "Enric Mas", winnerCountryCode: "ESP" }], [vuelta]);

  // The lowest place wins, with its stage; a top-five row without a stage says "overall".
  assert.deepEqual(JSON.parse(JSON.stringify(index["paul seixas"].bestPlacing)), { place: 4, race: "Vuelta a España", stage: "Stage 21" });
  assert.deepEqual(JSON.parse(JSON.stringify(index["giulio pellizzari"].bestPlacing)), { place: 5, race: "Vuelta a España", stage: "Stage 21" });
  // A rider with something to count carries no fallback.
  assert.equal(index["enric mas"].wins, 1);
  assert.equal(index["enric mas"].bestPlacing, undefined);

  // Two spellings of one rider share the lowest placing across both.
  const merged = buildRiderSeasonIndex([], [
    {
      id: "2026 Tour de Pologne",
      pageTitle: "2026 Tour de Pologne",
      title: "Tour de Pologne",
      stageRace: {
        stages: [
          { number: 1, label: "Stage 1", standings: [{ place: "1", rider: "A B" }, { place: "5", rider: "Oscar Onley" }] },
          { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "A B" }, { place: "4", rider: "Edgar Oscar Onley" }] },
        ],
      },
    },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(merged["oscar onley"].bestPlacing)), { place: 4, race: "Tour de Pologne", stage: "Stage 2" });
  assert.deepEqual(JSON.parse(JSON.stringify(merged["edgar oscar onley"].bestPlacing)), { place: 4, race: "Tour de Pologne", stage: "Stage 2" });
});

// The source writes a zero gap as `+ 0"` (Wikipedia) or "s.t."; the entry keeps the
// fact as `sameTime` and the card prints "same time" (A5/C3, 2026-09-26).
test("a zero gap in the source survives as sameTime on the standing entry", () => {
  const { parseCyclingResultLine, buildStandingEntry, isSameTimeMarker, buildPodiumMarkup } = loadParserExports();
  const second = parseCyclingResultLine('{{cyclingresult|2|[[Paul Seixas]]|FRA|{{UCI team code|DCT|2026}}|+ 0"}}');
  assert.equal(second.rider, "Paul Seixas");
  assert.equal(second.sameTime, true);
  assert.equal(second.gap, undefined);
  const third = parseCyclingResultLine('{{cyclingresult|3|[[Brandon McNulty]]|USA|{{UCI team code|UEX|2026}}|+ 27"}}');
  assert.equal(third.gap, "+00:27");
  assert.equal(third.sameTime, undefined);
  const winner = parseCyclingResultLine('{{cyclingresult|1|[[Isaac del Toro]]|MEX|{{UCI team code|UEX|2026}}|5h 13\' 16"}}');
  assert.equal(winner.time, "5:13:16");
  assert.equal(winner.sameTime, undefined);

  ["s.t.", "st", "same time", "+ 0\"", "+0:00", "+ 0' 00\"", "0:00"].forEach((marker) => assert.equal(isSameTimeMarker(marker), true, marker));
  ["+ 1\"", "+0:01", "", "5:13:16"].forEach((value) => assert.equal(isSameTimeMarker(value), false, value));
  assert.equal(buildStandingEntry(2, "Mads Pedersen", "DEN", "+ 0''").sameTime, true);
  assert.equal(buildStandingEntry(1, "Jasper Philipsen", "BEL", "+ 0''").sameTime, undefined);

  const html = buildPodiumMarkup([winner, second, third]);
  assert.match(html, /Paul Seixas<\/a><span class="standing-delta standing-same-time" title="Same time as the winner">same time<\/span>/);
  assert.match(html, /Brandon McNulty<\/a><span class="standing-gap">\+00:27<\/span>/);
});

// ---------------------------------------------------------------------------------
// Parsers and the rollover (assessment R4, R8, R9, R10, R11, R13, M10, M12, C6;
// 2026-09-26).

test("parseSeasonRows reads the real 2026 WorldTour page, a sortable table and a reordered header", () => {
  const { parseSeasonRows, SEASONS } = loadParserExports();
  const season = SEASONS[0];
  const raw = fs.readFileSync(path.join(__dirname, "fixtures", "uci-world-tour-2026-season.wikitext"), "utf8");
  const races = parseSeasonRows(raw, season, 2026);
  assert.ok(races.length >= 30, `${races.length} races read`);
  const downUnder = races.find((race) => race.title === "Tour Down Under");
  assert.ok(downUnder, "the first race of the season");
  assert.equal(downUnder.winner, "Jay Vine");
  assert.equal(downUnder.second, "Mauro Schmid");
  // Dates made inside the VM are not `instanceof` this realm's Date; read them as strings.
  assert.equal(new Date(downUnder.startDate).toISOString().slice(0, 10), "2026-01-20");
  assert.equal(new Date(downUnder.endDate).toISOString().slice(0, 10), "2026-01-25");

  // A `sortable` class, a `style=` before `class` and styled row separators used to
  // yield zero races.
  const restyled = raw
    .replace('{| class="wikitable plainrowheaders"', '{| style="text-align:left" class="wikitable sortable plainrowheaders"')
    .replace(/\n\|-\n/g, '\n|- style="background:#fff"\n');
  assert.equal(parseSeasonRows(restyled, season, 2026).length, races.length);

  // The header row says where the columns are, so a moved Date column is still a date.
  const reordered = [
    '{| class="wikitable plainrowheaders"',
    "|-",
    '! scope="col" |Race',
    '! scope="col" |Winner',
    '! scope="col" |Second',
    '! scope="col" |Third',
    '! scope="col" |Date',
    "|-",
    '! scope="row" |{{flagicon|ITA}} [[2026 Milan–San Remo|Milan–San Remo]]',
    "| {{Flagathlete|[[Tadej Pogačar]]|SLO}}",
    "| {{Flagathlete|[[Filippo Ganna]]|ITA}}",
    "| {{Flagathlete|[[Mathieu van der Poel]]|NED}}",
    "|21 March",
    "|}",
  ].join("\n");
  const [sanremo] = parseSeasonRows(reordered, season, 2026);
  assert.ok(sanremo, "one race from the reordered table");
  assert.equal(sanremo.winner, "Tadej Pogačar");
  assert.equal(sanremo.third, "Mathieu van der Poel");
  assert.equal(new Date(sanremo.startDate).toISOString().slice(0, 10), "2026-03-21");
});

test("ASO_SOURCES=off turns every ASO source off at once and leaves the others alone", () => {
  const {
    OFFICIAL_STAGE_RACE_PROVIDERS,
    OFFICIAL_ONE_DAY_RESULT_PROVIDERS,
    findOfficialRaceProvider,
    getStageProfileSource,
    loadPersistedStageProfiles,
    stageProfileCache,
  } = loadParserExports();
  const race = (title, start, end) => ({ pageTitle: `2026 ${title}`, startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`) });
  const tour = race("Tour de France", "2026-07-04", "2026-07-26");
  const vuelta = race("Vuelta a España", "2026-08-22", "2026-09-13");
  const giro = race("Giro d'Italia", "2026-05-08", "2026-05-31");
  const eschborn = race("Eschborn–Frankfurt", "2026-05-01", "2026-05-01");
  const aso = ["la-vuelta-femenina-rankings", "tour-auvergne-rhone-alpes-rankings", "tour-de-france-rankings", "tour-de-france-femmes-rankings", "vuelta-a-espana-rankings"];
  assert.deepEqual(JSON.parse(JSON.stringify(OFFICIAL_STAGE_RACE_PROVIDERS.filter((provider) => provider.aso).map((provider) => provider.id).sort())), [...aso].sort());
  const filePath = path.join(__dirname, "..", "data", "stage-profiles.json");
  const previous = process.env.ASO_SOURCES;
  try {
    delete process.env.ASO_SOURCES;
    assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour)?.id, "tour-de-france-rankings", "on unless switched off");
    assert.ok(getStageProfileSource(vuelta, new Date("2026-09-01T00:00:00Z")));

    process.env.ASO_SOURCES = "off";
    assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour), null);
    assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, vuelta), null);
    assert.equal(findOfficialRaceProvider(OFFICIAL_ONE_DAY_RESULT_PROVIDERS, eschborn), null);
    assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, giro)?.id, "giro-ditalia-stage-one", "RCS is not ASO");
    assert.equal(getStageProfileSource(vuelta, new Date("2026-09-01T00:00:00Z")), null);
    // The committed traces are all from lavuelta.es, so none is seeded.
    stageProfileCache.clear();
    assert.equal(loadPersistedStageProfiles(filePath), 0);
    assert.equal(stageProfileCache.size, 0);
  } finally {
    if (previous === undefined) delete process.env.ASO_SOURCES;
    else process.env.ASO_SOURCES = previous;
  }
});

test("official providers match the season's edition of a race, not a literal 2026 title", () => {
  const {
    OFFICIAL_STAGE_RACE_PROVIDERS,
    OFFICIAL_ONE_DAY_RESULT_PROVIDERS,
    findOfficialRaceProvider,
    matchesSeasonEdition,
    getSeasonYearForTest,
    setSeasonYearForTest,
  } = loadParserExports();
  const tour = (year) => ({
    pageTitle: `${year} Tour de France`,
    startDate: new Date(`${year}-07-04T00:00:00Z`),
    endDate: new Date(`${year}-07-26T00:00:00Z`),
  });

  assert.equal(getSeasonYearForTest(), 2026);
  assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour(2026))?.id, "tour-de-france-rankings");
  assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour(2025)), null);
  assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour(2027)), null, "next season's edition waits for the rollover");

  // After the rollover every titled provider follows the year, and last season's
  // pages no longer match.
  setSeasonYearForTest(2027);
  assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour(2027))?.id, "tour-de-france-rankings");
  assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, tour(2026)), null);
  OFFICIAL_STAGE_RACE_PROVIDERS.filter((provider) => provider.title && provider.id !== "vuelta-a-burgos-feminas-liveblog").forEach((provider) => {
    const race = { pageTitle: `2027 ${provider.title}`, startDate: new Date("2027-05-01T00:00:00Z"), endDate: new Date("2027-05-07T00:00:00Z") };
    assert.ok(matchesSeasonEdition(race, provider.title), `${provider.id} follows the season`);
    assert.equal(findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, race)?.id, provider.id);
  });
  assert.equal(
    findOfficialRaceProvider(OFFICIAL_ONE_DAY_RESULT_PROVIDERS, { pageTitle: "2027 Eschborn–Frankfurt", startDate: new Date("2027-05-01T00:00:00Z"), endDate: new Date("2027-05-01T00:00:00Z") })?.id,
    "eschborn-frankfurt",
  );
});

test("parseWorldChampionshipMedalSummary accepts a Medallists heading, {{Main}} and {{FlagIOCmedalist}}", () => {
  const { parseWorldChampionshipMedalSummary } = loadParserExports();
  const variant = [
    "== Medallists ==",
    '{| class="wikitable"',
    "|-",
    "|{{nowrap|[[UCI Road World Championships – Men's time trial|Men's time trial]]<br>{{Main|2026 UCI Road World Championships – Men's time trial}}",
    "| {{FlagIOCmedalist|[[Remco Evenepoel]]|BEL}}",
    "| 44'53.13\"",
    "| {{FlagIOCmedalist|[[Filippo Ganna]]|ITA}}",
    "| +57.31\"",
    "| {{FlagIOCmedalist|[[Paul Seixas]]|FRA}}",
    "| +1'13.04\"",
    "|}",
  ].join("\n");
  const podium = parseWorldChampionshipMedalSummary(variant).get("2026 uci road world championships - men's time trial");
  assert.ok(podium, "the event is keyed by its page title");
  assert.deepEqual(JSON.parse(JSON.stringify(podium.map((entry) => `${entry.rider}/${entry.countryCode}`))), ["Remco Evenepoel/BEL", "Filippo Ganna/ITA", "Paul Seixas/FRA"]);
});

test("findOverallRaceResult skips a previous edition's result block placed before this year's", () => {
  const { extractCyclingResultBlocks, findOverallRaceResult, parseCyclingResultStandings } = loadParserExports();
  const raw = fs.readFileSync(path.join(__dirname, "fixtures", "one-day-previous-edition-first.wikitext"), "utf8");
  const blocks = extractCyclingResultBlocks(raw);
  assert.ok(blocks.length >= 2, "two result blocks on the page");
  const previous = parseCyclingResultStandings(blocks[0].body);
  assert.equal(previous[0].rider, "Mathieu van der Poel", "the previous edition comes first on the page");
  assert.equal(findOverallRaceResult(blocks, { rawText: raw, raceYear: 2026 })[0].rider, "Tadej Pogačar");
  assert.equal(findOverallRaceResult(blocks)[0].rider, "Tadej Pogačar", "without a year, the block with no year in its title wins");
  assert.equal(findOverallRaceResult(null).length, 0);
});

test("fetchText does not retry a definitive 4xx but still retries a 503", async () => {
  const { fetchText, setFetchForTest } = loadParserExports();
  let calls = 0;
  setFetchForTest(async () => {
    calls += 1;
    return { ok: false, status: 404, statusText: "Not Found", text: async () => "" };
  });
  await assert.rejects(() => fetchText("https://example.test/missing"), /404/);
  assert.equal(calls, 1, "a missing page is asked for once");

  calls = 0;
  setFetchForTest(async () => {
    calls += 1;
    return calls < 2
      ? { ok: false, status: 503, statusText: "Unavailable", text: async () => "" }
      : { ok: true, status: 200, statusText: "OK", text: async () => "hello" };
  });
  assert.equal(await fetchText("https://example.test/flaky"), "hello");
  assert.equal(calls, 2, "a 503 is retried");
});

test("a finished race's news line leads with the result stories, then the rest, then the previews", () => {
  const { selectRaceArticles } = loadParserExports();
  const race = {
    id: "2026 Milan–San Remo",
    pageTitle: "2026 Milan–San Remo",
    title: "Milan–San Remo",
    series: "Men's WorldTour",
    countryCode: "ITA",
    startDate: new Date("2026-03-21T00:00:00Z"),
    endDate: new Date("2026-03-21T00:00:00Z"),
  };
  const pool = [
    { title: "Milan-San Remo 2026 preview: the contenders", description: "", url: "https://example.test/preview", publisher: "A", publishedAt: "2026-03-22T08:00:00Z", score: 9 },
    { title: "Tadej Pogačar wins Milan-San Remo 2026 after Poggio attack", description: "", url: "https://example.test/result", publisher: "B", publishedAt: "2026-03-21T16:00:00Z", score: 8 },
    { title: "Milan-San Remo 2026: how to watch", description: "", url: "https://example.test/watch", publisher: "C", publishedAt: "2026-03-20T10:00:00Z", score: 7 },
    null,
  ];
  const ordered = selectRaceArticles(pool, 0, race);
  assert.equal(ordered.length, 3, "a null entry is dropped");
  assert.equal(ordered[0].url, "https://example.test/result");
  assert.equal(ordered[1].url, "https://example.test/preview");
  assert.equal(ordered[2].url, "https://example.test/watch");
  assert.equal(selectRaceArticles(null, 0, race).length, 0);
});

test("extractFeedItems reads the items of a Bing News RSS document", () => {
  const { extractFeedItems } = loadParserExports();
  const xml = fs.readFileSync(path.join(__dirname, "fixtures", "bing-news-milan-san-remo-2026.rss.xml"), "utf8");
  const items = extractFeedItems(xml);
  assert.equal(items.length, 3);
  assert.match(items[0], /Pogačar wins Milan-San Remo/);
  assert.equal(extractFeedItems("").length, 0);
});

test("the season's race-keyed caches are cleared when the year moves on, and only then", async () => {
  const { clearSeasonCaches, seasonCaches, resolveSeasonYear } = loadParserExports();
  seasonCaches.articleCache.set("2026 Il Lombardia", { articles: [] });
  seasonCaches.finishVideoCache.set("2026 Il Lombardia", { url: "" });
  seasonCaches.stageProfileCache.set("2026 Vuelta a España#1", { points: [] });
  const profilesBefore = seasonCaches.stageProfileCache.size;
  clearSeasonCaches();
  assert.equal(seasonCaches.articleCache.size, 0);
  assert.equal(seasonCaches.finishVideoCache.size, 0);
  assert.equal(seasonCaches.stageProfileCache.size, profilesBefore, "the committed stage profiles are left alone");

  seasonCaches.articleCache.set("2026 Il Lombardia", { articles: [] });
  const opening = async () => ({ year: 2027, date: "2027-01-19", title: "Tour Down Under" });
  assert.equal(await resolveSeasonYear(new Date("2027-01-05T00:00:00Z"), opening, 2026), 2026);
  assert.equal(seasonCaches.articleCache.size, 1, "not yet: the season has not moved");
  assert.equal(await resolveSeasonYear(new Date("2027-01-13T00:00:00Z"), opening, 2026), 2027);
  assert.equal(seasonCaches.articleCache.size, 0, "cleared the moment the year moves");
});

// ---------------------------------------------------------------------------------
// The first screen, chosen from comps on 2026-09-26: the hero says where the season
// stands and who won today; upcoming cards sell the race; the phone calendar opens at
// this month and the Worlds have a lane.

test("the hero says where the season stands, with the Worlds as the next race when they come first", () => {
  const { buildHeroStatus, describeNextRace } = loadParserExports();
  const calendar = {
    today: "2026-09-26",
    finishedCount: 1,
    liveCount: 0,
    upcomingCount: 2,
    races: [
      { title: "Grand Prix Cycliste de Montréal", status: "finished", startDate: "2026-09-13", endDate: "2026-09-13" },
      { title: "Il Lombardia", status: "upcoming", startDate: "2026-10-10", endDate: "2026-10-10" },
      { title: "Tour of Guangxi", status: "upcoming", startDate: "2026-10-13", endDate: "2026-10-18" },
    ],
  };
  const mensRoadRace = {
    pageTitle: "2026 UCI Road World Championships – Men's road race",
    title: "Elite men's road race",
    series: "UCI Road World Championships",
    countryCode: "CAN",
    startDate: new Date("2026-09-27T00:00:00Z"),
    endDate: new Date("2026-09-27T00:00:00Z"),
  };
  const womensRoadRace = {
    ...mensRoadRace,
    pageTitle: "2026 UCI Road World Championships – Women's road race",
    title: "Elite women's road race",
    startDate: new Date("2026-09-26T00:00:00Z"),
    endDate: new Date("2026-09-26T00:00:00Z"),
    winner: "Demi Vollering",
    winnerCountryCode: "NED",
  };
  const data = { seasonCalendar: calendar, upcomingRaces: [mensRoadRace], recentResults: [womensRoadRace], finalizedStageRaces: [], liveStageRaces: [] };
  const now = new Date("2026-09-26T20:00:00Z");

  const status = buildHeroStatus(data, now);
  assert.equal(status.statusLine, "1 of 3 WorldTour races run · next: Worlds men's road race, tomorrow");
  assert.deepEqual({ ...status.headline }, { label: "Today", text: "Demi Vollering wins the women's road race" });
  // Without the Worlds the calendar's next race leads, with its date.
  assert.equal(describeNextRace({ seasonCalendar: calendar, upcomingRaces: [] }, now), "next: Il Lombardia, 10 Oct");
  // The day after, the same result is yesterday's; a week on it carries no headline.
  assert.equal(buildHeroStatus(data, new Date("2026-09-27T20:00:00Z")).headline.label, "Yesterday");
  assert.equal(buildHeroStatus(data, new Date("2026-10-05T12:00:00Z")).headline, null);
  // A live stage race's latest stage is the headline, and the race leads the status line.
  const vuelta = {
    title: "Vuelta a España",
    series: "Men's WorldTour",
    countryCode: "ESP",
    startDate: new Date("2026-08-22T00:00:00Z"),
    endDate: new Date("2026-09-13T00:00:00Z"),
    stageRace: { latestStage: { number: 5, date: "2026-08-26", winner: "Jasper Philipsen" } },
  };
  const live = buildHeroStatus(
    { seasonCalendar: { ...calendar, races: [{ title: "Vuelta a España", status: "live", startDate: "2026-08-22", endDate: "2026-09-13" }, ...calendar.races] }, liveStageRaces: [vuelta], recentResults: [], upcomingRaces: [], finalizedStageRaces: [] },
    new Date("2026-08-26T18:00:00Z"),
  );
  assert.match(live.statusLine, /^Vuelta a España in progress · 1 of 4 WorldTour races run · next: Il Lombardia, 10 Oct$/);
  assert.deepEqual({ ...live.headline }, { label: "Today", text: "Jasper Philipsen wins stage 5 of the Vuelta a España" });
  // No calendar, no status line (the hero falls back to its sentence).
  assert.equal(buildHeroStatus({ upcomingRaces: [], recentResults: [] }, now).statusLine, "");
});

test("the hero menu carries a short label for the chips a phone shows", () => {
  const { buildHeroMenuLabel } = loadParserExports();
  assert.equal(
    buildHeroMenuLabel({ id: "world-championships", label: "UCI Road World Championships" }),
    '<span class="hero-menu-full">UCI Road World Championships</span><span class="hero-menu-short">Worlds</span>',
  );
  assert.equal(buildHeroMenuLabel({ id: "season-calendar", label: "Season Calendar" }), '<span class="hero-menu-full">Season Calendar</span><span class="hero-menu-short">Calendar</span>');
  assert.equal(buildHeroMenuLabel({ id: "mens-worldtour", label: "Men's WorldTour" }), "Men&#39;s WorldTour");
});

test("an upcoming card names the tier, the day and the countdown, and last year's winner", () => {
  const { buildUpcomingCard } = loadParserExports();
  const now = new Date("2026-09-26T15:00:00Z");
  const lombardia = {
    id: "2026 Il Lombardia",
    pageTitle: "2026 Il Lombardia",
    title: "Il Lombardia",
    series: "Men's WorldTour",
    date: "10 October 2026",
    location: "Italy",
    countryCode: "ITA",
    startDate: new Date("2026-10-10T00:00:00Z"),
    endDate: new Date("2026-10-10T00:00:00Z"),
    previousWinner: "Tadej Pogačar",
    previousWinnerCountryCode: "SLO",
  };
  const card = buildUpcomingCard(lombardia, now);
  assert.match(card, /<div class="card-kicker">Men&#39;s WorldTour <span class="tier-chip tier-chip-monument">Monument<\/span><\/div>/);
  assert.match(card, /<p class="meta upcoming-detail">Saturday, in 14 days · Last year: <span class="country-flag" aria-hidden="true">🇸🇮<\/span> <a class="rider-text rider-link"[^>]*>Tadej Pogačar<\/a><\/p>/);

  const guangxi = {
    ...lombardia,
    id: "2026 Tour of Guangxi",
    pageTitle: "2026 Tour of Guangxi",
    title: "Tour of Guangxi",
    date: "13–18 October 2026",
    location: "China",
    countryCode: "CHN",
    startDate: new Date("2026-10-13T00:00:00Z"),
    endDate: new Date("2026-10-18T00:00:00Z"),
    previousWinner: "Paul Double",
    previousWinnerCountryCode: "GBR",
  };
  const stageCard = buildUpcomingCard(guangxi, now);
  assert.match(stageCard, /tier-chip tier-chip-stage">Stage race</);
  assert.match(stageCard, /Tuesday to Sunday, in 17 days · 6 days · Last year: /);

  // The Worlds keep their own detail line and wear no tier chip.
  const worlds = {
    pageTitle: "2026 UCI Road World Championships – Men's road race",
    title: "Elite men's road race",
    series: "UCI Road World Championships",
    date: "27 September 2026",
    location: "Montreal, Canada",
    countryCode: "CAN",
    startDate: new Date("2026-09-27T00:00:00Z"),
    endDate: new Date("2026-09-27T00:00:00Z"),
    startTimeLocal: "09:00",
    distanceKm: 273.4,
    laps: 12,
  };
  const worldsCard = buildUpcomingCard(worlds, new Date("2026-09-26T20:00:00Z"));
  assert.doesNotMatch(worldsCard, /tier-chip/);
  assert.match(worldsCard, /upcoming-detail">Sunday, tomorrow · Start 09:00 local · 273.4\u00a0km · 12\u00a0laps</);
  // On race day, before the result: Today. No previous edition: no line.
  assert.match(buildUpcomingCard({ ...worlds, finishedToday: true }, new Date("2026-09-27T14:00:00Z")), /upcoming-detail">Today · Start/);
  assert.doesNotMatch(buildUpcomingCard({ ...lombardia, previousWinner: "" }, now), /Last year/);
});

test("last year's winners are read once from the previous season's pages and joined by series and title", async () => {
  const { loadPreviousSeasonWinners, attachPreviousSeasonWinners } = loadParserExports();
  const table = (rows) =>
    ['{| class="wikitable plainrowheaders"', "|-", '! scope="col" |Race', '! scope="col" |Date', '! scope="col" |Winner', '! scope="col" |Second', '! scope="col" |Third', ...rows, "|}"].join("\n");
  const calls = [];
  const loader = async (title) => {
    calls.push(title);
    return title.includes("Women")
      ? table(["|-", '! scope="row" |{{flagicon|ITA}} [[2025 Strade Bianche Donne|Strade Bianche Donne]]', "|8 March", "| {{Flagathlete|[[Demi Vollering]]|NED}}", "|", "|"])
      : table(["|-", '! scope="row" |{{flagicon|ITA}} [[2025 Il Lombardia|Il Lombardia]]', "|11 October", "| {{Flagathlete|[[Tadej Pogačar]]|SLO}}", "| {{Flagathlete|[[Remco Evenepoel]]|BEL}}", "| {{Flagathlete|[[Ben Healy]]|IRL}}"]);
  };
  const winners = await loadPreviousSeasonWinners(2025, loader);
  assert.deepEqual(calls, ["2025_UCI_World_Tour", "2025_UCI_Women's_World_Tour"]);
  const races = [
    { title: "Il Lombardia", series: "Men's WorldTour" },
    { title: "Strade Bianche Donne", series: "Women's WorldTour" },
    { title: "Tour of Guangxi", series: "Men's WorldTour" },
  ];
  attachPreviousSeasonWinners(races, winners);
  assert.equal(races[0].previousWinner, "Tadej Pogačar");
  assert.equal(races[0].previousWinnerCountryCode, "SLO");
  assert.equal(races[1].previousWinner, "Demi Vollering");
  assert.equal(races[2].previousWinner, undefined);
  // Cached per process: the pages are not read again; a failure is remembered as empty.
  await loadPreviousSeasonWinners(2025, loader);
  assert.equal(calls.length, 2);
  const failing = await loadPreviousSeasonWinners(2024, async () => {
    throw new Error("503");
  });
  assert.equal(failing.size, 0);
});

test("the season calendar lists the Worlds among the months and draws them as their own lane", () => {
  const { buildSeasonCalendar, buildSeasonCalendarSection } = loadParserExports();
  const fixture = buildCalendarFixture();
  const calendar = buildSeasonCalendar(fixture, new Date("2026-09-26T00:00:00Z"));
  const mensRoadRace = {
    id: "2026 UCI Road World Championships – Men's road race",
    pageTitle: "2026 UCI Road World Championships – Men's road race",
    title: "Elite men's road race",
    series: "UCI Road World Championships",
    countryCode: "CAN",
    startDate: new Date("2026-09-27T00:00:00Z"),
    endDate: new Date("2026-09-27T00:00:00Z"),
  };
  const womensRoadRace = {
    ...mensRoadRace,
    id: "2026 UCI Road World Championships – Women's road race",
    pageTitle: "2026 UCI Road World Championships – Women's road race",
    title: "Elite women's road race",
    startDate: new Date("2026-09-26T00:00:00Z"),
    endDate: new Date("2026-09-26T00:00:00Z"),
    winner: "Demi Vollering",
    winnerCountryCode: "NED",
  };
  const markup = buildSeasonCalendarSection(
    calendar,
    { liveStageRaces: [], upcomingRaces: [mensRoadRace], recentResults: [womensRoadRace], finalizedStageRaces: [] },
    new Date("2026-09-26T12:00:00Z"),
  );
  assert.match(markup, />WORLD CHAMPIONSHIPS</, "a lane of its own on the timeline");
  assert.match(markup, /season-swatch-worlds/);
  assert.match(markup, /data-tip-title="Worlds: women&#39;s road race"[^>]*data-status="finished"/);
  assert.match(markup, /data-tip-title="Worlds: men&#39;s road race"[^>]*data-status="upcoming"/);
  assert.match(markup, /season-month-title">[\s\S]*?Worlds: men&#39;s road race/);
  assert.match(markup, /next: Worlds men&#39;s road race, tomorrow/);
  // The Worlds are not WorldTour races: the count is unchanged.
  assert.match(markup, /of 7 WorldTour races run/);
  // The single-series views keep to their series.
  const mensView = markup.slice(markup.indexOf('data-season-view="mens"'), markup.indexOf('data-season-view="womens"'));
  assert.doesNotMatch(mensView, /WORLD CHAMPIONSHIPS/);
});

// A response object that only records what the server would have written.
function makeRecordingResponse(requestHeaders = {}) {
  const written = { status: null, headers: null, body: undefined, ended: false };
  return {
    req: { headers: requestHeaders },
    written,
    writeHead(status, headers) {
      written.status = status;
      written.headers = headers;
    },
    end(body) {
      written.ended = true;
      written.body = body;
    },
  };
}

test("sendPreparedBody validates a cached body with a strong ETag and answers 304 when it matches", () => {
  const { prepareResponseBody, getCachedResponseBody, sendPreparedBody } = loadParserExports();
  const cached = getCachedResponseBody("page:/|2026-09-26T10:00:00.000Z|0", () => "<!doctype html><p>hello</p>", new Map());

  const first = makeRecordingResponse({});
  sendPreparedBody(first, 200, "text/html; charset=utf-8", cached);
  assert.equal(first.written.status, 200);
  assert.match(first.written.headers.etag, /^"[A-Za-z0-9_-]{20,}"$/, "a quoted strong tag");
  assert.equal(first.written.headers["cache-control"], "no-cache");
  assert.equal(first.written.headers["content-length"], cached.identity.length);
  assert.equal(first.written.body, cached.identity);
  const etag = first.written.headers.etag;

  const revalidated = makeRecordingResponse({ "if-none-match": etag });
  sendPreparedBody(revalidated, 200, "text/html; charset=utf-8", cached);
  assert.equal(revalidated.written.status, 304);
  assert.equal(revalidated.written.body, undefined, "no body on a 304");
  assert.equal(revalidated.written.ended, true);
  assert.equal(revalidated.written.headers.etag, etag, "the same tag comes back");
  assert.equal(revalidated.written.headers["cache-control"], "no-cache");
  assert.equal(revalidated.written.headers.vary, "accept-encoding");
  assert.equal("content-length" in revalidated.written.headers, false);
  assert.equal("content-type" in revalidated.written.headers, false);

  // Weak comparison: a W/ prefix and a list of tags both still match.
  const weak = makeRecordingResponse({ "if-none-match": '"stale", W/' + etag });
  sendPreparedBody(weak, 200, "text/html; charset=utf-8", cached);
  assert.equal(weak.written.status, 304);

  const stale = makeRecordingResponse({ "if-none-match": '"something-else"' });
  sendPreparedBody(stale, 200, "text/html; charset=utf-8", cached);
  assert.equal(stale.written.status, 200);
  assert.equal(stale.written.headers.etag, etag);
  assert.equal(stale.written.body, cached.identity);

  // A different body carries a different tag.
  const other = getCachedResponseBody("page:/|2026-09-26T11:00:00.000Z|0", () => "<!doctype html><p>later</p>", new Map());
  const rebuilt = makeRecordingResponse({ "if-none-match": etag });
  sendPreparedBody(rebuilt, 200, "text/html; charset=utf-8", other);
  assert.equal(rebuilt.written.status, 200);
  assert.notEqual(rebuilt.written.headers.etag, etag);

  // A compressed representation is a different one, so its tag differs by the coding.
  const big = getCachedResponseBody("races|x|0", () => JSON.stringify({ pad: "x".repeat(4096) }), new Map());
  const brotli = makeRecordingResponse({ "accept-encoding": "br, gzip" });
  sendPreparedBody(brotli, 200, "application/json; charset=utf-8", big);
  assert.equal(brotli.written.headers["content-encoding"], "br");
  assert.match(brotli.written.headers.etag, /-br"$/);
  const plain = makeRecordingResponse({});
  sendPreparedBody(plain, 200, "application/json; charset=utf-8", big);
  assert.equal(plain.written.headers.etag, brotli.written.headers.etag.replace(/-br"$/, '"'));
  const brotliAgain = makeRecordingResponse({ "accept-encoding": "br", "if-none-match": plain.written.headers.etag });
  sendPreparedBody(brotliAgain, 200, "application/json; charset=utf-8", big);
  assert.equal(brotliAgain.written.status, 200, "the plain tag does not validate the br body");

  // An uncached body (errors, on-demand answers) carries no validator and stays no-store.
  const uncached = makeRecordingResponse({ "if-none-match": "*" });
  sendPreparedBody(uncached, 200, "text/html; charset=utf-8", prepareResponseBody("<p>once</p>"));
  assert.equal(uncached.written.status, 200);
  assert.equal("etag" in uncached.written.headers, false);
  assert.equal(uncached.written.headers["cache-control"], "no-store");
});

test("concurrent loadRequestedStageHistory calls for one race share a single fetch and retry after a failure", async () => {
  const { loadRequestedStageHistory, stubFunctionForTest, seasonCaches } = loadParserExports();
  const race = { pageTitle: "2026 Tour de Suisse", stageRace: { stages: [] } };
  let loaderCalls = 0;

  stubFunctionForTest("createWikiRawLoader", () => async () => {
    loaderCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return "";
  });

  const [a, b] = await Promise.all([loadRequestedStageHistory(race), loadRequestedStageHistory(race)]);
  assert.equal(loaderCalls, 1, "the second caller shares the first fetch");
  // Array.isArray sees across realms; deepEqual would trip on the VM's Array prototype.
  assert.ok(Array.isArray(a) && a.length === 0, "no companion articles, so no stages");
  assert.equal(a, b, "one answer for both");
  const entry = seasonCaches.stageHistoryCache.get("2026 Tour de Suisse");
  assert.equal(entry.stages, a);
  assert.equal(entry.promise, null);
  assert.ok(entry.fetchedAt > 0);

  // Cached: a third call reads the entry without a loader.
  assert.equal(await loadRequestedStageHistory(race), a);
  assert.equal(loaderCalls, 1);

  // A failure drops the entry so the next call fetches again.
  const failing = { pageTitle: "2026 Tour de Pologne", stageRace: { stages: [] } };
  stubFunctionForTest("createWikiRawLoader", () => async () => {
    loaderCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new Error("upstream 503");
  });
  const settled = await Promise.allSettled([loadRequestedStageHistory(failing), loadRequestedStageHistory(failing)]);
  assert.deepEqual(
    settled.map((result) => result.status),
    ["rejected", "rejected"],
  );
  assert.equal(loaderCalls, 2, "the concurrent pair shared the failing fetch too");
  assert.equal(seasonCaches.stageHistoryCache.has("2026 Tour de Pologne"), false, "nothing is kept from a failure");

  stubFunctionForTest("createWikiRawLoader", () => async () => {
    loaderCalls += 1;
    return "";
  });
  const retried = await loadRequestedStageHistory(failing);
  assert.ok(Array.isArray(retried) && retried.length === 0);
  assert.equal(loaderCalls, 3, "the next call retried");
});

test("/calendar.ics lists one all-day event per race, folded at 75 octets, escaped, with an exclusive DTEND", () => {
  const { buildSeasonCalendar, buildSeasonCalendarIcs, buildUpcomingCard, foldIcsLine } = loadParserExports();
  const race = (title, series, start, end, extra = {}) => ({
    id: `2026 ${title}`,
    pageTitle: `2026 ${title}`,
    title,
    series,
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
    date: start,
    location: "Somewhere",
    countryCode: "ITA",
    ...extra,
  });
  const lombardia = race("Il Lombardia", "Men's WorldTour", "2026-10-10", "2026-10-10", {
    location: "Como, Italy; Lake Como",
    winner: "Tadej Pogačar",
    winnerCountryCode: "SLO",
  });
  const calendar = buildSeasonCalendar(
    [lombardia, race("Tour Down Under", "Men's WorldTour", "2026-01-20", "2026-01-25", { countryCode: "AUS", winner: "Jay Vine" })],
    new Date("2026-10-12T00:00:00Z"),
  );
  const worlds = {
    id: "2026 UCI Road World Championships – Men's road race",
    pageTitle: "2026 UCI Road World Championships – Men's road race",
    title: "Elite men's road race",
    series: "UCI Road World Championships",
    countryCode: "CAN",
    startDate: new Date("2026-09-27T00:00:00Z"),
    endDate: new Date("2026-09-27T00:00:00Z"),
    location: "Montréal",
    winner: "Tadej Pogačar",
  };
  const data = { fetchedAt: "2026-10-12T08:30:15.123Z", seasonCalendar: calendar, upcomingRaces: [], recentResults: [worlds] };
  const text = buildSeasonCalendarIcs(data);
  const lines = text.split("\r\n");
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.equal(lines[lines.length - 2], "END:VCALENDAR");
  assert.equal(lines[lines.length - 1], "", "the body ends with CRLF");
  assert.ok(text.includes("PRODID:-//Pro Cycling Results//"));
  assert.ok(text.includes("DTSTAMP:20261012T083015Z"));
  assert.ok(text.includes("UID:race-2026-il-lombardia@procyclingresults.up.railway.app"));
  assert.ok(text.includes("DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261011"), "a one-day race ends on the next day");
  assert.ok(text.includes("DTSTART;VALUE=DATE:20260120\r\nDTEND;VALUE=DATE:20260126"), "a stage race ends the day after its last stage");
  assert.ok(text.includes("LOCATION:Como\\, Italy\\; Lake Como"), "commas and semicolons are escaped");
  assert.ok(text.includes("SUMMARY:Worlds: men's road race"));
  assert.ok(text.includes("DTSTART;VALUE=DATE:20260927\r\nDTEND;VALUE=DATE:20260928"));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 3);
  for (const line of lines) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `folded: ${line}`);
  }
  const unfolded = text.replace(/\r\n /g, "");
  // The Worlds UID is 92 octets, so it only reads whole once unfolded.
  assert.ok(!text.includes("UID:race-2026-uci-road-world-championships-men-s-road-race@procyclingresults.up.railway.app"));
  assert.ok(unfolded.includes("UID:race-2026-uci-road-world-championships-men-s-road-race@procyclingresults.up.railway.app"));
  assert.ok(
    unfolded.includes("DESCRIPTION:Men's WorldTour · Monument\\nWinner: Tadej Pogačar.\\nResults: https://procyclingresults.up.railway.app/#race-2026-il-lombardia"),
    "the long description unfolds intact, accents included",
  );
  assert.ok(unfolded.includes("URL:https://procyclingresults.up.railway.app/#race-2026-il-lombardia"));
  // A fold never lands inside a multi-byte character.
  const accented = `SUMMARY:${"č".repeat(60)}`;
  const folded = foldIcsLine(accented);
  assert.equal(folded.replace(/\r\n /g, ""), accented);
  folded.split("\r\n").forEach((part) => assert.ok(Buffer.byteLength(part, "utf8") <= 75));
  // One race on its own, and nothing for an unknown anchor or an empty calendar.
  const single = buildSeasonCalendarIcs(data, { raceAnchor: "race-2026-il-lombardia" });
  assert.equal((single.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(single.includes("X-WR-CALNAME:Il Lombardia"));
  assert.equal(buildSeasonCalendarIcs(data, { raceAnchor: "race-2026-nope" }), "");
  assert.equal(buildSeasonCalendarIcs({ seasonCalendar: { races: [] } }), "");
  // The upcoming card links to its own event.
  assert.match(buildUpcomingCard(lombardia), /href="\/calendar\.ics\?race=race-2026-il-lombardia">Add to calendar</);
});

test("/feed.xml carries an entry per finished race and per raced stage, dated in the host zone and XML-escaped", () => {
  const { buildResultsAtomFeed } = loadParserExports();
  const lombardia = {
    id: "2026 Il Lombardia",
    pageTitle: "2026 Il Lombardia",
    title: "Il Lombardia",
    series: "Men's WorldTour",
    countryCode: "ITA",
    startDate: new Date("2026-10-10T00:00:00Z"),
    endDate: new Date("2026-10-10T00:00:00Z"),
    location: "Como & Bergamo",
    winner: "Tadej Pogačar",
    winnerCountryCode: "SLO",
    resultStandings: [
      { place: "1", rider: "Tadej Pogačar", countryCode: "SLO" },
      { place: "2", rider: "Remco Evenepoel", countryCode: "BEL" },
      { place: "3", rider: "Isaac del Toro", countryCode: "MEX" },
    ],
  };
  const vuelta = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    series: "Men's WorldTour",
    countryCode: "ESP",
    startDate: new Date("2026-08-22T00:00:00Z"),
    endDate: new Date("2026-09-13T00:00:00Z"),
    location: "Spain",
    winner: "Jonas Vingegaard",
    winnerCountryCode: "DEN",
    resultStandings: [{ place: "1", rider: "Jonas Vingegaard", countryCode: "DEN" }],
    stageRace: {
      totalStages: 21,
      completedStages: 21,
      stages: [
        {
          number: 1,
          label: "Stage 1",
          date: "22 August",
          course: "Turin to Novara",
          standings: [
            { place: "1", rider: "Jasper Philipsen", countryCode: "BEL" },
            { place: "2", rider: "Ethan Vernon", countryCode: "GBR" },
          ],
          winner: "Jasper Philipsen",
        },
        { number: 2, label: "Stage 2", standings: [{ place: "1", rider: "Jonas Vingegaard", countryCode: "DEN" }], winner: "Jonas Vingegaard" },
        { number: 3, label: "Stage 3", standings: [] },
      ],
    },
  };
  const guangxi = {
    id: "2026 Tour of Guangxi",
    pageTitle: "2026 Tour of Guangxi",
    title: "Tour of Guangxi",
    series: "Men's WorldTour",
    countryCode: "CHN",
    startDate: new Date("2026-10-14T00:00:00Z"),
    endDate: new Date("2026-10-19T00:00:00Z"),
    stageRace: { totalStages: 6, completedStages: 1, stages: [{ number: 1, label: "Stage 1", date: "14 October", standings: [{ place: "1", rider: "Paul Magnier", countryCode: "FRA" }] }] },
  };
  const feed = buildResultsAtomFeed({
    fetchedAt: "2026-10-15T10:00:00.000Z",
    recentResults: [lombardia, vuelta],
    finalizedStageRaces: [vuelta],
    liveStageRaces: [guangxi],
  });
  assert.ok(feed.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">'));
  assert.ok(feed.includes("<updated>2026-10-15T10:00:00.000Z</updated>"));
  assert.ok(feed.includes('<link rel="self" type="application/atom+xml" href="https://procyclingresults.up.railway.app/feed.xml"/>'));
  const ids = [...feed.matchAll(/<id>([^<]+)<\/id>/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "https://procyclingresults.up.railway.app/",
    "tag:procyclingresults.up.railway.app,2026:race-2026-tour-of-guangxi:stage-1",
    "tag:procyclingresults.up.railway.app,2026:race-2026-il-lombardia",
    "tag:procyclingresults.up.railway.app,2026:race-2026-vuelta-a-espana",
    "tag:procyclingresults.up.railway.app,2026:race-2026-vuelta-a-espana:stage-2",
    "tag:procyclingresults.up.railway.app,2026:race-2026-vuelta-a-espana:stage-1",
  ]);
  const titles = [...feed.matchAll(/<title>([^<]+)<\/title>/g)].map((match) => match[1]);
  assert.deepEqual(titles, [
    "Pro Cycling Results",
    "Stage 1 of the 2026 Tour of Guangxi: Paul Magnier",
    "Tadej Pogačar wins the 2026 Il Lombardia",
    "Jonas Vingegaard wins the 2026 Vuelta a España",
    "Stage 2 of the 2026 Vuelta a España: Jonas Vingegaard",
    "Stage 1 of the 2026 Vuelta a España: Jasper Philipsen",
  ]);
  assert.ok(feed.includes("<updated>2026-10-14T00:00:00+08:00</updated>"), "Guangxi's day in China");
  assert.ok(feed.includes("<updated>2026-10-10T00:00:00+02:00</updated>"), "Lombardia's day in Italy");
  assert.ok(feed.includes("<updated>2026-08-22T00:00:00+02:00</updated>"), "stage 1 on the route table's day");
  assert.ok(feed.includes("<updated>2026-08-23T00:00:00+02:00</updated>"), "a stage without a date is placed by its number");
  assert.ok(feed.includes("<summary>10 October 2026, Como &amp; Bergamo. 1. Tadej Pogačar (SLO), 2. Remco Evenepoel (BEL), 3. Isaac del Toro (MEX)</summary>"));
  assert.ok(feed.includes("<summary>22 August 2026. Turin to Novara. 1. Jasper Philipsen (BEL), 2. Ethan Vernon (GBR)</summary>"));
  assert.ok(feed.includes("<summary>13 September 2026, Spain. Final general classification. 1. Jonas Vingegaard (DEN)</summary>"));
  assert.ok(feed.includes('href="https://procyclingresults.up.railway.app/#race-2026-vuelta-a-espana"'));
  assert.doesNotMatch(feed, /&(?!amp;|lt;|gt;|quot;)/, "every ampersand is an entity");
  assert.equal(buildResultsAtomFeed({}).match(/<entry>/g), null, "an empty payload is an empty feed, not an error");
});

test("a WorldTour section with nothing upcoming says when the next season opens", () => {
  const { buildCompetitionSection, buildSeasonOpeningLine } = loadParserExports();
  const now = new Date("2026-09-26T12:00:00Z");
  const closeout = { year: 2026, nextYear: 2027, nextSeasonOpening: { year: 2027, date: "2027-01-20", title: "Tour Down Under" } };
  assert.equal(buildSeasonOpeningLine(closeout, now), "The 2027 season opens with the Tour Down Under on 20 January 2027, in 116 days.");
  assert.equal(buildSeasonOpeningLine(closeout, new Date("2027-01-19T12:00:00Z")), "The 2027 season opens with the Tour Down Under on 20 January 2027, tomorrow.");
  assert.equal(
    buildSeasonOpeningLine({ ...closeout, nextSeasonOpening: null }, now),
    "The 2027 season usually opens with the Tour Down Under in the second half of January; the exact day goes here once the 2027 WorldTour calendar is published.",
  );
  assert.equal(buildSeasonOpeningLine(null, now), "");
  const group = {
    id: "mens-worldtour",
    label: "Men's WorldTour",
    tag: "Men's races",
    description: "The season's top-level races for men.",
    liveStageRaces: [],
    recentResults: [],
    upcomingRaces: [],
  };
  const section = buildCompetitionSection(group, { seasonCloseout: closeout }, now);
  assert.match(section, /<h3>Upcoming<\/h3>/);
  assert.match(section, /season-opening-card/);
  assert.match(section, /<h3>The 2027 season<\/h3>/);
  assert.match(section, /on 20 January 2027, in 116 days\./);
  assert.equal(buildCompetitionSection(group, {}, now), "", "nothing to say while the season runs");
  assert.equal(buildCompetitionSection(group), "", "the old one-argument call still works");
  assert.equal(buildCompetitionSection({ ...group, id: "world-championships" }, { seasonCloseout: closeout }, now), "", "the Worlds section is left alone");
});

// ---------------------------------------------------------------------------------
// The webfonts (2026-09-26): both document heads ship the six faces as woff2, preload
// the two hero faces (the h1's Barlow Semi Condensed 800 and the body's Manrope 500)
// and carry metric-matched local fallbacks so the swap does not move the layout.
// buildHtmlPage needs a whole payload, so its head is checked in the function source
// and its stylesheet in the file the server inlines (assets/site.css).
// ---------------------------------------------------------------------------------
test("both heads preload the hero faces and load every face as woff2 with sized fallbacks", () => {
  const { buildHtmlPage, buildSiteContentPage } = loadParserExports();
  const rendered = buildSiteContentPage("about", "# About", { editable: false });
  const head = rendered.slice(0, rendered.indexOf("</head>"));
  const stylesheet = fs.readFileSync(path.join(__dirname, "..", "assets", "site.css"), "utf8");
  for (const html of [head, String(buildHtmlPage) + stylesheet]) {
    assert.match(html, /<link rel="preload" href="\/assets\/fonts\/barlow-semi-condensed-800\.woff2" as="font" type="font\/woff2" crossorigin \/>/);
    assert.match(html, /<link rel="preload" href="\/assets\/fonts\/manrope-500\.woff2" as="font" type="font\/woff2" crossorigin \/>/);
    const faces = html.match(/@font-face\s*\{[^}]*\}/g) || [];
    const hosted = faces.filter((rule) => rule.includes("url("));
    assert.equal(hosted.length, 6, "six self-hosted faces");
    assert.ok(hosted.every((rule) => /url\("\/assets\/fonts\/[a-z0-9-]+\.woff2"\) format\("woff2"\)/.test(rule)), "every hosted face is woff2");
    assert.doesNotMatch(html, /\.ttf/);
    const local = faces.filter((rule) => rule.includes("local("));
    assert.equal(local.length, 6, "two Manrope fallbacks, four Barlow fallbacks");
    assert.ok(local.every((rule) => /size-adjust:/.test(rule) && /ascent-override:/.test(rule) && /descent-override:/.test(rule)), "every fallback is metric-matched");
    assert.match(html, /"Manrope", "Manrope Fallback", "Segoe UI", sans-serif/);
    assert.match(html, /"Barlow Semi Condensed", "Barlow Semi Condensed Fallback", "Barlow Semi Condensed Fallback Arial", "Arial Narrow", sans-serif/);
  }
});
