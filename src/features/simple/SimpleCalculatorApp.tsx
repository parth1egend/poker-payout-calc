import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createId } from "@/lib/ids";
import { formatMoney, formatSignedMoney, parseMoneyInput, toAbsoluteMoney } from "@/lib/money";
import { applyImbalanceCorrection, simplifyPayments } from "@/lib/settlement-engine";
import {
  createDefaultCalculatorState,
  getCalculatorState,
  resetCalculatorState,
  saveCalculatorState,
  type CalculatorRow,
  type CalculatorState,
  type EntryMode
} from "@/lib/simple-state";

const currencies = ["USD", "INR", "GBP", "EUR"];

const numberValue = (minor: number): string => (minor === 0 ? "" : String(minor));

const createRow = (): CalculatorRow => ({
  id: createId(),
  name: "",
  totalInMinor: 0,
  totalOutMinor: 0,
  netMinor: 0
});

const rowBalance = (row: CalculatorRow, mode: EntryMode): number =>
  mode === "cashflow" ? row.totalOutMinor - row.totalInMinor : row.netMinor;

const withModeApplied = (state: CalculatorState, mode: EntryMode): CalculatorState => ({
  ...state,
  mode,
  rows: state.rows.map((row) => ({
    ...row,
    netMinor: mode === "net" ? row.totalOutMinor - row.totalInMinor : row.netMinor
  }))
});

