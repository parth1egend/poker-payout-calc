export type EntityId = string;

export type EntryType = "buyIn" | "rebuy" | "payout" | "correction" | "note";

export interface Player {
  id: EntityId;
  name: string;
  nickname?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: EntityId;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: EntityId;
  title: string;
  date: string;
  location?: string;
  notes?: string;
  groupId?: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPlayer {
  id: EntityId;
  sessionId: EntityId;
  playerId: EntityId;
  createdAt: string;
}

export interface Game {
  id: EntityId;
  sessionId: EntityId;
  name: string;
  notes?: string;
  includeInSettlement: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface AppSettings {
  id: "app";
  currencyLabel: string;
  defaultThresholdMinor: number;
  showIgnoredSmallTransfers: boolean;
  autoRunCorrection: boolean;
  moneyScale: number;
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

export interface SettlementRun {
  id: EntityId;
  sessionId: EntityId;
  selectedGameIds: EntityId[];
  thresholdMinor: number;
  imbalanceBeforeMinor: number;
  imbalanceAfterMinor: number;
  correctionRows: CorrectionRow[];
  payments: PaymentInstruction[];
  mainPayments: PaymentInstruction[];
  smallPayments: PaymentInstruction[];
  rawBalances: SettlementPlayerBalance[];
  correctedBalances: SettlementPlayerBalance[];
  warnings: string[];
  createdAt: string;
}

export interface BackupPayload {
  exportedAt: string;
  version: 1;
  players: Player[];
  groups: Group[];
  sessions: Session[];
  sessionPlayers: SessionPlayer[];
  games: Game[];
  ledgerEntries: LedgerEntry[];
  settlementRuns: SettlementRun[];
  settings?: AppSettings;
}
