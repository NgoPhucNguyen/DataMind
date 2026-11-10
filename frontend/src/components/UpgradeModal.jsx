import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Copy, Loader2, Sparkles, X } from "lucide-react";
import { createOrder, getOrderStatus } from "../services/paymentService";
import { trackOnce } from "../lib/analytics";
import { useAuth } from "../contexts/AuthContext";

export default function UpgradeModal({ isOpen, onClose, onSuccess }) {
    const { t, i18n } = useTranslation();
    const isEn = i18n.language?.startsWith("en");
    const dateLocale = isEn ? "en-US" : "vi-VN";

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("idle"); // idle, pending, completed, error
    const [error, setError] = useState(null);
    const [pollingTimeout, setPollingTimeout] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const { subscription } = useAuth();

    // Snapshot cục bộ tại thời điểm mở modal / tạo đơn (không đọc lại subscription sau khi thanh toán)
    const [initialIsPro, setInitialIsPro] = useState(false);
    const [initialCurrentExpiryStr, setInitialCurrentExpiryStr] = useState("");
    const [initialNewExpiryStr, setInitialNewExpiryStr] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setOrder(null);
            setStatus("idle");
            setError(null);
            setPollingTimeout(false);
            return;
        }

        // Lưu snapshot trạng thái Pro và ngày hết hạn tại thời điểm mở modal
        try {
            const isPro = subscription?.plan === "pro";
            const proExpiresAt = subscription?.pro_expires_at;
            const isProActive = Boolean(
                isPro && proExpiresAt && new Date(proExpiresAt).getTime() > Date.now()
            );
            setInitialIsPro(isProActive);
            if (isProActive && proExpiresAt) {
                const currentExpiry = new Date(proExpiresAt);
                if (!isNaN(currentExpiry.getTime())) {
                    const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
                    setInitialCurrentExpiryStr(currentExpiry.toLocaleDateString(dateLocale));
                    setInitialNewExpiryStr(newExpiry.toLocaleDateString(dateLocale));
                }
            } else {
                setInitialCurrentExpiryStr("");
                setInitialNewExpiryStr("");
            }
        } catch (err) {
            console.error("Error computing expiry snapshot:", err);
            setInitialIsPro(false);
            setInitialCurrentExpiryStr("");
            setInitialNewExpiryStr("");
        }

        let isMounted = true;

        const initOrder = async () => {
            setLoading(true);
            try {
                const data = await createOrder();
                if (isMounted) {
                    trackOnce(`begin_checkout_${data.order_ref}`, "begin_checkout", {
                        currency: "VND",
                        value: Number(data.amount),
                        items: [{ item_id: "pro", item_name: "DataMind Pro", price: Number(data.amount), quantity: 1 }],
                    });
                    setOrder(data);
                    setStatus("pending");
                }
            } catch (err) {
                if (isMounted) {
                    setError(t("upgrade.order_failed", "Không thể khởi tạo đơn hàng. Vui lòng thử lại sau."));
                    setStatus("error");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initOrder();

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (status !== "pending" || !order) return;

        let isMounted = true;
        let timeoutId;
        const startTime = Date.now();
        const MAX_POLL_TIME = 10 * 60 * 1000; // 10 minutes

        const pollStatus = async () => {
            if (!isMounted) return;

            // Check timeout
            if (Date.now() - startTime > MAX_POLL_TIME) {
                setPollingTimeout(true);
                return;
            }

            try {
                const res = await getOrderStatus(order.order_ref);
                if (res.status === "completed" && isMounted) {
                    setStatus("completed");
                    trackOnce(`purchase_${order.order_ref}`, "purchase", {
                        transaction_id: order.order_ref,
                        value: Number(order.amount),
                        currency: "VND",
                        items: [{ item_id: "pro", item_name: "DataMind Pro", price: Number(order.amount), quantity: 1 }],
                    });
                    // KHÔNG gọi onSuccess() tại đây để tránh re-render / unmount màn hình thành công
                    return; // Stop polling
                }
            } catch (error) {
                console.error("Poll error:", error);
                // Ignore transient errors and keep polling
            }

            // Continue polling every 3s
            if (isMounted) {
                timeoutId = setTimeout(pollStatus, 3000);
            }
        };

        timeoutId = setTimeout(pollStatus, 3000);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [status, order]);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // Khi người dùng bấm "Bắt đầu sử dụng" hoặc đóng modal sau khi thành công
    const handleClose = () => {
        const wasCompleted = status === "completed";
        onClose();
        if (wasCompleted && onSuccess) {
            onSuccess();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-sage/20">
                    <div className="flex items-center gap-2 text-forest">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="text-lg font-bold">
                            {initialIsPro ? t("upgrade.title_renew", "Gia hạn Pro Plan") : t("upgrade.title_upgrade", "Nâng cấp Pro Plan")}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-black/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* 1. Màn hình thành công: kiểm tra ĐẦU TIÊN và chỉ dùng state cục bộ */}
                    {status === "completed" && (
                        <div className="text-center py-8 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-ink mb-1">
                                    {initialIsPro ? t("upgrade.success_title_renew", "Gia hạn thành công!") : t("upgrade.success_title_upgrade", "Thanh toán thành công!")}
                                </h3>
                                <p className="text-muted">
                                    {initialIsPro
                                        ? t("upgrade.success_desc_renew", "Cảm ơn bạn. Gói Pro của bạn đã được gia hạn thêm 30 ngày (hạn mới: {{date}}).", { date: initialNewExpiryStr || "" })
                                        : t("upgrade.success_desc_upgrade", "Cảm ơn bạn. Tài khoản của bạn đã được nâng cấp lên Pro (20 lượt AI/ngày trong 30 ngày).")}
                                </p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="mt-2 w-full py-2.5 bg-forest hover:bg-forest/90 text-white rounded-lg font-semibold transition-colors"
                            >
                                {t("upgrade.btn_start_using", "Bắt đầu sử dụng")}
                            </button>
                        </div>
                    )}

                    {/* 2. Trạng thái Loading */}
                    {status !== "completed" && loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                            <Loader2 className="w-8 h-8 animate-spin text-forest" />
                            <p>{t("upgrade.loading_order", "Đang khởi tạo đơn hàng...")}</p>
                        </div>
                    )}

                    {/* 3. Trạng thái Lỗi */}
                    {status !== "completed" && status === "error" && !loading && (
                        <div className="text-center py-8 text-red-600">
                            <p>{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors"
                            >
                                {t("upgrade.btn_close", "Đóng")}
                            </button>
                        </div>
                    )}

                    {/* 4. Trạng thái Pending - Hiển thị mã QR và thông tin chuyển khoản */}
                    {status !== "completed" && status === "pending" && order && !pollingTimeout && (
                        <div className="space-y-5 flex flex-col items-center">
                            <p className="text-sm text-center text-muted px-4">
                                {t("upgrade.transfer_guide", "Vui lòng quét mã QR hoặc chuyển khoản theo thông tin bên dưới. Hệ thống sẽ tự động cập nhật ngay sau khi nhận được.")}
                            </p>

                            {initialIsPro && (
                                <div className="w-full bg-forest/5 border border-forest/20 rounded-xl p-3 text-xs text-forest text-center">
                                    <p className="font-semibold flex items-center justify-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" /> {t("upgrade.extend_badge", "Gia hạn thêm 30 ngày")}
                                    </p>
                                    <p className="text-muted mt-0.5">
                                        {t("upgrade.expiry_current_to_new", "Hạn hiện tại: {{current}} → Hạn mới: {{new}}", {
                                            current: initialCurrentExpiryStr,
                                            new: initialNewExpiryStr,
                                        })}
                                    </p>
                                </div>
                            )}

                            {/* QR Code */}
                            <div className="p-2 bg-white border border-border shadow-sm rounded-xl inline-block">
                                <img
                                    src={`https://img.vietqr.io/image/${order.transfer_info?.bank_name || 'ACB'}-${order.transfer_info?.account_number || ''}-compact2.jpg?amount=${order.amount}&addInfo=${order.order_ref}&accountName=${encodeURIComponent(order.transfer_info?.account_name || '')}`}
                                    alt="QR Code"
                                    className="w-48 h-48 object-contain"
                                />
                            </div>

                            {/* Transfer Info */}
                            <div className="w-full bg-sage/20 rounded-xl p-4 space-y-3 text-sm">
                                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                    <span className="text-muted">{t("upgrade.bank_label", "Ngân hàng:")}</span>
                                    <span className="font-semibold text-ink">{order.transfer_info?.bank_name}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                    <span className="text-muted">{t("upgrade.account_holder_label", "Chủ tài khoản:")}</span>
                                    <span className="font-semibold text-ink">{order.transfer_info?.account_name}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                    <span className="text-muted">{t("upgrade.account_number_label", "Số tài khoản:")}</span>
                                    <span className="font-semibold text-ink font-mono">{order.transfer_info?.account_number}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                    <span className="text-muted">{t("upgrade.amount_label", "Số tiền:")}</span>
                                    <span className="font-bold text-forest text-base">
                                        {new Intl.NumberFormat(dateLocale, { style: 'currency', currency: 'VND' }).format(order.amount || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-muted">{t("upgrade.content_label", "Nội dung (Bắt buộc):")}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-ink bg-white px-2 py-1 rounded border border-border font-mono text-base">
                                            {order.order_ref}
                                        </span>
                                        <button
                                            onClick={() => handleCopy(order.order_ref)}
                                            className="p-1.5 bg-white border border-border rounded hover:bg-gray-50 transition-colors text-ink relative"
                                            title={t("upgrade.copy_tooltip", "Copy nội dung")}
                                        >
                                            <Copy className="w-4 h-4" />
                                            {copySuccess && (
                                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-xs py-1 px-2 rounded">
                                                    {t("upgrade.copied_tooltip", "Đã copy")}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-forest bg-green-50 px-4 py-2 rounded-lg w-full justify-center">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t("upgrade.waiting_payment", "Đang chờ thanh toán...")}</span>
                            </div>
                        </div>
                    )}

                    {/* 5. Polling Timeout */}
                    {status !== "completed" && pollingTimeout && status === "pending" && (
                        <div className="text-center py-6">
                            <div className="text-amber-500 mb-3 flex justify-center">
                                <Loader2 className="w-8 h-8" />
                            </div>
                            <p className="text-ink font-medium mb-2">{t("upgrade.timeout_title", "Chưa nhận được thanh toán")}</p>
                            <p className="text-sm text-muted mb-4">
                                {t("upgrade.timeout_desc", "Vui lòng kiểm tra lại nếu bạn đã chuyển khoản. Bạn có thể đóng cửa sổ này và quay lại sau, trạng thái đơn hàng vẫn được lưu.")}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-border hover:bg-sage/40 rounded-lg font-medium transition-colors"
                            >
                                {t("upgrade.btn_close", "Đóng")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
