import { useMemo, useState } from "react";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import { PHASE3_STORE_KEY } from "./Phase3.jsx";

/**
 * Training – Time Scheduling (slot allocation for employee training)
 * Data: allocated teams from Phase 3 sessionStorage
 * (`elections:<context>:phase3-result`). Each team: 1 location + time from/to.
 * Submit POSTs to backend which persists slots + sends SMS to employees.
 * Frontend-only change: POST /api/<context>/training/schedule
 *   { slots: [{ ballotId, pollingStation, mandal, presidingOfficer,
 *               pollingOfficer, microOfficer, location, timeFrom, timeTo }] }
 */

const USE_MOCK = false;
const API_BASE = "/api";
const PAGE_SIZE = 10;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h2a2 2 0 0 1 0 4h-.5" />
      <path d="M7 5H5a2 2 0 0 0 0 4h.5" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current]);
  if (current - 1 > 0) set.add(current - 1);
  if (current + 1 <= total) set.add(current + 1);
  if (current <= 3) { set.add(2); set.add(3); set.add(4); }
  if (current >= total - 2) { set.add(total - 1); set.add(total - 2); set.add(total - 3); }
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/** Read the allocated teams saved by Phase 3 (one row = one training team). */
function loadTeams(context) {
  try {
    const raw = sessionStorage.getItem(PHASE3_STORE_KEY(context));
    if (!raw) return { teams: [], hasTeams: false };
    const data = JSON.parse(raw);
    const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
    const teams = rows.map((r, i) => ({
      key: `${pick(r, "ballotId", "ballotID", "ballotNo") ?? i}-${i}`,
      sno: pick(r, "sno", "sNo", "serial", "id") ?? i + 1,
      ballotId: pick(r, "ballotId", "ballotID", "ballotNo", "ballot_no", "ballot") ?? "—",
      pollingStation: pick(r, "psNo", "psNumber", "pollingStation", "ps_no", "unit", "ballotUnit") ?? "—",
      mandal: pick(r, "mandal", "workMandal", "ward", "zone") ?? "—",
      presidingOfficer: pick(r, "presidingOfficer", "presidingOfficerName", "presiding", "poName", "presiding_officer") ?? "—",
      pollingOfficer: pick(r, "pollingOfficer", "pollingOfficerName", "polling_officer", "polling") ?? "—",
      microOfficer: pick(r, "microOfficer", "microOfficerName", "micro_officer") ?? "—",
    }));
    return { teams, hasTeams: teams.length > 0 };
  } catch {
    return { teams: [], hasTeams: false };
  }
}

/** Demo teams so the page is previewable without running Phase 3. */
function mockTeams() {
  const rows = [
    { ballotId: "BAL-001", pollingStation: "PS-121", mandal: "Kakinada", presidingOfficer: "Venkatesh M", pollingOfficer: "Deepika Rani", microOfficer: "Micro-01" },
    { ballotId: "BAL-002", pollingStation: "PS-122", mandal: "Samalkot", presidingOfficer: "G. Nagesh", pollingOfficer: "Jyothi K", microOfficer: "Micro-02" },
    { ballotId: "BAL-003", pollingStation: "PS-123", mandal: "Pithapuram", presidingOfficer: "Sai Krishna", pollingOfficer: "Padma V", microOfficer: "Micro-03" },
    { ballotId: "BAL-004", pollingStation: "PS-124", mandal: "Tuni", presidingOfficer: "Hari Prasad", pollingOfficer: "Rajesh K", microOfficer: "Micro-04" },
    { ballotId: "BAL-005", pollingStation: "PS-125", mandal: "Peddapuram", presidingOfficer: "Suresh Babu", pollingOfficer: "Swapna", microOfficer: "Micro-05" },
  ];
  return rows.map((r, i) => ({ key: `${r.ballotId}-${i}`, sno: i + 1, ...r }));
}

function isValidTimeRange(from, to) {
  if (!from || !to) return false;
  return from < to;
}

function MemberCount({ icon, label, count }) {
  return (
    <div className="p3-officer-pill">
      <span className="p3-officer-pill-icon">{icon}</span>
      <span className="p3-officer-pill-meta">
        <span className="p3-officer-pill-count">{count}</span>
        <span className="p3-officer-pill-label">{label}</span>
      </span>
    </div>
  );
}

