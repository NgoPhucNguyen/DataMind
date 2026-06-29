import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
            {/* Main */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight text-center text-ink">
                    Chào mừng đến với <span className="text-forest italic font-semibold">DataMind</span>
                </h1>
                <p className="text-muted text-center max-w-sm leading-relaxed text-sm">
                    Nền tảng phân tích dữ liệu thông minh. Chọn gói phù hợp để bắt đầu.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto px-4 sm:px-0">
                    <button
                        onClick={() => navigate("/pricing")}
                        className="bg-forest hover:bg-[#15361c] text-white px-6 py-3 rounded-lg font-medium transition-all active:scale-[0.98] text-sm shadow-sm"
                    >
                        Xem gói dịch vụ
                    </button>
                    <button
                        onClick={() => navigate("/wallet")}
                        className="bg-white hover:bg-[#F9F9F8] border border-border text-ink px-6 py-3 rounded-lg font-medium transition-all active:scale-[0.98] text-sm"
                    >
                        Ví của tôi
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto px-4 sm:px-0">
                    <button
                        onClick={() => navigate("/ua_profiler")}
                        className="bg-[#111111] hover:bg-[#222222] text-white px-8 py-3 rounded-lg font-medium transition-all active:scale-[0.98] text-sm shadow-sm"
                    >
                        Bắt đầu phân tích dữ liệu →
                    </button>
                </div>

            </div>
        </div>
    );
}
