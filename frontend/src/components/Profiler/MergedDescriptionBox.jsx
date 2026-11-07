import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  HelpCircle,
  X,
  RefreshCw,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import { CARD, TEXT, BTN } from "../../constants/ui";
import { ConfidenceBadge } from "./Badges";
import { getDomainI18nKey } from "../../constants/dataTypes";
import { getCurrentLang, translateError } from "../../i18n";
import AIUsageBadge from "../AIUsageBadge";
import { useAIAction } from "../../hooks/useAIAction";
import { useToast } from "../../contexts/ToastContext";

function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

export default function MergedDescriptionBox({
  fileHash,
  description,
  setDescription,
  descriptionSource,
  setDescriptionSource,
  savedAt,
  isSaving,
  aiAnalyzed,
  analyzedDescription,
  aiLoading,
  semanticContext,
  handleAnalyzeAI,
  handleReanalyzeWithCorrection,
  contextPurpose,
  setContextPurpose,
  usage,
  setAiUsage,
  isFromCache,
  savedLang,
  onUpgradeClick,
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [showHelp, setShowHelp] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const helpRef = useRef(null);

  const aiAction = useAIAction({
    actionFn: async ({ signal, isReanalyze, replace }) => {
      if (isReanalyze) {
        return await handleReanalyzeWithCorrection(signal);
      } else {
        return await handleAnalyzeAI(replace !== false, signal);
      }
    },
    usage,
    onUsageUpdated: (newUsage) => {
      if (setAiUsage) setAiUsage(newUsage);
    },
    onUpgradeClick,
    getPreviousContent: () => description,
    onRestore: (prev) => {
      if (prev !== undefined && prev !== null) {
        setDescription(prev);
      }
    },
    onError: (err) => {
      const errCode = err?.response?.data?.detail?.code || err?.response?.data?.code;
      if (errCode === "ERR_AI_QUOTA_EXCEEDED" || err?.response?.status === 429 || err?.response?.status === 402) {
        if (onUpgradeClick) onUpgradeClick();
        showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
      } else {
        showToast(translateError(errCode), "error");
      }
    },
  });

  // Close help popover on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setShowHelp(false);
      }
    };
    if (showHelp) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHelp]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    if (descriptionSource === "ai_draft") {
      setDescriptionSource("ai_edited");
    } else if (!descriptionSource) {
      setDescriptionSource("user");
    }
  };

  const onAnalyzeClick = () => {
    // If text box already has content, confirm overwrite first
    if (description && description.trim().length > 0) {
      setShowOverwriteModal(true);
    } else {
      aiAction.execute({ isReanalyze: false, replace: true });
    }
  };

  const handleConfirmReplace = () => {
    setShowOverwriteModal(false);
    aiAction.execute({ isReanalyze: false, replace: true });
  };

  const handleConfirmKeepMine = () => {
    setShowOverwriteModal(false);
    aiAction.execute({ isReanalyze: false, replace: false });
  };

  const effectiveAnalyzed =
    analyzedDescription !== undefined && analyzedDescription !== null
      ? analyzedDescription
      : (aiAnalyzed ? description : null);

  const isDescriptionUnchanged = Boolean(
    aiAnalyzed &&
    effectiveAnalyzed !== null &&
    normalizeText(description) === normalizeText(effectiveAnalyzed)
  );

  const isReanalyzeDisabled = Boolean(
    isDescriptionUnchanged ||
    !description ||
    description.trim().length === 0 ||
    aiLoading ||
    aiAction.loading
  );

  const onReanalyzeClick = () => {
    if (isReanalyzeDisabled) return;
    aiAction.execute({ isReanalyze: true, replace: false });
  };

  const formatSavedTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date();
        d.setUTCHours(h, m, 0, 0);
        return new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(d);
      }
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(d);
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  const showCaution =
    descriptionSource === "ai_draft" || descriptionSource === "ai_edited";

  const isAnalyzed = Boolean(
    aiAnalyzed &&
    semanticContext?.domain &&
    semanticContext.domain !== "Chưa phân tích"
  );

  // ── 1. Compact mode before analysis ─────────────────────────────────
  if (!isExpanded && !isAnalyzed) {
    return (
      <div className={`${CARD} p-3 sm:p-4`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              id="dataset-description"
              type="text"
              value={description}
              onChange={handleTextChange}
              placeholder={t("profiler.description_placeholder")}
              className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-forest focus:border-forest outline-none bg-white text-ink shadow-2xs"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {aiAction.loading ? (
              aiAction.AIRunningBar
            ) : (
              <button
                type="button"
                id="profiler-ai-analyze-btn"
                onClick={onAnalyzeClick}
                className={`${BTN.primary} flex items-center gap-1.5 text-xs py-2 px-3 shadow-2xs`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("profiler.ai_analyze_compact", "Phân tích AI · 1 lượt")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="p-2 text-muted hover:text-ink hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              title={t("profiler.btn_expand", "Mở rộng")}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showOverwriteModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
              <h4 className="text-base font-bold text-ink mb-1.5">
                {t("profiler.overwrite_title")}
              </h4>
              <p className="text-xs text-muted leading-relaxed mb-5">
                {t("profiler.overwrite_desc")}
              </p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmKeepMine}
                  className={`${BTN.secondary} text-xs py-1.5 px-3`}
                >
                  {t("profiler.overwrite_keep")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReplace}
                  className={`${BTN.primary} text-xs py-1.5 px-3`}
                >
                  {t("profiler.overwrite_replace")}
                </button>
              </div>
            </div>
          </div>
        )}

        {aiAction.AIConfirmModal}
      </div>
    );
  }

  // ── 2. Compact mode after analysis ──────────────────────────────────
  if (!isExpanded && isAnalyzed) {
    const firstLineDesc = (description || "").split("\n")[0].trim();
    return (
      <div className={`${CARD} p-3 sm:p-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-forest text-xs sm:text-sm shrink-0">
              {t(getDomainI18nKey(semanticContext.domain), { defaultValue: semanticContext.domain })}
            </span>
            <ConfidenceBadge confidence={semanticContext.confidence} />
            {firstLineDesc && (
              <span className="text-muted truncate max-w-xs sm:max-w-md md:max-w-lg text-xs" title={description}>
                · {firstLineDesc}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {savedAt && (
              <span className="text-[11px] text-muted hidden md:flex items-center gap-1 select-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                {t("profiler.saved_status", { time: formatSavedTime(savedAt) })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="px-2.5 py-1 text-xs font-medium border border-border rounded-lg bg-neutral-50 hover:bg-neutral-100 text-ink transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>{t("profiler.btn_view_edit", "Xem/Sửa")}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted" />
            </button>
          </div>
        </div>

        {/* AI Disclaimer line */}
        <div className="text-[11px] text-muted italic mt-1.5 select-none">
          {t("profiler.ai_disclaimer", { defaultValue: "Kết quả do AI phân tích — chỉ mang tính tham khảo." })}
        </div>

        {/* Language mismatch warning banner */}
        {savedLang && savedLang !== getCurrentLang() && (
          <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs text-[#854D0E]">
            <div className="flex items-center gap-1.5 font-medium min-w-0">
              <Globe size={13} className="text-[#D97706] shrink-0" />
              <span className="truncate">
                {t("profiler.lang_mismatch_banner", {
                  savedLang: savedLang === "en" ? "English" : "Tiếng Việt",
                  defaultValue: `Phân tích AI đang lưu bằng ${savedLang === "en" ? "English" : "Tiếng Việt"}`
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleAnalyzeAI(true)}
              disabled={aiLoading}
              className="text-xs font-semibold text-forest hover:text-ink underline transition-colors cursor-pointer shrink-0"
            >
              {t("profiler.btn_reanalyze_current_lang", "Phân tích lại")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 3. Expanded mode ────────────────────────────────────────────────
  return (
    <div className={`${CARD} relative`}>
      {/* ── Top Header Row ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <label htmlFor="dataset-description" className={`${TEXT.sectionTitle} flex items-center gap-1.5`}>
            {t("profiler.description_label")}
          </label>

          {/* Help Popover Trigger */}
          <div className="relative" ref={helpRef}>
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              className="text-muted hover:text-ink p-1 rounded-md transition-colors"
              aria-label={t("profiler.help_title")}
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {showHelp && (
              <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white border border-border rounded-xl shadow-lg p-3.5 z-50 animate-in fade-in slide-in-from-top-1 text-xs text-ink/90">
                <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2 font-bold text-ink">
                  <span>{t("profiler.help_title")}</span>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="p-1 text-muted hover:text-ink rounded"
                    aria-label={t("common.close")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="leading-relaxed text-muted">{t("profiler.help_content")}</p>
              </div>
            )}
          </div>

          {/* Source badge */}
          {descriptionSource === "ai_draft" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {t("profiler.source_ai_draft")}
            </span>
          )}

          {descriptionSource === "ai_edited" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Check className="w-3 h-3 text-amber-600" />
              {t("profiler.source_ai_edited")}
            </span>
          )}
        </div>

        {/* Persistence Status & Usage Badge + Collapse Button */}
        <div className="flex items-center gap-2.5">
          {isSaving ? (
            <span className="text-[11px] text-muted flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {t("profiler.saving_status")}
            </span>
          ) : savedAt ? (
            <span className="text-[11px] text-muted flex items-center gap-1 select-none">
              <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
              {t("profiler.saved_status", { time: formatSavedTime(savedAt) })}
            </span>
          ) : null}

          <AIUsageBadge
            usage={usage}
            isFromCache={isFromCache}
            onUpgradeClick={onUpgradeClick}
          />

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="px-2 py-1 text-xs font-medium border border-border rounded-lg bg-neutral-50 hover:bg-neutral-100 text-ink transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            title={t("profiler.btn_collapse", "Thu gọn")}
          >
            <span>{t("profiler.btn_collapse", "Thu gọn")}</span>
            <ChevronUp className="w-3.5 h-3.5 text-muted" />
          </button>
        </div>
      </div>

      {/* ── Domain & Semantic result banner ───────── */}
      {semanticContext?.domain && (() => {
        const notAnalyzed = semanticContext.domain === "Chưa phân tích";
        return (
          <>
            <div className="mb-3.5 p-2.5 rounded-lg bg-sage/30 border border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted font-medium">{t("profiler.domain_label")}</span>
                <span className="font-semibold text-forest text-sm">
                  {notAnalyzed
                    ? t("profiler.domain_not_analyzed")
                    : t(getDomainI18nKey(semanticContext.domain), { defaultValue: semanticContext.domain })}
                </span>
                {!notAnalyzed && <ConfidenceBadge confidence={semanticContext.confidence} />}
              </div>
              <p className="text-muted text-[11px] italic max-w-md truncate">
                {notAnalyzed || !semanticContext.reasoning
                  ? t("profiler.ai_hint")
                  : semanticContext.reasoning}
              </p>
            </div>
            {!notAnalyzed && (
              <div className="text-[11px] text-muted italic -mt-2 mb-3.5 px-0.5 select-none">
                {t("profiler.ai_disclaimer", { defaultValue: "Kết quả do AI phân tích — chỉ mang tính tham khảo." })}
              </div>
            )}
          </>
        );
      })()}

      {/* Language mismatch warning banner */}
      {savedLang && savedLang !== getCurrentLang() && aiAnalyzed && (
        <div className="mb-3.5 px-3 py-2 rounded-lg bg-[#FEF6E6] border border-[#FDE68A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#854D0E]">
          <div className="flex items-center gap-1.5 font-medium">
            <Globe size={14} className="text-[#D97706] shrink-0" />
            <span>
              {t("profiler.lang_mismatch_banner", {
                savedLang: savedLang === "en" ? "English" : "Tiếng Việt",
                defaultValue: `Phân tích AI đang lưu bằng ${savedLang === "en" ? "English" : "Tiếng Việt"}, bạn có muốn phân tích lại theo ngôn ngữ hiện tại?`
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleAnalyzeAI(true)}
            disabled={aiLoading}
            className="text-xs font-semibold text-forest hover:text-ink underline transition-colors cursor-pointer disabled:opacity-50"
          >
            {t("profiler.btn_reanalyze_current_lang", "Phân tích lại theo ngôn ngữ này")}
          </button>
        </div>
      )}

      {/* ── Main Description Textarea ─────────────────────────── */}
      <textarea
        id="dataset-description"
        rows={3}
        value={description}
        onChange={handleTextChange}
        placeholder={t("profiler.description_placeholder")}
        className="w-full border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-forest focus:border-forest outline-none bg-white text-ink leading-relaxed transition-all"
      />

      {/* ── AI Caution Text (Only shown if source is ai_draft or ai_edited) */}
      {showCaution && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-border/60">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>{t("profiler.ai_caution")}</span>
        </div>
      )}

      {/* ── Actions Row ────────────────────────────────────────── */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        {aiAction.loading ? (
          aiAction.AIRunningBar
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="profiler-ai-analyze-btn"
              onClick={onAnalyzeClick}
              className={`${BTN.primary} flex items-center gap-1.5 text-xs py-2 px-3.5`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("profiler.ai_analyze_btn")}
            </button>

            {aiAnalyzed && (
              <button
                type="button"
                id="profiler-reanalyze-correction-btn"
                disabled={isReanalyzeDisabled}
                onClick={onReanalyzeClick}
                className={`${BTN.secondary} flex items-center gap-1.5 text-xs py-2 px-3 transition-colors ${
                  isReanalyzeDisabled
                    ? "opacity-50 bg-[#F9F9F8] text-[#87938B] border-[#E5E5E3] cursor-not-allowed hover:bg-[#F9F9F8] hover:text-[#87938B] hover:border-[#E5E5E3]"
                    : "hover:border-forest/50 hover:text-forest cursor-pointer"
                }`}
                title={
                  isDescriptionUnchanged
                    ? t("profiler.reanalyze_unchanged_hint")
                    : t("profiler.reanalyze_btn")
                }
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("profiler.reanalyze_btn")}
              </button>
            )}
          </div>
        )}

        {/* Purpose Radio Options (Preserved for report building) */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "Tìm xu hướng chung", key: "purpose_trends" },
            { value: "So sánh các nhóm", key: "purpose_compare" },
            { value: "Phát hiện vấn đề", key: "purpose_issues" },
            { value: "Báo cáo định kỳ", key: "purpose_report" },
          ].map(({ value: opt, key: optKey }) => (
            <label
              key={opt}
              className={`flex items-center gap-1.5 text-xs cursor-pointer border rounded-lg px-2.5 py-1.5 transition-colors select-none ${
                contextPurpose === opt
                  ? "bg-sage border-forest/40 text-forest font-semibold"
                  : "border-border text-muted hover:bg-sage/20 hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="purpose"
                value={opt}
                checked={contextPurpose === opt}
                onChange={() => setContextPurpose(opt)}
                className="hidden"
              />
              {t(`profiler.${optKey}`)}
            </label>
          ))}
        </div>
      </div>

      {/* ── Unchanged Description Hint for Reanalyze ────────────── */}
      {aiAnalyzed && isDescriptionUnchanged && !aiAction.loading && (
        <p className="mt-2 text-xs text-[#87938B] flex items-center gap-1.5 select-none">
          <AlertCircle className="w-3.5 h-3.5 text-[#87938B] shrink-0" />
          <span>{t("profiler.reanalyze_unchanged_hint")}</span>
        </p>
      )}

      {/* ── Overwrite Confirmation Modal ───────────────────────── */}
      {showOverwriteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl shadow-xl max-w-sm w-full p-5 animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-ink mb-1.5">
              {t("profiler.overwrite_title")}
            </h4>
            <p className="text-xs text-muted leading-relaxed mb-5">
              {t("profiler.overwrite_desc")}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleConfirmKeepMine}
                className={`${BTN.secondary} text-xs py-1.5 px-3`}
              >
                {t("profiler.overwrite_keep")}
              </button>
              <button
                type="button"
                onClick={handleConfirmReplace}
                className={`${BTN.primary} text-xs py-1.5 px-3`}
              >
                {t("profiler.overwrite_replace")}
              </button>
            </div>
          </div>
        </div>
      )}

      {aiAction.AIConfirmModal}
    </div>
  );
}
