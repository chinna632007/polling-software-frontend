/**
 * Training – batch management (no time slots, no randomization).
 *
 * Data: real `training_batches` / `training_batch_members` tables in the DB.
 *   GET  /api/training/batches              list batches (mandal + location)
 *   GET  /api/training/batches/:id/members  batch members
 *
 * Each batch: one location, one mandal, <=100 officers, code-assigned and
 * randomized by the backend (never touched by the UI). The UI supports
 * READ + REMOVE-ROLE (admin reassigns a member / adds a note) — the random
 * redistribution itself is unchanged.
 */

import { useEffect, useState } from "react";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import {
  listTrainingBatches,
  getBatchMembers,
  removeBatchMember,
  getBatchLocations,
  assignBatchLocation,
  fileToBase64,
  allocateTrainingOrders,
  printTrainingOrder,
  listTrainingOrders,
  downloadTrainingOrder,
} from "../api/client.js";

const PAGE_SIZE = 20;

// Icons (only the ones this page uses).
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

export default function Training() {
  const [batches, setBatches] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [page, setPage] = useState(1);
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const [removeCandidateName, setRemoveCandidateName] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationChoice, setLocationChoice] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  // --- Training orders (PO/APO DOCX generation, migration 011) --------------
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderGroup, setOrderGroup] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [allocateMsg, setAllocateMsg] = useState(null);
  const [printGroup, setPrintGroup] = useState("PO");
  const [printMandal, setPrintMandal] = useState("");
  const [printVenue, setPrintVenue] = useState("");
  const [printDateTime, setPrintDateTime] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadOrders = async (group) => {
    try {
      setError(null);
      const data = await listTrainingOrders({ group: group || undefined, perPage: 50 });
      setOrders(data.orders || []);
      setOrdersTotal(data.total ?? (data.orders || []).length);
    } catch (e) {
      setError(e.message || "Failed to load training orders");
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
      setAllocateMsg(
        errs.length > 0
          ? `Allocation finished with issues: ${errs.join("; ")}`
          : `Allocated ${n} PO/APO batch${n === 1 ? "" : "es"} from the last run.`
      );
      loadBatches();
    } catch (e) {
      setError(e.message || "Allocation failed");
    } finally {
      setAllocating(false);
    }
  };

  const runPrint = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("tr-template-file");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      setPrintMsg("Choose a .docx template file first.");
      return;
    }
    try {
      setError(null);
      setPrintMsg(null);
      setPrinting(true);
      const templateBase64 = await fileToBase64(file);
      const data = await printTrainingOrder({
        templateBase64,
        trainingGroup: printGroup,
        mandal: printMandal || undefined,
        venue: printVenue || undefined,
        dateTime: printDateTime || undefined,
      });
      const orderId = data.order && (data.order.order_id || data.order.id);
      setPrintMsg(`Order ${orderId || ""} generated (${data.document?.docx_bytes ?? "?"} bytes).`);
      loadOrders(orderGroup);
    } catch (err) {
      setPrintMsg(null);
      setError(err.message || "Print failed");
    } finally {
      setPrinting(false);
    }
  };

  const runDownload = async (id) => {
    try {
      setError(null);
      setDownloadingId(id);
      await downloadTrainingOrder(id);
    } catch (e) {
      setError(e.message || "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const loadBatches = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await listTrainingBatches();
      setBatches(data.batches || []);
    } catch (e) {
      setError(e.message || "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (id) => {
    try {
      setError(null);
      const [data, locData] = await Promise.all([
        getBatchMembers(id),
        getBatchLocations(id).catch(() => ({ locations: [] })),
      ]);
      setMembers(data.members || []);
      setLocations(Array.isArray(locData?.locations) ? locData.locations : []);
      const current = batches.find((b) => b.id === id);
      setLocationChoice(current && current.location_id ? String(current.location_id) : "");
      setRemoveCandidateId(null);
      setRemoveCandidateName(null);
      setSelectedBatchId(id);
      setConfirmingRemove(false);
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
      await assignBatchLocation(selectedBatchId, locationId);
      await loadBatches();
    } catch (e) {
      setError(e.message || "Failed to assign location");
    } finally {
      setSavingLocation(false);
    }
  };

  const removeMember = async () => {
    if (removeCandidateId == null || selectedBatchId == null) return;
    try {
      setError(null);
      await removeBatchMember(selectedBatchId, removeCandidateId);
      // Reload members + batches so counts stay accurate and persisted.
      await loadMembers(selectedBatchId);
      await loadBatches();
      setRemoveCandidateId(null);
      setRemoveCandidateName(null);
      setConfirmingRemove(false);
    } catch (e) {
      setError(e.message || "Failed to remove member from batch");
      setConfirmingRemove(false);
    }
  };

  const filtered = members;

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = batches.find((b) => b.id === selectedBatchId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listTrainingBatches();
        if (cancelled) return;
        setBatches(Array.isArray(data?.batches) ? data.batches : []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load batches");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="tr-page p1-page">
      <Header />

      <main className="p1-content">
        <section className="p1-card" aria-label="Training orders">
          <div className="p1-card-head">
            <span className="p1-card-title">Training orders (PO / APO)</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={orderGroup}
                onChange={(e) => { setOrderGroup(e.target.value); loadOrders(e.target.value); }}
                aria-label="Filter orders by group"
              >
                <option value="">All groups</option>
                <option value="PO">PO</option>
                <option value="APO">APO</option>
              </select>
              <button
                type="button"
                className="p1-mini-btn"
                disabled={allocating}
                onClick={runAllocate}
                title="Allocate separate PO/APO batches from the last randomization run"
              >
                {allocating ? "Allocating..." : "Allocate PO/APO"}
              </button>
            </div>
          </div>
          {allocateMsg && <div className="p1-note" role="status">{allocateMsg}</div>}
          <form onSubmit={runPrint} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
            <label>
              Template (.docx)&nbsp;
              <input id="tr-template-file" type="file" accept=".docx" />
            </label>
            <label>
              Group&nbsp;
              <select value={printGroup} onChange={(e) => setPrintGroup(e.target.value)}>
                <option value="PO">PO</option>
                <option value="APO">APO</option>
              </select>
            </label>
            <label>
              Mandal&nbsp;
              <input value={printMandal} onChange={(e) => setPrintMandal(e.target.value)} placeholder="e.g. Kakinada Rural" />
            </label>
            <label>
              Venue&nbsp;
              <input value={printVenue} onChange={(e) => setPrintVenue(e.target.value)} placeholder="Training venue" />
            </label>
            <label>
              Date / time&nbsp;
              <input value={printDateTime} onChange={(e) => setPrintDateTime(e.target.value)} placeholder="2026-10-20 10:00" />
            </label>
            <button type="submit" className="p1-mini-btn" disabled={printing}>
              {printing ? "Printing..." : "Print order (DOCX)"}
            </button>
          </form>
          {printMsg && <div className="p1-note" role="status">{printMsg}</div>}
          <div className="tr-table-wrap">
            <table className="tr-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Group</th>
                  <th>Mandal</th>
                  <th>Venue</th>
                  <th>Date / time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="tr-cell">{o.order_id}</td>
                    <td className="tr-cell">{o.training_group}</td>
                    <td className="tr-cell">{o.mandal || "-"}</td>
                    <td className="tr-cell">{o.venue || "-"}</td>
                    <td className="tr-cell">{o.date_time || "-"}</td>
                    <td className="tr-cell">{o.status}</td>
                    <td className="tr-cell">
                      <button
                        type="button"
                        className="p1-mini-btn"
                        disabled={downloadingId === o.id}
                        onClick={() => runDownload(o.id)}
                      >
                        {downloadingId === o.id ? "Saving..." : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <div className="tr-empty">No training orders yet. Allocate, then print.</div>}
            {ordersTotal > orders.length && (
              <div className="p1-page-info">Showing {orders.length} of {ordersTotal}.</div>
            )}
          </div>
        </section>

        <div className="tr-bulk">
          <div className="tr-bulk-head">
            <span className="tr-bulk-title">
              <UsersIcon /> Training batches
            </span>
            <span className="tr-hint">
              Code-assigned batches per mandal, one location each. Randomisation
              is handled by the backend; the UI only reads and edits that each
              batch stays within its own mandal.
            </span>
          </div>

          {loading && <div className="tr-loading">Loading batches…</div>}
          {!loading && error && <div className="tr-error">{error}</div>}

          {!loading && !error && (
            <div className="tr-table-wrap">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Mandal</th>
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
              {batches.length === 0 && <div className="tr-empty">No batches yet. Import personnel first, then create batches.</div>}
            </div>
          )}
        </div>

        {selectedBatchId && (
          <section className="tr-batch">
            <div className="tr-batch-head">
              <button
                type="button"
                className="p1-back-btn"
                onClick={() => setSelectedBatchId(null)}
              >
                <ChevronLeft /> Back to batches
              </button>
              <h3>Batch {selected.batch_no} — {selected.mandal || "—"}</h3>
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
                  <button
                    type="button"
                    className="p1-mini-btn"
                    disabled={savingLocation}
                    onClick={saveLocation}
                  >
                    {savingLocation ? "Saving…" : "Save location"}
                  </button>
                </span>
                <span> · {selected.member_count ?? 0} members</span>
                {locations.length === 0 && (
                  <span className="tr-loc-warn">
                    No training locations imported for mandal “{selected.mandal}”.
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
                      <th>ID</th>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Native mandal</th>
                      <th>Work mandal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((m) => (
                      <tr key={m.personnel_id}>
                        <td className="tr-cell">{m.personnel_id}</td>
                        <td className="tr-cell">{m.employee_id || "—"}</td>
                        <td className="tr-cell">{m.employee_name || "—"}</td>
                        <td className="tr-cell">{m.designation || "—"}</td>
                        <td className="tr-cell">{m.native_mandal || "—"}</td>
                        <td className="tr-cell">{m.work_mandal || "—"}</td>
                        <td className="tr-cell">
                          <button
                            type="button"
                            className="p1-mini-btn"
                            onClick={() => {
                              setRemoveCandidateId(m.personnel_id);
                              setRemoveCandidateName(m.employee_name || "");
                              setConfirmingRemove(true);
                            }}
                          >
                            Remove
                          </button>
                          {confirmingRemove && removeCandidateId === m.personnel_id && (
                            <div className="tr-remove-confirm">
                              <div>Remove <strong>{removeCandidateName || m.employee_name || m.personnel_id}</strong> from this batch?</div>
                              <div className="tr-remove-actions">
                                <button
                                  type="button"
                                  className="p1-mini-btn"
                                  onClick={() => setConfirmingRemove(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="p1-mini-btn is-danger"
                                  onClick={removeMember}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginated.length === 0 && <div className="tr-empty">No members in this batch.</div>}
                {page * PAGE_SIZE < filtered.length && (
                  <div className="p1-page-info">
                    <button type="button" className="p1-mini-btn" onClick={() => setPage(page + 1)}>Show more</button>
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
