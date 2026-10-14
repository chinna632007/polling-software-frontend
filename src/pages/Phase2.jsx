import { useMemo, useRef, useState } from "react";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search…)
import "./Phase2.css"; // Phase 2 specifics (partition button, presiding/polling chips + role badges)
import Header from "../components/Header.jsx";

/**
 * Phase 2 – Officer Ranking & Assignment (+ Micro-officer upload)
 * ---------------------------------------------------------------
 * Consumes the APPROVED employees produced by Phase 1 (Employee Validation) and
 * ranks them. When the user clicks "Partition", the ranked list is split into
 * Presiding Officers (most senior) and Polling Officers (the rest).
 *
 * This page ALSO collects the Micro-officer list (Excel upload, frontend-only
 * parse: name per row). The micro list is persisted together with the
 * partition so Phase 3 (ballot allocation) can consume
 * Presiding / Polling / Micro-officers without its own upload.
 *
 * Data source: Phase 1 persists its validated result to sessionStorage
 * (`elections:<context>:phase1-result`). If nothing is stored yet, a built-in
 * demo set is used so the page is always viewable.
 */

const STORE_KEY = (context) => `elections:${context}:phase1-result`;
// Persist the partition (+ micro list) so Phase 3 (ballot allocation) can
// consume the Presiding / Polling / Micro officers.
const PHASE2_STORE_KEY = (context) => `elections:${context}:phase2-partition`;
/** Micro-officer list uploaded on Phase 2, consumed by Phase 3. */
export const MICRO_STORE_KEY = (context) => `elections:${context}:micro-officers`;
const PAGE_SIZE = 10;
const MICRO_ACCEPTED = [".xlsx", ".xls", ".csv"];

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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
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

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.5 14.5A4.5 4.5 0 0 0 18 6.5h-1.3A7 7 0 1 0 5 12.5" />
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

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="5" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="12" cy="19" r="2.4" />
      <path d="M6 7.4V11a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.4" />
      <path d="M12 14v2.6" />
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

