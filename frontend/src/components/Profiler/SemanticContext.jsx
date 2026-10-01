import { Loader2, Sparkles } from "lucide-react";
import { CARD, TEXT, BTN } from "../../constants/ui";
import { ConfidenceBadge } from "./Badges";

export const SemanticContext = ({
  aiAnalyzed,
  aiLoading,
  result,
  handleRequestAI
}) => {
  return (
    <div className={CARD}>
      <div className="flex flex-col gap-3">
        <h2 className={TEXT.sectionTitle}>Ngữ cảnh của AI</h2>
        {!aiAnalyzed && (
          <button
            id="profiler-ai-btn"
            onClick={handleRequestAI}
            disabled={aiLoading}
            className={`${BTN.primary} flex items-center justify-center gap-2 text-sm w-full`}
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Explain by AI</>
            )}
          </button>
        )}
      </div>

      {aiAnalyzed ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2">
            <span className="font-serif text-lg text-ink font-medium leading-tight">
              {result.semantic_context.domain}
            </span>
            <ConfidenceBadge confidence={result.semantic_context.confidence} />
          </div>
          {result.semantic_context.reasoning && (
            <p className={`${TEXT.body} text-sm`}>
              {result.semantic_context.reasoning}
            </p>
          )}
        </div>
      ) : (
        <p className={`${TEXT.secondary} mt-4 text-xs`}>
          {aiLoading
            ? "Đang gọi Gemini AI để nhận diện..."
            : "Nhấn nút để AI nhận diện lĩnh vực dữ liệu."}
        </p>
      )}
    </div>
  );
};
