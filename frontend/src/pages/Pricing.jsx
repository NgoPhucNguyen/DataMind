import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, Sparkles } from "lucide-react";
import UpgradeModal from "../components/UpgradeModal";
import { PLANS, formatVND } from "../lib/plans";

export default function Pricing() {
    const navigate = useNavigate();
    const { user, subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const isPro = subscription?.plan === "pro";
    const free = PLANS.free;
    const pro = PLANS.pro;

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
                        Bắt đầu miễn phí với {free.aiRuns} lượt AI mỗi ngày. Nâng cấp lên Pro để
                        nhận {pro.aiRuns} lượt phân tích mỗi ngày (hạn {pro.durationDays} ngày).
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                    {/* Free Plan */}
                    <div className="rounded-2xl border border-border bg-white p-8 flex flex-col hover:border-forest/30 transition-all">
                        <div className="mb-6">
                            <h2 className="text-2xl font-serif font-bold mb-1 text-ink">
                                {free.name}
                            </h2>
                            <p className="text-muted text-sm">{free.subtitle}</p>
                        </div>
                        <div className="mb-8 flex items-baseline gap-2">
                            <span className="text-4xl font-bold font-mono text-ink tracking-tight">
                                0đ
                            </span>
                            <span className="text-muted text-sm font-medium">
                                / ngày (reset 00:00)
                            </span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {free.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-muted">
                                    <CheckCircle className="w-5 h-5 text-forest shrink-0" strokeWidth={1.5} />
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
                    <div className="rounded-2xl border-2 border-forest bg-white p-8 flex flex-col shadow-[0_4px_20px_rgba(27,67,36,0.08)] relative scale-100 md:scale-[1.02]">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" strokeWidth={2} /> Đề xuất
                            </span>
                        </div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-serif font-bold mb-1 text-forest">
                                {pro.name}
                            </h2>
                            <p className="text-muted text-sm">{pro.subtitle}</p>
                        </div>
                        <div className="mb-8">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold font-mono text-ink tracking-tight">
                                    {formatVND(pro.price)}
                                </span>
                                <span className="text-muted text-sm font-medium">
                                    / {pro.periodLabel}
                                </span>
                            </div>
                            <p className="text-xs text-muted mt-1">{pro.aiRuns} lượt/ngày · Reset 00:00 (giờ VN)</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {pro.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm font-medium text-ink">
                                    <CheckCircle className="w-5 h-5 text-forest shrink-0" strokeWidth={1.5} />
                                    <span>{feat}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={handleUpgradeClick}
                            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm bg-ink hover:bg-ink/90 text-white"
                        >
                            {isPro ? "Gia hạn thêm 30 ngày" : "Nâng cấp ngay"}
                        </button>
                        {isPro && subscription?.pro_expires_at && (
                            <p className="text-xs text-forest text-center mt-2 font-medium">
                                Hạn hiện tại: {new Date(subscription.pro_expires_at).toLocaleDateString("vi-VN")}
                            </p>
                        )}
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
