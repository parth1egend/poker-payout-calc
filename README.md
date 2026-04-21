# Poker Payout Calculator

Single-page, mobile-first poker settlement app. Enter player names and either:

- buy-in / payout totals, or
- direct net profit/loss values

The app instantly computes:

- corrected final balances (if totals are not zero),
- a ranked profit table (highest winner first),
- and a deterministic who-pays-whom settlement table.

No backend is used. State is stored locally in IndexedDB.

## Current features

- One-screen workflow optimized for phone usage
- Two input modes: `Buy-in / Payout` and `Net Profit`
- Deterministic imbalance correction with integer arithmetic
- Greedy transfer simplification (`from`, `to`, `amount`)
- Profit ranking board
- Local autosave in IndexedDB
- Offline-ready PWA (manifest + service worker)

## Stack

- React 18
- TypeScript
- Vite 5
- Dexie (IndexedDB)
- Vitest
- vite-plugin-pwa

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## GitHub Pages deployment

Deployment workflow is included at [.github/workflows/deploy-pages.yml](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/.github/workflows/deploy-pages.yml).

1. Push to `main`
2. In GitHub: `Settings > Pages`
3. Set source to `GitHub Actions`
4. Run/trigger the workflow

## Docs

- [Architecture](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/docs/architecture.md)
- [Settlement Logic](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/docs/settlement-logic.md)
- [Deployment on GitHub Pages](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/docs/deployment-github-pages.md)
- [Data Model](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/docs/data-model.md)
