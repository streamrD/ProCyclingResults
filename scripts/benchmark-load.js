#!/usr/bin/env node

const { performance } = require("node:perf_hooks");

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
    runs: Number.parseInt(process.env.RUNS || "5", 10) || 5,
    includeDeferred: false,
    waitReady: false,
    waitHomepageReady: false,
    readyTimeoutMs: Number.parseInt(process.env.READY_TIMEOUT_MS || "60000", 10) || 60000,
    readyPollMs: Number.parseInt(process.env.READY_POLL_MS || "500", 10) || 500,
  };

  argv.forEach((arg) => {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg.startsWith("--runs=")) {
      options.runs = Math.max(1, Number.parseInt(arg.slice("--runs=".length), 10) || options.runs);
    } else if (arg === "--include-deferred") {
      options.includeDeferred = true;
    } else if (arg === "--wait-ready") {
      options.waitReady = true;
    } else if (arg === "--wait-homepage-ready") {
      options.waitHomepageReady = true;
    } else if (arg.startsWith("--ready-timeout-ms=")) {
      options.readyTimeoutMs = Math.max(1000, Number.parseInt(arg.slice("--ready-timeout-ms=".length), 10) || options.readyTimeoutMs);
    } else if (arg.startsWith("--ready-poll-ms=")) {
      options.readyPollMs = Math.max(100, Number.parseInt(arg.slice("--ready-poll-ms=".length), 10) || options.readyPollMs);
    }
  });

  return options;
}

function quantile(sortedValues, ratio) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * ratio)));
  return sortedValues[index];
}

function summarizeTimings(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    min: sorted[0] || 0,
    avg: total / (sorted.length || 1),
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted[sorted.length - 1] || 0,
  };
}

async function measureRequest(url) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  });
  const body = await response.text();
  const durationMs = performance.now() - startedAt;
  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    bytes: Buffer.byteLength(body),
  };
}

async function sleep(timeoutMs) {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

async function waitForRaceDataReady(baseUrl, options) {
  return waitForEndpointReady(new URL("/api/races", baseUrl), "/api/races", options);
}

async function waitForHomepageReady(baseUrl, options) {
  return waitForEndpointReady(new URL("/api/homepage-data", baseUrl), "/api/homepage-data", options);
}

async function waitForEndpointReady(readyUrl, label, options) {
  const startedAt = performance.now();
  let attempts = 0;

  while (performance.now() - startedAt < options.readyTimeoutMs) {
    attempts += 1;
    const result = await measureRequest(readyUrl);
    if (result.status === 200) {
      return {
        durationMs: performance.now() - startedAt,
        attempts,
      };
    }

    if (result.status !== 202) {
      throw new Error(`${label} returned unexpected status ${result.status}`);
    }

    await sleep(options.readyPollMs);
  }

  throw new Error(`Timed out waiting for ${label} to become ready after ${options.readyTimeoutMs} ms`);
}

function buildEndpoints(options) {
  const endpoints = [
    { name: "Homepage HTML", path: "/" },
    { name: "Homepage data API", path: "/api/homepage-data" },
    { name: "Race API", path: "/api/races" },
    { name: "Race API (debug)", path: "/api/races?debug=1" },
  ];

  if (options.includeDeferred) {
    endpoints.push(
      { name: "Deferred ProSeries section", path: "/api/competition-section?group=proseries" },
      { name: "Deferred Europe Tour section", path: "/api/competition-section?group=europe-tour" },
    );
  }

  return endpoints;
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const endpoints = buildEndpoints(options);

  console.log(`Benchmarking ${options.baseUrl}`);
  console.log(`Runs per endpoint: ${options.runs}`);
  console.log("");

  if (options.waitReady) {
    const readiness = await waitForRaceDataReady(options.baseUrl, options);
    console.log("Race API readiness");
    console.log(`  attempts: ${readiness.attempts}`);
    console.log(`  ready in: ${formatMs(readiness.durationMs)}`);
    console.log("");
  }

  if (options.waitHomepageReady) {
    const readiness = await waitForHomepageReady(options.baseUrl, options);
    console.log("Homepage data readiness");
    console.log(`  attempts: ${readiness.attempts}`);
    console.log(`  ready in: ${formatMs(readiness.durationMs)}`);
    console.log("");
  }

  for (const endpoint of endpoints) {
    const timings = [];
    let lastStatus = 0;
    let lastBytes = 0;

    for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
      const result = await measureRequest(new URL(endpoint.path, options.baseUrl));
      if (!result.ok) {
        throw new Error(`${endpoint.name} failed with status ${result.status}`);
      }

      timings.push(result.durationMs);
      lastStatus = result.status;
      lastBytes = result.bytes;
    }

    const summary = summarizeTimings(timings);
    console.log(endpoint.name);
    console.log(`  status: ${lastStatus}`);
    console.log(`  bytes: ${lastBytes}`);
    console.log(`  min: ${formatMs(summary.min)}`);
    console.log(`  avg: ${formatMs(summary.avg)}`);
    console.log(`  p50: ${formatMs(summary.p50)}`);
    console.log(`  p95: ${formatMs(summary.p95)}`);
    console.log(`  max: ${formatMs(summary.max)}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(`Benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
