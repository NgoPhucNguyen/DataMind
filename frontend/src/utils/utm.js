/**
 * utm.js
 * First-touch UTM parameter capture and retrieval.
 */

const UTM_STORAGE_KEY = "datamind_utm";

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str ? str.slice(0, 100) : null;
}

/**
 * Reads utm_source, utm_medium, utm_campaign from window.location.search.
 * First-touch: only stores if no UTM data is currently in localStorage.
 * Trims whitespace and caps each string at 100 characters.
 */
export function captureUtmFromUrl() {
  if (typeof window === "undefined" || !window.location) return;
  try {
    if (localStorage.getItem(UTM_STORAGE_KEY)) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const utm_source = cleanValue(params.get("utm_source"));
    const utm_medium = cleanValue(params.get("utm_medium"));
    const utm_campaign = cleanValue(params.get("utm_campaign"));

    if (utm_source || utm_medium || utm_campaign) {
      const data = {
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
      };
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Safely ignore storage errors
  }
}

/**
 * Returns stored UTM object { utm_source, utm_medium, utm_campaign }
 * Missing fields or errors return null for each property.
 */
export function getStoredUtm() {
  const fallback = { utm_source: null, utm_medium: null, utm_campaign: null };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      utm_source: cleanValue(parsed?.utm_source),
      utm_medium: cleanValue(parsed?.utm_medium),
      utm_campaign: cleanValue(parsed?.utm_campaign),
    };
  } catch {
    return fallback;
  }
}

