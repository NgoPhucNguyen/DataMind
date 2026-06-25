import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getWallet, getCreditHistory } from "../services/paymentService";

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
    const debits  = history.filter(t => t.type === "debit");
    const totalSpent = debits.reduce((sum, t) => sum + Number(t.amount), 0);

    return (
        <div className="min-h-screen bg-[#0B0F1A] text-white">
            {/* Header */}
            <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
                <button
                    onClick={() => navigate("/home")}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
                >
                    ← Về trang chủ
                </button>
                <span className="text-lg font-bold tracking-tight text-white">
                    DataMind<span className="text-violet-400">.</span>
                </span>
                <button
                    onClick={() => navigate("/pricing")}
                    className="bg-violet-500 hover:bg-violet-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
                >
                    Mua gói
                </button>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-400 mb-2 font-medium">Ví của tôi</p>
                    <h1 className="text-3xl font-bold tracking-tight">Credits & Giao dịch</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-32">
                        <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-10">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Số dư</p>
                                <p className="text-2xl font-bold font-mono text-violet-300">
                                    {wallet ? formatCredits(wallet.balance) : "0"}
                                </p>
                                <p className="text-xs text-white/30 mt-1">credits</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Đã nhận</p>
                                <p className="text-2xl font-bold font-mono text-emerald-400">
                                    +{formatCredits(credits.reduce((s, t) => s + Number(t.amount), 0))}
                                </p>
                                <p className="text-xs text-white/30 mt-1">{credits.length} lần</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Đã chi</p>
                                <p className="text-2xl font-bold font-mono text-red-400">
                                    -{formatCredits(totalSpent)}
                                </p>
                                <p className="text-xs text-white/30 mt-1">{debits.length} giao dịch</p>
                            </div>
                        </div>

                        {/* Transaction list */}
                        <div>
                            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
                                Lịch sử giao dịch
                            </h2>

                            {history.length === 0 ? (
                                <div className="text-center text-white/30 py-20 border border-dashed border-white/10 rounded-2xl">
                                    Chưa có giao dịch nào.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((tx) => {
                                        const isCredit = tx.type === "credit";
                                        return (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-5 py-4 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm
                                                        ${isCredit ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                                        {isCredit ? "↓" : "↑"}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white leading-tight">
                                                            {tx.description || (isCredit ? "Nhận credits" : "Thanh toán")}
                                                        </p>
                                                        <p className="text-xs text-white/35 mt-0.5">
                                                            {tx.created_at ? formatDate(tx.created_at) : "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`font-mono text-sm font-semibold ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
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
