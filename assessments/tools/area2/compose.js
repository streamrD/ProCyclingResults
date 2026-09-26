// Page composition of one saved production homepage. Usage: node compose.js body-home-1.out
const fs = require("node:fs");
const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const total = Buffer.byteLength(html);
const B = (s) => Buffer.byteLength(s);

function sumMatches(re, transform = (m) => m[0]) {
  let sum = 0;
  let count = 0;
  for (const m of html.matchAll(re)) {
    sum += B(transform(m));
    count += 1;
  }
  return { count, bytes: sum };
}

const style = sumMatches(/<style[^>]*>([\s\S]*?)<\/style>/g, (m) => m[1]);
const inlineJs = sumMatches(/<script(?![^>]*\bsrc=)(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g, (m) => m[1]);
const jsonBlocks = sumMatches(/<script[^>]*application\/json[^>]*>([\s\S]*?)<\/script>/g, (m) => m[1]);
const externalScripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const svg = sumMatches(/<svg[\s\S]*?<\/svg>/g);
const img = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const fontFaces = [...html.matchAll(/@font-face\s*\{[^}]*url\("([^"]+)"\)/g)].map((m) => m[1]);
const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
const raceCards = (html.match(/\bid="race-/g) || []).length;
const newsPending = (html.match(/data-race-news-state="pending"/g) || []).length;
const newsTotal = (html.match(/data-race-news=/g) || []).length;
const hiddenAttrs = (html.match(/\shidden(?=[\s>])/g) || []).length;
const riderLinks = (html.match(/class="rider-link/g) || []).length;
const dataTip = sumMatches(/\sdata-tip-[a-z-]+="[^"]*"/g);
const stripped = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const approxElements = (stripped.match(/<[a-zA-Z][a-zA-Z0-9-]*[\s>\/]/g) || []).length;

function offsetOf(marker) {
  const i = html.indexOf(marker);
  return i < 0 ? null : B(html.slice(0, i));
}
const markers = {
  "</head>": offsetOf("</head>"),
  "<main": offsetOf("<main"),
  "first section": offsetOf("<section"),
  "first id=\"race-\" (first race card)": offsetOf('id="race-'),
  "first .podium/.standings-like result row": (() => {
    const m = html.match(/class="[^"]*(podium|result-row|standing)[^"]*"/);
    return m ? B(html.slice(0, m.index)) : null;
  })(),
  "season calendar section": offsetOf('id="season-calendar"'),
  "national championships section": offsetOf("data-national-almanac"),
  "rider-seasons JSON": offsetOf('id="rider-seasons"'),
  "client <script> (last inline)": (() => {
    const i = html.lastIndexOf("<script>");
    return i < 0 ? null : B(html.slice(0, i));
  })(),
  "</html>": offsetOf("</html>"),
};

// Byte size of the big blocks by id / attribute (start marker to matching close is hard; use next-known-marker deltas)
const sectionsOrder = ["<main", "season calendar section", "national championships section", "rider-seasons JSON", "client <script> (last inline)", "</html>"];

const out = {
  file,
  totalBytes: total,
  headBytes: markers["</head>"],
  inlineCss: style,
  inlineJs: inlineJs,
  embeddedJson: jsonBlocks,
  inlineSvg: svg,
  dataTipAttributes: dataTip,
  externalScripts,
  images: { count: img.length, sample: img.slice(0, 5) },
  fontFaces,
  links,
  raceCards,
  newsPlaceholders: { total: newsTotal, pending: newsPending },
  riderLinks,
  hiddenAttributes: hiddenAttrs,
  approxElementsByRegex: approxElements,
  byteOffsets: markers,
  deltas: sectionsOrder.slice(1).map((name, i) => ({ from: sectionsOrder[i], to: name, bytes: markers[name] - markers[sectionsOrder[i]] })),
  fractionBeforeFirstRaceCard: (markers['first id="race-" (first race card)'] / total).toFixed(3),
};
console.log(JSON.stringify(out, null, 2));
