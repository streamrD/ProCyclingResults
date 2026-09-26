#!/usr/bin/env node
// Turns an assessment written in Markdown into a PDF next to it, using headless
// Chrome and nothing else: the repository has no third-party packages and the
// assessments must stay reproducible on a plain checkout. Usage:
//
//   node scripts/build-assessment-pdf.js assessments/2026-09-26-project-assessment.md
//
// Markdown supported: headings, paragraphs, bullet and numbered lists (nested by
// indent), pipe tables, fenced code, blockquotes, horizontal rules, bold, italic,
// inline code and links. Cells that read Critical, High, Medium or Low are coloured.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text) {
  const codes = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function splitCells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function cell(text, tag) {
  const severity = text.match(/^(Critical|High|Medium|Low)$/);
  const body = severity ? `<span class="sev sev-${severity[1].toLowerCase()}">${severity[1]}</span>` : inline(text);
  return `<${tag}>${body}</${tag}>`;
}

function render(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headings = [];
  let i = 0;

  const flushParagraph = (buffer) => {
    if (buffer.length > 0) {
      html.push(`<p>${inline(buffer.join(" "))}</p>`);
      buffer.length = 0;
    }
  };

  const paragraph = [];
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushParagraph(paragraph);
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph(paragraph);
      // A rule directly before a heading starts that section on a new page.
      let next = i + 1;
      while (next < lines.length && lines[next].trim() === "") {
        next += 1;
      }
      html.push(next < lines.length && /^#{1,6}\s/.test(lines[next]) ? '<div class="page-break"></div>' : "<hr>");
      i += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flushParagraph(paragraph);
      const header = splitCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      html.push(
        `<table><thead><tr>${header.map((text) => cell(text, "th")).join("")}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((text) => cell(text, "td")).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParagraph(paragraph);
      const stack = [];
      const closeTo = (depth) => {
        while (stack.length > depth) {
          html.push(`</li></${stack.pop()}>`);
        }
      };
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const item = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        const depth = Math.floor(item[1].replace(/\t/g, "  ").length / 2) + 1;
        const tag = /\d/.test(item[2]) ? "ol" : "ul";
        let text = item[3];
        i += 1;
        // A wrapped item continues on indented lines that are not new items.
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          text += ` ${lines[i].trim()}`;
          i += 1;
        }
        if (depth > stack.length) {
          html.push(`<${tag}><li>${inline(text)}`);
          stack.push(tag);
        } else {
          closeTo(depth);
          if (stack[depth - 1] !== tag) {
            // A numbered list directly after a bulleted one at the same depth.
            closeTo(depth - 1);
            html.push(`<${tag}><li>${inline(text)}`);
            stack.push(tag);
          } else {
            html.push(`</li><li>${inline(text)}`);
          }
        }
      }
      closeTo(0);
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph(paragraph);
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(paragraph);
      i += 1;
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph(paragraph);

  return { body: html.join("\n"), headings };
}

const CSS = `
@page { size: A4; margin: 16mm 16mm 18mm 16mm; }
:root {
  --ink: #09214c; --muted: #4f6188; --blue: #0033a0; --blue-bright: #0078c7;
  --line: rgba(0, 51, 160, 0.16); --line-strong: rgba(0, 51, 160, 0.3); --bg: #eef3fb;
  --red: #ef3340; --yellow: #ffcc00;
}
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Manrope", "Segoe UI", -apple-system, Helvetica, Arial, sans-serif; color: var(--ink); font-size: 10.25pt; line-height: 1.45; margin: 0; }
h1, h2, h3, h4 { font-family: "Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", sans-serif; color: var(--blue); line-height: 1.15; margin: 0; }
h1 { font-size: 30pt; font-weight: 700; margin-bottom: 4pt; }
h2 { font-size: 20pt; font-weight: 700; margin-top: 20pt; margin-bottom: 8pt; padding-bottom: 4pt; border-bottom: 2px solid var(--line-strong); break-after: avoid; }
.page-break { break-before: page; }
h3 { font-size: 14pt; font-weight: 600; margin-top: 14pt; margin-bottom: 4pt; break-after: avoid; }
h4 { font-size: 11.5pt; font-weight: 600; margin-top: 10pt; margin-bottom: 3pt; color: var(--ink); break-after: avoid; }
p { margin: 0 0 7pt 0; }
p.lede { font-size: 12pt; color: var(--muted); margin-bottom: 14pt; }
ul, ol { margin: 0 0 8pt 0; padding-left: 18pt; }
li { margin-bottom: 3pt; }
li > ul, li > ol { margin-top: 3pt; }
a { color: var(--blue-bright); text-decoration: none; }
code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 9pt; background: var(--bg); padding: 0 3px; border-radius: 3px; }
pre { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8pt 10pt; font-size: 8.5pt; line-height: 1.4; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
blockquote { margin: 0 0 8pt 0; padding: 6pt 12pt; border-left: 3px solid var(--yellow); background: var(--bg); color: var(--ink); }
hr { border: 0; border-top: 1px solid var(--line); margin: 12pt 0; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt 0; font-size: 8.75pt; line-height: 1.35; }
th, td { text-align: left; vertical-align: top; padding: 4pt 6pt; border-bottom: 1px solid var(--line); }
th { background: var(--bg); color: var(--blue); font-weight: 700; border-bottom: 1.5px solid var(--line-strong); }
tr { break-inside: avoid; }
thead { display: table-header-group; }
.sev { display: inline-block; font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; font-weight: 700; font-size: 8.5pt; letter-spacing: 0.02em; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; color: #fff; }
.sev-critical { background: #8b0000; }
.sev-high { background: var(--red); }
.sev-medium { background: #c77700; }
.sev-low { background: var(--blue-bright); }
.cover { border-bottom: 4px solid var(--blue); padding-bottom: 12pt; margin-bottom: 14pt; }
.cover .kicker { font-family: "Barlow Semi Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); font-size: 10pt; margin-bottom: 6pt; }
.toc { columns: 2; column-gap: 24pt; font-size: 9.5pt; margin-bottom: 8pt; }
.toc a { color: var(--ink); display: block; padding: 1.5pt 0; border-bottom: 1px dotted var(--line); }
.toc a.l3 { padding-left: 12pt; color: var(--muted); }
`;

function buildDocument(markdown, { kicker }) {
  const { body, headings } = render(markdown);
  const title = headings.find((heading) => heading.level === 1)?.text || "Assessment";
  const toc = headings
    .filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading) => `<a class="l${heading.level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
    .join("");
  const bodyWithCover = body.replace(
    /^<h1 id="[^"]*">[\s\S]*?<\/h1>\n?(<p>[\s\S]*?<\/p>)?/,
    (match, lede) =>
      `<div class="cover"><div class="kicker">${escapeHtml(kicker)}</div>${match.replace(lede || "", "")}${
        lede ? lede.replace("<p>", '<p class="lede">') : ""
      }</div><div class="toc">${toc}</div>`,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${bodyWithCover}
</body>
</html>`;
}

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/build-assessment-pdf.js <assessment.md> [--kicker \"text\"]");
    process.exit(1);
  }
  const kickerIndex = process.argv.indexOf("--kicker");
  const kicker = kickerIndex > -1 ? process.argv[kickerIndex + 1] : "ProCyclingResults project assessment";
  const markdown = fs.readFileSync(input, "utf8");
  const htmlPath = input.replace(/\.md$/i, "") + ".html";
  const pdfPath = input.replace(/\.md$/i, "") + ".pdf";
  fs.writeFileSync(htmlPath, buildDocument(markdown, { kicker }));

  const chrome = findChrome();
  if (!chrome) {
    console.error(`HTML written to ${htmlPath}; no Chrome found to print it (set CHROME_PATH).`);
    process.exit(2);
  }
  execFileSync(
    chrome,
    ["--headless", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000", `--print-to-pdf=${path.resolve(pdfPath)}`, `file://${path.resolve(htmlPath)}`],
    { stdio: "ignore" },
  );
  fs.unlinkSync(htmlPath);
  console.log(`Wrote ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);
}

if (require.main === module) {
  main();
}

module.exports = { render, buildDocument };
