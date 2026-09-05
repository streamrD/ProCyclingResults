// Retired on 2026-09-05: the "Race Coverage" block at the foot of each competition
// section (a Load button, a race dropdown, a Refresh that paged through older
// batches, and eight article cards with summaries). It was replaced by the
// "Latest news" line on every race card (`buildRaceNewsMarkup`, `/api/race-news`),
// which shows the same eight stories in the same order without the scrolling or the
// click. Kept for reference only; not loaded. Refresh paging and story summaries
// were the two things not carried over.

function buildArticleCard(article) {
  const publishedLabel = article.publishedAt
    ? formatTimestamp(article.publishedAt)
    : "Recent coverage";

  return `
    <article class="article-card">
      <div class="article-kicker">${escapeHtml(article.publisher)}</div>
      <h3><a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a></h3>
      <p class="meta">${escapeHtml(publishedLabel)}</p>
      <p class="article-description">${escapeHtml(article.description || `Coverage related to ${article.raceTitle}.`)}</p>
    </article>`;
}


function buildRaceArticleControls(groupId, articleRaces, selectedRaceId, refreshToken) {
  const options = articleRaces
    .map((race) => {
      const selected = race.id === selectedRaceId ? " selected" : "";
      return `<option value="${escapeHtml(race.id)}"${selected}>${escapeHtml(race.title)} • ${escapeHtml(race.date)}</option>`;
    })
    .join("");

  return `
    <form class="article-controls" method="get" action="/#${escapeHtml(groupId)}-coverage">
      <div class="article-controls-left">
        <label class="article-label" for="${escapeHtml(groupId)}-race-select">Select Race</label>
        <select id="${escapeHtml(groupId)}-race-select" name="${escapeHtml(groupId)}-race" class="article-select" data-group-id="${escapeHtml(groupId)}">${options}</select>
      </div>
      <input type="hidden" name="${escapeHtml(groupId)}-refresh" id="${escapeHtml(groupId)}-refresh-token" value="${escapeHtml(String(refreshToken))}" />
      <button type="button" class="refresh-button" data-group-id="${escapeHtml(groupId)}">Refresh</button>
    </form>`;
}


function buildLoadCoverageButton(groupId) {
  return `
    <button type="button" class="load-coverage-button" data-coverage-group-id="${escapeHtml(groupId)}">
      Load Race Coverage
    </button>`;
}


async function buildCoverageViewForGroup(group, url) {
  // The recent-results grid reveals races in rows; the coverage dropdown only
  // lists races the user has actually revealed (defaults to the first row).
  const requestedShown = Number.parseInt(url.searchParams.get(`${group.id}-shown`) || "", 10);
  const shownRecent = Math.min(
    group.recentResults.length,
    Number.isFinite(requestedShown) && requestedShown > 0 ? requestedShown : WORLDTOUR_RECENT_RESULTS_STEP,
  );
  const articleRaces = [...group.liveStageRaces, ...group.recentResults.slice(0, shownRecent)];
  const selectedRaceId = url.searchParams.get(`${group.id}-race`) || articleRaces[0]?.id || "";
  const refreshToken = Math.max(
    0,
    Number.parseInt(url.searchParams.get(`${group.id}-refresh`) || "0", 10) || 0,
  );
  const selectedRace =
    articleRaces.find((race) => race.id === selectedRaceId) || articleRaces[0] || null;
  const articlePool = selectedRace ? await loadRaceArticlePool(selectedRace) : [];

  return {
    articleRaces,
    selectedRaceId: selectedRace?.id || "",
    selectedRaceTitle: selectedRace?.title || "the selected race",
    refreshToken,
    raceArticles: selectRaceArticles(articlePool, refreshToken, selectedRace),
  };
}


function buildCoverageBlock(group, coverageView) {
  if (!coverageView) {
    return `
      <div class="competition-block competition-coverage" id="${escapeHtml(group.id)}-coverage">
        <div class="competition-block-head">
          <h3>Race Coverage</h3>
          <p>Load article coverage to explore the latest stories for the above races.</p>
        </div>
        ${buildLoadCoverageButton(group.id)}
        <div class="coverage-content" id="${escapeHtml(group.id)}-coverage-content"></div>
      </div>`;
  }

  if (coverageView.articleRaces.length === 0) {
    return "";
  }

  const controls = buildRaceArticleControls(
    group.id,
    coverageView.articleRaces,
    coverageView.selectedRaceId,
    coverageView.refreshToken,
  );
  const articleCards =
    coverageView.raceArticles.length > 0
      ? coverageView.raceArticles.map(buildArticleCard).join("")
      : `<p class="meta">No top-tier race coverage was available for ${escapeHtml(coverageView.selectedRaceTitle)} at the moment.</p>`;

  return `
    <div class="competition-block competition-coverage" id="${escapeHtml(group.id)}-coverage">
      <div class="competition-block-head">
        <h3>Race Coverage</h3>
        <p>Choose one live or recent race from this competition to view article coverage.</p>
      </div>
      ${controls}
      <div class="coverage-content" id="${escapeHtml(group.id)}-coverage-content">
        <div class="article-grid">${articleCards}</div>
      </div>
    </div>`;
}


      if (url.pathname === "/api/competition-coverage") {
        const groupId = url.searchParams.get("group") || "";
        if (RETIRED_COMPETITION_GROUP_IDS.has(groupId)) {
          sendJson(response, 410, {
            error: "This competition group is retired.",
            message:
              "UCI ProSeries and Europe Tour article coverage is archived with the retired section code and is not currently loaded.",
          });
          return;
        }

        const data = DEFERRED_COMPETITION_GROUP_IDS.has(groupId)
          ? await loadCompetitionGroupData(groupId)
          : await loadRaceData({ includeDeferred: false });
        const group = getCompetitionGroups(data).find((entry) => entry.id === groupId);
        if (!group) {
          sendJson(response, 404, { error: "Unknown competition group." });
          return;
        }

        const coverageView = await buildCoverageViewForGroup(group, url);
        sendJson(response, 200, {
          groupId,
          html: buildCoverageBlock(group, coverageView),
        });
        return;
      }

