# Fantasy Auction Draft Tool

Static auction-draft tracker inspired by [elboberto’s Fantasy Football spreadsheet](https://www.reddit.com/user/elboberto). Track teams, budgets, picks, inflated values, and best available players — deployable on GitHub Pages.

## Features

- League + team setup (budget, roster size, starters, up to 20 teams)
- CSV player import (`name,pos,team,bye,tier,projected$,vbd,aav`)
- **Offline data refresh** via FantasyPros API → `public/data/players.json` + `lastUpdated`
- Live auction board: paid cost, inflated $, skew, drafted by, targets
- Overall inflation/deflation and per-position best/2nd remaining + dropoff
- Team budgets, max bid, and rosters
- localStorage persistence + JSON backup export/import

## Quick start

```bash
npm install
cp .env.example .env   # add FANTASYPROS_API_KEY
npm run refresh-data   # writes public/data/*
npm run dev
```

1. **Setup** — set teams/budget and rename teams  
2. **Players** — **Load current data** (or CSV)  
3. **Auction** — draft as the auction runs  
4. **Teams** — review budgets and rosters  

## Refreshing player data (no live proxy)

GitHub Pages is static — the browser never calls FantasyPros. You refresh locally, commit the JSON, and redeploy.

```bash
# .env (gitignored)
FANTASYPROS_API_KEY=your_key_here
AAV_PROVIDER=yahoo
SEASON=2026

npm run refresh-data
git add public/data
git commit -m "Refresh player data"
git push
```

### FantasyPros API key

1. Request a key: [secure.fantasypros.com/api-keys/request](https://secure.fantasypros.com/api-keys/request)  
2. Docs: [fantasypros.com/api-data](https://www.fantasypros.com/api-data/)  
3. **Free** keys return ~10 players/position (too small for full VBD). The refresh script then **overlays** FP metadata onto the Excel sample seed.  
4. **Premium / HOF** (~$8.99/mo) unlocks full projections — the script then runs the starter/bench `$` valuation end-to-end from FP stats.

How this mirrors the Excel sheet:

| Sheet source | Our refresh |
|--------------|-------------|
| FantasyPros projections → Raw tabs | FP API `/nfl/{season}/projections` |
| LeagueInfo VBD → `$` | `scripts/lib/valuation.ts` (starter/bench) when API is full |
| Yahoo/ESPN AAV → Skew | Best-effort AAV fetch (`AAV_PROVIDER`) |
| ESPN depth-chart Power Query | Not ported (auction doesn’t need it) |

## CSV format

```csv
name,pos,team,bye,tier,projected$,vbd,aav
Jahmyr Gibbs,RB,DET,6,RB1,83.52,218.59,72.7
```

`pos`: `QB`, `RB`, `WR`, `TE`, `K`, `DEF` (alias `DST`).

## Inflation math (from the sheet)

| Metric | Formula |
|--------|---------|
| Inflation | `(Σ projected$ − Σ paid) / Σ projected$ of undrafted` |
| Inflated $ | `projected$ × inflation` |
| Max bid | `remainingBudget − (rosterSpotsLeft − 1)` |

## Deploy to GitHub Pages

1. Push to `main` on `fantasy-auction-draft-tool`.
2. **Settings → Pages → Source: GitHub Actions**.
3. Workflow builds with `GITHUB_PAGES=true` and publishes `dist/`.

Site: `https://buckwp-auto.github.io/fantasy-auction-draft-tool/`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run refresh-data` | Pull FP (+ AAV) → `public/data/` |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build for Pages + `gh-pages` |

## Backup

Use **Setup → Export JSON** before draft day. Import restores settings, players, and picks.

For the 2026 keeper start file (12-team Superflex, $200, keepers pre-loaded, **Superflex-revalued $**): import [`draft-2026-keepers.json`](draft-2026-keepers.json) via Setup → Import JSON. Your team is **Buck, Will** ($160 remaining after keepers).

After changing starters/flex, use **Setup → Revalue $ from league settings** (needs player `fpts`). Superflex counts as a second QB for scarcity — Josh Allen jumps from ~$33 (1QB seed) to ~$70 in this league.

## Security

- Put API keys only in `.env` (gitignored). Never commit them.
- If a key was pasted into chat, rotate it on FantasyPros.
