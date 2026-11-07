import React from "react";
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WindowBar({
  window: win,
  isLoading = false,
  onPrev,
  onNext,
  onToggleErrorsOnly,
  totalRows = 0,
  totalErrorRows = 0,
}) {
  const { t } = useTranslation();

  const isErrorsMode = win?.mode === "errors";
  const effectiveTotal = isErrorsMode
    ? (win?.total_error_rows ?? totalErrorRows ?? 0)
    : (win?.total_rows ?? totalRows ?? 0);

  const first = win?.first_excel_row ?? (effectiveTotal > 0 ? 2 : 0);
  const last = win?.last_excel_row ?? first;
  const offset = win?.offset ?? 0;
  const size = win?.size ?? 150;

  const canPrev = offset > 0 && !isLoading;
  const canNext = (offset + size < effectiveTotal) && !isLoading;

  const errCount = win?.total_error_rows ?? totalErrorRows ?? 0;

  return (
    <div
      data-toolbar="true"
      className="flex flex-wrap items-center justify-between gap-2.5 py-1.5 px-3 bg-[#F9F9F8] border border-border rounded-lg text-xs text-ink select-none"
    >
      {/* Left side: Row window indicator & Prev/Next buttons */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-ink">
          {effectiveTotal > 0
            ? t("cleaner.window_rows_display", {
                first,
                last,
                total: effectiveTotal,
                defaultValue: `Dòng ${first}–${last} / ${effectiveTotal}`,
              })
            : t("cleaner.window_no_rows", { defaultValue: "0 dòng" })}
        </span>

        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            title={t("cleaner.window_prev", { defaultValue: "Trang trước" })}
            className={`p-1 rounded border transition-colors ${
              canPrev
                ? "bg-white border-border hover:bg-neutral-100 text-ink cursor-pointer shadow-2xs"
                : "bg-neutral-100 border-transparent text-muted/40 cursor-not-allowed"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            title={t("cleaner.window_next", { defaultValue: "Trang sau" })}
            className={`p-1 rounded border transition-colors ${
              canNext
                ? "bg-white border-border hover:bg-neutral-100 text-ink cursor-pointer shadow-2xs"
                : "bg-neutral-100 border-transparent text-muted/40 cursor-not-allowed"
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted ml-2">
            <Loader2 className="w-3 h-3 animate-spin text-forest" />
            {t("cleaner.window_loading", { defaultValue: "Đang tải…" })}
          </span>
        )}
      </div>

      {/* Right side: Errors-only toggle */}
      <div className="flex items-center gap-2">
        <label
          className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors px-2 py-0.5 rounded-md border ${
            isErrorsMode
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-white border-border hover:bg-neutral-50 text-ink"
          }`}
        >
          <input
            type="checkbox"
            checked={isErrorsMode}
            onChange={onToggleErrorsOnly}
            disabled={isLoading}
            className="w-3.5 h-3.5 rounded border-border text-forest focus:ring-forest accent-forest"
          />
          <span>{t("cleaner.window_errors_only", { defaultValue: "Chỉ dòng có lỗi" })}</span>
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
              errCount > 0
                ? isErrorsMode
                  ? "bg-amber-200/80 text-amber-950"
                  : "bg-gray-100 text-muted"
                : "bg-gray-100 text-muted/60"
            }`}
          >
            {t("cleaner.window_errors_badge", {
              count: errCount,
              defaultValue: `${errCount} dòng có lỗi`,
            })}
          </span>
        </label>
      </div>
    </div>
  );
}

