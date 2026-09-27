const deferredSectionState = new Map();
// The deferred groups are embedded as JSON by buildHtmlPage (id "deferred-groups"),
// so this file has no server-side expression in it.
const deferredGroups = JSON.parse((document.getElementById("deferred-groups") || {}).textContent || "[]");

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

function bindNationalChampionshipFilters() {
  const root = document.querySelector("[data-national-almanac]");
  if (!root) {
    return;
  }
  const search = root.querySelector("[data-national-search]");
  const groups = Array.prototype.slice.call(root.querySelectorAll("[data-national-group]"));
  const chips = Array.prototype.slice.call(root.querySelectorAll("[data-national-category]"));
  const includeToggle = root.querySelector("[data-national-include-empty]");
  const emptyState = root.querySelector("[data-national-empty-state]");
  const state = { query: "", category: "", includeEmpty: false };

  const rowMatches = (row) => {
    const champions = row.dataset.champions || "";
    if (!state.includeEmpty && champions === "") {
      return false;
    }
    if (state.category && champions.split(" ").indexOf(state.category) < 0) {
      return false;
    }
    return !state.query || (row.dataset.search || "").indexOf(state.query) >= 0;
  };

  const applyFilters = () => {
    const filtering = Boolean(state.query || state.category);
    let totalVisible = 0;
    root.dataset.category = state.category;
    root.dataset.includeEmpty = state.includeEmpty ? "1" : "0";
    groups.forEach((group) => {
      const rows = Array.prototype.slice.call(group.querySelectorAll("[data-national-row]"));
      let visible = 0;
      rows.forEach((row) => {
        const show = rowMatches(row);
        row.hidden = !show;
        if (show) {
          visible += 1;
        }
      });
      totalVisible += visible;
      group.hidden = filtering && visible === 0;
      const counter = group.querySelector("[data-national-group-visible]");
      if (counter) {
        counter.textContent = filtering && visible > 0 ? " · " + visible + " match" + (visible === 1 ? "" : "es") : "";
      }
      if (state.query) {
        group.open = visible > 0;
      }
    });
    if (emptyState) {
      emptyState.hidden = totalVisible !== 0;
    }
  };

  if (search) {
    let lastQuery = "";
    search.addEventListener("input", () => {
      state.query = search.value.trim().toLowerCase();
      if (lastQuery && !state.query) {
        groups.forEach((group) => {
          group.open = false;
        });
      }
      lastQuery = state.query;
      applyFilters();
    });
  }
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.category = chip.dataset.nationalCategory || "";
      chips.forEach((other) => {
        const active = other === chip;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", active ? "true" : "false");
      });
      applyFilters();
    });
  });
  if (includeToggle) {
    includeToggle.addEventListener("click", () => {
      state.includeEmpty = !state.includeEmpty;
      includeToggle.classList.toggle("is-active", state.includeEmpty);
      includeToggle.setAttribute("aria-pressed", state.includeEmpty ? "true" : "false");
      applyFilters();
    });
  }
  applyFilters();
}

