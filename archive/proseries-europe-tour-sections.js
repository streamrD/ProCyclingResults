"use strict";

// Archived on 2026-06-22.
// These UCI ProSeries and Europe Tour section configs were active previously.
// The current product scope is Men's WorldTour, Women's WorldTour, and National Championships.
// Keep this file as the restoration reference if those sections return later.

const archivedOn = "2026-06-22";
const retiredReason =
  "Retired from the active UI and API to focus the app on WorldTour results and national championships.";

const retiredSeasonConfigs = [
  {
    pageTitle: "2026_UCI_ProSeries",
    label: "Men's ProSeries",
    winnerMode: "winner",
    dateIndex: 1,
    winnerIndex: 2,
    secondIndex: 3,
    thirdIndex: 4,
    statusStartIndex: 2,
  },
  {
    pageTitle: "2026_UCI_Women's_ProSeries",
    label: "Women's ProSeries",
    winnerMode: "winner",
    dateIndex: 1,
    winnerIndex: 2,
    secondIndex: 3,
    thirdIndex: 4,
    statusStartIndex: 2,
  },
  {
    pageTitle: "2026_UCI_Europe_Tour",
    label: "Men's Europe Tour",
    winnerMode: "winner",
    dateIndex: 2,
    winnerIndex: 3,
    statusStartIndex: 3,
    includePageTitles: [
      "2026 Étoile de Bessèges",
      "2026 Tour de la Provence",
      "Giro di Sardegna",
      "Settimana Internazionale di Coppi e Bartali",
      "2026 O Gran Camiño",
      "Vuelta Asturias",
      "Grande Prémio Anicolor",
      "Tour of Greece",
      "Flèche du Sud",
      "GP Beiras e Serra da Estrela",
      "Tour of Estonia",
      "Route d'Occitanie",
      "Sibiu Cycling Tour",
      "Tour of Austria",
      "Tour de l'Ain",
      "Tour du Limousin",
      "Tour Poitou-Charentes en Nouvelle-Aquitaine",
      "Tour of Istanbul",
      "Giro d'Abruzzo",
      "Okolo Slovenska",
      "Tour of Holland",
    ],
  },
];

const retiredCompetitionGroups = [
  {
    id: "proseries",
    label: "UCI ProSeries",
    tag: "Expanded Calendar",
    description: "The ProSeries races added today, with live stage races, fresh results, and upcoming events.",
    deferred: true,
    predicateDescription: "race.series matches /ProSeries/",
    recentSource: "recentResults",
    recentBlockTitle: "Recent Results",
    recentBlockDescription: "Recent one-day races and finalized stage races, arranged in a three-column grid on larger screens.",
    recentGridClass: "competition-grid-three",
  },
  {
    id: "europe-tour",
    label: "Europe Tour Spotlight",
    tag: "Selected 2.1 Races",
    description: "Selected Europe Tour stage races that are worth tracking alongside the top-tier calendars.",
    deferred: true,
    predicateDescription: "race.series === \"Men's Europe Tour\"",
    liveSource: "europeTourLiveStageRaces",
    recentSource: "europeTourRecentResults",
    upcomingSource: "europeTourUpcomingRaces",
    recentBlockTitle: "Recent Stage Race Results",
    recentBlockDescription: "Finalized multi-stage results from the selected Europe Tour races.",
  },
];

module.exports = {
  archivedOn,
  retiredReason,
  retiredSeasonConfigs,
  retiredCompetitionGroups,
};
