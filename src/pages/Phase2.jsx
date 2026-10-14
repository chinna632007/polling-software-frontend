import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search…)
import "./Phase2.css"; // Phase 2 specifics (team formation bar, presiding/polling chips + role badges, Excel export bar)
import Header from "../components/Header.jsx";

/**
 * Phase 2 – Team Formation
 * --------------------------
 * Consumes the APPROVED employees produced by Phase 1 (Employee Validation),
 * ranks them by seniority, and forms them into polling teams: 1 Presiding
 * Officer + 5 Polling Officers (1st–5th) per team, each with a unique team
 * code, an officer role and a duty.
 *
 * Data source: Phase 1 persists its validated result to sessionStorage
 * (`elections:<context>:phase1-result`). If nothing is stored yet, the page
 * shows an empty state.
 *
 * NOTE: the backend Stage 2 formation module cannot run in the browser (it
 * requires Node's `crypto` and exposes no HTTP route), so the team formation
 * here mirrors its documented rules and works only with the real Phase 1
 * approved rows — no mock data.
 */

const STORE_KEY = (context) => `elections:${context}:phase1-result`;
// Persist the team formation so Phase 3 (ballot allocation) can consume the
// Presiding / Polling officers.
const PHASE2_STORE_KEY = (context) => `elections:${context}:phase2-partition`;
const PAGE_SIZE = 10;

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

/* ------------------------- team formation ---------------------------- */
/*
 * Frontend team formation — mirrors the backend Stage 2 rules (read-only).
 * The backend formation module cannot run in the browser (it requires
 * Node's `crypto` and is CommonJS) and exposes no HTTP route, so Phase 2
 * forms teams here from the real Phase 1 approved rows instead of mock
 * data. Rules mirrored: 1 Presiding Officer + 5 Polling Officers = 6 per
 * polling party; authorised shortage party = 1 + 4 with 3rd/4th duties
 * merged into the 3rd Polling Officer; team codes PP-<SHORT>-<NNN>.
 * Duty wording is the APSEC circular text kept in the backend
 * stage2.duties module. The circular gives NO duty description for the
 * Presiding Officer on the verified pages — recorded as null and shown
 * honestly, nothing invented.
 */

const TEAM_SIZE = 6;

const FULL_TEAM_ROLES = Object.freeze([
  "Presiding Officer",
  "1st Polling Officer",
  "2nd Polling Officer",
  "3rd Polling Officer",
  "4th Polling Officer",
  "5th Polling Officer",
]);

/* Shortage 1+4 party: no 4th Polling Officer exists; the 5th keeps its slot. */
const SHORTAGE_TEAM_ROLES = Object.freeze([
  "Presiding Officer",
  "1st Polling Officer",
  "2nd Polling Officer",
  "3rd Polling Officer",
  "5th Polling Officer",
]);

const TEAM_DUTIES = Object.freeze({
  "1st Polling Officer": "Voter's identification Officer.",
  "2nd Polling Officer": "Responsible for Indelible Ink.",
  "3rd Polling Officer": "Incharge of MPTC Ballot Papers.",
  "4th Polling Officer": "Incharge of ZPTC Ballot Papers.",
  "5th Polling Officer": "Ballot Paper Handling Officer.",
});

/* Merged 3rd + 4th duties for an authorised 1+4 shortage party. */
const MERGED_SHORTAGE_DUTY_3 =
  "Incharge of MPTC Ballot Papers and ZPTC Ballot Papers " +
  "(merged 3rd + 4th Polling Officer duties for 1+4 shortage party).";

/** Roles for a chunk of `size` ranked officers (most senior first). */
function teamRolesForSize(size) {
  if (size >= TEAM_SIZE) return FULL_TEAM_ROLES;
  if (size === TEAM_SIZE - 1) return SHORTAGE_TEAM_ROLES;
  return FULL_TEAM_ROLES.slice(0, size);
}

/** Unique team code in the backend's PP-<SHORT>-<NNN> shape. */
function buildTeamCode(short, n) {
  return `PP-${short}-${String(n).padStart(3, "0")}`;
}

/** Duty text for a numbered role, or null for the Presiding Officer. */
function dutyFor(teamRole, chunkSize) {
  if (teamRole === "Presiding Officer") return null;
  if (teamRole === "3rd Polling Officer" && chunkSize === TEAM_SIZE - 1) {
    return MERGED_SHORTAGE_DUTY_3;
  }
  return TEAM_DUTIES[teamRole] ?? null;
}

/**
 * Form the ranked list into polling teams. Every officer comes from the
 * real Phase 1 approved rows (no mock data). Each member keeps a legacy
 * `role` ("Presiding Officer" / "Polling Officer") so Phase 3's officer
 * pool keeps working, plus `teamCode`, `teamRole`, `duty` and `teamStatus`.
 */
