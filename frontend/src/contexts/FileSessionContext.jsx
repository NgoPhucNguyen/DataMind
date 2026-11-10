// @refresh reset
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { getPalette } from "../utils/chartPalettes";
import { getStoredSettings } from "../hooks/useSettings";

const FileSessionContext = createContext(null);

const SESSION_KEY = "datamind_session";

const createDefaultSession = () => ({
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
  uploadedAt: null,  // epoch ms
  fileExpiresAt: null, // ISO string from backend (Redis actual expiration)
  chartExplanations: {},  // { [chartId]: { content, source, lang } }
  chartSettings: {},  // { [chartId]: { display_type, top_n, sort, hide_zero } }
  chartPalette: getStoredSettings().defaultChartPalette || "datamind",
  reportSectionsIncluded: {
    overview: true,
    key_findings: true,
    methodology: true,
    detailed_analysis: true,
    appendix: true,
  },
  reportCover: {
    enabled: true,
    toc: true,
    title: "",
    author: "",
    organization: "",
    date: "",
  },
});

export function FileSessionProvider({ children }) {
  const [fileSession, setFileSession] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...createDefaultSession(),
          ...parsed,
          chartPalette: getPalette(parsed.chartPalette || getStoredSettings().defaultChartPalette).id,
        };
      }
      return createDefaultSession();
    } catch {
      return createDefaultSession();
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
    setFileSession(createDefaultSession());
    window.dispatchEvent(new Event("datamind:session-cleared"));
  };

    // Xóa phiên file khi đăng xuất chủ động hoặc đổi sang tài khoản khác.
    // Không xóa khi token hết hạn (session expired) để bảo toàn tiến độ làm việc của người dùng.
  const { user } = useAuth();
  const prevOwnerRef = useRef(user?.id ?? user?.email ?? null);
  useEffect(() => {
    const currentOwner = user?.id ?? user?.email ?? null;
    const isExpired =
      typeof window !== "undefined" &&
      sessionStorage.getItem("datamind_session_expired") === "true";

    if (prevOwnerRef.current && currentOwner && prevOwnerRef.current !== currentOwner) {
      // Đổi sang tài khoản người dùng khác -> xóa phiên cũ
      clearFileSession();
      prevOwnerRef.current = currentOwner;
    } else if (prevOwnerRef.current && !currentOwner) {
      // Chuyển sang chưa đăng nhập: chỉ xóa nếu KHÔNG PHẢI do token expired
      if (!isExpired) {
        clearFileSession();
        prevOwnerRef.current = null;
      }
      // Khi token expired, giữ nguyên prevOwnerRef để đối chiếu khi login lại
    } else if (!prevOwnerRef.current && currentOwner) {
      prevOwnerRef.current = currentOwner;
    }
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

export function getIncludedSections(fileSession) {
  return {
    overview: true,
    key_findings: true,
    methodology: true,
    detailed_analysis: true,
    appendix: true,
    ...(fileSession?.reportSectionsIncluded || {}),
  };
}

export const DEFAULT_REPORT_COVER = {
  enabled: true,
  toc: true,
  title: "",
  author: "",
  organization: "",
  date: "",
};

export function getCoverSettings(fileSession) {
  return {
    ...DEFAULT_REPORT_COVER,
    ...(fileSession?.reportCover || {}),
  };
}
