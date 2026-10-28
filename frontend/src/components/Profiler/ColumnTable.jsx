import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { AlertCircle, AlertTriangle, Info, Download, ChevronDown, ChevronUp } from "lucide-react";
import { CARD, TEXT, BTN } from "../../constants/ui";
import { TypeBadge } from "./Badges";
import { ExpandableText } from "./ExpandableText";
import { getCurrentLang } from "../../i18n";

const COLUMN_TYPES = ["numeric", "datetime", "categorical", "multiple_choice", "text"];
const DEFAULT_VISIBLE = 10;

export const ColumnTable = ({
  result,
  overrides,
  getEffectiveType,
  handleOverride
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  if (!result) return null;

  const cols = result.columns;
  const visible = showAll ? cols : cols.slice(0, DEFAULT_VISIBLE);
  const hasMore = cols.length > DEFAULT_VISIBLE;
  const lang = getCurrentLang();
  const numberLocale = lang === "vi" ? "vi-VN" : "en-US";

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className={TEXT.sectionTitle}>{t("profiler.col_section_title")}</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            <Trans
              i18nKey="profiler.col_showing"
              values={{
                visible: visible.length.toLocaleString(numberLocale),
                total: cols.length.toLocaleString(numberLocale),
              }}
              components={{
                1: <strong className="text-ink" />,
                3: <strong className="text-ink" />,
              }}
            />
          </span>
          {/* Download report */}
          <button
            onClick={() => {
              const dataStr =
                "data:text/json;charset=utf-8," +
                encodeURIComponent(JSON.stringify(result, null, 2));
              const a = document.createElement("a");
              a.setAttribute("href", dataStr);
              a.setAttribute(
                "download",
                `${result.filename.split(".")[0]}_report.json`
              );
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
            className={`${BTN.secondary} flex items-center gap-1.5 !py-1 !text-xs`}
          >
            <Download size={13} /> {t("profiler.col_download_report")}
          </button>
        </div>
      </div>

      {/* Table — horizontal scroll on mobile */}
      <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#F9F9F8] border-b border-border text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">{t("profiler.col_header_name")}</th>
                <th className="text-left px-3 py-2 font-medium">{t("profiler.col_header_detected")}</th>
                <th
                  className="text-left px-3 py-2 font-medium"
                  title={t("profiler.col_header_override_tooltip")}
                >
                  {t("profiler.col_header_override")}
                </th>
                <th className="text-right px-3 py-2 font-medium">{t("profiler.col_header_unique")}</th>
                <th className="text-right px-3 py-2 font-medium">{t("profiler.col_header_null_pct")}</th>
                <th className="text-left px-3 py-2 font-medium">{t("profiler.col_header_chart_hints")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((col, idx) => {
                const effectiveType = getEffectiveType(col);
                const isOverridden = overrides[col.name] !== undefined;

                return (
                  <tr
                    key={col.name}
                    className={`border-b border-border last:border-b-0 ${
                      idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                    }`}
                  >
                    {/* Column Name */}
                    <td className="px-3 py-2 font-mono text-xs text-ink max-w-[220px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="max-w-[200px] whitespace-normal">
                          <ExpandableText text={col.name} />
                        </div>
                        {col.null_pct > 60 && (
                          <AlertCircle
                            className="w-3 h-3 text-red-500 cursor-help shrink-0"
                            title={t("profiler.col_alert_missing_60")}
                          />
                        )}
                        {col.unique_count === 1 && (
                          <AlertCircle
                            className="w-3 h-3 text-amber-500 cursor-help shrink-0"
                            title={t("profiler.col_alert_unique_1")}
                          />
                        )}
                        {col.low_confidence &&
                          !col.disguised_numeric?.is_disguised && (
                            <AlertCircle
                              className="w-3 h-3 text-orange-500 cursor-help shrink-0"
                              title={t("profiler.col_alert_low_confidence")}
                            />
                          )}
                        {col.disguised_numeric?.is_disguised && (
                          <span
                            title={t("profiler.col_alert_disguised_numeric")}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700 cursor-help whitespace-nowrap border border-amber-200"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
                            {t("profiler.col_badge_likely_numeric")}
                          </span>
                        )}
                      </div>
                      {col.disguised_numeric?.is_disguised &&
                        col.disguised_numeric.sample_convertible?.length > 0 && (
                          <div className="mt-1 text-[9px] text-muted flex flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
                            {col.disguised_numeric.sample_convertible.map(
                              (sample, i) => (
                                <span key={i}>
                                  {sample}
                                  {i <
                                  col.disguised_numeric.sample_convertible
                                    .length -
                                    1
                                    ? " · "
                                    : ""}
                                </span>
                              )
                            )}
                            {col.disguised_numeric.null_synonym_count > 0 && (
                              <span>· N/A → NaN</span>
                            )}
                          </div>
                        )}
                      {col.unnamed_warning && (
                        <div className="mt-1 text-[9px] text-blue-600 flex items-center gap-1">
                          <Info className="w-3 h-3 shrink-0" />
                          <span>{t("profiler.col_unnamed_warning", { defaultValue: col.unnamed_warning })}</span>
                        </div>
                      )}
                    </td>

                    {/* Detected Type */}
                    <td className="px-3 py-2">
                      <TypeBadge type={col.detected_type} />
                    </td>

                    {/* Override dropdown */}
                    <td className="px-3 py-2">
                      <select
                        id={`override-${col.name}`}
                        value={effectiveType}
                        onChange={(e) => handleOverride(col.name, e.target.value)}
                        className={`text-xs rounded border px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-forest focus:border-forest ${
                          isOverridden
                            ? "border-forest text-forest"
                            : "border-border text-muted"
                        }`}
                      >
                        {COLUMN_TYPES.map((colType) => (
                          <option key={colType} value={colType}>
                            {t(`profiler.type_${colType}`, { defaultValue: colType })}
                          </option>
                        ))}
                      </select>
                      {isOverridden && (
                        <button
                          onClick={() =>
                            handleOverride(col.name, col.detected_type)
                          }
                          className="ml-1.5 text-[10px] text-muted hover:text-ink underline"
                          title={t("profiler.col_override_reset_tooltip")}
                        >
                          {t("profiler.col_override_reset")}
                        </button>
                      )}
                    </td>

                    {/* Unique count */}
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                      {col.unique_count.toLocaleString(numberLocale)}
                    </td>

                    {/* Null % */}
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                      {col.null_pct > 0 ? (
                        <span
                          className={
                            col.null_pct > 30 ? "text-[#9F2F2D] font-medium" : ""
                          }
                        >
                          {col.null_pct.toLocaleString(numberLocale)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Chart hints */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {col.suggested_charts.length > 0
                          ? col.suggested_charts.map((chart) => (
                              <span
                                key={chart}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-sage text-forest border border-[#c8e0cb]"
                              >
                                {t(`profiler.chart_${chart}`, { defaultValue: chart })}
                              </span>
                            ))
                          : <span className="text-muted text-xs">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show more / Show less toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-muted hover:text-ink py-1.5 border border-dashed border-border rounded-lg transition-colors hover:border-forest hover:bg-sage/10"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> {t("profiler.col_show_less")}
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> {t("profiler.col_show_all", { count: cols.length.toLocaleString(numberLocale) })}
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <p className="mt-2 text-[10px] text-muted">
        {t("profiler.col_footer_note", { hash: result.file_hash.slice(0, 8) })}
      </p>
    </div>
  );
};


