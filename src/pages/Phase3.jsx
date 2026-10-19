import { useEffect, useMemo, useRef, useState } from "react";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search, upload cards…)
import "./Phase3.css"; // Phase 3 specifics (allocate button, allocation badges, slot table)
import Header from "../components/Header.jsx";
import { allocateBallots, allocationReport, sendTeamNotification } from "../api/client.js";

/**
 * Phase 3 – Ballot Allocation
 * ---------------------------
 * ONE file is uploaded here: the Ballot register. The Presiding / Polling
 * officers produced by Phase 2 are pulled from sessionStorage. On clicking
 * "Allocate", the ballot file + the officer lists are POSTed to the backend,
 * which applies the allocation rules (which officer gets which ballot) and
 * returns the allocated list. This page only renders that backend response.
 *
 * Micro-officers live on Phase 2 / Training (not here).
 *
 * Expected backend response:
 *   {
 *     summary: { totalBallots, allocated, presidingCount, pollingCount },
 *     rows: [
 *       { ballotId, ballotUnit/psNo, presidingOfficer, pollingOfficer,
 *         mandal, status, remarks }, ...
 *     ]
 *   }
 *
 * USE_MOCK = true previews the UI with fabricated data (no backend required).
 */

const USE_MOCK = false;
const ACCEPTED = [".xlsx", ".xls", ".csv"];
const PAGE_SIZE = 10;
const PHASE2_STORE_KEY = (context) => `elections:${context}:phase2-partition`;
/** Last allocation snapshot — restored on reload/remount (no re-allocate needed). */
export const PHASE3_STORE_KEY = (context) => `elections:${context}:phase3-result`;

/* ------------------------------- icons -------------------------------- */

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
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

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.39 18.39A2 2 0 0 0 22 16.5a2 2 0 0 0-2-2h-1.26A8 8 0 1 0 4 12.75" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.5a5 5 0 0 0 7.07 7.07L14 18.07" />
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

/* ------------------------------- helpers ------------------------------ */

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusKey(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("reject") || s.includes("unassign") || s.includes("pend")) return "rejected";
  if (s.includes("approve") || s.includes("allocat") || s.includes("eligib") || s.includes("valid")) return "approved";
  return "review";
}

/** Map a backend row onto the allocation table (tolerant of casing/keys). */
function normalizeRow(raw) {
  const statusRaw = pick(raw, "status", "allocationStatus", "result") || "Allocated";
  return {
    sno: pick(raw, "sno", "sNo", "srNo", "sl", "serial", "id") ?? "—",
    ballotId: pick(raw, "ballotId", "ballotID", "ballotNo", "ballot_no", "ballot") ?? "—",
    psNo: pick(raw, "psNo", "psNumber", "pollingStation", "ps_no", "unit", "ballotUnit") ?? "—",
    presidingOfficer: pick(raw, "presidingOfficer", "presidingOfficerName", "presiding", "poName", "presiding_officer") ?? "—",
    pollingOfficer: pick(raw, "pollingOfficer", "pollingOfficerName", "polling_officer", "polling") ?? "—",
    mandal: pick(raw, "mandal", "workMandal", "ward", "wardMandal", "zone") ?? "—",
    status: statusRaw,
    remarks: pick(raw, "remarks", "remark", "note", "reason") ?? "",
    _statusKey: statusKey(statusRaw),
  };
}

