import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getUser, getMySubscription } from "../services/authService";
import { isTokenExpired, registerAuthExpiredHandler } from "../utils/sessionManager";

// ── Context ───────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────
export function AuthProvider({ children }) {
  // Initialise from localStorage only if stored token is not expired
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    if (!token || isTokenExpired(token)) {
      return null;
    }
    return getUser();
  });
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    registerAuthExpiredHandler(() => {
      setUser(null);
      setSubscription(null);
    });
  }, []);

  const reloadSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      return;
    }
    try {
      const data = await getMySubscription();
      setSubscription(data);
    } catch (err) {
      console.error("Failed to load subscription:", err);
    }
  }, [user]);

  useEffect(() => {
    reloadSubscription();
  }, [reloadSubscription]);

  const login = useCallback((userData, token) => {
    sessionStorage.removeItem("datamind_session_expired");
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("datamind_session_expired");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSubscription(null);
  }, []);

  const token = user ? localStorage.getItem("token") : null;

  return (
    <AuthContext.Provider value={{ user, token, subscription, login, logout, reloadSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
