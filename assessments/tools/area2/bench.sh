#!/bin/bash
# Usage: bench.sh <mode> where mode is homepage-ready | ready | load
# Starts a fresh local server from the worktree on port 3111, runs one benchmark, stops the server.
# Each cold mode is a true cold start (new process, empty cache) that fetches live upstream sources.
WT=/Users/tcs16/AgenticAI/ProCyclingResults/.claude/worktrees/agent-aa6954dd84a0ef280
OUT=/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/area2-scratch
MODE="$1"
PORT=3111
cd "$WT" || exit 1
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT busy"; exit 1
fi
echo "== start server $(date -u +%H:%M:%S) mode=$MODE"
PORT=$PORT node server.js > "$OUT/server-$MODE.log" 2>&1 &
SERVER_PID=$!
sleep 1
START=$(date +%s)
case "$MODE" in
  homepage-ready)
    npm run benchmark:homepage-ready -- --base-url=http://localhost:$PORT --ready-timeout-ms=240000 --runs=3 2>&1 | tee "$OUT/bench-$MODE.log"
    ;;
  ready)
    npm run benchmark:ready -- --base-url=http://localhost:$PORT --ready-timeout-ms=240000 --runs=3 2>&1 | tee "$OUT/bench-$MODE.log"
    ;;
  load)
    # warm the cache first, then measure warmed responses
    npm run benchmark:homepage-ready -- --base-url=http://localhost:$PORT --ready-timeout-ms=240000 --runs=1 > "$OUT/bench-load-warm.log" 2>&1
    npm run benchmark:load -- --base-url=http://localhost:$PORT --runs=5 2>&1 | tee "$OUT/bench-$MODE.log"
    ;;
esac
END=$(date +%s)
echo "== wall time $((END-START))s; stopping server pid $SERVER_PID"
kill $SERVER_PID 2>/dev/null
sleep 1
kill -9 $SERVER_PID 2>/dev/null
echo "== done $(date -u +%H:%M:%S)"