// National Championships map: hovering a continent shows its count, clicking or
// pressing Enter opens that continent's table below and marks it on the map. The
// map is hidden on phones, where the grouped list stands on its own.
function bindNationalChampionshipMap() {
  const root = document.querySelector("[data-national-almanac]");
  const map = root ? root.querySelector("[data-national-map]") : null;
  if (!root || !map) {
    return;
  }
  const tooltip = map.querySelector("[data-national-map-tooltip]");
  const continents = Array.prototype.slice.call(map.querySelectorAll("[data-national-map-continent]"));
  const groups = Array.prototype.slice.call(root.querySelectorAll("[data-national-group]"));

  const groupFor = (id) =>
    groups.find((group) => group.dataset.nationalGroupId === id) || null;

  const markActive = () => {
    continents.forEach((continent) => {
      const group = groupFor(continent.dataset.nationalMapContinent);
      continent.classList.toggle("is-active", Boolean(group && group.open && !group.hidden));
    });
  };

  const showTooltip = (continent, event) => {
    if (!tooltip) {
      return;
    }
    tooltip.textContent = "";
    const title = document.createElement("strong");
    title.textContent = continent.dataset.tipTitle || "";
    const detail = document.createElement("span");
    detail.textContent = continent.dataset.tipDetail || "";
    const hint = document.createElement("span");
    hint.textContent = "Click to open";
    tooltip.appendChild(title);
    tooltip.appendChild(detail);
    tooltip.appendChild(hint);
    tooltip.hidden = false;
    const mapBox = map.getBoundingClientRect();
    const tipBox = tooltip.getBoundingClientRect();
    let anchorX;
    let anchorY;
    if (event && typeof event.clientX === "number" && event.type !== "focus") {
      anchorX = event.clientX - mapBox.left;
      anchorY = event.clientY - mapBox.top;
    } else {
      const box = continent.getBoundingClientRect();
      anchorX = box.left - mapBox.left + box.width / 2;
      anchorY = box.top - mapBox.top + box.height / 2;
    }
    let left = anchorX - tipBox.width / 2;
    left = Math.max(8, Math.min(left, mapBox.width - tipBox.width - 8));
    let top = anchorY - tipBox.height - 16;
    if (top < 0) {
      top = anchorY + 20;
    }
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  };
  const hideTooltip = () => {
    if (tooltip) {
      tooltip.hidden = true;
    }
  };

  const openContinent = (continent) => {
    const group = groupFor(continent.dataset.nationalMapContinent);
    if (!group) {
      return;
    }
    // Picking a continent on the map means "show me this one": any other open
    // group folds away so the chosen table sits directly under the map.
    groups.forEach((other) => {
      if (other !== group) {
        other.open = false;
      }
    });
    group.open = true;
    group.classList.add("is-map-target");
    window.setTimeout(() => {
      group.classList.remove("is-map-target");
    }, 2400);
    markActive();
    group.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  continents.forEach((continent) => {
    continent.addEventListener("mouseenter", (event) => showTooltip(continent, event));
    continent.addEventListener("mousemove", (event) => showTooltip(continent, event));
    continent.addEventListener("mouseleave", hideTooltip);
    continent.addEventListener("focus", (event) => showTooltip(continent, event));
    continent.addEventListener("blur", hideTooltip);
    continent.addEventListener("click", () => openContinent(continent));
    continent.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openContinent(continent);
      }
    });
  });
  groups.forEach((group) => {
    group.addEventListener("toggle", markActive);
  });
  markActive();
}

// A share path such as /championships serves this same page with its own link
// preview; once loaded it jumps to the section and settles on the /#section URL.
// The calendar path is handled by bindSeasonCalendar, which opens the section.
// The refresh button beside the timestamp. A reload on its own can return the same
// copy the visitor already has, because the server serves one in-memory payload
// until it expires; a tab restored hours later, on the other hand, never asked the
// server at all. So the button asks /api/data-status first: a newer copy means
// reload now, a rebuild in progress means wait for it (bounded), and nothing newer
// means say so instead of pretending. It never triggers an upstream fetch itself.
function bindRefreshButton() {
  const button = document.querySelector("[data-refresh-button]");
  const status = document.querySelector("[data-refresh-status]");
  if (!button || !status) {
    return;
  }
  const label = button.querySelector("[data-refresh-label]");
  const idleText = label ? label.textContent : "";
  const REBUILD_WAIT_MS = 45000;
  const POLL_MS = 2500;

  const setBusy = (text) => {
    button.disabled = true;
    button.classList.add("is-busy");
    if (label) {
      label.textContent = text;
    }
  };
  const setIdle = () => {
    button.disabled = false;
    button.classList.remove("is-busy");
    if (label) {
      label.textContent = idleText;
    }
  };
  const say = (text) => {
    status.textContent = text;
    status.hidden = !text;
  };
  const describeMinutes = (ms) => {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) {
      return "under a minute";
    }
    return minutes === 1 ? "1 minute" : minutes + " minutes";
  };
  const reload = () => {
    window.location.reload();
  };
  const fetchStatus = async () => {
    const response = await fetch("/api/data-status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("status " + response.status);
    }
    return response.json();
  };

  button.addEventListener("click", async () => {
    if (button.disabled) {
      return;
    }
    const shownAt = button.getAttribute("data-fetched-at") || "";
    say("");
    setBusy("Checking for newer results…");
    try {
      let info = await fetchStatus();
      if (info.status === "warming" || (info.fetchedAt && info.fetchedAt !== shownAt)) {
        reload();
        return;
      }
      if (info.rebuilding) {
        setBusy("Newer results are being prepared…");
        const deadline = Date.now() + REBUILD_WAIT_MS;
        while (Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
          info = await fetchStatus();
          if (info.fetchedAt && info.fetchedAt !== shownAt) {
            reload();
            return;
          }
          if (!info.rebuilding) {
            break;
          }
        }
      }
      const age = typeof info.ageMs === "number" ? "Built " + describeMinutes(info.ageMs) + " ago" : "";
      const due =
        typeof info.nextRebuildDueMs === "number"
          ? info.rebuilding
            ? "a rebuild is still running; try again shortly"
            : "the next rebuild is due in about " + describeMinutes(info.nextRebuildDueMs)
          : "";
      say(
        "You already have the latest results." +
          (age ? " " + age + (due ? "; " + due : "") + "." : ""),
      );
    } catch (error) {
      // The status check failed (offline, or the server restarting): a plain reload
      // is still the most useful thing to do.
      reload();
      return;
    }
    setIdle();
  });
}

