import { calculateGameNetSummary } from "@/lib/settlement-engine";
import type { Game, LedgerEntry, Player, SessionPlayer, SettlementPlayerBalance } from "@/lib/types";

export const getPlayersForSession = (
  allPlayers: Player[],
  sessionPlayers: SessionPlayer[],
  sessionId: string
): Player[] => {
  const playerIds = new Set(
    sessionPlayers.filter((sessionPlayer) => sessionPlayer.sessionId === sessionId).map((sessionPlayer) => sessionPlayer.playerId)
  );

  return allPlayers.filter((player) => playerIds.has(player.id) && !player.archived);
};

export const getGamesForSession = (games: Game[], sessionId: string): Game[] =>
  games
    .filter((game) => game.sessionId === sessionId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const getEntriesForSession = (entries: LedgerEntry[], sessionId: string): LedgerEntry[] =>
  entries
    .filter((entry) => entry.sessionId === sessionId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const getSessionTotals = (
  sessionId: string,
  games: Game[],
  entries: LedgerEntry[],
  playerIds: string[]
): {
  totalBuyInsMinor: number;
  totalPayoutsMinor: number;
  totalCorrectionsMinor: number;
  combinedBalance: SettlementPlayerBalance[];
  imbalanceMinor: number;
} => {
  const sessionGames = getGamesForSession(games, sessionId);
  const sessionEntries = getEntriesForSession(entries, sessionId);

  let totalBuyInsMinor = 0;
  let totalPayoutsMinor = 0;
  let totalCorrectionsMinor = 0;

  sessionEntries.forEach((entry) => {
    if (entry.entryType === "buyIn" || entry.entryType === "rebuy") {
      totalBuyInsMinor += Math.abs(entry.amountMinor);
    } else if (entry.entryType === "payout") {
      totalPayoutsMinor += Math.abs(entry.amountMinor);
    } else if (entry.entryType === "correction") {
      totalCorrectionsMinor += entry.amountMinor;
    }
  });

  const combinedMap = new Map(playerIds.map((playerId) => [playerId, 0]));
  sessionGames.forEach((game) => {
    const summary = calculateGameNetSummary(game.id, playerIds, sessionEntries);
    summary.balances.forEach((balance) => {
      combinedMap.set(balance.playerId, (combinedMap.get(balance.playerId) ?? 0) + balance.balanceMinor);
    });
  });

  const combinedBalance = [...combinedMap.entries()]
    .map(([playerId, balanceMinor]) => ({ playerId, balanceMinor }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));

  return {
    totalBuyInsMinor,
    totalPayoutsMinor,
    totalCorrectionsMinor,
    imbalanceMinor: combinedBalance.reduce((sum, balance) => sum + balance.balanceMinor, 0),
    combinedBalance
  };
};
