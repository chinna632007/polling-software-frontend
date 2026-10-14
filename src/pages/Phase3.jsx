import { useMemo, useRef, useState } from "react";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search, upload cards…)
import "./Phase3.css"; // Phase 3 specifics (allocate button, allocation badges, dual upload accent)
import Header from "../components/Header.jsx";

/**
 * Phase 3 – Ballot Allocation
 * ---------------------------
 * Two Excel files are uploaded: the Ballot register and the Micro-officer list.
 * The Presiding / Polling officers produced by Phase 2 are pulled from
 * sessionStorage. On clicking "Allocate", both files + the officer lists are
 * POSTed to the backend, which applies the allocation rules (which officer gets
 * which ballot / micro-officer) and returns the allocated list. This page only
 * renders that backend response.
 *
 * Expected backend response:
 *   {
 *     summary: { totalBallots, allocated, presidingCount, pollingCount, microOfficers },
 *     rows: [
 *       { ballotId, ballotUnit/psNo, presidingOfficer, pollingOfficer,
 *         microOfficer, mandal, status, remarks }, ...
 *     ]
 *   }
 *
 * USE_MOCK = true previews the UI with fabricated data (no backend required).
 */

const USE_MOCK = false;
const API_BASE = "/api";
const ACCEPTED = [".xlsx", ".xls", ".csv"];
const PAGE_SIZE = 10;
const PHASE2_STORE_KEY = (context) => `elections:${context}:phase2-partition`;

/* ------------------------------- icons -------------------------------- */

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

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
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
    microOfficer: pick(raw, "microOfficer", "microOfficerName", "micro_officer", "microOfficerId") ?? "—",
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
    microOfficers: num(sum.microOfficers, new Set(rows.map((r) => r.microOfficer).filter((v) => v && v !== "—")).size),
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

/** Read the Presiding / Polling officers saved by Phase 2. */
function loadOfficers(context) {
  try {
    const raw = sessionStorage.getItem(PHASE2_STORE_KEY(context));
    if (!raw) return { presiding: [], polling: [], hasOfficers: false };
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return { presiding: [], polling: [], hasOfficers: false };
    const presiding = rows.filter((r) => r.role === "Presiding Officer").map((r) => r.employeeName);
    const polling = rows.filter((r) => r.role === "Polling Officer").map((r) => r.employeeName);
    return { presiding, polling, hasOfficers: presiding.length + polling.length > 0 };
  } catch {
    return { presiding: [], polling: [], hasOfficers: false };
  }
}