function bindShareJump() {
  const jump = document.body.dataset.jumpTo;
  if (!jump || jump === "season-calendar") {
    return;
  }
  const target = document.getElementById(jump);
  if (!target) {
    return;
  }
  window.history.replaceState(null, "", "/#" + jump);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Season calendar: hidden until the hero button or a #season-calendar link opens it,
// so the day's results stay first. It closes from its own header, bars carry their
// own tooltip, and a click on a race whose card is hidden behind "Load more races"
// reveals it before the browser jumps.
// history.replaceState refuses a file:// document (the smoke test's) and some
// embedded viewers; the address is a nicety, never worth an exception.
function replaceAddress(url) {
  try {
    window.history.replaceState(null, "", url);
  } catch (error) {
    // Leave the address as it is.
  }
}

function bindSeasonCalendar() {
  let section = document.querySelector("[data-season-calendar]");
  if (!section) {
    return;
  }

  // The page carries a stub; the calendar itself arrives from data-fragment-src the
  // first time it is opened and is bound then (S3, 2026-09-27).
  let loaded = section.dataset.fragmentSrc ? null : Promise.resolve(section);
  const ensureCalendar = () => {
    if (!loaded) {
      loaded = fetch(section.dataset.fragmentSrc, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Unable to load the calendar");
          }
          return response.json();
        })
        .then((payload) => {
          const holder = document.createElement("div");
          holder.innerHTML = payload.html || "";
          const fresh = holder.firstElementChild;
          if (!fresh || !fresh.matches("[data-season-calendar]")) {
            throw new Error("Unexpected calendar markup");
          }
          section.replaceWith(fresh);
          section = fresh;
          bindSeasonCalendarSection(section);
          return section;
        })
        .catch((error) => {
          loaded = null;
          const heading = section.querySelector("h2");
          if (heading) {
            heading.textContent = "The calendar is unavailable right now";
          }
          throw error;
        });
    }
    return loaded;
  };

  const openCalendar = () => {
    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.location.hash !== "#season-calendar" || window.location.pathname !== "/") {
      replaceAddress("/#season-calendar");
    }
    ensureCalendar()
      .then((fresh) => {
        fresh.hidden = false;
        fresh.classList.add("is-expanded");
      })
      .catch(() => {});
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-season-open]"), (link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openCalendar();
    });
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#season-calendar") {
      openCalendar();
    }
  });
  if (!section.dataset.fragmentSrc) {
    bindSeasonCalendarSection(section);
  }
  if (window.location.hash === "#season-calendar" || document.body.dataset.jumpTo === "season-calendar") {
    openCalendar();
  }
}

