# Cap Table

A daily venture capital game for phones. Everyone in a world sees the same startups on the same days. Back the ones you believe in, watch your city of companies grow, and rank against every firm that had the same chances.

## How it plays
- **Seasons are 7 days.** Each season you get a fresh $10M fund. When the season ends, its stakes lock: no new money, it plays out on its own, and you can still sell any time at 25% below value.
- **Deal Flow:** 3 new startups a day, each open for 2 days. You see founder, market and traction as ranges that always contain the truth. One peek a day narrows a range. Scouting levels (earned by good calls, capped at 3) narrow all ranges.
- **City:** every company you back is a building. Each fund is a district; swipe back through older ones. Gold crown = acquired, rubble = shut down, red light = raising (pay to keep your stake, or get diluted).
- **Standings:** you against six rival firms playing the same world.
- **Practice** runs a separate world where you move time yourself. **Live** follows the calendar from 2026-11-23 (New York time).

All balance numbers live in `src/config.mjs`.

## Run
```
npm run build        # writes dist/index.html, one self-contained page
open dist/index.html # or any static host
```

## Test
```
npm test
```

## Deployed
- Live: not yet (next step: a GitHub Pages workflow)
- Day snapshot: `2026-11-23 - Cap Table` (frozen; never edited)

## Known limits (v1)
- **The future is readable.** The world is computed in the browser from a public seed, so someone reading the code could see which startups win. Fine for a prototype; a fair shared game needs the server to publish each day's state as it happens.
- **Rivals are bots.** Real friends' leagues need a backend (likely the app_builder Cloudflare platform).
- **Progress is per device** (browser storage).

## Ship a sprint day
Set `project` in `sprint.config.json`, then freeze the day's page:
```
node scripts/snapshot.mjs <page.html>            # private
node scripts/snapshot.mjs <page.html> --public   # opts in to the public sprint site
```
Commit `snapshots/` to `main` (via PR). The index's nightly refresh logs the day automatically; public pages still have to pass its UAT and secret scan.
