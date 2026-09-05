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

function buildPage({ probe: customProbe, setup = "" } = {}) {
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
      route: [
        { number: 13, order: 13, label: "Stage 13", date: "4 September", course: "Almuñécar to Loja", stageType: "medium-mountain", distanceKm: 192.8 },
      ],
    },
  };
  const switcher = buildStageSwitcherMarkup(race, { live: true });
  const probe = `
    const out = { errors: window.__errors };
    const chip = document.querySelector('.stage-chip[data-stage-target]:not(.is-active):not(.is-next)');
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

    // The nudge row selects tomorrow's preview and lights the matching chip.
    document.querySelector('.stage-next-row').click();
    out.previewShown = !document.getElementById('2026-vuelta-a-espana-stage-13').hidden;
    out.previewChipActive = document.querySelector('.stage-chip.is-next').classList.contains('is-active');
    out.previewChipSelected = document.querySelector('.stage-chip.is-next').getAttribute('aria-selected');
    out.rowActive = document.querySelector('.stage-next-row').classList.contains('is-active');
    out.resultPanelsHidden = [...document.querySelectorAll('[data-stage-panel]:not(.stage-panel-next)')].every((panel) => panel.hidden);
    document.querySelector('.stage-chip.is-next').click();
    out.chipAgainStillShown = !document.getElementById('2026-vuelta-a-espana-stage-13').hidden;
    document.querySelector('[data-stage-target="2026-vuelta-a-espana-stage-12"]').click();
    out.backToResult = !document.getElementById('2026-vuelta-a-espana-stage-12').hidden && document.getElementById('2026-vuelta-a-espana-stage-13').hidden;
    out.rowInactive = !document.querySelector('.stage-next-row').classList.contains('is-active');

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
<body><script>window.__errors = []; window.addEventListener('error', (event) => window.__errors.push(event.message));${setup}</script>
<main>${switcher}</main><pre id="smoke"></pre>
<script>${script}</script>
<script>${customProbe || probe}</script>`;
}

function runProbe(chrome, page, chromeArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcr-smoke-"));
  const file = path.join(dir, "card.html");
  fs.writeFileSync(file, page);
  let dom = "";
  try {
    dom = execFileSync(
      chrome,
      ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=4000", "--dump-dom", ...chromeArgs, `file://${file}`],
      { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const match = dom.match(/<pre id="smoke">([\s\S]*?)<\/pre>/);
  assert.ok(match && match[1].trim(), "the probe never reported: the client script threw before it ran or the page did not load");
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

test("the stage card's client script works in a real browser", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const out = runProbe(chrome, buildPage());

  assert.deepEqual(out.errors, []);
  assert.equal(out.otherPanelShown, true);
  // Three panels: stages 11 and 12 plus the stage 13 preview; one shows at a time.
  assert.equal(out.hiddenPanels, 2);
  assert.equal(out.activeChip, "11");
  assert.equal(out.units, "imperial");
  assert.equal(out.distance, "103.5 mi");
  assert.equal(out.storedUnits, "imperial");
  // Stage 12 and the stage 13 preview both carry a measured profile (the preview is
  // seeded from data/stage-profiles.json), and the preference applies to every one.
  assert.equal(out.expanded, 2);
  assert.equal(out.toggleLabel, "Collapse profile");
  assert.equal(out.storedView, "expanded");
  assert.equal(out.imperialAxisVisible, true);
  assert.equal(out.metricAxisVisible, false);
  assert.equal(out.previewShown, true);
  assert.equal(out.previewChipActive, true);
  assert.equal(out.previewChipSelected, "true");
  assert.equal(out.rowActive, true);
  assert.equal(out.resultPanelsHidden, true);
  assert.equal(out.chipAgainStillShown, true);
  assert.equal(out.backToResult, true);
  assert.equal(out.rowInactive, true);
  assert.equal(out.lateExpanded, true);
  assert.equal(out.lateDistance, "103.5 mi");
});

// A phone never gets the expanded chart: the trace is too flat to read at that width
// and the start and finish towns collide with the caption. The control is hidden and a
// choice remembered from a wider screen is not applied, though it is not forgotten.
test("phones keep stage profiles compact even when expansion is remembered", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const probe = `
    const out = { errors: window.__errors };
    out.width = window.innerWidth;
    out.expanded = document.querySelectorAll('.stage-profile.is-expanded').length;
    out.measured = document.querySelectorAll('.stage-profile.is-measured').length;
    out.buttonVisible = getComputedStyle(document.querySelector('[data-profile-toggle]')).display !== 'none';
    out.endMarkerVisible = getComputedStyle(document.querySelector('.stage-profile-end')).display !== 'none';
    out.storedView = localStorage.getItem('pcr-profile-view');
    document.getElementById('smoke').textContent = JSON.stringify(out);
  `;
  const out = runProbe(
    chrome,
    buildPage({ probe, setup: "localStorage.setItem('pcr-profile-view', 'expanded');" }),
    ["--window-size=390,844"],
  );

  assert.deepEqual(out.errors, []);
  assert.ok(out.width <= 720, `phone run rendered at ${out.width}px`);
  assert.equal(out.measured, 2);
  assert.equal(out.expanded, 0);
  assert.equal(out.buttonVisible, false);
  assert.equal(out.endMarkerVisible, false);
  assert.equal(out.storedView, "expanded");
});
