#!/bin/bash
# Exactly 9 production GETs: 3 x /, 3 x /api/homepage-data, 3 x /api/races.
# Sent with a phone-like User-Agent and Accept-Encoding so Content-Encoding reflects what a browser gets.
cd "$(dirname "$0")"
BASE=https://procyclingresults.up.railway.app
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
FMT='status=%{http_code} ttfb=%{time_starttransfer} total=%{time_total} connect=%{time_connect} tls=%{time_appconnect} size_download=%{size_download} size_header=%{size_header} speed=%{speed_download}\n'
for path in / /api/homepage-data /api/races; do
  name=$(echo "$path" | tr '/?' '__')
  if [ "$name" = "_" ]; then name=home; fi
  for run in 1 2 3; do
    echo "== GET $path run $run  $(date -u +%H:%M:%S)"
    curl -sS --compressed -A "$UA" -H 'Accept-Encoding: gzip, deflate, br' \
      -o "body-${name}-${run}.out" -D "headers-${name}-${run}.txt" \
      -w "$FMT" "$BASE$path"
  done
done
