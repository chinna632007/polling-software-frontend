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