/** Build demo allocation data so the page is previewable without a backend. */
function mockAllocate() {
  const presidingPool = ["Venkatesh M", "G. Nagesh", "Sai Krishna", "Hari Prasad", "Suresh Babu"];
  const pollingPool = ["Deepika Rani", "Jyothi K", "Padma V", "Rajesh K", "Swapna", "Krishna M", "Mahesh B", "Sunitha"];
  const microPool = ["Micro-01 (App)", "Micro-02 (App)", "Micro-03 (App)", "Micro-04 (Web)", "Micro-05 (Web)"];
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
      microOfficer: microPool[i % microPool.length],
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
    microOfficers: new Set(rows.map((r) => r.microOfficer)).size,
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

  // Two upload slots.
  const [ballotFile, setBallotFile] = useState(null);
  const [microFile, setMicroFile] = useState(null);
  const ballotInputRef = useRef(null);
  const microInputRef = useRef(null);
  const [ballotDrag, setBallotDrag] = useState(false);
  const [microDrag, setMicroDrag] = useState(false);

  const [status, setStatus] = useState("idle"); // idle | allocating | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null); // { summary, rows }

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
  function onMicroPick(e) { validateAndSet(e.target.files?.[0], setMicroFile); }
  function onBallotDrop(e) { e.preventDefault(); setBallotDrag(false); validateAndSet(e.dataTransfer.files?.[0], setBallotFile); }
  function onMicroDrop(e) { e.preventDefault(); setMicroDrag(false); validateAndSet(e.dataTransfer.files?.[0], setMicroFile); }

  function clearBallot() {
    setBallotFile(null);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
  }
  function clearMicro() {
    setMicroFile(null);
    if (microInputRef.current) microInputRef.current.value = "";
  }

  function reset() {
    setBallotFile(null);
    setMicroFile(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setQuery("");
    setStatusFilter("all");
    setPage(1);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
    if (microInputRef.current) microInputRef.current.value = "";
  }

  async function allocate() {
    if (!ballotFile) {
      setStatus("error");
      setErrorMsg("Please upload the Ballot Excel file first.");
      return;
    }
    if (!microFile) {
      setStatus("error");
      setErrorMsg("Please upload the Micro-officer Excel file first.");
      return;
    }
    setStatus("allocating");
    setErrorMsg("");
    try {
      let data;
      if (USE_MOCK) {
        data = await new Promise((res) => setTimeout(() => res(mockAllocate()), 500));
      } else {
        const form = new FormData();
        form.append("ballots", ballotFile);
        form.append("microOfficers", microFile);
        form.append("presidingOfficers", JSON.stringify(officers.presiding));
        form.append("pollingOfficers", JSON.stringify(officers.polling));
        const res = await fetch(`${API_BASE}/${context}/phase-3/allocate`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const msg = await parseJson(res);
          throw new Error(msg?.message || `Allocation failed (${res.status}).`);
        }
        data = await parseJson(res);
      }
      const rows = (Array.isArray(data?.rows) ? data.rows : []).map(normalizeRow);
      setResult({ summary: normalizeSummary(data, rows), rows });
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong during allocation.");
    }
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary ?? { totalBallots: 0, allocated: 0, presidingCount: 0, pollingCount: 0, microOfficers: 0 };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r._statusKey === (statusFilter === "allocated" ? "approved" : "rejected"));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.ballotId, r.psNo, r.presidingOfficer, r.pollingOfficer, r.microOfficer, r.mandal]
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
  const canAllocate = !!ballotFile && !!microFile && status !== "allocating";


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
                Upload the Ballot register and Micro-officer list, then allocate ballots to the
                Presiding and Polling officers using the backend allocation rules.
              </p>
            </div>
          </div>
          <aside className="p1-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Presiding &amp; Polling officers are pulled from <strong>Phase 2</strong>. Upload both
              files and click <strong>Allocate Ballots</strong> — the backend assigns each ballot to
              an officer and micro-officer per the rules, and the result is shown below.
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
            <OfficerCount tone="p3-tone-polling" icon={<BadgeIcon />} label="Polling Officers" count={officers.polling.length} />
          </div>
          {!officers.hasOfficers && (
            <p className="p3-officers-warn">
              No Presiding/Polling officers found. Complete Phase 2 so the backend has officers to
              allocate to — though you may still upload files and allocate.
            </p>
          )}
        </section>


        {/* dual upload */}
        <section className="p3-upload-grid">
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

          {/* Micro-officer upload */}
          <div className="p1-upload-card p3-upload-card">
            <h2 className="p1-card-title">
              <span className="p1-card-title-icon">
                <PeopleIcon />
              </span>
              Upload Micro-officer Excel File
            </h2>
            <div
              className={`p1-drop${microDrag ? " is-drag" : ""}`}
              onClick={() => microInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setMicroDrag(true); }}
              onDragOver={(e) => { e.preventDefault(); setMicroDrag(true); }}
              onDragLeave={() => setMicroDrag(false)}
              onDrop={onMicroDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") microInputRef.current?.click(); }}
            >
              <span className="p1-drop-icon">
                <CloudUpIcon />
              </span>
              <strong>Drag &amp; drop the Micro-officer file here</strong>
              <span className="p1-drop-or">or</span>
              <button type="button" className="p1-browse" onClick={(e) => { e.stopPropagation(); microInputRef.current?.click(); }}>
                Browse Files
              </button>
              <span className="p1-drop-hint">Supported format: .xlsx&nbsp;&nbsp;|&nbsp;&nbsp;Max file size: 10 MB</span>
              <input ref={microInputRef} type="file" accept={ACCEPTED.join(",")} onChange={onMicroPick} hidden />
            </div>
            {microFile && (
              <div className="p1-filechip">
                <span className="p1-filechip-icon"><DocIcon /></span>
                <span className="p1-filechip-name">{microFile.name}</span>
                <span className="p1-filechip-size">{(microFile.size / 1024).toFixed(1)} KB</span>
                <button type="button" className="p1-filechip-clear" onClick={clearMicro} aria-label="Remove file">×</button>
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
            Upload both files, then click <strong>Allocate Ballots</strong>. The backend applies the
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
                    placeholder="Search ballot, officer, micro-officer…"
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
                  <span className="p1-stat-label">Micro-officers Used</span>
                  <span className="p1-stat-num">{summary.microOfficers}</span>
                </div>
              </div>
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
                    <th>Micro-officer</th>
                    <th>Mandal</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p1-empty">No matching records.</td>
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
                        <td>{r.microOfficer}</td>
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
          </section>
        )}
      </div>
    </main>
  );
}

