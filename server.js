const http = require("http");
const fs = require("fs/promises");
const path = require("path");
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

  if (!cleaned || /^Row\s+\d+\s+-\s+Cell\b/i.test(cleaned)) {
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

  const routeTable = extractWikiTableByCaption(rawText, /^stage characteristics(?: and winners)?$/i);
  [...routeTable.matchAll(/\{\{\s*UCI team code[^}]*\}\}[^\n]*/gi)].forEach((match) => {
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

function getStageRaceSnapshotFieldQuality(field, snapshot, race, fieldType, now = new Date()) {
  if (!field) {
    return [-1, -1, -1];
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

  return [Number(floor <= 0 || progress >= floor), Number(!suspiciousSparseJump), progress, standingsLength];
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
  const preferredSnapshot = choosePreferredByQuality(primary, secondary, (snapshot) => {
    if (!snapshot) {
      return [-1, -1, -1, -1, -1];
    }

    const floor = getLiveStageRaceFreshnessFloor(race, now);
    const snapshotQuality = getStageRaceSnapshotQuality(snapshot);
    return [
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
      ),
  );
  const overallResult = choosePreferredByQuality(primary?.overallResult, secondary?.overallResult, (field) =>
    getStageRaceSnapshotFieldQuality(
      field,
      Array.isArray(field) && field === primary?.overallResult ? primary : secondary,
      race,
      "overallResult",
      now,
    ),
  );
  // Official providers report only the current stage, so the Wikipedia-derived
  // history is normally the only side carrying one. Prefer whichever side knows more
  // stages in depth rather than whichever snapshot won overall.
  const stages = choosePreferredByQuality(primary?.stages, secondary?.stages, getStageHistoryQuality);
  // Only the Wikipedia side describes the route (distance, type, course), so whichever
  // snapshot carries one is the route for both.
  const route = [primary?.route, secondary?.route].find((entry) => Array.isArray(entry) && entry.length > 0) || [];
  const totalStages = Math.max(
    Number(primary?.totalStages || 0),
    Number(secondary?.totalStages || 0),
  );
  const fallbackTotalStages = inferStageCountFromDates(race) || 0;
  const resolvedTotalStages = totalStages || fallbackTotalStages;
  const completedStages = Math.max(
    getStageRaceSnapshotProgress(preferredSnapshot),
    getStageRaceFieldProgress(latestStage),
    getStageRaceFieldProgress(generalClassification),
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
  await enrichStageProfiles(liveStageRaces);
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
  };
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
  const podium = entries
    .filter((entry) => entry?.rider)
    .map(
      (entry) => `
        <li class="podium-item">
          <span class="podium-place place-${escapeHtml(entry.place)}">${escapeHtml(entry.place)}</span>
          ${buildRiderMarkup(entry, "podium-rider", { metricContext })}
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
      if (cached && now.getTime() - cached.fetchedAt < ttl) {
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

  return `
      <div class="card-subsection stage-switcher" data-stage-switcher>
        <div class="detail-label">Stage results</div>
        <div class="stage-strip" role="tablist" aria-label="${escapeHtml(race.title)} stages">${chips}</div>
        ${panels}
        ${stageResultsControl}
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
  const gcContent = gcStandings.length > 0
    ? `
      <div class="card-subsection">
        <div class="detail-label">${escapeHtml(classificationLabel)}</div>
        ${buildPodiumMarkup(gcStandings, { metricContext: "gc" })}
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
  const metric = getStandingMetric(entry, options.metricContext || "default");
  const gapMarkup = metric ? `<span class="standing-gap">${escapeHtml(metric)}</span>` : "";

  return `<span class="${escapeHtml(className)} rider-name">${flagMarkup}<span class="rider-text">${escapeHtml(rider)}</span>${gapMarkup}</span>`;
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

function buildLoadCoverageButton(groupId) {
  return `
    <button type="button" class="load-coverage-button" data-coverage-group-id="${escapeHtml(groupId)}">
      Load Race Coverage
    </button>`;
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

async function buildCoverageViewForGroup(group, url) {
  // The recent-results grid reveals races in rows; the coverage dropdown only
  // lists races the user has actually revealed (defaults to the first row).
  const requestedShown = Number.parseInt(url.searchParams.get(`${group.id}-shown`) || "", 10);
  const shownRecent = Math.min(
    group.recentResults.length,
    Number.isFinite(requestedShown) && requestedShown > 0 ? requestedShown : WORLDTOUR_RECENT_RESULTS_STEP,
  );
  const articleRaces = [...group.liveStageRaces, ...group.recentResults.slice(0, shownRecent)];
  const selectedRaceId = url.searchParams.get(`${group.id}-race`) || articleRaces[0]?.id || "";
  const refreshToken = Math.max(
    0,
    Number.parseInt(url.searchParams.get(`${group.id}-refresh`) || "0", 10) || 0,
  );
  const selectedRace =
    articleRaces.find((race) => race.id === selectedRaceId) || articleRaces[0] || null;
  const articlePool = selectedRace ? await loadRaceArticlePool(selectedRace) : [];

  return {
    articleRaces,
    selectedRaceId: selectedRace?.id || "",
    selectedRaceTitle: selectedRace?.title || "the selected race",
    refreshToken,
    raceArticles: selectRaceArticles(articlePool, refreshToken, selectedRace),
  };
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
  if (!coverageView) {
    return `
      <div class="competition-block competition-coverage" id="${escapeHtml(group.id)}-coverage">
        <div class="competition-block-head">
          <h3>Race Coverage</h3>
          <p>Load article coverage to explore the latest stories for the above races.</p>
        </div>
        ${buildLoadCoverageButton(group.id)}
        <div class="coverage-content" id="${escapeHtml(group.id)}-coverage-content"></div>
      </div>`;
  }

  if (coverageView.articleRaces.length === 0) {
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
      <div class="coverage-content" id="${escapeHtml(group.id)}-coverage-content">
        <div class="article-grid">${articleCards}</div>
      </div>
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

function buildCompetitionSection(group, coverageView) {
  const liveMarkup = group.liveStageRaces.map(buildLiveStageRaceCard).join("");
  const upcomingMarkup = group.upcomingRaces.map(buildUpcomingCard).join("");
  const blocks = [
    buildCompetitionBlock("Live Multi-Stage", "Current stage races and overall standings.", liveMarkup),
    buildRecentResultsBlock(group),
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

function buildNationalChampionValue(value) {
  return value ? escapeHtml(value) : `<span class="champion-tbd">TBD</span>`;
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

function buildNationalChampionshipFilters(events) {
  if (!events?.length) {
    return "";
  }

  const countries = [...new Set(events.map((event) => event.country).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
  const countryOptions = countries
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
    .join("");
  const eventOptions = NATIONAL_CHAMPIONSHIP_EVENT_KEYS
    .map((eventKey) => `<option value="${escapeHtml(eventKey)}">${escapeHtml(NATIONAL_CHAMPIONSHIP_EVENT_LABELS[eventKey])}</option>`)
    .join("");

  return `
    <div class="national-filter-bar">
      <label class="national-filter">
        <span>Country</span>
        <select id="national-country-filter" data-national-filter="country">
          <option value="">All countries</option>
          ${countryOptions}
        </select>
      </label>
      <label class="national-filter">
        <span>Category</span>
        <select id="national-event-filter" data-national-filter="event">
          <option value="">All categories</option>
          ${eventOptions}
        </select>
      </label>
    </div>`;
}

function buildNationalChampionshipsSection(nationalChampionships) {
  const data = nationalChampionships || buildEmptyNationalChampionships();
  const events = sortNationalChampionshipEvents(data.events || buildNationalChampionshipEventRecords(data.rows || []));
  const eventMarkup = events.map(buildNationalChampionshipEventCard).join("");
  const filterMarkup = buildNationalChampionshipFilters(events);
  const sourceUpdatedLabel = data.sourceLastModified
    ? `Source updated ${formatTimestamp(data.sourceLastModified)} Eastern Time.`
    : `Source fetched ${formatTimestamp(data.fetchedAt)} Eastern Time.`;
  const summaryMarkup = `
    <div class="national-summary-grid">
      <div class="national-summary-card">
        <span>Countries Listed</span>
        <strong>${escapeHtml(String(data.totalCountryCount || 0))}</strong>
      </div>
      <div class="national-summary-card">
        <span>Completed Events</span>
        <strong>${escapeHtml(String(data.completedEventCount || events.filter((event) => event.status === "completed").length))}</strong>
      </div>
      <div class="national-summary-card">
        <span>Scheduled/TBD</span>
        <strong>${escapeHtml(String(events.filter((event) => event.status !== "completed").length))}</strong>
      </div>
    </div>`;
  const errorMarkup = data.error
    ? `<p class="meta national-error">National championship data is temporarily unavailable: ${escapeHtml(data.error)}</p>`
    : "";

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
        ${summaryMarkup}
        ${errorMarkup}
        <div class="competition-block national-results-block">
          <div class="competition-block-head">
            <h3>Results</h3>
            <p>${escapeHtml(data.sourceLabel)}. ${escapeHtml(sourceUpdatedLabel)} <a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noreferrer">View source</a>.</p>
          </div>
          ${filterMarkup}
          <div class="grid competition-grid competition-grid-three national-event-grid" data-national-event-grid>
            ${eventMarkup}
          </div>
          <p class="meta national-empty-state" data-national-empty-state hidden>No national championship entries match those filters.</p>
        </div>
      </div>
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
  const competitionGroups = getCompetitionGroups(data);
  const eagerCompetitionGroups = competitionGroups.filter((group) => !group.deferred);
  const deferredCompetitionGroups = competitionGroups.filter((group) => group.deferred);
  const competitionSections = eagerCompetitionGroups
    .map((group) => buildCompetitionSection(group, view.coverageByGroup[group.id]))
    .filter(Boolean)
    .join("");
  const nationalChampionshipsSection = buildNationalChampionshipsSection(data.nationalChampionships);
  const heroSubheader = [
    "TOP-FIVE RACE RESULTS",
    "NATIONAL CHAMPIONS",
    "UPCOMING RACE CALENDARS",
    "LATEST RACE NEWS",
    "FEATURED STAGE RACES",
  ].join(" • ");
  const heroMenu = [
    ...competitionGroups,
    { id: "national-championships", label: "National Championships" },
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
            : `<a class="hero-menu-link" href="#${escapeHtml(group.id)}">${escapeHtml(group.label)}</a>`
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
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pro Cycling Results" />
    <meta property="og:title" content="Pro Cycling Results" />
    <meta property="og:description" content="Live race standings, recent results, national champions, and news coverage for the 2026 men's and women's UCI WorldTour." />
    <meta property="og:url" content="https://procyclingresults.up.railway.app" />
    <meta property="og:image" content="https://procyclingresults.up.railway.app/assets/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="405" />
    <meta property="og:image:alt" content="Pro Cycling Results — Live UCI Race Coverage" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Pro Cycling Results" />
    <meta name="twitter:description" content="Live race standings, recent results, national champions, and news coverage for the 2026 men's and women's UCI WorldTour." />
    <meta name="twitter:image" content="https://procyclingresults.up.railway.app/assets/og-image.jpg" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
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

      .competition-coverage .article-grid {
        margin-top: 1rem;
      }

      .national-section::before {
        background: var(--rainbow);
      }

      .national-summary-grid {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .national-summary-card {
        padding: 1rem;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(0, 120, 199, 0.05));
      }

      .national-summary-card span,
      .champion-line span {
        display: block;
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-summary-card strong {
        display: block;
        margin-top: 0.2rem;
        color: var(--uci-blue-deep);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 2rem;
        line-height: 1;
      }

      .champion-lines {
        display: grid;
        gap: 0.65rem;
        margin-top: 1rem;
      }

      .champion-line {
        display: grid;
        gap: 0.18rem;
        padding-top: 0.65rem;
        border-top: 1px solid var(--line);
      }

      .champion-line:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .champion-line strong {
        color: var(--ink);
        font-size: 0.98rem;
        line-height: 1.35;
      }

      .champion-tbd {
        color: rgba(79, 97, 136, 0.68);
        font-weight: 600;
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

      .national-filter-bar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
        margin-bottom: 1rem;
      }

      .national-filter {
        display: grid;
        gap: 0.35rem;
      }

      .national-filter span,
      .national-event-meta span,
      .national-event-empty span {
        color: var(--muted);
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-filter select {
        width: 100%;
        min-height: 2.8rem;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: white;
        color: var(--ink);
        font: inherit;
        font-weight: 700;
        padding: 0.65rem 0.8rem;
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

      .national-table-wrap {
        overflow-x: auto;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.94);
      }

      .national-table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
      }

      .national-table th,
      .national-table td {
        padding: 0.82rem 0.9rem;
        border-bottom: 1px solid var(--line);
        color: var(--ink);
        font-size: 0.92rem;
        line-height: 1.35;
        text-align: left;
        vertical-align: top;
      }

      .national-table thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--uci-blue-deep);
        color: white;
        font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .national-table tbody th {
        width: 14rem;
        color: var(--uci-blue-deep);
        font-weight: 800;
      }

      .national-table tbody tr:last-child th,
      .national-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .national-table tbody tr:nth-child(even) {
        background: rgba(0, 120, 199, 0.035);
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

      .coverage-content {
        margin-top: 1rem;
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

        .national-summary-grid {
          grid-template-columns: 1fr;
        }

        .national-filter-bar {
          grid-template-columns: 1fr;
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
      ${nationalChampionshipsSection}
      ${deferredSectionButtons}
      ${deferredSectionMounts}

      <p class="footer-note">WorldTour data refreshes from live season pages when the server cache expires. National champions update from the current championship index.</p>
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

      async function loadCoverage(groupId, options = {}) {
        const coverageBlock = document.getElementById(groupId + "-coverage");
        const coverageContent = document.getElementById(groupId + "-coverage-content");
        if (!coverageBlock || !coverageContent) {
          return;
        }

        const trigger = coverageBlock.querySelector('[data-coverage-group-id="' + groupId + '"]');
        if (trigger) {
          trigger.classList.add("is-loading");
        }

        try {
          const params = new URLSearchParams({ group: groupId });
          if (options.selectedRaceId) {
            params.set(groupId + "-race", options.selectedRaceId);
          }
          if (Number.isFinite(options.refreshToken)) {
            params.set(groupId + "-refresh", String(options.refreshToken));
          }
          const shownRecent = countShownRecentRaces(groupId);
          if (shownRecent > 0) {
            params.set(groupId + "-shown", String(shownRecent));
          }

          const response = await fetch("/api/competition-coverage?" + params.toString(), { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Unable to load coverage");
          }

          const payload = await response.json();
          coverageBlock.outerHTML = payload.html || "";
          bindArticleControls(document);
          syncCoverageRaceOptions(groupId);
        } catch (error) {
          coverageContent.innerHTML = '<p class="meta">Unable to load race coverage right now. Please try again in a moment.</p>';
        } finally {
          if (trigger) {
            trigger.classList.remove("is-loading");
          }
        }
      }

      function bindNationalChampionshipFilters() {
        const countrySelect = document.getElementById("national-country-filter");
        const eventSelect = document.getElementById("national-event-filter");
        const cards = Array.from(document.querySelectorAll("[data-national-event-card]"));
        const emptyState = document.querySelector("[data-national-empty-state]");
        if (!countrySelect || !eventSelect || cards.length === 0) {
          return;
        }

        const applyFilters = () => {
          const selectedCountry = countrySelect.value;
          const selectedEvent = eventSelect.value;
          const includePending = Boolean(selectedCountry);
          let visibleCount = 0;

          cards.forEach((card) => {
            const matchesCountry = !selectedCountry || card.dataset.country === selectedCountry;
            const matchesEvent = !selectedEvent || card.dataset.eventKey === selectedEvent;
            const matchesStatus = includePending || card.dataset.status === "completed";
            const shouldShow = matchesCountry && matchesEvent && matchesStatus;
            card.hidden = !shouldShow;
            if (shouldShow) {
              visibleCount += 1;
            }
          });

          if (emptyState) {
            emptyState.hidden = visibleCount !== 0;
          }
        };

        countrySelect.addEventListener("change", applyFilters);
        eventSelect.addEventListener("change", applyFilters);
        applyFilters();
      }

      function getRecentBlock(groupId) {
        return document.querySelector('[data-recent-block="' + groupId + '"]');
      }

      function getRecentSlots(groupId) {
        const block = getRecentBlock(groupId);
        return block ? Array.prototype.slice.call(block.querySelectorAll("[data-recent-slot]")) : [];
      }

      function countShownRecentRaces(groupId) {
        return getRecentSlots(groupId).filter((slot) => !slot.hidden).length;
      }

      // Keep the coverage dropdown in sync with the races the user has revealed,
      // appending newly shown races without disturbing the current selection.
      function syncCoverageRaceOptions(groupId) {
        const select = document.getElementById(groupId + "-race-select");
        if (!select) {
          return;
        }

        const existingValues = new Set(Array.prototype.map.call(select.options, (option) => option.value));
        getRecentSlots(groupId).forEach((slot) => {
          if (slot.hidden) {
            return;
          }
          const raceId = slot.dataset.recentRaceId;
          if (!raceId || existingValues.has(raceId)) {
            return;
          }
          const option = document.createElement("option");
          option.value = raceId;
          option.textContent = slot.dataset.recentRaceTitle + " • " + slot.dataset.recentRaceDate;
          select.appendChild(option);
          existingValues.add(raceId);
        });
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

        syncCoverageRaceOptions(groupId);
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

      function bindArticleControls(root = document) {
        root.querySelectorAll(".article-select").forEach((raceSelect) => {
          if (raceSelect.dataset.bound === "true") {
            return;
          }

          raceSelect.dataset.bound = "true";
          raceSelect.addEventListener("change", () => {
            const groupId = raceSelect.dataset.groupId;
            const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
            if (refreshTokenInput) {
              refreshTokenInput.value = "0";
            }
            loadCoverage(groupId, {
              selectedRaceId: raceSelect.value,
              refreshToken: 0,
            });
          });
        });

        root.querySelectorAll(".refresh-button").forEach((refreshButton) => {
          if (refreshButton.dataset.bound === "true") {
            return;
          }

          refreshButton.dataset.bound = "true";
          refreshButton.addEventListener("click", () => {
            const groupId = refreshButton.dataset.groupId;
            const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
            const currentValue = Number.parseInt(refreshTokenInput?.value || "0", 10) || 0;
            const nextValue = currentValue + 1;
            if (refreshTokenInput) {
              refreshTokenInput.value = String(nextValue);
            }
            const raceSelect = document.getElementById(groupId + "-race-select");
            loadCoverage(groupId, {
              selectedRaceId: raceSelect?.value || "",
              refreshToken: nextValue,
            });
          });
        });

        root.querySelectorAll(".load-coverage-button").forEach((coverageButton) => {
          if (coverageButton.dataset.bound === "true") {
            return;
          }

          coverageButton.dataset.bound = "true";
          coverageButton.addEventListener("click", () => {
            loadCoverage(coverageButton.dataset.coverageGroupId, { refreshToken: 0 });
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
          bindArticleControls(mount);
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

        switcher.querySelectorAll("[data-stage-target]").forEach((stageChip) => {
          const isActive = stageChip === chip;
          stageChip.classList.toggle("is-active", isActive);
          stageChip.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        switcher.querySelectorAll("[data-stage-panel]").forEach((panel) => {
          panel.hidden = panel.id !== chip.dataset.stageTarget;
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
      // is kept the same way the units are.
      const PROFILE_VIEW_KEY = "pcr-profile-view";

      function readProfileView() {
        try {
          return window.localStorage.getItem(PROFILE_VIEW_KEY) === "expanded" ? "expanded" : "compact";
        } catch (error) {
          return "compact";
        }
      }

      function applyProfileView(view) {
        const expanded = view === "expanded";
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

      bindArticleControls();
      bindLoadMoreRaces();
      bindNationalChampionshipFilters();
    </script>
  </body>
</html>`;
}

function buildWarmupPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <title>Pro Cycling Results</title>
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

      if (url.pathname === "/") {
        sendHtml(response, 200, buildWarmupPage());
        return;
      }
    }

    if (url.pathname !== "/") {
      if (url.pathname === "/api/build-info") {
        sendJson(response, 200, BUILD_INFO);
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
          html: buildCompetitionSection(group, null),
        });
        return;
      }

      if (url.pathname === "/api/competition-coverage") {
        const groupId = url.searchParams.get("group") || "";
        if (RETIRED_COMPETITION_GROUP_IDS.has(groupId)) {
          sendJson(response, 410, {
            error: "This competition group is retired.",
            message:
              "UCI ProSeries and Europe Tour article coverage is archived with the retired section code and is not currently loaded.",
          });
          return;
        }

        const data = DEFERRED_COMPETITION_GROUP_IDS.has(groupId)
          ? await loadCompetitionGroupData(groupId)
          : await loadRaceData({ includeDeferred: false });
        const group = getCompetitionGroups(data).find((entry) => entry.id === groupId);
        if (!group) {
          sendJson(response, 404, { error: "Unknown competition group." });
          return;
        }

        const coverageView = await buildCoverageViewForGroup(group, url);
        sendJson(response, 200, {
          groupId,
          html: buildCoverageBlock(group, coverageView),
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

    const competitionGroups = getCompetitionGroups(data);
    const coverageByGroup = Object.fromEntries(competitionGroups.map((group) => [group.id, null]));

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
