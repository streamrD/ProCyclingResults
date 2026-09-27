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
    `${serverSource.slice(0, serverSource.indexOf(listenMarker))}\n;globalThis.__SMOKE__ = { buildStageSwitcherMarkup, buildRaceNewsMarkup, buildJerseyHoldersMarkup, buildSiteContentPage, buildRaceCard, buildStageRaceCard, buildNationalChampionshipsSection, parseNationalChampionshipsIndex };`,
    sandbox,
  );
  return {
    buildStageSwitcherMarkup: sandbox.__SMOKE__.buildStageSwitcherMarkup,
    buildRaceNewsMarkup: sandbox.__SMOKE__.buildRaceNewsMarkup,
    buildJerseyHoldersMarkup: sandbox.__SMOKE__.buildJerseyHoldersMarkup,
    buildSiteContentPage: sandbox.__SMOKE__.buildSiteContentPage,
    buildRaceCard: sandbox.__SMOKE__.buildRaceCard,
    buildStageRaceCard: sandbox.__SMOKE__.buildStageRaceCard,
    buildNationalChampionshipsSection: sandbox.__SMOKE__.buildNationalChampionshipsSection,
    parseNationalChampionshipsIndex: sandbox.__SMOKE__.parseNationalChampionshipsIndex,
    // The stylesheet and the homepage client script are the files the server inlines
    // (assets/site.css and assets/site.js since 2026-09-27); the deferred-group list
    // the script reads is a JSON element this page does not carry, so it sees none.
    style: fs.readFileSync(path.join(__dirname, "..", "assets", "site.css"), "utf8").replace(/@font-face\s*\{[^}]*\}/g, ""),
    script: fs.readFileSync(path.join(__dirname, "..", "assets", "site.js"), "utf8"),
  };
}

