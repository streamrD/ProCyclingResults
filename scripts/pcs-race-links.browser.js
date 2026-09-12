// Checks the ProCyclingStats race address behind every "Full results" link.
//
// The server cannot do this (PCS blocks it), so this runs in a browser: open any
// https://www.procyclingstats.com/ page, paste this file into the console, then call
//   await checkRaceLinks({ "Vuelta a España": "vuelta-a-espana", ... }, 2026)
// with the RACE_RESULT_SLUGS map from server.js. It fetches /race/<slug>/<year> for
// each entry (same origin, one request every 120 ms). A wrong slug answers HTTP 500
// with an empty body, not a titled 404, so the check is "200 and a <title>". For a
// miss it reads the PCS search page for the key and lists the race addresses that
// page offers beyond the site's own navigation.
//
// Learned on 2026-09-12, when the map was first built: the women's races rarely take
// the men's slug plus "-we" (Strade Bianche is "strade-bianche-donne", the Flèche is
// "la-fleche-wallonne-feminine", the Tour Down Under is "santos-women-s-tour"), the
// Dauphiné is "tour-auvergne-rhone-alpes", Classic Lorient is "gp-ouest-france-plouay",
// and the classification pages are gc, points, kom and youth ("teams" is the start list).
async function checkRaceLinks(slugsByKey, year, delayMs = 120) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const titleOf = (html) => ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").trim();
  const hrefsOf = (html) => [...new Set([...html.matchAll(/href="(race\/[a-z0-9-]+)(?:\/\d{4})?[^"]*"/g)].map((m) => m[1]))];
  const navigation = new Set(hrefsOf(await (await fetch("/search.php?term=zzzzqqq")).text()));
  const issues = [];
  let ok = 0;
  for (const [key, slug] of Object.entries(slugsByKey)) {
    try {
      const response = await fetch(`/race/${slug}/${year}`);
      const title = titleOf(await response.text());
      if (response.status === 200 && title) {
        ok += 1;
      } else {
        const search = await (await fetch(`/search.php?term=${encodeURIComponent(key.replace(/\s*\(.*\)/, ""))}`)).text();
        issues.push({ key, slug, status: response.status, offered: hrefsOf(search).filter((href) => !navigation.has(href)).slice(0, 8) });
      }
    } catch (error) {
      issues.push({ key, slug, status: `error ${error.message}`, offered: [] });
    }
    await sleep(delayMs);
  }
  console.log(`${ok} ok, ${issues.length} to look at`);
  console.table(issues);
  return issues;
}
