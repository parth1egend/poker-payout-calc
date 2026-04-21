# Architecture

## Overview

The current app is intentionally narrow: a single-page payout calculator with local persistence.

- No backend
- No user accounts
- No multi-session workflow
- No cross-device sync

Everything is client-side and deterministic.

## Runtime layers

1. UI layer  
   [SimpleCalculatorApp.tsx](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/features/simple/SimpleCalculatorApp.tsx) renders:
   - player input cards
   - reconciliation panel
   - profit ranking table
   - settlement table

2. Persistence layer  
   [simple-state.ts](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/lib/simple-state.ts) handles IndexedDB read/write via Dexie.
   [simple-state-schema.ts](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/lib/simple-state-schema.ts) owns default state and normalization/validation.

3. Money and settlement logic  
   [money.ts](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/lib/money.ts) handles integer money parsing/formatting.  
   [settlement-engine.ts](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/lib/settlement-engine.ts) handles correction + transfer generation.

4. Build/PWA layer  
   `vite` + `vite-plugin-pwa` provide static bundling, manifest, and service worker.

## Design decisions

- Integer money only: avoids floating-point drift.
- Pure settlement engine: math is testable and independent of React.
- Normalized saved state: malformed or outdated local data is corrected on load.
- Debounced persistence: reduces excessive IndexedDB writes during typing.

## Testing scope

Current tests cover:

- settlement/correction logic
- money parsing edge cases
- calculator state normalization

See `src/test`.