function buildPage({ probe: customProbe, setup = "", markup = "" } = {}) {
  const { buildStageSwitcherMarkup, buildRaceNewsMarkup, style, script } = loadServer();
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
  const news = buildRaceNewsMarkup(race, {
    articles: [
      { title: "Van Aert wins Vuelta stage 13 as the breakaway holds off the peloton on a scorching day into Loja", publisher: "Reuters", url: "https://example.com/a", publishedAt: "Fri, 04 Sep 2026 08:38:00 GMT", score: 50 },
      { title: "Van Aert powers to victory", publisher: "BBC", url: "https://example.com/b", publishedAt: "Fri, 04 Sep 2026 10:00:00 GMT", score: 40 },
    ],
  });
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

    const newsToggle = document.querySelector('[data-race-news-toggle]');
    out.newsClosed = document.querySelector('.race-news-drawer').hidden;
    newsToggle.click();
    out.newsOpen = !document.querySelector('.race-news-drawer').hidden && newsToggle.getAttribute('aria-expanded') === 'true';
    out.newsItems = document.querySelectorAll('.race-news-list li').length;
    // A narrow recent-results card must not widen to the headline: nothing may
    // overflow the card with the list open.
    const narrow = document.getElementById('narrow');
    out.newsOverflow = Math.max(narrow.scrollWidth - narrow.clientWidth, document.querySelector('.race-news').getBoundingClientRect().right - narrow.getBoundingClientRect().right);
    newsToggle.click();
    out.newsClosedAgain = document.querySelector('.race-news-drawer').hidden;

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
<main>${markup}${switcher}<article class="card" id="narrow" style="width: 300px">${news}</article></main><pre id="smoke"></pre>
<script>${script}</script>
<script>${customProbe || probe}</script>`;
}

// Chrome's own answer to "(hover: hover)" varies by headless build, so a test that
// depends on it says which one it wants.
const HOVER_ON = "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
const HOVER_OFF = "--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2";

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

// Headless Chrome lays a page out at 500px wide at the narrowest, whatever
// --window-size asks for (measured on this machine in both headless modes on
// 2026-09-26), so a true phone width needs the page hosted in a 390px iframe. The
// probe runs in the host page and reads the frame's DOM, which
// --allow-file-access-from-files permits between two file:// documents.
function runFramedProbe(chrome, page, hostProbe, width = 390) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pcr-smoke-frame-"));
  fs.writeFileSync(path.join(dir, "frame.html"), page);
  fs.writeFileSync(
    path.join(dir, "host.html"),
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{display:block;width:${width}px;height:844px;border:0}</style>
<body><iframe id="f" src="frame.html"></iframe><pre id="smoke"></pre>
<script>document.getElementById('f').addEventListener('load', () => setTimeout(() => { ${hostProbe} }, 300));</script>`,
  );
  let dom = "";
  try {
    dom = execFileSync(
      chrome,
      ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=6000", `--window-size=${width + 110},844`, "--dump-dom", `file://${path.join(dir, "host.html")}`],
      { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const match = dom.match(/<pre id="smoke">([\s\S]*?)<\/pre>/);
  assert.ok(match && match[1].trim(), "the framed probe never reported: the frame did not load or the host could not read it");
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
  assert.equal(out.newsClosed, true);
  assert.equal(out.newsOpen, true);
  assert.equal(out.newsItems, 2);
  assert.ok(out.newsOverflow <= 0, `the news line overflows a narrow card by ${out.newsOverflow}px`);
  assert.equal(out.newsClosedAgain, true);
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

// The refresh button asks the server first. When the server's copy is the one already
// on screen it must say so and hand the button back, never reload into the same page.
test("the refresh button reports when there is nothing newer instead of reloading", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const markup = `<div class="updated-row"><div class="updated">Updated now</div>
    <button type="button" class="refresh-button" data-refresh-button data-fetched-at="2026-09-06T15:32:07.658Z"><span data-refresh-label>Refresh results</span></button></div>
    <p class="refresh-status" data-refresh-status hidden></p>`;
  const setup = `
    window.__fetches = [];
    window.fetch = (url, options) => {
      window.__fetches.push({ url, cache: options && options.cache });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
        fetchedAt: "2026-09-06T15:32:07.658Z", ageMs: 4 * 60000, ttlMs: 15 * 60000, nextRebuildDueMs: 11 * 60000, rebuilding: false,
      }) });
    };
  `;
  const probe = `
    const out = { errors: window.__errors };
    const button = document.querySelector('[data-refresh-button]');
    const status = document.querySelector('[data-refresh-status]');
    // The timestamp is rewritten in the reader's own zone from the ISO stamp on the
    // button; the server's Eastern text is only the no-script fallback.
    out.updatedText = document.querySelector('.updated').textContent;
    out.updatedExpected = 'Updated ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-09-06T15:32:07.658Z'));
    button.click();
    out.busyLabel = button.querySelector('[data-refresh-label]').textContent;
    out.disabledWhileChecking = button.disabled;
    setTimeout(() => {
      out.fetches = window.__fetches;
      out.statusText = status.textContent;
      out.statusShown = !status.hidden;
      out.enabledAgain = !button.disabled && !button.classList.contains('is-busy');
      out.idleLabel = button.querySelector('[data-refresh-label]').textContent;
      document.getElementById('smoke').textContent = JSON.stringify(out);
    }, 100);
  `;
  const out = runProbe(chrome, buildPage({ probe, setup, markup }));

  assert.deepEqual(out.errors, []);
  assert.notEqual(out.updatedText, "Updated now");
  assert.ok(out.updatedText.startsWith(out.updatedExpected + " "), `timestamp in the reader's zone: ${out.updatedText}`);
  assert.doesNotMatch(out.updatedText, /Eastern Time/);
  assert.equal(out.busyLabel, "Checking for newer results…");
  assert.equal(out.disabledWhileChecking, true);
  assert.deepEqual(out.fetches, [{ url: "/api/data-status", cache: "no-store" }]);
  assert.equal(out.statusShown, true);
  assert.equal(out.statusText, "You already have the latest results. Built 4 minutes ago; the next rebuild is due in about 11 minutes.");
  assert.equal(out.enabledAgain, true);
  assert.equal(out.idleLabel, "Refresh results");
});

test("the jersey list opens its contenders card on hover", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const { buildJerseyHoldersMarkup } = loadServer();
  const race = {
    stageRace: {
      generalClassification: { stageNumber: 18, standings: [{ place: "1", rider: "Enric Mas" }] },
      classificationLeaders: {
        stageNumber: 18,
        stageLabel: "Stage 18",
        entries: [
          {
            key: "points",
            label: "Points",
            jersey: "dark green",
            rider: "Wout van Aert",
            countryCode: "BEL",
            contenders: {
              stageNumber: 17,
              metric: "count",
              metricLabel: "Points",
              entries: [
                { place: "1", rider: "Wout van Aert", countryCode: "BEL", value: "295" },
                { place: "2", rider: "Matthew Brennan", countryCode: "GBR", value: "239" },
                { place: "3", rider: "Alessandro Romele", countryCode: "ITA", value: "171" },
                { place: "4", rider: "Bryan Coquard", countryCode: "FRA", value: "141" },
                { place: "5", rider: "Jordi Meeus", countryCode: "BEL", value: "116" },
              ],
            },
          },
          { key: "polish-rider", label: "Polish rider", rider: "Filip Gruszczyński" },
        ],
      },
    },
  };
  const probe = `
    const out = { errors: window.__errors };
    const hover = (node, type) => node.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    out.hoverMedia = matchMedia('(hover: hover)').matches;
    out.plainLabels = document.querySelectorAll('.jersey-classification:not(.has-contenders)').length;
    out.cursor = getComputedStyle(document.querySelector('[data-jersey-contenders]')).cursor;

    hover(document.querySelector('[data-jersey-contenders]'), 'mouseover');
    setTimeout(() => {
      const card = document.querySelector('body > .jersey-card');
      out.opened = Boolean(card);
      out.name = card && card.querySelector('.jersey-card-name').textContent;
      out.kicker = card && [...card.querySelectorAll('.jersey-card-kicker span')].map((span) => span.textContent);
      out.rows = card ? card.querySelectorAll('.contender-row').length : 0;
      out.first = card && card.querySelector('.contender-row').textContent;
      // Fixed to the viewport and inside it, whatever the card it sits in clips.
      const box = card && card.getBoundingClientRect();
      out.position = card && getComputedStyle(card).position;
      out.onScreen = Boolean(box && box.left >= 0 && box.right <= window.innerWidth && box.top >= 0);
      // Nothing opens for a classification the article has no standings table for.
      hover(document.querySelector('[data-jersey-contenders]'), 'mouseout');
      hover([...document.querySelectorAll('.jersey-classification')].find((node) => node.textContent === 'Polish rider'), 'mouseover');
      setTimeout(() => {
        out.closed = !document.querySelector('body > .jersey-card');
        // The swatch opens the same card, and moving from it to the label keeps it.
        const swatch = document.querySelector('[data-jersey-contenders-swatch]');
        out.swatchCursor = getComputedStyle(swatch).cursor;
        hover(swatch, 'mouseover');
        setTimeout(() => {
          const viaSwatch = document.querySelector('body > .jersey-card');
          out.swatchOpened = viaSwatch && viaSwatch.querySelector('.jersey-card-name').textContent;
          hover(swatch, 'mouseout');
          hover(document.querySelector('[data-jersey-contenders]'), 'mouseover');
          setTimeout(() => {
            out.keptAcross = document.querySelector('body > .jersey-card') === viaSwatch;
            document.getElementById('smoke').textContent = JSON.stringify(out);
          }, 400);
        }, 400);
      }, 400);
    }, 400);
  `;
  // Whether a headless Chrome reports "(hover: hover)" depends on the build — this
  // machine's says yes, the CI runner's says no — and the card is gated on it. Both
  // hover types are forced here so the test exercises the same path everywhere, and
  // the phone path is asserted below rather than left to the runner's default.
  const page = buildPage({ markup: `<article class="card">${buildJerseyHoldersMarkup(race)}</article>`, probe });
  const out = runProbe(chrome, page, [HOVER_ON]);

  assert.deepEqual(out.errors, []);
  assert.equal(out.hoverMedia, true);
  assert.equal(out.plainLabels, 1);
  assert.equal(out.opened, true);
  assert.equal(out.name, "Points classification");
  assert.deepEqual(out.kicker, ["Top five after stage 17", "Points"]);
  assert.equal(out.rows, 5);
  assert.equal(out.first, "1🇧🇪Wout van Aert295");
  assert.equal(out.position, "fixed");
  assert.equal(out.onScreen, true);
  assert.equal(out.closed, true);
  assert.equal(out.swatchCursor, "help");
  assert.equal(out.swatchOpened, "Points classification");
  assert.equal(out.keptAcross, true);

  // A phone never gets the floating card from a hover it cannot make, but the label is
  // a button and a tap opens the same top five inline under the list (since
  // 2026-09-26; before, a phone reader saw only each jersey's leader).
  const touch = runProbe(chrome, page, [HOVER_OFF]);

  assert.deepEqual(touch.errors, []);
  assert.equal(touch.hoverMedia, false);
  assert.equal(touch.opened, false);
  assert.equal(touch.cursor, "pointer");
  assert.equal(touch.swatchCursor, "auto");

  const tapProbe = `
    const out = { errors: window.__errors };
    const label = document.querySelector('[data-jersey-contenders]');
    out.tag = label.tagName.toLowerCase();
    out.gloss = label.getAttribute('title');
    label.click();
    const inline = document.querySelector('.jersey-holders [data-jersey-inline]');
    out.inlineOpened = Boolean(inline);
    out.inlineRows = inline ? inline.querySelectorAll('.contender-row').length : 0;
    out.inlineName = inline && inline.querySelector('.jersey-card-name').textContent;
    out.expanded = label.getAttribute('aria-expanded');
    out.afterList = inline && inline.previousElementSibling.classList.contains('jersey-list');
    out.floating = document.querySelectorAll('body > .jersey-card').length;
    // Inline means inside the card's column, not past it.
    const card = document.querySelector('article.card');
    out.fits = inline ? inline.getBoundingClientRect().right <= card.getBoundingClientRect().right : false;
    // The swatch opens the same panel; the label closes it again; Escape closes too.
    label.click();
    out.closedAgain = !document.querySelector('[data-jersey-inline]');
    out.collapsed = label.getAttribute('aria-expanded');
    document.querySelector('[data-jersey-contenders-swatch]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    out.viaSwatch = Boolean(document.querySelector('[data-jersey-inline]'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.escaped = !document.querySelector('[data-jersey-inline]');
    document.getElementById('smoke').textContent = JSON.stringify(out);
  `;
  const tap = runProbe(chrome, buildPage({ markup: `<article class="card">${buildJerseyHoldersMarkup(race)}</article>`, probe: tapProbe }), [HOVER_OFF, "--window-size=390,844"]);

  assert.deepEqual(tap.errors, []);
  assert.equal(tap.tag, "button");
  assert.equal(tap.gloss, "Points: sprint and intermediate points");
  assert.equal(tap.inlineOpened, true);
  assert.equal(tap.inlineRows, 5);
  assert.equal(tap.inlineName, "Points classification");
  assert.equal(tap.expanded, "true");
  assert.equal(tap.afterList, true);
  assert.equal(tap.floating, 0);
  assert.equal(tap.fits, true);
  assert.equal(tap.closedAgain, true);
  assert.equal(tap.collapsed, "false");
  assert.equal(tap.viaSwatch, true);
  assert.equal(tap.escaped, true);
});

test("a picture on a site page fills the window on a click and goes back on the next one", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  // The real page, not a stand-in: runProbe writes whatever HTML it is handed, so the
  // about page is driven exactly as it ships, with its own script and stylesheet.
  const { buildSiteContentPage } = loadServer();
  const markdown = [
    "![Five people who do not exist](/assets/gruppetto.jpg)",
    "",
    "*The caption.*",
    "",
    "Some prose to double-click near.",
  ].join("\n");
  const page = buildSiteContentPage("about", markdown, { editable: false }).replace(
    "</body>",
    `<pre id="smoke"></pre>
<script>
  const out = { errors: [] };
  window.addEventListener('error', (event) => out.errors.push(event.message));
  const fire = (node, type) => node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  const image = document.querySelector('.site-figure img');
  out.startingOverlays = document.querySelectorAll('.site-figure-full').length;

  // One click opens it, and that same click must not carry on to the handler that
  // closes it.
  fire(image, 'click');
  const overlay = document.querySelector('.site-figure-full');
  out.opened = Boolean(overlay);
  // Assigning .src resolves it, so compare the resolved address, not the attribute.
  out.sameImage = overlay && overlay.querySelector('img').src === image.src;
  out.imagePath = new URL(image.src).pathname;
  out.altKept = overlay && overlay.querySelector('img').alt;
  out.covers = overlay
    ? (() => {
        const box = overlay.getBoundingClientRect();
        return box.width === window.innerWidth && box.height === window.innerHeight;
      })()
    : false;
  // Edge to edge: no padding holding the picture off the window.
  out.imageFills = overlay
    ? (() => {
        const box = overlay.querySelector('img').getBoundingClientRect();
        return box.width === window.innerWidth && box.height === window.innerHeight;
      })()
    : false;
  out.ground = overlay && getComputedStyle(overlay).backgroundColor;
  out.scrollLocked = getComputedStyle(document.documentElement).overflow === 'hidden';
  out.dialog = overlay && overlay.getAttribute('role');

  fire(document.body, 'click');
  out.closed = !document.querySelector('.site-figure-full');
  out.scrollFree = getComputedStyle(document.documentElement).overflow !== 'hidden';

  // Escape closes it too, and clicking ordinary prose opens nothing.
  fire(image, 'click');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  out.escapeClosed = !document.querySelector('.site-figure-full');
  fire(document.querySelector('.site-prose p:last-of-type'), 'click');
  out.proseOpensNothing = !document.querySelector('.site-figure-full');

  // Reopened, a click on the picture itself closes it like any other.
  fire(image, 'click');
  out.reopened = Boolean(document.querySelector('.site-figure-full'));
  fire(document.querySelector('.site-figure-full img'), 'click');
  out.closedFromInside = !document.querySelector('.site-figure-full');

  document.getElementById('smoke').textContent = JSON.stringify(out);
</script>
</body>`,
  );
  const out = runProbe(chrome, page);

  assert.deepEqual(out.errors, []);
  assert.equal(out.startingOverlays, 0);
  assert.equal(out.opened, true);
  assert.equal(out.sameImage, true);
  assert.equal(out.imagePath, "/assets/gruppetto.jpg");
  assert.equal(out.altKept, "Five people who do not exist");
  assert.equal(out.covers, true);
  assert.equal(out.imageFills, true);
  // A neutral near-black, not the site blue it started as.
  assert.equal(out.ground, "rgb(16, 14, 12)");
  assert.equal(out.scrollLocked, true);
  assert.equal(out.dialog, "dialog");
  assert.equal(out.closed, true);
  assert.equal(out.scrollFree, true);
  assert.equal(out.escapeClosed, true);
  assert.equal(out.proseOpensNothing, true);
  assert.equal(out.reopened, true);
  assert.equal(out.closedFromInside, true);
});

