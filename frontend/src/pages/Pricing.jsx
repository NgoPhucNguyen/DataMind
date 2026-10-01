import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, Sparkles } from "lucide-react";
import UpgradeModal from "../components/UpgradeModal";

export default function Pricing() {
    const navigate = useNavigate();
    const { user, subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const isPro = subscription?.plan === "pro";

    const featuresFree = [
        "Phân tích dữ liệu cơ bản",
        "2 lượt sử dụng AI Insights mỗi tháng",
        "Trực quan hóa dữ liệu tiêu chuẩn",
        "Hỗ trợ cộng đồng"
    ];

    const featuresPro = [
        "Mọi thứ trong gói Free",
        "50 lượt sử dụng AI Insights",
        "Làm sạch dữ liệu tự động với AI",
        "Tạo báo cáo chi tiết",
        "Hỗ trợ ưu tiên"
    ];

    const handleUpgradeClick = () => {
        if (!user) {
            navigate("/login");
            return;
        }
        setShowUpgradeModal(true);
    };

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <main className="max-w-5xl mx-auto px-6 py-16">
                {/* Hero */}
                <div className="text-center mb-14">
                    <p className="text-xs uppercase tracking-[0.2em] text-forest mb-4 font-semibold">
                        Gói dịch vụ
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
                        Chọn gói phù hợp với bạn
                    </h1>
                    <p className="text-muted text-lg max-w-md mx-auto">
                        Mở khóa toàn bộ tính năng phân tích dữ liệu thông minh và AI với gói Pro.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Free Plan */}
                    <div className="rounded-2xl border border-border bg-white p-8 flex flex-col hover:border-forest/30 transition-all">
                        <div className="mb-6">
                            <h2 className="text-2xl font-serif font-bold mb-1 text-ink">Free</h2>
                            <p className="text-muted text-sm">Trải nghiệm cơ bản</p>
                        </div>
                        <div className="mb-8">
                            <span className="text-4xl font-bold font-mono text-ink tracking-tight">0</span>
                            <span className="text-muted text-sm ml-2 font-medium">VNĐ</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {featuresFree.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted">
                                    <CheckCircle className="w-5 h-5 text-forest shrink-0" />
                                    <span>{feat}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            disabled
                            className="w-full py-3.5 rounded-xl text-sm font-bold bg-sage/50 text-ink/50 cursor-not-allowed"
                        >
                            Đang sử dụng
                        </button>
                    </div>

                    {/* Pro Plan */}
                    <div className="rounded-2xl border-2 border-forest bg-white p-8 flex flex-col shadow-xl shadow-forest/5 relative scale-100 md:scale-[1.02]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Đề xuất
                            </span>
                        </div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-serif font-bold mb-1 text-forest">Pro</h2>
                            <p className="text-muted text-sm">Dành cho người dùng chuyên nghiệp</p>
                        </div>
                        <div className="mb-8 flex items-baseline">
                            <span className="text-4xl font-bold font-mono text-ink tracking-tight">2.000</span>
                            <span className="text-muted text-sm ml-2 font-medium">VNĐ / tháng</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {featuresPro.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm font-medium text-ink">
                                    <CheckCircle className="w-5 h-5 text-forest shrink-0" />
                                    <span>{feat}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleUpgradeClick}
                            disabled={isPro}
                            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm
                                ${isPro 
                                    ? "bg-forest/10 text-forest cursor-not-allowed" 
                                    : "bg-ink hover:bg-ink/90 text-white"
                                }
                            `}
                        >
                            {isPro ? "Đang sử dụng" : "Nâng cấp ngay"}
                        </button>
                    </div>
                </div>
            </main>

            <UpgradeModal 
                isOpen={showUpgradeModal} 
                onClose={() => setShowUpgradeModal(false)} 
                onSuccess={() => {
                    reloadSubscription();
                }}
            />
        </div>
    );
}
