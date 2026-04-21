import type { Game, Player, Session, SettlementComputation, SettlementPlayerBalance } from "@/lib/types";
import { formatMoney, formatSignedMoney, toAbsoluteMoney } from "@/lib/money";

const findPlayerName = (players: Player[], playerId: string): string =>
  players.find((player) => player.id === playerId)?.nickname ||
  players.find((player) => player.id === playerId)?.name ||
  "Unknown player";

const formatBalanceLines = (
  balances: SettlementPlayerBalance[],
  players: Player[],
  currencyLabel: string,
  scale: number
): string =>
  balances
    .map(
      (balance) =>
        `${findPlayerName(players, balance.playerId)}: ${formatSignedMoney(balance.balanceMinor, currencyLabel, scale)}`
    )
    .join("\n");

export const buildSettlementText = (
  session: Session,
  games: Game[],
  players: Player[],
  computation: SettlementComputation,
  currencyLabel: string,
  scale: number
): string => {
  const gameNames = games
    .filter((game) => computation.selectedGameIds.includes(game.id))
    .map((game) => game.name)
    .join(", ");

  const paymentsBlock =
    computation.mainPayments.length > 0
      ? computation.mainPayments
          .map(
            (payment) =>
              `${findPlayerName(players, payment.fromPlayerId)} pays ${findPlayerName(players, payment.toPlayerId)} ${toAbsoluteMoney(payment.amountMinor, currencyLabel, scale)}`
          )
          .join("\n")
      : "No main transfers.";

  const smallPaymentsBlock =
    computation.smallPayments.length > 0
      ? computation.smallPayments
          .map(
            (payment) =>
              `${findPlayerName(players, payment.fromPlayerId)} -> ${findPlayerName(players, payment.toPlayerId)} ${toAbsoluteMoney(payment.amountMinor, currencyLabel, scale)}`
          )
          .join("\n")
      : "None";

  const correctionsBlock =
    computation.correctionRows.length > 0
      ? computation.correctionRows
          .map(
            (row) =>
              `${findPlayerName(players, row.playerId)} adjustment ${formatSignedMoney(row.adjustmentMinor, currencyLabel, scale)} on basis ${formatMoney(row.basisMinor, currencyLabel, scale)}`
          )
          .join("\n")
      : "No imbalance correction.";

  return [
    `${session.title} (${session.date})`,
    session.location ? `Location: ${session.location}` : undefined,
    `Games: ${gameNames || "None selected"}`,
    "",
    "Raw balances",
    formatBalanceLines(computation.rawBalances, players, currencyLabel, scale),
    "",
    `Imbalance before correction: ${formatSignedMoney(computation.imbalanceBeforeMinor, currencyLabel, scale)}`,
    "Corrections",
    correctionsBlock,
    "",
    "Corrected balances",
    formatBalanceLines(computation.correctedBalances, players, currencyLabel, scale),
    "",
    `Main transfers (>= ${formatMoney(computation.thresholdMinor, currencyLabel, scale)})`,
    paymentsBlock,
    "",
    "Ignored small transfers",
    smallPaymentsBlock,
    computation.warnings.length > 0 ? `Warnings\n${computation.warnings.join("\n")}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
};

export const buildSessionSummaryText = (
  session: Session,
  games: Game[],
  players: Player[],
  currencyLabel: string,
  scale: number
): string => {
  const playerLine = players.map((player) => player.nickname || player.name).join(", ");
  const gameLines = games.map((game) => `- ${game.name}${game.includeInSettlement ? "" : " (excluded from settlement)"}`);

  return [
    `${session.title} (${session.date})`,
    session.location ? `Location: ${session.location}` : undefined,
    session.notes ? `Notes: ${session.notes}` : undefined,
    `Players: ${playerLine || "None"}`,
    `Games (${gameLines.length})`,
    gameLines.length > 0 ? gameLines.join("\n") : "- None",
    `Currency: ${currencyLabel}`,
    `Minor-unit scale: ${scale}`
  ]
    .filter(Boolean)
    .join("\n");
};