// Everything inside the calendar section: full screen, close, the series chips, the
// bar tooltips and the jump to a race card. Bound once per section element.
function bindSeasonCalendarSection(section) {
  const tooltip = section.querySelector("[data-season-tooltip]");
  const fullscreenButton = section.querySelector("[data-season-fullscreen]");
  const fullscreenLabel = section.querySelector("[data-season-fullscreen-label]");
  const setFullscreen = (on) => {
    section.classList.toggle("is-fullscreen", on);
    document.documentElement.style.overflow = on ? "hidden" : "";
    if (fullscreenButton) {
      fullscreenButton.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (fullscreenLabel) {
      fullscreenLabel.textContent = on ? "Exit full screen" : "Full screen";
    }
    if (tooltip) {
      tooltip.hidden = true;
    }
    if (!on && !section.hidden) {
      section.scrollIntoView({ block: "start" });
    }
  };
  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", () => {
      setFullscreen(!section.classList.contains("is-fullscreen"));
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && section.classList.contains("is-fullscreen")) {
      setFullscreen(false);
    }
  });
  const seasonBody = section.querySelector(".season-body");
  if (seasonBody) {
    seasonBody.addEventListener("scroll", () => {
      if (tooltip) {
        tooltip.hidden = true;
      }
    }, { passive: true });
  }
  const closeCalendar = () => {
    if (section.classList.contains("is-fullscreen")) {
      setFullscreen(false);
    }
    section.hidden = true;
    if (window.location.hash === "#season-calendar" || window.location.pathname !== "/") {
      replaceAddress("/");
    }
  };

  Array.prototype.forEach.call(section.querySelectorAll("[data-season-close]"), (button) => {
    button.addEventListener("click", closeCalendar);
  });

  Array.prototype.forEach.call(section.querySelectorAll("[data-season-series]"), (chip) => {
    chip.addEventListener("click", () => {
      const wanted = chip.dataset.seasonSeries;
      Array.prototype.forEach.call(section.querySelectorAll("[data-season-series]"), (other) => {
        const active = other === chip;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", active ? "true" : "false");
      });
      Array.prototype.forEach.call(section.querySelectorAll("[data-season-view]"), (view) => {
        view.hidden = view.dataset.seasonView !== wanted;
      });
    });
  });

  const showTooltip = (bar) => {
    if (!tooltip) {
      return;
    }
    tooltip.textContent = "";
    const title = document.createElement("strong");
    title.textContent = bar.dataset.tipTitle || "";
    const dates = document.createElement("span");
    dates.textContent = bar.dataset.tipDates || "";
    const detail = document.createElement("span");
    detail.textContent = bar.dataset.tipDetail || "";
    tooltip.appendChild(title);
    tooltip.appendChild(dates);
    tooltip.appendChild(detail);
    tooltip.hidden = false;
    const sectionBox = section.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const tipBox = tooltip.getBoundingClientRect();
    let left = barBox.left - sectionBox.left + barBox.width / 2 - tipBox.width / 2;
    left = Math.max(8, Math.min(left, sectionBox.width - tipBox.width - 8));
    let top = barBox.top - sectionBox.top - tipBox.height - 10;
    if (top < 0) {
      top = barBox.bottom - sectionBox.top + 10;
    }
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  };
  const hideTooltip = () => {
    if (tooltip) {
      tooltip.hidden = true;
    }
  };
  Array.prototype.forEach.call(section.querySelectorAll("[data-season-bar]"), (bar) => {
    bar.addEventListener("mouseenter", () => showTooltip(bar));
    bar.addEventListener("mouseleave", hideTooltip);
    bar.addEventListener("focus", () => showTooltip(bar));
    bar.addEventListener("blur", hideTooltip);
  });

  section.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-season-bar], a[data-season-race-link]");
    if (!link) {
      return;
    }
    const href = link.getAttribute("href") || "";
    if (href.charAt(0) !== "#") {
      return;
    }
    event.preventDefault();
    revealRaceCard(href.slice(1)).then((target) => {
      if (!target) {
        return;
      }
      // The card sits behind the full-screen layer, so step out before the jump.
      if (section.classList.contains("is-fullscreen")) {
        setFullscreen(false);
      }
      replaceAddress("/" + href);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      flashRaceCard(target);
    });
  });
}

function getRecentBlock(groupId) {
  return document.querySelector('[data-recent-block="' + groupId + '"]');
}

function getRecentSlots(groupId) {
  const block = getRecentBlock(groupId);
  return block ? Array.prototype.slice.call(block.querySelectorAll("[data-recent-slot]")) : [];
}

// The page carries only the first row of each section's recent results (S3,
// 2026-09-27). The next row, or every row through a given card, is fetched from
// /api/recent-races and appended; a card already on the page is never added twice.
const recentRaceLoads = new Map();

function loadRecentRaces(groupId, options = {}) {
  const block = getRecentBlock(groupId);
  const grid = block ? block.querySelector(".competition-grid") : null;
  if (!block || !grid) {
    return Promise.resolve(false);
  }
  const key = groupId + "|" + (options.until || "");
  if (recentRaceLoads.has(key)) {
    return recentRaceLoads.get(key);
  }
  const slots = getRecentSlots(groupId);
  const last = slots[slots.length - 1];
  const params = new URLSearchParams({ group: groupId });
  if (last && last.dataset.recentAnchor) {
    params.set("after", last.dataset.recentAnchor);
  }
  if (options.until) {
    params.set("until", options.until);
  }
  const button = block.querySelector("[data-load-more-races]");
  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
  }
  const load = fetch("/api/recent-races?" + params.toString(), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load more races");
      }
      return response.json();
    })
    .then((payload) => {
      const holder = document.createElement("div");
      holder.innerHTML = payload.html || "";
      Array.prototype.slice.call(holder.children).forEach((slot) => {
        const anchor = slot.dataset ? slot.dataset.recentAnchor : "";
        if (anchor && block.querySelector('[data-recent-anchor="' + anchor + '"]')) {
          return;
        }
        grid.appendChild(slot);
      });
      if (button && payload.done) {
        button.hidden = true;
      }
      return true;
    })
    .catch(() => {
      if (button) {
        button.textContent = "More races are unavailable right now. Tap to try again.";
      }
      return false;
    })
    .then((loaded) => {
      if (button) {
        button.disabled = false;
        button.classList.remove("is-loading");
      }
      recentRaceLoads.delete(key);
      return loaded;
    });
  recentRaceLoads.set(key, load);
  return load;
}

