# Fantasy Auction Draft Tool

Static auction-draft tracker inspired by [elboberto’s Fantasy Football spreadsheet](https://www.reddit.com/user/elboberto). Track teams, budgets, picks, inflated values, and best available players — deployable on GitHub Pages.

## Features

- League + team setup (budget, roster size, starters, up to 20 teams)
- CSV player import (`name,pos,team,bye,tier,projected$,vbd,aav`)
- Bundled **2026 sample** extracted from the elboberto Auction sheet
- Live auction board: paid cost, inflated $, skew, drafted by, targets
- Overall inflation/deflation and per-position best/2nd remaining + dropoff
- Team budgets, max bid, and rosters
- localStorage persistence + JSON backup export/import

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

1. **Setup** — set teams/budget and rename teams  
2. **Players** — click **Load 2026 sample** or import your CSV  
3. **Auction** — draft players as the auction runs  
4. **Teams** — review budgets and rosters  

## CSV format

```csv
name,pos,team,bye,tier,projected$,vbd,aav
Jahmyr Gibbs,RB,DET,6,RB1,83.52,218.59,72.7
```

`pos` must be one of: `QB`, `RB`, `WR`, `TE`, `K`, `DEF` (aliases: `DST`).

Each season, replace the player pool with a fresh CSV (same practical workflow as pasting into the spreadsheet’s Raw tabs).

## Follow-up: scrape proxy

Not in this release. Next step can add a small serverless/proxy that pulls FantasyPros (API key) and/or ESPN depth charts and returns CSV/JSON for the app to import — keeping the static Pages frontend CORS-safe.

## Inflation math (from the sheet)

| Metric | Formula |
|--------|---------|
| Inflation | `(Σ projected$ − Σ paid) / Σ projected$ of undrafted` |
| Inflated $ | `projected$ × inflation` |
| Max bid | `remainingBudget − (rosterSpotsLeft − 1)` |

## Why no live web scrape?

The Excel workbook’s Power Query only scrapes an ESPN **depth chart** article. Projections are manual (FantasyPros). A browser-only GitHub Pages app cannot reliably call those sites (CORS / API keys). **CSV import** is the v1 data path. A small **proxy + scraper** is planned as follow-up work.

## Deploy to GitHub Pages

1. Create a GitHub repo named `fantasy-auction-draft-tool` (or update `base` in `vite.config.ts` to match).
2. Push this project.
3. In the repo: **Settings → Pages → Source: GitHub Actions**.
4. Push to `main` — the workflow builds with `GITHUB_PAGES=true` and publishes `dist/`.

Manual publish:

```bash
GITHUB_PAGES=true npm run build
npx gh-pages -d dist
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build for Pages + `gh-pages` |

## Backup

Use **Setup → Export JSON** before draft day. Import restores settings, players, and picks.
