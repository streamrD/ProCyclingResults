"use strict";

// Archived on 2026-09-27 (assessment finding L8).
// hellas-tour.gr answers every request, including a plain `/robots.txt`, with a
// Cloudflare challenge page, so this official provider never once returned real
// results in production: it was dead code from the day the challenge went up.
// This is the verbatim provider that used to live in server.js — the fetcher,
// its private parsers, and the constant it read from — plus the registry line
// that wired it into OFFICIAL_STAGE_RACE_PROVIDERS. It called shared server.js
// helpers (fetchText, cleanFeedText, toTitleCaseWords, normalizeAlpha2CountryCode,
// buildStandingEntry, MAX_RESULT_RIDERS, toUtcDateOnly, matchesSeasonEdition,
// inferStageCountFromDates, getWinnerDetails, getLeaderDetails,
// seasonEditionProvider) that still exist there for the other providers; this
// file is kept for reference only and is not required by anything.

const TOUR_OF_GREECE_RESULTS_URL = "https://hellas-tour.gr/portal/en/results-2026";

function extractTourOfGreeceResultsSection(html) {
  const text = String(html || "");
  const startIndex = text.search(/<h1[^>]*>\s*Results 2026\s*<\/h1>/i);
  if (startIndex < 0) {
    return "";
  }

  return text.slice(startIndex);
}

function parseTourOfGreeceOfficialStandings(html, heading) {
  const section = extractTourOfGreeceResultsSection(html);
  if (!section) {
    return [];
  }

  const tableMatch = section.match(
    new RegExp(
      `<h4>${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/h4>[\\s\\S]*?<table>([\\s\\S]*?)<\\/table>`,
      "i",
    ),
  );
  if (!tableMatch) {
    return [];
  }

  const tableHtml = tableMatch[1];
  const headerRow = tableHtml.match(/<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/i)?.[1] || "";
  const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) =>
    cleanFeedText(match[1]).toLowerCase(),
  );
  const rankIndex = headers.findIndex((header) => header.includes("rank"));
  const nameIndex = headers.findIndex((header) => header === "name" || header.includes("name"));
  const nationIndex = headers.findIndex((header) => header.includes("nation"));

  const tbody = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || "";

  return [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cellMatch) => cellMatch[1]);
      const place = Number.parseInt(cleanFeedText(cells[rankIndex] || "").match(/\d+/)?.[0] || "", 10);
      const rider = toTitleCaseWords(cleanFeedText(cells[nameIndex] || "").replace(/\*/g, ""));
      const alpha2Code = (cells[nationIndex] || "").match(/\/([a-z]{2})_black\.png/i)?.[1] || "";
      const countryCode = normalizeAlpha2CountryCode(alpha2Code);
      return Number.isInteger(place) && rider ? buildStandingEntry(place, rider, countryCode) : null;
    })
    .filter(Boolean)
    .slice(0, MAX_RESULT_RIDERS);
}

function extractTourOfGreeceLatestStageNumber(html) {
  return [...extractTourOfGreeceResultsSection(html).matchAll(/<h4>\s*Stage\s+(\d+)\s*<\/h4>/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
    .reduce((max, stageNumber) => Math.max(max, stageNumber), 0);
}

async function fetchTourOfGreeceOfficialSnapshot(race, fetchHtml = fetchText) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    !matchesSeasonEdition(race, "Tour of Greece") ||
    !startUtc ||
    !endUtc ||
    todayUtc.getTime() < startUtc.getTime()
  ) {
    return null;
  }

  const html = await fetchHtml(TOUR_OF_GREECE_RESULTS_URL);
  const gcStandings = parseTourOfGreeceOfficialStandings(html, "General Classification");
  const latestStageNumber = extractTourOfGreeceLatestStageNumber(html);
  const latestStageStandings = latestStageNumber
    ? parseTourOfGreeceOfficialStandings(html, `Stage ${latestStageNumber}`)
    : [];
  if (gcStandings.length === 0 && latestStageStandings.length === 0) {
    return null;
  }

  return {
    totalStages: inferStageCountFromDates(race) || 5,
    completedStages: latestStageNumber,
    latestStage:
      latestStageStandings.length > 0
        ? {
            number: latestStageNumber,
            label: `Stage ${latestStageNumber}`,
            standings: latestStageStandings,
            ...getWinnerDetails(latestStageStandings),
          }
        : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber: latestStageNumber,
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: gcStandings,
  };
}

// The registry line this provider used to occupy in OFFICIAL_STAGE_RACE_PROVIDERS:
//
// seasonEditionProvider("tour-of-greece-results", "Tour of Greece", fetchTourOfGreeceOfficialSnapshot),

module.exports = {
  archivedOn: "2026-09-27",
  retiredReason:
    "hellas-tour.gr answers every request, including /robots.txt, with a Cloudflare challenge, so the provider never returned real results.",
  TOUR_OF_GREECE_RESULTS_URL,
  extractTourOfGreeceResultsSection,
  parseTourOfGreeceOfficialStandings,
  extractTourOfGreeceLatestStageNumber,
  fetchTourOfGreeceOfficialSnapshot,
};
