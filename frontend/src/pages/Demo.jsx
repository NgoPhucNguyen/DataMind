import { useState } from "react";

const SAMPLE_DATA = [
    { month: "T1", value: 4200 },
    { month: "T2", value: 3800 },
    { month: "T3", value: 5100 },
    { month: "T4", value: 4700 },
    { month: "T5", value: 6300 },
    { month: "T6", value: 5900 },
];

const INSIGHTS = [
    { label: "Tăng trưởng TB", value: "+12.4%", positive: true },
    { label: "Tháng cao nhất", value: "T6", positive: true },
    { label: "Biến động", value: "Thấp", positive: true },
    { label: "Dự báo T7", value: "~6.800", positive: true },
];

export default function Demo() {
    const [uploaded, setUploaded] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [done, setDone] = useState(false);

    const maxVal = Math.max(...SAMPLE_DATA.map((d) => d.value));

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
        <div className="min-h-screen bg-[#0B0F1A] text-white">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        Thử <span className="text-violet-400">nghiệm</span> ngay
                    </h1>
                    <p className="text-white/40 max-w-xl mx-auto">
                        Xem DataMind phân tích dữ liệu mẫu trong thời gian thực.
                    </p>
                </div>

                {/* Upload zone */}
                {!uploaded && (
                    <div
                        onClick={handleDemo}
                        className="border-2 border-dashed border-white/15 hover:border-violet-500/50 rounded-2xl p-16 text-center cursor-pointer transition-all group"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-violet-500/20 transition-all">
                            <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <p className="font-semibold mb-1">Nhấn để chạy demo với dữ liệu mẫu</p>
                        <p className="text-white/40 text-sm">Hoặc kéo thả file CSV / Excel của bạn vào đây</p>
                    </div>
                )}

                {/* Analyzing */}
                {analyzing && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
                        <p className="font-semibold text-violet-400">Đang phân tích dữ liệu...</p>
                        <p className="text-white/30 text-sm mt-1">AI đang xử lý 6 cột, 1.240 dòng</p>
                    </div>
                )}

                {/* Results */}
                {done && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {INSIGHTS.map((ins) => (
                                <div key={ins.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <p className="text-white/40 text-xs mb-1">{ins.label}</p>
                                    <p className="text-xl font-bold text-violet-400">{ins.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <p className="text-sm font-semibold mb-6 text-white/70">Doanh thu theo tháng (nghìn đồng)</p>
                            <div className="flex items-end gap-3 h-40">
                                {SAMPLE_DATA.map((d) => (
                                    <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                                        <span className="text-xs text-white/40">{(d.value / 1000).toFixed(1)}k</span>
                                        <div
                                            className="w-full rounded-t-lg bg-violet-500/70 hover:bg-violet-400 transition-all"
                                            style={{ height: `${(d.value / maxVal) * 100}%` }}
                                        />
                                        <span className="text-xs text-white/40">{d.month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6">
                            <p className="text-sm font-semibold text-violet-300 mb-2">💡 Nhận xét từ AI</p>
                            <p className="text-white/60 text-sm leading-relaxed">
                                Dữ liệu cho thấy xu hướng tăng trưởng ổn định với mức tăng bình quân 12.4%/tháng.
                                Tháng 6 đạt đỉnh cao nhất (6.300), dự báo tháng 7 tiếp tục tăng nhẹ lên khoảng 6.800.
                                Không phát hiện bất thường đáng kể.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 bg-violet-500 hover:bg-violet-400 text-white py-3 rounded-xl font-semibold transition-all text-sm">
                                Xuất báo cáo PDF
                            </button>
                            <button
                                onClick={reset}
                                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
