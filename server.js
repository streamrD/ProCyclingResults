const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 15 * 60 * 1000;

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&ndash;", "–");
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
    { place: "1", rider: race.winner },
    { place: "2", rider: race.second },
    { place: "3", rider: race.third },
  ]
    .map(
      (entry) => `
        <li class="podium-item">
          <span class="podium-place">${entry.place}</span>
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
  }).format(new Date(timestamp));
}

function buildHtmlPage(data) {
  const recentCards = data.recentResults.map(buildRaceCard).join("");
  const upcomingCards = data.upcomingRaces.map(buildUpcomingCard).join("");

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
        background: linear-gradient(180deg, #0fae75 0%, #0a6a48 100%);
        color: white;
        font: 800 0.95rem/1 "Avenir Next Condensed", "Arial Narrow", "Trebuchet MS", sans-serif;
      }

      .podium-rider {
        font-size: 1.05rem;
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
        <div class="updated">Updated ${escapeHtml(formatTimestamp(data.fetchedAt))}</div>
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

      <p class="footer-note">Data refreshes automatically from live season pages when the server cache expires.</p>
    </main>
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

    if (url.pathname === "/api/races") {
      const data = await loadRaceData();
      sendJson(response, 200, data);
      return;
    }

    if (url.pathname !== "/") {
      sendHtml(
        response,
        404,
        "<!doctype html><meta charset='utf-8'><title>Not Found</title><h1>Not Found</h1>",
      );
      return;
    }

    const data = await loadRaceData();
    sendHtml(response, 200, buildHtmlPage(data));
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
