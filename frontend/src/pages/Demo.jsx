import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";

export default function Demo() {
    const { t, i18n } = useTranslation();
    const isEn = i18n.language?.startsWith("en");

    const sampleData = [
        { month: isEn ? "Jan" : "T1", value: 4200 },
        { month: isEn ? "Feb" : "T2", value: 3800 },
        { month: isEn ? "Mar" : "T3", value: 5100 },
        { month: isEn ? "Apr" : "T4", value: 4700 },
        { month: isEn ? "May" : "T5", value: 6300 },
        { month: isEn ? "Jun" : "T6", value: 5900 },
    ];

    const insights = [
        { label: t("demo.stat_avg_growth", "Tăng trưởng TB"), value: "+12.4%", positive: true },
        { label: t("demo.stat_peak_month", "Tháng cao nhất"), value: isEn ? "Jun" : "T6", positive: true },
        { label: t("demo.stat_volatility", "Biến động"), value: t("demo.stat_volatility_val", "Thấp"), positive: true },
        { label: t("demo.stat_forecast", "Dự báo T7"), value: "~6.800", positive: true },
    ];

    const [uploaded, setUploaded] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [done, setDone] = useState(false);

    const maxVal = Math.max(...sampleData.map((d) => d.value));

    const handleDemo = () => {
        setUploaded(true);
        setAnalyzing(true);
        setTimeout(() => {
            setAnalyzing(false);
            setDone(true);
        }, 1800);
    };

    const reset = () => {
        setUploaded(false);
        setAnalyzing(false);
        setDone(false);
    };

    return (
        <div className="min-h-screen bg-canvas text-ink font-sans">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="text-center mb-12">
                    <h1 className="text-3xl sm:text-4xl font-serif tracking-tight mb-4 text-ink">
                        {t("demo.badge", "Thử")} <span className="text-forest italic font-semibold">{t("demo.badge_highlight", "nghiệm ngay")}</span>
                    </h1>
                    <p className="text-muted max-w-xl mx-auto">
                        {t("demo.subtitle", "Xem DataMind phân tích dữ liệu mẫu trong thời gian thực.")}
                    </p>
                </div>

                {/* Upload zone */}
                {!uploaded && (
                    <div
                        onClick={handleDemo}
                        className="bg-white border-2 border-dashed border-border hover:border-forest/50 rounded-2xl p-16 text-center cursor-pointer transition-all group"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-sage/40 border border-forest/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-sage/60 transition-all">
                            <svg className="w-8 h-8 text-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <p className="font-semibold text-ink mb-1">{t("demo.upload_title", "Nhấn để chạy demo với dữ liệu mẫu")}</p>
                        <p className="text-muted text-sm">{t("demo.upload_subtitle", "Hoặc kéo thả file CSV / Excel của bạn vào đây")}</p>
                    </div>
                )}

                {/* Analyzing */}
                {analyzing && (
                    <div className="bg-white border border-border rounded-2xl p-10 text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-forest border-t-transparent animate-spin mx-auto mb-4" />
                        <p className="font-semibold text-forest">{t("demo.analyzing_title", "Đang phân tích dữ liệu...")}</p>
                        <p className="text-muted text-sm mt-1">{t("demo.analyzing_desc", "AI đang xử lý 6 cột, 1.240 dòng")}</p>
                    </div>
                )}

                {/* Results */}
                {done && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {insights.map((ins) => (
                                <div key={ins.label} className="bg-white border border-border rounded-xl p-4 shadow-sm">
                                    <p className="text-muted text-xs mb-1">{ins.label}</p>
                                    <p className="text-xl font-bold text-forest">{ins.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
                            <p className="text-sm font-semibold mb-6 text-ink/75">{t("demo.chart_title", "Doanh thu theo tháng (nghìn đồng)")}</p>
                            <div className="flex items-end gap-3 h-40">
                                {sampleData.map((d) => (
                                    <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                                        <span className="text-xs text-muted">{(d.value / 1000).toFixed(1)}k</span>
                                        <div
                                            className="w-full rounded-t-lg bg-forest/80 hover:bg-forest transition-all"
                                            style={{ height: `${(d.value / maxVal) * 100}%` }}
                                        />
                                        <span className="text-xs text-muted">{d.month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-sage/20 border border-[#c8e0cb]/50 rounded-2xl p-6">
                            <p className="text-sm font-semibold text-forest mb-2 flex items-center">
                                <Lightbulb className="w-4 h-4 mr-1.5" /> {t("demo.ai_comment_title", "Nhận xét từ AI")}
                            </p>
                            <p className="text-ink/80 text-sm leading-relaxed">
                                {t("demo.ai_comment_text", "Dữ liệu cho thấy xu hướng tăng trưởng ổn định với mức tăng bình quân 12.4%/tháng. Tháng 6 đạt đỉnh cao nhất (6.300), dự báo tháng 7 tiếp tục tăng nhẹ lên khoảng 6.800. Không phát hiện bất thường đáng kể.")}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 bg-[#111111] hover:bg-[#222222] text-white py-3 rounded-lg font-semibold transition-all text-sm shadow-sm">
                                {t("demo.btn_export_pdf", "Xuất báo cáo PDF")}
                            </button>
                            <button
                                onClick={reset}
                                className="px-6 py-3 rounded-lg bg-white hover:bg-[#F9F9F8] border border-border text-ink text-sm font-medium transition-all"
                            >
                                {t("demo.btn_retry", "Thử lại")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
