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
} from "lucide-react";
import { CARD, TEXT, BTN, BADGE } from "../../constants/ui";
import { ConfidenceBadge } from "./Badges";
import AIUsageBadge from "../AIUsageBadge";

export default function MergedDescriptionBox({
  fileHash,
  description,
  setDescription,
  descriptionSource,
  setDescriptionSource,
  savedAt,
  isSaving,
  aiAnalyzed,
  aiLoading,
  semanticContext,
  handleAnalyzeAI,
  handleReanalyzeWithCorrection,
  contextPurpose,
  setContextPurpose,
  usage,
  isFromCache,
  onUpgradeClick,
}) {
  const { t, i18n } = useTranslation();
  const [showHelp, setShowHelp] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const helpRef = useRef(null);

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
    // If text box already has content, confirm overwrite
    if (description && description.trim().length > 0) {
      setShowOverwriteModal(true);
    } else {
      handleAnalyzeAI(true); // replace
    }
  };

  const handleConfirmReplace = () => {
    setShowOverwriteModal(false);
    handleAnalyzeAI(true);
  };

  const handleConfirmKeepMine = () => {
    setShowOverwriteModal(false);
    handleAnalyzeAI(false);
  };

  const formatSavedTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      // If timeStr is already a HH:mm string from backend (e.g. UTC "11:42")
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
      // If it's an ISO timestamp or date
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

        {/* Persistence Status & Usage Badge */}
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
        </div>
      </div>

      {/* ── Domain & Semantic result banner if analyzed ───────── */}
      {semanticContext?.domain && semanticContext.domain !== "Chưa phân tích" && (
        <div className="mb-3.5 p-2.5 rounded-lg bg-sage/30 border border-border/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted font-medium">{t("profiler.domain_label")}</span>
            <span className="font-semibold text-forest text-sm">{semanticContext.domain}</span>
            <ConfidenceBadge confidence={semanticContext.confidence} />
          </div>
          {semanticContext.reasoning && (
            <p className="text-muted text-[11px] italic max-w-md truncate">
              {semanticContext.reasoning}
            </p>
          )}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="profiler-ai-analyze-btn"
            onClick={onAnalyzeClick}
            disabled={aiLoading}
            className={`${BTN.primary} flex items-center gap-1.5 text-xs py-2 px-3.5`}
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {t("profiler.ai_analyzing")}
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {t("profiler.ai_analyze_btn")}
              </>
            )}
          </button>

          {aiAnalyzed && description && description.trim().length > 0 && (
            <button
              type="button"
              id="profiler-reanalyze-correction-btn"
              onClick={handleReanalyzeWithCorrection}
              disabled={aiLoading}
              className={`${BTN.secondary} flex items-center gap-1.5 text-xs py-2 px-3 hover:border-forest/50 hover:text-forest transition-colors`}
              title={t("profiler.reanalyze_btn")}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
              {t("profiler.reanalyze_btn")}
            </button>
          )}
        </div>

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
    </div>
  );
}
