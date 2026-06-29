import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout } from "../services/authService";
import { LayoutDashboard, FileSearch, Wand2, PieChart, Workflow, ChevronLeft, ChevronRight, LogOut } from "lucide-react";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const menuItems = [
    { path: "/home", label: "Tổng quan", icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: "/ua_profiler", label: "Phân tích thủ công", icon: <FileSearch className="w-5 h-5" /> },
    { path: "/ua_cleaner", label: "Làm sạch thủ công", icon: <Wand2 className="w-5 h-5" /> },
    { path: "/ua_visualize", label: "Trực quan hóa", icon: <PieChart className="w-5 h-5" /> },
    { path: "/pipeline", label: "Tự động hóa", icon: <Workflow className="w-5 h-5" /> },
  ];

  return (
    <div
      className={`bg-canvas border-border transition-all duration-300 flex z-50 shrink-0
        max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-full max-md:h-16 max-md:flex-row max-md:border-t
        md:flex-col md:border-r md:h-screen ${isCollapsed ? "md:w-16" : "md:w-64"}
      `}
    >
      {/* Header / Logo */}
      <div className="md:h-20 flex items-center justify-between px-4 md:border-b md:border-border shrink-0 max-md:hidden">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <span className="font-bold text-lg text-ink">
              Data<span className="text-forest">Mind</span>
            </span>
          </Link>
        )}
        {isCollapsed && (
          <Link to="/" className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto">
            <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted hover:text-ink transition-colors p-1"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 md:py-4 flex max-md:flex-row max-md:items-center max-md:justify-around md:flex-col md:gap-2 md:px-2 md:overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center md:gap-3 max-md:flex-col max-md:justify-center px-3 py-2.5 max-md:h-full max-md:w-full transition-all md:rounded-xl ${isActive
                ? "md:bg-sage text-forest font-semibold"
                : "text-muted hover:bg-sage/40 hover:text-ink"
                }`}
              title={isCollapsed ? item.label : ""}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className={`font-medium text-[10px] md:text-sm truncate max-md:mt-1 ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div className="md:border-t md:border-border p-3 shrink-0 max-md:hidden">
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-border">
            <div className="w-10 h-10 rounded-full bg-forest flex items-center justify-center text-white font-bold shrink-0">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-ink truncate">{user.full_name || "User"}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="text-muted hover:text-red-600 transition-colors p-1"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="mt-2 w-full text-muted hover:text-red-600 transition-colors flex justify-center py-2 bg-white border border-border rounded-lg"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
