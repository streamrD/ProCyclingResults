// Runs the page's own client script in a real headless Chrome: stage chips, the km/mi
// toggle, the profile expand control, and the observer that re-applies both to markup
// that lands later. The parser suite cannot see any of that. Skips cleanly when no
// Chrome is installed, so it never blocks a machine without one.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadServer() {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const listenMarker = "\nserver.listen(PORT, () => {";
  const sandbox = {
    require, console, process, URL, fetch: global.fetch, URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, AbortController, AbortSignal,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${serverSource.slice(0, serverSource.indexOf(listenMarker))}\n;globalThis.__SMOKE__ = { buildStageSwitcherMarkup };`,
    sandbox,
  );
  return {
    buildStageSwitcherMarkup: sandbox.__SMOKE__.buildStageSwitcherMarkup,
    style: serverSource.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/@font-face\s*\{[^}]*\}/g, ""),
    // The homepage script is the block that defines the unit preference; the warm-up
    // page carries a later, unrelated block. Its one server-side expression is the
    // deferred-group payload, which this page has none of.
    script: (() => {
      const start = serverSource.lastIndexOf("<script>", serverSource.indexOf("const UNIT_PREFERENCE_KEY")) + 8;
      const script = serverSource.slice(start, serverSource.indexOf("</script>", start));
      const remaining = script.replace("${deferredGroupClientPayload}", "[]").match(/\$\{[^}]*\}/g);
      assert.equal(remaining, null, "the client script gained a template expression the smoke test does not substitute");
      return script.replace("${deferredGroupClientPayload}", "[]");
    })(),
  };
}

function buildPage() {
  const { buildStageSwitcherMarkup, style, script } = loadServer();
  const profile = { source: "komoot", distanceKm: 166.6, elevationGainM: 4527, points: [[0, 113], [80, 900], [120, 700], [166.6, 2137]] };
  const race = {
    id: "2026 Vuelta a España",
    pageTitle: "2026 Vuelta a España",
    title: "Vuelta a España",
    stageRace: {
      totalStages: 21,
      stages: [
        { number: 11, order: 11, label: "Stage 11", stageType: "flat", distanceKm: 156.1, winner: "A", standings: [{ place: "1", rider: "A" }] },
        { number: 12, order: 12, label: "Stage 12", stageType: "mountain", distanceKm: 166.5, course: "Vera to Calar Alto", profile, winner: "B", standings: [{ place: "1", rider: "B" }] },
      ],
    },
  };
  const switcher = buildStageSwitcherMarkup(race, { live: true });
  const probe = `
    const out = { errors: window.__errors };
    const chip = document.querySelector('[data-stage-target]:not(.is-active)');
    chip.click();
    out.otherPanelShown = !document.getElementById(chip.dataset.stageTarget).hidden;
    out.hiddenPanels = [...document.querySelectorAll('[data-stage-panel]')].filter((panel) => panel.hidden).length;
    out.activeChip = document.querySelector('.stage-chip.is-active').textContent;

    document.querySelector('[data-unit-option="imperial"]').click();
    out.units = document.documentElement.getAttribute('data-units');
    out.distance = document.querySelector('.stage-profile.is-measured .stage-profile-stat').textContent;
    out.storedUnits = localStorage.getItem('pcr-units');

    document.querySelector('[data-profile-toggle]').click();
    out.expanded = document.querySelectorAll('.stage-profile.is-expanded').length;
    out.toggleLabel = document.querySelector('[data-profile-toggle]').textContent;
    out.storedView = localStorage.getItem('pcr-profile-view');
    out.imperialAxisVisible = getComputedStyle(document.querySelector('.stage-profile-gridlabel[data-unit-system="imperial"]')).display !== 'none';
    out.metricAxisVisible = getComputedStyle(document.querySelector('.stage-profile-gridlabel[data-unit-system="metric"]')).display !== 'none';

    // Markup that lands later must pick up both preferences from the observer.
    const late = document.querySelector('.stage-profile.is-measured').cloneNode(true);
    late.classList.remove('is-expanded');
    late.querySelector('.stage-profile-stat').textContent = 'stale';
    document.body.appendChild(late);
    setTimeout(() => {
      out.lateExpanded = late.classList.contains('is-expanded');
      out.lateDistance = late.querySelector('.stage-profile-stat').textContent;
      document.getElementById('smoke').textContent = JSON.stringify(out);
    }, 50);
  `;
  return `<!doctype html><meta charset="utf-8"><style>${style}</style>
<body><script>window.__errors = []; window.addEventListener('error', (event) => window.__errors.push(event.message));</script>
<main>${switcher}</main><pre id="smoke"></pre>
<script>${script}</script>
<script>${probe}</script>`;
}

test("the stage card's client script works in a real browser", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcr-smoke-"));
  const file = path.join(dir, "card.html");
  fs.writeFileSync(file, buildPage());
  let dom = "";
  try {
    dom = execFileSync(
      chrome,
      ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=4000", "--dump-dom", `file://${file}`],
      { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const match = dom.match(/<pre id="smoke">([\s\S]*?)<\/pre>/);
  assert.ok(match && match[1].trim(), "the probe never reported: the client script threw before it ran or the page did not load");
  const out = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));

  assert.deepEqual(out.errors, []);
  assert.equal(out.otherPanelShown, true);
  assert.equal(out.hiddenPanels, 1);
  assert.equal(out.activeChip, "11");
  assert.equal(out.units, "imperial");
  assert.equal(out.distance, "103.5 mi");
  assert.equal(out.storedUnits, "imperial");
  assert.equal(out.expanded, 1);
  assert.equal(out.toggleLabel, "Collapse profile");
  assert.equal(out.storedView, "expanded");
  assert.equal(out.imperialAxisVisible, true);
  assert.equal(out.metricAxisVisible, false);
  assert.equal(out.lateExpanded, true);
  assert.equal(out.lateDistance, "103.5 mi");
});
