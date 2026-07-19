import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
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
import Wallet from "./pages/Wallet";
import Profiler from "./pages/Profiler";
import Cleaner from "./pages/Cleaner";
import Visualize from "./pages/Visualize";
import Report from "./pages/Report";
import Docs from "./pages/Docs";
import Pipeline from "./pages/Pipeline";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

// /profiler is accessible without login (upload will gate on its own)
const PUBLIC_PATHS = ["/", "/login", "/register", "/docs", "/pricing", "/profiler", '/cleaner', '/visualize', '/pipeline'];
const HIDDEN_NAVBAR_PATHS = [];

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
    return <Navigate to="/profiler" replace />;
  }

  return children;
}

// ===================== Layout =====================
function Layout() {
  const location = useLocation();
  const { user } = useAuth();

  // Determine if we're on a public page
  const isPublic = PUBLIC_PATHS.includes(location.pathname);

  // Show Navbar on public pages
  const showNavbar = isPublic && !HIDDEN_NAVBAR_PATHS.includes(location.pathname);

  // Show Sidebar only when logged in AND on a protected page
  const showSidebar = !isPublic && !!user;

  return (
    <div className={`min-h-screen bg-canvas text-ink flex ${showSidebar ? "md:flex-row max-md:flex-col" : "flex-col"}`}>
      {/* Sidebar for Dashboard */}
      {showSidebar && <Sidebar />}

      <div className={`flex-1 flex flex-col ${showSidebar ? "h-screen overflow-hidden max-md:pb-16" : ""}`}>
        {/* Top Navbar for Public pages (or mobile Dashboard) */}
        {(showNavbar || showSidebar) && (
          <div className={showSidebar ? "md:hidden" : ""}>
            <Navbar />
          </div>
        )}

        <main className={`flex-1 relative ${showSidebar ? "overflow-y-auto" : ""}`}>
          <Routes>
            {/* Public — redirect logged-in users straight to dashboard */}
            <Route
              path="/"
              element={user ? <Navigate to="/profiler" replace /> : <LandingPage />}
            />

            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />

            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

            <Route path="/pricing" element={<Pricing />} />

            <Route path="/docs" element={<Docs />} />

            {/* Profiler — public browse, upload gates itself */}
            <Route path="/profiler" element={<Profiler />} />

            {/* Protected */}
            <Route
              path="/wallet"
              element={
                <RequireAuth>
                  <Wallet />
                </RequireAuth>
              }
            />

            <Route
              path="/cleaner"
              element={
                <RequireAuth>
                  <Cleaner />
                </RequireAuth>
              }
            />

            <Route
              path="/visualize"
              element={
                <RequireAuth>
                  <Visualize />
                </RequireAuth>
              }
            />

            <Route
              path="/report"
              element={
                <RequireAuth>
                  <Report />
                </RequireAuth>
              }
            />

            <Route
              path="/pipeline"
              element={
                <RequireAuth>
                  <Pipeline />
                </RequireAuth>
              }
            />
            {/* Pipeline sub-routes */}
            <Route
              path="/pipeline/:step"
              element={
                <RequireAuth>
                  <Pipeline />
                </RequireAuth>
              }
            />

            {/* Redirect shims for old URLs */}
            <Route path="/home" element={<Navigate to="/profiler" replace />} />
            <Route path="/ua_profiler" element={<Navigate to="/profiler" replace />} />
            <Route path="/ua_cleaner" element={<Navigate to="/cleaner" replace />} />
            <Route path="/ua_visualize" element={<Navigate to="/visualize" replace />} />
            <Route path="/how-it-works" element={<Navigate to="/" replace />} />
            <Route path="/demo" element={<Navigate to="/" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ===================== App =====================
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FileSessionProvider>
          <Layout />
        </FileSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;