function formTeams(rankedRows, codeShort) {
  const out = [];
  const teamCount = Math.ceil(rankedRows.length / TEAM_SIZE);
  for (let t = 0; t < teamCount; t += 1) {
    const chunk = rankedRows.slice(t * TEAM_SIZE, t * TEAM_SIZE + TEAM_SIZE);
    const roles = teamRolesForSize(chunk.length);
    const teamCode = buildTeamCode(codeShort, t + 1);
    const teamStatus = chunk.length >= TEAM_SIZE ? "complete" : chunk.length === TEAM_SIZE - 1 ? "shortage" : "incomplete";
    chunk.forEach((r, i) => {
      const teamRole = roles[i];
      out.push({
        ...r,
        teamCode,
        teamIndex: t + 1,
        teamRole,
        role: i === 0 ? "Presiding Officer" : "Polling Officer",
        duty: dutyFor(teamRole, chunk.length),
        teamStatus,
      });
    });
  }
  return out;
}

/** Drop any previous team assignment before re-forming (idempotent re-form). */
function stripTeam(row) {
  const clean = { ...row };
  delete clean.role;
  delete clean.teamCode;
  delete clean.teamIndex;
  delete clean.teamRole;
  delete clean.duty;
  delete clean.teamStatus;
  return clean;
}

/** Group flat member rows back into team chunks (unique codes), in team order. */
function groupIntoTeams(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.teamCode) return;
    if (!map.has(r.teamCode)) {
      map.set(r.teamCode, {
        teamCode: r.teamCode,
        index: r.teamIndex,
        status: r.teamStatus,
        members: [],
      });
    }
    map.get(r.teamCode).members.push(r);
  });
  return [...map.values()].sort((a, b) => a.index - b.index);
}

/** Human label for a team status badge. */
function teamStatusLabel(team) {
  if (team.status === "complete") return "Complete · 6/6";
  if (team.status === "shortage") return "Shortage · 5/6";
  return `Incomplete · ${team.members.length}/6`;
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
  if (role === "Presiding Officer") {
    return (
      <span className="p1-badge p2-badge-presiding">
        <TrophyIcon /> {role}
      </span>
    );
  }
  // Any numbered 1st–5th Polling Officer reads as the polling group.
  return (
    <span className="p1-badge p2-badge-polling">
      <BadgeIcon /> {role}
    </span>
  );
}


/* ---------------------------- excel export ---------------------------- */
/*
 * Team data is shown only in the Excel-style table below. There is a single
 * Download button: ONE workbook, ONE sheet, with every officer row carrying
 * its Team Code column. The team-code buttons are filters (they open that
 * team's officer data in the table), not downloads.
 */

const EXPORT_COLS = [
  ["Team Code", 14],
  ["Role", 24],
  ["Employee ID", 14],
  ["Employee Name", 26],
  ["Designation", 24],
  ["Work Mandal", 18],
  ["Team Status", 16],
  ["Duty", 60],
];

/** Map one team's members to flat export rows (Excel header order). */
function teamExportRows(team) {
  return team.members.map((m) => ({
    "Team Code": team.teamCode,
    Role: m.teamRole || m.role,
    "Employee ID": m.employeeId,
    "Employee Name": m.employeeName,
    Designation: m.designation,
    "Work Mandal": m.workMandal,
    "Team Status": teamStatusLabel(team),
    Duty: m.duty ?? "—",
  }));
}

/**
 * Download ALL teams into one workbook with a single sheet. Every row is
 * tagged with its Team Code so the sheet can be re-grouped/sorted in Excel.
 */
