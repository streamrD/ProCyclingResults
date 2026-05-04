const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const EASTERN_TIMEZONE = "America/New_York";
const UMAMI_ANALYTICS_SCRIPT =
  '<script defer src="https://todd-umami.up.railway.app/script.js" data-website-id="2ad971aa-bf49-4708-b2b3-e117825d9e13"></script>';
const MAX_RACE_ARTICLES = 8;
const MAX_RESULT_RIDERS = 5;
const MAX_RECENT_RESULTS = 24;
const MAX_UPCOMING_RACES = 8;
const MAX_LIVE_STAGE_RACES = 6;
const MAX_EUROPE_TOUR_RESULTS = 6;
const MAX_EUROPE_TOUR_UPCOMING = 4;
const WORLDTOUR_RECENT_RESULTS = 6;
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
    dateIndex: 1,
    winnerIndex: 2,
    secondIndex: 3,
    thirdIndex: 4,
    statusStartIndex: 2,
  },
  {
    pageTitle: "2026_UCI_Women's_World_Tour",
    label: "Women's WorldTour",
    winnerMode: "podium",
    dateIndex: 1,
    winnerIndex: 2,
    secondIndex: 3,
    thirdIndex: 4,
    statusStartIndex: 2,
  },
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

const COUNTRY_NAMES = {
  ALG: "Algeria",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BRA: "Brazil",
  CAN: "Canada",
  CHN: "China",
  COL: "Colombia",
  CRO: "Croatia",
  CZE: "Czech Republic",
  DEN: "Denmark",
  ECU: "Ecuador",
  ERI: "Eritrea",
  ESP: "Spain",
  EST: "Estonia",
  ETH: "Ethiopia",
  FIN: "Finland",
  FRA: "France",
  GBR: "United Kingdom",
  GER: "Germany",
  GRE: "Greece",
  HUN: "Hungary",
  IRL: "Ireland",
  ISR: "Israel",
  ITA: "Italy",
  JPN: "Japan",
  KAZ: "Kazakhstan",
  LAT: "Latvia",
  LTU: "Lithuania",
  LUX: "Luxembourg",
  MAR: "Morocco",
  MEX: "Mexico",
  NED: "Netherlands",
  NOR: "Norway",
  NZL: "New Zealand",
  POL: "Poland",
  POR: "Portugal",
  RUS: "Russia",
  ROU: "Romania",
  MRI: "Mauritius",
  RSA: "South Africa",
  RWA: "Rwanda",
  SLO: "Slovenia",
  SRB: "Serbia",
  SVK: "Slovakia",
  SUI: "Switzerland",
  SWI: "Switzerland",
  SWE: "Sweden",
  THA: "Thailand",
  TUR: "Turkey",
  UAE: "United Arab Emirates",
  UKR: "Ukraine",
  URU: "Uruguay",
  USA: "United States",
  VEN: "Venezuela",
};

const COUNTRY_FLAG_CODES = {
  ALG: "DZ",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BRA: "BR",
  CAN: "CA",
  CHN: "CN",
  COL: "CO",
  CRO: "HR",
  CZE: "CZ",
  DEN: "DK",
  ECU: "EC",
  ERI: "ER",
  ESP: "ES",
  EST: "EE",
  ETH: "ET",
  FIN: "FI",
  FRA: "FR",
  GBR: "GB",
  GER: "DE",
  GRE: "GR",
  HUN: "HU",
  IRL: "IE",
  ISR: "IL",
  ITA: "IT",
  JPN: "JP",
  KAZ: "KZ",
  LAT: "LV",
  LTU: "LT",
  LUX: "LU",
  MAR: "MA",
  MEX: "MX",
  NED: "NL",
  NOR: "NO",
  NZL: "NZ",
  POL: "PL",
  POR: "PT",
  RUS: "RU",
  ROU: "RO",
  MRI: "MU",
  RSA: "ZA",
  RWA: "RW",
  SLO: "SI",
  SRB: "RS",
  SVK: "SK",
  SUI: "CH",
  SWI: "CH",
  SWE: "SE",
  THA: "TH",
  TUR: "TR",
  UAE: "AE",
  UKR: "UA",
  URU: "UY",
  USA: "US",
  VEN: "VE",
};

const RACE_FINISH_VIDEO_URLS = {
  "2026 Tour de Romandie": "https://www.youtube.com/watch?v=e3eX4dZpAAg",
  "2026 Presidential Cycling Tour of Turkiye": "https://www.youtube.com/watch?v=yOl95xG1yUo",
  "2026 Eschborn–Frankfurt": "https://www.youtube.com/watch?v=RRweTbrT4FM",
  "2026 Liège–Bastogne–Liège": "https://www.youtube.com/watch?v=54aTnzlKeg0",
  "2026 Liège–Bastogne–Liège Femmes": "https://www.youtube.com/watch?v=EAmXtxlmnOo",
  "2026 La Flèche Wallonne": "https://www.youtube.com/watch?v=dV3qE0Gn2m8",
  "2026 La Flèche Wallonne Femmes": "https://www.youtube.com/watch?v=P7G-RaIBfKs",
  "2026 Amstel Gold Race": "https://www.youtube.com/watch?v=JmMHjKmuPNo",
  "2026 Amstel Gold Race (women's race)": "https://www.youtube.com/watch?v=7L8DrzGq78A",
  "2026 Paris–Roubaix": "https://www.youtube.com/watch?v=dqAFZboY-aI",
  "2026 Paris–Roubaix Femmes": "https://www.youtube.com/watch?v=gh-uOBQ0hsM",
  "2026 Brabantse Pijl": "https://www.youtube.com/watch?v=v04vpeOCRdM",
  "2026 Scheldeprijs": "https://www.youtube.com/watch?v=bwXrRj53HRo",
};

const RIDER_COUNTRY_CODES = new Map(
  Object.entries({
    "Adria Pericas": "ESP",
    "Alan Hatherly": "RSA",
    "Aleksandr Vlasov": "RUS",
    "Alessandro Verre": "ITA",
    "Alex Aranburu": "ESP",
    "Alex Baudin": "FRA",
    "Alexander Kamp": "DEN",
    "Anders Foldager": "DEN",
    "Andrea Bagioli": "ITA",
    "Andrew August": "USA",
    "Anna van der Breggen": "NED",
    "Antoine L'Hote": "FRA",
    "Anton Schiffer": "GER",
    "Antonio Tiberi": "ITA",
    "Arnaud De Lie": "BEL",
    "Axel Laurance": "FRA",
    "Ben Tulett": "GBR",
    "Benoit Cosnefroy": "FRA",
    "Biniam Girmay": "ERI",
    "Carys Lloyd": "GBR",
    "Chiara Consonni": "ITA",
    "Christophe Laporte": "FRA",
    "Clement Champoussin": "FRA",
    "Clement Venturini": "FRA",
    "Corbin Strong": "NZL",
    "Davide Ballerini": "ITA",
    "Davide Donati": "ITA",
    "Davide Persico": "ITA",
    "Demi Vollering": "NED",
    "Diego Pescador": "COL",
    "Dusan Rajovic": "SRB",
    "Dylan Groenewegen": "NED",
    "Edgar David Cadena": "COL",
    "Eduard Prades": "ESP",
    "Egan Bernal": "COL",
    "Eleonora Gasparrini": "ITA",
    "Eline Jansen": "NED",
    "Elisa Balsamo": "ITA",
    "Elisa Longo Borghini": "ITA",
    "Elise Chabbey": "SUI",
    "Emiel Verstrynge": "BEL",
    "Emilien Jeanniere": "FRA",
    "Erlend Blikra": "NOR",
    "Ethan Vernon": "GBR",
    "Felix Gall": "AUT",
    "Femke de Vries": "NED",
    "Filippo Fiorelli": "ITA",
    "Filippo Ganna": "ITA",
    "Filippo Zana": "ITA",
    "Fleur Moors": "BEL",
    "Florian Lipowitz": "GER",
    "Florian Vermeersch": "BEL",
    "Frank van den Broek": "NED",
    "Franziska Koch": "GER",
    "Gal Glivar": "SLO",
    "Georg Zimmermann": "GER",
    "Gianmarco Garofoli": "ITA",
    "Giovanni Aleotti": "ITA",
    "Giulio Pellizzari": "ITA",
    "Harold Tejada": "COL",
    "Ibon Ruiz Sedano": "ESP",
    "Ion Izagirre": "ESP",
    "Isaac del Toro": "MEX",
    "Ivan Sosa": "COL",
    "Jan Christen": "SUI",
    "Jasper Philipsen": "BEL",
    "Jasper Stuyven": "BEL",
    "Jelle Vermoote": "BEL",
    "Jonas Abrahamsen": "NOR",
    "Jonathan Milan": "ITA",
    "Jordan Jegat": "FRA",
    "Jose Manuel Diaz": "ESP",
    "Joao Almeida": "POR",
    "Juan Ayuso": "ESP",
    "Jorgen Nordhagen": "NOR",
    "Kamiel Bonneu": "BEL",
    "Karlijn Swinkels": "NED",
    "Katarzyna Niewiadoma": "POL",
    "Katarzyna Niewiadoma-Phinney": "POL",
    "Kimberley Le Court": "MRI",
    "Kristian Egholm": "DEN",
    "Kevin Vauquelin": "FRA",
    "Laurence Pithie": "NZL",
    "Laurenz Rex": "BEL",
    "Lenny Martinez": "FRA",
    "Letizia Paternoster": "ITA",
    "Lieke Nooijen": "NED",
    "Loes Adegeest": "NED",
    "Lorena Wiebes": "NED",
    "Lorenzo Fortunato": "ITA",
    "Lotte Kopecky": "BEL",
    "Luca Mozzato": "ITA",
    "Luke Plapp": "AUS",
    "Mads Pedersen": "DEN",
    "Manuel Penalver": "ESP",
    "Marianne Vos": "NED",
    "Marlen Reusser": "SUI",
    "Martin Marcellusi": "ITA",
    "Mathieu van der Poel": "NED",
    "Matteo Fabbro": "ITA",
    "Matteo Jorgenson": "USA",
    "Matteo Malucelli": "ITA",
    "Mattias Skjelmose": "DEN",
    "Mauro Schmid": "SUI",
    "Max Kanter": "GER",
    "Maeva Squiban": "FRA",
    "Megan Jastrab": "USA",
    "Monica Trinca Colonel": "ITA",
    "Nairo Quintana": "COL",
    "Nicolas Breuillard": "FRA",
    "Nienke Veenhoven": "NED",
    "Noemi Ruegg": "SUI",
    "Oded Kogut": "ISR",
    "Oscar Onley": "GBR",
    "Paul Seixas": "FRA",
    "Paula Blasi": "ESP",
    "Pauline Ferrand-Prevot": "FRA",
    "Pavel Bittner": "CZE",
    "Pello Bilbao": "ESP",
    "Per Strand Hagenes": "NOR",
    "Primoz Roglic": "SLO",
    "Puck Pieterse": "NED",
    "Quinn Simmons": "USA",
    "Quinten Hermans": "BEL",
    "Raul Garcia Pierna": "ESP",
    "Remco Evenepoel": "BEL",
    "Robert Donaldson": "GBR",
    "Romain Gregoire": "FRA",
    "Sam Welsford": "AUS",
    "Samuel Fernandez": "ESP",
    "Sebastian Berwick": "AUS",
    "Shari Bossuyt": "BEL",
    "Simone Gualdi": "ITA",
    "Stan Dewulf": "BEL",
    "Stanislaw Aniolkowski": "POL",
    "Soren Waerenskjold": "NOR",
    "Tadej Pogacar": "SLO",
    "Thomas Gloag": "GBR",
    "Thomas Pesenti": "ITA",
    "Tilen Finkst": "SLO",
    "Tim Merlier": "BEL",
    "Tobias Halland Johannessen": "NOR",
    "Tobias Lund Andresen": "DEN",
    "Tom Crabbe": "GBR",
    "Tom Pidcock": "GBR",
    "Txomin Juaristi": "ESP",
    "Urko Berrade Fernandez": "ESP",
    "Wout van Aert": "BEL",
    "Zoe Backstedt": "GBR",
    "Zak Erzen": "SLO",
  }).map(([name, code]) => [name.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase(), code]),
);

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

  decoded = decoded
    .replace(/&#(\d+);/g, (_, codePoint) => {
      const value = Number.parseInt(codePoint, 10);
      if (!Number.isFinite(value)) {
        return _;
      }

      try {
        return String.fromCodePoint(value);
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => {
      const value = Number.parseInt(codePoint, 16);
      if (!Number.isFinite(value)) {
        return _;
      }

      try {
        return String.fromCodePoint(value);
      } catch {
        return _;
      }
    });

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

function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return code === "SWI" ? "SUI" : code;
}

