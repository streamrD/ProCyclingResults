const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const EASTERN_TIMEZONE = "America/New_York";
const MAX_RACE_ARTICLES = 8;
const MAX_RESULT_RIDERS = 5;
const MAX_RECENT_RESULTS = 8;
const MAX_UPCOMING_RACES = 8;
const MAX_LIVE_STAGE_RACES = 6;
const TOP_TIER_PUBLISHERS = [
  { pattern: /reuters/i, score: 140 },
  { pattern: /\bap\b|associated press|ap news/i, score: 135 },
  { pattern: /bbc|bbc sport/i, score: 128 },
  { pattern: /cyclingnews/i, score: 126 },
  { pattern: /velonews/i, score: 122 },
  { pattern: /escape collective/i, score: 120 },
  { pattern: /eurosport/i, score: 118 },
  { pattern: /cycling weekly/i, score: 112 },
  { pattern: /rouleur/i, score: 108 },
  { pattern: /the guardian|guardian/i, score: 104 },
  { pattern: /road\.cc/i, score: 98 },
];

const SEASONS = [
  {
    pageTitle: "2026_UCI_World_Tour",
    label: "Men's WorldTour",
    winnerMode: "podium",
  },
  {
    pageTitle: "2026_UCI_Women's_World_Tour",
    label: "Women's WorldTour",
    winnerMode: "podium",
  },
  {
    pageTitle: "2026_UCI_ProSeries",
    label: "Men's ProSeries",
    winnerMode: "winner",
  },
  {
    pageTitle: "2026_UCI_Women's_ProSeries",
    label: "Women's ProSeries",
    winnerMode: "winner",
  },
];

const COUNTRY_NAMES = {
  AUS: "Australia",
  BEL: "Belgium",
  CAN: "Canada",
  CHN: "China",
  DEN: "Denmark",
  ESP: "Spain",
  FRA: "France",
  GBR: "United Kingdom",
  GER: "Germany",
  ITA: "Italy",
  NED: "Netherlands",
  POL: "Poland",
  SUI: "Switzerland",
  UAE: "United Arab Emirates",
};

const MONTHS = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

let cache = {
  updatedAt: 0,
  data: null,
  promise: null,
};

const articleCache = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtml(value) {
  let decoded = String(value);

  for (let index = 0; index < 2; index += 1) {
    decoded = decoded
      .replaceAll("&nbsp;", " ")
      .replaceAll("&#160;", " ")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&ndash;", "–")
      .replaceAll("&amp;", "&");
  }

  return decoded;
}

function cleanWikiText(value) {
  return decodeHtml(String(value || ""))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^/]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/\s*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{flagicon\|[^}]+\}\}/gi, "")
    .replace(/\{\{flag\|([^}|]+)(?:\|[^}]*)?\}\}/gi, "$1")
    .replace(/\{\{flagathlete\|([^}|]+)(?:\|[^}]*)?\}\}/gi, "$1")
    .replace(/\{\{nowrap\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{small\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{abbr\|([^}|]+)\|[^}]+\}\}/gi, "$1")
    .replace(/\{\{ubl\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{unbulleted list\|([^}]*)\}\}/gi, "$1")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/''+/g, "")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\|/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAthlete(cell) {
  const match = String(cell || "").match(/\{\{flagathlete\|(.+?)\|[A-Z]{2,3}\}\}/i);
  return cleanWikiText(match ? match[1] : cell);
}

function parseRaceCell(cell) {
  const text = String(cell || "");
  const codeMatch = text.match(/\{\{flagicon\|([^}]+)\}\}/i);
  const linkMatch = text.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
  const countryCode = codeMatch ? codeMatch[1].trim().toUpperCase() : "";

  return {
    pageTitle: linkMatch ? linkMatch[1] : cleanWikiText(text),
    title: cleanWikiText(linkMatch ? linkMatch[2] || linkMatch[1] : text),
    countryCode,
    location: COUNTRY_NAMES[countryCode] || countryCode || "Location TBC",
  };
}

function getRaceId(race) {
  return String(race?.pageTitle || "").trim();
}

function getRaceYear(race) {
  return race?.endDate instanceof Date ? race.endDate.getUTCFullYear() : null;
}

