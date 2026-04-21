# Settlement Logic

## Sign convention

- positive balance: player should receive money
- negative balance: player should pay money

## Input modes

### `cashflow` mode

Per-player raw net is computed as:

```text
net = totalOut - totalIn
```

### `net` mode

Per-player raw net is entered directly by the user.

## Imbalance correction

Let `S = sum(all raw balances)`.

- If `S = 0`: no correction
- If `S < 0`: allocate `|S|` proportionally across losers (negative balances) to move them toward zero
- If `S > 0`: allocate `S` proportionally across winners (positive balances) to move them toward zero

This keeps the post-correction system zero-sum when correction is possible.

## Integer remainder handling

For proportional allocation:

1. compute floor allocation per participant
2. compute remaining units
3. distribute remainders by:
   - larger fractional remainder first
   - larger basis first
   - player id lexicographic order (deterministic tie-break)

All money is integer minor units, so no floating-point drift is introduced.

## Settlement routing

After correction:

1. build creditors (`balance > 0`)
2. build debtors (`balance < 0`)
3. sort both by descending absolute balance, then id
4. greedily transfer `min(debtorRemaining, creditorRemaining)` until both lists are exhausted

Each transfer row is:

```text
fromPlayer -> toPlayer : amount
```

## Ranking board

The Profit Ranking table uses corrected balances and is sorted:

1. higher corrected profit first
2. name ascending for ties
