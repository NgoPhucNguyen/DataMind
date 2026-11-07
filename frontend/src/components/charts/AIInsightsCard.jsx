import React, { useState, useEffect } from "react";
import { Sparkles, Edit2, Save, X, RefreshCw, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../contexts/ToastContext";
import { useFileSession } from "../../contexts/FileSessionContext";
import { explainChart, saveExplanation } from "../../services/visualizeService";
import { translateError } from "../../i18n";
import { BTN, BADGE } from "../../constants/ui";
import { useAIAction } from "../../hooks/useAIAction";

/** Cap plotted data to this many points before sending to backend */
const MAX_PLOTTED_POINTS = 30;

function getPlottedData(chart) {
  if (!chart || !chart.data || !Array.isArray(chart.data)) return [];
  return chart.data.slice(0, MAX_PLOTTED_POINTS);
}

function getChartConfig(chart) {
  return {
    title: chart.user_title || chart.title || null,
    type: chart.type || null,
    aggregation: chart.aggregation || null,
    filters: chart.filters || null,
  };
}

export default function AIInsightsCard({ sessionId, fileHash, chart, autoInsights, anchorPair }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { fileSession, updateFileSession } = useFileSession();

  const chartId = chart.id;

  const [loading, setLoading] = useState(false);
  const [insightData, setInsightData] = useState(null); // { content, source, cached, from_cache, is_stale, usage }
  const [displayedCols, setDisplayedCols] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  const [lastError, setLastError] = useState(null);

  // On mount: restore saved explanation from fileSession (no API call)
  useEffect(() => {
    if (!chartId) return;
    const saved = fileSession.chartExplanations?.[chartId];
    if (saved) {
      setInsightData(saved);
      setEditContent(saved.content || "");
      setIsExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId]);

  const currentX =
    chart.type === "heatmap"
      ? anchorPair
        ? anchorPair.colA
        : chart.topCorr?.length > 0
        ? chart.topCorr[0].col_a
        : chart.col
      : chart.col;

  const currentY =
    chart.type === "heatmap"
      ? anchorPair
        ? anchorPair.colB
        : chart.topCorr?.length > 0
        ? chart.topCorr[0].col_b
        : null
      : null;

  const isMismatch =
    displayedCols &&
    (displayedCols.col_x !== currentX || displayedCols.col_y !== currentY);

  const isStale = insightData?.is_stale === true;

  // ── Quota remaining display ──────────────────────────────────────────────
  const usageRemaining = insightData?.usage?.remaining;
  const quotaLabel =
    usageRemaining !== undefined
      ? usageRemaining > 0
        ? t("usage.remaining", { n: usageRemaining })
        : t("errors.ERR_AI_QUOTA_EXCEEDED")
      : null;

  // ── Core explain action hook ─────────────────────────────────────────────
  const aiAction = useAIAction({
    actionFn: async ({ signal, isReanalyze }) => {
      setLastError(null);
      const res = await explainChart(
        {
          session_id: sessionId,
          chart_type: chart.type,
          col_x: currentX,
          col_y: currentY,
          tier: "tier1",
          is_reanalyze: Boolean(isReanalyze),
          chart_config: getChartConfig(chart),
          plotted_data: getPlottedData(chart),
        },
        { signal }
      );
      setInsightData(res);
      setDisplayedCols({ col_x: currentX, col_y: currentY });
      setEditContent(res.content);
      setIsExpanded(true);
      if (chartId) {
        updateFileSession({
          chartExplanations: {
            ...fileSession.chartExplanations,
            [chartId]: { content: res.content, source: res.source, lang: i18n.language },
          },
        });
      }
      return res;
    },
    usage: insightData?.usage,
    onUsageUpdated: (newUsage) => {
      setInsightData((prev) => (prev ? { ...prev, usage: newUsage } : prev));
    },
    onUpgradeClick: () => {
      showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
    },
    getPreviousContent: () => ({
      insightData,
      editContent,
      isExpanded,
    }),
    onRestore: (prev) => {
      if (prev) {
        setInsightData(prev.insightData);
        setEditContent(prev.editContent);
        setIsExpanded(prev.isExpanded);
      }
    },
    onError: (err) => {
      const errCode =
        err?.response?.data?.detail?.code ||
        err?.response?.data?.code;
      if (
        errCode === "ERR_AI_QUOTA_EXCEEDED" ||
        err?.response?.status === 429 ||
        err?.response?.status === 402
      ) {
        showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
      } else {
        const msg = translateError(errCode) || t("visualize.ai_error_generic");
        setLastError(msg);
        showToast(msg, "error");
      }
    },
  });

  const handleExplain = (isReanalyze = false) => {
    aiAction.execute({ isReanalyze });
  };

  // ── Save user edit ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editContent.trim()) {
      showToast(t("visualize.ai_edit_empty"), "warning");
      return;
    }
    setLoading(true);
    try {
      await saveExplanation({
        session_id: sessionId,
        chart_type: chart.type,
        col_x: currentX,
        col_y: currentY,
        tier: "tier1",
        content: editContent,
      });
      setInsightData((prev) => ({
        ...prev,
        content: editContent,
        source: "user",
        cached: true,
        is_stale: false, // user saved fresh, no longer stale
      }));
      setIsEditing(false);
      // Persist user edit to fileSession
      if (chartId) {
        updateFileSession({
          chartExplanations: {
            ...fileSession.chartExplanations,
            [chartId]: { content: editContent, source: "user", lang: i18n.language },
          },
        });
      }
      showToast(t("visualize.ai_save_success"), "success");
    } catch {
      showToast(t("visualize.ai_save_error"), "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Initial state (no result yet) ────────────────────────────────────────
  if (!insightData && !aiAction.loading && !lastError) {
    return (
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap justify-between items-center gap-2 min-w-0">
        <p className="text-sm text-muted shrink-0">{t("visualize.ai_prompt")}</p>
        <button
          id={`ai-explain-btn-${chart.id || chart.col}`}
          onClick={() => handleExplain(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF2EB] text-[#1B4324] hover:bg-[#dceddd] rounded text-sm font-medium transition-colors shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {t("visualize.ai_btn_explain")}
        </button>
        {aiAction.AIConfirmModal}
      </div>
    );
  }

  // ── Loading state (initial) ──────────────────────────────────────────────
  if (!insightData && aiAction.loading) {
    return (
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap justify-between items-center gap-2 min-w-0">
        <p className="text-sm text-muted shrink-0">{t("visualize.ai_prompt")}</p>
        {aiAction.AIRunningBar}
      </div>
    );
  }

  // ── Error state with retry ───────────────────────────────────────────────
  if (!insightData && !aiAction.loading && lastError) {
    return (
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap justify-between items-center gap-2 min-w-0">
        <p className="text-sm text-red-500 flex items-center gap-1 shrink min-w-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">{lastError}</span>
        </p>
        <button
          onClick={() => { setLastError(null); handleExplain(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF2EB] text-[#1B4324] hover:bg-[#dceddd] rounded text-sm font-medium transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("visualize.ai_btn_retry")}
        </button>
        {aiAction.AIConfirmModal}
      </div>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 pt-3 border-t border-border relative min-w-0">
      {aiAction.loading && (
        <div className="mb-3 p-2 bg-neutral-50 rounded-lg border border-border">
          {aiAction.AIRunningBar}
        </div>
      )}

      {/* Header row */}
      <div className="flex justify-between items-center mb-2 flex-wrap gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-ink flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-4 h-4 text-forest" />
            {t("visualize.ai_title")}
          </span>
          {insightData && (
            <span className={insightData.source === "user" ? BADGE.info : BADGE.neutral}>
              {insightData.source === "user"
                ? t("visualize.ai_badge_user")
                : t("visualize.ai_badge_ai")}
            </span>
          )}
          {insightData?.from_cache && (
            <span className="text-[10px] text-muted italic">
              {t("usage.from_cache")}
            </span>
          )}
          {quotaLabel && (
            <span className="text-[10px] text-muted shrink-0">{quotaLabel}</span>
          )}
        </div>

        {insightData && !isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleExplain(true)}
              disabled={aiAction.loading}
              className="p-1 text-muted hover:text-ink transition-colors disabled:opacity-40"
              title={t("visualize.ai_btn_reanalyze")}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiAction.loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted hover:text-ink underline underline-offset-2"
            >
              {isExpanded ? t("visualize.ai_collapse") : t("visualize.ai_expand")}
            </button>
            <button
              onClick={() => { setIsEditing(true); setIsExpanded(true); }}
              className="p-1 text-muted hover:text-ink transition-colors"
              title={t("visualize.ai_btn_edit")}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Stale banner */}
      {!loading && !aiAction.loading && isStale && !isEditing && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {t("visualize.ai_stale_notice")}
          </span>
          <button
            onClick={() => handleExplain(false)}
            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded text-xs font-medium transition-colors shrink-0"
          >
            {t("visualize.ai_btn_reexplain")}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-2 mt-3">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
        </div>
      )}

      {/* Column mismatch warning */}
      {!loading && !aiAction.loading && isMismatch && insightData && (
        <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800 flex flex-col gap-2">
          <div className="flex items-start gap-1.5">
            <span className="mt-0.5">⚠️</span>
            <span>
              {t("visualize.ai_mismatch_notice", {
                oldX: displayedCols.col_x,
                oldY: displayedCols.col_y || "N/A",
                newX: currentX,
                newY: currentY || "N/A",
              })}
            </span>
          </div>
          <button
            onClick={() => handleExplain(false)}
            className="self-start ml-5 px-3 py-1.5 bg-[#EAF2EB] text-[#1B4324] hover:bg-[#dceddd] rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" />
            {t("visualize.ai_btn_explain")}
          </button>
        </div>
      )}

      {/* Content area */}
      {!loading && isExpanded && insightData && (
        <div className="mt-3 bg-[#F9F9F8] rounded-md border border-border p-3 text-sm text-ink leading-relaxed min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-32 p-2 border border-border rounded outline-none focus:border-forest text-sm bg-white"
                placeholder={t("visualize.ai_edit_placeholder")}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className={`${BTN.secondary} px-3 py-1 text-xs`}
                >
                  <X className="w-3 h-3 inline-block mr-1" />
                  {t("visualize.ai_cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className={`${BTN.primary} px-3 py-1 text-xs`}
                >
                  {loading ? (
                    <RefreshCw className="w-3 h-3 animate-spin inline-block mr-1" />
                  ) : (
                    <Save className="w-3 h-3 inline-block mr-1" />
                  )}
                  {t("visualize.ai_save")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words">{insightData.content}</p>
              <p className="text-[10px] text-muted italic mt-3 pt-2 border-t border-border/50">
                ⚠️ {t("visualize.ai_disclaimer")}
              </p>
            </>
          )}
        </div>
      )}
      {aiAction.AIConfirmModal}
    </div>
  );
}