function extractMentionedYears(text) {
  return [...String(text || "").matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
}

function normalizeSearchText(value) {
  return cleanWikiText(String(value || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function createRaceNameVariants(value) {
  const raw = cleanWikiText(String(value || ""))
    .replace(/^20\d{2}\s+/, "")
    .replace(/\s+\((men's|women's) race\)$/i, "")
    .replace(/\s+Hauts de France$/i, "")
    .replace(/\s+Femmes(?: avec Zwift)?$/i, " Femmes")
    .trim();

  const variants = new Set();
  const queue = [raw];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    const normalized = current.replace(/\s+/g, " ").trim();
    if (!normalized || variants.has(normalized)) {
      continue;
    }

    variants.add(normalized);
    queue.push(normalized.replace(/[–—]/g, "-"));
    queue.push(normalized.replace(/-/g, "–"));
    queue.push(normalized.replace(/\s*[-–—]\s*/g, " "));
  }

  return [...variants];
}

function getRaceTokens(race) {
  return [...new Set(
    createRaceNameVariants(race?.title)
      .flatMap((variant) => normalizeSearchText(variant).split(/[^a-z0-9]+/i))
      .filter(
        (token) =>
          token.length >= 4 &&
          ![
            "race",
            "races",
            "tour",
            "tours",
            "women",
            "womens",
            "world",
            "classic",
            "classics",
            "grand",
            "prix",
            "stage",
            "stages",
          ].includes(token),
      ),
  )];
}

function getRaceDivision(race) {
  const text = normalizeSearchText([race?.title, race?.pageTitle].join(" "));

  if (/\bfemmes\b|\bwomen\b|\bwomens\b/.test(text)) {
    return "women";
  }

  return "men";
}

function hasWomenMarker(text) {
  return /\bfemmes\b|\bwomen\b|\bwomens\b|\bladies\b/.test(text);
}

function hasMenMarker(text) {
  return /\bmen\b|\bmens\b/.test(text);
}

function parseDateRange(dateText, year) {
  const text = String(dateText || "").replace(/\s+/g, " ").trim();
  const crossMonth = [...text.matchAll(/(\d{1,2})\s+([A-Za-z]+)/g)];
  if (crossMonth.length >= 2) {
    const startDay = Number(crossMonth[0][1]);
    const startMonth = MONTHS[crossMonth[0][2]];
    const endDay = Number(crossMonth[crossMonth.length - 1][1]);
    const endMonth = MONTHS[crossMonth[crossMonth.length - 1][2]];
    return {
      start: new Date(Date.UTC(year, startMonth, startDay)),
      end: new Date(Date.UTC(year, endMonth, endDay)),
    };
  }

  const sameMonth = text.match(/(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+([A-Za-z]+)/);
  if (!sameMonth) {
    return {
      start: null,
      end: null,
    };
  }

  const startDay = Number(sameMonth[1]);
  const endDay = Number(sameMonth[2] || sameMonth[1]);
  const monthIndex = MONTHS[sameMonth[3]];

  return {
    start: new Date(Date.UTC(year, monthIndex, startDay)),
    end: new Date(Date.UTC(year, monthIndex, endDay)),
  };
}

function formatDateLabel(dateText, year) {
  return `${String(dateText || "").trim()} ${year}`.replace(/\s+/g, " ");
}

function parseSeasonRows(rawText, season, year) {
  const tableStart = rawText.indexOf('{| class="wikitable plainrowheaders"');
  const tableEnd = rawText.indexOf("\n|}", tableStart);
  const tableText = rawText.slice(tableStart, tableEnd);
  const rows = tableText.split("\n|-\n").slice(1);

  return rows
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line.startsWith("!")) {
          cells.push(line.replace(/^!\s*(?:scope="row"\s*\|\s*)?/, "").trim());
        } else if (line.startsWith("|")) {
          cells.push(line.replace(/^\|\s*/, "").trim());
        }
      }
      return cells;
    })
    .filter((cells) => cells.length >= 5)
    .map((cells) => {
      const race = parseRaceCell(cells[0]);
      const dateRange = parseDateRange(cells[1], year);
      const statusText = cleanWikiText(cells.slice(2).join(" "));
      const hasPodium = season.winnerMode === "podium";

      return {
        ...race,
        series: season.label,
        date: formatDateLabel(cells[1], year),
        winner: parseAthlete(cells[2]),
        second: hasPodium ? parseAthlete(cells[3]) : "",
        third: hasPodium ? parseAthlete(cells[4]) : "",
        startDate: dateRange.start,
        endDate: dateRange.end,
        isCancelled: /\bcancelled\b/i.test(statusText),
      };
    });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ProCyclingResults/1.0; +https://wikipedia.org)",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchWikiRaw(title) {
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
  const text = await fetchText(url);
  if (text.startsWith("<!DOCTYPE html>")) {
    return "";
  }
  return text;
}

