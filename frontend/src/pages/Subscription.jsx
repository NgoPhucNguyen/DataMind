import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import UpgradeModal from "../components/UpgradeModal";
import { useState } from "react";

export default function Subscription() {
    const navigate = useNavigate();
    const { subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const isPro = subscription?.plan === "pro";
    const runsUsed = subscription?.runs_used || 0;
    const runsLimit = subscription?.runs_limit || 2;
    const expiresAt = subscription?.pro_expires_at;

    const formatDate = (isoString) => {
        if (!isoString) return "—";
        const d = new Date(isoString);
        return d.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans">
            {/* Header */}
            <header className="border-b border-border px-6 py-4 flex justify-between items-center bg-white sticky top-0 z-10">
                <button
                    onClick={() => navigate("/dashboard/profiler")}
                    className="flex items-center gap-2 text-muted hover:text-ink text-sm font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 inline-block mr-1" /> Về trang chủ
                </button>
                <span className="text-xl font-bold tracking-tight text-ink font-serif hidden sm:block">
                    DataMind<span className="text-forest">.</span>
                </span>
                {!isPro && (
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="bg-forest hover:bg-forest/90 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" /> Nâng cấp Pro
                    </button>
                )}
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="mb-10 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-forest mb-3 font-semibold">Tài khoản</p>
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-ink">Quản lý Gói dịch vụ</h1>
                </div>

                {/* Plan Info */}
                <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
                    <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-border">
                        <div>
                            <h2 className="text-lg font-bold text-ink mb-1">Gói hiện tại</h2>
                            <p className="text-muted text-sm">
                                {isPro 
                                    ? "Bạn đang sử dụng đầy đủ tính năng của gói Pro." 
                                    : "Bạn đang sử dụng gói Free giới hạn. Nâng cấp để mở khóa tất cả tính năng."}
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
                            <p className="text-xs text-muted font-bold mb-3 uppercase tracking-wider">Số lượt sử dụng AI</p>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-3xl font-bold font-mono text-ink tracking-tighter">
                                    {runsUsed}
                                </span>
                                <span className="text-muted font-medium mb-1">/ {runsLimit}</span>
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
                                    <span className="text-red-500 font-medium">Bạn đã dùng hết lượt quy định.</span>
                                ) : (
                                    `Còn ${runsLimit - runsUsed} lượt sử dụng.`
                                )}
                            </p>
                        </div>

                        {/* Expiration (only for Pro) */}
                        {isPro && (
                            <div>
                                <p className="text-xs text-muted font-bold mb-3 uppercase tracking-wider">Ngày hết hạn</p>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl font-bold font-mono text-ink tracking-tighter">
                                        {formatDate(expiresAt)}
                                    </span>
                                </div>
                                <p className="text-xs text-muted mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-forest" />
                                    Tự động khôi phục lượt dùng khi gia hạn
                                </p>
                            </div>
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
