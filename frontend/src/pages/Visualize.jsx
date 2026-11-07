import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/axiosClient";
import {
  Check, X, AlertTriangle, ArrowLeft, ArrowRight, Lock, FolderUp, Upload,
  Info, Edit2, ChevronUp, ChevronDown, Lightbulb, Maximize2, FilePlus2, FileCheck2, Settings
} from "lucide-react";
import {
  DistributionChart, CategoricalChart, TrendChart,
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import {
  parseSortKey,
  sortCategories,
  computeEffectiveChart,
} from "../utils/chartView";
import PageHelpDocs from "../components/PageHelpDocs";
import AnchorScatterPanel from "../components/charts/AnchorScatterPanel";
import AIInsightsCard from "../components/charts/AIInsightsCard";
import { getUser } from "../services/authService";
import { profileFile, getSessionStatus, getAIUsage } from "../services/profilerService";
import FileExpiredBanner from "../components/FileExpiredBanner";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import PageHeader from "../components/PageHeader";
import { BTN } from "../constants/ui";

const CURRENT_SUMMARY_VERSION = 3;
const ENABLE_CHART_EDIT = false; // bật lại khi xử lý xong cache-invalidation cho edit chart
const EMPTY_SETTINGS = Object.freeze({});

function LazyChart({ height, children }) {
  const [isVisible, setIsVisible] = useState(() => {
    return typeof window === "undefined" || !("IntersectionObserver" in window);
  });
  const containerRef = useRef(null);

  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full">
      {isVisible ? children : (
        <div
          className="w-full h-full bg-[#F9F9F8] rounded-lg animate-pulse flex items-center justify-center border border-[#EAEAEA]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function formatInsight(insight, t, lang) {
  if (!insight) return "";
  if (insight.text) return insight.text;
  const { key, params = {} } = insight;
  if (!key) return "";

  const currentLang = lang || (t?.i18n ? t.i18n.language : "vi");
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  const formattedParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number") {
      if (k === "mean") {
        formattedParams[k] = v.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else if (k === "pct") {
        formattedParams[k] = v.toLocaleString(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      } else {
        formattedParams[k] = v.toLocaleString(locale, {
          maximumFractionDigits: Number.isInteger(v) ? 0 : 1,
          minimumFractionDigits: Number.isInteger(v) ? 0 : 1,
        });
      }
    } else {
      formattedParams[k] = v;
    }
  }

  const translationKey = `visualize.insight.${key}`;
  const translated = t(translationKey, formattedParams);
  if (!translated || translated === translationKey) {
    return "";
  }
  return translated;
}

export function getInsightTooltip(insight, t, lang) {
  if (!insight) return undefined;
  const { key, params = {} } = insight;

  // Mean insights
  if (key === "scale_mean" || key === "discrete_mean" || params.mean !== undefined) {
    return t("visualize.insight_tooltip_mean");
  }

  // Pct insights
  if (
    params.pct !== undefined ||
    key === "scale_top_box" ||
    key === "discrete_top" ||
    key === "top_value" ||
    key === "top3_share" ||
    key === "mc_top" ||
    key === "trend_up" ||
    key === "trend_down"
  ) {
    if (params.count !== undefined && params.n !== undefined) {
      const currentLang = lang || (t?.i18n ? t.i18n.language : "vi");
      const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";
      return t("visualize.insight_tooltip_pct", {
        count: typeof params.count === "number" ? params.count.toLocaleString(locale) : params.count,
        n: typeof params.n === "number" ? params.n.toLocaleString(locale) : params.n,
      });
    }
    return t("visualize.insight_tooltip_pct_fallback");
  }

  return undefined;
}

function getSubtitle(chart, stats, summary, t) {
  if (chart.type === "heatmap") {
    const numCols = Object.keys(chart.matrix || {}).length;
    return t("visualize.subtitle_heatmap", { count: numCols });
  }
  if (stats?.dtype === "multiple_choice") {
    const resp = stats.respondents ?? summary?.shape?.[0] ?? "";
    return t("visualize.subtitle_multiple_choice", { count: resp });
  }
  if (stats?.dtype === "categorical" || chart.type === "bar") {
    const totalRows = summary?.shape?.[0] ?? "";
    return t("visualize.subtitle_categorical", { count: totalRows });
  }
  if (chart.type === "histogram") {
    const totalRows = summary?.shape?.[0] ?? "";
    return t("visualize.subtitle_numeric", { count: totalRows });
  }
  if (chart.type === "line" || stats?.dtype === "datetime") {
    const days = stats?.range_days;
    return days
      ? t("visualize.subtitle_time_days", { count: days })
      : t("visualize.subtitle_time_points", { count: chart.data?.length || 0 });
  }
  return t("visualize.subtitle_generic", { count: summary?.shape?.[0] || "" });
}

function isSummaryStale(summary, currentOverrides) {
  if (!summary) return true;
  if (summary.summary_version !== CURRENT_SUMMARY_VERSION) return true;

  const cleanCurrent = Object.fromEntries(
    Object.entries(currentOverrides || {}).filter(([_, v]) => v && v !== "auto")
  );
  const cleanSaved = Object.fromEntries(
    Object.entries(summary.computed_overrides || {}).filter(([_, v]) => v && v !== "auto")
  );
  if (JSON.stringify(cleanCurrent) !== JSON.stringify(cleanSaved)) {
    return true;
  }

  const cols = Object.values(summary.columns || {});
  for (const c of cols) {
    if (!c.skip_chart) {
      if (c.dtype === "categorical" && !c.all_values) return true;
      if (c.dtype === "multiple_choice" && (c.respondents === undefined || !c.all_values)) return true;
    }
    if (c.auto_insights && c.auto_insights.some(ins => ins.key === undefined && !ins.text)) return true;
  }

  return false;
}

export function getSuggestedReason(chart, stats, summary, t, currentLang = "vi") {
  const isEn = currentLang.startsWith("en");

  if (chart.type === "heatmap") {
    const strongCorrPairs = (summary?.top_correlations || []).filter(
      tc => Math.abs(typeof tc.r === "number" ? tc.r : parseFloat(tc.r)) >= 0.5
    );
    const n = strongCorrPairs.length;
    return t("visualize.badge_suggested_reason_heatmap", {
      n,
      defaultValue: isEn
        ? `Pre-selected: ${n} pairs with fairly strong correlation (|r| ≥ 0.5). Click 'Added to report' to deselect.`
        : `Chọn sẵn vì có ${n} cặp cột liên quan khá mạnh (r ≥ 0,5). Bấm 'Đã thêm vào báo cáo' để bỏ chọn.`
    });
  }

  if (chart.type === "line" || stats?.dtype === "datetime") {
    return t("visualize.badge_suggested_reason_time", {
      defaultValue: isEn
        ? "Pre-selected for report based on time trend. Click 'Added to report' to deselect."
        : "Chọn sẵn cho báo cáo theo xu hướng thời gian. Bấm 'Đã thêm vào báo cáo' để bỏ chọn."
    });
  }

  // Distribution / categorical
  const missing = typeof stats?.missing_pct === "number"
    ? (Number.isInteger(stats.missing_pct) ? stats.missing_pct : stats.missing_pct.toFixed(1))
    : 0;

  const insights = stats?.auto_insights || [];
  let insightPart = "";
  if (insights.length > 0) {
    const firstText = formatInsight(insights[0], t, currentLang);
    if (firstText) {
      const lowerFirst = firstText.charAt(0).toLowerCase() + firstText.slice(1);
      const andWord = isEn ? ", and " : ", và ";
      insightPart = `${andWord}${lowerFirst}`;
    }
  }

  return t("visualize.badge_suggested_reason_dist", {
    missing,
    insight_part: insightPart,
    defaultValue: isEn
      ? `Pre-selected for report: only ${missing}% missing${insightPart}. Click 'Added to report' to deselect.`
      : `Chọn sẵn cho báo cáo vì chỉ trống ${missing}%${insightPart}. Bấm 'Đã thêm vào báo cáo' để bỏ chọn.`
  });
}

export function ChartSettingsPopover({ chart, stats, settings = {}, onUpdateSettings, onResetSettings }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!chart || chart.type === "heatmap" || chart.type === "line" || stats?.dtype === "datetime") {
    return null;
  }

  const isCategorical = stats?.dtype === "categorical" || (chart.type === "bar" && stats?.dtype !== "multiple_choice");
  const isMultipleChoice = stats?.dtype === "multiple_choice";
  const isDiscrete = stats?.is_discrete;
  const isScale = stats?.is_discrete && stats?.is_scale;
  const isContinuous = stats?.dtype === "numeric" && !stats?.is_discrete;

  const canBox = isContinuous &&
    stats?.min !== undefined &&
    stats?.p25 !== undefined &&
    stats?.median !== undefined &&
    stats?.p75 !== undefined &&
    stats?.max !== undefined;

  const showDisplayType = (isCategorical || isDiscrete) || (isContinuous && canBox);
  const showTopN = isCategorical || isMultipleChoice;
  const showSort = isCategorical;
  const showHideZero = isScale;

  if (!showDisplayType && !showTopN && !showSort && !showHideZero) {
    return null;
  }

  const displayType = settings.display_type || (isContinuous ? "histogram" : "bar");
  const topN = settings.top_n || "auto";
  const sort = settings.sort || "by_count";
  const hideZero = Boolean(settings.hide_zero);

  const isCustomized = Boolean(
    (settings.display_type && settings.display_type !== (isContinuous ? "histogram" : "bar")) ||
    (settings.top_n && settings.top_n !== "auto") ||
    (settings.sort && settings.sort !== "by_count") ||
    settings.hide_zero
  );

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isOpen || isCustomized
            ? "bg-[#EAF2EB] text-[#1B4324] border border-[#1B4324]/30"
            : "text-[#626C65] hover:text-[#121A14] hover:bg-[#F3F4F2]"
        }`}
        title={t("visualize.settings_btn_tooltip")}
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-[#E5E5E3] rounded-xl shadow-xl p-3.5 z-[100] text-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#EAEAEA]">
            <span className="font-semibold text-[#121A14]">
              {t("visualize.settings_title")}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#626C65] hover:text-[#121A14] p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* display_type */}
          {showDisplayType && (
            <div>
              <label className="block text-[11px] font-medium text-[#626C65] mb-1.5">
                {t("visualize.settings_display_type")}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(isCategorical || isDiscrete) && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ display_type: "bar" })}
                      className={`py-1 px-2 rounded-md text-xs font-medium border text-center transition-colors ${
                        displayType === "bar"
                          ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                          : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                      }`}
                    >
                      {t("visualize.settings_type_bar")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ display_type: "pie" })}
                      className={`py-1 px-2 rounded-md text-xs font-medium border text-center transition-colors ${
                        displayType === "pie"
                          ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                          : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                      }`}
                    >
                      {t("visualize.settings_type_pie")}
                    </button>
                  </>
                )}
                {isContinuous && canBox && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ display_type: "histogram" })}
                      className={`py-1 px-2 rounded-md text-xs font-medium border text-center transition-colors ${
                        displayType === "histogram"
                          ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                          : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                      }`}
                    >
                      {t("visualize.settings_type_histogram")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ display_type: "box" })}
                      className={`py-1 px-2 rounded-md text-xs font-medium border text-center transition-colors ${
                        displayType === "box"
                          ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                          : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                      }`}
                    >
                      {t("visualize.settings_type_box")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* top_n */}
          {showTopN && displayType !== "pie" && (
            <div>
              <label className="block text-[11px] font-medium text-[#626C65] mb-1.5">
                {t("visualize.settings_top_n")}
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "auto", label: t("visualize.settings_top_auto") },
                  { id: 10, label: "10" },
                  { id: 15, label: "15" },
                  { id: "all", label: t("visualize.settings_top_all") },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ top_n: opt.id })}
                    className={`py-1 px-1 rounded-md text-[11px] font-medium border text-center transition-colors ${
                      String(topN) === String(opt.id)
                        ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                        : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* sort */}
          {showSort && displayType !== "pie" && (
            <div>
              <label className="block text-[11px] font-medium text-[#626C65] mb-1.5">
                {t("visualize.settings_sort")}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ sort: "by_count" })}
                  className={`py-1 px-1.5 rounded-md text-[11px] font-medium border text-center transition-colors ${
                    sort === "by_count"
                      ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                      : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                  }`}
                >
                  {t("visualize.settings_sort_count")}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ sort: "by_value" })}
                  className={`py-1 px-1.5 rounded-md text-[11px] font-medium border text-center transition-colors ${
                    sort === "by_value"
                      ? "bg-[#EAF2EB] text-[#1B4324] border-[#1B4324]/30 font-semibold"
                      : "bg-[#F9F9F8] text-[#626C65] border-[#E5E5E3] hover:text-[#121A14]"
                  }`}
                >
                  {t("visualize.settings_sort_value")}
                </button>
              </div>
            </div>
          )}

          {/* hide_zero */}
          {showHideZero && displayType !== "pie" && (
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#2A342D]">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={e => onUpdateSettings({ hide_zero: e.target.checked })}
                  className="rounded border-[#E5E5E3] text-[#1B4324] focus:ring-[#1B4324] w-3.5 h-3.5"
                />
                <span>{t("visualize.settings_hide_zero")}</span>
              </label>
            </div>
          )}

          {/* Reset to default */}
          <div className="pt-2 border-t border-[#EAEAEA] flex justify-end">
            <button
              type="button"
              onClick={() => {
                onResetSettings();
              }}
              className="text-[11px] text-[#626C65] hover:text-[#1B4324] hover:underline"
            >
              {t("visualize.settings_reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ChartCard = memo(({
  chart,
  isSelected,
  toggleChart,
  summary,
  onUpdate,
  onCellClick,
  anchorPair,
  sessionId,
  fileHash,
  onMaximize,
  isSuggested,
  settings = EMPTY_SETTINGS,
  onUpdateSettings,
  onResetSettings,
  aiUsage,
  onUsageUpdated,
}) => {
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [localTitle, setLocalTitle] = useState(chart.user_title || chart.title);

  const stats = summary?.columns?.[chart.col];
  const insights = stats?.auto_insights || [];
  const displayTitle = chart.user_title || chart.title;
  const isLongTitle = (displayTitle || "").length > 40;

  const currentLang = t?.i18n ? t.i18n.language : "vi";
  const effective = useMemo(() => {
    return computeEffectiveChart(chart, stats, settings, summary, t, currentLang);
  }, [chart, stats, settings, summary, t, currentLang]);

  const displayType = effective.displayType;
  const effectiveData = effective.effectiveData;
  const barHeight = effective.calculatedBarHeight;
  const isCapped200 = effective.isCapped200;

  const subtitle = useMemo(() => getSubtitle(chart, stats, summary, t), [chart, stats, summary, t]);
  const suggestedReason = useMemo(() => {
    return isSuggested ? getSuggestedReason(chart, stats, summary, t, currentLang) : "";
  }, [isSuggested, chart, stats, summary, t, currentLang]);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onUpdate(chart.id, { user_title: localTitle });
  };

  return (
    <div className={`bg-white rounded-xl border transition-all p-5 ${isSelected ? "border-[#1B4324] ring-1 ring-[#1B4324]/20 shadow-sm" : "border-[#E5E5E3] hover:border-[#1B4324]/40"}`}>
      <div>
        {/* Header: Checkbox + Title + Subtitle + Toolbar */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                toggleChart(chart.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-[18px] h-[18px] rounded border-[#87938B] text-[#1B4324] accent-[#1B4324] focus:ring-[#1B4324]/30 cursor-pointer shrink-0 mt-0.5"
              aria-label={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
              title={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
            />
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  autoFocus
                  className="px-2 py-1 border border-[#1B4324] rounded text-sm font-semibold outline-none w-full max-w-sm"
                  value={localTitle}
                  onChange={e => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={e => e.key === "Enter" && handleTitleBlur()}
                />
              ) : (
                <div className="group/title flex items-start gap-1.5">
                  <h3 className={`text-sm font-semibold text-[#121A14] leading-snug break-words ${isTitleExpanded ? "" : "line-clamp-2"}`}>
                    {displayTitle}
                  </h3>
                  {isLongTitle && (
                    <button
                      onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                      className="text-[11px] text-[#1B4324] hover:underline font-medium shrink-0 ml-1"
                    >
                      {isTitleExpanded ? t("visualize.title_collapse") : t("visualize.title_expand")}
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover/title:opacity-100 p-0.5 text-[#626C65] hover:text-[#121A14] transition-opacity shrink-0"
                    title={t("visualize.title_edit_tooltip")}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-[#626C65] mt-1 truncate">{subtitle}</p>
            </div>
          </div>

          {/* Top-Right Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isSuggested && (
              <span
                className="text-[10px] font-semibold bg-[#EAF2EB] text-[#1B4324] px-2 py-0.5 rounded-full border border-[#c8e0cb]/50 cursor-help"
                title={suggestedReason}
              >
                {t("visualize.badge_suggested")}
              </span>
            )}
            {effective.hasSettings && (
              <ChartSettingsPopover
                chart={chart}
                stats={stats}
                settings={settings}
                onUpdateSettings={newSettings => onUpdateSettings(chart.id, newSettings)}
                onResetSettings={() => onResetSettings(chart.id)}
              />
            )}
            <button
              onClick={() => onMaximize(chart)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#626C65] hover:text-[#121A14] hover:bg-[#F3F4F2] transition-colors"
              title={t("visualize.btn_maximize")}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart Canvas with Lazy Render */}
        <div className="w-full my-2">
          <LazyChart height={chart.type === "heatmap" || displayType === "pie" ? "auto" : (displayType === "bar" ? `${Math.min(600, barHeight)}px` : "260px")}>
            <div
              className={
                chart.type === "heatmap"
                  ? "w-full"
                  : displayType === "bar" && barHeight > 600
                  ? "w-full max-h-[600px] overflow-y-auto pr-1"
                  : "w-full h-full"
              }
            >
              {displayType === "histogram" && (
                <DistributionChart data={effectiveData} color={chart.color} isDiscrete={stats?.is_discrete} />
              )}
              {displayType === "bar" && (
                <div style={{ height: `${barHeight}px` }}>
                  <CategoricalChart data={effectiveData} color={chart.color} />
                </div>
              )}
              {displayType === "pie" && (
                <div className="w-full py-1 flex items-center justify-center">
                  <PieChartComponent
                    data={effectiveData}
                    color={chart.color}
                    isDiscrete={stats?.is_discrete}
                    isScale={stats?.is_scale}
                  />
                </div>
              )}
              {displayType === "box" && (
                <div className="h-[260px]">
                  <BoxPlotChart stats={stats} color={chart.color} />
                </div>
              )}
              {chart.type === "line" && <TrendChart data={effectiveData} color={chart.color} />}
              {chart.type === "heatmap" && <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} onCellClick={onCellClick} anchorPair={anchorPair} />}
            </div>
          </LazyChart>
          {isCapped200 && (
            <p className="text-[11px] text-[#8C948D] mt-1.5 italic text-center">
              {t("visualize.capped_200_note")}
            </p>
          )}
        </div>

        {/* Discrete scale / rating subtitle */}
        {stats?.is_discrete && (
          <p className="text-[11px] text-[#626C65] mt-1">
            {stats.is_scale
              ? t("visualize.scale_subtitle", { min: stats.scale_min, max: stats.scale_max, n: stats.respondents })
              : t("visualize.discrete_subtitle", { n: stats.respondents })
            }
          </p>
        )}

        {/* Multiple choice note */}
        {stats?.dtype === "multiple_choice" && (
          <p className="text-[11px] text-[#626C65] mt-1 italic">
            {t("visualize.mc_disclaimer")}
          </p>
        )}

        {/* Auto Insights */}
        {chart.type !== "heatmap" && insights.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#E5E5E3]">
            <p className="text-xs font-semibold text-[#1B4324] mb-1.5 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-[#1B4324]" /> {t("visualize.auto_insights_title")}
            </p>
            <ul className="space-y-1">
              {insights.slice(0, 2).map((ins, idx) => {
                const text = formatInsight(ins, t);
                if (!text) return null;
                const tooltip = getInsightTooltip(ins, t);
                return (
                  <li
                    key={idx}
                    className={`text-xs text-[#2A342D] leading-snug line-clamp-2 ${tooltip ? "cursor-help" : ""}`}
                    title={tooltip}
                  >
                    • {text}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* AI Explain */}
        <AIInsightsCard
          sessionId={sessionId}
          fileHash={fileHash}
          chart={chart}
          autoInsights={insights}
          anchorPair={anchorPair}
          aiUsage={aiUsage}
          onUsageUpdated={onUsageUpdated}
        />
      </div>
    </div>
  );
});

const EnlargedChartModal = ({
  chart,
  summary,
  isSelected,
  toggleChart,
  onClose,
  sessionId,
  fileHash,
  anchorPair,
  onCellClick,
  settings = EMPTY_SETTINGS,
  onUpdateSettings,
  onResetSettings,
  aiUsage,
  onUsageUpdated,
}) => {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setIsReady(false);
    if (!chart) return;
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [chart?.id]);

  if (!chart) return null;
  const stats = summary?.columns?.[chart.col];
  const insights = stats?.auto_insights || [];
  const subtitle = getSubtitle(chart, stats, summary, t);

  const currentLang = t?.i18n ? t.i18n.language : "vi";
  const effective = computeEffectiveChart(chart, stats, settings, summary, t, currentLang);
  const displayType = effective.displayType;
  const effectiveData = effective.effectiveData;
  const isCapped200 = effective.isCapped200;
  const modalBarHeight = Math.max(300, (effectiveData?.length || 5) * 26 + 40);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#E5E5E3] w-full max-w-5xl h-full sm:h-[88vh] max-h-[920px] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E3] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 pr-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                toggleChart(chart.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-[18px] h-[18px] rounded border-[#87938B] text-[#1B4324] accent-[#1B4324] focus:ring-[#1B4324]/30 cursor-pointer shrink-0"
              aria-label={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
              title={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
            />
            <div>
              <h2 className="text-base sm:lg font-bold text-[#121A14]">{chart.user_title || chart.title}</h2>
              <p className="text-xs text-[#626C65] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {effective.hasSettings && (
              <ChartSettingsPopover
                chart={chart}
                stats={stats}
                settings={settings}
                onUpdateSettings={newSettings => onUpdateSettings(chart.id, newSettings)}
                onResetSettings={() => onResetSettings(chart.id)}
              />
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#626C65] hover:text-[#121A14] hover:bg-[#F3F4F2] transition-colors"
              title={t("visualize.modal_close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="w-full">
            {!isReady ? (
              <div
                style={{ height: `${displayType === "bar" ? modalBarHeight : 360}px` }}
                className="w-full bg-[#F9F9F8] rounded-xl flex items-center justify-center border border-[#EAEAEA] animate-pulse"
              >
                <div className="w-8 h-8 rounded-full border-2 border-[#1B4324] border-t-transparent animate-spin opacity-40" />
              </div>
            ) : (
              <>
                {displayType === "histogram" && (
                  <div className="h-[360px]">
                    <DistributionChart data={effectiveData} color={chart.color} isDiscrete={stats?.is_discrete} isAnimationActive={false} debounce={100} />
                  </div>
                )}
                {displayType === "bar" && (
                  <div className={modalBarHeight > 700 ? "max-h-[700px] overflow-y-auto pr-1" : ""}>
                    <div style={{ height: `${modalBarHeight}px` }}>
                      <CategoricalChart data={effectiveData} color={chart.color} isAnimationActive={false} debounce={100} />
                    </div>
                  </div>
                )}
                {displayType === "pie" && (
                  <div className="w-full py-2 flex items-center justify-center">
                    <PieChartComponent
                      data={effectiveData}
                      color={chart.color}
                      isDiscrete={stats?.is_discrete}
                      isScale={stats?.is_scale}
                      isAnimationActive={false}
                      debounce={100}
                    />
                  </div>
                )}
                {displayType === "box" && (
                  <div className="h-[360px]">
                    <BoxPlotChart stats={stats} color={chart.color} isAnimationActive={false} debounce={100} />
                  </div>
                )}
                {chart.type === "line" && (
                  <div className="h-[360px]">
                    <TrendChart data={effectiveData} color={chart.color} isAnimationActive={false} debounce={100} />
                  </div>
                )}
                {chart.type === "heatmap" && (
                  <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} onCellClick={onCellClick} anchorPair={anchorPair} />
                )}
              </>
            )}
          </div>

          {isCapped200 && (
            <p className="text-xs text-[#8C948D] italic text-center">
              {t("visualize.capped_200_note")}
            </p>
          )}

          {/* Discrete scale / rating subtitle */}
          {stats?.is_discrete && (
            <p className="text-xs text-[#626C65]">
              {stats.is_scale
                ? t("visualize.scale_subtitle", { min: stats.scale_min, max: stats.scale_max, n: stats.respondents })
                : t("visualize.discrete_subtitle", { n: stats.respondents })
              }
            </p>
          )}

          {stats?.dtype === "multiple_choice" && (
            <p className="text-xs text-[#626C65] italic">
              {t("visualize.mc_disclaimer")}
            </p>
          )}

          {chart.type !== "heatmap" && insights.length > 0 && (
            <div className="p-4 bg-[#F9F9F8] rounded-xl border border-[#E5E5E3]">
              <p className="text-xs font-semibold text-[#1B4324] mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-[#1B4324]" /> {t("visualize.auto_insights_title")}
              </p>
              <ul className="space-y-1.5">
                {insights.map((ins, idx) => {
                  const text = formatInsight(ins, t);
                  if (!text) return null;
                  const tooltip = getInsightTooltip(ins, t);
                  return (
                    <li
                      key={idx}
                      className={`text-xs text-[#2A342D] ${tooltip ? "cursor-help" : ""}`}
                      title={tooltip}
                    >
                      • {text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <AIInsightsCard
            sessionId={sessionId}
            fileHash={fileHash}
            chart={chart}
            autoInsights={insights}
            anchorPair={anchorPair}
            aiUsage={aiUsage}
            onUsageUpdated={onUsageUpdated}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E5E5E3] bg-[#FBFBFA] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs font-medium text-[#626C65] hover:text-[#121A14] transition-colors"
          >
            {t("visualize.modal_close")}
          </button>
        </div>
      </div>
    </div>
  );
};

const generateCharts = (summary, t) => {
  const charts = {
    distribution: [],
    correlation: [],
    time: [],
    other: []
  };

  if (!summary || !summary.columns) return charts;

  Object.entries(summary.columns).forEach(([colName, info]) => {
    if (info.skip_chart) return;

    if (info.dtype === "numeric" && info.distribution_bins) {
      charts.distribution.push({
        id: `dist_${colName}`,
        type: "histogram",
        col: colName,
        title: colName,
        data: info.distribution_bins,
        score: (1 - (info.missing_pct || 0) / 100) + ((info.std || 0) / (Math.abs(info.mean) || 1) * 0.5)
      });
    } else if ((info.dtype === "categorical" || info.dtype === "boolean" || info.dtype === "multiple_choice") && info.top_values) {
      charts.distribution.push({
        id: `cat_${colName}`,
        type: "bar",
        col: colName,
        title: colName,
        data: info.top_values,
        score: 1 - info.missing_pct / 100
      });
    } else if (info.dtype === "datetime" && info.trend_data) {
      charts.time.push({
        id: `time_${colName}`,
        type: "line",
        col: colName,
        title: colName,
        data: info.trend_data,
        score: 1.0
      });
    }
  });

  if (summary.correlation_matrix && Object.keys(summary.correlation_matrix).length > 0) {
    charts.correlation.push({
      id: `corr_heatmap`,
      type: "heatmap",
      title: t ? t("visualize.heatmap_title") : "Ma trận tương quan",
      matrix: summary.correlation_matrix,
      topCorr: summary.top_correlations,
      score: 1.0
    });
  }

  charts.distribution.sort((a, b) => b.score - a.score);
  charts.correlation.sort((a, b) => b.score - a.score);
  charts.time.sort((a, b) => b.score - a.score);

  return charts;
};

function SkippedColumnsPanel({ skippedColumns = [], pipelineMode, navigate }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!skippedColumns || skippedColumns.length === 0) return null;

  return (
    <div className="mt-8 border border-[#E5E5E3] bg-white rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#F9F9F8] transition-colors"
      >
        <span className="text-sm font-semibold text-[#121A14] flex items-center gap-1.5">
          {t("visualize.skipped_panel_title", { n: skippedColumns.length })}
          <span className="text-[#626C65] text-sm font-normal">
            {isExpanded ? "▴" : "▾"}
          </span>
        </span>
        <span className="text-xs text-[#626C65]">
          {isExpanded ? t("visualize.title_collapse") : t("visualize.title_expand")}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-[#E5E5E3] divide-y divide-[#EAEAEA] px-5 py-1">
          {skippedColumns.map((item, idx) => {
            let reasonText = null;
            if (item.reason === "missing_high") {
              reasonText = t("visualize.skipped_missing_high", { pct: item.missing_pct });
            } else if (item.reason === "single_value") {
              reasonText = t("visualize.skipped_single_value");
            } else if (item.reason === "free_text") {
              reasonText = (
                <span>
                  {t("visualize.skipped_free_text_prefix")}
                  <button
                    type="button"
                    onClick={() => navigate(pipelineMode ? "/dashboard/pipeline/profiler" : "/dashboard/profiler")}
                    className="text-[#1B4324] hover:underline font-medium inline"
                  >
                    {t("visualize.skipped_free_text_link")}
                  </button>
                </span>
              );
            } else {
              reasonText = item.reason || "";
            }

            return (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {item.letter && (
                    <span className="font-mono text-xs font-semibold px-1.5 py-0.5 bg-[#F3F4F2] text-[#2A342D] border border-[#E5E5E3] rounded">
                      {item.letter}
                    </span>
                  )}
                  <span className="font-semibold text-[#121A14] truncate">
                    {item.column}
                  </span>
                </div>
                <div className="text-[#626C65] text-xs shrink-0 text-right">
                  {reasonText}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Visualize({ pipelineMode, onComplete, onError }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("distribution");
  const [charts, setCharts] = useState({ distribution: [], correlation: [], time: [], other: [] });
  const [selectedChartIds, setSelectedChartIds] = useState(new Set());
  const [suggestedChartIds, setSuggestedChartIds] = useState(new Set());
  const [customCharts, setCustomCharts] = useState([]);
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [enlargedChart, setEnlargedChart] = useState(null);
  const [showEmptyConfirmModal, setShowEmptyConfirmModal] = useState(false);

  const [showDirectUpload, setShowDirectUpload] = useState(false);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [directSummary, setDirectSummary] = useState(null);
  const [fileExpired, setFileExpired] = useState(false);
  const [aiUsage, setAiUsage] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch AI usage on mount
  useEffect(() => {
    getAIUsage()
      .then((res) => setAiUsage(res.data))
      .catch(() => {});
  }, []);

  // Check session status on mount
  useEffect(() => {
    if (!fileSession.fileHash) return;
    getSessionStatus(fileSession.fileHash)
      .then((res) => {
        if (!res.data.file_available) {
          setFileExpired(true);
        }
      })
      .catch((err) => {
        console.warn("Visualize session status check failed:", err);
      });
  }, [fileSession.fileHash]);

  // Anchor state for Correlation Heatmap
  const [anchorPair, setAnchorPair] = useState(null);
  const [scatterData, setScatterData] = useState(null);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [scatterError, setScatterError] = useState(null);
  const abortRef = useRef(null);

  // Fetch lock refs to prevent duplicate/infinite /visualize/compute loops
  const isFetchingRef = useRef(false);
  const lastFetchedKeyRef = useRef(null);

  // Pre-select 3-5 charts
  const computePreSelection = useCallback((generated, summary) => {
    const selected = new Set();
    const all = [
      ...(generated.distribution || []),
      ...(generated.correlation || []),
      ...(generated.time || [])
    ];

    const strongCorrPairs = (summary?.top_correlations || []).filter(
      tc => Math.abs(typeof tc.r === "number" ? tc.r : parseFloat(tc.r)) >= 0.5
    );

    // 1. At least one per non-empty category
    if (generated.distribution?.length > 0) {
      const bestDist = generated.distribution.find(c => {
        const ins = summary?.columns?.[c.col]?.auto_insights;
        return ins && ins.length > 0;
      }) || generated.distribution[0];
      if (bestDist) selected.add(bestDist.id);
    }

    if (generated.correlation?.length > 0 && generated.correlation[0] && strongCorrPairs.length > 0) {
      selected.add(generated.correlation[0].id);
    }

    if (generated.time?.length > 0) {
      const bestTime = generated.time.find(c => {
        const ins = summary?.columns?.[c.col]?.auto_insights;
        return ins && ins.length > 0;
      }) || generated.time[0];
      if (bestTime) selected.add(bestTime.id);
    }

    // 2. Fill up to 3-5 charts total preferring charts with insights
    for (const c of all) {
      if (selected.size >= 5) break;
      if (selected.has(c.id)) continue;
      if (c.type === "heatmap" && strongCorrPairs.length === 0) continue;
      const ins = summary?.columns?.[c.col]?.auto_insights;
      if (ins && ins.length > 0) {
        selected.add(c.id);
      }
    }

    // 3. Fallback to fill up to at least 3
    for (const c of all) {
      if (selected.size >= 3) break;
      if (selected.has(c.id)) continue;
      if (c.type === "heatmap" && strongCorrPairs.length === 0) continue;
      selected.add(c.id);
    }

    return selected;
  }, []);

  useEffect(() => {
    if (!fileSession.statisticalSummary && !fileSession.fileHash) {
      setShowDirectUpload(true);
      return;
    }
    if (!fileSession.sessionId) return;

    const cleanOverrides = Object.fromEntries(
      Object.entries(fileSession.overrides || {}).filter(([_, v]) => v && v !== "auto")
    );
    const fetchKey = `${fileSession.sessionId}_${JSON.stringify(cleanOverrides)}`;

    const stale = isSummaryStale(fileSession.statisticalSummary, fileSession.overrides);

    if (!fileSession.statisticalSummary || stale) {
      if (isFetchingRef.current || lastFetchedKeyRef.current === fetchKey) {
        return;
      }

      const fetchStats = async () => {
        isFetchingRef.current = true;
        setLoading(true);
        try {
          const res = await api.post("/visualize/compute", {
            session_id: fileSession.sessionId,
            warnings: fileSession.warnings || [],
            overridden_types: cleanOverrides
          });

          lastFetchedKeyRef.current = fetchKey;

          const summary = {
            ...res.data,
            summary_version: CURRENT_SUMMARY_VERSION,
            computed_overrides: cleanOverrides
          };

          updateFileSession({ statisticalSummary: summary });

          const generated = generateCharts(summary, t);
          setCharts(generated);

          if (fileSession.confirmedCharts && fileSession.confirmedCharts.length > 0) {
            setSelectedChartIds(new Set(fileSession.confirmedCharts.map(c => c.chart_id)));
          } else {
            const preSelected = computePreSelection(generated, summary);
            setSuggestedChartIds(preSelected);
            setSelectedChartIds(preSelected);
          }

          if (generated.distribution.length === 0 && generated.correlation.length > 0) setActiveTab("correlation");
          else if (generated.distribution.length === 0 && generated.time.length > 0) setActiveTab("time");

        } catch (err) {
          const detail = err.response?.data?.detail;
          const errCode = err.response?.data?.code || (typeof detail === "string" && detail.includes("ERR_SYS_CACHE_EXPIRED") ? "ERR_SYS_CACHE_EXPIRED" : "");
          if (errCode === "ERR_SYS_CACHE_EXPIRED") {
            setFileExpired(true);
            return;
          }
          showToast(detail || t("visualize.toast_load_error"), "error");
        } finally {
          setLoading(false);
          isFetchingRef.current = false;
        }
      };

      fetchStats();
    } else {
      lastFetchedKeyRef.current = fetchKey;
      const generated = generateCharts(fileSession.statisticalSummary, t);
      setCharts(generated);
      if (fileSession.confirmedCharts && fileSession.confirmedCharts.length > 0) {
        setSelectedChartIds(new Set(fileSession.confirmedCharts.map(c => c.chart_id)));
      } else {
        const preSelected = computePreSelection(generated, fileSession.statisticalSummary);
        setSuggestedChartIds(preSelected);
        setSelectedChartIds(preSelected);
      }
    }
  }, [fileSession.sessionId, fileSession.statisticalSummary, fileSession.fileHash, fileSession.overrides, computePreSelection, t]);

  const handleDirectUpload = async (file) => {
    if (!file) return;
    setIsDirectUploading(true);
    try {
      const profileRes = await profileFile(file);
      const fileHash = profileRes.data.file_hash;
      await detectIssues(fileHash, {});
      await autoClean(fileHash, {});
      const confirmRes = await confirmClean(fileHash, "auto", {});

      const diff = confirmRes.data.clean_report;
      const issuesFixed = (diff.missing_filled ? Object.keys(diff.missing_filled).length : 0) +
        (diff.types_converted ? Object.keys(diff.types_converted).length : 0) +
        (diff.encoding_fixed ? Object.keys(diff.encoding_fixed).length : 0) +
        (diff.duplicate_rows_removed || 0);

      updateFileSession({
        sessionId: confirmRes.data.session_id,
        capabilities: confirmRes.data.validation?.capabilities || null,
        warnings: confirmRes.data.validation?.warnings || [],
        fileHash: fileHash,
        fileName: file.name
      });

      setDirectSummary({
        rows: confirmRes.data.clean_report.clean_rows,
        cols: confirmRes.data.clean_report.clean_cols,
        issuesFixed: issuesFixed,
      });

    } catch (err) {
      showToast(t("visualize.toast_direct_error"), "error");
    } finally {
      setIsDirectUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleDirectUpload(file);
  };

  const toggleChart = useCallback((id, chartObj = null) => {
    setSelectedChartIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        if (chartObj) {
          setCustomCharts(curr => {
            if (curr.find(c => c.id === id)) return curr;
            return [...curr, chartObj];
          });
        }
      }
      return newSet;
    });
  }, []);

  const handleAnchorSelect = useCallback(async (colA, colB, r) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnchorPair({ colA, colB, r });
    setScatterLoading(true);
    setScatterError(null);
    setScatterData(null);

    try {
      const res = await api.post("/visualize/scatter-data", {
        session_id: fileSession.sessionId,
        col_x: colA,
        col_y: colB,
      }, { signal: controller.signal });

      if (!controller.signal.aborted) {
        setScatterData(res.data);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && !controller.signal.aborted) {
        setScatterError(err.response?.data?.detail || t("visualize.toast_scatter_error"));
      }
    } finally {
      if (!controller.signal.aborted) {
        setScatterLoading(false);
      }
    }
  }, [fileSession.sessionId, t]);

  const handleAnchorClear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setAnchorPair(null);
    setScatterData(null);
    setScatterError(null);
  }, []);

  const handleUpdateChart = useCallback((id, newConfig) => {
    setCharts(prev => {
      const newCharts = { ...prev };
      for (const category in newCharts) {
        const idx = newCharts[category].findIndex(c => c.id === id);
        if (idx !== -1) {
          newCharts[category][idx] = { ...newCharts[category][idx], ...newConfig };
          break;
        }
      }
      return newCharts;
    });
  }, []);

  const handleMaximize = useCallback((chart) => {
    setEnlargedChart(chart);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEnlargedChart(null);
  }, []);

  const proceedToReport = (confirmedList) => {
    updateFileSession({ confirmedCharts: confirmedList });
    showToast(t("visualize.toast_confirmed"), "success");
    if (pipelineMode && onComplete) {
      onComplete();
    } else {
      navigate("/dashboard/report");
    }
  };

  const handleUpdateChartSettings = useCallback((chartId, newSettings) => {
    const current = fileSession.chartSettings?.[chartId] || {};
    updateFileSession({
      chartSettings: {
        ...(fileSession.chartSettings || {}),
        [chartId]: { ...current, ...newSettings }
      }
    });
  }, [fileSession.chartSettings, updateFileSession]);

  const handleResetChartSettings = useCallback((chartId) => {
    const next = { ...(fileSession.chartSettings || {}) };
    delete next[chartId];
    updateFileSession({ chartSettings: next });
  }, [fileSession.chartSettings, updateFileSession]);

  const handleConfirm = () => {
    if (selectedChartIds.size === 0) {
      setShowEmptyConfirmModal(true);
      return;
    }

    const allCharts = [...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other, ...customCharts];
    const confirmed = allCharts
      .filter(c => selectedChartIds.has(c.id))
      .map(c => {
        const s = fileSession.chartSettings?.[c.id] || {};
        const displayType = s.display_type || c.type;
        return {
          chart_id: c.id,
          user_title: c.user_title || c.title,
          auto_title: c.auto_title || c.title,
          type: c.type, // keep existing type field = base type, unchanged
          display_type: displayType,
          settings: s,
          column: c.col,
          ai_explanation: fileSession.chartExplanations?.[c.id]?.content || null,
        };
      });

    proceedToReport(confirmed);
  };

  const totalCharts = useMemo(() => {
    return (charts.distribution?.length || 0) + (charts.correlation?.length || 0) + (charts.time?.length || 0) + customCharts.length;
  }, [charts, customCharts]);

  const selectedCharts = useMemo(() => {
    const all = [
      ...(charts.distribution || []),
      ...(charts.correlation || []),
      ...(charts.time || []),
      ...customCharts
    ];
    return all.filter(c => selectedChartIds.has(c.id));
  }, [charts, customCharts, selectedChartIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F2] text-[#121A14] flex flex-col items-center justify-center py-20 px-6 font-sans">
        <div className="w-10 h-10 rounded-full border-3 border-[#1B4324] border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-lg font-bold mb-1">{t("visualize.loading_title")}</h2>
        <p className="text-[#626C65] text-xs text-center max-w-md">
          {t("visualize.loading_desc")}
        </p>
      </div>
    );
  }

  if (showDirectUpload && !directSummary) {
    return (
      <div className="min-h-screen bg-[#F3F4F2] flex flex-col pt-16 px-6 font-sans">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-xl font-bold text-[#121A14] mb-2">{t("visualize.direct_title")}</h2>
          <p className="text-xs text-[#626C65] mb-6">
            {t("visualize.direct_subtitle")}
          </p>

          <div
            id="upload-zone"
            className={`
              border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors bg-white
              ${isDragging
                ? "border-[#1B4324] bg-[#EAF2EB]"
                : "border-[#E5E5E3] hover:border-[#1B4324] hover:bg-white"
              }
              ${isDirectUploading ? "pointer-events-none opacity-60" : ""}
            `}
            onClick={() => !isDirectUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!isDirectUploading) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => handleDirectUpload(e.target.files?.[0])}
              id="file-input"
            />
            {isDirectUploading ? (
              <div>
                <div className="w-10 h-10 rounded-full border-3 border-[#1B4324] border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-[#121A14] font-medium text-base mb-1">{t("visualize.direct_analyzing")}</p>
                <p className="text-[#626C65] text-xs">{t("visualize.direct_analyzing_desc")}</p>
              </div>
            ) : (
              <div className="text-[#626C65] text-xs">
                <Upload size={40} strokeWidth={1.5} className="mx-auto mb-3 text-[#1B4324]" />
                <span className="block mb-1 text-[#121A14] font-semibold text-base">{t("visualize.direct_drag_drop")}</span>
                {t("visualize.direct_support_hint")}
              </div>
            )}
          </div>

          <div className="mt-6 bg-white border border-[#E5E5E3] rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs text-[#121A14] flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-[#1B4324]" />
              {t("visualize.direct_notes_title")}
            </h3>
            <ul className="text-xs text-[#626C65] space-y-2 list-disc pl-5">
              <li><strong className="text-[#121A14] font-medium">{t("visualize.direct_note1_title")}</strong> {t("visualize.direct_note1_desc")}</li>
              <li><strong className="text-[#121A14] font-medium">{t("visualize.direct_note2_title")}</strong> {t("visualize.direct_note2_desc")}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (showDirectUpload && directSummary) {
    return (
      <div className="min-h-screen bg-[#F3F4F2] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-[#E5E5E3]">
          <Check className="w-12 h-12 text-[#1B4324] mx-auto mb-4 bg-[#EAF2EB] rounded-full p-2.5" />
          <h2 className="text-lg font-bold mb-2 text-[#121A14]">{t("visualize.direct_done_title")}</h2>
          <p className="text-sm font-mono mb-4 text-[#121A14]">
            {t("visualize.direct_done_summary", { rows: directSummary.rows, cols: directSummary.cols, issues: directSummary.issuesFixed })}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => setShowDirectUpload(false)}
              className="bg-[#121A14] hover:bg-[#2A342D] text-white py-2.5 rounded-lg text-xs font-semibold w-full transition-colors"
            >
              {t("visualize.direct_btn_continue")}
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(pipelineMode ? "/dashboard/pipeline/profiler" : "/dashboard/profiler")}
                className="border border-[#E5E5E3] text-[#121A14] py-2 rounded-lg font-medium w-full hover:bg-[#F3F4F2] transition-colors text-xs"
              >
                {t("visualize.direct_btn_profiler")}
              </button>
              <button
                onClick={() => navigate(pipelineMode ? "/dashboard/pipeline/cleaner" : "/dashboard/cleaner")}
                className="border border-[#E5E5E3] text-[#121A14] py-2 rounded-lg font-medium w-full hover:bg-[#F3F4F2] transition-colors text-xs"
              >
                {t("visualize.direct_btn_cleaner")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeCharts = charts[activeTab] || [];

  return (
    <div className="min-h-full bg-[#F3F4F2] text-[#121A14] flex flex-col font-sans relative">
      {/* Main Content Area */}
      <div className="flex-1 pb-16">
        <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
          <PageHeader
            title={t("visualize.page_title")}
            subtitle={t("visualize.page_subtitle")}
            actions={
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-[#E5E5E3] text-[#2A342D] rounded-full shadow-sm">
                  {t("visualize.counter_selected", { selected: selectedChartIds.size, total: totalCharts })}
                </span>
                <PageHelpDocs pageId="visualize" />
                {!pipelineMode && !showDirectUpload && (
                  <>
                    <button
                      onClick={() => navigate("/dashboard/cleaner")}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <ArrowLeft className="w-4 h-4" /> {t("visualize.btn_back")}
                    </button>
                    <button
                      onClick={() => {
                        clearFileSession();
                        setShowDirectUpload(true);
                        setDirectSummary(null);
                      }}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <FolderUp className="w-4 h-4" /> {t("visualize.btn_upload_other")}
                    </button>
                  </>
                )}
              </div>
            }
          />

          {fileExpired && (
            <FileExpiredBanner
              fileName={fileSession.fileName}
              fileHash={fileSession.fileHash}
              onReuploaded={() => {
                setFileExpired(false);
                lastFetchedKeyRef.current = null;
              }}
            />
          )}

          {/* Capabilities Banner */}
          {fileSession.capabilities && (
            <div className="bg-white border border-[#E5E5E3] rounded-xl p-4 mb-6 shadow-sm">
              <h2 className="text-xs font-semibold mb-2.5 flex items-center justify-between text-[#121A14]">
                <span>{t("visualize.capability_title")}</span>
                {fileSession.warnings?.some(w => w.code === "LOW_ROW_COUNT") && (
                  <span className="text-[11px] font-normal text-[#956400] bg-[#FBF3DB] px-2 py-0.5 rounded border border-[#f0dda0] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 inline-block" /> {t("visualize.capability_low_rows")}
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <span className={`flex items-center gap-1.5 ${((fileSession.capabilities.histogram || fileSession.capabilities.bar_chart) && charts.distribution.length > 0) ? 'text-[#1B4324] font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {((fileSession.capabilities.histogram || fileSession.capabilities.bar_chart) && charts.distribution.length > 0) ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />} {t("visualize.cap_distribution")}
                </span>
                <span className={`flex items-center gap-1.5 ${(fileSession.capabilities.correlation && charts.correlation.length > 0) ? 'text-[#1B4324] font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {(fileSession.capabilities.correlation && charts.correlation.length > 0) ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />} {t("visualize.cap_correlation")}
                </span>
                <span className={`flex items-center gap-1.5 ${(fileSession.capabilities.line_chart && charts.time.length > 0) ? 'text-[#1B4324] font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {(fileSession.capabilities.line_chart && charts.time.length > 0) ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />} {t("visualize.cap_time")}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-[#E5E5E3] mb-6 pb-1 overflow-x-auto">
            {[
              { id: "distribution", label: t("visualize.tab_distribution", { count: charts.distribution.length }) },
              { id: "correlation", label: t("visualize.tab_correlation", { count: charts.correlation.length }) },
              { id: "time", label: t("visualize.tab_time", { count: charts.time.length }) },
            ].map(tab => {
              const isSupported = !fileSession.capabilities || (
                (tab.id === "distribution" && fileSession.capabilities.histogram) ||
                (tab.id === "correlation" && fileSession.capabilities.correlation) ||
                (tab.id === "time" && fileSession.capabilities.line_chart)
              );

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                      ? "border-[#1B4324] text-[#1B4324] font-semibold"
                      : "border-transparent text-[#626C65] hover:text-[#121A14]"
                    } ${!isSupported && activeTab !== tab.id ? 'opacity-50' : ''}`}
                >
                  {tab.label} {!isSupported && <AlertTriangle className="w-3 h-3 inline-block ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Chart Grid: 2 columns from lg (1024px), 1 column below; Heatmap spans full width */}
          {activeCharts.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#E5E5E3] rounded-xl">
              <p className="text-xs text-[#626C65]">{t("visualize.tab_empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeCharts.map(chart => {
                let isDisabled = false;
                let disableReason = "";

                if (fileSession.capabilities) {
                  if (chart.type === "histogram" && !fileSession.capabilities.histogram) {
                    isDisabled = true;
                    disableReason = t("visualize.locked_histogram");
                  } else if (chart.type === "heatmap" && !fileSession.capabilities.correlation) {
                    isDisabled = true;
                    disableReason = t("visualize.locked_heatmap");
                  } else if (chart.type === "line" && !fileSession.capabilities.line_chart) {
                    isDisabled = true;
                    disableReason = t("visualize.locked_line");
                  }
                }

                return (
                  <div key={chart.id} className={`relative group ${chart.type === 'heatmap' ? 'lg:col-span-2' : ''}`}>
                    <div className={`transition-all ${isDisabled ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                      <ChartCard
                        chart={chart}
                        isSelected={selectedChartIds.has(chart.id)}
                        toggleChart={toggleChart}
                        summary={fileSession.statisticalSummary}
                        onUpdate={handleUpdateChart}
                        onCellClick={chart.type === "heatmap" ? handleAnchorSelect : undefined}
                        anchorPair={chart.type === "heatmap" ? anchorPair : undefined}
                        sessionId={fileSession.sessionId}
                        fileHash={fileSession.fileHash}
                        onMaximize={handleMaximize}
                        isSuggested={suggestedChartIds.has(chart.id)}
                        settings={fileSession.chartSettings?.[chart.id] || EMPTY_SETTINGS}
                        onUpdateSettings={handleUpdateChartSettings}
                        onResetSettings={handleResetChartSettings}
                        aiUsage={aiUsage}
                        onUsageUpdated={setAiUsage}
                      />
                    </div>

                    {isDisabled && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-xl border border-[#E5E5E3] backdrop-blur-[1px]">
                        <div className="bg-white px-4 py-3 rounded-lg border border-[#E5E5E3] text-center max-w-[80%] shadow-md">
                          <Lock className="w-5 h-5 mx-auto mb-1.5 text-[#121A14]/70" />
                          <p className="text-xs font-semibold text-[#121A14] mb-0.5">{t("visualize.locked_title")}</p>
                          <p className="text-[11px] text-[#626C65]">{disableReason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Columns without a chart panel (end of Distribution tab) */}
          {activeTab === "distribution" && (
            <SkippedColumnsPanel
              skippedColumns={fileSession.statisticalSummary?.skipped_columns || []}
              pipelineMode={pipelineMode}
              navigate={navigate}
            />
          )}

          {/* Anchor Scatter Panel */}
          {activeTab === "correlation" && anchorPair && (
            <AnchorScatterPanel
              colA={anchorPair.colA}
              colB={anchorPair.colB}
              rValue={anchorPair.r}
              scatterData={scatterData}
              loading={scatterLoading}
              error={scatterError}
              onClear={handleAnchorClear}
              isSelected={selectedChartIds.has(`scatter_${anchorPair.colA}_${anchorPair.colB}`)}
              onToggle={() => {
                toggleChart(`scatter_${anchorPair.colA}_${anchorPair.colB}`, {
                  id: `scatter_${anchorPair.colA}_${anchorPair.colB}`,
                  type: "scatter",
                  colA: anchorPair.colA,
                  colB: anchorPair.colB,
                  title: `${anchorPair.colA} × ${anchorPair.colB}`,
                  data: scatterData,
                  r: anchorPair.r
                });
              }}
            />
          )}
        </div>
      </div>

      {/* Enlarged Chart Modal */}
      <EnlargedChartModal
        chart={enlargedChart}
        summary={fileSession.statisticalSummary}
        isSelected={enlargedChart ? selectedChartIds.has(enlargedChart.id) : false}
        toggleChart={toggleChart}
        onClose={handleCloseModal}
        sessionId={fileSession.sessionId}
        fileHash={fileSession.fileHash}
        anchorPair={anchorPair}
        onCellClick={handleAnchorSelect}
        settings={enlargedChart ? (fileSession.chartSettings?.[enlargedChart.id] || EMPTY_SETTINGS) : EMPTY_SETTINGS}
        onUpdateSettings={handleUpdateChartSettings}
        onResetSettings={handleResetChartSettings}
        aiUsage={aiUsage}
        onUsageUpdated={setAiUsage}
      />

      {/* Confirmation warning modal for 0 charts selected */}
      {showEmptyConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E5E3] p-6 max-w-md w-full shadow-xl">
            <div className="w-10 h-10 rounded-full bg-[#FBF3DB] text-[#956400] flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#121A14] mb-1.5">{t("visualize.empty_selection_warning_title")}</h3>
            <p className="text-xs text-[#626C65] leading-relaxed mb-6">
              {t("visualize.empty_selection_warning_desc")}
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setShowEmptyConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#E5E5E3] text-[#2A342D] hover:bg-[#F3F4F2] transition-colors"
              >
                {t("visualize.btn_stay_and_select")}
              </button>
              <button
                onClick={() => {
                  setShowEmptyConfirmModal(false);
                  proceedToReport([]);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#121A14] text-white hover:bg-[#2A342D] transition-colors"
              >
                {t("visualize.btn_proceed_empty")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-[#E5E5E3] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] mt-auto">
        {/* Expanded list of selected charts */}
        {selectionExpanded && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 border-b border-[#E5E5E3]">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-[#121A14]">{t("visualize.selected_panel_title")}</h3>
              <button
                onClick={() => setSelectionExpanded(false)}
                className="text-[#626C65] hover:text-[#121A14] p-1 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {selectedChartIds.size === 0 ? (
              <p className="text-xs text-[#626C65]/70 py-2">{t("visualize.selected_panel_empty")}</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                {selectedCharts.map(c => (
                  <div key={`sel_${c.id}`} className="bg-[#F3F4F2] border border-[#E5E5E3] rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-xs text-[#121A14]">
                    <span className="truncate max-w-[180px] font-medium">{c.user_title || c.title}</span>
                    <button onClick={() => toggleChart(c.id)} className="text-[#626C65] hover:text-[#9F2F2D] shrink-0 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom action bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectionExpanded(!selectionExpanded)}
              className="flex items-center gap-1.5 text-xs text-[#626C65] hover:text-[#121A14] transition-colors"
            >
              {selectionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              <span className="font-semibold text-[#1B4324]">{selectedChartIds.size}</span>
              <span>{t("visualize.sticky_selected_count", { count: selectedChartIds.size })}</span>
            </button>
            {suggestedChartIds.size > 0 && (
              <span className="hidden sm:inline-block text-[11px] text-[#626C65] bg-[#F3F4F2] px-2 py-0.5 rounded-full border border-[#E5E5E3]">
                {t("visualize.sticky_suggested_hint", { n: suggestedChartIds.size })}
              </span>
            )}
          </div>

          <button
            onClick={handleConfirm}
            className={`${BTN.primary} px-5 py-2 flex items-center gap-2 text-xs font-semibold`}
          >
            {t("visualize.btn_confirm_proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
