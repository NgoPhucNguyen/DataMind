import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { User, Settings, LogOut, LayoutDashboard, Sparkles, ChevronDown, Menu, X, Crown, BarChart2 } from "lucide-react";
import UpgradeModal from "./UpgradeModal";
import LanguageSelect from "./LanguageSelect";

export default function Navbar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, subscription, reloadSubscription } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const menuRef = useRef(null);

    const navLinks = [
        { label: t("navbar.home", "Trang chủ"), path: "/" },
        { label: t("navbar.pricing", "Giá cả"), path: "/pricing" },
        { label: t("navbar.live_stats", "Số liệu"), path: "/live-stats" },
        { label: t("navbar.docs", "Tài liệu"), path: "/docs" },
    ];

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="border-b border-border bg-canvas sticky top-0 z-50 h-[var(--app-topbar-h,65px)] flex items-center">
            {/* Changed from flex justify-between to a 3-column grid so nav links stay perfectly centered */}
            <div className="px-4 md:px-6 py-3.5 grid grid-cols-3 items-center w-full">

                {/* Left Section: Logo & Mobile Menu */}
                <div className="flex items-center gap-3 justify-start">
                    <button
                        className="md:hidden text-ink hover:text-forest p-1 rounded-md"
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                    >
                        {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>

                    <div
                        className="flex items-center gap-2 cursor-pointer select-none"
                        onClick={() => navigate("/")}
                    >
                        <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
                            <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-ink hidden sm:block">
                            Data<span className="text-forest">Mind</span>
                        </span>
                    </div>
                </div>

                {/* Middle Section: Nav Links (Centered) */}
                <nav className="hidden md:flex items-center justify-center gap-1">
                    {navLinks.map((link) => (
                        <button
                            key={link.path}
                            onClick={() => navigate(link.path)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === link.path
                                ? "bg-sage text-forest"
                                : "text-muted hover:text-ink hover:bg-sage/40"
                                }`}
                        >
                            {link.label}
                        </button>
                    ))}
                </nav>

                {/* Right Section: Auth buttons / User Profile & Language Toggle */}
                <div className="flex items-center justify-end gap-1.5 sm:gap-3">
                    <LanguageSelect compact />
                    {user ? (
                        <div className="flex items-center gap-4 relative" ref={menuRef} >
                            <button
                                onClick={() => navigate("/dashboard/profiler")}
                                className="text-sm bg-ink hover:bg-ink/80 text-white px-4 py-2 rounded-lg font-semibold transition-all hidden sm:block"
                            >
                                {t("navbar.dashboard", "Dashboard")}
                            </button>

                            <div
                                className="flex items-center gap-2 text-ink cursor-pointer hover:bg-sage/40 px-2 py-1.5 rounded-lg transition-colors select-none"
                                onClick={() => setShowMenu(!showMenu)}
                            >
                                <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-white font-bold text-sm shrink-0">
                                    {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                                </div>
                                <span className="text-sm font-medium hidden lg:block text-ink max-w-[100px] truncate">{user.full_name || "User"}</span>
                                {subscription?.plan === "pro" && (
                                    <span className="hidden sm:flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        <Crown className="w-3 h-3" /> Pro
                                    </span>
                                )}
                                <ChevronDown className={`w-4 h-4 text-muted transition-transform shrink-0 ${showMenu ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Dropdown Menu */}
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-2 border-b border-border mb-1">
                                        <p className="text-sm font-semibold text-ink truncate">{user.full_name || "User"}</p>
                                        <p className="text-xs text-muted truncate">{user.email}</p>
                                    </div>

                                    <div className="p-1">
                                        <button
                                            onClick={() => { setShowMenu(false); navigate("/dashboard/profiler"); }}
                                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage/40 transition-colors flex items-center gap-2 font-medium rounded-md"
                                        >
                                            <LayoutDashboard className="w-4 h-4 text-muted" /> {t("navbar.menu_dashboard", "Bảng điều khiển")}
                                        </button>
                                        <button
                                            onClick={() => { setShowMenu(false); navigate("/dashboard/subscription"); }}
                                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage/40 transition-colors flex items-center gap-2 font-medium rounded-md"
                                        >
                                            <User className="w-4 h-4 text-muted" /> {t("navbar.menu_account", "Tài khoản")}
                                        </button>
                                        {subscription?.plan !== "pro" && (
                                            <button
                                                onClick={() => { setShowMenu(false); setShowUpgradeModal(true); }}
                                                className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage/40 transition-colors flex items-center gap-2 font-medium rounded-md"
                                            >
                                                <Sparkles className="w-4 h-4 text-forest" /> {t("navbar.menu_upgrade", "Nâng cấp tài khoản")}
                                            </button>
                                        )}
                                    </div>

                                    <div className="h-px bg-border my-1"></div>

                                    <div className="p-1">
                                        <button
                                            onClick={() => { setShowMenu(false); navigate("/dashboard/settings"); }}
                                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage/40 transition-colors flex items-center gap-2 font-medium rounded-md cursor-pointer"
                                        >
                                            <Settings className="w-4 h-4 text-muted" /> {t("navbar.menu_settings", "Cài đặt")}
                                        </button>
                                        <button
                                            onClick={() => { setShowMenu(false); navigate("/live-stats"); }}
                                            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage/40 transition-colors flex items-center gap-2 font-medium rounded-md cursor-pointer"
                                        >
                                            <BarChart2 className="w-4 h-4 text-muted" /> {t("navbar.live_stats", "Số liệu")}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowMenu(false);
                                                logout();
                                                navigate("/");
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium rounded-md"
                                        >
                                            <LogOut className="w-4 h-4" /> {t("navbar.menu_logout", "Đăng xuất")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate("/login")}
                                className="text-xs sm:text-sm text-ink hover:text-forest transition-colors px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-sage/40 font-semibold"
                            >
                                {t("navbar.login", "Đăng nhập")}
                            </button>
                            <button
                                onClick={() => navigate("/register")}
                                className="text-xs sm:text-sm bg-ink hover:bg-ink/80 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold transition-all shadow-sm"
                            >
                                {t("navbar.register", "Đăng ký")}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Nav links */}
            {showMobileMenu && (
                <nav className="md:hidden border-t border-border bg-canvas px-4 py-3 flex flex-col gap-1 shadow-inner" >
                    {navLinks.map((link) => (
                        <button
                            key={link.path}
                            onClick={() => { navigate(link.path); setShowMobileMenu(false); }}
                            className={`px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${location.pathname === link.path
                                ? "bg-sage text-forest"
                                : "text-muted hover:text-ink hover:bg-sage/40"
                                }`}
                        >
                            {link.label}
                        </button>
                    ))}
                    {user && subscription?.plan !== "pro" && (
                        <button
                            onClick={() => { setShowMobileMenu(false); setShowUpgradeModal(true); }}
                            className="px-4 py-3 rounded-lg text-sm font-bold text-left transition-colors text-forest hover:bg-sage/40 flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" /> {t("navbar.upgrade_pro", "Nâng cấp Pro")}
                        </button>
                    )}
                </nav>
            )}

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onSuccess={() => {
                    reloadSubscription();
                }}
            />
        </header>
    );
}