function revealMoreRecentRaces(groupId) {
  const block = getRecentBlock(groupId);
  if (!block) {
    return Promise.resolve(false);
  }
  // A row the page carried hidden (an older page) is shown before anything is fetched.
  const step = Number.parseInt(block.dataset.recentStep || "3", 10) || 3;
  const slots = getRecentSlots(groupId);
  const hidden = slots.filter((slot) => slot.hidden);
  if (hidden.length) {
    hidden.slice(0, step).forEach((slot) => {
      slot.hidden = false;
    });
    return Promise.resolve(true);
  }
  return loadRecentRaces(groupId);
}

// The card a calendar bar, a feed entry or a share link points at, fetched first if
// its row is not on the page yet. Resolves with the element, or null.
function revealRaceCard(anchor) {
  const existing = document.getElementById(anchor);
  if (existing) {
    const hiddenSlot = existing.closest("[data-recent-slot][hidden]");
    if (hiddenSlot) {
      hiddenSlot.hidden = false;
    }
    return Promise.resolve(existing);
  }
  const block = Array.prototype.slice.call(document.querySelectorAll("[data-recent-block]")).find((candidate) => {
    try {
      return JSON.parse(candidate.dataset.recentAnchors || "[]").indexOf(anchor) >= 0;
    } catch (error) {
      return false;
    }
  });
  if (!block) {
    return Promise.resolve(null);
  }
  return loadRecentRaces(block.dataset.recentBlock, { until: anchor }).then(() => document.getElementById(anchor));
}

function flashRaceCard(target) {
  target.classList.add("is-calendar-target");
  window.setTimeout(() => {
    target.classList.remove("is-calendar-target");
  }, 2400);
}

// A link straight to a card (#race-…, as the feed and the calendar write them) that
// is not on the page yet: fetch its row, then go there.
function bindRaceHashJump() {
  const hash = window.location.hash || "";
  if (hash.indexOf("#race-") !== 0 || document.getElementById(hash.slice(1))) {
    return;
  }
  revealRaceCard(hash.slice(1)).then((target) => {
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      flashRaceCard(target);
    }
  });
}

// The almanac travels as a stub and is fetched as the reader scrolls toward it (or
// at once where the browser cannot watch the scroll); the section keeps its id, so
// the menu link and /championships land on it either way.
function bindFragmentSections() {
  const stubs = Array.prototype.slice.call(document.querySelectorAll("[data-fragment-src]:not([data-season-calendar])"));
  if (!stubs.length) {
    return;
  }
  const load = (stub) => {
    if (stub.dataset.fragmentState === "loading") {
      return;
    }
    stub.dataset.fragmentState = "loading";
    fetch(stub.dataset.fragmentSrc, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load section");
        }
        return response.json();
      })
      .then((payload) => {
        const holder = document.createElement("div");
        holder.innerHTML = payload.html || "";
        const fresh = holder.firstElementChild;
        if (!fresh) {
          throw new Error("Empty section");
        }
        stub.replaceWith(fresh);
        bindNationalChampionshipFilters();
        bindNationalChampionshipMap();
      })
      .catch(() => {
        stub.dataset.fragmentState = "error";
        const status = stub.querySelector("[data-fragment-status]");
        if (status) {
          status.textContent = "This section is unavailable right now. Reload the page to try again.";
        }
      });
  };
  if (!("IntersectionObserver" in window)) {
    stubs.forEach(load);
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          load(entry.target);
        }
      });
    },
    { rootMargin: "900px 0px" },
  );
  stubs.forEach((stub) => observer.observe(stub));
}