// A true 390px phone width, which needs the framed probe: nothing in the National
// Championships section may run past the right edge, where the section's overflow
// clip would cut it mid-word (assessment A2, 2026-09-26; the cause was the
// competition stack's implicit grid track). The results table scrolls sideways inside
// its own wrapper by design and is left out of the count.
test("the rows behind Load more, a linked card and the almanac are fetched on demand", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }

  const slot = (n) =>
    '<div class="recent-race-slot" data-recent-slot data-recent-race-id="2026 Race ' + n + '" data-recent-anchor="race-2026-race-' + n + '" data-recent-race-title="Race ' + n + '" data-recent-race-date="June ' + n + '"><article class="card" id="race-2026-race-' + n + '">Race ' + n + '</article></div>';
  const anchors = JSON.stringify([1, 2, 3, 4, 5, 6, 7].map((n) => "race-2026-race-" + n)).replace(/"/g, "&quot;");
  const markup = `
    <section class="section season-section is-expanded" id="season-calendar" data-season-calendar data-fragment-src="/api/season-calendar" hidden><div class="season-head"><h2>Loading the calendar…</h2></div></section>
    <div class="competition-block" data-recent-block="mens-worldtour" data-recent-step="3" data-recent-total="7" data-recent-anchors="${anchors}">
      <div class="grid competition-grid">${slot(1)}${slot(2)}${slot(3)}</div>
      <button type="button" class="load-more-races" data-load-more-races="mens-worldtour">Load more races</button>
    </div>
    <section class="section national-section" id="national-championships" data-fragment-src="/api/national-championships"><h2>National Championships</h2><p data-fragment-status>Loading…</p></section>`;
  const setup = `
    window.__fetches = [];
    window.fetch = (url) => {
      window.__fetches.push(url);
      const params = new URL(url, "http://x").searchParams;
      let body = {};
      if (url.indexOf("/api/recent-races") === 0) {
        const after = Number((params.get("after") || "race-2026-race-0").slice(-1));
        const until = params.get("until") ? Number(params.get("until").slice(-1)) : 0;
        const end = until ? Math.ceil(until / 3) * 3 : after + 3;
        let html = "";
        for (let n = after + 1; n <= Math.min(7, end); n += 1) {
          html += '<div class="recent-race-slot" data-recent-slot data-recent-anchor="race-2026-race-' + n + '"><article class="card" id="race-2026-race-' + n + '">Race ' + n + '</article></div>';
        }
        body = { html, done: end >= 7 };
      } else if (url.indexOf("/api/national-championships") === 0) {
        body = { html: '<section class="section national-section" id="national-championships" data-national-almanac><h2>National Championships</h2><div data-national-map></div></section>' };
      } else if (url.indexOf("/api/season-calendar") === 0) {
        body = { html: '<section class="section season-section is-expanded" id="season-calendar" data-season-calendar hidden><div class="season-head"><h2>Where we are in 2026</h2></div><a data-season-race-link href="#race-2026-race-7">Race 7</a><div class="season-tooltip" data-season-tooltip hidden></div></section>' };
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    };
  `;
  const probe = `
    const out = { errors: window.__errors };
    const button = document.querySelector('[data-load-more-races]');
    button.click();
    setTimeout(() => {
      out.afterFirstLoad = [...document.querySelectorAll('[data-recent-slot]')].map((s) => s.dataset.recentAnchor);
      out.buttonShown = !button.hidden;
      // Opening the calendar fetches it; its race link fetches the rows through race 7.
      window.location.hash = '#season-calendar';
      setTimeout(() => {
        const calendar = document.querySelector('[data-season-calendar]');
        out.calendarOpen = Boolean(calendar) && !calendar.hidden && calendar.textContent.indexOf('Where we are') >= 0;
        calendar.querySelector('[data-season-race-link]').click();
        setTimeout(() => {
          out.afterJump = [...document.querySelectorAll('[data-recent-slot]')].map((s) => s.dataset.recentAnchor);
          out.buttonHiddenAtEnd = button.hidden;
          out.flashed = document.getElementById('race-2026-race-7').classList.contains('is-calendar-target');
          out.almanacLoaded = Boolean(document.querySelector('#national-championships[data-national-almanac]'));
          out.fetches = window.__fetches;
          document.getElementById('smoke').textContent = JSON.stringify(out);
        }, 100);
      }, 100);
    }, 100);
  `;
  const out = runProbe(chrome, buildPage({ probe, setup, markup }));

  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.afterFirstLoad, [1, 2, 3, 4, 5, 6].map((n) => "race-2026-race-" + n));
  assert.equal(out.buttonShown, true);
  assert.equal(out.almanacLoaded, true, "the almanac stub is replaced as it is in view");
  assert.equal(out.calendarOpen, true);
  assert.deepEqual(out.afterJump, [1, 2, 3, 4, 5, 6, 7].map((n) => "race-2026-race-" + n));
  assert.equal(out.buttonHiddenAtEnd, true);
  assert.equal(out.flashed, true);
  assert.ok(out.fetches.includes("/api/recent-races?group=mens-worldtour&after=race-2026-race-3"), out.fetches.join(" "));
  assert.ok(out.fetches.includes("/api/recent-races?group=mens-worldtour&after=race-2026-race-6&until=race-2026-race-7"), out.fetches.join(" "));
});