function getCompetitionGroupIdForRace(race) {
  return /women/i.test(String(race?.series || "")) ? "womens-worldtour" : "mens-worldtour";
}


      async function loadCoverage(groupId, options = {}) {
        const coverageBlock = document.getElementById(groupId + "-coverage");
        const coverageContent = document.getElementById(groupId + "-coverage-content");
        if (!coverageBlock || !coverageContent) {
          return;
        }

        const trigger = coverageBlock.querySelector('[data-coverage-group-id="' + groupId + '"]');
        if (trigger) {
          trigger.classList.add("is-loading");
        }

        try {
          const params = new URLSearchParams({ group: groupId });
          if (options.selectedRaceId) {
            params.set(groupId + "-race", options.selectedRaceId);
          }
          if (Number.isFinite(options.refreshToken)) {
            params.set(groupId + "-refresh", String(options.refreshToken));
          }
          const shownRecent = countShownRecentRaces(groupId);
          if (shownRecent > 0) {
            params.set(groupId + "-shown", String(shownRecent));
          }

          const response = await fetch("/api/competition-coverage?" + params.toString(), { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Unable to load coverage");
          }

          const payload = await response.json();
          coverageBlock.outerHTML = payload.html || "";
          bindArticleControls(document);
          syncCoverageRaceOptions(groupId);
        } catch (error) {
          coverageContent.innerHTML = '<p class="meta">Unable to load race coverage right now. Please try again in a moment.</p>';
        } finally {
          if (trigger) {
            trigger.classList.remove("is-loading");
          }
        }
      }

      // Keep the coverage dropdown in sync with the races the user has revealed,
      // appending newly shown races without disturbing the current selection.
      function syncCoverageRaceOptions(groupId) {
        const select = document.getElementById(groupId + "-race-select");
        if (!select) {
          return;
        }

        const existingValues = new Set(Array.prototype.map.call(select.options, (option) => option.value));
        getRecentSlots(groupId).forEach((slot) => {
          if (slot.hidden) {
            return;
          }
          const raceId = slot.dataset.recentRaceId;
          if (!raceId || existingValues.has(raceId)) {
            return;
          }
          const option = document.createElement("option");
          option.value = raceId;
          option.textContent = slot.dataset.recentRaceTitle + " • " + slot.dataset.recentRaceDate;
          select.appendChild(option);
          existingValues.add(raceId);
        });
      }

      function countShownRecentRaces(groupId) {
        return getRecentSlots(groupId).filter((slot) => !slot.hidden).length;
      }

      function bindArticleControls(root = document) {
        root.querySelectorAll(".article-select").forEach((raceSelect) => {
          if (raceSelect.dataset.bound === "true") {
            return;
          }

          raceSelect.dataset.bound = "true";
          raceSelect.addEventListener("change", () => {
            const groupId = raceSelect.dataset.groupId;
            const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
            if (refreshTokenInput) {
              refreshTokenInput.value = "0";
            }
            loadCoverage(groupId, {
              selectedRaceId: raceSelect.value,
              refreshToken: 0,
            });
          });
        });

        root.querySelectorAll(".refresh-button").forEach((refreshButton) => {
          if (refreshButton.dataset.bound === "true") {
            return;
          }

          refreshButton.dataset.bound = "true";
          refreshButton.addEventListener("click", () => {
            const groupId = refreshButton.dataset.groupId;
            const refreshTokenInput = document.getElementById(groupId + "-refresh-token");
            const currentValue = Number.parseInt(refreshTokenInput?.value || "0", 10) || 0;
            const nextValue = currentValue + 1;
            if (refreshTokenInput) {
              refreshTokenInput.value = String(nextValue);
            }
            const raceSelect = document.getElementById(groupId + "-race-select");
            loadCoverage(groupId, {
              selectedRaceId: raceSelect?.value || "",
              refreshToken: nextValue,
            });
          });
        });

        root.querySelectorAll(".load-coverage-button").forEach((coverageButton) => {
          if (coverageButton.dataset.bound === "true") {
            return;
          }

          coverageButton.dataset.bound = "true";
          coverageButton.addEventListener("click", () => {
            loadCoverage(coverageButton.dataset.coverageGroupId, { refreshToken: 0 });
          });
        });
      }