// The news line on each race card. A pill rendered pending (no cached stories)
// is filled from /api/race-news when it scrolls near the viewport or is tapped,
// so a page of recent races loads its coverage a card at a time.
function bindRaceNews() {
  const loading = new Set();

  function setRaceNewsOpen(block, open) {
    const button = block.querySelector("[data-race-news-toggle]");
    const drawer = block.querySelector(".race-news-drawer");
    if (button) {
      button.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (drawer) {
      drawer.hidden = !open;
    }
  }

  async function loadRaceNews(block, open) {
    const raceId = block.dataset.raceNews;
    if (!raceId || loading.has(raceId)) {
      return;
    }
    loading.add(raceId);
    try {
      const response = await fetch("/api/race-news?race=" + encodeURIComponent(raceId), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load race news");
      }
      const payload = await response.json();
      const holder = document.createElement("div");
      holder.innerHTML = payload.html || "";
      const fresh = holder.firstElementChild;
      if (!fresh || !fresh.matches("[data-race-news]")) {
        throw new Error("Unexpected race news markup");
      }
      const button = block.querySelector("[data-race-news-toggle]");
      setRaceNewsOpen(fresh, open || Boolean(button && button.getAttribute("aria-expanded") === "true"));
      block.replaceWith(fresh);
    } catch (error) {
      block.dataset.raceNewsState = "error";
      const text = block.querySelector(".race-news-ticker-text");
      if (text) {
        text.textContent = "Coverage is unavailable right now. Tap to try again.";
      }
    } finally {
      loading.delete(raceId);
    }
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-race-news-toggle]");
    if (toggle) {
      const block = toggle.closest("[data-race-news]");
      if (!block) {
        return;
      }
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setRaceNewsOpen(block, open);
      const state = block.dataset.raceNewsState;
      if (state === "pending" || state === "error") {
        loadRaceNews(block, open);
      }
    }
  });

  if (!("IntersectionObserver" in window)) {
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        observer.unobserve(entry.target);
        if (entry.target.dataset.raceNewsState === "pending") {
          loadRaceNews(entry.target, false);
        }
      });
    },
    { rootMargin: "240px 0px" },
  );
  const watch = (root) => {
    root.querySelectorAll('[data-race-news][data-race-news-state="pending"]').forEach((block) => observer.observe(block));
  };
  watch(document);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      Array.from(mutation.addedNodes).forEach((node) => {
        if (node.nodeType === 1) {
          watch(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
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

// A folding section header (finished stage-race cards): the button's aria-expanded
// and its panel's hidden attribute move together. Delegated, so cards that arrive
// later (rows, fragments) need no binding.
document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-detail-toggle]");
  if (!toggle) {
    return;
  }
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  const panel = document.getElementById(toggle.getAttribute("aria-controls") || "");
  if (panel) {
    panel.hidden = !open;
    if (open) {
      loadFoldedStageResults(panel);
    }
  }
});

// A finished card's stage results arrive on first open (the panel names its race in
// data-stage-results-src). A failed fetch says so and is tried again on the next open.
function loadFoldedStageResults(panel) {
  const raceId = panel.dataset.stageResultsSrc;
  if (!raceId || panel.dataset.stageResultsState === "loading" || panel.dataset.stageResultsState === "loaded") {
    return;
  }
  panel.dataset.stageResultsState = "loading";
  const status = panel.querySelector("[data-stage-results-status]");
  if (status) {
    status.textContent = "Loading stage results…";
  }
  fetch("/api/stage-results?" + new URLSearchParams({ race: raceId }).toString())
    .then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load stage results");
      }
      return response.json();
    })
    .then((payload) => {
      panel.innerHTML = payload.html || "";
      panel.dataset.stageResultsState = "loaded";
    })
    .catch(() => {
      panel.dataset.stageResultsState = "failed";
      if (status) {
        status.textContent = "Stage results could not be loaded. Close and reopen to try again.";
      }
    });
}

