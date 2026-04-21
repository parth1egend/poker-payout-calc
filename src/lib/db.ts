import Dexie, { type Table } from "dexie";

import { createId, nowIso } from "@/lib/ids";
import type {
  AppSettings,
  BackupPayload,
  Game,
  Group,
  LedgerEntry,
  Player,
  Session,
  SessionPlayer,
  SettlementComputation,
  SettlementRun
} from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  id: "app",
  currencyLabel: "INR",
  defaultThresholdMinor: 20,
  showIgnoredSmallTransfers: true,
  autoRunCorrection: true,
  moneyScale: 1,
  updatedAt: nowIso()
};

class PokerSettlementDatabase extends Dexie {
  players!: Table<Player, string>;
  groups!: Table<Group, string>;
  sessions!: Table<Session, string>;
  sessionPlayers!: Table<SessionPlayer, string>;
  games!: Table<Game, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  settlementRuns!: Table<SettlementRun, string>;
  settings!: Table<AppSettings, "app">;

  constructor() {
    super("poker-settlement-db");

    this.version(1).stores({
      players: "id, archived, updatedAt, name",
      groups: "id, archived, updatedAt, name",
      sessions: "id, date, updatedAt, groupId",
      sessionPlayers: "id, sessionId, playerId",
      games: "id, sessionId, includeInSettlement, updatedAt",
      ledgerEntries: "id, sessionId, gameId, playerId, entryType, createdAt",
      settlementRuns: "id, sessionId, createdAt",
      settings: "id"
    });

    this.on("populate", async () => {
      await this.settings.put(DEFAULT_SETTINGS);
    });
  }
}

export const db = new PokerSettlementDatabase();

export const ensureAppSettings = async (): Promise<AppSettings> => {
  const existing = await db.settings.get("app");

  if (existing) {
    return existing;
  }

  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
};

export const listSettings = async (): Promise<AppSettings> => ensureAppSettings();

export const saveSettings = async (partial: Partial<AppSettings>): Promise<void> => {
  const current = await ensureAppSettings();

  await db.settings.put({
    ...current,
    ...partial,
    id: "app",
    updatedAt: nowIso()
  });
};