function getInfoboxField(rawText, fieldName) {
  const match = String(rawText || "").match(new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.+)$`, "im"));
  return match ? cleanWikiText(match[1]) : "";
}

function splitWikiTemplateArgs(templateText) {
  const args = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < templateText.length; index += 1) {
    const pair = templateText.slice(index, index + 2);

    if (pair === "{{") {
      braceDepth += 1;
      current += pair;
      index += 1;
      continue;
    }

    if (pair === "}}") {
      braceDepth = Math.max(0, braceDepth - 1);
      current += pair;
      index += 1;
      continue;
    }

    if (pair === "[[") {
      bracketDepth += 1;
      current += pair;
      index += 1;
      continue;
    }

    if (pair === "]]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += pair;
      index += 1;
      continue;
    }

    if (templateText[index] === "|" && braceDepth === 0 && bracketDepth === 0) {
      args.push(current);
      current = "";
      continue;
    }

    current += templateText[index];
  }

  args.push(current);
  return args.map((value) => value.trim());
}

function parseCyclingResultLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("{{cyclingresult|")) {
    return null;
  }

  const args = splitWikiTemplateArgs(trimmed.replace(/^\{\{/, "").replace(/\}\}$/, ""));
  if (args[0] !== "cyclingresult" || args.length < 3) {
    return null;
  }

  return {
    place: cleanWikiText(args[1]),
    rider: parseAthlete(args[2]),
  };
}

function extractCyclingResultBlocks(rawText) {
  return [...String(rawText || "").matchAll(/\{\{cyclingresult start(?:\|title=([\s\S]*?))?\}\}([\s\S]*?)\{\{cyclingresult end(?:[\s\S]*?)\}\}/gi)].map(
    (match) => ({
      title: cleanWikiText(match[1] || ""),
      body: match[2],
    }),
  );
}

function parseCyclingResultStandings(blockBody, maxRiders = MAX_RESULT_RIDERS) {
  return String(blockBody || "")
    .split("\n")
    .map((line) => parseCyclingResultLine(line))
    .filter((entry) => entry && /^\d+$/.test(entry.place) && Number(entry.place) <= maxRiders && entry.rider)
    .sort((left, right) => Number(left.place) - Number(right.place));
}

function findOverallRaceResult(blocks) {
  const titledResult = blocks.find((block) => /\bresult\b/.test(normalizeSearchText(block.title)));
  const fallbackResult = blocks.find((block) => parseCyclingResultStandings(block.body).length > 0);
  const selectedBlock = titledResult || fallbackResult;

  return selectedBlock ? parseCyclingResultStandings(selectedBlock.body) : [];
}

function extractRouteStageWinners(rawText) {
  const routeMatch = String(rawText || "").match(/\|\+\s*Stage characteristics and winners[\s\S]*?\n\|\}/i);
  if (!routeMatch) {
    return [];
  }

  return routeMatch[0]
    .split("\n|-\n")
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line.startsWith("!")) {
          cells.push(line.replace(/^!\s*(?:scope="[^"]+"\s*\|\s*)?(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        } else if (line.startsWith("|")) {
          cells.push(line.replace(/^\|\s*(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        }
      }

      if (cells.length < 7) {
        return null;
      }

      const stageNumber = Number(cleanWikiText(cells[0]).match(/\d+/)?.[0] || 0);
      const winner = parseAthlete(cells[cells.length - 1]);
      return stageNumber > 0 && winner ? { stageNumber, winner } : null;
    })
    .filter(Boolean);
}

function extractStageRaceSnapshot(rawText) {
  const blocks = extractCyclingResultBlocks(rawText);
  const stageResults = [];
  const gcResults = [];

  blocks.forEach((block) => {
    const title = normalizeSearchText(block.title);
    const stageMatch = title.match(/\bstage\s+(\d+)\s+result\b/);
    const gcMatch = title.match(/\bgeneral classification after stage\s+(\d+)\b/);
    const standings = parseCyclingResultStandings(block.body);

    if (stageMatch && standings.length > 0) {
      stageResults.push({
        stageNumber: Number(stageMatch[1]),
        standings,
      });
    }

    if (gcMatch && standings.length > 0) {
      gcResults.push({
        stageNumber: Number(gcMatch[1]),
        standings,
      });
    }
  });

  const routeStageWinners = extractRouteStageWinners(rawText);
  const latestStage =
    [...stageResults].sort((left, right) => right.stageNumber - left.stageNumber)[0] ||
    [...routeStageWinners]
      .sort((left, right) => right.stageNumber - left.stageNumber)
      .map((entry) => ({
        stageNumber: entry.stageNumber,
        standings: [{ place: "1", rider: entry.winner }],
      }))[0] ||
    null;
  const latestGc = [...gcResults].sort((left, right) => right.stageNumber - left.stageNumber)[0] || null;
  const totalStages = Number.parseInt(getInfoboxField(rawText, "stages"), 10) || 0;
  const finalStandings = ["first", "second", "third"]
    .map((fieldName, index) => ({
      place: String(index + 1),
      rider: parseAthlete(getInfoboxField(rawText, fieldName)),
    }))
    .filter((entry) => entry.rider);
  const overallResult = findOverallRaceResult(blocks);

  return {
    totalStages,
    completedStages:
      latestGc?.stageNumber || latestStage?.stageNumber || routeStageWinners.reduce((max, entry) => Math.max(max, entry.stageNumber), 0),
    latestStage: latestStage
      ? {
          number: latestStage.stageNumber,
          standings: latestStage.standings,
          winner: latestStage.standings[0]?.rider || "",
        }
      : null,
    generalClassification:
      latestGc || finalStandings.length > 0
        ? {
            stageNumber: latestGc?.stageNumber || totalStages || 0,
            standings: latestGc?.standings || finalStandings,
            leader: (latestGc?.standings || finalStandings)[0]?.rider || "",
          }
        : null,
    overallResult: overallResult.length > 0 ? overallResult : finalStandings,
  };
}

function extractLeadLocation(rawText) {
  const lead = rawText
    .split("\n\n")
    .slice(0, 4)
    .join(" ");

  const patterns = [
    /\b(?:took place|will take place|takes place)\b.*?\bin ([^.]+)\./i,
    /\b(?:took place|will take place|takes place)\b.*?\bfrom ([^.]+)\./i,
    /\bbegan in ([^.]+?) and finished in ([^.]+)\./i,
    /\bstarted and finished in ([^.]+)\./i,
  ];

  for (const pattern of patterns) {
    const match = lead.match(pattern);
    if (match) {
      const value = cleanWikiText(match[1]).replace(/\s+,/g, ",");
      return value
        .replace(/^(?:the\s+)?(?:[a-z]+\s+)?city of\s+/i, "")
        .replace(/^(?:the\s+)?city of\s+/i, "")
        .replace(/\bthe municipality of\s+/gi, "")
        .replace(/\bthe province of\s+/gi, "")
        .trim();
    }
  }

  return "";
}

function extractInfoboxLocation(rawText) {
  const match = rawText.match(/^\|\s*location\s*=\s*(.+)$/im);
  return match ? cleanWikiText(match[1]) : "";
}

function isLikelyLocation(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  if (/^\d{4}$/.test(text)) {
    return false;
  }

  if (/\d/.test(text)) {
    return false;
  }

  if (text.length > 80) {
    return false;
  }

  return !/(organisers|announced|world tour|women's world tour|men's world tour|season|edition|race would be held|victory|attack|winner|podium|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(
    text,
  );
}

async function enrichLocations(races) {
  await Promise.all(
    races.map(async (race) => {
      try {
        const raw = await fetchWikiRaw(race.pageTitle);
        const location = extractInfoboxLocation(raw) || extractLeadLocation(raw);
        if (isLikelyLocation(location)) {
          race.location = location;
        }
      } catch {
        // Keep the season-table fallback location.
      }
    }),
  );

  return races;
}

function isMultiDayRace(race) {
  return race?.startDate instanceof Date && race?.endDate instanceof Date && race.startDate.getTime() !== race.endDate.getTime();
}

async function enrichStageRaceSnapshots(races) {
  await Promise.all(
    races.map(async (race) => {
      if (!isMultiDayRace(race)) {
        return;
      }

      try {
        const raw = await fetchWikiRaw(race.pageTitle);
        const snapshot = extractStageRaceSnapshot(raw);

        if (snapshot.totalStages > 1 || snapshot.completedStages > 0) {
          race.stageRace = snapshot;
        }
      } catch {
        // Fall back to season-table data when the race page cannot be parsed.
      }
    }),
  );

  return races;
}

async function enrichRecentResultStandings(races) {
  await Promise.all(
    races.map(async (race) => {
      try {
        const raw = await fetchWikiRaw(race.pageTitle);
        const snapshot = extractStageRaceSnapshot(raw);

        if (snapshot.totalStages > 1 || snapshot.completedStages > 0) {
          race.stageRace = snapshot;
          race.resultStandings = snapshot.generalClassification?.standings || snapshot.overallResult || [];
          return;
        }

        const resultStandings = findOverallRaceResult(extractCyclingResultBlocks(raw));
        if (resultStandings.length > 0) {
          race.resultStandings = resultStandings;
        }
      } catch {
        // Fall back to season-table results when page parsing fails.
      }
    }),
  );

  return races;
}

function seededValue(seed, key) {
  let hash = 2166136261 ^ seed;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function stripXmlCdata(value) {
  return String(value || "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function cleanFeedText(value) {
  return decodeHtml(stripXmlCdata(String(value || "")))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractXmlTag(block, tagName) {
  const match = String(block || "").match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? match[1] : "";
}

function extractFeedItems(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
}

function buildRaceArticleQueries(race) {
  const raceYear = getRaceYear(race);
  const variants = [...new Set(createRaceNameVariants(race.title).filter(Boolean))].slice(0, 4);

  return variants.flatMap((variant) => {
    if (raceYear) {
      return [
        `"${variant}" ${raceYear} cycling`,
        `"${variant}" ${raceYear} results cycling`,
      ];
    }

    return [`"${variant}" cycling`];
  });
}

function getPublisherScore(publisher) {
  const value = String(publisher || "").trim();

  for (const candidate of TOP_TIER_PUBLISHERS) {
    if (candidate.pattern.test(value)) {
      return candidate.score;
    }
  }

  return 40;
}

function isLikelyRaceArticle(article, race) {
  const combinedText = normalizeSearchText([article.title, article.description, article.publisher].join(" "));
  const variants = createRaceNameVariants(race.title).map((variant) => normalizeSearchText(variant));
  const raceTokens = getRaceTokens(race);
  const tokenMatches = raceTokens.filter((token) => combinedText.includes(token)).length;
  const division = getRaceDivision(race);
  const mentionsExactVariant = variants.some((variant) => variant && combinedText.includes(variant));

  if (division === "women") {
    if (!hasWomenMarker(combinedText) && !mentionsExactVariant) {
      return false;
    }
  }

  if (division === "men" && hasWomenMarker(combinedText) && !hasMenMarker(combinedText)) {
    return false;
  }

  return mentionsExactVariant || tokenMatches >= Math.min(2, raceTokens.length);
}

function normalizeArticleTitle(title, publisher) {
  const cleaned = cleanFeedText(title);
  const source = cleanFeedText(publisher);

  if (!source) {
    return cleaned;
  }

  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return cleaned
    .replace(new RegExp(`\\s*(?:[-|:]\s*)?${escapedSource}$`, "i"), "")
    .replace(/\s{2,}$/, "")
    .trim();
}

function scoreRaceArticle(article, race) {
  const title = normalizeSearchText(article.title);
  const description = normalizeSearchText(article.description);
  const raceTokens = getRaceTokens(race);
  const titleMatches = raceTokens.filter((token) => title.includes(token)).length;
  const descriptionMatches = raceTokens.filter((token) => description.includes(token)).length;
  const publishedAt = article.publishedAt ? new Date(article.publishedAt).getTime() : 0;
  const hoursOld = publishedAt ? Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60)) : 9999;

  let score = getPublisherScore(article.publisher);
  score += titleMatches * 28;
  score += descriptionMatches * 12;
  score += /result|results|wins|won|victory|podium|preview|report|gallery|highlights/i.test(article.title) ? 18 : 0;
  score += Math.max(0, 48 - Math.min(hoursOld, 48));

  return score;
}

function buildArticleItem(block, race) {
  const title = normalizeArticleTitle(extractXmlTag(block, "title"), extractXmlTag(block, "source"));
  const publisher = cleanFeedText(extractXmlTag(block, "source")) || "News source";
  const description = cleanFeedText(extractXmlTag(block, "description"));
  const url = cleanFeedText(extractXmlTag(block, "link"));
  const publishedAt = cleanFeedText(extractXmlTag(block, "pubDate"));

  return {
    raceTitle: race.title,
    raceDate: race.date,
    title: title || `${race.title} coverage`,
    description,
    publisher,
    url,
    publishedAt,
    score: 0,
  };
}

async function fetchRaceArticles(race) {
  const queries = buildRaceArticleQueries(race);
  const xmlFeeds = await Promise.all(
    queries.map(async (query) => {
      try {
        const params = new URLSearchParams({
          q: query,
          hl: "en-US",
          gl: "US",
          ceid: "US:en",
        });
        return await fetchText(`https://news.google.com/rss/search?${params.toString()}`);
      } catch {
        return "";
      }
    }),
  );

  const seenKeys = new Set();
  const articles = xmlFeeds
    .flatMap((xml) => extractFeedItems(xml))
    .map((block) => buildArticleItem(block, race))
    .filter((article) => article.url && article.title)
    .filter((article) => isLikelyRaceArticle(article, race))
    .filter((article) => {
      const key = `${normalizeSearchText(article.title)}|${normalizeSearchText(article.publisher)}`;
      if (seenKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);
      return true;
    })
    .map((article) => ({
      ...article,
      score: scoreRaceArticle(article, race),
    }))
    .sort((left, right) => right.score - left.score);

  const topTierArticles = articles.filter((article) => getPublisherScore(article.publisher) > 40);
  return (topTierArticles.length > 0 ? topTierArticles : articles).slice(0, 32);
}

