import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logout } from "../services/authService";
const NAV_LINKS = [
    { label: "Trang chủ", path: "/" },
    { label: "Giá cả", path: "/pricing" },
    { label: "Cách hoạt động", path: "/how-it-works" },
    { label: "Thử nghiệm", path: "/demo" },
    { label: "Tài liệu", path: "/docs" },
];

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getUser();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

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
        <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#0B0F1A] sticky top-0 z-50">
            {/* Logo */}
            {/* Logo */}
<div
    className="flex items-center gap-2 cursor-pointer select-none"
    onClick={() => navigate("/")}
>
    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
        <img src="/logo_icon.png" alt="Logo" className="w-full h-full object-cover mix-blend-multiply" />
    </div>

    <span className="text-lg font-bold tracking-tight">
        DataMind<span className="text-violet-400">.</span>
    </span>
</div>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
                {NAV_LINKS.map((link) => (
                    <button
                        key={link.path}
                        onClick={() => navigate(link.path)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            location.pathname === link.path
                                ? "bg-violet-500/20 text-violet-400"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        {link.label}
                    </button>
                ))}
            </nav>

            {/* Auth buttons / User Profile */}
            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-4 relative" ref={menuRef}>
                        <button
                            onClick={() => navigate("/home")}
                            className="text-sm bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 rounded-lg font-semibold transition-all hidden sm:block"
                        >
                            Vào Dashboard
                        </button>
                        
                        <div 
                            className="flex items-center gap-2 text-white/80 cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded-lg transition-colors select-none"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold text-sm">
                                {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                            </div>
                            <span className="text-sm font-medium hidden sm:block">{user.full_name || "User"}</span>
                            <svg className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-[#161B2E] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-2 border-b border-white/5 mb-1">
                                    <p className="text-sm font-medium text-white truncate">{user.full_name || "User"}</p>
                                    <p className="text-xs text-white/50 truncate">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => { setShowMenu(false); navigate("/wallet"); }}
                                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <span>💰</span> Ví của tôi
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); navigate("/settings"); }}
                                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <span>⚙️</span> Cài đặt
                                </button>
                                <div className="h-px bg-white/5 my-1"></div>
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        logout();
                                        navigate("/");
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2"
                                >
                                    <span>🚪</span> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => navigate("/login")}
                            className="text-sm text-white/50 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 font-medium"
                        >
                            Đăng nhập
                        </button>
                        <button
                            onClick={() => navigate("/register")}
                            className="text-sm bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                        >
                            Đăng ký
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