test("a folded section header opens its panel on a tap and closes it on the next", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }
  const markup = `<article class="card result-card stage-race-card" id="race-x">
    <div class="card-subsection">
      <button type="button" class="detail-label detail-toggle" data-detail-toggle aria-expanded="false" aria-controls="race-x-jerseys">Final jersey winners<span class="detail-toggle-chevron" aria-hidden="true"></span></button>
      <ul class="jersey-list detail-panel" id="race-x-jerseys" hidden><li>General: Enric Mas</li></ul>
    </div></article>`;
  const probe = `
    const out = { errors: window.__errors };
    const toggle = document.querySelector('[data-detail-toggle]');
    const panel = document.getElementById('race-x-jerseys');
    out.hiddenAtStart = panel.hidden && getComputedStyle(panel).display === 'none';
    out.hitHeight = toggle.getBoundingClientRect().height;
    toggle.click();
    out.openAfterTap = !panel.hidden && getComputedStyle(panel).display !== 'none' && toggle.getAttribute('aria-expanded') === 'true';
    toggle.click();
    out.closedAgain = panel.hidden && toggle.getAttribute('aria-expanded') === 'false';
    document.getElementById('smoke').textContent = JSON.stringify(out);
  `;
  const out = runProbe(chrome, buildPage({ probe, markup }));
  assert.deepEqual(out.errors, []);
  assert.equal(out.hiddenAtStart, true);
  assert.ok(out.hitHeight >= 30, `the header is a comfortable tap target: ${out.hitHeight}px`);
  assert.equal(out.openAfterTap, true);
  assert.equal(out.closedAgain, true);
});

