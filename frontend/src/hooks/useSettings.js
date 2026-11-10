import { useState, useEffect, useCallback } from "react";
import { getPalette } from "../utils/chartPalettes";

const SETTINGS_KEY = "datamind_settings";
const SETTINGS_EVENT = "datamind:settings-updated";

const DEFAULT_SETTINGS = {
  defaultChartPalette: "datamind",
  aiConfirm: true,
};

/**
 * Read settings synchronously from localStorage with safe fallback.
 */
export function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultChartPalette: getPalette(parsed?.defaultChartPalette).id,
        aiConfirm: parsed?.aiConfirm !== false, // default true
      };
    }
  } catch (err) {
    console.warn("Failed to read datamind_settings:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage and dispatch custom event for all listeners.
 */
export function saveStoredSettings(newSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: newSettings }));
    }
  } catch (err) {
    console.warn("Failed to save datamind_settings:", err);
  }
}

/**
 * React hook to read and update DataMind user settings.
 */
export function useSettings() {
  const [settings, setSettings] = useState(getStoredSettings);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e?.detail) {
        setSettings(e.detail);
      } else {
        setSettings(getStoredSettings());
      }
    };

    window.addEventListener(SETTINGS_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateSettings = useCallback((partial) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...partial,
        defaultChartPalette: partial.defaultChartPalette
          ? getPalette(partial.defaultChartPalette).id
          : prev.defaultChartPalette,
        aiConfirm: partial.aiConfirm !== undefined ? Boolean(partial.aiConfirm) : prev.aiConfirm,
      };

      // If aiConfirm is toggled back on, clear the "Don't ask again today" flag
      if (prev.aiConfirm === false && next.aiConfirm === true) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          localStorage.removeItem(`datamind_ai_skip_confirm_${today}`);
        } catch (_) {}
      }

      saveStoredSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}

export default useSettings;

