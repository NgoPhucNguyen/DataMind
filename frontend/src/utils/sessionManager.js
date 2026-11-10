/**
 * sessionManager.js
 * Central session expiry and JWT validation logic for DataMind.
 */

let isHandlingExpiry = false;
let authExpiredCallback = null;

/**
 * Register a callback from AuthContext to clear React state synchronously.
 */
export function registerAuthExpiredHandler(callback) {
  authExpiredCallback = callback;
}

/**
 * Decodes a JWT payload safely without external dependencies.
 */
export function parseJwt(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Checks whether a JWT token is expired (or will expire within thresholdSeconds).
 */
export function isTokenExpired(token, thresholdSeconds = 5) {
  if (!token) return true;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const nowInSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSec + thresholdSeconds;
}

/**
 * Sanitizes return paths so users can only be redirected to valid internal relative paths.
 * Blocks external URLs, protocol-relative '//', javascript:, and login itself.
 */
export function sanitizeReturnPath(path) {
  if (!path || typeof path !== "string") return "/dashboard/profiler";
  const trimmed = path.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/login") ||
    trimmed.includes(":") ||
    trimmed.toLowerCase().includes("javascript:")
  ) {
    return "/dashboard/profiler";
  }
  return trimmed;
}

/**
 * Handles expired session cleanly:
 * 1. Prevents concurrent duplicate runs (e.g. 3 failed queries at once).
 * 2. Clears token and user state immediately from localStorage.
 * 3. Preserves work session (datamind_session) so working file is NOT lost.
 * 4. Saves return path in `next` parameter and redirects to /login?reason=expired&next=...
 */
export function handleSessionExpired() {
  if (isHandlingExpiry) return;

  const currentPath =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "";

  // If already on /login, simply clean up tokens without redirect loop
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (authExpiredCallback) authExpiredCallback();
    } catch (e) {}
    return;
  }

  isHandlingExpiry = true;

  try {
    sessionStorage.setItem("datamind_session_expired", "true");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (authExpiredCallback) {
      authExpiredCallback();
    }
  } catch (e) {
    // Ignore storage errors in restricted iframe/private mode
  }

  if (typeof window !== "undefined") {
    const returnPath = sanitizeReturnPath(currentPath);
    const target = `/login?reason=expired&next=${encodeURIComponent(returnPath)}`;
    window.location.replace(target);
  }
}

/**
 * Proactively checks stored token on app load or visibility change.
 * If expired, triggers handleSessionExpired() immediately.
 */
export function checkSessionOnStartup() {
  if (typeof window === "undefined") return false;
  try {
    const token = localStorage.getItem("token");
    if (token && isTokenExpired(token)) {
      handleSessionExpired();
      return true;
    }
  } catch (e) {}
  return false;
}

// Proactive tab wake-up check
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkSessionOnStartup();
    }
  });
}

/**
 * Safe fetch wrapper that handles auth headers and automatic expiry handling.
 * Can be used anywhere direct fetch is needed.
 */
export async function authFetch(url, options = {}) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  if (token && isTokenExpired(token)) {
    handleSessionExpired();
    throw new Error("Session expired");
  }

  const headers = { ...options.headers };
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    handleSessionExpired();
    throw new Error("Session expired");
  }
  return response;
}

