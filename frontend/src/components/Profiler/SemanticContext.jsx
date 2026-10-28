import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CARD, TEXT, BTN } from "../../constants/ui";
import { ConfidenceBadge } from "./Badges";

export const SemanticContext = ({
  aiAnalyzed,
  aiLoading,
  result,
  handleRequestAI
}) => {
  const { t } = useTranslation();

  const domain = result?.semantic_context?.domain === "Chưa phân tích"
    ? t("profiler.domain_not_analyzed")
    : result?.semantic_context?.domain;

  const reasoning = result?.semantic_context?.domain === "Chưa phân tích" && !result?.semantic_context?.reasoning
    ? t("profiler.domain_not_analyzed_reasoning")
    : result?.semantic_context?.reasoning;

  return (
    <div className={CARD}>
      <div className="flex flex-col gap-3">
        <h2 className={TEXT.sectionTitle}>{t("profiler.semantic_title")}</h2>
        {!aiAnalyzed && (
          <button
            id="profiler-ai-btn"
            onClick={handleRequestAI}
            disabled={aiLoading}
            className={`${BTN.primary} flex items-center justify-center gap-2 text-sm w-full`}
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("profiler.semantic_analyzing")}</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {t("profiler.semantic_explain_ai")}</>
            )}
          </button>
        )}
      </div>

      {aiAnalyzed ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2">
            <span className="font-serif text-lg text-ink font-medium leading-tight">
              {domain}
            </span>
            <ConfidenceBadge confidence={result.semantic_context.confidence} />
          </div>
          {reasoning && (
            <p className={`${TEXT.body} text-sm`}>
              {reasoning}
            </p>
          )}
        </div>
      ) : (
        <p className={`${TEXT.secondary} mt-4 text-xs`}>
          {aiLoading
            ? t("profiler.semantic_hint_analyzing")
            : t("profiler.semantic_hint_idle")}
        </p>
      )}
    </div>
  );
};

