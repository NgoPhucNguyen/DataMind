import { useState, useEffect } from "react";
import { Clock, Zap, RotateCw, RotateCcw, AlertTriangle } from "lucide-react";
import { BTN } from "../../constants/ui";

const SESSION_TTL_MS = 3600 * 1000; // 1 hour in ms

function useCountdown(uploadedAt) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!uploadedAt) return SESSION_TTL_MS / 1000;
    const elapsed = Date.now() - uploadedAt;
    return Math.max(0, Math.floor((SESSION_TTL_MS - elapsed) / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const ref = uploadedAt || Date.now();
      const elapsed = Date.now() - ref;
      setSecondsLeft(Math.max(0, Math.floor((SESSION_TTL_MS - elapsed) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [uploadedAt]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const isUrgent = secondsLeft > 0 && secondsLeft < 300; // red when < 5 min

  return { secondsLeft, formatted, isUrgent };
}

export const ResultsSummary = ({
  result,
  aiAnalyzed,
  lastFile,
  handleFile,
  handleReset,
  uploadedAt,
}) => {
  if (!result) return null;

  const { formatted, isUrgent } = useCountdown(uploadedAt);
  const problemCols = result.columns.filter(
    (c) => c.null_pct > 60 || c.unique_count === 1 || c.low_confidence
  ).length;

  return (
    <>
      {/* Expiration Banner with live countdown */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border transition-colors ${
          isUrgent
            ? "bg-[#FDEBEC] border-[#f5c6cb] text-[#9F2F2D]"
            : "bg-[#F9F9F8] border-border text-muted"
        }`}
      >
        {isUrgent ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : (
          <Clock className="w-4 h-4 shrink-0" />
        )}
        <p className="flex-1 text-xs sm:text-sm">
          File{" "}
          <strong className={isUrgent ? "text-[#9F2F2D]" : "text-ink"}>
            {result.filename}
          </strong>{" "}
          is temporarily stored on server.{" "}
          {isUrgent ? (
            <span className="font-semibold">
              Auto-delete in{" "}
              <span className="font-mono">{formatted}</span> — save your work!
            </span>
          ) : (
            <>
              Auto-deletes in{" "}
              <span className="font-mono font-medium">{formatted}</span> for
              security.
            </>
          )}
        </p>
      </div>

      {/* Summary + Actions bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm bg-[#F9F9F8] border border-border px-4 py-2.5 rounded-lg">
        {/* Dataset stats */}
        <span className="font-medium text-ink text-xs sm:text-sm">
          {result.total_columns} columns &middot; {problemCols} issue
          {problemCols !== 1 ? "s" : ""} &middot;{" "}
          {result.total_rows.toLocaleString()} rows
          {aiAnalyzed
            ? ` · Domain: ${result.semantic_context.domain} (${Math.round(
                result.semantic_context.confidence * 100
              )}%)`
            : ""}
        </span>

        {/* Cache badge + re-analyze (only when result came from cache) */}
        {result.cached && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-full border border-[#EAF2EB] bg-sage text-forest text-[10px] font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> Cached
            </span>
            <button
              onClick={() => handleFile(lastFile, true)}
              disabled={!lastFile}
              className="flex items-center gap-1 text-[10px] font-medium text-forest hover:text-ink underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Re-run analysis and refresh cached data"
            >
              <RotateCw className="w-3 h-3" /> Re-analyze
            </button>
          </div>
        )}

        {/* Upload new file — pushed to far right */}
        <button
          id="profiler-reanalyze-btn"
          onClick={handleReset}
          className={`${BTN.secondary} ml-auto flex items-center gap-1.5 text-xs shrink-0`}
        >
          <RotateCcw size={14} /> Upload New File
        </button>
      </div>
    </>
  );
};
