import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle, Sparkles } from "lucide-react";
import UpgradeModal from "../components/UpgradeModal";
import { getLocalizedPlans } from "../lib/plans";

export default function Pricing() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user, subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        document.title = t("seo.title_pricing", "Bảng giá & Gói dịch vụ — DataMind");
    }, [t, i18n.language]);

    const isPro = subscription?.plan === "pro";
    const plans = useMemo(() => getLocalizedPlans(t, i18n.language), [t, i18n.language]);
    const free = plans.free;
    const pro = plans.pro;
    const dateLocale = i18n.language?.startsWith("en") ? "en-US" : "vi-VN";

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
                        {t("pricing.badge", "Gói dịch vụ")}
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
                        {t("pricing.title", "Chọn gói phù hợp với bạn")}
                    </h1>
                    <p className="text-muted text-lg max-w-md mx-auto">
                        {t("pricing.subtitle", "Bắt đầu miễn phí với {{freeRuns}} lượt AI mỗi ngày. Nâng cấp lên Pro để nhận {{proRuns}} lượt phân tích mỗi ngày (hạn {{days}} ngày).", {
                            freeRuns: free.aiRuns,
                            proRuns: pro.aiRuns,
                            days: pro.durationDays,
                        })}
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
                                {free.priceLabel}
                            </span>
                            <span className="text-muted text-sm font-medium">
                                / {free.periodLabel}
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
                            {t("pricing.current_plan", "Đang sử dụng")}
                        </button>
                    </div>

                    {/* Pro Plan */}
                    <div className="rounded-2xl border-2 border-forest bg-white p-8 flex flex-col shadow-[0_4px_20px_rgba(27,67,36,0.08)] relative scale-100 md:scale-[1.02]">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" strokeWidth={2} /> {t("landing.badge_recommended", "Đề xuất")}
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
                                    {pro.priceLabel}
                                </span>
                                <span className="text-muted text-sm font-medium">
                                    / {pro.periodLabel}
                                </span>
                            </div>
                            <p className="text-xs text-muted mt-1">
                                {t("pricing.ai_runs_reset_note", "{{runs}} lượt/ngày · Reset 00:00 (giờ VN)", { runs: pro.aiRuns })}
                            </p>
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
                            {isPro ? t("pricing.extend_pro", "Gia hạn thêm 30 ngày") : t("pricing.upgrade_now", "Nâng cấp ngay")}
                        </button>
                        {isPro && subscription?.pro_expires_at && (
                            <p className="text-xs text-forest text-center mt-2 font-medium">
                                {t("pricing.current_expiry", "Hạn hiện tại: {{date}}", {
                                    date: new Date(subscription.pro_expires_at).toLocaleDateString(dateLocale),
                                })}
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
