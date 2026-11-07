import React, { useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Layers, Trash2 } from "lucide-react";

/**
 * Format-only checker: returns true if transition from oldVal to newVal
 * is purely format normalization (e.g., currency/comma removal or date format).
 */
function isFormatOnlyChange(oldVal, newVal) {
  if (oldVal === newVal) return true;
  if (oldVal === null || oldVal === undefined || newVal === null || newVal === undefined) return false;

  const oldStr = String(oldVal).trim();
  const newStr = String(newVal).trim();

  // Numeric currency / thousands formatting (e.g. "10,000,000 VND" -> 10000000)
  const cleanedOldNum = oldStr.replace(/[^0-9.-]/g, "");
  if (cleanedOldNum && !isNaN(Number(cleanedOldNum)) && Number(cleanedOldNum) === Number(newVal)) {
    return true;
  }

  // Date format normalization (e.g. "15/03/2023" -> "2023-03-15")
  const datePartsSlash = oldStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (datePartsSlash) {
    const [, d, m, y] = datePartsSlash;
    const isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (isoDate === newStr) return true;
  }

  return false;
}

export default function DiffTableBlock({ data }) {
  const [viewMode, setViewMode] = useState("after"); // 'after' | 'before' | 'side-by-side'

  if (!data || !Array.isArray(data.columns)) return null;

  const { columns = [], before = [], after = [], note = "" } = data;

  // Track removed rows by checking which rows in before don't exist in after (by id in col 0 if present, or length)
  const isRowRemoved = (beforeRow) => {
    if (!after || after.length === 0) return true;
    const id = beforeRow[0];
    return !after.some((r) => r[0] === id);
  };

  // Find corresponding before row for an after row
  const findBeforeRow = (afterRow) => {
    const id = afterRow[0];
    return before.find((r) => r[0] === id) || null;
  };

  return (
    <div className="my-5 border border-border rounded-xl bg-white shadow-xs overflow-hidden max-w-full">
      {/* Header bar with view toggles */}
      <div className="p-3 bg-sage/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-forest shrink-0" />
          <span className="text-xs font-bold text-ink uppercase tracking-wider">
            Bảng minh họa sai khác (Before / After Diff)
          </span>
        </div>

        {/* View mode toggle buttons */}
        <div className="inline-flex rounded-lg border border-border/80 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("after")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === "after" ? "bg-forest text-white shadow-2xs" : "text-muted hover:text-ink"
            }`}
          >
            Sau làm sạch (Kết quả)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("before")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === "before" ? "bg-forest text-white shadow-2xs" : "text-muted hover:text-ink"
            }`}
          >
            Trước làm sạch (Dữ liệu gốc)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors hidden md:inline-block ${
              viewMode === "side-by-side" ? "bg-forest text-white shadow-2xs" : "text-muted hover:text-ink"
            }`}
          >
            So sánh song song
          </button>
        </div>
      </div>

      {/* Main Table Views */}
      <div className="p-3">
        {/* VIEW 1: AFTER (Cleaned View with Highlighting) */}
        {viewMode === "after" && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead className="bg-[#FAF9F5] text-ink font-semibold border-b border-border">
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} className="py-2 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {after.map((row, rIdx) => {
                  const bRow = findBeforeRow(row);
                  return (
                    <tr key={rIdx} className="border-b border-border/40 hover:bg-sage/10 transition-colors">
                      {row.map((cell, cIdx) => {
                        const oldVal = bRow ? bRow[cIdx] : undefined;
                        const isChanged = bRow && oldVal !== cell && !isFormatOnlyChange(oldVal, cell);
                        const isFormatOnly = bRow && oldVal !== cell && isFormatOnlyChange(oldVal, cell);

                        const tooltipText = isChanged
                          ? `Giá trị cũ: "${oldVal === null ? "null (ô trống)" : oldVal}" → Mới: "${cell}"`
                          : isFormatOnly
                          ? `Đã chuẩn hóa định dạng (Giá trị gốc: "${oldVal}")`
                          : undefined;

                        return (
                          <td
                            key={cIdx}
                            title={tooltipText}
                            className={`py-2 px-3 text-xs ${
                              isChanged
                                ? "bg-[#EBF7EE] text-[#1E7E34] font-semibold border-l-2 border-[#28A745] cursor-help"
                                : "text-ink"
                            }`}
                          >
                            {cell === null ? (
                              <span className="italic text-muted/60">null</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: BEFORE (Original Data with Removed Rows Struck-through) */}
        {viewMode === "before" && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead className="bg-[#FAF9F5] text-ink font-semibold border-b border-border">
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} className="py-2 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {before.map((row, rIdx) => {
                  const removed = isRowRemoved(row);
                  return (
                    <tr
                      key={rIdx}
                      className={`border-b border-border/40 transition-colors ${
                        removed ? "bg-red-50/50 line-through text-red-700/70" : "hover:bg-sage/10 text-ink"
                      }`}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 text-xs">
                          {cell === null ? (
                            <span className="italic text-muted/60">null</span>
                          ) : (
                            String(cell)
                          )}
                          {cIdx === 0 && removed && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-red-100 text-red-800 border border-red-200 no-underline">
                              Đã xóa trùng
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 3: SIDE-BY-SIDE */}
        {viewMode === "side-by-side" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Before Column */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-[#FAF9F5] px-3 py-1.5 border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider flex items-center justify-between">
                <span>Dữ liệu gốc (Trước)</span>
                <span className="text-[10px] text-muted font-normal">{before.length} dòng</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse bg-white">
                  <thead>
                    <tr className="border-b border-border/60 bg-sage/20 text-muted">
                      {columns.map((c, i) => (
                        <th key={i} className="py-1.5 px-2.5 text-[10.5px] font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {before.map((row, rIdx) => {
                      const removed = isRowRemoved(row);
                      return (
                        <tr
                          key={rIdx}
                          className={`border-b border-border/30 ${
                            removed ? "bg-red-50/50 line-through text-red-600/70" : ""
                          }`}
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1.5 px-2.5 text-[11.5px]">
                              {cell === null ? <span className="italic text-muted/50">null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* After Column */}
            <div className="border border-emerald-200 rounded-lg overflow-hidden">
              <div className="bg-emerald-50/60 px-3 py-1.5 border-b border-emerald-200 text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                <span>Đã làm sạch (Sau)</span>
                <span className="text-[10px] text-emerald-800 font-normal">{after.length} dòng</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse bg-white">
                  <thead>
                    <tr className="border-b border-emerald-100 bg-emerald-50/30 text-emerald-900">
                      {columns.map((c, i) => (
                        <th key={i} className="py-1.5 px-2.5 text-[10.5px] font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {after.map((row, rIdx) => {
                      const bRow = findBeforeRow(row);
                      return (
                        <tr key={rIdx} className="border-b border-emerald-50">
                          {row.map((cell, cIdx) => {
                            const oldVal = bRow ? bRow[cIdx] : undefined;
                            const isChanged = bRow && oldVal !== cell && !isFormatOnlyChange(oldVal, cell);
                            return (
                              <td
                                key={cIdx}
                                className={`py-1.5 px-2.5 text-[11.5px] ${
                                  isChanged ? "bg-[#EBF7EE] text-[#1E7E34] font-semibold" : "text-ink"
                                }`}
                              >
                                {cell === null ? <span className="italic text-muted/50">null</span> : String(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Note / Explanation callout */}
        {note && (
          <div className="mt-3 p-2.5 bg-sage/20 border border-border/80 rounded-lg text-xs text-muted leading-relaxed flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span>{note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

