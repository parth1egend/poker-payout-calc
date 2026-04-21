# Data Model

## Core entities

### Player

- `id`
- `name`
- `nickname?`
- `archived`
- `createdAt`
- `updatedAt`

Reusable person record across sessions.

### Group

- `id`
- `name`
- `archived`
- `createdAt`
- `updatedAt`

Reserved for recurring poker groups. The MVP stores the model for forward compatibility even though group management is minimal in the current UI.

### Session

- `id`
- `title`
- `date`
- `location?`
- `notes?`
- `groupId?`
- `createdAt`
- `updatedAt`

Represents one poker night or event.

### SessionPlayer

- `id`
- `sessionId`
- `playerId`
- `createdAt`

Join table between sessions and reusable players.

### Game

- `id`
- `sessionId`
- `name`
- `notes?`
- `includeInSettlement`
- `createdAt`
- `updatedAt`

Represents one table, format, or side game within a session.

### LedgerEntry

- `id`
- `sessionId`
- `gameId`
- `playerId`
- `entryType`
- `amountMinor`
- `note?`
- `createdAt`
- `updatedAt`

Supported `entryType` values:

- `buyIn`
- `rebuy`
- `payout`
- `correction`
- `note`

### SettlementRun

- `id`
- `sessionId`
- `selectedGameIds`
- `thresholdMinor`
- `imbalanceBeforeMinor`
- `imbalanceAfterMinor`
- `correctionRows`
- `payments`
- `mainPayments`
- `smallPayments`
- `rawBalances`
- `correctedBalances`
- `warnings`
- `createdAt`

Each saved run is a point-in-time snapshot of the settlement output for a session.

### AppSettings

- `id = "app"`
- `currencyLabel`
- `defaultThresholdMinor`
- `showIgnoredSmallTransfers`
- `autoRunCorrection`
- `moneyScale`
- `updatedAt`

## Storage choice

The MVP uses IndexedDB via Dexie because:

- it is durable enough for local-only usage
- it supports structured records better than `localStorage`
- it fits GitHub Pages and offline usage with no backend

## Backup

The JSON backup exports all tables plus app settings. Restore clears local tables and replaces them with the imported payload.