async function loadRaceArticlePool(race) {
  const raceId = getRaceId(race);
  const cached = articleCache.get(raceId);
  const now = Date.now();

  if (cached?.data && now - cached.updatedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetchRaceArticles(race)
    .then((articles) => {
      articleCache.set(raceId, {
        updatedAt: Date.now(),
        data: articles,
        promise: null,
      });
      return articles;
    })
    .catch((error) => {
      articleCache.delete(raceId);
      throw error;
    });

  articleCache.set(raceId, {
    updatedAt: now,
    data: cached?.data || null,
    promise,
  });

  return promise;
}

function selectRaceArticles(articlePool, refreshToken) {
  const rankedPool = [...articlePool]
    .sort((left, right) => right.score - left.score)
    .slice(0, 32);

  if (rankedPool.length <= MAX_RACE_ARTICLES) {
    return rankedPool;
  }

  const orderedPool = [...rankedPool]
    .sort((left, right) => {
      const leftValue = seededValue(0, `${left.url}|${left.title}`);
      const rightValue = seededValue(0, `${right.url}|${right.title}`);
      return leftValue - rightValue;
    })
    .slice(0);
  const batchCount = Math.ceil(orderedPool.length / MAX_RACE_ARTICLES);
  const batchIndex = refreshToken % batchCount;
  const startIndex = batchIndex * MAX_RACE_ARTICLES;
  const batch = orderedPool.slice(startIndex, startIndex + MAX_RACE_ARTICLES);

  if (batch.length === MAX_RACE_ARTICLES || startIndex === 0) {
    return batch;
  }

  return [...batch, ...orderedPool.slice(0, MAX_RACE_ARTICLES - batch.length)];
}

async function loadRaceData() {
  const now = Date.now();
  if (cache.data && now - cache.updatedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    const seasonPages = await Promise.all(
      SEASONS.map(async (season) => {
        const yearMatch = season.pageTitle.match(/20\d{2}/);
        const year = yearMatch ? Number(yearMatch[0]) : new Date().getUTCFullYear();
        const rawText = await fetchWikiRaw(season.pageTitle);
        return parseSeasonRows(rawText, season, year);
      }),
    );

    const allRaces = seasonPages
      .flat()
      .filter((race) => race.pageTitle && race.startDate && race.endDate && !race.isCancelled);
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const recentResults = allRaces
      .filter((race) => race.winner && race.endDate && race.endDate <= todayUtc)
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, MAX_RECENT_RESULTS);

    const liveStageRaces = allRaces
      .filter(
        (race) =>
          isMultiDayRace(race) &&
          race.startDate &&
          race.endDate &&
          race.startDate <= todayUtc &&
          race.endDate >= todayUtc,
      )
      .sort((left, right) => {
        if (left.endDate.getTime() !== right.endDate.getTime()) {
          return left.endDate - right.endDate;
        }

        return left.startDate - right.startDate;
      })
      .slice(0, MAX_LIVE_STAGE_RACES);

    const upcomingRaces = allRaces
      .filter((race) => race.startDate && race.startDate > todayUtc)
      .sort((left, right) => left.startDate - right.startDate)
      .slice(0, MAX_UPCOMING_RACES);

    const displayRaces = [...recentResults, ...liveStageRaces, ...upcomingRaces];
    const stageRaceDisplays = liveStageRaces.filter(isMultiDayRace);

    await enrichLocations(displayRaces);
    await enrichRecentResultStandings(recentResults);
    await enrichStageRaceSnapshots(stageRaceDisplays);

    recentResults.forEach((race) => {
      race.id = getRaceId(race);
    });

    liveStageRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    upcomingRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    const data = {
      fetchedAt: new Date().toISOString(),
      recentResults,
      liveStageRaces,
      upcomingRaces,
    };

    cache = {
      updatedAt: Date.now(),
      data,
      promise: null,
    };

    return data;
  })();

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

