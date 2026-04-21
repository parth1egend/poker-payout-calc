import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { MoneyField } from "@/components/MoneyField";
import { copyText } from "@/lib/browser";
import { db, saveSettlementRun } from "@/lib/db";
import { formatMoney, formatSignedMoney, parseMoneyInput, toAbsoluteMoney } from "@/lib/money";
import { buildSettlementComputation } from "@/lib/settlement-engine";
import { getEntriesForSession, getGamesForSession, getPlayersForSession } from "@/lib/session-metrics";
import { buildSettlementText } from "@/lib/summary";

const playerName = (players: ReturnType<typeof getPlayersForSession>, playerId: string): string =>
  players.find((player) => player.id === playerId)?.nickname ||
  players.find((player) => player.id === playerId)?.name ||
  "Unknown player";

export const SettlementPage = () => {
  const { sessionId = "" } = useParams();
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const players = useLiveQuery(() => db.players.toArray(), [], []);
  const sessionPlayers = useLiveQuery(() => db.sessionPlayers.toArray(), [], []);
  const games = useLiveQuery(() => db.games.toArray(), [], []);
  const entries = useLiveQuery(() => db.ledgerEntries.toArray(), [], []);
  const settlementRuns = useLiveQuery(() => db.settlementRuns.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get("app"), [], undefined);
  const session = sessions.find((item) => item.id === sessionId);
  const roster = useMemo(() => getPlayersForSession(players, sessionPlayers, sessionId), [players, sessionPlayers, sessionId]);
  const sessionGames = useMemo(() => getGamesForSession(games, sessionId), [games, sessionId]);
  const sessionEntries = useMemo(() => getEntriesForSession(entries, sessionId), [entries, sessionId]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [thresholdInput, setThresholdInput] = useState("20");
  const [applyCorrection, setApplyCorrection] = useState(true);
  const [showIgnored, setShowIgnored] = useState(true);

  useEffect(() => {
    setSelectedGameIds((current) =>
      current.length > 0 ? current : sessionGames.filter((game) => game.includeInSettlement).map((game) => game.id)
    );
  }, [sessionGames]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setThresholdInput(String(settings.defaultThresholdMinor));
    setApplyCorrection(settings.autoRunCorrection);
    setShowIgnored(settings.showIgnoredSmallTransfers);
  }, [settings]);

  const computation = useMemo(
    () =>
      buildSettlementComputation({
        sessionId,
        playerIds: roster.map((player) => player.id),
        selectedGameIds,
        entries: sessionEntries,
        thresholdMinor: parseMoneyInput(thresholdInput || "0", settings?.moneyScale ?? 1),
        applyCorrection
      }),
    [applyCorrection, roster, selectedGameIds, sessionEntries, sessionId, settings?.moneyScale, thresholdInput]
  );

  if (!session) {
    return <p className="muted">Session not found.</p>;
  }

  const currencyLabel = settings?.currencyLabel ?? "INR";
  const scale = settings?.moneyScale ?? 1;
  const recentRuns = settlementRuns
    .filter((run) => run.sessionId === sessionId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);

  const saveRun = async () => {
    await saveSettlementRun(computation);
  };

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">{session.title}</p>
          <h2>Combined settlement</h2>
          <p className="muted">Choose which games count, review the correction, and then save a settlement snapshot.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={saveRun}>
            Save settlement run
          </button>
          <Link className="ghost-button link-button" to={`/sessions/${sessionId}`}>
            Back to session
          </Link>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Settlement controls</p>
            <h3>Games, threshold, correction</h3>
          </div>
        </div>
        <div className="stack compact">
          <div className="field">
            <span>Included games</span>
            <div className="checkbox-grid">
              {sessionGames.map((game) => {
                const checked = selectedGameIds.includes(game.id);

                return (
                  <label key={game.id} className={`toggle-tile${checked ? " active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedGameIds((current) =>
                          checked ? current.filter((gameId) => gameId !== game.id) : [...current, game.id]
                        )
                      }
                    />
                    <span>{game.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <MoneyField
            label="Threshold"
            value={thresholdInput}
            onChange={setThresholdInput}
            helpText="Transfers below this amount stay in a separate ignored bucket."
          />

          <label className="switch-row">
            <input type="checkbox" checked={applyCorrection} onChange={(event) => setApplyCorrection(event.target.checked)} />
            <span>Apply proportional imbalance correction before payments</span>
          </label>

          <label className="switch-row">
            <input type="checkbox" checked={showIgnored} onChange={(event) => setShowIgnored(event.target.checked)} />
            <span>Show ignored small transfers section</span>
          </label>

          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              copyText(buildSettlementText(session, sessionGames, roster, computation, currencyLabel, scale)).catch(
                () => undefined
              )
            }
          >
            Copy settlement summary
          </button>
        </div>
      </article>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Raw imbalance</span>
          <strong>{formatSignedMoney(computation.imbalanceBeforeMinor, currencyLabel, scale)}</strong>
        </article>
        <article className="stat-card">
          <span>After correction</span>
          <strong>{formatSignedMoney(computation.imbalanceAfterMinor, currencyLabel, scale)}</strong>
        </article>
        <article className="stat-card">
          <span>Main transfers</span>
          <strong>{computation.mainPayments.length}</strong>
        </article>
        <article className="stat-card">
          <span>Ignored small</span>
          <strong>{computation.smallPayments.length}</strong>
        </article>
      </div>

      {computation.warnings.length > 0 ? (
        <article className="card warning-card">
          <p className="eyebrow">Warnings</p>
          <ul className="plain-list">
            {computation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Raw combined balances</p>
            <h3>Before correction</h3>
          </div>
        </div>
        <div className="stack compact">
          {computation.rawBalances.map((balance) => (
            <div key={balance.playerId} className="list-row">
              <span>{playerName(roster, balance.playerId)}</span>
              <strong>{formatSignedMoney(balance.balanceMinor, currencyLabel, scale)}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Per-game audit</p>
            <h3>Selected game balances</h3>
          </div>
        </div>
        <div className="stack compact">
          {computation.perGameBalances.map((gameSummary) => {
            const game = sessionGames.find((item) => item.id === gameSummary.gameId);

            return (
              <div key={gameSummary.gameId} className="note-box">
                <strong>{game?.name ?? "Unknown game"}</strong>
                <div className="stack compact top-gap">
                  {gameSummary.balances.map((balance) => (
                    <div key={balance.playerId} className="list-row">
                      <span>{playerName(roster, balance.playerId)}</span>
                      <span>{formatSignedMoney(balance.balanceMinor, currencyLabel, scale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Auto-correction</p>
            <h3>How the imbalance was distributed</h3>
          </div>
        </div>
        <div className="stack compact">
          {computation.correctionRows.length === 0 ? (
            <p className="muted">No correction rows for the current configuration.</p>
          ) : (
            computation.correctionRows.map((row) => (
              <div key={row.playerId} className="list-row wide">
                <div>
                  <strong>{playerName(roster, row.playerId)}</strong>
                  <p className="muted">Basis {formatMoney(row.basisMinor, currencyLabel, scale)}</p>
                </div>
                <span className={`badge${row.adjustmentMinor >= 0 ? " success" : " warning"}`}>
                  {formatSignedMoney(row.adjustmentMinor, currencyLabel, scale)}
                </span>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Corrected balances</p>
            <h3>Ready for settlement</h3>
          </div>
        </div>
        <div className="stack compact">
          {computation.correctedBalances.map((balance) => (
            <div key={balance.playerId} className="list-row">
              <span>{playerName(roster, balance.playerId)}</span>
              <strong>{formatSignedMoney(balance.balanceMinor, currencyLabel, scale)}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Main transfers</p>
            <h3>Who pays whom</h3>
          </div>
        </div>
        <div className="stack compact">
          {computation.mainPayments.length === 0 ? (
            <p className="muted">No main transfers for the current threshold and correction settings.</p>
          ) : (
            computation.mainPayments.map((payment, index) => (
              <div key={`${payment.fromPlayerId}-${payment.toPlayerId}-${index}`} className="list-row wide">
                <div>
                  <strong>
                    {playerName(roster, payment.fromPlayerId)} pays {playerName(roster, payment.toPlayerId)}
                  </strong>
                </div>
                <span className="badge success">{toAbsoluteMoney(payment.amountMinor, currencyLabel, scale)}</span>
              </div>
            ))
          )}
        </div>
      </article>

      {showIgnored ? (
        <article className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Ignored small transfers</p>
              <h3>Optional carry-forward bucket</h3>
            </div>
          </div>
          <div className="stack compact">
            {computation.smallPayments.length === 0 ? (
              <p className="muted">No transfers fell below the current threshold.</p>
            ) : (
              <>
                {computation.smallPayments.map((payment, index) => (
                  <div key={`${payment.fromPlayerId}-${payment.toPlayerId}-${index}`} className="list-row wide">
                    <div>
                      <strong>
                        {playerName(roster, payment.fromPlayerId)}
                        {" -> "}
                        {playerName(roster, payment.toPlayerId)}
                      </strong>
                    </div>
                    <span className="badge">{toAbsoluteMoney(payment.amountMinor, currencyLabel, scale)}</span>
                  </div>
                ))}
                <div className="note-box">
                  <strong>Carry-forward impact if ignored</strong>
                  <div className="stack compact top-gap">
                    {computation.smallTransferImpact.map((balance) => (
                      <div key={balance.playerId} className="list-row">
                        <span>{playerName(roster, balance.playerId)}</span>
                        <span>{formatSignedMoney(balance.balanceMinor, currencyLabel, scale)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </article>
      ) : null}

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Saved runs</p>
            <h3>Most recent snapshots</h3>
          </div>
        </div>
        <div className="stack compact">
          {recentRuns.length === 0 ? (
            <p className="muted">No saved runs yet for this session.</p>
          ) : (
            recentRuns.map((run) => (
              <div key={run.id} className="list-row wide">
                <div>
                  <strong>{new Date(run.createdAt).toLocaleString()}</strong>
                  <p className="muted">
                    {run.mainPayments.length} main transfers · threshold {formatMoney(run.thresholdMinor, currencyLabel, scale)}
                  </p>
                </div>
                <span className={`badge${run.imbalanceAfterMinor === 0 ? " success" : " warning"}`}>
                  {formatSignedMoney(run.imbalanceAfterMinor, currencyLabel, scale)}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
};
