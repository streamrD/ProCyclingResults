#!/bin/bash
# Second diagnosis pass: the AGENTS.md recipe exactly (no user-data-dir), screenshot instead of dump-dom, then --no-sandbox.
cd "$(dirname "$0")" || exit 1
pkill -9 -f "Google Chrome.*--headless" 2>/dev/null
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
run() { perl -e 'alarm shift; exec @ARGV' 40 "$@"; echo "[exit $?]"; }
echo "== A recipe screenshot of tiny.html $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --screenshot=tiny.png --window-size=390,844 --hide-scrollbars "file://$PWD/tiny.html" 2>&1 | grep -v "^$" | tail -2
ls -l tiny.png 2>/dev/null
echo "== B recipe screenshot of instrumented page at 390 $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --screenshot=home-390.png --window-size=390,844 --hide-scrollbars "file://$PWD/home-instrumented.html" 2>&1 | grep -v "^$" | tail -2
ls -l home-390.png 2>/dev/null
echo "== C dump-dom of instrumented page at 390 with --no-sandbox $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --no-sandbox --window-size=390,844 --hide-scrollbars --dump-dom "file://$PWD/home-instrumented.html" 2>/dev/null | grep -o "<title>PROBE:[^<]*</title>" | cut -c1-600
echo "== done $(date -u +%H:%M:%S)"
