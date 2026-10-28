import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, X, Sparkles } from "lucide-react";
import UpgradeModal from "./UpgradeModal";

function formatDate(isoStr) {
    if (!isoStr) return "";
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return "";
    }
}

export default function ExpiredProBanner() {
    const { subscription, reloadSubscription } = useAuth();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const isFree = subscription?.plan === "free";
    const proExpiresAt = subscription?.pro_expires_at;
    let isExpired = false;
    try {
        isExpired = Boolean(
            isFree && proExpiresAt && new Date(proExpiresAt).getTime() < Date.now()
        );
    } catch {
        isExpired = false;
    }

    const dismissKey = proExpiresAt ? `dismiss_expired_banner_${proExpiresAt}` : "";
    const [dismissed, setDismissed] = useState(() => {
        if (!dismissKey) return false;
        try {
            return localStorage.getItem(dismissKey) === "true";
        } catch {
            return false;
        }
    });

    const handleDismiss = () => {
        setDismissed(true);
        try {
            if (dismissKey) {
                localStorage.setItem(dismissKey, "true");
            }
        } catch (e) {
            console.error("LocalStorage error:", e);
        }
    };

    return (
        <>
            {isExpired && !dismissed && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-ink text-xs sm:text-sm flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="truncate">
                            <span className="font-semibold text-amber-900">
                                Gói Pro của bạn đã hết hạn ngày {formatDate(proExpiresAt)}.
                            </span>{" "}
                            <span className="text-muted">Gia hạn để tiếp tục dùng 20 lượt/ngày.</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="px-3 py-1 bg-forest hover:bg-forest/90 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Gia hạn
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="p-1 hover:bg-amber-200/50 text-muted hover:text-ink rounded transition-colors"
                            title="Đóng thông báo"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onSuccess={() => {
                    reloadSubscription();
                }}
            />
        </>
    );
}
