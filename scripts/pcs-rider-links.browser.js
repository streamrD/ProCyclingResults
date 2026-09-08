// Checks the ProCyclingStats address the site builds for each rider name.
//
// The server cannot do this (PCS blocks it), so this runs in a browser: open any
// https://www.procyclingstats.com/ page, paste this file into the console, then call
//   await checkRiderLinks(["Tadej Pogačar", "Juan Ayuso", ...])
// It fetches /rider/<slug> for each name (same origin, one request every 150 ms), and
// for a miss or a page titled for a different rider it reads the PCS search page for
// the name and lists the rider addresses it offers. The result is what goes into
// RIDER_PROFILE_URLS in server.js: { "Juan Ayuso": "https://www.procyclingstats.com/rider/juan-ayuso-pesquera" }.
//
// To get the names on the site today:
//   curl -s https://procyclingresults.up.railway.app/api/races | node -e '...collect .rider, .winner, .second, .third...'
// (see "Rider links" in handoff.md for the one-liner). The slug rule below must stay
// identical to buildRiderSlug in server.js.
function foldRiderName(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o").replace(/Ø/g, "O").replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/ß/g, "ss")
    .replace(/ł/g, "l").replace(/Ł/g, "L").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/ð/g, "d").replace(/Ð/g, "D")
    .replace(/þ/g, "th").replace(/Þ/g, "Th").replace(/ı/g, "i").replace(/œ/g, "oe").replace(/Œ/g, "Oe")
    .toLowerCase();
}

function buildRiderSlug(name) {
  return foldRiderName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function checkRiderLinks(names, delayMs = 150) {
  const issues = [];
  let ok = 0;
  const norm = (text) => foldRiderName(text).replace(/[^a-z0-9]+/g, " ").trim();
  for (const name of names) {
    const slug = buildRiderSlug(name);
    try {
      const html = await (await fetch(`/rider/${slug}`)).text();
      const title = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").trim();
      const found = title && !/page not found/i.test(title);
      if (found && norm(title) === norm(name)) {
        ok += 1;
      } else {
        let offered = [];
        if (!found) {
          const search = await (await fetch(`/search.php?term=${encodeURIComponent(name)}`)).text();
          offered = [...new Set([...search.matchAll(/href="(rider\/[^"]+)"/g)].map((match) => match[1]))].slice(0, 3);
        }
        issues.push({ name, slug, title: found ? title : "", offered });
      }
    } catch (error) {
      issues.push({ name, slug, title: `ERR ${error.message}`, offered: [] });
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ok, issues };
}
