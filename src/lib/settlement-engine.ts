import type {
  CorrectionRow,
  EntityId,
  GameNetSummary,
  LedgerEntry,
  PaymentInstruction,
  PlayerNetSummary,
  SettlementComputation,
  SettlementPlayerBalance
} from "@/lib/types";

import { nowIso } from "@/lib/ids";

const EMPTY_WARNINGS: string[] = [];

const entryDelta = (entry: LedgerEntry): number => {
  if (entry.entryType === "buyIn" || entry.entryType === "rebuy") {
    return -Math.abs(entry.amountMinor);
  }

  if (entry.entryType === "payout") {
    return Math.abs(entry.amountMinor);
  }

  if (entry.entryType === "correction") {
    return entry.amountMinor;
  }

  return 0;
};

const sortBalances = (balances: SettlementPlayerBalance[]): SettlementPlayerBalance[] =>
  [...balances].sort((left, right) => left.playerId.localeCompare(right.playerId));

const createEmptyBalanceMap = (playerIds: EntityId[]): Map<EntityId, number> =>
  new Map(playerIds.map((playerId) => [playerId, 0]));

const mapToBalances = (balancesMap: Map<EntityId, number>): SettlementPlayerBalance[] =>
  sortBalances(
    [...balancesMap.entries()].map(([playerId, balanceMinor]) => ({
      playerId,
      balanceMinor
    }))
  );

const totalBalance = (balances: SettlementPlayerBalance[]): number =>
  balances.reduce((sum, balance) => sum + balance.balanceMinor, 0);

const proportionalAllocation = (
  totalToAllocate: number,
  items: Array<{ playerId: EntityId; basisMinor: number }>
): Array<{ playerId: EntityId; allocatedMinor: number; basisMinor: number }> => {
  const totalBasis = items.reduce((sum, item) => sum + item.basisMinor, 0);

  if (totalToAllocate <= 0 || totalBasis <= 0) {
    return items.map((item) => ({ ...item, allocatedMinor: 0 }));
  }

  const interim = items.map((item) => {
    const weighted = totalToAllocate * item.basisMinor;
    const allocatedMinor = Math.floor(weighted / totalBasis);
    const remainder = weighted % totalBasis;

    return {
      ...item,
      allocatedMinor,
      remainder
    };
  });

  let remainingMinor = totalToAllocate - interim.reduce((sum, item) => sum + item.allocatedMinor, 0);

  interim
    .sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }

      if (right.basisMinor !== left.basisMinor) {
        return right.basisMinor - left.basisMinor;
      }

      return left.playerId.localeCompare(right.playerId);
    })
    .forEach((item) => {
      if (remainingMinor <= 0) {
        return;
      }

      item.allocatedMinor += 1;
      remainingMinor -= 1;
    });

  return interim
    .map(({ playerId, basisMinor, allocatedMinor }) => ({
      playerId,
      basisMinor,
      allocatedMinor
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));
};

export const calculateGameNetSummary = (
  gameId: EntityId,
  playerIds: EntityId[],
  entries: LedgerEntry[]
): GameNetSummary => {
  const perPlayer = new Map<EntityId, PlayerNetSummary>(
    playerIds.map((playerId) => [
      playerId,
      {
        playerId,
        contributedMinor: 0,
        paidOutMinor: 0,
        correctionsMinor: 0,
        netMinor: 0
      }
    ])
  );

  entries
    .filter((entry) => entry.gameId === gameId)
    .forEach((entry) => {
      const summary =
        perPlayer.get(entry.playerId) ??
        ({
          playerId: entry.playerId,
          contributedMinor: 0,
          paidOutMinor: 0,
          correctionsMinor: 0,
          netMinor: 0
        } satisfies PlayerNetSummary);

      if (entry.entryType === "buyIn" || entry.entryType === "rebuy") {
        summary.contributedMinor += Math.abs(entry.amountMinor);
      } else if (entry.entryType === "payout") {
        summary.paidOutMinor += Math.abs(entry.amountMinor);
      } else if (entry.entryType === "correction") {
        summary.correctionsMinor += entry.amountMinor;
      }

      summary.netMinor += entryDelta(entry);
      perPlayer.set(entry.playerId, summary);
    });

  const balances = mapToBalances(
    new Map([...perPlayer.values()].map((summary) => [summary.playerId, summary.netMinor]))
  );

  return {
    gameId,
    balances,
    perPlayer: [...perPlayer.values()].sort((left, right) => left.playerId.localeCompare(right.playerId))
  };
};

