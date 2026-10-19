/**
 * Training – PO/APO allocate (duty mandal), venue assign, generate orders, ZIP download.
 * Spec: TRAINING-ORDERS-ANALYSIS.md (separate po_* / apo_* tables).
 */

import { useEffect, useState } from "react";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import {
  allocateTrainingOrders,
  generateTrainingOrders,
  listTrainingOrders,
  listPoApoBatches,
  getPoApoBatchMembers,
  getPoApoBatchLocations,
  assignPoApoBatchLocation,
  downloadTrainingOrder,
  downloadTrainingOrdersZip,
  uploadTrainingLocations,
  uploadTrainingSessions,
  listTrainingLocations,
  wipeAllTrainingOrders,
} from "../api/client.js";

const PAGE_SIZE = 20;

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function Training({ context } = {}) {
  const [batchGroup, setBatchGroup] = useState("PO");
  const [batches, setBatches] = useState([]);

  const selected = batches.find((b) => String(b.id) === String(selectedBatchId)) || null;

  // Derive the election context (municipal / panchayat) from the prop; fall
  // back to the route so the back button returns to the right election home page.
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isMunicipal = context === "municipal" || (context == null && path.startsWith("/elections/municipal"));
  const contextLabel = isMunicipal ? "Municipal" : "Panchayat";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [page, setPage] = useState(1);
  const [locations, setLocations] = useState([]);
  const [locationChoice, setLocationChoice] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderGroup, setOrderGroup] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [allocateMsg, setAllocateMsg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState(null);
  const [zipping, setZipping] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeMsg, setWipeMsg] = useState(null);
  const [uploadingLoc, setUploadingLoc] = useState(false);
  const [locMsg, setLocMsg] = useState(null);
  const [locCount, setLocCount] = useState(null);
  const [uploadingSess, setUploadingSess] = useState(false);
  const [sessMsg, setSessMsg] = useState(null);
  const [sessCount, setSessCount] = useState(null);

  const loadOrders = async (group) => {
    try {
      const data = await listTrainingOrders({ group: group || undefined, perPage: 100 });
      setOrders(data.orders || []);
      setOrdersTotal(data.total ?? (data.orders || []).length);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load training orders");
    }
  };

  const loadBatches = async (group = batchGroup) => {
    try {
      setError(null);
      setLoading(true);
      const data = await listPoApoBatches(group);
      setBatches(data.batches || []);
    } catch (e) {
      setError(e.message || "Failed to load batches");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const runAllocate = async () => {
    try {
      setError(null);
      setAllocateMsg(null);
      setAllocating(true);
      const data = await allocateTrainingOrders();
      const n = (data.batches || []).length;
      const errs = data.errors || [];
      const bits = [];
      if (errs.length) bits.push(errs.join("; "));
      else {
        bits.push(`Allocated ${n} batch${n === 1 ? "" : "es"} (wiped previous).`);
        if (data.source === "stage_tables") {
          bits.push(`Source: Stage 2/3 DB tables (run ${data.stageRunId ?? "?"}).`);
        } else if (data.source === "run_json") {
          bits.push(`Source: last-run JSON (pre-014 run; re-run randomization to persist stage tables).`);
        }
      }
      if (data.skippedMo) bits.push(`Skipped ${data.skippedMo} MO.`);
      if (data.unresolved) bits.push(`${data.unresolved} unresolved employee id(s).`);
      setAllocateMsg(bits.join(" "));
      setSelectedBatchId(null);
      await loadBatches(batchGroup);
      await loadOrders(orderGroup);
    } catch (e) {
      setError(e.message || "Allocation failed");
    } finally {
      setAllocating(false);
    }
  };

  const runWipeAll = async () => {
    try {
      setError(null);
      setWipeMsg(null);
      setWiping(true);
      const data = await wipeAllTrainingOrders();
      setWipeMsg(
        `Wiped ${data.truncated?.length ?? 0} table(s) (users + roles kept). Reload to see clean state.`
      );
      setBatches([]);
      setMembers([]);
      setOrders([]);
      setOrdersTotal(0);
      setSelectedBatchId(null);
    } catch (e) {
      setError(e.message || "Wipe failed");
    } finally {
      setWiping(false);
    }
  };

  const runGenerate = async (group) => {
    try {
      setError(null);
      setGenerateMsg(null);
      setGenerating(true);
      const data = await generateTrainingOrders(group);
      setGenerateMsg(
        `${group}: generated ${data.generated ?? 0} of ${data.totalMembers ?? 0} orders` +
          (data.skippedNoLocation ? ` (${data.skippedNoLocation} without venue yet)` : "") +
          ((data.errors || []).length ? `; issues: ${data.errors.join("; ")}` : "")
      );
      await loadOrders(orderGroup || group);
    } catch (e) {
      setError(e.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const runZip = async (group) => {
    try {
      setError(null);
      setZipping(true);
      await downloadTrainingOrdersZip(group);
    } catch (e) {
      setError(e.message || "ZIP download failed");
    } finally {
      setZipping(false);
    }
  };

  const runDownloadOne = async (group, id) => {
    try {
      setError(null);
      // downloadTrainingOrder triggers the browser blob download directly.
      await downloadTrainingOrder(group, id);
    } catch (e) {
      setError(e.message || "Failed to download order");
    }
  };

  const runLocUpload = async (file) => {
    if (!file) return;
    try {
      setError(null);
      setLocMsg(null);
      setUploadingLoc(true);
      const data = await uploadTrainingLocations(file);
      const n = data.count ?? data.replaced ?? 0;
      setLocMsg(`Uploaded ${n} training location${n === 1 ? "" : "s"}.`);
      try {
        const locs = await listTrainingLocations();
        setLocCount(locs.count ?? (locs.locations || []).length);
      } catch { /* count refresh is best-effort */ }
    } catch (e) {
      setError(e.message || "Locations upload failed");
    } finally {
      setUploadingLoc(false);
    }
  };

  const runSessionUpload = async (file) => {
    if (!file) return;
    try {
      setError(null);
      setSessMsg(null);
      setUploadingSess(true);
      const data = await uploadTrainingSessions(file);
      const n = data.count ?? data.replaced ?? data.acceptedRows ?? 0;
      setSessCount(n);
      setSessMsg(`Uploaded ${n} training session${n === 1 ? "" : "s"}.`);
      try {
        const locs = await listTrainingLocations();
        setLocCount(locs.count ?? (locs.locations || []).length);
      } catch { /* count refresh is best-effort */ }
    } catch (e) {
      setError(e.message || "Sessions upload failed");
    } finally {
      setUploadingSess(false);
    }
  };

  const loadMembers = async (id) => {
    try {
      setError(null);
      const [data, locData] = await Promise.all([
        getPoApoBatchMembers(batchGroup, id),
        getPoApoBatchLocations(batchGroup, id).catch(() => ({ locations: [] })),
      ]);
      setMembers(data.members || []);
      setLocations(Array.isArray(locData?.locations) ? locData.locations : []);
      const current = batches.find((b) => b.id === id);
      setLocationChoice(current && current.location_id ? String(current.location_id) : "");
      setSelectedBatchId(id);
      setPage(1);
    } catch (e) {
      setError(e.message || "Failed to load members");
    }
  };

  const saveLocation = async () => {
    if (selectedBatchId == null) return;
    try {
      setError(null);
      setSavingLocation(true);
      const locationId = locationChoice === "" ? null : Number(locationChoice);
      await assignPoApoBatchLocation(batchGroup, selectedBatchId, locationId);
      await loadBatches(batchGroup);
    } catch (e) {
      setError(e.message || "Failed to assign location");
    } finally {
      setSavingLocation(false);
    }
  };

  const paginated = members.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [batchData, locData, orderData] = await Promise.all([
          listPoApoBatches(batchGroup),
          listTrainingLocations().catch(() => null),
          listTrainingOrders({ perPage: 100 }).catch(() => null),
        ]);
        if (cancelled) return;
        setBatches(Array.isArray(batchData?.batches) ? batchData.batches : []);
        if (locData) setLocCount(locData.count ?? (locData.locations || []).length);
        if (orderData) {
          setOrders(orderData.orders || []);
          setOrdersTotal(orderData.total ?? (orderData.orders || []).length);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load batches");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tr-page p1-page">
      <Header />

      <main className="p1-content">
      <div className="tr-back-row">
        <a
          href={backHref}
          aria-label={`Back to ${contextLabel} Elections`}
          title={`Back to ${contextLabel} Elections`}
        >
          <ChevronLeft />
          Back to {contextLabel} Elections
        </a>
      </div>
        <section className="p1-card" aria-label="Training orders">
          <div className="p1-card-head">
            <span className="p1-card-title">Training orders (PO / APO / OPO)</span>
          </div>
          <p className="tr-hint" style={{ marginBottom: 12 }}>
            After Stage 3: Allocate splits officers by duty mandal (PO = team heads, APO = the 4th Polling Officer slot,
            OPO = other Presiding Officers — Voter ID / Ink / MPTC / Incharge; MO skipped).
            Assign venues, Generate letters from built-in templates, then Download ZIP.
            Date/time/district come from server <code>.env</code>.
            {locCount != null && (
              <span> Training locations loaded: <strong>{locCount}</strong>.</span>
            )}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <label className="p1-mini-btn" style={{ cursor: uploadingLoc ? "wait" : "pointer" }}>
              {uploadingLoc ? "Uploading…" : "Upload locations"}
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                disabled={uploadingLoc}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = "";
                  runLocUpload(f);
                }}
              />
            </label>
            {locMsg && (
              <span className="tr-hint" role="status" style={{ marginLeft: 10 }}>
                {locMsg}
              </span>
            )}
            <label className="p1-mini-btn" style={{ cursor: uploadingSess ? "wait" : "pointer", marginLeft: 6 }}>
              {uploadingSess ? "Uploading…" : "Upload sessions (schedule)"}
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                disabled={uploadingSess}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = "";
                  runSessionUpload(f);
                }}
              />
            </label>
            {sessMsg && (
              <span className="tr-hint" role="status" style={{ marginLeft: 10 }}>
                {sessMsg}
              </span>
            )}
            {sessCount != null && (
              <span className="tr-hint" style={{ marginLeft: 10 }}>
                Training sessions loaded: <strong>{sessCount}</strong>.
              </span>
            )}
            <span className="tr-hint" style={{ marginLeft: 10, fontSize: 11, opacity: 0.8 }}>
              ⚠ Each upload replaces that table's existing rows (re-upload supersedes).
            </span>
            <button type="button" className="p1-mini-btn" disabled={allocating} onClick={runAllocate}>
              {allocating ? "Allocating…" : "Allocate (wipe + redo)"}
            </button>
            <button
              type="button"
              className="p1-mini-btn"
              disabled={wiping}
              onClick={() => {
                if (
                  !window.confirm(
                    'This will DELETE all data from every table except users and roles (personnel, stations, training, randomization results, etc.). This cannot be undone. Continue?'
                  )
                )
                  return;
                runWipeAll();
              }}
            >
              {wiping ? "Wiping…" : "Wipe all data (keep users/roles)"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={generating} onClick={() => runGenerate("PO")}>
              {generating ? "Generating…" : "Generate PO orders"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={generating} onClick={() => runGenerate("APO")}>
              {generating ? "Generating…" : "Generate APO orders"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={generating} onClick={() => runGenerate("OPO")}>
              {generating ? "Generating…" : "Generate OPO orders"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={zipping} onClick={() => runZip("PO")}>
              {zipping ? "Zipping…" : "Download PO ZIP"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={zipping} onClick={() => runZip("APO")}>
              {zipping ? "Zipping…" : "Download APO ZIP"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={zipping} onClick={() => runZip("OPO")}>
              {zipping ? "Zipping…" : "Download OPO ZIP"}
            </button>
            <button type="button" className="p1-mini-btn" disabled={zipping} onClick={() => runZip("ALL")}>
              {zipping ? "Zipping…" : "Download ALL ZIP"}
            </button>
            <select
              value={orderGroup}
              onChange={(e) => {
                setOrderGroup(e.target.value);
                loadOrders(e.target.value);
              }}
              aria-label="Filter orders by group"
            >
              <option value="">All groups</option>
              <option value="PO">PO</option>
              <option value="APO">APO</option>
              <option value="OPO">OPO</option>
            </select>
          </div>
          {allocateMsg && <div className="p1-note" role="status">{allocateMsg}</div>}
          {generateMsg && <div className="p1-note" role="status">{generateMsg}</div>}
          {wipeMsg && <div className="p1-note" role="status">{wipeMsg}</div>}
          {error && <div className="tr-error">{error}</div>}

          <div className="tr-table-wrap tr-orders-wrap">
            <table className="tr-table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Order</th>
                  <th>Group</th>
                  <th>Employee</th>
                  <th>Name</th>
                  <th>Duty mandal</th>
                  <th>Venue</th>
                  <th>Status</th>
                  <th style={{ width: 56 }} />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={`${o.training_group}-${o.id}`} className="tr-order-row">
                    <td className="tr-cell">{o.sl_no ?? "—"}</td>
                    <td className="tr-cell">{o.order_id}</td>
                    <td className="tr-cell">
                      <span className={`tr-group-badge ${o.training_group === "APO" ? "tr-group-apo" : o.training_group === "OPO" ? "tr-group-opo" : "tr-group-po"}`}>{o.training_group}</span>
                    </td>
                    <td className="tr-cell">{o.employee_id || "—"}</td>
                    <td className="tr-cell">{o.employee_name || "—"}</td>
                    <td className="tr-cell">{o.mandal || "—"}</td>
                    <td className="tr-cell">{o.venue_code || "—"}</td>
                    <td className="tr-cell">
                      <span className={`tr-venue-badge ${o.venue ? "tr-venue-assigned" : "tr-venue-pending"}`}>
                        {o.venue || "Not assigned"}
                      </span>
                    </td>
                    <td className="tr-cell tr-status">{o.status}</td>
                    <td className="tr-cell">
                      <button
                        type="button"
                        className="tr-dl-btn"
                        onClick={() => runDownloadOne(o.training_group, o.id)}
                        title="Download order DOCX"
                        aria-label={`Download ${o.order_id}`}
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div className="tr-empty">No generated orders yet. Allocate → assign venues → Generate → Download ZIP.</div>
            )}
            {ordersTotal > orders.length && (
              <div className="p1-page-info">
                Showing {orders.length} of {ordersTotal}.
              </div>
            )}
          </div>
        </section>

        <div className="tr-bulk">
          <div className="tr-bulk-head">
            <span className="tr-bulk-title">
              <UsersIcon /> {batchGroup} training batches
            </span>
            <select
              value={batchGroup}
              onChange={(e) => {
                const g = e.target.value;
                setBatchGroup(g);
                setSelectedBatchId(null);
                setMembers([]);
                loadBatches(g);
              }}
              aria-label="PO, APO or OPO training phase"
            >
              <option value="PO">PO Training Phase</option>
              <option value="APO">APO Training Phase</option>
              <option value="OPO">OPO Training Phase</option>
            </select>
            <span className="tr-hint">Grouped by duty mandal (not work/native). Max 100 per batch.</span>
          </div>

          {loading && <div className="tr-loading">Loading batches…</div>}

          {!loading && (
            <div className="tr-table-wrap">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Duty mandal</th>
                    <th>Location</th>
                    <th>Members</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      className={"tr-row" + (b.id === selectedBatchId ? " is-selected" : "")}
                      onClick={() => loadMembers(b.id)}
                    >
                      <td className="tr-cell">{b.batch_no}</td>
                      <td className="tr-cell">{b.mandal || "—"}</td>
                      <td className="tr-cell">{b.location_name || "—"}</td>
                      <td className="tr-cell">{b.member_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {batches.length === 0 && (
                <div className="tr-empty">No {batchGroup} batches. Click Allocate after Stage 3.</div>
              )}
            </div>
          )}
        </div>

        {selectedBatchId && selected && (
          <section className="tr-batch">
            <div className="tr-batch-head">
              <button type="button" className="p1-back-btn" onClick={() => setSelectedBatchId(null)}>
                <ChevronLeft /> Back to batches
              </button>
              <h3>
                {batchGroup} batch {selected.batch_no} — {selected.mandal || "—"}
              </h3>
              <div className="tr-batch-meta">
                <span className="tr-batch-loc">
                  Location:
                  <select
                    className="tr-loc-select"
                    value={locationChoice}
                    onChange={(e) => setLocationChoice(e.target.value)}
                  >
                    <option value="">— not assigned —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.location_name}
                        {l.panchayat ? ` (${l.panchayat})` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="p1-mini-btn" disabled={savingLocation} onClick={saveLocation}>
                    {savingLocation ? "Saving…" : "Save location"}
                  </button>
                </span>
                <span> · {selected.member_count ?? 0} members</span>
                {locations.length === 0 && (
                  <span className="tr-loc-warn">
                    No training locations for mandal “{selected.mandal}”. Import Kakinada locations first.
                  </span>
                )}
              </div>
            </div>

            <div className="tr-panel">
              <div className="tr-panel-head">
                <span className="tr-label">
                  Members — {members.length} officer{members.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="tr-table-wrap">
                <table className="tr-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Designation</th>
                      <th>Team (Stage 2)</th>
                      <th>Duty mandal (Stage 3)</th>
                      <th>Booth (Stage 3)</th>
                      <th>Work mandal</th>
                      <th>Working Office Address</th>
                      <th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((m) => (
                      <tr key={m.personnel_id}>
                        <td className="tr-cell">{m.employee_id || "—"}</td>
                        <td className="tr-cell">{m.employee_name || "—"}</td>
                        <td className="tr-cell">{m.role || "—"}</td>
                        <td className="tr-cell">{m.designation || "—"}</td>
                        <td className="tr-cell">{m.team_code || "—"}</td>
                        <td className="tr-cell">{m.duty_mandal || "—"}</td>
                        <td className="tr-cell">{m.venue_code || "—"}</td>
                        <td className="tr-cell">{m.work_mandal || "—"}</td>
                        <td className="tr-cell">{m.working_office_address || "—"}</td>
                        <td className="tr-cell">{m.mobile_no || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginated.length === 0 && <div className="tr-empty">No members in this batch.</div>}
                {page * PAGE_SIZE < members.length && (
                  <div className="p1-page-info">
                    <button type="button" className="p1-mini-btn" onClick={() => setPage(page + 1)}>
                      Show more
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
