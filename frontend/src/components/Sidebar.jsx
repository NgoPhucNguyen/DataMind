import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUser, logout } from "../services/authService";
import { LayoutDashboard, FileSearch, Wand2, PieChart, Workflow, ChevronLeft, ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function Sidebar() {
  const [sidebarState, setSidebarState] = useState(() => {
    return localStorage.getItem("sidebar_state") || "canva-collapsed";
  });
  
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const updateState = (newState) => {
    setSidebarState(newState);
    localStorage.setItem("sidebar_state", newState);
  };

  const menuItems = [
    { path: "/home", label: "Tổng quan", icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: "/profiler", label: "Phân tích", icon: <FileSearch className="w-5 h-5" /> },
    { path: "/cleaner", label: "Làm sạch", icon: <Wand2 className="w-5 h-5" /> },
    { path: "/visualize", label: "Trực quan hóa", icon: <PieChart className="w-5 h-5" /> },
    { path: "/pipeline", label: "Tự động", icon: <Workflow className="w-5 h-5" /> },
  ];

  let widthClass = "md:w-64";
  if (sidebarState === "canva-collapsed") widthClass = "md:w-20";
  if (sidebarState === "hidden") widthClass = "md:w-0 md:border-r-0 md:overflow-hidden md:opacity-0";

  return (
    <>
      <div
        className={`bg-canvas border-border transition-all duration-300 flex z-50 shrink-0
          max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-full max-md:h-16 max-md:flex-row max-md:border-t
          md:flex-col md:border-r md:h-screen ${widthClass}
        `}
      >
        {/* Header / Logo */}
        <div className={`md:h-20 flex items-center ${sidebarState === "expanded" ? "justify-between px-4" : "justify-center"} md:border-b md:border-border shrink-0 max-md:hidden relative`}>
          {sidebarState === "expanded" ? (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
                <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              <span className="font-bold text-lg text-ink">
                Data<span className="text-forest">Mind</span>
              </span>
            </Link>
          ) : (
            <Link to="/" className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
            </Link>
          )}
          
          {sidebarState === "expanded" && (
            <button
              onClick={() => updateState("canva-collapsed")}
              className="text-muted hover:text-ink transition-colors p-1"
              title="Thu gọn"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 md:py-4 flex max-md:flex-row max-md:items-center max-md:justify-around md:flex-col md:gap-2 md:px-2 md:overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center transition-all md:rounded-xl 
                  max-md:flex-col max-md:justify-center max-md:h-full max-md:w-full px-2 py-2
                  ${sidebarState === "expanded" ? "md:flex-row md:gap-3 md:px-3" : "md:flex-col md:justify-center md:gap-1 text-center"}
                  ${isActive
                    ? "md:bg-sage text-forest font-semibold"
                    : "text-muted hover:bg-sage/40 hover:text-ink"
                  }`}
                title={sidebarState === "canva-collapsed" ? item.label : ""}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className={`
                  ${sidebarState === "expanded" ? "font-medium text-sm truncate" : "text-[11px] font-normal leading-tight w-full break-words"}
                  max-md:font-medium max-md:text-[10px] max-md:mt-1 max-md:truncate
                `}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        {user && (
          <div className="md:border-t md:border-border p-3 shrink-0 max-md:hidden">
            {sidebarState === "expanded" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-border">
                  <div className="w-10 h-10 rounded-full bg-forest flex items-center justify-center text-white font-bold shrink-0">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-semibold text-ink truncate">{user.full_name || "User"}</p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                  </div>
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
                </div>
                <button
                  onClick={() => updateState("hidden")}
                  className="flex items-center justify-center gap-2 py-2 w-full text-xs text-muted hover:text-ink hover:bg-sage/40 rounded-lg transition-colors border border-transparent"
                >
                  <PanelLeftClose className="w-4 h-4" /> Ẩn thanh bên
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex justify-center w-full">
                  <div className="w-10 h-10 rounded-full bg-forest flex items-center justify-center text-white font-bold shrink-0">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="w-full text-muted hover:text-red-600 transition-colors flex justify-center py-2 bg-white border border-border rounded-lg"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between gap-1 w-full mt-1">
                   <button
                     onClick={() => updateState("expanded")}
                     className="flex-1 flex items-center justify-center py-1.5 text-muted hover:text-ink hover:bg-sage/40 rounded-md transition-colors"
                     title="Mở rộng"
                   >
                     <ChevronRight className="w-4 h-4" />
                   </button>
                   <button
                     onClick={() => updateState("hidden")}
                     className="flex-1 flex items-center justify-center py-1.5 text-muted hover:text-ink hover:bg-sage/40 rounded-md transition-colors"
                     title="Ẩn thanh bên"
                   >
                     <PanelLeftClose className="w-4 h-4" />
                   </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Button for Hidden State */}
      {sidebarState === "hidden" && (
        <button
          onClick={() => updateState("canva-collapsed")}
          className="fixed left-0 top-4 z-50 p-2 bg-white border border-l-0 border-border rounded-r-xl shadow-sm text-muted hover:text-ink hover:bg-sage/40 transition-all max-md:hidden flex items-center gap-1 group"
          title="Hiện thanh bên"
        >
          <PanelLeftOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[100px] overflow-hidden transition-all duration-300">
            Hiện thanh bên
          </span>
        </button>
      )}
    </>
  );
}
