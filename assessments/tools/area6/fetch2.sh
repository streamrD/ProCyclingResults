#!/bin/bash
D=/private/tmp/claude-503/-Users-tcs16-AgenticAI-ProCyclingResults/c63ca093-89df-43c9-913a-baa41930c571/scratchpad/assessment/fetch
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
cnt() { grep -oiE "$2" "$1" 2>/dev/null | wc -l | tr -d ' '; }
fetch() {
  name=$1; url=$2; out="$D/$name.html"
  res=$(curl -sSL --max-time 45 -A "$UA" -H 'Accept: text/html,application/xhtml+xml' -H 'Accept-Language: en-US,en;q=0.9' -o "$out" -w '%{http_code} %{size_download} %{time_total}s %{url_effective}' "$url" 2>&1)
  echo "== $name | $res"
  if [ -s "$out" ]; then
    echo "   gpt=$(cnt "$out" 'googletag|gpt\.js') doubleclick=$(cnt "$out" 'doubleclick') adclass=$(cnt "$out" 'class="[^"]*(ad-slot|adslot|ad-unit|advert|ad-container|ad-wrapper|sticky-ad|leaderboard|banner-ad|ad_|dfp)[^"]*"') consent=$(cnt "$out" 'onetrust|didomi|cookiebot|sourcepoint|quantcast|usercentrics|__tcfapi|cookieconsent') scripts=$(cnt "$out" '<script') extscripts=$(cnt "$out" '<script[^>]+src=') imgs=$(cnt "$out" '<img') tables=$(cnt "$out" '<table') viewport=$(cnt "$out" 'name="viewport"') cloudflare=$(cnt "$out" 'challenge-platform|Just a moment')"
    echo "   title=[$(grep -oiE '<title[^>]*>[^<]*' "$out" | head -1 | sed -E 's/<title[^>]*>//')]"
    echo "   mentions: vollering=$(cnt "$out" 'vollering') niewiadoma=$(cnt "$out" 'niewiadoma') worldchamp=$(cnt "$out" 'world championship') calendar=$(cnt "$out" 'calendar') women=$(cnt "$out" 'women')"
  fi
}
fetch uci-calendar 'https://www.uci.org/calendar/all/2jnxYAuvjgttyHi6YQ94EJ'
fetch vv-pro 'https://veloviewer.com/pro'
fetch cn-live 'https://www.cyclingnews.com/pro-cycling/live/road-world-championships-2026-elite-womens-road-race-live-the-battle-for-the-rainbow-jersey-begins-in-montreal/'
