#!/usr/bin/env node
// Builds data/continent-map.json, the world map behind the National Championships
// almanac: every country outline from Natural Earth's public-domain 1:110m dataset,
// projected (Robinson), simplified for the web, and bucketed into the same continent
// groups the almanac uses (CONTINENT_BY_ALPHA2 in server.js, falling back to Natural
// Earth's own continent for countries that are not federations in the index).
// Federations too small to draw at this scale get a dot at a hand-set position.
//
//   node scripts/build-continent-map.js [--source path/to/ne_110m_admin_0_countries.geojson]
//
// Commit the result; the server reads it at startup and never fetches geography.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "continent-map.json");
const WIDTH = 1170;
const LAT_TOP = 84;
const LAT_BOTTOM = -57;
const SIMPLIFY_TOLERANCE = 0.55;

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : "";

// Federations the 1:110m dataset has no polygon for. Positions are the territory's
// own coordinates, so the dot sits where the place is.
const TINY_FEDERATIONS = {
  BM: [32.3, -64.8, "Bermuda"],
  AG: [17.1, -61.8, "Antigua and Barbuda"],
  GD: [12.1, -61.7, "Grenada"],
  VC: [13.25, -61.2, "Saint Vincent and the Grenadines"],
  HK: [22.3, 114.2, "Hong Kong"],
  MO: [22.2, 113.55, "Macau"],
  SG: [1.35, 103.8, "Singapore"],
  MT: [35.9, 14.4, "Malta"],
  CV: [16.0, -24.0, "Cape Verde"],
  MU: [-20.3, 57.6, "Mauritius"],
};
// Where each continent's label chip sits (longitude, latitude): open water or empty
// land beside the continent, so the chip never covers a small country.
const LABEL_POSITIONS = {
  europe: [-8, 60],
  "north-america": [-118, 60],
  "south-america": [-85, -20],
  asia: [100, 60],
  africa: [-12, -8],
  oceania: [150, -38],
};
const NATURAL_EARTH_CONTINENTS = {
  Europe: "europe",
  Asia: "asia",
  Africa: "africa",
  "North America": "north-america",
  "South America": "south-america",
  Oceania: "oceania",
};

