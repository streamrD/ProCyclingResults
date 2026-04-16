const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const EASTERN_TIMEZONE = "America/New_York";
const MAX_RACE_ARTICLES = 8;
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
  },
  {
    pageTitle: "2026_UCI_Women's_World_Tour",
    label: "Women's WorldTour",
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

function parseSeasonRows(rawText, seriesLabel, year) {
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
      return {
        ...race,
        series: seriesLabel,
        date: formatDateLabel(cells[1], year),
        winner: parseAthlete(cells[2]),
        second: parseAthlete(cells[3]),
        third: parseAthlete(cells[4]),
        startDate: dateRange.start,
        endDate: dateRange.end,
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

function extractLeadLocation(rawText) {
  const lead = rawText
    .split("\n\n")
    .slice(0, 4)
    .join(" ");

  const patterns = [
    /\b(?:took place|will take place|takes place)\b.*?\bin ([^.]+)\./i,
    /\bwas a .*? race that took place .*?\bin ([^.]+)\./i,
    /\bwas a .*? race .*?\bin ([^.]+)\./i,
  ];

  for (const pattern of patterns) {
    const match = lead.match(pattern);
    if (match) {
      return cleanWikiText(match[1]).replace(/\s+,/g, ",");
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

  if (text.length > 80) {
    return false;
  }

  return !/(organisers|announced|world tour|women's world tour|men's world tour|season|edition|race would be held)/i.test(
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
        return parseSeasonRows(rawText, season.label, year);
      }),
    );

    const allRaces = seasonPages.flat();
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const recentResults = allRaces
      .filter((race) => race.winner && race.endDate && race.endDate <= todayUtc)
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, 8);

    const upcomingRaces = allRaces
      .filter((race) => race.endDate && race.endDate >= todayUtc)
      .sort((left, right) => left.startDate - right.startDate)
      .slice(0, 8);

    await enrichLocations([...recentResults, ...upcomingRaces]);
    recentResults.forEach((race) => {
      race.id = getRaceId(race);
    });

    upcomingRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    const data = {
      fetchedAt: new Date().toISOString(),
      recentResults,
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

function buildRaceCard(race) {
  const podium = [
    { place: "1", rider: race.winner, medalClass: "place-1" },
    { place: "2", rider: race.second, medalClass: "place-2" },
    { place: "3", rider: race.third, medalClass: "place-3" },
  ]
    .map(
      (entry) => `
        <li class="podium-item">
          <span class="podium-place ${entry.medalClass}">${entry.place}</span>
          <span class="podium-rider">${escapeHtml(entry.rider)}</span>
        </li>`,
    )
    .join("");

  return `
    <article class="card result-card">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      <ol class="podium-list">${podium}</ol>
    </article>`;
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

function buildRaceArticleControls(recentResults, selectedRaceId, refreshToken) {
  const options = recentResults
    .map((race) => {
      const selected = race.id === selectedRaceId ? " selected" : "";
      return `<option value="${escapeHtml(race.id)}"${selected}>${escapeHtml(race.title)} • ${escapeHtml(race.date)}</option>`;
    })
    .join("");

  return `
    <form class="article-controls" method="get" action="/#race-articles">
      <div class="article-controls-left">
        <label class="article-label" for="race-select">Select Race</label>
        <select id="race-select" name="race" class="article-select">${options}</select>
      </div>
      <input type="hidden" name="refresh" id="refresh-token" value="${escapeHtml(String(refreshToken))}" />
      <button type="button" class="refresh-button" id="refresh-button">Refresh</button>
    </form>`;
}

function buildHtmlPage(data, view) {
  const recentCards = data.recentResults.map(buildRaceCard).join("");
  const upcomingCards = data.upcomingRaces.map(buildUpcomingCard).join("");
  const controls = buildRaceArticleControls(data.recentResults, view.selectedRaceId, view.refreshToken);
  const articleCards =
    view.raceArticles.length > 0
      ? view.raceArticles.map(buildArticleCard).join("")
      : `<p class="meta">No top-tier race coverage was available for ${escapeHtml(view.selectedRaceTitle)} at the moment.</p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pro Cycling Results</title>
    <style>
      :root {
        --bg: #eef3ef;
        --panel: rgba(255, 255, 255, 0.82);
        --panel-strong: rgba(255, 255, 255, 0.96);
        --ink: #102217;
        --muted: #4b6250;
        --line: rgba(16, 34, 23, 0.1);
        --accent: #0e8f61;
        --accent-deep: #06543a;
        --shadow: 0 24px 60px rgba(5, 50, 34, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(14, 143, 97, 0.18), transparent 28%),
          radial-gradient(circle at top right, rgba(237, 162, 55, 0.18), transparent 22%),
          linear-gradient(180deg, #f6fbf7 0%, var(--bg) 100%);
        font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
      }

      .page {
        width: min(1120px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 2rem 0 3rem;
      }

      .hero,
      .section {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .hero {
        padding: 2.2rem;
        overflow: hidden;
        position: relative;
      }

      .hero::after {
        content: "";
        position: absolute;
        inset: auto -5rem -5rem auto;
        width: 14rem;
        height: 14rem;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(14, 143, 97, 0.22), transparent 70%);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        background: rgba(14, 143, 97, 0.1);
        color: var(--accent-deep);
        font: 700 0.78rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3 {
        margin: 0;
        line-height: 1.05;
      }

      h1 {
        margin-top: 1rem;
        font-size: clamp(2.4rem, 5vw, 4.8rem);
      }

      .hero p,
      .meta,
      .updated {
        color: var(--muted);
      }

      .hero p {
        max-width: 42rem;
        margin: 1rem 0 0;
        font-size: 1.02rem;
      }

      .updated {
        margin-top: 1.1rem;
        font: 600 0.86rem/1.2 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .section {
        margin-top: 1.4rem;
        padding: 1.4rem;
      }

      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .section-head p {
        margin: 0.35rem 0 0;
        color: var(--muted);
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .card {
        background: var(--panel-strong);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 1.15rem;
      }

      .card-kicker {
        margin-bottom: 0.65rem;
        color: var(--accent-deep);
        font: 700 0.78rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .card h3 {
        font-size: 1.42rem;
      }

      .meta {
        margin: 0.6rem 0 0;
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
        padding: 0.65rem 0;
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
        border-radius: 999px;
        color: #39250b;
        font: 800 0.95rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        border: 1px solid rgba(16, 34, 23, 0.12);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.7),
          0 8px 20px rgba(16, 34, 23, 0.12);
      }

      .place-1 {
        background: linear-gradient(180deg, #f7e08c 0%, #d4a62a 100%);
      }

      .place-2 {
        background: linear-gradient(180deg, #f3f6fa 0%, #a5b0bc 100%);
      }

      .place-3 {
        background: linear-gradient(180deg, #e5b18d 0%, #b06a3e 100%);
      }

      .podium-rider {
        font-size: 1.05rem;
      }

      .article-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .article-controls {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        width: 100%;
      }

      .article-controls-left {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        min-width: min(100%, 26rem);
      }

      .article-label {
        color: var(--accent-deep);
        font: 700 0.78rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .article-select,
      .refresh-button {
        min-height: 2.9rem;
        border-radius: 14px;
        border: 1px solid rgba(16, 34, 23, 0.16);
        font: 600 0.98rem/1.1 "Avenir Next", "Trebuchet MS", sans-serif;
      }

      .article-select {
        width: 100%;
        padding: 0.8rem 1rem;
        background: rgba(255, 255, 255, 0.96);
        color: var(--ink);
      }

      .refresh-button {
        padding: 0.8rem 1.2rem;
        background: linear-gradient(180deg, #0fae75 0%, #0a6a48 100%);
        color: white;
        cursor: pointer;
      }

      .article-card {
        background: var(--panel-strong);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 1rem;
        box-shadow: 0 12px 36px rgba(5, 50, 34, 0.08);
      }

      .article-kicker {
        color: var(--accent-deep);
        font: 700 0.78rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .article-card h3 {
        margin-top: 0.6rem;
        font-size: 1.08rem;
        line-height: 1.25;
      }

      .article-card h3 a {
        color: var(--ink);
        text-decoration: none;
      }

      .article-card h3 a:hover {
        text-decoration: underline;
      }

      .article-description {
        margin: 0.85rem 0 0;
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.45;
      }

      .footer-note {
        margin-top: 1.2rem;
        text-align: center;
        color: var(--muted);
        font-size: 0.92rem;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100% - 1rem, 1120px);
          padding-top: 0.8rem;
        }

        .hero,
        .section {
          border-radius: 22px;
        }

        .hero {
          padding: 1.4rem;
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
        <div class="eyebrow">Live Race Snapshot</div>
        <h1>Pro Cycling Results</h1>
        <p>
          The latest WorldTour and Women&apos;s WorldTour podiums, followed by the next
          high-profile races on the calendar.
        </p>
        <div class="updated">Updated ${escapeHtml(formatTimestamp(data.fetchedAt))} Eastern Time</div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Most Recent Results</h2>
            <p>Each race shows the top three finishers, date, and location.</p>
          </div>
        </div>
        <div class="grid">${recentCards}</div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Upcoming Important Races</h2>
            <p>The next marquee events from the men&apos;s and women&apos;s top-tier calendars.</p>
          </div>
        </div>
        <div class="grid">${upcomingCards}</div>
      </section>

      <section class="section" id="race-articles">
        <div class="section-head">
          <div>
            <h2>Race Coverage</h2>
            <p>Choose one recent race to view top-tier article links related to that exact event.</p>
          </div>
          ${controls}
        </div>
        <div class="article-grid">${articleCards}</div>
      </section>

      <p class="footer-note">Data refreshes automatically from live season pages when the server cache expires. Race coverage links update from current news feeds.</p>
    </main>
    <script>
      const raceSelect = document.getElementById("race-select");
      const refreshButton = document.getElementById("refresh-button");
      const refreshTokenInput = document.getElementById("refresh-token");

      raceSelect?.addEventListener("change", () => {
        refreshTokenInput.value = "0";
        raceSelect.form?.requestSubmit();
      });

      refreshButton?.addEventListener("click", () => {
        const currentValue = Number.parseInt(refreshTokenInput.value || "0", 10) || 0;
        refreshTokenInput.value = String(currentValue + 1);
        refreshButton.form?.requestSubmit();
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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
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

    const selectedRaceId = url.searchParams.get("race") || data.recentResults[0]?.id || "";
    const refreshToken = Math.max(0, Number.parseInt(url.searchParams.get("refresh") || "0", 10) || 0);
    const selectedRace =
      data.recentResults.find((race) => race.id === selectedRaceId) || data.recentResults[0] || null;
    const articlePool = selectedRace ? await loadRaceArticlePool(selectedRace) : [];
    const raceArticles = selectRaceArticles(articlePool, refreshToken);

    sendHtml(
      response,
      200,
      buildHtmlPage(data, {
        selectedRaceId: selectedRace?.id || "",
        selectedRaceTitle: selectedRace?.title || "the selected race",
        refreshToken,
        raceArticles,
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
