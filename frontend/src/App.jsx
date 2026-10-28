import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "./contexts/ToastContext";
import { FileSessionProvider } from "./contexts/FileSessionContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Pricing from "./pages/Pricing";
import Subscription from "./pages/Subscription";
import Profiler from "./pages/Profiler";
import Cleaner from "./pages/Cleaner";
import Visualize from "./pages/Visualize";
import Report from "./pages/Report";
import Docs from "./pages/Docs";
import Pipeline from "./pages/Pipeline";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ExpiredProBanner from "./components/ExpiredProBanner";
import ErrorBoundary from "./components/ErrorBoundary";

// ===================== Protected Route =====================
function RequireAuth({ children }) {
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      showToast("Vui lòng đăng nhập để tiếp tục sử dụng tính năng này.", "warning");
    }
  }, []);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ===================== Guest Only =====================
function GuestOnly({ children }) {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard/profiler" replace />;
  }

  return children;
}

// ===================== Public Layout =====================
// Navbar on top, page content below via <Outlet>
function PublicLayout() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Navbar />
      <main className="flex-1 relative">
        <Outlet />
      </main>
    </div>
  );
}

// ===================== Dashboard Layout =====================
// Sidebar (desktop) + mobile bottom Navbar, page content via <Outlet>
function DashboardLayout() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex md:flex-row max-md:flex-col">
      {/* Sidebar for Desktop */}
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden max-md:pb-16">
        {/* Top Navbar for Mobile only */}
        <div className="md:hidden">
          <Navbar />
        </div>

        {/* Expired Pro Banner */}
        <ExpiredProBanner />

        <main className="flex-1 relative overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// ===================== App Routes =====================
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ── Public pages with Navbar ── */}
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={<LandingPage />}
        />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/docs" element={<Docs />} />
      </Route>

      {/* ── Dashboard pages with Sidebar (single RequireAuth wrapper) ── */}
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Navigate to="profiler" replace />} />
        <Route path="profiler" element={<Profiler />} />
        <Route path="cleaner" element={<Cleaner />} />
        <Route path="visualize" element={<Visualize />} />
        <Route path="report" element={<Report />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="pipeline/:step" element={<Pipeline />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>

      {/* ── Redirect shims for old flat URLs ── */}
      <Route path="/profiler" element={<Navigate to="/dashboard/profiler" replace />} />
      <Route path="/cleaner" element={<Navigate to="/dashboard/cleaner" replace />} />
      <Route path="/visualize" element={<Navigate to="/dashboard/visualize" replace />} />
      <Route path="/report" element={<Navigate to="/dashboard/report" replace />} />
      <Route path="/pipeline" element={<Navigate to="/dashboard/pipeline" replace />} />
      <Route path="/pipeline/:step" element={<Navigate to="/dashboard/pipeline" replace />} />
      <Route path="/home" element={<Navigate to="/dashboard/profiler" replace />} />
      <Route path="/ua_profiler" element={<Navigate to="/dashboard/profiler" replace />} />
      <Route path="/ua_cleaner" element={<Navigate to="/dashboard/cleaner" replace />} />
      <Route path="/ua_visualize" element={<Navigate to="/dashboard/visualize" replace />} />
      <Route path="/how-it-works" element={<Navigate to="/" replace />} />
      <Route path="/demo" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ===================== App =====================
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FileSessionProvider>
          <AppRoutes />
        </FileSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;