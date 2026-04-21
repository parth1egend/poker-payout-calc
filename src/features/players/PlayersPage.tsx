import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { createPlayer, db, updatePlayer } from "@/lib/db";
import type { Player } from "@/lib/types";

const emptyForm = {
  name: "",
  nickname: ""
};

export const PlayersPage = () => {
  const players = useLiveQuery(() => db.players.toArray(), [], []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState(emptyForm);

  const orderedPlayers = useMemo(
    () =>
      [...players].sort((left, right) => {
        if (left.archived !== right.archived) {
          return Number(left.archived) - Number(right.archived);
        }

        return left.name.localeCompare(right.name);
      }),
    [players]
  );

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    setForm({
      name: player.name,
      nickname: player.nickname ?? ""
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      return;
    }

    if (editing) {
      await updatePlayer(editing.id, {
        name: form.name.trim(),
        nickname: form.nickname.trim() || undefined
      });
    } else {
      await createPlayer({
        name: form.name.trim(),
        nickname: form.nickname.trim() || undefined
      });
    }

    reset();
  };

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">Reusable roster</p>
          <h2>Keep players ready for the next session.</h2>
        </div>
        <button type="button" className="primary-button" onClick={openCreate}>
          Add player
        </button>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Players</p>
            <h3>{orderedPlayers.length} saved</h3>
          </div>
        </div>

        <div className="stack compact">
          {orderedPlayers.length === 0 ? (
            <p className="muted">No players yet. Add the people you usually play with and reuse them across sessions.</p>
          ) : (
            orderedPlayers.map((player) => (
              <div key={player.id} className="list-row">
                <div>
                  <strong>{player.name}</strong>
                  <p className="muted">{player.nickname ? `Nickname: ${player.nickname}` : "No nickname"}</p>
                </div>
                <div className="row-actions">
                  <button type="button" className="ghost-button" onClick={() => openEdit(player)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => updatePlayer(player.id, { archived: !player.archived })}
                  >
                    {player.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </article>

      <Modal
        title={editing ? "Edit player" : "Add player"}
        open={open}
        onClose={reset}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={reset}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div className="stack compact">
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Nickname</span>
            <input
              value={form.nickname}
              onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </section>
  );
};