function buildPodiumMarkup(entries) {
  const podium = entries
    .filter((entry) => entry?.rider)
    .map(
      (entry) => `
        <li class="podium-item">
          <span class="podium-place place-${escapeHtml(entry.place)}">${escapeHtml(entry.place)}</span>
          <span class="podium-rider">${escapeHtml(entry.rider)}</span>
        </li>`,
    )
    .join("");

  return podium ? `<ol class="podium-list">${podium}</ol>` : `<p class="meta">Result details are still being updated.</p>`;
}

function buildStageRaceCard(race, options = {}) {
  const latestStage = race.stageRace?.latestStage || null;
  const classification = race.stageRace?.generalClassification || null;
  const isFinalizedStageRace =
    !options.live &&
    (race.stageRace?.completedStages || 0) > 0 &&
    (race.stageRace?.totalStages || 0) > 0 &&
    (race.stageRace.completedStages || 0) >= (race.stageRace.totalStages || 0);
  const hasCurrentGcSnapshot =
    options.live ||
    ((race.stageRace?.completedStages || 0) > 0 &&
      (race.stageRace?.totalStages || 0) > 0 &&
      (race.stageRace.completedStages || 0) < (race.stageRace.totalStages || 0));
  const stageLabel = latestStage?.number ? `Stage ${latestStage.number}` : "Latest stage";
  const classificationLabel =
    classification?.stageNumber && hasCurrentGcSnapshot
      ? `Overall after stage ${classification.stageNumber}`
      : "Overall classification";
  const stageStandings = latestStage?.standings || [];
  const gcStandings =
    classification?.standings ||
    race.resultStandings ||
    [
      { place: "1", rider: race.winner },
      { place: "2", rider: race.second },
      { place: "3", rider: race.third },
    ].filter((entry) => entry.rider);
  const liveBadge = options.live ? `<span class="status-pill">Live stage race</span>` : "";
  const stageContent = latestStage?.winner
    ? `
      <div class="card-subsection">
        <div class="detail-label">${escapeHtml(stageLabel)} winner</div>
        <div class="stage-winner">${escapeHtml(latestStage.winner)}</div>
        ${buildPodiumMarkup(stageStandings)}
      </div>`
    : `
      <div class="card-subsection">
        <div class="detail-label">Stage results</div>
        <p class="meta">No completed stage result is available yet.</p>
      </div>`;
  const gcContent = gcStandings.length > 0
    ? `
      <div class="card-subsection">
        <div class="detail-label">${escapeHtml(classificationLabel)}</div>
        ${buildPodiumMarkup(gcStandings)}
      </div>`
    : `
      <div class="card-subsection">
        <div class="detail-label">Overall classification</div>
        <p class="meta">The general classification is not available yet.</p>
      </div>`;
  const orderedContent = isFinalizedStageRace
    ? `${gcContent}${stageContent}`
    : `${stageContent}${gcContent}`;

  return `
    <article class="card result-card stage-race-card">
      <div class="card-kicker">${escapeHtml(race.series)} ${liveBadge}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${orderedContent}
    </article>`;
}

function buildRaceCard(race) {
  if (race.stageRace) {
    return buildStageRaceCard(race);
  }

  return `
    <article class="card result-card">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${buildPodiumMarkup(
        race.resultStandings ||
          [
            { place: "1", rider: race.winner },
            { place: "2", rider: race.second },
            { place: "3", rider: race.third },
          ],
      )}
    </article>`;
}

function buildLiveStageRaceCard(race) {
  return buildStageRaceCard(race, { live: true });
}

function buildUpcomingCard(race) {
  return `
    <article class="card upcoming-card">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
    </article>`;
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: EASTERN_TIMEZONE,
  }).format(new Date(timestamp));
}

function buildArticleCard(article) {
  const publishedLabel = article.publishedAt
    ? formatTimestamp(article.publishedAt)
    : "Recent coverage";

  return `
    <article class="article-card">
      <div class="article-kicker">${escapeHtml(article.publisher)}</div>
      <h3><a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a></h3>
      <p class="meta">${escapeHtml(publishedLabel)}</p>
      <p class="article-description">${escapeHtml(article.description || `Coverage related to ${article.raceTitle}.`)}</p>
    </article>`;
}

function buildRaceArticleControls(groupId, articleRaces, selectedRaceId, refreshToken) {
  const options = articleRaces
    .map((race) => {
      const selected = race.id === selectedRaceId ? " selected" : "";
      return `<option value="${escapeHtml(race.id)}"${selected}>${escapeHtml(race.title)} • ${escapeHtml(race.date)}</option>`;
    })
    .join("");

  return `
    <form class="article-controls" method="get" action="/#${escapeHtml(groupId)}-coverage">
      <div class="article-controls-left">
        <label class="article-label" for="${escapeHtml(groupId)}-race-select">Select Race</label>
        <select id="${escapeHtml(groupId)}-race-select" name="${escapeHtml(groupId)}-race" class="article-select" data-group-id="${escapeHtml(groupId)}">${options}</select>
      </div>
      <input type="hidden" name="${escapeHtml(groupId)}-refresh" id="${escapeHtml(groupId)}-refresh-token" value="${escapeHtml(String(refreshToken))}" />
      <button type="button" class="refresh-button" data-group-id="${escapeHtml(groupId)}">Refresh</button>
    </form>`;
}

