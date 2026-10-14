  /**
 * Thin fetch wrapper around the polling-duty backend.
 *
 * All requests are same-origin through the Vite dev proxy ("/api" -> backend,
 * see vite.config.js). `credentials: "include"` is REQUIRED because the backend
 * authenticates with an express-session cookie (connect.sid).
 *
 * Backend response convention: `{ ok: true, ... }` on success,
 * `{ ok: false, error: "message" }` on failure.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/** Error carrying the HTTP status and the raw backend payload (if any). */
export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Core request helper. Throws ApiError on network failure, non-2xx status, or
 * an `{ ok: false }` body — so callers only handle the happy path.
 */
export async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new ApiError(
      "Cannot reach the server. Is the backend running?",
      0,
      cause
    );
  }

  const data = await parseResponse(res);

  if (!res.ok || (data && data.ok === false)) {
    const message =
      (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}

/** Read a File as a base64 string (no data-URL prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new ApiError("Could not read the selected file.", 0));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------- Auth ---------------------------------- */

/** Fetch the captcha SVG markup. Backend also stores the answer in session. */
export function getCaptcha(signal) {
  return fetch(`${API_BASE}/auth/captcha`, { credentials: "include", signal }).then(
    (res) => {
      if (!res.ok) {
        throw new ApiError(`Failed to load captcha (${res.status})`, res.status);
      }
      return res.text();
    }
  );
}

export const login = (creds) =>
  request("/auth/login", { method: "POST", body: creds });

export const logout = () => request("/auth/logout", { method: "POST" });

export const me = () => request("/auth/me");

/* ------------------------------ Imports -------------------------------- */

/** Upload one personnel proforma workbook (base64 JSON payload). */
export function uploadPersonnel(file, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/personnel",
      { method: "POST", body: { fileName: file.name, dataBase64 }, signal }
    )
  );
}

export const listBatches = () => request("/imports/batches");

export const getBatchPersonnel = (id) =>
  request(`/imports/batches/${id}/personnel`);

export const getBatchRejected = (id) =>
  request(`/imports/batches/${id}/rejected`);

/* --------------------------- Polling stations ---------------------------- */

/** Import polling stations (validated JSON array shaped like the 003 schema). */
export const importStations = (fileName, stations) =>
  request('/master-data/stations', { method: 'POST', body: { fileName, stations } });

/** List polling stations (paginated server-side; page/limit optional). */
export const listStations = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.batchId) qs.set('batchId', params.batchId);
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  const q = qs.toString() ? `?${qs}` : '';
  return request(`/master-data/stations${q}`);
};

/** List station import batches (kind='polling_stations'). */
export const listStationBatches = () => request('/master-data/stations/batches');

/* ---------------------------- Randomization ------------------------------ */

/**
 * Run the full allocation chain (Stage 1 -> Stage 2 + MO -> Stage 3).
 * Body: { electionConfiguration, designationRules, officeIdOverrides,
 *         personnelImportBatchId, stationImportBatchId, districtId, seed }.
 */
export const runAllocation = (body) =>
  request('/randomization/run', { method: 'POST', body });

/** Authorised disclosure of a completed Stage 3 mapping (records confirmer). */
export const publishAllocation = (stage3Run) =>
  request('/randomization/publish', { method: 'POST', body: { stage3Run } });

/* ----------------------------- Notifications ----------------------------- */

/** Provider/channel configuration status (read-only for all auth'd users). */
export const notificationChannels = () => request('/notifications/channels');

/** Render per-recipient messages without sending (authority/admin). */
export const previewNotifications = (body) =>
  request('/notifications/preview', { method: 'POST', body });

/** Authorised dispatch; requires confirmAllocation: true in body. */
export const sendNotifications = (body) =>
  request('/notifications/send', { method: 'POST', body });

/** Delivery-attempt records (authority/admin). */
export const notificationDeliveries = () => request('/notifications/deliveries');

/* -------------------------------- Reports -------------------------------- */

/** Last allocation run report (authority/admin). */
export const allocationReport = () => request('/reports/allocation');

/** Import data counts (all authenticated roles). */
export const summaryReport = () => request('/reports/summary');

/* -------------------------------- Training ------------------------------- */

/** List training sessions (all authenticated users). */
export const listTrainingSessions = () => request('/training/sessions');

/** Create a training session (authority/admin). */
export const createTrainingSession = (body) =>
  request('/training/sessions', { method: 'POST', body });

/** Attendance for one session (all authenticated users). */
export const trainingAttendance = (id) =>
  request(`/training/sessions/${id}/attendance`);

/** Mark attendance records (authority/admin). Body: { records: [...] }. */
export const markTrainingAttendance = (id, records) =>
  request(`/training/sessions/${id}/attendance`, {
    method: 'POST',
    body: { records },
  });
