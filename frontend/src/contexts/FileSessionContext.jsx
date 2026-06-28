import { createContext, useContext, useState } from "react";

const FileSessionContext = createContext(null);

export function FileSessionProvider({ children }) {
  const [fileSession, setFileSession] = useState({
    fileHash: null,
    fileName: null,
    profileData: null,
    overrides: {},
    sessionId: null,
    statisticalSummary: null,
    confirmedCharts: null,
  });

  const updateFileSession = (updates) => {
    setFileSession((prev) => ({ ...prev, ...updates }));
  };

  const clearFileSession = () => {
    setFileSession({
      fileHash: null,
      fileName: null,
      profileData: null,
      overrides: {},
      sessionId: null,
      statisticalSummary: null,
      confirmedCharts: null,
    });
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
