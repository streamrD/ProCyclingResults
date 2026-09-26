#!/bin/bash
# Diagnose why headless Chrome does not return on the saved page. Every run is capped at 30s by perl alarm.
cd "$(dirname "$0")" || exit 1
pkill -9 -f "chrome-profile-" 2>/dev/null
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
run() { perl -e 'alarm shift; exec @ARGV' 30 "$@"; echo "[exit $?]"; }
echo "<!doctype html><title>tiny</title><p>hi</p>" > tiny.html
echo "== 1 tiny page dump-dom $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --no-first-run --user-data-dir=./chrome-profile-t1 --dump-dom "file://$PWD/tiny.html" 2>&1 | tail -3
echo "== 2 raw production html (no probe, no font rewrite) dump-dom, JS disabled $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --no-first-run --user-data-dir=./chrome-profile-t2 --blink-settings=scriptEnabled=false --dump-dom "file://$PWD/body-home-1.out" 2>/dev/null | wc -c
echo "== 3 instrumented html dump-dom, JS disabled $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --no-first-run --user-data-dir=./chrome-profile-t3 --blink-settings=scriptEnabled=false --dump-dom "file://$PWD/home-instrumented.html" 2>/dev/null | wc -c
echo "== 4 instrumented html dump-dom with JS, umami blocked via host-resolver $(date -u +%H:%M:%S)"
run "$CHROME" --headless --disable-gpu --no-first-run --user-data-dir=./chrome-profile-t4 --host-resolver-rules="MAP todd-umami.up.railway.app 127.0.0.1" --window-size=390,844 --dump-dom "file://$PWD/home-instrumented.html" 2>/dev/null | grep -o "<title>PROBE:[^<]*</title>" | cut -c1-400
echo "== done $(date -u +%H:%M:%S)"
