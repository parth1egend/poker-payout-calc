import { describe, expect, it } from "vitest";

import {
  applyImbalanceCorrection,
  buildSettlementComputation,
  calculateGameNetSummary,
  combineBalances,
  simplifyPayments,
  splitPaymentsByThreshold
} from "@/lib/settlement-engine";
import type { LedgerEntry } from "@/lib/types";

const entry = (
  id: string,
  gameId: string,
  playerId: string,
  entryType: LedgerEntry["entryType"],
  amountMinor: number
): LedgerEntry => ({
  id,
  sessionId: "session-1",
  gameId,
  playerId,
  entryType,
  amountMinor,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

describe("settlement engine", () => {
  it("calculates per-game balances with buy-ins, payouts, corrections, and notes", () => {
    const summary = calculateGameNetSummary("game-1", ["a", "b"], [
      entry("1", "game-1", "a", "buyIn", 200),
      entry("2", "game-1", "a", "payout", 450),
      entry("3", "game-1", "a", "correction", -25),
      entry("4", "game-1", "a", "note", 0),
      entry("5", "game-1", "b", "buyIn", 225)
    ]);

    expect(summary.perPlayer).toEqual([
      {
        playerId: "a",
        contributedMinor: 200,
        paidOutMinor: 450,
        correctionsMinor: -25,
        netMinor: 225
      },
      {
        playerId: "b",
        contributedMinor: 225,
        paidOutMinor: 0,
        correctionsMinor: 0,
        netMinor: -225
      }
    ]);
  });

  it("combines multiple games into one balance vector", () => {
    const first = calculateGameNetSummary("g1", ["a", "b", "c"], [
      entry("1", "g1", "a", "buyIn", 100),
      entry("2", "g1", "b", "buyIn", 100),
      entry("3", "g1", "c", "buyIn", 100),
      entry("4", "g1", "a", "payout", 300)
    ]);
    const second = calculateGameNetSummary("g2", ["a", "b", "c"], [
      entry("5", "g2", "a", "buyIn", 50),
      entry("6", "g2", "b", "buyIn", 50),
      entry("7", "g2", "b", "payout", 100)
    ]);

    expect(combineBalances([first, second], ["a", "b", "c"])).toEqual([
      { playerId: "a", balanceMinor: 150 },
      { playerId: "b", balanceMinor: -50 },
      { playerId: "c", balanceMinor: -100 }
    ]);
  });

  it("keeps already balanced results unchanged", () => {
    const correction = applyImbalanceCorrection([
      { playerId: "a", balanceMinor: 100 },
      { playerId: "b", balanceMinor: -100 }
    ]);

    expect(correction.correctionRows).toEqual([]);
    expect(correction.imbalanceAfterMinor).toBe(0);
  });

  it("absorbs a short table proportionally across losers so the result returns to zero", () => {
    const correction = applyImbalanceCorrection([
      { playerId: "a", balanceMinor: 400 },
      { playerId: "b", balanceMinor: 100 },
      { playerId: "c", balanceMinor: -550 }
    ]);

    expect(correction.correctionRows).toEqual([
      { playerId: "c", basisMinor: 550, adjustmentMinor: 50 }
    ]);
    expect(correction.correctedBalances).toEqual([
      { playerId: "a", balanceMinor: 400 },
      { playerId: "b", balanceMinor: 100 },
      { playerId: "c", balanceMinor: -500 }
    ]);
    expect(correction.imbalanceAfterMinor).toBe(0);
  });

  it("absorbs excess payout proportionally across winners so the result returns to zero", () => {
    const correction = applyImbalanceCorrection([
      { playerId: "a", balanceMinor: 450 },
      { playerId: "b", balanceMinor: -300 },
      { playerId: "c", balanceMinor: -100 }
    ]);

    expect(correction.correctionRows).toEqual([
      { playerId: "a", basisMinor: 450, adjustmentMinor: -50 }
    ]);
    expect(correction.correctedBalances).toEqual([
      { playerId: "a", balanceMinor: 400 },
      { playerId: "b", balanceMinor: -300 },
      { playerId: "c", balanceMinor: -100 }
    ]);
    expect(correction.imbalanceAfterMinor).toBe(0);
  });

  it("distributes integer remainders deterministically", () => {
    const correction = applyImbalanceCorrection([
      { playerId: "a", balanceMinor: 5 },
      { playerId: "b", balanceMinor: 3 },
      { playerId: "c", balanceMinor: -6 }
    ]);

    expect(correction.correctionRows).toEqual([
      { playerId: "a", basisMinor: 5, adjustmentMinor: -1 },
      { playerId: "b", basisMinor: 3, adjustmentMinor: -1 }
    ]);
    expect(correction.imbalanceAfterMinor).toBe(0);
  });

  it("greedily simplifies transfers in descending order", () => {
    expect(
      simplifyPayments([
        { playerId: "a", balanceMinor: -70 },
        { playerId: "b", balanceMinor: -30 },
        { playerId: "c", balanceMinor: 60 },
        { playerId: "d", balanceMinor: 40 }
      ])
    ).toEqual([
      { fromPlayerId: "a", toPlayerId: "c", amountMinor: 60 },
      { fromPlayerId: "a", toPlayerId: "d", amountMinor: 10 },
      { fromPlayerId: "b", toPlayerId: "d", amountMinor: 30 }
    ]);
  });

  it("splits transfers by threshold with exact-boundary handling", () => {
    const split = splitPaymentsByThreshold(
      [
        { fromPlayerId: "a", toPlayerId: "b", amountMinor: 20 },
        { fromPlayerId: "c", toPlayerId: "d", amountMinor: 19 }
      ],
      20
    );

    expect(split.mainPayments).toEqual([{ fromPlayerId: "a", toPlayerId: "b", amountMinor: 20 }]);
    expect(split.smallPayments).toEqual([{ fromPlayerId: "c", toPlayerId: "d", amountMinor: 19 }]);
  });

  it("corrects a single-sided positive imbalance by adjusting the only winner", () => {
    const correction = applyImbalanceCorrection([{ playerId: "a", balanceMinor: 50 }]);

    expect(correction.imbalanceAfterMinor).toBe(0);
    expect(correction.correctionRows).toEqual([{ playerId: "a", basisMinor: 50, adjustmentMinor: -50 }]);
  });

  it("handles an empty settlement selection safely", () => {
    const computation = buildSettlementComputation({
      sessionId: "session-1",
      playerIds: ["a"],
      selectedGameIds: [],
      entries: [],
      thresholdMinor: 20,
      applyCorrection: true
    });

    expect(computation.mainPayments).toEqual([]);
    expect(computation.warnings[0]).toContain("Select at least one game");
  });

  it("deduplicates repeated games inside a settlement run", () => {
    const computation = buildSettlementComputation({
      sessionId: "session-1",
      playerIds: ["a", "b"],
      selectedGameIds: ["g1", "g1"],
      entries: [entry("1", "g1", "a", "buyIn", 100), entry("2", "g1", "b", "payout", 100)],
      thresholdMinor: 10,
      applyCorrection: true
    });

    expect(computation.selectedGameIds).toEqual(["g1"]);
    expect(computation.warnings.some((warning) => warning.includes("Duplicate games"))).toBe(true);
  });

  it("keeps a one-player session explorable even if it cannot settle", () => {
    const computation = buildSettlementComputation({
      sessionId: "session-1",
      playerIds: ["a"],
      selectedGameIds: ["g1"],
      entries: [entry("1", "g1", "a", "buyIn", 200)],
      thresholdMinor: 20,
      applyCorrection: true
    });

    expect(computation.correctedBalances).toEqual([{ playerId: "a", balanceMinor: 0 }]);
    expect(computation.mainPayments).toEqual([]);
  });

  it("includes correction ledger rows when recomputing a settlement", () => {
    const computation = buildSettlementComputation({
      sessionId: "session-1",
      playerIds: ["a", "b"],
      selectedGameIds: ["g1"],
      entries: [
        entry("1", "g1", "a", "buyIn", 100),
        entry("2", "g1", "b", "buyIn", 100),
        entry("3", "g1", "a", "payout", 150),
        entry("4", "g1", "b", "payout", 40),
        entry("5", "g1", "b", "correction", 10)
      ],
      thresholdMinor: 10,
      applyCorrection: true
    });

    expect(computation.rawBalances).toEqual([
      { playerId: "a", balanceMinor: 50 },
      { playerId: "b", balanceMinor: -50 }
    ]);
    expect(computation.mainPayments).toEqual([{ fromPlayerId: "b", toPlayerId: "a", amountMinor: 50 }]);
  });
});
