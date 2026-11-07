import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Clock, Zap, RotateCw, RotateCcw, AlertTriangle, Info, X } from "lucide-react";
import { BTN } from "../../constants/ui";
import { getCurrentLang } from "../../i18n";
import { normalizeConfidence } from "./Badges";

function useCountdown(fileExpiresAt, uploadedAt) {
  const computeSecondsLeft = () => {
    if (fileExpiresAt) {
      const expMs = new Date(fileExpiresAt).getTime();
      if (!isNaN(expMs)) {
        return Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      }
    }
    // Fallback if no fileExpiresAt: 5 hours (18000s) from uploadedAt or now
    const ref = uploadedAt || Date.now();
    const elapsed = Date.now() - ref;
    return Math.max(0, Math.floor((18000 * 1000 - elapsed) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState(computeSecondsLeft);

  useEffect(() => {
    const tick = () => {
      setSecondsLeft(computeSecondsLeft());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fileExpiresAt, uploadedAt]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  
  // Turn red at < 5 min (300s), amber at < 30 min (1800s)
  const isRed = secondsLeft > 0 && secondsLeft < 300;
  const isAmber = secondsLeft >= 300 && secondsLeft < 1800;

  return { secondsLeft, formatted, isRed, isAmber };
}

export const ResultsSummary = ({
  result,
  aiAnalyzed,
  lastFile,
  handleFile,
  handleReset,
  uploadedAt,
  fileExpiresAt,
}) => {
  const { t } = useTranslation();
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowInfoPopover(false);
      }
    }
    if (showInfoPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showInfoPopover]);

  if (!result) return null;

  const { formatted, isRed, isAmber } = useCountdown(fileExpiresAt || result.file_expires_at, uploadedAt);
  const lang = getCurrentLang();
  const numberLocale = lang === "vi" ? "vi-VN" : "en-US";
  const problemCols = result.columns.filter(
    (c) => c.null_pct > 60 || c.unique_count === 1 || c.low_confidence
  ).length;

  const domain = result.semantic_context?.domain === "Chưa phân tích"
    ? t("profiler.domain_not_analyzed")
    : result.semantic_context?.domain;

  let bannerClass = "bg-[#F9F9F8] border-border text-muted";
  if (isRed) {
    bannerClass = "bg-[#FDEBEC] border-[#f5c6cb] text-[#9F2F2D]";
  } else if (isAmber) {
    bannerClass = "bg-amber-50/70 border-amber-200 text-amber-800";
  }

  return (
    <>
      {/* Expiration Banner with live countdown & deletion explanation */}
      <div className={`relative flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg text-sm border transition-colors ${bannerClass}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isRed ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#9F2F2D]" />
          ) : isAmber ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          ) : (
            <Clock className="w-4 h-4 shrink-0" />
          )}
          <p className="text-xs sm:text-sm truncate">
            {t("profiler.expiry_file")}{" "}
            <strong className={isRed ? "text-[#9F2F2D]" : isAmber ? "text-amber-900" : "text-ink"}>
              {result.filename}
            </strong>{" "}
            {isRed ? (
              <span className="font-semibold text-[#9F2F2D]">
                {t("profiler.expiry_urgent", { time: formatted })}
              </span>
            ) : (
              <span>
                {t("profiler.expiry_normal", { time: formatted })}
              </span>
            )}
          </p>
        </div>

        {/* Info Icon & Popover */}
        <div className="relative shrink-0" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowInfoPopover(!showInfoPopover)}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-black/5 transition-colors focus:outline-none"
            title={t("profiler.why_deletion_title", "Vì sao file bị xóa?")}
          >
            <Info className="w-4 h-4" />
          </button>

          {showInfoPopover && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 p-4 bg-white border border-border rounded-xl shadow-xl z-50 text-xs text-ink animate-fade-in-up">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                <span className="font-semibold text-ink text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-forest" />
                  {t("profiler.why_deletion_title", "Vì sao file bị xóa?")}
                </span>
                <button
                  type="button"
                  onClick={() => setShowInfoPopover(false)}
                  className="text-muted hover:text-ink p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-muted leading-relaxed text-[12.5px]">
                <p>• {t("profiler.why_deletion_p1")}</p>
                <p>• {t("profiler.why_deletion_p2")}</p>
                <p>• {t("profiler.why_deletion_p3")}</p>
                <p>• {t("profiler.why_deletion_p4")}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-border/60 text-right">
                <Link
                  to="/docs/profiler/session#session-countdown"
                  className="text-forest font-semibold hover:underline inline-flex items-center gap-1"
                  onClick={() => setShowInfoPopover(false)}
                >
                  {t("profiler.why_deletion_details", "Xem chi tiết")} →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary + Actions bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm bg-[#F9F9F8] border border-border px-4 py-2.5 rounded-lg">
        {/* Dataset stats */}
        <span className="font-medium text-ink text-xs sm:text-sm">
          {t("profiler.subtitle_with_result", {
            cols: result.total_columns.toLocaleString(numberLocale),
            rows: result.total_rows.toLocaleString(numberLocale),
          })}
          {` · ${problemCols} ${problemCols === 1 ? "issue" : "issues"}`}
          {aiAnalyzed
            ? ` · ${t("profiler.domain_label")} ${domain} (${normalizeConfidence(
                result.semantic_context?.confidence
              )}%)`
            : ""}
        </span>

        {/* Cached profile badge */}
        {result.cached && (
          <span
            title="Kết quả phân tích đã được tải từ bộ nhớ đệm (không cần quét lại)"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB]"
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>{t("profiler.badge_cached")}</span>
          </span>
        )}

        {/* Action buttons (Right-aligned) */}
        <div className="ml-auto flex items-center gap-2">
          {lastFile && handleFile && (
            <button
              onClick={() => handleFile(lastFile, false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-ink bg-white border border-border rounded-lg hover:border-ink/30 transition-colors"
              title="Đọc lại dữ liệu gốc từ file (miễn phí, không dùng AI)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Đọc lại</span>
            </button>
          )}

          {handleReset && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9F2F2D] hover:bg-[#FDEBEC] border border-[#f5c6cb] rounded-lg transition-colors"
              title="Xóa cache và quét lại toàn bộ từ đầu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Quét lại</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default ResultsSummary;
