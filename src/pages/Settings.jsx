/**
 * Settings — Customization Center (admin). Every knob the authority can
 * change without code lives here, backed by GET/PATCH /api/settings.
 * See backend docs/CUSTOMIZATION_ROADMAP.md §2 for the registry pattern.
 */

import { useEffect, useState } from "react";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import { listSettings, updateSetting, listSettingChanges } from "../api/client.js";

function SettingField({ setting, disabled, onSave }) {
  const [draft, setDraft] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  function coerce(raw) {
    if (setting.type === "number") {
      if (raw === "" || raw == null) return raw;
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (setting.type === "boolean") return raw === true || raw === "true";
    return raw;
  }

  async function handleSave() {
    const value = coerce(draft);
    if (setting.type === "number" && (value === "" || value == null || !Number.isFinite(value))) return;
    setSaving(true);
    try {
      await onSave(setting.key, value);
      setDraft(value);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);

  return (
    <div className="tr-setting-row">
      <div className="tr-setting-meta">
        <span className="tr-setting-label">{setting.label}</span>
        <code className="tr-setting-key">{setting.key}</code>
      </div>
      <div className="tr-setting-control">
        {setting.type === "boolean" ? (
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft)}
            aria-label={setting.label}
            className={"p1-mini-btn" + (draft ? " is-active" : "")}
            disabled={disabled || saving}
            onClick={() => setDraft(!draft)}
          >
            {draft ? "On" : "Off"}
          </button>
        ) : (
          <input
            type={setting.type === "number" ? "number" : "text"}
            className="tr-setting-input"
            aria-label={setting.label}
            value={draft ?? ""}
            disabled={disabled || saving}
            onChange={(e) => setDraft(setting.type === "number" ? e.target.valueAsNumber : e.target.value)}
          />
        )}
        <button
          type="button"
          className="p1-mini-btn"
          disabled={disabled || saving || !dirty}
          onClick={handleSave}
        >
          {saving ? "Saving…" : savedTick ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}


const GROUP_TITLES = {
  election: "Election rules",
  uploads: "Upload limits",
  training: "Training",
  notifications: "Notifications",
  portal: "Portal branding & text",
};

export default function Settings() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isMunicipal = path.startsWith("/elections/municipal");
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const [settings, setSettings] = useState([]);
  const [changes, setChanges] = useState([]);
  const [changesVisible, setChangesVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listSettings();
        if (cancelled) return;
        setSettings(data.settings || []);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(key, value) {
    setFormError(null);
    try {
      const data = await updateSetting(key, value);
      setSettings((prev) => prev.map((s) => (s.key === key ? data.setting : s)));
    } catch (e) {
      if (e && e.status === 403) {
        setFormError("Your role cannot edit settings (authority/admin only).");
      } else {
        setFormError(e.message || "Failed to save " + key);
      }
      throw e;
    }
  }

  async function toggleChanges() {
    if (changesVisible) {
      setChangesVisible(false);
      return;
    }
    try {
      const data = await listSettingChanges(20);
      setChanges(data.changes || []);
      setChangesVisible(true);
      setFormError(null);
    } catch (e) {
      if (e && e.status === 403) {
        setFormError("Change history is visible to authority/admin only.");
      } else {
        setFormError(e.message || "Failed to load change history");
      }
    }
  }

  const groups = {};
  for (const s of settings) {
    (groups[s.group] = groups[s.group] || []).push(s);
  }
  const groupNames = Object.keys(groups).sort();

  return (
    <div className="p1-page">
      <div className="page-overlay" />
      <Header />
      <main className="p1-main">
        <div className="tr-back-row">
          <a className="p1-back-btn" href={backHref}>
            ← Back
          </a>
          <h1 className="p1-title">Settings — Customization Center</h1>
        </div>
        <p className="tr-hint">
          Every value here takes effect immediately. Defaults match the
          original behavior — changing nothing keeps everything as it was.
        </p>

        {loading && <div className="tr-empty">Loading settings…</div>}
        {error && (
          <div className="p1-alert p1-alert-error" role="alert">
            {error}
          </div>
        )}
        {formError && (
          <div className="p1-alert p1-alert-error" role="alert">
            {formError}
          </div>
        )}

        {!loading && !error && groupNames.length === 0 && (
          <div className="tr-empty">No settings available for your role.</div>
        )}

        {groupNames.map((g) => (
          <section className="tr-panel" key={g}>
            <div className="tr-panel-head">
              <span className="tr-label">{GROUP_TITLES[g] || g}</span>
            </div>
            {groups[g].map((s) => (
              <SettingField key={s.key} setting={s} disabled={false} onSave={handleSave} />
            ))}
          </section>
        ))}

        <section className="tr-panel">
          <div className="tr-panel-head">
            <span className="tr-label">Change history</span>
            <button type="button" className="p1-mini-btn" onClick={toggleChanges}>
              {changesVisible ? "Hide" : "Show last 20 changes"}
            </button>
          </div>
          {changesVisible && changes.length === 0 && (
            <div className="tr-empty">No changes recorded yet.</div>
          )}
          {changesVisible &&
            changes.map((c, i) => (
              <div className="tr-setting-row" key={(c.key || "") + "-" + i}>
                <div className="tr-setting-meta">
                  <code className="tr-setting-key">{c.key}</code>
                  <span className="tr-hint">
                    {JSON.stringify(c.oldValue)} → {JSON.stringify(c.newValue)}
                  </span>
                </div>
                <span className="tr-hint">
                  {c.changedAt ? new Date(c.changedAt).toLocaleString("en-IN") : "—"}
                </span>
              </div>
            ))}
        </section>
      </main>
    </div>
  );
}
