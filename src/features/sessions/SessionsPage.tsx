import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Modal } from "@/components/Modal";
import { createSession, db } from "@/lib/db";
import { formatSignedMoney } from "@/lib/money";
import { getPlayersForSession, getSessionTotals } from "@/lib/session-metrics";

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  title: "",
  date: today,
  location: "",
  notes: "",
  playerIds: [] as string[]
};

export const SessionsPage = () => {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const players = useLiveQuery(() => db.players.toArray(), [], []);
  const sessionPlayers = useLiveQuery(() => db.sessionPlayers.toArray(), [], []);
  const games = useLiveQuery(() => db.games.toArray(), [], []);
  const entries = useLiveQuery(() => db.ledgerEntries.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get("app"), [], undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const orderedPlayers = useMemo(
    () => players.filter((player) => !player.archived).sort((left, right) => left.name.localeCompare(right.name)),
    [players]
  );

  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt)),
    [sessions]
  );

  const reset = () => {
    setForm(emptyForm);
    setOpen(false);
  };

  const saveSession = async () => {
    if (!form.title.trim() || form.playerIds.length === 0) {
      return;
    }

    await createSession(
      {
        title: form.title.trim(),
        date: form.date,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
        groupId: undefined
      },
      form.playerIds
    );

    reset();
  };

  const currencyLabel = settings?.currencyLabel ?? "INR";
  const scale = settings?.moneyScale ?? 1;

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">Session ledger</p>
          <h2>Track poker nights by session, game, and final settlement.</h2>
          <p className="muted">All data stays in your browser with offline support and deterministic integer-money math.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          New session
        </button>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Sessions</p>
            <h3>{orderedSessions.length} total</h3>
          </div>
        </div>

        <div className="stack compact">
          {orderedSessions.length === 0 ? (
            <p className="muted">Start with a session, pick the active players, and then add each game inside it.</p>
          ) : (
            orderedSessions.map((session) => {
              const sessionRoster = getPlayersForSession(players, sessionPlayers, session.id);
              const totals = getSessionTotals(
                session.id,
                games,
                entries,
                sessionRoster.map((player) => player.id)
              );

              return (
                <Link key={session.id} to={`/sessions/${session.id}`} className="card-link">
                  <div className="list-row wide">
                    <div>
                      <strong>{session.title}</strong>
                      <p className="muted">
                        {session.date}
                        {session.location ? ` · ${session.location}` : ""}
                      </p>
                      <p className="muted">
                        {sessionRoster.length} players · {games.filter((game) => game.sessionId === session.id).length} games
                      </p>
                    </div>
                    <div className="stat-stack">
                      <span className={`badge${totals.imbalanceMinor === 0 ? " success" : " warning"}`}>
                        Imbalance {formatSignedMoney(totals.imbalanceMinor, currencyLabel, scale)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </article>

      <Modal
        title="New session"
        open={open}
        onClose={reset}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={reset}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={saveSession}>
              Create session
            </button>
          </>
        }
      >
        <div className="stack compact">
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <div className="field">
            <span>Active players</span>
            <div className="checkbox-grid">
              {orderedPlayers.map((player) => {
                const checked = form.playerIds.includes(player.id);

                return (
                  <label key={player.id} className={`toggle-tile${checked ? " active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
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
    </section>
  );
};
