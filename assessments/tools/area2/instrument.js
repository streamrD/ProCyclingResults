// Builds an instrumented copy of the saved production homepage for headless Chrome.
// Fonts are re-pointed at the worktree's assets so the render uses the real typefaces.
// A script injected into <head> measures the DOM after load and writes JSON into <title>,
// which `--dump-dom` then exposes (the pattern handoff.md recommends).
const fs = require("node:fs");
const path = require("node:path");
const [src, dest, assetsDir] = process.argv.slice(2);
let html = fs.readFileSync(src, "utf8");
html = html.split('url("/assets/').join('url("file://' + assetsDir + "/");
html = html.split('src="/assets/').join('src="file://' + assetsDir + "/");
html = html.split('href="/assets/').join('href="file://' + assetsDir + "/");
const probe = `<script>
document.title = "PROBE:{\\"note\\":\\"probe did not run\\"}";
document.addEventListener("DOMContentLoaded", runProbe);
window.addEventListener("load", runProbe);
function runProbe() {
  var all = document.getElementsByTagName("*");
  var vw = window.innerWidth;
  var over = [];
  for (var i = 0; i < all.length && over.length < 8; i++) {
    var r = all[i].getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) {
      over.push(all[i].tagName.toLowerCase() + (all[i].id ? "#" + all[i].id : "") + (all[i].className && typeof all[i].className === "string" ? "." + all[i].className.trim().split(/\\s+/).slice(0, 2).join(".") : "") + "@right=" + Math.round(r.right));
    }
  }
  var firstCard = document.querySelector('[id^="race-"]');
  var firstVisibleCard = null;
  var cards = document.querySelectorAll('[id^="race-"]');
  for (var j = 0; j < cards.length; j++) { var rc = cards[j].getBoundingClientRect(); if (rc.height > 0) { firstVisibleCard = cards[j]; break; } }
  var firstName = document.querySelector(".rider-link");
  var hero = document.querySelector("header, .hero");
  var result = {
    viewport: [vw, window.innerHeight],
    elements: all.length,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    overflowsHorizontally: document.documentElement.scrollWidth > vw,
    overflowingElements: over,
    raceCards: cards.length,
    firstCardId: firstCard ? firstCard.id : null,
    firstCardTop: firstCard ? Math.round(firstCard.getBoundingClientRect().top) : null,
    firstVisibleCardId: firstVisibleCard ? firstVisibleCard.id : null,
    firstVisibleCardTop: firstVisibleCard ? Math.round(firstVisibleCard.getBoundingClientRect().top) : null,
    firstRiderLinkTop: firstName ? Math.round(firstName.getBoundingClientRect().top) : null,
    firstRiderLinkText: firstName ? firstName.textContent.trim() : null,
    heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    newsBlocks: document.querySelectorAll("[data-race-news]").length,
    hiddenElements: document.querySelectorAll("[hidden]").length,
    fontsLoaded: document.fonts ? document.fonts.size : null,
    timing: (function () {
      var t = performance.timing;
      var n = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      return {
        responseEndMs: Math.round(t.responseEnd - t.navigationStart),
        domInteractiveMs: Math.round(t.domInteractive - t.navigationStart),
        domContentLoadedEndMs: Math.round(t.domContentLoadedEventEnd - t.navigationStart),
        dclHandlerMs: Math.round(t.domContentLoadedEventEnd - t.domContentLoadedEventStart),
        loadEventEndMs: t.loadEventEnd ? Math.round(t.loadEventEnd - t.navigationStart) : null,
        transferSize: n ? n.transferSize : null
      };
    })()
  };
  document.title = "PROBE:" + JSON.stringify(result);
  if (window.parent !== window) { try { window.parent.postMessage(document.title, "*"); } catch (e) {} }
}
</script>`;
html = html.replace("</head>", probe + "</head>");
fs.writeFileSync(dest, html);
console.log("wrote", dest, Buffer.byteLength(html), "bytes");