function normalizeSummary(data, rows) {
  const sum = data?.summary ?? {};
  const approved = num(sum.allocated, rows.filter((r) => r._statusKey === "approved").length);
  return {
    totalBallots: num(sum.totalBallots, rows.length),
    allocated: approved,
    presidingCount: num(sum.presidingCount, new Set(rows.map((r) => r.presidingOfficer).filter((v) => v && v !== "—")).size),
    pollingCount: num(sum.pollingCount, new Set(rows.map((r) => r.pollingOfficer).filter((v) => v && v !== "—")).size),
  };
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

/** Team-role groups shown below the Phase 3 allocation table.
 * New formation: 1 PO (Presiding Officer), 1 APO (Assistant Polling Officer,
 * non-gazetted School Assistant), 4 OPOs (Other / normal Polling Officers).
 * MO and any unassigned officer are not assigned here. APO is displayed
 * distinctly from OPO ("normal polling officer").
 */
const PO_ROLES = new Set(["Presiding Officer"]);
const APO_ROLES = new Set(["APO", "Assistant Polling Officer"]);
const OPO_ROLES = new Set(["OPO", "Other Polling Officer", "Polling Officer"]);

/** Treat "na" / empty / unknown roles as unassigned — never force them into APO or OPO. */
function isNaRole(role) {
  const r = (role || "").toString().trim().toLowerCase();
  return r === "" || r === "na" || r === "n/a" || r === "null" || r === "undefined";
}

/** Read the officers saved by Phase 2 for the Phase 3 allocation page. */
function loadOfficers(context) {
  try {
    const raw = sessionStorage.getItem(PHASE2_STORE_KEY(context));
    if (!raw)
      return { presiding: [], polling: [], apo: [], opo: [], na: [], hasOfficers: false };
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows))
      return { presiding: [], polling: [], apo: [], opo: [], na: [], hasOfficers: false };
    const roleOf = (r) => String(r.role || "").trim();
    const presiding = rows.filter((r) => PO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
    const apo = rows.filter((r) => APO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
    // OPO = normal/other polling officers (distinct from APO).
    const opo = rows.filter((r) => OPO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
    const na = rows.filter((r) => isNaRole(roleOf(r))).map((r) => r.employeeName);
    // polling = every polling officer (APO + OPO) kept for the Phase 3 allocation API.
    const polling = [...apo, ...opo];
    return {
      presiding,
      polling,
      apo,
      opo,
      na,
      hasOfficers: presiding.length + polling.length > 0,
    };
  } catch {
    return { presiding: [], polling: [], apo: [], opo: [], na: [], hasOfficers: false };
  }
}

/** Build demo allocation data so the page is previewable without a backend. */
function mockAllocate() {
  const presidingPool = ["Venkatesh M", "G. Nagesh", "Sai Krishna", "Hari Prasad", "Suresh Babu"];
  const pollingPool = ["Deepika Rani", "Jyothi K", "Padma V", "Rajesh K", "Swapna", "Krishna M", "Mahesh B", "Sunitha"];
  const mandals = ["Kakinada", "Samalkot", "Pithapuram", "Tuni", "Peddapuram"];
  const rows = [];
  const total = 24;
  for (let i = 1; i <= total; i++) {
    rows.push({
      sno: i,
      ballotId: `BAL-${String(i).padStart(3, "0")}`,
      psNo: `PS-${120 + i}`,
      presidingOfficer: presidingPool[i % presidingPool.length],
      pollingOfficer: pollingPool[i % pollingPool.length],
      mandal: mandals[i % mandals.length],
      status: "Allocated",
      remarks: "",
    });
  }
  const summary = {
    totalBallots: total,
    allocated: total,
    presidingCount: new Set(rows.map((r) => r.presidingOfficer)).size,
    pollingCount: new Set(rows.map((r) => r.pollingOfficer)).size,
  };
  return { summary, rows };
}


/* ---------------------------- sub-components -------------------------- */

function StatusBadge({ row }) {
  if (row._statusKey === "approved") {
    return (
      <span className="p1-badge p1-badge-approved">
        <CheckIcon /> {row.status}
      </span>
    );
  }
  if (row._statusKey === "rejected") {
    return (
      <span className="p1-badge p1-badge-rejected">
        <CrossIcon /> {row.status}
      </span>
    );
  }
  return (
    <span className="p1-badge p1-badge-review">
      {row.status}
    </span>
  );
}

/** A compact officer-count chip used in the "from Phase 2" summary strip. */
function OfficerCount({ icon, label, count, tone }) {
  return (
    <div className={`p3-officer-pill ${tone}`}>
      <span className="p3-officer-pill-icon">{icon}</span>
      <span className="p3-officer-pill-meta">
        <span className="p3-officer-pill-count">{count}</span>
        <span className="p3-officer-pill-label">{label}</span>
      </span>
    </div>
  );
}


/* ------------------------------- page --------------------------------- */

export default function Phase3({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  // Presiding / Polling officers from Phase 2.
  const officers = useMemo(() => loadOfficers(context), [context]);

  // Duty allocation (Stage 2 teams -> Stage 3 station allotment) from the last
  // run — verification view. Loaded once; the send button posts per team.
  const [duty, setDuty] = useState(null); // { runAt, stage2, stage3, counts }
  const [dutyError, setDutyError] = useState("");
  const [sendState, setSendState] = useState({}); // teamCode -> { pending, msg, tone }

  useEffect(() => {
    let cancelled = false;
    allocationReport()
      .then((data) => {
        if (!cancelled) setDuty(data);
      })
      .catch((e) => {
        if (!cancelled) setDutyError(e.message || "Failed to load duty allocation");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One row per Stage-2 team with its Stage-3 station joined by teamCode.
  // Members carry the full officer allocation profile (employee ID, designation,
  // MO flag, venue/ballot code + duty mandal from the frozen roster).
  const dutyRows = useMemo(() => {
    const parties = duty?.stage2?.parties || [];
    const assigns = duty?.stage3?.assignments || [];
    const byTeam = new Map(assigns.map((a) => [a.teamCode, a]));
    return parties.map((p) => {
      const members = (p.members || [])
        .map((m) => ({
          employeeId: m.employeeId ?? m.employee_id ?? m.personnelId ?? null,
          name: m.name,
          role: m.role,
          designation: m.designation,
          isMicroObserver: !!m.isMicroObserver,
          venueCode: m.venueCode ?? m.venue_code ?? null,
          dutyMandal: m.dutyMandal ?? m.duty_mandal ?? null,
        }))
        .filter((m) => m.name || m.employeeId);
      return { ...p, members, assignment: byTeam.get(p.teamCode) || null };
    });
  }, [duty]);

  async function onSendNotification(teamCode, memberCount) {
    const confirmed = window.confirm(
      `Send the duty notification for team ${teamCode} to ${memberCount} member(s) via the configured channels (SMS / WhatsApp)?`
    );
    if (!confirmed) return;
    setSendState((s) => ({ ...s, [teamCode]: { pending: true, msg: "" } }));
    try {
      const res = await sendTeamNotification(teamCode);
      const sum = res.summary || {};
      const by = sum.byChannel || {};
      const bits = [];
      for (const ch of ["sms", "whatsapp"]) {
        if (!by[ch]) continue;
        const c = by[ch];
        let bit = `${ch.toUpperCase()}: ${c.delivered || 0} delivered`;
        if (c.failed) bit += `, ${c.failed} failed`;
        if (c.unavailable) bit += `, ${c.unavailable} unavailable`;
        bits.push(bit);
      }
      setSendState((s) => ({
        ...s,
        [teamCode]: {
          pending: false,
          msg: bits.join(" · ") || `Sent ${sum.sent || 0} message(s)`,
          tone: (sum.failed || 0) > 0 ? "warn" : "ok",
        },
      }));
    } catch (e) {
      setSendState((s) => ({
        ...s,
        [teamCode]: { pending: false, msg: e.message || "Send failed", tone: "warn" },
      }));
    }
  }

  // Single upload slot: ballot register only.
  const [ballotFile, setBallotFile] = useState(null);
  const ballotInputRef = useRef(null);
  const [ballotDrag, setBallotDrag] = useState(false);

  const [status, setStatus] = useState("idle"); // idle | allocating | done | error
  const [errorMsg, setErrorMsg] = useState("");
  // Restore last allocation (also feeds the Training page) on reload/remount.
  const [result, setResult] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PHASE3_STORE_KEY(context));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data?.rows) && data.rows.length > 0) {
        return { summary: data.summary, rows: data.rows };
      }
      return null;
    } catch {
      return null;
    }
  }); // { summary, rows }

  const [statusFilter, setStatusFilter] = useState("all"); // all | allocated | rejected
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  function validateAndSet(next, setter) {
    if (!next) return;
    const ok = ACCEPTED.some((ext) => next.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setStatus("error");
      setErrorMsg("Unsupported file type. Please upload an .xlsx, .xls or .csv file.");
      return;
    }
    setter(next);
    setErrorMsg("");
    if (status === "error") setStatus("idle");
  }

  function onBallotPick(e) { validateAndSet(e.target.files?.[0], setBallotFile); }
  function onBallotDrop(e) { e.preventDefault(); setBallotDrag(false); validateAndSet(e.dataTransfer.files?.[0], setBallotFile); }

  function clearBallot() {
    setBallotFile(null);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
  }

  function reset() {
    setBallotFile(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setQuery("");
    setStatusFilter("all");
    setPage(1);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
  }

  async function allocate() {
    if (!ballotFile) {
      setStatus("error");
      setErrorMsg("Please upload the Ballot Excel file first.");
      return;
    }
    // Fail closed: no Phase-2 officers means every ballot would be
    // "Unassigned" — say so instead of uploading and rendering noise.
    if (!officers.hasOfficers) {
      setStatus("error");
      setErrorMsg("No Presiding/Polling officers found from Phase 2 — complete Phase 2 (Form Teams) first.");
      return;
    }
    setStatus("allocating");
    setErrorMsg("");
    try {
      let data;
      if (USE_MOCK) {
        data = await new Promise((res) => setTimeout(() => res(mockAllocate()), 500));
      } else {
        // Real backend: base64-JSON via the shared client (credentials ride
        // along). POST /api/randomization/ballot-allocation parses the
        // register and allocates the Phase-2 officers to ballots.
        data = await allocateBallots({
          file: ballotFile,
          presidingOfficers: officers.presiding,
          pollingOfficers: officers.polling,
        });
      }
      const rows = (Array.isArray(data?.rows) ? data.rows : []).map(normalizeRow);
      const summary = normalizeSummary(data, rows);
      setResult({ summary, rows });
      try {
        sessionStorage.setItem(PHASE3_STORE_KEY(context), JSON.stringify({ summary, rows, savedAt: Date.now() }));
      } catch {
        /* storage may be unavailable */
      }
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong during allocation.");
    }
  }

  /** Continue to the Training page (assign venues / generate training orders). */
  const goToTraining = () => {
    if (!result || status === "allocating") return;
    window.location.href = `${backHref}/training`;
  };

  /** Print ID cards for the currently allocated officers. */
  const generateIdCard = () => {
    if (!result || status === "allocating") return;
    const rows = (result.rows || []).filter((r) => r._statusKey === "approved");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>ID Cards - ${contextLabel}</title>
      <style>
        body{font-family:sans-serif;padding:20px;color:#111}
        h1{font-size:18px;margin-bottom:16px;border-bottom:2px solid #1a3c5a;padding-bottom:6px}
        .sheet{display:flex;flex-wrap:wrap;gap:14px}
        .card{border:2px solid #1a3c5a;border-radius:8px;padding:10px 12px;width:250px;box-sizing:border-box;background:#fff}
        .card h2{font-size:14px;margin:0 0 4px 0;color:#1a3c5a}
        .card p{font-size:12px;margin:2px 0}
        .tag{font-size:10px;letter-spacing:1px;color:#666;text-transform:uppercase;margin-bottom:6px}
        @media print{body{padding:0} .card{break-inside:avoid}}
      </style></head><body>
      <h1>Polling Officer ID Cards — ${contextLabel}</h1>
      <div class="sheet">
      ${rows
        .map(
          (r) => `
        <div class="card">
          <div class="tag">Polling Duty ID</div>
          <h2>${escapeHtml(r.ballotId || "")}</h2>
          <p><strong>Presiding:</strong> ${escapeHtml(r.presidingOfficer || "—")}</p>
          <p><strong>Polling:</strong> ${escapeHtml(r.pollingOfficer || "—")}</p>
          <p><strong>Mandal:</strong> ${escapeHtml(r.mandal || "—")}</p>
          <p><strong>Station:</strong> ${escapeHtml(r.psNo || "—")}</p>
          <p><strong>Status:</strong> ${escapeHtml(r.status || "Allocated")}</p>
        </div>`
        )
        .join("")}
      </div>
      <p style="margin-top:16px;font-size:12px;color:#666">Generated ${rows.length} card(s). Use browser Print (Ctrl+P) and save as PDF.</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const rows = useMemo(() => result?.rows ?? [], [result]);
  const summary = result?.summary ?? { totalBallots: 0, allocated: 0, presidingCount: 0, pollingCount: 0 };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r._statusKey === (statusFilter === "allocated" ? "approved" : "rejected"));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.ballotId, r.psNo, r.presidingOfficer, r.pollingOfficer, r.mandal]
          .join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);

  const allocatedCount = rows.filter((r) => r._statusKey === "approved").length;
  const pendingCount = rows.length - allocatedCount;
  const canAllocate = !!ballotFile && status !== "allocating";


  return (
    <main className="p1-page p3-page">
      <div className="page-overlay" />
      <Header />

      <div className="p1-shell">
        {/* breadcrumb */}
        <nav className="p1-breadcrumb" aria-label="Breadcrumb">
          <a href="/home" className="p1-crumb-home" aria-label="Home">
            <HomeIcon />
          </a>
          <span className="p1-crumb-sep">/</span>
          <a href={backHref}>{contextLabel}</a>
          <span className="p1-crumb-sep">/</span>
          <span>Phase 3</span>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Ballot Allocation</span>
        </nav>

        {/* title + info box */}
        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon">
              <LinkIcon />
            </span>
            <div>
              <h1>Phase 3 – Ballot Allocation</h1>
              <p>
                Upload the Ballot register, then allocate ballots to the
                Presiding and Polling officers using the backend allocation rules.
              </p>
            </div>
          </div>
          <aside className="p1-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Presiding &amp; Polling officers are pulled from <strong>Phase 2</strong>. Upload the
              ballot file and click <strong>Allocate Ballots</strong> — the backend assigns each ballot to
              an officer per the rules, and the result is shown below.
            </p>
          </aside>
        </section>

        {/* officers from Phase 2 */}
        <section className="p3-officers">
          <div className="p3-officers-head">
            <span className="p3-officers-title">Officers from Phase 2</span>
            {!officers.hasOfficers && (
              <a className="p3-officers-link" href={`${backHref}/phase-2`}>
                Run Phase 2 first to assign officers →
              </a>
            )}
          </div>
          <div className="p3-officer-pills">
            <OfficerCount tone="p3-tone-presiding" icon={<TrophyIcon />} label="Presiding Officers" count={officers.presiding.length} />
            <OfficerCount tone="p3-tone-apo" icon={<TrophyIcon />} label="APO Officers" count={officers.apo.length} />
            <OfficerCount tone="p3-tone-polling" icon={<BadgeIcon />} label="Polling Officers" count={officers.polling.length} />
          </div>
          {!officers.hasOfficers && (
            <p className="p3-officers-warn">
              No Presiding/APO/Polling officers found. Complete Phase 2 so the backend has officers to
              allocate to — though you may still upload files and allocate.
            </p>
          )}
        </section>

        {/* single upload: ballot register only */}
        <section className="p3-upload-grid p3-upload-single">
          {/* Ballot upload */}
          <div className="p1-upload-card p3-upload-card">
            <h2 className="p1-card-title">
              <span className="p1-card-title-icon">
                <DocIcon />
              </span>
              Upload Ballot Excel File
            </h2>
            <div
              className={`p1-drop${ballotDrag ? " is-drag" : ""}`}
              onClick={() => ballotInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setBallotDrag(true); }}
              onDragOver={(e) => { e.preventDefault(); setBallotDrag(true); }}
              onDragLeave={() => setBallotDrag(false)}
              onDrop={onBallotDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ballotInputRef.current?.click(); }}
            >
              <span className="p1-drop-icon">
                <CloudUpIcon />
              </span>
              <strong>Drag &amp; drop the Ballot file here</strong>
              <span className="p1-drop-or">or</span>
              <button type="button" className="p1-browse" onClick={(e) => { e.stopPropagation(); ballotInputRef.current?.click(); }}>
                Browse Files
              </button>
              <span className="p1-drop-hint">Supported format: .xlsx&nbsp;&nbsp;|&nbsp;&nbsp;Max file size: 10 MB</span>
              <input ref={ballotInputRef} type="file" accept={ACCEPTED.join(",")} onChange={onBallotPick} hidden />
            </div>
            {ballotFile && (
              <div className="p1-filechip">
                <span className="p1-filechip-icon"><DocIcon /></span>
                <span className="p1-filechip-name">{ballotFile.name}</span>
                <span className="p1-filechip-size">{(ballotFile.size / 1024).toFixed(1)} KB</span>
                <button type="button" className="p1-filechip-clear" onClick={clearBallot} aria-label="Remove file">×</button>
              </div>
            )}
          </div>
        </section>

        {/* allocate action */}
        <section className="p3-allocate-row">
          <button type="button" className="p3-allocate-btn" onClick={allocate} disabled={!canAllocate}>
            {status === "allocating" ? (
              <span className="p1-spinner" aria-hidden="true" />
            ) : (
              <LinkIcon />
            )}
            {status === "allocating" ? "Allocating…" : "Allocate Ballots"}
          </button>
          <p className="p1-validate-note">
            <span className="p1-validate-note-icon">
              <InfoIcon />
            </span>
            Upload the ballot file, then click <strong>Allocate Ballots</strong>. The backend applies the
            allocation rules and returns the assigned list, shown below.
          </p>
        </section>


        {status === "error" && (
          <div className="p1-alert p1-alert-error" role="alert">
            <span className="p1-alert-icon">
              <CrossIcon />
            </span>
            <div>{errorMsg}</div>
          </div>
        )}

        {/* results */}
        {result && (
          <section className="p1-result">
            {/* toolbar */}
            <div className="p1-toolbar">
              <div className="p1-chips">
                <button
                  type="button"
                  className={`p1-chip p1-chip-all${statusFilter === "all" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("all"); setPage(1); }}
                >
                  All Ballots <b>({summary.totalBallots})</b>
                </button>
                <button
                  type="button"
                  className={`p1-chip p1-chip-approved${statusFilter === "allocated" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("allocated"); setPage(1); }}
                >
                  <CheckIcon /> Allocated <b>({allocatedCount})</b>
                </button>
                <button
                  type="button"
                  className={`p1-chip p1-chip-rejected${statusFilter === "pending" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("pending"); setPage(1); }}
                >
                  <CrossIcon /> Pending <b>({pendingCount})</b>
                </button>
              </div>

              <div className="p1-tools">
                <div className="p1-search-wrap">
                  <span className="p1-search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    className="p1-search"
                    placeholder="Search ballot, officer…"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  />
                </div>
                <button type="button" className="p3-reset-btn" onClick={reset} title="Clear and start over">
                  Reset
                </button>
              </div>
            </div>

            {/* stats */}
            <div className="p1-stats">
              <div className="p1-stat p1-stat-total">
                <span className="p1-stat-icon"><DocIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Total Ballots</span>
                  <span className="p1-stat-num">{summary.totalBallots}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-ok">
                <span className="p1-stat-icon"><CheckIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Allocated</span>
                  <span className="p1-stat-num">{summary.allocated}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-ok">
                <span className="p1-stat-icon"><TrophyIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Presiding Used</span>
                  <span className="p1-stat-num">{summary.presidingCount}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-review">
                <span className="p1-stat-icon"><BadgeIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Polling Used</span>
                  <span className="p1-stat-num">{summary.pollingCount}</span>
                </div>
              </div>
            </div>

            {/* post-allocation actions: continue to training / generate ID cards */}
            <div className="p3-next-actions">
              <button
                type="button"
                className="p3-next-btn"
                onClick={goToTraining}
                disabled={!result || status === "allocating"}
              >
                <LinkIcon />
                {" "}
                Continue to Training
              </button>
              <button
                type="button"
                className="p3-idcard-btn"
                onClick={generateIdCard}
                disabled={!result || status === "allocating"}
              >
                <DocIcon />
                {" "}
                Generate ID Card
              </button>
              {result && status === "done" && (
                <span className="p3-next-note">
                  Allocation saved — proceed to training to assign venues and generate orders.
                </span>
              )}
            </div>


            {/* table */}
            <div className="p1-table-wrap">
              <table className="p1-table p3-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Ballot ID</th>
                    <th>Polling Station</th>
                    <th>Presiding Officer</th>
                    <th>Polling Officer</th>
                    <th>Mandal</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p1-empty">No matching records.</td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={`${r.ballotId}-${r.psNo}`}>
                        <td>{r.sno}</td>
                        <td className="p1-mono">{r.ballotId}</td>
                        <td className="p1-strong">{r.psNo}</td>
                        <td>
                          <span className="p3-role presiding">
                            <TrophyIcon /> {r.presidingOfficer}
                          </span>
                        </td>
                        <td>
                          <span className="p3-role polling">
                            <BadgeIcon /> {r.pollingOfficer}
                          </span>
                        </td>
                        <td>{r.mandal}</td>
                        <td><StatusBadge row={r} /></td>
                        <td className="p1-remarks">{r.remarks || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="p1-pagination">
              <span className="p1-page-info">
                Showing {start} to {end} of {filtered.length} records
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
            {/* Team data – officers from Phase 2, shown below the allocation table after clicking Allocate */}
            <div className="p3-officers">
              <div className="p3-officers-head">
                <span className="p3-officers-title">Team Data – Officers from Phase 2</span>
              </div>
              <div className="p3-officer-pills">
                <OfficerCount
                  tone="p3-tone-presiding"
                  icon={<TrophyIcon />}
                  label="PO (Presiding Officers)"
                  count={officers.presiding.length}
                />
                <OfficerCount
                  tone="p3-tone-apo"
                  icon={<BadgeIcon />}
                  label="APO Officers"
                  count={officers.apo.length}
                />
                <OfficerCount
                  tone="p3-tone-opo"
                  icon={<PeopleIcon />}
                  label="OPO Officers"
                  count={officers.opo.length}
                />
                {officers.na.length > 0 && (
                  <OfficerCount
                    tone="p3-tone-na"
                    icon={<CrossIcon />}
                    label="NA / Unassigned"
                    count={officers.na.length}
                  />
                )}
              </div>
              {officers.presiding.length === 0 && officers.apo.length === 0 && officers.opo.length === 0 && (
                <p className="p3-officers-warn">
                  No PO/APO/OPO officers found. Complete Phase 2 so the backend has officers to allocate to.
                </p>
              )}
            </div>
          </section>
        )}
          {/* Duty allocation (Stage 2 -> Stage 3): team data shown below the
               results table, only after Allocate has run. */}
          {status === "done" && duty && dutyRows.length > 0 && (
            <section className="p3-duty">
              <div className="p3-officers-head">
                <span className="p3-officers-title">Duty Allocation (Stage 2 → Stage 3)</span>
                {duty?.runAt && (
                  <span className="p3-officer-pill-label">
                    Last run: {new Date(duty.runAt).toLocaleString("en-IN")}
                    {duty.stage3?.status ? ` · Stage 3: ${duty.stage3.status}` : ""}
                    {duty.stage3?.publicationStatus ? ` · ${duty.stage3.publicationStatus}` : ""}
                  </span>
                )}
              </div>
              {dutyError && <div className="p1-note">⚠ {dutyError}</div>}
              <div className="p1-table-wrap">
                <table className="p1-table p3-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Ballot ID</th>
                      <th>Posting Mandal</th>
                      <th>Station (Stage 3)</th>
                      <th>Station Mandal</th>
                      <th>Members (name — role)</th>
                      <th>Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dutyRows.map((r) => {
                      const st = sendState[r.teamCode] || {};
                      return (
                        <tr key={r.teamCode}>
                          <td className="p1-strong p1-mono">{r.teamCode}</td>
                          <td className="p1-mono">
                            {r.assignment?.stationId || r.assignment?.ballotId || r.assignment?.venueCode || "—"}
                            {!r.assignment && <span className="p1-remarks"> (not allotted)</span>}
                          </td>
                          <td>{r.postingMandal || "—"}</td>
                          <td className="p1-mono">
                            {r.assignment?.stationCode || r.assignment?.stationId || "—"}
                          </td>
                          <td>{r.assignment?.stationMandal || "—"}</td>
                          <td>
                            {(r.members || []).map((m, i) => (
                              <div key={`${r.teamCode}-${i}`} className="p1-officer-row">
                                <span className="p1-mono">{m.employeeId || "—"}</span>
                                <span className="p1-strong">{m.name || "—"}</span>
                                <span className="p1-remarks">— {m.role}</span>
                                {m.isMicroObserver ? " (MO)" : ""}
                                {m.designation ? <span className="p1-remarks">— {m.designation}</span> : ""}
                              </div>
                            ))}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="p1-mini-btn"
                              disabled={st.pending}
                              onClick={() => onSendNotification(r.teamCode, (r.members || []).length)}
                            >
                              {st.pending ? "Sending…" : "Send notification"}
                            </button>
                            {st.msg && (
                              <div className="p1-note">
                                {st.tone === "warn" ? "⚠ " : ""}
                                {st.msg}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
      </div>
    </main>
  );
}

