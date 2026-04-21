import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Modal } from "@/components/Modal";
import { MoneyField } from "@/components/MoneyField";
import { QuickAmountButtons } from "@/components/QuickAmountButtons";
import { createLedgerEntry, db, deleteLedgerEntry, updateGame, updateLedgerEntry } from "@/lib/db";
import { formatMoney, formatSignedMoney, parseMoneyInput } from "@/lib/money";
import { calculateGameNetSummary } from "@/lib/settlement-engine";
import { getPlayersForSession } from "@/lib/session-metrics";
import type { EntryType, LedgerEntry } from "@/lib/types";

const entryTypeLabels: Record<EntryType, string> = {
  buyIn: "Buy-in",
  rebuy: "Rebuy",
  payout: "Payout",
  correction: "Correction",
  note: "Note"
};

const quickAmounts = [100, 200, 500, 1000];

const emptyEntryForm = {
  playerId: "",
  entryType: "buyIn" as EntryType,
  amount: "",
  note: ""
};

export const GameDetailPage = () => {
  const { sessionId = "", gameId = "" } = useParams();
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const players = useLiveQuery(() => db.players.toArray(), [], []);
  const sessionPlayers = useLiveQuery(() => db.sessionPlayers.toArray(), [], []);
  const games = useLiveQuery(() => db.games.toArray(), [], []);
  const entries = useLiveQuery(() => db.ledgerEntries.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get("app"), [], undefined);
  const session = sessions.find((item) => item.id === sessionId);
  const game = games.find((item) => item.id === gameId);
  const roster = useMemo(() => getPlayersForSession(players, sessionPlayers, sessionId), [players, sessionPlayers, sessionId]);
  const gameEntries = useMemo(
    () => entries.filter((entry) => entry.gameId === gameId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [entries, gameId]
  );
  const summary = useMemo(
    () => calculateGameNetSummary(gameId, roster.map((player) => player.id), gameEntries),
    [gameEntries, gameId, roster]
  );
  const [entryForm, setEntryForm] = useState({
    ...emptyEntryForm,
    playerId: roster[0]?.id ?? ""
  });
  const [gameForm, setGameForm] = useState({
    name: game?.name ?? "",
    notes: game?.notes ?? ""
  });
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [editingForm, setEditingForm] = useState(emptyEntryForm);

  useEffect(() => {
    if (roster.length === 0) {
      return;
    }

    setEntryForm((current) => ({
      ...current,
      playerId: current.playerId || roster[0].id
    }));
  }, [roster]);

  useEffect(() => {
    if (!game) {
      return;
    }

    setGameForm({
      name: game.name,
      notes: game.notes ?? ""
    });
  }, [game]);

  if (!session || !game) {
    return <p className="muted">Game not found.</p>;
  }

  const currencyLabel = settings?.currencyLabel ?? "INR";
  const scale = settings?.moneyScale ?? 1;

  const saveGameMeta = async () => {
    if (!gameForm.name.trim()) {
      return;
    }

    await updateGame(game.id, {
      name: gameForm.name.trim(),
      notes: gameForm.notes.trim() || undefined
    });
  };

  const saveEntry = async () => {
    if (!entryForm.playerId) {
      return;
    }

    const amountMinor =
      entryForm.entryType === "note" ? 0 : parseMoneyInput(entryForm.amount || "0", scale);

    if (entryForm.entryType !== "note" && amountMinor === 0) {
      return;
    }

    await createLedgerEntry({
      sessionId,
      gameId,
      playerId: entryForm.playerId,
      entryType: entryForm.entryType,
      amountMinor,
      note: entryForm.note.trim() || undefined
    });

    setEntryForm({
      ...emptyEntryForm,
      playerId: entryForm.playerId,
      entryType: entryForm.entryType
    });
  };

  const openEditEntry = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setEditingForm({
      playerId: entry.playerId,
      entryType: entry.entryType,
      amount: entry.entryType === "note" ? "" : String(entry.amountMinor),
      note: entry.note ?? ""
    });
  };

  const saveEditedEntry = async () => {
    if (!editingEntry) {
      return;
    }

    await updateLedgerEntry(editingEntry.id, {
      playerId: editingForm.playerId,
      entryType: editingForm.entryType,
      amountMinor: editingForm.entryType === "note" ? 0 : parseMoneyInput(editingForm.amount || "0", scale),
      note: editingForm.note.trim() || undefined
    });
    setEditingEntry(null);
  };

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">{session.title}</p>
          <h2>{game.name}</h2>
          <p className="muted">Track buy-ins, payouts, corrections, and notes for this game only.</p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => updateGame(game.id, { includeInSettlement: !game.includeInSettlement })}
          >
            {game.includeInSettlement ? "Exclude from settlement" : "Include in settlement"}
          </button>
          <Link className="ghost-button link-button" to={`/sessions/${sessionId}`}>
            Back to session
          </Link>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Game setup</p>
            <h3>Metadata</h3>
          </div>
          <button type="button" className="primary-button" onClick={saveGameMeta}>
            Save details
          </button>
        </div>
        <div className="stack compact">
          <label className="field">
            <span>Name</span>
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
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Quick entry</p>
            <h3>Add ledger rows fast</h3>
          </div>
        </div>

        <div className="stack compact">
          <div className="field">
            <span>Player</span>
            <div className="chip-row">
              {roster.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`chip-button${entryForm.playerId === player.id ? " active" : ""}`}
                  onClick={() => setEntryForm((current) => ({ ...current, playerId: player.id }))}
                >
                  {player.nickname || player.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Entry type</span>
            <div className="chip-row">
              {(Object.keys(entryTypeLabels) as EntryType[]).map((entryType) => (
                <button
                  key={entryType}
                  type="button"
                  className={`chip-button${entryForm.entryType === entryType ? " active" : ""}`}
                  onClick={() => setEntryForm((current) => ({ ...current, entryType }))}
                >
                  {entryTypeLabels[entryType]}
                </button>
              ))}
            </div>
          </div>

          {entryForm.entryType !== "note" ? (
            <>
              <MoneyField
                label="Amount"
                value={entryForm.amount}
                onChange={(amount) => setEntryForm((current) => ({ ...current, amount }))}
                helpText={entryForm.entryType === "correction" ? "Use a negative amount to increase what the player owes." : undefined}
              />
              <QuickAmountButtons
                amounts={quickAmounts}
                onPick={(amount) =>
                  setEntryForm((current) => ({
                    ...current,
                    amount:
                      current.entryType === "correction" && current.amount.startsWith("-")
                        ? String(-(Math.abs(Number(current.amount || 0)) + amount))
                        : String(Math.abs(Number(current.amount || 0)) + amount)
                  }))
                }
              />
            </>
          ) : null}

          <label className="field">
            <span>Note</span>
            <textarea
              rows={2}
              placeholder="Optional explanation"
              value={entryForm.note}
              onChange={(event) => setEntryForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>

          <button type="button" className="primary-button" onClick={saveEntry}>
            Add entry
          </button>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Running balances</p>
            <h3>Per-player game result</h3>
          </div>
        </div>
        <div className="stack compact">
          {summary.perPlayer.map((playerSummary) => {
            const player = roster.find((item) => item.id === playerSummary.playerId);

            return (
              <div key={playerSummary.playerId} className="list-row wide">
                <div>
                  <strong>{player?.nickname || player?.name || "Unknown player"}</strong>
                  <p className="muted">
                    In {formatMoney(playerSummary.contributedMinor, currencyLabel, scale)} · Out{" "}
                    {formatMoney(playerSummary.paidOutMinor, currencyLabel, scale)} · Corrections{" "}
                    {formatSignedMoney(playerSummary.correctionsMinor, currencyLabel, scale)}
                  </p>
                </div>
                <span className={`badge${playerSummary.netMinor >= 0 ? " success" : " warning"}`}>
                  {formatSignedMoney(playerSummary.netMinor, currencyLabel, scale)}
                </span>
              </div>
            );
          })}
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Ledger</p>
            <h3>{gameEntries.length} rows</h3>
          </div>
        </div>
        <div className="stack compact">
          {gameEntries.length === 0 ? (
            <p className="muted">No entries yet. Add buy-ins, payouts, or a note to start the audit trail.</p>
          ) : (
            gameEntries.map((entry) => {
              const player = roster.find((item) => item.id === entry.playerId);

              return (
                <div key={entry.id} className="list-row wide">
                  <div>
                    <strong>
                      {player?.nickname || player?.name || "Unknown"} · {entryTypeLabels[entry.entryType]}
                    </strong>
                    <p className="muted">
                      {entry.entryType === "note" ? "No amount" : formatSignedMoney(entry.amountMinor, currencyLabel, scale)}
                    </p>
                    {entry.note ? <p className="muted">{entry.note}</p> : null}
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost-button" onClick={() => openEditEntry(entry)}>
                      Edit
                    </button>
                    <button type="button" className="ghost-button" onClick={() => deleteLedgerEntry(entry.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>

      <Modal
        title="Edit entry"
        open={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setEditingEntry(null)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={saveEditedEntry}>
              Save
            </button>
          </>
        }
      >
        <div className="stack compact">
          <div className="field">
            <span>Player</span>
            <select
              value={editingForm.playerId}
              onChange={(event) => setEditingForm((current) => ({ ...current, playerId: event.target.value }))}
            >
              {roster.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nickname || player.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>Entry type</span>
            <select
              value={editingForm.entryType}
              onChange={(event) => setEditingForm((current) => ({ ...current, entryType: event.target.value as EntryType }))}
            >
              {(Object.keys(entryTypeLabels) as EntryType[]).map((entryType) => (
                <option key={entryType} value={entryType}>
                  {entryTypeLabels[entryType]}
                </option>
              ))}
            </select>
          </div>
          {editingForm.entryType !== "note" ? (
            <MoneyField
              label="Amount"
              value={editingForm.amount}
              onChange={(amount) => setEditingForm((current) => ({ ...current, amount }))}
            />
          ) : null}
          <label className="field">
            <span>Note</span>
            <textarea
              rows={2}
              value={editingForm.note}
              onChange={(event) => setEditingForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
};
