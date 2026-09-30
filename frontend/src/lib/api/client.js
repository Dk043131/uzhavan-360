export const API_BASE = (process.env.REACT_APP_API_URL || (process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : "")).replace(/\/$/, "");

const TOKEN_KEY = "uzhavan_token";
const USER_KEY = "uzhavan_user";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  getUser: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const friendly = (status, message) => {
  if (status === 0) return "Cannot reach the Uzhavan 360 API. Check your connection and try again.";
  if (status === 429) return "Too many requests. Please slow down and try again shortly.";
  if (status >= 500) return message || "The Uzhavan 360 server hit a problem. Please try again.";
  return message;
};

async function request(path, { method = "GET", body, params, signal } = {}) {
  if (!API_BASE) throw new ApiError("API URL is not configured. Set REACT_APP_API_URL in the frontend env file.", 0);
  const query = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)).toString() : "";
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}${query ? `?${query}` : ""}`;
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(friendly(0), 0);
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    tokenStore.clear();
    onUnauthorized?.();
    throw new ApiError(payload.error || "Your session has ended. Please log in again.", 401, payload.details);
  }
  if (!response.ok || payload.success === false) {
    const detailText = Array.isArray(payload.details) ? payload.details.map((d) => d.message || d).join(" ") : "";
    throw new ApiError(friendly(response.status, [payload.error || payload.message, detailText].filter(Boolean).join(" ")) || "Request failed.", response.status, payload.details);
  }
  return payload.data !== undefined ? payload.data : payload;
}

export const http = {
  get: (path, params, opts) => request(path, { params, ...opts }),
  post: (path, body, opts) => request(path, { method: "POST", body: body ?? {}, ...opts }),
  put: (path, body, opts) => request(path, { method: "PUT", body: body ?? {}, ...opts }),
  patch: (path, body, opts) => request(path, { method: "PATCH", body: body ?? {}, ...opts }),
  delete: (path, opts) => request(path, { method: "DELETE", ...opts }),
};
