import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <span className="text-lg font-bold tracking-tight">
                    DataMind<span className="text-violet-400">.</span>
                </span>
                <button
                    onClick={handleLogout}
                    className="text-sm text-white/50 hover:text-white transition-colors"
                >
                    Đăng xuất
                </button>
            </header>

            {/* Main */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
                <h1 className="text-4xl font-bold tracking-tight text-center">
                    Chào mừng đến với <span className="text-violet-400">DataMind</span>
                </h1>
                <p className="text-white/40 text-center max-w-sm">
                    Nền tảng phân tích dữ liệu thông minh. Chọn gói phù hợp để bắt đầu.
                </p>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => navigate("/pricing")}
                        className="bg-violet-500 hover:bg-violet-400 text-white px-6 py-3 rounded-xl font-semibold transition-all text-sm"
                    >
                        Xem gói dịch vụ
                    </button>
                    <button
                        onClick={() => navigate("/wallet")}
                        className="bg-white/10 hover:bg-white/15 border border-white/10 text-white px-6 py-3 rounded-xl font-semibold transition-all text-sm"
                    >
                        Ví của tôi
                    </button>
                </div>
            </div>
        </div>
    );
}