function getCompetitionGroups(data) {
  const definitions = [
    {
      id: "mens-worldtour",
      label: "Men's WorldTour",
      tag: "Top Tier Men",
      description: "Live stage races, latest results, and upcoming events from the men's WorldTour calendar.",
      predicate: (race) => race.series === "Men's WorldTour",
    },
    {
      id: "womens-worldtour",
      label: "Women's WorldTour",
      tag: "Top Tier Women",
      description: "Live stage races, latest results, and upcoming events from the women's WorldTour calendar.",
      predicate: (race) => race.series === "Women's WorldTour",
    },
    {
      id: "proseries",
      label: "UCI ProSeries",
      tag: "Expanded Calendar",
      description: "The ProSeries races added today, with live stage races, fresh results, and upcoming events.",
      predicate: (race) => /ProSeries/.test(race.series),
    },
  ];

  return definitions.map((definition) => ({
    ...definition,
    liveStageRaces: data.liveStageRaces.filter(definition.predicate),
    recentResults: data.recentResults.filter(definition.predicate),
    upcomingRaces: data.upcomingRaces.filter(definition.predicate),
  }));
}

function buildCompetitionBlock(title, description, markup) {
  if (!markup) {
    return "";
  }

  return `
    <div class="competition-block">
      <div class="competition-block-head">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="grid competition-grid">${markup}</div>
    </div>`;
}

function buildCoverageBlock(group, coverageView) {
  if (!coverageView || coverageView.articleRaces.length === 0) {
    return "";
  }

  const controls = buildRaceArticleControls(
    group.id,
    coverageView.articleRaces,
    coverageView.selectedRaceId,
    coverageView.refreshToken,
  );
  const articleCards =
    coverageView.raceArticles.length > 0
      ? coverageView.raceArticles.map(buildArticleCard).join("")
      : `<p class="meta">No top-tier race coverage was available for ${escapeHtml(coverageView.selectedRaceTitle)} at the moment.</p>`;

  return `
    <div class="competition-block competition-coverage" id="${escapeHtml(group.id)}-coverage">
      <div class="competition-block-head">
        <h3>Race Coverage</h3>
        <p>Choose one live or recent race from this competition to view article coverage.</p>
      </div>
      ${controls}
      <div class="article-grid">${articleCards}</div>
    </div>`;
}

function buildCompetitionSection(group, coverageView) {
  const liveMarkup = group.liveStageRaces.map(buildLiveStageRaceCard).join("");
  const recentMarkup = group.recentResults.map(buildRaceCard).join("");
  const upcomingMarkup = group.upcomingRaces.map(buildUpcomingCard).join("");
  const blocks = [
    buildCompetitionBlock("Live Now", "Current stage races and overall standings.", liveMarkup),
    buildCompetitionBlock("Recent Results", "Most recent finalized races and classifications.", recentMarkup),
    buildCompetitionBlock("Upcoming", "Next races on the calendar.", upcomingMarkup),
    buildCoverageBlock(group, coverageView),
  ]
    .filter(Boolean)
    .join("");

  if (!blocks) {
    return "";
  }

  return `
    <section class="section competition-section" id="${escapeHtml(group.id)}">
      <div class="section-head">
        <div>
          <div class="section-tag">${escapeHtml(group.tag)}</div>
          <h2>${escapeHtml(group.label)}</h2>
          <p>${escapeHtml(group.description)}</p>
        </div>
      </div>
      <div class="competition-stack">${blocks}</div>
    </section>`;
}

