import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getWallet, getCreditHistory } from "../services/paymentService";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const formatCredits = (n) => Number(n).toLocaleString("vi-VN");

const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function Wallet() {
    const navigate = useNavigate();
    const [wallet, setWallet] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [w, h] = await Promise.all([getWallet(), getCreditHistory()]);
            setWallet(w);
            setHistory(h);
        } catch {
            // silently fail; UI shows empty state
        } finally {
            setLoading(false);
        }
    };

    const credits = history.filter(t => t.type === "credit");
    const debits = history.filter(t => t.type === "debit");
    const totalSpent = debits.reduce((sum, t) => sum + Number(t.amount), 0);

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
                <span className="text-xl font-bold tracking-tight text-ink font-serif">
                    DataMind<span className="text-forest">.</span>
                </span>
                <button
                    onClick={() => navigate("/pricing")}
                    className="bg-ink hover:bg-ink/80 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm"
                >
                    Mua gói
                </button>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="mb-10 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-forest mb-3 font-semibold">Ví của tôi</p>
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-ink">Credits & Giao dịch</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-32">
                        <div className="w-8 h-8 rounded-full border-2 border-forest border-t-transparent animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                                <p className="text-[11px] text-muted font-bold mb-3 uppercase tracking-wider">Số dư hiện tại</p>
                                <p className="text-4xl font-bold font-mono text-ink tracking-tighter">
                                    {wallet ? formatCredits(wallet.balance) : "0"}
                                </p>
                                <p className="text-[11px] text-muted mt-2 font-medium">credits</p>
                            </div>
                            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                                <p className="text-[11px] text-muted font-bold mb-3 uppercase tracking-wider">Tổng đã nạp</p>
                                <p className="text-4xl font-bold font-mono text-forest tracking-tighter">
                                    +{formatCredits(credits.reduce((s, t) => s + Number(t.amount), 0))}
                                </p>
                                <p className="text-[11px] text-muted mt-2 font-medium">{credits.length} lần nạp</p>
                            </div>
                            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                                <p className="text-[11px] text-muted font-bold mb-3 uppercase tracking-wider">Tổng đã tiêu</p>
                                <p className="text-4xl font-bold font-mono text-red-600 tracking-tighter">
                                    -{formatCredits(totalSpent)}
                                </p>
                                <p className="text-[11px] text-muted mt-2 font-medium">{debits.length} giao dịch</p>
                            </div>
                        </div>

                        {/* Transaction list */}
                        <div>
                            <h2 className="text-xs font-bold text-ink uppercase tracking-widest mb-4 border-b border-border pb-2">
                                Lịch sử giao dịch
                            </h2>

                            {history.length === 0 ? (
                                <div className="text-center text-muted py-20 border border-dashed border-border rounded-2xl bg-[#F9F9F8]">
                                    Chưa có giao dịch nào.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((tx) => {
                                        const isCredit = tx.type === "credit";
                                        return (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between bg-white hover:border-forest/30 border border-border rounded-xl px-5 py-4 transition-all shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base
                                                        ${isCredit ? "bg-sage text-forest font-bold" : "bg-red-50 text-red-600 font-bold"}`}>
                                                        {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-ink leading-tight">
                                                            {tx.description || (isCredit ? "Nạp credits" : "Thanh toán")}
                                                        </p>
                                                        <p className="text-xs text-muted mt-1 font-medium">
                                                            {tx.created_at ? formatDate(tx.created_at) : "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-mono text-base font-bold tracking-tight ${isCredit ? "text-forest" : "text-red-600"}`}>
                                                    {isCredit ? "+" : "-"}{formatCredits(tx.amount)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