export const createPlayer = async (input: Pick<Player, "name" | "nickname">): Promise<Player> => {
  const player: Player = {
    id: createId(),
    name: input.name.trim(),
    nickname: input.nickname?.trim() || undefined,
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.players.add(player);
  return player;
};

export const updatePlayer = async (id: string, partial: Partial<Player>): Promise<void> => {
  await db.players.update(id, {
    ...partial,
    updatedAt: nowIso()
  });
};

export const createSession = async (
  input: Pick<Session, "title" | "date" | "location" | "notes" | "groupId">,
  playerIds: string[]
): Promise<Session> => {
  const session: Session = {
    id: createId(),
    title: input.title.trim(),
    date: input.date,
    location: input.location?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    groupId: input.groupId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.transaction("rw", db.sessions, db.sessionPlayers, async () => {
    await db.sessions.add(session);
    await db.sessionPlayers.bulkAdd(
      playerIds.map((playerId) => ({
        id: createId(),
        sessionId: session.id,
        playerId,
        createdAt: nowIso()
      }))
    );
  });

  return session;
};

export const updateSession = async (
  id: string,
  partial: Partial<Session>,
  playerIds?: string[]
): Promise<void> => {
  await db.transaction("rw", db.sessions, db.sessionPlayers, async () => {
    await db.sessions.update(id, {
      ...partial,
      updatedAt: nowIso()
    });

    if (playerIds) {
      await db.sessionPlayers.where("sessionId").equals(id).delete();
      await db.sessionPlayers.bulkAdd(
        playerIds.map((playerId) => ({
          id: createId(),
          sessionId: id,
          playerId,
          createdAt: nowIso()
        }))
      );
    }
  });
};

export const createGame = async (sessionId: string, input: Pick<Game, "name" | "notes">): Promise<Game> => {
  const game: Game = {
    id: createId(),
    sessionId,
    name: input.name.trim(),
    notes: input.notes?.trim() || undefined,
    includeInSettlement: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.games.add(game);
  return game;
};

export const updateGame = async (id: string, partial: Partial<Game>): Promise<void> => {
  await db.games.update(id, {
    ...partial,
    updatedAt: nowIso()
  });
};

export const createLedgerEntry = async (
  input: Pick<LedgerEntry, "sessionId" | "gameId" | "playerId" | "entryType" | "amountMinor" | "note">
): Promise<LedgerEntry> => {
  const entry: LedgerEntry = {
    id: createId(),
    sessionId: input.sessionId,
    gameId: input.gameId,
    playerId: input.playerId,
    entryType: input.entryType,
    amountMinor: input.amountMinor,
    note: input.note?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.ledgerEntries.add(entry);
  return entry;
};

export const updateLedgerEntry = async (id: string, partial: Partial<LedgerEntry>): Promise<void> => {
  await db.ledgerEntries.update(id, {
    ...partial,
    updatedAt: nowIso()
  });
};

export const deleteLedgerEntry = async (id: string): Promise<void> => {
  await db.ledgerEntries.delete(id);
};

export const saveSettlementRun = async (computation: SettlementComputation): Promise<SettlementRun> => {
  const run: SettlementRun = {
    id: createId(),
    sessionId: computation.sessionId,
    selectedGameIds: computation.selectedGameIds,
    thresholdMinor: computation.thresholdMinor,
    imbalanceBeforeMinor: computation.imbalanceBeforeMinor,
    imbalanceAfterMinor: computation.imbalanceAfterMinor,
    correctionRows: computation.correctionRows,
    payments: computation.payments,
    mainPayments: computation.mainPayments,
    smallPayments: computation.smallPayments,
    rawBalances: computation.rawBalances,
    correctedBalances: computation.correctedBalances,
    warnings: computation.warnings,
    createdAt: computation.createdAt
  };

  await db.settlementRuns.add(run);
  return run;
};

export const exportBackup = async (): Promise<BackupPayload> => {
  const [players, groups, sessions, sessionPlayers, games, ledgerEntries, settlementRuns, settings] = await Promise.all([
    db.players.toArray(),
    db.groups.toArray(),
    db.sessions.toArray(),
    db.sessionPlayers.toArray(),
    db.games.toArray(),
    db.ledgerEntries.toArray(),
    db.settlementRuns.toArray(),
    db.settings.get("app")
  ]);

  return {
    exportedAt: nowIso(),
    version: 1,
    players,
    groups,
    sessions,
    sessionPlayers,
    games,
    ledgerEntries,
    settlementRuns,
    settings
  };
};

export const importBackup = async (payload: BackupPayload): Promise<void> => {
  await db.transaction(
    "rw",
    [db.players, db.groups, db.sessions, db.sessionPlayers, db.games, db.ledgerEntries, db.settlementRuns, db.settings],
    async () => {
      await Promise.all([
        db.players.clear(),
        db.groups.clear(),
        db.sessions.clear(),
        db.sessionPlayers.clear(),
        db.games.clear(),
        db.ledgerEntries.clear(),
        db.settlementRuns.clear(),
        db.settings.clear()
      ]);

      await Promise.all([
        db.players.bulkPut(payload.players),
        db.groups.bulkPut(payload.groups),
        db.sessions.bulkPut(payload.sessions),
        db.sessionPlayers.bulkPut(payload.sessionPlayers),
        db.games.bulkPut(payload.games),
        db.ledgerEntries.bulkPut(payload.ledgerEntries),
        db.settlementRuns.bulkPut(payload.settlementRuns),
        db.settings.put(payload.settings ?? DEFAULT_SETTINGS)
      ]);
    }
  );
};

export const resetAllData = async (): Promise<void> => {
  await db.transaction(
    "rw",
    [db.players, db.groups, db.sessions, db.sessionPlayers, db.games, db.ledgerEntries, db.settlementRuns, db.settings],
    async () => {
      await Promise.all([
        db.players.clear(),
        db.groups.clear(),
        db.sessions.clear(),
        db.sessionPlayers.clear(),
        db.games.clear(),
        db.ledgerEntries.clear(),
        db.settlementRuns.clear(),
        db.settings.clear()
      ]);
      await db.settings.put(DEFAULT_SETTINGS);
    }
  );
};