function buildHtmlPage(data, view) {
  const competitionSections = getCompetitionGroups(data)
    .map((group) => buildCompetitionSection(group, view.coverageByGroup[group.id]))
    .filter(Boolean)
    .join("");
  const heroHighlights = [
    "Live stage winners",
    "Overall classification leaders",
    "Top-five race results",
    "Upcoming race calendars",
    "Competition-specific coverage",
    "WorldTour and ProSeries tracking",
  ]
    .map(
      (highlight) => `
        <div class="highlight-pill">${escapeHtml(highlight)}</div>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pro Cycling Results</title>
    <style>
      @font-face {
        font-family: "Manrope";
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url("/assets/fonts/manrope-500.ttf") format("truetype");
      }

      @font-face {
        font-family: "Manrope";
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url("/assets/fonts/manrope-700.ttf") format("truetype");
      }

      @font-face {
        font-family: "Manrope";
        font-style: normal;
        font-weight: 800;
        font-display: swap;
        src: url("/assets/fonts/manrope-800.ttf") format("truetype");
      }

      @font-face {
        font-family: "Barlow Semi Condensed";
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        src: url("/assets/fonts/barlow-semi-condensed-600.ttf") format("truetype");
      }

      @font-face {
        font-family: "Barlow Semi Condensed";
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url("/assets/fonts/barlow-semi-condensed-700.ttf") format("truetype");
      }

      @font-face {
        font-family: "Barlow Semi Condensed";
        font-style: normal;
        font-weight: 800;
        font-display: swap;
        src: url("/assets/fonts/barlow-semi-condensed-800.ttf") format("truetype");
      }

      :root {
        --uci-blue: #0033a0;
        --uci-blue-bright: #0078c7;
        --uci-blue-deep: #00184d;
        --uci-yellow: #ffcc00;
        --uci-red: #ef3340;
        --bg: #eef3fb;
        --bg-deep: #dfe8f7;
        --panel: rgba(255, 255, 255, 0.94);
        --panel-alt: rgba(244, 248, 255, 0.9);
        --ink: #09214c;
        --muted: #4f6188;
        --line: rgba(0, 51, 160, 0.12);
        --line-strong: rgba(0, 51, 160, 0.22);
        --shadow: 0 22px 60px rgba(0, 31, 98, 0.12);
        --shadow-strong: 0 32px 90px rgba(0, 31, 98, 0.18);
        --rainbow: linear-gradient(
          90deg,
          #00a651 0%,
          #00a651 20%,
          #005bbb 20%,
          #005bbb 40%,
          #ef3340 40%,
          #ef3340 60%,
          #111111 60%,
          #111111 80%,
          #ffcc00 80%,
          #ffcc00 100%
        );
      }

      * {
        box-sizing: border-box;
      }

      html {
        background: var(--uci-blue-deep);
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(0, 120, 199, 0.24), transparent 24%),
          radial-gradient(circle at 85% 12%, rgba(255, 204, 0, 0.22), transparent 18%),
          linear-gradient(180deg, #f7faff 0%, var(--bg) 52%, #e6eefb 100%);
        font-family: "Manrope", "Segoe UI", sans-serif;
      }

      .page {
        width: min(1240px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.25rem 0 3rem;
      }

      h1,
      h2,
      h3 {
        margin: 0;
        line-height: 0.96;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .hero {
        position: relative;
        overflow: hidden;
        padding: 2rem;
        border-radius: 34px;
        color: white;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 42%),
          linear-gradient(160deg, var(--uci-blue-deep) 0%, var(--uci-blue) 58%, var(--uci-blue-bright) 100%);
        box-shadow: var(--shadow-strong);
      }

      .hero::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(120deg, rgba(255, 255, 255, 0.08), transparent 30%),
          radial-gradient(circle at 92% 14%, rgba(255, 204, 0, 0.28), transparent 20%);
        pointer-events: none;
      }

      .hero::after {
        content: "";
        position: absolute;
        left: 2rem;
        right: 2rem;
        bottom: 0;
        height: 6px;
        border-radius: 999px 999px 0 0;
        background: var(--rainbow);
      }

      .hero-grid {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 1.6rem;
        grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.9fr);
        align-items: end;
      }

      .hero-copy {
        max-width: 48rem;
      }

      .eyebrow,
      .section-tag,
      .card-kicker,
      .detail-label,
      .article-kicker,
      .article-label,
      .metric-label,
      .updated {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .eyebrow {
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.18);
        backdrop-filter: blur(10px);
      }

      h1 {
        margin-top: 1rem;
        font-size: clamp(3.1rem, 7vw, 6rem);
        text-transform: uppercase;
      }

      .hero p {
        margin: 1rem 0 0;
        max-width: 38rem;
        color: rgba(255, 255, 255, 0.82);
        font-size: 1.04rem;
        line-height: 1.65;
      }

      .updated {
        margin-top: 1.1rem;
        color: rgba(255, 255, 255, 0.76);
        font-size: 0.82rem;
      }

      .hero-highlights {
        display: flex;
        flex-wrap: wrap;
        align-content: end;
        gap: 0.8rem;
        padding: 0.2rem 0 0.4rem;
      }

      .highlight-pill {
        display: inline-flex;
        align-items: center;
        min-height: 3.25rem;
        padding: 0.85rem 1rem;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
        backdrop-filter: blur(14px);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        color: white;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .meta {
        margin: 0.6rem 0 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .section {
        position: relative;
        margin-top: 1.25rem;
        padding: 1.35rem;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(244, 248, 255, 0.92));
        box-shadow: var(--shadow);
      }

      .section::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 6px;
        background: linear-gradient(180deg, var(--uci-blue-bright), var(--uci-blue));
      }

      .section-head {
        position: relative;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.15rem;
      }

      .section-head p {
        margin: 0.4rem 0 0;
        color: var(--muted);
        max-width: 44rem;
        line-height: 1.55;
      }

      .section-tag {
        color: var(--uci-blue-bright);
        font-size: 0.74rem;
      }

      .section h2 {
        margin-top: 0.2rem;
        font-size: clamp(1.9rem, 3.8vw, 2.7rem);
        text-transform: uppercase;
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .competition-section::before {
        background: linear-gradient(180deg, var(--uci-yellow), var(--uci-blue-bright));
      }

      .competition-stack {
        display: grid;
        gap: 1.15rem;
      }

      .competition-block {
        padding: 1rem;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(0, 51, 160, 0.03), rgba(255, 255, 255, 0.94));
      }

      .competition-block-head {
        margin-bottom: 0.9rem;
      }

      .competition-block-head h3 {
        font-size: 1.4rem;
        text-transform: uppercase;
      }

      .competition-block-head p {
        margin: 0.3rem 0 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .competition-grid {
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }

      .competition-coverage .article-grid {
        margin-top: 1rem;
      }

      .card,
      .article-card {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, white 0%, var(--panel-alt) 100%);
        box-shadow: 0 14px 40px rgba(0, 31, 98, 0.08);
      }

      .card::before,
      .article-card::before {
        content: "";
        position: absolute;
        left: 1rem;
        right: 1rem;
        top: 0;
        height: 4px;
        border-radius: 0 0 999px 999px;
        background: linear-gradient(90deg, var(--uci-blue), var(--uci-blue-bright));
      }

      .card {
        padding: 1.2rem;
      }

      .card-kicker {
        margin-bottom: 0.65rem;
        color: var(--uci-blue-bright);
        font-size: 0.75rem;
      }

      .card h3 {
        font-size: 1.58rem;
        text-transform: uppercase;
      }

      .podium-list {
        list-style: none;
        margin: 1rem 0 0;
        padding: 0;
      }

      .podium-item {
        display: grid;
        grid-template-columns: 2.6rem 1fr;
        align-items: center;
        gap: 0.8rem;
        padding: 0.75rem 0;
        border-top: 1px solid var(--line);
      }

      .podium-item:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .podium-place {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 16px;
        color: white;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1rem;
        font-weight: 800;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      .place-1 {
        background: linear-gradient(180deg, #0047d4 0%, #0033a0 100%);
      }

      .place-2 {
        background: linear-gradient(180deg, #0b84d9 0%, #0067b8 100%);
      }

      .place-3 {
        background: linear-gradient(180deg, #ff4f5e 0%, #d92c3a 100%);
      }

      .place-4,
      .place-5 {
        background: linear-gradient(180deg, #93a4c7 0%, #64779f 100%);
      }

      .podium-rider {
        font-size: 1.05rem;
        font-weight: 700;
      }

      .stage-race-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .card-subsection {
        padding-top: 0.95rem;
        border-top: 1px solid var(--line);
      }

      .detail-label {
        color: var(--uci-blue-bright);
        font-size: 0.73rem;
      }

      .stage-winner {
        margin-top: 0.45rem;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1.18rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .status-pill {
        display: inline-flex;
        margin-left: 0.45rem;
        padding: 0.22rem 0.52rem;
        border-radius: 999px;
        background: rgba(255, 204, 0, 0.14);
        color: #9b6500;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        vertical-align: middle;
      }

      .article-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }

      .article-controls {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        width: 100%;
        padding: 1rem;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(0, 51, 160, 0.04), rgba(0, 120, 199, 0.02));
      }

      .article-controls-left {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        min-width: min(100%, 28rem);
      }

      .article-label {
        color: var(--uci-blue-bright);
        font-size: 0.74rem;
      }

      .article-select,
      .refresh-button {
        min-height: 3.2rem;
        border-radius: 16px;
        border: 1px solid var(--line-strong);
        font-family: "Manrope", "Segoe UI", sans-serif;
        font-size: 0.98rem;
        font-weight: 700;
      }

      .article-select {
        width: 100%;
        padding: 0.9rem 1rem;
        background: rgba(255, 255, 255, 0.98);
        color: var(--ink);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }

      .refresh-button {
        padding: 0.9rem 1.25rem;
        background: linear-gradient(180deg, var(--uci-blue-bright) 0%, var(--uci-blue) 100%);
        color: white;
        cursor: pointer;
        box-shadow: 0 16px 30px rgba(0, 74, 184, 0.24);
      }

      .article-card {
        padding: 1rem 1rem 1.1rem;
      }

      .article-kicker {
        color: var(--uci-blue-bright);
        font-size: 0.72rem;
      }

      .article-card h3 {
        margin-top: 0.6rem;
        font-size: 1.26rem;
        line-height: 1.05;
        text-transform: uppercase;
      }

      .article-card h3 a {
        color: var(--ink);
        text-decoration: none;
      }

      .article-card h3 a:hover {
        color: var(--uci-blue);
      }

      .article-description {
        margin: 0.85rem 0 0;
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.45;
      }

      .footer-note {
        margin-top: 1.2rem;
        padding: 0.95rem 1rem 0;
        color: rgba(9, 33, 76, 0.66);
        font-size: 0.9rem;
        text-align: center;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100% - 1rem, 1120px);
          padding-top: 0.7rem;
        }

        .hero,
        .section {
          border-radius: 22px;
        }

        .hero {
          padding: 1.25rem;
        }

        .hero::after {
          left: 1.25rem;
          right: 1.25rem;
        }

        .hero-grid {
          grid-template-columns: 1fr;
        }

        .hero-highlights {
          gap: 0.65rem;
        }

        h1 {
          font-size: clamp(2.7rem, 14vw, 4.4rem);
        }

        .section {
          padding: 1rem;
        }

        .section-head {
          align-items: start;
          flex-direction: column;
        }

        .article-controls {
          align-items: stretch;
          flex-direction: column;
        }

        .article-controls-left {
          min-width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="eyebrow">UCI-Inspired Race Desk</div>
            <h1>Pro Cycling Results</h1>
            <p>
              Organized by competition tier, with separate race desks for the men&apos;s WorldTour,
              women&apos;s WorldTour, and ProSeries races.
            </p>
            <div class="updated">Updated ${escapeHtml(formatTimestamp(data.fetchedAt))} Eastern Time</div>
          </div>
          <div class="hero-highlights">${heroHighlights}</div>
        </div>
      </section>

      ${competitionSections}

      <p class="footer-note">Data refreshes automatically from live season pages when the server cache expires. Race coverage links update from current news feeds.</p>
    </main>
    <script>
      document.querySelectorAll(".article-select").forEach((raceSelect) => {
        raceSelect.addEventListener("change", () => {
          const groupId = raceSelect.dataset.groupId;
          const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
          if (refreshTokenInput) {
            refreshTokenInput.value = "0";
          }
          raceSelect.form?.requestSubmit();
        });
      });

      document.querySelectorAll(".refresh-button").forEach((refreshButton) => {
        refreshButton.addEventListener("click", () => {
          const groupId = refreshButton.dataset.groupId;
          const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
          const currentValue = Number.parseInt(refreshTokenInput?.value || "0", 10) || 0;
          if (refreshTokenInput) {
            refreshTokenInput.value = String(currentValue + 1);
          }
          refreshButton.form?.requestSubmit();
        });
      });
    </script>
  </body>
</html>`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(html);
}

async function sendStaticFile(response, pathname) {
  const assetRoot = path.join(__dirname, "assets");
  const resolvedPath = path.normalize(path.join(__dirname, pathname));

  if (!resolvedPath.startsWith(assetRoot)) {
    sendHtml(
      response,
      403,
      "<!doctype html><meta charset='utf-8'><title>Forbidden</title><h1>Forbidden</h1>",
    );
    return true;
  }

  try {
    const file = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentTypeByExtension = {
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".ttf": "font/ttf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".svg": "image/svg+xml; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };

    response.writeHead(200, {
      "content-type": contentTypeByExtension[extension] || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    });
    response.end(file);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/assets/")) {
      const handled = await sendStaticFile(response, url.pathname);
      if (handled) {
        return;
      }
    }

    const data = await loadRaceData();

    if (url.pathname !== "/") {
      if (url.pathname === "/api/races") {
        sendJson(response, 200, data);
        return;
      }

      sendHtml(
        response,
        404,
        "<!doctype html><meta charset='utf-8'><title>Not Found</title><h1>Not Found</h1>",
      );
      return;
    }

    const competitionGroups = getCompetitionGroups(data);
    const coverageEntries = await Promise.all(
      competitionGroups.map(async (group) => {
        const articleRaces = [...group.liveStageRaces, ...group.recentResults];
        const selectedRaceId = url.searchParams.get(`${group.id}-race`) || articleRaces[0]?.id || "";
        const refreshToken = Math.max(
          0,
          Number.parseInt(url.searchParams.get(`${group.id}-refresh`) || "0", 10) || 0,
        );
        const selectedRace =
          articleRaces.find((race) => race.id === selectedRaceId) || articleRaces[0] || null;
        const articlePool = selectedRace ? await loadRaceArticlePool(selectedRace) : [];

        return [
          group.id,
          {
            articleRaces,
            selectedRaceId: selectedRace?.id || "",
            selectedRaceTitle: selectedRace?.title || "the selected race",
            refreshToken,
            raceArticles: selectRaceArticles(articlePool, refreshToken),
          },
        ];
      }),
    );
    const coverageByGroup = Object.fromEntries(coverageEntries);

    sendHtml(
      response,
      200,
      buildHtmlPage(data, {
        coverageByGroup,
      }),
    );
  } catch (error) {
    sendHtml(
      response,
      500,
      `<!doctype html>
       <html lang="en">
         <meta charset="utf-8" />
         <title>Race Feed Error</title>
         <body style="font-family: Georgia, serif; padding: 2rem; background: #f6fbf7; color: #102217;">
           <h1>Unable to load race data</h1>
           <p>${escapeHtml(error.message)}</p>
         </body>
       </html>`,
    );
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
