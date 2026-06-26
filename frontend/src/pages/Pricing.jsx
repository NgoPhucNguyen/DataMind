import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPackages, purchasePackage, getWallet, getMySubscription } from "../services/paymentService";

const DURATION_LABEL = (days) => {
    if (days >= 365) return `${Math.round(days / 365)} năm`;
    if (days >= 30) return `${Math.round(days / 30)} tháng`;
    return `${days} ngày`;
};

const formatCredits = (n) =>
    Number(n).toLocaleString("vi-VN");

export default function Pricing() {
    const navigate = useNavigate();
    const [packages, setPackages] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pkgs, w, sub] = await Promise.all([
                getPackages(),
                getWallet(),
                getMySubscription(),
            ]);
            setPackages(pkgs);
            setWallet(w);
            setSubscription(Array.isArray(sub) ? sub : null);
        } catch {
            showToast("Không thể tải dữ liệu. Vui lòng thử lại.", "error");
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handlePurchase = async (pkg) => {
        if (!wallet) return;
        if (wallet.balance < pkg.price) {
            showToast("Số dư không đủ để mua gói này.", "error");
            return;
        }
        setPurchasing(pkg.id);
        try {
            const result = await purchasePackage(pkg.id);
            showToast(`Mua gói "${pkg.name}" thành công! Số dư còn: ${formatCredits(result.remaining_credits)} credits`);
            await fetchAll();
        } catch (err) {
            showToast(err.response?.data?.detail || "Mua gói thất bại.", "error");
        } finally {
            setPurchasing(null);
        }
    };

    const activePackageIds = subscription?.map((s) => s.package_id) ?? [];

    return (
        <div className="min-h-screen bg-[#0B0F1A] text-white">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
                    ${toast.type === "error" ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"}`}
                >
                    {toast.msg}
                </div>
            )}

           

            <main className="max-w-5xl mx-auto px-6 py-16">
                {/* Hero */}
                <div className="text-center mb-14">
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-400 mb-4 font-medium">
                        Gói dịch vụ
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Chọn gói phù hợp với bạn
                    </h1>
                    <p className="text-white/50 text-base max-w-md mx-auto">
                        Thanh toán bằng credits trong ví. Gói cùng loại sẽ được gia hạn tự động.
                    </p>
                </div>

                {/* Active subscription banner */}
                {subscription && subscription.length > 0 && (
                    <div className="mb-10 border border-violet-500/30 bg-violet-500/10 rounded-2xl px-6 py-4">
                        <p className="text-sm text-violet-300 font-medium mb-2">✅ Đăng ký đang hoạt động</p>
                        <div className="flex flex-wrap gap-4">
                            {subscription.map((sub) => {
                                const pkg = packages.find(p => p.id === sub.package_id);
                                return (
                                    <div key={sub.package_id} className="text-xs text-white/70">
                                        <span className="text-white font-medium">{pkg?.name ?? `Gói #${sub.package_id}`}</span>
                                        {" · "}hết hạn{" "}
                                        <span className="text-violet-300">
                                            {new Date(sub.end_date).toLocaleDateString("vi-VN")}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Package cards */}
                {loading ? (
                    <div className="flex justify-center items-center py-32">
                        <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                    </div>
                ) : packages.length === 0 ? (
                    <div className="text-center text-white/40 py-32">Không có gói nào đang hoạt động.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {packages.map((pkg, i) => {
                            const isActive = activePackageIds.includes(pkg.id);
                            const canAfford = wallet && wallet.balance >= pkg.price;
                            const isBuying = purchasing === pkg.id;
                            const isPopular = i === 1;

                            return (
                                <div
                                    key={pkg.id}
                                    className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-200
                                    ${isPopular
                                        ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                                        : "border-white/10 bg-white/5 hover:border-white/20"
                                    }`}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="bg-violet-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                                Phổ biến
                                            </span>
                                        </div>
                                    )}

                                    {isActive && (
                                        <div className="absolute top-4 right-4">
                                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-emerald-500/30">
                                                Đang dùng
                                            </span>
                                        </div>
                                    )}

                                    <div className="mb-5">
                                        <h2 className="text-lg font-bold mb-1 text-white">{pkg.name}</h2>
                                        <p className="text-white/40 text-xs">Thời hạn {DURATION_LABEL(pkg.duration_days)}</p>
                                    </div>

                                    <div className="mb-6">
                                        <span className="text-3xl font-bold font-mono text-white">
                                            {formatCredits(pkg.price)}
                                        </span>
                                        <span className="text-white/40 text-sm ml-2">credits</span>
                                    </div>

                                    <div className="mt-auto">
                                        {!canAfford && !isActive && (
                                            <p className="text-xs text-red-400 mb-2 text-center">
                                                Số dư không đủ
                                            </p>
                                        )}
                                        <button
                                            onClick={() => handlePurchase(pkg)}
                                            disabled={isBuying || !canAfford}
                                            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all
                                            ${isPopular
                                                ? "bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-40"
                                                : "bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
                                            } disabled:cursor-not-allowed`}
                                        >
                                            {isBuying ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Đang xử lý…
                                                </span>
                                            ) : isActive ? "Gia hạn thêm" : "Mua ngay"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Top-up hint */}
                <div className="mt-12 text-center text-white/30 text-xs">
                    Số dư ví của bạn:{" "}
                    <span className="text-white/60 font-mono">
                        {wallet ? formatCredits(wallet.balance) : "---"} credits
                    </span>
                    {" · "}
                    <button onClick={() => navigate("/wallet")} className="underline hover:text-white/60 transition-colors">
                        Xem ví & lịch sử
                    </button>
                </div>
            </main>
        </div>
    );
}
