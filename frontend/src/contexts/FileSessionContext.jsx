import { createContext, useContext, useState } from "react";

const FileSessionContext = createContext(null);

const SESSION_KEY = "datamind_session";

const defaultSession = {
  fileHash: null,
  fileName: null,
  profileData: null,
  overrides: {},
  sessionId: null,
  statisticalSummary: null,
  confirmedCharts: null,
  capabilities: null,
  warnings: [],
  userContext: null,
};

export function FileSessionProvider({ children }) {
  const [fileSession, setFileSession] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : defaultSession;
    } catch {
      return defaultSession;
    }
  });

  const updateFileSession = (updates) => {
    setFileSession((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearFileSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setFileSession(defaultSession);
    window.dispatchEvent(new Event("datamind:session-cleared"));
  };

  return (
    <FileSessionContext.Provider value={{ fileSession, updateFileSession, clearFileSession }}>
      {children}
    </FileSessionContext.Provider>
  );
}

export function useFileSession() {
  const ctx = useContext(FileSessionContext);
  if (!ctx) {
    throw new Error("useFileSession must be used within a FileSessionProvider");
  }
  return ctx;
}