function exportTeamsExcel(teams) {
  const allRows = teams.flatMap(teamExportRows);
  if (allRows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(allRows);
  ws["!cols"] = EXPORT_COLS.map(([, wch]) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All Teams");
  XLSX.writeFile(wb, "phase2-teams.xlsx");
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
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

  // rows always carry a rank; role stays "—" until the user forms teams.
  const [rows, setRows] = useState(() => withRanks(approvedSource));
  const [partitioned, setPartitioned] = useState(false);
  const [busy, setBusy] = useState(false);

  const [roleFilter, setRoleFilter] = useState("all"); // all | presiding | polling
  const [teamFilter, setTeamFilter] = useState(null); // team code → only that team's officers
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const presidingCount = rows.filter((r) => r.role === "Presiding Officer").length;
  const pollingCount = rows.filter((r) => r.role === "Polling Officer").length;
  const groupedTeams = useMemo(() => groupIntoTeams(rows), [rows]);
  const teamCount = groupedTeams.length;

  function runPartition() {
    setBusy(true);
    // brief delay so the split is visibly applied
    setTimeout(() => {
      setRows((prev) => {
        const next = formTeams(withRanks(prev.map(stripTeam)), isMunicipal ? "MUN" : "GPN");
        // Share the team-formed officers with Phase 3 (allocation). The
        // legacy `role` field keeps Phase 3's officer pool working; the
        // team fields power the Phase 2 team display.
        try {
          sessionStorage.setItem(PHASE2_STORE_KEY(context), JSON.stringify(next));
        } catch {
          /* storage may be unavailable */
        }
        return next;
      });
      setPartitioned(true);
      setRoleFilter("all");
      setTeamFilter(null);
      setPage(1);
      setBusy(false);
    }, 450);
  }

  function resetPartition() {
    setRows(withRanks(approvedSource.map(stripTeam)));
    setPartitioned(false);
    setRoleFilter("all");
    setTeamFilter(null);
    setPage(1);
    try {
      sessionStorage.removeItem(PHASE2_STORE_KEY(context));
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (roleFilter === "presiding") list = list.filter((r) => r.role === "Presiding Officer");
    if (roleFilter === "polling") list = list.filter((r) => r.role === "Polling Officer");
    if (teamFilter) list = list.filter((r) => r.teamCode === teamFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.employeeName, r.employeeId, r.designation, r.teamCode, r.teamRole].join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, roleFilter, teamFilter, query]);

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
              <h1>Phase 2 – Team Formation</h1>
              <p>
                Approved employees from Phase 1 are ranked by experience &amp; seniority, then
                formed into polling teams — 1 Presiding Officer + 5 Polling Officers per team,
                each with a unique team code, an officer role and a duty.
              </p>
            </div>
          </div>
          <aside className="p1-infobox p2-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Click <strong>Form Teams</strong> to group the approved staff into polling
              teams. The most senior officer of each team becomes its Presiding Officer;
              the rest take the numbered Polling Officer roles (1st–5th) with their
              circular duties. Click a <strong>team-code button</strong> below to open that
              team's officer data, or <strong>Show All Teams</strong> for the full structure.
            </p>
          </aside>
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
                ? `Formed ${teamCount} team${teamCount === 1 ? "" : "s"} — ${presidingCount} Presiding & ${pollingCount} Polling Officers.`
                : "Not yet formed — every employee is currently Unassigned."}
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
              {partitioned ? "Re-form Teams" : "Form Teams"}
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
                  placeholder="Search by team code, role, name, Employee ID, designation..."
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
            <div className="p1-stat p2-stat-teams">
              <span className="p1-stat-icon"><SplitIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Teams Formed</span>
                <span className="p1-stat-num">{partitioned ? teamCount : "—"}</span>
              </div>
            </div>
            <div className="p1-stat p1-stat-review">
              <span className="p1-stat-icon"><CheckIcon /></span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">Status</span>
                <span className="p1-stat-num">{partitioned ? "Formed" : "Pending"}</span>
              </div>
            </div>
          </div>


          {/* team-code filter buttons + single-sheet Excel download */}
          {partitioned && (
            <div className="p2-export-bar">
              <div className="p2-export-info">
                <span className="p2-export-title">
                  Generated Team Codes <span className="p2-teams-count">({teamCount})</span>
                  {teamFilter && <span className="p2-team-filter-tag">Viewing {teamFilter}</span>}
                </span>
                <span className="p2-export-hint">
                  Click a team-code button to open that team's officer data in the table below.
                  Download puts every officer of every team into one Excel sheet, each row tagged
                  with its Team Code.
                </span>
              </div>
              <div className="p2-export-actions">
                <div className="p2-export-row">
                  <button
                    type="button"
                    className="p2-export-all"
                    onClick={() => exportTeamsExcel(groupedTeams)}
                    disabled={teamCount === 0}
                  >
                    <DownloadIcon /> Download All Teams (Excel · single sheet)
                  </button>
                  <button
                    type="button"
                    className="p2-show-all"
                    onClick={() => {
                      setTeamFilter(null);
                      setPage(1);
                    }}
                    disabled={!teamFilter}
                  >
                    Show All Teams
                  </button>
                </div>
                <div className="p2-export-chips" role="group" aria-label="Filter officers by team code">
                  {groupedTeams.map((team) => (
                    <button
                      key={team.teamCode}
                      type="button"
                      className={`p2-export-chip${teamFilter === team.teamCode ? " is-active" : ""}`}
                      onClick={() => {
                        setTeamFilter((cur) => (cur === team.teamCode ? null : team.teamCode));
                        setPage(1);
                      }}
                      title={`Show officers of ${team.teamCode}`}
                      aria-pressed={teamFilter === team.teamCode}
                    >
                      {team.teamCode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* table */}
          <div className="p1-table-wrap">
            <table className="p1-table p2-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team Code</th>
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
                  <th>Duty</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p1-empty">
                      {roleFilter !== "all" && !partitioned
                        ? "Form the teams first to see assigned roles."
                        : "No matching records."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={`${r.rank}-${r.employeeId}`}>
                      <td className="p2-rank"><span>{r.rank}</span></td>
                      <td className="p1-mono p2-teamcode-cell">{r.teamCode ?? "—"}</td>
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
                      <td><RoleBadge role={r.teamRole || r.role} /></td>
                      <td className="p2-duty-cell">{r.duty ?? "—"}</td>
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
            </a>
          </div>
        )}
        </>
        )}
      </div>
    </main>
  );
}

