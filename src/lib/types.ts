export type EntityId = string;

export type EntryType = "buyIn" | "rebuy" | "payout" | "correction" | "note";

export interface LedgerEntry {
  id: EntityId;
  sessionId: EntityId;
  gameId: EntityId;
  playerId: EntityId;
  entryType: EntryType;
  amountMinor: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementPlayerBalance {
  playerId: EntityId;
  balanceMinor: number;
}

export interface CorrectionRow {
  playerId: EntityId;
  basisMinor: number;
  adjustmentMinor: number;
}

export interface PaymentInstruction {
  fromPlayerId: EntityId;
  toPlayerId: EntityId;
  amountMinor: number;
}

export interface PlayerNetSummary {
  playerId: EntityId;
  contributedMinor: number;
  paidOutMinor: number;
  correctionsMinor: number;
  netMinor: number;
}

export interface GameNetSummary {
  gameId: EntityId;
  balances: SettlementPlayerBalance[];
  perPlayer: PlayerNetSummary[];
}

export interface SettlementComputation {
  sessionId: EntityId;
  selectedGameIds: EntityId[];
  thresholdMinor: number;
  rawBalances: SettlementPlayerBalance[];
  correctedBalances: SettlementPlayerBalance[];
  perGameBalances: GameNetSummary[];
  imbalanceBeforeMinor: number;
  imbalanceAfterMinor: number;
  correctionRows: CorrectionRow[];
  payments: PaymentInstruction[];
  mainPayments: PaymentInstruction[];
  smallPayments: PaymentInstruction[];
  smallTransferImpact: SettlementPlayerBalance[];
  warnings: string[];
  createdAt: string;
}
