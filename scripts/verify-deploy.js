#!/usr/bin/env node
// Verify a deploy on production: the loop every "Process Lessons" section in
// handoff.md used to spell out by hand, as one command.
//
//   npm run verify:deploy                      # the commit you have checked out
//   npm run verify:deploy -- --sha=77674e9     # a specific commit
//   npm run verify:deploy -- --base-url=http://localhost:3000
//
// It polls /api/build-info until the live commit matches (Railway takes a minute or
// two to build and swap), then /api/data-status until it answers 200 (the warm-up
// build is running until then), then fetches the page once and checks that at least
// one race card and one section heading rendered. It prints one PASS or FAIL line
// with the section counts from /api/data-status and exits non-zero on failure. It
// only reads; three requests on a deploy that is already live, a few more while it
// waits. Built-in modules only, like the rest of the repository.
"use strict";

const { execSync } = require("child_process");

const DEFAULT_BASE_URL = "https://procyclingresults.up.railway.app";
const BUILD_INFO_TIMEOUT_MS = 6 * 60 * 1000;
const DATA_STATUS_TIMEOUT_MS = 4 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 10 * 1000;
const REQUEST_TIMEOUT_MS = 20 * 1000;
const USER_AGENT = "ProCyclingResults verify-deploy (reads /api/build-info, /api/data-status and / once)";
// Any one of these proves a section rendered. The page escapes the apostrophe in
// "Men's WorldTour" as an entity, so the check matches the tail of the heading.
const SECTION_HEADING_MARKERS = ["WorldTour</h2>", "World Championships</h2>", "National Championships</h2>"];
const RACE_CARD_MARKER = 'id="race-';

function parseArgs(argv) {
  const options = { sha: "", baseUrl: DEFAULT_BASE_URL, pollIntervalMs: DEFAULT_POLL_INTERVAL_MS, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const match = /^--([a-z][a-z-]*)(?:=(.*))?$/i.exec(argv[index]);
    if (!match) {
      throw new Error(`Unexpected argument: ${argv[index]}`);
    }
    const key = match[1].toLowerCase();
    let value = match[2];
    if (value === undefined && key !== "help" && argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) {
      value = argv[index + 1];
      index += 1;
    }
    if (key === "help") {
      options.help = true;
    } else if (key === "sha") {
      options.sha = String(value || "").trim().toLowerCase().slice(0, 7);
      if (!/^[0-9a-f]{7}$/.test(options.sha)) {
        throw new Error(`--sha wants the first seven hex characters of a commit, got "${value}"`);
      }
    } else if (key === "base-url") {
      options.baseUrl = String(value || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\/[^/]+$/i.test(options.baseUrl)) {
        throw new Error(`--base-url wants an http(s) origin, got "${value}"`);
      }
    } else if (key === "poll-interval-ms") {
      options.pollIntervalMs = Number.parseInt(String(value), 10);
      if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs < 250) {
        throw new Error(`--poll-interval-ms wants a number of milliseconds (250 or more), got "${value}"`);
      }
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  return options;
}

function resolveSha(sha) {
  if (sha) {
    return sha;
  }
  return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim().slice(0, 7).toLowerCase();
}

// One line for the summary: every section count, the nationals error and the last
// build error, so a PASS with "recent 0" still reads as the warning it is.
function describeStatus(status) {
  const sections = status?.sections || {};
  const count = (key) => (Number.isFinite(sections[key]) ? sections[key] : "?");
  return [
    `live ${count("liveStageRaces")}`,
    `recent ${count("recentResults")}`,
    `finalized ${count("finalizedStageRaces")}`,
    `upcoming ${count("upcomingRaces")}`,
    `nationals ${count("nationalChampionships")} federations${status?.nationalsError ? ` (error: ${status.nationalsError})` : ""}`,
    `last build error: ${status?.lastBuildError ? `${status.lastBuildError.message} at ${status.lastBuildError.at}` : "none"}`,
  ].join(", ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
}

async function fetchOnce(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

// Calls `check` until it answers { done: true, value } or the deadline passes. A thrown
// request error counts as "not yet" (Railway drops connections during the swap).
async function pollUntil(label, { timeoutMs, intervalMs }, check) {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; ; attempt += 1) {
    let outcome;
    try {
      outcome = await check();
    } catch (error) {
      outcome = { done: false, note: error.message || String(error) };
    }
    if (outcome.done) {
      return outcome.value;
    }
    log(`${label}: ${outcome.note} (attempt ${attempt})`);
    if (Date.now() + intervalMs > deadline) {
      throw new Error(`${label}: timed out after ${Math.round(timeoutMs / 1000)}s; last seen: ${outcome.note}`);
    }
    await sleep(intervalMs);
  }
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write("usage: node scripts/verify-deploy.js [--sha=<7 hex>] [--base-url=<origin>] [--poll-interval-ms=<n>]\n");
    return 0;
  }
  const sha = resolveSha(options.sha);
  const polling = { timeoutMs: BUILD_INFO_TIMEOUT_MS, intervalMs: options.pollIntervalMs };
  log(`verifying ${sha} at ${options.baseUrl}`);

  const buildInfo = await pollUntil("build-info", polling, async () => {
    const { status, body } = await fetchOnce(`${options.baseUrl}/api/build-info`);
    const liveCommit = String(body?.commit || "").toLowerCase();
    return liveCommit === sha
      ? { done: true, value: body }
      : { done: false, note: `HTTP ${status}, live commit ${liveCommit || "unknown"}, waiting for ${sha}` };
  });
  log(`build-info: ${buildInfo.commit} is live (${buildInfo.source}, node ${buildInfo.node || "?"})`);

  const dataStatus = await pollUntil("data-status", { ...polling, timeoutMs: DATA_STATUS_TIMEOUT_MS }, async () => {
    const { status, body } = await fetchOnce(`${options.baseUrl}/api/data-status`);
    return status === 200 && body
      ? { done: true, value: body }
      : { done: false, note: `HTTP ${status}${body?.status ? ` (${body.status})` : ""}, waiting for 200` };
  });
  log(`data-status: ${describeStatus(dataStatus)}`);

  const page = await fetchOnce(`${options.baseUrl}/`);
  const cardCount = page.text.split(RACE_CARD_MARKER).length - 1;
  const headingsFound = SECTION_HEADING_MARKERS.filter((marker) => page.text.includes(marker));
  const problems = [];
  if (page.status !== 200) {
    problems.push(`/ answered HTTP ${page.status}`);
  }
  if (cardCount < 1) {
    problems.push('/ has no race card (no id="race-…")');
  }
  if (headingsFound.length === 0) {
    problems.push(`/ has none of the section headings (${SECTION_HEADING_MARKERS.join(", ")})`);
  }

  const summary = `${sha} at ${options.baseUrl}: ${cardCount} race cards, headings ${headingsFound.length}/${SECTION_HEADING_MARKERS.length}; ${describeStatus(dataStatus)}`;
  if (problems.length > 0) {
    process.stdout.write(`FAIL ${summary}; ${problems.join("; ")}\n`);
    return 1;
  }
  process.stdout.write(`PASS ${summary}\n`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stdout.write(`FAIL ${error.message || String(error)}\n`);
      process.exitCode = /wants|Unknown option|Unexpected argument/.test(String(error.message)) ? 2 : 1;
    });
}

module.exports = { parseArgs, describeStatus, DEFAULT_BASE_URL, SECTION_HEADING_MARKERS, RACE_CARD_MARKER };
