/**
 * Cleaner.jsx — Module 2: Data Cleaner
 *
 * Pipeline flow:
 *   detecting → choosing_mode → cleaning → reviewing_diff → confirmed
 *
 * Nhận dữ liệu từ Profiler qua React Router state:
 *   { file_hash, filename, profileData, overrides }
 *
 * V1: Auto Clean + Manual Edit (Guided Fix đánh dấu Coming Soon)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useFileSession } from "../contexts/FileSessionContext";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import { profileFile, getSessionStatus } from "../services/profilerService";
import FileExpiredBanner from "../components/FileExpiredBanner";
import { useToast } from "../contexts/ToastContext";
import { translateError, getCurrentLang } from "../i18n";
import { ArrowRight, ArrowLeft, Info, CheckCircle, AlertTriangle, Upload, RefreshCw, Eye, MousePointerClick, ShieldCheck, Save, Clock, FolderUp, Download, Lock, Zap, PenTool, Compass, Wand2, ChevronLeft, ChevronRight, Check, HelpCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageHelpDocs from "../components/PageHelpDocs";
import ManualCleanWorkspace from "../components/cleaner/ManualCleanWorkspace";
import { TEXT, PAGE, BTN, CARD, BADGE } from "../constants/ui";
import { getColumnWidth, getOrderedErrorCells, getNextError, getPrevError, scrollToCell } from "../components/cleaner/tableUtils";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STEPS = ["detecting", "choosing_mode", "cleaning", "reviewing_diff", "confirmed"];

function IssueCountBadge({ count, label, color }) {
  if (count === 0) return null;
  const colors = {
    red: BADGE.error,
    yellow: BADGE.warning,
    orange: BADGE.warning,
    blue: BADGE.info,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 ${colors[color]}`}>
      <span className="font-semibold">{count}</span> {label}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] text-muted uppercase tracking-[0.15em] font-medium mb-3">
      {children}
    </p>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`${CARD} ${className}`}>
      {children}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IssuesSummary({ issues, previewRows = [], onJumpToCol }) {
  const { t } = useTranslation();
  const missingCount = issues.missing_values?.length ?? 0;
  const wrongTypeCount = issues.wrong_types?.length ?? 0;
  const encodingCount = issues.encoding_errors?.length ?? 0;
  const dupCount = issues.duplicates?.duplicate_count ?? 0;
  const semanticCount = issues.semantic_errors?.length ?? 0;

  const structuralCount = missingCount + wrongTypeCount + encodingCount + (dupCount > 0 ? 1 : 0);

  // Group issues by column name:
  // map: colName -> { missing: n, wrongType: n, encoding: n, semantic: n }
  const colIssuesMap = useMemo(() => {
    const map = new Map();
    const getOrInit = (c) => {
      if (!map.has(c)) map.set(c, { missing: 0, wrongType: 0, encoding: 0, semantic: 0 });
      return map.get(c);
    };

    (issues.missing_values || []).forEach(item => {
      const entry = getOrInit(item.column);
      entry.missing += item.null_count;
    });
    (issues.wrong_types || []).forEach(item => {
      const entry = getOrInit(item.column);
      entry.wrongType += 1;
    });
    (issues.encoding_errors || []).forEach(item => {
      const entry = getOrInit(item.column);
      entry.encoding += item.bad_char_count;
    });
    (issues.semantic_errors || []).forEach(item => {
      const entry = getOrInit(item.column);
      entry.semantic += item.violation_count;
    });

    return map;
  }, [issues]);

  // Count how many error cells in this preview data per column
  const previewErrorCountPerCol = useMemo(() => {
    const map = new Map();
    const validRowIds = new Set(previewRows.map(r => r.original_index).filter(id => id !== undefined));
    (issues.error_cells || []).forEach(e => {
      if (validRowIds.has(e.row_id)) {
        map.set(e.column, (map.get(e.column) || 0) + 1);
      }
    });
    return map;
  }, [issues.error_cells, previewRows]);

  if (!issues.has_issues) {
    return (
      <div className="bg-sage/30 border border-[#c8e0cb] rounded-lg p-3 text-sm text-forest flex items-center gap-2">
        <CheckCircle className="w-5 h-5 shrink-0" />
        {t("cleaner.data_clean_desc")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-[#FBF3DB] border border-[#f0dda0] rounded-lg p-3 text-sm text-[#956400] flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>
          <Trans
            i18nKey="cleaner.issues_detected"
            values={{ structuralCount }}
            components={{ 1: <strong /> }}
          />
          {semanticCount > 0 ? (
            <Trans
              i18nKey="cleaner.semantic_issues_detected"
              values={{ semanticCount }}
              components={{ 1: <strong /> }}
            />
          ) : ""}
          {t("cleaner.issues_need_review")}
        </span>
      </div>

      {/* Issue Chips */}
      <div className="flex flex-wrap gap-2 items-center">
        {dupCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FDEBEC] text-[#9F2F2D] border border-[#f5c6cb]">
            {t("cleaner.chip_duplicates", { count: dupCount })}
          </span>
        )}

        {Array.from(colIssuesMap.entries()).map(([col, counts]) => {
          const k = previewErrorCountPerCol.get(col) || 0;
          const parts = [];
          if (counts.missing > 0) parts.push(t("cleaner.chip_missing", { col, count: counts.missing }));
          else parts.push(col);

          if (counts.wrongType > 0) parts.push(t("cleaner.chip_wrong_type", { count: counts.wrongType }));
          if (counts.encoding > 0) parts.push(t("cleaner.chip_encoding", { count: counts.encoding }));
          if (counts.semantic > 0) parts.push(t("cleaner.chip_semantic", { count: counts.semantic }));

          const chipText = parts.join(" ");
          const inTableText = t("cleaner.chip_in_table", { count: k });
          const tooltip = k === 0
            ? `${t("cleaner.chip_outside_preview")}. ${t("cleaner.tooltip_chip_jump")}.`
            : `${chipText} ${inTableText}. ${t("cleaner.tooltip_chip_jump")}.`;

          return (
            <button
              key={col}
              type="button"
              onClick={() => onJumpToCol && onJumpToCol(col)}
              title={tooltip}
              aria-label={tooltip}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${k > 0
                  ? "bg-[#FEF6E6] text-[#854D0E] border-[#FDE68A] hover:bg-[#FDF0D5]"
                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                }`}
            >
              <span>{chipText}</span>
              <span className={`text-[11px] font-semibold ${k > 0 ? "text-[#D97706]" : "text-gray-400"}`}>
                {inTableText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CleanerActionBar({ onAutoClean, onManualClean, onSkip, hasIssues }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
      {hasIssues ? (
        <>
          <button
            id="clean-mode-auto-btn"
            onClick={onAutoClean}
            title={t("cleaner.tooltip_btn_auto_clean")}
            aria-label={t("cleaner.tooltip_btn_auto_clean")}
            className={`${BTN.primary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
          >
            <Zap className="w-5 h-5" /> {t("cleaner.btn_auto_clean")}
          </button>
          <button
            id="clean-mode-manual-btn"
            onClick={onManualClean}
            title={t("cleaner.tooltip_btn_manual_clean")}
            aria-label={t("cleaner.tooltip_btn_manual_clean")}
            className={`${BTN.secondary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
          >
            <PenTool className="w-5 h-5" /> {t("cleaner.btn_manual_clean")}
          </button>
          <button
            id="clean-mode-skip-btn"
            onClick={onSkip}
            title={t("cleaner.tooltip_btn_skip_cleaning")}
            aria-label={t("cleaner.tooltip_btn_skip_cleaning")}
            className={`${BTN.secondary} flex-1 justify-center py-3 text-base flex items-center gap-2 text-muted`}
          >
            {t("cleaner.btn_skip_cleaning")}
          </button>
        </>
      ) : (
        <>
          <button
            id="clean-mode-skip-btn-primary"
            onClick={onSkip}
            title={t("cleaner.tooltip_btn_skip_cleaning")}
            aria-label={t("cleaner.tooltip_btn_skip_cleaning")}
            className={`${BTN.primary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
          >
            <CheckCircle className="w-5 h-5" /> {t("cleaner.btn_skip_cleaning_clean")}
          </button>
          <button
            id="clean-mode-auto-btn"
            onClick={onAutoClean}
            title={t("cleaner.tooltip_btn_auto_clean")}
            aria-label={t("cleaner.tooltip_btn_auto_clean")}
            className={`${BTN.secondary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
          >
            <Zap className="w-5 h-5" /> {t("cleaner.btn_auto_clean")}
          </button>
          <button
            id="clean-mode-manual-btn"
            onClick={onManualClean}
            title={t("cleaner.tooltip_btn_manual_clean")}
            aria-label={t("cleaner.tooltip_btn_manual_clean")}
            className={`${BTN.secondary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
          >
            <PenTool className="w-5 h-5" /> {t("cleaner.btn_manual_clean")}
          </button>
        </>
      )}
    </div>
  );
}

function PreviewTable({
  data,
  errorCells = [],
  changedCells = [],
  title,
  containerRef: externalContainerRef,
  filterOnlyErrorCols = false,
  filterOnlyErrorRows = false,
  onCellClick = null
}) {
  const { t } = useTranslation();
  const internalContainerRef = useRef(null);
  const containerRef = externalContainerRef || internalContainerRef;

  if (!data || data.length === 0) return null;

  // Build changed map for quick lookup: `${row_id}:${col}` -> item
  const changedMap = useMemo(() => {
    const map = new Map();
    changedCells.forEach(item => {
      map.set(`${item.row_id}:${item.column}`, item);
    });
    return map;
  }, [changedCells]);

  // All columns except original_index
  const allColumns = useMemo(() => {
    return Object.keys(data[0] || {}).filter(c => c !== "original_index");
  }, [data]);

  // Set of columns with error cells in this preview data
  const errorColsSet = useMemo(() => {
    const set = new Set();
    errorCells.forEach(e => {
      if (e.column) set.add(e.column);
    });
    return set;
  }, [errorCells]);

  // Set of row_ids with errors in this preview data
  const errorRowIdsSet = useMemo(() => {
    const set = new Set();
    errorCells.forEach(e => {
      if (e.row_id !== undefined && e.row_id !== null) set.add(e.row_id);
    });
    return set;
  }, [errorCells]);

  // Filter columns
  const visibleColumns = useMemo(() => {
    if (!filterOnlyErrorCols) return allColumns;
    const filtered = allColumns.filter(c => errorColsSet.has(c));
    return filtered.length > 0 ? filtered : allColumns;
  }, [allColumns, filterOnlyErrorCols, errorColsSet]);

  // Filter rows
  const visibleRows = useMemo(() => {
    if (!filterOnlyErrorRows) return data;
    const filtered = data.filter(r => r.original_index !== undefined && errorRowIdsSet.has(r.original_index));
    return filtered.length > 0 ? filtered : data;
  }, [data, filterOnlyErrorRows, errorRowIdsSet]);

  // Compute column widths
  const colWidths = useMemo(() => {
    const widths = {};
    visibleColumns.forEach(col => {
      widths[col] = getColumnWidth(col, data);
    });
    return widths;
  }, [visibleColumns, data]);

  const getReasonLabel = (reason) => {
    switch (reason) {
      case "edited":
        return t("cleaner.action_reason_edited");
      case "missing_filled":
        return t("cleaner.action_reason_missing_filled");
      case "encoding_fixed":
        return t("cleaner.action_reason_encoding_fixed");
      case "type_converted":
        return t("cleaner.action_reason_type_converted");
      default:
        return reason || "";
    }
  };

  return (
    <Card className="mt-4 p-4">
      {title && <SectionTitle>{title}</SectionTitle>}
      <div
        ref={containerRef}
        className="overflow-x-auto border border-border rounded-lg mt-3 bg-white max-h-[600px] overflow-y-auto relative"
      >
        <table className="w-full text-left text-sm table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            {visibleColumns.map(col => (
              <col key={col} style={{ width: `${colWidths[col] || 120}px` }} />
            ))}
          </colgroup>
          <thead className="bg-[#F9F9F8] border-b border-border sticky top-0 z-20 shadow-xs">
            <tr>
              <th
                className="px-2.5 py-2.5 font-semibold text-ink w-12 text-center sticky left-0 z-30 bg-[#F9F9F8] border-r border-border"
              >
                #
              </th>
              {visibleColumns.map(col => (
                <th
                  key={col}
                  id={`th-col-${col}`}
                  className="px-2.5 py-2.5 font-semibold text-ink text-left align-top transition-all"
                  title={col}
                >
                  <span className="line-clamp-2 break-words text-xs leading-snug">
                    {col}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row, idx) => {
              const rowId = row.original_index;
              const hasErrorInRow = rowId !== undefined && errorRowIdsSet.has(rowId);

              return (
                <tr
                  key={rowId !== undefined ? rowId : idx}
                  className={`hover:bg-sage/10 transition-colors ${hasErrorInRow ? "bg-amber-50/20" : ""}`}
                >
                  <td
                    className="px-2.5 py-2 text-muted text-center border-r border-border/50 sticky left-0 z-10 bg-[#F9F9F8] font-mono text-xs select-none"
                  >
                    {rowId !== undefined ? rowId : idx + 1}
                  </td>
                  {visibleColumns.map(col => {
                    let cellClasses = "px-2.5 py-2 truncate text-xs transition-colors border border-transparent";
                    let tooltip = row[col] !== null && row[col] !== undefined ? String(row[col]) : "null";

                    const cellError = rowId !== undefined ? errorCells.find(e => e.row_id === rowId && e.column === col) : null;
                    const changedItem = rowId !== undefined ? changedMap.get(`${rowId}:${col}`) : null;

                    if (changedItem) {
                      cellClasses = "px-2.5 py-2 truncate text-xs transition-colors bg-emerald-50 text-emerald-900 border-emerald-200 font-medium";
                      const oldDisplay = changedItem.old === null || changedItem.old === undefined ? "null" : String(changedItem.old);
                      const newDisplay = changedItem.new === null || changedItem.new === undefined ? "null" : String(changedItem.new);
                      tooltip = `${oldDisplay} → ${newDisplay} · ${getReasonLabel(changedItem.reason)}`;
                    } else if (cellError) {
                      if (cellError.severity === "error") {
                        cellClasses = "px-2.5 py-2 truncate text-xs transition-colors bg-red-50 text-red-900 border-red-200 font-medium";
                      } else {
                        cellClasses = "px-2.5 py-2 truncate text-xs transition-colors bg-[#FEF9C3]/80 text-amber-900 border-[#FEF08A]";
                      }
                      tooltip = t(`cleaner.guided.reasons.${cellError.issue_type}`, {
                        defaultValue: cellError.semantic_type || t("cleaner.guided.pending")
                      });
                    } else {
                      cellClasses += " text-ink";
                    }

                    return (
                      <td
                        key={col}
                        data-cell-id={`${rowId}:${col}`}
                        className={cellClasses}
                        title={tooltip}
                        onClick={() => onCellClick && onCellClick(rowId, col, row[col])}
                      >
                        {row[col] !== null && row[col] !== undefined ? (
                          String(row[col])
                        ) : (
                          <span className="text-gray-400 italic">null</span>
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
    </Card>
  );
}

function DiffReportView({
  diff,
  validationState,
  filename,
  previewData,
  errorCells = [],
  changedCells = [],
  removedRows = [],
  changedTruncated = false,
  onConfirm,
  onBack,
  confirming,
  onManualClean
}) {
  const { t } = useTranslation();
  const tableContainerRef = useRef(null);

  const rows = [
    { label: t("cleaner.diff_dup_rows"), value: diff.duplicate_rows_removed, warn: diff.duplicate_rows_removed > 0 },
    { label: t("cleaner.diff_remaining_rows"), value: `${diff.original_rows} → ${diff.clean_rows}` },
    { label: t("cleaner.diff_remaining_cols"), value: `${diff.original_cols} → ${diff.clean_cols}` },
  ];

  const missingEntries = Object.entries(diff.missing_filled || {});
  const typeEntries = Object.entries(diff.types_converted || {});
  const encodingEntries = Object.entries(diff.encoding_fixed || {});
  const droppedColumns = diff.columns_dropped || [];

  const semanticErrorsCount = errorCells.filter(e => e.severity === "error").length;
  const semanticHintsCount = errorCells.filter(e => e.severity === "hint").length;
  const hasSemanticIssues = semanticErrorsCount > 0 || semanticHintsCount > 0;

  const structuralFixedCount = Object.values(diff.missing_filled || {}).reduce((a, b) => a + b, 0) +
    Object.keys(diff.types_converted || {}).length +
    Object.values(diff.encoding_fixed || {}).reduce((a, b) => a + b, 0) +
    diff.duplicate_rows_removed;

  const handleJumpToCol = (colName) => {
    // Find first changed cell or error cell in this column within previewData
    const firstChanged = changedCells.find(c => c.column === colName);
    const rowId = firstChanged ? firstChanged.row_id : null;
    scrollToCell(tableContainerRef.current, colName, rowId);
  };

  return (
    <div className="space-y-4">
      {/* Semantic Issues Banner */}
      {hasSemanticIssues && (
        <div className="bg-[#FFF0E6] border border-[#ffd0aa] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#A84300] mt-0.5" />
            <div>
              <p className="font-semibold text-[#A84300] text-sm">
                {t("cleaner.auto_clean_semantic_banner_title", { count: structuralFixedCount })}
              </p>
              <p className="text-xs text-[#A84300]/80 mt-0.5">
                {t("cleaner.auto_clean_semantic_banner_desc", {
                  total: semanticErrorsCount + semanticHintsCount,
                  errors: semanticErrorsCount,
                  hints: semanticHintsCount,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <SectionTitle>{t("cleaner.diff_report_title")}</SectionTitle>

        {/* Tóm tắt chính */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {rows.map((r) => (
            <div key={r.label} className="text-center py-3 rounded-lg bg-[#F9F9F8] border border-border">
              <p className={`text-lg font-semibold font-mono ${r.warn ? "text-[#9F2F2D]" : "text-ink"}`}>
                {r.value}
              </p>
              <p className="text-[10px] text-muted mt-0.5">{r.label}</p>
            </div>
          ))}
        </div>

        {/* Removed duplicate rows note */}
        {(diff.duplicate_rows_removed > 0 || removedRows.length > 0) && (
          <div
            className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2"
            title={t("cleaner.tooltip_removed_rows_note")}
          >
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {t("cleaner.removed_rows_note", {
                count: diff.duplicate_rows_removed || removedRows.length
              })}
            </span>
          </div>
        )}

        {/* Truncated notice */}
        {changedTruncated && (
          <div className="mb-3 text-xs text-muted italic">
            * {t("cleaner.changed_truncated_note")}
          </div>
        )}

        {/* Interactive Chips per changed column */}
        {(missingEntries.length > 0 || typeEntries.length > 0 || encodingEntries.length > 0) && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink mb-1.5">{t("cleaner.legend_action_changed")}:</p>
            <div className="flex flex-wrap gap-2">
              {missingEntries.map(([col, cnt]) => (
                <button
                  key={`missing_${col}`}
                  type="button"
                  onClick={() => handleJumpToCol(col)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title={col}
                >
                  <span>{t("cleaner.chip_changed_filled", { col, count: cnt })}</span>
                </button>
              ))}

              {typeEntries.map(([col, change]) => (
                <button
                  key={`type_${col}`}
                  type="button"
                  onClick={() => handleJumpToCol(col)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#FBF3DB] text-[#956400] border border-[#f0dda0] hover:bg-[#faebc2] transition-colors cursor-pointer"
                  title={col}
                >
                  <span>{t("cleaner.chip_changed_types", { col, change })}</span>
                </button>
              ))}

              {encodingEntries.map(([col, cnt]) => (
                <button
                  key={`enc_${col}`}
                  type="button"
                  onClick={() => handleJumpToCol(col)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#FFF0E6] text-[#A84300] border border-[#ffd0aa] hover:bg-[#ffe3cf] transition-colors cursor-pointer"
                  title={col}
                >
                  <span>{t("cleaner.chip_changed_encoding", { col, count: cnt })}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dropped columns */}
        {droppedColumns.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink mb-1.5">{t("cleaner.diff_dropped_cols")}</p>
            <div className="flex flex-wrap gap-1.5">
              {droppedColumns.map((col) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-[#FDEBEC] text-[#9F2F2D] border border-[#f5c6cb]">
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}

        {missingEntries.length === 0 && typeEntries.length === 0 && encodingEntries.length === 0 && diff.duplicate_rows_removed === 0 && droppedColumns.length === 0 && (
          <p className="text-sm text-muted">{t("cleaner.diff_no_changes")}</p>
        )}
      </Card>

      {/* Warnings Banner */}
      {validationState?.warnings?.length > 0 && (
        <div className="bg-[#FBF3DB] border border-[#f0dda0] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-[#956400] text-sm mb-1">{t("cleaner.quality_warnings_title")}</p>
              <ul className="space-y-1">
                {validationState.warnings.map(w => (
                  <li key={w.code} className="text-xs text-[#956400]/80">
                    <span className="font-medium">• {w.message}</span>
                    {w.impact && <span className="block ml-2 opacity-80 mt-0.5">{t("cleaner.impact_label", { impact: w.impact })}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <PreviewTable
        data={previewData}
        errorCells={errorCells}
        changedCells={changedCells}
        containerRef={tableContainerRef}
        title={t("cleaner.cleaned_preview_title")}
      />
    </div>
  );
}

function ConfirmedView({ result, previewData, onGoHome, onGoVisualize, onBackToEdit, isSkip }) {
  const { t } = useTranslation();
  const summary = result.summary_for_module3;
  const currentLang = getCurrentLang();
  const localeStr = currentLang === "vi" ? "vi-VN" : "en-US";

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="border border-[#c8e0cb] rounded-xl p-5 bg-sage">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-forest" />
          <div>
            <p className="font-medium text-forest">
              {isSkip ? t("cleaner.skip_banner_title") : t("cleaner.confirmed_banner_title")}
            </p>
            <p className="text-sm text-forest/70 mt-0.5">
              {isSkip ? t("cleaner.skip_banner_desc") : t("cleaner.confirmed_banner_desc")}
            </p>
          </div>
        </div>
      </div>

      {/* Summary for Module 3 */}
      <Card>
        <SectionTitle>{t("cleaner.summary_module3_title")}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: t("cleaner.summary_rows"), value: summary?.shape?.[0]?.toLocaleString(localeStr) ?? "—" },
            { label: t("cleaner.summary_cols"), value: summary?.shape?.[1]?.toLocaleString(localeStr) ?? "—" },
            { label: t("cleaner.summary_numeric_cols"), value: summary?.numeric_columns?.length ?? "—" },
            { label: t("cleaner.summary_categorical_cols"), value: summary?.categorical_columns?.length ?? "—" },
          ].map((s) => (
            <div key={s.label} className="text-center py-3 rounded-lg bg-[#F9F9F8] border border-border">
              <p className="text-lg font-semibold font-mono text-ink">{s.value}</p>
              <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Session info */}
        <div className="text-xs text-muted space-y-0.5 pt-3 border-t border-border">
          <p>{t("cleaner.session_info_session")} <code className="font-mono bg-[#F9F9F8] px-1 rounded">{result.session_id.slice(0, 12)}...</code></p>
          <p>{t("cleaner.session_info_mode")} <span className="font-medium text-ink">{result.clean_mode === "auto" ? t("cleaner.session_info_mode_auto") : t("cleaner.session_info_mode_manual")}</span></p>
          <p>{t("cleaner.session_info_confirmed_at")} <span className="font-medium text-ink">{new Date(result.confirmed_at).toLocaleString(localeStr)}</span></p>
        </div>
      </Card>

      {/* Preview Table */}
      <PreviewTable data={previewData} />

      {/* Next steps */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            id="cleaner-go-home-btn"
            onClick={onGoHome}
            className={`${BTN.secondary} flex items-center gap-2`}
          >
            <ArrowLeft className="w-4 h-4 inline-block mr-1" /> {t("cleaner.btn_go_home")}
          </button>
          {onBackToEdit && (
            <button
              onClick={onBackToEdit}
              className={`${BTN.secondary} flex items-center gap-2`}
            >
              <ArrowLeft className="w-4 h-4 inline-block mr-1" /> {t("cleaner.btn_back_to_edit")}
            </button>
          )}
        </div>
        <button
          id="cleaner-go-module3-btn"
          onClick={onGoVisualize}
          className={`${BTN.primary} flex items-center gap-2`}
        >
          {t("cleaner.btn_visualize")} <ArrowRight className="w-4 h-4 inline-block ml-1" />
        </button>
      </div>
    </div>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────

function LoadingStep({ message }) {
  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center gap-3 text-muted text-sm">
        <svg className="animate-spin h-5 w-5 text-forest shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>{message}</span>
      </div>
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        <div className="h-full bg-forest rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Cleaner({ pipelineMode, onComplete, onError }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const manualWorkspaceDirtyRef = useRef(false);

  // Guards for duplicate calls and in-flight abort
  const isDetectingRef = useRef(false);
  const isAutoCleaningRef = useRef(false);
  const abortControllerRef = useRef(null);

  const { fileSession, updateFileSession, clearFileSession } = useFileSession();

  const fileHash = fileSession.fileHash;
  const fileName = fileSession.fileName;
  const profileData = fileSession.profileData;
  const overrides = fileSession.overrides || {};

  const setFileHash = (hash) => updateFileSession({ fileHash: hash });
  const setFileName = (name) => updateFileSession({ fileName: name });
  const setProfileData = (data) => updateFileSession({ profileData: data });

  // Trạng thái upload nội bộ
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [step, setStep] = useState("detecting");
  const [issues, setIssues] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [diffReport, setDiffReport] = useState(null);
  const [validationState, setValidationState] = useState(null);
  const [autoCleanErrorCells, setAutoCleanErrorCells] = useState([]);
  const [autoCleanChangedCells, setAutoCleanChangedCells] = useState([]);
  const [autoCleanRemovedRows, setAutoCleanRemovedRows] = useState([]);
  const [autoCleanChangedTruncated, setAutoCleanChangedTruncated] = useState(false);
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState(t("cleaner.loading_scanning"));
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [isSkip, setIsSkip] = useState(false);
  const [fileExpired, setFileExpired] = useState(false);

  // Check session-status on mount
  useEffect(() => {
    if (!fileHash) return;
    getSessionStatus(fileHash)
      .then((res) => {
        if (!res.data.file_available) {
          setFileExpired(true);
        }
      })
      .catch((err) => {
        console.warn("Cleaner session-status check failed:", err);
      });
  }, [fileHash]);

  // Filters state
  const [filterOnlyErrorCols, setFilterOnlyErrorCols] = useState(false);
  const [filterOnlyErrorRows, setFilterOnlyErrorRows] = useState(false);

  // Error navigation state
  const [currentNavError, setCurrentNavError] = useState(null);
  const previewTableContainerRef = useRef(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      showToast(t("cleaner.toast_upload_invalid_format"), "error");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsUploading(true);
    setError(null);
    try {
      const res = await profileFile(file);
      setFileHash(res.data.file_hash);
      setFileName(file.name);
      setProfileData(res.data);
      updateFileSession({ overrides: {} });
      showToast(t("cleaner.toast_upload_success"), "success");
    } catch (err) {
      showToast(t("cleaner.toast_upload_failed"), "error");
      setError(t("cleaner.toast_upload_failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  useEffect(() => {
    if (fileHash && step === "detecting") {
      runDetection();
    }
  }, [fileHash, step]);

  const runDetection = async () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoadingMsg(t("cleaner.loading_scanning"));
      const res = await detectIssues(fileHash, overrides);
      setIssues(res.data);
      setPreviewData(res.data.preview_data || []);
      setError(null);
      setStep("previewing_issues");
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      const detail = err?.response?.data?.detail;
      const errCode = err?.response?.data?.code || (typeof detail === "string" && detail.includes("ERR_SYS_CACHE_EXPIRED") ? "ERR_SYS_CACHE_EXPIRED" : "");
      if (errCode === "ERR_SYS_CACHE_EXPIRED") {
        setFileExpired(true);
        setError(null);
        setStep("previewing_issues");
        return;
      }
      const msg = typeof detail === "string" ? translateError(detail, detail) : t("cleaner.toast_detect_failed");
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    } finally {
      isDetectingRef.current = false;
    }
  };

  const handleModeSelect = async (mode) => {
    setSelectedMode(mode);
    if (mode === "manual") {
      setStep("manual_workspace");
      return;
    }

    if (isAutoCleaningRef.current) return;
    isAutoCleaningRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoadingMsg(t("cleaner.loading_auto_cleaning"));
      setStep("cleaning");
      const finalOverrides = Object.fromEntries(Object.entries(overrides).filter(([_, v]) => v !== "auto"));
      const res = await autoClean(fileHash, finalOverrides);
      setDiffReport(res.data.diff_report);
      setPreviewData(res.data.preview_data || []);
      setAutoCleanErrorCells(res.data.error_cells || []);
      setAutoCleanChangedCells(res.data.changed_cells || []);
      setAutoCleanRemovedRows(res.data.removed_rows || []);
      setAutoCleanChangedTruncated(Boolean(res.data.changed_truncated));
      setError(null);

      if (res.data.validation && !res.data.validation.can_proceed) {
        const err = res.data.validation.hard_blocks[0]?.message || t("cleaner.error_clean_failed");
        setError(err);
        showToast(err, "error");
        setStep("error");
        return;
      }

      setValidationState(res.data.validation);
      setStep("reviewing_diff");
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      const detail = err?.response?.data?.detail;
      const errCode = err?.response?.data?.code || (typeof detail === "string" && detail.includes("ERR_SYS_CACHE_EXPIRED") ? "ERR_SYS_CACHE_EXPIRED" : "");
      if (errCode === "ERR_SYS_CACHE_EXPIRED") {
        setFileExpired(true);
        setError(null);
        setStep("previewing_issues");
        return;
      }
      const msg = typeof detail === "string" ? translateError(detail, detail) : t("cleaner.toast_auto_clean_failed");
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    } finally {
      isAutoCleaningRef.current = false;
    }
  };

  const handleConfirmClean = async (manualActions = []) => {
    setConfirming(true);
    try {
      const res = await confirmClean(fileHash, selectedMode || "auto", overrides, manualActions);
      manualWorkspaceDirtyRef.current = false; // Rule 1: clear unsaved-changes flag on Confirm
      setConfirmedResult(res.data);
      setStep("confirmed");
      showToast(t("cleaner.toast_confirm_success"), "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? translateError(detail, detail) : t("cleaner.toast_confirm_failed");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setConfirming(false);
    }
  };

  const handleSkipCleaning = async () => {
    const totalIssues = (issues?.missing_values?.length ?? 0) +
      (issues?.wrong_types?.length ?? 0) +
      (issues?.encoding_errors?.length ?? 0) +
      (issues?.duplicates?.duplicate_count ?? 0) +
      (issues?.semantic_errors?.length ?? 0);
    if (totalIssues > 0) {
      if (!window.confirm(t("cleaner.confirm_skip_with_issues", { count: totalIssues }))) return;
    }
    // Confirm with manual mode + empty actions = skip (no changes)
    setIsSkip(true);
    setConfirming(true);
    try {
      const res = await confirmClean(fileHash, "manual", overrides, []);
      manualWorkspaceDirtyRef.current = false;
      setConfirmedResult(res.data);
      setSelectedMode("manual");
      setStep("confirmed");
      showToast(t("cleaner.toast_confirm_success"), "success");
    } catch (err) {
      setIsSkip(false);
      const detail = err?.response?.data?.detail;
      const errCode = err?.response?.data?.code || (typeof detail === "string" && detail.includes("ERR_SYS_CACHE_EXPIRED") ? "ERR_SYS_CACHE_EXPIRED" : "");
      if (errCode === "ERR_SYS_CACHE_EXPIRED") {
        setFileExpired(true);
        setError(null);
        return;
      }
      const msg = typeof detail === "string" ? translateError(detail, detail) : t("cleaner.toast_confirm_failed");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setConfirming(false);
    }
  };

  const handleBackToOriginal = () => {
    if (manualWorkspaceDirtyRef.current) {
      if (!window.confirm(t("cleaner.nav.confirm_back_to_original"))) {
        return;
      }
    }
    manualWorkspaceDirtyRef.current = false;
    setConfirmedResult(null);
    setDiffReport(null);
    setValidationState(null);
    setStep("previewing_issues");
  };

  const handleStartOver = () => {
    if (manualWorkspaceDirtyRef.current) {
      if (!window.confirm(t("cleaner.nav.confirm_start_over"))) {
        return;
      }
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    manualWorkspaceDirtyRef.current = false;
    clearFileSession();
    setStep("detecting");
    setIssues(null);
    setDiffReport(null);
    setConfirmedResult(null);
    setPreviewData([]);
    setAutoCleanErrorCells([]);
    setAutoCleanChangedCells([]);
    setAutoCleanRemovedRows([]);
    setAutoCleanChangedTruncated(false);
    setSelectedMode(null);
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    if (!issues) {
      setStep("detecting");
      runDetection();
    } else if (selectedMode === "auto") {
      handleModeSelect("auto");
    } else {
      setStep("previewing_issues");
    }
  };

  const handleJumpToCol = (colName) => {
    // Find first error cell of this column in preview
    const firstErr = (issues?.error_cells || []).find(e => e.column === colName);
    const rowId = firstErr ? firstErr.row_id : null;
    scrollToCell(previewTableContainerRef.current, colName, rowId);
    if (firstErr) {
      setCurrentNavError(firstErr);
    }
  };

  const handleNextError = () => {
    const ordered = getOrderedErrorCells(issues?.error_cells || [], previewData, profileData?.columns?.map(c => c.name) || []);
    if (ordered.length === 0) {
      showToast(t("cleaner.bar_no_errors_in_preview"), "info");
      return;
    }
    const next = getNextError(ordered, currentNavError);
    if (next) {
      setCurrentNavError(next);
      scrollToCell(previewTableContainerRef.current, next.column, next.row_id);
    }
  };

  const handlePrevError = () => {
    const ordered = getOrderedErrorCells(issues?.error_cells || [], previewData, profileData?.columns?.map(c => c.name) || []);
    if (ordered.length === 0) {
      showToast(t("cleaner.bar_no_errors_in_preview"), "info");
      return;
    }
    const prev = getPrevError(ordered, currentNavError);
    if (prev) {
      setCurrentNavError(prev);
      scrollToCell(previewTableContainerRef.current, prev.column, prev.row_id);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24">
      <div className={PAGE.wrapper}>
        <PageHeader
          title={t("cleaner.title")}
          subtitle={fileName ? t("cleaner.subtitle_cleaning", { fileName }) : t("cleaner.subtitle_auto")}
          actions={
            <div className="flex items-center gap-3">
              <PageHelpDocs pageId="cleaner" />
              {!pipelineMode && (
                <>
                  <button
                    onClick={() => navigate(fileHash ? "/dashboard/profiler" : "/dashboard/profiler")}
                    className={`${BTN.secondary} flex items-center gap-1.5`}
                  >
                    <ArrowLeft className="w-4 h-4" /> {t("cleaner.back_to_profiler")}
                  </button>
                  {fileHash && (
                    <button
                      onClick={handleStartOver}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <FolderUp className="w-4 h-4" /> {t("cleaner.upload_different_file")}
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        {/* Persistent Navigation Bar (after upload) */}
        {fileExpired && (
          <FileExpiredBanner
            fileName={fileName}
            fileHash={fileHash}
            onReuploaded={() => {
              setFileExpired(false);
              runDetection();
            }}
          />
        )}

        {fileHash && step !== "detecting" && (
          <div className="mb-4 bg-white border border-border rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
            <div>
              {step !== "previewing_issues" ? (
                <button
                  id="cleaner-persistent-back-btn"
                  onClick={handleBackToOriginal}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("cleaner.nav.back_to_original")}
                </button>
              ) : (
                <span className="text-xs text-muted font-medium">
                  {fileName}
                </span>
              )}
            </div>
            <button
              id="cleaner-persistent-start-over-btn"
              onClick={handleStartOver}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-[#9F2F2D] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t("cleaner.nav.start_over")}
            </button>
          </div>
        )}

        {/* Upload Zone (Nếu chưa có fileHash) */}
        {!fileHash ? (
          <div className="max-w-3xl mx-auto py-8">
            <h2 className="text-xl font-semibold text-ink mb-2">{t("cleaner.start_cleaning_title")}</h2>
            <p className="text-sm text-muted mb-6">
              {t("cleaner.start_cleaning_desc")}
            </p>

            <div
              id="upload-zone"
              className={`
                border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors
                ${isDragging
                  ? "border-[#1B4324] bg-[#EAF2EB]"
                  : "border-border hover:border-[#1B4324] hover:bg-sage/40"
                }
                ${isUploading ? "pointer-events-none opacity-60" : ""}
              `}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleInputChange}
                id="file-input"
              />
              <div className="text-muted text-sm">
                <Upload size={48} strokeWidth={1.5} className="mx-auto mb-4 text-[#1B4324]" />
                <span className="block mb-1.5 text-ink font-medium text-lg">{t("cleaner.drag_drop_prompt")}</span>
                {t("cleaner.file_support_hint")}
              </div>
            </div>

            <div className="mt-8 bg-white border border-border rounded-xl p-6 shadow-sm">
              <h3 className="font-medium text-ink flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-[#1B4324]" />
                {t("cleaner.cleaning_notes_title")}
              </h3>
              <ul className="text-sm text-muted space-y-3 list-disc pl-5">
                <li><strong className="text-ink font-medium">{t("cleaner.note_preserve_original")}</strong> {t("cleaner.note_preserve_original_desc")}</li>
                <li><strong className="text-ink font-medium">{t("cleaner.note_auto_clean")}</strong> {t("cleaner.note_auto_clean_desc")}</li>
                <li><strong className="text-ink font-medium">{t("cleaner.note_full_control")}</strong> {t("cleaner.note_full_control_desc")}</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Error inline */}
            {error && (
              <div className="mb-6 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={handleRetry}
                  className="text-xs font-semibold underline hover:no-underline shrink-0"
                >
                  {t("cleaner.retry")}
                </button>
              </div>
            )}

            {/* ── Step: detecting ── */}
            {step === "detecting" && (
              <LoadingStep message={loadingMsg || t("cleaner.loading_scanning")} />
            )}

            {/* ── Step: error ── */}
            {step === "error" && (
              <div className="text-center py-10 bg-white border border-[#f5c6cb] rounded-xl shadow-sm">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[#9F2F2D]" />
                <h2 className="text-lg font-semibold text-[#9F2F2D] mb-2">{t("cleaner.error_clean_failed")}</h2>
                <p className="text-sm text-muted whitespace-pre-line mb-6 max-w-md mx-auto leading-relaxed">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleRetry}
                    className={BTN.primary}
                  >
                    {t("cleaner.retry")}
                  </button>
                  <button
                    onClick={() => {
                      updateFileSession({ fileHash: null, fileName: null, profileData: null, overrides: null, sessionId: null });
                      setStep("detecting");
                      setError(null);
                    }}
                    className={BTN.secondary}
                  >
                    {t("cleaner.upload_different")}
                  </button>
                  <button
                    onClick={() => navigate("/dashboard/profiler")}
                    className={BTN.secondary}
                  >
                    {t("cleaner.view_original_data")}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: cleaning ── */}
            {step === "cleaning" && (
              <LoadingStep message={loadingMsg || t("cleaner.loading_rules")} />
            )}

            {/* ── Step: previewing_issues ── */}
            {step === "previewing_issues" && issues && (
              <div className="space-y-4">
                <IssuesSummary
                  issues={issues}
                  previewRows={previewData}
                  onJumpToCol={handleJumpToCol}
                />

                {/* Filter toggles */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label
                    className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none"
                    title={t("cleaner.tooltip_filter_error_cols")}
                  >
                    <input
                      type="checkbox"
                      checked={filterOnlyErrorCols}
                      onChange={(e) => setFilterOnlyErrorCols(e.target.checked)}
                      className="rounded border-border text-forest focus:ring-forest w-3.5 h-3.5"
                    />
                    <span>{t("cleaner.filter_only_error_cols")}</span>
                    <HelpCircle className="w-3.5 h-3.5 text-muted hover:text-ink transition-colors" />
                  </label>

                  <label
                    className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none"
                    title={t("cleaner.tooltip_filter_error_rows")}
                  >
                    <input
                      type="checkbox"
                      checked={filterOnlyErrorRows}
                      onChange={(e) => setFilterOnlyErrorRows(e.target.checked)}
                      className="rounded border-border text-forest focus:ring-forest w-3.5 h-3.5"
                    />
                    <span>{t("cleaner.filter_only_error_rows")}</span>
                    <HelpCircle className="w-3.5 h-3.5 text-muted hover:text-ink transition-colors" />
                  </label>
                </div>

                <PreviewTable
                  data={previewData}
                  errorCells={issues.error_cells || []}
                  containerRef={previewTableContainerRef}
                  filterOnlyErrorCols={filterOnlyErrorCols}
                  filterOnlyErrorRows={filterOnlyErrorRows}
                  title={t("cleaner.preview_table_title")}
                />
              </div>
            )}

            {/* ── Step: manual_workspace ── */}
            {step === "manual_workspace" && (
              <div className="space-y-4">
                <ManualCleanWorkspace
                  columns={profileData?.columns?.map(c => c.name) || []}
                  fileHash={fileHash}
                  onConfirm={(actions) => handleConfirmClean(actions)}
                  onBack={handleBackToOriginal}
                  initialPreviewData={previewData}
                  initialErrorCells={selectedMode === "auto" ? autoCleanErrorCells : (issues?.error_cells || [])}
                  onDirtyChange={(isDirty) => {
                    manualWorkspaceDirtyRef.current = isDirty;
                  }}
                />
              </div>
            )}

            {/* ── Step: reviewing_diff ── */}
            {step === "reviewing_diff" && diffReport && (
              <DiffReportView
                diff={diffReport}
                validationState={validationState}
                filename={fileName}
                previewData={previewData}
                errorCells={autoCleanErrorCells}
                changedCells={autoCleanChangedCells}
                removedRows={autoCleanRemovedRows}
                changedTruncated={autoCleanChangedTruncated}
                onConfirm={() => handleConfirmClean()}
                onBack={() => setStep("previewing_issues")}
                confirming={confirming}
                onManualClean={() => setStep("manual_workspace")}
              />
            )}

            {/* ── Step: confirmed ── */}
            {step === "confirmed" && confirmedResult && (
              <ConfirmedView
                result={confirmedResult}
                previewData={confirmedResult.preview_data && confirmedResult.preview_data.length > 0 ? confirmedResult.preview_data : previewData}
                isSkip={isSkip}
                onGoHome={() => navigate("/dashboard/profiler")}
                onGoVisualize={() => {
                  updateFileSession({
                    sessionId: confirmedResult.session_id,
                    capabilities: confirmedResult.validation?.capabilities || null,
                    warnings: confirmedResult.validation?.warnings || []
                  });
                  if (pipelineMode && onComplete) onComplete();
                  else navigate("/dashboard/visualize");
                }}
                onBackToEdit={() => {
                  // Rule 1: No confirm dialog when clicking "Quay lại sửa tiếp" on confirmed screen
                  manualWorkspaceDirtyRef.current = false;
                  setIsSkip(false);
                  setStep("previewing_issues");
                  setConfirmedResult(null);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      {fileHash && step !== "detecting" && step !== "cleaning" && step !== "error" && step !== "manual_workspace" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E5E3] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* 1. previewing_issues bar */}
            {step === "previewing_issues" && issues && (
              <>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-xs font-semibold text-ink">
                    {t("cleaner.bar_issues_summary", {
                      issues: (issues.missing_values?.length ?? 0) +
                        (issues.wrong_types?.length ?? 0) +
                        (issues.encoding_errors?.length ?? 0) +
                        (issues.duplicates?.duplicate_count ? 1 : 0) +
                        (issues.semantic_errors?.length ?? 0),
                      cols: new Set([
                        ...(issues.missing_values || []).map(m => m.column),
                        ...(issues.wrong_types || []).map(w => w.column),
                        ...(issues.encoding_errors || []).map(e => e.column),
                        ...(issues.semantic_errors || []).map(s => s.column)
                      ]).size
                    })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevError}
                      title={t("cleaner.tooltip_btn_prev_error")}
                      aria-label={t("cleaner.tooltip_btn_prev_error")}
                      className="px-2.5 py-1 text-xs font-medium border border-border rounded-md bg-white hover:bg-neutral-50 text-ink transition-colors cursor-pointer"
                    >
                      {t("cleaner.bar_btn_prev_error")}
                    </button>
                    <button
                      type="button"
                      onClick={handleNextError}
                      title={t("cleaner.tooltip_btn_next_error")}
                      aria-label={t("cleaner.tooltip_btn_next_error")}
                      className="px-2.5 py-1 text-xs font-medium border border-border rounded-md bg-white hover:bg-neutral-50 text-ink transition-colors cursor-pointer"
                    >
                      {t("cleaner.bar_btn_next_error")}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                  {issues.has_issues ? (
                    <>
                      <button
                        id="clean-mode-auto-btn"
                        onClick={() => handleModeSelect("auto")}
                        title={t("cleaner.tooltip_btn_auto_clean")}
                        aria-label={t("cleaner.tooltip_btn_auto_clean")}
                        className={`${BTN.primary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2`}
                      >
                        <Zap className="w-4 h-4" /> {t("cleaner.btn_auto_clean")}
                      </button>
                      <button
                        id="clean-mode-manual-btn"
                        onClick={() => handleModeSelect("manual")}
                        title={t("cleaner.tooltip_btn_manual_clean")}
                        aria-label={t("cleaner.tooltip_btn_manual_clean")}
                        className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2`}
                      >
                        <PenTool className="w-4 h-4" /> {t("cleaner.btn_manual_clean")}
                      </button>
                      <button
                        id="clean-mode-skip-btn"
                        onClick={handleSkipCleaning}
                        title={t("cleaner.tooltip_btn_skip_cleaning")}
                        aria-label={t("cleaner.tooltip_btn_skip_cleaning")}
                        className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2 text-muted`}
                      >
                        {t("cleaner.btn_skip_cleaning")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        id="clean-mode-skip-btn-primary"
                        onClick={handleSkipCleaning}
                        title={t("cleaner.tooltip_btn_skip_cleaning")}
                        aria-label={t("cleaner.tooltip_btn_skip_cleaning")}
                        className={`${BTN.primary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2`}
                      >
                        <CheckCircle className="w-4 h-4" /> {t("cleaner.btn_skip_cleaning_clean")}
                      </button>
                      <button
                        id="clean-mode-auto-btn"
                        onClick={() => handleModeSelect("auto")}
                        title={t("cleaner.tooltip_btn_auto_clean")}
                        aria-label={t("cleaner.tooltip_btn_auto_clean")}
                        className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2`}
                      >
                        <Zap className="w-4 h-4" /> {t("cleaner.btn_auto_clean")}
                      </button>
                      <button
                        id="clean-mode-manual-btn"
                        onClick={() => handleModeSelect("manual")}
                        title={t("cleaner.tooltip_btn_manual_clean")}
                        aria-label={t("cleaner.tooltip_btn_manual_clean")}
                        className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-2`}
                      >
                        <PenTool className="w-4 h-4" /> {t("cleaner.btn_manual_clean")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* 2. reviewing_diff bar */}
            {step === "reviewing_diff" && diffReport && (
              <>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-forest flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    {t("cleaner.bar_fixed_summary", {
                      count: autoCleanChangedCells.length || (
                        Object.values(diffReport.missing_filled || {}).reduce((a, b) => a + b, 0) +
                        Object.keys(diffReport.types_converted || {}).length +
                        Object.values(diffReport.encoding_fixed || {}).reduce((a, b) => a + b, 0)
                      )
                    })}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                  <button
                    id="cleaner-back-to-mode-btn"
                    onClick={() => setStep("previewing_issues")}
                    className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    <ArrowLeft className="w-4 h-4" /> {t("cleaner.nav.back_to_original")}
                  </button>
                  <button
                    onClick={() => setStep("manual_workspace")}
                    className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    <Wand2 className="w-4 h-4" /> {t("cleaner.btn_manual_clean_more")}
                  </button>
                  <button
                    id="cleaner-confirm-btn"
                    onClick={() => handleConfirmClean()}
                    disabled={confirming}
                    className={`${BTN.primary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    {confirming ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        {t("cleaner.loading_saving")}
                      </>
                    ) : (
                      <>
                        {t("cleaner.btn_confirm_use_this")} <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* 3. confirmed bar */}
            {step === "confirmed" && confirmedResult && (
              <>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-forest flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    {isSkip ? t("cleaner.skip_banner_title") : t("cleaner.confirmed_banner_title")}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                  <button
                    id="cleaner-go-home-btn"
                    onClick={() => navigate("/dashboard/profiler")}
                    className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    <ArrowLeft className="w-4 h-4" /> {t("cleaner.btn_go_home")}
                  </button>
                  <button
                    onClick={() => {
                      manualWorkspaceDirtyRef.current = false;
                      setIsSkip(false);
                      setStep("previewing_issues");
                      setConfirmedResult(null);
                    }}
                    className={`${BTN.secondary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    <ArrowLeft className="w-4 h-4" /> {t("cleaner.btn_back_to_edit")}
                  </button>
                  <button
                    id="cleaner-go-module3-btn"
                    onClick={() => {
                      updateFileSession({
                        sessionId: confirmedResult.session_id,
                        capabilities: confirmedResult.validation?.capabilities || null,
                        warnings: confirmedResult.validation?.warnings || []
                      });
                      if (pipelineMode && onComplete) onComplete();
                      else navigate("/dashboard/visualize");
                    }}
                    className={`${BTN.primary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    {t("cleaner.btn_visualize")} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
