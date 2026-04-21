# Settlement Logic

## Sign convention

The app stores balances with this convention:

- positive balance: the player should receive money
- negative balance: the player should pay money

Per-entry effects:

- `buyIn`, `rebuy`: negative
- `payout`: positive
- `correction`: signed exactly as entered
- `note`: zero

Per-game net:

```text
net = payouts - buy_ins - rebuys + manual_corrections
```

Combined session net is the sum of selected game nets.

## Important note on the source brief

The brief says:

- if the combined sum is negative, reduce winners
- if the combined sum is positive, reduce losers

Under the positive-receives / negative-pays convention above, those directions do not mathematically return the system to zero. They move the total farther away from zero.

To keep the product trustworthy and zero-sum, the implementation uses the equivalent correction that actually resolves the imbalance:

- if the sum is negative, adjust losers toward zero proportionally
- if the sum is positive, adjust winners toward zero proportionally

This is the only way to satisfy all of the following at once:

- integer arithmetic
- deterministic correction
- exact post-correction zero sum
- positive = receive / negative = pay

## Imbalance correction

Let `S` be the combined balance sum across selected games.

### Case 1: `S = 0`

No correction is needed.

### Case 2: `S < 0`

The session is short overall. The app allocates `|S|` proportionally across players with negative balances.

Each affected player gets a positive adjustment, moving them closer to zero.

### Case 3: `S > 0`

The session has excess payout overall. The app allocates `S` proportionally across players with positive balances.

Each affected player gets a negative adjustment, moving them closer to zero.

## Proportional allocation and integer remainder handling

For each affected player:

```text
quota = total_correction * player_basis / total_basis
```

Because money is stored as integers:

1. Take the floor of each quota.
2. Compute the leftover remainder.
3. Distribute leftover units one by one to the largest fractional remainders.
4. Break exact ties deterministically by:
   - larger basis first
   - player id ascending

This guarantees:

- the total allocated correction is exact
- the final corrected balances sum exactly to zero when correction is possible
- repeated recomputation produces the same result

## Greedy settlement algorithm

After correction:

1. creditors = players with positive balances
2. debtors = players with negative balances
3. sort both by descending magnitude, then by id
4. match largest debtor with largest creditor
5. transfer `min(abs(debtor), creditor)`
6. continue until all balances are settled

This is deterministic and usually minimal or near-minimal in transaction count for the standard debtor-creditor problem.

## Threshold split

The app computes the full settlement first.

Then it splits payments into:

- main transfers: `amount >= threshold`
- small transfers: `amount < threshold`

Ignoring the small bucket is explicitly shown as non-exact settlement. The app also computes the carry-forward impact by player so the ignored residue is still transparent.

## Example

Raw corrected balances:

- A: `+400`
- B: `-250`
- C: `-150`

Greedy settlement:

- B pays A `250`
- C pays A `150`

If threshold is `200`:

- main transfer: `B -> A 250`
- small transfer: `C -> A 150`

Ignoring the small transfer means C still owes `150` and A is still short `150`.
