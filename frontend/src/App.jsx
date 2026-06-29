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

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Wallet from "./pages/Wallet";
import Profiler from "./pages/Profiler";
import Cleaner from "./pages/Cleaner";
import Visualize from "./pages/Visualize";
import Report from "./pages/Report";
import HowItWorks from "./pages/HowItWorks";
import Demo from "./pages/Demo";
import Docs from "./pages/Docs";
import Pipeline from "./pages/Pipeline";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

const PUBLIC_PATHS = ["/", "/login", "/register", "/how-it-works", "/demo", "/docs", "/pricing"];
const HIDDEN_NAVBAR_PATHS = [];

// ===================== Protected Route =====================
function RequireAuth({ children }) {
  const location = useLocation();
  const { showToast } = useToast();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      showToast("Vui lòng đăng nhập để tiếp tục sử dụng tính năng này.", "warning");
    }
  }, []);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// ===================== Guest Only =====================
function GuestOnly({ children }) {
  const token = localStorage.getItem("token");

  if (token) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

// ===================== Layout =====================
function Layout() {
  const location = useLocation();

  // Xác định xem đang ở Public hay Dashboard (Protected)
  const isPublic = PUBLIC_PATHS.includes(location.pathname);

  // Hiển thị Navbar toàn cục (nếu ở Public và không bị ẩn)
  const showNavbar = isPublic && !HIDDEN_NAVBAR_PATHS.includes(location.pathname);

  // Hiển thị Sidebar (chỉ khi ở Dashboard)
  const showSidebar = !isPublic;

  return (
    <div className={`min-h-screen bg-canvas text-ink flex ${showSidebar ? "md:flex-row max-md:flex-col" : "flex-col"}`}>
      {/* Sidebar cho Dashboard */}
      {showSidebar && <Sidebar />}

      <div className={`flex-1 flex flex-col ${showSidebar ? "h-screen overflow-hidden max-md:pb-16" : ""}`}>
        {/* Top Navbar cho Public pages (hoặc mobile Dashboard) */}
        {(showNavbar || showSidebar) && (
          <div className={showSidebar ? "md:hidden" : ""}>
            <Navbar />
          </div>
        )}

        <main className={`flex-1 relative ${showSidebar ? "overflow-y-auto" : ""}`}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />

            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />

            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

            {/* Protected */}
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />

            <Route path="/pricing" element={<Pricing />} />

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

            {/* Redirect shims for old URLs */}
            <Route path="/ua_profiler" element={<Navigate to="/profiler" replace />} />
            <Route path="/ua_cleaner" element={<Navigate to="/cleaner" replace />} />
            <Route path="/ua_visualize" element={<Navigate to="/visualize" replace />} />

            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/docs" element={<Docs />} />

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
      <FileSessionProvider>
        <Layout />
      </FileSessionProvider>
    </BrowserRouter>
  );
}

export default App;