# BlueDot grants visualization

- `node scripts/fetch-grants.mjs` — pulls public data from bluedot.org's tRPC endpoints (rapid grants + stats, career-transition roster + stats) into `data/grants.json` and `web/data.js`. Needs Node 18+.
- Open `web/index.html` (no server or build needed; Chart.js loads from CDN).

## Deploy
Pushing to `main` deploys `web/` to GitHub Pages via `.github/workflows/pages.yml` (repo Settings → Pages → Source: GitHub Actions). To refresh the data: run the fetch script, commit `data/` and `web/data.js`, push.
