const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const STATIC_STAGE_RACE_SNAPSHOT_DATA = require(path.join(process.cwd(), "data", "static-stage-race-snapshots.json"));

const PORT = process.env.PORT || 3000;
// Railway injects the deployed commit, so /api/build-info can answer "what is live?"
// without anyone remembering to bump a constant. The hardcoded values remain as the
// local/dev fallback; `source` says which one you are looking at, because a stale
// marker that looks authoritative is worse than one that admits it is a fallback.
const BUILD_INFO = {
  marker: cleanFeedText(process.env.RAILWAY_GIT_COMMIT_MESSAGE || "").slice(0, 120) || "2026-06-02-giro-post-race-fix",
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || "fefa813").slice(0, 7),
  branch: process.env.RAILWAY_GIT_BRANCH || "",
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || "",
  source: process.env.RAILWAY_GIT_COMMIT_SHA ? "railway-env" : "hardcoded-fallback",
  node: process.version,
};
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
const WORLDTOUR_RECENT_RESULTS = 12;
// Recent results reveal in rows: WORLDTOUR_RECENT_RESULTS_STEP shown by default,
// with a "Load more races" button adding another row up to WORLDTOUR_RECENT_RESULTS.
const WORLDTOUR_RECENT_RESULTS_STEP = 3;
const PROSERIES_RECENT_RESULTS = 10;
const HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT = 6;
// YouTube finish-video lookups: found URLs are stable so they cache for hours,
// while "not found yet" misses re-check sooner so a video that is uploaded an hour
// after the finish still gets picked up. Lookups per build are capped and only run
// for recently finished races to bound cold-start cost.
const FINISH_VIDEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FINISH_VIDEO_MISS_CACHE_TTL_MS = 20 * 60 * 1000;
const FINISH_VIDEO_LOOKUP_LIMIT = 6;
// Earlier stages of a live race are resolved a few per refresh rather than all at once.
const STAGE_FINISH_VIDEO_LOOKUP_LIMIT = 4;
const FINISH_VIDEO_MAX_AGE_DAYS = 6;
// A plausible highlights runtime: long enough to be real coverage rather than a
// clip/Short, short enough to exclude full-stage replays and livestream VODs.
const FINISH_VIDEO_MIN_LENGTH_SECONDS = 2 * 60;
const FINISH_VIDEO_MAX_LENGTH_SECONDS = 20 * 60;
const DEFERRED_COMPETITION_GROUP_IDS = new Set();
const RETIRED_COMPETITION_GROUP_IDS = new Set(["proseries", "europe-tour"]);
const RACE_METADATA_CACHE_TTL_MS = 60 * 60 * 1000;
const LIVE_RACE_CACHE_TTL_MS = 60 * 1000;
const WIKI_FETCH_CONCURRENCY = 3;
const FETCH_RETRY_DELAYS_MS = [250, 750];
// Per-attempt request timeout. A hung upstream would otherwise stall a synchronous
// live-race rebuild indefinitely; a timed-out attempt is retried like any other
// transient failure and ultimately degrades to partial data in enrichment paths.
const FETCH_TIMEOUT_MS = 10 * 1000;
const NATIONAL_CHAMPIONSHIPS_SOURCE_URL =
  "https://www.cyclingnews.com/pro-cycling/racing/2026-road-national-champions-index/";
const NATIONAL_CHAMPIONSHIPS_SOURCE_LABEL = "Cyclingnews 2026 Road National Champions index";
const NATIONAL_CHAMPIONSHIP_EVENT_KEYS = ["meItt", "meRoadRace", "weItt", "weRoadRace"];
const NATIONAL_CHAMPIONSHIP_EVENT_LABELS = {
  meItt: "ME ITT",
  meRoadRace: "ME Road Race",
  weItt: "WE ITT",
  weRoadRace: "WE Road Race",
};
const NATIONAL_CHAMPIONSHIP_EVENT_GROUPS = {
  meItt: "Men's Elite Individual Time Trial",
  meRoadRace: "Men's Elite Road Race",
  weItt: "Women's Elite Individual Time Trial",
  weRoadRace: "Women's Elite Road Race",
};
const NATIONAL_CHAMPIONSHIP_FEATURED_COUNTRIES = [
  "United States",
  "Australia",
  "New Zealand",
  "Colombia",
  "South Africa",
  "Finland",
  "Bolivia",
  "Chile",
  "Ecuador",
  "Panama",
  "Uruguay",
  "United Arab Emirates",
  "Philippines",
  "Zimbabwe",
  "Thailand",
];
const NATIONAL_CHAMPION_NAME_CORRECTIONS = {
  "Artem Schmidt": "Artem Shmidt",
};
// Continent buckets for the National Championships almanac. Geographic rather than
// UCI confederation so the Americas split the way their championship windows do:
// South America mostly races in January and February, North America in late June.
// The hints are typical timing, not confirmed dates — the UI says "usually".
const SEASON_YEAR = 2026;
const NATIONAL_CHAMPIONSHIP_CONTINENTS = [
  { id: "europe", label: "Europe", hint: "Usually the last week of June" },
  { id: "north-america", label: "North & Central America", hint: "Usually late June" },
  { id: "south-america", label: "South America", hint: "Mostly January and February" },
  { id: "asia", label: "Asia", hint: "Spread across the year" },
  { id: "africa", label: "Africa", hint: "Spread across the year" },
  { id: "oceania", label: "Oceania", hint: "Usually January" },
];
const CONTINENT_BY_ALPHA2 = {
  AL: "europe", AT: "europe", BA: "europe", BE: "europe", BG: "europe", BY: "europe", CH: "europe",
  CY: "europe", CZ: "europe", DE: "europe", DK: "europe", EE: "europe", ES: "europe", FI: "europe",
  FR: "europe", GB: "europe", GR: "europe", HR: "europe", HU: "europe", IE: "europe", IS: "europe",
  IT: "europe", LT: "europe", LU: "europe", LV: "europe", ME: "europe", MK: "europe", MT: "europe",
  NL: "europe", NO: "europe", PL: "europe", PT: "europe", RO: "europe", RS: "europe", SE: "europe",
  SI: "europe", SK: "europe", TR: "europe", UA: "europe", XK: "europe",
  AE: "asia", AF: "asia", CN: "asia", HK: "asia", ID: "asia", IN: "asia", IR: "asia", JP: "asia",
  KR: "asia", KZ: "asia", LA: "asia", MN: "asia", MO: "asia", MY: "asia", PH: "asia", PK: "asia",
  SG: "asia", TH: "asia", UZ: "asia",
  BF: "africa", CM: "africa", CV: "africa", DZ: "africa", EG: "africa", ER: "africa", ET: "africa",
  KE: "africa", LS: "africa", MA: "africa", MU: "africa", NA: "africa", RW: "africa", TN: "africa",
  UG: "africa", ZA: "africa", ZW: "africa",
  AG: "north-america", BM: "north-america", BZ: "north-america", CA: "north-america", CR: "north-america",
  CU: "north-america", DO: "north-america", GD: "north-america", GT: "north-america", HN: "north-america",
  MX: "north-america", PA: "north-america", PR: "north-america", SV: "north-america", TT: "north-america",
  US: "north-america", VC: "north-america",
  AR: "south-america", BO: "south-america", BR: "south-america", CL: "south-america", CO: "south-america",
  EC: "south-america", PE: "south-america", PY: "south-america", UY: "south-america", VE: "south-america",
  AU: "oceania", NZ: "oceania",
};
// Windows drawn hatched on both calendar strips. They are schematic: the Cyclingnews
// index carries no dates, so confirmed dates come only from
// NATIONAL_CHAMPIONSHIP_EVENT_METADATA and these bands are labelled "typical".
const NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS = [
  { start: `${SEASON_YEAR}-01-05`, end: `${SEASON_YEAR}-02-20`, label: "Nationals · southern hemisphere" },
  { start: `${SEASON_YEAR}-06-18`, end: `${SEASON_YEAR}-06-29`, label: "Nationals week · Europe & N. America" },
];
const NATIONAL_CHAMPIONSHIP_TABLE_COLUMNS = [
  { key: "meRoadRace", label: "Men's road race", chip: "Men RR" },
  { key: "meItt", label: "Men's time trial", chip: "Men TT" },
  { key: "weRoadRace", label: "Women's road race", chip: "Women RR" },
  { key: "weItt", label: "Women's time trial", chip: "Women TT" },
];
// The season calendar emphasises a fixed, hand-curated set: three Grand Tours per
// series and the Monuments (with their women's editions). Everything else is drawn by
// duration only, so no other tier is invented.
const SEASON_CALENDAR_GRAND_TOURS = new Set([
  "Giro d'Italia",
  "Tour de France",
  "Vuelta a España",
  "Giro d'Italia Women",
  "Tour de France Femmes",
  "La Vuelta Femenina",
]);
const SEASON_CALENDAR_MONUMENTS = new Set([
  "Milan–San Remo",
  "Tour of Flanders",
  "Paris–Roubaix",
  "Liège–Bastogne–Liège",
  "Il Lombardia",
  "Milan–San Remo Women",
  "Paris–Roubaix Femmes",
  "Liège–Bastogne–Liège Femmes",
]);
const SEASON_CALENDAR_SERIES = [
  { id: "mens", label: "Men's WorldTour" },
  { id: "womens", label: "Women's WorldTour" },
];
const SEASON_DAY_MS = 24 * 60 * 60 * 1000;
const NATIONAL_CHAMPIONSHIP_EVENT_METADATA = {
  "United States": {
    meItt: {
      date: "2026-06-17",
      location: "Charleston, West Virginia",
      podium: ["Artem Shmidt", "Larry Warbasse", "William Barta"],
      sourceUrl:
        "https://www.cyclingnews.com/pro-cycling/racing/us-pro-national-championships-artem-shmidt-tops-larry-warbasse-in-elite-mens-time-trial/",
    },
    meRoadRace: {
      date: "2026-06-21",
      location: "Charleston, West Virginia",
      podium: ["Quinn Simmons"],
      finishVideoUrl: "https://www.youtube.com/watch?v=hSVSHs9lPPI",
    },
    weItt: {
      date: "2026-06-17",
      location: "Charleston, West Virginia",
      podium: ["Taylor Knibb", "Emily Ehrlich", "Paige Onweller"],
      sourceUrl:
        "https://www.cyclingweekly.com/news/taylor-knibb-artem-shmidt-win-time-trial-titles-on-opening-day-of-us-pro-road-nationals",
    },
    weRoadRace: {
      date: "2026-06-21",
      location: "Charleston, West Virginia",
      podium: ["Kate Courtney", "Lauren Stephens", "Grace Arlandson"],
      sourceUrl:
        "https://www.cyclingnews.com/pro-cycling/womens-cycling/us-road-championships-kate-courtney-outsprints-lauren-stephens-to-win/",
    },
  },
  "Great Britain": {
    meItt: {
      date: "2026-06-25",
      location: "Lampeter, Wales",
    },
    weItt: {
      date: "2026-06-25",
      location: "Lampeter, Wales",
    },
    meRoadRace: {
      date: "2026-06-28",
      location: "Aberystwyth, Wales",
    },
    weRoadRace: {
      date: "2026-06-28",
      location: "Aberystwyth, Wales",
    },
  },
};
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

// A three-week Grand Tour splits its stage results across two companion articles.
// Cap the lookups so a malformed route table can never fan out into many fetches
// against a rate-limited upstream.
const MAX_STAGE_ARTICLES = 3;
// Arbitrary token that survives template expansion so a batched request can be split
// back apart; anything wiki-meaningful would be mangled or expanded itself.
const TEAM_NAME_SEPARATOR = "@@PCR@@";

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
];

const ACTIVE_SEASONS = SEASONS;

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

const ALPHA2_TO_COUNTRY_CODE = new Map(
  Object.entries(COUNTRY_FLAG_CODES).map(([countryCode, alpha2Code]) => [alpha2Code, countryCode]),
);

// Country-name to ISO 3166-1 alpha-2, covering every federation in the Cyclingnews
// National Championships index (the rider flag table only covers ~50 race nations).
// Keys are lowercased; a few aliases cover alternate source spellings.
const COUNTRY_NAME_ALPHA2 = {
  afghanistan: "AF", albania: "AL", algeria: "DZ", "antigua and barbuda": "AG", argentina: "AR",
  australia: "AU", austria: "AT", belarus: "BY", belgium: "BE", belize: "BZ", bermuda: "BM",
  bolivia: "BO", "bosnia and herzegovina": "BA", brazil: "BR", bulgaria: "BG", "burkina faso": "BF",
  cameroon: "CM", canada: "CA", "cape verde": "CV", chile: "CL", china: "CN", colombia: "CO",
  "costa rica": "CR", croatia: "HR", cuba: "CU", cyprus: "CY", czechia: "CZ", "czech republic": "CZ",
  denmark: "DK", "dominican republic": "DO", ecuador: "EC", egypt: "EG", "el salvador": "SV",
  eritrea: "ER", estonia: "EE", ethiopia: "ET", finland: "FI", france: "FR", germany: "DE",
  "great britain": "GB", "united kingdom": "GB", greece: "GR", grenada: "GD", guatemala: "GT",
  honduras: "HN", "hong kong, china": "HK", "hong kong": "HK", hungary: "HU", iceland: "IS",
  india: "IN", indonesia: "ID", iran: "IR", ireland: "IE", italy: "IT", japan: "JP", kazakhstan: "KZ",
  kenya: "KE", korea: "KR", "south korea": "KR", kosovo: "XK", laos: "LA", latvia: "LV", lesotho: "LS",
  lithuania: "LT", luxembourg: "LU", macao: "MO", macau: "MO", malaysia: "MY", malta: "MT",
  mauritius: "MU", mexico: "MX", mongolia: "MN", montenegro: "ME", morocco: "MA", namibia: "NA",
  netherlands: "NL", "new zealand": "NZ", "north macedonia": "MK", norway: "NO", pakistan: "PK",
  panama: "PA", paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL", portugal: "PT",
  "puerto rico": "PR", romania: "RO", rwanda: "RW", "saint vincent and the grenadines": "VC",
  serbia: "RS", singapore: "SG", slovakia: "SK", slovenia: "SI", "south africa": "ZA", spain: "ES",
  sweden: "SE", switzerland: "CH", thailand: "TH", "trinidad and tobago": "TT", tunisia: "TN",
  "türkiye": "TR", turkiye: "TR", turkey: "TR", uganda: "UG", ukraine: "UA",
  "united arab emirates": "AE", "united states": "US", "united states of america": "US", usa: "US",
  uruguay: "UY", uzbekistan: "UZ", venezuela: "VE", zimbabwe: "ZW",
};

const RACE_FINISH_VIDEO_URLS = {
  "2026 Giro d'Italia": {
    1: "https://www.youtube.com/watch?v=k9etTDahUFo",
    2: "https://video.giroditalia.it/video/126977539",
    3: "https://video.giroditalia.it/video/126996326",
    4: "https://video.giroditalia.it/video/127117045",
    5: "https://video.giroditalia.it/video/127169105",
    9: "https://www.youtube.com/watch?v=ZhO3_roH_mg",
    13: "https://www.youtube.com/watch?v=RUOs9YzSato",
    19: "https://www.youtube.com/watch?v=CyQsfq_O6S4",
  },
  "2026 Tour de Suisse": {
    5: "https://www.youtube.com/watch?v=f61NRl63jFg",
  },
  "2026 Tour Auvergne-Rhône-Alpes": {
    5: "https://www.youtube.com/watch?v=4VSnvDeUO4E",
  },
  "2026 Tour de France": {
    1: "https://www.youtube.com/watch?v=U5br6kI5ha8",
  },
  "2026 La Vuelta Femenina": "https://www.youtube.com/watch?v=_aJn7pjCTVw",
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
    "Madis Mihkels": "EST",
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
    "Paul Magnier": "FRA",
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

let raceMetadataCache = {
  updatedAt: 0,
  data: null,
  promise: null,
};

let deferredRaceMetadataCache = {
  updatedAt: 0,
  data: null,
  promise: null,
};

let raceDataCache = {
  updatedAt: 0,
  data: null,
  promise: null,
};

let deferredRaceDataCache = {
  updatedAt: 0,
  data: null,
  promise: null,
};

const deferredGroupDataCaches = new Map();

const articleCache = new Map();
const finishVideoCache = new Map();
// Channels whose cycling highlights are reliable. The race's own official channel
// is scored separately (by matching race tokens in the channel name), so this list
// is for the major broadcasters that cover many races.
const TRUSTED_FINISH_VIDEO_CHANNELS = [
  { pattern: /\buci\b|union cycliste/i, score: 70 },
  { pattern: /global cycling network|\bgcn\b/i, score: 66 },
  { pattern: /eurosport|discovery|tnt sports/i, score: 64 },
  { pattern: /flobikes|flosports/i, score: 60 },
  { pattern: /nbc sports|peacock/i, score: 58 },
  { pattern: /sporza|rai ?sport|france ?tv|rtbf|\bned\b|nos sport/i, score: 52 },
  { pattern: /red bull/i, score: 50 },
];

const HTML_NAMED_ENTITY_CODEPOINTS = {
  Aacute: 0x00c1,
  aacute: 0x00e1,
  Acirc: 0x00c2,
  acirc: 0x00e2,
  Agrave: 0x00c0,
  agrave: 0x00e0,
  Aring: 0x00c5,
  aring: 0x00e5,
  Atilde: 0x00c3,
  atilde: 0x00e3,
  Auml: 0x00c4,
  auml: 0x00e4,
  Ccedil: 0x00c7,
  ccedil: 0x00e7,
  Eacute: 0x00c9,
  eacute: 0x00e9,
  Ecirc: 0x00ca,
  ecirc: 0x00ea,
  Egrave: 0x00c8,
  egrave: 0x00e8,
  Euml: 0x00cb,
  euml: 0x00eb,
  Iacute: 0x00cd,
  iacute: 0x00ed,
  Icirc: 0x00ce,
  icirc: 0x00ee,
  Igrave: 0x00cc,
  igrave: 0x00ec,
  Iuml: 0x00cf,
  iuml: 0x00ef,
  Ntilde: 0x00d1,
  ntilde: 0x00f1,
  Oacute: 0x00d3,
  oacute: 0x00f3,
  Ocirc: 0x00d4,
  ocirc: 0x00f4,
  Ograve: 0x00d2,
  ograve: 0x00f2,
  Oslash: 0x00d8,
  oslash: 0x00f8,
  Otilde: 0x00d5,
  otilde: 0x00f5,
  Ouml: 0x00d6,
  ouml: 0x00f6,
  Uacute: 0x00da,
  uacute: 0x00fa,
  Ucirc: 0x00db,
  ucirc: 0x00fb,
  Ugrave: 0x00d9,
  ugrave: 0x00f9,
  Uuml: 0x00dc,
  uuml: 0x00fc,
  Yacute: 0x00dd,
  yacute: 0x00fd,
  yuml: 0x00ff,
  THORN: 0x00de,
  thorn: 0x00fe,
  ETH: 0x00d0,
  eth: 0x00f0,
  szlig: 0x00df,
  AElig: 0x00c6,
  aelig: 0x00e6,
  OElig: 0x0152,
  oelig: 0x0153,
  Scaron: 0x0160,
  scaron: 0x0161,
  Zcaron: 0x017d,
  zcaron: 0x017e,
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
    .replace(/&([A-Za-z][A-Za-z0-9]+);/g, (match, entityName) => {
      const codePoint = HTML_NAMED_ENTITY_CODEPOINTS[entityName];
      return codePoint ? String.fromCodePoint(codePoint) : match;
    })
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
    .replace(/\{\{flag[\s_]*athlete\|([^}|]+)(?:\|[^}]*)?\}\}/gi, "$1")
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

function normalizeAlpha2CountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return ALPHA2_TO_COUNTRY_CODE.get(code) || "";
}

function getRiderCountryCode(name) {
  const key = String(name || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .trim();

  return RIDER_COUNTRY_CODES.get(key) || "";
}

function resolveKnownRiderName(rawName) {
  const cleaned = cleanFeedText(String(rawName || ""))
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const exactCode = getRiderCountryCode(cleaned);
  if (exactCode) {
    return cleaned;
  }

  const titleCased = toTitleCaseWords(cleaned);
  if (getRiderCountryCode(titleCased)) {
    return titleCased;
  }

  const normalizedTarget = cleaned
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .trim();
  const tokens = normalizedTarget.split(/\s+/).filter(Boolean);
  const surname = tokens[tokens.length - 1] || normalizedTarget;
  const matchingNames = [...RIDER_COUNTRY_CODES.keys()].filter((key) => {
    const keyTokens = key.split(/\s+/).filter(Boolean);
    return keyTokens[keyTokens.length - 1] === surname;
  });

  if (matchingNames.length === 1) {
    return toTitleCaseWords(matchingNames[0]);
  }

  return titleCased;
}

function isVueltaABurgosFeminasRace(race) {
  const text = normalizeSearchText([race?.pageTitle, race?.title].join(" "));
  return text.includes("vuelta a burgos feminas");
}

function parseAthleteDetails(cell) {
  const text = String(cell || "");
  // Wikipedia race pages use several redirects of the same template interchangeably
  // ("{{flagathlete}}", "{{Flagathlete}}", "{{Flag athlete}}"). The spaced spelling is
  // now the most common one on Tour de France / Tour de France Femmes pages, so a
  // name-only match silently dropped every rider on those pages.
  const match = text.match(/\{\{\s*flag[\s_]*athlete\s*\|([\s\S]+?)\}\}/i);
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
  if (race?.endDate instanceof Date) {
    return race.endDate.getUTCFullYear();
  }

  const parsed = race?.endDate ? new Date(race.endDate) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getUTCFullYear() : null;
}

function getRaceCoverageStageNumber(race) {
  const stageNumber = Number(
    race?.stageRace?.latestStage?.number ||
      race?.stageRace?.generalClassification?.stageNumber ||
      race?.stageRace?.completedStages ||
      0,
  );

  return Number.isFinite(stageNumber) && stageNumber > 0 ? stageNumber : 0;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let activeWikiFetches = 0;
const wikiFetchQueue = [];

async function withWikiFetchSlot(task) {
  if (activeWikiFetches >= WIKI_FETCH_CONCURRENCY) {
    await new Promise((resolve) => wikiFetchQueue.push(resolve));
  }

  activeWikiFetches += 1;

  try {
    return await task();
  } finally {
    activeWikiFetches -= 1;
    wikiFetchQueue.shift()?.();
  }
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
  for (let attempt = 0; attempt <= FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ProCyclingResults/1.0; +https://wikipedia.org)",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok) {
        return await response.text();
      }

      if ((response.status === 429 || response.status >= 500) && attempt < FETCH_RETRY_DELAYS_MS.length) {
        await sleep(FETCH_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt >= FETCH_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(FETCH_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function fetchWikiRaw(title) {
  const url = `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
  const text = await withWikiFetchSlot(() => fetchText(url));
  if (text.startsWith("<!DOCTYPE html>")) {
    return "";
  }
  return text;
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function cleanNationalChampionCell(value) {
  const cleaned = cleanFeedText(value)
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // The index writes a status word into a cell when a title has not been decided —
  // "postponed", "cancelled" — and those must not render as a champion's name.
  if (!cleaned || /^Row\s+\d+\s+-\s+Cell\b/i.test(cleaned) || /^(postponed|cancell?ed|tbc|tbd|n\/a|not held|no race|none)$/i.test(cleaned)) {
    return "";
  }

  return NATIONAL_CHAMPION_NAME_CORRECTIONS[cleaned] || cleaned;
}

function extractHtmlTableByCaption(html, captionPattern) {
  return [...String(html || "").matchAll(/<table[\s\S]*?<\/table>/gi)].find((match) => {
    const caption = match[0].match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    return captionPattern.test(cleanFeedText(caption?.[1] || ""));
  })?.[0] || "";
}

function hasNationalChampion(row) {
  return NATIONAL_CHAMPIONSHIP_EVENT_KEYS.some((key) => Boolean(row?.[key]));
}

function isCompleteNationalChampionRow(row) {
  return NATIONAL_CHAMPIONSHIP_EVENT_KEYS.every((key) => Boolean(row?.[key]));
}

function createNationalChampionshipEventId(country, eventKey) {
  const countrySlug = String(country || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${countrySlug || "unknown"}-${eventKey}`;
}

function getNationalChampionshipEventMetadata(country, eventKey) {
  return NATIONAL_CHAMPIONSHIP_EVENT_METADATA[country]?.[eventKey] || {};
}

function formatNationalChampionshipDate(dateIso) {
  if (!dateIso) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

function normalizeNationalChampionshipPodium(metadataPodium, champion) {
  const podium = Array.isArray(metadataPodium) ? metadataPodium : [];
  const normalized = podium
    .map((rider, index) => ({
      place: String(index + 1),
      rider: cleanNationalChampionCell(rider),
    }))
    .filter((entry) => entry.rider)
    .slice(0, 3);

  if (normalized.length > 0) {
    return normalized;
  }

  return champion ? [{ place: "1", rider: champion }] : [];
}

function getNationalChampionshipStatus(champion, dateIso, today = new Date()) {
  if (champion) {
    return "completed";
  }

  if (!dateIso) {
    return "pending";
  }

  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const eventDate = new Date(`${dateIso}T00:00:00Z`);
  return eventDate.getTime() >= todayUtc.getTime() ? "upcoming" : "pending";
}

function buildNationalChampionshipEventRecords(rows) {
  return (rows || []).flatMap((row) =>
    NATIONAL_CHAMPIONSHIP_EVENT_KEYS.map((eventKey) => {
      const champion = cleanNationalChampionCell(row?.[eventKey]);
      const metadata = getNationalChampionshipEventMetadata(row?.country, eventKey);
      const dateIso = metadata.date || "";
      const dateLabel = formatNationalChampionshipDate(dateIso);
      const status = getNationalChampionshipStatus(champion, dateIso);
      const podium = normalizeNationalChampionshipPodium(metadata.podium, champion);

      return {
        id: createNationalChampionshipEventId(row?.country, eventKey),
        country: row?.country || "",
        eventKey,
        eventLabel: NATIONAL_CHAMPIONSHIP_EVENT_LABELS[eventKey],
        eventName: NATIONAL_CHAMPIONSHIP_EVENT_GROUPS[eventKey],
        champion,
        podium,
        status,
        date: dateIso,
        dateLabel,
        location: metadata.location || "",
        finishVideoUrl: metadata.finishVideoUrl || "",
        sourceUrl: metadata.sourceUrl || "",
      };
    }),
  );
}

function sortNationalChampionshipEvents(events) {
  return [...(events || [])].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "completed") {
        return -1;
      }
      if (right.status === "completed") {
        return 1;
      }
      if (left.status === "upcoming") {
        return -1;
      }
      if (right.status === "upcoming") {
        return 1;
      }
    }

    const leftTime = left.date ? new Date(`${left.date}T00:00:00Z`).getTime() : 0;
    const rightTime = right.date ? new Date(`${right.date}T00:00:00Z`).getTime() : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    const countryCompare = String(left.country || "").localeCompare(String(right.country || ""));
    if (countryCompare !== 0) {
      return countryCompare;
    }

    return NATIONAL_CHAMPIONSHIP_EVENT_KEYS.indexOf(left.eventKey) - NATIONAL_CHAMPIONSHIP_EVENT_KEYS.indexOf(right.eventKey);
  });
}

function selectNationalChampionshipHighlights(rows, limit = 6) {
  return [...(rows || [])]
    .filter(hasNationalChampion)
    .map((row, originalIndex) => {
      const featuredIndex = NATIONAL_CHAMPIONSHIP_FEATURED_COUNTRIES.findIndex(
        (country) => country === row.country,
      );
      const completedEventCount = NATIONAL_CHAMPIONSHIP_EVENT_KEYS.filter((key) => Boolean(row[key])).length;
      const roadRaceCount = Number(Boolean(row.meRoadRace)) + Number(Boolean(row.weRoadRace));
      const featuredScore = featuredIndex >= 0 ? 1000 - featuredIndex : 0;

      return {
        row,
        score: featuredScore + completedEventCount * 25 + roadRaceCount * 40,
        originalIndex,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.originalIndex - right.originalIndex;
    })
    .slice(0, limit)
    .map((entry) => entry.row);
}

function getNationalChampionshipContinent(countryName) {
  const alpha2 = COUNTRY_NAME_ALPHA2[String(countryName || "").trim().toLowerCase()];
  return CONTINENT_BY_ALPHA2[alpha2] || "";
}

function isFeaturedNationalChampionshipEvent(event) {
  return (
    event?.status === "completed" &&
    ((event.podium?.length || 0) > 1 || Boolean(event.sourceUrl) || Boolean(event.finishVideoUrl))
  );
}

function describeNationalChampionshipFederation(events) {
  const dated = events.filter((event) => event.date).sort((left, right) => left.date.localeCompare(right.date));
  if (!dated.length) {
    return "";
  }
  const first = dated[0].dateLabel;
  const last = dated[dated.length - 1].dateLabel;
  const locations = [...new Set(dated.map((event) => event.location).filter(Boolean))];
  return [first === last ? first : `${first} – ${last}`, locations.join(" / ")].filter(Boolean).join(" · ");
}

// One row per federation, bucketed by continent in NATIONAL_CHAMPIONSHIP_CONTINENTS
// order. Federations the map does not know land in a trailing "Other" group rather
// than disappearing.
function groupNationalChampionshipsByContinent(events) {
  const byCountry = new Map();
  (events || []).forEach((event) => {
    if (!event?.country) {
      return;
    }
    if (!byCountry.has(event.country)) {
      byCountry.set(event.country, []);
    }
    byCountry.get(event.country).push(event);
  });

  const groups = NATIONAL_CHAMPIONSHIP_CONTINENTS.map((continent) => ({ ...continent, federations: [] }));
  const other = { id: "other", label: "Other federations", hint: "", federations: [] };

  [...byCountry.keys()]
    .sort((left, right) => left.localeCompare(right))
    .forEach((country) => {
      const countryEvents = byCountry.get(country);
      const continentId = getNationalChampionshipContinent(country);
      const group = groups.find((entry) => entry.id === continentId) || other;
      const champions = {};
      NATIONAL_CHAMPIONSHIP_EVENT_KEYS.forEach((key) => {
        champions[key] = countryEvents.find((event) => event.eventKey === key)?.champion || "";
      });
      group.federations.push({
        country,
        flag: getCountryFlagEmojiByName(country),
        champions,
        championKeys: NATIONAL_CHAMPIONSHIP_EVENT_KEYS.filter((key) => champions[key]),
        detail: describeNationalChampionshipFederation(countryEvents),
      });
    });

  return [...groups, other]
    .filter((group) => group.federations.length > 0)
    .map((group) => ({
      ...group,
      federationCount: group.federations.length,
      reportingCount: group.federations.filter((federation) => federation.championKeys.length > 0).length,
      championCount: group.federations.reduce((sum, federation) => sum + federation.championKeys.length, 0),
    }));
}

function buildEmptyNationalChampionships(error) {
  return {
    sourceLabel: NATIONAL_CHAMPIONSHIPS_SOURCE_LABEL,
    sourceUrl: NATIONAL_CHAMPIONSHIPS_SOURCE_URL,
    sourceLastModified: "",
    fetchedAt: new Date().toISOString(),
    rows: [],
    events: [],
    highlights: [],
    totalCountryCount: 0,
    reportingCountryCount: 0,
    completeCountryCount: 0,
    completedEventCount: 0,
    upcomingEventCount: 0,
    error: error?.message || "",
  };
}

function parseNationalChampionshipsIndex(html) {
  const table = extractHtmlTableByCaption(html, /elite road national champions/i);
  if (!table) {
    return buildEmptyNationalChampionships(new Error("National championships table was not found."));
  }

  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .slice(1)
    .map((match) => {
      const cells = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cellMatch) => cleanNationalChampionCell(cellMatch[1]));

      if (cells.length < 5 || !cells[0]) {
        return null;
      }

      return {
        country: cells[0],
        meItt: cells[1],
        meRoadRace: cells[2],
        weItt: cells[3],
        weRoadRace: cells[4],
      };
    })
    .filter(Boolean);
  const events = sortNationalChampionshipEvents(buildNationalChampionshipEventRecords(rows));

  const sourceLastModified =
    String(html || "").match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1] ||
    String(html || "").match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ||
    "";

  return {
    sourceLabel: NATIONAL_CHAMPIONSHIPS_SOURCE_LABEL,
    sourceUrl: NATIONAL_CHAMPIONSHIPS_SOURCE_URL,
    sourceLastModified,
    fetchedAt: new Date().toISOString(),
    rows,
    events,
    highlights: selectNationalChampionshipHighlights(rows),
    totalCountryCount: rows.length,
    reportingCountryCount: rows.filter(hasNationalChampion).length,
    completeCountryCount: rows.filter(isCompleteNationalChampionRow).length,
    completedEventCount: events.filter((event) => event.status === "completed").length,
    upcomingEventCount: events.filter((event) => event.status === "upcoming").length,
    error: "",
  };
}

async function loadNationalChampionships() {
  try {
    const html = await fetchText(NATIONAL_CHAMPIONSHIPS_SOURCE_URL);
    return parseNationalChampionshipsIndex(html);
  } catch (error) {
    return buildEmptyNationalChampionships(error);
  }
}

function createWikiRawLoader() {
  const memo = new Map();

  return async function loadWikiRaw(title) {
    const key = String(title || "").trim();
    if (!key) {
      return "";
    }

    if (memo.has(key)) {
      return memo.get(key);
    }

    const promise = fetchWikiRaw(key).catch((error) => {
      memo.delete(key);
      throw error;
    });

    memo.set(key, promise);
    return promise;
  };
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

// A {{cyclingresult}} time cell is a bare clock value: an elapsed time ("4h 47' 47\"",
// "10' 57\"") for the leader and a gap ("+ 9\"", "+ 1' 23\"") for everyone below. Anything
// carrying wiki markup is a team, jersey or reference argument rather than a time.
// A team time trial classifies teams, not riders, and the wikitext only ever carries a
// team *code* — `{{UCI team code|TVL men|2026}}` — in the result row, the route table
// and even the article's own Teams section. No display name appears anywhere on the
// page, which is why these stages used to render as an unraced chip.
function parseTeamReference(cell) {
  const text = String(cell || "");
  const match = text.match(/\{\{\s*UCI team code\s*\|\s*([^|}]+?)\s*(?:\|\s*([^|}]+?)\s*)?(?:\|[^}]*)?\}\}/i);
  if (!match) {
    return null;
  }

  const flagCode = text.match(/\{\{\s*flagicon\s*\|\s*([A-Za-z]{2,3})\s*\}\}/i)?.[1] || "";
  return {
    code: match[1],
    edition: match[2] || "",
    countryCode: normalizeCountryCode(flagCode.toUpperCase()),
  };
}

function getTeamReferenceKey(reference) {
  return `${reference.code}|${reference.edition}`;
}

const teamNameCache = new Map();

// Wikipedia expands the template for us, so the names stay correct across seasons
// instead of drifting out of a hardcoded table. Codes are resolved in one batched
// request and cached for the process lifetime — a team's rendered name does not change.
async function resolveTeamNames(references) {
  const wanted = [...new Map(references.map((reference) => [getTeamReferenceKey(reference), reference])).values()].filter(
    (reference) => !teamNameCache.has(getTeamReferenceKey(reference)),
  );

  if (wanted.length > 0) {
    try {
      const params = new URLSearchParams({
        action: "expandtemplates",
        format: "json",
        formatversion: "2",
        prop: "wikitext",
        text: wanted
          .map((reference) => `{{UCI team code|${reference.code}${reference.edition ? `|${reference.edition}` : ""}}}`)
          .join(TEAM_NAME_SEPARATOR),
      });
      const payload = await fetchJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
      const expanded = String(payload?.expandtemplates?.wikitext || "").split(TEAM_NAME_SEPARATOR);

      wanted.forEach((reference, index) => {
        // The template expands to a wikilink; the display half is the readable name.
        const link = expanded[index]?.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
        const name = cleanWikiText(link?.[2] || link?.[1] || "");
        teamNameCache.set(getTeamReferenceKey(reference), isPlausibleRiderName(name) ? name : "");
      });
    } catch {
      // Leave the codes unresolved; the stage renders as it did before.
    }
  }

  return new Map(
    references
      .map((reference) => [getTeamReferenceKey(reference), teamNameCache.get(getTeamReferenceKey(reference)) || ""])
      .filter(([, name]) => name),
  );
}

function isWikiResultTimeCell(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned || /[[\]{}<>]/.test(cleaned)) {
    return false;
  }

  return (
    /^\+?\s*(?:\d+\s*h\s*)?(?:\d{1,2}\s*'\s*)?\d{1,2}\s*(?:''|")$/.test(cleaned) ||
    /^\+?\s*\d+(?::\d{2}){1,2}$/.test(cleaned)
  );
}

function parseCyclingResultLine(line, teamNames = new Map()) {
  const trimmed = String(line || "").trim();
  if (!/^\{\{\s*cycling\s*result\s*\|/i.test(trimmed)) {
    return null;
  }

  const args = splitWikiTemplateArgs(trimmed.replace(/^\{\{/, "").replace(/\}\}$/, ""));
  const templateName = String(args[0] || "").replace(/\s+/g, "").toLowerCase();
  if (templateName !== "cyclingresult" || args.length < 3) {
    return null;
  }

  // {{cyclingresult|rank|rider|ESP|{{UCI team code|...}}|4h 47' 47"|{{cjersey|red}}}}
  // keeps the country and the finishing time in their own positional arguments, while
  // other pages inline the country as {{flagathlete|[[Rider]]|ESP}} inside the rider
  // cell. parseAthleteDetails only understands the inline spelling, so reading only it
  // dropped every flag *and* every time on Grand Tour stage articles.
  const athlete = parseAthleteDetails(args[2]);
  const trailingArgs = args.slice(3);
  // A team time trial row leaves the rider and country arguments empty and carries a
  // {{UCI team code}} where the team cell would be: {{cyclingresult|1|||{{flagicon|NED}}
  // {{UCI team code|TVL men|2026}}|21' 47"}}. Without a resolved name there is nothing
  // readable to show, so the row is skipped exactly as it was before.
  if (!athlete.rider) {
    const teamReference = trailingArgs.map(parseTeamReference).find(Boolean);
    const teamName = teamReference ? teamNames.get(getTeamReferenceKey(teamReference)) : "";
    if (!teamName) {
      return null;
    }

    const teamTimeCell = trailingArgs.find(isWikiResultTimeCell) || "";
    return buildStandingEntry(cleanWikiText(args[1]), {
      rider: teamName,
      countryCode: teamReference.countryCode,
      gap: teamTimeCell.startsWith("+") ? teamTimeCell : "",
      time: teamTimeCell.startsWith("+") ? "" : teamTimeCell,
    });
  }

  // Team and jersey cells are templates, so the country is the only bare alpha token
  // among them and the time the only clock-shaped one; matching by shape rather than
  // by position tolerates the optional jersey and team arguments being absent.
  const positionalCountryCode = trailingArgs.find((value) => /^[A-Za-z]{2,3}$/.test(value)) || "";
  const timeCell = trailingArgs.find(isWikiResultTimeCell) || "";

  return buildStandingEntry(cleanWikiText(args[1]), {
    ...athlete,
    countryCode: athlete.countryCode || positionalCountryCode,
    gap: timeCell.startsWith("+") ? timeCell : "",
    time: timeCell.startsWith("+") ? "" : timeCell,
  });
}

// Two things this has to survive, both seen on the 2026 Tour's stage articles.
//
// The start tag's parameters are not always just `title=`: a team time trial writes
// `{{Cyclingresult start|rider=no|title=Stage 1 result}}`, and requiring `title=` to
// come first silently dropped the block — every TTT result on every race page.
//
// And the closing `{{Cyclingresult end}}` is sometimes simply missing. Pairing a start
// with the next `end` then runs one block's title into a later block's body, which is
// worse than dropping it: the 2026 Tour's stage 3 and 4 results disappeared while their
// rows were served under a general-classification title. Each block therefore ends at
// its own `end` tag *or* at the next start tag, whichever comes first, so a missing end
// costs nothing.
function extractCyclingResultBlocks(rawText) {
  const text = String(rawText || "");
  // The parameter list can span lines: a citation inside `title=` often wraps, which is
  // why this cannot be anchored to a single line.
  const starts = [...text.matchAll(/\{\{\s*cycling\s*result\s*start((?:\|[\s\S]*?)?)\}\}/gi)];

  return starts.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyLimit = index + 1 < starts.length ? starts[index + 1].index : text.length;
    const body = text.slice(bodyStart, bodyLimit);
    const endIndex = body.search(/\{\{\s*cycling\s*result\s*end/i);

    return {
      title: cleanWikiText(match[1]?.match(/(?:^|\|)\s*title\s*=([\s\S]*)$/)?.[1] || ""),
      body: endIndex >= 0 ? body.slice(0, endIndex) : body,
    };
  });
}

function parseCyclingResultStandings(blockBody, maxRiders = MAX_RESULT_RIDERS, teamNames = new Map()) {
  return String(blockBody || "")
    .split("\n")
    .map((line) => parseCyclingResultLine(line, teamNames))
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

// A parsed athlete cell that is empty or still holds table-layout residue (colspan /
// rowspan / stray markup characters) is not a real rider name. This guards against a
// wiki row separator that carries attributes (e.g. "|- class=sortbottom" on a "Total"
// footer) merging that footer into the last data row and exposing its spanning cell as
// a fake stage winner.
function isPlausibleRiderName(rider) {
  const value = String(rider || "").trim();
  return value.length > 0 && !/[=|{}]|colspan|rowspan/i.test(value);
}

const STAGE_TYPE_LABELS = {
  flat: "Flat stage",
  hilly: "Hilly stage",
  "medium-mountain": "Medium mountain stage",
  mountain: "Mountain stage",
  "individual-time-trial": "Individual time trial",
  "team-time-trial": "Team time trial",
};

// The route table's Type column is an icon cell followed by a text cell, and pages are
// inconsistent about which of the two carries the useful words: the icon file name
// ("Mediummountainstage.svg", "Time Trial.svg") and the label ("Medium-mountain stage",
// "[[Individual time trial]]") are read together so either alone is enough. Team time
// trials are checked first because they also match the plain "time trial" test.
function parseStageType(cells) {
  const raw = (Array.isArray(cells) ? cells : [cells]).join(" ");
  // cleanWikiText drops file links outright, so the icon names are lifted out first.
  const iconNames = [...raw.matchAll(/File:([^|\]]+)/gi)].map((match) => match[1]).join(" ");
  const text = normalizeSearchText(`${iconNames} ${raw}`).replace(/-/g, " ");
  if (/team\s*time\s*trial/.test(text)) {
    return "team-time-trial";
  }
  if (/time\s*trial|\bprologue\b/.test(text)) {
    return "individual-time-trial";
  }
  if (/medium\s*mountain/.test(text)) {
    return "medium-mountain";
  }
  if (/mountain/.test(text)) {
    return "mountain";
  }
  if (/hilly|intermediate/.test(text)) {
    return "hilly";
  }
  if (/flat|plain/.test(text)) {
    return "flat";
  }
  return "";
}

// Distances are written as {{convert|215.5|km|abbr=on}} almost everywhere, with the
// occasional bare "215.5 km"; either way the number is kept in kilometres and the
// renderer converts for display.
function parseStageDistanceKm(cell) {
  const raw = String(cell || "");
  const match =
    raw.match(/\{\{\s*(?:convert|cvt)\s*\|\s*(\d+(?:[.,]\d+)?)\s*\|\s*(km|mi)\b/i) ||
    cleanWikiText(raw).match(/(\d+(?:[.,]\d+)?)\s*(km|mi)\b/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const km = match[2].toLowerCase() === "mi" ? value / 0.621371 : value;
  return Math.round(km * 10) / 10;
}

// Every row of the route table, raced or not. Unraced stages carry no winner, but their
// distance and type still describe the route, and an official provider's current stage
// needs them once it is folded into the history ahead of Wikipedia's own update.
function extractRouteStages(rawText, teamNames = new Map()) {
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
      if (!stageInfo) {
        return null;
      }

      const winnerCell = cells[cells.length - 1];
      const teamReference = parseTeamReference(winnerCell);
      const teamName = teamReference ? teamNames.get(getTeamReferenceKey(teamReference)) : "";
      // A team time trial's winner cell holds a team code rather than a rider, and
      // parseAthleteDetails cleans it away to an empty string.
      const winner = teamName
        ? { rider: teamName, countryCode: teamReference.countryCode }
        : parseAthleteDetails(winnerCell);
      // The route table is Stage | Date | Course | Distance | Type | Winner, so the
      // date and course cells give a stage its label without a second fetch. They are
      // best-effort: a race whose table omits them just renders the stage number.
      const stageDate = cleanWikiText(cells[1] || "");
      const course = cleanWikiText(cells[2] || "");
      const distanceKm = parseStageDistanceKm(cells[3]);
      const stageType = parseStageType(cells.slice(4, cells.length - 1));
      // A stage whose race has not happened yet has an empty winner cell; reject
      // any winner still carrying table-layout residue (e.g. a "colspan" cell from
      // a merged "Total" footer row) so a scheduled stage is never read as raced.
      return {
        ...stageInfo,
        stageDate,
        course,
        ...(distanceKm ? { distanceKm } : {}),
        ...(stageType ? { stageType } : {}),
        winner: isPlausibleRiderName(winner.rider) ? winner : null,
      };
    })
    .filter(Boolean);
}

function extractRouteStageWinners(rawText, teamNames = new Map()) {
  return extractRouteStages(rawText, teamNames).filter((entry) => entry.winner);
}

// The route as the card needs it: one entry per listed stage, keyed by stage number,
// carrying only what describes the course. It travels on the snapshot as `route` so a
// stage that arrives from an official provider can pick up its distance and type.
function buildRouteDetails(routeStages) {
  return (Array.isArray(routeStages) ? routeStages : []).map((entry) => ({
    number: entry.stageNumber,
    order: entry.stageOrder,
    label: entry.stageLabel,
    ...(entry.stageDate ? { date: entry.stageDate } : {}),
    ...(entry.course ? { course: entry.course } : {}),
    ...(entry.distanceKm ? { distanceKm: entry.distanceKm } : {}),
    ...(entry.stageType ? { stageType: entry.stageType } : {}),
  }));
}

const ROUTE_DETAIL_FIELDS = ["date", "course", "distanceKm", "stageType", "elevationGainM"];

// Fill route details onto stages that lack them without overwriting anything a stage
// already knows: a provider-supplied stage keeps its standings and gains its course.
function applyRouteDetails(stages, route) {
  const routeByNumber = new Map(
    (Array.isArray(route) ? route : []).filter((entry) => entry).map((entry) => [Number(entry.number), entry]),
  );
  if (!Array.isArray(stages) || routeByNumber.size === 0) {
    return stages;
  }

  return stages.map((stage) => {
    const details = stage ? routeByNumber.get(Number(stage.number)) : null;
    if (!details) {
      return stage;
    }

    const filled = { ...stage };
    ROUTE_DETAIL_FIELDS.forEach((field) => {
      const missing = filled[field] === undefined || filled[field] === null || filled[field] === "";
      if (missing && details[field] !== undefined && details[field] !== null && details[field] !== "") {
        filled[field] = details[field];
      }
    });
    return filled;
  });
}

// One entry per stage that has actually been raced, richest source first: the full
// podium from a {{cyclingresult}} block when a page publishes one, otherwise the
// winner-only row from the route table. Ordering follows the route table so a
// prologue sorts ahead of stage 1.
// A Grand Tour's route table links each stage number at its companion article
// ("[[2026 Vuelta a España, Stage 1 to Stage 11#Stage 1|1]]"), so the titles can be
// read off the page instead of guessed from a naming convention. Races that publish
// their stage results inline return nothing here and cost no extra fetch.
function extractStageArticleTitles(rawText) {
  const routeTable = extractWikiTableByCaption(rawText, /^stage characteristics(?: and winners)?$/i);
  const titles = [...routeTable.matchAll(/\[\[([^|\]#]*,\s*Stage\s[^|\]#]*)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/gi)].map(
    (match) => match[1].trim(),
  );

  return [...new Set(titles)].filter(Boolean).slice(0, MAX_STAGE_ARTICLES);
}

function buildStageHistory(routeStageWinners, stageResults) {
  const standingsByStage = new Map();
  stageResults.forEach((entry) => {
    const existing = standingsByStage.get(entry.stageNumber);
    if (!existing || entry.standings.length > existing.length) {
      standingsByStage.set(entry.stageNumber, entry.standings);
    }
  });

  const routeByStage = new Map(routeStageWinners.map((entry) => [entry.stageNumber, entry]));

  return [...new Set([...routeByStage.keys(), ...standingsByStage.keys()])]
    .map((stageNumber) => {
      const routeEntry = routeByStage.get(stageNumber) || null;
      const standings =
        standingsByStage.get(stageNumber) || [buildStandingEntry(1, routeEntry?.winner)].filter(Boolean);
      if (standings.length === 0) {
        return null;
      }

      return {
        number: stageNumber,
        order: routeEntry?.stageOrder ?? stageNumber,
        label: routeEntry?.stageLabel || (stageNumber === 0 ? "Prologue" : `Stage ${stageNumber}`),
        ...(routeEntry?.stageDate ? { date: routeEntry.stageDate } : {}),
        ...(routeEntry?.course ? { course: routeEntry.course } : {}),
        ...(routeEntry?.distanceKm ? { distanceKm: routeEntry.distanceKm } : {}),
        ...(routeEntry?.stageType ? { stageType: routeEntry.stageType } : {}),
        standings,
        ...getWinnerDetails(standings),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);
}

// ---------------------------------------------------------------------------
// Classification leadership table
//
// Every stage-race article carries a "Classification leadership" section (older pages
// title it "Classification leadership table"; every one captions the table
// "Classification leadership by stage"): one row per stage, one column per
// classification, and the rider leading each after that stage. It is the only place
// Wikipedia states who holds the points, mountains and young-rider jerseys, so it is
// what the card's jersey list reads. It is also full of `rowspan`: a rider who keeps a
// jersey for six stages is written once, spanning six rows, and every later row simply
// omits that cell. Reading cells by index on those rows returns a neighbouring column,
// which is how an earlier version of this file reported the wrong GC leader. The grid
// below expands the spans first, so a cell's column is known before its content is read.
// ---------------------------------------------------------------------------

function extractClassificationLeadershipTable(rawText) {
  const text = String(rawText || "");
  const headingMatch = text.match(
    /==+\s*Classification leadership(?:\s+table)?\s*==+(?:(?!\n==)[\s\S])*?(\{\|[\s\S]*?\n\|\})/i,
  );

  return headingMatch?.[1] || extractWikiTableByCaption(text, /^classification leadership by stage$/i);
}

// `| style="..." | content` keeps its attributes before a single pipe; a cell whose
// first pipe sits inside a link or template (`[[Page#Stage 1|1]]`, `{{font colour|...}}`)
// has no attributes at all.
function splitWikiCellSource(source) {
  const text = String(source || "");
  const match = text.match(/^([^|\n]*?)\|(?!\|)([\s\S]*)$/);
  if (match && /=/.test(match[1]) && !/\[\[|\{\{/.test(match[1])) {
    return { attributes: match[1].trim(), content: match[2].trim() };
  }

  return { attributes: "", content: text.trim() };
}

// Expands a wikitable into a grid of cells, resolving `rowspan` and `colspan` so that
// `grid[row][column]` is the cell that visually occupies that position. A cell that
// spans several rows is repeated into each of them, flagged `spanned` on the copies.
function parseWikiTableGrid(tableText) {
  const sourceRows = [];
  let cells = [];
  let current = null;
  const flushRow = () => {
    if (cells.length > 0) {
      sourceRows.push(cells);
    }
    cells = [];
    current = null;
  };

  String(tableText || "")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trimStart();
      if (line.startsWith("{|") || line.startsWith("|+")) {
        return;
      }
      if (line.startsWith("|}") || line.startsWith("|-")) {
        flushRow();
        return;
      }
      if (line.startsWith("!") || line.startsWith("|")) {
        const header = line.startsWith("!");
        line
          .slice(1)
          .split(header ? /\s*(?:!!|\|\|)\s*/ : /\s*\|\|\s*/)
          .forEach((part) => {
            current = { header, source: part };
            cells.push(current);
          });
        return;
      }
      if (current) {
        current.source += `\n${rawLine}`;
      }
    });
  flushRow();

  const grid = [];
  const pending = [];
  sourceRows.forEach((sourceCells) => {
    const row = [];
    let column = 0;
    let index = 0;
    const hasPendingAhead = () => pending.some((entry, position) => position >= column && entry?.remaining > 0);

    while (column < 64 && (index < sourceCells.length || hasPendingAhead())) {
      const carried = pending[column];
      if (carried?.remaining > 0) {
        row[column] = { ...carried.cell, spanned: true };
        carried.remaining -= 1;
        column += 1;
        continue;
      }

      if (index >= sourceCells.length) {
        column += 1;
        continue;
      }

      const sourceCell = sourceCells[index];
      index += 1;
      const { attributes, content } = splitWikiCellSource(sourceCell.source);
      const rowspan = Math.max(1, Number(attributes.match(/rowspan\s*=\s*"?(\d+)/i)?.[1] || 1));
      const colspan = Math.max(1, Number(attributes.match(/colspan\s*=\s*"?(\d+)/i)?.[1] || 1));
      const cell = { header: sourceCell.header, content, attributes };
      for (let span = 0; span < colspan; span += 1) {
        row[column] = cell;
        if (rowspan > 1) {
          pending[column] = { remaining: rowspan - 1, cell };
        }
        column += 1;
      }
    }

    grid.push(row);
  });

  return grid;
}

// Removes `{{efn|...}}`-style footnote templates, which nest links and other templates
// that the flat template stripper in cleanWikiText cannot see past.
function stripWikiFootnoteTemplates(text) {
  const source = String(text || "");
  let output = "";
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf("{{", index);
    if (open < 0) {
      output += source.slice(index);
      break;
    }

    const nameMatch = source.slice(open + 2, open + 24).match(/^\s*(efn|efn-[a-z]+|refn|sfn|notetag|note)\s*(?:\||\})/i);
    if (!nameMatch) {
      output += source.slice(index, open + 2);
      index = open + 2;
      continue;
    }

    let depth = 0;
    let cursor = open;
    while (cursor < source.length) {
      const pair = source.slice(cursor, cursor + 2);
      if (pair === "{{") {
        depth += 1;
        cursor += 2;
        continue;
      }
      if (pair === "}}") {
        depth -= 1;
        cursor += 2;
        if (depth === 0) {
          break;
        }
        continue;
      }
      cursor += 1;
    }

    output += source.slice(index, open);
    index = cursor;
  }

  return output;
}

// A leader whose jersey is dark is written `{{font colour|white|Name|link=Name}}`
// (also `font color` and `fontcolour`); the name is the second argument. An empty
// cell on an unraced row still carries the template with blank arguments.
function unwrapWikiFontColour(text) {
  return String(text || "").replace(/\{\{\s*font\s*colou?r\s*\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/gi, (_, inner) => {
    const args = splitWikiTemplateArgs(inner);
    return args[1] || "";
  });
}

// Order matters: the Giro heads its team column "General Super Team".
const CLASSIFICATION_LEADERSHIP_COLUMNS = [
  { key: "team", label: "Team", pattern: /team/ },
  { key: "general", label: "General", pattern: /general/ },
  { key: "points", label: "Points", pattern: /points|sprinter/ },
  { key: "mountains", label: "Mountains", pattern: /mountain|climb|king of the/ },
  { key: "young", label: "Young rider", pattern: /young|youth/ },
];

// The stage and winner columns are not classifications, and a combativity award is a
// per-stage prize rather than a jersey anyone holds, so neither reaches the list.
const CLASSIFICATION_LEADERSHIP_EXCLUDED_COLUMNS = /^(stage|stage winner|winner|date|course)$|combativ|aggressive|award/i;

function parseClassificationLeadershipColumn(headerCell) {
  const source = stripWikiFootnoteTemplates(String(headerCell?.content || "")).replace(/\[\[File:[^\]]*\]\]/gi, "");
  const jersey = source.match(/\{\{\s*cjersey\s*\|\s*([^|}]+?)\s*(?:\||\}\})/i)?.[1] || "";
  const heading = cleanWikiText(source.replace(/<br\s*\/?>[\s\S]*$/i, ""));
  if (!heading || CLASSIFICATION_LEADERSHIP_EXCLUDED_COLUMNS.test(heading)) {
    return null;
  }

  const rule = CLASSIFICATION_LEADERSHIP_COLUMNS.find((entry) => entry.pattern.test(heading.toLowerCase()));
  const genericLabel = heading.replace(/\s*classification\s*$/i, "").trim();

  return {
    key: rule?.key || normalizeSearchText(genericLabel).replace(/\s+/g, "-"),
    label: rule?.label || genericLabel,
    ...(jersey ? { jersey: jersey.trim().toLowerCase() } : {}),
  };
}

const CLASSIFICATION_LEADERSHIP_EMPTY_CELL = /^(?:no award|not awarded|no winner|none|n\/a|tba|tbc|tbd|stage cancelled|[-–—])$/i;

// A holder is a rider, or on the team column a team. Team cells only ever carry a
// `{{UCI team code}}`, resolved through the same map the stage results use; a code the
// map cannot name is left out rather than shown raw.
function parseClassificationLeadershipHolder(content, teamNames = new Map()) {
  const text = stripWikiFootnoteTemplates(String(content || ""));
  const teamReference = parseTeamReference(text);
  if (teamReference) {
    const teamName = teamNames.get(getTeamReferenceKey(teamReference)) || "";
    return teamName
      ? { rider: teamName, ...(teamReference.countryCode ? { countryCode: teamReference.countryCode } : {}) }
      : null;
  }

  const athlete = parseAthleteDetails(unwrapWikiFontColour(text));
  const rider = String(athlete.rider || "").trim();
  if (!isPlausibleRiderName(rider) || CLASSIFICATION_LEADERSHIP_EMPTY_CELL.test(rider)) {
    return null;
  }

  const countryCode = normalizeCountryCode(athlete.countryCode || getRiderCountryCode(rider));
  return { rider, ...(countryCode ? { countryCode } : {}) };
}

function parseClassificationLeadershipStage(cell) {
  const cleaned = cleanWikiText(stripWikiFootnoteTemplates(String(cell?.content || "")));
  if (/^final$/i.test(cleaned)) {
    return null;
  }

  const bareNumber = cleaned.match(/^\s*(\d+)\s*$/);
  if (bareNumber) {
    const stageNumber = Number(bareNumber[1]);
    return { stageNumber, stageOrder: stageNumber, stageLabel: `Stage ${stageNumber}` };
  }

  return parseStageSequence(cleaned);
}

// One entry per raced stage row: `{ stageNumber, stageLabel, entries }`, where each
// entry is `{ key, label, jersey?, rider, countryCode? }`. A row counts as raced when
// its winner cell says anything at all — a cancelled stage still carries its jerseys
// forward by rowspan — or when any classification cell names a holder. Rows whose cells
// are all blank are the stages still to come. The "Final" row is skipped because it
// repeats the last stage.
function extractClassificationLeadershipRows(rawText, teamNames = new Map()) {
  const grid = parseWikiTableGrid(extractClassificationLeadershipTable(rawText));
  const headerRowIndex = grid.findIndex(
    (row) => row.some((cell) => cell?.header) && row.some((cell) => /general/i.test(cleanWikiText(cell?.content || ""))),
  );
  if (headerRowIndex < 0) {
    return [];
  }

  const columns = grid[headerRowIndex].map((cell) => (cell ? parseClassificationLeadershipColumn(cell) : null));
  const winnerColumn = grid[headerRowIndex].findIndex((cell) => /winner/i.test(cleanWikiText(cell?.content || "")));

  return grid
    .slice(headerRowIndex + 1)
    .map((row) => {
      const stageInfo = parseClassificationLeadershipStage(row[0]);
      if (!stageInfo) {
        return null;
      }

      const entries = columns
        .map((column, index) => {
          if (!column || index === 0) {
            return null;
          }

          const holder = parseClassificationLeadershipHolder(row[index]?.content, teamNames);
          return holder ? { ...column, ...holder } : null;
        })
        .filter(Boolean);
      const winnerText = cleanWikiText(stripWikiFootnoteTemplates(String(row[winnerColumn]?.content || "")));
      if (entries.length === 0 && !winnerText) {
        return null;
      }

      return { ...stageInfo, entries };
    })
    .filter(Boolean);
}

// The jersey holders after the most recent raced stage, or null when the page has no
// leadership table yet.
function extractClassificationLeadership(rawText, teamNames = new Map()) {
  const rows = extractClassificationLeadershipRows(rawText, teamNames);
  const latest = rows[rows.length - 1] || null;
  if (!latest || latest.entries.length === 0) {
    return null;
  }

  return {
    stageNumber: latest.stageNumber,
    stageLabel: latest.stageLabel,
    entries: latest.entries,
  };
}

// The leadership table writes most riders as bare links, so their flags come from the
// standings parsed elsewhere on the page — the same rider, named the same way.
function fillClassificationLeaderCountryCodes(leaders, standingsLists) {
  if (!leaders || !Array.isArray(leaders.entries)) {
    return leaders;
  }

  const codesByRider = new Map();
  standingsLists.forEach((standings) => {
    (Array.isArray(standings) ? standings : []).forEach((entry) => {
      const key = normalizeSearchText(entry?.rider);
      if (key && entry?.countryCode && !codesByRider.has(key)) {
        codesByRider.set(key, normalizeCountryCode(entry.countryCode));
      }
    });
  });

  return {
    ...leaders,
    entries: leaders.entries.map((entry) => {
      if (entry.countryCode) {
        return entry;
      }
      const countryCode = codesByRider.get(normalizeSearchText(entry.rider)) || "";
      return countryCode ? { ...entry, countryCode } : entry;
    }),
  };
}

function extractStageLeadershipGcSnapshots(rawText) {
  return extractClassificationLeadershipRows(rawText)
    .map((row) => {
      const leader = row.entries.find((entry) => entry.key === "general");
      const standings = leader ? [buildStandingEntry(1, leader)].filter(Boolean) : [];
      return standings.length > 0 ? { stageNumber: row.stageNumber, standings } : null;
    })
    .filter(Boolean);
}

// Cell attributes are written both quoted and bare on Wikipedia (`scope="row" |` and
// `scope=row |`, `align="right" |` and `align=right |`), so accept either form.
function stripWikiCellAttributes(line) {
  return String(line || "")
    .replace(/^[!|]\s*/, "")
    .replace(/^(?:[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*)+\|\s*/i, "")
    .trim();
}

// Wiki classification tables write seconds with a double quote ("19h 43' 34"",
// "+ 12""), whereas the shared time/gap normalizers expect the ASO doubled-apostrophe
// form. Those normalizers also require a two-digit seconds field and a minutes field,
// neither of which a sub-minute gap has, so "+ 4"" has to become "+ 0' 04''" or the
// gap is dropped entirely and the rider renders as level with the leader.
function normalizeWikiTimeCell(value) {
  const asoLike = cleanWikiText(value)
    .replace(/[”″]/g, '"')
    .replace(/[’′]/g, "'")
    .replace(/"/g, "''")
    .replace(/(\d{1,2})''/, (full, seconds) => `${seconds.padStart(2, "0")}''`);

  return /\d\s*'(?!')/.test(asoLike) ? asoLike : asoLike.replace(/(\d{2})''/, "0' $1''");
}

function parseWikiClassificationTableStandings(table) {
  return String(table || "")
    .split("\n|-")
    .map((row) => {
      const cells = [];
      for (const line of row.split("\n")) {
        if (line === "|}" || line.startsWith("|+") || line.startsWith("{|")) {
          continue;
        }

        if (line.startsWith("!") || line.startsWith("|")) {
          cells.push(stripWikiCellAttributes(line));
        }
      }

      // Rank / Rider / ... / Time. The header row's "Rank" cell is not a number, so
      // it drops out here rather than needing a separate skip.
      if (cells.length < 2) {
        return null;
      }

      const place = Number.parseInt(cells[0], 10);
      const rider = parseAthleteDetails(cells[1]);
      if (!Number.isInteger(place) || place > MAX_RESULT_RIDERS || !rider.rider) {
        return null;
      }

      // The leader's cell carries an elapsed time and everyone below carries a gap.
      const timeCell = normalizeWikiTimeCell(cells[cells.length - 1]);
      const isGap = timeCell.startsWith("+");

      return buildStandingEntry(place, {
        ...rider,
        gap: isGap ? timeCell : "",
        time: isGap ? "" : timeCell,
      });
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.place) - Number(right.place));
}

// Grand Tour pages publish their in-progress standings as plain wikitables captioned
// "General classification after Stage N" instead of the {{cycling result start}}
// blocks smaller races use, so they need a dedicated reader to surface a GC at all.
function extractClassificationTableGcSnapshots(rawText) {
  return [...String(rawText || "").matchAll(/\{\|[\s\S]*?\n\|\}/g)]
    .map((match) => {
      const table = match[0];
      const caption = cleanWikiText(table.match(/\|\+\s*([^\n]+)/)?.[1] || "");
      const captionMatch = caption.match(/^general classification after stage\s+(\d+)/i);
      if (!captionMatch) {
        return null;
      }

      const standings = parseWikiClassificationTableStandings(table);
      return standings.length > 0 ? { stageNumber: Number(captionMatch[1]), standings } : null;
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

// Grand Tours keep only a winner column on the main article and publish the real
// stage podiums on companion pages ("2026 Vuelta a España, Stage 1 to Stage 11").
// `stageArticleTexts` carries those pages so a stage-by-stage history can be built;
// `overallResult` is still read from `rawText` alone, because a stage article's first
// "Stage 1 Result" block would otherwise be mistaken for the race's overall result.
// Scoped to places a team can actually be rendered — {{cyclingresult}} rows and the
// route table's winner column — so an article that merely lists its teams never
// triggers a lookup.
function collectTeamReferences(rawText, stageArticleTexts = []) {
  const texts = [rawText, ...(Array.isArray(stageArticleTexts) ? stageArticleTexts : [stageArticleTexts])];
  const references = [];

  texts.forEach((text) => {
    [...String(text || "").matchAll(/^\{\{\s*cycling\s*result\s*\|[^\n]*$/gim)].forEach((match) => {
      const reference = parseTeamReference(match[0]);
      if (reference) {
        references.push(reference);
      }
    });
  });

  // The team classification column of the leadership table is the third place a team
  // code appears with no name beside it.
  const routeTable = extractWikiTableByCaption(rawText, /^stage characteristics(?: and winners)?$/i);
  const leadershipTable = extractClassificationLeadershipTable(rawText);
  [...`${routeTable}\n${leadershipTable}`.matchAll(/\{\{\s*UCI team code[^}]*\}\}[^\n]*/gi)].forEach((match) => {
    const reference = parseTeamReference(match[0]);
    if (reference) {
      references.push(reference);
    }
  });

  return references;
}

// Resolves every team a race's stage results could need, in one batched request.
// Returns an empty map when the race has no team rows at all, which is almost always.
async function loadStageRaceTeamNames(rawText, stageArticleTexts = []) {
  const references = collectTeamReferences(rawText, stageArticleTexts);
  return references.length > 0 ? resolveTeamNames(references) : new Map();
}

function extractStageRaceSnapshot(rawText, stageArticleTexts = [], teamNames = new Map()) {
  const blocks = extractCyclingResultBlocks(rawText);
  const stageArticleBlocks = (Array.isArray(stageArticleTexts) ? stageArticleTexts : [stageArticleTexts])
    .flatMap((text) => extractCyclingResultBlocks(text));
  const stageResults = [];
  const gcResults = [];

  const readResultBlock = (block, allowGeneralClassification) => {
    const title = normalizeSearchText(block.title);
    const stageMatch = title.match(/\bstage\s+(\d+)\s+result\b/);
    const gcMatch = title.match(/\bgeneral classification after stage\s+(\d+)\b/);
    const standings = parseCyclingResultStandings(block.body, MAX_RESULT_RIDERS, teamNames);

    if (stageMatch && standings.length > 0) {
      stageResults.push({
        stageNumber: Number(stageMatch[1]),
        standings,
      });
    }

    if (allowGeneralClassification && gcMatch && standings.length > 0) {
      gcResults.push({
        stageNumber: Number(gcMatch[1]),
        standings,
      });
    }
  };

  blocks.forEach((block) => readResultBlock(block, true));
  // Companion stage articles contribute their stage podiums only. They also repeat a
  // "General classification after Stage N" block, but those are hand-copied and drift
  // from the main article's classification table — on the 2026 Vuelta the stage 2 GC
  // block still carries the stage 1 leader time, which would contradict the gaps
  // rendered beneath it.
  stageArticleBlocks.forEach((block) => readResultBlock(block, false));

  const routeStages = extractRouteStages(rawText, teamNames);
  const routeStageWinners = routeStages.filter((entry) => entry.winner);
  const classificationTableGcResults = extractClassificationTableGcSnapshots(rawText);
  const leadershipGcResults = extractStageLeadershipGcSnapshots(rawText);
  const classificationLeaders = extractClassificationLeadership(rawText, teamNames);
  const stages = buildStageHistory(routeStageWinners, stageResults);
  // The most recent raced stage is simply the last history entry, so the card's
  // headline stage and its stage selector can never disagree about which stage is
  // current or about how deep that stage's result is.
  const latestStageEntry = stages[stages.length - 1] || null;
  const latestStage = latestStageEntry
    ? {
        stageNumber: latestStageEntry.number,
        stageOrder: latestStageEntry.order,
        stageLabel: latestStageEntry.label,
        standings: latestStageEntry.standings,
      }
    : null;
  // Ordering matters on ties: the {{cycling result}} blocks and the classification
  // tables carry full standings, while the leadership table only yields the leader.
  const latestGc =
    [...gcResults, ...classificationTableGcResults, ...leadershipGcResults].sort(
      (left, right) => right.stageNumber - left.stageNumber,
    )[0] || null;
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
    stages,
    ...(routeStages.length > 0 ? { route: buildRouteDetails(routeStages) } : {}),
    completedStages: Math.max(
      latestGc?.stageNumber || 0,
      latestStage?.stageOrder || 0,
      routeStageWinners.reduce((max, entry) => Math.max(max, entry.stageOrder), 0),
      classificationTableGcResults.reduce((max, entry) => Math.max(max, entry.stageNumber), 0),
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
    ...(classificationLeaders
      ? {
          classificationLeaders: fillClassificationLeaderCountryCodes(classificationLeaders, [
            latestGc?.standings,
            ...stages.map((stage) => stage.standings),
            overallResult,
            finalStandings,
          ]),
        }
      : {}),
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

  if (race?.pageTitle === "2026 Giro d'Italia Women") {
    const correctedStageTwoStandings = buildStandings([
      "Elisa Balsamo",
      "Lara Gillespie",
      "Chiara Consonni",
      "Charlotte Kool",
      "Barbara Guarischi",
    ]);
    const correctedStageTwoGcStandings = buildStandings([
      { rider: "Elisa Balsamo" },
      { rider: "Lara Gillespie", gap: "+0:08" },
      { rider: "Chiara Consonni", gap: "+0:12" },
      { rider: "Charlotte Kool", gap: "+0:20" },
      { rider: "Linda Zanetti", gap: "+0:20" },
    ]);
    const latestStageNumber = snapshot.latestStage?.number || 0;
    const gcStageNumber = snapshot.generalClassification?.stageNumber || 0;
    const hasSparseStageTwoData =
      (latestStageNumber > 0 && latestStageNumber <= 2 && (snapshot.latestStage?.standings?.length || 0) < 5) ||
      (gcStageNumber > 0 && gcStageNumber <= 2 && (snapshot.generalClassification?.standings?.length || 0) < 5);

    if (hasSparseStageTwoData) {
      return {
        ...snapshot,
        totalStages: snapshot.totalStages || 9,
        completedStages: Math.max(snapshot.completedStages || 0, 2),
        latestStage: {
          number: 2,
          label: "Stage 2",
          standings: correctedStageTwoStandings,
          winner: correctedStageTwoStandings[0]?.rider || "",
        },
        generalClassification: {
          stageNumber: 2,
          standings: correctedStageTwoGcStandings,
          leader: correctedStageTwoGcStandings[0]?.rider || "",
        },
        overallResult: [],
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

function inferStageCountFromDates(race) {
  if (!isMultiDayRace(race)) {
    return 0;
  }

  const durationMs = race.endDate.getTime() - race.startDate.getTime();
  return Math.max(0, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);
}

function hasFreshnessSensitiveRaceData(data) {
  if ((data?.liveStageRaces?.length || data?.europeTourLiveStageRaces?.length || 0) > 0) {
    return true;
  }

  return [
    ...(data?.recentResults || []),
    ...(data?.finalizedStageRaces || []),
    ...(data?.europeTourRecentResults || []),
  ].some((race) => race?.finishedToday);
}

function getRaceDataCacheTtlMs(data) {
  return hasFreshnessSensitiveRaceData(data)
    ? LIVE_RACE_CACHE_TTL_MS
    : CACHE_TTL_MS;
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

function toUtcDateOnly(value) {
  const date =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : null;

  return date && !Number.isNaN(date.getTime())
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    : null;
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

const LA_VUELTA_FEMENINA_RANKINGS_URL = "https://www.lavueltafemenina.es/en/rankings";
const TOUR_AUVERGNE_RHONE_ALPES_RANKINGS_URL = "https://www.tour-auvergne-rhone-alpes.fr/en/rankings";

function extractAsoRankingsAjaxUrl(html, baseUrl, type) {
  const decoded = decodeHtml(String(html || ""));
  const path =
    decoded.match(new RegExp(`data-tabs-ajax="([^"]+\\/${type}\\/[^"]+\\/subtab)"`))?.[1] ||
    decoded.match(new RegExp(`"${type}":"([^"]+)"`))?.[1] ||
    "";

  if (!path) {
    return "";
  }

  return new URL(path.replace(/\\\//g, "/"), baseUrl).toString();
}

async function fetchResolvedAsoRankingsAjaxHtml(url, baseUrl, type, fetchHtml = fetchText) {
  if (!url) {
    return "";
  }

  const html = await fetchHtml(url);
  // The first response usually already carries the table, in which case the nested
  // subtab is a wasted request. Only follow it when this response has no usable rows
  // (ASO sometimes serves a "no rank available" stub), and keep the original when the
  // subtab turns out to be empty too, so a good response is never traded for a stub.
  if (parseLetourOfficialStandings(html, { rankingType: type }).length > 0) {
    return html;
  }

  const nestedUrl = extractAsoRankingsAjaxUrl(html, baseUrl, type);
  if (!nestedUrl || nestedUrl === url) {
    return html;
  }

  const nestedHtml = await fetchHtml(nestedUrl);
  return parseLetourOfficialStandings(nestedHtml, { rankingType: type }).length > 0 ? nestedHtml : html;
}

function parseAsoOfficialStandings(html, options = {}) {
  const riderCellPattern = options.riderCellPattern || /<td class="runner[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/i;
  const includeCountry = options.includeCountry !== false;
  const tbodyMatch = String(html || "").match(/<table class="rankingTable[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  return [...tbodyMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const row = match[1];
      const place = Number.parseInt(row.match(/<td class="is-alignCenter">(\d+)<\/td>/i)?.[1] || "", 10);
      const label = toTitleCaseWords(cleanFeedText(row.match(riderCellPattern)?.[1] || ""));
      const countryCode = includeCountry
        ? normalizeCountryCode((row.match(/data-class="flag--([a-z]{2,3})"/i)?.[1] || "").toUpperCase())
        : "";
      const timeCells = [...row.matchAll(/<td class="is-alignCenter time">\s*([\s\S]*?)\s*<\/td>/gi)]
        .map((cell) => decodeHtml(cleanFeedText(cell[1] || "")));
      const time = normalizeStandingTime(timeCells[0] || "");
      const gap = normalizeStandingGap(timeCells[1] || "");
      return Number.isInteger(place) && label ? buildStandingEntry(place, label, countryCode, gap, time) : null;
    })
    .filter(Boolean)
    .slice(0, MAX_RESULT_RIDERS);
}

function resolveAsoStageStandings(stageHtml, teamStageHtml = "", options = {}) {
  const tttFallbackPattern = options.tttFallbackPattern || /No edition of individual classification during a Team Time Trial/i;
  if (tttFallbackPattern.test(stageHtml || "")) {
    return parseAsoOfficialStandings(teamStageHtml, {
      riderCellPattern: /<td class="break-line is-sticky team[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/i,
      includeCountry: false,
    });
  }

  return parseAsoOfficialStandings(stageHtml);
}

function extractLaVueltaFemeninaOfficialStageInfo(html, race) {
  const text = String(html || "");
  const titleStageNumber = Number.parseInt(
    text.match(/Official classifications of La Vuelta Femenina\s*-\s*Stage\s*(\d+)/i)?.[1] || "",
    10,
  );
  const listedStages = [...text.matchAll(/stage-select__option__stage">\s*Stage\s*(\d+)\s*</gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite);
  const totalStages = Math.max(...listedStages, inferStageCountFromDates(race) || 0);
  const stageNumber =
    titleStageNumber ||
    listedStages.reduce((max, value) => Math.max(max, value), 0) ||
    Number.parseInt(text.match(/2026 Rankings\s*-\s*Stage\s*(\d+)/i)?.[1] || "", 10) ||
    0;

  return {
    stageNumber,
    totalStages,
  };
}

function extractLaVueltaFemeninaGeneralAjaxUrl(html) {
  return extractAsoRankingsAjaxUrl(html, LA_VUELTA_FEMENINA_RANKINGS_URL, "itg");
}

function extractLaVueltaFemeninaStageAjaxUrl(html) {
  return extractAsoRankingsAjaxUrl(html, LA_VUELTA_FEMENINA_RANKINGS_URL, "ite");
}

function parseLaVueltaFemeninaOfficialStandings(html) {
  return parseAsoOfficialStandings(html);
}

function buildLaVueltaFemeninaOfficialSnapshot(rankingsHtml, stageHtml, generalHtml, race) {
  const { stageNumber, totalStages } = extractLaVueltaFemeninaOfficialStageInfo(rankingsHtml, race);
  const stageStandings = parseLaVueltaFemeninaOfficialStandings(stageHtml);
  const gcStandings = parseLaVueltaFemeninaOfficialStandings(generalHtml);

  if (stageNumber <= 0 || (stageStandings.length === 0 && gcStandings.length === 0)) {
    return null;
  }

  return {
    totalStages: totalStages || inferStageCountFromDates(race) || 7,
    completedStages: stageNumber,
    latestStage:
      stageStandings.length > 0
        ? {
            number: stageNumber,
            label: `Stage ${stageNumber}`,
            standings: stageStandings,
            ...getWinnerDetails(stageStandings),
          }
        : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber,
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function fetchLaVueltaFemeninaOfficialSnapshot(race) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate) || new Date(Date.UTC(2026, 4, 3));
  const endUtc = toUtcDateOnly(race?.endDate) || new Date(Date.UTC(2026, 4, 9));

  if (
    race?.pageTitle !== "2026 La Vuelta Femenina" ||
    getRaceYear(race) !== 2026 ||
    todayUtc.getTime() < startUtc.getTime() ||
    todayUtc.getTime() > endUtc.getTime()
  ) {
    return null;
  }

  const rankingsHtml = await fetchText(LA_VUELTA_FEMENINA_RANKINGS_URL);
  const stageUrl = extractLaVueltaFemeninaStageAjaxUrl(rankingsHtml);
  const generalUrl = extractLaVueltaFemeninaGeneralAjaxUrl(rankingsHtml);
  const stageHtml = stageUrl ? await fetchText(stageUrl) : rankingsHtml;
  const generalHtml = generalUrl ? await fetchText(generalUrl) : "";
  return buildLaVueltaFemeninaOfficialSnapshot(rankingsHtml, stageHtml, generalHtml, race);
}

function extractTourAuvergneRhoneAlpesOfficialStageInfo(html, race) {
  const text = String(html || "");
  const titleStageNumber = Number.parseInt(
    text.match(/Official classifications of Tour Auvergne-Rh[oô]ne-Alpes\s*-\s*Stage\s*(\d+)/i)?.[1] || "",
    10,
  );
  const listedStages = [...text.matchAll(/stage-select__option__stage">\s*Stage\s*(\d+)\s*</gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite);
  const totalStages = Math.max(...listedStages, inferStageCountFromDates(race) || 0);
  const stageNumber =
    titleStageNumber ||
    listedStages.reduce((max, value) => Math.max(max, value), 0) ||
    Number.parseInt(text.match(/2026 Rankings\s*-\s*Stage\s*(\d+)/i)?.[1] || "", 10) ||
    0;

  return {
    stageNumber,
    totalStages,
  };
}

function extractTourAuvergneRhoneAlpesGeneralAjaxUrl(html) {
  return extractAsoRankingsAjaxUrl(html, TOUR_AUVERGNE_RHONE_ALPES_RANKINGS_URL, "itg");
}

function extractTourAuvergneRhoneAlpesStageAjaxUrl(html) {
  return extractAsoRankingsAjaxUrl(html, TOUR_AUVERGNE_RHONE_ALPES_RANKINGS_URL, "ite");
}

function extractTourAuvergneRhoneAlpesTeamStageAjaxUrl(html) {
  return extractAsoRankingsAjaxUrl(html, TOUR_AUVERGNE_RHONE_ALPES_RANKINGS_URL, "ete");
}

function parseTourAuvergneRhoneAlpesOfficialStandings(html) {
  return parseAsoOfficialStandings(html);
}

function buildTourAuvergneRhoneAlpesOfficialSnapshot(rankingsHtml, stageHtml, teamStageHtml, generalHtml, race) {
  const { stageNumber, totalStages } = extractTourAuvergneRhoneAlpesOfficialStageInfo(rankingsHtml, race);
  const stageStandings = resolveAsoStageStandings(stageHtml, teamStageHtml);
  const gcStandings = parseTourAuvergneRhoneAlpesOfficialStandings(generalHtml);

  if (stageNumber <= 0 || (stageStandings.length === 0 && gcStandings.length === 0)) {
    return null;
  }

  return {
    totalStages: totalStages || inferStageCountFromDates(race) || 8,
    completedStages: stageNumber,
    latestStage:
      stageStandings.length > 0
        ? {
            number: stageNumber,
            label: `Stage ${stageNumber}`,
            standings: stageStandings,
            ...getWinnerDetails(stageStandings),
          }
        : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber,
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function fetchTourAuvergneRhoneAlpesOfficialSnapshot(race, fetchHtml = fetchText) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    race?.pageTitle !== "2026 Tour Auvergne-Rhône-Alpes" ||
    getRaceYear(race) !== 2026 ||
    !startUtc ||
    !endUtc ||
    todayUtc.getTime() < startUtc.getTime()
  ) {
    return null;
  }

  const rankingsHtml = await fetchHtml(TOUR_AUVERGNE_RHONE_ALPES_RANKINGS_URL);
  const stageUrl = extractTourAuvergneRhoneAlpesStageAjaxUrl(rankingsHtml);
  const teamStageUrl = extractTourAuvergneRhoneAlpesTeamStageAjaxUrl(rankingsHtml);
  const generalUrl = extractTourAuvergneRhoneAlpesGeneralAjaxUrl(rankingsHtml);
  const stageHtml = stageUrl ? await fetchHtml(stageUrl) : "";
  const teamStageHtml = teamStageUrl ? await fetchHtml(teamStageUrl) : "";
  const generalHtml = generalUrl ? await fetchHtml(generalUrl) : "";
  return buildTourAuvergneRhoneAlpesOfficialSnapshot(rankingsHtml, stageHtml, teamStageHtml, generalHtml, race);
}

const TOUR_DE_FRANCE_RANKINGS_URL = "https://www.letour.fr/en/rankings";
const TOUR_DE_FRANCE_FEMMES_RANKINGS_URL = "https://www.letourfemmes.fr/en/rankings";
const VUELTA_A_ESPANA_RANKINGS_URL = "https://www.lavuelta.es/en/rankings";

// letour.fr and letourfemmes.fr are the same ASO rankings deployment, so both races
// share every parser below and differ only in entry point, page title and stage count.
const TOUR_DE_FRANCE_RANKINGS_SOURCE = {
  pageTitle: "2026 Tour de France",
  rankingsUrl: TOUR_DE_FRANCE_RANKINGS_URL,
  // Anchored on "France -" so the men's page title never matches the Femmes edition.
  titlePattern: /Official classifications of Tour de France\s*\d*\s*-\s*Stage\s*(\d+)/i,
  defaultTotalStages: 21,
};
const TOUR_DE_FRANCE_FEMMES_RANKINGS_SOURCE = {
  pageTitle: "2026 Tour de France Femmes",
  rankingsUrl: TOUR_DE_FRANCE_FEMMES_RANKINGS_URL,
  titlePattern: /Official classifications of Tour de France Femmes\s*\d*\s*-\s*Stage\s*(\d+)/i,
  defaultTotalStages: 9,
};
// lavuelta.es is the same ASO rankings deployment again. The Vuelta's own Wikipedia
// article publishes each stage result a day before it refreshes the classification
// tables, so without this provider the GC is dropped as stale every evening of the
// race and the card renders a stage with no overall standings behind it.
const VUELTA_A_ESPANA_RANKINGS_SOURCE = {
  pageTitle: "2026 Vuelta a España",
  rankingsUrl: VUELTA_A_ESPANA_RANKINGS_URL,
  // The page titles itself "La Vuelta", not "Vuelta a España". Anchoring the dash
  // straight after the optional year keeps this from matching the Femenina edition,
  // whose title reads "Official classifications of La Vuelta Femenina - Stage n".
  titlePattern: /Official classifications of La Vuelta\s*\d*\s*-\s*Stage\s*(\d+)/i,
  defaultTotalStages: 21,
};

// letour.fr runs the same ASO rankings platform as the Tour Auvergne / La Vuelta
// Femenina providers, but the current markup keeps the rank inside a <span> and
// the rider name only in the picture `alt` attribute (no anchor), so it needs a
// dedicated row parser rather than the shared parseAsoOfficialStandings helper.
function parseLetourOfficialStandings(html, options = {}) {
  const tbodyMatch = String(html || "").match(/<table class="rankingTable[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return [];
  }

  const expectedRankingType = String(options.rankingType || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  // The "rankingTable::<TYPE>" marker lives in the rider/team profile anchor, and some
  // ASO markup variants render rows without that anchor at all (see above). Only
  // enforce the type filter when this table carries markers, so an untagged variant
  // degrades to the previous unfiltered behavior instead of parsing to nothing.
  const hasRankingTypeMarkers = /RANKINGTABLE::/i.test(tbodyMatch[1]);

  return [...tbodyMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const row = match[1];
      if (
        expectedRankingType &&
        hasRankingTypeMarkers &&
        !row.toUpperCase().includes(`RANKINGTABLE::${expectedRankingType}`)
      ) {
        return null;
      }

      const place = Number.parseInt(
        row.match(/<td class="rankingTables__row__position[^"]*"[^>]*>\s*(?:<span[^>]*>)?\s*(\d+)/i)?.[1] || "",
        10,
      );
      // Every rider links to /en/rider/{id}/{team}/{first-last}, whose final slug
      // carries the full name even for riders without a jersey photo `alt` (the
      // visible cell text is otherwise abbreviated to "T. Pogacar").
      const slugName = (row.match(/\/en\/rider\/\d+\/[^/]+\/([a-z0-9-]+)/i)?.[1] || "").replace(/-/g, " ").trim();
      const altName = cleanFeedText(row.match(/<img[^>]*\balt="([^"]+)"/i)?.[1] || "");
      const profileText = cleanFeedText(row.match(/<td class="[^"]*\brunner\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");
      // A team time trial classification lists teams, not riders: the profile cell
      // carries a `team` class and links to /en/team/... with the team name in the
      // anchor text (e.g. "TEAM VISMA | LEASE A BIKE") rather than a rider slug.
      const teamName = cleanFeedText(
        row.match(/<td class="[^"]*\bteam\b[^"]*"[^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "",
      );
      const rider = toTitleCaseWords(slugName || altName || profileText || teamName);
      const countryCode = normalizeCountryCode((row.match(/flag--([a-z]{2,3})\b/i)?.[1] || "").toUpperCase());
      const timeCells = [...row.matchAll(/<td class="is-alignCenter time">\s*([\s\S]*?)\s*<\/td>/gi)].map((cell) =>
        decodeHtml(cleanFeedText(cell[1] || "")),
      );
      const time = normalizeStandingTime(timeCells[0] || "");
      const gap = normalizeStandingGap(timeCells[1] || "");
      return Number.isInteger(place) && rider ? buildStandingEntry(place, rider, countryCode, gap, time) : null;
    })
    .filter(Boolean)
    .slice(0, MAX_RESULT_RIDERS);
}

function extractTourDeFranceOfficialStageInfo(html, race, source = TOUR_DE_FRANCE_RANKINGS_SOURCE) {
  const text = String(html || "");
  const titleStageNumber = Number.parseInt(text.match(source.titlePattern)?.[1] || "", 10);
  const listedStages = [...text.matchAll(/stage-select__option__stage">\s*Stage\s*(\d+)\s*</gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite);
  // The "<year> Rankings - Stage <n>" header reflects the edition and stage the
  // page is actually displaying. Until the current edition's first stage is
  // published, letour.fr defaults this to the previous edition's final GC, so we
  // capture the year here to reject stale prior-edition data downstream.
  const headerMatch = text.match(/(20\d\d)\s+Rankings\s*-\s*Stage\s*(\d+)/i);
  const editionYear = headerMatch ? Number.parseInt(headerMatch[1], 10) : 0;
  const headerStageNumber = headerMatch ? Number.parseInt(headerMatch[2], 10) : 0;
  // The stage menu is authoritative for a Grand Tour; calendar-day inference would
  // over-count because of rest days, so only use it when the menu is unavailable.
  const totalStages =
    listedStages.length > 0
      ? Math.max(...listedStages)
      : inferStageCountFromDates(race) || source.defaultTotalStages;
  const stageNumber =
    titleStageNumber ||
    headerStageNumber ||
    listedStages.reduce((max, value) => Math.max(max, value), 0) ||
    0;

  return {
    stageNumber,
    totalStages,
    editionYear,
  };
}

function extractTourDeFranceGeneralAjaxUrl(html, rankingsUrl = TOUR_DE_FRANCE_RANKINGS_URL) {
  return extractAsoRankingsAjaxUrl(html, rankingsUrl, "itg");
}

function extractTourDeFranceStageAjaxUrl(html, rankingsUrl = TOUR_DE_FRANCE_RANKINGS_URL) {
  return extractAsoRankingsAjaxUrl(html, rankingsUrl, "ite");
}

function extractTourDeFranceTeamStageAjaxUrl(html, rankingsUrl = TOUR_DE_FRANCE_RANKINGS_URL) {
  return extractAsoRankingsAjaxUrl(html, rankingsUrl, "ete");
}

function resolveLetourStageStandings(stageHtml, teamStageHtml = "") {
  // Normal stages expose an individual stage classification. A team time trial has
  // none (letour.fr may not even offer an "ite" tab, so stageHtml can be empty or a
  // "No edition of individual classification during a Team Time Trial" notice), and
  // the team classification is the meaningful stage result in that case.
  // Ask for each table by type for the same reason the general classification does: if
  // the "ite" endpoint ever serves the rankings shell instead, its inlined general
  // rows would otherwise surface as the stage result and show the GC leader as the
  // stage winner.
  const individualStandings = parseLetourOfficialStandings(stageHtml, { rankingType: "ITE" });
  if (individualStandings.length > 0) {
    return individualStandings;
  }

  return parseLetourOfficialStandings(teamStageHtml, { rankingType: "ETE" });
}

function buildTourDeFranceOfficialSnapshot(
  rankingsHtml,
  stageHtml,
  teamStageHtml,
  generalHtml,
  race,
  source = TOUR_DE_FRANCE_RANKINGS_SOURCE,
) {
  const { stageNumber, totalStages, editionYear } = extractTourDeFranceOfficialStageInfo(
    rankingsHtml,
    race,
    source,
  );
  // letour.fr keeps serving the previous edition's final classification on its
  // rankings page until the current edition's first stage is published. Reject any
  // snapshot whose displayed edition year does not match this race so we never
  // surface last year's Tour as the current result. Once ASO flips the page to the
  // new edition (e.g. "2026 Rankings - Stage 1"), this passes and results appear.
  const raceYear = getRaceYear(race);
  if (editionYear && raceYear && editionYear !== raceYear) {
    return null;
  }
  // The main rankings page renders the general classification table inline, so it
  // is a reliable GC source only when the rows are explicitly tagged as ITG. While
  // a stage tab is active, the same page can inline ITE stage rows instead.
  const stageStandings = resolveLetourStageStandings(stageHtml, teamStageHtml);
  const gcStandings = parseLetourOfficialStandings(generalHtml, { rankingType: "ITG" }) || [];
  const inlineGcStandings =
    gcStandings.length > 0
      ? gcStandings
      : parseLetourOfficialStandings(rankingsHtml, { rankingType: "ITG" });

  if (stageNumber <= 0 || (stageStandings.length === 0 && inlineGcStandings.length === 0)) {
    return null;
  }

  return {
    totalStages: totalStages || inferStageCountFromDates(race) || source.defaultTotalStages,
    completedStages: stageNumber,
    latestStage:
      stageStandings.length > 0
        ? {
            number: stageNumber,
            label: `Stage ${stageNumber}`,
            standings: stageStandings,
            ...getWinnerDetails(stageStandings),
          }
        : null,
    generalClassification:
      inlineGcStandings.length > 0
        ? {
            stageNumber,
            standings: inlineGcStandings,
            ...getLeaderDetails(inlineGcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function fetchAsoTourRankingsSnapshot(race, fetchHtml, source) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    race?.pageTitle !== source.pageTitle ||
    getRaceYear(race) !== 2026 ||
    !startUtc ||
    !endUtc ||
    todayUtc.getTime() < startUtc.getTime()
  ) {
    return null;
  }

  const rankingsHtml = await fetchHtml(source.rankingsUrl);
  const stageUrl = extractTourDeFranceStageAjaxUrl(rankingsHtml, source.rankingsUrl);
  const teamStageUrl = extractTourDeFranceTeamStageAjaxUrl(rankingsHtml, source.rankingsUrl);
  const generalUrl = extractTourDeFranceGeneralAjaxUrl(rankingsHtml, source.rankingsUrl);
  const stageHtml = stageUrl ? await fetchHtml(stageUrl) : "";
  const teamStageHtml = teamStageUrl ? await fetchHtml(teamStageUrl) : "";
  const generalHtml = await fetchResolvedAsoRankingsAjaxHtml(generalUrl, source.rankingsUrl, "itg", fetchHtml);
  return buildTourDeFranceOfficialSnapshot(rankingsHtml, stageHtml, teamStageHtml, generalHtml, race, source);
}

async function fetchTourDeFranceOfficialSnapshot(race, fetchHtml = fetchText) {
  return fetchAsoTourRankingsSnapshot(race, fetchHtml, TOUR_DE_FRANCE_RANKINGS_SOURCE);
}

async function fetchTourDeFranceFemmesOfficialSnapshot(race, fetchHtml = fetchText) {
  return fetchAsoTourRankingsSnapshot(race, fetchHtml, TOUR_DE_FRANCE_FEMMES_RANKINGS_SOURCE);
}

async function fetchVueltaAEspanaOfficialSnapshot(race, fetchHtml = fetchText) {
  return fetchAsoTourRankingsSnapshot(race, fetchHtml, VUELTA_A_ESPANA_RANKINGS_SOURCE);
}

function getStageRaceSnapshotQuality(snapshot) {
  if (!snapshot) {
    return [-1, -1, -1, -1];
  }

  return [
    getStageRaceSnapshotProgress(snapshot),
    Number(snapshot.generalClassification?.stageNumber || snapshot.latestStage?.number || 0),
    Math.max(snapshot.generalClassification?.standings?.length || 0, snapshot.overallResult?.length || 0),
    Number(snapshot.latestStage?.standings?.length || 0),
  ];
}

function getStageRaceFieldProgress(field) {
  if (!field) {
    return 0;
  }

  if (field.label === "Prologue") {
    return 0.5;
  }

  return Number(field.stageNumber || field.number || 0);
}

function getStageRaceSnapshotProgress(snapshot) {
  if (!snapshot) {
    return 0;
  }

  return Math.max(
    Number(snapshot.completedStages || 0),
    getStageRaceFieldProgress(snapshot.latestStage),
    getStageRaceFieldProgress(snapshot.generalClassification),
  );
}

function getLiveStageRaceFreshnessFloor(race, now = new Date()) {
  if (!isMultiDayRace(race)) {
    return 0;
  }

  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);
  if (!startUtc || !endUtc) {
    return 0;
  }

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (todayUtc.getTime() < startUtc.getTime()) {
    return 0;
  }

  const totalStages = inferStageCountFromDates(race);
  if (todayUtc.getTime() > endUtc.getTime()) {
    return totalStages;
  }

  const elapsedDays = Math.floor((todayUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  // Allow a small buffer for rest days and slower official updates so an
  // in-progress grand tour does not get treated as stale and lose to a
  // future-stage placeholder parsed from a route table.
  return Math.max(0, Math.min(totalStages || elapsedDays, elapsedDays - 2));
}

const ROUTE_DATE_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function findRouteDateMonth(word) {
  const normalized = String(word || "").toLowerCase();
  if (normalized.length < 3) {
    return -1;
  }

  return ROUTE_DATE_MONTHS.findIndex((name) => name.startsWith(normalized));
}

// Route tables write a stage's date as "3 September", occasionally "September 3" or
// with a weekday or year attached. Resolve it against the race's year; a cell that
// names no recognisable month is unknown rather than guessed.
function parseRouteStageDate(value, year) {
  const text = cleanWikiText(value).toLowerCase();
  const explicitYear = Number.parseInt(text.match(/\b(20\d\d)\b/)?.[1] || "", 10);
  const resolvedYear = explicitYear || Number(year);
  if (!Number.isFinite(resolvedYear) || resolvedYear <= 0) {
    return null;
  }

  for (const match of text.matchAll(/\b(\d{1,2})\s+([a-z]+)\b/g)) {
    const month = findRouteDateMonth(match[2]);
    if (month >= 0) {
      return new Date(Date.UTC(resolvedYear, month, Number(match[1])));
    }
  }

  for (const match of text.matchAll(/\b([a-z]+)\s+(\d{1,2})\b/g)) {
    const month = findRouteDateMonth(match[1]);
    if (month >= 0) {
      return new Date(Date.UTC(resolvedYear, month, Number(match[2])));
    }
  }

  return null;
}

// The mirror image of the freshness floor: a stage the calendar has not reached yet
// cannot have a result or a classification "after" it. Wikipedia's 2026 Vuelta article
// captioned its stage-12 general classification "after stage 13" the evening stage 12
// finished, and the higher number read as the fresher of the two GCs on offer, so the
// card announced a stage that would not be raced until the next day. Two bounds apply:
// no stage can outrun the days elapsed since the start, and a route-table stage dated
// after today has not happened. The route only ever lowers the bound for stages it
// lists, so a final stage the table omits is still accepted on its own day.
function isStageRaceProgressPlausible(progress, race, route = [], now = new Date()) {
  if (!isMultiDayRace(race) || !(progress > 0)) {
    return true;
  }

  const startUtc = toUtcDateOnly(race.startDate);
  const endUtc = toUtcDateOnly(race.endDate);
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (todayUtc.getTime() > endUtc.getTime()) {
    return true;
  }

  if (todayUtc.getTime() < startUtc.getTime()) {
    return false;
  }

  const elapsedDays = Math.floor((todayUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (progress > elapsedDays) {
    return false;
  }

  const raceYear = getRaceYear(race);
  return !(Array.isArray(route) ? route : []).some((stage) => {
    if (!stage || getStageRaceFieldProgress(stage) !== progress) {
      return false;
    }

    const stageDate = parseRouteStageDate(stage.date, raceYear);
    return Boolean(stageDate) && stageDate.getTime() > todayUtc.getTime();
  });
}

function choosePreferredByQuality(primary, secondary, getQuality) {
  const primaryQuality = getQuality(primary);
  const secondaryQuality = getQuality(secondary);

  for (let index = 0; index < primaryQuality.length; index += 1) {
    if (primaryQuality[index] !== secondaryQuality[index]) {
      return primaryQuality[index] > secondaryQuality[index] ? primary : secondary;
    }
  }

  return primary || secondary || null;
}

function getStageRaceSnapshotFieldQuality(field, snapshot, race, fieldType, now = new Date(), route = []) {
  if (!field) {
    return [-1, -1, -1, -1, -1];
  }

  const floor = getLiveStageRaceFreshnessFloor(race, now);
  const progress =
    fieldType === "overallResult"
      ? getStageRaceSnapshotProgress(snapshot)
      : getStageRaceFieldProgress(field);
  const standingsLength = Array.isArray(field?.standings) ? field.standings.length : Array.isArray(field) ? field.length : 0;
  const suspiciousSparseJump =
    floor > 0 &&
    standingsLength <= 1 &&
    progress > floor + 2;

  // A field claiming a stage the calendar has not reached ranks below a stale one:
  // stale standings are at least real standings.
  return [
    Number(isStageRaceProgressPlausible(progress, race, route, now)),
    Number(floor <= 0 || progress >= floor),
    Number(!suspiciousSparseJump),
    progress,
    standingsLength,
  ];
}

function annotateStageRaceSnapshotSource(snapshot, sourceId) {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    _sourceId: sourceId || snapshot._sourceId || "",
  };
}

function getStageRaceFieldSourceId(field, primaryField, primarySnapshot, secondarySnapshot) {
  if (!field) {
    return "";
  }

  if (primaryField && field === primaryField) {
    return primarySnapshot?._sourceId || "";
  }

  if (secondarySnapshot) {
    return secondarySnapshot._sourceId || "";
  }

  return "";
}

// An official provider reports only the current stage, but usually reports it far
// better than the route table does: deeper standings, and sometimes a stage the route
// table omits altogether — the 2026 Tour's final stage is absent from its route table
// yet letour.fr has it five deep. Folding it in keeps the stage strip from contradicting
// the card's own headline stage, which is what it did when the strip rendered only the
// Wikipedia history.
function mergeLatestStageIntoHistory(stages, latestStage) {
  const history = Array.isArray(stages) ? stages : [];
  const number = Number(latestStage?.number);
  const standings = Array.isArray(latestStage?.standings) ? latestStage.standings : [];
  if (!Number.isFinite(number) || standings.length === 0) {
    return history;
  }

  const existing = history.find((stage) => stage.number === number) || null;
  if (existing && existing.standings.length >= standings.length) {
    return history;
  }

  // Spread the existing entry first so the route table's date and course survive, along
  // with any finish video already resolved for that stage.
  const merged = {
    ...(existing || {}),
    number,
    order: existing?.order ?? number,
    label: existing?.label || latestStage.label || `Stage ${number}`,
    standings,
    ...getWinnerDetails(standings),
    ...(existing?.finishVideoUrl || latestStage.finishVideoUrl
      ? { finishVideoUrl: existing?.finishVideoUrl || latestStage.finishVideoUrl }
      : {}),
  };

  return [...history.filter((stage) => stage.number !== number), merged].sort(
    (left, right) => left.order - right.order,
  );
}

function getStageHistoryQuality(stages) {
  const entries = Array.isArray(stages) ? stages : [];

  return [
    entries.filter((entry) => (entry?.standings?.length || 0) > 1).length,
    entries.filter((entry) => (entry?.standings?.length || 0) > 0).length,
    entries.length,
  ];
}

function mergeStageRaceSnapshots(primary, secondary, race, now = new Date()) {
  // Only the Wikipedia side describes the route (distance, type, course), so whichever
  // snapshot carries one is the route for both. Its stage dates also bound how far the
  // race can plausibly have progressed, so it is resolved before any field is ranked.
  const route = [primary?.route, secondary?.route].find((entry) => Array.isArray(entry) && entry.length > 0) || [];
  const isPlausibleProgress = (progress) => isStageRaceProgressPlausible(progress, race, route, now);
  const preferredSnapshot = choosePreferredByQuality(primary, secondary, (snapshot) => {
    if (!snapshot) {
      return [-1, -1, -1, -1, -1, -1];
    }

    const floor = getLiveStageRaceFreshnessFloor(race, now);
    const snapshotQuality = getStageRaceSnapshotQuality(snapshot);
    return [
      Number(isPlausibleProgress(getStageRaceSnapshotProgress(snapshot))),
      Number(floor <= 0 || getStageRaceSnapshotProgress(snapshot) >= floor),
      snapshotQuality[2],
      snapshotQuality[3],
      snapshotQuality[0],
      snapshotQuality[1],
    ];
  });

  let latestStage = choosePreferredByQuality(primary?.latestStage, secondary?.latestStage, (field) =>
    getStageRaceSnapshotFieldQuality(
      field,
      field === primary?.latestStage ? primary : secondary,
      race,
      "latestStage",
      now,
      route,
    ),
  );
  let generalClassification = choosePreferredByQuality(
    primary?.generalClassification,
    secondary?.generalClassification,
    (field) =>
      getStageRaceSnapshotFieldQuality(
        field,
        field === primary?.generalClassification ? primary : secondary,
        race,
        "generalClassification",
        now,
        route,
      ),
  );
  const overallResult = choosePreferredByQuality(primary?.overallResult, secondary?.overallResult, (field) =>
    getStageRaceSnapshotFieldQuality(
      field,
      Array.isArray(field) && field === primary?.overallResult ? primary : secondary,
      race,
      "overallResult",
      now,
      route,
    ),
  );
  // Ranking only demotes an implausible field; when it is the sole candidate it still
  // wins, so drop it outright rather than announce a stage that has not been raced.
  if (latestStage && !isPlausibleProgress(getStageRaceFieldProgress(latestStage))) {
    latestStage = null;
  }

  if (generalClassification && !isPlausibleProgress(getStageRaceFieldProgress(generalClassification))) {
    generalClassification = null;
  }

  // Only Wikipedia describes the jersey holders, so this is usually a pass-through.
  // Unlike the GC, a list one stage behind the official provider is kept and labelled
  // with its own stage rather than dropped: it does not contradict anything above it.
  let classificationLeaders = choosePreferredByQuality(
    primary?.classificationLeaders,
    secondary?.classificationLeaders,
    (field) =>
      field
        ? [
            Number(isPlausibleProgress(getStageRaceFieldProgress(field))),
            getStageRaceFieldProgress(field),
            Array.isArray(field.entries) ? field.entries.length : 0,
          ]
        : [-1, -1, -1],
  );
  if (classificationLeaders && !isPlausibleProgress(getStageRaceFieldProgress(classificationLeaders))) {
    classificationLeaders = null;
  }

  // Official providers report only the current stage, so the Wikipedia-derived
  // history is normally the only side carrying one. Prefer whichever side knows more
  // stages in depth rather than whichever snapshot won overall.
  const stages = choosePreferredByQuality(primary?.stages, secondary?.stages, getStageHistoryQuality);
  const totalStages = Math.max(
    Number(primary?.totalStages || 0),
    Number(secondary?.totalStages || 0),
  );
  const fallbackTotalStages = inferStageCountFromDates(race) || 0;
  const resolvedTotalStages = totalStages || fallbackTotalStages;
  // A snapshot's own completed-stage count can carry the same implausible claim its
  // fields did (Wikipedia derives it from the mis-captioned table), so it only counts
  // when the calendar allows it.
  const completedStages = Math.max(
    0,
    ...[
      getStageRaceSnapshotProgress(preferredSnapshot),
      getStageRaceFieldProgress(latestStage),
      getStageRaceFieldProgress(generalClassification),
    ].filter((progress) => isPlausibleProgress(progress)),
  );

  if ((isMultiDayRace(race) || resolvedTotalStages > 1) && completedStages > 0) {
    if (getStageRaceFieldProgress(latestStage) > 0 && getStageRaceFieldProgress(latestStage) < completedStages) {
      latestStage = null;
    }

    if (
      getStageRaceFieldProgress(generalClassification) > 0 &&
      getStageRaceFieldProgress(generalClassification) < completedStages
    ) {
      generalClassification = null;
    }
  }

  // An official provider's standings carry flags Wikipedia's bare links do not.
  classificationLeaders = fillClassificationLeaderCountryCodes(classificationLeaders, [
    generalClassification?.standings,
    latestStage?.standings,
    ...(Array.isArray(stages) ? stages.map((stage) => stage?.standings) : []),
  ]);

  const latestStageSourceId = getStageRaceFieldSourceId(
    latestStage,
    primary?.latestStage,
    primary,
    secondary,
  );
  const generalClassificationSourceId = getStageRaceFieldSourceId(
    generalClassification,
    primary?.generalClassification,
    primary,
    secondary,
  );
  const overallResultSourceId = getStageRaceFieldSourceId(
    overallResult,
    primary?.overallResult,
    primary,
    secondary,
  );

  return preferredSnapshot || latestStage || generalClassification || (overallResult?.length || 0) > 0
    ? {
        totalStages: resolvedTotalStages,
        stages: applyRouteDetails(mergeLatestStageIntoHistory(stages, latestStage), route),
        ...(route.length > 0 ? { route } : {}),
        completedStages,
        latestStage: latestStage
          ? {
              ...applyRouteDetails([latestStage], route)[0],
              ...getWinnerDetails(latestStage.standings),
            }
          : null,
        generalClassification: generalClassification
          ? {
              ...generalClassification,
              ...getLeaderDetails(generalClassification.standings),
            }
          : null,
        overallResult: Array.isArray(overallResult) ? overallResult : [],
        ...(classificationLeaders ? { classificationLeaders } : {}),
        provenance: {
          snapshot: preferredSnapshot?._sourceId || "",
          latestStage: latestStageSourceId,
          generalClassification: generalClassificationSourceId,
          overallResult: overallResultSourceId,
        },
      }
    : null;
}

function selectPreferredStageRaceSnapshot(primary, secondary, race = null, now = new Date()) {
  if (!race) {
    return choosePreferredByQuality(primary, secondary, getStageRaceSnapshotQuality);
  }

  return mergeStageRaceSnapshots(primary, secondary, race, now);
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

  const ordinalDigitMatch = normalized.match(/\b(\d+)(?:a|o)\s+etapa\b/);
  if (ordinalDigitMatch) {
    return Number(ordinalDigitMatch[1]);
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

function normalizeStandingGap(value) {
  const cleaned = cleanFeedText(String(value || ""))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned === "0:00" || cleaned === "+ 0:00" || cleaned === "+0:00") {
    return "";
  }

  // ASO markup writes seconds as two apostrophes ("12' 34''") while Wikipedia's
  // {{cyclingresult}} cells use a real double quote ("12' 34\""), and a sprint gap
  // is often seconds-only ("+ 9\"") with no minutes part at all.
  const asoMatch = cleaned.match(/\+?\s*(?:(\d+)\s*h\s*)?(?:(\d{1,2})\s*'\s*)?(\d{1,2})\s*(?:''|")/);
  if (asoMatch) {
    const hours = Number.parseInt(asoMatch[1] || "0", 10);
    const minutes = Number.parseInt(asoMatch[2] || "0", 10);
    const seconds = Number.parseInt(asoMatch[3] || "0", 10);

    if (hours === 0 && minutes === 0 && seconds === 0) {
      return "";
    }

    if (hours > 0) {
      return `+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const match = cleaned.match(/\+?\s*(\d+(?::\d{2}){1,2})/);
  return match ? `+${match[1]}` : "";
}

function normalizeStandingTime(value) {
  const cleaned = cleanFeedText(String(value || ""))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned === "-" || cleaned === "0:00") {
    return "";
  }

  const asoMatch = cleaned.match(/(?:(\d+)\s*h\s*)?(?:(\d{1,2})\s*'\s*)?(\d{1,2})\s*(?:''|")/);
  if (asoMatch) {
    const hours = Number.parseInt(asoMatch[1] || "0", 10);
    const minutes = Number.parseInt(asoMatch[2] || "0", 10);
    const seconds = Number.parseInt(asoMatch[3] || "0", 10);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const match = cleaned.match(/\b(\d+(?::\d{2}){1,2})\b/);
  return match ? match[1] : "";
}

function buildStandingEntry(place, rider, countryCode = "", gap = "", time = "") {
  const details =
    rider && typeof rider === "object"
      ? {
          rider: String(rider.rider || "").trim(),
          countryCode: normalizeCountryCode(rider.countryCode || getRiderCountryCode(rider.rider)),
          gap: normalizeStandingGap(rider.gap || ""),
          time: normalizeStandingTime(rider.time || ""),
        }
      : {
          rider: String(rider || "").trim(),
          countryCode: normalizeCountryCode(countryCode || getRiderCountryCode(rider)),
          gap: normalizeStandingGap(gap),
          time: normalizeStandingTime(time),
        };

  return details.rider
    ? {
        place: String(place),
        rider: details.rider,
        ...(details.countryCode ? { countryCode: details.countryCode } : {}),
        ...(details.gap ? { gap: details.gap } : {}),
        ...(details.time ? { time: details.time } : {}),
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

function findStaticStageRaceSnapshotData(race) {
  const raceId = getRaceId(race);

  return Object.entries(STATIC_STAGE_RACE_SNAPSHOT_DATA).find(([pageTitle, snapshot]) => {
    if (pageTitle === raceId) {
      return true;
    }

    return Array.isArray(snapshot?.aliases) && snapshot.aliases.includes(raceId);
  })?.[1] || null;
}

function hydrateStoredStageRaceField(field, type) {
  if (!field) {
    return null;
  }

  const standings = buildStandings(field.standings || []);
  if (standings.length === 0) {
    return null;
  }

  return {
    ...field,
    standings,
    ...(type === "latestStage" ? getWinnerDetails(standings) : getLeaderDetails(standings)),
  };
}

function getStaticStageRaceSnapshot(race) {
  const snapshot = findStaticStageRaceSnapshotData(race);
  if (!snapshot || snapshot.year !== getRaceYear(race)) {
    return null;
  }

  return annotateStageRaceSnapshotSource({
    totalStages: snapshot.totalStages,
    completedStages: snapshot.completedStages,
    latestStage: hydrateStoredStageRaceField(snapshot.latestStage, "latestStage"),
    generalClassification: hydrateStoredStageRaceField(snapshot.generalClassification, "generalClassification"),
    overallResult: buildStandings(snapshot.generalClassification?.standings || []),
  }, "static-fallback");
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

function extractVueltaABurgosFeminasStageStandings(text) {
  const cleanedText = cleanFeedText(text);
  const finishSegmentMatch = cleanedText.match(/meta:\s*1[ªa][^.]*/iu);
  const finishSegment = finishSegmentMatch ? finishSegmentMatch[0] : cleanedText;
  const matches = [...finishSegment.matchAll(/([1-5])[ªa]\s+\d+\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'’.-]+)/gu)];

  return uniqueStandings(
    matches
      .map((match) => {
        const place = Number(match[1]);
        const rider = resolveKnownRiderName(match[2]);
        return Number.isInteger(place) && rider ? buildStandingEntry(place, rider) : null;
      })
      .filter(Boolean),
  );
}

function extractVueltaABurgosFeminasLiveblogEndpoint(contentHtml) {
  const match = String(contentHtml || "").match(/data-endpoint="([^"]+)"/i);
  return cleanFeedText(match?.[1] || "");
}

function extractVueltaABurgosFeminasLatestMetaUpdateText(payload) {
  const updates = Array.isArray(payload?.updates) ? payload.updates : [];
  const metaUpdate = updates.find((update) => /meta:/i.test(cleanFeedText(update?.content || "")));
  return cleanFeedText(metaUpdate?.content || "");
}

function getKnownVueltaABurgosFeminasGcStandings(stageNumber) {
  if (stageNumber !== 2) {
    return [];
  }

  return [
    buildStandingEntry(1, "Lorena Wiebes"),
    buildStandingEntry(2, "Chiara Consonni", "", "0:14"),
    buildStandingEntry(3, "Elisa Balsamo", "", "0:14"),
    buildStandingEntry(4, "Ally Wollaston", "", "0:16"),
    buildStandingEntry(5, "Dominika Wlodarczyk", "", "0:17"),
  ].filter(Boolean);
}

async function fetchVueltaABurgosFeminasOfficialSnapshot(race) {
  const raceYear = getRaceYear(race);
  const raceWindowStart = race?.startDate instanceof Date ? race.startDate.getTime() - 7 * 24 * 60 * 60 * 1000 : 0;
  const raceWindowEnd = race?.endDate instanceof Date ? race.endDate.getTime() + 2 * 24 * 60 * 60 * 1000 : Number.POSITIVE_INFINITY;
  const params = new URLSearchParams({
    search: "Película",
    per_page: "10",
    _fields: "id,date,title,content,excerpt",
  });
  const posts = await fetchJson(`https://www.vueltaburgos.com/feminas/wp-json/wp/v2/posts?${params.toString()}`);
  const stagePosts = (Array.isArray(posts) ? posts : [])
    .map((post) => {
      const title = cleanFeedText(post?.title?.rendered || "");
      const contentHtml = String(post?.content?.rendered || "");
      const content = cleanFeedText(contentHtml || post?.excerpt?.rendered || "");
      const combinedText = [title, content].join(" ").trim();

      return {
        title,
        contentHtml,
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

  const liveblogEndpoint = extractVueltaABurgosFeminasLiveblogEndpoint(latestStagePost.contentHtml);
  const liveblogPayload = liveblogEndpoint ? await fetchJson(liveblogEndpoint) : null;
  const updateText = extractVueltaABurgosFeminasLatestMetaUpdateText(liveblogPayload);
  const stageStandings = extractVueltaABurgosFeminasStageStandings(updateText || latestStagePost.combinedText);
  if (stageStandings.length === 0) {
    return null;
  }

  const totalStages = inferStageCountFromDates(race);
  const gcStandings =
    latestStagePost.stageNumber === 1
      ? stageStandings
      : getKnownVueltaABurgosFeminasGcStandings(latestStagePost.stageNumber);

  return {
    totalStages,
    completedStages: latestStagePost.stageNumber,
    latestStage: {
      number: latestStagePost.stageNumber,
      label: `Stage ${latestStagePost.stageNumber}`,
      standings: stageStandings,
      ...getWinnerDetails(stageStandings),
    },
    generalClassification: gcStandings.length > 0
      ? {
          stageNumber: latestStagePost.stageNumber,
          standings: gcStandings,
          ...getLeaderDetails(gcStandings),
        }
      : null,
    overallResult: [],
  };
}

const TOUR_OF_GREECE_RESULTS_URL = "https://hellas-tour.gr/portal/en/results-2026";
const GIRO_D_ITALIA_CLASSIFICATIONS_URL = "https://www.giroditalia.it/en/classifiche/";
const GIRO_D_ITALIA_STAGE_RANKINGS_BASE_URL = "https://www.giroditalia.it/en/classifiche/di-tappa/";
const GIRO_D_ITALIA_LIVEFEED_STAGE_BASE_URL = "https://www.giroditalia.it/en/livefeed/tappa/";
const GIRO_D_ITALIA_WOMEN_RANKINGS_URL = "https://www.giroditaliawomen.it/en/rankings/";
const GIRO_D_ITALIA_WOMEN_STAGE_RANKINGS_BASE_URL = "https://www.giroditaliawomen.it/en/rankings/di-tappa/";
const GIRO_D_ITALIA_WOMEN_VIDEO_URL = "https://www.giroditaliawomen.it/en/video/";

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

function parseGiroDItaliaClassificationStandings(html, category) {
  const normalized = String(html || "").replace(/</g, "\n<");
  const blockMatch = normalized.match(
    new RegExp(
      `data-category="${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?<div class="table type-[^"]+">([\\s\\S]*?)(?:<div class="single-tab js-tab-classifica-|<div class="single-tab js-tab-|$)`,
      "i",
    ),
  );
  if (!blockMatch) {
    return [];
  }

  const rows = [...blockMatch[1].matchAll(/<div class="line-table"[\s\S]*?(?=<div class="line-table"|$)/gi)].map(
    (match) => match[0],
  );

  return rows
    .map((match) => {
      const row = match;
      const place = Number.parseInt(
        row.match(/<(?:h5|div) class="position(?:\s+[^"]*)?">(\d+)\s*<\/(?:h5|div)>/i)?.[1] || "",
        10,
      );
      const firstName = cleanFeedText(row.match(/<div class="name p-3">([\s\S]*?)<\/div>/i)?.[1] || "");
      const surname = cleanFeedText(row.match(/<div class="surname p-3 is-bold">([\s\S]*?)<\/div>/i)?.[1] || "");
      const alpha3Code = (row.match(/athletes-flags\/([a-z]{3})\.png/i)?.[1] || "").toUpperCase();
      const gap = normalizeStandingGap(row.match(/<div class="distacco p-3 is-text-right">([\s\S]*?)<\/div>/i)?.[1] || "");
      const time = normalizeStandingTime(row.match(/<div class="tempo p-3 is-text-right">([\s\S]*?)<\/div>/i)?.[1] || "");
      const rider = toTitleCaseWords([firstName, surname].filter(Boolean).join(" "));
      return Number.isInteger(place) && rider
        ? buildStandingEntry(place, { rider, countryCode: alpha3Code, gap, time })
        : null;
    })
    .filter(Boolean)
    .slice(0, MAX_RESULT_RIDERS);
}

function parseGiroDItaliaGeneralClassificationStandings(html) {
  return parseGiroDItaliaClassificationStandings(html, "tab-classifica-CLGEN");
}

function parseGiroDItaliaStageClassificationStandings(html) {
  return parseGiroDItaliaClassificationStandings(html, "tab-classifica-ORARR");
}

function parseGiroDItaliaLivefeedStageStandings(jsonText) {
  let payload;

  try {
    payload = JSON.parse(String(jsonText || ""));
  } catch {
    return [];
  }

  const entries = payload?.cronaca_sintesi?.entries || [];
  let bestStandings = [];
  let bestScore = -1;

  for (const entry of entries) {
    const title = cleanFeedText(entry?.titolo || "");
    const abstract = decodeHtml(String(entry?.abstract || ""))
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
    const lines = abstract
      .split("\n")
      .map((line) => cleanFeedText(line))
      .filter(Boolean);

    const standings = lines
      .map((line) => {
        const match = line.match(/^(\d+)[\.\-]\s+(.+?)\s+\([^)]+\)\s+(.+)$/i);
        const place = Number.parseInt(match?.[1] || "", 10);
        const rider = cleanFeedText(match?.[2] || "");
        const tail = cleanFeedText(match?.[3] || "");
        const hasResultTime =
          /s\.t\.|[+\-]?\d+h|[+\-]?\d+:\d+(?::\d+)?|[+\-]?\d+[’'](?:\d+[”"]?)?|[+\-]?\d+[”"]/i.test(tail);
        return Number.isInteger(place) && rider && hasResultTime
          ? buildStandingEntry(place, toTitleCaseWords(rider))
          : null;
      })
      .filter(Boolean)
      .slice(0, MAX_RESULT_RIDERS);

    if (standings.length === 0) {
      continue;
    }

    const score =
      standings.length * 10 +
      Number(/top\s*10|order of arrival|results|winner/i.test(title)) +
      Number(entry?.sintesi === true);

    if (score > bestScore) {
      bestScore = score;
      bestStandings = standings;
    }
  }

  return bestStandings;
}

function extractGiroDItaliaFinishVideoUrl(jsonText) {
  let payload;

  try {
    payload = JSON.parse(String(jsonText || ""));
  } catch {
    return "";
  }

  const finishVideoEntry = [...(payload?.cronaca_sintesi?.entries || [])]
    .reverse()
    .find((entry) => {
      const title = cleanFeedText(entry?.titolo || "");
      const url = cleanFeedText(entry?.url_media || "");
      return (
        entry?.categoria === "VIDEO" &&
        /last[\s-]*(?:[^a-z0-9]{0,6}|\w+[\s-]+){0,4}(km|kilomet(?:re|er))/i.test(title) &&
        /again|enjoy/i.test(title) &&
        /^https:\/\/video\.giroditalia\.it\/video\/\d+/i.test(url)
      );
    });

  return cleanFeedText(finishVideoEntry?.url_media || "");
}

function extractGiroDItaliaWomenFinishVideoUrl(html, stageNumber) {
  const resolvedStageNumber = Number(stageNumber || 0);
  if (!resolvedStageNumber) {
    return "";
  }

  const entries = [...String(html || "").matchAll(
    /data-media="(https:\/\/video\.giroditaliawomen\.it\/video\/\d+)[^"]*"[\s\S]*?<span class="[^"]*(?:videoHighlights__info|sliderType__info)[^"]*">\s*Stage\s+(\d+)\s*<\/span>[\s\S]*?<p class="[^"]*(?:videoHighlights__txt|sliderType__txt)[^"]*">\s*([^<]+?)\s*<\/p>/gi,
  )]
    .map((match) => ({
      url: cleanFeedText(match[1] || ""),
      stageNumber: Number.parseInt(match[2] || "", 10),
      title: decodeHtml(cleanFeedText(match[3] || "")),
    }))
    .filter((entry) => entry.url && entry.stageNumber === resolvedStageNumber);

  if (entries.length === 0) {
    return "";
  }

  const scoreEntry = (entry) => {
    const title = entry.title.toLowerCase();
    if (/last\s*km/.test(title)) {
      return 3;
    }

    if (/highlights/.test(title)) {
      return 2;
    }

    if (/race against the clock|time trial|itt/.test(title)) {
      return 1;
    }

    return 0;
  };

  return entries
    .sort((left, right) => scoreEntry(right) - scoreEntry(left))[0]
    ?.url || "";
}

function extractGiroDItaliaLatestCompletedStageNumber(html) {
  return [...String(html || "").matchAll(/classifiche\/di-tappa\/(\d+)\/?/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
}

function inferGiroDItaliaCurrentStageNumber(race, now = new Date()) {
  const startUtc = toUtcDateOnly(race?.startDate);
  if (!startUtc) {
    return 0;
  }

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const elapsedDays = Math.floor((todayUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, Math.min(inferStageCountFromDates(race) || elapsedDays, elapsedDays));
}

function resolveGiroDItaliaLivefeedStageNumber(linkedStageNumber, race, now = new Date()) {
  return Number(linkedStageNumber || 0) || inferGiroDItaliaCurrentStageNumber(race, now);
}

function resolveGiroDItaliaCompletedStageNumber(linkedStageNumber, livefeedStageNumber, livefeedStageStandings) {
  if (Number(linkedStageNumber || 0) > 0) {
    return Number(linkedStageNumber);
  }

  if (Array.isArray(livefeedStageStandings) && livefeedStageStandings.length > 1) {
    return Number(livefeedStageNumber || 0);
  }

  return Number(livefeedStageNumber || 0) || 1;
}

function extractGiroDItaliaWomenLatestCompletedStageNumber(html) {
  return [...String(html || "").matchAll(/rankings\/di-tappa\/(\d+)\/?/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
}

function extractGiroDItaliaWomenEmbeddedStageNumber(html) {
  const text = String(html || "");
  const matches = [
    text.match(/js-n-stage"[^>]*>\s*(\d+)\s*</i),
    text.match(/<span class="is-pink">Stage(?:&nbsp;|\s)+(\d+)\s*<\/span>/i),
  ].filter(Boolean);

  return matches
    .map((match) => Number.parseInt(match[1], 10))
    .find(Number.isFinite) || 0;
}

async function fetchGiroDItaliaOfficialSnapshot(race, fetchHtml = fetchText, now = new Date()) {
  const today = now instanceof Date ? now : new Date(now);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    race?.pageTitle !== "2026 Giro d'Italia" ||
    getRaceYear(race) !== 2026 ||
    !startUtc ||
    !endUtc ||
    todayUtc.getTime() < startUtc.getTime()
  ) {
    return null;
  }

  const classificationsHtml = await fetchHtml(GIRO_D_ITALIA_CLASSIFICATIONS_URL);
  const linkedStageNumber = extractGiroDItaliaLatestCompletedStageNumber(classificationsHtml);
  const livefeedStageNumber = resolveGiroDItaliaLivefeedStageNumber(linkedStageNumber, race, today);
  const livefeedJson = livefeedStageNumber
    ? await fetchHtml(`${GIRO_D_ITALIA_LIVEFEED_STAGE_BASE_URL}${livefeedStageNumber}/`)
    : "";
  const livefeedStageStandings = parseGiroDItaliaLivefeedStageStandings(livefeedJson);
  const finishVideoUrl = extractGiroDItaliaFinishVideoUrl(livefeedJson);
  const stageNumber = resolveGiroDItaliaCompletedStageNumber(
    linkedStageNumber,
    livefeedStageNumber,
    livefeedStageStandings,
  );
  const explicitStageVideoOverride = RACE_FINISH_VIDEO_URLS["2026 Giro d'Italia"]?.[stageNumber] || "";
  if (finishVideoUrl && stageNumber > 0 && !explicitStageVideoOverride) {
    RACE_FINISH_VIDEO_URLS["2026 Giro d'Italia"][stageNumber] = finishVideoUrl;
  }
  const resolvedFinishVideoUrl = explicitStageVideoOverride || finishVideoUrl;
  const stageHtml = await fetchHtml(`${GIRO_D_ITALIA_STAGE_RANKINGS_BASE_URL}${stageNumber}/`);
  const officialStageStandings = parseGiroDItaliaStageClassificationStandings(stageHtml);
  const stageStandings = officialStageStandings.length > 1 ? officialStageStandings : livefeedStageStandings;
  const gcStandings = parseGiroDItaliaGeneralClassificationStandings(classificationsHtml);

  if (stageStandings.length === 0 && gcStandings.length === 0) {
    return null;
  }

  return {
    totalStages: 21,
    completedStages: stageNumber,
    latestStage:
      stageStandings.length > 0
        ? {
            number: stageNumber,
            label: `Stage ${stageNumber}`,
            standings: stageStandings,
            finishVideoUrl: resolvedFinishVideoUrl,
            ...getWinnerDetails(stageStandings),
          }
        : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber,
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function fetchGiroDItaliaWomenOfficialSnapshot(race, fetchHtml = fetchText, now = new Date()) {
  const today = now instanceof Date ? now : new Date(now);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    race?.pageTitle !== "2026 Giro d'Italia Women" ||
    getRaceYear(race) !== 2026 ||
    !startUtc ||
    !endUtc ||
    todayUtc.getTime() < startUtc.getTime()
  ) {
    return null;
  }

  const rankingsHtml = await fetchHtml(GIRO_D_ITALIA_WOMEN_RANKINGS_URL);
  const linkedStageNumber = extractGiroDItaliaWomenLatestCompletedStageNumber(rankingsHtml);
  const requestedStageNumber = linkedStageNumber || inferGiroDItaliaCurrentStageNumber(race, today);
  const stageHtml = requestedStageNumber
    ? await fetchHtml(`${GIRO_D_ITALIA_WOMEN_STAGE_RANKINGS_BASE_URL}${requestedStageNumber}/`)
    : "";
  const embeddedStageNumber = extractGiroDItaliaWomenEmbeddedStageNumber(stageHtml);
  const stageNumber =
    embeddedStageNumber > 0 && embeddedStageNumber <= requestedStageNumber
      ? embeddedStageNumber
      : linkedStageNumber;
  const stageStandings = parseGiroDItaliaStageClassificationStandings(stageHtml);
  const gcStandings = parseGiroDItaliaGeneralClassificationStandings(rankingsHtml);
  const trustworthyStageStandings =
    requestedStageNumber > 0 && stageNumber > 0 && requestedStageNumber !== stageNumber
      ? []
      : stageStandings;
  const videoHubHtml = stageNumber > 0 ? await fetchHtml(GIRO_D_ITALIA_WOMEN_VIDEO_URL) : "";
  const finishVideoUrl = extractGiroDItaliaWomenFinishVideoUrl(videoHubHtml, stageNumber);

  if (trustworthyStageStandings.length === 0 && gcStandings.length === 0) {
    return null;
  }

  return {
    totalStages: 9,
    completedStages: Math.max(stageNumber, gcStandings.length > 0 ? linkedStageNumber : 0),
    latestStage:
      stageNumber > 0 && trustworthyStageStandings.length > 0
        ? {
            number: stageNumber,
            label: `Stage ${stageNumber}`,
            standings: trustworthyStageStandings,
            finishVideoUrl,
            ...getWinnerDetails(trustworthyStageStandings),
          }
        : null,
    generalClassification:
      gcStandings.length > 0
        ? {
            stageNumber: linkedStageNumber || stageNumber || inferGiroDItaliaCurrentStageNumber(race, today),
            standings: gcStandings,
            ...getLeaderDetails(gcStandings),
          }
        : null,
    overallResult: [],
  };
}

async function fetchTourOfGreeceOfficialSnapshot(race, fetchHtml = fetchText) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);

  if (
    race?.pageTitle !== "Tour of Greece" ||
    getRaceYear(race) !== 2026 ||
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

const OFFICIAL_STAGE_RACE_PROVIDERS = [
  {
    id: "tour-de-romandie-prologue",
    matches: (race) => race?.pageTitle === "2026 Tour de Romandie",
    load: fetchTourDeRomandieOfficialSnapshot,
  },
  {
    id: "la-vuelta-femenina-rankings",
    matches: (race) => race?.pageTitle === "2026 La Vuelta Femenina",
    load: fetchLaVueltaFemeninaOfficialSnapshot,
  },
  {
    id: "grande-premio-anicolor-live",
    matches: (race) => race?.pageTitle === "Grande Prémio Anicolor",
    load: fetchGrandePremioAnicolorLiveSnapshot,
  },
  {
    id: "vuelta-asturias",
    matches: (race) => race?.pageTitle === "Vuelta Asturias",
    load: fetchVueltaAsturiasOfficialSnapshot,
  },
  {
    id: "tour-of-greece-results",
    matches: (race) => race?.pageTitle === "Tour of Greece",
    load: fetchTourOfGreeceOfficialSnapshot,
  },
  {
    id: "tour-auvergne-rhone-alpes-rankings",
    matches: (race) => race?.pageTitle === "2026 Tour Auvergne-Rhône-Alpes",
    load: fetchTourAuvergneRhoneAlpesOfficialSnapshot,
  },
  {
    id: "giro-ditalia-stage-one",
    matches: (race) => race?.pageTitle === "2026 Giro d'Italia",
    load: fetchGiroDItaliaOfficialSnapshot,
  },
  {
    id: "tour-de-france-rankings",
    matches: (race) => race?.pageTitle === "2026 Tour de France",
    load: fetchTourDeFranceOfficialSnapshot,
  },
  {
    id: "tour-de-france-femmes-rankings",
    matches: (race) => race?.pageTitle === "2026 Tour de France Femmes",
    load: fetchTourDeFranceFemmesOfficialSnapshot,
  },
  {
    id: "giro-ditalia-women-rankings",
    matches: (race) => race?.pageTitle === "2026 Giro d'Italia Women",
    load: fetchGiroDItaliaWomenOfficialSnapshot,
  },
  {
    id: "vuelta-a-espana-rankings",
    matches: (race) => race?.pageTitle === "2026 Vuelta a España",
    load: fetchVueltaAEspanaOfficialSnapshot,
  },
  {
    id: "vuelta-a-burgos-feminas-liveblog",
    matches: (race) => isVueltaABurgosFeminasRace(race),
    load: fetchVueltaABurgosFeminasOfficialSnapshot,
  },
];

const OFFICIAL_ONE_DAY_RESULT_PROVIDERS = [
  {
    id: "eschborn-frankfurt",
    matches: (race) => race?.pageTitle === "2026 Eschborn–Frankfurt",
    load: fetchEschbornFrankfurtOfficialStandings,
  },
];

function findOfficialRaceProvider(providers, race) {
  return providers.find((provider) => provider.matches(race)) || null;
}

async function loadOfficialStageRaceSnapshot(race) {
  const staticSnapshot = getStaticStageRaceSnapshot(race);
  if (staticSnapshot) {
    return staticSnapshot;
  }

  const provider = findOfficialRaceProvider(OFFICIAL_STAGE_RACE_PROVIDERS, race);
  if (!provider) {
    return null;
  }

  const snapshot = await provider.load(race);
  return annotateStageRaceSnapshotSource(snapshot, provider.id);
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
  const provider = findOfficialRaceProvider(OFFICIAL_ONE_DAY_RESULT_PROVIDERS, race);
  return provider ? provider.load(race) : [];
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

async function enrichLocations(races, loadWikiRaw = fetchWikiRaw) {
  await Promise.all(
    races.map(async (race) => {
      try {
        const raw = await loadWikiRaw(race.pageTitle);
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

function enrichLocationsInBackground(races, loadWikiRaw = fetchWikiRaw) {
  enrichLocations(races, loadWikiRaw).catch(() => {
    // Keep the season-table fallback locations if background enrichment fails.
  });
}

function isMultiDayRace(race) {
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);
  return Boolean(startUtc && endUtc && startUtc.getTime() !== endUtc.getTime());
}

function isOneDayRace(race) {
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);
  return Boolean(startUtc && endUtc && startUtc.getTime() === endUtc.getTime());
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

function isRaceWithinScheduledLiveWindow(race, todayUtc = new Date()) {
  const startUtc = toUtcDateOnly(race?.startDate);
  const endUtc = toUtcDateOnly(race?.endDate);
  const currentUtc = toUtcDateOnly(todayUtc);

  return Boolean(
    startUtc &&
      endUtc &&
      currentUtc &&
      startUtc.getTime() !== endUtc.getTime() &&
      startUtc.getTime() <= currentUtc.getTime() &&
      endUtc.getTime() >= currentUtc.getTime(),
  );
}

// Companion stage articles are a bonus source: a page that 404s or times out must
// leave the race rendering exactly as it did from the main article alone.
async function loadStageArticleTexts(rawText, loadWikiRaw = fetchWikiRaw) {
  const titles = extractStageArticleTitles(rawText);
  if (titles.length === 0) {
    return [];
  }

  const texts = await Promise.all(
    titles.map((title) =>
      loadWikiRaw(title).catch(() => ""),
    ),
  );

  return texts.filter(Boolean);
}

// Companion stage articles are read at build time for live races only, so a finished
// race's card starts from the route table's winner-per-stage history. This fills in the
// real podiums for one race on request, keeping the cold-start budget on the races that
// are actually moving. Cached because the answer for a finished race never changes.
const stageHistoryCache = new Map();
const STAGE_HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_STAGE_HISTORY_CACHE_ENTRIES = 40;

async function loadRequestedStageHistory(race) {
  const cacheKey = getRaceId(race);
  const cached = stageHistoryCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < STAGE_HISTORY_CACHE_TTL_MS) {
    return cached.stages;
  }

  const loadWikiRaw = createWikiRawLoader();
  const raw = await loadWikiRaw(race.pageTitle);
  const stageArticleTexts = await loadStageArticleTexts(raw, loadWikiRaw);
  const teamNames = stageArticleTexts.length > 0 ? await loadStageRaceTeamNames(raw, stageArticleTexts) : new Map();
  const stages =
    stageArticleTexts.length > 0 ? extractStageRaceSnapshot(raw, stageArticleTexts, teamNames).stages || [] : [];

  if (stageHistoryCache.size >= MAX_STAGE_HISTORY_CACHE_ENTRIES) {
    stageHistoryCache.delete(stageHistoryCache.keys().next().value);
  }
  stageHistoryCache.set(cacheKey, { fetchedAt: Date.now(), stages });
  return stages;
}

// Only races already on the page can be asked for, so the race id cannot be turned into
// an arbitrary Wikipedia fetch.
function findStageRaceById(data, raceId) {
  const wanted = String(raceId || "").trim();
  if (!wanted) {
    return null;
  }

  return (
    [...(data?.recentResults || []), ...(data?.finalizedStageRaces || []), ...(data?.liveStageRaces || [])].find(
      (race) => getRaceId(race) === wanted && Array.isArray(race?.stageRace?.stages),
    ) || null
  );
}

async function enrichStageRaceSnapshots(races, loadWikiRaw = fetchWikiRaw) {
  await Promise.all(
    races.map(async (race) => {
      if (!isMultiDayRace(race)) {
        return;
      }

      try {
        const officialSnapshot = await loadOfficialStageRaceSnapshot(race);
        const raw = await loadWikiRaw(race.pageTitle);
        const stageArticleTexts = await loadStageArticleTexts(raw, loadWikiRaw);
        const teamNames = await loadStageRaceTeamNames(raw, stageArticleTexts);
        const parsedSnapshot = annotateStageRaceSnapshotSource(
          applyKnownStageRaceCorrections(race, extractStageRaceSnapshot(raw, stageArticleTexts, teamNames)),
          "wikipedia-raw",
        );
        const snapshot = selectPreferredStageRaceSnapshot(officialSnapshot, parsedSnapshot, race);

        if ((snapshot?.totalStages || 0) > 1 || (snapshot?.completedStages || 0) > 0) {
          race.stageRace = snapshot;
        }
      } catch {
        try {
          const officialSnapshot = await loadOfficialStageRaceSnapshot(race);
          if (officialSnapshot?.completedStages > 0) {
            race.stageRace = officialSnapshot;
          }
        } catch {
          // Fall back to season-table data when the race page cannot be parsed.
        }
      }
    }),
  );

  return races;
}

// Official providers are not merely a refinement for a finished race: Wikipedia alone
// leaves several Grand Tours one to three riders deep, and Tour de Romandie drops out of
// the finalized grid without one. So they stay on the blocking path — but with a time
// budget, because one provider is pathologically slow. giroditaliawomen.it takes ~11s of
// sequential requests for a race that finished in June, while every other provider
// measured under 1.3s. A lookup that overruns stops blocking first paint and is applied
// when it lands instead.
const OFFICIAL_SNAPSHOT_BLOCKING_BUDGET_MS = 2500;

// A distinct sentinel, so "the budget elapsed" is never confused with "this race has no
// official provider" — most races resolve to null instantly and must not be treated as
// slow lookups still in flight.
const OFFICIAL_SNAPSHOT_TIMED_OUT = Symbol("official-snapshot-timed-out");

// `settled` resolves to the provider result if it arrives inside the budget, or to
// OFFICIAL_SNAPSHOT_TIMED_OUT if it does not. `pending` is the same in-flight lookup,
// handed back so a late result can be applied without re-requesting it — a slow origin
// is still asked only once per build.
function loadOfficialStageRaceSnapshotWithinBudget(race, budgetMs) {
  const pending = loadOfficialStageRaceSnapshot(race).catch(() => null);
  if (!budgetMs) {
    return { pending, settled: pending };
  }

  let timer;
  const budget = new Promise((resolve) => {
    timer = setTimeout(() => resolve(OFFICIAL_SNAPSHOT_TIMED_OUT), budgetMs);
  });

  return {
    pending,
    settled: Promise.race([pending.finally(() => clearTimeout(timer)), budget]),
  };
}

// Applies a provider result that missed the blocking budget. These are the same race
// objects the caller cached, so the refinement appears on the next render without
// another build. It merges through the same path the inline case uses, so a late
// snapshot never wins where it is worse than what Wikipedia already gave.
function applyLateOfficialSnapshots(lateLookups) {
  lateLookups.forEach(({ race, pending }) => {
    pending
      .then((officialSnapshot) => {
        if (!officialSnapshot) {
          return;
        }

        const merged = selectPreferredStageRaceSnapshot(officialSnapshot, race.stageRace, race);
        if (merged && ((merged.totalStages || 0) > 1 || (merged.completedStages || 0) > 0)) {
          race.stageRace = merged;
          race.resultStandings = selectStandings(merged.generalClassification?.standings, merged.overallResult);
        }
      })
      .catch(() => {
        // Keep the Wikipedia-derived standings already rendering.
      });
  });
}

// `options.officialSnapshotBudgetMs` caps how long the official stage-race provider may
// block. Lookups that overrun are collected into `options.lateLookups` for the caller to
// apply once they land. The one-day lookup is left unbudgeted: it measured at ~0ms and
// is the only source for some one-day races.
async function enrichRecentResultStandings(races, loadWikiRaw = fetchWikiRaw, options = {}) {
  const budgetMs = options.officialSnapshotBudgetMs || 0;
  const lateLookups = options.lateLookups || null;

  await Promise.all(
    races.map(async (race) => {
      const isStageRace = isMultiDayRace(race);

      try {
        const officialLookup = loadOfficialStageRaceSnapshotWithinBudget(race, budgetMs);
        const settledSnapshot = await officialLookup.settled;
        const timedOut = settledSnapshot === OFFICIAL_SNAPSHOT_TIMED_OUT;
        const officialSnapshot = timedOut ? null : settledSnapshot;
        if (timedOut && lateLookups) {
          lateLookups.push({ race, pending: officialLookup.pending });
        }
        const officialOneDayStandings = await loadOfficialOneDayResultStandings(race);
        if (officialOneDayStandings.length > 0) {
          race.resultStandings = officialOneDayStandings;
          return;
        }

        const raw = await loadWikiRaw(race.pageTitle);
        // Companion stage articles are read here again. They were moved off this path
        // when the cold start was ~20s and their ~2s mattered; budgeting the official
        // providers took the build to ~5.7s, so a finished Grand Tour can afford to
        // render its stage podiums without anyone pressing a button. /api/race-stages
        // stays as the fallback for whatever this misses.
        const stageArticleTexts = isStageRace ? await loadStageArticleTexts(raw, loadWikiRaw) : [];
        const teamNames = isStageRace ? await loadStageRaceTeamNames(raw, stageArticleTexts) : new Map();
        const parsedSnapshot = annotateStageRaceSnapshotSource(
          applyKnownStageRaceCorrections(race, extractStageRaceSnapshot(raw, stageArticleTexts, teamNames)),
          "wikipedia-raw",
        );
        const snapshot = selectPreferredStageRaceSnapshot(officialSnapshot, parsedSnapshot, race);

        if (isStageRace && ((snapshot?.totalStages || 0) > 1 || (snapshot?.completedStages || 0) > 0)) {
          race.stageRace = snapshot;
          race.resultStandings = selectStandings(snapshot.generalClassification?.standings, snapshot.overallResult);
          return;
        }

        const resultStandings = findOverallRaceResult(extractCyclingResultBlocks(raw));
        if (resultStandings.length > 0) {
          race.resultStandings = resultStandings;
        }
      } catch {
        try {
          const officialSnapshot = await loadOfficialStageRaceSnapshot(race);
          if (isStageRace && officialSnapshot?.completedStages > 0) {
            race.stageRace = officialSnapshot;
            race.resultStandings = selectStandings(
              officialSnapshot.generalClassification?.standings,
              officialSnapshot.overallResult,
            );
          }
        } catch {
          // Fall back to season-table results when page parsing fails.
        }
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
  const stageNumber = getRaceCoverageStageNumber(race);
  const latestStageWinner = cleanWikiText(race?.stageRace?.latestStage?.winner || "");
  const overallWinner = cleanWikiText(race?.winner || "");
  const primaryVariant = variants[0] || "";

  // Result-oriented queries placed first so they survive the 32-query cap. A bare
  // "<race> <year> cycling" query tends to surface previews/guides; naming the
  // winner and asking for the report is what surfaces the actual result coverage
  // (e.g. "Wout Van Aert beats Tadej Pogacar" for Paris-Roubaix).
  // Cover the top few name variants (e.g. "Paris–Roubaix" and "Paris-Roubaix"),
  // since news sources spell punctuation differently and the result articles only
  // surface under some spellings.
  const priorityQueries = [];
  const yearPart = raceYear ? `${raceYear} ` : "";
  variants.slice(0, 3).forEach((variant) => {
    priorityQueries.push(`"${variant}" ${yearPart}results report`);
    if (overallWinner) {
      priorityQueries.push(`"${variant}" ${yearPart}${overallWinner}`);
    }
  });
  if (primaryVariant && overallWinner) {
    priorityQueries.push(`"${primaryVariant}" "${overallWinner}" wins`);
  }

  const queries = variants.flatMap((variant) => {
    const variantQueries = [];

    if (raceYear) {
      variantQueries.push(`"${variant}" ${raceYear} cycling`);
      variantQueries.push(`"${variant}" ${raceYear} results cycling`);
    } else {
      variantQueries.push(`"${variant}" cycling`);
    }

    if (stageNumber > 0) {
      variantQueries.push(`"${variant}" stage ${stageNumber} cycling`);
      variantQueries.push(`"${variant}" stage ${stageNumber} results`);
      variantQueries.push(`"${variant}" stage ${stageNumber} winner`);
    }

    if (stageNumber > 0 && raceYear) {
      variantQueries.push(`"${variant}" ${raceYear} stage ${stageNumber}`);
      variantQueries.push(`"${variant}" ${raceYear} stage ${stageNumber} results`);
    }

    if (stageNumber > 0 && latestStageWinner) {
      variantQueries.push(`"${variant}" "${latestStageWinner}" stage ${stageNumber}`);
    }

    return variantQueries;
  });

  return [...new Set([...priorityQueries, ...queries])].slice(0, 32);
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
  const toTime = (value) => {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  };
  const startTime = toTime(race?.startDate);
  const endTime = toTime(race?.endDate);
  const hasWindow = startTime !== null && endTime !== null;
  const earliestAllowed = hasWindow ? startTime - 30 * 24 * 60 * 60 * 1000 : null;
  const latestAllowed = hasWindow ? endTime + 10 * 24 * 60 * 60 * 1000 : null;

  // When the publish date lands inside this edition's window and matches the race
  // year, the date settles it — accept even if the article references previous
  // editions (e.g. "Van Aert finally wins after years"), which the mentioned-year
  // heuristic below would otherwise wrongly reject.
  if (
    articleTime &&
    raceYear &&
    hasWindow &&
    new Date(articleTime).getUTCFullYear() === raceYear &&
    articleTime >= earliestAllowed &&
    articleTime <= latestAllowed
  ) {
    return true;
  }

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

  if (!hasWindow) {
    return true;
  }

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
  const stageNumber = getRaceCoverageStageNumber(race);
  const latestStageWinner = normalizeSearchText(race?.stageRace?.latestStage?.winner || "");
  const combinedText = `${title} ${description}`;

  const endUtc = toUtcDateOnly(race?.endDate);
  const nowUtc = toUtcDateOnly(new Date());
  const raceConcluded = Boolean(endUtc && nowUtc && endUtc.getTime() < nowUtc.getTime());

  let score = getPublisherScore(article.publisher);
  score += titleMatches * 28;
  score += descriptionMatches * 12;
  // Reward result/report coverage; keep "preview" out of this list so it is not
  // treated as a positive signal.
  score += /\bresult|results|wins|won|victory|podium|report|recap|highlights|gallery\b/i.test(article.title) ? 22 : 0;
  // Once a race is over, previews/guides/start lists are stale and should sink
  // below actual result coverage (e.g. the Copenhagen Sprint "contenders" preview).
  if (
    raceConcluded &&
    /\bpreview|contenders|guide|how to watch|where to watch|start ?list|favou?rites|predictions?|ultimate guide\b/i.test(
      article.title,
    )
  ) {
    score -= 45;
  }
  // Continuous recency so newer articles always rank above older ones, not just
  // within the first 48 hours (kept the Giro result below an older tactics piece).
  score += Math.max(0, 60 - Math.min(hoursOld, 720) / 12);
  if (stageNumber > 0 && combinedText.includes(`stage ${stageNumber}`)) {
    score += 36;
  }
  if (latestStageWinner && title.includes(latestStageWinner)) {
    score += 18;
  }

  return score;
}

function isStageSpecificRaceArticle(article, race) {
  const stageNumber = getRaceCoverageStageNumber(race);
  if (stageNumber <= 0) {
    return false;
  }

  const combinedText = normalizeSearchText([article?.title, article?.description].join(" "));
  const latestStageWinner = normalizeSearchText(race?.stageRace?.latestStage?.winner || "");

  if (combinedText.includes(`stage ${stageNumber}`)) {
    return true;
  }

  return Boolean(latestStageWinner && combinedText.includes(latestStageWinner) && /\bwin|wins|won|victory|result|results|report\b/.test(combinedText));
}

function compareArticleRecency(left, right) {
  // Bucket by calendar day so the most recent day leads, but within a day order by
  // score — otherwise a stale "how to watch" published hours after the finish could
  // outrank the actual result article from the same day.
  const dayOf = (article) => {
    if (!article.publishedAt) {
      return -Infinity;
    }
    const time = new Date(article.publishedAt).getTime();
    return Number.isNaN(time) ? -Infinity : Math.floor(time / (24 * 60 * 60 * 1000));
  };
  const leftDay = dayOf(left);
  const rightDay = dayOf(right);
  if (rightDay !== leftDay) {
    return rightDay - leftDay; // most recent day first; undated articles sink
  }
  return (right.score || 0) - (left.score || 0);
}

function selectRaceArticles(articlePool, refreshToken, race = null) {
  // Rank by score to choose the quality pool, but display most-recent-first so the
  // current result leads instead of an older (if higher-scored) article.
  const rankedPool = [...articlePool]
    .sort((left, right) => right.score - left.score)
    .slice(0, 32);

  if (rankedPool.length <= MAX_RACE_ARTICLES) {
    return [...rankedPool].sort(compareArticleRecency);
  }

  const hasLiveStageContext = Boolean(race && isMultiDayRace(race) && !isFinalizedStageRace(race) && getRaceCoverageStageNumber(race) > 0);
  if (hasLiveStageContext) {
    const stageSpecific = rankedPool
      .filter((article) => isStageSpecificRaceArticle(article, race))
      .sort(compareArticleRecency);
    const broaderContext = rankedPool
      .filter((article) => !isStageSpecificRaceArticle(article, race))
      .sort(compareArticleRecency);
    const selected = [];
    const usedUrls = new Set();
    const addArticles = (articles, limit) => {
      for (const article of articles) {
        if (selected.length >= limit) {
          break;
        }
        if (usedUrls.has(article.url)) {
          continue;
        }
        usedUrls.add(article.url);
        selected.push(article);
      }
    };

    addArticles(stageSpecific, Math.min(4, MAX_RACE_ARTICLES));
    addArticles(broaderContext, Math.min(6, MAX_RACE_ARTICLES));

    if (selected.length < MAX_RACE_ARTICLES) {
      const fillerPool = [...rankedPool]
        .filter((article) => !usedUrls.has(article.url))
        .sort(compareArticleRecency);
      addArticles(fillerPool, MAX_RACE_ARTICLES);
    }

    return selected.slice(0, MAX_RACE_ARTICLES);
  }
  // Most-recent-first; the refresh token pages through older batches.
  const orderedPool = [...rankedPool].sort(compareArticleRecency);
  const batchCount = Math.ceil(orderedPool.length / MAX_RACE_ARTICLES);
  const batchIndex = refreshToken % batchCount;
  const startIndex = batchIndex * MAX_RACE_ARTICLES;
  const batch = orderedPool.slice(startIndex, startIndex + MAX_RACE_ARTICLES);

  if (batch.length === MAX_RACE_ARTICLES || startIndex === 0) {
    return batch;
  }

  return [...batch, ...orderedPool.slice(0, MAX_RACE_ARTICLES - batch.length)];
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

  // Keep top-tier coverage first, but do not let it suppress lower-tier articles
  // entirely: an evergreen top-tier "guide" page must not crowd out the actual
  // result coverage (e.g. "Van Aert beats Pogacar" from Yahoo/MSN). Publisher
  // quality is already reflected in each article's score.
  const topTierArticles = articles.filter((article) => getPublisherScore(article.publisher) > 40);
  const otherArticles = articles.filter((article) => getPublisherScore(article.publisher) <= 40);
  return [...topTierArticles, ...otherArticles].slice(0, 32);
}

async function loadRaceArticlePool(race) {
  const raceId = getRaceId(race);
  const cached = articleCache.get(raceId);
  const now = Date.now();

  const startRefresh = () =>
    fetchRaceArticles(race)
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

  if (cached?.data) {
    if (now - cached.updatedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    if (!cached.promise) {
      const promise = startRefresh();
      articleCache.set(raceId, {
        updatedAt: cached.updatedAt,
        data: cached.data,
        promise,
      });
      promise.catch(() => {});
    }

    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = startRefresh();
  articleCache.set(raceId, {
    updatedAt: now,
    data: cached?.data || null,
    promise,
  });

  return promise;
}

function cloneStandingEntry(entry) {
  return entry ? { ...entry } : entry;
}

function cloneStageRaceField(field) {
  if (!field) {
    return null;
  }

  return {
    ...field,
    standings: Array.isArray(field.standings) ? field.standings.map(cloneStandingEntry) : [],
  };
}

function cloneRace(race) {
  return {
    ...race,
    startDate: race?.startDate instanceof Date ? new Date(race.startDate) : race?.startDate ? new Date(race.startDate) : null,
    endDate: race?.endDate instanceof Date ? new Date(race.endDate) : race?.endDate ? new Date(race.endDate) : null,
    resultStandings: Array.isArray(race?.resultStandings) ? race.resultStandings.map(cloneStandingEntry) : race?.resultStandings,
    stageRace: race?.stageRace
      ? {
          ...race.stageRace,
          latestStage: cloneStageRaceField(race.stageRace.latestStage),
          generalClassification: cloneStageRaceField(race.stageRace.generalClassification),
          overallResult: Array.isArray(race.stageRace.overallResult)
            ? race.stageRace.overallResult.map(cloneStandingEntry)
            : race.stageRace.overallResult,
        }
      : race?.stageRace,
  };
}

function cloneRaces(races) {
  return races.map(cloneRace);
}

function partitionRaceBuckets(allRaces, now = new Date()) {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
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
    .filter((race) => isMultiDayRace(race) && race.endDate && race.endDate <= todayUtc)
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

  return {
    todayUtc,
    recentOneDayResults,
    finalizedStageCandidates,
    liveStageCandidates,
    upcomingRaces,
    europeTourRecentResults,
    europeTourLiveStageRaces,
    europeTourUpcomingRaces,
    upcomingDisplayRaces,
  };
}

function createRaceAnchorId(race) {
  const slug = String(race?.id || race?.pageTitle || race?.title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `race-${slug}` : "";
}

function getSeasonCalendarTier(race) {
  if (SEASON_CALENDAR_GRAND_TOURS.has(race?.title)) {
    return "grand-tour";
  }
  if (SEASON_CALENDAR_MONUMENTS.has(race?.title)) {
    return "monument";
  }
  return isMultiDayRace(race) ? "stage-race" : "one-day";
}

function toIsoDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function seasonDayIndex(isoDay, isoBase) {
  return Math.round((Date.parse(`${isoDay}T00:00:00Z`) - Date.parse(`${isoBase}T00:00:00Z`)) / SEASON_DAY_MS);
}

// The whole WorldTour season as one JSON-friendly list, padded to month boundaries so
// the timeline axis starts on the 1st. Status is by date against todayUtc; a race is
// "live" from its first day through its last.
function buildSeasonCalendar(allRaces, todayUtc = new Date()) {
  const todayIso = toIsoDay(todayUtc);
  const races = (allRaces || [])
    .filter((race) => race?.startDate && race?.endDate && SEASON_CALENDAR_SERIES.some((series) => series.label === race.series))
    .map((race) => {
      const startDate = toIsoDay(race.startDate);
      const endDate = toIsoDay(race.endDate);
      const status = race.isCancelled
        ? "cancelled"
        : endDate < todayIso
        ? "finished"
        : startDate <= todayIso
        ? "live"
        : "upcoming";
      return {
        id: race.id || race.pageTitle || race.title,
        anchor: createRaceAnchorId(race),
        title: race.title || "",
        series: race.series,
        seriesId: SEASON_CALENDAR_SERIES.find((series) => series.label === race.series)?.id || "",
        startDate,
        endDate,
        date: race.date || "",
        location: race.location || "",
        countryCode: race.countryCode || "",
        winner: race.winner || "",
        winnerCountryCode: race.winnerCountryCode || "",
        status,
        tier: getSeasonCalendarTier(race),
      };
    })
    .filter((race) => race.startDate && race.endDate && race.endDate >= race.startDate)
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || right.endDate.localeCompare(left.endDate));

  if (!races.length) {
    return { year: SEASON_YEAR, today: todayIso, rangeStart: "", rangeEnd: "", finishedCount: 0, liveCount: 0, upcomingCount: 0, races: [] };
  }

  const first = new Date(`${races[0].startDate}T00:00:00Z`);
  const lastEnd = races.reduce((max, race) => (race.endDate > max ? race.endDate : max), races[0].endDate);
  const last = new Date(`${lastEnd}T00:00:00Z`);
  const rangeStart = toIsoDay(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)));
  const rangeEnd = toIsoDay(new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)));

  return {
    year: first.getUTCFullYear(),
    today: todayIso,
    rangeStart,
    rangeEnd,
    finishedCount: races.filter((race) => race.status === "finished").length,
    liveCount: races.filter((race) => race.status === "live").length,
    upcomingCount: races.filter((race) => race.status === "upcoming").length,
    races,
  };
}

function dedupeRacesByPageTitle(races) {
  const seen = new Set();
  return (races || []).filter((race) => {
    const key = race?.pageTitle || race?.id || "";
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function selectHomepageWorldTourRecentCandidates(recentOneDayResults, finalizedStageCandidates) {
  const worldTourSeries = ["Men's WorldTour", "Women's WorldTour"];

  return worldTourSeries.flatMap((series) =>
    [...recentOneDayResults, ...finalizedStageCandidates]
      .filter((race) => race.series === series)
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, WORLDTOUR_RECENT_RESULTS),
  );
}

function selectHomepageRecentStandingsTargets(recentCandidates) {
  return [...recentCandidates]
    .sort((left, right) => right.endDate - left.endDate)
    .slice(0, HOMEPAGE_RECENT_STANDINGS_ENRICH_LIMIT);
}

function selectHomepageWorldTourUpcomingRaces(upcomingRaces) {
  return [
    ...selectUpcomingRaces(upcomingRaces, (race) => race.series === "Men's WorldTour"),
    ...selectUpcomingRaces(upcomingRaces, (race) => race.series === "Women's WorldTour"),
  ];
}

async function buildRaceMetadata(options = {}) {
  const startedAt = Date.now();
  const includeDeferred = options.includeDeferred === true;
  const wikiRawLoader = createWikiRawLoader();
  const seasons = ACTIVE_SEASONS;
  const seasonPagesStartedAt = Date.now();
  const seasonPages = await Promise.all(
    seasons.map(async (season) => {
      const yearMatch = season.pageTitle.match(/20\d{2}/);
      const year = yearMatch ? Number(yearMatch[0]) : new Date().getUTCFullYear();
      const rawText = await fetchWikiRaw(season.pageTitle);
      return parseSeasonRows(rawText, season, year);
    }),
  );
  const seasonPagesMs = Date.now() - seasonPagesStartedAt;

  const allRaces = seasonPages
    .flat()
    .filter((race) => race.pageTitle && race.startDate && race.endDate && !race.isCancelled);
  allRaces.forEach((race) => {
    race.id = getRaceId(race);
  });

  const {
    recentOneDayResults,
    finalizedStageCandidates,
    liveStageCandidates,
    upcomingRaces,
    europeTourRecentResults,
    europeTourLiveStageRaces,
    europeTourUpcomingRaces,
    upcomingDisplayRaces,
  } = partitionRaceBuckets(allRaces);

  const homepageWorldTourRecentCandidates = includeDeferred
    ? []
    : selectHomepageWorldTourRecentCandidates(recentOneDayResults, finalizedStageCandidates);
  const homepageWorldTourUpcomingRaces = includeDeferred ? [] : selectHomepageWorldTourUpcomingRaces(upcomingRaces);

  const displayRaces = [
    ...(includeDeferred ? recentOneDayResults : homepageWorldTourRecentCandidates),
    ...(includeDeferred ? finalizedStageCandidates : []),
    ...liveStageCandidates.filter((race) => includeDeferred || /WorldTour/.test(race.series)),
    ...(includeDeferred ? upcomingDisplayRaces : homepageWorldTourUpcomingRaces),
    ...(includeDeferred ? europeTourRecentResults : []),
    ...(includeDeferred ? europeTourLiveStageRaces : []),
    ...(includeDeferred ? europeTourUpcomingRaces : []),
  ];

  if (includeDeferred) {
    const locationEnrichmentStartedAt = Date.now();
    await enrichLocations(displayRaces, wikiRawLoader);
    var locationEnrichmentMs = Date.now() - locationEnrichmentStartedAt;
  } else {
    enrichLocationsInBackground(displayRaces, wikiRawLoader);
  }

  return {
    allRaces,
    fetchedAt: new Date().toISOString(),
    buildTimings: {
      totalMs: Date.now() - startedAt,
      seasonPagesMs,
      locationEnrichmentMs: includeDeferred ? locationEnrichmentMs : 0,
      locationEnrichmentMode: includeDeferred ? "blocking" : "background",
      seasonCount: seasons.length,
      displayRaceCount: displayRaces.length,
      allRaceCount: allRaces.length,
    },
  };
}

async function buildRaceData(metadata, options = {}) {
  const startedAt = Date.now();
  const allRaces = cloneRaces(metadata?.allRaces || []);
  const {
    todayUtc,
    recentOneDayResults,
    finalizedStageCandidates,
    liveStageCandidates,
    upcomingRaces,
    europeTourRecentResults,
    europeTourLiveStageRaces,
    europeTourUpcomingRaces,
  } = partitionRaceBuckets(allRaces);
  const includeDeferred = options.includeDeferred !== false;
  const isWorldTourRace = (race) => race.series === "Men's WorldTour" || race.series === "Women's WorldTour";
  const homepageWorldTourRecentCandidates = selectHomepageWorldTourRecentCandidates(
    recentOneDayResults,
    finalizedStageCandidates,
  );
  const homepageRecentStandingsTargets = includeDeferred
    ? []
    : selectHomepageRecentStandingsTargets(homepageWorldTourRecentCandidates);
  const selectedRecentOneDayResults = includeDeferred ? recentOneDayResults : [];
  const selectedFinalizedStageCandidates = includeDeferred ? finalizedStageCandidates : [];
  const selectedHomepageRecentCandidates = includeDeferred ? [] : homepageWorldTourRecentCandidates;
  const selectedLiveStageCandidates = includeDeferred
    ? liveStageCandidates
    : liveStageCandidates.filter(isWorldTourRace);
  const selectedUpcomingRaces = includeDeferred
    ? upcomingRaces
    : selectHomepageWorldTourUpcomingRaces(upcomingRaces);
  const selectedEuropeTourRecentResults = includeDeferred ? europeTourRecentResults : [];
  const selectedEuropeTourLiveStageRaces = includeDeferred ? europeTourLiveStageRaces : [];
  const selectedEuropeTourUpcomingRaces = includeDeferred ? europeTourUpcomingRaces : [];

  // Timed on settle rather than on await: this promise is started early and awaited
  // last, so measuring at the await reports how long the *other* work took. It read
  // 14462ms against a 14461ms critical path while the fetch itself takes under 250ms,
  // which pointed cold-start work at the wrong subsystem entirely.
  const nationalChampionshipsStartedAt = Date.now();
  let nationalChampionshipsMs = 0;
  const nationalChampionshipsPromise = loadNationalChampionships().then((result) => {
    nationalChampionshipsMs = Date.now() - nationalChampionshipsStartedAt;
    return result;
  });
  const stageRaceDisplays = [
    ...selectedLiveStageCandidates,
    ...selectedEuropeTourRecentResults,
    ...selectedEuropeTourLiveStageRaces,
  ].filter(isMultiDayRace);

  const wikiRawLoader = createWikiRawLoader();
  const recentStandingsStartedAt = Date.now();
  // Finalized stage races only render (and survive isFinalizedStageRace) once they
  // have a stage-race snapshot, so every displayed multi-day recent race must be
  // enriched — not just the most-recent few. Otherwise an older Grand Tour like the
  // Giro silently disappears from the recent grid.
  const homepageRecentEnrichTargets = includeDeferred
    ? selectedRecentOneDayResults
    : dedupeRacesByPageTitle([
        ...homepageRecentStandingsTargets,
        ...homepageWorldTourRecentCandidates.filter(isMultiDayRace),
      ]);
  // Providers stay on the blocking path but only for as long as the budget allows;
  // whatever overruns is applied when it lands. This is what keeps one slow origin off
  // first paint without giving up the depth the providers supply.
  const lateOfficialLookups = [];
  await enrichRecentResultStandings(homepageRecentEnrichTargets, wikiRawLoader, {
    officialSnapshotBudgetMs: OFFICIAL_SNAPSHOT_BLOCKING_BUDGET_MS,
    lateLookups: lateOfficialLookups,
  });
  let recentStandingsMs = Date.now() - recentStandingsStartedAt;
  let finalizedStageStandingsMs = 0;
  if (includeDeferred) {
    const finalizedStageStandingsStartedAt = Date.now();
    await enrichRecentResultStandings(selectedFinalizedStageCandidates, wikiRawLoader);
    finalizedStageStandingsMs = Date.now() - finalizedStageStandingsStartedAt;
  }
  const stageSnapshotsStartedAt = Date.now();
  await enrichStageRaceSnapshots(stageRaceDisplays, wikiRawLoader);
  const stageSnapshotsMs = Date.now() - stageSnapshotsStartedAt;
  const nationalChampionships = await nationalChampionshipsPromise;

  const finalizedStageRaces = (
    includeDeferred ? selectedFinalizedStageCandidates : selectedHomepageRecentCandidates
  ).filter(isFinalizedStageRace);
  const liveStageRaces = selectedLiveStageCandidates.filter(
    (race) => !isFinalizedStageRace(race) || isRaceWithinScheduledLiveWindow(race, todayUtc),
  );
  // On the homepage, show every finished recent WorldTour race in date order:
  // one-day results plus finalized stage races. A finished stage race that could
  // not be enriched into a snapshot still appears (rendered from its season-table
  // winner/podium) rather than being dropped from the grid entirely.
  const recentResults = (
    includeDeferred
      ? [...selectedRecentOneDayResults, ...finalizedStageRaces]
      : [...selectedHomepageRecentCandidates]
  ).sort((left, right) => right.endDate - left.endDate);

  finalizedStageRaces.forEach((race) => {
    if (!race.resultStandings?.length) {
      race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
    }
  });

  selectedEuropeTourRecentResults.forEach((race) => {
    if (!race.resultStandings?.length) {
      race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
    }
  });

  [
    ...recentResults,
    ...liveStageRaces,
    ...selectedUpcomingRaces,
    ...selectedEuropeTourRecentResults,
    ...selectedEuropeTourLiveStageRaces,
    ...selectedEuropeTourUpcomingRaces,
  ].forEach((race) => {
    race.finishedToday = Boolean(race.endDate && race.endDate.getTime() === todayUtc.getTime());
  });

  // Resolve YouTube finish videos for the races that render a finish link, after
  // curated/official sources have had their say. Bounded + cached so it does not
  // dominate cold-start latency; failures degrade silently to no link.
  await enrichFinishVideos([...recentResults, ...liveStageRaces, ...selectedEuropeTourRecentResults, ...selectedEuropeTourLiveStageRaces]);
  await enrichStageFinishVideos([...liveStageRaces, ...selectedEuropeTourLiveStageRaces]);
  await enrichStageProfiles([...liveStageRaces, ...finalizedStageRaces, ...recentResults]);
  // Fire-and-forget: these races already render from Wikipedia, and their provider is
  // still in flight rather than re-requested.
  applyLateOfficialSnapshots(lateOfficialLookups);

  return {
    fetchedAt: new Date().toISOString(),
    metadataFetchedAt: metadata?.fetchedAt || "",
    recentResults,
    finalizedStageRaces,
    liveStageRaces,
    upcomingRaces: selectedUpcomingRaces,
    europeTourRecentResults: selectedEuropeTourRecentResults,
    europeTourLiveStageRaces: selectedEuropeTourLiveStageRaces,
    europeTourUpcomingRaces: selectedEuropeTourUpcomingRaces,
    nationalChampionships,
    seasonCalendar: buildSeasonCalendar(allRaces.filter(isWorldTourRace), todayUtc),
    buildTimings: {
      totalMs: Date.now() - startedAt,
      recentStandingsMs,
      finalizedStageStandingsMs,
      stageSnapshotsMs,
      nationalChampionshipsMs,
      recentResultCount: includeDeferred ? selectedRecentOneDayResults.length : selectedHomepageRecentCandidates.length,
      recentStandingsTargetCount: homepageRecentEnrichTargets.length,
      lateOfficialSnapshotCount: lateOfficialLookups.length,
      finalizedStageCandidateCount: selectedFinalizedStageCandidates.length,
      liveStageCandidateCount: selectedLiveStageCandidates.length,
      stageRaceDisplayCount: stageRaceDisplays.length,
      upcomingRaceCount: selectedUpcomingRaces.length,
      includeDeferred,
      metadataBuildTimings: metadata?.buildTimings || null,
    },
  };
}

async function buildCompetitionGroupRaceData(metadata, groupId) {
  const startedAt = Date.now();
  const allRaces = cloneRaces(metadata?.allRaces || []);
  const {
    todayUtc,
    recentOneDayResults,
    finalizedStageCandidates,
    liveStageCandidates,
    upcomingRaces,
    europeTourRecentResults,
    europeTourLiveStageRaces,
    europeTourUpcomingRaces,
  } = partitionRaceBuckets(allRaces);
  const wikiRawLoader = createWikiRawLoader();

  if (groupId === "proseries") {
    const selectedRecentCandidates = [...recentOneDayResults, ...finalizedStageCandidates]
      .filter((race) => /ProSeries/.test(race.series))
      .sort((left, right) => right.endDate - left.endDate)
      .slice(0, PROSERIES_RECENT_RESULTS);
    const selectedLiveStageCandidates = liveStageCandidates.filter((race) => /ProSeries/.test(race.series));
    const selectedUpcomingRaces = upcomingRaces.filter((race) => /ProSeries/.test(race.series));
    const stageRaceDisplays = [...selectedLiveStageCandidates, ...selectedRecentCandidates].filter(isMultiDayRace);

    const recentStandingsStartedAt = Date.now();
    await enrichRecentResultStandings(selectedRecentCandidates, wikiRawLoader);
    const recentStandingsMs = Date.now() - recentStandingsStartedAt;

    const stageSnapshotsStartedAt = Date.now();
    await enrichStageRaceSnapshots(stageRaceDisplays, wikiRawLoader);
    const stageSnapshotsMs = Date.now() - stageSnapshotsStartedAt;

    const finalizedStageRaces = selectedRecentCandidates.filter(isFinalizedStageRace);
    const liveStageRaces = selectedLiveStageCandidates.filter((race) => !isFinalizedStageRace(race));
    const recentResults = [
      ...selectedRecentCandidates.filter(isOneDayRace),
      ...finalizedStageRaces,
    ].sort((left, right) => right.endDate - left.endDate);

    finalizedStageRaces.forEach((race) => {
      if (!race.resultStandings?.length) {
        race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
      }
    });

    [...recentResults, ...liveStageRaces, ...selectedUpcomingRaces].forEach((race) => {
      race.finishedToday = Boolean(race.endDate && race.endDate.getTime() === todayUtc.getTime());
    });

    return {
      fetchedAt: new Date().toISOString(),
      metadataFetchedAt: metadata?.fetchedAt || "",
      recentResults,
      finalizedStageRaces,
      liveStageRaces,
      upcomingRaces: selectedUpcomingRaces,
      europeTourRecentResults: [],
      europeTourLiveStageRaces: [],
      europeTourUpcomingRaces: [],
      buildTimings: {
        totalMs: Date.now() - startedAt,
        recentStandingsMs,
        finalizedStageStandingsMs: 0,
        stageSnapshotsMs,
        recentResultCount: selectedRecentCandidates.length,
        recentStandingsTargetCount: selectedRecentCandidates.length,
        finalizedStageCandidateCount: finalizedStageRaces.length,
        liveStageCandidateCount: selectedLiveStageCandidates.length,
        stageRaceDisplayCount: stageRaceDisplays.length,
        upcomingRaceCount: selectedUpcomingRaces.length,
        includeDeferred: true,
        targetGroupId: groupId,
        metadataBuildTimings: metadata?.buildTimings || null,
      },
    };
  }

  if (groupId === "europe-tour") {
    const selectedRecentResults = cloneRaces(europeTourRecentResults);
    const selectedLiveStageRaces = cloneRaces(europeTourLiveStageRaces);
    const selectedUpcomingRaces = cloneRaces(europeTourUpcomingRaces);
    const stageRaceDisplays = [...selectedRecentResults, ...selectedLiveStageRaces].filter(isMultiDayRace);

    const stageSnapshotsStartedAt = Date.now();
    await enrichStageRaceSnapshots(stageRaceDisplays, wikiRawLoader);
    const stageSnapshotsMs = Date.now() - stageSnapshotsStartedAt;

    selectedRecentResults.forEach((race) => {
      if (!race.resultStandings?.length) {
        race.resultStandings = selectStandings(race.stageRace?.generalClassification?.standings, race.stageRace?.overallResult);
      }
    });

    [...selectedRecentResults, ...selectedLiveStageRaces, ...selectedUpcomingRaces].forEach((race) => {
      race.finishedToday = Boolean(race.endDate && race.endDate.getTime() === todayUtc.getTime());
    });

    return {
      fetchedAt: new Date().toISOString(),
      metadataFetchedAt: metadata?.fetchedAt || "",
      recentResults: [],
      finalizedStageRaces: [],
      liveStageRaces: [],
      upcomingRaces: [],
      europeTourRecentResults: selectedRecentResults,
      europeTourLiveStageRaces: selectedLiveStageRaces,
      europeTourUpcomingRaces: selectedUpcomingRaces,
      buildTimings: {
        totalMs: Date.now() - startedAt,
        recentStandingsMs: 0,
        finalizedStageStandingsMs: 0,
        stageSnapshotsMs,
        recentResultCount: selectedRecentResults.length,
        recentStandingsTargetCount: 0,
        finalizedStageCandidateCount: 0,
        liveStageCandidateCount: selectedLiveStageRaces.length,
        stageRaceDisplayCount: stageRaceDisplays.length,
        upcomingRaceCount: selectedUpcomingRaces.length,
        includeDeferred: true,
        targetGroupId: groupId,
        metadataBuildTimings: metadata?.buildTimings || null,
      },
    };
  }

  throw new Error(`Unsupported competition group: ${groupId}`);
}

function refreshRaceMetadataInBackground(options = {}) {
  const includeDeferred = options.includeDeferred === true;
  const resetOnFailure = options.resetOnFailure === true;
  const targetCache = includeDeferred ? deferredRaceMetadataCache : raceMetadataCache;
  if (targetCache.promise) {
    return targetCache.promise;
  }

  const buildPromise = buildRaceMetadata({ includeDeferred })
    .then((data) => {
      const nextCache = {
        updatedAt: Date.now(),
        data,
        promise: null,
      };
      if (includeDeferred) {
        deferredRaceMetadataCache = nextCache;
      } else {
        raceMetadataCache = nextCache;
      }
      return data;
    })
    .catch((error) => {
      const fallbackCache = {
        updatedAt: resetOnFailure ? 0 : targetCache.updatedAt,
        data: resetOnFailure ? null : targetCache.data,
        promise: null,
      };
      if (includeDeferred) {
        deferredRaceMetadataCache = fallbackCache;
      } else {
        raceMetadataCache = fallbackCache;
      }
      throw error;
    });

  if (includeDeferred) {
    deferredRaceMetadataCache = {
      ...targetCache,
      promise: buildPromise,
    };
  } else {
    raceMetadataCache = {
      ...targetCache,
      promise: buildPromise,
    };
  }

  return buildPromise;
}

async function loadRaceMetadata(options = {}) {
  const includeDeferred = options.includeDeferred === true;
  const targetCache = includeDeferred ? deferredRaceMetadataCache : raceMetadataCache;
  const now = Date.now();
  if (targetCache.data) {
    if (now - targetCache.updatedAt < RACE_METADATA_CACHE_TTL_MS) {
      return targetCache.data;
    }

    refreshRaceMetadataInBackground({ includeDeferred, resetOnFailure: false }).catch(() => {});
    return targetCache.data;
  }

  return refreshRaceMetadataInBackground({ includeDeferred, resetOnFailure: true });
}

function refreshRaceDataInBackground(metadata, options = {}) {
  const includeDeferred = options.includeDeferred === true;
  const resetOnFailure = options.resetOnFailure === true;
  const targetCache = includeDeferred ? deferredRaceDataCache : raceDataCache;
  if (targetCache.promise) {
    return targetCache.promise;
  }

  const buildPromise = buildRaceData(metadata, { includeDeferred })
    .then((data) => {
      const nextCache = {
        updatedAt: Date.now(),
        data,
        promise: null,
      };
      if (includeDeferred) {
        deferredRaceDataCache = nextCache;
      } else {
        raceDataCache = nextCache;
      }
      return data;
    })
    .catch((error) => {
      const fallbackCache = {
        updatedAt: resetOnFailure ? 0 : targetCache.updatedAt,
        data: resetOnFailure ? null : targetCache.data,
        promise: null,
      };
      if (includeDeferred) {
        deferredRaceDataCache = fallbackCache;
      } else {
        raceDataCache = fallbackCache;
      }
      throw error;
    });

  if (includeDeferred) {
    deferredRaceDataCache = {
      ...targetCache,
      promise: buildPromise,
    };
  } else {
    raceDataCache = {
      ...targetCache,
      promise: buildPromise,
    };
  }

  return buildPromise;
}

async function loadRaceData(options = {}) {
  const includeDeferred = options.includeDeferred === true;
  const metadata = await loadRaceMetadata({ includeDeferred });
  const targetCache = includeDeferred ? deferredRaceDataCache : raceDataCache;
  const now = Date.now();
  if (targetCache.data) {
    const ttlMs = getRaceDataCacheTtlMs(targetCache.data);
    const hasFreshData = hasFreshnessSensitiveRaceData(targetCache.data);
    if (now - targetCache.updatedAt < ttlMs) {
      return targetCache.data;
    }

    if (hasFreshData) {
      return refreshRaceDataInBackground(metadata, { includeDeferred, resetOnFailure: false });
    }

    refreshRaceDataInBackground(metadata, { includeDeferred, resetOnFailure: false }).catch(() => {});
    return targetCache.data;
  }

  return refreshRaceDataInBackground(metadata, { includeDeferred, resetOnFailure: true });
}

function getDeferredGroupDataCache(groupId) {
  if (!deferredGroupDataCaches.has(groupId)) {
    deferredGroupDataCaches.set(groupId, {
      updatedAt: 0,
      data: null,
      promise: null,
    });
  }

  return deferredGroupDataCaches.get(groupId);
}

function refreshCompetitionGroupDataInBackground(metadata, groupId, options = {}) {
  const resetOnFailure = options.resetOnFailure === true;
  const targetCache = getDeferredGroupDataCache(groupId);
  if (targetCache.promise) {
    return targetCache.promise;
  }

  const buildPromise = buildCompetitionGroupRaceData(metadata, groupId)
    .then((data) => {
      deferredGroupDataCaches.set(groupId, {
        updatedAt: Date.now(),
        data,
        promise: null,
      });
      return data;
    })
    .catch((error) => {
      deferredGroupDataCaches.set(groupId, {
        updatedAt: resetOnFailure ? 0 : targetCache.updatedAt,
        data: resetOnFailure ? null : targetCache.data,
        promise: null,
      });
      throw error;
    });

  deferredGroupDataCaches.set(groupId, {
    ...targetCache,
    promise: buildPromise,
  });

  return buildPromise;
}

async function loadCompetitionGroupData(groupId) {
  if (!DEFERRED_COMPETITION_GROUP_IDS.has(groupId)) {
    throw new Error(`Unsupported competition group: ${groupId}`);
  }

  const metadata = await loadRaceMetadata({ includeDeferred: true });
  const targetCache = getDeferredGroupDataCache(groupId);
  const now = Date.now();
  if (targetCache.data) {
    const ttlMs = getRaceDataCacheTtlMs(targetCache.data);
    const hasFreshData = hasFreshnessSensitiveRaceData(targetCache.data);
    if (now - targetCache.updatedAt < ttlMs) {
      return targetCache.data;
    }

    if (hasFreshData) {
      return refreshCompetitionGroupDataInBackground(metadata, groupId, { resetOnFailure: false });
    }

    refreshCompetitionGroupDataInBackground(metadata, groupId, { resetOnFailure: false }).catch(() => {});
    return targetCache.data;
  }

  return refreshCompetitionGroupDataInBackground(metadata, groupId, { resetOnFailure: true });
}

function warmRaceDataInBackground() {
  if (raceDataCache.promise) {
    return raceDataCache.promise;
  }

  return loadRaceMetadata({ includeDeferred: false })
    .then((metadata) => refreshRaceDataInBackground(metadata, { includeDeferred: false, resetOnFailure: true }))
    .catch((error) => {
      throw error;
    });
}

function shouldServeHomepageWarmup(now = Date.now()) {
  if (!raceDataCache.data) {
    return true;
  }

  const ttlMs = getRaceDataCacheTtlMs(raceDataCache.data);
  const hasLiveRaces =
    (raceDataCache.data.liveStageRaces?.length || raceDataCache.data.europeTourLiveStageRaces?.length || 0) > 0;
  const isExpired = now - raceDataCache.updatedAt >= ttlMs;

  return Boolean(raceDataCache.promise || (hasLiveRaces && isExpired));
}

function buildRaceDataDebugPayload(data) {
  return {
    ...data,
    debug: {
      build: BUILD_INFO,
      raceDataCacheUpdatedAt: raceDataCache.updatedAt ? new Date(raceDataCache.updatedAt).toISOString() : "",
      deferredRaceDataCacheUpdatedAt: deferredRaceDataCache.updatedAt
        ? new Date(deferredRaceDataCache.updatedAt).toISOString()
        : "",
      raceMetadataCacheUpdatedAt: raceMetadataCache.updatedAt
        ? new Date(raceMetadataCache.updatedAt).toISOString()
        : "",
      deferredRaceMetadataCacheUpdatedAt: deferredRaceMetadataCache.updatedAt
        ? new Date(deferredRaceMetadataCache.updatedAt).toISOString()
        : "",
      raceDataCacheAgeMs: raceDataCache.updatedAt ? Math.max(0, Date.now() - raceDataCache.updatedAt) : null,
      deferredRaceDataCacheAgeMs: deferredRaceDataCache.updatedAt
        ? Math.max(0, Date.now() - deferredRaceDataCache.updatedAt)
        : null,
      raceMetadataCacheAgeMs: raceMetadataCache.updatedAt ? Math.max(0, Date.now() - raceMetadataCache.updatedAt) : null,
      deferredRaceMetadataCacheAgeMs: deferredRaceMetadataCache.updatedAt
        ? Math.max(0, Date.now() - deferredRaceMetadataCache.updatedAt)
        : null,
      liveRaceDataTtlMs: getRaceDataCacheTtlMs(data),
      metadataTtlMs: RACE_METADATA_CACHE_TTL_MS,
      liveRaceCount: Array.isArray(data?.liveStageRaces) ? data.liveStageRaces.length : 0,
      buildTimings: data?.buildTimings || null,
    },
  };
}

function buildHomepageDataPayload(data) {
  return {
    fetchedAt: data.fetchedAt,
    metadataFetchedAt: data.metadataFetchedAt,
    recentResults: data.recentResults,
    finalizedStageRaces: data.finalizedStageRaces,
    liveStageRaces: data.liveStageRaces,
    upcomingRaces: data.upcomingRaces,
    nationalChampionships: data.nationalChampionships,
    seasonCalendar: data.seasonCalendar,
  };
}

function parseClockSeconds(value) {
  const parts = String(value || "").split(":").map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function formatClock(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatGap(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// A stage result shows both the finishing time and the gap to the winner. Sources
// rarely give both — an official provider does, Wikipedia gives the winner's time and
// everyone else's gap — so whichever half is missing is derived from the winner's time.
// A rider on the winner's time reads "s.t.", the convention every fan knows.
function getStageStandingMetrics(entry, winnerSeconds) {
  const time = normalizeStandingTime(entry?.time || "");
  const gap = normalizeStandingGap(entry?.gap || "");
  const rawGap = cleanFeedText(String(entry?.gap || "")).trim();
  const isWinner = String(entry?.place || "") === "1";
  const seconds = parseClockSeconds(time);
  const gapSeconds = gap ? parseClockSeconds(gap.slice(1)) : null;

  if (isWinner) {
    return { time, gap: "" };
  }

  if (seconds !== null && winnerSeconds !== null) {
    const delta = seconds - winnerSeconds;
    return { time, gap: delta > 0 ? formatGap(delta) : delta === 0 ? "s.t." : gap };
  }

  if (gapSeconds !== null && winnerSeconds !== null) {
    return { time: formatClock(winnerSeconds + gapSeconds), gap };
  }

  if (!time && !gap && winnerSeconds !== null && /^(s\.?t\.?|same time)$/i.test(rawGap)) {
    return { time: formatClock(winnerSeconds), gap: "s.t." };
  }

  return { time, gap };
}

function getStandingMetric(entry, context = "default") {
  const time = normalizeStandingTime(entry?.time || "");
  const gap = normalizeStandingGap(entry?.gap || "");

  if (context === "stage") {
    return time || gap;
  }

  if (context === "gc") {
    return entry?.place === "1" ? time : gap || time;
  }

  return gap || time;
}

function buildPodiumMarkup(entries, options = {}) {
  const metricContext = options.metricContext || "default";
  const winner = entries.find((entry) => String(entry?.place || "") === "1") || entries[0];
  const winnerSeconds = metricContext === "stage" ? parseClockSeconds(normalizeStandingTime(winner?.time || "")) : null;
  const podium = entries
    .filter((entry) => entry?.rider)
    .map(
      (entry) => `
        <li class="podium-item">
          <span class="podium-place place-${escapeHtml(entry.place)}">${escapeHtml(entry.place)}</span>
          ${buildRiderMarkup(entry, "podium-rider", { metricContext, winnerSeconds })}
        </li>`,
    )
    .join("");

  return podium ? `<ol class="podium-list">${podium}</ol>` : `<p class="meta">Result details are still being updated.</p>`;
}

function extractYouTubeInitialData(html) {
  const text = String(html || "");
  const match =
    text.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/) ||
    text.match(/ytInitialData"\]\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function getYouTubeRendererText(node) {
  if (!node) {
    return "";
  }
  if (typeof node.simpleText === "string") {
    return node.simpleText;
  }
  if (Array.isArray(node.runs)) {
    return node.runs.map((run) => run?.text || "").join("");
  }
  return "";
}

function collectYouTubeVideoRenderers(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((value) => collectYouTubeVideoRenderers(value, out));
  } else if (node && typeof node === "object") {
    if (node.videoRenderer?.videoId) {
      out.push(node.videoRenderer);
    }
    Object.values(node).forEach((value) => collectYouTubeVideoRenderers(value, out));
  }
  return out;
}

function parseYouTubeDurationSeconds(text) {
  const parts = String(text || "")
    .trim()
    .split(":")
    .map((value) => Number.parseInt(value, 10));
  if (parts.length === 0 || parts.some((value) => Number.isNaN(value))) {
    return 0;
  }
  return parts.reduce((total, value) => total * 60 + value, 0);
}

function parseYouTubeSearchVideos(html) {
  const data = extractYouTubeInitialData(html);
  if (!data) {
    return [];
  }

  return collectYouTubeVideoRenderers(data)
    .map((renderer) => ({
      id: renderer.videoId,
      title: getYouTubeRendererText(renderer.title),
      channel: getYouTubeRendererText(renderer.ownerText) || getYouTubeRendererText(renderer.longBylineText),
      lengthSeconds: parseYouTubeDurationSeconds(getYouTubeRendererText(renderer.lengthText)),
      ageText: getYouTubeRendererText(renderer.publishedTimeText),
      verified: (renderer.ownerBadges || []).some((badge) =>
        /VERIFIED|OFFICIAL_ARTIST|OFFICIAL/i.test(badge?.metadataBadgeRenderer?.style || ""),
      ),
    }))
    .filter((video) => video.id && video.title);
}

function buildFinishVideoQuery(race) {
  const base = cleanFeedText(getRaceArticleVariants(race)[0] || race?.title || "").replace(/^20\d{2}\s+/, "");
  if (!base) {
    return "";
  }

  const year = getRaceYear(race);
  const stageNumber = getRaceCoverageStageNumber(race);
  return [base, year || "", stageNumber > 0 ? `stage ${stageNumber}` : "", "highlights"]
    .filter(Boolean)
    .join(" ");
}

// A finish video must come from a source we trust, because a title/description can
// be gamed: clickbait channels post talking-head videos titled "<race> stage N
// highlights" that are not the race at all. Accept, in order:
//   1. a major broadcaster from the trusted list;
//   2. the race's own official channel (its name carries the race tokens), verified;
//   3. any other channel only when it is YouTube-verified (an established channel,
//      not a throwaway) AND the clip runs a sensible highlights length.
// Rule 3 is the deliberately looser middle ground: it still blocks unverified
// clickbait and Shorts/VODs while recovering coverage from legitimate verified
// channels that are not on the broadcaster list.
function isRecognizedFinishVideoSource(video, race) {
  if (TRUSTED_FINISH_VIDEO_CHANNELS.some((channel) => channel.pattern.test(video.channel))) {
    return true;
  }

  if (!video.verified) {
    return false;
  }

  const tokens = getRaceTokens(race);
  const channelText = normalizeSearchText(video.channel);
  const channelTokenMatches = tokens.filter((token) => channelText.includes(token)).length;
  const isOfficialRaceChannel = tokens.length > 0 && channelTokenMatches >= Math.min(2, tokens.length);

  const hasSensibleLength =
    video.lengthSeconds >= FINISH_VIDEO_MIN_LENGTH_SECONDS &&
    video.lengthSeconds <= FINISH_VIDEO_MAX_LENGTH_SECONDS;

  return isOfficialRaceChannel || hasSensibleLength;
}

function isLikelyFinishVideo(video, race) {
  const combined = normalizeSearchText(`${video.title} ${video.channel}`);
  const titleText = normalizeSearchText(video.title);
  const tokens = getRaceTokens(race);

  // Only surface finish videos from recognized sources; a correct-looking title
  // from an unknown channel is not enough (it is often clickbait).
  if (!isRecognizedFinishVideoSource(video, race)) {
    return false;
  }
  // Match race tokens against the title, not the channel: official ASO channels
  // (e.g. a channel literally named "Tour de France") also post highlights for the
  // other races they organise, so a channel-name match would wrongly admit a
  // different race's stage. The title is what identifies the actual clip.
  const tokenMatches = tokens.filter((token) => titleText.includes(token)).length;

  // Require at least one strong, race-specific token so generic cycling clips are dropped.
  if (tokens.length > 0 && tokenMatches === 0) {
    return false;
  }

  // Reject a clearly different edition (e.g. last year's highlights surfacing for
  // the same race). A title with no year is allowed through.
  const raceYear = getRaceYear(race);
  if (raceYear) {
    const mentionedYears = extractMentionedYears(video.title);
    if (mentionedYears.length > 0 && !mentionedYears.includes(raceYear)) {
      return false;
    }
  }

  // Stage races: the title must name the exact stage, otherwise it could be a
  // different stage, an overall recap, or a non-result clip.
  const stageNumber = getRaceCoverageStageNumber(race);
  if (stageNumber > 0 && !new RegExp(`\\bstage ?${stageNumber}\\b`).test(titleText)) {
    return false;
  }

  const division = getRaceDivision(race);
  if (division === "women" && !hasWomenMarker(combined)) {
    return false;
  }
  if (division === "men" && hasWomenMarker(combined) && !hasMenMarker(combined)) {
    return false;
  }

  if (
    /\bpreview\b|how to watch|where to watch|\blive\b|live ?stream|\bteaser\b|start ?list|\bprofile\b|\bguide\b|\bpredict|storylines|what to expect|beyond the podium|\bpre-?race\b|warm-?up/i.test(
      video.title,
    )
  ) {
    return false;
  }

  return true;
}

function scoreFinishVideo(video, race) {
  const titleText = normalizeSearchText(video.title);
  const channelText = normalizeSearchText(video.channel);
  const tokens = getRaceTokens(race);
  let score = 0;

  for (const channel of TRUSTED_FINISH_VIDEO_CHANNELS) {
    if (channel.pattern.test(video.channel)) {
      score += channel.score;
      break;
    }
  }

  // The race's own official channel (channel name carries the race tokens) is the
  // most authoritative source for a finish video.
  // Official race channels are globally available and permanent, unlike
  // region-locked broadcaster uploads, so they should win when they exist.
  const channelTokenMatches = tokens.filter((token) => channelText.includes(token)).length;
  if (tokens.length > 0 && channelTokenMatches >= Math.min(2, tokens.length)) {
    score += 70;
  }

  if (video.verified) {
    score += 15;
  }

  if (/\bextended highlights\b/i.test(video.title)) {
    score += 32;
  } else if (/\bhighlights\b|\brecap\b|\bfinish\b|final kilomet|last kilomet|\bfinale\b/i.test(video.title)) {
    score += 24;
  }

  score += tokens.filter((token) => titleText.includes(token)).length * 10;

  const seconds = video.lengthSeconds;
  if (seconds >= 120 && seconds <= 20 * 60) {
    score += 12;
  } else if (seconds > 0 && seconds < 75) {
    score -= 12;
  } else if (seconds > 45 * 60) {
    score -= 8;
  }

  if (/\b(?:hour|minute)s?\b|just now|\btoday\b/i.test(video.ageText)) {
    score += 20;
  } else if (/\b1 day\b/i.test(video.ageText) || /\bdays\b/i.test(video.ageText)) {
    score += 10;
  } else if (/\bweek\b|\bweeks\b/i.test(video.ageText)) {
    score += 4;
  }

  return score;
}

function selectFinishVideo(videos, race) {
  return videos
    .filter((video) => isLikelyFinishVideo(video, race))
    .map((video) => ({ video, score: scoreFinishVideo(video, race) }))
    .sort((left, right) => right.score - left.score)[0]?.video || null;
}

async function fetchYouTubeFinishVideoUrl(race) {
  const query = buildFinishVideoQuery(race);
  if (!query) {
    return "";
  }

  const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  const best = selectFinishVideo(parseYouTubeSearchVideos(html), race);
  return best ? `https://www.youtube.com/watch?v=${best.id}` : "";
}

function hasCuratedFinishVideo(race) {
  const mapped = RACE_FINISH_VIDEO_URLS[getRaceId(race)];
  if (!mapped) {
    return false;
  }
  if (typeof mapped === "string") {
    return true;
  }
  return Boolean(mapped[getRaceCoverageStageNumber(race)]);
}

async function resolveRaceFinishVideoUrl(race) {
  const key = `${getRaceId(race)}|${getRaceCoverageStageNumber(race)}`;
  const cached = finishVideoCache.get(key);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? FINISH_VIDEO_CACHE_TTL_MS : FINISH_VIDEO_MISS_CACHE_TTL_MS;
    if (now - cached.updatedAt < ttl) {
      return cached.url;
    }
  }

  try {
    const url = await fetchYouTubeFinishVideoUrl(race);
    finishVideoCache.set(key, { updatedAt: Date.now(), url });
    return url;
  } catch {
    if (cached) {
      return cached.url;
    }
    finishVideoCache.set(key, { updatedAt: now, url: "" });
    return "";
  }
}

function shouldSearchFinishVideo(race, todayUtc) {
  if (!race || hasCuratedFinishVideo(race)) {
    return false;
  }
  // A provider (e.g. the Giro livefeed) may already have supplied a stage video.
  if (race.stageRace?.latestStage?.finishVideoUrl || race.finishVideoUrl) {
    return false;
  }

  const liveStageWithResult =
    isMultiDayRace(race) &&
    !isFinalizedStageRace(race) &&
    (race.stageRace?.latestStage?.standings?.length || 0) > 0;
  if (liveStageWithResult) {
    return true;
  }

  const endUtc = toUtcDateOnly(race.endDate);
  if (!endUtc) {
    return false;
  }
  const ageDays = Math.floor((todayUtc.getTime() - endUtc.getTime()) / (24 * 60 * 60 * 1000));
  return ageDays >= 0 && ageDays <= FINISH_VIDEO_MAX_AGE_DAYS;
}

async function enrichFinishVideos(races, now = new Date()) {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const seenKeys = new Set();
  const candidates = [];
  for (const race of races || []) {
    if (!shouldSearchFinishVideo(race, todayUtc)) {
      continue;
    }
    const key = `${getRaceId(race)}|${getRaceCoverageStageNumber(race)}`;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    candidates.push(race);
    if (candidates.length >= FINISH_VIDEO_LOOKUP_LIMIT) {
      break;
    }
  }

  await Promise.all(
    candidates.map(async (race) => {
      const url = await resolveRaceFinishVideoUrl(race);
      if (!url) {
        return;
      }
      if (isMultiDayRace(race) && race.stageRace?.latestStage) {
        race.stageRace.latestStage.finishVideoUrl = race.stageRace.latestStage.finishVideoUrl || url;
      } else {
        race.finishVideoUrl = race.finishVideoUrl || url;
      }
    }),
  );
}

// The whole-race entry in RACE_FINISH_VIDEO_URLS is the video for a race's finish, so
// it belongs to the final stage only; an earlier stage takes a per-stage map entry or
// whatever the per-stage search stored on the stage itself.
// Every finish-video helper — the query builder, the cache key, the curated-map
// lookup, the title matcher — reads the stage off the race object. Asking about an
// earlier stage is therefore a matter of presenting that stage as the current one,
// rather than threading a stage argument through all of them. finishVideoUrl is
// dropped so the subject is judged on the stage's own state and not the race's
// headline video, which would otherwise suppress the search.
function buildStageFinishVideoSubject(race, stage) {
  const { finishVideoUrl, ...raceWithoutVideo } = race;

  return {
    ...raceWithoutVideo,
    stageRace: {
      ...race.stageRace,
      completedStages: stage.number,
      latestStage: { number: stage.number, label: stage.label, standings: stage.standings },
    },
  };
}

// Earlier stages get their own bounded pass so they never compete with other races'
// current stages for FINISH_VIDEO_LOOKUP_LIMIT. Restricted to live races for the same
// reason companion stage articles are: a three-week race would otherwise fire twenty
// searches on one cold start. Results cache per (race, stage), so the backlog fills in
// over successive refreshes instead of all at once, newest stage first.
// Real stage profiles. ASO's race sites embed each stage as a komoot tour, and komoot's
// public API returns the tour's distance, climbing total and the full coordinate trace
// with altitudes. That is the same data the organiser's profile graphic is drawn from,
// so a race listed here renders its true profile; everything else falls back to the
// stylised silhouette for its stage type. Only the current edition is looked up: the
// sites always show this year's race, whatever year the Wikipedia page describes.
const STAGE_PROFILE_SOURCES = [
  {
    matches: (race) => /^\d{4} Vuelta a España$/.test(race?.pageTitle || ""),
    stageUrl: (stageNumber) => `https://www.lavuelta.es/en/stage-${stageNumber}`,
  },
  {
    matches: (race) => /^\d{4} Tour de France$/.test(race?.pageTitle || ""),
    stageUrl: (stageNumber) => `https://www.letour.fr/en/stage-${stageNumber}`,
  },
  {
    matches: (race) => /^\d{4} Tour de France Femmes$/.test(race?.pageTitle || ""),
    stageUrl: (stageNumber) => `https://www.letourfemmes.fr/en/stage-${stageNumber}`,
  },
  {
    matches: (race) => /^\d{4} La Vuelta Femenina$/.test(race?.pageTitle || ""),
    stageUrl: (stageNumber) => `https://www.lavueltafemenina.es/en/stage-${stageNumber}`,
  },
];
const STAGE_PROFILE_LOOKUP_LIMIT = 8;
const STAGE_PROFILE_BLOCKING_BUDGET_MS = 2500;
const STAGE_PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STAGE_PROFILE_MISS_TTL_MS = 60 * 60 * 1000;
const STAGE_PROFILE_POINT_COUNT = 120;
const stageProfileCache = new Map();
const PERSISTED_STAGE_PROFILE_PATH = path.join(process.cwd(), "data", "stage-profiles.json");

// The in-memory cache dies with every deploy and Railway's disk is ephemeral, so
// profiles that have been fetched once are also committed to data/stage-profiles.json
// by scripts/refresh-stage-profiles.js and seeded from there at startup. A seeded entry
// never expires: a published profile does not change. Runtime fetches still happen for
// anything the file lacks, so a live race stays current between refreshes.
function loadPersistedStageProfiles(filePath = PERSISTED_STAGE_PROFILE_PATH) {
  let entries;
  try {
    // `fs` here is fs/promises; the seed has to be synchronous so it lands before the
    // first build.
    entries = JSON.parse(require("fs").readFileSync(filePath, "utf8"));
  } catch (error) {
    return 0;
  }

  let seeded = 0;
  Object.entries(entries?.profiles || {}).forEach(([key, entry]) => {
    if (entry?.profile && Array.isArray(entry.profile.points) && entry.profile.points.length > 1) {
      stageProfileCache.set(key, { fetchedAt: Date.now(), profile: entry.profile, persistent: true });
      seeded += 1;
    }
  });
  return seeded;
}

loadPersistedStageProfiles();

function extractKomootTourReference(html) {
  const match = String(html || "").match(/komoot\.com\/tour\/(\d+)\/embed\?share_token=([A-Za-z0-9_-]+)/);
  return match ? { tourId: match[1], shareToken: match[2] } : null;
}

function haversineKm(from, to) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

// Resample the trace to a fixed number of points evenly spaced by distance, so a stage
// carries a couple of kilobytes rather than thousands of GPS fixes. Each sample takes
// the highest altitude in its window rather than the average, which keeps a sharp
// summit from being smoothed away.
function buildStageProfileFromKomoot(tour, coordinates) {
  const items = (Array.isArray(coordinates?.items) ? coordinates.items : []).filter(
    (item) => Number.isFinite(item?.lat) && Number.isFinite(item?.lng) && Number.isFinite(item?.alt),
  );
  if (items.length < 2) {
    return null;
  }

  const cumulative = [0];
  for (let index = 1; index < items.length; index += 1) {
    cumulative.push(cumulative[index - 1] + haversineKm(items[index - 1], items[index]));
  }
  const traceKm = cumulative[cumulative.length - 1];
  const distanceKm = Number(tour?.distance) > 0 ? Number(tour.distance) / 1000 : traceKm;
  if (!(traceKm > 0)) {
    return null;
  }

  const points = [];
  let cursor = 0;
  for (let sample = 0; sample < STAGE_PROFILE_POINT_COUNT; sample += 1) {
    const windowEnd = ((sample + 1) / STAGE_PROFILE_POINT_COUNT) * traceKm;
    let altitude = items[cursor].alt;
    while (cursor < items.length - 1 && cumulative[cursor + 1] <= windowEnd) {
      cursor += 1;
      altitude = Math.max(altitude, items[cursor].alt);
    }
    if (sample === STAGE_PROFILE_POINT_COUNT - 1) {
      altitude = items[items.length - 1].alt;
    }
    points.push([Math.round((sample / (STAGE_PROFILE_POINT_COUNT - 1)) * distanceKm * 10) / 10, Math.round(altitude)]);
  }
  points[0] = [0, Math.round(items[0].alt)];

  const altitudes = points.map((point) => point[1]);
  return {
    source: "komoot",
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevationGainM: Math.round(Number(tour?.elevation_up) || 0),
    elevationLossM: Math.round(Number(tour?.elevation_down) || 0),
    minAltM: Math.min(...altitudes),
    maxAltM: Math.max(...altitudes),
    points,
  };
}

async function fetchStageProfile(stagePageUrl) {
  const reference = extractKomootTourReference(await fetchText(stagePageUrl));
  if (!reference) {
    return null;
  }

  const base = `https://api.komoot.de/v007/tours/${encodeURIComponent(reference.tourId)}`;
  const query = `?share_token=${encodeURIComponent(reference.shareToken)}`;
  const [tour, coordinates] = await Promise.all([fetchJson(base + query), fetchJson(`${base}/coordinates${query}`)]);
  return buildStageProfileFromKomoot(tour, coordinates);
}

function getStageProfileSource(race, now = new Date()) {
  if (getRaceYear(race) !== now.getUTCFullYear()) {
    return null;
  }
  return STAGE_PROFILE_SOURCES.find((source) => source.matches(race)) || null;
}

function getStageProfileCacheKey(race, stage) {
  return `${getRaceId(race)}#${stage?.number}`;
}

function getCachedStageProfile(race, stageNumber) {
  return stageProfileCache.get(getStageProfileCacheKey(race, { number: stageNumber }))?.profile || null;
}

// The stage after the last raced one, as the route table describes it, or null when
// the route is unknown or the race is on its final stage.
function getNextRouteStage(race) {
  const stages = (race?.stageRace?.stages || []).filter((stage) => (stage?.standings?.length || 0) > 0);
  if (stages.length === 0) {
    return null;
  }
  const nextNumber = stages[stages.length - 1].number + 1;
  return (race.stageRace?.route || []).find((entry) => Number(entry?.number) === nextNumber) || null;
}

// Profiles already fetched for this race are re-attached from the cache. Used when a
// race's stage history is rebuilt from Wikipedia (`/api/race-stages`), which would
// otherwise drop them until the next full build.
function attachCachedStageProfiles(race) {
  (race?.stageRace?.stages || []).forEach((stage) => {
    const cached = stageProfileCache.get(getStageProfileCacheKey(race, stage));
    if (!stage.profile && cached?.profile) {
      stage.profile = cached.profile;
    }
  });
  return race;
}

// Bounded like the official-provider lookups: whatever lands inside the budget renders
// on first paint, and whatever lands later is written onto the cached race and the
// profile cache, so the next render has it without another fetch. Profiles never
// change once published, so hits live for a week; a miss is retried after an hour.
async function enrichStageProfiles(races, now = new Date(), options = {}) {
  const budgetMs = options.budgetMs ?? STAGE_PROFILE_BLOCKING_BUDGET_MS;
  const loadProfile = options.loadProfile || fetchStageProfile;
  const pending = [];

  for (const race of races || []) {
    const source = getStageProfileSource(race, now);
    if (!source || !isMultiDayRace(race) || !Array.isArray(race.stageRace?.stages)) {
      continue;
    }

    for (const stage of [...race.stageRace.stages].reverse()) {
      if (stage.profile || (stage.standings?.length || 0) === 0 || !(Number(stage.number) > 0)) {
        continue;
      }

      const cacheKey = getStageProfileCacheKey(race, stage);
      const cached = stageProfileCache.get(cacheKey);
      const ttl = cached?.profile ? STAGE_PROFILE_CACHE_TTL_MS : STAGE_PROFILE_MISS_TTL_MS;
      if (cached && (cached.persistent || now.getTime() - cached.fetchedAt < ttl)) {
        if (cached.profile) {
          stage.profile = cached.profile;
        }
        continue;
      }
      if (pending.length >= STAGE_PROFILE_LOOKUP_LIMIT) {
        continue;
      }

      pending.push(
        loadProfile(source.stageUrl(stage.number))
          .catch(() => null)
          .then((profile) => {
            stageProfileCache.set(cacheKey, { fetchedAt: Date.now(), profile: profile || null });
            if (profile) {
              stage.profile = profile;
            }
          }),
      );
    }

    // Tomorrow's stage is worth one lookup too: the card previews it under the results,
    // and organisers publish the whole route before the race starts. Cache only — it
    // has no history entry to attach to yet.
    const next = getNextRouteStage(race);
    if (next && pending.length < STAGE_PROFILE_LOOKUP_LIMIT) {
      const nextKey = getStageProfileCacheKey(race, next);
      const cachedNext = stageProfileCache.get(nextKey);
      const nextTtl = cachedNext?.profile ? STAGE_PROFILE_CACHE_TTL_MS : STAGE_PROFILE_MISS_TTL_MS;
      if (!cachedNext || (!cachedNext.persistent && now.getTime() - cachedNext.fetchedAt >= nextTtl)) {
        pending.push(
          loadProfile(source.stageUrl(next.number))
            .catch(() => null)
            .then((profile) => {
              stageProfileCache.set(nextKey, { fetchedAt: Date.now(), profile: profile || null });
            }),
        );
      }
    }
  }

  if (pending.length > 0) {
    await Promise.race([Promise.all(pending), sleep(budgetMs)]);
  }
  return races;
}

async function enrichStageFinishVideos(races, now = new Date()) {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const pending = [];

  for (const race of races || []) {
    if (!isMultiDayRace(race) || isFinalizedStageRace(race) || !Array.isArray(race.stageRace?.stages)) {
      continue;
    }

    for (const stage of [...race.stageRace.stages].reverse()) {
      if (pending.length >= STAGE_FINISH_VIDEO_LOOKUP_LIMIT) {
        break;
      }
      if (stage.finishVideoUrl || (stage.standings?.length || 0) === 0) {
        continue;
      }

      const subject = buildStageFinishVideoSubject(race, stage);
      // A curated entry for this stage settles it without a search.
      if (hasCuratedFinishVideo(subject)) {
        stage.finishVideoUrl = getRaceFinishVideoUrl(subject);
        continue;
      }
      if (shouldSearchFinishVideo(subject, todayUtc)) {
        pending.push({ stage, subject });
      }
    }
  }

  await Promise.all(
    pending.map(async ({ stage, subject }) => {
      const url = await resolveRaceFinishVideoUrl(subject);
      if (url) {
        stage.finishVideoUrl = url;
      }
    }),
  );

  return races;
}

function getStageFinishVideoUrl(race, stage) {
  const mapped = RACE_FINISH_VIDEO_URLS[getRaceId(race)];
  if (mapped && typeof mapped === "object" && mapped[stage?.number]) {
    return mapped[stage.number];
  }

  return cleanFeedText(stage?.finishVideoUrl || "");
}

function getRaceFinishVideoUrl(race) {
  const mapped = RACE_FINISH_VIDEO_URLS[getRaceId(race)];
  const stageNumber = Number(race?.stageRace?.completedStages || race?.stageRace?.latestStage?.number || 0);
  if (mapped) {
    if (typeof mapped === "string") {
      return mapped;
    }

    if (mapped[stageNumber]) {
      return mapped[stageNumber];
    }
  }

  return cleanFeedText(race?.stageRace?.latestStage?.finishVideoUrl || race?.finishVideoUrl || "");
}

function buildStageFinishLink(race, stage, isCurrentStage) {
  // The current stage can also answer to the race-level video, which covers curated
  // whole-race entries and provider-supplied URLs that never carried a stage number.
  const url = isCurrentStage
    ? getRaceFinishVideoUrl(race) || getStageFinishVideoUrl(race, stage)
    : getStageFinishVideoUrl(race, stage);
  if (!url) {
    return "";
  }

  return `
    <a class="race-finish-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
      Watch the stage finish
    </a>`;
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

function selectRichestStandings(...candidateLists) {
  return candidateLists
    .filter((candidate) => Array.isArray(candidate) && candidate.some((entry) => entry?.rider))
    .map((candidate) => candidate.filter((entry) => entry?.rider))
    .sort((left, right) => right.length - left.length)[0] || [];
}

function buildStageSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Schematic pictograms, one per stage type, drawn the same way for every stage of that
// type. A stage without a measured trace must look generic rather than plausible, so
// these are deliberately icons — a line, some hills, some peaks — not profiles.
const STAGE_TYPE_GLYPHS = {
  flat: '<path class="stage-profile-glyph-line" d="M4 24 H60"></path>',
  hilly:
    '<path class="stage-profile-glyph-fill" d="M4 28 Q14 12 24 24 T44 20 T60 28 Z"></path><path class="stage-profile-glyph-line" d="M4 28 Q14 12 24 24 T44 20 T60 28"></path>',
  "medium-mountain":
    '<path class="stage-profile-glyph-fill" d="M4 28 L18 14 L28 22 L42 8 L52 18 L60 28 Z"></path><path class="stage-profile-glyph-line" d="M4 28 L18 14 L28 22 L42 8 L52 18 L60 28"></path>',
  mountain:
    '<path class="stage-profile-glyph-fill" d="M4 28 L16 8 L26 18 L38 3 L50 16 L60 28 Z"></path><path class="stage-profile-glyph-line" d="M4 28 L16 8 L26 18 L38 3 L50 16 L60 28"></path>',
  "individual-time-trial": '<path class="stage-profile-glyph-line is-dashed" d="M4 24 H60"></path>',
  "team-time-trial": '<path class="stage-profile-glyph-line is-dashed" d="M4 24 H60"></path>',
};
const STAGE_PROFILE_WIDTH = 600;
const STAGE_PROFILE_HEIGHT = 80;
const STAGE_PROFILE_BADGES = { "individual-time-trial": "ITT", "team-time-trial": "TTT" };

function formatStageNumberValue(value, decimals) {
  const fixed = Number(value).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction && Number(fraction) > 0 ? `${grouped}.${fraction}` : grouped;
}

function formatStageDistance(distanceKm, units) {
  const value = units === "imperial" ? distanceKm * 0.621371 : distanceKm;
  return `${formatStageNumberValue(value, 1)} ${units === "imperial" ? "mi" : "km"}`;
}

function formatStageAltitude(altitudeM, units) {
  const value = units === "imperial" ? altitudeM * 3.28084 : altitudeM;
  return `${formatStageNumberValue(value, 0)} ${units === "imperial" ? "ft" : "m"}`;
}

function formatStageElevation(elevationGainM, units) {
  const value = units === "imperial" ? elevationGainM * 3.28084 : elevationGainM;
  return `${formatStageNumberValue(value, 0)} ${units === "imperial" ? "ft" : "m"} climbing`;
}

// The real trace is scaled to its own altitude range, but never to less than a
// kilometre of it, so a coastal flat stage sits low and a summit finish fills the
// height rather than every stage being stretched to look alpine.
const STAGE_PROFILE_MIN_ALTITUDE_SPAN_M = 1000;

// Start and finish towns come from the route table's course cell ("Vera to Calar
// Alto"); anything that does not split cleanly into two places is left unlabelled.
function parseStageCourseEnds(course) {
  const parts = cleanFeedText(course || "")
    .split(/\s+(?:to|–|—|→|>)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length === 2 ? { start: parts[0], finish: parts[1] } : null;
}

function buildMeasuredStageProfilePaths(profile) {
  const points = (Array.isArray(profile?.points) ? profile.points : []).filter(
    (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  const distanceKm = Number(profile?.distanceKm) || points[points.length - 1]?.[0] || 0;
  if (points.length < 2 || !(distanceKm > 0)) {
    return null;
  }

  const top = 6;
  const bottom = STAGE_PROFILE_HEIGHT;
  const minAlt = Math.min(...points.map((point) => point[1]));
  const maxAlt = Math.max(...points.map((point) => point[1]));
  const span = Math.max(maxAlt - minAlt, STAGE_PROFILE_MIN_ALTITUDE_SPAN_M);
  const toY = (altitude) => bottom - 4 - ((altitude - minAlt) / span) * (bottom - 4 - top);
  const toBottomPercent = (altitude) => ((bottom - toY(altitude)) / bottom) * 100;
  const coordinates = points.map(([km, altitude]) => `${((km / distanceKm) * STAGE_PROFILE_WIDTH).toFixed(1)},${toY(altitude).toFixed(1)}`);
  const peak = points.reduce((best, point) => (point[1] > best[1] ? point : best), points[0]);

  // Altitude gridlines at a round step chosen for the range, drawn as stretched SVG
  // lines with HTML labels; distance ticks along the base at a step chosen for the
  // length. Each axis is built twice — round metres and round feet, round kilometres
  // and round miles — because a converted round number is not a round number, and
  // the client shows whichever set matches the unit preference.
  const buildGridlines = (units) => {
    const toMetres = units === "imperial" ? (feet) => feet / 3.28084 : (metres) => metres;
    const fromMetres = units === "imperial" ? (metres) => metres * 3.28084 : (metres) => metres;
    const unitSpan = fromMetres(span);
    const step =
      units === "imperial"
        ? unitSpan >= 6000 ? 2000 : unitSpan >= 2500 ? 1000 : 500
        : unitSpan >= 2000 ? 500 : unitSpan >= 800 ? 250 : 100;
    const lines = [];
    for (let value = Math.ceil(fromMetres(minAlt) / step) * step; toMetres(value) <= minAlt + span; value += step) {
      const altitudeM = toMetres(value);
      const bottomPercent = toBottomPercent(altitudeM);
      if (bottomPercent > 8 && bottomPercent < 96) {
        lines.push({ units, label: `${formatStageNumberValue(value, 0)} ${units === "imperial" ? "ft" : "m"}`, y: toY(altitudeM), bottomPercent });
      }
    }
    return lines;
  };
  const buildTicks = (units) => {
    const unitDistance = units === "imperial" ? distanceKm * 0.621371 : distanceKm;
    const step =
      units === "imperial"
        ? unitDistance > 75 ? 25 : unitDistance > 25 ? 10 : unitDistance > 8 ? 5 : 2
        : unitDistance > 120 ? 50 : unitDistance > 40 ? 25 : unitDistance > 12 ? 10 : 5;
    const marks = [];
    for (let value = step; value < unitDistance - step * 0.35; value += step) {
      marks.push({ units, label: `${formatStageNumberValue(value, 0)} ${units === "imperial" ? "mi" : "km"}`, leftPercent: (value / unitDistance) * 100 });
    }
    return marks;
  };
  const gridlines = [...buildGridlines("metric"), ...buildGridlines("imperial")];
  const ticks = [...buildTicks("metric"), ...buildTicks("imperial")];

  return {
    line: `M${coordinates.join(" L")}`,
    area: `M0,${bottom} L${coordinates.join(" L")} L${STAGE_PROFILE_WIDTH},${bottom} Z`,
    peak: {
      altitudeM: peak[1],
      leftPercent: Math.min(94, Math.max(6, (peak[0] / distanceKm) * 100)),
      bottomPercent: toBottomPercent(peak[1]),
    },
    startAltitudeM: points[0][1],
    finishAltitudeM: points[points.length - 1][1],
    distanceKm,
    gridlines,
    ticks,
  };
}

function buildStageProfilePaths(stage) {
  return buildMeasuredStageProfilePaths(stage?.profile);
}

// The block under the stage strip. A stage with a measured trace draws it, labelled
// with where the data came from; any other stage shows a schematic pictogram for its
// type plus a note that no profile is available, so a reader is never left guessing
// which of the two they are looking at. Both figures render in metric and carry their
// imperial text in data attributes so the client's km/mi toggle swaps them without a
// round trip.
function buildStageProfileMarkup(stage) {
  const stageType = String(stage?.stageType || "");
  const typeLabel = STAGE_TYPE_LABELS[stageType] || "";
  // The route table's distance is the official one; the trace's is a fallback for a
  // stage whose table row never carried a figure. Climbing comes from the trace unless
  // a source has set it directly.
  const distanceKm =
    Number(stage?.distanceKm) > 0
      ? Number(stage.distanceKm)
      : Number(stage?.profile?.distanceKm) > 0
        ? Number(stage.profile.distanceKm)
        : null;
  const elevationGainM =
    Number(stage?.elevationGainM) > 0
      ? Number(stage.elevationGainM)
      : Number(stage?.profile?.elevationGainM) > 0
        ? Number(stage.profile.elevationGainM)
        : null;
  if (!typeLabel && !distanceKm) {
    return "";
  }

  const paths = buildStageProfilePaths(stage);
  const badge = STAGE_PROFILE_BADGES[stageType];
  const glyph = STAGE_TYPE_GLYPHS[stageType] || "";
  const peakLabel = paths?.peak
    ? `<span class="stage-profile-peak" style="left: ${paths.peak.leftPercent.toFixed(1)}%; bottom: ${paths.peak.bottomPercent.toFixed(
        1,
      )}%;" data-unit-metric="${escapeHtml(formatStageAltitude(paths.peak.altitudeM, "metric"))}" data-unit-imperial="${escapeHtml(
        formatStageAltitude(paths.peak.altitudeM, "imperial"),
      )}">${escapeHtml(formatStageAltitude(paths.peak.altitudeM, "metric"))}</span>`
    : "";
  const ends = parseStageCourseEnds(stage?.course);
  const altitudeLabel = (altitudeM, className, style) =>
    `<span class="${className}" style="${style}" data-unit-metric="${escapeHtml(formatStageAltitude(altitudeM, "metric"))}" data-unit-imperial="${escapeHtml(
      formatStageAltitude(altitudeM, "imperial"),
    )}">${escapeHtml(formatStageAltitude(altitudeM, "metric"))}</span>`;
  const gradientId = `stage-profile-gradient-${Math.round(Number(stage?.number) || 0)}-${Math.round((distanceKm || 0) * 10)}`;
  const canvas = paths
    ? `
        <div class="stage-profile-canvas is-measured">
          <div class="stage-profile-plot">
            <svg viewBox="0 0 ${STAGE_PROFILE_WIDTH} ${STAGE_PROFILE_HEIGHT}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <!-- The site's rainbow strip by height: green valley floor, blue lower slopes, yellow high ground, red summit. -->
                <linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${STAGE_PROFILE_HEIGHT}">
                  <stop offset="0" stop-color="#ef3340"></stop>
                  <stop offset="0.08" stop-color="#ef3340"></stop>
                  <stop offset="0.3" stop-color="#ffcc00"></stop>
                  <stop offset="0.62" stop-color="#005bbb"></stop>
                  <stop offset="1" stop-color="#00a651"></stop>
                </linearGradient>
              </defs>
              ${paths.gridlines
                .map(
                  (line) =>
                    `<line class="stage-profile-gridline" data-unit-system="${line.units}" x1="0" x2="${STAGE_PROFILE_WIDTH}" y1="${line.y.toFixed(
                      1,
                    )}" y2="${line.y.toFixed(1)}"></line>`,
                )
                .join("")}
              <path class="stage-profile-area" style="fill: url(#${gradientId});" d="${paths.area}"></path>
              <path class="stage-profile-line" d="${paths.line}"></path>
            </svg>${peakLabel}${paths.gridlines
              .map(
                (line) =>
                  `<span class="stage-profile-gridlabel" data-unit-system="${line.units}" style="bottom: ${line.bottomPercent.toFixed(1)}%;">${escapeHtml(
                    line.label,
                  )}</span>`,
              )
              .join("")}${paths.ticks
              .map(
                (tick) =>
                  `<span class="stage-profile-tick" data-unit-system="${tick.units}" style="left: ${tick.leftPercent.toFixed(1)}%;">${escapeHtml(
                    tick.label,
                  )}</span>`,
              )
              .join("")}
            <span class="stage-profile-end is-start">${ends ? `<strong>${escapeHtml(ends.start)}</strong>` : "Start"} ${altitudeLabel(
              paths.startAltitudeM,
              "stage-profile-end-altitude",
              "",
            )}</span>
            <span class="stage-profile-end is-finish">${ends ? `<strong>${escapeHtml(ends.finish)}</strong>` : "Finish"} ${altitudeLabel(
              paths.finishAltitudeM,
              "stage-profile-end-altitude",
              "",
            )}</span>
          </div>${badge ? `<span class="stage-profile-badge">${escapeHtml(badge)}</span>` : ""}
        </div>`
    : glyph
      ? `
        <div class="stage-profile-glyph" aria-hidden="true">
          <svg viewBox="0 0 64 32" focusable="false">${glyph}</svg>
        </div>`
      : "";
  const sourceLabel = paths
    ? `<span class="stage-profile-source">Elevation data: ${escapeHtml(stage.profile?.source || "official route")}</span>`
    : "";
  // Compact by default; the expanded chart is the same SVG given room to breathe. The
  // client remembers the choice alongside the unit preference.
  const expandControl = paths
    ? `<button type="button" class="stage-profile-expand" data-profile-toggle aria-expanded="false">Expand profile</button>`
    : "";
  const genericNote = paths
    ? ""
    : `<span class="stage-profile-note">Stage-type icon only — no elevation profile is available for this stage.</span>`;
  const stats = [
    distanceKm
      ? `<span class="stage-profile-stat" data-unit-metric="${escapeHtml(
          formatStageDistance(distanceKm, "metric"),
        )}" data-unit-imperial="${escapeHtml(formatStageDistance(distanceKm, "imperial"))}">${escapeHtml(
          formatStageDistance(distanceKm, "metric"),
        )}</span>`
      : "",
    elevationGainM
      ? `<span class="stage-profile-stat" data-unit-metric="${escapeHtml(
          formatStageElevation(elevationGainM, "metric"),
        )}" data-unit-imperial="${escapeHtml(formatStageElevation(elevationGainM, "imperial"))}">${escapeHtml(
          formatStageElevation(elevationGainM, "metric"),
        )}</span>`
      : "",
  ].join("");
  const toggle = distanceKm || elevationGainM
    ? `
          <span class="unit-toggle" role="group" aria-label="Distance and elevation units">
            <button type="button" class="unit-option is-active" data-unit-option="metric" aria-pressed="true">km</button>
            <button type="button" class="unit-option" data-unit-option="imperial" aria-pressed="false">mi</button>
          </span>`
    : "";
  const ariaLabel = [
    typeLabel,
    distanceKm ? formatStageDistance(distanceKm, "metric") : "",
    elevationGainM ? formatStageElevation(elevationGainM, "metric") : "",
  ]
    .filter(Boolean)
    .join(", ");

  return `
        <figure class="stage-profile${paths ? " is-measured" : " is-generic"}" data-stage-type="${escapeHtml(
          stageType,
        )}" aria-label="${escapeHtml(ariaLabel)}">${canvas}
          <figcaption class="stage-profile-caption">
            ${!paths && badge ? `<span class="stage-profile-badge is-inline">${escapeHtml(badge)}</span>` : ""}${
              typeLabel ? `<span class="stage-profile-type">${escapeHtml(typeLabel)}</span>` : ""
            }${stats}${sourceLabel}${toggle}${expandControl}${genericNote}
          </figcaption>
        </figure>`;
}

function buildStagePanelMarkup(race, stage, stageId, isCurrentStage) {
  const standings = selectStandings(stage.standings);
  const courseMeta = [stage.date, stage.course].filter(Boolean).join(" • ");

  return `
      <div class="stage-panel" id="${escapeHtml(stageId)}" data-stage-panel role="tabpanel" aria-label="${escapeHtml(
        stage.label,
      )} result"${isCurrentStage ? "" : " hidden"}>${buildStageProfileMarkup(stage)}
        <div class="detail-label">${escapeHtml(stage.label)} winner</div>
        ${courseMeta ? `<p class="stage-panel-meta">${escapeHtml(courseMeta)}</p>` : ""}
        <div class="stage-winner">${buildRiderMarkup(
          { rider: stage.winner, countryCode: stage.winnerCountryCode, time: standings[0]?.time || "" },
          "stage-winner-rider",
          { metricContext: "stage" },
        )}</div>
        ${buildPodiumMarkup(standings, { metricContext: "stage" })}
        ${buildStageFinishLink(race, stage, isCurrentStage)}
      </div>`;
}

// A three-week race would push its GC far below the fold if every stage rendered at
// once, so the stages share one panel and a numbered strip swaps between them. The
// strip lists the full route, with stages that have not been raced yet disabled, so a
// 21-stage card stays exactly as tall as a 5-stage one.
//
// A finished race is built from the route table alone, so its panels start winner-only
// and carry a control to pull the real podiums from the companion stage articles.
// `options.stageResultsRequested` marks the re-render after that request, so the button
// is not offered a second time when the source had nothing deeper to give.
function buildStageSwitcherMarkup(race, options = {}) {
  const stages = (race.stageRace?.stages || []).filter((stage) => (stage?.standings?.length || 0) > 0);
  if (stages.length < 2) {
    return "";
  }

  const racedNumbers = new Set(stages.map((stage) => stage.number));
  const currentNumber = stages[stages.length - 1].number;
  // On a live race the following stage gets a chip of its own: it previews the course
  // rather than a result, and a one-line row above the strip points readers at it.
  const nextStage = options.live ? getNextRouteStage(race) : null;
  const totalStages = Math.max(race.stageRace?.totalStages || 0, ...stages.map((stage) => stage.number));
  const raceSlug = buildStageSlug(race.id || race.pageTitle || race.title);
  const stageId = (stageNumber) => `${raceSlug}-stage-${stageNumber}`;
  // parseTotalStages counts a prologue as a stage, so a race with a prologue has one
  // fewer numbered stage than its total; without this the strip grows a phantom chip.
  const hasPrologue = racedNumbers.has(0);
  const numberedStageCount = Math.max(0, totalStages - (hasPrologue ? 1 : 0));

  const chips = [...(hasPrologue ? [0] : []), ...Array.from({ length: numberedStageCount }, (unused, index) => index + 1)]
    .map((stageNumber) => {
      const chipLabel = stageNumber === 0 ? "P" : String(stageNumber);
      if (nextStage && stageNumber === nextStage.number) {
        return `<button type="button" class="stage-chip is-next" role="tab" aria-selected="false" aria-controls="${escapeHtml(
          stageId(stageNumber),
        )}" data-stage-target="${escapeHtml(stageId(stageNumber))}" title="${escapeHtml(
          `Up next: ${nextStage.label || `Stage ${nextStage.number}`}${nextStage.course ? ` — ${nextStage.course}` : ""}`,
        )}">${escapeHtml(chipLabel)}<span class="stage-chip-next-tag">next</span></button>`;
      }

      if (!racedNumbers.has(stageNumber)) {
        // A gap below the current stage is a stage we have no rider result for — a
        // team time trial, say — not a stage that has yet to happen. Both are
        // unselectable, but they should not claim to mean the same thing.
        const chipTitle = stageNumber < currentNumber ? "No published result" : "Not raced yet";
        return `<span class="stage-chip is-upcoming" title="${escapeHtml(chipTitle)}">${escapeHtml(chipLabel)}</span>`;
      }

      const isCurrentStage = stageNumber === currentNumber;
      return `<button type="button" class="stage-chip${isCurrentStage ? " is-active" : ""}" role="tab" aria-selected="${
        isCurrentStage ? "true" : "false"
      }" aria-controls="${escapeHtml(stageId(stageNumber))}" data-stage-target="${escapeHtml(
        stageId(stageNumber),
      )}">${escapeHtml(chipLabel)}</button>`;
    })
    .join("");

  const panels = stages
    .map((stage) => buildStagePanelMarkup(race, stage, stageId(stage.number), stage.number === currentNumber))
    .join("");
  // Live races read their companion articles at build time, so their panels are already
  // as deep as the source allows and there is nothing to offer.
  const isShallowHistory = stages.some((stage) => stage.standings.length < 2);
  const stageResultsControl =
    !isShallowHistory || options.live
      ? ""
      : options.stageResultsRequested
        ? `<p class="stage-panel-meta">No fuller stage results are published for this race.</p>`
        : `
        <button type="button" class="load-coverage-button stage-results-button" data-load-stage-results="${escapeHtml(
          getRaceId(race),
        )}">
          Load full stage results
        </button>`;

  const nextRow = nextStage ? buildNextStageRowMarkup(nextStage, stageId(nextStage.number)) : "";
  const nextPanel = nextStage ? buildNextStagePanelMarkup(race, nextStage, stageId(nextStage.number)) : "";

  return `
      <div class="card-subsection stage-switcher" data-stage-switcher>
        <div class="detail-label">Stage results</div>${nextRow}
        <div class="stage-strip" role="tablist" aria-label="${escapeHtml(race.title)} stages">${chips}</div>
        ${panels}${nextPanel}
        ${stageResultsControl}
      </div>`;
}

// What a fan checks the night before. The row above the strip names tomorrow's stage
// in one line and, like the chip, selects its panel; the panel shows the date, course,
// type, distance and — when the organiser has published the trace — the profile, plus
// a note that results land after the finish. Live races only: "next" has no meaning
// once a race is over.
function describeNextStage(nextStage) {
  return [
    nextStage.course,
    STAGE_TYPE_LABELS[nextStage.stageType] ? STAGE_TYPE_LABELS[nextStage.stageType].replace(/ stage$/, "") : "",
  ].filter(Boolean);
}

function buildNextStageRowMarkup(nextStage, panelId) {
  const label = nextStage.label || `Stage ${nextStage.number}`;
  const parts = describeNextStage(nextStage).map((part) => escapeHtml(part));
  const distance =
    Number(nextStage.distanceKm) > 0
      ? `<span data-unit-metric="${escapeHtml(formatStageDistance(nextStage.distanceKm, "metric"))}" data-unit-imperial="${escapeHtml(
          formatStageDistance(nextStage.distanceKm, "imperial"),
        )}">${escapeHtml(formatStageDistance(nextStage.distanceKm, "metric"))}</span>`
      : "";

  return `
        <button type="button" class="stage-next-row" data-stage-target="${escapeHtml(panelId)}" aria-controls="${escapeHtml(panelId)}">
          <span class="stage-next-row-label">Up next</span>
          <span class="stage-next-row-text">${[escapeHtml(label), ...parts, distance].filter(Boolean).join(" · ")}</span>
          <span class="stage-next-row-arrow" aria-hidden="true">▸</span>
        </button>`;
}

function buildNextStagePanelMarkup(race, nextStage, panelId) {
  const label = nextStage.label || `Stage ${nextStage.number}`;
  const meta = [nextStage.date, nextStage.course].filter(Boolean).join(" • ");
  const profileMarkup = buildStageProfileMarkup({
    number: nextStage.number,
    stageType: nextStage.stageType,
    distanceKm: nextStage.distanceKm,
    course: nextStage.course,
    profile: getCachedStageProfile(race, nextStage.number),
  });
  const finish = nextStage.date ? ` on ${nextStage.date}` : "";

  return `
      <div class="stage-panel stage-panel-next" id="${escapeHtml(panelId)}" data-stage-panel role="tabpanel" aria-label="${escapeHtml(
        label,
      )} preview" hidden>
        <div class="detail-label">Up next · ${escapeHtml(label)}</div>
        ${meta ? `<p class="stage-panel-meta">${escapeHtml(meta)}</p>` : ""}${profileMarkup}
        <p class="stage-panel-meta stage-panel-next-note">Results will appear here once the stage finishes${escapeHtml(finish)}.</p>
      </div>`;
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
  const gcStandings = isFinalized
    ? selectRichestStandings(
        race.resultStandings,
        race.stageRace?.overallResult,
        classification?.standings,
        fallbackPodium,
      )
    : selectStandings(
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
  const stageSwitcher = buildStageSwitcherMarkup(race, { live: Boolean(options.live) });
  const stageContent = stageSwitcher
    ? stageSwitcher
    : latestStage?.winner
    ? `
      <div class="card-subsection">${buildStageProfileMarkup(latestStage)}
        <div class="detail-label">${escapeHtml(stageLabel)} winner</div>
        <div class="stage-winner">${buildRiderMarkup(
          {
            rider: latestStage.winner,
            countryCode: latestStage.winnerCountryCode,
            time: latestStage.standings?.[0]?.time || "",
          },
          "stage-winner-rider",
          { metricContext: "stage" },
        )}</div>
        ${buildPodiumMarkup(stageStandings, { metricContext: "stage" })}
        ${buildRaceFinishLink(race)}
      </div>`
    : isFinalized
      ? ""
    : `
      <div class="card-subsection">
        <div class="detail-label">Stage results</div>
        <p class="meta">No completed stage result is available yet.</p>
      </div>`;
  // With jersey holders, the podium and the jersey list share a two-column row on a
  // card wide enough for both (a container query in .gc-columns), so the list adds no
  // height; on a narrow card it stacks beneath the podium as a second block.
  const jerseyHolders = buildJerseyHoldersMarkup(race, { finalized: isFinalized });
  const withJerseys = (mainMarkup) =>
    jerseyHolders
      ? `
        <div class="gc-columns">
          <div class="gc-podium">${mainMarkup}</div>${jerseyHolders}
        </div>`
      : mainMarkup;
  const gcContent = gcStandings.length > 0
    ? `
      <div class="card-subsection">
        <div class="detail-label">${escapeHtml(classificationLabel)}</div>
        ${withJerseys(buildPodiumMarkup(gcStandings, { metricContext: "gc" }))}
      </div>`
    : `
      <div class="card-subsection">
        <div class="detail-label">Overall classification</div>
        ${withJerseys(`<p class="meta">The general classification is not available yet.</p>`)}
      </div>`;
  const orderedContent = isFinalized
    ? `${gcContent}${stageContent}`
    : `${stageContent}${gcContent}`;
  // The news line is the last thing on the card, under the GC on a live race. A live
  // race warms its article pool so the next render carries the headline.
  if (options.live) {
    warmRaceArticlePool(race);
  }

  return `
    <article class="card result-card stage-race-card" id="${escapeHtml(createRaceAnchorId(race))}">
      <div class="card-kicker">${escapeHtml(race.series)} ${statusBadge}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${statusNote}
      ${orderedContent}
      ${buildRaceNewsMarkup(race)}
    </article>`;
}

function buildRaceCard(race) {
  if (isMultiDayRace(race) && race.stageRace) {
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
    <article class="card result-card" id="${escapeHtml(createRaceAnchorId(race))}">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
      ${buildPodiumMarkup(standings)}
      ${buildRaceFinishLink(race)}
      ${buildRaceNewsMarkup(race)}
    </article>`;
}

function buildLiveStageRaceCard(race) {
  return buildStageRaceCard(race, { live: true });
}

function buildUpcomingCard(race) {
  return `
    <article class="card upcoming-card" id="${escapeHtml(createRaceAnchorId(race))}">
      <div class="card-kicker">${escapeHtml(race.series)}</div>
      <h3>${escapeHtml(race.title)}</h3>
      <p class="meta">${escapeHtml(race.date)} • ${escapeHtml(race.location)}</p>
    </article>`;
}

function alpha2ToFlagEmoji(alpha2Code) {
  if (!/^[A-Z]{2}$/.test(alpha2Code || "")) {
    return "";
  }

  return [...alpha2Code]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function getCountryFlagEmoji(countryCode) {
  return alpha2ToFlagEmoji(COUNTRY_FLAG_CODES[normalizeCountryCode(countryCode)]);
}

function getCountryFlagEmojiByName(countryName) {
  return alpha2ToFlagEmoji(COUNTRY_NAME_ALPHA2[String(countryName || "").trim().toLowerCase()]);
}

// Jersey colours as Wikipedia's {{cjersey}} template names them in the leadership
// table header. A name outside this map draws an outlined, unfilled jersey, which is
// meant to look generic rather than to guess.
const JERSEY_FILL_COLOURS = new Map([
  ["yellow", "#ffcc00"],
  ["yellow number", "#ffcc00"],
  ["paris–nice", "#ffcc00"],
  ["paris-nice", "#ffcc00"],
  ["gold", "#d4af37"],
  ["white", "#ffffff"],
  ["silver", "#c9ced6"],
  ["grey", "#8a8f98"],
  ["gray", "#8a8f98"],
  ["black", "#232323"],
  ["green", "#2f9e44"],
  ["green number", "#2f9e44"],
  ["dark green", "#0f7a3a"],
  ["teal", "#1aa39a"],
  ["red", "#e42a19"],
  ["red number", "#e42a19"],
  ["pink", "#f06aa9"],
  ["cyclamen", "#c8408f"],
  ["ciclamino", "#c8408f"],
  ["magenta", "#c8408f"],
  ["purple", "#7a3fb0"],
  ["violet", "#7a3fb0"],
  ["blue", "#0a63c9"],
  ["azul", "#0a63c9"],
  ["azure", "#3b8fe0"],
  ["light blue", "#7dc3f0"],
  ["lightblue", "#7dc3f0"],
  ["orange", "#f28c1e"],
]);

const JERSEY_POLKADOT_COLOURS = new Map([
  ["polkadot", "#e42a19"],
  ["polka dot", "#e42a19"],
  ["red polkadot", "#e42a19"],
  ["blue polkadot", "#0a63c9"],
  ["green polkadot", "#2f9e44"],
  ["orange polkadot", "#f28c1e"],
]);

function buildJerseySwatchMarkup(jersey) {
  const name = String(jersey || "").trim().toLowerCase();
  const dots = JERSEY_POLKADOT_COLOURS.get(name) || "";
  const fill = dots ? "#ffffff" : JERSEY_FILL_COLOURS.get(name) || "";
  const outline = 'd="M8 2.5 C8.6 4.6 15.4 4.6 16 2.5 L21.4 5 L23.4 10.6 L19 12.1 L19 22 L5 22 L5 12.1 L0.6 10.6 L2.6 5 Z" stroke-linejoin="round"';
  const body = fill
    ? `<path ${outline} fill="${fill}" stroke="rgba(9, 33, 76, 0.5)" stroke-width="1"/>`
    : `<path ${outline} fill="none" stroke="rgba(9, 33, 76, 0.45)" stroke-width="1" stroke-dasharray="2 1.5"/>`;
  const dotMarkup = dots
    ? [
        [9, 9],
        [15, 9],
        [12, 14],
        [8.5, 19],
        [15.5, 19],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${dots}"/>`)
        .join("")
    : "";
  const title = name ? `${name} jersey` : "jersey";

  return `<svg class="jersey-swatch" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(title)}"><title>${escapeHtml(
    title,
  )}</title>${body}${dotMarkup}</svg>`;
}

// The jersey holders listed beneath the GC podium: one row per classification the
// leadership table names, in the table's own column order. Labelled with its stage only
// when that differs from the GC's, so the common case reads simply "Jersey holders".
function buildJerseyHoldersMarkup(race, options = {}) {
  const leaders = race?.stageRace?.classificationLeaders || null;
  const entries = (Array.isArray(leaders?.entries) ? leaders.entries : []).filter((entry) => entry?.rider && entry?.label);
  if (entries.length === 0) {
    return "";
  }

  const gcStageNumber = Number(race?.stageRace?.generalClassification?.stageNumber);
  const stageLabel = leaders.stageLabel || (leaders.stageNumber === 0 ? "Prologue" : `Stage ${leaders.stageNumber}`);
  const label = options.finalized
    ? "Final jersey winners"
    : Number.isFinite(gcStageNumber) && Number(leaders.stageNumber) !== gcStageNumber
      ? `Jersey holders after ${stageLabel.toLowerCase()}`
      : "Jersey holders";
  const items = entries
    .map(
      (entry) => `
          <li class="jersey-item">
            ${buildJerseySwatchMarkup(entry.jersey)}
            <span class="jersey-classification">${escapeHtml(entry.label)}</span>
            ${buildRiderMarkup(entry, "jersey-holder")}
          </li>`,
    )
    .join("");

  return `
        <div class="jersey-holders">
          <div class="detail-label">${escapeHtml(label)}</div>
          <ul class="jersey-list">${items}
          </ul>
        </div>`;
}

function buildRiderMarkup(entry, className = "podium-rider", options = {}) {
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
  let gapMarkup = "";
  if (options.metricContext === "stage" && options.winnerSeconds !== undefined) {
    const metrics = getStageStandingMetrics(entry, options.winnerSeconds);
    gapMarkup =
      (metrics.time ? `<span class="standing-gap">${escapeHtml(metrics.time)}</span>` : "") +
      (metrics.gap ? `<span class="standing-delta">${escapeHtml(metrics.gap)}</span>` : "");
  } else {
    const metric = getStandingMetric(entry, options.metricContext || "default");
    gapMarkup = metric ? `<span class="standing-gap">${escapeHtml(metric)}</span>` : "";
  }

  return `<span class="${escapeHtml(className)} rider-name">${flagMarkup}<span class="rider-text">${escapeHtml(rider)}</span>${gapMarkup}</span>`;
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: EASTERN_TIMEZONE,
  }).format(new Date(timestamp));
}

// Reads the article cache without triggering a fetch: the pill renders from a warm
// pool and otherwise as a placeholder the client fills in.
function peekRaceArticlePool(race) {
  const cached = articleCache.get(getRaceId(race));
  return Array.isArray(cached?.data) ? cached.data : null;
}

// Start filling the cache in the background so the next render carries the
// headlines. Used only for live races: recent cards load when scrolled into view.
function warmRaceArticlePool(race) {
  if (!peekRaceArticlePool(race) && getRaceId(race)) {
    loadRaceArticlePool(race).catch(() => {});
  }
}

// "Sep 4, 4:38 AM" — the year is noise on a headline published this week.
function formatNewsTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EASTERN_TIMEZONE,
  }).format(date);
}

// One line at the foot of a race card: "Latest news" plus the newest headline, which
// opens the race's stories in place — the same eight the retired coverage block
// showed, in the same order. Rendered ready when the article pool is cached (or
// passed in by /api/race-news), otherwise as a pending placeholder the client
// fetches when the card scrolls into view or the line is tapped.
function buildRaceNewsMarkup(race, options = {}) {
  const raceId = String(race?.id || "");
  const drawerId = `${createRaceAnchorId(race)}-news`;
  const pool = Array.isArray(options.articles) ? options.articles : peekRaceArticlePool(race);
  const articles = pool ? selectRaceArticles(pool, 0, race) : null;
  const state = !articles ? "pending" : articles.length === 0 ? "empty" : "ready";
  const lead = articles?.[0] || null;
  const stamp = (article) => (article.publishedAt ? formatNewsTimestamp(article.publishedAt) : "");
  const tickerText = !articles
    ? "Loading the latest stories…"
    : !lead
      ? "No stories found yet."
      : `<strong>${escapeHtml(lead.title)}</strong> · ${escapeHtml(lead.publisher)}${
          stamp(lead) ? `, ${escapeHtml(stamp(lead))}` : ""
        }`;
  const items = (articles || [])
    .slice(0, MAX_RACE_ARTICLES)
    .map(
      (article) => `
            <li><a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer"><span class="race-news-source">${escapeHtml(
              article.publisher,
            )}${stamp(article) ? ` · ${escapeHtml(stamp(article))}` : ""}</span><span class="race-news-title">${escapeHtml(
              article.title,
            )}</span></a></li>`,
    )
    .join("");
  const drawer =
    state === "ready"
      ? `
          <ol class="race-news-list">${items}
          </ol>`
      : "";

  return `
      <div class="card-subsection race-news" data-race-news="${escapeHtml(raceId)}" data-race-news-state="${state}">
        <button type="button" class="race-news-ticker" data-race-news-toggle aria-expanded="false" aria-controls="${escapeHtml(
          drawerId,
        )}"${state === "empty" ? " disabled" : ""}>
          <span class="race-news-ticker-label">Latest news</span>
          <span class="race-news-ticker-text">${tickerText}</span>
          ${state === "empty" ? "" : `<span class="race-news-ticker-arrow" aria-hidden="true">▾</span>`}
        </button>
        <div class="race-news-drawer" id="${escapeHtml(drawerId)}" hidden>${drawer}
        </div>
      </div>`;
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

function buildRecentResultsBlock(group) {
  const races = group.recentResults || [];
  if (races.length === 0) {
    return "";
  }

  const step = WORLDTOUR_RECENT_RESULTS_STEP;
  const gridClass = group.recentGridClass ? `grid competition-grid ${group.recentGridClass}` : "grid competition-grid";
  const slots = races
    .map(
      (race, index) => `
        <div
          class="recent-race-slot"
          data-recent-slot
          data-recent-race-id="${escapeHtml(race.id)}"
          data-recent-race-title="${escapeHtml(race.title)}"
          data-recent-race-date="${escapeHtml(race.date)}"
          ${index >= step ? "hidden" : ""}
        >${buildRaceCard(race)}</div>`,
    )
    .join("");
  const loadMoreButton =
    races.length > step
      ? `<button type="button" class="load-more-races" data-load-more-races="${escapeHtml(group.id)}">Load more races</button>`
      : "";

  return `
    <div class="competition-block" data-recent-block="${escapeHtml(group.id)}" data-recent-step="${step}">
      <div class="competition-block-head">
        <h3>${escapeHtml(group.recentBlockTitle || "Recent Results")}</h3>
        <p>${escapeHtml(group.recentBlockDescription || "Most recent finalized races and classifications.")}</p>
      </div>
      <div class="${gridClass}">${slots}</div>
      ${loadMoreButton}
    </div>`;
}

function buildCompetitionSection(group) {
  const liveMarkup = group.liveStageRaces.map(buildLiveStageRaceCard).join("");
  const upcomingMarkup = group.upcomingRaces.map(buildUpcomingCard).join("");
  const blocks = [
    buildCompetitionBlock("Live Multi-Stage", "Current stage races and overall standings.", liveMarkup),
    buildRecentResultsBlock(group),
    buildCompetitionBlock("Upcoming", "Next races on the calendar.", upcomingMarkup),
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

function buildNationalChampionshipPodium(event) {
  if (!event.podium?.length) {
    return `
      <div class="national-event-empty">
        <span>${escapeHtml(event.dateLabel || "TBD")}</span>
        <strong>${event.status === "upcoming" ? "Upcoming" : "TBD"}</strong>
      </div>`;
  }

  const podiumMarkup = event.podium
    .map(
      (entry) => `
        <li class="national-podium-item">
          <span class="podium-place place-${escapeHtml(entry.place)}">${escapeHtml(entry.place)}</span>
          <span class="rider-text">${escapeHtml(entry.rider)}</span>
        </li>`,
    )
    .join("");

  return `<ol class="national-podium-list">${podiumMarkup}</ol>`;
}

function buildNationalChampionshipEventCard(event) {
  const statusLabel =
    event.status === "completed"
      ? "Completed"
      : event.status === "upcoming"
      ? "Upcoming"
      : "TBD";
  const dateLabel = event.dateLabel || "TBD";
  const locationLabel = event.location || "Location TBD";
  const sourceLink = event.sourceUrl
    ? `<a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">Report</a>`
    : "";
  const finishVideoLink = event.finishVideoUrl
    ? `<a href="${escapeHtml(event.finishVideoUrl)}" target="_blank" rel="noreferrer">Watch race finish</a>`
    : "";
  const linkMarkup = [finishVideoLink, sourceLink].filter(Boolean).join("");
  const flagEmoji = getCountryFlagEmojiByName(event.country);
  const flagMarkup = flagEmoji
    ? `<span class="national-flag" aria-hidden="true">${escapeHtml(flagEmoji)}</span>`
    : "";

  return `
    <article
      class="card national-event-card"
      data-national-event-card
      data-country="${escapeHtml(event.country)}"
      data-event-key="${escapeHtml(event.eventKey)}"
      data-status="${escapeHtml(event.status)}"
      ${event.status === "completed" ? "" : "hidden"}
    >
      <div class="card-kicker">${escapeHtml(statusLabel)} ${event.status === "completed" ? "National Title" : "National Title"}</div>
      <h3 class="national-title">${flagMarkup}<span>${escapeHtml(event.country)}</span></h3>
      <p class="meta">${escapeHtml(event.eventName)}</p>
      <div class="national-event-meta">
        <span>${escapeHtml(dateLabel)}</span>
        <span>${escapeHtml(locationLabel)}</span>
      </div>
      ${buildNationalChampionshipPodium(event)}
      ${linkMarkup ? `<div class="national-event-links">${linkMarkup}</div>` : ""}
    </article>`;
}

function svgText(x, y, text, attributes) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${attributes}>${escapeHtml(text)}</text>`;
}

const CALENDAR_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CALENDAR_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CALENDAR_LABEL_FONT = 'font-family="Barlow Semi Condensed, Arial Narrow, sans-serif"';
const CALENDAR_HATCH_DEFS = (id) =>
  `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(239, 51, 64, 0.05)"></rect><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(239, 51, 64, 0.35)" stroke-width="1.5"></line></pattern></defs>`;

// Month bands, labels and gridlines between two ISO days. Shared by both calendar strips.
function buildCalendarMonthMarkup(rangeStart, rangeEnd, X, top, bottom, compact) {
  const parts = [];
  const start = new Date(`${rangeStart}T00:00:00Z`);
  const end = new Date(`${rangeEnd}T00:00:00Z`);
  for (
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    cursor <= end;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const xa = X(toIsoDay(cursor));
    const xb = X(toIsoDay(next));
    if (cursor.getUTCMonth() % 2 === 1) {
      parts.push(`<rect x="${xa.toFixed(1)}" y="${top}" width="${(xb - xa).toFixed(1)}" height="${bottom - top}" fill="rgba(0, 51, 160, 0.035)"></rect>`);
    }
    parts.push(
      svgText(
        xa + 6,
        compact ? 14 : 18,
        CALENDAR_MONTH_LABELS[cursor.getUTCMonth()].toUpperCase(),
        `${CALENDAR_LABEL_FONT} font-size="${compact ? 11 : 13}" font-weight="700" letter-spacing="0.12em" fill="#4f6188"`,
      ),
    );
    parts.push(`<line x1="${xa.toFixed(1)}" x2="${xa.toFixed(1)}" y1="${top}" y2="${bottom}" stroke="rgba(0, 51, 160, 0.12)"></line>`);
  }
  return parts.join("");
}

function buildCalendarWindowMarkup(X, top, bottom, patternId, labelY) {
  return NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS.map((window) => {
    const xa = X(window.start);
    const xb = X(window.end);
    const label = labelY
      ? svgText(xa + 4, labelY, window.label, `font-family="Manrope, sans-serif" font-size="10.5" font-weight="700" fill="#c9252f"`)
      : "";
    return `<g><title>${escapeHtml(`${window.label} — typical window, not confirmed dates`)}</title><rect x="${xa.toFixed(1)}" y="${top}" width="${(xb - xa).toFixed(1)}" height="${bottom - top}" fill="url(#${patternId})" stroke="rgba(239, 51, 64, 0.35)" stroke-dasharray="4 3"></rect>${label}</g>`;
  }).join("");
}

function buildCalendarTodayMarkup(x, top, bottom, badgeY) {
  return `
    <line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${bottom}" stroke="#ffcc00" stroke-width="2.5"></line>
    <circle class="season-today-dot" cx="${x.toFixed(1)}" cy="${bottom - 4}" r="4" fill="#ffcc00"></circle>
    <rect x="${(x - 24).toFixed(1)}" y="${badgeY}" width="48" height="16" rx="8" fill="#ffcc00"></rect>
    ${svgText(x, badgeY + 12, "TODAY", `text-anchor="middle" ${CALENDAR_LABEL_FONT} font-size="10.5" font-weight="800" letter-spacing="0.08em" fill="#00184d"`)}`;
}

function buildNationalChampionshipScheduleMarkup(events, today = new Date()) {
  const width = 800;
  const height = 96;
  const x0 = 6;
  const x1 = width - 6;
  const rangeStart = `${SEASON_YEAR}-01-01`;
  const rangeEnd = `${SEASON_YEAR}-12-31`;
  const totalDays = seasonDayIndex(rangeEnd, rangeStart) + 1;
  const scale = (x1 - x0) / totalDays;
  const X = (isoDay) => x0 + seasonDayIndex(isoDay, rangeStart) * scale;
  const top = 26;
  const bottom = 90;
  const parts = [CALENDAR_HATCH_DEFS("national-hatch")];
  parts.push(buildCalendarMonthMarkup(rangeStart, rangeEnd, X, top, bottom, false));
  parts.push(buildCalendarWindowMarkup(X, top, bottom, "national-hatch", bottom - 6));

  const byDate = new Map();
  (events || [])
    .filter((event) => event.date)
    .forEach((event) => {
      if (!byDate.has(event.date)) {
        byDate.set(event.date, []);
      }
      byDate.get(event.date).push(event);
    });
  [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([date, dateEvents], index) => {
      const label = dateEvents.map((event) => `${event.country} ${event.eventLabel}`).join(", ");
      parts.push(
        `<g><title>${escapeHtml(`${formatNationalChampionshipDate(date)} · ${label}`)}</title><circle cx="${X(date).toFixed(1)}" cy="${44 + (index % 2) * 16}" r="6" fill="#0033a0" stroke="white" stroke-width="2"></circle></g>`,
      );
    });

  const todayIso = toIsoDay(today);
  if (todayIso >= rangeStart && todayIso <= rangeEnd) {
    parts.push(buildCalendarTodayMarkup(X(todayIso), top - 4, bottom, 10));
  }

  return `<svg class="national-schedule-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Championship dates across the ${SEASON_YEAR} calendar year">${parts.join("")}</svg>`;
}

function describeConfirmedNationalChampionshipDates(events) {
  const byCountry = new Map();
  (events || [])
    .filter((event) => event.date)
    .forEach((event) => {
      if (!byCountry.has(event.country)) {
        byCountry.set(event.country, new Set());
      }
      byCountry.get(event.country).add(event.date);
    });
  if (!byCountry.size) {
    return "No confirmed dates yet.";
  }
  const entries = [...byCountry.entries()].map(([country, dates]) => {
    const labels = [...dates].sort().map((date) => formatNationalChampionshipDate(date).replace(/, \d{4}$/, ""));
    return `${country} (${labels.join(", ")})`;
  });
  return `Confirmed ${SEASON_YEAR} dates: ${entries.join("; ")}.`;
}

function describeNextNationalChampionshipWindow(today = new Date()) {
  const todayIso = toIsoDay(today);
  const next = NATIONAL_CHAMPIONSHIP_TYPICAL_WINDOWS.find((window) => window.end >= todayIso);
  if (next) {
    const start = new Date(`${next.start}T00:00:00Z`);
    return `Next window: ${CALENDAR_MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  return `Next window: January ${SEASON_YEAR + 1}`;
}

function buildNationalChampionshipStatusMarkup(data, events, today = new Date()) {
  const total = data.totalCountryCount || 0;
  const reporting = data.reportingCountryCount || 0;
  const completed = data.completedEventCount || events.filter((event) => event.status === "completed").length;
  const upcoming = events.filter((event) => event.status === "upcoming").length;
  const headline =
    reporting === 0
      ? "Season not started"
      : upcoming > 0
      ? `${upcoming} title${upcoming === 1 ? "" : "s"} still to come`
      : total > 0 && reporting / total >= 0.75
      ? "Essentially complete"
      : "In progress";
  const sourceUpdatedLabel = data.sourceLastModified
    ? `Source updated ${formatTimestamp(data.sourceLastModified)} Eastern Time.`
    : `Source fetched ${formatTimestamp(data.fetchedAt)} Eastern Time.`;

  return `
    <div class="national-status">
      <div>
        <span class="national-status-label">${escapeHtml(String(SEASON_YEAR))} season status</span>
        <strong class="national-status-headline">${escapeHtml(headline)}</strong>
      </div>
      <div class="national-status-grid">
        <div>
          <span class="national-status-label">Federations with champions</span>
          <strong class="national-status-figure">${escapeHtml(String(reporting))} of ${escapeHtml(String(total))}</strong>
        </div>
        <div>
          <span class="national-status-label">Titles decided</span>
          <strong class="national-status-figure">${escapeHtml(String(completed))}</strong>
        </div>
      </div>
      <p class="meta national-status-note">${escapeHtml(describeNextNationalChampionshipWindow(today))}. ${escapeHtml(sourceUpdatedLabel)} <a href="${escapeHtml(data.sourceUrl || NATIONAL_CHAMPIONSHIPS_SOURCE_URL)}" target="_blank" rel="noreferrer">View source</a>.</p>
    </div>`;
}

function buildNationalChampionshipGroupMarkup(group) {
  const rows = group.federations
    .map((federation) => {
      const search = [federation.country, ...federation.championKeys.map((key) => federation.champions[key])]
        .join(" ")
        .toLowerCase();
      const cells = NATIONAL_CHAMPIONSHIP_TABLE_COLUMNS.map((column) =>
        federation.champions[column.key]
          ? `<td data-event-key="${column.key}"><span class="national-champion">${escapeHtml(federation.champions[column.key])}</span></td>`
          : `<td data-event-key="${column.key}"><span class="national-cell-empty" aria-label="No result recorded">—</span></td>`,
      ).join("");
      const flag = federation.flag ? `<span class="national-flag" aria-hidden="true">${escapeHtml(federation.flag)}</span>` : "";
      const detail = federation.detail ? `<span class="national-federation-detail">${escapeHtml(federation.detail)}</span>` : "";
      return `
        <tr data-national-row data-champions="${escapeHtml(federation.championKeys.join(" "))}" data-search="${escapeHtml(search)}">
          <th scope="row"><span class="national-federation">${flag}<span>${escapeHtml(federation.country)}</span></span>${detail}</th>
          ${cells}
        </tr>`;
    })
    .join("");
  const head = NATIONAL_CHAMPIONSHIP_TABLE_COLUMNS.map(
    (column) => `<th scope="col" data-event-key="${column.key}">${escapeHtml(column.label)}</th>`,
  ).join("");
  const hint = group.hint ? `<span class="national-group-hint">${escapeHtml(group.hint)}</span>` : "";

  return `
    <details class="national-group" data-national-group data-national-group-id="${escapeHtml(group.id)}">
      <summary class="national-group-summary">
        <span class="national-group-chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"></path></svg></span>
        <span class="national-group-name">${escapeHtml(group.label)}</span>
        <span class="national-group-count">${escapeHtml(String(group.reportingCount))} of ${escapeHtml(String(group.federationCount))} federations with champions<span data-national-group-visible></span></span>
        ${hint}
      </summary>
      <div class="national-table-wrap">
        <table class="national-table">
          <thead><tr><th scope="col">Federation</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>`;
}

// ---------------------------------------------------------------------------
// National Championships map. Shapes come from data/continent-map.json (built by
// scripts/build-continent-map.js from Natural Earth); status shading comes from the
// same continent groups the almanac tables use, so the two can never disagree.

function loadContinentMapData() {
  try {
    return require(path.join(process.cwd(), "data", "continent-map.json"));
  } catch (error) {
    return null;
  }
}

const CONTINENT_MAP_DATA = loadContinentMapData();

function buildNationalChampionshipMapMarkup(groups, mapData = CONTINENT_MAP_DATA) {
  if (!mapData?.countries?.length) {
    return "";
  }
  const federations = new Map();
  (groups || []).forEach((group) => {
    group.federations.forEach((federation) => {
      const alpha2 = COUNTRY_NAME_ALPHA2[String(federation.country || "").trim().toLowerCase()];
      if (alpha2) {
        federations.set(alpha2, { ...federation, continent: group.id });
      }
    });
  });
  const groupById = new Map((groups || []).map((group) => [group.id, group]));
  const statusOf = (alpha2) => {
    const federation = federations.get(alpha2);
    if (!federation) {
      return "none";
    }
    return federation.championKeys.length ? "champion" : "listed";
  };
  const championAttributes = (alpha2) => {
    const federation = federations.get(alpha2);
    return federation ? federation.championKeys.map((key) => ` data-has-${key.toLowerCase()}="1"`).join("") : "";
  };

  const continents = NATIONAL_CHAMPIONSHIP_CONTINENTS.map((continent) => {
    const group = groupById.get(continent.id);
    const countries = mapData.countries.filter((country) => country.continent === continent.id);
    const dots = (mapData.dots || []).filter((dot) => dot.continent === continent.id);
    const paths = countries
      .map(
        (country) =>
          `<path class="national-map-country is-${statusOf(country.alpha2)}"${championAttributes(country.alpha2)} d="${country.d}"><title>${escapeHtml(country.name)}</title></path>`,
      )
      .join("");
    const dotMarkup = dots
      .map(
        (dot) =>
          `<circle class="national-map-dot is-${statusOf(dot.alpha2)}"${championAttributes(dot.alpha2)} cx="${dot.x}" cy="${dot.y}" r="4"><title>${escapeHtml(dot.name)}</title></circle>`,
      )
      .join("");
    const label = mapData.labels?.[continent.id];
    const count = group ? `${group.reportingCount}/${group.federationCount}` : "";
    const labelMarkup = label
      ? `<g class="national-map-label"><rect x="${(label.x - 4).toFixed(1)}" y="${(label.y - 13).toFixed(1)}" width="${(continent.label.length * 7.6 + 54).toFixed(0)}" height="18" rx="9"></rect><text x="${(label.x + 4).toFixed(1)}" y="${label.y.toFixed(1)}" class="national-map-label-name">${escapeHtml(continent.label.toUpperCase())}</text><text x="${(label.x + continent.label.length * 7.6 + 8).toFixed(1)}" y="${label.y.toFixed(1)}" class="national-map-label-count">${escapeHtml(count)}</text></g>`
      : "";
    const tip = group
      ? `${group.reportingCount} of ${group.federationCount} federations with champions${group.hint ? ` · ${group.hint.charAt(0).toLowerCase()}${group.hint.slice(1)}` : ""}`
      : "No federations listed";
    return `<g class="national-map-continent" data-national-map-continent="${escapeHtml(continent.id)}" role="button" tabindex="0" aria-label="${escapeHtml(`${continent.label}: ${tip}. Opens the ${continent.label} champions.`)}" data-tip-title="${escapeHtml(continent.label)}" data-tip-detail="${escapeHtml(tip)}">${paths}${dotMarkup}${labelMarkup}</g>`;
  }).join("");

  return `
    <div class="national-map" data-national-map>
      <svg class="national-map-svg" viewBox="0 0 ${mapData.width} ${mapData.height}" role="group" aria-label="World map of national championship federations, one region per continent">
        <defs><pattern id="national-map-listed" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="rgba(0, 120, 199, 0.12)"></rect><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(0, 51, 160, 0.45)" stroke-width="1"></line></pattern></defs>
        ${continents}
      </svg>
      <div class="season-tooltip national-map-tooltip" data-national-map-tooltip role="tooltip" hidden></div>
      <div class="national-map-legend">
        <span class="season-legend-item"><span class="season-swatch national-map-swatch-champion"></span>Champion recorded in ${escapeHtml(String(SEASON_YEAR))}</span>
        <span class="season-legend-item"><span class="season-swatch national-map-swatch-listed"></span>In the index, no result yet</span>
        <span class="season-legend-item"><span class="season-swatch national-map-swatch-none"></span>Not a federation in the index</span>
        <span class="season-legend-item"><span class="season-swatch national-map-swatch-dot"></span>Federation too small to draw</span>
      </div>
      <p class="meta national-map-note">Hover a continent for its count; click it to open its champions below. Shapes from Natural Earth, public domain. Ten federations are smaller than a pixel at this scale and appear as dots.</p>
    </div>`;
}

function buildNationalChampionshipsSection(nationalChampionships) {
  const data = nationalChampionships || buildEmptyNationalChampionships();
  const events = sortNationalChampionshipEvents(data.events || buildNationalChampionshipEventRecords(data.rows || []));
  const featured = events.filter(isFeaturedNationalChampionshipEvent);
  const groups = groupNationalChampionshipsByContinent(events);
  const federationCount = groups.reduce((sum, group) => sum + group.federationCount, 0);
  const reportingCount = groups.reduce((sum, group) => sum + group.reportingCount, 0);
  const datedCountryCount = new Set(events.filter((event) => event.date).map((event) => event.country)).size;
  const errorMarkup = data.error
    ? `<p class="meta national-error">National championship data is temporarily unavailable: ${escapeHtml(data.error)}</p>`
    : "";
  const featuredMarkup = featured.length
    ? `
        <div class="competition-block national-featured-block">
          <div class="competition-block-head">
            <h3>Featured</h3>
            <p>Titles with a full podium, a report or a finish video.</p>
          </div>
          <div class="grid competition-grid national-featured-grid">
            ${featured.map(buildNationalChampionshipEventCard).join("")}
          </div>
        </div>`
    : "";
  const chips = [{ key: "", chip: "All" }, ...NATIONAL_CHAMPIONSHIP_TABLE_COLUMNS]
    .map(
      (column) => `
        <button type="button" class="national-chip${column.key ? "" : " is-active"}" data-national-category="${escapeHtml(column.key)}" aria-pressed="${column.key ? "false" : "true"}">${escapeHtml(column.chip)}</button>`,
    )
    .join("");
  const emptyFederationCount = federationCount - reportingCount;

  return `
    <section class="section national-section" id="national-championships">
      <div class="section-head">
        <div>
          <div class="section-tag">National Titles</div>
          <h2>National Championships</h2>
          <p>Elite men and women road race and individual time trial champions by country.</p>
        </div>
      </div>
      <div class="competition-stack">
        ${errorMarkup}
        <div class="national-almanac-grid">
          <div class="competition-block national-schedule-block">
            <div class="competition-block-head national-schedule-head">
              <h3>When the championships happen</h3>
              <p>Confirmed dates for ${escapeHtml(String(datedCountryCount))} of ${escapeHtml(String(federationCount))} federations.</p>
            </div>
            ${buildNationalChampionshipScheduleMarkup(events)}
            <p class="meta national-schedule-note">${escapeHtml(describeConfirmedNationalChampionshipDates(events))} Hatched windows show when most federations usually race and are not confirmed dates.</p>
          </div>
          <div class="competition-block national-status-block">
            ${buildNationalChampionshipStatusMarkup(data, events)}
          </div>
        </div>
        ${featuredMarkup}
        <div class="competition-block national-results-block" data-national-almanac data-category="" data-include-empty="0">
          <div class="competition-block-head national-results-head">
            <div>
              <h3>All ${escapeHtml(String(SEASON_YEAR))} champions</h3>
              <p>One row per federation, grouped by continent. Type a country or a rider.</p>
            </div>
            <p class="meta national-source-line">${escapeHtml(data.sourceLabel)}. <a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noreferrer">View source</a>.</p>
          </div>
          <div class="national-search-bar">
            <label class="national-search">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="6"></circle><path d="M14 14l4 4"></path></svg>
              <span class="visually-hidden">Search a country or rider</span>
              <input type="search" data-national-search placeholder="Search a country or rider, e.g. Slovenia or Vollering" autocomplete="off" spellcheck="false" />
            </label>
            <div class="national-chip-row" role="group" aria-label="Category">${chips}</div>
          </div>
          ${buildNationalChampionshipMapMarkup(groups)}
          <div class="national-groups">
            ${groups.map(buildNationalChampionshipGroupMarkup).join("")}
          </div>
          <p class="meta national-empty-state" data-national-empty-state hidden>No federation or rider matches that search.</p>
          ${
            emptyFederationCount > 0
              ? `<div class="national-results-foot"><button type="button" class="national-chip national-chip-muted" data-national-include-empty aria-pressed="false">Include ${escapeHtml(String(emptyFederationCount))} federations without a recorded result</button></div>`
              : ""
          }
        </div>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Season calendar

function formatSeasonRaceDates(race) {
  const start = new Date(`${race.startDate}T00:00:00Z`);
  const end = new Date(`${race.endDate}T00:00:00Z`);
  const month = (date) => CALENDAR_MONTH_LABELS[date.getUTCMonth()];
  if (race.startDate === race.endDate) {
    return `${start.getUTCDate()} ${month(start)}`;
  }
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month(start)}`;
  }
  return `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)}`;
}

function describeSeasonRace(race) {
  if (race.status === "cancelled") {
    return "Cancelled";
  }
  if (race.status === "live") {
    return "In progress";
  }
  if (race.status === "finished") {
    const flag = getCountryFlagEmoji(race.winnerCountryCode);
    return race.winner ? `${race.winner}${flag ? ` ${flag}` : ""}` : "Result pending";
  }
  return race.location ? `Upcoming · ${race.location}` : "Upcoming";
}

function seasonRaceFill(race) {
  if (race.status === "live") {
    return "#ffcc00";
  }
  if (race.status !== "finished") {
    return "rgba(255, 255, 255, 0.7)";
  }
  if (race.tier === "grand-tour") {
    return "#0033a0";
  }
  if (race.tier === "monument") {
    return "#ef3340";
  }
  return "#0078c7";
}

// Greedy row packing: each race takes the first row whose last bar (plus label) ends
// before it starts, so a crowded April stacks instead of overlapping.
function packSeasonCalendarRows(races, X, scale, labelFor) {
  const rowEnds = [];
  const placed = [];
  races.forEach((race) => {
    const x = X(race.startDate);
    const width = Math.max(12, (seasonDayIndex(race.endDate, race.startDate) + 1) * scale);
    const label = labelFor(race);
    const labelWidth = label ? label.length * (race.tier === "grand-tour" ? 7.6 : 6.4) : 0;
    const labelInside = Boolean(label) && race.tier === "grand-tour" && width > labelWidth + 12;
    const extent = label && !labelInside ? width + 5 + labelWidth : width;
    let row = rowEnds.findIndex((end) => end + 6 <= x);
    if (row < 0) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = x + extent;
    placed.push({ race, x, width, row, label, labelInside });
  });
  return { placed, rowCount: rowEnds.length };
}

function buildSeasonCalendarSvg(calendar, options = {}) {
  const compact = options.compact === true;
  const seriesFilter = options.series || "both";
  const presentAnchors = options.presentAnchors || new Set();
  const width = options.width || (compact ? 900 : 1170);
  const x0 = 8;
  const x1 = width - 8;
  const totalDays = seasonDayIndex(calendar.rangeEnd, calendar.rangeStart) + 1;
  const scale = (x1 - x0) / totalDays;
  const X = (isoDay) => x0 + seasonDayIndex(isoDay, calendar.rangeStart) * scale;
  const axisHeight = compact ? 22 : 30;
  const rowHeight = compact ? 12 : 24;
  const laneGap = compact ? 4 : 18;
  const laneLabelHeight = compact ? 0 : 22;
  const labelFor = (race) =>
    compact ? "" : race.tier === "grand-tour" || race.tier === "monument" ? race.title : "";

  const lanes = SEASON_CALENDAR_SERIES.filter((series) => seriesFilter === "both" || series.id === seriesFilter).map((series) => {
    const laneRaces = calendar.races.filter((race) => race.seriesId === series.id);
    return { series, ...packSeasonCalendarRows(laneRaces, X, scale, labelFor) };
  });

  let cursorY = axisHeight + 10;
  const laneTops = lanes.map((lane) => {
    const top = cursorY;
    cursorY += laneLabelHeight + lane.rowCount * rowHeight + laneGap;
    return top;
  });
  const height = cursorY + (compact ? 4 : 8);
  const bandTop = axisHeight - 4;
  const patternId = compact ? "season-hatch-compact" : `season-hatch-${seriesFilter}`;
  const parts = [CALENDAR_HATCH_DEFS(patternId)];
  parts.push(buildCalendarMonthMarkup(calendar.rangeStart, calendar.rangeEnd, X, bandTop, height, compact));
  parts.push(buildCalendarWindowMarkup(X, bandTop, height, patternId, compact ? 0 : height - 4));

  let barIndex = 0;
  lanes.forEach((lane, laneIndex) => {
    const top = laneTops[laneIndex];
    const barsTop = top + laneLabelHeight;
    if (!compact) {
      parts.push(
        svgText(x0, top + 12, lane.series.label.toUpperCase(), `${CALENDAR_LABEL_FONT} font-size="13" font-weight="800" letter-spacing="0.1em" fill="#0078c7"`),
      );
    }
    lane.placed.forEach((entry) => {
      const { race } = entry;
      const grand = race.tier === "grand-tour";
      const barHeight = grand ? rowHeight - 4 : rowHeight - 8;
      const y = barsTop + entry.row * rowHeight + (rowHeight - barHeight) / 2;
      const radius = Math.min(6, barHeight / 2);
      const fill = seasonRaceFill(race);
      const outlined = race.status === "upcoming" || race.status === "cancelled";
      const stroke = race.status === "live" ? "#b78f00" : outlined ? "rgba(0, 51, 160, 0.5)" : "none";
      const dash = outlined ? ' stroke-dasharray="3 2"' : "";
      const tip = `${race.title} · ${formatSeasonRaceDates(race)} · ${describeSeasonRace(race)}`;
      const anchor = presentAnchors.has(race.anchor) ? race.anchor : "";
      const dataAttributes = `data-season-bar data-tip-title="${escapeHtml(race.title)}" data-tip-dates="${escapeHtml(formatSeasonRaceDates(race))}" data-tip-detail="${escapeHtml(describeSeasonRace(race))}" data-status="${escapeHtml(race.status)}" style="--i:${barIndex}"`;
      barIndex += 1;
      const open = anchor
        ? `<a class="season-bar" href="#${escapeHtml(anchor)}" ${dataAttributes}>`
        : `<g class="season-bar" tabindex="0" ${dataAttributes}>`;
      const close = anchor ? "</a>" : "</g>";
      const pieces = [`<title>${escapeHtml(tip)}</title>`];
      pieces.push(
        `<rect class="season-bar-fill" x="${entry.x.toFixed(1)}" y="${y.toFixed(1)}" width="${entry.width.toFixed(1)}" height="${barHeight}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"${dash}></rect>`,
      );
      if (race.status === "live") {
        const doneWidth = Math.max(4, (seasonDayIndex(calendar.today, race.startDate) + 1) * scale);
        pieces.push(
          `<rect class="season-bar-fill season-bar-progress" x="${entry.x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.min(doneWidth, entry.width).toFixed(1)}" height="${barHeight}" rx="${radius}" fill="#0033a0"></rect>`,
        );
      }
      if (entry.label) {
        const inside = entry.labelInside;
        const labelX = inside ? entry.x + 8 : entry.x + entry.width + 5;
        const labelFill = inside ? (race.status === "live" ? "#09214c" : "white") : "#09214c";
        pieces.push(
          svgText(labelX, y + barHeight / 2 + 4, entry.label, `class="season-bar-label" ${CALENDAR_LABEL_FONT} font-size="${grand ? 13 : 11.5}" font-weight="${grand ? 800 : 700}" fill="${labelFill}"`),
        );
      }
      parts.push(`${open}${pieces.join("")}${close}`);
    });
  });

  if (calendar.today >= calendar.rangeStart && calendar.today <= calendar.rangeEnd) {
    parts.push(buildCalendarTodayMarkup(X(calendar.today), bandTop - 2, height, compact ? height - 18 : bandTop - 12));
  }

  const description = compact
    ? `${calendar.year} WorldTour season strip`
    : `${calendar.year} WorldTour calendar, ${lanes.map((lane) => lane.series.label).join(" and ")}`;
  return `<svg class="season-svg${compact ? " season-svg-compact" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(description)}">${parts.join("")}</svg>`;
}

function buildSeasonRaceRowMarkup(race, presentAnchors) {
  const fill = seasonRaceFill(race);
  const outlined = race.status === "upcoming" || race.status === "cancelled";
  const dotStyle = `background:${outlined ? "transparent" : fill}; border:${outlined ? "1.5px dashed rgba(0, 51, 160, 0.5)" : "none"};${race.tier === "grand-tour" ? " height:22px;" : ""}`;
  const title = presentAnchors.has(race.anchor)
    ? `<a href="#${escapeHtml(race.anchor)}" data-season-race-link>${escapeHtml(race.title)}</a>`
    : escapeHtml(race.title);
  const detail = race.status === "upcoming" ? race.series : describeSeasonRace(race);
  return `
    <div class="season-month-row" data-status="${escapeHtml(race.status)}">
      <span class="season-month-dot" style="${dotStyle}" aria-hidden="true"></span>
      <div class="season-month-copy">
        <div class="season-month-title">${title}</div>
        <div class="season-month-detail">${escapeHtml(detail)}</div>
      </div>
      <span class="season-month-date">${escapeHtml(formatSeasonRaceDates(race))}</span>
    </div>`;
}

// Phone layout: the strip is unreadable at 390px, so the same races become a list
// grouped by month, live races pinned first and finished months folded away until the
// section is expanded.
function buildSeasonMonthListMarkup(calendar, presentAnchors) {
  const live = calendar.races.filter((race) => race.status === "live");
  const todayMonth = calendar.today.slice(0, 7);
  const byMonth = new Map();
  calendar.races.forEach((race) => {
    if (race.status === "live") {
      return;
    }
    const month = race.startDate.slice(0, 7);
    if (!byMonth.has(month)) {
      byMonth.set(month, []);
    }
    byMonth.get(month).push(race);
  });
  const liveMarkup = live.length
    ? `
      <div class="season-month">
        <div class="season-month-head"><h3>Live now</h3></div>
        ${live.map((race) => buildSeasonRaceRowMarkup(race, presentAnchors)).join("")}
      </div>`
    : "";
  const months = [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, races]) => {
      const past = month < todayMonth && races.every((race) => race.status !== "upcoming");
      const monthIndex = Number.parseInt(month.slice(5, 7), 10) - 1;
      const rows = past ? "" : races.map((race) => buildSeasonRaceRowMarkup(race, presentAnchors)).join("");
      return `
        <div class="season-month"${past ? " data-season-past" : ""}>
          <div class="season-month-head">
            <h3>${escapeHtml(CALENDAR_MONTH_NAMES[monthIndex])}</h3>
            <span class="season-month-count">${escapeHtml(String(races.length))} race${races.length === 1 ? "" : "s"}${past ? " · finished" : ""}</span>
          </div>
          ${rows || `<div class="season-month-folded">${races.map((race) => escapeHtml(race.title)).join(" · ")}</div>`}
        </div>`;
    })
    .join("");
  return `${liveMarkup}${months}`;
}

function buildSeasonCalendarSection(calendar, data = {}) {
  if (!calendar?.races?.length || !calendar.rangeStart || !calendar.rangeEnd) {
    return "";
  }
  const presentAnchors = new Set(
    [
      ...(data.recentResults || []),
      ...(data.finalizedStageRaces || []),
      ...(data.liveStageRaces || []),
      ...(data.upcomingRaces || []),
    ]
      .map(createRaceAnchorId)
      .filter(Boolean),
  );
  const liveTitles = calendar.races.filter((race) => race.status === "live").map((race) => race.title);
  const upcoming = calendar.races.filter((race) => race.status === "upcoming").slice(0, 3);
  const summary = [
    liveTitles.length ? `${liveTitles.join(" and ")} in progress` : "",
    `${calendar.finishedCount} of ${calendar.races.length} WorldTour races run`,
    upcoming[0] ? `next: ${upcoming[0].title}, ${formatSeasonRaceDates(upcoming[0])}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const upNextMarkup = upcoming.length
    ? `
      <aside class="competition-block season-upnext">
        <div class="card-kicker">Up next</div>
        ${upcoming
          .map(
            (race) => `
          <div class="season-upnext-row">
            ${
              presentAnchors.has(race.anchor)
                ? `<a href="#${escapeHtml(race.anchor)}" data-season-race-link>${escapeHtml(race.title)}</a>`
                : `<span>${escapeHtml(race.title)}</span>`
            }
            <span class="season-upnext-date">${escapeHtml(formatSeasonRaceDates(race))}</span>
          </div>`,
          )
          .join("")}
      </aside>`
    : "";
  const legend = [
    ["season-swatch-grand", "Grand Tour"],
    ["season-swatch-monument", "Monument"],
    ["season-swatch-finished", "Finished"],
    ["season-swatch-live", "Live now"],
    ["season-swatch-upcoming", "Upcoming"],
    ["season-swatch-window", "National championship window (typical, not confirmed)"],
  ]
    .map(([swatch, label]) => `<span class="season-legend-item"><span class="season-swatch ${swatch}"></span>${escapeHtml(label)}</span>`)
    .join("");
  const seriesChips = [
    ["both", "Both series"],
    ["mens", "Men"],
    ["womens", "Women"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="national-chip${id === "both" ? " is-active" : ""}" data-season-series="${id}" aria-pressed="${id === "both" ? "true" : "false"}">${escapeHtml(label)}</button>`,
    )
    .join("");
  const fullViews = ["both", "mens", "womens"]
    .map(
      (id) =>
        `<div class="season-full-view" data-season-view="${id}"${id === "both" ? "" : " hidden"}>${buildSeasonCalendarSvg(calendar, { series: id, presentAnchors })}</div>`,
    )
    .join("");

  return `
    <section class="section season-section is-expanded" id="season-calendar" data-season-calendar hidden>
      <div class="season-head">
        <div>
          <div class="section-tag">Season at a glance</div>
          <h2>Where we are in ${escapeHtml(String(calendar.year))}</h2>
          <p class="meta season-summary">${escapeHtml(summary)}</p>
        </div>
        <button type="button" class="season-toggle" data-season-close aria-label="Close the season calendar">
          <span>Close calendar</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"></path></svg>
        </button>
      </div>
      <div class="season-body">
        <div class="season-main">
          <div class="season-full" data-season-full>
            <div class="season-series-row" role="group" aria-label="Series">${seriesChips}</div>
            ${fullViews}
            <div class="season-legend">${legend}</div>
            <p class="meta season-note">Race dates and winners come from the Wikipedia ${escapeHtml(String(calendar.year))} season pages the site already reads. Hover or focus a bar for the result; click one to jump to its card. Hatched windows show when national championships usually fall; confirmed dates live in the National Championships section.</p>
          </div>
          <div class="season-month-list" data-season-months>
            ${buildSeasonMonthListMarkup(calendar, presentAnchors)}
          </div>
        </div>
        ${upNextMarkup}
      </div>
      <div class="season-tooltip" data-season-tooltip role="tooltip" hidden></div>
    </section>`;
}

function buildDeferredSectionButtons(groups) {
  if (groups.length === 0) {
    return "";
  }

  const buttons = groups
    .map(
      (group) => `
        <button
          type="button"
          class="hero-menu-link deferred-load-button"
          data-deferred-group-id="${escapeHtml(group.id)}"
          data-scroll-on-load="true"
        >
          ${escapeHtml(group.label)}
        </button>`,
    )
    .join("");

  return `
    <section class="section section-cta">
      <div class="section-head">
        <div>
          <div class="section-tag">More Race Coverage</div>
          <h2>Load More Racing</h2>
          <p>Open additional race sections only when you want them.</p>
        </div>
      </div>
      <div class="deferred-button-row">${buttons}</div>
    </section>`;
}

function buildDeferredGroupClientPayload(groups) {
  return JSON.stringify(
    groups.map((group) => ({
      id: group.id,
      label: group.label,
    })),
  );
}

function buildHtmlPage(data, view) {
  const shareView = getShareView(view?.sharePath || "/") || SHARE_VIEWS["/"];
  const competitionGroups = getCompetitionGroups(data);
  const eagerCompetitionGroups = competitionGroups.filter((group) => !group.deferred);
  const deferredCompetitionGroups = competitionGroups.filter((group) => group.deferred);
  const competitionSections = eagerCompetitionGroups
    .map((group) => buildCompetitionSection(group))
    .filter(Boolean)
    .join("");
  const nationalChampionshipsSection = buildNationalChampionshipsSection(data.nationalChampionships);
  const seasonCalendarSection = buildSeasonCalendarSection(data.seasonCalendar, data);
  const heroSubheader = [
    "RACE RESULTS",
    "SEASON CALENDAR",
    "WATCH THE FINISH",
    "STAGE PROFILES",
    "RACE NEWS",
    "NATIONAL CHAMPIONSHIPS",
  ].join(" • ");
  const heroMenu = [
    ...competitionGroups,
    { id: "national-championships", label: "National Championships" },
    { id: "season-calendar", label: "Season Calendar", badge: "New", opensSeasonCalendar: true },
  ]
    .map(
      (group) => `
        ${
          group.deferred
            ? `<button
                type="button"
                class="hero-menu-link deferred-load-button"
                data-deferred-group-id="${escapeHtml(group.id)}"
                data-scroll-on-load="true"
              >
                ${escapeHtml(group.label)}
              </button>`
            : `<a class="hero-menu-link${group.badge ? " is-new" : ""}" href="#${escapeHtml(group.id)}"${group.opensSeasonCalendar ? " data-season-open" : ""}>${escapeHtml(group.label)}${group.badge ? `<span class="hero-menu-badge">${escapeHtml(group.badge)}</span>` : ""}</a>`
        }`,
    )
    .join("");
  const deferredSectionButtons = buildDeferredSectionButtons(deferredCompetitionGroups);
  const deferredGroupClientPayload = buildDeferredGroupClientPayload(deferredCompetitionGroups);
  const deferredSectionMounts = deferredCompetitionGroups
    .map(
      (group) => `
        <div
          id="${escapeHtml(group.id)}-mount"
          class="deferred-section-mount"
          data-group-id="${escapeHtml(group.id)}"
          hidden
        ></div>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${buildShareMetaTags(shareView)}
    <link rel="canonical" href="${escapeHtml(SITE_ORIGIN)}/" />
    <link rel="icon" href="/assets/favicon.svg?v=2" type="image/svg+xml" />
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
        appearance: none;
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
        cursor: pointer;
      }

      .hero-menu-link.is-new {
        border-color: rgba(255, 204, 0, 0.7);
        background: linear-gradient(180deg, rgba(255, 204, 0, 0.28), rgba(255, 204, 0, 0.12));
      }

      .hero-menu-badge {
        margin-left: 0.5rem;
        padding: 0.12rem 0.45rem;
        border-radius: 999px;
        background: var(--uci-yellow);
        color: var(--uci-blue-deep);
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        line-height: 1.2;
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

      .section-cta::before {
        background: linear-gradient(180deg, var(--uci-red), var(--uci-yellow));
      }

      .deferred-button-row {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .section-cta .deferred-load-button {
        color: var(--uci-blue-deep);
        border-color: rgba(0, 51, 160, 0.14);
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.12), rgba(0, 51, 160, 0.05));
      }

      .section-cta .deferred-load-button:hover {
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.18), rgba(0, 51, 160, 0.1));
        border-color: rgba(0, 51, 160, 0.22);
      }

      .deferred-load-button.is-loading {
        opacity: 0.78;
        pointer-events: none;
      }

      .deferred-section-mount[hidden] {
        display: none !important;
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

      /* Slots let recent-result cards carry reveal state and dropdown metadata
         without becoming the grid item themselves (display: contents), so the
         card layout is unchanged; a hidden slot removes its card from the row. */
      .recent-race-slot {
        display: contents;
      }

      .recent-race-slot[hidden] {
        display: none;
      }

      .load-more-races {
        display: block;
        margin: 1.1rem auto 0;
        min-height: 3rem;
        padding: 0.8rem 1.6rem;
        border-radius: 16px;
        border: 1px solid var(--line-strong);
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.1), rgba(0, 51, 160, 0.04));
        color: var(--uci-blue-deep);
        cursor: pointer;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .load-more-races:hover {
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.16), rgba(0, 51, 160, 0.08));
      }

      /* display: block above overrides the UA [hidden] rule, so the button needs
         an explicit hidden state for revealMoreRecentRaces to remove it at the max. */
      .load-more-races[hidden] {
        display: none;
      }

      .national-section::before {
        background: var(--rainbow);
      }

      .national-error {
        padding: 0.85rem 1rem;
        border-radius: 18px;
        border: 1px solid rgba(239, 51, 64, 0.24);
        background: rgba(239, 51, 64, 0.06);
      }

      .national-results-block a {
        color: var(--uci-blue);
        font-weight: 700;
        text-decoration: none;
      }

      .national-results-block a:hover {
        text-decoration: underline;
      }

      .national-event-meta span,
      .national-event-empty span {
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-event-card[hidden] {
        display: none;
      }

      .national-event-meta {
        display: grid;
        gap: 0.35rem;
        margin-top: 0.9rem;
        padding-top: 0.85rem;
        border-top: 1px solid var(--line);
      }

      .national-podium-list {
        display: grid;
        gap: 0.55rem;
        list-style: none;
        margin: 1rem 0 0;
        padding: 0;
      }

      .national-podium-item {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        color: var(--ink);
        font-weight: 800;
      }

      .national-event-empty {
        display: grid;
        gap: 0.25rem;
        margin-top: 1rem;
      }

      .national-event-empty strong {
        color: var(--ink);
        font-size: 1.05rem;
      }

      .national-event-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
        margin-top: 1rem;
      }

      .national-empty-state {
        padding: 0.85rem 1rem;
        border-radius: 18px;
        border: 1px dashed var(--line);
        background: rgba(255, 255, 255, 0.62);
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      .national-almanac-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: stretch;
      }

      .national-schedule-block {
        padding-bottom: 0.6rem;
      }

      .national-schedule-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
      }

      .national-schedule-svg,
      .season-svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .national-schedule-note,
      .season-note {
        font-size: 0.82rem;
      }

      .national-status {
        display: grid;
        gap: 0.9rem;
        align-content: center;
        height: 100%;
      }

      .national-status-label,
      .season-upnext-date,
      .season-month-date,
      .season-month-count,
      .national-group-count {
        display: block;
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-status-headline,
      .national-status-figure {
        display: block;
        margin-top: 0.2rem;
        color: var(--uci-blue-deep);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-weight: 800;
        line-height: 1;
      }

      .national-status-headline {
        font-size: 2rem;
      }

      .national-status-figure {
        font-size: 1.6rem;
      }

      .national-status-grid {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .national-status-note {
        margin: 0;
        font-size: 0.85rem;
      }

      .national-featured-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .national-results-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 1rem;
      }

      .national-source-line {
        margin: 0;
        font-size: 0.82rem;
        text-align: right;
      }

      .national-search-bar {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
      }

      .national-search {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        min-height: 2.8rem;
        padding: 0 0.9rem;
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        background: white;
        color: var(--muted);
      }

      .national-search:focus-within {
        border-color: var(--uci-blue-bright);
        box-shadow: 0 0 0 3px rgba(0, 120, 199, 0.16);
      }

      .national-search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--ink);
        font: inherit;
        font-weight: 700;
      }

      .national-search input::placeholder {
        color: rgba(79, 97, 136, 0.7);
      }

      .national-chip-row,
      .season-series-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .national-chip,
      .season-toggle {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        height: 2.1rem;
        padding: 0 0.8rem;
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.75);
        color: var(--uci-blue);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }

      .national-chip:hover,
      .season-toggle:hover {
        background: rgba(0, 51, 160, 0.08);
      }

      .national-chip.is-active {
        background: var(--uci-blue);
        border-color: var(--uci-blue);
        color: white;
      }

      .national-chip-muted {
        border-style: dashed;
        background: transparent;
        color: var(--muted);
      }

      .national-chip-muted.is-active {
        border-style: solid;
        background: var(--uci-blue-deep);
        border-color: var(--uci-blue-deep);
        color: white;
      }

      .national-groups {
        display: grid;
        gap: 0.7rem;
        margin-top: 1rem;
      }

      .national-group {
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.94);
      }

      .national-group[hidden] {
        display: none;
      }

      .national-group-summary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 1rem;
        padding: 0.85rem 1rem;
        list-style: none;
        cursor: pointer;
      }

      .national-group-summary::-webkit-details-marker {
        display: none;
      }

      .national-group-summary:hover {
        background: rgba(0, 51, 160, 0.03);
      }

      .national-group-chevron {
        display: inline-flex;
        color: var(--uci-blue);
        transition: transform 0.15s ease;
      }

      .national-group[open] .national-group-chevron {
        transform: rotate(90deg);
      }

      .national-group-name {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1.25rem;
        font-weight: 800;
        letter-spacing: -0.01em;
        text-transform: uppercase;
      }

      .national-group-count {
        display: inline;
      }

      .national-group-hint {
        margin-left: auto;
        color: var(--muted);
        font-size: 0.85rem;
        font-weight: 600;
      }

      .national-table-wrap {
        overflow-x: auto;
        border-top: 1px solid var(--line);
      }

      .national-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
      }

      .national-table th,
      .national-table td {
        padding: 0.62rem 0.9rem;
        border-top: 1px solid var(--line);
        color: var(--ink);
        font-size: 0.95rem;
        line-height: 1.35;
        text-align: left;
        vertical-align: top;
      }

      .national-table thead th {
        padding-top: 0.55rem;
        padding-bottom: 0.45rem;
        border-top: 0;
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-table tbody tr:nth-child(even) {
        background: rgba(0, 51, 160, 0.025);
      }

      .national-table tbody th {
        white-space: nowrap;
      }

      .national-federation {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1.05rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .national-federation .national-flag {
        font-size: 1.35rem;
      }

      .national-federation-detail {
        display: block;
        margin-top: 0.15rem;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 600;
        white-space: normal;
      }

      .national-champion {
        font-weight: 700;
      }

      .national-cell-empty {
        color: rgba(79, 97, 136, 0.45);
      }

      .national-results-foot {
        display: flex;
        justify-content: center;
        margin-top: 0.9rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--line);
      }

      [data-national-almanac]:not([data-include-empty="1"]) [data-national-row][data-champions=""] {
        display: none;
      }

      [data-national-almanac] [data-national-row][hidden] {
        display: none;
      }

      [data-national-almanac][data-category="meRoadRace"] [data-event-key]:not([data-event-key="meRoadRace"]),
      [data-national-almanac][data-category="meItt"] [data-event-key]:not([data-event-key="meItt"]),
      [data-national-almanac][data-category="weRoadRace"] [data-event-key]:not([data-event-key="weRoadRace"]),
      [data-national-almanac][data-category="weItt"] [data-event-key]:not([data-event-key="weItt"]) {
        display: none;
      }

      [data-national-almanac][data-category]:not([data-category=""]) .national-table {
        min-width: 0;
      }

      .national-map {
        position: relative;
        margin-top: 1rem;
      }

      .national-map-svg {
        display: block;
        width: 100%;
        height: auto;
        padding: 0.4rem 0.3rem 0.1rem;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.05), rgba(255, 255, 255, 0.6));
      }

      .national-map-continent {
        cursor: pointer;
        outline: none;
      }

      .national-map-country {
        stroke: rgba(255, 255, 255, 0.9);
        stroke-width: 0.6;
        stroke-linejoin: round;
        transition: fill 0.15s ease;
      }

      .national-map-country.is-champion,
      .national-map-dot.is-champion {
        fill: #0078c7;
      }

      .national-map-country.is-listed {
        fill: url(#national-map-listed);
      }

      .national-map-country.is-none {
        fill: rgba(0, 51, 160, 0.08);
      }

      .national-map-dot {
        stroke: white;
        stroke-width: 1.5;
      }

      .national-map-dot.is-listed,
      .national-map-dot.is-none {
        fill: white;
        stroke: rgba(0, 51, 160, 0.5);
      }

      .national-map-continent:hover .national-map-country.is-champion,
      .national-map-continent:focus-visible .national-map-country.is-champion,
      .national-map-continent.is-active .national-map-country.is-champion,
      .national-map-continent:hover .national-map-dot.is-champion,
      .national-map-continent:focus-visible .national-map-dot.is-champion,
      .national-map-continent.is-active .national-map-dot.is-champion {
        fill: #0033a0;
      }

      .national-map-continent:hover .national-map-country,
      .national-map-continent:focus-visible .national-map-country,
      .national-map-continent.is-active .national-map-country {
        stroke: #00184d;
        stroke-width: 0.8;
      }

      .national-map-label {
        pointer-events: none;
      }

      .national-map-label rect {
        fill: rgba(255, 255, 255, 0.85);
      }

      .national-map-label text {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 11.5px;
        font-weight: 800;
      }

      .national-map-label-name {
        letter-spacing: 0.08em;
        fill: #09214c;
      }

      .national-map-label-count {
        font-weight: 700;
        fill: #0078c7;
      }

      .national-map-continent:hover .national-map-label rect,
      .national-map-continent:focus-visible .national-map-label rect,
      .national-map-continent.is-active .national-map-label rect {
        fill: #00184d;
      }

      .national-map-continent:hover .national-map-label-name,
      .national-map-continent:focus-visible .national-map-label-name,
      .national-map-continent.is-active .national-map-label-name {
        fill: white;
      }

      .national-map-continent:hover .national-map-label-count,
      .national-map-continent:focus-visible .national-map-label-count,
      .national-map-continent.is-active .national-map-label-count {
        fill: #ffcc00;
      }

      /* A category chip re-shades the map: only countries holding that title stay blue. */
      [data-national-almanac][data-category="meRoadRace"] .national-map-country.is-champion:not([data-has-meroadrace]),
      [data-national-almanac][data-category="meItt"] .national-map-country.is-champion:not([data-has-meitt]),
      [data-national-almanac][data-category="weRoadRace"] .national-map-country.is-champion:not([data-has-weroadrace]),
      [data-national-almanac][data-category="weItt"] .national-map-country.is-champion:not([data-has-weitt]) {
        fill: url(#national-map-listed);
      }

      [data-national-almanac][data-category="meRoadRace"] .national-map-dot.is-champion:not([data-has-meroadrace]),
      [data-national-almanac][data-category="meItt"] .national-map-dot.is-champion:not([data-has-meitt]),
      [data-national-almanac][data-category="weRoadRace"] .national-map-dot.is-champion:not([data-has-weroadrace]),
      [data-national-almanac][data-category="weItt"] .national-map-dot.is-champion:not([data-has-weitt]) {
        fill: white;
        stroke: rgba(0, 51, 160, 0.5);
      }

      .national-map-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.1rem;
        margin-top: 0.7rem;
        padding: 0 0.3rem;
      }

      .national-map-swatch-champion {
        background: #0078c7;
      }

      .national-map-swatch-listed {
        background: repeating-linear-gradient(45deg, rgba(0, 51, 160, 0.45) 0 1px, rgba(0, 120, 199, 0.12) 1px 5px);
        border: 1px solid rgba(0, 51, 160, 0.18);
      }

      .national-map-swatch-none {
        background: rgba(0, 51, 160, 0.08);
        border: 1px solid rgba(0, 51, 160, 0.18);
      }

      .national-map-swatch-dot {
        width: 10px;
        height: 10px;
        border-radius: 5px;
        background: #0078c7;
        border: 1.5px solid white;
        box-shadow: 0 0 0 1px rgba(0, 51, 160, 0.3);
      }

      .national-map-note {
        font-size: 0.8rem;
      }

      .national-group.is-map-target {
        box-shadow: 0 0 0 3px rgba(0, 120, 199, 0.18);
        border-color: var(--line-strong);
      }

      /* Season calendar */

      .season-section {
        margin-top: 1.25rem;
        padding: 1.1rem 1.35rem;
      }

      .season-section[hidden] {
        display: none;
      }

      .season-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 1rem;
      }

      .season-head h2 {
        margin-top: 0.2rem;
        font-size: 1.9rem;
        text-transform: uppercase;
      }

      .season-summary {
        margin-top: 0.35rem;
        font-size: 0.9rem;
      }

      .season-toggle {
        flex: 0 0 auto;
      }

      .season-body {
        display: grid;
        gap: 1.2rem;
        grid-template-columns: minmax(0, 1fr) 300px;
        align-items: start;
        margin-top: 0.8rem;
      }

      .season-main {
        min-width: 0;
      }

      .season-full[hidden],
      .season-full-view[hidden] {
        display: none;
      }

      .season-full {
        display: grid;
        gap: 0.8rem;
      }

      .season-full-view {
        padding: 1rem 1.1rem 0.6rem;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(0, 51, 160, 0.03), rgba(255, 255, 255, 0.94));
      }

      .season-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.1rem;
        padding: 0 0.3rem;
      }

      .season-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .season-swatch {
        display: inline-block;
        width: 22px;
        height: 12px;
        border-radius: 6px;
      }

      .season-swatch-grand {
        background: #0033a0;
      }

      .season-swatch-monument {
        background: #ef3340;
      }

      .season-swatch-finished {
        background: #0078c7;
      }

      .season-swatch-live {
        background: #ffcc00;
      }

      .season-swatch-upcoming {
        background: rgba(255, 255, 255, 0.7);
        border: 1.2px dashed rgba(0, 51, 160, 0.5);
      }

      .season-swatch-window {
        border: 1px dashed rgba(239, 51, 64, 0.5);
        background: repeating-linear-gradient(45deg, rgba(239, 51, 64, 0.35) 0 1.5px, rgba(239, 51, 64, 0.05) 1.5px 6px);
      }

      .season-upnext {
        padding: 0.9rem 1rem;
      }

      .season-upnext .card-kicker {
        margin-bottom: 0.3rem;
      }

      .season-upnext-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.8rem;
        padding: 0.45rem 0;
        border-top: 1px solid var(--line);
        font-weight: 800;
      }

      .season-upnext-row a {
        color: var(--ink);
        text-decoration: none;
      }

      .season-upnext-row a:hover {
        color: var(--uci-blue);
      }

      .season-upnext-date,
      .season-month-date {
        color: var(--uci-blue);
        white-space: nowrap;
      }

      .season-bar {
        cursor: pointer;
        outline: none;
      }

      .season-bar:hover .season-bar-fill,
      .season-bar:focus-visible .season-bar-fill {
        filter: brightness(1.12);
        stroke: #00184d;
        stroke-width: 1.5;
      }

      .season-bar-fill {
        transform-box: fill-box;
        transform-origin: left center;
        animation: season-draw 520ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
        animation-delay: calc(var(--i, 0) * 9ms);
      }

      .season-bar-label {
        animation: season-fade 400ms ease-out both;
        animation-delay: calc(var(--i, 0) * 9ms + 250ms);
      }

      .season-today-dot {
        animation: season-pulse 1.8s ease-in-out infinite;
      }

      @keyframes season-draw {
        from {
          transform: scaleX(0);
        }
        to {
          transform: scaleX(1);
        }
      }

      @keyframes season-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes season-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      .season-tooltip {
        position: absolute;
        z-index: 5;
        max-width: 260px;
        padding: 0.6rem 0.8rem;
        border-radius: 14px;
        background: var(--uci-blue-deep);
        color: white;
        box-shadow: 0 14px 40px rgba(0, 31, 98, 0.28);
        pointer-events: none;
      }

      .season-tooltip[hidden] {
        display: none;
      }

      .season-tooltip strong {
        display: block;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.98rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .season-tooltip span {
        display: block;
        margin-top: 0.15rem;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .season-month-list {
        display: none;
      }

      .season-month {
        margin-top: 0.9rem;
      }

      .season-month-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.8rem;
      }

      .season-month-head h3 {
        font-size: 1.25rem;
        text-transform: uppercase;
      }

      .season-month-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0;
        border-top: 1px solid var(--line);
      }

      .season-month-dot {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        border-radius: 5px;
      }

      .season-month-copy {
        flex: 1;
        min-width: 0;
      }

      .season-month-title {
        font-size: 0.98rem;
        font-weight: 800;
        line-height: 1.2;
      }

      .season-month-title a {
        color: var(--ink);
        text-decoration: none;
      }

      .season-month-detail {
        margin-top: 0.15rem;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .season-month-row[data-status="live"] .season-month-detail {
        color: #b78f00;
      }

      .season-month-folded {
        margin-top: 0.4rem;
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.5;
      }

      .is-calendar-target {
        outline: 3px solid var(--uci-yellow);
        outline-offset: 4px;
        transition: outline-color 0.6s ease;
      }

      @media (prefers-reduced-motion: reduce) {
        .season-bar-fill,
        .season-bar-label,
        .season-today-dot,
        .national-group-chevron {
          animation: none;
          transition: none;
        }
      }

      .card {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, white 0%, var(--panel-alt) 100%);
        box-shadow: 0 14px 40px rgba(0, 31, 98, 0.08);
      }

      .card::before {
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
        flex-wrap: wrap;
      }

      .rider-text {
        min-width: 0;
      }

      .country-flag {
        flex: 0 0 auto;
        font-size: 0.95em;
        line-height: 1;
      }

      .national-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .national-flag {
        flex: 0 0 auto;
        font-size: 1.5em;
        line-height: 1;
      }

      .standing-gap {
        flex: 0 0 auto;
        margin-left: 0.1rem;
        font-size: 0.92em;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        color: var(--muted);
      }

      /* A stage result's gap to the winner, shown beside the finishing time. */
      .standing-delta {
        flex: 0 0 auto;
        padding: 0.08rem 0.42rem;
        border-radius: 999px;
        background: rgba(0, 51, 160, 0.08);
        color: var(--uci-blue);
        font-size: 0.8em;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .stage-race-card {
        container-type: inline-size;
      }

      .gc-columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: start;
      }

      .jersey-holders {
        margin-top: 1rem;
        padding-top: 0.8rem;
        border-top: 1px dashed var(--line);
      }

      /* Beside the podium once the card can hold both: the swatch spans two lines,
         the classification above the name, so the column stays under 10rem wide. The
         query measures the card's content box, so 340px is a card about 390px wide;
         the phone-width single column stays stacked. */
      @container (min-width: 340px) {
        .gc-columns {
          grid-template-columns: minmax(0, 1fr) minmax(0, 9.75rem);
          column-gap: 0.8rem;
        }

        /* The podium's column is narrower here, so its riders flow inline too: the
           flag stays with the name and the time follows on the same line or the next. */
        .gc-columns .podium-rider {
          display: inline;
          line-height: 1.3;
        }

        .gc-columns .podium-rider .country-flag {
          margin-right: 0.35rem;
        }

        .gc-columns .podium-rider .standing-gap {
          margin-left: 0.4rem;
        }

        .gc-columns .jersey-holders {
          align-self: stretch;
          margin-top: 1rem;
          padding: 0 0 0 0.9rem;
          border-top: 0;
          border-left: 1px dashed var(--line);
        }

        .gc-columns .jersey-list {
          gap: 0.6rem;
        }

        .gc-columns .jersey-item {
          grid-template-columns: 1.4rem minmax(0, 1fr);
          grid-template-rows: auto auto;
          column-gap: 0.5rem;
          row-gap: 0.05rem;
        }

        .gc-columns .jersey-swatch {
          grid-row: 1 / span 2;
          width: 1.4rem;
          height: 1.4rem;
        }

        .gc-columns .jersey-classification {
          font-size: 0.66rem;
          line-height: 1.1;
        }

        .gc-columns .jersey-holder {
          font-size: 0.88rem;
          line-height: 1.2;
        }
      }

      /* A full-width card (a lone live race) would otherwise pin the narrow jersey
         column to its far edge with a gap between. Bound both columns and keep them
         together on the left, and give the jersey list its roomier one-row layout. */
      @container (min-width: 640px) {
        .gc-columns {
          grid-template-columns: minmax(0, 30rem) minmax(0, 22rem);
          justify-content: start;
          column-gap: 1.5rem;
        }

        .gc-columns .jersey-holders {
          padding-left: 1.5rem;
        }

        .gc-columns .jersey-list {
          gap: 0.5rem;
        }

        .gc-columns .jersey-item {
          grid-template-columns: 1.5rem 6.6rem minmax(0, 1fr);
          grid-template-rows: auto;
          column-gap: 0.6rem;
        }

        .gc-columns .jersey-swatch {
          grid-row: auto;
          width: 1.5rem;
          height: 1.5rem;
        }

        .gc-columns .jersey-classification {
          font-size: 0.8rem;
        }

        .gc-columns .jersey-holder {
          font-size: 0.98rem;
        }
      }

      .jersey-list {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.42rem;
      }

      .jersey-item {
        display: grid;
        grid-template-columns: 1.5rem 6.6rem minmax(0, 1fr);
        align-items: center;
        gap: 0.6rem;
      }

      .jersey-swatch {
        display: block;
        width: 1.5rem;
        height: 1.5rem;
      }

      .jersey-classification {
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        line-height: 1.15;
        text-transform: uppercase;
      }

      /* Inline flow rather than the flex row the podium uses: in a narrow column a flex
         flag would sit alone on its line while the name wraps beneath it. */
      .jersey-holder {
        display: inline;
        font-size: 0.98rem;
        font-weight: 700;
        line-height: 1.25;
      }

      .jersey-holder .country-flag {
        margin-right: 0.35rem;
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

      .stage-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        margin: 0.55rem 0 0.95rem;
      }

      .stage-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.85rem;
        height: 1.85rem;
        padding: 0 0.35rem;
        border: 1px solid var(--line-strong);
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.75);
        color: var(--uci-blue);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }

      .stage-chip:hover {
        border-color: var(--uci-blue-bright);
        background: rgba(0, 120, 199, 0.12);
      }

      .stage-chip:focus-visible {
        outline: 2px solid var(--uci-blue-bright);
        outline-offset: 2px;
      }

      .stage-chip.is-active {
        border-color: var(--uci-blue);
        background: var(--uci-blue);
        color: white;
      }

      /* A stage that has not been raced yet still occupies the strip, so the card
         shows the length of the race and never changes height as stages complete. */
      .stage-chip.is-upcoming {
        border-style: dashed;
        border-color: var(--line);
        background: transparent;
        color: rgba(9, 33, 76, 0.32);
        cursor: default;
      }

      .stage-panel-meta {
        margin: 0.3rem 0 0;
        color: rgba(9, 33, 76, 0.66);
        font-size: 0.86rem;
        line-height: 1.35;
      }

      .stage-panel[hidden] {
        display: none;
      }

      /* Tomorrow's stage: a selectable chip wearing a "next" tag in the live-race
         yellow, a one-line row above the strip that selects the same panel, and a
         preview panel that carries the course instead of a result. */
      .stage-chip.is-next {
        position: relative;
        border-style: solid;
        border-color: rgba(255, 204, 0, 0.95);
        background: rgba(255, 204, 0, 0.16);
        color: var(--uci-blue-deep);
      }

      .stage-chip.is-next:hover {
        border-color: rgba(255, 204, 0, 0.95);
        background: rgba(255, 204, 0, 0.32);
      }

      .stage-chip.is-next.is-active {
        border-color: var(--uci-blue);
        background: var(--uci-blue);
        color: white;
      }

      .stage-chip-next-tag {
        position: absolute;
        top: -0.55rem;
        right: -0.35rem;
        padding: 0.05rem 0.3rem;
        border-radius: 999px;
        background: #9b6500;
        color: white;
        font-size: 0.5rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        line-height: 1.2;
      }

      .stage-chip.is-next.is-active .stage-chip-next-tag {
        background: var(--uci-yellow);
        color: var(--uci-blue-deep);
      }

      .stage-next-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        margin: 0.55rem 0 0.2rem;
        padding: 0.45rem 0.7rem;
        border: 1px solid rgba(255, 204, 0, 0.9);
        border-radius: 10px;
        background: rgba(255, 204, 0, 0.14);
        color: var(--uci-blue-deep);
        font: 500 0.88rem "Manrope", "Segoe UI", sans-serif;
        text-align: left;
        cursor: pointer;
      }

      .stage-next-row:hover,
      .stage-next-row:focus-visible {
        background: rgba(255, 204, 0, 0.28);
        outline: none;
      }

      .stage-next-row.is-active {
        background: rgba(255, 204, 0, 0.32);
      }

      .stage-next-row-label {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-weight: 800;
        font-size: 0.72rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #9b6500;
      }

      .stage-next-row-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stage-next-row-arrow {
        margin-left: auto;
        font-weight: 800;
      }

      /* The news line at the foot of a race card: label, newest headline, arrow.
         Opens a short list in place; the group's coverage block stays the full
         reader. The headline runs on one line on a wide card and two on a phone. */
      .race-news {
        display: grid;
        gap: 0.5rem;
      }

      .race-news-ticker {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        margin: 0;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--line-strong);
        border-radius: 10px;
        background: rgba(0, 120, 199, 0.07);
        color: var(--ink);
        font-family: "Manrope", "Segoe UI", sans-serif;
        font-size: 0.95rem;
        line-height: 1.35;
        text-align: left;
        cursor: pointer;
      }

      .race-news-ticker:hover,
      .race-news-ticker:focus-visible {
        background: rgba(0, 120, 199, 0.14);
        outline: none;
      }

      .race-news-ticker[disabled] {
        cursor: default;
        color: var(--muted);
      }

      .race-news-ticker-label {
        flex: none;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--uci-blue-bright);
      }

      .race-news-ticker-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .race-news-ticker-text strong {
        font-weight: 700;
      }

      .race-news-ticker-arrow {
        margin-left: auto;
        font-weight: 800;
        color: var(--uci-blue);
      }

      .race-news-ticker[aria-expanded="true"] .race-news-ticker-arrow {
        transform: rotate(180deg);
      }

      .race-news-drawer {
        margin: 0;
        padding: 0.6rem 0.75rem 0.7rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.7);
      }

      .race-news-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
      }

      .race-news-list li {
        padding: 0.5rem 0;
        border-top: 1px solid var(--line);
      }

      .race-news-list li:first-child {
        padding-top: 0.1rem;
        border-top: 0;
      }

      .race-news-list a {
        display: grid;
        gap: 0.15rem;
        color: var(--ink);
        text-decoration: none;
      }

      .race-news-list a:hover .race-news-title {
        color: var(--uci-blue);
      }

      .race-news-source {
        color: var(--uci-blue-bright);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .race-news-title {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 1.02rem;
        font-weight: 700;
        line-height: 1.2;
      }

      @media (max-width: 720px) {
        .race-news-ticker {
          align-items: flex-start;
        }

        .race-news-ticker-label {
          padding-top: 0.2rem;
        }

        .race-news-ticker-text {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          white-space: normal;
        }
      }

      .stage-panel-next .stage-panel-meta {
        margin-bottom: 0.55rem;
      }

      .stage-panel-next-note {
        margin-top: 0.7rem;
      }

      .stage-profile {
        margin: 0 0 0.85rem;
        padding: 0.6rem 0.75rem 0.55rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(244, 248, 255, 0.92));
      }

      .stage-profile-canvas {
        position: relative;
      }

      .stage-profile-plot {
        position: relative;
      }

      /* A measured stage is a compact row by default: a thumbnail of the trace beside
         its caption. Expanding lays the caption over a tall chart with its axes, end
         markers and summit label, which stay hidden while compact. */
      .stage-profile.is-measured {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem 0.9rem;
      }

      .stage-profile.is-measured .stage-profile-canvas {
        flex: 0 0 8.5rem;
      }

      .stage-profile.is-measured .stage-profile-plot svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .stage-profile.is-measured .stage-profile-plot {
        height: 3rem;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid var(--line);
      }

      .stage-profile.is-measured .stage-profile-caption {
        flex: 1 1 14rem;
        margin-top: 0;
      }

      .stage-profile.is-measured .stage-profile-peak,
      .stage-profile.is-measured .stage-profile-gridlabel,
      .stage-profile.is-measured .stage-profile-gridline,
      .stage-profile.is-measured .stage-profile-tick,
      .stage-profile.is-measured .stage-profile-end {
        display: none;
      }

      .stage-profile.is-expanded {
        padding-bottom: 0.75rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(238, 243, 251, 0.95));
      }

      .stage-profile.is-expanded .stage-profile-canvas {
        order: 2;
        flex: 1 1 100%;
        padding: 1.5rem 0 1.7rem 3.1rem;
      }

      .stage-profile.is-expanded .stage-profile-plot {
        height: 15rem;
        overflow: visible;
        border-radius: 0;
        border: 0;
        border-bottom: 2px solid var(--uci-blue-deep);
        background: transparent;
      }

      .stage-profile.is-expanded .stage-profile-peak,
      .stage-profile.is-expanded .stage-profile-gridlabel,
      .stage-profile.is-expanded .stage-profile-tick,
      .stage-profile.is-expanded .stage-profile-end {
        display: block;
      }

      .stage-profile.is-expanded .stage-profile-gridline {
        display: inline;
      }

      .stage-profile.is-expanded .stage-profile-badge {
        top: 0.2rem;
        right: 0;
      }

      /* Axes come in a metric and an imperial set; the client stamps the preference on
         <html> and the matching set shows. Metric is the default when nothing is stamped. */
      .stage-profile.is-expanded [data-unit-system="imperial"] {
        display: none;
      }

      html[data-units="imperial"] .stage-profile.is-expanded [data-unit-system="metric"] {
        display: none;
      }

      html[data-units="imperial"] .stage-profile.is-expanded .stage-profile-gridlabel[data-unit-system="imperial"],
      html[data-units="imperial"] .stage-profile.is-expanded .stage-profile-tick[data-unit-system="imperial"] {
        display: block;
      }

      html[data-units="imperial"] .stage-profile.is-expanded .stage-profile-gridline[data-unit-system="imperial"] {
        display: inline;
      }

      .stage-profile-gridline {
        stroke: rgba(9, 33, 76, 0.16);
        stroke-width: 1;
        stroke-dasharray: 4 5;
        vector-effect: non-scaling-stroke;
      }

      .stage-profile-gridlabel {
        position: absolute;
        right: calc(100% + 0.45rem);
        transform: translateY(50%);
        color: rgba(9, 33, 76, 0.6);
        font-size: 0.72rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .stage-profile-tick {
        position: absolute;
        top: calc(100% + 0.35rem);
        transform: translateX(-50%);
        color: rgba(9, 33, 76, 0.6);
        font-size: 0.72rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .stage-profile-tick::before {
        content: "";
        position: absolute;
        left: 50%;
        top: -0.4rem;
        height: 0.3rem;
        border-left: 1px solid rgba(9, 33, 76, 0.4);
      }

      .stage-profile-end {
        position: absolute;
        top: calc(100% + 0.35rem);
        color: var(--uci-blue-deep);
        font-size: 0.78rem;
        line-height: 1.2;
        white-space: nowrap;
      }

      .stage-profile-end strong {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .stage-profile-end.is-start {
        left: 0;
      }

      .stage-profile-end.is-finish {
        right: 0;
        text-align: right;
      }

      .stage-profile-end-altitude {
        color: rgba(9, 33, 76, 0.6);
        font-size: 0.72rem;
      }

      .stage-profile-expand {
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
        background: rgba(255, 255, 255, 0.75);
        color: var(--uci-blue);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .stage-profile-expand:hover,
      .stage-profile-expand:focus-visible {
        border-color: var(--uci-blue-bright);
        background: rgba(0, 120, 199, 0.12);
        outline: none;
      }

      .stage-profile-expand::after {
        content: " ▾";
      }

      .stage-profile.is-expanded .stage-profile-expand::after {
        content: " ▴";
      }

      .stage-profile-canvas svg {
        display: block;
        width: 100%;
        height: 4.6rem;
      }

      .stage-profile-area {
        fill: rgba(0, 120, 199, 0.16);
        opacity: 0.9;
      }

      .stage-profile-line {
        fill: none;
        stroke: var(--uci-blue-deep);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }

      .stage-profile[data-stage-type="mountain"] .stage-profile-area {
        fill: rgba(0, 51, 160, 0.22);
      }

      .stage-profile[data-stage-type$="time-trial"] .stage-profile-line {
        stroke-dasharray: 7 5;
      }

      .stage-profile-peak {
        position: absolute;
        transform: translate(-50%, 0);
        margin-bottom: 0.2rem;
        padding: 0.08rem 0.4rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--line-strong);
        color: var(--uci-blue-deep);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        white-space: nowrap;
        pointer-events: none;
      }

      .stage-profile-badge {
        position: absolute;
        top: 0.15rem;
        right: 0.15rem;
        padding: 0.18rem 0.5rem;
        border-radius: 999px;
        background: var(--uci-blue);
        color: white;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.1em;
      }

      .stage-profile-caption {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem 0.95rem;
        margin-top: 0.45rem;
        font-size: 0.88rem;
      }

      /* A generic stage lays its pictogram beside the caption rather than above it, so
         it reads as an icon-and-label row and never as a chart. */
      .stage-profile.is-generic {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        border-style: dashed;
        background: rgba(244, 248, 255, 0.55);
      }

      .stage-profile.is-generic .stage-profile-caption {
        flex: 1;
        margin-top: 0;
      }

      .stage-profile-glyph {
        flex: 0 0 auto;
        width: 3.6rem;
        height: 1.9rem;
        padding: 0.15rem 0.2rem;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid var(--line);
      }

      .stage-profile-glyph svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .stage-profile-glyph-line {
        fill: none;
        stroke: var(--uci-blue);
        stroke-width: 2.2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }

      .stage-profile-glyph-line.is-dashed {
        stroke-dasharray: 5 4;
      }

      .stage-profile-glyph-fill {
        fill: rgba(0, 120, 199, 0.18);
      }

      .stage-profile-badge.is-inline {
        position: static;
      }

      .stage-profile-source {
        color: rgba(9, 33, 76, 0.6);
        font-size: 0.78rem;
      }

      .stage-profile-note {
        flex-basis: 100%;
        color: rgba(9, 33, 76, 0.6);
        font-size: 0.78rem;
        line-height: 1.3;
      }

      .stage-profile-type {
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--uci-blue-deep);
      }

      .stage-profile-stat {
        color: rgba(9, 33, 76, 0.8);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .unit-toggle {
        display: inline-flex;
        margin-left: auto;
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.75);
      }

      .unit-option {
        border: 0;
        padding: 0.2rem 0.55rem;
        background: transparent;
        color: var(--uci-blue);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        line-height: 1.2;
        cursor: pointer;
      }

      .unit-option:focus-visible {
        outline: 2px solid var(--uci-blue-bright);
        outline-offset: -2px;
      }

      .unit-option.is-active {
        background: var(--uci-blue);
        color: white;
      }

      .stage-results-button {
        width: 100%;
        margin-top: 0.9rem;
        min-height: 2.6rem;
        padding: 0.6rem 1rem;
        font-size: 0.86rem;
      }

      .load-coverage-button {
        min-height: 3.2rem;
        padding: 0.9rem 1.25rem;
        border-radius: 16px;
        border: 1px solid var(--line-strong);
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.1), rgba(0, 51, 160, 0.04));
        color: var(--uci-blue-deep);
        cursor: pointer;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .load-coverage-button:hover {
        background: linear-gradient(180deg, rgba(0, 120, 199, 0.16), rgba(0, 51, 160, 0.08));
      }

      .load-coverage-button.is-loading {
        opacity: 0.78;
        pointer-events: none;
      }

      .footer-note {
        margin-top: 1.2rem;
        padding: 0.95rem 1rem 0;
        color: rgba(9, 33, 76, 0.66);
        font-size: 0.9rem;
        text-align: center;
      }

      .footer-links {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.6rem;
        margin-top: 0.5rem;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .footer-links a {
        color: var(--uci-blue);
        text-decoration: none;
      }

      .footer-links a:hover {
        text-decoration: underline;
      }

      .footer-links span[aria-current],
      .footer-links-dot {
        color: var(--muted);
      }

      @media (max-width: 720px) {
        .page {
          width: min(100% - 1rem, 1120px);
          padding-top: 0.7rem;
        }

        /* A phone is too narrow for the expanded chart: the trace flattens and the
           start and finish towns run into the caption. Compact only; the client
           keeps the class off as well. */
        .stage-profile-expand {
          display: none;
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

      }

      @media (max-width: 960px) {
        .competition-grid-three {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .national-almanac-grid,
        .season-body {
          grid-template-columns: 1fr;
        }

        .national-results-head {
          flex-direction: column;
          align-items: flex-start;
        }

        .national-source-line {
          text-align: left;
        }
      }

      @media (max-width: 720px) {
        .competition-grid-three {
          grid-template-columns: 1fr;
        }

        .national-search-bar {
          grid-template-columns: 1fr;
        }

        .national-schedule-head,
        .season-head {
          flex-direction: column;
          align-items: flex-start;
        }

        .national-group-hint {
          margin-left: 0;
          flex-basis: 100%;
        }

        .season-full,
        .national-map {
          display: none;
        }

        .season-month-list {
          display: block;
        }
      }
    </style>
  </head>
  <body${shareView.jump ? ` data-jump-to="${escapeHtml(shareView.jump)}"` : ""}>
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

      ${seasonCalendarSection}
      ${competitionSections}
      ${nationalChampionshipsSection}
      ${deferredSectionButtons}
      ${deferredSectionMounts}

      <p class="footer-note">WorldTour data refreshes from live season pages when the server cache expires. National champions update from the current championship index.</p>
      ${buildSiteFooterLinks("/")}
    </main>
    <script>
      const deferredSectionState = new Map();
      const deferredGroups = ${deferredGroupClientPayload};

      function buildDeferredButtonMarkup(group, scrollOnLoad) {
        return '<button type="button" class="hero-menu-link deferred-load-button" data-deferred-group-id="' +
          group.id +
          '" data-scroll-on-load="' +
          (scrollOnLoad ? "true" : "false") +
          '">' +
          group.label +
          '</button>';
      }

      function buildDeferredContinuationMarkup(groups) {
        if (!groups.length) {
          return "";
        }

        return '<section class="section section-cta deferred-followup-cta">' +
          '<div class="section-head"><div><div class="section-tag">More Race Coverage</div><h2>Load More Racing</h2><p>Open the next race section only when you want it.</p></div></div>' +
          '<div class="deferred-button-row">' +
          groups.map((group) => buildDeferredButtonMarkup(group, true)).join("") +
          '</div></section>';
      }

      function buildDeferredLoadingMarkup(group) {
        return '<section class="section competition-section" id="' +
          group.id +
          '-loading">' +
          '<div class="section-head"><div><div class="section-tag">Loading</div><h2>' +
          group.label +
          '</h2><p>Fetching this section now. Race results and coverage will appear here shortly.</p></div></div>' +
          '</section>';
      }

      function updateDeferredContinuationSections() {
        deferredGroups.forEach((group, index) => {
          const mount = document.getElementById(group.id + "-mount");
          if (!mount || mount.hidden || !deferredSectionState.has(group.id)) {
            return;
          }

          const existingContinuation = mount.querySelector(".deferred-followup-cta");
          if (existingContinuation) {
            existingContinuation.remove();
          }

          const remainingGroups = deferredGroups.filter(
            (candidate, candidateIndex) => candidateIndex > index && !deferredSectionState.has(candidate.id),
          );
          if (!remainingGroups.length) {
            return;
          }

          mount.insertAdjacentHTML("beforeend", buildDeferredContinuationMarkup(remainingGroups));
        });
      }

      function bindNationalChampionshipFilters() {
        const root = document.querySelector("[data-national-almanac]");
        if (!root) {
          return;
        }
        const search = root.querySelector("[data-national-search]");
        const groups = Array.prototype.slice.call(root.querySelectorAll("[data-national-group]"));
        const chips = Array.prototype.slice.call(root.querySelectorAll("[data-national-category]"));
        const includeToggle = root.querySelector("[data-national-include-empty]");
        const emptyState = root.querySelector("[data-national-empty-state]");
        const state = { query: "", category: "", includeEmpty: false };

        const rowMatches = (row) => {
          const champions = row.dataset.champions || "";
          if (!state.includeEmpty && champions === "") {
            return false;
          }
          if (state.category && champions.split(" ").indexOf(state.category) < 0) {
            return false;
          }
          return !state.query || (row.dataset.search || "").indexOf(state.query) >= 0;
        };

        const applyFilters = () => {
          const filtering = Boolean(state.query || state.category);
          let totalVisible = 0;
          root.dataset.category = state.category;
          root.dataset.includeEmpty = state.includeEmpty ? "1" : "0";
          groups.forEach((group) => {
            const rows = Array.prototype.slice.call(group.querySelectorAll("[data-national-row]"));
            let visible = 0;
            rows.forEach((row) => {
              const show = rowMatches(row);
              row.hidden = !show;
              if (show) {
                visible += 1;
              }
            });
            totalVisible += visible;
            group.hidden = filtering && visible === 0;
            const counter = group.querySelector("[data-national-group-visible]");
            if (counter) {
              counter.textContent = filtering && visible > 0 ? " · " + visible + " match" + (visible === 1 ? "" : "es") : "";
            }
            if (state.query) {
              group.open = visible > 0;
            }
          });
          if (emptyState) {
            emptyState.hidden = totalVisible !== 0;
          }
        };

        if (search) {
          let lastQuery = "";
          search.addEventListener("input", () => {
            state.query = search.value.trim().toLowerCase();
            if (lastQuery && !state.query) {
              groups.forEach((group) => {
                group.open = false;
              });
            }
            lastQuery = state.query;
            applyFilters();
          });
        }
        chips.forEach((chip) => {
          chip.addEventListener("click", () => {
            state.category = chip.dataset.nationalCategory || "";
            chips.forEach((other) => {
              const active = other === chip;
              other.classList.toggle("is-active", active);
              other.setAttribute("aria-pressed", active ? "true" : "false");
            });
            applyFilters();
          });
        });
        if (includeToggle) {
          includeToggle.addEventListener("click", () => {
            state.includeEmpty = !state.includeEmpty;
            includeToggle.classList.toggle("is-active", state.includeEmpty);
            includeToggle.setAttribute("aria-pressed", state.includeEmpty ? "true" : "false");
            applyFilters();
          });
        }
        applyFilters();
      }

      // National Championships map: hovering a continent shows its count, clicking or
      // pressing Enter opens that continent's table below and marks it on the map. The
      // map is hidden on phones, where the grouped list stands on its own.
      function bindNationalChampionshipMap() {
        const root = document.querySelector("[data-national-almanac]");
        const map = root ? root.querySelector("[data-national-map]") : null;
        if (!root || !map) {
          return;
        }
        const tooltip = map.querySelector("[data-national-map-tooltip]");
        const continents = Array.prototype.slice.call(map.querySelectorAll("[data-national-map-continent]"));
        const groups = Array.prototype.slice.call(root.querySelectorAll("[data-national-group]"));

        const groupFor = (id) =>
          groups.find((group) => group.dataset.nationalGroupId === id) || null;

        const markActive = () => {
          continents.forEach((continent) => {
            const group = groupFor(continent.dataset.nationalMapContinent);
            continent.classList.toggle("is-active", Boolean(group && group.open && !group.hidden));
          });
        };

        const showTooltip = (continent, event) => {
          if (!tooltip) {
            return;
          }
          tooltip.textContent = "";
          const title = document.createElement("strong");
          title.textContent = continent.dataset.tipTitle || "";
          const detail = document.createElement("span");
          detail.textContent = continent.dataset.tipDetail || "";
          const hint = document.createElement("span");
          hint.textContent = "Click to open";
          tooltip.appendChild(title);
          tooltip.appendChild(detail);
          tooltip.appendChild(hint);
          tooltip.hidden = false;
          const mapBox = map.getBoundingClientRect();
          const tipBox = tooltip.getBoundingClientRect();
          let anchorX;
          let anchorY;
          if (event && typeof event.clientX === "number" && event.type !== "focus") {
            anchorX = event.clientX - mapBox.left;
            anchorY = event.clientY - mapBox.top;
          } else {
            const box = continent.getBoundingClientRect();
            anchorX = box.left - mapBox.left + box.width / 2;
            anchorY = box.top - mapBox.top + box.height / 2;
          }
          let left = anchorX - tipBox.width / 2;
          left = Math.max(8, Math.min(left, mapBox.width - tipBox.width - 8));
          let top = anchorY - tipBox.height - 16;
          if (top < 0) {
            top = anchorY + 20;
          }
          tooltip.style.left = left + "px";
          tooltip.style.top = top + "px";
        };
        const hideTooltip = () => {
          if (tooltip) {
            tooltip.hidden = true;
          }
        };

        const openContinent = (continent) => {
          const group = groupFor(continent.dataset.nationalMapContinent);
          if (!group) {
            return;
          }
          // Picking a continent on the map means "show me this one": any other open
          // group folds away so the chosen table sits directly under the map.
          groups.forEach((other) => {
            if (other !== group) {
              other.open = false;
            }
          });
          group.open = true;
          group.classList.add("is-map-target");
          window.setTimeout(() => {
            group.classList.remove("is-map-target");
          }, 2400);
          markActive();
          group.scrollIntoView({ behavior: "smooth", block: "start" });
        };

        continents.forEach((continent) => {
          continent.addEventListener("mouseenter", (event) => showTooltip(continent, event));
          continent.addEventListener("mousemove", (event) => showTooltip(continent, event));
          continent.addEventListener("mouseleave", hideTooltip);
          continent.addEventListener("focus", (event) => showTooltip(continent, event));
          continent.addEventListener("blur", hideTooltip);
          continent.addEventListener("click", () => openContinent(continent));
          continent.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openContinent(continent);
            }
          });
        });
        groups.forEach((group) => {
          group.addEventListener("toggle", markActive);
        });
        markActive();
      }

      // A share path such as /championships serves this same page with its own link
      // preview; once loaded it jumps to the section and settles on the /#section URL.
      // The calendar path is handled by bindSeasonCalendar, which opens the section.
      function bindShareJump() {
        const jump = document.body.dataset.jumpTo;
        if (!jump || jump === "season-calendar") {
          return;
        }
        const target = document.getElementById(jump);
        if (!target) {
          return;
        }
        window.history.replaceState(null, "", "/#" + jump);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Season calendar: hidden until the hero button or a #season-calendar link opens it,
      // so the day's results stay first. It closes from its own header, bars carry their
      // own tooltip, and a click on a race whose card is hidden behind "Load more races"
      // reveals it before the browser jumps.
      function bindSeasonCalendar() {
        const section = document.querySelector("[data-season-calendar]");
        if (!section) {
          return;
        }
        const tooltip = section.querySelector("[data-season-tooltip]");

        const openCalendar = () => {
          section.hidden = false;
          section.classList.add("is-expanded");
          if (window.location.hash !== "#season-calendar" || window.location.pathname !== "/") {
            window.history.replaceState(null, "", "/#season-calendar");
          }
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        const closeCalendar = () => {
          section.hidden = true;
          if (window.location.hash === "#season-calendar" || window.location.pathname !== "/") {
            window.history.replaceState(null, "", "/");
          }
        };

        Array.prototype.forEach.call(document.querySelectorAll("[data-season-open]"), (link) => {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            openCalendar();
          });
        });
        Array.prototype.forEach.call(section.querySelectorAll("[data-season-close]"), (button) => {
          button.addEventListener("click", closeCalendar);
        });
        window.addEventListener("hashchange", () => {
          if (window.location.hash === "#season-calendar") {
            openCalendar();
          }
        });
        if (window.location.hash === "#season-calendar" || document.body.dataset.jumpTo === "season-calendar") {
          openCalendar();
        }

        Array.prototype.forEach.call(section.querySelectorAll("[data-season-series]"), (chip) => {
          chip.addEventListener("click", () => {
            const wanted = chip.dataset.seasonSeries;
            Array.prototype.forEach.call(section.querySelectorAll("[data-season-series]"), (other) => {
              const active = other === chip;
              other.classList.toggle("is-active", active);
              other.setAttribute("aria-pressed", active ? "true" : "false");
            });
            Array.prototype.forEach.call(section.querySelectorAll("[data-season-view]"), (view) => {
              view.hidden = view.dataset.seasonView !== wanted;
            });
          });
        });

        const showTooltip = (bar) => {
          if (!tooltip) {
            return;
          }
          tooltip.textContent = "";
          const title = document.createElement("strong");
          title.textContent = bar.dataset.tipTitle || "";
          const dates = document.createElement("span");
          dates.textContent = bar.dataset.tipDates || "";
          const detail = document.createElement("span");
          detail.textContent = bar.dataset.tipDetail || "";
          tooltip.appendChild(title);
          tooltip.appendChild(dates);
          tooltip.appendChild(detail);
          tooltip.hidden = false;
          const sectionBox = section.getBoundingClientRect();
          const barBox = bar.getBoundingClientRect();
          const tipBox = tooltip.getBoundingClientRect();
          let left = barBox.left - sectionBox.left + barBox.width / 2 - tipBox.width / 2;
          left = Math.max(8, Math.min(left, sectionBox.width - tipBox.width - 8));
          let top = barBox.top - sectionBox.top - tipBox.height - 10;
          if (top < 0) {
            top = barBox.bottom - sectionBox.top + 10;
          }
          tooltip.style.left = left + "px";
          tooltip.style.top = top + "px";
        };
        const hideTooltip = () => {
          if (tooltip) {
            tooltip.hidden = true;
          }
        };
        Array.prototype.forEach.call(section.querySelectorAll("[data-season-bar]"), (bar) => {
          bar.addEventListener("mouseenter", () => showTooltip(bar));
          bar.addEventListener("mouseleave", hideTooltip);
          bar.addEventListener("focus", () => showTooltip(bar));
          bar.addEventListener("blur", hideTooltip);
        });

        section.addEventListener("click", (event) => {
          const link = event.target.closest("a[data-season-bar], a[data-season-race-link]");
          if (!link) {
            return;
          }
          const href = link.getAttribute("href") || "";
          if (href.charAt(0) !== "#") {
            return;
          }
          const target = document.getElementById(href.slice(1));
          if (!target) {
            return;
          }
          const hiddenSlot = target.closest("[data-recent-slot][hidden]");
          if (hiddenSlot) {
            const block = hiddenSlot.closest("[data-recent-block]");
            let guard = 0;
            while (hiddenSlot.hidden && block && guard < 12) {
              revealMoreRecentRaces(block.dataset.recentBlock);
              guard += 1;
            }
          }
          target.classList.add("is-calendar-target");
          window.setTimeout(() => {
            target.classList.remove("is-calendar-target");
          }, 2400);
        });
      }

      function getRecentBlock(groupId) {
        return document.querySelector('[data-recent-block="' + groupId + '"]');
      }

      function getRecentSlots(groupId) {
        const block = getRecentBlock(groupId);
        return block ? Array.prototype.slice.call(block.querySelectorAll("[data-recent-slot]")) : [];
      }

      function revealMoreRecentRaces(groupId) {
        const block = getRecentBlock(groupId);
        if (!block) {
          return;
        }
        const step = Number.parseInt(block.dataset.recentStep || "3", 10) || 3;
        const slots = getRecentSlots(groupId);
        const shown = slots.filter((slot) => !slot.hidden).length;
        const nextShown = Math.min(slots.length, shown + step);
        for (let index = shown; index < nextShown; index += 1) {
          slots[index].hidden = false;
        }

        const button = block.querySelector("[data-load-more-races]");
        if (button && nextShown >= slots.length) {
          button.hidden = true;
        }

      }

      // The news line on each race card. A pill rendered pending (no cached stories)
      // is filled from /api/race-news when it scrolls near the viewport or is tapped,
      // so a page of recent races loads its coverage a card at a time.
      function bindRaceNews() {
        const loading = new Set();

        function setRaceNewsOpen(block, open) {
          const button = block.querySelector("[data-race-news-toggle]");
          const drawer = block.querySelector(".race-news-drawer");
          if (button) {
            button.setAttribute("aria-expanded", open ? "true" : "false");
          }
          if (drawer) {
            drawer.hidden = !open;
          }
        }

        async function loadRaceNews(block, open) {
          const raceId = block.dataset.raceNews;
          if (!raceId || loading.has(raceId)) {
            return;
          }
          loading.add(raceId);
          try {
            const response = await fetch("/api/race-news?race=" + encodeURIComponent(raceId), { cache: "no-store" });
            if (!response.ok) {
              throw new Error("Unable to load race news");
            }
            const payload = await response.json();
            const holder = document.createElement("div");
            holder.innerHTML = payload.html || "";
            const fresh = holder.firstElementChild;
            if (!fresh || !fresh.matches("[data-race-news]")) {
              throw new Error("Unexpected race news markup");
            }
            const button = block.querySelector("[data-race-news-toggle]");
            setRaceNewsOpen(fresh, open || Boolean(button && button.getAttribute("aria-expanded") === "true"));
            block.replaceWith(fresh);
          } catch (error) {
            block.dataset.raceNewsState = "error";
            const text = block.querySelector(".race-news-ticker-text");
            if (text) {
              text.textContent = "Coverage is unavailable right now. Tap to try again.";
            }
          } finally {
            loading.delete(raceId);
          }
        }

        document.addEventListener("click", (event) => {
          const toggle = event.target.closest("[data-race-news-toggle]");
          if (toggle) {
            const block = toggle.closest("[data-race-news]");
            if (!block) {
              return;
            }
            const open = toggle.getAttribute("aria-expanded") !== "true";
            setRaceNewsOpen(block, open);
            const state = block.dataset.raceNewsState;
            if (state === "pending" || state === "error") {
              loadRaceNews(block, open);
            }
          }
        });

        if (!("IntersectionObserver" in window)) {
          return;
        }
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) {
                return;
              }
              observer.unobserve(entry.target);
              if (entry.target.dataset.raceNewsState === "pending") {
                loadRaceNews(entry.target, false);
              }
            });
          },
          { rootMargin: "240px 0px" },
        );
        const watch = (root) => {
          root.querySelectorAll('[data-race-news][data-race-news-state="pending"]').forEach((block) => observer.observe(block));
        };
        watch(document);
        new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            Array.from(mutation.addedNodes).forEach((node) => {
              if (node.nodeType === 1) {
                watch(node);
              }
            });
          });
        }).observe(document.body, { childList: true, subtree: true });
      }

      function bindLoadMoreRaces(root = document) {
        root.querySelectorAll("[data-load-more-races]").forEach((button) => {
          if (button.dataset.bound === "true") {
            return;
          }
          button.dataset.bound = "true";
          button.addEventListener("click", () => {
            revealMoreRecentRaces(button.dataset.loadMoreRaces);
          });
        });
      }

      async function loadDeferredSection(groupId, options = {}) {
        const mount = document.getElementById(groupId + "-mount");
        if (!mount) {
          return;
        }
        const group = deferredGroups.find((entry) => entry.id === groupId);
        if (!group) {
          return;
        }

        const buttons = document.querySelectorAll('[data-deferred-group-id="' + groupId + '"]');
        buttons.forEach((button) => button.classList.add("is-loading"));

        mount.hidden = false;
        mount.innerHTML = buildDeferredLoadingMarkup(group);
        if (options.scrollOnLoad) {
          mount.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        try {
          const params = new URLSearchParams({ group: groupId });
          if (options.selectedRaceId) {
            params.set(groupId + "-race", options.selectedRaceId);
          }
          if (Number.isFinite(options.refreshToken)) {
            params.set(groupId + "-refresh", String(options.refreshToken));
          }

          const response = await fetch("/api/competition-section?" + params.toString(), { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Unable to load section");
          }

          const payload = await response.json();
          mount.innerHTML = payload.html || "";
          mount.hidden = false;
          deferredSectionState.set(groupId, true);
          updateDeferredContinuationSections();

          if (options.scrollOnLoad && options.scrollAfterLoad !== false) {
            const section = mount.querySelector("#" + groupId);
            section?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch (error) {
          mount.hidden = false;
          mount.innerHTML = '<section class="section competition-section"><div class="section-head"><div><div class="section-tag">Load failed</div><h2>Unable to load this section</h2><p>Please try again in a moment.</p></div></div></section>';
        } finally {
          buttons.forEach((button) => button.classList.remove("is-loading"));
        }
      }

      document.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-load-stage-results]");
        if (!button) {
          return;
        }

        const switcher = button.closest("[data-stage-switcher]");
        button.classList.add("is-loading");
        button.textContent = "Loading stage results…";

        try {
          const params = new URLSearchParams({ race: button.dataset.loadStageResults });
          const result = await fetch("/api/race-stages?" + params.toString(), { cache: "no-store" });
          if (!result.ok) {
            throw new Error("Unable to load stage results");
          }

          const payload = await result.json();
          switcher.outerHTML = payload.html || switcher.outerHTML;
        } catch (error) {
          button.classList.remove("is-loading");
          button.textContent = "Stage results unavailable — try again";
        }
      });

      // Delegated so stage strips inside deferred sections work without rebinding.
      document.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-stage-target]");
        const switcher = chip ? chip.closest("[data-stage-switcher]") : null;
        if (!switcher) {
          return;
        }

        const target = chip.dataset.stageTarget;
        switcher.querySelectorAll("[data-stage-target]").forEach((control) => {
          const isActive = control.dataset.stageTarget === target;
          control.classList.toggle("is-active", isActive);
          if (control.getAttribute("role") === "tab") {
            control.setAttribute("aria-selected", isActive ? "true" : "false");
          }
        });
        switcher.querySelectorAll("[data-stage-panel]").forEach((panel) => {
          panel.hidden = panel.id !== target;
        });
      });

      document.addEventListener("click", (event) => {
        const button = event.target.closest(".deferred-load-button");
        if (!button) {
          return;
        }

        const groupId = button.dataset.deferredGroupId;
        const scrollOnLoad = button.dataset.scrollOnLoad === "true";

        if (deferredSectionState.has(groupId)) {
          if (scrollOnLoad) {
            document.getElementById(groupId)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }

        loadDeferredSection(groupId, { scrollOnLoad });
      });

      // Stage distances and climbing render in metric; the choice is kept per browser so
      // a reader who picks miles once keeps miles on every card and every visit.
      const UNIT_PREFERENCE_KEY = "pcr-units";

      function readUnitPreference() {
        try {
          return window.localStorage.getItem(UNIT_PREFERENCE_KEY) === "imperial" ? "imperial" : "metric";
        } catch (error) {
          return "metric";
        }
      }

      function applyUnitPreference(units) {
        document.documentElement.setAttribute("data-units", units);
        document.querySelectorAll("[data-unit-metric]").forEach((element) => {
          element.textContent = units === "imperial" ? element.dataset.unitImperial : element.dataset.unitMetric;
        });
        document.querySelectorAll("[data-unit-option]").forEach((button) => {
          const isActive = button.dataset.unitOption === units;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-unit-option]");
        if (!button) {
          return;
        }

        try {
          window.localStorage.setItem(UNIT_PREFERENCE_KEY, button.dataset.unitOption);
        } catch (error) {
          // Private mode or blocked storage: the toggle still works for this page view.
        }
        applyUnitPreference(button.dataset.unitOption);
      });

      // Measured profiles open compact; expanding one expands them all, and the choice
      // is kept the same way the units are. Phones stay compact whatever is stored:
      // the expanded chart needs more width than they have, so the control is hidden
      // there and the class is never applied. The stored choice survives a rotation.
      const PROFILE_VIEW_KEY = "pcr-profile-view";
      const narrowViewport = window.matchMedia("(max-width: 720px)");

      function readProfileView() {
        try {
          return window.localStorage.getItem(PROFILE_VIEW_KEY) === "expanded" ? "expanded" : "compact";
        } catch (error) {
          return "compact";
        }
      }

      function applyProfileView(view) {
        const expanded = view === "expanded" && !narrowViewport.matches;
        document.querySelectorAll(".stage-profile.is-measured").forEach((figure) => {
          figure.classList.toggle("is-expanded", expanded);
          const button = figure.querySelector("[data-profile-toggle]");
          if (button) {
            button.setAttribute("aria-expanded", expanded ? "true" : "false");
            button.textContent = expanded ? "Collapse profile" : "Expand profile";
          }
        });
      }

      document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-profile-toggle]");
        if (!button) {
          return;
        }

        const view = button.getAttribute("aria-expanded") === "true" ? "compact" : "expanded";
        try {
          window.localStorage.setItem(PROFILE_VIEW_KEY, view);
        } catch (error) {
          // Storage blocked: the toggle still works for this page view.
        }
        applyProfileView(view);
      });

      // Markup that arrives later (deeper stage results, more races, deferred sections)
      // is rendered in metric and compact, so re-apply both preferences whenever
      // elements land. Text swaps add only text nodes, which the element check
      // ignores, so this cannot loop.
      new MutationObserver((mutations) => {
        const landed = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === 1 && (node.matches("[data-unit-metric]") || node.querySelector("[data-unit-metric]")),
          ),
        );
        if (landed) {
          applyUnitPreference(readUnitPreference());
          applyProfileView(readProfileView());
        }
      }).observe(document.body, { childList: true, subtree: true });
      applyUnitPreference(readUnitPreference());
      applyProfileView(readProfileView());
      narrowViewport.addEventListener("change", () => applyProfileView(readProfileView()));

      bindLoadMoreRaces();
      bindRaceNews();
      bindNationalChampionshipFilters();
      bindNationalChampionshipMap();
      bindSeasonCalendar();
      bindShareJump();
    </script>
  </body>
</html>`;
}

function buildWarmupPage(shareView = SHARE_VIEWS["/"]) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/assets/favicon.svg?v=2" type="image/svg+xml" />
    <title>${escapeHtml(shareView.title)}</title>
    ${buildShareMetaTags(shareView)}
    ${UMAMI_ANALYTICS_SCRIPT}
    <style>
      :root {
        --bg-top: #f7efe1;
        --bg-bottom: #dbeaf8;
        --card: rgba(255, 255, 255, 0.86);
        --ink: #0b2347;
        --muted: rgba(11, 35, 71, 0.72);
        --blue: #0b5fcc;
        --blue-deep: #083a84;
        --line: rgba(11, 35, 71, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Manrope", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.85), transparent 34%),
          linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
      }

      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .panel {
        width: min(100%, 42rem);
        padding: 2rem 1.4rem;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--card);
        box-shadow: 0 24px 60px rgba(8, 34, 74, 0.12);
        text-align: center;
      }

      .eyebrow {
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--blue);
      }

      h1 {
        margin: 0.6rem 0 0;
        font-size: clamp(2.2rem, 8vw, 4rem);
        line-height: 0.95;
        text-transform: uppercase;
      }

      p {
        margin: 1rem auto 0;
        max-width: 33rem;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.55;
      }

      .loader {
        display: inline-flex;
        gap: 0.45rem;
        margin-top: 1.4rem;
        align-items: center;
        justify-content: center;
      }

      .loader span {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        background: linear-gradient(180deg, var(--blue) 0%, var(--blue-deep) 100%);
        animation: pulse 1.2s infinite ease-in-out;
      }

      .loader span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .loader span:nth-child(3) {
        animation-delay: 0.3s;
      }

      .status {
        margin-top: 1.2rem;
        font-size: 0.92rem;
        color: var(--muted);
      }

      @keyframes pulse {
        0%, 80%, 100% {
          transform: scale(0.75);
          opacity: 0.45;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <div class="eyebrow">Live Race Desk</div>
        <h1>Pro Cycling Results</h1>
        <p>Loading today’s live race data. First load can take a few seconds during active stage races while we warm up results from current season and race sources.</p>
        <div class="loader" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="status" id="warmup-status">Checking for fresh race data…</div>
      </section>
    </main>
    <script>
      const statusNode = document.getElementById("warmup-status");

      async function pollRaceData() {
        try {
          const response = await fetch("/api/homepage-data", { cache: "no-store" });
          if (response.ok) {
            window.location.reload();
            return;
          }

          if (response.status === 202) {
            statusNode.textContent = "Still warming live data. This page will update automatically.";
          } else {
            statusNode.textContent = "Live data is taking longer than usual. Retrying automatically.";
          }
        } catch {
          statusNode.textContent = "Waiting for live data sources. Retrying automatically.";
        }

        window.setTimeout(pollRaceData, 1500);
      }

      window.setTimeout(pollRaceData, 900);
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Editable site pages: release notes and about.
//
// The copy lives in data/*.md and is committed with the code. The maintainer can edit
// it in place on the live page: a POST to /api/site-content, authorised by
// SITE_EDIT_TOKEN, writes the file on the server and, when GITHUB_CONTENT_TOKEN is
// set, commits it to the repo so the next deploy carries it. Without the GitHub token
// an edit lives only until the next deploy, and the response says so.

const SITE_CONTENT_PAGES = {
  "release-notes": {
    file: "release-notes.md",
    title: "Release Notes",
    tag: "What changed",
    path: "/release-notes",
    description: "Every change to Pro Cycling Results in plain language, newest first, dated by the day it went live.",
  },
  about: {
    file: "about.md",
    title: "About",
    tag: "Who makes this",
    path: "/about",
    description: "Who makes Pro Cycling Results: the Grupetto Committee, purely for the love of the sport, free for all to use and enjoy.",
  },
};
const SITE_ORIGIN = "https://procyclingresults.up.railway.app";
// Link previews. A URL fragment never reaches the server, so /#season-calendar and /
// look identical to a crawler; these share paths serve the same results page with a
// different preview image and a jump to the section once the page loads.
const SHARE_VIEWS = {
  "/": {
    path: "/",
    title: "Pro Cycling Results",
    description: "Race results, the season calendar, finish videos, stage profiles, race news and national champions for the 2026 men's and women's UCI WorldTour.",
    image: "/assets/og-default.jpg",
    alt: "Pro Cycling Results, with a Vuelta a España stage profile rising across the image",
    jump: "",
  },
  "/calendar": {
    path: "/calendar",
    title: "Season Calendar · Pro Cycling Results",
    description: "Every men's and women's WorldTour race of 2026 on one timeline, drawn to scale, with today's stage filling in.",
    image: "/assets/og-calendar.jpg",
    alt: "The 2026 WorldTour season drawn as a timeline",
    jump: "season-calendar",
  },
  "/championships": {
    path: "/championships",
    title: "National Championships · Pro Cycling Results",
    description: "Every elite road champion by federation, on a world map shaded by this season's results.",
    image: "/assets/og-championships.jpg",
    alt: "A world map of national championship federations shaded by this season's results",
    jump: "national-championships",
  },
};
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

function getShareView(pathname) {
  return Object.prototype.hasOwnProperty.call(SHARE_VIEWS, pathname) ? SHARE_VIEWS[pathname] : null;
}

function buildShareMetaTags(view) {
  const url = SITE_ORIGIN + view.path;
  const image = SITE_ORIGIN + view.image;
  return `<meta name="description" content="${escapeHtml(view.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pro Cycling Results" />
    <meta property="og:title" content="${escapeHtml(view.title)}" />
    <meta property="og:description" content="${escapeHtml(view.description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta property="og:image:alt" content="${escapeHtml(view.alt || view.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(view.title)}" />
    <meta name="twitter:description" content="${escapeHtml(view.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`;
}
const SITE_CONTENT_MAX_BYTES = 256 * 1024;
const SITE_EDIT_TOKEN = process.env.SITE_EDIT_TOKEN || "";
const GITHUB_CONTENT_TOKEN = process.env.GITHUB_CONTENT_TOKEN || "";
const GITHUB_CONTENT_REPO = process.env.GITHUB_CONTENT_REPO || "streamrD/ProCyclingResults";
const GITHUB_CONTENT_BRANCH = process.env.GITHUB_CONTENT_BRANCH || "main";

// Resolved lazily: the test harness runs this file in a VM without __dirname.
function getSiteContentDir() {
  return path.join(typeof __dirname === "string" ? __dirname : process.cwd(), "data");
}

function getSiteContentPage(pageId) {
  return Object.prototype.hasOwnProperty.call(SITE_CONTENT_PAGES, pageId) ? SITE_CONTENT_PAGES[pageId] : null;
}

function findSiteContentPageByPath(pathname) {
  return Object.keys(SITE_CONTENT_PAGES).find((pageId) => SITE_CONTENT_PAGES[pageId].path === pathname) || "";
}

// A deliberately small Markdown subset: headings, paragraphs, bullet lists, rules,
// bold, italics, inline code and http(s) or site-relative links. Everything is HTML
// escaped first, so the editor can never inject markup.
function renderMarkdownInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g, (match, label, href) => {
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${label}</a>`;
  });
  return html;
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderMarkdownInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`<ul>${list.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join("")}</ul>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 1;
      out.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      flushParagraph();
      flushList();
      out.push("<hr />");
      continue;
    }
    const lead = line.match(/^>\s+(.+)$/);
    if (lead) {
      flushParagraph();
      flushList();
      out.push(`<p class="site-lead">${renderMarkdownInline(lead[1])}</p>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list = list || [];
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}

async function readSiteContent(pageId) {
  const page = getSiteContentPage(pageId);
  if (!page) {
    return "";
  }
  try {
    return await fs.readFile(path.join(getSiteContentDir(), page.file), "utf8");
  } catch (error) {
    return "";
  }
}

async function writeSiteContent(pageId, markdown) {
  const page = getSiteContentPage(pageId);
  if (!page) {
    throw new Error("Unknown site page.");
  }
  await fs.writeFile(path.join(getSiteContentDir(), page.file), markdown, "utf8");
}

function isAuthorizedSiteEdit(authorizationHeader, expectedToken = SITE_EDIT_TOKEN) {
  if (!expectedToken) {
    return false;
  }
  const match = /^Bearer\s+(.+)$/i.exec(String(authorizationHeader || "").trim());
  if (!match) {
    return false;
  }
  // Hashing first keeps the comparison constant-time regardless of length and avoids
  // relying on the Buffer global, which the test harness's VM does not provide.
  const provided = crypto.createHash("sha256").update(match[1], "utf8").digest();
  const expected = crypto.createHash("sha256").update(expectedToken, "utf8").digest();
  return crypto.timingSafeEqual(provided, expected);
}

async function commitSiteContentToGitHub(pageId, markdown) {
  const page = getSiteContentPage(pageId);
  if (!GITHUB_CONTENT_TOKEN || !page) {
    return { committed: false, reason: "GitHub commits are not configured on this server." };
  }
  const apiUrl = `https://api.github.com/repos/${GITHUB_CONTENT_REPO}/contents/data/${page.file}`;
  const headers = {
    authorization: `Bearer ${GITHUB_CONTENT_TOKEN}`,
    accept: "application/vnd.github+json",
    "user-agent": "ProCyclingResults site editor",
    "x-github-api-version": "2022-11-28",
  };
  const readSha = async () => {
    const current = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_CONTENT_BRANCH)}`, {
      headers: { ...headers, "cache-control": "no-cache" },
      signal: AbortSignal.timeout(10000),
    });
    if (current.ok) {
      return { sha: (await current.json())?.sha || "" };
    }
    if (current.status === 404) {
      return { sha: "" };
    }
    return { error: `GitHub lookup failed (${current.status}).` };
  };
  const putContent = async (sha) =>
    fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        message: `Update ${page.title} from the site editor`,
        content: Buffer.from(markdown, "utf8").toString("base64"),
        branch: GITHUB_CONTENT_BRANCH,
        ...(sha ? { sha } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });

  // A 409 means the file's version moved between the read and the write — typically a
  // save landing seconds after another one — so re-read the version and try once more.
  let result;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const lookup = await readSha();
    if (lookup.error) {
      return { committed: false, reason: lookup.error };
    }
    result = await putContent(lookup.sha);
    if (result.status !== 409) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (!result.ok) {
    return { committed: false, reason: `GitHub commit failed (${result.status}).` };
  }
  const payload = await result.json();
  return { committed: true, commitUrl: payload?.commit?.html_url || "" };
}

function readRequestBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function handleSiteContentUpdate(request, response) {
  if (!isAuthorizedSiteEdit(request.headers.authorization)) {
    sendJson(response, SITE_EDIT_TOKEN ? 401 : 403, {
      ok: false,
      error: SITE_EDIT_TOKEN ? "That edit key was not accepted." : "Editing is not enabled on this server.",
    });
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request, SITE_CONTENT_MAX_BYTES));
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "The edit could not be read." });
    return;
  }
  const pageId = typeof payload?.page === "string" ? payload.page : "";
  const page = getSiteContentPage(pageId);
  const markdown = typeof payload?.markdown === "string" ? payload.markdown.replace(/\r\n?/g, "\n") : null;
  if (!page || markdown === null) {
    sendJson(response, 400, { ok: false, error: "Unknown page or missing text." });
    return;
  }
  const normalized = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  await writeSiteContent(pageId, normalized);
  let commit;
  try {
    commit = await commitSiteContentToGitHub(pageId, normalized);
  } catch (error) {
    commit = { committed: false, reason: `GitHub commit failed: ${error.message}` };
  }
  sendJson(response, 200, {
    ok: true,
    html: renderMarkdown(normalized),
    committed: commit.committed,
    commitUrl: commit.commitUrl || "",
    note: commit.committed
      ? "Saved and committed to GitHub. The next deploy will carry it."
      : `Saved on this server only. ${commit.reason} The change will not survive the next deploy.`,
  });
}

function buildSiteFooterLinks(currentPath) {
  const links = [{ href: "/", label: "Results" }, ...Object.values(SITE_CONTENT_PAGES).map((page) => ({ href: page.path, label: page.title }))];
  return `<nav class="footer-links" aria-label="Site pages">${links
    .map((link) =>
      link.href === currentPath
        ? `<span aria-current="page">${escapeHtml(link.label)}</span>`
        : `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`,
    )
    .join('<span class="footer-links-dot" aria-hidden="true">·</span>')}</nav>`;
}

function buildSiteContentPage(pageId, markdown, options = {}) {
  const page = getSiteContentPage(pageId);
  if (!page) {
    return "";
  }
  const editable = options.editable === undefined ? Boolean(SITE_EDIT_TOKEN) : Boolean(options.editable);
  const editorMarkup = editable
    ? `
      <div class="site-edit-bar">
        <button type="button" class="site-edit-button" data-site-edit>Edit this page</button>
        <p class="meta site-edit-status" data-site-status aria-live="polite"></p>
      </div>
      <div class="site-editor" data-site-editor data-site-page="${escapeHtml(pageId)}" hidden>
        <label class="site-editor-label" for="site-editor-text">Markdown for ${escapeHtml(page.title)}</label>
        <textarea id="site-editor-text" class="site-editor-text" spellcheck="true">${escapeHtml(markdown)}</textarea>
        <p class="meta">Headings with #, bullets with -, a lead paragraph with &gt;, **bold**, *italics* and [links](https://…) are supported. Saving publishes immediately.</p>
        <div class="site-editor-actions">
          <button type="button" class="site-edit-button is-primary" data-site-save>Save</button>
          <button type="button" class="site-edit-button" data-site-cancel>Cancel</button>
        </div>
      </div>`
    : "";
  const editorScript = editable
    ? `
    <script>
      (function () {
        var editor = document.querySelector("[data-site-editor]");
        var prose = document.querySelector("[data-site-prose]");
        var editButton = document.querySelector("[data-site-edit]");
        var status = document.querySelector("[data-site-status]");
        if (!editor || !prose || !editButton) {
          return;
        }
        var textarea = editor.querySelector("textarea");
        var saveButton = editor.querySelector("[data-site-save]");
        var cancelButton = editor.querySelector("[data-site-cancel]");
        var page = editor.getAttribute("data-site-page");
        var original = textarea.value;
        var KEY = "pcr-edit-key";

        function readKey(force) {
          var key = "";
          try {
            key = window.localStorage.getItem(KEY) || "";
          } catch (error) {
            key = "";
          }
          if (!key || force) {
            key = window.prompt("Enter the edit key for this site") || "";
            try {
              if (key) {
                window.localStorage.setItem(KEY, key);
              }
            } catch (error) {
              // Private mode: the key lives for this page only.
            }
          }
          return key;
        }

        function forgetKey() {
          try {
            window.localStorage.removeItem(KEY);
          } catch (error) {
            // Nothing to forget.
          }
        }

        function setStatus(text) {
          if (status) {
            status.textContent = text;
          }
        }

        function openEditor() {
          editor.hidden = false;
          editButton.hidden = true;
          textarea.focus();
        }

        function closeEditor() {
          editor.hidden = true;
          editButton.hidden = false;
        }

        editButton.addEventListener("click", function () {
          if (!readKey(false)) {
            return;
          }
          openEditor();
        });

        cancelButton.addEventListener("click", function () {
          textarea.value = original;
          closeEditor();
          setStatus("");
        });

        saveButton.addEventListener("click", function () {
          var key = readKey(false);
          if (!key) {
            return;
          }
          saveButton.disabled = true;
          setStatus("Saving…");
          fetch("/api/site-content", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer " + key },
            body: JSON.stringify({ page: page, markdown: textarea.value }),
          })
            .then(function (response) {
              return response.json().then(function (body) {
                return { status: response.status, body: body };
              });
            })
            .then(function (result) {
              saveButton.disabled = false;
              if (result.status === 401) {
                forgetKey();
                setStatus("That edit key was not accepted. Click Save to enter it again.");
                return;
              }
              if (!result.body || !result.body.ok) {
                setStatus((result.body && result.body.error) || "The edit could not be saved.");
                return;
              }
              prose.innerHTML = result.body.html;
              original = textarea.value;
              closeEditor();
              setStatus(result.body.note || "Saved.");
            })
            .catch(function () {
              saveButton.disabled = false;
              setStatus("The edit could not be saved. Check the connection and try again.");
            });
        });
      })();
    </script>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/assets/favicon.svg?v=2" type="image/svg+xml" />
    <title>${escapeHtml(page.title)} · Pro Cycling Results</title>
    ${buildShareMetaTags({ path: page.path, title: `${page.title} · Pro Cycling Results`, description: page.description, image: SHARE_VIEWS["/"].image, alt: SHARE_VIEWS["/"].alt })}
    <link rel="canonical" href="${escapeHtml(SITE_ORIGIN + page.path)}" />
    ${UMAMI_ANALYTICS_SCRIPT}
    <style>
      @font-face { font-family: "Manrope"; font-style: normal; font-weight: 500; font-display: swap; src: url("/assets/fonts/manrope-500.ttf") format("truetype"); }
      @font-face { font-family: "Manrope"; font-style: normal; font-weight: 700; font-display: swap; src: url("/assets/fonts/manrope-700.ttf") format("truetype"); }
      @font-face { font-family: "Manrope"; font-style: normal; font-weight: 800; font-display: swap; src: url("/assets/fonts/manrope-800.ttf") format("truetype"); }
      @font-face { font-family: "Barlow Semi Condensed"; font-style: normal; font-weight: 700; font-display: swap; src: url("/assets/fonts/barlow-semi-condensed-700.ttf") format("truetype"); }
      @font-face { font-family: "Barlow Semi Condensed"; font-style: normal; font-weight: 800; font-display: swap; src: url("/assets/fonts/barlow-semi-condensed-800.ttf") format("truetype"); }
      :root {
        --uci-blue: #0033a0;
        --uci-blue-bright: #0078c7;
        --uci-blue-deep: #00184d;
        --uci-yellow: #ffcc00;
        --uci-red: #ef3340;
        --bg: #eef3fb;
        --ink: #09214c;
        --muted: #4f6188;
        --line: rgba(0, 51, 160, 0.12);
        --line-strong: rgba(0, 51, 160, 0.22);
        --shadow: 0 22px 60px rgba(0, 31, 98, 0.12);
        --shadow-strong: 0 32px 90px rgba(0, 31, 98, 0.18);
        --rainbow: linear-gradient(90deg, #00a651 0%, #00a651 20%, #005bbb 20%, #005bbb 40%, #ef3340 40%, #ef3340 60%, #111111 60%, #111111 80%, #ffcc00 80%, #ffcc00 100%);
      }
      * { box-sizing: border-box; }
      html { background: var(--uci-blue-deep); }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(0, 120, 199, 0.24), transparent 24%),
          radial-gradient(circle at 85% 12%, rgba(255, 204, 0, 0.22), transparent 18%),
          linear-gradient(180deg, #f7faff 0%, var(--bg) 52%, #e6eefb 100%);
        font-family: "Manrope", "Segoe UI", sans-serif;
        line-height: 1.55;
      }
      .page { width: min(880px, calc(100% - 2rem)); margin: 0 auto; padding: 1.25rem 0 3rem; }
      h1, h2, h3, h4 { margin: 0; line-height: 0.96; font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-weight: 800; letter-spacing: -0.02em; }
      .hero {
        position: relative;
        overflow: hidden;
        padding: 1.6rem 2rem 1.8rem;
        border-radius: 34px;
        color: white;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 42%), linear-gradient(160deg, var(--uci-blue-deep) 0%, var(--uci-blue) 58%, var(--uci-blue-bright) 100%);
        box-shadow: var(--shadow-strong);
      }
      .hero::after { content: ""; position: absolute; left: 2rem; right: 2rem; bottom: 0; height: 6px; border-radius: 999px 999px 0 0; background: var(--rainbow); }
      .hero-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
      .eyebrow, .section-tag, .hero-back {
        display: inline-flex; align-items: center; gap: 0.5rem;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      }
      .eyebrow { padding: 0.45rem 0.8rem; border-radius: 999px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.18); color: white; font-size: 0.78rem; }
      .hero-back { color: white; font-size: 0.8rem; text-decoration: none; opacity: 0.85; }
      .hero-back:hover { opacity: 1; }
      .hero h1 { margin-top: 1rem; font-size: clamp(2.6rem, 7vw, 4.4rem); text-transform: uppercase; }
      .hero p { margin: 0.8rem 0 0; max-width: 40rem; color: rgba(255, 255, 255, 0.82); font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-size: 1rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .section {
        position: relative; margin-top: 1.25rem; padding: 1.6rem 1.8rem; overflow: hidden;
        border: 1px solid var(--line); border-radius: 28px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(244, 248, 255, 0.92)); box-shadow: var(--shadow);
      }
      .section::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: linear-gradient(180deg, var(--uci-blue-bright), var(--uci-blue)); }
      .site-prose { font-size: 1.02rem; }
      .site-prose > :first-child { margin-top: 0; }
      .site-prose h2 { margin-top: 1.8rem; font-size: 2rem; text-transform: uppercase; }
      .site-prose h3 { margin-top: 1.6rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--uci-blue); font-size: 1.35rem; text-transform: uppercase; }
      .site-prose h4 { margin-top: 1.2rem; font-size: 1.1rem; }
      .site-prose p { margin: 0.8rem 0 0; }
      .site-prose .site-lead { margin: 0; font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; color: var(--uci-blue-deep); text-wrap: balance; }
      .site-prose .site-lead + p { margin-top: 1.2rem; }
      .site-prose ul { margin: 0.6rem 0 0; padding-left: 1.2rem; }
      .site-prose li { margin-top: 0.45rem; }
      .site-prose li::marker { color: var(--uci-blue-bright); }
      .site-prose strong { color: var(--uci-blue-deep); }
      .site-prose a { color: var(--uci-blue); font-weight: 700; text-decoration: none; }
      .site-prose a:hover { text-decoration: underline; }
      .site-prose code { padding: 0.1rem 0.35rem; border-radius: 6px; background: rgba(0, 51, 160, 0.07); font-size: 0.9em; }
      .site-prose hr { margin: 1.5rem 0; border: 0; border-top: 1px solid var(--line); }
      .meta { margin: 0.6rem 0 0; color: var(--muted); font-size: 0.9rem; }
      .site-edit-bar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 1.6rem; padding-top: 1rem; border-top: 1px solid var(--line); }
      .site-edit-status { margin: 0; }
      .site-edit-button {
        appearance: none; display: inline-flex; align-items: center; justify-content: center; height: 2.4rem; padding: 0 1rem;
        border: 1px solid var(--line-strong); border-radius: 999px; background: rgba(255, 255, 255, 0.75); color: var(--uci-blue);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer;
      }
      .site-edit-button:hover { background: rgba(0, 51, 160, 0.08); }
      .site-edit-button.is-primary { background: var(--uci-blue); border-color: var(--uci-blue); color: white; }
      .site-edit-button:disabled { opacity: 0.6; cursor: wait; }
      .site-editor { margin-top: 1rem; }
      .site-editor[hidden] { display: none; }
      .site-editor-label { display: block; margin-bottom: 0.4rem; color: var(--muted); font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .site-editor-text {
        width: 100%; min-height: 26rem; padding: 0.9rem 1rem; border: 1px solid var(--line-strong); border-radius: 18px; background: white; color: var(--ink);
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.9rem; line-height: 1.5; resize: vertical;
      }
      .site-editor-text:focus { outline: none; border-color: var(--uci-blue-bright); box-shadow: 0 0 0 3px rgba(0, 120, 199, 0.16); }
      .site-editor-actions { display: flex; gap: 0.6rem; margin-top: 0.8rem; }
      .footer-note { margin-top: 1.2rem; padding: 0.95rem 1rem 0; color: rgba(9, 33, 76, 0.66); font-size: 0.9rem; text-align: center; }
      .footer-links { display: flex; justify-content: center; align-items: center; gap: 0.6rem; margin-top: 0.6rem; font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .footer-links a { color: var(--uci-blue); text-decoration: none; }
      .footer-links a:hover { text-decoration: underline; }
      .footer-links span[aria-current] { color: var(--muted); }
      .footer-links-dot { color: var(--muted); }
      @media (max-width: 720px) {
        .page { width: min(100% - 1rem, 880px); padding-top: 0.7rem; }
        .hero { padding: 1.25rem; border-radius: 22px; }
        .hero::after { left: 1.25rem; right: 1.25rem; }
        .section { padding: 1.2rem 1.1rem; border-radius: 22px; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="hero-top">
          <span class="eyebrow">Pro Cycling Results</span>
          <a class="hero-back" href="/">← Back to the results</a>
        </div>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.tag)}</p>
      </section>
      <section class="section">
        <div class="site-prose" data-site-prose>
          ${renderMarkdown(markdown)}
        </div>
        ${editorMarkup}
      </section>
      <p class="footer-note">Free, for all to use and enjoy.</p>
      ${buildSiteFooterLinks(page.path)}
    </main>
    ${editorScript}
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
    const shouldWarmHomepage = shouldServeHomepageWarmup();

    if (url.pathname.startsWith("/assets/")) {
      const handled = await sendStaticFile(response, url.pathname);
      if (handled) {
        return;
      }
    }

    if (shouldWarmHomepage) {
      warmRaceDataInBackground().catch(() => {});

      if (url.pathname === "/api/homepage-data") {
        sendJson(response, 202, {
          status: "warming",
          message: "Live race data is still loading.",
        });
        return;
      }

      if (getShareView(url.pathname)) {
        sendHtml(response, 200, buildWarmupPage(getShareView(url.pathname)));
        return;
      }
    }

    if (!getShareView(url.pathname)) {
      if (url.pathname === "/api/build-info") {
        sendJson(response, 200, BUILD_INFO);
        return;
      }

      if (url.pathname === "/api/site-content" && request.method === "POST") {
        await handleSiteContentUpdate(request, response);
        return;
      }

      const sitePageId = findSiteContentPageByPath(url.pathname);
      if (sitePageId) {
        sendHtml(response, 200, buildSiteContentPage(sitePageId, await readSiteContent(sitePageId)));
        return;
      }

      if (url.pathname === "/api/homepage-data") {
        const data = await loadRaceData({ includeDeferred: false });
        const debugRequested = url.searchParams.get("debug") === "1";
        sendJson(response, 200, debugRequested ? buildRaceDataDebugPayload(data) : buildHomepageDataPayload(data));
        return;
      }

      if (url.pathname === "/api/competition-section") {
        const groupId = url.searchParams.get("group") || "";
        if (RETIRED_COMPETITION_GROUP_IDS.has(groupId)) {
          sendJson(response, 410, {
            error: "This competition section is retired.",
            message:
              "UCI ProSeries and Europe Tour sections are archived in the repository but are not part of the active product scope.",
          });
          return;
        }

        if (!DEFERRED_COMPETITION_GROUP_IDS.has(groupId)) {
          sendJson(response, 404, { error: "Unknown competition group." });
          return;
        }
        const data = await loadCompetitionGroupData(groupId);
        const group = getCompetitionGroups(data).find((entry) => entry.id === groupId);
        if (!group) {
          sendJson(response, 404, { error: "Unknown competition group." });
          return;
        }

        sendJson(response, 200, {
          groupId,
          html: buildCompetitionSection(group),
        });
        return;
      }

      if (url.pathname === "/api/race-news") {
        const raceId = url.searchParams.get("race") || "";
        const data = await loadRaceData({ includeDeferred: false });
        const race = [...(data.liveStageRaces || []), ...(data.recentResults || []), ...(data.finalizedStageRaces || [])].find(
          (entry) => entry.id === raceId,
        );
        if (!race) {
          sendJson(response, 404, { error: "Unknown race." });
          return;
        }

        let articles;
        try {
          articles = await loadRaceArticlePool(race);
        } catch (error) {
          sendJson(response, 502, { error: "Race coverage is unavailable right now." });
          return;
        }

        sendJson(response, 200, {
          raceId,
          html: buildRaceNewsMarkup(race, { articles }),
        });
        return;
      }

      if (url.pathname === "/api/race-stages") {
        const raceId = url.searchParams.get("race") || "";
        const data = await loadRaceData({ includeDeferred: false });
        const race = findStageRaceById(data, raceId);
        if (!race) {
          sendJson(response, 404, { error: "Unknown stage race." });
          return;
        }

        const requestedStages = await loadRequestedStageHistory(race);
        const preferredStages = choosePreferredByQuality(
          requestedStages,
          race.stageRace.stages,
          getStageHistoryQuality,
        );
        // Write the deeper history back onto the cached race so the next full page
        // render already has it, until the race-data cache next rebuilds.
        race.stageRace.stages = Array.isArray(preferredStages) ? preferredStages : race.stageRace.stages;
        attachCachedStageProfiles(race);

        sendJson(response, 200, {
          raceId: getRaceId(race),
          html: buildStageSwitcherMarkup(race, { stageResultsRequested: true }),
        });
        return;
      }

      if (url.pathname === "/api/races") {
        const data = await loadRaceData({ includeDeferred: false });
        const debugRequested = url.searchParams.get("debug") === "1";
        sendJson(response, 200, debugRequested ? buildRaceDataDebugPayload(data) : data);
        return;
      }

      sendHtml(
        response,
        404,
        `<!doctype html><meta charset='utf-8'><title>Not Found</title>${UMAMI_ANALYTICS_SCRIPT}<h1>Not Found</h1>`,
      );
      return;
    }

    const data = await loadRaceData({ includeDeferred: false });

    sendHtml(
      response,
      200,
      buildHtmlPage(data, {
        sharePath: url.pathname,
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
