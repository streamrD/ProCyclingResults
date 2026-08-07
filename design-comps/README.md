# Design comps

Design explorations kept alongside the code, so the rejected options and the reasoning
behind the chosen one don't get lost.

## favicon-directions.html

Five cyclist favicon marks explored for the site, all drawn from the existing UCI
palette in `server.js` (`--uci-blue #0033a0`, `--uci-blue-deep #00184d`,
`--uci-yellow #ffcc00`, `--uci-red #ef3340`).

Open it directly in a browser — it pulls Barlow Semi Condensed and Manrope from
`../assets/fonts`, so keep it in this folder or the type falls back.

Each mark is shown at 48/32/16px on both light and dark grounds plus a mock browser
tab, because 16px is where a favicon actually has to work. That test decided the set:
two earlier candidates (a spoked-wheel mark and a version with motion lines) read well
large and turned to mush small, so they were dropped rather than refined.

| Mark | Character |
| --- | --- |
| `marks/mono.svg` | **Chosen.** No background plate; sits on the browser's own chrome |
| `marks/maillot-jaune.svg` | Navy on yellow. Highest contrast, sharpest at 16px |
| `marks/rouge.svg` | White on UCI red. Loudest in a crowded tab bar |
| `marks/squircle.svg` | App-icon shape, for a home-screen bookmark or PWA install |
| `marks/roundel.svg` | The only one drawing the full bike. Best large, softest small |

## Swapping the favicon

`marks/mono.svg` is a copy of what ships. To switch to a different mark, copy it over
`assets/favicon.svg` — the `<link rel="icon">` tags in `server.js` point at that fixed
path and don't need touching.

Two things to know before swapping:

- Static assets are served with `cache-control: max-age=31536000, immutable`, so a
  replacement at the same path won't reach anyone who already has the old one cached.
  Add a version query to the `<link>` (`/assets/favicon.svg?v=2`) when you change it.
- Only `mono.svg` carries a `prefers-color-scheme` rule, which it needs because it has
  no background plate. The other four bring their own background and work on any tab bar.
