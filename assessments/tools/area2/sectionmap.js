// Byte map of the saved homepage by top-level <section> inside <main>, plus a few counts.
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const B = (s) => Buffer.byteLength(s);
const mainStart = html.indexOf("<main");
const mainEnd = html.indexOf("</main>");
const main = html.slice(mainStart, mainEnd);
// Walk <section ...> / </section> at depth 1 inside main.
const tagRe = /<(\/?)section\b([^>]*)>/g;
let depth = 0;
let open = null;
const sections = [];
for (const m of main.matchAll(tagRe)) {
  if (m[1] === "") {
    if (depth === 0) open = { index: m.index, attrs: m[2] };
    depth += 1;
  } else {
    depth -= 1;
    if (depth === 0 && open) {
      const chunk = main.slice(open.index, m.index + m[0].length);
      const id = (open.attrs.match(/\bid="([^"]*)"/) || [])[1] || "";
      const cls = (open.attrs.match(/\bclass="([^"]*)"/) || [])[1] || "";
      const h2 = (chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "";
      sections.push({
        id,
        class: cls.slice(0, 60),
        h2: h2.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 60),
        bytes: B(chunk),
        svgBytes: [...chunk.matchAll(/<svg[\s\S]*?<\/svg>/g)].reduce((s, x) => s + B(x[0]), 0),
        raceCards: (chunk.match(/\bid="race-/g) || []).length,
        hiddenAtOpen: /\bhidden\b/.test(open.attrs),
        offsetInPage: B(html.slice(0, mainStart + open.index)),
      });
      open = null;
    }
  }
}
const beforeFirstSection = sections.length ? B(html.slice(0, mainStart + sections[0].offsetInPage - B(html.slice(0, mainStart)))) : null;
console.log(JSON.stringify({
  totalBytes: B(html),
  mainBytes: B(main),
  headBytes: B(html.slice(0, html.indexOf("</head>"))),
  riderKeyLinks: (html.match(/data-rider-key=/g) || []).length,
  riderLinkClass: (html.match(/rider-link/g) || []).length,
  tables: (html.match(/<table\b/g) || []).length,
  tableRows: (html.match(/<tr\b/g) || []).length,
  buttons: (html.match(/<button\b/g) || []).length,
  anchors: (html.match(/<a\b/g) || []).length,
  sections,
}, null, 2));