function loadServerConstants() {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const listenMarker = "\nserver.listen(PORT, () => {";
  const sandbox = {
    require, console, process, URL, fetch: global.fetch, URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, AbortController, AbortSignal,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${serverSource.slice(0, serverSource.indexOf(listenMarker))}\n;globalThis.__MAP__ = { CONTINENT_BY_ALPHA2, NATIONAL_CHAMPIONSHIP_CONTINENTS };`,
    sandbox,
  );
  return sandbox.__MAP__;
}

// Robinson projection from its published table, interpolated at 5° steps.
const ROBINSON = [
  [0, 1, 0], [5, 0.9986, 0.062], [10, 0.9954, 0.124], [15, 0.99, 0.186], [20, 0.9822, 0.248],
  [25, 0.973, 0.31], [30, 0.96, 0.372], [35, 0.9427, 0.434], [40, 0.9216, 0.4958], [45, 0.8962, 0.5571],
  [50, 0.8679, 0.6176], [55, 0.835, 0.6769], [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936], [80, 0.6213, 0.9394], [85, 0.5722, 0.9761], [90, 0.5322, 1],
];
function robinson(lon, lat) {
  const absLat = Math.abs(lat);
  const index = Math.min(17, Math.floor(absLat / 5));
  const t = (absLat - index * 5) / 5;
  const plen = ROBINSON[index][1] + (ROBINSON[index + 1][1] - ROBINSON[index][1]) * t;
  const pdfe = ROBINSON[index][2] + (ROBINSON[index + 1][2] - ROBINSON[index][2]) * t;
  return [0.8487 * plen * ((lon * Math.PI) / 180), 1.3523 * pdfe * Math.sign(lat)];
}
const X_MAX = 0.8487 * Math.PI;
const SCALE = (WIDTH - 10) / (2 * X_MAX);
const Y_TOP = robinson(0, LAT_TOP)[1];
const HEIGHT = Math.round((Y_TOP - robinson(0, LAT_BOTTOM)[1]) * SCALE) + 10;
function project(lon, lat) {
  const [x, y] = robinson(lon, Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat)));
  return [5 + (x + X_MAX) * SCALE, 5 + (Y_TOP - y) * SCALE];
}

// Douglas–Peucker on projected points; keeps the outline within `tolerance` px.
function simplify(points, tolerance) {
  if (points.length <= 3) {
    return points;
  }
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  // Rings close on their first point, so the first/last chord has no length. Split
  // at the point farthest from the start and simplify the two halves separately.
  let anchor = 1;
  let anchorDistance = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = Math.hypot(points[index][0] - points[0][0], points[index][1] - points[0][1]);
    if (distance > anchorDistance) {
      anchorDistance = distance;
      anchor = index;
    }
  }
  keep[anchor] = true;
  const stack = [[0, anchor], [anchor, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    let farthest = -1;
    let farthestDistance = 0;
    for (let index = first + 1; index < last; index += 1) {
      const [px, py] = points[index];
      const distance = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / length;
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = index;
      }
    }
    if (farthestDistance > tolerance && farthest > 0) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((point, index) => keep[index]);
}

function ringToPath(ring) {
  const projected = simplify(ring.map(([lon, lat]) => project(lon, lat)), SIMPLIFY_TOLERANCE);
  if (projected.length < 4) {
    return "";
  }
  return `M${projected.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

async function readSource() {
  if (sourcePath) {
    return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  }
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Natural Earth download failed (${response.status}).`);
  }
  return response.json();
}

async function main() {
  const { CONTINENT_BY_ALPHA2, NATIONAL_CHAMPIONSHIP_CONTINENTS } = loadServerConstants();
  const geojson = await readSource();
  const countries = [];
  for (const feature of geojson.features) {
    const properties = feature.properties;
    if (properties.CONTINENT === "Antarctica" || properties.CONTINENT === "Seven seas (open ocean)") {
      continue;
    }
    const alpha2 =
      properties.ISO_A2_EH && properties.ISO_A2_EH !== "-99" ? properties.ISO_A2_EH : properties.ISO_A2;
    const continent = CONTINENT_BY_ALPHA2[alpha2] || NATURAL_EARTH_CONTINENTS[properties.CONTINENT] || "";
    if (!continent) {
      continue;
    }
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const d = polygons.map((polygon) => ringToPath(polygon[0])).filter(Boolean).join("");
    if (!d) {
      continue;
    }
    countries.push({ alpha2: /^[A-Z]{2}$/.test(alpha2) ? alpha2 : "", name: properties.NAME_EN || properties.NAME, continent, d });
  }
  const dots = Object.entries(TINY_FEDERATIONS).map(([alpha2, [lat, lon, name]]) => {
    const [x, y] = project(lon, lat);
    return { alpha2, name, continent: CONTINENT_BY_ALPHA2[alpha2] || "", x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
  const labels = Object.fromEntries(
    NATIONAL_CHAMPIONSHIP_CONTINENTS.map((continent) => {
      const [x, y] = project(...LABEL_POSITIONS[continent.id]);
      return [continent.id, { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }];
    }),
  );
  const output = {
    source: "Natural Earth 1:110m admin 0 countries (public domain), Robinson projection",
    generatedAt: new Date().toISOString().slice(0, 10),
    width: WIDTH,
    height: HEIGHT,
    countries,
    dots,
    labels,
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
  const bytes = fs.statSync(OUTPUT_PATH).size;
  console.log(`wrote ${path.relative(process.cwd(), OUTPUT_PATH)}: ${countries.length} countries, ${dots.length} dots, ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
