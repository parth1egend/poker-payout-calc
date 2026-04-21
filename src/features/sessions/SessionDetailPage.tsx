import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Modal } from "@/components/Modal";
import { copyText } from "@/lib/browser";
import { createGame, db, updateSession } from "@/lib/db";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { getEntriesForSession, getGamesForSession, getPlayersForSession, getSessionTotals } from "@/lib/session-metrics";
import { buildSessionSummaryText } from "@/lib/summary";

export const SessionDetailPage = () => {
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
  const runs = useMemo(
    () => settlementRuns.filter((run) => run.sessionId === sessionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [settlementRuns, sessionId]
  );
  const [editOpen, setEditOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameForm, setGameForm] = useState({ name: "", notes: "" });
  const [sessionForm, setSessionForm] = useState({
    title: session?.title ?? "",
    date: session?.date ?? "",
    location: session?.location ?? "",
    notes: session?.notes ?? "",
    playerIds: roster.map((player) => player.id)
  });

  if (!session) {
    return <p className="muted">Session not found.</p>;
  }

  const totals = getSessionTotals(
    session.id,
    games,
    entries,
    roster.map((player) => player.id)
  );
  const currencyLabel = settings?.currencyLabel ?? "INR";
  const scale = settings?.moneyScale ?? 1;

  const openEdit = () => {
    setSessionForm({
      title: session.title,
      date: session.date,
      location: session.location ?? "",
      notes: session.notes ?? "",
      playerIds: roster.map((player) => player.id)
    });
    setEditOpen(true);
  };

  const saveSessionChanges = async () => {
    if (!sessionForm.title.trim() || sessionForm.playerIds.length === 0) {
      return;
    }

    await updateSession(
      session.id,
      {
        title: sessionForm.title.trim(),
        date: sessionForm.date,
        location: sessionForm.location.trim() || undefined,
        notes: sessionForm.notes.trim() || undefined
      },
      sessionForm.playerIds
    );
    setEditOpen(false);
  };

  const saveGame = async () => {
    if (!gameForm.name.trim()) {
      return;
    }

    await createGame(session.id, {
      name: gameForm.name.trim(),
      notes: gameForm.notes.trim() || undefined
    });
    setGameForm({ name: "", notes: "" });
    setGameOpen(false);
  };

  const activeGameCount = sessionGames.filter((game) => game.includeInSettlement).length;

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">Session overview</p>
          <h2>{session.title}</h2>
          <p className="muted">
            {session.date}
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="ghost-button" onClick={openEdit}>
            Edit session
          </button>
          <Link className="primary-button" to={`/sessions/${session.id}/settlement`}>
            Open settlement
          </Link>
        </div>
      </article>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Buy-ins</span>
          <strong>{formatMoney(totals.totalBuyInsMinor, currencyLabel, scale)}</strong>
        </article>
        <article className="stat-card">
          <span>Payouts</span>
          <strong>{formatMoney(totals.totalPayoutsMinor, currencyLabel, scale)}</strong>
        </article>
        <article className="stat-card">
          <span>Games included</span>
          <strong>
            {activeGameCount}/{sessionGames.length}
          </strong>
        </article>
        <article className="stat-card">
          <span>Imbalance</span>
          <strong>{formatSignedMoney(totals.imbalanceMinor, currencyLabel, scale)}</strong>
        </article>
      </div>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Players</p>
            <h3>{roster.length} active</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              copyText(buildSessionSummaryText(session, sessionGames, roster, currencyLabel, scale)).catch(() => undefined)
            }
          >
            Copy session summary
          </button>
        </div>
        <div className="chip-row">
          {roster.map((player) => (
            <span key={player.id} className="pill">
              {player.nickname || player.name}
            </span>
          ))}
        </div>
        {session.notes ? <p className="note-box">{session.notes}</p> : null}
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Games</p>
            <h3>{sessionGames.length} created</h3>
          </div>
          <button type="button" className="primary-button" onClick={() => setGameOpen(true)}>
            Add game
          </button>
        </div>

        <div className="stack compact">
          {sessionGames.length === 0 ? (
            <p className="muted">Create a game for each table or format you want to settle together later.</p>
          ) : (
            sessionGames.map((game) => {
              const gameEntries = sessionEntries.filter((entry) => entry.gameId === game.id);

              return (
                <div key={game.id} className="list-row wide">
                  <div>
                    <strong>{game.name}</strong>
                    <p className="muted">
                      {gameEntries.length} entries · {game.includeInSettlement ? "Included in settlement" : "Excluded from settlement"}
                    </p>
                    {game.notes ? <p className="muted">{game.notes}</p> : null}
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => db.games.update(game.id, { includeInSettlement: !game.includeInSettlement, updatedAt: new Date().toISOString() })}
                    >
                      {game.includeInSettlement ? "Exclude" : "Include"}
                    </button>
                    <Link className="ghost-button link-button" to={`/sessions/${session.id}/games/${game.id}`}>
                      Open
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Settlement history</p>
            <h3>{runs.length} saved runs</h3>
          </div>
        </div>
        <div className="stack compact">
          {runs.length === 0 ? (
            <p className="muted">No saved settlement runs yet. Each settlement snapshot is stored for auditability.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="list-row wide">
                <div>
                  <strong>{new Date(run.createdAt).toLocaleString()}</strong>
                  <p className="muted">
                    Threshold {formatMoney(run.thresholdMinor, currencyLabel, scale)} · {run.mainPayments.length} main transfers
                  </p>
                </div>
                <span className={`badge${run.imbalanceAfterMinor === 0 ? " success" : " warning"}`}>
                  After correction {formatSignedMoney(run.imbalanceAfterMinor, currencyLabel, scale)}
                </span>
              </div>
            ))
          )}
        </div>
      </article>

      <Modal
        title="Edit session"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={saveSessionChanges}>
              Save
            </button>
          </>
        }
      >
        <div className="stack compact">
          <label className="field">
            <span>Title</span>
            <input
              value={sessionForm.title}
              onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={sessionForm.date}
              onChange={(event) => setSessionForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              value={sessionForm.location}
              onChange={(event) => setSessionForm((current) => ({ ...current, location: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={3}
              value={sessionForm.notes}
              onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <div className="field">
            <span>Active players</span>
            <div className="checkbox-grid">
              {players
                .filter((player) => !player.archived)
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((player) => {
                  const checked = sessionForm.playerIds.includes(player.id);

                  return (
                    <label key={player.id} className={`toggle-tile${checked ? " active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSessionForm((current) => ({
                            ...current,
                            playerIds: checked
                              ? current.playerIds.filter((playerId) => playerId !== player.id)
                              : [...current.playerIds, player.id]
                          }))
                        }
                      />
                      <span>{player.nickname || player.name}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="Add game"
        open={gameOpen}
        onClose={() => setGameOpen(false)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setGameOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={saveGame}>
              Save game
            </button>
          </>
        }
      >
        <div className="stack compact">
          <label className="field">
            <span>Game name</span>
            <input value={gameForm.name} onChange={(event) => setGameForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={3}
              value={gameForm.notes}
              onChange={(event) => setGameForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
};
