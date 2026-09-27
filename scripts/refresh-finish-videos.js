#!/usr/bin/env node
// Copies the finish videos a running server has found into data/finish-videos.json,
// which server.js seeds its finish-video cache from at startup. The server searches
// YouTube a few races per rebuild within the API's daily quota, so run this every few
// days while the backlog fills, and commit the result; a redeploy then starts from
// the file instead of forgetting every video. Hand-picked videos belong in
// RACE_FINISH_VIDEO_URLS in server.js, not here.
//
//   node scripts/refresh-finish-videos.js [--from https://procyclingresults.up.railway.app]
//
// Point --from at http://localhost:<port> to collect from a local run with
// YOUTUBE_API_KEY set. Entries already in the file are kept; the server's newer
// find for the same race or stage replaces the file's.
"use strict";

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const baseUrl = readArg("--from", "https://procyclingresults.up.railway.app").replace(/\/+$/, "");
const filePath = path.join(__dirname, "..", "data", "finish-videos.json");

(async () => {
  const response = await fetch(`${baseUrl}/api/finish-videos`, { headers: { accept: "application/json" } });
  if (!response.ok) {
    console.error(`${baseUrl}/api/finish-videos answered ${response.status}`);
    process.exit(1);
  }
  const found = (await response.json())?.videos || {};

  let store = { videos: {} };
  try {
    store = JSON.parse(fs.readFileSync(filePath, "utf8"));
    store.videos = store.videos || {};
  } catch (error) {
    // First run: start empty.
  }

  let added = 0;
  let changed = 0;
  Object.entries(found).forEach(([key, entry]) => {
    const url = typeof entry === "string" ? entry : entry?.url;
    if (!/^https?:\/\//.test(url || "") || !/\|\d+$/.test(key)) {
      return;
    }
    const previous = store.videos[key];
    if (!previous) {
      added += 1;
    } else if (previous.url !== url) {
      changed += 1;
    } else {
      return;
    }
    store.videos[key] = { url, foundAt: entry?.foundAt || new Date().toISOString() };
  });

  store.videos = Object.fromEntries(Object.entries(store.videos).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`);
  console.log(
    `${Object.keys(found).length} video(s) known to ${baseUrl}; ${added} added, ${changed} replaced, ` +
      `${Object.keys(store.videos).length} in ${path.relative(process.cwd(), filePath)}`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
