# Poker Settlement

Poker Settlement is a static React + TypeScript PWA for tracking poker-night finances: players, sessions, multiple games, ledger entries, combined balances, proportional imbalance correction, simplified final transfers, threshold-based ignored payments, and local JSON backup.

The MVP is intentionally backend-free. All data is stored locally in IndexedDB and the app is designed for GitHub Pages hosting and iPhone Safari home-screen use.

## Features

- Reusable player list with archive support
- Session creation with active-player selection
- Multiple games per session, each with its own ledger
- Buy-ins, rebuys, payouts, manual corrections, and note rows
- Per-game and combined balances
- Deterministic imbalance correction with integer remainder handling
- Greedy transfer simplification
- Threshold split for small transfers
- Saved settlement-run history
- Copyable settlement and session summaries
- JSON backup export/import
- Offline-ready PWA with service worker and install metadata

## Stack

- React 18
- TypeScript
- Vite 5
- Dexie / IndexedDB
- React Router with `HashRouter`
- Vitest for pure logic tests
- Vite PWA plugin

## Local development

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Because the app uses `HashRouter`, route refreshes work cleanly on static hosting and in local preview.

## Production build

```bash
npm run lint
npm run test
npm run build
```

The build output goes to `dist/`.

## GitHub Pages deployment

This repo includes `.github/workflows/deploy-pages.yml`.

1. Push the repository to GitHub.
2. Make sure the default branch is `main`.
3. In GitHub, open `Settings > Pages`.
4. Set `Build and deployment` to `GitHub Actions`.
5. Push to `main` or manually run the workflow.

The workflow sets `GITHUB_PAGES=true`, which makes Vite use `/<repo>/` as the build base path automatically. For user-site hosting or custom manual builds, see [docs/deployment-github-pages.md](docs/deployment-github-pages.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Settlement Logic](docs/settlement-logic.md)
- [Deployment on GitHub Pages](docs/deployment-github-pages.md)
- [Data Model](docs/data-model.md)

## Notes

- The app stores money as integer minor units. The default is whole INR (`moneyScale = 1`).
- The imported product brief contains a sign/correction ambiguity. The implementation chooses the zero-sum-safe correction behavior and documents it in [docs/settlement-logic.md](docs/settlement-logic.md).
