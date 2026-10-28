import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import UpgradeModal from "../components/UpgradeModal";
import { useState } from "react";
import { PLANS } from "../lib/plans";

function formatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function getDaysRemaining(isoStr) {
    if (!isoStr) return 0;
    const target = new Date(isoStr).getTime();
    const now = Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function Subscription() {
    const navigate = useNavigate();
    const { subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const isPro = subscription?.plan === "pro";
    const free = PLANS.free;
    const pro = PLANS.pro;
    const runsUsed = subscription?.runs_used ?? 0;
    const runsLimit = subscription?.runs_limit ?? (isPro ? pro.aiRuns : free.aiRuns);
    const proExpiresAt = subscription?.pro_expires_at;
    const daysRemaining = proExpiresAt ? getDaysRemaining(proExpiresAt) : 0;
    const isExpiringSoon = isPro && daysRemaining > 0 && daysRemaining <= 3;

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans">
            {/* Header */}
            <header className="border-b border-border px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-10">
                <button
                    onClick={() => navigate("/dashboard/profiler")}
                    className="flex items-center gap-2 text-muted hover:text-ink text-sm font-medium transition-colors"
                >
                    ← Về trang chủ
                </button>
                <span className="text-xl font-bold tracking-tight text-ink font-serif hidden sm:block">
                    DataMind<span className="text-forest">.</span>
                </span>
                {!isPro ? (
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="bg-forest hover:bg-forest/90 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" /> Nâng cấp Pro
                    </button>
                ) : (
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="border border-border hover:bg-sage/40 text-ink rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4 text-forest" /> Gia hạn Pro
                    </button>
                )}
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="mb-10 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-forest mb-3 font-semibold">Tài khoản</p>
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-ink">Quản lý Gói dịch vụ</h1>
                </div>

                {/* Cảnh báo Pro sắp hết hạn (<= 3 ngày) */}
                {isExpiringSoon && (
                    <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                                <p className="font-semibold text-sm">Gói Pro sắp hết hạn</p>
                                <p className="text-xs text-amber-800">
                                    Gói Pro của bạn còn {daysRemaining} ngày (hết hạn ngày {formatDate(proExpiresAt)}). Hãy gia hạn để không bị gián đoạn hạn mức 20 lượt/ngày.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="shrink-0 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Gia hạn ngay
                        </button>
                    </div>
                )}

                {/* Plan Info Card */}
                <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
                    <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-border">
                        <div>
                            <h2 className="text-lg font-bold text-ink mb-1">Gói hiện tại</h2>
                            <p className="text-muted text-sm">
                                {isPro
                                    ? `Gói Pro — ${runsLimit} lượt AI Insights mỗi ngày (reset 00:00).`
                                    : `Gói Free — ${runsLimit} lượt AI Insights mỗi ngày (reset 00:00). Nâng cấp để mở khóa 20 lượt/ngày.`}
                            </p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider
                                ${isPro ? "bg-amber-100 text-amber-700" : "bg-sage text-forest"}
                            `}>
                                {isPro ? (
                                    <>
                                        <Sparkles className="w-4 h-4" /> Pro Plan
                                    </>
                                ) : "Free Plan"}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {/* Usage Limit */}
                        <div>
                            <p className="text-xs text-muted font-bold mb-3 uppercase tracking-wider">Hạn mức hôm nay</p>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-3xl font-bold font-mono text-ink tracking-tighter">
                                    {runsUsed}
                                </span>
                                <span className="text-muted font-medium mb-1">/ {runsLimit} lượt</span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="w-full bg-border rounded-full h-2.5 mt-4 overflow-hidden">
                                <div 
                                    className={`h-2.5 rounded-full transition-all duration-500 ${runsUsed >= runsLimit ? 'bg-red-500' : 'bg-forest'}`}
                                    style={{ width: `${Math.min(100, (runsUsed / runsLimit) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-muted mt-2">
                                {runsUsed >= runsLimit ? (
                                    <span className="text-red-500 font-medium">Bạn đã dùng hết {runsLimit} lượt hôm nay.</span>
                                ) : (
                                    `Hôm nay đã dùng ${runsUsed}/${runsLimit} lượt (còn ${runsLimit - runsUsed} lượt).`
                                )}
                            </p>
                            <p className="text-[11px] text-muted/70 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Tự động reset lúc 00:00 (giờ Việt Nam)
                            </p>
                        </div>

                        {/* Plan info & Expiration */}
                        <div>
                            <p className="text-xs text-muted font-bold mb-3 uppercase tracking-wider">Thời hạn sử dụng</p>
                            {isPro ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-ink">
                                        Hết hạn ngày {formatDate(proExpiresAt)} {daysRemaining > 0 ? `(còn ${daysRemaining} ngày)` : ""}
                                    </p>
                                    <p className="text-xs text-muted flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
                                        Gia hạn bất kỳ lúc nào để cộng dồn thêm 30 ngày.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-ink">Gói Free vĩnh viễn</p>
                                    <p className="text-xs text-muted flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
                                        Nhận {free.aiRuns} lượt AI mỗi ngày. Nâng cấp Pro để nhận {pro.aiRuns} lượt/ngày.
                                    </p>
                                </div>
                            )}
                        </div>
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