export const combineBalances = (gameSummaries: GameNetSummary[], playerIds: EntityId[]): SettlementPlayerBalance[] => {
  const totals = createEmptyBalanceMap(playerIds);

  gameSummaries.forEach((summary) => {
    summary.balances.forEach((balance) => {
      totals.set(balance.playerId, (totals.get(balance.playerId) ?? 0) + balance.balanceMinor);
    });
  });

  return mapToBalances(totals);
};

export const applyImbalanceCorrection = (
  balances: SettlementPlayerBalance[]
): { correctedBalances: SettlementPlayerBalance[]; correctionRows: CorrectionRow[]; imbalanceAfterMinor: number; warnings: string[] } => {
  const imbalanceBeforeMinor = totalBalance(balances);

  if (imbalanceBeforeMinor === 0) {
    return {
      correctedBalances: sortBalances(balances),
      correctionRows: [],
      imbalanceAfterMinor: 0,
      warnings: EMPTY_WARNINGS
    };
  }

  if (imbalanceBeforeMinor < 0) {
    const losers = balances
      .filter((balance) => balance.balanceMinor < 0)
      .map((balance) => ({ playerId: balance.playerId, basisMinor: Math.abs(balance.balanceMinor) }));

    if (losers.length === 0) {
      return {
        correctedBalances: sortBalances(balances),
        correctionRows: [],
        imbalanceAfterMinor: imbalanceBeforeMinor,
        warnings: ["The combined result is short overall, but there are no losers available to absorb the correction."]
      };
    }

    const allocations = proportionalAllocation(Math.abs(imbalanceBeforeMinor), losers);
    const correctionMap = new Map(allocations.map((allocation) => [allocation.playerId, allocation.allocatedMinor]));
    const correctedBalances = sortBalances(
      balances.map((balance) => ({
        ...balance,
        balanceMinor: balance.balanceMinor + (correctionMap.get(balance.playerId) ?? 0)
      }))
    );

    return {
      correctedBalances,
      correctionRows: allocations.map((allocation) => ({
        playerId: allocation.playerId,
        basisMinor: allocation.basisMinor,
        adjustmentMinor: allocation.allocatedMinor
      })),
      imbalanceAfterMinor: totalBalance(correctedBalances),
      warnings: EMPTY_WARNINGS
    };
  }

  const winners = balances
    .filter((balance) => balance.balanceMinor > 0)
    .map((balance) => ({ playerId: balance.playerId, basisMinor: balance.balanceMinor }));

  if (winners.length === 0) {
    return {
      correctedBalances: sortBalances(balances),
      correctionRows: [],
      imbalanceAfterMinor: imbalanceBeforeMinor,
      warnings: ["The combined result has excess payout overall, but there are no winners available to absorb the correction."]
    };
  }

  const allocations = proportionalAllocation(imbalanceBeforeMinor, winners);
  const correctionMap = new Map(allocations.map((allocation) => [allocation.playerId, -allocation.allocatedMinor]));
  const correctedBalances = sortBalances(
    balances.map((balance) => ({
      ...balance,
      balanceMinor: balance.balanceMinor + (correctionMap.get(balance.playerId) ?? 0)
    }))
  );

  return {
    correctedBalances,
    correctionRows: allocations.map((allocation) => ({
      playerId: allocation.playerId,
      basisMinor: allocation.basisMinor,
      adjustmentMinor: -allocation.allocatedMinor
    })),
    imbalanceAfterMinor: totalBalance(correctedBalances),
    warnings: EMPTY_WARNINGS
  };
};

export const simplifyPayments = (balances: SettlementPlayerBalance[]): PaymentInstruction[] => {
  const creditors = balances
    .filter((balance) => balance.balanceMinor > 0)
    .map((balance) => ({ playerId: balance.playerId, remainingMinor: balance.balanceMinor }))
    .sort((left, right) => {
      if (right.remainingMinor !== left.remainingMinor) {
        return right.remainingMinor - left.remainingMinor;
      }

      return left.playerId.localeCompare(right.playerId);
    });

  const debtors = balances
    .filter((balance) => balance.balanceMinor < 0)
    .map((balance) => ({ playerId: balance.playerId, remainingMinor: Math.abs(balance.balanceMinor) }))
    .sort((left, right) => {
      if (right.remainingMinor !== left.remainingMinor) {
        return right.remainingMinor - left.remainingMinor;
      }

      return left.playerId.localeCompare(right.playerId);
    });

  const payments: PaymentInstruction[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountMinor = Math.min(creditor.remainingMinor, debtor.remainingMinor);

    if (amountMinor <= 0) {
      break;
    }

    payments.push({
      fromPlayerId: debtor.playerId,
      toPlayerId: creditor.playerId,
      amountMinor
    });

    creditor.remainingMinor -= amountMinor;
    debtor.remainingMinor -= amountMinor;

    if (creditor.remainingMinor === 0) {
      creditorIndex += 1;
    }

    if (debtor.remainingMinor === 0) {
      debtorIndex += 1;
    }
  }

  return payments;
};

