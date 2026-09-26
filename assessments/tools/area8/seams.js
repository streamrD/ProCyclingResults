// Classify each top-level function in server.js into a seam by name, then count calls
// across seams and direct touches of cache state from each seam.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const lines = src.split('\n');
const { fns } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const CACHE_NAMES = ['raceMetadataCache', 'deferredRaceMetadataCache', 'raceDataCache', 'deferredRaceDataCache', 'deferredGroupDataCaches', 'articleCache', 'finishVideoCache', 'worldChampionshipMissingPages', 'wikiRawCache', 'teamNameCache', 'officialSnapshotCache', 'stageHistoryCache', 'seasonOpeningCache', 'stageProfileCache', 'nationalChampionshipsCache', 'wikiRevisionIndex', 'liveRaceRefreshTimer'];
function seamOf(name) {
  if (/^(fetch|load|probe|warm|refresh|getWikiRevision|indexWikiRevisions|fetchText|fetchWikiRaw|readSiteContent|writeSiteContent|commitSiteContent)/.test(name)) return 'sources';
  if (/Official|Aso|Letour|Livefeed|Ajax|Snapshot|Provider/.test(name)) return 'providers';
  if (/^(parse|extract|clean|decode|normalize|fold|split|tokenize|match|is[A-Z]|has[A-Z]|infer|resolve|derive|classify|pick|group|merge|apply|compare|score|select|rank|choose|toIso|toUtc|format|convert)/.test(name)) return 'parsers';
  if (/^(build|render|escape|send|create[A-Z].*(Markup|Html|Id)|get[A-Z].*(Markup|Html|Url|Label|Class))/.test(name) || /Markup|Html|Page|Section|Card|Svg|Hero|Payload/.test(name)) return 'rendering';
  if (/^(handle|sendJson|sendHtml|sendStaticFile|findSiteContentPageByPath|getShareView|isAuthorizedSiteEdit)/.test(name)) return 'http';
  return 'other';
}
const byName = new Map(fns.map(f => [f.name, f]));
for (const f of fns) f.seam = seamOf(f.name);
const seamCounts = {};
for (const f of fns) seamCounts[f.seam] = (seamCounts[f.seam] || 0) + 1;
console.log('SEAM_FUNCTION_COUNTS', JSON.stringify(seamCounts));
const seamLines = {};
for (const f of fns) seamLines[f.seam] = (seamLines[f.seam] || 0) + f.len;
console.log('SEAM_LINE_COUNTS', JSON.stringify(seamLines));
const cross = {};
const cacheTouch = {};
const callRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
for (const f of fns) {
  const body = lines.slice(f.start + 1, f.end + 1).join('\n');
  const seen = new Set();
  let m;
  while ((m = callRe.exec(body))) {
    const callee = m[1];
    if (callee === f.name || !byName.has(callee) || seen.has(callee)) continue;
    seen.add(callee);
    const to = byName.get(callee).seam;
    const key = `${f.seam}->${to}`;
    cross[key] = (cross[key] || 0) + 1;
  }
  for (const c of CACHE_NAMES) {
    if (new RegExp(`\\b${c}\\b`).test(body)) {
      cacheTouch[f.seam] = cacheTouch[f.seam] || new Set();
      cacheTouch[f.seam].add(f.name);
    }
  }
}
console.log('CROSS_SEAM_CALL_EDGES (distinct caller->callee pairs)');
for (const k of Object.keys(cross).sort()) console.log(' ', k, cross[k]);
console.log('FUNCTIONS TOUCHING CACHE STATE BY SEAM');
for (const k of Object.keys(cacheTouch)) console.log(' ', k, cacheTouch[k].size, [...cacheTouch[k]].join(', '));
// rendering functions that call parsers or sources directly
const renderingToParsers = [];
const renderingToSources = [];
for (const f of fns.filter(x => x.seam === 'rendering')) {
  const body = lines.slice(f.start + 1, f.end + 1).join('\n');
  let m; const seen = new Set();
  while ((m = callRe.exec(body))) {
    const callee = m[1];
    if (!byName.has(callee) || seen.has(callee)) continue;
    seen.add(callee);
    const to = byName.get(callee).seam;
    if (to === 'parsers') renderingToParsers.push(`${f.name}->${callee}`);
    if (to === 'sources' || to === 'providers') renderingToSources.push(`${f.name}->${callee}`);
  }
}
console.log('RENDERING->PARSERS', renderingToParsers.length, renderingToParsers.slice(0, 40).join(', '));
console.log('RENDERING->SOURCES/PROVIDERS', renderingToSources.length, renderingToSources.join(', '));
