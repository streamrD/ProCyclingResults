#!/usr/bin/env node
// Fetches the organiser's elevation trace for every stage of a race and writes it to
// data/stage-profiles.json, which server.js seeds its profile cache from at startup.
// Run it after a route is published (all stages exist on the site before the race
// starts) and commit the result; production then never re-fetches those stages.
//
//   node scripts/refresh-stage-profiles.js --race "2026 Vuelta a España" [--stages 21]
//
// server.js is not a module, so its helpers are loaded the same way the tests do.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const raceTitle = readArg("--race", "");
const stageCount = Number(readArg("--stages", 21));
if (!raceTitle || !(stageCount > 0)) {
  console.error('Usage: node scripts/refresh-stage-profiles.js --race "<Wikipedia page title>" [--stages 21]');
  process.exit(1);
}

const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const listenMarker = "\nserver.listen(PORT, () => {";
const sandbox = {
  require,
  console,
  process,
  URL,
  fetch: global.fetch,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  setImmediate,
  AbortController,
  AbortSignal,
};
vm.createContext(sandbox);
vm.runInContext(
  `${serverSource.slice(0, serverSource.indexOf(listenMarker))}\n;globalThis.__REFRESH__ = { STAGE_PROFILE_SOURCES, fetchStageProfile, getStageProfileSource };`,
  sandbox,
);
const { fetchStageProfile, getStageProfileSource } = sandbox.__REFRESH__;

const yearMatch = raceTitle.match(/^(\d{4})\b/);
const race = { pageTitle: raceTitle, endDate: new Date(Date.UTC(Number(yearMatch?.[1]) || new Date().getUTCFullYear(), 11, 31)) };
const source = getStageProfileSource(race, race.endDate);
if (!source) {
  console.error(`No stage profile source matches "${raceTitle}". See STAGE_PROFILE_SOURCES in server.js.`);
  process.exit(1);
}

const filePath = path.join(__dirname, "..", "data", "stage-profiles.json");
let store = { profiles: {} };
try {
  store = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (error) {
  // First run: start empty.
}

(async () => {
  let fetched = 0;
  for (let stage = 1; stage <= stageCount; stage += 1) {
    const key = `${raceTitle}#${stage}`;
    const url = source.stageUrl(stage);
    try {
      const profile = await fetchStageProfile(url);
      if (profile) {
        store.profiles[key] = { fetchedAt: new Date().toISOString(), url, profile };
        fetched += 1;
        console.log(`stage ${stage}: ${profile.distanceKm} km, ${profile.elevationGainM} m climbing`);
      } else {
        console.log(`stage ${stage}: no trace embedded at ${url}`);
      }
    } catch (error) {
      console.log(`stage ${stage}: ${error.message}`);
    }
  }

  store.profiles = Object.fromEntries(Object.entries(store.profiles).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  console.log(`wrote ${fetched} profile(s) for "${raceTitle}" to ${path.relative(process.cwd(), filePath)}`);
})();