function getRiderCountryCode(name) {
  const key = String(name || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .trim();

  return RIDER_COUNTRY_CODES.get(key) || "";
}

function parseAthleteDetails(cell) {
  const text = String(cell || "");
  const match = text.match(/\{\{\s*flagathlete\s*\|([\s\S]+?)\}\}/i);
  const templateArgs = match
    ? splitWikiTemplateArgs(match[0].replace(/^\{\{/, "").replace(/\}\}$/, ""))
    : [];
  const countryCode = normalizeCountryCode(templateArgs[2]);

  return {
    rider: cleanWikiText(templateArgs[1] || cell),
    countryCode,
  };
}

function parseAthlete(cell) {
  return parseAthleteDetails(cell).rider;
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

function createRaceNameVariants(value, options = {}) {
  let raw = cleanWikiText(String(value || ""))
    .replace(/^20\d{2}\s+/, "")
    .replace(/\s+Hauts de France$/i, "")
    .replace(/\s+Femmes(?: avec Zwift)?$/i, " Femmes")
    .trim();

  if (!options.preserveDivisionSuffix) {
    raw = raw.replace(/\s+\((men's|women's) race\)$/i, "").trim();
  }

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

function getRaceArticleVariants(race) {
  const variants = [];
  const seen = new Set();
  const division = getRaceDivision(race);

  function addVariant(value) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    variants.push(normalized);
  }

  function addFrom(value, options) {
    createRaceNameVariants(value, options).forEach(addVariant);
  }

  const baseVariants = [];
  const baseSeen = new Set();
  const addBaseVariant = (value) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (baseSeen.has(key)) {
      return;
    }

    baseSeen.add(key);
    baseVariants.push(normalized);
  };

  createRaceNameVariants(race?.title).forEach(addBaseVariant);
  createRaceNameVariants(race?.pageTitle).forEach(addBaseVariant);

  if (division === "women") {
    createRaceNameVariants(race?.pageTitle, { preserveDivisionSuffix: true }).forEach(addVariant);
    createRaceNameVariants(race?.title, { preserveDivisionSuffix: true }).forEach(addVariant);

    baseVariants.forEach((variant) => {
      if (hasWomenMarker(normalizeSearchText(variant))) {
        addVariant(variant);
        return;
      }

      addVariant(`${variant} Women`);
      addVariant(`${variant} Femmes`);
    });
  }

  baseVariants.forEach(addVariant);
  return variants;
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

function seasonIncludesRace(season, race) {
  const includedPageTitles = season.includePageTitles || [];
  const includedTitles = season.includeTitles || [];

  if (includedPageTitles.length === 0 && includedTitles.length === 0) {
    return true;
  }

  return (
    includedPageTitles.includes(race.pageTitle) ||
    includedTitles.includes(race.title)
  );
}

function parseSeasonRows(rawText, season, year) {
  const tableMatches = [...String(rawText || "").matchAll(/\{\| class="wikitable plainrowheaders"[\s\S]*?\n\|\}/g)];
  const dateIndex = season.dateIndex ?? 1;
  const winnerIndex = season.winnerIndex ?? 2;
  const secondIndex = season.secondIndex ?? 3;
  const thirdIndex = season.thirdIndex ?? 4;
  const statusStartIndex = season.statusStartIndex ?? winnerIndex;

  return tableMatches
    .flatMap((match) => match[0].split("\n|-\n").slice(1))
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
    .filter((cells) => cells.length > winnerIndex)
    .map((cells) => {
      const race = parseRaceCell(cells[0]);
      const dateRange = parseDateRange(cells[dateIndex], year);
      const statusText = cleanWikiText(cells.slice(statusStartIndex).join(" "));
      const hasPodium = season.winnerMode === "podium";
      const winner = parseAthleteDetails(cells[winnerIndex]);
      const second = hasPodium ? parseAthleteDetails(cells[secondIndex]) : { rider: "", countryCode: "" };
      const third = hasPodium ? parseAthleteDetails(cells[thirdIndex]) : { rider: "", countryCode: "" };

      return {
        ...race,
        series: season.label,
        date: formatDateLabel(cells[dateIndex], year),
        winner: winner.rider,
        winnerCountryCode: winner.countryCode || getRiderCountryCode(winner.rider),
        second: second.rider,
        secondCountryCode: second.countryCode || getRiderCountryCode(second.rider),
        third: third.rider,
        thirdCountryCode: third.countryCode || getRiderCountryCode(third.rider),
        startDate: dateRange.start,
        endDate: dateRange.end,
        isCancelled: /\bcancelled\b/i.test(statusText),
      };
    })
    .filter((race) => seasonIncludesRace(season, race));
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

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function getInfoboxField(rawText, fieldName) {
  const horizontalWhitespace = "[^\\S\\r\\n]*";
  const match = String(rawText || "").match(
    new RegExp(`^\\|${horizontalWhitespace}${fieldName}${horizontalWhitespace}=${horizontalWhitespace}([^\\r\\n]*)$`, "im"),
  );
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
  if (!/^\{\{\s*cycling\s*result\s*\|/i.test(trimmed)) {
    return null;
  }

  const args = splitWikiTemplateArgs(trimmed.replace(/^\{\{/, "").replace(/\}\}$/, ""));
  const templateName = String(args[0] || "").replace(/\s+/g, "").toLowerCase();
  if (templateName !== "cyclingresult" || args.length < 3) {
    return null;
  }

  return buildStandingEntry(cleanWikiText(args[1]), parseAthleteDetails(args[2]));
}

function extractCyclingResultBlocks(rawText) {
  return [...String(rawText || "").matchAll(/\{\{\s*cycling\s*result\s*start(?:\|title=([\s\S]*?))?\}\}([\s\S]*?)\{\{\s*cycling\s*result\s*end(?:[\s\S]*?)\}\}/gi)].map(
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

function parseStageSequence(value) {
  const cleaned = cleanWikiText(value);
  const normalized = normalizeSearchText(cleaned);
  const numberMatch = cleaned.match(/\d+/);

  if (/^p$|^prologue$/.test(normalized)) {
    return {
      stageNumber: 0,
      stageOrder: 0.5,
      stageLabel: "Prologue",
    };
  }

  if (numberMatch) {
    const stageNumber = Number(numberMatch[0]);
    return {
      stageNumber,
      stageOrder: stageNumber,
      stageLabel: `Stage ${stageNumber}`,
    };
  }

  return null;
}

function extractWikiTableByCaption(rawText, captionPattern) {
  return [...String(rawText || "").matchAll(/\{\|[\s\S]*?\n\|\}/g)].find((match) => {
    const caption = match[0].match(/\|\+\s*([^\n]+)/);
    return captionPattern.test(cleanWikiText(caption?.[1] || ""));
  })?.[0] || "";
}

function extractRouteStageWinners(rawText) {
  const routeTable = extractWikiTableByCaption(rawText, /^stage characteristics(?: and winners)?$/i);
  if (!routeTable) {
    return [];
  }

  return routeTable
    .split("\n|-\n")
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line === "|}") {
          continue;
        }

        if (line.startsWith("!")) {
          cells.push(line.replace(/^!\s*(?:scope="[^"]+"\s*\|\s*)?(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        } else if (line.startsWith("|")) {
          cells.push(line.replace(/^\|\s*(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        }
      }

      if (cells.length < 7) {
        return null;
      }

      const stageInfo = parseStageSequence(cells[0]);
      const winner = parseAthleteDetails(cells[cells.length - 1]);
      return stageInfo && winner.rider ? { ...stageInfo, winner } : null;
    })
    .filter(Boolean);
}

function extractStageLeadershipGcSnapshots(rawText) {
  const leadershipMatch = String(rawText || "").match(
    /==\s*Classification leadership table\s*==[\s\S]*?(\{\|[\s\S]*?\n\|\})/i,
  );
  const leadershipTable = leadershipMatch?.[1] || "";
  if (!leadershipTable) {
    return [];
  }

  return leadershipTable
    .split("\n|-\n")
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line === "|}") {
          continue;
        }

        if (line.startsWith("!")) {
          cells.push(line.replace(/^!\s*(?:scope="[^"]+"\s*\|\s*)?(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        } else if (line.startsWith("|")) {
          cells.push(line.replace(/^\|\s*(?:style="[^"]+"\s*\|\s*)?/, "").trim());
        }
      }

      if (cells.length < 3) {
        return null;
      }

      const stageInfo = parseStageSequence(cells[0]);
      const leader = parseAthleteDetails(cells[2]);
      if (!stageInfo || !leader.rider) {
        return null;
      }

      return {
        stageNumber: stageInfo.stageNumber,
        standings: [buildStandingEntry(1, leader)].filter(Boolean),
      };
    })
    .filter(Boolean);
}

function parseTotalStages(rawText) {
  const stagesField = getInfoboxField(rawText, "stages");
  if (!stagesField) {
    return 0;
  }

  const stageCount = Number.parseInt(stagesField.match(/\d+/)?.[0] || "0", 10) || 0;
  const hasPrologue = /\bprologue\b/i.test(stagesField);
  return stageCount + (hasPrologue ? 1 : 0);
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
  const leadershipGcResults = extractStageLeadershipGcSnapshots(rawText);
  const latestStage =
    [...stageResults]
      .map((entry) => ({
        ...entry,
        stageOrder: entry.stageNumber,
        stageLabel: `Stage ${entry.stageNumber}`,
      }))
      .sort((left, right) => right.stageOrder - left.stageOrder)[0] ||
    [...routeStageWinners]
      .sort((left, right) => right.stageOrder - left.stageOrder)
      .map((entry) => ({
        stageNumber: entry.stageNumber,
        stageOrder: entry.stageOrder,
        stageLabel: entry.stageLabel,
        standings: [buildStandingEntry(1, entry.winner)].filter(Boolean),
      }))[0] ||
    null;
  const latestGc =
    [...gcResults, ...leadershipGcResults].sort((left, right) => right.stageNumber - left.stageNumber)[0] || null;
  const totalStages = parseTotalStages(rawText);
  const prologueClassification =
    !latestGc && latestStage?.stageLabel === "Prologue" && latestStage.standings.length > 0
      ? {
          stageNumber: 0,
          standings: latestStage.standings,
          leader: latestStage.standings[0]?.rider || "",
        }
      : null;
  const finalStandings = ["first", "second", "third"]
    .map((fieldName, index) => buildStandingEntry(index + 1, parseAthleteDetails(getInfoboxField(rawText, fieldName))))
    .filter(Boolean);
  const overallResult = findOverallRaceResult(blocks);

  return {
    totalStages,
    completedStages: Math.max(
      latestGc?.stageNumber || 0,
      latestStage?.stageOrder || 0,
      routeStageWinners.reduce((max, entry) => Math.max(max, entry.stageOrder), 0),
      leadershipGcResults.reduce((max, entry) => Math.max(max, entry.stageNumber), 0),
    ),
    latestStage: latestStage
      ? {
          number: latestStage.stageNumber,
          label: latestStage.stageLabel,
          standings: latestStage.standings,
          winner: latestStage.standings[0]?.rider || "",
          ...(latestStage.standings[0]?.countryCode
            ? { winnerCountryCode: latestStage.standings[0].countryCode }
            : {}),
        }
      : null,
    generalClassification:
      latestGc || prologueClassification || finalStandings.length > 0
        ? {
            stageNumber: latestGc?.stageNumber ?? prologueClassification?.stageNumber ?? totalStages ?? 0,
            standings: latestGc?.standings || prologueClassification?.standings || finalStandings,
            leader: (latestGc?.standings || prologueClassification?.standings || finalStandings)[0]?.rider || "",
            ...((latestGc?.standings || prologueClassification?.standings || finalStandings)[0]?.countryCode
              ? {
                  leaderCountryCode:
                    (latestGc?.standings || prologueClassification?.standings || finalStandings)[0].countryCode,
                }
              : {}),
          }
        : null,
    overallResult: overallResult.length > 0 ? overallResult : finalStandings,
  };
}

function applyKnownStageRaceCorrections(race, snapshot) {
  if (!snapshot) {
    return snapshot;
  }

  if (race?.pageTitle === "2026 La Vuelta Femenina") {
    const correctedStageStandings = buildStandings([
      "Noemi Rüegg",
      "Lotte Kopecky",
      "Franziska Koch",
      "Katarzyna Niewiadoma-Phinney",
      "Maëva Squiban",
    ]);
    const correctedGcStandings = buildStandings([
      "Noemi Rüegg",
      "Franziska Koch",
      "Lotte Kopecky",
      "Loes Adegeest",
      "Katarzyna Niewiadoma-Phinney",
    ]);

    if ((snapshot.completedStages || 0) <= 1) {
      return {
        ...snapshot,
        totalStages: snapshot.totalStages || 7,
        completedStages: Math.max(snapshot.completedStages || 0, 1),
        latestStage: {
          number: 1,
          label: "Stage 1",
          standings: correctedStageStandings,
          winner: correctedStageStandings[0]?.rider || "",
        },
        generalClassification: {
          stageNumber: 1,
          standings: correctedGcStandings,
          leader: correctedGcStandings[0]?.rider || "",
        },
      };
    }

    return snapshot;
  }

  if (race?.pageTitle !== "2026 Tour de Romandie") {
    return snapshot;
  }

  const latestStageNumber = snapshot.latestStage?.number || 0;
  const gcStageNumber = snapshot.generalClassification?.stageNumber || 0;

  // On May 1, 2026, the Romandie page published Stage 3 results while repeating
  // the Stage 2 GC block. Patch that specific stale upstream state until the
  // source page catches up.
  if (latestStageNumber === 3 && gcStageNumber === 2) {
    const correctedStandings = [
      buildStandingEntry(1, "Tadej Pogačar"),
      buildStandingEntry(2, "Florian Lipowitz"),
      buildStandingEntry(3, "Lenny Martinez"),
      buildStandingEntry(4, "Jørgen Nordhagen"),
      buildStandingEntry(5, "Albert Withen Philipsen"),
    ].filter(Boolean);

    return {
      ...snapshot,
      completedStages: Math.max(snapshot.completedStages || 0, 3),
      generalClassification: {
        stageNumber: 3,
        standings: correctedStandings,
        leader: correctedStandings[0]?.rider || "",
      },
    };
  }

  return snapshot;
}

function getOfficialStageRaceSource(race) {
  if (race?.pageTitle === "2026 Tour de Romandie") {
    return "tour-de-romandie-prologue";
  }

  if (race?.pageTitle === "2026 La Vuelta Femenina") {
    return "la-vuelta-femenina-stage-1";
  }

  if (race?.pageTitle === "Grande Prémio Anicolor") {
    return "grande-premio-anicolor-live";
  }

  if (race?.pageTitle === "Vuelta Asturias") {
    return "vuelta-asturias";
  }

  return "";
}

function inferStageCountFromDates(race) {
  if (!isMultiDayRace(race)) {
    return 0;
  }

  const durationMs = race.endDate.getTime() - race.startDate.getTime();
  return Math.max(0, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);
}

function isSameUtcDay(left, right) {
  return (
    left instanceof Date &&
    right instanceof Date &&
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

async function fetchTourDeRomandieOfficialSnapshot(race) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (!isSameUtcDay(race?.startDate, todayUtc)) {
    return null;
  }

  const prologueStandings = [
    buildStandingEntry(1, "Dorian Godon"),
    buildStandingEntry(2, "Jakob Soderqvist"),
    buildStandingEntry(3, "Ivo Oliveira"),
    buildStandingEntry(4, "Mauro Schmid"),
    buildStandingEntry(5, "Axel Zingle"),
  ].filter(Boolean);

  return {
    totalStages: 6,
    completedStages: 0.5,
    latestStage: {
      number: 0,
      label: "Prologue",
      standings: prologueStandings,
      ...getWinnerDetails(prologueStandings),
    },
    generalClassification: {
      stageNumber: 0,
      standings: prologueStandings,
      ...getLeaderDetails(prologueStandings),
    },
    overallResult: [],
  };
}

async function fetchLaVueltaFemeninaOfficialSnapshot(race) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = new Date(Date.UTC(2026, 4, 3));
  const endUtc = new Date(Date.UTC(2026, 4, 4));

  if (
    race?.pageTitle !== "2026 La Vuelta Femenina" ||
    getRaceYear(race) !== 2026 ||
    todayUtc.getTime() < startUtc.getTime() ||
    todayUtc.getTime() > endUtc.getTime()
  ) {
    return null;
  }

  const stageOneStandings = buildStandings([
    "Noemi Rüegg",
    "Lotte Kopecky",
    "Franziska Koch",
    "Katarzyna Niewiadoma-Phinney",
    "Maëva Squiban",
  ]);
  const gcStandings = buildStandings([
    "Noemi Rüegg",
    "Franziska Koch",
    "Lotte Kopecky",
    "Loes Adegeest",
    "Katarzyna Niewiadoma-Phinney",
  ]);

  return {
    totalStages: 7,
    completedStages: 1,
    latestStage: {
      number: 1,
      label: "Stage 1",
      standings: stageOneStandings,
      ...getWinnerDetails(stageOneStandings),
    },
    generalClassification: {
      stageNumber: 1,
      standings: gcStandings,
      ...getLeaderDetails(gcStandings),
    },
    overallResult: [],
  };
}

async function fetchGrandePremioAnicolorLiveSnapshot(race) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = new Date(Date.UTC(2026, 4, 1));
  const endUtc = new Date(Date.UTC(2026, 4, 2));

  if (
    race?.pageTitle !== "Grande Prémio Anicolor" ||
    getRaceYear(race) !== 2026 ||
    todayUtc.getTime() < startUtc.getTime() ||
    todayUtc.getTime() > endUtc.getTime()
  ) {
    return null;
  }

  const stageOneStandings = buildStandings([
    "Tiago Antunes",
    "Xabier Berasategi",
    "Diogo Gonçalves",
    "Gotzon Martín",
    "Gonçalo Carvalho",
  ]);

  return {
    totalStages: inferStageCountFromDates(race) || 3,
    completedStages: 1,
    latestStage: {
      number: 1,
      label: "Stage 1",
      standings: stageOneStandings,
      ...getWinnerDetails(stageOneStandings),
    },
    generalClassification: {
      stageNumber: 1,
      standings: stageOneStandings,
      ...getLeaderDetails(stageOneStandings),
    },
    overallResult: [],
  };
}

function parseSpanishStageNumber(text) {
  const normalized = normalizeSearchText(text);
  const digitMatch = normalized.match(/\betapa\s+(\d+)\b/);
  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  const stageWords = [
    ["primera etapa", 1],
    ["segunda etapa", 2],
    ["tercera etapa", 3],
    ["cuarta etapa", 4],
    ["quinta etapa", 5],
    ["sexta etapa", 6],
  ];

  for (const [pattern, stageNumber] of stageWords) {
    const flexiblePattern = pattern.replace(/\s+/g, "\\s+(?:y\\s+[a-záéíóúñü]+\\s+)?");
    if (new RegExp(`\\b${flexiblePattern}\\b`, "u").test(normalized)) {
      return stageNumber;
    }
  }

  if (/\barranque\b/.test(normalized)) {
    return 1;
  }

  return 0;
}

function buildStandingEntry(place, rider, countryCode = "") {
  const details =
    rider && typeof rider === "object"
      ? {
          rider: String(rider.rider || "").trim(),
          countryCode: normalizeCountryCode(rider.countryCode || getRiderCountryCode(rider.rider)),
        }
      : {
          rider: String(rider || "").trim(),
          countryCode: normalizeCountryCode(countryCode || getRiderCountryCode(rider)),
        };

  return details.rider
    ? {
        place: String(place),
        rider: details.rider,
        ...(details.countryCode ? { countryCode: details.countryCode } : {}),
      }
    : null;
}

function buildStandings(riders) {
  return riders.map((rider, index) => buildStandingEntry(index + 1, rider)).filter(Boolean);
}

function getWinnerDetails(standings) {
  return {
    winner: standings?.[0]?.rider || "",
    ...(standings?.[0]?.countryCode ? { winnerCountryCode: standings[0].countryCode } : {}),
  };
}

function getLeaderDetails(standings) {
  return {
    leader: standings?.[0]?.rider || "",
    ...(standings?.[0]?.countryCode ? { leaderCountryCode: standings[0].countryCode } : {}),
  };
}

const STATIC_STAGE_RACE_SNAPSHOTS = {
  "2026 Tour de Romandie": {
    totalStages: 6,
    completedStages: 6,
    latestStage: {
      number: 5,
      label: "Stage 5",
      standings: buildStandings([
        "Tadej Pogačar",
        "Florian Lipowitz",
        "Primož Roglič",
        "Lorenzo Fortunato",
        "Jørgen Nordhagen",
      ]),
    },
    generalClassification: {
      stageNumber: 5,
      standings: buildStandings([
        "Tadej Pogačar",
        "Florian Lipowitz",
        "Lenny Martinez",
        "Jørgen Nordhagen",
        "Luke Plapp",
      ]),
    },
  },
  "2026 Tour de la Provence": {
    totalStages: 3,
    completedStages: 3,
    latestStage: {
      number: 3,
      label: "Stage 3",
      standings: buildStandings([
        "Axel Laurance",
        "Maxime Jarnet",
        "Lorenzo Manzin",
        "Victor Loulergue",
        "Simon Carr",
      ]),
    },
    generalClassification: {
      stageNumber: 3,
      standings: buildStandings([
        "Matthew Riccitello",
        "Carlos Rodríguez Cano",
        "Brandon Smith Rivera Vargas",
        "Aurélien Paret-Peintre",
        "Clément Champoussin",
      ]),
    },
  },
  "Giro di Sardegna": {
    totalStages: 5,
    completedStages: 5,
    latestStage: {
      number: 5,
      label: "Stage 5",
      standings: buildStandings([
        "Davide Donati",
        "Davide Persico",
        "Tilen Finkšt",
        "Kristian Egholm",
        "Manuel Peñalver",
      ]),
    },
    generalClassification: {
      stageNumber: 5,
      standings: buildStandings([
        "Filippo Zana",
        "Gianmarco Garofoli",
        "Alessandro Verre",
        "Urko Berrade Fernández",
        "Ibon Ruiz Sedano",
      ]),
    },
  },
  "Settimana Internazionale di Coppi e Bartali": {
    totalStages: 5,
    completedStages: 5,
    latestStage: {
      number: 5,
      label: "Stage 5",
      standings: buildStandings([
        "Mauro Schmid",
        "Axel Laurance",
        "Alan Hatherly",
        "Giovanni Aleotti",
        "Matteo Fabbro",
      ]),
    },
    generalClassification: {
      stageNumber: 5,
      standings: buildStandings([
        "Mauro Schmid",
        "Axel Laurance",
        "Alan Hatherly",
        "Thomas Pesenti",
        "Anton Schiffer",
      ]),
    },
  },
  "2026 O Gran Camiño": {
    totalStages: 5,
    completedStages: 5,
    latestStage: {
      number: 5,
      label: "Stage 5",
      standings: buildStandings([
        "Alessandro Pinarello",
        "Jørgen Nordhagen",
        "Adam Yates",
        "Iván Romeo Abad",
        "Txomin Juaristi Arrieta",
      ]),
    },
    generalClassification: {
      stageNumber: 5,
      standings: buildStandings([
        "Adam Yates",
        "Jørgen Nordhagen",
        "Alessandro Pinarello",
        "Abel Balderstone Roumens",
        "Iván Romeo Abad",
      ]),
    },
  },
  "Vuelta Asturias": {
    totalStages: 4,
    completedStages: 4,
    latestStage: {
      number: 4,
      label: "Stage 4",
      standings: buildStandings([
        "Edgar David Cadena",
        "Adrià Pericas",
        "José Manuel Díaz",
        "Nairo Quintana",
        "Txomin Juaristi",
      ]),
    },
    generalClassification: {
      stageNumber: 4,
      standings: buildStandings([
        "Nairo Quintana",
        "Adrià Pericas",
        "Diego Pescador",
        "Txomin Juaristi",
        "Samuel Fernández",
      ]),
    },
  },
};

function getStaticStageRaceSnapshot(race) {
  if (getRaceYear(race) !== 2026) {
    return null;
  }

  const snapshot = STATIC_STAGE_RACE_SNAPSHOTS[race?.pageTitle];
  if (!snapshot) {
    return null;
  }

  return {
    totalStages: snapshot.totalStages,
    completedStages: snapshot.completedStages,
    latestStage: snapshot.latestStage
      ? {
          ...snapshot.latestStage,
          ...getWinnerDetails(snapshot.latestStage.standings),
        }
      : null,
    generalClassification: snapshot.generalClassification
      ? {
          ...snapshot.generalClassification,
          ...getLeaderDetails(snapshot.generalClassification.standings),
        }
      : null,
    overallResult: snapshot.generalClassification?.standings || [],
  };
}

function toTitleCaseWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b([\p{L}])([\p{L}'’.-]*)/gu, (_, first, rest) => `${first.toUpperCase()}${rest}`);
}

function uniqueStandings(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    if (!entry?.rider) {
      return false;
    }

    const key = normalizeSearchText(entry.rider);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getMentionedRiderNames(text) {
  const matches = [...cleanFeedText(text).matchAll(/\b([A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+){1,2})\b/gu)];
  return [...new Set(matches.map((match) => cleanFeedText(match[1])).filter(Boolean))];
}

function resolveVueltaAsturiasRiderName(text, rawName) {
  const cleaned = cleanFeedText(rawName)
    .replace(/^(?:el|la)\s+/u, "")
    .replace(/^como\s+son\s+/u, "")
    .replace(/^(?:ciclista|corredor)(?:\s+[a-záéíóúñü]+){0,4}\s+/u, "")
    .replace(/\..*$/u, "")
    .replace(/\s+(?:que|y|fue|es|lleg(?:aron|aba)|por|sobre)\b.*$/u, "")
    .trim();

  if (!cleaned || /\b(?:vuelta|asturias)\b/iu.test(cleaned)) {
    return "";
  }

  if (cleaned.includes(" ")) {
    return cleaned;
  }

  const target = normalizeSearchText(cleaned);
  const mentionedNames = getMentionedRiderNames(text);
  const exactLastNameMatch = mentionedNames.find((name) => normalizeSearchText(name.split(" ").slice(-1)[0]) === target);
  return exactLastNameMatch || cleaned;
}

function extractVueltaAsturiasWinner(text) {
  const namePattern = "([A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+(?:\\s+[A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+){0,3})";
  const patterns = [
    new RegExp(`${namePattern}\\s+fue el vencedor de la [a-z0-9ª ]*etapa`, "u"),
    new RegExp(`finaliz[oó] con la victoria(?: del [^,]+,)?\\s+${namePattern}`, "u"),
    new RegExp(`el m[aá]s r[aá]pido fue\\s+${namePattern}`, "u"),
    new RegExp(`victoria del corredor [^,]+,\\s+${namePattern}`, "u"),
    new RegExp(`${namePattern}\\s+repite victoria`, "u"),
    new RegExp(`${namePattern}\\s+se present[oó] en solitario en la meta[^.]*?victoria`, "u"),
  ];

  const cleanedText = cleanFeedText(text);

  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      return resolveVueltaAsturiasRiderName(cleanedText, match[1]);
    }
  }

  return "";
}

function extractVueltaAsturiasStageStandings(text) {
  const namePattern = "([A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+(?:\\s+[A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+){0,3})";
  const winner = extractVueltaAsturiasWinner(text);
  const standings = [];
  const cleanedText = cleanFeedText(text);

  if (winner) {
    standings.push(buildStandingEntry(1, winner));
  }

  const secondStagePattern = new RegExp(
    `aventajando con[^.]*?a\\s+${namePattern}[^.]*?que fue segundo y con[^.]*?sobre\\s+${namePattern}\\s+y\\s+${namePattern}`,
    "u",
  );
  const firstStagePattern = new RegExp(
    `por delante de\\s+${namePattern}\\s+siendo tercero(?: el [^,]+)?\\s+${namePattern}`,
    "u",
  );
  const finalStagePattern = new RegExp(
    `Tras la pelea por el p[oó]dium llegaban a meta\\s+${namePattern},\\s+${namePattern},\\s+${namePattern}\\s+y\\s+${namePattern}`,
    "u",
  );
  const fifthPlacePattern = new RegExp(`llegaba el asturiano\\s+${namePattern}`, "u");

  const secondStageMatch = cleanedText.match(secondStagePattern);
  if (secondStageMatch) {
    standings.push(buildStandingEntry(2, resolveVueltaAsturiasRiderName(cleanedText, secondStageMatch[1])));
    standings.push(buildStandingEntry(3, resolveVueltaAsturiasRiderName(cleanedText, secondStageMatch[2])));
    standings.push(buildStandingEntry(4, resolveVueltaAsturiasRiderName(cleanedText, secondStageMatch[3])));

    const fifthPlaceMatch = cleanedText.match(fifthPlacePattern);
    if (fifthPlaceMatch) {
      standings.push(buildStandingEntry(5, resolveVueltaAsturiasRiderName(cleanedText, fifthPlaceMatch[1])));
    }

    return uniqueStandings(standings);
  }

  const firstStageMatch = cleanedText.match(firstStagePattern);
  if (firstStageMatch) {
    standings.push(buildStandingEntry(2, resolveVueltaAsturiasRiderName(cleanedText, firstStageMatch[1])));
    standings.push(buildStandingEntry(3, resolveVueltaAsturiasRiderName(cleanedText, firstStageMatch[2])));
    return uniqueStandings(standings);
  }

  const finalStageMatch = cleanedText.match(finalStagePattern);
  if (finalStageMatch) {
    standings.push(buildStandingEntry(2, resolveVueltaAsturiasRiderName(cleanedText, finalStageMatch[1])));
    standings.push(buildStandingEntry(3, resolveVueltaAsturiasRiderName(cleanedText, finalStageMatch[2])));
    standings.push(buildStandingEntry(4, resolveVueltaAsturiasRiderName(cleanedText, finalStageMatch[3])));
    standings.push(buildStandingEntry(5, resolveVueltaAsturiasRiderName(cleanedText, finalStageMatch[4])));
    return uniqueStandings(standings);
  }

  return uniqueStandings(standings);
}

function extractVueltaAsturiasOverallWinner(text, fallbackLeader) {
  const namePattern = "([A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+(?:\\s+[A-ZÁÉÍÓÚÑÜ][\\p{L}'’.-]+){0,3})";
  const cleanedText = cleanFeedText(text);
  const patterns = [
    new RegExp(`${namePattern}[^.]*?ha conseguido la victoria absoluta`, "u"),
    new RegExp(`${namePattern}\\s+gana su tercera Vuelta Asturias`, "u"),
    new RegExp(`Con esta victoria\\s+${namePattern}\\s+se convierte`, "u"),
  ];

  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      return resolveVueltaAsturiasRiderName(cleanedText, match[1]);
    }
  }

  return fallbackLeader;
}

function extractVueltaAsturiasGcStandings(text, fallbackLeader) {
  const cleanedText = cleanFeedText(text);
  const overallWinner = extractVueltaAsturiasOverallWinner(cleanedText, fallbackLeader);
  const leaderSentenceMatch = cleanedText.match(/Tras la etapa de hoy\s+([^.]*)\./u);
  if (leaderSentenceMatch) {
    const leaderSegment = leaderSentenceMatch[1];
    const [leaderPart, trailingPart = ""] = leaderSegment.split(", por delante de ");
    const leaderName = leaderPart.replace(/\s+es el nuevo l[íi]der$/u, "").trim();
    const trailingNames = trailingPart
      .split(/\s+y\s+/u)
      .map((name) => resolveVueltaAsturiasRiderName(cleanedText, name))
      .filter(Boolean)
      .slice(0, 2);
    return uniqueStandings([
      buildStandingEntry(1, resolveVueltaAsturiasRiderName(cleanedText, leaderName || overallWinner)),
      buildStandingEntry(2, trailingNames[0]),
      buildStandingEntry(3, trailingNames[1]),
    ]);
  }

  const finalPodiumMatch = cleanedText.match(
    /le acompa[ñn]aron en el p[oó]dium[^.]*?([A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+){0,3})\s+y\s+([A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\p{L}'’.-]+){0,3})\s+segundo y tercer clasificados/iu,
  );
  if (finalPodiumMatch) {
    return uniqueStandings([
      buildStandingEntry(1, overallWinner),
      buildStandingEntry(2, resolveVueltaAsturiasRiderName(cleanedText, finalPodiumMatch[1])),
      buildStandingEntry(3, resolveVueltaAsturiasRiderName(cleanedText, finalPodiumMatch[2])),
    ]);
  }

  return uniqueStandings([buildStandingEntry(1, overallWinner)]);
}

async function fetchVueltaAsturiasOfficialSnapshot(race) {
  const raceYear = getRaceYear(race);
  const raceWindowStart = race?.startDate instanceof Date ? race.startDate.getTime() - 14 * 24 * 60 * 60 * 1000 : 0;
  const raceWindowEnd = race?.endDate instanceof Date ? race.endDate.getTime() + 2 * 24 * 60 * 60 * 1000 : Number.POSITIVE_INFINITY;
  const params = new URLSearchParams({
    search: "Vuelta Asturias",
    per_page: "8",
    _fields: "id,date,link,title,content,excerpt",
  });
  const posts = await fetchJson(`https://lavueltaasturias.com/wp-json/wp/v2/posts?${params.toString()}`);
  const stagePosts = (Array.isArray(posts) ? posts : [])
    .map((post) => {
      const title = cleanFeedText(post?.title?.rendered || "");
      const content = cleanFeedText(post?.content?.rendered || post?.excerpt?.rendered || "");
      const combinedText = [title, content].join(" ").trim();

      return {
        title,
        content,
        combinedText,
        stageNumber: parseSpanishStageNumber(combinedText),
        publishedAt: post?.date ? new Date(post.date).getTime() : 0,
        publishedYear: post?.date ? new Date(post.date).getUTCFullYear() : 0,
      };
    })
    .filter(
      (post) =>
        post.stageNumber > 0 &&
        /\bvuelta(?:\s+a)?\s+asturias\b/i.test(normalizeSearchText(post.combinedText)) &&
        (!raceYear || post.publishedYear === raceYear) &&
        post.publishedAt >= raceWindowStart &&
        post.publishedAt <= raceWindowEnd,
    )
    .sort((left, right) => {
      if (left.stageNumber !== right.stageNumber) {
        return right.stageNumber - left.stageNumber;
      }

      return right.publishedAt - left.publishedAt;
    });

  const latestStagePost = stagePosts[0] || null;
  if (!latestStagePost) {
    return null;
  }

  const stageStandings = extractVueltaAsturiasStageStandings(latestStagePost.combinedText);
  const winner = stageStandings[0]?.rider || extractVueltaAsturiasWinner(latestStagePost.combinedText);
  const gcStandings = extractVueltaAsturiasGcStandings(latestStagePost.combinedText, winner);
  const totalStages = inferStageCountFromDates(race);

  return {
    totalStages,
    completedStages: latestStagePost.stageNumber,
    latestStage: winner
      ? {
          number: latestStagePost.stageNumber,
          standings: stageStandings.length > 0 ? stageStandings : [buildStandingEntry(1, winner)].filter(Boolean),
          ...getWinnerDetails(stageStandings.length > 0 ? stageStandings : [buildStandingEntry(1, winner)].filter(Boolean)),
        }
      : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber: latestStagePost.stageNumber,
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function loadOfficialStageRaceSnapshot(race) {
  const staticSnapshot = getStaticStageRaceSnapshot(race);
  if (staticSnapshot) {
    return staticSnapshot;
  }

  switch (getOfficialStageRaceSource(race)) {
    case "tour-de-romandie-prologue":
      return fetchTourDeRomandieOfficialSnapshot(race);
    case "la-vuelta-femenina-stage-1":
      return fetchLaVueltaFemeninaOfficialSnapshot(race);
    case "grande-premio-anicolor-live":
      return fetchGrandePremioAnicolorLiveSnapshot(race);
    case "vuelta-asturias":
      return fetchVueltaAsturiasOfficialSnapshot(race);
    default:
      return null;
  }
}

function getOfficialOneDayResultSource(race) {
  if (race?.pageTitle === "2026 Eschborn–Frankfurt") {
    return "eschborn-frankfurt";
  }

  return "";
}

function parseEschbornFrankfurtOfficialStandings(html) {
  const tbodyMatch = String(html || "").match(/<table class="rankingTable[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  return [...tbodyMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const row = match[1];
      const placeMatch = row.match(/<td class="is-alignCenter">(\d+)<\/td>/i);
      const riderMatch = row.match(/<td class="runner[^"]*"[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/i);
      const place = Number.parseInt(placeMatch?.[1] || "", 10);
      const rider = toTitleCaseWords(cleanFeedText(riderMatch?.[1] || ""));
      return Number.isInteger(place) ? buildStandingEntry(place, rider) : null;
    })
    .filter((entry) => entry && Number(entry.place) <= MAX_RESULT_RIDERS);
}

async function fetchEschbornFrankfurtOfficialStandings() {
  const html = await fetchText("https://www.eschborn-frankfurt.de/de/klassements");
  return parseEschbornFrankfurtOfficialStandings(html);
}

async function loadOfficialOneDayResultStandings(race) {
  switch (getOfficialOneDayResultSource(race)) {
    case "eschborn-frankfurt":
      return fetchEschbornFrankfurtOfficialStandings(race);
    default:
      return [];
  }
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
      return cleanLocationValue(match[1])
        .replace(/^(?:the\s+)?(?:[a-z]+\s+)?city of\s+/i, "")
        .replace(/^(?:the\s+)?city of\s+/i, "")
        .replace(/\bthe municipality of\s+/gi, "")
        .replace(/\bthe province of\s+/gi, "")
        .trim();
    }
  }

  return "";
}

function cleanLocationValue(value) {
  return cleanWikiText(String(value || ""))
    .replace(/\burl\s*=\s*\S+/gi, "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInfoboxLocation(rawText) {
  const match = rawText.match(/^\|\s*location\s*=\s*(.+)$/im);
  return match ? cleanLocationValue(match[1]) : "";
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

  return !/(\burl\s*=|\bhttps?:\/\/|\bwww\.|\?|organisers|announced|world tour|women's world tour|men's world tour|season|edition|race would be held|victory|attack|winner|podium|preview|report|results?|contenders?|calendar|\bgrand prix\b|\bgp\b|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(
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

function isOneDayRace(race) {
  return race?.startDate instanceof Date && race?.endDate instanceof Date && race.startDate.getTime() === race.endDate.getTime();
}

function selectUpcomingRaces(races, predicate, limit = MAX_UPCOMING_RACES) {
  return races.filter(predicate).slice(0, limit);
}

function isFinalizedStageRace(race) {
  return (
    (race?.stageRace?.completedStages || 0) > 0 &&
    (race?.stageRace?.totalStages || 0) > 0 &&
    (race.stageRace.completedStages || 0) >= (race.stageRace.totalStages || 0)
  );
}

async function enrichStageRaceSnapshots(races) {
  await Promise.all(
    races.map(async (race) => {
      if (!isMultiDayRace(race)) {
        return;
      }

      try {
        const officialSnapshot = await loadOfficialStageRaceSnapshot(race);
        if (officialSnapshot?.completedStages > 0) {
          race.stageRace = officialSnapshot;
          return;
        }

        const raw = await fetchWikiRaw(race.pageTitle);
        const snapshot = applyKnownStageRaceCorrections(race, extractStageRaceSnapshot(raw));

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
        const officialSnapshot = await loadOfficialStageRaceSnapshot(race);
        if (officialSnapshot?.completedStages > 0) {
          race.stageRace = officialSnapshot;
          race.resultStandings = selectStandings(
            officialSnapshot.generalClassification?.standings,
            officialSnapshot.overallResult,
          );
          return;
        }

        const officialOneDayStandings = await loadOfficialOneDayResultStandings(race);
        if (officialOneDayStandings.length > 0) {
          race.resultStandings = officialOneDayStandings;
          return;
        }

        const raw = await fetchWikiRaw(race.pageTitle);
        const snapshot = applyKnownStageRaceCorrections(race, extractStageRaceSnapshot(raw));

        if (snapshot.totalStages > 1 || snapshot.completedStages > 0) {
          race.stageRace = snapshot;
          race.resultStandings = selectStandings(snapshot.generalClassification?.standings, snapshot.overallResult);
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

function extractFirstXmlTag(block, tagNames) {
  for (const tagName of tagNames) {
    const value = extractXmlTag(block, tagName);
    if (value) {
      return value;
    }
  }

  return "";
}

function buildRaceArticleQueries(race) {
  const raceYear = getRaceYear(race);
  const variants = getRaceArticleVariants(race).slice(0, 8);

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
  const variants = getRaceArticleVariants(race).map((variant) => normalizeSearchText(variant));
  const raceTokens = getRaceTokens(race);
  const tokenMatches = raceTokens.filter((token) => combinedText.includes(token)).length;
  const division = getRaceDivision(race);
  const mentionsExactVariant = variants.some((variant) => variant && combinedText.includes(variant));
  const mentionsWomenVariant = variants.some(
    (variant) => variant && hasWomenMarker(variant) && combinedText.includes(variant),
  );

  if (division === "women") {
    if (!hasWomenMarker(combinedText) && !mentionsWomenVariant) {
      return false;
    }
  }

  if (division === "men" && hasWomenMarker(combinedText) && !hasMenMarker(combinedText)) {
    return false;
  }

  if (division === "women") {
    return mentionsWomenVariant || (hasWomenMarker(combinedText) && tokenMatches >= Math.min(2, raceTokens.length));
  }

  return mentionsExactVariant || tokenMatches >= Math.min(2, raceTokens.length);
}

function isCurrentEditionRaceArticle(article, race) {
  const raceYear = getRaceYear(race);
  const combinedText = normalizeSearchText([article.title, article.description].join(" "));
  const articleTime = article.publishedAt ? new Date(article.publishedAt).getTime() : 0;

  if (raceYear) {
    const mentionedYears = extractMentionedYears([article.title, article.description].join(" "));
    if (mentionedYears.length > 0 && !mentionedYears.includes(raceYear)) {
      return false;
    }
  }

  if (!articleTime) {
    return !raceYear || combinedText.includes(String(raceYear));
  }

  if (raceYear && new Date(articleTime).getUTCFullYear() !== raceYear) {
    return false;
  }

  if (!(race?.startDate instanceof Date) || !(race?.endDate instanceof Date)) {
    return true;
  }

  const earliestAllowed = race.startDate.getTime() - 30 * 24 * 60 * 60 * 1000;
  const latestAllowed = race.endDate.getTime() + 10 * 24 * 60 * 60 * 1000;
  return articleTime >= earliestAllowed && articleTime <= latestAllowed;
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

function normalizeArticlePublisher(publisher) {
  return cleanFeedText(publisher)
    .replace(/\s+on\s+msn$/i, "")
    .trim();
}

function normalizeArticleUrl(rawUrl) {
  const cleanedUrl = cleanFeedText(rawUrl);

  if (!cleanedUrl) {
    return "";
  }

  try {
    const parsed = new URL(cleanedUrl);

    if (/(\.|^)bing\.com$/i.test(parsed.hostname) && /\/news\/apiclick\.aspx$/i.test(parsed.pathname)) {
      const targetUrl = parsed.searchParams.get("url");
      if (targetUrl) {
        return cleanFeedText(targetUrl);
      }
    }

    return parsed.toString();
  } catch {
    return cleanedUrl;
  }
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
  const rawPublisher = extractFirstXmlTag(block, ["News:Source", "source"]);
  const publisher = normalizeArticlePublisher(rawPublisher) || "News source";
  const title = normalizeArticleTitle(extractXmlTag(block, "title"), publisher);
  const description = cleanFeedText(extractXmlTag(block, "description"));
  const url = normalizeArticleUrl(extractXmlTag(block, "link"));
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

async function fetchNewsFeed(query) {
  const params = new URLSearchParams({
    q: query,
    format: "rss",
  });

  return fetchText(`https://www.bing.com/news/search?${params.toString()}`);
}

async function fetchRaceArticles(race) {
  const queries = buildRaceArticleQueries(race);
  const xmlFeeds = await Promise.all(
    queries.map(async (query) => {
      try {
        return await fetchNewsFeed(query);
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
    .filter((article) => isCurrentEditionRaceArticle(article, race))
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

    const recentOneDayResults = allRaces
      .filter((race) => race.winner && race.endDate && race.endDate <= todayUtc)
      .filter(isOneDayRace)
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, MAX_RECENT_RESULTS);

    const finalizedStageCandidates = allRaces
      .filter(
        (race) =>
          isMultiDayRace(race) &&
          race.endDate &&
          race.endDate <= todayUtc &&
          race.series !== "Men's Europe Tour",
      )
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, MAX_RECENT_RESULTS);

    const liveStageCandidates = allRaces
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
      .sort((left, right) => left.startDate - right.startDate);

    const europeTourRaces = allRaces.filter((race) => race.series === "Men's Europe Tour");
    const europeTourRecentResults = europeTourRaces
      .filter((race) => isMultiDayRace(race) && race.winner && race.endDate && race.endDate <= todayUtc)
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, MAX_EUROPE_TOUR_RESULTS);
    const europeTourLiveStageRaces = europeTourRaces
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
    const europeTourUpcomingRaces = europeTourRaces
      .filter((race) => isMultiDayRace(race) && race.startDate && race.startDate > todayUtc)
      .sort((left, right) => left.startDate - right.startDate)
      .slice(0, MAX_EUROPE_TOUR_UPCOMING);

    const upcomingDisplayRaces = [
      ...selectUpcomingRaces(upcomingRaces, (race) => race.series === "Men's WorldTour"),
      ...selectUpcomingRaces(upcomingRaces, (race) => race.series === "Women's WorldTour"),
      ...selectUpcomingRaces(upcomingRaces, (race) => /ProSeries/.test(race.series)),
    ];

    const displayRaces = [
      ...recentOneDayResults,
      ...finalizedStageCandidates,
      ...liveStageCandidates,
      ...upcomingDisplayRaces,
      ...europeTourRecentResults,
      ...europeTourLiveStageRaces,
      ...europeTourUpcomingRaces,
    ];
    const stageRaceDisplays = [...liveStageCandidates, ...europeTourRecentResults, ...europeTourLiveStageRaces].filter(
      isMultiDayRace,
    );

    await enrichLocations(displayRaces);
    await enrichRecentResultStandings(recentOneDayResults);
    await enrichRecentResultStandings(finalizedStageCandidates);
    await enrichStageRaceSnapshots(stageRaceDisplays);

    const finalizedStageRaces = finalizedStageCandidates.filter(isFinalizedStageRace);
    const liveStageRaces = liveStageCandidates.filter((race) => !isFinalizedStageRace(race));
    const recentResults = [...recentOneDayResults, ...finalizedStageRaces].sort((left, right) => right.endDate - left.endDate);

    finalizedStageRaces.forEach((race) => {
      if (!race.resultStandings?.length) {
        race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
      }
    });

    europeTourRecentResults.forEach((race) => {
      if (!race.resultStandings?.length) {
        race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
      }
    });

    [
      ...recentResults,
      ...liveStageRaces,
      ...upcomingRaces,
      ...europeTourRecentResults,
      ...europeTourLiveStageRaces,
      ...europeTourUpcomingRaces,
    ].forEach((race) => {
      race.finishedToday = Boolean(race.endDate && race.endDate.getTime() === todayUtc.getTime());
    });

    recentOneDayResults.forEach((race) => {
      race.id = getRaceId(race);
    });

    finalizedStageRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    liveStageRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    upcomingRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    europeTourRecentResults.forEach((race) => {
      race.id = getRaceId(race);
    });

    europeTourLiveStageRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    europeTourUpcomingRaces.forEach((race) => {
      race.id = getRaceId(race);
    });

    const data = {
      fetchedAt: new Date().toISOString(),
      recentResults,
      finalizedStageRaces,
      liveStageRaces,
      upcomingRaces,
      europeTourRecentResults,
      europeTourLiveStageRaces,
      europeTourUpcomingRaces,
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
          ${buildRiderMarkup(entry)}
        </li>`,
    )
    .join("");

  return podium ? `<ol class="podium-list">${podium}</ol>` : `<p class="meta">Result details are still being updated.</p>`;
}

function getRaceFinishVideoUrl(race) {
  return RACE_FINISH_VIDEO_URLS[getRaceId(race)] || "";
}

function buildRaceFinishLink(race) {
  const url = getRaceFinishVideoUrl(race);
  if (!url) {
    return "";
  }

  return `
    <a class="race-finish-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
      Watch the race finish
    </a>`;
}

function selectStandings(...candidateLists) {
  for (const candidate of candidateLists) {
    if (Array.isArray(candidate) && candidate.some((entry) => entry?.rider)) {
      return candidate.filter((entry) => entry?.rider);
    }
  }

  return [];
}

function buildStageRaceCard(race, options = {}) {
  const latestStage = race.stageRace?.latestStage || null;
  const classification = race.stageRace?.generalClassification || null;
  const isFinalized = isFinalizedStageRace(race);
  const hasCurrentGcSnapshot =
    options.live ||
    ((race.stageRace?.completedStages || 0) > 0 &&
      (race.stageRace?.totalStages || 0) > 0 &&
      (race.stageRace.completedStages || 0) < (race.stageRace.totalStages || 0));
  const stageLabel = latestStage?.label || (latestStage?.number ? `Stage ${latestStage.number}` : "Latest stage");
  const isPrologueClassification = classification?.stageNumber === 0 || latestStage?.label === "Prologue";
  const fallbackPodium = [
    { place: "1", rider: race.winner, countryCode: race.winnerCountryCode },
    { place: "2", rider: race.second, countryCode: race.secondCountryCode },
    { place: "3", rider: race.third, countryCode: race.thirdCountryCode },
  ].filter((entry) => entry.rider);
  const classificationLabel = isFinalized
    ? "Final general classification"
    : isPrologueClassification && hasCurrentGcSnapshot
      ? "Overall after prologue"
      : classification?.stageNumber && hasCurrentGcSnapshot
      ? `Overall after stage ${classification.stageNumber}`
      : "Overall classification";
  const stageStandings = selectStandings(latestStage?.standings);
  const gcStandings = selectStandings(
    classification?.standings,
    race.resultStandings,
    race.stageRace?.overallResult,
    fallbackPodium,
  );
  const totalStagesLabel =
    (race.stageRace?.totalStages || 0) > 0
      ? `All ${race.stageRace.totalStages} stages ${race.finishedToday ? "were completed today." : "are complete."}`
      : race.finishedToday
        ? "The race finished today."
        : "Final standings are now available.";
  const statusBadge = options.live
    ? `<span class="status-pill">Live stage race</span>`
    : isFinalized
      ? `<span class="status-pill status-pill-finished">${escapeHtml(race.finishedToday ? "Finished today" : "Final stage race")}</span>`
      : "";
  const statusNote = options.live
    ? `<p class="stage-status-note">Live classifications refresh as stage and GC data become available.</p>`
    : isFinalized
      ? `<p class="stage-status-note">${escapeHtml(totalStagesLabel)}</p>`
      : "";
  const stageContent = latestStage?.winner
    ? `
      <div class="card-subsection">
        <div class="detail-label">${escapeHtml(stageLabel)} winner</div>
        <div class="stage-winner">${buildRiderMarkup(
          {
            rider: latestStage.winner,
            countryCode: latestStage.winnerCountryCode,
          },
          "stage-winner-rider",
        )}</div>
        ${buildPodiumMarkup(stageStandings)}
        ${buildRaceFinishLink(race)}
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
  const orderedContent = isFinalized
    ? `${gcContent}${stageContent}`
    : `${stageContent}${gcContent}`;

  return `
    <article class="card result-card stage-race-card">
      <div class="card-kicker">${escapeHtml(race.series)} ${statusBadge}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${statusNote}
      ${orderedContent}
    </article>`;
}

function buildRaceCard(race) {
  if (race.stageRace) {
    return buildStageRaceCard(race);
  }

  const standings = selectStandings(
    race.resultStandings,
    [
      { place: "1", rider: race.winner, countryCode: race.winnerCountryCode },
      { place: "2", rider: race.second, countryCode: race.secondCountryCode },
      { place: "3", rider: race.third, countryCode: race.thirdCountryCode },
    ],
  );

  return `
    <article class="card result-card">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${buildPodiumMarkup(standings)}
      ${buildRaceFinishLink(race)}
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

function getCountryFlagEmoji(countryCode) {
  const alpha2Code = COUNTRY_FLAG_CODES[normalizeCountryCode(countryCode)];
  if (!/^[A-Z]{2}$/.test(alpha2Code || "")) {
    return "";
  }

  return [...alpha2Code]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function buildRiderMarkup(entry, className = "podium-rider") {
  const rider = String(entry?.rider || "").trim();
  if (!rider) {
    return "";
  }

  const countryCode = normalizeCountryCode(entry?.countryCode);
  const flag = getCountryFlagEmoji(countryCode);
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const flagMarkup = flag
    ? `<span class="country-flag" title="${escapeHtml(countryName)}" aria-hidden="true">${escapeHtml(flag)}</span>`
    : "";

  return `<span class="${escapeHtml(className)} rider-name">${flagMarkup}<span>${escapeHtml(rider)}</span></span>`;
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
      recentSource: "recentResults",
      recentResultsLimit: WORLDTOUR_RECENT_RESULTS,
      recentBlockTitle: "Recent Results",
      recentBlockDescription: "Recent one-day races and finalized stage races, arranged in a three-column grid on larger screens.",
      recentGridClass: "competition-grid-three",
    },
    {
      id: "womens-worldtour",
      label: "Women's WorldTour",
      tag: "Top Tier Women",
      description: "Live stage races, latest results, and upcoming events from the women's WorldTour calendar.",
      predicate: (race) => race.series === "Women's WorldTour",
      recentSource: "recentResults",
      recentResultsLimit: WORLDTOUR_RECENT_RESULTS,
      recentBlockTitle: "Recent Results",
      recentBlockDescription: "Recent one-day races and finalized stage races, arranged in a three-column grid on larger screens.",
      recentGridClass: "competition-grid-three",
    },
    {
      id: "proseries",
      label: "UCI ProSeries",
      tag: "Expanded Calendar",
      description: "The ProSeries races added today, with live stage races, fresh results, and upcoming events.",
      predicate: (race) => /ProSeries/.test(race.series),
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
      predicate: (race) => race.series === "Men's Europe Tour",
      liveSource: "europeTourLiveStageRaces",
      recentSource: "europeTourRecentResults",
      upcomingSource: "europeTourUpcomingRaces",
      recentBlockTitle: "Recent Stage Race Results",
      recentBlockDescription: "Finalized multi-stage results from the selected Europe Tour races.",
    },
  ];

  return definitions.map((definition) => ({
    ...definition,
    liveStageRaces: (data[definition.liveSource || "liveStageRaces"] || []).filter(definition.predicate),
    recentResults: (data[definition.recentSource || "recentResults"] || [])
      .filter(definition.predicate)
      .slice(0, definition.recentResultsLimit || MAX_RECENT_RESULTS),
    upcomingRaces: (data[definition.upcomingSource || "upcomingRaces"] || [])
      .filter(definition.predicate)
      .slice(0, definition.upcomingRacesLimit || MAX_UPCOMING_RACES),
  }));
}

function buildCompetitionBlock(title, description, markup, options = {}) {
  if (!markup) {
    return "";
  }

  const gridClass = options.gridClass ? `grid competition-grid ${options.gridClass}` : "grid competition-grid";

  return `
    <div class="competition-block">
      <div class="competition-block-head">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="${gridClass}">${markup}</div>
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
    buildCompetitionBlock("Live Multi-Stage", "Current stage races and overall standings.", liveMarkup),
    buildCompetitionBlock(
      group.recentBlockTitle || "Recent Results",
      group.recentBlockDescription || "Most recent finalized races and classifications.",
      recentMarkup,
      { gridClass: group.recentGridClass || "" },
    ),
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
  const competitionGroups = getCompetitionGroups(data);
  const competitionSections = competitionGroups
    .map((group) => buildCompetitionSection(group, view.coverageByGroup[group.id]))
    .filter(Boolean)
    .join("");
  const heroSubheader = [
    "TOP-FIVE RACE RESULTS",
    "UPCOMING RACE CALENDARS",
    "LATEST RACE NEWS",
    "FEATURED STAGE RACES",
  ].join(" • ");
  const heroMenu = competitionGroups
    .map(
      (group) => `
        <a class="hero-menu-link" href="#${escapeHtml(group.id)}">${escapeHtml(group.label)}</a>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pro Cycling Results" />
    <meta property="og:title" content="Pro Cycling Results" />
    <meta property="og:description" content="Live race standings, recent results, and news coverage for the 2026 UCI WorldTour, Women's WorldTour, ProSeries, and Europe Tour." />
    <meta property="og:url" content="https://procyclingresults.up.railway.app" />
    <meta property="og:image" content="https://procyclingresults.up.railway.app/assets/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="405" />
    <meta property="og:image:alt" content="Pro Cycling Results — Live UCI Race Coverage" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Pro Cycling Results" />
    <meta name="twitter:description" content="Live race standings, recent results, and news coverage for the 2026 UCI WorldTour, Women's WorldTour, ProSeries, and Europe Tour." />
    <meta name="twitter:image" content="https://procyclingresults.up.railway.app/assets/og-image.jpg" />
    <title>Pro Cycling Results</title>
    ${UMAMI_ANALYTICS_SCRIPT}
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

      .hero-subtitle {
        margin: 1rem 0 0;
        max-width: 42rem;
        color: rgba(255, 255, 255, 0.82);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        line-height: 1.55;
        text-transform: uppercase;
      }

      .updated {
        margin-top: 1.1rem;
        color: rgba(255, 255, 255, 0.76);
        font-size: 0.82rem;
      }

      .hero-menu {
        display: grid;
        gap: 0.8rem;
        align-content: end;
        grid-template-columns: 1fr;
        padding: 0.2rem 0 0.4rem;
      }

      .hero-menu-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3.4rem;
        padding: 0.9rem 1rem;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
        backdrop-filter: blur(14px);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        color: white;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-align: center;
        text-decoration: none;
        text-transform: uppercase;
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
      }

      .hero-menu-link:hover {
        transform: translateY(-1px);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.1));
        border-color: rgba(255, 255, 255, 0.24);
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

      .competition-grid-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
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

      .rider-name {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
      }

      .country-flag {
        flex: 0 0 auto;
        font-size: 0.95em;
        line-height: 1;
      }

      .race-finish-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 0.95rem;
        padding: 0.75rem 1rem;
        border-radius: 16px;
        border: 1px solid rgba(0, 120, 199, 0.2);
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.1), rgba(0, 51, 160, 0.18));
        color: var(--uci-blue-deep);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-decoration: none;
        text-transform: uppercase;
      }

      .race-finish-link:hover {
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.16), rgba(0, 51, 160, 0.26));
        color: var(--uci-blue);
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

      .stage-winner-rider {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
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

      .status-pill-finished {
        background: rgba(0, 71, 212, 0.12);
        color: var(--uci-blue-deep);
      }

      .stage-status-note {
        margin: 0.1rem 0 0;
        color: rgba(9, 33, 76, 0.72);
        font-size: 0.94rem;
        line-height: 1.45;
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

        .hero-menu {
          gap: 0.65rem;
          grid-template-columns: 1fr;
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

      @media (max-width: 960px) {
        .competition-grid-three {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .competition-grid-three {
          grid-template-columns: 1fr;
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
            <p class="hero-subtitle">${escapeHtml(heroSubheader)}</p>
            <div class="updated">Updated ${escapeHtml(formatTimestamp(data.fetchedAt))} Eastern Time</div>
          </div>
          <nav class="hero-menu" aria-label="Page sections">${heroMenu}</nav>
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
      `<!doctype html><meta charset='utf-8'><title>Forbidden</title>${UMAMI_ANALYTICS_SCRIPT}<h1>Forbidden</h1>`,
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
        `<!doctype html><meta charset='utf-8'><title>Not Found</title>${UMAMI_ANALYTICS_SCRIPT}<h1>Not Found</h1>`,
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
         ${UMAMI_ANALYTICS_SCRIPT}
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
