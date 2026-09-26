#!/bin/bash
# Headless-Chrome probes and screenshots of the saved production homepage at phone and desktop widths.
# Lessons: --user-data-dir under the scratch directory makes Chrome hang in this sandbox, and
# --virtual-time-budget never settles on this page; the plain AGENTS.md recipe works.
cd "$(dirname "$0")" || exit 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
run() { perl -e 'alarm shift; exec @ARGV' 60 "$@"; }
node instrument.js body-home-1.out home-instrumented.html /Users/tcs16/AgenticAI/ProCyclingResults/.claude/worktrees/agent-aa6954dd84a0ef280/assets
PAGE="file://$PWD/home-instrumented.html"
for size in 390,844 1280,1400; do
  w=${size%,*}
  echo "== dump-dom probe at ${size} $(date -u +%H:%M:%S)"
  run "$CHROME" --headless --disable-gpu --hide-scrollbars --window-size=$size --dump-dom "$PAGE" 2>/dev/null \
    | grep -o "<title>PROBE:[^<]*</title>" | sed 's/<title>PROBE://; s/<\/title>//' | tee probe-$w.json
  echo
  echo "== screenshot at ${size} $(date -u +%H:%M:%S)"
  run "$CHROME" --headless --disable-gpu --hide-scrollbars --window-size=$size --screenshot=home-$w.png "$PAGE" 2>/dev/null
  ls -l home-$w.png
done
echo "== done $(date -u +%H:%M:%S)"
