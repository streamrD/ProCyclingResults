const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const lines = src.split('\n');
const fnRe = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
const arrowRe = /^const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/;
const constRe = /^const\s+([A-Za-z0-9_$]+)/;
const fns = [];
let topConsts = 0;
const topConstNames = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let m = l.match(fnRe);
  if (m) { fns.push({ name: m[1], start: i, kind: 'function' }); continue; }
  m = l.match(arrowRe);
  if (m) { fns.push({ name: m[1], start: i, kind: 'arrow' }); continue; }
  m = l.match(constRe);
  if (m) { topConsts++; topConstNames.push({ name: m[1], line: i + 1 }); }
}
for (const f of fns) {
  let end = f.start;
  for (let j = f.start + 1; j < lines.length; j++) {
    if (/^\}\)?;?\s*$/.test(lines[j])) { end = j; break; }
  }
  f.end = end; f.len = end - f.start + 1;
  let k = f.start - 1; let hasComment = false; let commentLines = 0;
  while (k >= 0 && (/^\s*\/\//.test(lines[k]) || /^\s*\*\/?/.test(lines[k]) || /^\s*\/\*/.test(lines[k]))) { hasComment = true; commentLines++; k--; }
  f.comment = hasComment; f.commentLines = commentLines;
}
fns.sort((a, b) => b.len - a.len);
console.log('LINES', lines.length);
console.log('FUNCTIONS', fns.length, 'declared', fns.filter(f => f.kind === 'function').length, 'arrow', fns.filter(f => f.kind === 'arrow').length);
console.log('TOP_CONSTS', topConsts);
console.log('WITH_PRECEDING_COMMENT', fns.filter(f => f.comment).length);
console.log('TOTAL_FN_LINES', fns.reduce((a, f) => a + f.len, 0));
console.log('FNS_OVER_100', fns.filter(f => f.len > 100).length, 'OVER_200', fns.filter(f => f.len > 200).length, 'OVER_50', fns.filter(f => f.len > 50).length);
const med = [...fns].sort((a, b) => a.len - b.len)[Math.floor(fns.length / 2)].len;
console.log('MEDIAN_FN_LEN', med);
console.log('TOP15');
for (const f of fns.slice(0, 15)) console.log(`${f.name}\t${f.start + 1}-${f.end + 1}\t${f.len}\tcomment=${f.comment}`);
const cons = {};
lines.forEach((l) => { const m = l.match(/console\.(log|error|warn|info)\(/); if (m) { cons[m[1]] = (cons[m[1]] || 0) + 1; } });
console.log('CONSOLE', JSON.stringify(cons));
console.log('COMMENT_LINES', lines.filter(l => /^\s*\/\//.test(l) || /^\s*\*/.test(l) || /^\s*\/\*/.test(l)).length);
console.log('BLANK_LINES', lines.filter(l => /^\s*$/.test(l)).length);
let maxLen = 0, maxAt = 0; lines.forEach((l, i) => { if (l.length > maxLen) { maxLen = l.length; maxAt = i + 1; } });
console.log('LONGEST_LINE', maxLen, 'at', maxAt);
fs.writeFileSync(process.argv[3], JSON.stringify({ fns, topConstNames }));
