import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "./contexts/ToastContext";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Wallet from "./pages/Wallet";
import Profiler from "./pages/Profiler";
import HowItWorks from "./pages/HowItWorks";
import Demo from "./pages/Demo";
import Docs from "./pages/Docs";

import Navbar from "./components/Navbar";

const HIDDEN_NAVBAR_PATHS = ["/wallet"];

// ===================== Protected Route =====================
function RequireAuth({ children }) {
  const location = useLocation();
  const { showToast } = useToast();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      showToast("Bạn cần đăng nhập để sử dụng tính năng này.", "warning");
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

  const showNavbar = !HIDDEN_NAVBAR_PATHS.includes(location.pathname);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col">
      {showNavbar && <Navbar />}

      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={<Login />} />

<Route path="/register" element={<Register />} />

          {/* Protected */}
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

          <Route
            path="/how-it-works"
            element={
              <RequireAuth>
                <HowItWorks />
              </RequireAuth>
            }
          />

          <Route
            path="/demo"
            element={
              <RequireAuth>
                <Demo />
              </RequireAuth>
            }
          />

          <Route
            path="/docs"
            element={
              <RequireAuth>
                <Docs />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ===================== App =====================
function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;