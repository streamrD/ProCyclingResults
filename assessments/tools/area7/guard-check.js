const path = require("path");
const dir = "/app";
const assetRoot = path.join(dir, "assets");
for (const p of ["/assets/../assets-other/x.txt", "/assets/../server.js", "/assets/%2e%2e/server.js", "/assets/fonts/../../data/about.md"]) {
  const resolved = path.normalize(path.join(dir, p));
  console.log(p, "->", resolved, "passes guard:", resolved.startsWith(assetRoot), "| with separator:", resolved.startsWith(assetRoot + path.sep));
}
// markdown link scheme rule from renderMarkdownInline
const re = /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g;
for (const s of ["[a](//evil.example/x)", "[a](/assets/x.jpg)", "[a](javascript:alert(1))"]) {
  console.log(s, "->", JSON.stringify([...s.matchAll(re)].map((m) => m[2])));
}
// Host header edge
try { new URL("/x", "http://" + "bad host"); } catch (e) { console.log("host with space ->", e.message); }
try { console.log("no host ->", new URL("/x", "http://undefined").href); } catch (e) { console.log(e.message); }