function SlotBadge({ slot }) {
  if (!slot?.location && !slot?.timeFrom) {
    return <span className="p1-badge p1-badge-review">Not Scheduled</span>;
  }
  const ok = slot.location?.trim() && isValidTimeRange(slot.timeFrom, slot.timeTo);
  if (!ok) return <span className="p1-badge p1-badge-rejected">Incomplete</span>;
  if (slot.status === "sent" || slot.status === "scheduled" || slot.status === "notified") {
    return (
      <span className="p1-badge p1-badge-approved">
        <CheckIcon /> SMS Sent
      </span>
    );
  }
  if (slot.status === "failed" || slot.status === "error") {
    return (
      <span className="p1-badge p1-badge-rejected">
        <CrossIcon /> Failed
      </span>
    );
  }
  return <span className="p1-badge p2-badge-presiding">Ready</span>;
}

export default function Training({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const source = useMemo(() => {
    const stored = loadTeams(context);
    if (stored.hasTeams) return { ...stored, isDemo: false };
    return { teams: mockTeams(), hasTeams: false, isDemo: true };
  }, [context]);

  const [slots, setSlots] = useState({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");

  function setSlot(teamKey, field, value) {
    setSlots((prev) => ({
      ...prev,
      [teamKey]: { ...(prev[teamKey] ?? { location: "", timeFrom: "", timeTo: "" }), [field]: value },
    }));
    if (status === "done" || status === "error") {
      setStatus("idle");
      setResult(null);
      setErrorMsg("");
    }
  }

  function applyToAll() {
    if (!bulkLocation.trim() && !bulkFrom && !bulkTo) return;
    setSlots((prev) => {
      const next = { ...prev };
      for (const t of source.teams) {
        const cur = next[t.key] ?? { location: "", timeFrom: "", timeTo: "" };
        next[t.key] = {
          ...cur,
          ...(bulkLocation.trim() ? { location: bulkLocation.trim() } : null),
          ...(bulkFrom ? { timeFrom: bulkFrom } : null),
          ...(bulkTo ? { timeTo: bulkTo } : null),
        };
      }
      return next;
    });
  }

  const teams = source.teams;
  const slotOf = (teamKey) => slots[teamKey] ?? { location: "", timeFrom: "", timeTo: "" };
  const scheduledCount = teams.filter((t) => {
    const s = slotOf(t.key);
    return s.location?.trim() && isValidTimeRange(s.timeFrom, s.timeTo);
  }).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      [t.ballotId, t.pollingStation, t.mandal, t.presidingOfficer, t.pollingOfficer, t.microOfficer, slotOf(t.key)?.location]
        .join(" ").toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, query, slots]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);

  function buildPayload() {
    return teams.map((t) => {
      const s = slotOf(t.key);
      return {
        ballotId: t.ballotId,
        pollingStation: t.pollingStation,
        mandal: t.mandal,
        presidingOfficer: t.presidingOfficer,
        pollingOfficer: t.pollingOfficer,
        microOfficer: t.microOfficer,
        location: (s.location ?? "").trim(),
        timeFrom: s.timeFrom ?? "",
        timeTo: s.timeTo ?? "",
      };
    });
  }

  async function allocateSlots() {
    setErrorMsg("");
    setResult(null);
    const payload = buildPayload();
    if (payload.length === 0) {
      setStatus("error");
      setErrorMsg("No teams found. Run Phase 3 (Ballot Allocation) first.");
      return;
    }
    const bad = [];
    payload.forEach((s, i) => {
      if (!s.location) bad.push(`Team ${i + 1} (${s.ballotId}): location required.`);
      else if (!s.timeFrom || !s.timeTo) bad.push(`Team ${i + 1} (${s.ballotId}): time from & to required.`);
      else if (!isValidTimeRange(s.timeFrom, s.timeTo)) bad.push(`Team ${i + 1} (${s.ballotId}): Time To must be after Time From.`);
    });
    if (bad.length > 0) {
      setStatus("error");
      setErrorMsg(bad.slice(0, 4).join(" ") + (bad.length > 4 ? ` (+${bad.length - 4} more)` : ""));
      return;
    }
    setStatus("scheduling");
    try {
      let data;
      if (USE_MOCK) {
        data = await new Promise((res) =>
          setTimeout(() => res({ ok: true, scheduled: payload.length, messagesSent: payload.length * 3 }), 600)
        );
      } else {
        const res = await fetch(`${API_BASE}/${context}/training/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slots: payload }),
        });
        data = await parseJson(res);
        if (!res.ok || (data && data.ok === false)) {
          throw new Error(data?.message || data?.error || `Scheduling failed (${res.status}).`);
        }
      }
      const byId = new Map((data?.results ?? []).map((r) => [String(r.ballotId ?? ""), r]));
      setSlots((prev) => {
        const next = { ...prev };
        for (const t of teams) {
          const r = byId.get(String(t.ballotId));
          next[t.key] = { ...(next[t.key] ?? {}), status: r?.status ?? "sent" };
        }
        return next;
      });
      setResult({ scheduled: data?.scheduled ?? payload.length, messagesSent: data?.messagesSent ?? payload.length });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong while allocating slots.");
    }
  }

  function reset() {
    setSlots({});
    setBulkLocation("");
    setBulkFrom("");
    setBulkTo("");
    setQuery("");
    setPage(1);
    setStatus("idle");
    setErrorMsg("");
    setResult(null);
  }

  const canSubmit = teams.length > 0 && status !== "scheduling";

  return (
    <main className="p1-page p3-page tr-page">
      <div className="page-overlay" />
      <Header />

      <div className="p1-shell">
        <nav className="p1-breadcrumb" aria-label="Breadcrumb">
          <a href="/home" className="p1-crumb-home" aria-label="Home">
            <HomeIcon />
          </a>
          <span className="p1-crumb-sep">/</span>
          <a href={backHref}>{contextLabel}</a>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Training – Time Scheduling</span>
        </nav>

        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon">
              <CalendarIcon />
            </span>
            <div>
              <h1>Training – Time Scheduling</h1>
              <p>
                Allocate training slots to the Phase 3 teams. Enter the <strong>location</strong> and{" "}
                <strong>time (from – to)</strong> for each team, then send the schedule — the backend
                notifies every employee by message.
              </p>
            </div>
          </div>
          <aside className="p1-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Teams are fetched from <strong>Phase 3</strong> (Presiding + Polling + Micro-officer per
              ballot). Fill every row&apos;s venue &amp; time, then click <strong>Allocate Slots</strong>.
            </p>
          </aside>
        </section>

        <section className="p3-officers">
          <div className="p3-officers-head">
            <span className="p3-officers-title">Teams from Phase 3</span>
            {!source.hasTeams && (
              <a className="p3-officers-link" href={`${backHref}/phase-3`}>
                Run Phase 3 first to allocate teams →
              </a>
            )}
          </div>
          <div className="p3-officer-pills">
            <MemberCount icon={<PeopleIcon />} label="Training Teams" count={teams.length} />
            <MemberCount icon={<ClockIcon />} label="Slots Ready" count={scheduledCount} />
            <MemberCount icon={<SendIcon />} label="Pending SMS" count={teams.length * 3} />
          </div>
          {source.isDemo && (
            <p className="p3-officers-warn">
              Showing demo teams — complete Phase 3 (Ballot Allocation) so the real teams appear here.
            </p>
          )}
        </section>

        <section className="tr-bulk">
          <div className="tr-bulk-head">
            <span className="tr-bulk-title">
              <PinIcon /> Quick Fill — apply to all teams
            </span>
          </div>
          <div className="tr-bulk-grid">
            <label className="tr-field">
              <span className="tr-label">Location</span>
              <input
                type="text"
                className="tr-input"
                placeholder="e.g. ZP High School, Kakinada"
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
              />
            </label>
            <label className="tr-field">
              <span className="tr-label">Time From</span>
              <input type="time" className="tr-input" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
            </label>
            <label className="tr-field">
              <span className="tr-label">Time To</span>
              <input type="time" className="tr-input" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
            </label>
            <button type="button" className="tr-apply-btn" onClick={applyToAll}>
              Apply to All
            </button>
          </div>
        </section>

        <section className="p1-result">
          <div className="p1-toolbar">
            <div className="p1-chips">
              <span className="p1-chip p1-chip-all is-active">
                All Teams <b>({teams.length})</b>
              </span>
              <span className="p1-chip p1-chip-approved">
                <CheckIcon /> Ready <b>({scheduledCount})</b>
              </span>
              <span className="p1-chip p1-chip-rejected">
                <CrossIcon /> Pending <b>({teams.length - scheduledCount})</b>
              </span>
            </div>
            <div className="p1-tools">
              <div className="p1-search-wrap">
                <span className="p1-search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  className="p1-search"
                  placeholder="Search team, officer, venue…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
              </div>
              <button type="button" className="p3-reset-btn" onClick={reset} title="Clear all slots">
                Reset
              </button>
            </div>
          </div>

          <div className="p1-stats">
            <div className="p1-stat p1-stat-total">
              <span className="p1-stat-icon"><PeopleIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Total Teams</span>
                <span className="p1-stat-num">{teams.length}</span>
              </div>
            </div>
            <div className="p1-stat p1-stat-ok">
              <span className="p1-stat-icon"><CheckIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Slots Ready</span>
                <span className="p1-stat-num">{scheduledCount}</span>
              </div>
            </div>
            <div className="p1-stat p1-stat-review">
              <span className="p1-stat-icon"><ClockIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Pending</span>
                <span className="p1-stat-num">{teams.length - scheduledCount}</span>
              </div>
            </div>
          </div>

          {status === "error" && (
            <div className="p1-alert p1-alert-error" role="alert">
              <span className="p1-alert-icon">
                <CrossIcon />
              </span>
              <div>{errorMsg}</div>
            </div>
          )}

          {status === "done" && result && (
            <div className="p1-alert p1-alert-success" role="status">
              <span className="p1-alert-icon">
                <CheckIcon />
              </span>
              <div>
                Slots allocated for <strong>{result.scheduled}</strong> team(s) —{" "}
                <strong>{result.messagesSent}</strong> message(s) sent to employees by the backend.
              </div>
            </div>
          )}

          <div className="p1-table-wrap">
            <table className="p1-table tr-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Team (Ballot)</th>
                  <th>Polling Station</th>
                  <th>Members</th>
                  <th>Location</th>
                  <th>Time From</th>
                  <th>Time To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p1-empty">
                      {teams.length === 0 ? "No teams found. Run Phase 3 first." : "No matching teams."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((t) => {
                    const s = slotOf(t.key);
                    return (
                      <tr key={t.key}>
                        <td>{t.sno}</td>
                        <td className="p1-mono">{t.ballotId}</td>
                        <td className="p1-strong">{t.pollingStation}</td>
                        <td className="tr-members">
                          <span className="p3-role presiding">
                            <TrophyIcon /> {t.presidingOfficer}
                          </span>
                          <span className="p3-role polling">
                            <BadgeIcon /> {t.pollingOfficer}
                          </span>
                          <span className="tr-micro">{t.microOfficer}</span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="tr-input tr-cell-input"
                            placeholder="Training venue…"
                            value={s.location ?? ""}
                            onChange={(e) => setSlot(t.key, "location", e.target.value)}
                            aria-label={`Training location for team ${t.ballotId}`}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="tr-input tr-cell-input"
                            value={s.timeFrom ?? ""}
                            onChange={(e) => setSlot(t.key, "timeFrom", e.target.value)}
                            aria-label={`Training start time for team ${t.ballotId}`}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="tr-input tr-cell-input"
                            value={s.timeTo ?? ""}
                            onChange={(e) => setSlot(t.key, "timeTo", e.target.value)}
                            aria-label={`Training end time for team ${t.ballotId}`}
                          />
                        </td>
                        <td><SlotBadge slot={s} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p1-pagination">
            <span className="p1-page-info">
              Showing {start} to {end} of {filtered.length} teams
            </span>
            <div className="p1-pages">
              <button
                type="button"
                className="p1-page-btn p1-page-nav"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </button>
              {pages.map((p, idx) =>
                p === "…" ? (
                  <span key={`dots-${idx}`} className="p1-page-dots">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`p1-page-btn${p === safePage ? " is-active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className="p1-page-btn p1-page-nav"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount}
                aria-label="Next page"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </section>

        <div className="p3-allocate-row">
          <button type="button" className="p3-allocate-btn" onClick={allocateSlots} disabled={!canSubmit}>
            {status === "scheduling" ? (
              <>Allocating Slots…</>
            ) : (
              <>
                <SendIcon /> Allocate Slots &amp; Notify Employees
              </>
            )}
          </button>
          <span className="tr-hint">
            {scheduledCount}/{teams.length} slots ready — the backend sends SMS to all 3 members of each team.
          </span>
        </div>
      </div>
    </main>
  );
}