// Delegated so stage strips inside deferred sections work without rebinding.
document.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-stage-target]");
  const switcher = chip ? chip.closest("[data-stage-switcher]") : null;
  if (!switcher) {
    return;
  }

  const target = chip.dataset.stageTarget;
  switcher.querySelectorAll("[data-stage-target]").forEach((control) => {
    const isActive = control.dataset.stageTarget === target;
    control.classList.toggle("is-active", isActive);
    if (control.getAttribute("role") === "tab") {
      control.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  });
  switcher.querySelectorAll("[data-stage-panel]").forEach((panel) => {
    panel.hidden = panel.id !== target;
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
// is kept the same way the units are. Phones stay compact whatever is stored:
// the expanded chart needs more width than they have, so the control is hidden
// there and the class is never applied. The stored choice survives a rotation.
const PROFILE_VIEW_KEY = "pcr-profile-view";
const narrowViewport = window.matchMedia("(max-width: 720px)");

function readProfileView() {
  try {
    return window.localStorage.getItem(PROFILE_VIEW_KEY) === "expanded" ? "expanded" : "compact";
  } catch (error) {
    return "compact";
  }
}

function applyProfileView(view) {
  const expanded = view === "expanded" && !narrowViewport.matches;
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
narrowViewport.addEventListener("change", () => applyProfileView(readProfileView()));

// A small card that opens beside whatever the pointer is resting on. The rider
// card and the jersey contenders card are both one of these and differ only in
// what goes inside. Pointer devices only; a phone keeps the plain page. The card
// is fixed-positioned on the body so a card's overflow clip cannot cut it off.
// resolveTarget maps a secondary target onto the element the card belongs to,
// so moving between the two keeps one card open instead of closing and reopening.
function bindHoverCards(selector, className, buildMarkup, resolveTarget) {
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) {
    return null;
  }
  const resolve = (node) => (node && resolveTarget ? resolveTarget(node) : node);
  let card = null;
  let openFor = null;
  let showTimer = null;
  let hideTimer = null;

  function hideCard() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (card) {
      card.remove();
      card = null;
    }
    openFor = null;
  }

  function showCard(target) {
    if (openFor === target) {
      return;
    }
    const markup = buildMarkup(target);
    if (!markup) {
      return;
    }
    hideCard();
    card = document.createElement("div");
    card.className = className;
    card.setAttribute("role", "tooltip");
    card.innerHTML = markup;
    document.body.appendChild(card);
    const rect = target.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const left = Math.max(8, Math.min(rect.left - 16, window.innerWidth - width - 8));
    const below = rect.bottom + 10;
    const above = rect.top - height - 10;
    const fitsBelow = below + height <= window.innerHeight - 8 || above < 8;
    card.style.left = left + "px";
    card.style.top = (fitsBelow ? below : above) + "px";
    card.style.setProperty("--rider-card-arrow", Math.max(12, rect.left - left + 8) + "px");
    card.classList.toggle("is-above", !fitsBelow);
    openFor = target;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideCard, 180);
  }

  document.addEventListener("mouseover", (event) => {
    const target = resolve(event.target.closest(selector));
    if (target) {
      clearTimeout(hideTimer);
      if (openFor !== target) {
        clearTimeout(showTimer);
        showTimer = setTimeout(() => showCard(target), 250);
      }
      return;
    }
    if (card && card.contains(event.target)) {
      clearTimeout(hideTimer);
    }
  });
  document.addEventListener("mouseout", (event) => {
    const target = resolve(event.target.closest(selector));
    if (target || (card && card.contains(event.target))) {
      clearTimeout(showTimer);
      scheduleHide();
    }
  });
  document.addEventListener("focusin", (event) => {
    const target = resolve(event.target.closest(selector));
    if (target) {
      showCard(target);
    } else if (!(card && card.contains(event.target))) {
      hideCard();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCard();
    }
  });
  window.addEventListener("scroll", hideCard, { passive: true });
  window.addEventListener("resize", hideCard);
  return { show: showCard, hide: hideCard };
}

// The five riders closest to a jersey, written into a template beside the
// classification when the page was built, so nothing here has to know how a name,
// a flag or a standing is spelled.
// The swatch beside the classification opens the same card, resolved onto the
// label so the card is anchored, and kept, in one place.
//
// Hover is one way in, not the only one (since 2026-09-26): the label is a
// button, and a click, a tap or Enter opens the same top five. On a pointer
// device with room it is the floating card; on a phone, or without hover, the
// template's content opens inline under the jersey list, where the same label
// (or Escape) closes it again. One inline panel per list.
function bindJerseyContenderCards() {
  const selector = "[data-jersey-contenders], [data-jersey-contenders-swatch]";
  const resolveLabel = (node) =>
    node.hasAttribute("data-jersey-contenders-swatch")
      ? node.parentElement && node.parentElement.querySelector("[data-jersey-contenders]")
      : node;
  const readMarkup = (label) => {
    const source = label.parentElement && label.parentElement.querySelector(".jersey-card-source");
    return source ? source.innerHTML : "";
  };
  const hoverCards = bindHoverCards(selector, "rider-card jersey-card", readMarkup, resolveLabel);

  function closeInline(panel) {
    if (panel.__opener) {
      panel.__opener.setAttribute("aria-expanded", "false");
    }
    panel.remove();
  }

  function toggleInline(label) {
    const list = label.closest(".jersey-list");
    const holders = label.closest(".jersey-holders") || (list && list.parentElement);
    if (!list || !holders) {
      return;
    }
    const existing = holders.querySelector("[data-jersey-inline]");
    const wasOpen = Boolean(existing && existing.__opener === label);
    if (existing) {
      closeInline(existing);
    }
    if (wasOpen) {
      return;
    }
    const markup = readMarkup(label);
    if (!markup) {
      return;
    }
    const panel = document.createElement("div");
    panel.className = "jersey-inline-card";
    panel.setAttribute("data-jersey-inline", "");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", label.textContent.trim() + " classification top five");
    panel.innerHTML = markup;
    panel.__opener = label;
    list.insertAdjacentElement("afterend", panel);
    label.setAttribute("aria-expanded", "true");
  }

  document.addEventListener("click", (event) => {
    const node = event.target.closest(selector);
    if (!node) {
      return;
    }
    const label = resolveLabel(node);
    if (!label) {
      return;
    }
    event.preventDefault();
    if (hoverCards && !narrowViewport.matches) {
      hoverCards.show(label);
      return;
    }
    toggleInline(label);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll("[data-jersey-inline]").forEach(closeInline);
    }
  });
}

