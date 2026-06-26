import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useToast } from "./contexts/ToastContext";
import { useEffect } from "react";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Wallet from "./pages/Wallet";
import Profiler from "./pages/Profiler";

// ── Protected Route ────────────────────────────────────────
// Nếu chưa đăng nhập → redirect /login + hiển thị toast cảnh báo
function RequireAuth({ children }) {
  const location = useLocation();
  const { showToast } = useToast();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      showToast("Bạn cần đăng nhập để sử dụng tính năng này.", "warning");
    }
  }, []);  // chỉ chạy khi component mount

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ── Guest Only Route ───────────────────────────────────────
// Nếu đã đăng nhập mà vào /login hay /register → redirect /home
function GuestOnly({ children }) {
  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

// ── App ───────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes ── */}
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />

        <Route
          path="/register"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />

        {/* ── Protected routes ── */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />

        <Route
          path="/pricing"
          element={
            <RequireAuth>
              <Pricing />
            </RequireAuth>
          }
        />

        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <Wallet />
            </RequireAuth>
          }
        />

        <Route
          path="/profiler"
          element={
            <RequireAuth>
              <Profiler />
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