test("a finished card's folded stage results are fetched on first open, once, and retried after a failure", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }
  const markup = `<article class="card result-card stage-race-card" id="race-x">
    <div class="card-subsection stage-switcher" data-stage-switcher>
      <button type="button" class="detail-label detail-toggle" data-detail-toggle aria-expanded="false" aria-controls="race-x-stages">Stage results (21 stages)<span class="detail-toggle-chevron" aria-hidden="true"></span></button>
      <div class="detail-panel" id="race-x-stages" hidden data-stage-results-src="2026 Race X">
        <p class="stage-panel-meta" data-stage-results-status>Loading stage results…</p>
      </div>
    </div></article>`;
  const setup = `
    window.__fetches = [];
    window.__failNext = true;
    window.fetch = (url) => {
      window.__fetches.push(url);
      if (window.__failNext) {
        window.__failNext = false;
        return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
        html: '<div class="stage-strip" role="tablist"><button type="button" class="stage-chip is-active" data-stage-target="race-x-stage-21">21</button></div><div data-stage-panel id="race-x-stage-21">Stage 21 panel</div>',
      }) });
    };
  `;
  const probe = `
    const out = { errors: window.__errors };
    const toggle = document.querySelector('[data-detail-toggle]');
    const panel = document.getElementById('race-x-stages');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    (async () => {
      toggle.click();
      await wait(50);
      out.failureText = panel.textContent.trim();
      toggle.click();
      toggle.click();
      await wait(50);
      out.filled = Boolean(panel.querySelector('[data-stage-panel]')) && !panel.hidden;
      toggle.click();
      toggle.click();
      await wait(50);
      out.fetches = window.__fetches;
      document.getElementById('smoke').textContent = JSON.stringify(out);
    })();
  `;
  const out = runProbe(chrome, buildPage({ probe, setup, markup }));
  assert.deepEqual(out.errors, []);
  assert.match(out.failureText, /could not be loaded/);
  assert.equal(out.filled, true);
  // One failed try, one success, and nothing on the third open.
  assert.deepEqual(out.fetches, ["/api/stage-results?race=2026+Race+X", "/api/stage-results?race=2026+Race+X"]);
});