/** Frontend-only reader: first column of the file = micro-officer names. */
function readMicroOfficers(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = text
          .split(/\r?\n/)
          .map((line) =>
            line
              .split(/[,;\t]/)
              .map((c) => c.replace(/^"|"$/g, "").trim())
              .filter(Boolean)
          )
          .filter((cells) => cells.length > 0)
          .map((cells) => cells[0]);
        const head = rows[0]?.toLowerCase() ?? "";
        const data = /micro|officer|name|sl\.?\s*no|s\.?\s*no|employee/i.test(head) ? rows.slice(1) : rows;
        const names = data.filter((n) => n && n.toLowerCase() !== "nan" && n !== "—");
        resolve({ fileName: file.name, officers: names });
      } catch {
        reject(new Error("Could not parse the micro-officer file. Use a CSV export of the list."));
      }
    };
    reader.readAsText(file);
  });
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Extract a leading integer from strings like "12 yrs", "5 yrs PH-40%". */
function serviceYears(s) {
  const m = String(s || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Higher score = more senior / more experienced → ranked first. */
function rankScore(r) {
  const seniority = /superintendent/i.test(r.designation || "") ? 120
    : /senior/i.test(r.designation || "") ? 90
    : /engineer/i.test(r.designation || "") ? 60
    : 0;
  return seniority + serviceYears(r.serviceInDistrict) * 10 + num(r.age, 0);
}

/** Sort approved rows by rank and stamp each with a 1-based rank. */
function withRanks(rows) {
  return [...rows]
    .sort((a, b) => rankScore(b) - rankScore(a) || String(a.employeeName).localeCompare(String(b.employeeName)))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Partition the ranked list. Roughly 1 in every 4 becomes a Presiding Officer
 * (min 1), the rest become Polling Officers — mirroring real staffing ratios.
 */
function partition(rankedRows) {
  const presidingCount = Math.max(1, Math.round(rankedRows.length / 4));
  return rankedRows.map((r, i) => ({
    ...r,
    role: i < presidingCount ? "Presiding Officer" : "Polling Officer",
  }));
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


/* --------------------------- approved loader --------------------------- */

/**
 * Read the APPROVED rows stored by Phase 1 (Employee Validation).
 *
 * Phase 1 persists its validated result to sessionStorage; this returns only
 * the approved employees, normalized to the table shape. Returns an empty
 * array when Phase 1 hasn't been run yet (the page shows an empty state).
 */
function loadApproved(context) {
  try {
    const raw = sessionStorage.getItem(STORE_KEY(context));
    if (!raw) return [];
    const data = JSON.parse(raw);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return rows
      .filter((r) => /approve|eligib|valid/i.test(String(r.status || "")))
      .map((raw2) => ({
        employeeId: pick(raw2, "employeeId", "employeeID", "empId", "EmployeeID", "employee_id") ?? "—",
        employeeName: pick(raw2, "employeeName", "name", "employee_name") ?? "—",
        designation: pick(raw2, "designation", "Designation") ?? "—",
        gender: pick(raw2, "gender", "Gender", "sex") ?? "—",
        age: pick(raw2, "age", "Age") ?? "—",
        employmentType: pick(raw2, "employmentType", "employment_type", "EmploymentType") ?? "—",
        workMandal: pick(raw2, "workMandal", "work_mandal", "WorkMandal", "mandal") ?? "—",
        serviceInDistrict: pick(raw2, "serviceInDistrict", "service_in_district", "ServiceInDistrict", "service") ?? "—",
        phCategory: pick(raw2, "phCategory", "ph_category", "PHCategory", "ph") ?? "—",
        criminalCaseEci: pick(raw2, "criminalCaseEciRestriction", "criminalCaseEci", "criminalCase", "eciRestriction") ?? "—",
      }));
  } catch {
    return [];
  }
}

/* ---------------------------- sub-components -------------------------- */

function RoleBadge({ role }) {
  if (!role || role === "—") {
    return <span className="p1-badge p1-badge-review">Unassigned</span>;
  }
  return role === "Presiding Officer" ? (
    <span className="p1-badge p2-badge-presiding">
      <TrophyIcon /> {role}
    </span>
  ) : (
    <span className="p1-badge p2-badge-polling">
      <BadgeIcon /> {role}
    </span>
  );
}


/* ------------------------------- page --------------------------------- */

export default function Phase2({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  // Approved employees come ONLY from Phase 1's validated result (sessionStorage).
  const approvedSource = useMemo(() => loadApproved(context), [context]);
  const hasData = approvedSource.length > 0;

  // rows always carry a rank; role stays "—" until the user partitions.
  const [rows, setRows] = useState(() => withRanks(approvedSource));
  const [partitioned, setPartitioned] = useState(false);
  const [busy, setBusy] = useState(false);

  const [roleFilter, setRoleFilter] = useState("all"); // all | presiding | polling
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Micro-officer list (uploaded here, consumed by Phase 3). Restore on reload.
  const [micro, setMicro] = useState(() => {
    try {
      const raw = sessionStorage.getItem(MICRO_STORE_KEY(context));
      if (!raw) return { fileName: "", officers: [] };
      const data = JSON.parse(raw);
      return { fileName: data?.fileName ?? "", officers: Array.isArray(data?.officers) ? data.officers : [] };
    } catch {
      return { fileName: "", officers: [] };
    }
  });
  const [microError, setMicroError] = useState("");

  const presidingCount = rows.filter((r) => r.role === "Presiding Officer").length;
  const pollingCount = rows.filter((r) => r.role === "Polling Officer").length;

  function runPartition() {
    setBusy(true);
    // brief delay so the split is visibly applied
    setTimeout(() => {
      setRows((prev) => {
        const next = partition(withRanks(prev.map(({ role, ...r }) => r)));
        // Share the Presiding / Polling officers with Phase 3 (allocation).
        try {
          sessionStorage.setItem(PHASE2_STORE_KEY(context), JSON.stringify(next));
        } catch {
          /* storage may be unavailable */
        }
        return next;
      });
      setPartitioned(true);
      setRoleFilter("all");
      setPage(1);
      setBusy(false);
    }, 450);
  }

  function resetPartition() {
    setRows(withRanks(approvedSource.map(({ role, ...r }) => r)));
    setPartitioned(false);
    setRoleFilter("all");
    setPage(1);
    try {
      sessionStorage.removeItem(PHASE2_STORE_KEY(context));
    } catch {
      /* ignore */
    }
  }

  async function handleMicroFile(file) {
    if (!file) return;
    setMicroError("");
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    if (ext && !MICRO_ACCEPTED.includes(ext)) {
      setMicroError(`Unsupported file type "${ext}". Upload .xlsx, .xls or .csv.`);
      return;
    }
    try {
      const parsed = await readMicroOfficers(file);
      if (parsed.officers.length === 0) {
        setMicroError(`No officer names found in "${file.name}".`);
        return;
      }
      setMicro(parsed);
      try {
        sessionStorage.setItem(MICRO_STORE_KEY(context), JSON.stringify(parsed));
      } catch {
        /* storage may be unavailable */
      }
    } catch (err) {
      setMicroError(err.message || "Could not read the micro-officer file.");
    }
  }

  function clearMicro() {
    setMicro({ fileName: "", officers: [] });
    setMicroError("");
    try {
      sessionStorage.removeItem(MICRO_STORE_KEY(context));
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (roleFilter === "presiding") list = list.filter((r) => r.role === "Presiding Officer");
    if (roleFilter === "polling") list = list.filter((r) => r.role === "Polling Officer");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.employeeName, r.employeeId, r.designation].join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, roleFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);


  return (
    <main className="p1-page p2-page">
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
          <span>Phase 2</span>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Officer Ranking &amp; Assignment</span>
        </nav>

        {/* title + info box */}
        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon p2-title-icon">
              <PeopleIcon />
            </span>
            <div>
              <h1>Phase 2 – Officer Ranking &amp; Assignment</h1>
              <p>
                Approved employees from Phase 1 are ranked by experience &amp; seniority, then
                partitioned into Presiding Officers and Polling Officers. Upload the{" "}
                <strong>Micro-officer list</strong> here — it travels with the partition to Phase 3.
              </p>
            </div>
          </div>
          <aside className="p1-infobox p2-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Click <strong>Partition Employees</strong> to divide the approved staff. The most
              senior become Presiding Officers; the rest become Polling Officers. Upload the{" "}
              <strong>Micro-officer Excel</strong> below so Phase 3 can attach one micro-officer
              per ballot.
            </p>
          </aside>
        </section>

        {/* micro-officer upload (moved here from Phase 3) */}
        <section className="p1-upload-grid p2-micro-grid">
          <div className="p1-upload-card p2-micro-card">
            <div className="p1-upload-info">
              <span className="p1-upload-icon">
                <CloudUpIcon />
              </span>
              <div>
                <h2>Upload Micro-officer List</h2>
                <p>
                  Excel / CSV — one officer name per row. Parsed in the browser and sent with the
                  Phase 3 allocation request.
                </p>
              </div>
            </div>
            <label className="p1-dropzone">
              <input
                type="file"
                accept={MICRO_ACCEPTED.join(",")}
                hidden
                onChange={(e) => {
                  handleMicroFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <span className="p1-dropzone-icon">
                <CloudUpIcon />
              </span>
              <span className="p1-dropzone-text">
                {micro.fileName ? (
                  <>
                    <strong>{micro.fileName}</strong>
                    <span>{micro.officers.length} micro-officer(s) loaded — click to replace</span>
                  </>
                ) : (
                  <>
                    <strong>Upload micro-officer file</strong>
                    <span>Click to browse or drop (.xlsx, .xls, .csv)</span>
                  </>
                )}
              </span>
            </label>
            {microError && (
              <p className="p1-alert p1-alert-error" role="alert">
                {microError}
              </p>
            )}
            {micro.officers.length > 0 && (
              <div className="p2-micro-list">
                <div className="p2-micro-head">
                  <span>
                    <DocIcon /> {micro.officers.length} micro-officer(s) ready for Phase 3
                  </span>
                  <button type="button" className="p2-reset-btn" onClick={clearMicro}>
                    Remove
                  </button>
                </div>
                <ol>
                  {micro.officers.slice(0, 8).map((name, i) => (
                    <li key={`${name}-${i}`}>{name}</li>
                  ))}
                </ol>
                {micro.officers.length > 8 && (
                  <p className="p2-micro-more">+{micro.officers.length - 8} more…</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* no Phase 1 data yet → prompt the user to complete Phase 1 */}
        {!hasData && (
          <section className="p2-empty">
            <span className="p2-empty-icon">
              <CloudUpIcon />
            </span>
            <h2>No approved employees yet</h2>
            <p>
              This page ranks and partitions the employees approved in{" "}
              <strong>Phase 1 – Employee Validation</strong>. Please complete Phase 1
              first by uploading and validating the Employee Excel file.
            </p>
            <a className="p2-empty-btn" href={`${backHref}/phase-1`}>
              Go to Phase 1 – Employee Validation
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </a>
          </section>
        )}

        {/* partition action + result (only once Phase 1 has approved data) */}
        {hasData && (
        <>
        <section className="p2-partition-bar">
          <div className="p2-partition-info">
            <span className="p2-partition-count">
              <strong>{rows.length}</strong> approved employees ready to assign
            </span>
            <span className="p2-partition-hint">
              {partitioned
                ? `Partitioned into ${presidingCount} Presiding & ${pollingCount} Polling Officers.`
                : "Not yet partitioned — every employee is currently Unassigned."}
            </span>
          </div>
          <div className="p2-partition-actions">
            <button
              type="button"
              className="p2-partition-btn"
              onClick={runPartition}
              disabled={busy || rows.length === 0}
            >
              {busy ? (
                <span className="p1-spinner" aria-hidden="true" />
              ) : (
                <SplitIcon />
              )}
              {partitioned ? "Re-partition" : "Partition Employees"}
            </button>
            {partitioned && (
              <button type="button" className="p2-reset-btn" onClick={resetPartition}>
                Reset
              </button>
            )}
          </div>
        </section>


        {/* result */}
        <section className="p1-result">
          {/* toolbar */}
          <div className="p1-toolbar">
            <div className="p1-chips">
              <button
                type="button"
                className={`p1-chip p1-chip-all${roleFilter === "all" ? " is-active" : ""}`}
                onClick={() => { setRoleFilter("all"); setPage(1); }}
              >
                All Approved <b>({rows.length})</b>
              </button>
              <button
                type="button"
                className={`p1-chip p2-chip-presiding${roleFilter === "presiding" ? " is-active" : ""}`}
                onClick={() => { setRoleFilter("presiding"); setPage(1); }}
              >
                <TrophyIcon /> Presiding Officers <b>({presidingCount})</b>
              </button>
              <button
                type="button"
                className={`p1-chip p2-chip-polling${roleFilter === "polling" ? " is-active" : ""}`}
                onClick={() => { setRoleFilter("polling"); setPage(1); }}
              >
                <BadgeIcon /> Polling Officers <b>({pollingCount})</b>
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
                  placeholder="Search by name, Employee ID, designation..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* stats */}
          <div className="p1-stats">
            <div className="p1-stat p1-stat-total">
              <span className="p1-stat-icon"><CheckIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Approved (Total)</span>
                <span className="p1-stat-num">{rows.length}</span>
              </div>
            </div>
            <div className="p1-stat p2-stat-presiding">
              <span className="p1-stat-icon"><TrophyIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Presiding Officers</span>
                <span className="p1-stat-num">{presidingCount}</span>
              </div>
            </div>
            <div className="p1-stat p2-stat-polling">
              <span className="p1-stat-icon"><BadgeIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Polling Officers</span>
                <span className="p1-stat-num">{pollingCount}</span>
              </div>
            </div>
            <div className="p1-stat p1-stat-review">
              <span className="p1-stat-icon"><SplitIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Status</span>
                <span className="p1-stat-num">{partitioned ? "Partitioned" : "Pending"}</span>
              </div>
            </div>
          </div>


          {/* table */}
          <div className="p1-table-wrap">
            <table className="p1-table p2-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Designation</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Employment Type</th>
                  <th>Work Mandal</th>
                  <th>Service in District</th>
                  <th>PH Category</th>
                  <th>Criminal Case / ECI</th>
                  <th>Assigned Role</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p1-empty">
                      {roleFilter !== "all" && !partitioned
                        ? "Partition the employees first to see assigned roles."
                        : "No matching records."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={`${r.rank}-${r.employeeId}`}>
                      <td className="p2-rank"><span>{r.rank}</span></td>
                      <td className="p1-mono">{r.employeeId}</td>
                      <td className="p1-strong">{r.employeeName}</td>
                      <td>{r.designation}</td>
                      <td>{r.gender}</td>
                      <td>{r.age}</td>
                      <td>{r.employmentType}</td>
                      <td>{r.workMandal}</td>
                      <td>{r.serviceInDistrict}</td>
                      <td>{r.phCategory}</td>
                      <td>{r.criminalCaseEci}</td>
                      <td><RoleBadge role={r.role} /></td>
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

        {/* continue to Phase 3 */}
        {partitioned && presidingCount + pollingCount > 0 && (
          <div className="p1-next-row">
            <a className="p1-next-btn" href={`${backHref}/phase-3`}>
              Continue to Phase 3 – Ballot Allocation
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </a>
          </div>
        )}
        </>
        )}
      </div>
    </main>
  );
}

