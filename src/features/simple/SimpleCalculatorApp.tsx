import { useEffect, useMemo, useRef, useState } from "react";

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

    saveCalculatorState(state).catch(() => undefined);
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

  const nameFor = (rowId: string): string => activeRows.find((row) => row.id === rowId)?.name.trim() || "Unknown";

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

          <div className="player-table">
            <div className={state.mode === "cashflow" ? "player-table-head four" : "player-table-head two"}>
              <span>Player Name</span>
              {state.mode === "cashflow" ? <span>Total In</span> : null}
              {state.mode === "cashflow" ? <span>Total Out</span> : null}
              <span>Net</span>
            </div>

            {state.rows.map((row) => {
              const netMinor = rowBalance(row, state.mode);

              return (
                <div key={row.id} className={state.mode === "cashflow" ? "player-row four" : "player-row two"}>
                  <input
                    aria-label="Player name"
                    className="table-input name"
                    value={row.name}
                    placeholder="Player name"
                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  />

                  {state.mode === "cashflow" ? (
                    <input
                      aria-label="Total in"
                      inputMode="numeric"
                      className="table-input amount"
                      value={numberValue(row.totalInMinor)}
                      placeholder="0"
                      onChange={(event) =>
                        updateRow(row.id, {
                          totalInMinor: Math.max(0, parseMoneyInput(event.target.value, 1))
                        })
                      }
                    />
                  ) : null}

                  {state.mode === "cashflow" ? (
                    <input
                      aria-label="Total out"
                      inputMode="numeric"
                      className="table-input amount"
                      value={numberValue(row.totalOutMinor)}
                      placeholder="0"
                      onChange={(event) =>
                        updateRow(row.id, {
                          totalOutMinor: Math.max(0, parseMoneyInput(event.target.value, 1))
                        })
                      }
                    />
                  ) : null}

                  {state.mode === "net" ? (
                    <input
                      aria-label="Net profit"
                      inputMode="numeric"
                      className={`table-input amount net-field ${netMinor > 0 ? "positive" : netMinor < 0 ? "negative" : ""}`}
                      value={numberValue(row.netMinor)}
                      placeholder="0"
                      onChange={(event) =>
                        updateRow(row.id, {
                          netMinor: parseMoneyInput(event.target.value, 1)
                        })
                      }
                    />
                  ) : (
                    <div className={`net-pill ${netMinor > 0 ? "positive" : netMinor < 0 ? "negative" : ""}`}>
                      {formatSignedMoney(netMinor, state.currencyLabel, 1)}
                    </div>
                  )}

                  <button type="button" className="row-delete" onClick={() => removeRow(row.id)} aria-label="Remove player">
                    ×
                  </button>
                </div>
              );
            })}

            <div className={state.mode === "cashflow" ? "player-total four" : "player-total two"}>
              <strong>Total</strong>
              {state.mode === "cashflow" ? <strong>{formatMoney(totals.totalInMinor, state.currencyLabel, 1)}</strong> : null}
              {state.mode === "cashflow" ? <strong>{formatMoney(totals.totalOutMinor, state.currencyLabel, 1)}</strong> : null}
              <strong className={totals.netMinor === 0 ? "" : totals.netMinor > 0 ? "positive-text" : "negative-text"}>
                {formatSignedMoney(totals.netMinor, state.currencyLabel, 1)}
              </strong>
            </div>
          </div>

          <p className="panel-note">Positive net means the player should receive. Negative net means the player should pay.</p>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Settlement Plan</h2>
              <p>Optimized transfer routing.</p>
            </div>
          </div>

          <div className="settlement-table">
            <div className="settlement-head">
              <span>From (Loser)</span>
              <span>To (Winner)</span>
              <span>Amount</span>
            </div>

            {payments.length === 0 ? (
              <div className="empty-state">Add player numbers to generate the who-pays-whom table.</div>
            ) : (
              payments.map((payment, index) => (
                <div key={`${payment.fromPlayerId}-${payment.toPlayerId}-${index}`} className="settlement-row">
                  <span>{nameFor(payment.fromPlayerId)}</span>
                  <span>{nameFor(payment.toPlayerId)}</span>
                  <strong>{toAbsoluteMoney(payment.amountMinor, state.currencyLabel, 1)}</strong>
                </div>
              ))
            )}
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