test("the National Championships section fits a true 390px phone width", (t) => {
  const chrome = findChrome();
  if (!chrome) {
    t.skip("no Chrome found; set CHROME_PATH to run the browser smoke test");
    return;
  }
  const { buildNationalChampionshipsSection, parseNationalChampionshipsIndex } = loadServer();
  const index = fs.readFileSync(path.join(__dirname, "fixtures", "cyclingnews-2026-road-national-champions-index.html"), "utf8");
  const section = buildNationalChampionshipsSection({ ...parseNationalChampionshipsIndex(index), sourceUrl: "https://example.test/index" });
  assert.match(section, /id="national-championships"/);
  const page = buildPage({ markup: section, probe: "document.getElementById('smoke').textContent = JSON.stringify({ errors: window.__errors });" });
  const out = runFramedProbe(
    chrome,
    page,
    `
    const d = document.getElementById('f').contentDocument;
    const width = d.documentElement.clientWidth;
    const past = [].filter.call(d.querySelectorAll('#national-championships *'), (e) => {
      const box = e.getBoundingClientRect();
      return !e.closest('.national-table-wrap') && box.width > 0 && box.right > width + 1;
    });
    const label = (e) => e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || '').split(' ')[0];
    document.getElementById('smoke').textContent = JSON.stringify({ width, past: past.length, sample: past.slice(0, 6).map(label) });
  `,
  );
  // Linux Chrome reserves 15px for the frame's scrollbar even when hidden on some builds,
  // so the layout width is 375 there and 390 on a Mac; both are phone widths.
  assert.ok(out.width >= 375 && out.width <= 390, `the frame lays the page out at a phone width, got ${out.width}`);
  assert.equal(out.past, 0, `elements past the right edge at 390px: ${JSON.stringify(out.sample)}`);
});
