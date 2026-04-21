# Architecture

## Overview

The app is a static client-side PWA. There is no backend for the MVP. All durable state lives in IndexedDB through Dexie, and all settlement math is computed from stored ledger rows so results remain deterministic and auditable.

## Main layers

1. UI layer
   React pages in `src/features/*` render the mobile-first screens:
   - Sessions
   - Players
   - Session detail
   - Game detail
   - Settlement
   - Backup / Settings

2. Persistence layer
   `src/lib/db.ts` defines the IndexedDB schema and helper functions for CRUD, backup import/export, and settlement-run snapshots.

3. Domain / calculation layer
   `src/lib/settlement-engine.ts` contains pure logic for:
   - per-game nets
   - combined balances
   - imbalance correction
   - greedy payment simplification
   - threshold split

4. Formatting / summary helpers
   `src/lib/money.ts`, `src/lib/summary.ts`, and `src/lib/session-metrics.ts` format amounts and build copyable summaries without mixing those concerns into components.

## Routing

The app uses `HashRouter` for maximum GitHub Pages compatibility:

- static hosting has no server-side route rewriting
- refreshes on nested routes still work
- Pages deployment remains trivial

## Offline and PWA

`vite-plugin-pwa` generates the manifest and service worker. The configuration caches the app shell and static assets so the previously loaded app remains available offline.

## Why this structure

- Trustworthy math: UI does not contain settlement formulas.
- Auditability: settlement runs are snapshotted and stored locally.
- Maintainability: small helpers keep pages focused on workflow.
- GitHub Pages fit: the whole product ships as a static bundle.
