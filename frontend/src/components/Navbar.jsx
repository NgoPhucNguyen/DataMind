import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/image.png";
const NAV_LINKS = [
    { label: "Trang chủ", path: "/home" },
    { label: "Cách hoạt động", path: "/how-it-works" },
    { label: "Thử nghiệm", path: "/demo" },
    { label: "Tài liệu", path: "/docs" },
];

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#0B0F1A] sticky top-0 z-50">
            {/* Logo */}
            {/* Logo */}
<div
    className="flex items-center gap-2 cursor-pointer select-none"
    onClick={() => navigate("/home")}
>
   <img
    src={logo}
    alt="DataMind Logo"
    className="w-8 h-8 object-contain"
/>

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

            {/* Auth buttons */}
            <div className="flex items-center gap-2">
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
            </div>
        </header>
    );
}
