import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, Download, ChevronDown, ChevronUp } from "lucide-react";
import { CARD, TEXT, BTN } from "../../constants/ui";
import { TypeBadge } from "./Badges";
import { ExpandableText } from "./ExpandableText";

const COLUMN_TYPES = ["numeric", "datetime", "categorical", "multiple_choice", "text"];

const TYPE_LABELS = {
  numeric: "Numeric",
  datetime: "Datetime",
  categorical: "Categorical",
  multiple_choice: "Multi-choice",
  text: "Text",
};

const CHART_LABELS = {
  bar: "Bar",
  pie: "Pie",
  line: "Line",
  histogram: "Histogram",
};

const DEFAULT_VISIBLE = 10;

export const ColumnTable = ({
  result,
  overrides,
  getEffectiveType,
  handleOverride
}) => {
  const [showAll, setShowAll] = useState(false);

  if (!result) return null;

  const cols = result.columns;
  const visible = showAll ? cols : cols.slice(0, DEFAULT_VISIBLE);
  const hasMore = cols.length > DEFAULT_VISIBLE;

  return (
    <div className={CARD}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className={TEXT.sectionTitle}>Column Structure &amp; Data Issues</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            Showing <strong className="text-ink">{visible.length}</strong> of{" "}
            <strong className="text-ink">{cols.length}</strong> columns
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
            <Download size={13} /> Download Report
          </button>
        </div>
      </div>

      {/* Table — horizontal scroll on mobile */}
      <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#F9F9F8] border-b border-border text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Column Name</th>
                <th className="text-left px-3 py-2 font-medium">Detected Type</th>
                <th
                  className="text-left px-3 py-2 font-medium"
                  title="Auto-detected types may be wrong — override here."
                >
                  Override Type
                </th>
                <th className="text-right px-3 py-2 font-medium">Unique</th>
                <th className="text-right px-3 py-2 font-medium">Null%</th>
                <th className="text-left px-3 py-2 font-medium">Chart Hints</th>
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
                            title="Missing >60% of data"
                          />
                        )}
                        {col.unique_count === 1 && (
                          <AlertCircle
                            className="w-3 h-3 text-amber-500 cursor-help shrink-0"
                            title="Only 1 unique value"
                          />
                        )}
                        {col.low_confidence &&
                          !col.disguised_numeric?.is_disguised && (
                            <AlertCircle
                              className="w-3 h-3 text-orange-500 cursor-help shrink-0"
                              title="Low detection confidence"
                            />
                          )}
                        {col.disguised_numeric?.is_disguised && (
                          <span
                            title="Column contains numeric values stored as text. Use Override Type to convert."
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700 cursor-help whitespace-nowrap border border-amber-200"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
                            Likely numeric
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
                          <span>{col.unnamed_warning}</span>
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
                        {COLUMN_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      {isOverridden && (
                        <button
                          onClick={() =>
                            handleOverride(col.name, col.detected_type)
                          }
                          className="ml-1.5 text-[10px] text-muted hover:text-ink underline"
                          title="Reset to original detected type"
                        >
                          Reset
                        </button>
                      )}
                    </td>

                    {/* Unique count */}
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                      {col.unique_count.toLocaleString()}
                    </td>

                    {/* Null % */}
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                      {col.null_pct > 0 ? (
                        <span
                          className={
                            col.null_pct > 30 ? "text-[#9F2F2D] font-medium" : ""
                          }
                        >
                          {col.null_pct}%
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
                                {CHART_LABELS[chart] || chart}
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
              <ChevronUp className="w-3.5 h-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Show all {cols.length} columns
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <p className="mt-2 text-[10px] text-muted">
        * Type overrides only affect the UI (local state). File hash:{" "}
        <code className="font-mono bg-[#F9F9F8] px-1 rounded">
          {result.file_hash.slice(0, 8)}...
        </code>
      </p>
    </div>
  );
};

