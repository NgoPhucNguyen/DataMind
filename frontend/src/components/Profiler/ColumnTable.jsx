import { useState, useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle,
} from "lucide-react";
import { CARD } from "../../constants/ui";
import { ExpandableText } from "./ExpandableText";
import { TypeDropdownButton } from "./TypeDropdownButton";
import { getCurrentLang } from "../../i18n";
import {
  CHART_CONFIG,
  getSuggestedChartsForType,
} from "../../constants/dataTypes";

const DEFAULT_VISIBLE = 10;

/**
 * Helper to check if a column requires user review
 * Counting ONLY: null_pct > 60, unique_count === 1, disguised_numeric, unnamed_warning
 * Plain text columns are NOT counted as warnings!
 */
export function isAttentionColumn(col) {
  if (col.null_pct > 60) return true;
  if (col.unique_count === 1) return true;
  if (col.disguised_numeric?.is_disguised) return true;
  if (Boolean(col.unnamed_warning)) return true;
  return false;
}

export const ColumnTable = ({
  result,
  overrides,
  getEffectiveType,
  handleOverride,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [expandedMobileRows, setExpandedMobileRows] = useState({});
  const [showOverrideHelp, setShowOverrideHelp] = useState(false);

  if (!result) return null;

  const cols = result.columns || [];
  const lang = getCurrentLang();
  const numberLocale = lang === "vi" ? "vi-VN" : "en-US";

  // Attention count (only 4 strict conditions)
  const attentionCount = useMemo(() => {
    return cols.filter(isAttentionColumn).length;
  }, [cols]);

  // Filtered list
  const filteredCols = useMemo(() => {
    if (!filterNeedsReview) return cols;
    return cols.filter(isAttentionColumn);
  }, [cols, filterNeedsReview]);

  const visible = showAll ? filteredCols : filteredCols.slice(0, DEFAULT_VISIBLE);
  const hasMore = filteredCols.length > DEFAULT_VISIBLE;

  const toggleMobileRow = (colName) => {
    setExpandedMobileRows((prev) => ({
      ...prev,
      [colName]: !prev[colName],
    }));
  };

  return (
    <div className={CARD}>
      {/* ── 1. Summary Band Above Table ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-ink">
            {result.total_rows.toLocaleString(numberLocale)}{" "}
            <span className="font-normal text-muted">{t("profiler.summary_rows", "dòng")}</span>
            {" · "}
            {result.total_columns.toLocaleString(numberLocale)}{" "}
            <span className="font-normal text-muted">{t("profiler.summary_cols", "cột")}</span>
          </span>

          {attentionCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterNeedsReview((prev) => !prev)}
              title={
                filterNeedsReview
                  ? t("profiler.chip_filter_clear", "Bấm để xem tất cả cột")
                  : t("profiler.chip_filter_apply", "Bấm để lọc các cột cần xem")
              }
              aria-pressed={filterNeedsReview}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${filterNeedsReview
                ? "bg-[#D97706] text-white ring-2 ring-[#D97706]/40 shadow-sm"
                : "bg-[#FEF6E6] text-[#854D0E] border border-[#FDE68A] hover:bg-[#FDF0D5]"
                }`}
            >
              <AlertTriangle size={13} className={filterNeedsReview ? "text-white" : "text-[#D97706]"} aria-hidden="true" />
              <span>
                {t("profiler.chip_needs_review", {
                  count: attentionCount,
                  defaultValue: `${attentionCount} cột cần xem`,
                })}
              </span>
              {filterNeedsReview && <X size={12} className="ml-0.5" aria-hidden="true" />}
            </button>
          )}

          {filterNeedsReview && (
            <span className="text-xs text-muted">
              {t("profiler.filtering_hint", "Đang lọc hiển thị")}
            </span>
          )}
        </div>

        {/* Showing count & Info Help Popover Button */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            <Trans
              i18nKey="profiler.col_showing"
              values={{
                visible: visible.length.toLocaleString(numberLocale),
                total: filteredCols.length.toLocaleString(numberLocale),
              }}
              components={{
                1: <strong className="text-ink" />,
                3: <strong className="text-ink" />,
              }}
            />
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOverrideHelp((prev) => !prev)}
              aria-label={t("profiler.popover_info_title", "Cách hệ thống xử lý ghi đè")}
              className="p-1 rounded-full text-muted hover:text-ink hover:bg-neutral-100 transition-colors cursor-pointer"
              title={t("profiler.popover_info_title", "Cách hệ thống xử lý ghi đè")}
            >
              <HelpCircle size={15} />
            </button>

            {showOverrideHelp && (
              <div
                role="dialog"
                className="absolute right-0 top-7 z-30 w-80 p-3.5 bg-white border border-border rounded-xl shadow-lg text-xs text-ink space-y-2 animate-in fade-in"
              >
                <div className="flex items-center justify-between font-semibold border-b border-border pb-1.5">
                  <span className="flex items-center gap-1.5 text-forest">
                    <Info size={14} />
                    {t("profiler.popover_info_title", "Tác động khi đổi loại dữ liệu")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOverrideHelp(false)}
                    className="p-0.5 text-muted hover:text-ink rounded cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-muted leading-relaxed">
                  {t(
                    "profiler.popover_info_desc",
                    "Khi đổi kiểu cột, bộ phận Làm sạch (Cleaner) sẽ áp dụng quy tắc tương ứng:"
                  )}
                </p>
                <ul className="space-y-1.5 text-[13px] leading-snug">
                  <li>
                    <strong className="text-ink">{t("profiler.type_numeric", "Số liệu")}:</strong>{" "}
                    {t("profiler.popover_rule_numeric", "Điền ô trống bằng số trung vị (median) & chuyển đổi sang số.")}
                  </li>
                  <li>
                    <strong className="text-ink">{t("profiler.type_categorical", "Danh mục")}:</strong>{" "}
                    {t("profiler.popover_rule_categorical", "Điền ô trống bằng nhãn 'Không xác định'.")}
                  </li>
                  <li>
                    <strong className="text-ink">{t("profiler.type_multiple_choice", "Nhiều lựa chọn")}:</strong>{" "}
                    {t("profiler.popover_rule_multiple_choice", "Điền ô trống bằng nhãn 'Không xác định'.")}
                  </li>
                  <li>
                    <strong className="text-ink">{t("profiler.type_datetime", "Thời gian")}:</strong>{" "}
                    {t("profiler.popover_rule_datetime", "Giữ nguyên ô trống & chuyển đổi sang datetime.")}
                  </li>
                  <li>
                    <strong className="text-ink">{t("profiler.type_text", "Văn bản")}:</strong>{" "}
                    {t("profiler.popover_rule_text", "Bỏ qua các bước kiểm tra cấu trúc & chuẩn hóa số.")}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Desktop Table with vertical column borders ── */}
      <div className="hidden md:block border border-border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px] border-collapse table-fixed">
            <colgroup>
              {/* name: auto (takes all remaining space) */}
              <col />
              {/* type */}
              <col className="w-[150px]" />
              {/* unique */}
              <col className="w-[120px]" />
              {/* null% */}
              <col className="w-[84px]" />
              {/* charts */}
              <col className="w-[230px]" />
            </colgroup>
            <thead className="bg-[#F7F7F6] border-b border-border">
              <tr>
                <th className="px-3.5 py-2.5 text-left font-semibold text-ink border-r border-border/80">
                  {t("profiler.col_header_name", "Tên cột")}
                </th>
                <th className="px-3.5 py-2.5 text-left font-semibold text-ink border-r border-border/80">
                  {t("profiler.col_header_type", "Loại dữ liệu")}
                </th>
                <th className="px-3.5 py-2.5 text-center font-semibold text-ink border-r border-border/80">
                  <div className="flex flex-col items-center leading-tight">
                    <span>{t("profiler.col_header_unique_line1", "Giá trị")}</span>
                    <span>{t("profiler.col_header_unique_line2", "khác nhau")}</span>
                  </div>
                </th>
                <th className="px-3.5 py-2.5 text-center font-semibold text-ink border-r border-border/80">
                  {t("profiler.col_header_null_pct", "Ô trống")}
                </th>
                <th className="px-3.5 py-2.5 text-left font-semibold text-ink">
                  {t("profiler.col_header_chart_hints", "Gợi ý biểu đồ")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((col, idx) => {
                const effectiveType = getEffectiveType(col);
                const isOverridden = overrides[col.name] !== undefined && overrides[col.name] !== col.detected_type;
                const suggestedCharts = getSuggestedChartsForType(effectiveType, col);

                return (
                  <tr
                    key={col.name}
                    className={`transition-colors hover:bg-neutral-50/70 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                      }`}
                  >
                    {/* 1. Tên cột: text-left, border-r */}
                    <td className="px-3.5 py-2.5 text-left text-sm text-ink align-middle border-r border-border/80">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <div className="font-medium text-ink min-w-0 flex-1 break-words leading-snug">
                          <ExpandableText text={col.name} />
                        </div>

                        {/* Status Icons */}
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {col.null_pct > 60 && (
                            <span
                              title={t("profiler.col_alert_missing_60", "Thiếu hơn 60% dữ liệu")}
                              aria-label={t("profiler.col_alert_missing_60", "Thiếu hơn 60% dữ liệu")}
                              className="text-[#9F2F2D]"
                            >
                              <AlertCircle size={15} />
                            </span>
                          )}
                          {col.unique_count === 1 && (
                            <span
                              title={t("profiler.col_alert_unique_1", "Chỉ có 1 giá trị duy nhất")}
                              aria-label={t("profiler.col_alert_unique_1", "Chỉ có 1 giá trị duy nhất")}
                              className="text-[#D97706]"
                            >
                              <AlertCircle size={15} />
                            </span>
                          )}
                          {col.disguised_numeric?.is_disguised && (
                            <span
                              title={t("profiler.col_alert_disguised_numeric", "Cột chứa dữ liệu số nhưng lưu dưới dạng văn bản.")}
                              aria-label={t("profiler.col_alert_disguised_numeric", "Cột chứa dữ liệu số nhưng lưu dưới dạng văn bản.")}
                              className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#FEF6E6] text-[#854D0E] border border-[#FDE68A] whitespace-nowrap"
                            >
                              <AlertTriangle size={11} className="inline mr-1 text-[#D97706]" aria-hidden="true" />
                              {t("profiler.col_badge_likely_numeric", "Có thể là số")}
                            </span>
                          )}
                        </div>
                      </div>

                      {col.unnamed_warning && (
                        <div className="mt-1 text-xs text-[#1D4ED8] flex items-center gap-1 font-normal">
                          <Info size={12} className="shrink-0" aria-hidden="true" />
                          <span>{t("profiler.col_unnamed_warning", { defaultValue: col.unnamed_warning })}</span>
                        </div>
                      )}
                    </td>

                    {/* 2. Loại dữ liệu: text-left, border-r */}
                    <td className="px-3.5 py-2.5 text-left align-middle border-r border-border/80">
                      <TypeDropdownButton
                        colName={col.name}
                        effectiveType={effectiveType}
                        detectedType={col.detected_type}
                        isOverridden={isOverridden}
                        onSelectType={handleOverride}
                        onReset={handleOverride}
                      />
                    </td>

                    {/* 3. Giá trị khác nhau: text-center (align-middle), tabular-nums, border-r */}
                    <td className="px-3.5 py-2.5 text-center font-mono text-sm text-ink align-middle tabular-nums border-r border-border/80">
                      {col.unique_count.toLocaleString(numberLocale)}
                    </td>

                    {/* 4. Ô trống: text-center (align-middle), tabular-nums, border-r */}
                    <td className="px-3.5 py-2.5 text-center font-mono text-sm align-middle tabular-nums border-r border-border/80">
                      {col.null_pct > 0 ? (
                        <span
                          className={
                            col.null_pct > 60
                              ? "text-[#9F2F2D] font-semibold"
                              : col.null_pct > 30
                                ? "text-[#B45309] font-medium"
                                : "text-ink"
                          }
                        >
                          {col.null_pct.toLocaleString(numberLocale)}%
                        </span>
                      ) : (
                        <span className="text-muted/60">0%</span>
                      )}
                    </td>

                    {/* 5. Gợi ý biểu đồ: text-left, aligned to the left so no weird empty spaces */}
                    <td className="px-3.5 py-2.5 text-left align-middle">
                      <div className="flex gap-1.5 flex-wrap items-center justify-start">
                        {suggestedCharts.length > 0 ? (
                          suggestedCharts.map((chart) => {
                            const chartCfg = CHART_CONFIG[chart];
                            const ChartIcon = chartCfg?.icon;
                            return (
                              <span
                                key={chart}
                                title={t(chartCfg?.i18nKey || chart, { defaultValue: chart })}
                                aria-label={t(chartCfg?.i18nKey || chart, { defaultValue: chart })}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB]"
                              >
                                {ChartIcon && <ChartIcon size={12} strokeWidth={2} aria-hidden="true" />}
                                <span>{t(chartCfg?.i18nKey || chart, { defaultValue: chart })}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-muted text-xs italic">
                            {effectiveType === "text"
                              ? t("profiler.chart_not_suitable", "Không phù hợp để vẽ biểu đồ")
                              : "—"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div >
      </div >

      {/* ── 3. Mobile Cards View (< 768px) ── */}
      < div className="block md:hidden space-y-3" >
        {
          visible.map((col) => {
            const effectiveType = getEffectiveType(col);
            const isOverridden = overrides[col.name] !== undefined && overrides[col.name] !== col.detected_type;
            const suggestedCharts = getSuggestedChartsForType(effectiveType, col);
            const isExpanded = Boolean(expandedMobileRows[col.name]);

            return (
              <div
                key={col.name}
                className="border border-border rounded-xl p-3 bg-white shadow-sm space-y-2.5"
              >
                {/* Card Header: Name + TypeDropdownButton */}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-ink break-words flex-1 leading-snug">
                    {col.name}
                  </div>
                  <TypeDropdownButton
                    colName={col.name}
                    effectiveType={effectiveType}
                    detectedType={col.detected_type}
                    isOverridden={isOverridden}
                    onSelectType={handleOverride}
                    onReset={handleOverride}
                  />
                </div>

                {/* Status Warning if any */}
                {isAttentionColumn(col) && (
                  <div className="flex items-center gap-1.5 text-xs text-[#854D0E] bg-[#FEF6E6] px-2 py-1 rounded border border-[#FDE68A]">
                    <AlertTriangle size={13} className="text-[#D97706] shrink-0" aria-hidden="true" />
                    <span>
                      {col.null_pct > 60
                        ? t("profiler.col_alert_missing_60", "Thiếu hơn 60% dữ liệu")
                        : col.unique_count === 1
                          ? t("profiler.col_alert_unique_1", "Chỉ có 1 giá trị duy nhất")
                          : col.disguised_numeric?.is_disguised
                            ? t("profiler.col_alert_disguised_numeric", "Có thể là số")
                            : t("profiler.col_unnamed_warning", "Cần đặt lại tên")}
                    </span>
                  </div>
                )}

                {/* Quick stats row */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                  <div className="text-center border-r border-border/60 pr-2">
                    <span className="text-muted block text-[11px] uppercase tracking-wider">
                      {t("profiler.col_header_unique_diff", "Khác nhau")}
                    </span>
                    <span className="font-mono font-medium text-ink tabular-nums">
                      {col.unique_count.toLocaleString(numberLocale)}
                    </span>
                  </div>
                  <div className="text-center pl-2">
                    <span className="text-muted block text-[11px] uppercase tracking-wider">
                      {t("profiler.col_header_null_pct", "Ô trống")}
                    </span>
                    <span className="font-mono font-medium text-ink tabular-nums">
                      {col.null_pct > 0 ? `${col.null_pct.toLocaleString(numberLocale)}%` : "0%"}
                    </span>
                  </div>
                </div>

                {/* Expand details for Chart suggestions on mobile */}
                <button
                  type="button"
                  onClick={() => toggleMobileRow(col.name)}
                  className="w-full text-xs text-muted hover:text-ink flex items-center justify-between pt-1 border-t border-border/40 cursor-pointer"
                >
                  <span>{t("profiler.col_header_chart_hints", "Gợi ý biểu đồ")}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded && (
                  <div className="pt-1.5 flex gap-1.5 flex-wrap justify-start">
                    {suggestedCharts.length > 0 ? (
                      suggestedCharts.map((chart) => {
                        const chartCfg = CHART_CONFIG[chart];
                        const ChartIcon = chartCfg?.icon;
                        return (
                          <span
                            key={chart}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB]"
                          >
                            {ChartIcon && <ChartIcon size={12} />}
                            <span>{t(chartCfg?.i18nKey || chart, { defaultValue: chart })}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-muted text-xs italic">
                        {effectiveType === "text"
                          ? t("profiler.chart_not_suitable", "Không phù hợp để vẽ biểu đồ")
                          : "—"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        }
      </div >

      {/* ── 4. Show More / Show Less Toggle ── */}
      {
        hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-ink py-2 border border-dashed border-border rounded-lg transition-colors hover:border-forest hover:bg-sage/10 cursor-pointer"
          >
            {showAll ? (
              <>
                <ChevronUp size={14} aria-hidden="true" />
                <span>{t("profiler.col_show_less", "Thu gọn bớt")}</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} aria-hidden="true" />
                <span>
                  {t("profiler.col_show_all", {
                    count: filteredCols.length.toLocaleString(numberLocale),
                    defaultValue: `Hiển thị toàn bộ ${filteredCols.length} cột`,
                  })}
                </span>
              </>
            )}
          </button>
        )
      }
    </div >
  );
};