export const splitPaymentsByThreshold = (
  payments: PaymentInstruction[],
  thresholdMinor: number
): {
  mainPayments: PaymentInstruction[];
  smallPayments: PaymentInstruction[];
  smallTransferImpact: SettlementPlayerBalance[];
} => {
  const mainPayments = payments.filter((payment) => payment.amountMinor >= thresholdMinor);
  const smallPayments = payments.filter((payment) => payment.amountMinor < thresholdMinor);
  const impact = new Map<EntityId, number>();

  smallPayments.forEach((payment) => {
    impact.set(payment.fromPlayerId, (impact.get(payment.fromPlayerId) ?? 0) - payment.amountMinor);
    impact.set(payment.toPlayerId, (impact.get(payment.toPlayerId) ?? 0) + payment.amountMinor);
  });

  return {
    mainPayments,
    smallPayments,
    smallTransferImpact: mapToBalances(impact)
  };
};

export interface SettlementBuildInput {
  sessionId: EntityId;
  playerIds: EntityId[];
  selectedGameIds: EntityId[];
  entries: LedgerEntry[];
  thresholdMinor: number;
  applyCorrection: boolean;
}

export const buildSettlementComputation = ({
  sessionId,
  playerIds,
  selectedGameIds,
  entries,
  thresholdMinor,
  applyCorrection
}: SettlementBuildInput): SettlementComputation => {
  const uniqueSelectedGameIds = [...new Set(selectedGameIds)];
  const warnings: string[] = [];
  const gameSummaries = uniqueSelectedGameIds.map((gameId) =>
    calculateGameNetSummary(
      gameId,
      playerIds,
      entries.filter((entry) => entry.gameId === gameId)
    )
  );

  const rawBalances = combineBalances(gameSummaries, playerIds);
  const imbalanceBeforeMinor = totalBalance(rawBalances);
  let correctedBalances = rawBalances;
  let correctionRows: CorrectionRow[] = [];
  let imbalanceAfterMinor = imbalanceBeforeMinor;

  if (selectedGameIds.length !== uniqueSelectedGameIds.length) {
    warnings.push("Duplicate games were removed from the settlement selection to keep the result deterministic.");
  }

  if (uniqueSelectedGameIds.length === 0) {
    warnings.push("Select at least one game to compute a combined settlement.");
  }

  if (applyCorrection) {
    const correction = applyImbalanceCorrection(rawBalances);
    correctedBalances = correction.correctedBalances;
    correctionRows = correction.correctionRows;
    imbalanceAfterMinor = correction.imbalanceAfterMinor;
    warnings.push(...correction.warnings);
  } else if (imbalanceBeforeMinor !== 0) {
    warnings.push("Imbalance correction is pending. Final payment instructions stay disabled until you apply the correction.");
  }

  const payments = imbalanceAfterMinor === 0 ? simplifyPayments(correctedBalances) : [];

  if (imbalanceAfterMinor !== 0) {
    warnings.push("Balances do not sum to zero after the current correction mode, so a full settlement cannot be produced.");
  }

  const { mainPayments, smallPayments, smallTransferImpact } = splitPaymentsByThreshold(payments, thresholdMinor);

  if (smallPayments.length > 0) {
    warnings.push("Ignoring small transfers changes the exact settlement. Carry the ignored balances forward if you need exact reconciliation later.");
  }

  return {
    sessionId,
    selectedGameIds: uniqueSelectedGameIds,
    thresholdMinor,
    rawBalances,
    correctedBalances,
    perGameBalances: gameSummaries,
    imbalanceBeforeMinor,
    imbalanceAfterMinor,
    correctionRows,
    payments,
    mainPayments,
    smallPayments,
    smallTransferImpact,
    warnings,
    createdAt: nowIso()
  };
};