// What this site holds about a rider's season, and the two outward links.
// The index (~35 KB of JSON) is parsed on the first card a pointer opens, never at
// load: a phone cannot hover, so bindHoverCards binds nothing there and the parse
// never happens (assessment S7, 2026-09-26).
function bindRiderCards() {
  let index = null;
  function readIndex() {
    if (index) {
      return index;
    }
    try {
      const node = document.getElementById("rider-seasons");
      index = (node && JSON.parse(node.textContent)) || {};
    } catch (error) {
      index = {};
    }
    return index;
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tallyPart(count, singular, plural) {
    return count > 0 ? "<span><strong>" + count + "</strong>" + (count === 1 ? singular : plural) + "</span>" : "";
  }

  function ordinal(number) {
    const rest = number % 100;
    const suffix = rest >= 11 && rest <= 13 ? "th" : ["th", "st", "nd", "rd"][number % 10] || "th";
    return number + suffix;
  }

  // A rider with nothing to count still gets the best placing the page saw, from
  // the same top fives the index reads ("Best on this site: 4th, Vuelta a España
  // stage 21"); only a rider the page never placed gets the empty line.
  function describeBestPlacing(best) {
    if (!best || !Number.isFinite(Number(best.place)) || !best.race) {
      return "";
    }
    return (
      "Best on this site: " + ordinal(Number(best.place)) + ", " + escapeText(best.race) +
      (best.stage ? " " + escapeText(String(best.stage).toLowerCase()) : "") + "."
    );
  }

  function buildCardMarkup(link) {
    // A team or a lone surname carries no key (its link is a PCS search): no card.
    if (!link.hasAttribute("data-rider-key")) {
      return "";
    }
    const key = link.getAttribute("data-rider-key") || "";
    const entry = readIndex()[key] || null;
    const best = entry ? describeBestPlacing(entry.bestPlacing) : "";
    const name = entry ? entry.name : link.textContent.trim();
    const flagNode = link.previousElementSibling;
    const flag = flagNode && flagNode.classList.contains("country-flag") ? flagNode.textContent : "";
    // "Wins" and "podiums" each count one-day races, overall classifications and
    // stages alike, the way ProCyclingStats counts them; podiums include the wins.
    const tally = entry
      ? tallyPart(entry.wins + entry.stageWins, "win", "wins") + tallyPart(entry.podiums + entry.stagePodiums, "podium", "podiums")
      : "";
    const wikipedia = entry && entry.wikiTitle
      ? "https://en.wikipedia.org/wiki/" + encodeURIComponent(entry.wikiTitle.replace(/ /g, "_"))
      : "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(name) + "&go=Go";
    return (
      '<div class="rider-card-head">' +
      (flag ? '<span class="country-flag" aria-hidden="true">' + escapeText(flag) + "</span>" : "") +
      '<span class="rider-card-name">' + escapeText(name) + "</span></div>" +
      '<div class="rider-card-kicker">This season on this site</div>' +
      (tally
        ? '<div class="rider-card-tally">' + tally + "</div>"
        : '<p class="rider-card-empty">' + (best || "No win or podium on this site this season.") + "</p>") +
      '<div class="rider-card-links">' +
      '<a href="' + escapeText(link.href) + '" target="_blank" rel="noreferrer">ProCyclingStats \u2197</a>' +
      '<a href="' + escapeText(wikipedia) + '" target="_blank" rel="noreferrer">Wikipedia \u2197</a>' +
      "</div>"
    );
  }

  bindHoverCards(".rider-link", "rider-card", buildCardMarkup);
}

// The build time in the reader's own time zone. The server prints it in Eastern
// Time, which stays as the no-script fallback; the ISO stamp on the refresh
// button is the same instant. Two formatters because dateStyle and timeZoneName
// cannot share one.
function localizeUpdatedTimestamp() {
  const button = document.querySelector("[data-refresh-button][data-fetched-at]");
  const row = button ? button.closest(".updated-row") : null;
  const updated = row ? row.querySelector(".updated") : null;
  const stamp = button ? new Date(button.getAttribute("data-fetched-at") || "") : null;
  if (!updated || !stamp || Number.isNaN(stamp.getTime()) || !window.Intl || !Intl.DateTimeFormat) {
    return;
  }
  try {
    const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(stamp);
    const zone = (new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(stamp).find((part) => part.type === "timeZoneName") || {}).value || "";
    updated.textContent = "Updated " + when + (zone ? " " + zone : "");
  } catch (error) {
    // An unsupported locale option: the server's Eastern Time text stands.
  }
}

bindLoadMoreRaces();
bindRaceNews();
bindRiderCards();
bindJerseyContenderCards();
bindNationalChampionshipFilters();
bindNationalChampionshipMap();
bindSeasonCalendar();
bindFragmentSections();
bindShareJump();
bindRaceHashJump();
localizeUpdatedTimestamp();
bindRefreshButton();