export const SimpleCalculatorApp = () => {
  const [state, setState] = useState<CalculatorState>(createDefaultCalculatorState);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    getCalculatorState()
      .then((savedState) => {
        hydrated.current = true;
        setState(savedState);
        setReady(true);
      })
      .catch(() => {
        hydrated.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current || !ready) {
      return;
    }

    const timer = window.setTimeout(() => {
      saveCalculatorState(state).catch(() => undefined);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [ready, state]);

  const activeRows = useMemo(
    () => state.rows.filter((row) => row.name.trim().length > 0),
    [state.rows]
  );

  const balances = useMemo(
    () =>
      activeRows.map((row) => ({
        playerId: row.id,
        balanceMinor: rowBalance(row, state.mode)
      })),
    [activeRows, state.mode]
  );

  const correction = useMemo(() => applyImbalanceCorrection(balances), [balances]);
  const payments = useMemo(() => simplifyPayments(correction.correctedBalances), [correction.correctedBalances]);
  const imbalanceMinor = useMemo(
    () => balances.reduce((sum, item) => sum + item.balanceMinor, 0),
    [balances]
  );
  const correctedBalanceMap = useMemo(
    () => new Map(correction.correctedBalances.map((balance) => [balance.playerId, balance.balanceMinor])),
    [correction.correctedBalances]
  );
  const activeNameMap = useMemo(
    () => new Map(activeRows.map((row) => [row.id, row.name.trim()])),
    [activeRows]
  );
  const nameFor = useCallback(
    (rowId: string): string => activeNameMap.get(rowId) || "Unknown",
    [activeNameMap]
  );
  const rankedRows = useMemo(
    () =>
      activeRows
        .map((row) => {
          const rawMinor = rowBalance(row, state.mode);
          return {
            id: row.id,
            name: row.name.trim(),
            rawMinor,
            finalMinor: correctedBalanceMap.get(row.id) ?? rawMinor
          };
        })
        .sort((left, right) => right.finalMinor - left.finalMinor || left.name.localeCompare(right.name)),
    [activeRows, correctedBalanceMap, state.mode]
  );
  const adjustmentRows = useMemo(
    () =>
      correction.correctionRows
        .map((row) => {
          const originalMinor = balances.find((balance) => balance.playerId === row.playerId)?.balanceMinor ?? 0;
          const correctedMinor = correctedBalanceMap.get(row.playerId) ?? originalMinor;
          return {
            playerId: row.playerId,
            name: nameFor(row.playerId),
            originalMinor,
            correctedMinor,
            adjustmentMinor: row.adjustmentMinor
          };
        })
        .sort(
          (left, right) =>
            Math.abs(right.adjustmentMinor) - Math.abs(left.adjustmentMinor) || left.name.localeCompare(right.name)
        ),
    [balances, correctedBalanceMap, correction.correctionRows, nameFor]
  );

  const totals = useMemo(
    () =>
      state.rows.reduce(
        (accumulator, row) => ({
          totalInMinor: accumulator.totalInMinor + row.totalInMinor,
          totalOutMinor: accumulator.totalOutMinor + row.totalOutMinor,
          netMinor: accumulator.netMinor + rowBalance(row, state.mode)
        }),
        { totalInMinor: 0, totalOutMinor: 0, netMinor: 0 }
      ),
    [state.mode, state.rows]
  );

  const updateRow = (rowId: string, partial: Partial<CalculatorRow>) => {
    setState((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...partial } : row))
    }));
  };

  const removeRow = (rowId: string) => {
    setState((current) => ({
      ...current,
      rows: current.rows.length > 1 ? current.rows.filter((row) => row.id !== rowId) : [createRow()]
    }));
  };

  const resetAll = async () => {
    const confirmed = window.confirm("Clear the current payout table?");

    if (!confirmed) {
      return;
    }

    const next = await resetCalculatorState();
    setState(next);
  };

  const correctionMessage =
    correction.correctionRows.length > 0
      ? correction.correctionRows
          .map((row) => `${nameFor(row.playerId)} ${formatSignedMoney(row.adjustmentMinor, state.currencyLabel, 1)}`)
          .join(", ")
      : "";

  return (
    <main className="simple-app">
      <div className="simple-shell">
        <header className="brand-bar">
          <p className="brand-kicker">Poker Settlement</p>
          <h1>Payout Tables</h1>
          <p className="brand-subtitle">Enter buy-ins and payouts or direct net profit. The table settles instantly.</p>
        </header>

        <section className="summary-strip">
          <article className="summary-chip">
            <span>Players</span>
            <strong>{activeRows.length}</strong>
          </article>
          <article className="summary-chip">
            <span>Transfers</span>
            <strong>{payments.length}</strong>
          </article>
          <article className="summary-chip">
            <span>{state.mode === "cashflow" ? "Table In" : "Net Sum"}</span>
            <strong>
              {state.mode === "cashflow"
                ? formatMoney(totals.totalInMinor, state.currencyLabel, 1)
                : formatSignedMoney(imbalanceMinor, state.currencyLabel, 1)}
            </strong>
          </article>
          <article className={`summary-chip ${imbalanceMinor === 0 ? "status-balanced" : "status-adjusted"}`}>
            <span>Status</span>
            <strong>{imbalanceMinor === 0 ? "Balanced" : "Adjusted"}</strong>
          </article>
        </section>

        <section className="toolbar-card">
          <div className="segmented-control" role="tablist" aria-label="Entry mode">
            <button
              type="button"
              className={state.mode === "cashflow" ? "segment active" : "segment"}
              onClick={() => setState((current) => withModeApplied(current, "cashflow"))}
            >
              Buy-in / Payout
            </button>
            <button
              type="button"
              className={state.mode === "net" ? "segment active" : "segment"}
              onClick={() => setState((current) => withModeApplied(current, "net"))}
            >
              Net Profit
            </button>
          </div>

          <div className="toolbar-actions">
            <label className="select-shell">
              <span>Currency</span>
              <select
                value={state.currencyLabel}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    currencyLabel: event.target.value
                  }))
                }
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setState((current) => ({
                  ...current,
                  rows: [...current.rows, createRow()]
                }))
              }
            >
              Add player
            </button>
            <button type="button" className="secondary-action muted" onClick={resetAll}>
              Clear
            </button>
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Player Positions</h2>
              <p>{activeRows.length} active</p>
            </div>
          </div>

          <div className="player-card-list">
            {state.rows.map((row) => {
              const netMinor = rowBalance(row, state.mode);
              const parsePositiveMinor = (value: string): number => Math.max(0, parseMoneyInput(value, 1));

              return (
                <article key={row.id} className="player-card">
                  <div className="player-card-header">
                    <div className="name-cell">
                      <span className={row.name.trim() ? "player-dot active" : "player-dot"} />
                      <input
                        aria-label="Player name"
                        className="player-name-input"
                        value={row.name}
                        placeholder="Player name"
                        onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      />
                    </div>
                    <button type="button" className="row-delete" onClick={() => removeRow(row.id)} aria-label="Remove player">
                      ×
                    </button>
                  </div>

                  <div className="player-card-body">
                    <div className={state.mode === "cashflow" ? "player-fields" : "player-fields single"}>
                      {state.mode === "cashflow" ? (
                        <>
                          <label className="field-chip">
                            <span>In</span>
                            <input
                              aria-label="Total in"
                              inputMode="numeric"
                              className="field-chip-input"
                              value={numberValue(row.totalInMinor)}
                              placeholder="0"
                              onChange={(event) =>
                                updateRow(row.id, {
                                  totalInMinor: parsePositiveMinor(event.target.value)
                                })
                              }
                            />
                          </label>
                          <label className="field-chip">
                            <span>Out</span>
                            <input
                              aria-label="Total out"
                              inputMode="numeric"
                              className="field-chip-input"
                              value={numberValue(row.totalOutMinor)}
                              placeholder="0"
                              onChange={(event) =>
                                updateRow(row.id, {
                                  totalOutMinor: parsePositiveMinor(event.target.value)
                                })
                              }
                            />
                          </label>
                        </>
                      ) : (
                        <label className="field-chip wide">
                          <span>Net</span>
                          <input
                            aria-label="Net profit"
                            inputMode="numeric"
                            className={`field-chip-input ${netMinor > 0 ? "positive" : netMinor < 0 ? "negative" : ""}`}
                            value={numberValue(row.netMinor)}
                            placeholder="0"
                            onChange={(event) =>
                              updateRow(row.id, {
                                netMinor: parseMoneyInput(event.target.value, 1)
                              })
                            }
                          />
                        </label>
                      )}
                    </div>

                    <div className={`net-pill ${netMinor > 0 ? "positive" : netMinor < 0 ? "negative" : ""}`}>
                      {formatSignedMoney(netMinor, state.currencyLabel, 1)}
                    </div>
                  </div>
                </article>
              );
            })}

            <article className="player-total-card">
              <strong>Total</strong>
              <div className="player-total-metrics">
                {state.mode === "cashflow" ? <span>In: {formatMoney(totals.totalInMinor, state.currencyLabel, 1)}</span> : null}
                {state.mode === "cashflow" ? <span>Out: {formatMoney(totals.totalOutMinor, state.currencyLabel, 1)}</span> : null}
                <span className={totals.netMinor === 0 ? "" : totals.netMinor > 0 ? "positive-text" : "negative-text"}>
                  Net: {formatSignedMoney(totals.netMinor, state.currencyLabel, 1)}
                </span>
              </div>
            </article>
          </div>

          <p className="panel-note">Positive net means the player should receive. Negative net means the player should pay.</p>
        </section>

        <section className="panel-card reconciliation-card">
          <div className="panel-header">
            <div>
              <h2>Balance Reconciliation</h2>
              <p>
                Initial net position was {formatSignedMoney(imbalanceMinor, state.currencyLabel, 1)}.
                {correction.correctionRows.length > 0 ? " Adjustments applied to resolve discrepancy." : " No adjustment needed."}
              </p>
            </div>
          </div>

          <div className="reconciliation-status">
            <span className={correction.imbalanceAfterMinor === 0 ? "status-badge success" : "status-badge warning"}>
              {correction.imbalanceAfterMinor === 0 ? "Balances Zeroed" : "Needs Attention"}
            </span>
          </div>

          {adjustmentRows.length > 0 ? (
            <div className="adjustment-grid">
              {adjustmentRows.map((row) => (
                <div key={row.playerId} className="adjustment-row">
                  <div className="adjustment-row-main">
                    <span className="player-dot active" />
                    <strong>{row.name}</strong>
                  </div>
                  <div className="adjustment-values">
                    <span className="adjustment-original">{formatSignedMoney(row.originalMinor, state.currencyLabel, 1)}</span>
                    <span className={`adjustment-final ${row.correctedMinor > 0 ? "positive-text" : row.correctedMinor < 0 ? "negative-text" : ""}`}>
                      {formatSignedMoney(row.correctedMinor, state.currencyLabel, 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Profit Ranking</h2>
              <p>Final positions ordered from biggest winner to biggest loser.</p>
            </div>
          </div>

          <div className="table-shell">
            <table className="ranking-table" role="table" aria-label="Profit ranking">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {rankedRows.length === 0 ? (
                  <tr>
                    <td className="empty-state-cell" colSpan={3}>
                      Enter players to see the ranking board.
                    </td>
                  </tr>
                ) : (
                  rankedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <span className="rank-pill">#{index + 1}</span>
                      </td>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>
                        <span
                          className={`ranking-amount ${row.finalMinor > 0 ? "positive-text" : row.finalMinor < 0 ? "negative-text" : ""}`}
                        >
                          {formatSignedMoney(row.finalMinor, state.currencyLabel, 1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Settlement Plan</h2>
              <p>Optimized transfer routing.</p>
            </div>
          </div>

          <div className="table-shell">
            <table className="settlement-table" role="table" aria-label="Settlement plan">
              <thead>
                <tr>
                  <th>From (Loser)</th>
                  <th>To (Winner)</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td className="empty-state-cell" colSpan={3}>
                      Add player numbers to generate the who-pays-whom table.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment, index) => (
                    <tr key={`${payment.fromPlayerId}-${payment.toPlayerId}-${index}`}>
                      <td>
                        <strong>{nameFor(payment.fromPlayerId)}</strong>
                      </td>
                      <td>
                        <strong>{nameFor(payment.toPlayerId)}</strong>
                      </td>
                      <td>
                        <strong className="amount-badge">{toAbsoluteMoney(payment.amountMinor, state.currencyLabel, 1)}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {correction.correctionRows.length > 0 ? (
            <div className="adjustment-strip">
              <strong>Adjustment made</strong>
              <span>
                Total net was {formatSignedMoney(balances.reduce((sum, item) => sum + item.balanceMinor, 0), state.currencyLabel, 1)}.
                Auto-correction: {correctionMessage}
              </span>
            </div>
          ) : null}

          {correction.warnings.length > 0 ? (
            <div className="warning-strip">{correction.warnings.join(" ")}</div>
          ) : null}
        </section>
      </div>
    </main>
  );
};
