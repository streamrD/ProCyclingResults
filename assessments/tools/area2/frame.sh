#!/bin/bash
# Headless Chrome clamps its window to 500px wide, so a --window-size=390 run lays the page out at
# 500px and crops the screenshot. To lay the page out at a true 390px, host it in a 390x844 iframe.
cd "$(dirname "$0")" || exit 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
run() { perl -e 'alarm shift; exec @ARGV' 60 "$@"; }
node instrument.js body-home-1.out home-instrumented.html /Users/tcs16/AgenticAI/ProCyclingResults/.claude/worktrees/agent-aa6954dd84a0ef280/assets
cat > host-390.html <<'EOF'
<!doctype html>
<html><head><meta charset="utf-8"><title>HOST</title>
<style>html,body{margin:0;background:#888}iframe{display:block;width:390px;height:844px;border:0;background:#fff}</style>
<script>
window.addEventListener("message", function (e) { document.title = "FRAME" + String(e.data); });
window.addEventListener("load", function () {
  try { var t = document.getElementById("f").contentDocument.title; if (t.indexOf("PROBE:") === 0) document.title = "FRAME" + t; } catch (err) {}
});
</script></head>
<body><iframe id="f" src="home-instrumented.html"></iframe></body></html>
EOF
PAGE="file://$PWD/host-390.html"
echo "== dump-dom probe of the 390px iframe $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=500,844 --dump-dom "$PAGE" 2>/dev/null \
  | grep -o "<title>FRAMEPROBE:[^<]*</title>" | sed 's/<title>FRAMEPROBE://; s/<\/title>//' | tee probe-390-true.json
echo
echo "== screenshot of the 390px iframe (window 500x844; the iframe is the left 390px) $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=500,844 --screenshot=home-390-true.png "$PAGE" 2>/dev/null
ls -l home-390-true.png
echo "== plain 500-wide probe again, for the timing fields $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --hide-scrollbars --window-size=390,844 --dump-dom "file://$PWD/home-instrumented.html" 2>/dev/null \
  | grep -o "<title>PROBE:[^<]*</title>" | sed 's/<title>PROBE://; s/<\/title>//' | tee probe-500.json
echo
echo "== done $(date -u +%H:%M:%S)"
