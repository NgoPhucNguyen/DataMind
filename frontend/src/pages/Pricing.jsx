import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPackages, purchasePackage, getWallet, getMySubscription } from "../services/paymentService";
import { CheckCircle } from "lucide-react";

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

    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const pkgs = await getPackages();
            setPackages(pkgs);

            if (token) {
                const [w, sub] = await Promise.all([
                    getWallet(),
                    getMySubscription(),
                ]);
                setWallet(w);
                setSubscription(Array.isArray(sub) ? sub : null);
            }
        } catch {
            showToast("Không thể kết nối để lấy thông tin. Vui lòng thử lại sau.", "error");
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handlePurchase = async (pkg) => {
        if (!token) {
            navigate("/login");
            return;
        }
        if (!wallet) return;
        if (wallet.balance < pkg.price) {
            showToast("Số dư trong ví không đủ. Vui lòng nạp thêm để mua gói dịch vụ này.", "error");
            return;
        }
        setPurchasing(pkg.id);
        try {
            const result = await purchasePackage(pkg.id);
            showToast(`Tuyệt vời! Bạn đã mua gói "${pkg.name}" thành công. Số dư còn: ${formatCredits(result.remaining_credits)} credits`);
            await fetchAll();
        } catch (err) {
            showToast(err.response?.data?.detail || "Giao dịch không thành công. Vui lòng thử lại sau.", "error");
        } finally {
            setPurchasing(null);
        }
    };

    const activePackageIds = subscription?.map((s) => s.package_id) ?? [];

    return (
        <div className="min-h-screen bg-canvas text-ink">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
                    ${toast.type === "error" ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}
                >
                    {toast.msg}
                </div>
            )}

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
                        Thanh toán bằng credits trong ví. Gói cùng loại sẽ được gia hạn tự động.
                    </p>
                </div>

                {/* Active subscription banner */}
                {token && subscription && subscription.length > 0 && (
                    <div className="mb-10 border border-forest/20 bg-sage/40 rounded-2xl px-6 py-4">
                        <p className="text-sm text-forest font-semibold mb-2 flex items-center"><CheckCircle className="w-4 h-4 mr-1.5" /> Đăng ký đang hoạt động</p>
                        <div className="flex flex-wrap gap-4">
                            {subscription.map((sub) => {
                                const pkg = packages.find(p => p.id === sub.package_id);
                                return (
                                    <div key={sub.package_id} className="text-xs text-muted font-medium">
                                        <span className="text-ink font-bold">{pkg?.name ?? `Gói #${sub.package_id}`}</span>
                                        {" · "}hết hạn{" "}
                                        <span className="text-forest">
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
                        <div className="w-8 h-8 rounded-full border-2 border-forest border-t-transparent animate-spin" />
                    </div>
                ) : packages.length === 0 ? (
                    <div className="text-center text-muted py-32">Không có gói nào đang hoạt động.</div>
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
                                    className={`relative rounded-2xl border p-8 flex flex-col transition-all duration-200
                                    ${isPopular
                                        ? "border-forest bg-white shadow-xl shadow-forest/5 scale-[1.02]"
                                        : "border-border bg-white hover:border-forest/40 hover:shadow-lg"
                                    }`}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
                                                Phổ biến nhất
                                            </span>
                                        </div>
                                    )}

                                    {isActive && (
                                        <div className="absolute top-4 right-4">
                                            <span className="bg-sage text-forest text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-forest/20">
                                                Đang dùng
                                            </span>
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h2 className="text-xl font-serif font-bold mb-1 text-ink">{pkg.name}</h2>
                                        <p className="text-muted text-sm">Thời hạn {DURATION_LABEL(pkg.duration_days)}</p>
                                    </div>

                                    <div className="mb-8">
                                        <span className="text-4xl font-bold font-mono text-ink tracking-tight">
                                            {formatCredits(pkg.price)}
                                        </span>
                                        <span className="text-muted text-sm ml-2 font-medium">credits</span>
                                    </div>

                                    <div className="mt-auto">
                                        {token && !canAfford && !isActive && (
                                            <p className="text-xs text-red-500 mb-3 text-center font-medium">
                                                Số dư không đủ
                                            </p>
                                        )}
                                        <button
                                            onClick={() => handlePurchase(pkg)}
                                            disabled={isBuying || (token && !canAfford && !isActive)}
                                            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm
                                            ${isPopular
                                                ? "bg-ink hover:bg-ink/80 text-white disabled:opacity-40"
                                                : "bg-sage hover:bg-forest text-forest hover:text-white disabled:opacity-40"
                                            } disabled:cursor-not-allowed`}
                                        >
                                            {isBuying ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    Đang xử lý…
                                                </span>
                                            ) : !token ? (
                                                "Đăng nhập để mua"
                                            ) : isActive ? (
                                                "Gia hạn thêm"
                                            ) : (
                                                "Mua ngay"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Top-up hint */}
                {token && (
                    <div className="mt-16 text-center text-muted text-sm bg-white border border-border py-4 px-6 rounded-2xl max-w-sm mx-auto shadow-sm">
                        Số dư ví của bạn:{" "}
                        <span className="text-ink font-mono font-bold text-base ml-1">
                            {wallet ? formatCredits(wallet.balance) : "---"} credits
                        </span>
                        <div className="mt-3">
                            <button onClick={() => navigate("/wallet")} className="text-forest font-semibold hover:text-ink transition-colors underline-offset-4 hover:underline">
                                Xem ví & lịch sử giao dịch
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
