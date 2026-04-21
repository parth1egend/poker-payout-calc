import { useLiveQuery } from "dexie-react-hooks";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { downloadJson } from "@/lib/browser";
import { db, exportBackup, importBackup, listSettings, resetAllData, saveSettings } from "@/lib/db";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { BackupPayload } from "@/lib/types";

export const SettingsPage = () => {
  const settings = useLiveQuery(() => listSettings(), [], undefined);
  const playersCount = useLiveQuery(() => db.players.count(), [], 0);
  const sessionsCount = useLiveQuery(() => db.sessions.count(), [], 0);
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [threshold, setThreshold] = useState("20");
  const [showIgnored, setShowIgnored] = useState(true);
  const [autoCorrection, setAutoCorrection] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const initialized = useMemo(() => Boolean(settings), [settings]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setCurrencyLabel(settings.currencyLabel);
    setThreshold(String(settings.defaultThresholdMinor));
    setShowIgnored(settings.showIgnoredSmallTransfers);
    setAutoCorrection(settings.autoRunCorrection);
  }, [settings]);

  const persistSettings = async () => {
    if (!settings) {
      return;
    }

    await saveSettings({
      currencyLabel: currencyLabel.trim() || "INR",
      defaultThresholdMinor: parseMoneyInput(threshold || "0", settings.moneyScale),
      showIgnoredSmallTransfers: showIgnored,
      autoRunCorrection: autoCorrection
    });
    setMessage("Settings saved.");
  };

  const handleExport = async () => {
    const backup = await exportBackup();
    downloadJson(`poker-settlement-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
    setMessage("Backup exported.");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const payload = JSON.parse(text) as BackupPayload;
    await importBackup(payload);
    setMessage("Backup restored.");
    event.target.value = "";
  };

  const handleReset = async () => {
    const confirmed = window.confirm("Reset all locally stored poker data on this device?");

    if (!confirmed) {
      return;
    }

    await resetAllData();
    setMessage("All local data was reset.");
  };

  return (
    <section className="stack">
      <article className="hero-card">
        <div>
          <p className="eyebrow">Device settings</p>
          <h2>Backup, restore, and tune the settlement defaults.</h2>
          <p className="muted">Safari on iPhone keeps this data only on this device and only while browser storage is retained.</p>
        </div>
      </article>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Players</span>
          <strong>{playersCount}</strong>
        </article>
        <article className="stat-card">
          <span>Sessions</span>
          <strong>{sessionsCount}</strong>
        </article>
        <article className="stat-card">
          <span>Default threshold</span>
          <strong>{settings ? formatMoney(settings.defaultThresholdMinor, settings.currencyLabel, settings.moneyScale) : "--"}</strong>
        </article>
      </div>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Preferences</p>
            <h3>Settlement defaults</h3>
          </div>
          <button type="button" className="primary-button" onClick={persistSettings} disabled={!initialized}>
            Save settings
          </button>
        </div>
        <div className="stack compact">
          <label className="field">
            <span>Currency label</span>
            <input value={currencyLabel} onChange={(event) => setCurrencyLabel(event.target.value)} />
          </label>
          <label className="field">
            <span>Default threshold</span>
            <input inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={showIgnored} onChange={(event) => setShowIgnored(event.target.checked)} />
            <span>Show ignored small transfers by default</span>
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={autoCorrection} onChange={(event) => setAutoCorrection(event.target.checked)} />
            <span>Apply imbalance correction automatically on the settlement screen</span>
          </label>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Backup</p>
            <h3>Import and export JSON</h3>
          </div>
        </div>
        <div className="stack compact">
          <button type="button" className="primary-button" onClick={handleExport}>
            Export backup JSON
          </button>
          <label className="field">
            <span>Restore from JSON backup</span>
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
          <button type="button" className="ghost-button" onClick={handleReset}>
            Reset local data
          </button>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Install</p>
            <h3>Use it like an app</h3>
          </div>
        </div>
        <div className="stack compact">
          <p className="muted">On iPhone Safari: open Share, then choose Add to Home Screen.</p>
          <p className="muted">For reliability, export a JSON backup before clearing browser data or switching phones.</p>
        </div>
      </article>

      {message ? <p className="banner success">{message}</p> : null}
    </section>
  );
};
