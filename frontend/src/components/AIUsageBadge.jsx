import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, HelpCircle, X, Clock, Flame } from "lucide-react";

export default function AIUsageBadge({
  usage,
  isFromCache = false,
  onUpgradeClick,
  className = "",
}) {
  const { t, i18n } = useTranslation();
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showPopover]);

  if (!usage) return null;

  const remaining = usage.remaining ?? 0;
  const isLow = remaining <= 2 && remaining > 0;
  const isZero = remaining === 0;

  const formatResetTime = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const handleBadgeClick = () => {
    if (isZero && !usage.is_pro && onUpgradeClick) {
      onUpgradeClick();
    } else {
      setShowPopover((prev) => !prev);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`} ref={popoverRef}>
      {isFromCache && (
        <span className="text-[11px] font-medium text-forest bg-sage/60 border border-forest/20 px-2 py-0.5 rounded-full select-none">
          {t("usage.from_cache")}
        </span>
      )}

      <button
        type="button"
        onClick={handleBadgeClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none ${
          isZero
            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
            : isLow
            ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
            : "bg-white border-border text-ink hover:bg-sage/30 hover:border-forest/40"
        }`}
        title={t("usage.breakdown_title")}
      >
        <Sparkles className={`w-3.5 h-3.5 ${isZero ? "text-rose-500" : isLow ? "text-amber-600" : "text-forest"}`} />
        <span>{t("usage.remaining", { n: remaining })}</span>
        {isLow && <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
      </button>

      {/* Breakdown popover */}
      {showPopover && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-xl shadow-lg p-3 z-50 text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2.5">
            <span className="font-bold text-ink">{t("usage.breakdown_title")}</span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="p-1 text-muted hover:text-ink rounded"
              aria-label={t("common.close")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-ink/80">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">{t("usage.profiler")}</span>
              <span className="font-semibold text-ink">{usage.breakdown?.profiler || 0}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">{t("usage.reanalyze")}</span>
              <span className="font-semibold text-ink">{usage.breakdown?.reanalyze || 0}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">{t("usage.explain")}</span>
              <span className="font-semibold text-ink">{usage.breakdown?.explain || 0}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-muted">{t("usage.re_explain")}</span>
              <span className="font-semibold text-ink">{usage.breakdown?.re_explain || 0}</span>
            </div>
          </div>

          <div className="border-t border-border/70 mt-2.5 pt-2 flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t("usage.resets_at", { time: formatResetTime(usage.reset_at) })}
            </span>
            <span className="font-medium text-ink">
              {usage.used} / {usage.limit}
            </span>
          </div>

          {isZero && !usage.is_pro && (
            <button
              type="button"
              onClick={() => {
                setShowPopover(false);
                if (onUpgradeClick) onUpgradeClick();
              }}
              className="mt-2.5 w-full py-1.5 bg-forest text-white rounded-lg font-semibold text-center hover:bg-forest/90 transition-colors"
            >
              {t("usage.upgrade_pro")}
            </button>
          )}

          {isZero && usage.is_pro && (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              {t("usage.pro_exhausted", { time: formatResetTime(usage.reset_at) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

