// @refresh reset
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

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
  uploadedAt: null,  // epoch ms — used for the 1-hour file expiry countdown
  chartExplanations: {},  // { [chartId]: { content, source, lang } }
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

    // Xóa phiên file khi đăng xuất hoặc đổi sang tài khoản khác
  const { user } = useAuth();
  const prevOwnerRef = useRef(user?.id ?? user?.email ?? null);
  useEffect(() => {
    const currentOwner = user?.id ?? user?.email ?? null;
    if (prevOwnerRef.current !== currentOwner) {
      clearFileSession();
    }
    prevOwnerRef.current = currentOwner;
  }, [user]);

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
