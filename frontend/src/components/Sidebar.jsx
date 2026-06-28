import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout } from "../services/authService";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const menuItems = [
    { path: "/home", label: "Tổng quan", icon: "" },
    { path: "/ua_profiler", label: "Phân tích thủ công", icon: "" },
    { path: "/ua_cleaner", label: "Làm sạch thủ công", icon: "" },
    { path: "/ua_visualize", label: "Trực quan hóa (Thống kê)", icon: "" },
    { path: "/pipeline", label: "Quy trình tự động", icon: "" },
  ];

  return (
    <div
      className={`bg-[#0B0F1A] border-r border-white/10 transition-all duration-300 flex flex-col shrink-0 ${isCollapsed ? "w-16" : "w-64"
        }`}
    >
      {/* Header / Logo */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <span className="font-bold text-lg text-white">
              Data<span className="text-violet-400">Mind</span>
            </span>
          </Link>
        )}
        {isCollapsed && (
          <Link to="/" className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 mx-auto">
            <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white/60 hover:text-white transition-colors p-1"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive
                ? "bg-violet-500/20 text-violet-400"
                : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              title={isCollapsed ? item.label : ""}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {!isCollapsed && (
                <span className="font-medium text-sm truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
            <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold shrink-0">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user.full_name || "User"}</p>
                <p className="text-xs text-white/50 truncate">{user.email}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="text-white/40 hover:text-red-400 transition-colors p-1"
                title="Đăng xuất"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="mt-2 w-full text-white/40 hover:text-red-400 transition-colors flex justify-center py-2 bg-white/5 rounded-lg"
              title="Đăng xuất"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
