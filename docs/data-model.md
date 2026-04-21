# Data Model

## Persisted calculator state

The app stores one record in IndexedDB (`calculatorState` table) keyed by `id = "current"`.

```ts
type EntryMode = "cashflow" | "net";

interface CalculatorRow {
  id: string;
  name: string;
  totalInMinor: number;  // non-negative integer
  totalOutMinor: number; // non-negative integer
  netMinor: number;      // signed integer (used in net mode)
}

interface CalculatorState {
  id: "current";
  mode: EntryMode;
  currencyLabel: string; // e.g. USD, INR
  rows: CalculatorRow[];
  updatedAt: string;     // ISO timestamp
}
```

## Normalization rules

On load/save, state is normalized by [simple-state-schema.ts](/mnt/c/Users/parth/Desktop/CODING/Poker/poker-payout-calc/src/lib/simple-state-schema.ts):

- Invalid mode defaults to `cashflow`
- Invalid currency defaults to `USD`
- `rows` is capped to 150 entries
- Empty row list is replaced with one blank row
- `totalInMinor` and `totalOutMinor` are clamped to non-negative safe integers
- `netMinor` is clamped to a signed safe integer
- Missing/invalid row id is regenerated
- Long names are truncated to 80 chars

## Derived runtime data (not persisted)

Computed each render from rows:

- active players (non-empty names)
- raw net balances
- corrected balances
- adjustment list
- settlement transfer list
- ranked profitability list

These are intentionally not stored to keep the persisted model minimal and recomputable.
