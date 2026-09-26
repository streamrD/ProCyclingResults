#!/bin/bash
D=/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/fetch
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
cnt() { grep -oiE "$2" "$1" 2>/dev/null | wc -l | tr -d ' '; }
fetch() {
  name=$1; url=$2; out="$D/$name.html"
  res=$(curl -sSL --max-time 45 -A "$UA" -H 'Accept: text/html,application/xhtml+xml' -H 'Accept-Language: en-US,en;q=0.9' -o "$out" -w '%{http_code} %{size_download} %{time_total}s %{url_effective}' "$url" 2>&1)
  echo "== $name | $res"
  if [ -s "$out" ]; then
    echo "   gpt=$(cnt "$out" 'googletag|gpt\.js') adsbygoogle=$(cnt "$out" 'adsbygoogle') doubleclick=$(cnt "$out" 'doubleclick') adclass=$(cnt "$out" 'class="[^"]*(ad-slot|adslot|ad-unit|advert|ad-container|ad-wrapper|sticky-ad|\bmpu\b|leaderboard|banner-ad|ad_)[^"]*"') consent=$(cnt "$out" 'onetrust|didomi|cookiebot|sourcepoint|quantcast|usercentrics|cmp\.js|consentmanager|iubenda|__tcfapi|cookieconsent') paywallish=$(cnt "$out" 'paywall|subscribe|membership|become a member') scripts=$(cnt "$out" '<script') extscripts=$(cnt "$out" '<script[^>]+src=') imgs=$(cnt "$out" '<img') viewport=$(cnt "$out" 'name="viewport"') og=$(cnt "$out" 'property="og:') rss=$(cnt "$out" 'application/(rss|atom)\+xml') cloudflare=$(cnt "$out" 'cf-challenge|challenge-platform|Just a moment')"
    echo "   title=[$(grep -oiE '<title[^>]*>[^<]*' "$out" | head -1 | sed -E 's/<title[^>]*>//')]"
    echo "   mentions: vollering=$(cnt "$out" 'vollering') worldchamp=$(cnt "$out" 'world championship|worlds|road world') womens=$(cnt "$out" 'women|femmes|WE ') calendar=$(cnt "$out" 'calendar')"
  fi
}
fetch ours-home 'https://procyclingresults.up.railway.app/'
fetch ours-calendar 'https://procyclingresults.up.railway.app/calendar'
fetch pcs-home 'https://www.procyclingstats.com/'
fetch pcs-result 'https://www.procyclingstats.com/race/world-championship-we/2026/result'
fetch fc-home 'https://firstcycling.com/'
fetch cn-home 'https://www.cyclingnews.com/'
fetch cn-results 'https://www.cyclingnews.com/race-results/'
fetch vv-home 'https://veloviewer.com/'
fetch uci-home 'https://www.uci.org/'
fetch lfr-home 'https://www.la-flamme-rouge.eu/'
fetch escape-home 'https://escapecollective.com/'
ls -la "$D"
