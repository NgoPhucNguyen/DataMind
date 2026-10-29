import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/axiosClient";
import {
  Check, X, AlertTriangle, ArrowLeft, ArrowRight, Lock, FolderUp, Upload,
  Info, Edit2, ChevronUp, ChevronDown, Lightbulb, Maximize2, FilePlus2, FileCheck2
} from "lucide-react";
import {
  DistributionChart, CategoricalChart, TrendChart,
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import PageHelpDocs from "../components/PageHelpDocs";
import AnchorScatterPanel from "../components/charts/AnchorScatterPanel";
import AIInsightsCard from "../components/charts/AIInsightsCard";
import { getUser } from "../services/authService";
import { profileFile } from "../services/profilerService";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import PageHeader from "../components/PageHeader";
import { BTN } from "../constants/ui";

const CURRENT_SUMMARY_VERSION = 2;
const ENABLE_CHART_EDIT = false; // bật lại khi xử lý xong cache-invalidation cho edit chart

export function formatInsight(insight, t) {
  if (!insight) return "";
  if (insight.text) return insight.text;
  const { key, params = {} } = insight;
  if (!key) return "";
  return t(`visualize.insight.${key}`, params);
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

const ChartCard = ({
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
  isSuggested
}) => {
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [localTitle, setLocalTitle] = useState(chart.user_title || chart.title);

  const stats = summary?.columns?.[chart.col];
  const insights = stats?.auto_insights || [];
  const subtitle = getSubtitle(chart, stats, summary, t);
  const displayTitle = chart.user_title || chart.title;
  const isLongTitle = (displayTitle || "").length > 40;

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onUpdate(chart.id, { user_title: localTitle });
  };

  const barHeight = Math.min(380, Math.max(220, (chart.data?.length || 5) * 28 + 40));

  return (
    <div className={`bg-white rounded-xl border transition-all flex flex-col justify-between p-5 ${isSelected ? "border-[#1B4324] ring-1 ring-[#1B4324]/20 shadow-sm" : "border-[#E5E5E3] hover:border-[#1B4324]/40"
      }`}>
      <div>
        {/* Header: Title + Subtitle + Toolbar */}
        <div className="flex items-start justify-between gap-3 mb-3">
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
                <h3 className={`text-sm font-semibold text-[#121A14] leading-snug break-words ${isTitleExpanded ? "" : "line-clamp-2"
                  }`}>
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

          {/* Top-Right Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isSuggested && (
              <span className="text-[10px] font-semibold bg-[#EAF2EB] text-[#1B4324] px-2 py-0.5 rounded-full border border-[#c8e0cb]/50">
                {t("visualize.badge_suggested")}
              </span>
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

        {/* Chart Canvas */}
        <div
          className={chart.type === "heatmap" ? "h-[500px] lg:h-[65vh] flex flex-col w-full my-2" : "w-full my-2"}
          style={chart.type === "bar" ? { height: `${barHeight}px` } : (chart.type !== "heatmap" ? { height: "260px" } : undefined)}
        >
          {chart.type === "histogram" && <DistributionChart data={chart.data} color={chart.color} />}
          {chart.type === "bar" && <CategoricalChart data={chart.data} color={chart.color} />}
          {chart.type === "line" && <TrendChart data={chart.data} color={chart.color} />}
          {chart.type === "heatmap" && <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} onCellClick={onCellClick} anchorPair={anchorPair} />}
          {chart.type === "pie" && <PieChartComponent data={chart.data} color={chart.color} />}
          {chart.type === "box" && <BoxPlotChart stats={stats} color={chart.color} />}
        </div>

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
              {insights.slice(0, 2).map((ins, idx) => (
                <li key={idx} className="text-xs text-[#2A342D] leading-snug line-clamp-2">
                  • {formatInsight(ins, t)}
                </li>
              ))}
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
        />
      </div>

      {/* Footer Button: Toggle Add to Report */}
      <div className="mt-4 pt-3 border-t border-[#E5E5E3]">
        {isSelected ? (
          <button
            onClick={() => toggleChart(chart.id)}
            className="w-full py-2 px-3 bg-[#EAF2EB] border border-[#1B4324]/30 text-[#1B4324] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors hover:bg-[#dbece0]"
          >
            <FileCheck2 className="w-4 h-4 text-[#1B4324]" /> {t("visualize.btn_added_to_report")}
          </button>
        ) : (
          <button
            onClick={() => toggleChart(chart.id)}
            className="w-full py-2 px-3 border border-[#E5E5E3] hover:border-[#1B4324] hover:bg-[#F3F4F2] text-[#2A342D] text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <FilePlus2 className="w-4 h-4 text-[#626C65]" /> {t("visualize.btn_add_to_report")}
          </button>
        )}
      </div>
    </div>
  );
};

const EnlargedChartModal = ({
  chart,
  summary,
  isSelected,
  toggleChart,
  onClose,
  sessionId,
  fileHash,
  anchorPair,
  onCellClick
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!chart) return null;
  const stats = summary?.columns?.[chart.col];
  const insights = stats?.auto_insights || [];
  const subtitle = getSubtitle(chart, stats, summary, t);

  // Use all_values for modal if available (cap 200)
  const modalData = (chart.type === "bar" && stats?.all_values && stats.all_values.length > 0)
    ? stats.all_values
    : chart.data;

  const barHeight = Math.min(600, Math.max(300, (modalData?.length || 5) * 26 + 40));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#E5E5E3] w-full max-w-5xl h-full sm:h-[88vh] max-h-[920px] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E3] flex items-center justify-between bg-white shrink-0">
          <div className="pr-4">
            <h2 className="text-base sm:lg font-bold text-[#121A14]">{chart.user_title || chart.title}</h2>
            <p className="text-xs text-[#626C65] mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#626C65] hover:text-[#121A14] hover:bg-[#F3F4F2] transition-colors"
            title={t("visualize.modal_close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className={chart.type === "heatmap" ? "h-[500px]" : "w-full"}>
            {chart.type === "histogram" && (
              <div className="h-[360px]">
                <DistributionChart data={modalData} color={chart.color} />
              </div>
            )}
            {chart.type === "bar" && (
              <div style={{ height: `${barHeight}px` }}>
                <CategoricalChart data={modalData} color={chart.color} />
              </div>
            )}
            {chart.type === "line" && (
              <div className="h-[360px]">
                <TrendChart data={modalData} color={chart.color} />
              </div>
            )}
            {chart.type === "heatmap" && (
              <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} onCellClick={onCellClick} anchorPair={anchorPair} />
            )}
            {chart.type === "pie" && (
              <div className="h-[360px]">
                <PieChartComponent data={modalData} color={chart.color} />
              </div>
            )}
            {chart.type === "box" && (
              <div className="h-[360px]">
                <BoxPlotChart stats={stats} color={chart.color} />
              </div>
            )}
          </div>

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
                {insights.map((ins, idx) => (
                  <li key={idx} className="text-xs text-[#2A342D]">
                    • {formatInsight(ins, t)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AIInsightsCard
            sessionId={sessionId}
            fileHash={fileHash}
            chart={chart}
            autoInsights={insights}
            anchorPair={anchorPair}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E5E5E3] bg-[#FBFBFA] flex items-center justify-between shrink-0">
          <button
            onClick={() => toggleChart(chart.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${isSelected
                ? "bg-[#EAF2EB] border border-[#1B4324]/30 text-[#1B4324] hover:bg-[#dbece0]"
                : "border border-[#E5E5E3] bg-white hover:border-[#1B4324] text-[#2A342D]"
              }`}
          >
            {isSelected ? (
              <><FileCheck2 className="w-4 h-4 text-[#1B4324]" /> {t("visualize.btn_added_to_report")}</>
            ) : (
              <><FilePlus2 className="w-4 h-4 text-[#626C65]" /> {t("visualize.btn_add_to_report")}</>
            )}
          </button>
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
    if (info.skip_chart || info.missing_pct >= 60) return;

    if (info.dtype === "numeric" && info.distribution_bins) {
      charts.distribution.push({
        id: `dist_${colName}`,
        type: "histogram",
        col: colName,
        title: colName,
        data: info.distribution_bins,
        score: (1 - info.missing_pct / 100) + (info.std / (Math.abs(info.mean) || 1) * 0.5)
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
  const fileInputRef = useRef(null);

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

    // 1. At least one per non-empty category
    if (generated.distribution?.length > 0) {
      const bestDist = generated.distribution.find(c => {
        const ins = summary?.columns?.[c.col]?.auto_insights;
        return ins && ins.length > 0;
      }) || generated.distribution[0];
      if (bestDist) selected.add(bestDist.id);
    }

    if (generated.correlation?.length > 0 && generated.correlation[0]) {
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
      const ins = summary?.columns?.[c.col]?.auto_insights;
      if (ins && ins.length > 0) {
        selected.add(c.id);
      }
    }

    // 3. Fallback to fill up to at least 3
    for (const c of all) {
      if (selected.size >= 3) break;
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
          showToast(err.response?.data?.detail || t("visualize.toast_load_error"), "error");
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

  const handleAnchorSelect = async (colA, colB, r) => {
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
  };

  const handleAnchorClear = () => {
    if (abortRef.current) abortRef.current.abort();
    setAnchorPair(null);
    setScatterData(null);
    setScatterError(null);
  };

  const handleUpdateChart = (id, newConfig) => {
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
  };

  const proceedToReport = (confirmedList) => {
    updateFileSession({ confirmedCharts: confirmedList });
    showToast(t("visualize.toast_confirmed"), "success");
    if (pipelineMode && onComplete) {
      onComplete();
    } else {
      navigate("/dashboard/report");
    }
  };

  const handleConfirm = () => {
    if (selectedChartIds.size === 0) {
      setShowEmptyConfirmModal(true);
      return;
    }

    const allCharts = [...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other, ...customCharts];
    const confirmed = allCharts
      .filter(c => selectedChartIds.has(c.id))
      .map(c => ({
        chart_id: c.id,
        user_title: c.user_title || c.title,
        auto_title: c.auto_title || c.title,
        type: c.type,
        column: c.col
      }));

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
                        onMaximize={setEnlargedChart}
                        isSuggested={suggestedChartIds.has(chart.id)}
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
        onClose={() => setEnlargedChart(null)}
        sessionId={fileSession.sessionId}
        fileHash={fileSession.fileHash}
        anchorPair={anchorPair}
        onCellClick={handleAnchorSelect}
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
            {t("visualize.btn_confirm_proceed")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
