import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, ChevronRight, PlayCircle, ArrowLeft, MousePointerClick, ChevronDown, Edit2, AlignLeft, Save, X, AlertTriangle, Check, EyeOff, ChevronLeft, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TEXT, BTN, CARD } from "../../constants/ui";
import { manualCleanPreview, locateRow } from "../../services/cleanerService";
import { useToast } from "../../contexts/ToastContext";
import { getColumnWidth, getOrderedErrorCells, getNextError, getPrevError, scrollToCell, highlightExcelCell } from "./tableUtils";
import { colLetter, cellAddress, cellAddressWords } from "../../utils/cellAddress";
import { GoToCellInput } from "./GoToCellInput";
import { WindowBar } from "./WindowBar";
import ErrorListPanel, { ErrorChipsRow } from "./ErrorListPanel";
import { getCurrentLang } from "../../i18n";

// Từ điển ánh xạ sang Tiếng Việt
const ACTION_LABELS = {
  DROP_COLUMN: "Xóa cột",
  DROP_DUPLICATES: "Xóa dòng trùng lặp",
  STRIP_BAD_CHARS: "Xóa ký tự lỗi (Encoding)",
  CONVERT_TO_NUMERIC: "Ép kiểu sang Số",
  CONVERT_TO_DATETIME: "Ép kiểu sang Ngày giờ",
  FILL_MISSING_MEDIAN: "Điền rỗng: Trung vị (Median)",
  FILL_MISSING_MEAN: "Điền rỗng: Trung bình (Mean)",
  FILL_MISSING_MODE: "Điền rỗng: Xuất hiện nhiều nhất (Mode)",
  FILL_MISSING_UNKNOWN: "Điền rỗng: 'Không xác định'",
  FILL_MISSING_CUSTOM_VALUE: "Điền rỗng: Tùy chỉnh",
  RENAME_COLUMN: "Đổi tên cột",
  BATCH_EDIT_CELLS: "Sửa ô thủ công"
};

export default function ManualCleanWorkspace({
  columns,
  fileHash,
  onConfirm,
  onBack,
  initialPreviewData = null,
  initialErrorCells = null,
  onDirtyChange = null,
  columnLetters = {},
  initialColumnIssueCounts = {},
}) {
  const { t } = useTranslation();
  const currentLang = getCurrentLang();
  const [colLetters, setColLetters] = useState(columnLetters || {});
  const [columnIssueCounts, setColumnIssueCounts] = useState(initialColumnIssueCounts || {});
  const [isErrorPanelOpen, setIsErrorPanelOpen] = useState(false);
  const [activeErrorGroupKey, setActiveErrorGroupKey] = useState(null);
  const [actions, setActions] = useState([]);
  const [previewData, setPreviewData] = useState(initialPreviewData || []);
  const [errorCells, setErrorCells] = useState(initialErrorCells || []); // Array of ErrorCell from backend preview
  const [changedCells, setChangedCells] = useState([]);
  const [removedRows, setRemovedRows] = useState([]);
  const [changedTruncated, setChangedTruncated] = useState(false);

  // Row Windowing State
  const [windowInfo, setWindowInfo] = useState(null);
  const [windowOffset, setWindowOffset] = useState(0);
  const [windowMode, setWindowMode] = useState("all");
  const [isLoadingWindow, setIsLoadingWindow] = useState(false);
  const activeRequestIdRef = useRef(0);

  // Rule 4: Keep the cell highlighted by state, using the ORIGINAL error_cells list (do not drop once fixed)
  const originalErrorCellsRef = useRef(initialErrorCells || []);
  const [pendingCellEdits, setPendingCellEdits] = useState([]); // Array of {row_id, column, new_value}
  const pendingEditsRef = useRef([]);
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // cellReviewStates: { [ "row_id:col" ]: "fixed" | "ignored" } (default for any error cell is "pending")
  const [cellReviewStates, setCellReviewStates] = useState({});

  const debounceTimer = useRef(null);
  const { showToast } = useToast();

  // Reset all state when fileHash changes
  useEffect(() => {
    setActions([]);
    setPendingCellEdits([]);
    pendingEditsRef.current = [];
    setCellReviewStates({});
    originalErrorCellsRef.current = initialErrorCells || [];
    setPreviewData(initialPreviewData || []);
    setErrorCells(initialErrorCells || []);
    setWindowOffset(0);
    setWindowMode("all");
    setWindowInfo(null);
  }, [fileHash, initialErrorCells, initialPreviewData]);

  // Keep originalErrorCellsRef populated if initialErrorCells is passed later
  useEffect(() => {
    if (initialErrorCells && initialErrorCells.length > 0 && originalErrorCellsRef.current.length === 0) {
      originalErrorCellsRef.current = initialErrorCells;
    }
  }, [initialErrorCells]);

  // Notify parent about dirty state
  useEffect(() => {
    const isDirty = pendingCellEdits.length > 0 || actions.length > 0;
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [pendingCellEdits, actions, onDirtyChange]);

  // Load ban đầu
  useEffect(() => {
    if (!initialPreviewData || initialPreviewData.length === 0) {
      handlePreview([], 0, "all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmount: clear timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handlePreview = async (currentActions = actions, offset = windowOffset, mode = windowMode) => {
    setIsPreviewing(true);
    setIsLoadingWindow(true);
    const reqId = ++activeRequestIdRef.current;
    try {
      const res = await manualCleanPreview(fileHash, currentActions, offset, mode);
      if (reqId !== activeRequestIdRef.current) return false;

      setPreviewData(res.data.preview_data || []);
      if (res.data.column_letters) {
        setColLetters(res.data.column_letters);
      }
      if (res.data.column_issue_counts) {
        setColumnIssueCounts(res.data.column_issue_counts);
      }
      setErrorCells(res.data.error_cells || []);
      setChangedCells(res.data.changed_cells || []);
      setRemovedRows(res.data.removed_rows || []);
      setChangedTruncated(Boolean(res.data.changed_truncated));
      if (res.data.window) {
        setWindowInfo(res.data.window);
        setWindowOffset(res.data.window.offset);
        setWindowMode(res.data.window.mode);
      }
      return true;
    } catch (err) {
      if (reqId === activeRequestIdRef.current) {
        const detail = err?.response?.data?.detail;
        showToast(typeof detail === "string" ? detail : t("cleaner.workspace.empty_data"), "error");
      }
      return false;
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setIsPreviewing(false);
        setIsLoadingWindow(false);
      }
    }
  };

  const handleSavePendingEdits = async () => {
    if (pendingCellEdits.length === 0) return true;

    const newAction = {
      action_type: "BATCH_EDIT_CELLS",
      column: "all",
      params: { edits: [...pendingCellEdits] }
    };

    const newActions = [...actions, newAction];

    const success = await handlePreview(newActions, windowOffset, windowMode);
    if (success) {
      setActions(newActions);
      setPendingCellEdits([]); // Clear pending state only on success
      pendingEditsRef.current = [];
      showToast(t("cleaner.workspace.toast_changes_saved"), "success");
      return true;
    } else {
      // Failed to sync (e.g. 400 error). Do not clear pendingCellEdits.
      return false;
    }
  };

  const handleWindowSwitch = async (newOffset, newMode) => {
    if (pendingCellEdits.length > 0) {
      const saved = await handleSavePendingEdits();
      if (!saved) return;
    }
    handlePreview(actions, newOffset, newMode);
  };

  const handlePrevWindow = () => {
    const curOffset = windowInfo?.offset ?? windowOffset;
    const newOffset = Math.max(0, curOffset - 150);
    handleWindowSwitch(newOffset, windowMode);
  };

  const handleNextWindow = () => {
    const curOffset = windowInfo?.offset ?? windowOffset;
    const newOffset = curOffset + 150;
    handleWindowSwitch(newOffset, windowMode);
  };

  const handleToggleErrorsOnly = () => {
    const nextMode = windowMode === "errors" ? "all" : "errors";
    setWindowMode(nextMode);
    handleWindowSwitch(0, nextMode);
  };

  const handleLocateAndGo = async ({ excelRow, letter, matchedCol }) => {
    try {
      const res = await locateRow({
        file_hash: fileHash,
        excel_row: excelRow,
        mode: windowMode,
        clean_mode: "manual",
        actions,
      });
      const data = res.data;
      if (data.status === "removed") {
        showToast(
          t("cleaner.goto_row_removed", {
            row: excelRow,
            reason: "trùng lặp",
            defaultValue: `Dòng ${excelRow} đã bị xóa (trùng lặp).`,
          }),
          "warning"
        );
        return;
      }
      if (data.status === "not_found") {
        showToast(
          t("cleaner.goto_cell_not_found", {
            addr: `${letter}${excelRow}`,
            defaultValue: `Không tìm thấy ô ${letter}${excelRow}`,
          }),
          "warning"
        );
        return;
      }
      if (data.status === "not_in_errors") {
        showToast(
          t("cleaner.goto_not_in_errors", {
            row: excelRow,
            defaultValue: `Dòng ${excelRow} không có lỗi.`,
          }),
          "info"
        );
        return;
      }
      if (data.status === "found" && data.offset !== null) {
        if (pendingCellEdits.length > 0) {
          const saved = await handleSavePendingEdits();
          if (!saved) return;
        }
        await handlePreview(actions, data.offset, windowMode);
        setTimeout(() => {
          if (tableContainerRef?.current) {
            highlightExcelCell(tableContainerRef.current, {
              addr: `${letter}${excelRow}`,
              letter,
              excelRow,
              colName: matchedCol,
            });
          }
        }, 120);
      }
    } catch (_) {
      showToast(t("cleaner.goto_locate_error", { defaultValue: "Không thể định vị dòng trong file." }), "error");
    }
  };

  const handleAddPendingEdit = (edit) => {
    setPendingCellEdits(prev => {
      const existingIdx = prev.findIndex(e => e.row_id === edit.row_id && e.column === edit.column);
      const newEdits = [...prev];
      if (existingIdx >= 0) {
        newEdits[existingIdx].new_value = edit.new_value;
      } else {
        newEdits.push(edit);
      }
      pendingEditsRef.current = newEdits;
      return newEdits;
    });

    // Mark cell as fixed in review state
    const cellKey = `${edit.row_id}:${edit.column}`;
    setCellReviewStates(prev => ({ ...prev, [cellKey]: "fixed" }));
  };

  const handleSetCellIgnored = (rowId, col) => {
    const cellKey = `${rowId}:${col}`;
    setCellReviewStates(prev => ({
      ...prev,
      [cellKey]: prev[cellKey] === "ignored" ? "pending" : "ignored"
    }));
  };

  const executeAction = async (newAction) => {
    if (pendingCellEdits.length > 0) {
      const confirmed = window.confirm(t("cleaner.workspace.unsaved_confirm_action"));
      if (!confirmed) return;
      setPendingCellEdits([]); // Bỏ qua thay đổi cũ
      pendingEditsRef.current = [];
    }

    const newActions = [...actions, newAction];
    const success = await handlePreview(newActions);
    if (success) {
      setActions(newActions);
    }
  };

  const handleRemoveAction = async (index) => {
    if (pendingCellEdits.length > 0) {
      const confirmed = window.confirm(t("cleaner.workspace.unsaved_confirm_action"));
      if (!confirmed) return;
      setPendingCellEdits([]); // Bỏ qua thay đổi cũ
      pendingEditsRef.current = [];
    }

    const newActions = [...actions];
    newActions.splice(index, 1);
    const success = await handlePreview(newActions);
    if (success) {
      setActions(newActions);
    }
  };

  // Rule 4: Error cells review progress calculation using original error cells
  const originalErrorList = originalErrorCellsRef.current && originalErrorCellsRef.current.length > 0
    ? originalErrorCellsRef.current
    : errorCells;

  const totalErrorCells = originalErrorList.length;
  const reviewedCount = originalErrorList.filter(ec => {
    const key = `${ec.row_id}:${ec.column}`;
    const state = cellReviewStates[key];
    return state === "fixed" || state === "ignored";
  }).length;
  const pendingCount = Math.max(0, totalErrorCells - reviewedCount);
  const ignoredCount = originalErrorList.filter(ec => cellReviewStates[`${ec.row_id}:${ec.column}`] === "ignored").length;

  const [filterOnlyErrorCols, setFilterOnlyErrorCols] = useState(false);
  const [filterOnlyErrorRows, setFilterOnlyErrorRows] = useState(false);
  const [currentNavError, setCurrentNavError] = useState(null);
  const tableContainerRef = useRef(null);

  const orderedErrors = useMemo(() => {
    return getOrderedErrorCells(originalErrorList, previewData, columns);
  }, [originalErrorList, previewData, columns]);

  const currentNavErrorIndex = useMemo(() => {
    if (!currentNavError || orderedErrors.length === 0) return -1;
    return orderedErrors.findIndex(e => e.row_id === currentNavError.row_id && e.column === currentNavError.column);
  }, [currentNavError, orderedErrors]);

  const currentNavAddress = useMemo(() => {
    if (!currentNavError) return "";
    const letter = colLetters[currentNavError.column] || colLetter(columns.indexOf(currentNavError.column));
    const excelRow = (currentNavError.row_id ?? 0) + 2;
    return cellAddress(letter, excelRow);
  }, [currentNavError, colLetters, columns]);

  const handlePrevError = () => {
    const ordered = getOrderedErrorCells(originalErrorList, previewData, columns);
    if (ordered.length === 0) return;
    const prev = getPrevError(ordered, currentNavError);
    if (prev) {
      setCurrentNavError(prev);
      scrollToCell(tableContainerRef.current, prev.column, prev.row_id);
    }
  };

  const handleNextError = () => {
    const ordered = getOrderedErrorCells(originalErrorList, previewData, columns);
    if (ordered.length === 0) return;
    const next = getNextError(ordered, currentNavError);
    if (next) {
      setCurrentNavError(next);
      scrollToCell(tableContainerRef.current, next.column, next.row_id);
    }
  };

  const handleFinalConfirm = () => {
    if (pendingCount > 0) {
      const proceed = window.confirm(t("cleaner.guided.warn_pending_cells", { count: pendingCount }));
      if (!proceed) return;
    }

    setTimeout(() => {
      const currentPending = pendingEditsRef.current;
      let finalActions = [...actions];
      if (currentPending.length > 0) {
        finalActions.push({
          action_type: "BATCH_EDIT_CELLS",
          column: "all",
          params: { edits: [...currentPending] }
        });
      }
      onConfirm(finalActions);
    }, 50);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-36 sm:pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-4">
          <label
            className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer select-none"
            title={t("cleaner.tooltip_full_edit_mode")}
          >
            <input
              type="checkbox"
              checked={isFullEditMode}
              onChange={(e) => setIsFullEditMode(e.target.checked)}
              className="rounded border-border text-forest focus:ring-forest/30"
            />
            {t("cleaner.workspace.full_edit_mode")}
            <HelpCircle className="w-3.5 h-3.5 text-muted hover:text-ink transition-colors" />
          </label>

          <label
            className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none"
            title={t("cleaner.tooltip_filter_error_cols")}
          >
            <input
              type="checkbox"
              checked={filterOnlyErrorCols}
              onChange={(e) => setFilterOnlyErrorCols(e.target.checked)}
              className="rounded border-border text-forest focus:ring-forest/30"
            />
            {t("cleaner.filter_only_error_cols")}
            <HelpCircle className="w-3.5 h-3.5 text-muted hover:text-ink transition-colors" />
          </label>

          <label
            className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none"
            title={t("cleaner.tooltip_filter_error_rows")}
          >
            <input
              type="checkbox"
              checked={filterOnlyErrorRows}
              onChange={(e) => setFilterOnlyErrorRows(e.target.checked)}
              className="rounded border-border text-forest focus:ring-forest/30"
            />
            {t("cleaner.filter_only_error_rows")}
            <HelpCircle className="w-3.5 h-3.5 text-muted hover:text-ink transition-colors" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {totalErrorCells > 0 && (
            <div className="flex items-center gap-2 bg-white border border-border px-3 py-1.5 rounded-lg text-xs">
              <span className="font-medium text-ink">
                {t("cleaner.guided.reviewed_progress", { reviewed: reviewedCount, total: totalErrorCells })}
              </span>
              {ignoredCount > 0 && (
                <span className="text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                  {t("cleaner.guided.ignored_count", { count: ignoredCount })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Chips Row & Error List Panel (Inline expand directly below chips row) */}
      <div className="mb-2">
        <ErrorChipsRow
          columnIssueCounts={columnIssueCounts}
          columnLetters={colLetters}
          isPanelOpen={isErrorPanelOpen}
          onTogglePanel={() => setIsErrorPanelOpen((prev) => !prev)}
          onSelectGroup={(g) => {
            setIsErrorPanelOpen(true);
            setActiveErrorGroupKey(g.key);
          }}
        />

        <ErrorListPanel
          isOpen={isErrorPanelOpen}
          onClose={() => setIsErrorPanelOpen(false)}
          fileHash={fileHash}
          actions={actions}
          overriddenTypes={{}}
          columnIssueCounts={columnIssueCounts}
          columnLetters={colLetters}
          cellReviewStates={cellReviewStates}
          pendingCellEdits={pendingCellEdits}
          onLocateCell={handleLocateAndGo}
          activeGroupKey={activeErrorGroupKey}
          onActiveGroupKeyChange={setActiveErrorGroupKey}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Phần Trái: Bảng (chiếm 3/4) */}
        <div className="xl:col-span-3">
          <PreviewTable
            data={previewData}
            actions={actions}
            originalColumns={columns}
            colLetters={colLetters}
            isLoading={isPreviewing}
            pendingCellEdits={pendingCellEdits}
            errorCells={errorCells}
            originalErrorCells={originalErrorList}
            changedCells={changedCells}
            cellReviewStates={cellReviewStates}
            onSetCellIgnored={handleSetCellIgnored}
            isFullEditMode={isFullEditMode}
            filterOnlyErrorCols={filterOnlyErrorCols}
            filterOnlyErrorRows={filterOnlyErrorRows}
            containerRef={tableContainerRef}
            onAddPendingEdit={handleAddPendingEdit}
            onExecuteAction={executeAction}
            onFlushPendingEdits={async () => {
              if (window.confirm(t("cleaner.workspace.unsaved_confirm_action"))) {
                setPendingCellEdits([]);
                pendingEditsRef.current = [];
                return true;
              }
              return false;
            }}
            windowInfo={windowInfo}
            isLoadingWindow={isLoadingWindow}
            onPrevWindow={handlePrevWindow}
            onNextWindow={handleNextWindow}
            onToggleErrorsOnly={handleToggleErrorsOnly}
            onLocateRow={handleLocateAndGo}
          />
        </div>

        {/* Phần Phải: Nhật ký (chiếm 1/4) */}
        <div className="xl:col-span-1">
          <div className={CARD + " h-full max-h-[600px] flex flex-col sticky top-4"}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className={`${TEXT.sectionTitle} flex items-center gap-2 mb-0`}>
                <CheckCircle2 className="w-5 h-5 text-forest" /> {t("cleaner.workspace.action_log_title")}
              </h3>
              <div className="flex items-center gap-1.5">
                {ignoredCount > 0 && (
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full" title={t("cleaner.guided.ignored")}>
                    {t("cleaner.guided.ignored")}: {ignoredCount}
                  </span>
                )}
                <span className="text-xs font-medium bg-sage/30 text-forest px-2 py-0.5 rounded-full">
                  {actions.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted py-10 opacity-60">
                  <PlayCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm text-center" dangerouslySetInnerHTML={{ __html: t("cleaner.workspace.no_actions") }} />
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {actions.map((act, idx) => (
                    <div key={idx} className="relative flex items-center justify-between group animate-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center gap-3 bg-white border border-border p-3 rounded-lg w-full hover:border-forest/50 transition-colors shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-forest text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm z-10">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {t(`cleaner.workspace.actions.${act.action_type}`, { defaultValue: ACTION_LABELS[act.action_type] || act.action_type })}
                          </p>
                          <p className="text-xs text-muted truncate mt-0.5">
                            {t("cleaner.workspace.col_label")} <span className="font-mono bg-sage/30 px-1 rounded text-ink">{act.column}</span>
                            {act.params?.new_name && ` ➔ ${act.params.new_name}`}
                            {act.params?.value !== undefined && ` ➔ "${act.params.value}"`}
                            {act.params?.edits && ` ➔ ${t("cleaner.workspace.cells_count", { count: act.params.edits.length })}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveAction(idx)}
                          className="p-1.5 text-muted hover:text-[#9F2F2D] hover:bg-[#FDEBEC] rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title={t("cleaner.workspace.undo_title")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <div className="mt-4 pt-4 border-t border-border">
              <AdvancedActionForm columns={columns} onExecuteAction={executeAction} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar for Manual Workspace */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E5E3] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-xs font-semibold text-ink">
              {t("cleaner.guided.reviewed_progress", { reviewed: reviewedCount, total: totalErrorCells })}
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
              {currentNavErrorIndex >= 0 && currentNavAddress && (
                <span className="text-xs font-mono font-medium text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 ml-1 select-none">
                  {t("cleaner.err_nav_address", {
                    current: currentNavErrorIndex + 1,
                    total: orderedErrors.length,
                    addr: currentNavAddress,
                    defaultValue: `Lỗi ${currentNavErrorIndex + 1}/${orderedErrors.length} · ${currentNavAddress}`
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              onClick={handleSavePendingEdits}
              disabled={pendingCellEdits.length === 0 || isPreviewing}
              title={t("cleaner.tooltip_btn_save_pending")}
              aria-label={t("cleaner.tooltip_btn_save_pending")}
              className={`${pendingCellEdits.length > 0 ? BTN.secondary : "rounded-md px-4 py-2 text-xs font-medium bg-[#EAEAEA] text-[#626C65] cursor-not-allowed"} w-full sm:w-auto flex items-center justify-center gap-1.5`}
            >
              <Save className="w-4 h-4" />
              {t("cleaner.bar_btn_save_pending", { count: pendingCellEdits.length })}
            </button>
            <button
              onClick={handleFinalConfirm}
              title={t("cleaner.tooltip_btn_finalize")}
              aria-label={t("cleaner.tooltip_btn_finalize")}
              className={`${BTN.primary} w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5`}
            >
              {t("cleaner.bar_btn_finalize")} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Thêm Action Cũ (Thu gọn) ───────────────────────────────────────────
function AdvancedActionForm({ columns, onExecuteAction }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [customValue, setCustomValue] = useState("");

  const needsParam = selectedAction === "FILL_MISSING_CUSTOM_VALUE" || selectedAction === "RENAME_COLUMN";
  const isAddDisabled = !selectedAction || (selectedAction !== "DROP_DUPLICATES" && !selectedColumn) || (needsParam && !customValue);

  const handleAddAction = () => {
    if (isAddDisabled) return;
    const newAction = {
      action_type: selectedAction,
      column: selectedAction === "DROP_DUPLICATES" ? "all" : selectedColumn,
      params: {}
    };
    if (selectedAction === "FILL_MISSING_CUSTOM_VALUE") newAction.params.value = customValue;
    else if (selectedAction === "RENAME_COLUMN") newAction.params.new_name = customValue;

    onExecuteAction(newAction);
    setCustomValue("");
    if (selectedAction === "DROP_DUPLICATES") setSelectedAction("");
  };

  return (
    <div className="bg-[#FBFBFA] border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-ink hover:bg-sage/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-forest" /> {t("cleaner.workspace.advanced_options")}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-3 pt-0 space-y-3 border-t border-border mt-2 bg-white">
          <div className="mt-2">
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">{t("cleaner.workspace.target_col")}</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full text-sm border border-border rounded p-1.5 focus:outline-none focus:border-forest"
              disabled={selectedAction === "DROP_DUPLICATES"}
            >
              <option value="">{t("cleaner.workspace.select_col")}</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">{t("cleaner.workspace.operation")}</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full text-sm border border-border rounded p-1.5 focus:outline-none focus:border-forest"
            >
              <option value="">{t("cleaner.workspace.select_op")}</option>
              {Object.entries(ACTION_LABELS).filter(([k]) => k !== "BATCH_EDIT_CELLS").map(([key, label]) => (
                <option key={key} value={key}>
                  {t(`cleaner.workspace.actions.${key}`, { defaultValue: label })}
                </option>
              ))}
            </select>
          </div>
          {needsParam && (
            <div>
              <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">
                {selectedAction === "RENAME_COLUMN" ? t("cleaner.workspace.new_col_name") : t("cleaner.workspace.fill_value")}
              </label>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-full text-sm border border-border rounded p-1.5 focus:outline-none focus:border-forest"
              />
            </div>
          )}
          <button
            onClick={handleAddAction}
            disabled={isAddDisabled}
            className={`w-full ${BTN.secondary} text-xs py-1.5 flex justify-center`}
          >
            {t("cleaner.workspace.add_action")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: PreviewTable ──────────────────────────────────────────────

function PreviewTable({
  data,
  actions,
  originalColumns,
  isLoading,
  pendingCellEdits,
  errorCells,
  originalErrorCells,
  changedCells = [],
  cellReviewStates,
  onSetCellIgnored,
  isFullEditMode,
  filterOnlyErrorCols = false,
  filterOnlyErrorRows = false,
  containerRef,
  onAddPendingEdit,
  onExecuteAction,
  onFlushPendingEdits,
  colLetters = {},
  windowInfo = null,
  isLoadingWindow = false,
  onPrevWindow,
  onNextWindow,
  onToggleErrorsOnly,
  onLocateRow,
}) {
  const { t } = useTranslation();
  const currentLang = getCurrentLang();
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, col, isDirectEdit: boolean }
  const [editValue, setEditValue] = useState("");
  const [activeErrorPanel, setActiveErrorPanel] = useState(null); // { rowIdx, col, errorCell, currentValue }
  const [openHeaderMenu, setOpenHeaderMenu] = useState(null); // column name
  const [renamingCol, setRenamingCol] = useState(null); // column name
  const [renameValue, setRenameValue] = useState("");

  if (!data || data.length === 0) return (
    <div className={CARD + " h-full flex items-center justify-center min-h-[400px] relative"}>
      {isLoading ? (
        <div className="flex flex-col items-center text-muted animate-pulse">
          <div className="w-8 h-8 rounded-full border-2 border-forest border-t-transparent animate-spin mb-3" />
          <p className="text-sm">{t("cleaner.workspace.loading_data")}</p>
        </div>
      ) : (
        <p className="text-muted text-sm">{t("cleaner.workspace.empty_data")}</p>
      )}
    </div>
  );

  const currentData = data;

  // Changed cells map: `${row_id}:${col}` -> item
  const changedMap = useMemo(() => {
    const map = new Map();
    changedCells.forEach(item => {
      map.set(`${item.row_id}:${item.column}`, item);
    });
    return map;
  }, [changedCells]);

  // Xác định các thay đổi
  const droppedCols = new Set(actions.filter(a => a.action_type === "DROP_COLUMN").map(a => a.column));
  const renamedCols = {};
  actions.filter(a => a.action_type === "RENAME_COLUMN").forEach(a => {
    renamedCols[a.params.new_name] = a.column; // new -> old
  });

  const BATCHED_EDITS = actions
    .filter(a => a.action_type === "BATCH_EDIT_CELLS")
    .flatMap(a => a.params.edits || []);

  const activeCols = Object.keys(data[0] || {}).filter(c => c !== "original_index");
  const allDisplayCols = [...activeCols];
  droppedCols.forEach(col => {
    if (!allDisplayCols.includes(col)) allDisplayCols.push(col);
  });

  const errorList = originalErrorCells && originalErrorCells.length > 0 ? originalErrorCells : errorCells;

  // Filter column & row sets
  const errorColsSet = useMemo(() => {
    const set = new Set();
    errorList.forEach(e => { if (e.column) set.add(e.column); });
    return set;
  }, [errorList]);

  const errorRowIdsSet = useMemo(() => {
    const set = new Set();
    errorList.forEach(e => {
      if (e.row_id !== undefined && e.row_id !== null) set.add(e.row_id);
    });
    return set;
  }, [errorList]);

  const displayCols = useMemo(() => {
    if (!filterOnlyErrorCols) return allDisplayCols;
    const filtered = allDisplayCols.filter(c => errorColsSet.has(c));
    return filtered.length > 0 ? filtered : allDisplayCols;
  }, [allDisplayCols, filterOnlyErrorCols, errorColsSet]);

  const visibleData = useMemo(() => {
    if (!filterOnlyErrorRows) return currentData;
    const filtered = currentData.filter(r => r.original_index !== undefined && errorRowIdsSet.has(r.original_index));
    return filtered.length > 0 ? filtered : currentData;
  }, [currentData, filterOnlyErrorRows, errorRowIdsSet]);

  // Column widths
  const colWidths = useMemo(() => {
    const widths = {};
    displayCols.forEach(col => {
      widths[col] = getColumnWidth(col, data);
    });
    return widths;
  }, [displayCols, data]);

  // Rule 4: Compute cell status using ORIGINAL error_cells list
  const getCellStatus = (rowId, col) => {
    const cellKey = `${rowId}:${col}`;
    const reviewState = cellReviewStates?.[cellKey];

    // Check if user set it to ignored
    if (reviewState === "ignored") {
      return { type: "ignored", reviewState: "ignored" };
    }

    // Check if pending edit in local memory
    const pending = pendingCellEdits.find(e => e.row_id === rowId && e.column === col);

    // Check if confirmed in BATCH_EDIT_CELLS action history
    const confirmed = BATCHED_EDITS.find(e => e.row_id === rowId && e.column === col);

    // Original error cell entry
    const err = errorList.find(e => e.row_id === rowId && e.column === col);

    // Changed cell by backend action (e.g. FILL_MISSING_MEDIAN, etc.)
    const changedByAction = changedMap.get(`${rowId}:${col}`);

    if (pending) {
      return {
        type: "pending_edit",
        value: pending.new_value,
        originalValue: err?.original_value !== undefined ? err.original_value : null,
        reviewState: "fixed"
      };
    }

    if (confirmed || reviewState === "fixed") {
      return {
        type: "fixed",
        value: confirmed ? confirmed.new_value : undefined,
        originalValue: err?.original_value !== undefined ? err.original_value : null,
        reviewState: "fixed"
      };
    }

    if (err) {
      return {
        type: "error",
        issue: err.issue_type,
        errorCell: err,
        originalValue: err.original_value,
        reviewState: reviewState || "pending"
      };
    }

    if (changedByAction) {
      return {
        type: "action_changed",
        changedItem: changedByAction,
        reviewState: "fixed"
      };
    }

    return { type: "normal" };
  };

  const handleCellClick = (idx, col, status, isDropped) => {
    if (isDropped) return;

    const rowId = visibleData[idx].original_index;
    const cellError = errorList.find(e => e.row_id === rowId && e.column === col);

    // In Guided Mode (not full edit mode), if it was an error cell
    if (!isFullEditMode && (cellError || status.reviewState === "fixed" || status.reviewState === "ignored")) {
      const pending = pendingCellEdits.find(e => e.row_id === rowId && e.column === col);
      const val = pending ? pending.new_value : visibleData[idx][col];
      setActiveErrorPanel({
        rowIdx: idx,
        rowId,
        col,
        errorCell: cellError || { issue_type: "manual", original_value: visibleData[idx][col] },
        currentValue: val
      });
      return;
    }

    // Full edit mode or non-error cells in full edit mode: allow inline editing
    const canEdit = isFullEditMode || status.type === "error" || status.type === "fixed" || status.type === "pending_edit" || status.type === "action_changed";
    if (!canEdit) return;

    setEditingCell({ rowIdx: idx, col, isDirectEdit: true });

    const pending = pendingCellEdits.find(e => e.row_id === rowId && e.column === col);
    setEditValue(pending ? pending.new_value : (visibleData[idx][col] === null ? "" : visibleData[idx][col]));
  };

  // Rule 3: Null editing: empty input = real null, send JSON null, not string "null"
  const handleCellSave = (directVal = undefined, targetRowIdx = null, targetCol = null) => {
    const rIdx = targetRowIdx !== null ? targetRowIdx : editingCell?.rowIdx;
    const cCol = targetCol !== null ? targetCol : editingCell?.col;
    if (rIdx === null || rIdx === undefined || !cCol) return;

    const rowId = visibleData[rIdx].original_index;
    const originalVal = visibleData[rIdx][cCol];

    let valToSave;
    if (directVal !== undefined) {
      valToSave = directVal; // Can explicitly be null or string or number
    } else {
      if (editValue.trim() === "") {
        valToSave = null;
      } else {
        valToSave = editValue;
      }
    }

    const isValChanged = valToSave !== originalVal;

    if (rowId !== undefined && isValChanged) {
      onAddPendingEdit({ row_id: rowId, column: cCol, new_value: valToSave });
    }
    setEditingCell(null);
  };

  // Header Actions
  const handleHeaderAction = (col, actionType, params = {}) => {
    setOpenHeaderMenu(null);
    onExecuteAction({
      action_type: actionType,
      column: col,
      params
    });
  };

  const handleRenameSubmit = (col) => {
    if (renameValue.trim() !== "" && renameValue !== col) {
      handleHeaderAction(col, "RENAME_COLUMN", { new_name: renameValue });
    }
    setRenamingCol(null);
  };

  return (
    <div className={CARD + " h-full flex flex-col relative"}>
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-[1px] rounded-2xl">
          <div className="bg-white p-3 rounded-lg shadow-lg flex items-center gap-3 border border-border">
            <div className="w-5 h-5 rounded-full border-2 border-forest border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-ink">{t("cleaner.workspace.loading_data")}</span>
          </div>
        </div>
      )}

      {/* Header and Legend above table */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`${TEXT.sectionTitle} flex items-center gap-2 mb-0`}>
            {t("cleaner.preview_table_title")}
            <span className="text-xs font-normal text-muted bg-gray-100 px-2 py-0.5 rounded-full">
              {isFullEditMode ? t("cleaner.workspace.full_edit_badge") : t("cleaner.workspace.guided_badge")}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <GoToCellInput
            columnLetters={colLetters}
            allColumns={originalColumns}
            visibleColumns={displayCols}
            rows={visibleData}
            containerRef={containerRef}
            previewRowsLimit={150}
            onLocateRow={onLocateRow}
          />
          {pendingCellEdits.length > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full animate-pulse">
              {t("cleaner.workspace.syncing_badge", { count: pendingCellEdits.length })}
            </span>
          )}
        </div>
      </div>

      {/* Row Window Pagination Bar */}
      <div className="mb-2">
        <WindowBar
          window={windowInfo}
          isLoading={isLoadingWindow}
          onPrev={onPrevWindow}
          onNext={onNextWindow}
          onToggleErrorsOnly={onToggleErrorsOnly}
          totalRows={windowInfo?.total_rows ?? visibleData.length}
          totalErrorRows={windowInfo?.total_error_rows ?? 0}
        />
      </div>

      {/* Rule 4: Small Legend above table with the states */}
      <div className="flex flex-wrap items-center gap-4 py-2 px-3 mb-2 bg-[#F9F9F8] border border-border rounded-lg text-xs text-ink">
        <span className="font-semibold text-muted uppercase tracking-wider text-[10px]">
          {t("cleaner.guided.legend_title")}
        </span>
        <div
          className="flex items-center gap-1.5 cursor-help"
          title={t("cleaner.tooltip_legend_pending")}
        >
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
          <span>{t("cleaner.guided.legend_pending")}</span>
          <HelpCircle className="w-3 h-3 text-muted" />
        </div>
        <div
          className="flex items-center gap-1.5 cursor-help"
          title={t("cleaner.tooltip_legend_fixed")}
        >
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-flex items-center justify-center text-[9px] text-emerald-800 font-bold">✓</span>
          <span>{t("cleaner.guided.legend_fixed")}</span>
          <HelpCircle className="w-3 h-3 text-muted" />
        </div>
        <div
          className="flex items-center gap-1.5 cursor-help"
          title={t("cleaner.tooltip_legend_action_changed")}
        >
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" />
          <span className="text-emerald-900 font-medium">{t("cleaner.legend_action_changed")}</span>
          <HelpCircle className="w-3 h-3 text-muted" />
        </div>
        <div
          className="flex items-center gap-1.5 cursor-help"
          title={t("cleaner.tooltip_legend_ignored")}
        >
          <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300 inline-block" />
          <span className="text-gray-500 line-through">{t("cleaner.guided.legend_ignored")}</span>
          <HelpCircle className="w-3 h-3 text-muted" />
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto border border-border rounded-lg bg-white min-h-[400px] max-h-[600px] overflow-y-auto relative flex-1"
      >
        <table className="w-full text-left text-sm table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            {displayCols.map(col => (
              <col key={col} style={{ width: `${colWidths[col] || 120}px` }} />
            ))}
          </colgroup>
          <thead className="bg-[#F9F9F8] border-b border-border sticky top-0 z-20 shadow-xs">
            {/* Row of column letters */}
            <tr className="border-b border-border/60 text-[11px] font-mono text-muted bg-[#F4F4F2]">
              <th className="px-2.5 py-1 text-center w-12 sticky left-0 z-30 bg-[#F4F4F2] border-r border-border font-semibold select-none">
                {/* corner */}
              </th>
              {displayCols.map(col => {
                const letter = colLetters[col] || colLetter(originalColumns.indexOf(col));
                return (
                  <th
                    key={`letter-${col}`}
                    data-col-letter={letter}
                    className="px-2.5 py-1 text-center font-mono font-semibold text-muted/80 tracking-wider select-none border-r border-border/30 last:border-r-0"
                    title={t("cleaner.col_letter_tooltip", { letter, defaultValue: `Cột ${letter} trong file gốc` })}
                  >
                    {letter}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="px-2.5 py-2.5 font-semibold text-ink w-12 text-center sticky left-0 z-30 bg-[#F9F9F8] border-r border-border select-none">
                {t("cleaner.row_header", { defaultValue: "Dòng" })}
              </th>
              {displayCols.map(col => {
                const isDropped = droppedCols.has(col);
                const isRenamed = renamedCols[col];

                return (
                  <th
                    key={col}
                    id={`th-col-${col}`}
                    className={`px-2.5 py-2.5 font-semibold bg-[#F9F9F8] text-left align-top transition-all ${isDropped ? "text-gray-400" : "text-ink"}`}
                    title={col}
                  >
                    <div className="flex items-start justify-between group/header gap-1">
                      {renamingCol === col ? (
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(col)}
                          onKeyDown={e => { if (e.key === "Enter") handleRenameSubmit(col); if (e.key === "Escape") setRenamingCol(null); }}
                          className="w-full border border-forest rounded px-1 py-0.5 text-xs font-normal text-ink outline-none"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <span className={`line-clamp-2 break-words text-xs leading-snug ${isDropped ? "line-through" : ""}`}>
                            {col}
                          </span>
                          {isDropped && <span className="text-[10px] text-red-500 font-normal border border-red-200 bg-red-50 px-1 py-0.5 rounded mt-0.5 inline-block">{t("cleaner.workspace.dropped_badge")}</span>}
                          {isRenamed && <span className="text-[10px] text-blue-600 font-normal border border-blue-200 bg-blue-50 px-1 py-0.5 rounded mt-0.5 inline-block" title={t("cleaner.workspace.old_name_tooltip", { name: isRenamed })}>{t("cleaner.workspace.renamed_badge")}</span>}
                        </div>
                      )}

                      {!isDropped && renamingCol !== col && (
                        <div className="relative shrink-0 mt-0.5">
                          <button
                            onClick={() => setOpenHeaderMenu(openHeaderMenu === col ? null : col)}
                            className="p-1 rounded text-muted hover:bg-gray-200 hover:text-ink opacity-0 group-hover/header:opacity-100 transition-opacity"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {openHeaderMenu === col && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenHeaderMenu(null)} />
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-border rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 font-normal">
                                <button
                                  onClick={() => { setRenamingCol(col); setRenameValue(col); setOpenHeaderMenu(null); }}
                                  title={t("cleaner.tooltip_menu_rename_col")}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-muted" /> {t("cleaner.workspace.menu_rename_col")}
                                </button>
                                <div className="h-px bg-border my-1" />
                                <button
                                  onClick={() => handleHeaderAction(col, "FILL_MISSING_MEAN")}
                                  title={t("cleaner.tooltip_menu_fill_mean")}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2"
                                >
                                  <AlignLeft className="w-3.5 h-3.5 text-muted" /> {t("cleaner.workspace.menu_fill_mean")}
                                </button>
                                <button
                                  onClick={() => handleHeaderAction(col, "FILL_MISSING_UNKNOWN")}
                                  title={t("cleaner.tooltip_menu_fill_unknown")}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2"
                                >
                                  <AlignLeft className="w-3.5 h-3.5 text-muted" /> {t("cleaner.workspace.menu_fill_unknown")}
                                </button>
                                <div className="h-px bg-border my-1" />
                                <button
                                  onClick={() => handleHeaderAction(col, "DROP_COLUMN")}
                                  title={t("cleaner.tooltip_menu_drop_col")}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" /> {t("cleaner.workspace.menu_drop_col")}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleData.map((row, idx) => {
              const rowId = row.original_index;
              const hasErrorInRow = rowId !== undefined && errorRowIdsSet.has(rowId);
              const excelRow = (rowId !== undefined && rowId !== null ? rowId : idx) + 2;

              return (
                <tr
                  key={rowId !== undefined ? rowId : idx}
                  className={`hover:bg-sage/10 transition-colors ${hasErrorInRow ? "bg-amber-50/20" : ""}`}
                >
                  <td
                    data-row={excelRow}
                    className="px-2.5 py-2 text-muted text-center border-r border-border/50 sticky left-0 z-10 bg-[#F9F9F8] font-mono text-xs select-none"
                  >
                    {excelRow}
                  </td>
                  {displayCols.map(col => {
                    const isDropped = droppedCols.has(col);
                    if (isDropped) {
                      return <td key={col} className="px-2.5 py-2 text-gray-300 bg-gray-50/50 italic text-xs">-</td>;
                    }

                    const letter = colLetters[col] || colLetter(originalColumns.indexOf(col));
                    const cellAddr = `${letter}${excelRow}`;
                    const status = getCellStatus(rowId, col);
                    const isEditing = editingCell?.rowIdx === idx && editingCell?.col === col && editingCell?.isDirectEdit;

                    // Value to display
                    let displayVal = row[col];
                    if (status.type === "pending_edit") displayVal = status.value;
                    else if (status.type === "fixed" && status.value !== undefined) displayVal = status.value;

                    const isNull = displayVal === null || displayVal === undefined;

                    let cellClasses = "px-2.5 py-2 truncate text-xs transition-colors border border-transparent ";
                    let tooltip = null;

                    if (status.type === "ignored") {
                      cellClasses += "bg-gray-100 text-gray-400 line-through cursor-pointer hover:border-gray-300";
                      tooltip = `${cellAddr}: ${t("cleaner.guided.ignored")}`;
                    } else if (status.type === "fixed" || status.type === "pending_edit") {
                      cellClasses += "bg-emerald-50 text-emerald-900 border-emerald-200 font-medium cursor-pointer hover:border-emerald-400";
                      const oldStr = status.originalValue === null || status.originalValue === undefined ? "null" : String(status.originalValue);
                      const newStr = isNull ? "null" : String(displayVal);
                      tooltip = `${cellAddr}: ${t("cleaner.guided.fixed_tooltip", { oldVal: oldStr, newVal: newStr })}`;
                    } else if (status.type === "action_changed") {
                      cellClasses += "bg-emerald-50/70 text-emerald-900 border-emerald-200/80 font-medium cursor-pointer hover:border-emerald-400";
                      const oldStr = status.changedItem.old === null || status.changedItem.old === undefined ? "null" : String(status.changedItem.old);
                      const newStr = isNull ? "null" : String(displayVal);
                      tooltip = `${cellAddr}: ${oldStr} → ${newStr} (${t("cleaner.legend_action_changed")})`;
                    } else if (status.type === "error") {
                      cellClasses += "bg-red-50 text-red-900 cursor-pointer border-red-200 hover:border-red-300";
                      tooltip = `${cellAddr}: ${t(`cleaner.guided.reasons.${status.issue}`, { defaultValue: t("cleaner.guided.pending") })}`;
                    } else {
                      cellClasses += "text-ink ";
                      if (isFullEditMode) {
                        cellClasses += "cursor-pointer hover:border-gray-300 hover:bg-gray-50";
                        tooltip = `${cellAddr}: ${t("cleaner.guided.btn_edit_value")}`;
                      } else {
                        tooltip = `${cellAddr}: ${!isNull ? String(displayVal) : "null"}`;
                      }
                    }

                    return (
                      <td
                        key={col}
                        data-cell-id={`${rowId}:${col}`}
                        data-addr={cellAddr}
                        data-col-letter={letter}
                        data-row={excelRow}
                        onClick={() => handleCellClick(idx, col, status, isDropped)}
                        className={cellClasses}
                        title={tooltip}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCellSave()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellSave();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="w-full bg-white border border-forest rounded px-1 py-0.5 text-ink outline-none text-xs"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">
                              {!isNull ? String(displayVal) : <span className="text-gray-400 italic">null</span>}
                            </span>
                            {status.type === "error" && status.reviewState === "pending" && (
                              <span className="shrink-0 text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-medium">
                                !
                              </span>
                            )}
                            {(status.type === "fixed" || status.type === "pending_edit") && (
                              <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold flex items-center">
                                ✓
                              </span>
                            )}
                            {status.type === "action_changed" && (
                              <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-medium">
                                •
                              </span>
                            )}
                            {status.type === "ignored" && (
                              <span className="shrink-0 text-[10px] bg-gray-200 text-gray-600 px-1 py-0.2 rounded font-medium">
                                {t("cleaner.guided.ignored")}
                              </span>
                            )}
                          </div>
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

      {/* Guided Mode Cell Detail Modal/Panel - responsive, 375px+ compliant */}
      {activeErrorPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setActiveErrorPanel(null)}
        >
          <div
            className="bg-white border border-border rounded-xl shadow-2xl p-5 w-full max-w-[375px] space-y-4 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-ink font-mono">
                  {`Ô ${cellAddress(colLetters[activeErrorPanel.col] || colLetter(originalColumns.indexOf(activeErrorPanel.col)), (activeErrorPanel.rowId !== undefined && activeErrorPanel.rowId !== null ? activeErrorPanel.rowId : activeErrorPanel.rowIdx) + 2)} (${cellAddressWords(colLetters[activeErrorPanel.col] || colLetter(originalColumns.indexOf(activeErrorPanel.col)), (activeErrorPanel.rowId !== undefined && activeErrorPanel.rowId !== null ? activeErrorPanel.rowId : activeErrorPanel.rowIdx) + 2, currentLang)}) · ${activeErrorPanel.col}`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cellReviewStates[`${activeErrorPanel.rowId}:${activeErrorPanel.col}`] === "ignored"
                      ? "bg-gray-100 text-gray-700"
                      : cellReviewStates[`${activeErrorPanel.rowId}:${activeErrorPanel.col}`] === "fixed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                    {cellReviewStates[`${activeErrorPanel.rowId}:${activeErrorPanel.col}`] === "ignored"
                      ? t("cleaner.guided.ignored")
                      : cellReviewStates[`${activeErrorPanel.rowId}:${activeErrorPanel.col}`] === "fixed"
                        ? t("cleaner.guided.fixed")
                        : t("cleaner.guided.pending")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveErrorPanel(null)}
                className="p-1 rounded-lg text-muted hover:text-ink hover:bg-gray-100 transition-colors"
                title={t("cleaner.guided.cancel")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Issue Reason */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wider">
                {t("cleaner.guided.reason_title")}
              </p>
              <div className="bg-[#FFF0E6] text-[#A84300] border border-[#ffd0aa] rounded-lg p-2.5 text-xs">
                {activeErrorPanel.errorCell.issue_type === "missing"
                  ? t("cleaner.guided.reasons.missing")
                  : activeErrorPanel.errorCell.issue_type === "type_mismatch"
                    ? t("cleaner.guided.reasons.type_mismatch")
                    : activeErrorPanel.errorCell.issue_type === "encoding"
                      ? t("cleaner.guided.reasons.encoding")
                      : activeErrorPanel.errorCell.issue_type === "semantic_error"
                        ? t("cleaner.guided.reasons.semantic_error", { type: activeErrorPanel.errorCell.semantic_type || "" })
                        : t("cleaner.guided.reasons.default")}
              </div>
            </div>

            {/* Current Value / Inline Edit */}
            {editingCell?.rowIdx === activeErrorPanel.rowIdx && editingCell?.col === activeErrorPanel.col && !editingCell?.isDirectEdit ? (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  {t("cleaner.guided.btn_edit_value")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full border border-forest rounded-lg p-2 text-sm text-ink outline-none focus:ring-1 focus:ring-forest"
                  placeholder={t("cleaner.guided.enter_new_value")}
                />

                {/* Rule 3: Hint that typing the word null saves text */}
                <p className="text-[11px] text-muted italic">
                  {t("cleaner.guided.null_typing_hint")}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleCellSave(undefined, activeErrorPanel.rowIdx, activeErrorPanel.col);
                      setActiveErrorPanel(null);
                    }}
                    className={`${BTN.primary} flex-1 py-1.5 text-xs justify-center`}
                  >
                    {t("cleaner.guided.save_cell")}
                  </button>
                  <button
                    onClick={() => setEditingCell(null)}
                    className={`${BTN.secondary} flex-1 py-1.5 text-xs justify-center`}
                  >
                    {t("cleaner.guided.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  {t("cleaner.guided.current_value")}
                </p>
                <p className="text-sm font-mono bg-gray-50 border border-border rounded-lg p-2 text-ink break-all">
                  {activeErrorPanel.currentValue === null || activeErrorPanel.currentValue === undefined
                    ? <span className="italic text-gray-400">null</span>
                    : String(activeErrorPanel.currentValue)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {(!editingCell || editingCell.rowIdx !== activeErrorPanel.rowIdx || editingCell.col !== activeErrorPanel.col) && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                {/* 1. Apply Suggestion - only shown if errorCell carries suggested_value */}
                {activeErrorPanel.errorCell.suggested_value !== undefined && activeErrorPanel.errorCell.suggested_value !== null && (
                  <button
                    onClick={() => {
                      handleCellSave(activeErrorPanel.errorCell.suggested_value, activeErrorPanel.rowIdx, activeErrorPanel.col);
                      setActiveErrorPanel(null);
                    }}
                    className={`${BTN.primary} w-full py-2 text-xs flex items-center justify-center gap-1.5`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t("cleaner.guided.btn_apply_suggestion")}: "{String(activeErrorPanel.errorCell.suggested_value)}"
                  </button>
                )}

                {/* 2. Edit value */}
                <button
                  onClick={() => {
                    setEditingCell({
                      rowIdx: activeErrorPanel.rowIdx,
                      col: activeErrorPanel.col,
                      isDirectEdit: false
                    });
                    setEditValue(activeErrorPanel.currentValue === null || activeErrorPanel.currentValue === undefined ? "" : String(activeErrorPanel.currentValue));
                  }}
                  className={`${BTN.secondary} w-full py-2 text-xs flex items-center justify-center gap-1.5`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {t("cleaner.guided.btn_edit_value")}
                </button>

                {/* Rule 3: Add a "Set empty (null)" button in the edit panel. Send JSON null */}
                <button
                  onClick={() => {
                    handleCellSave(null, activeErrorPanel.rowIdx, activeErrorPanel.col);
                    setActiveErrorPanel(null);
                  }}
                  className="w-full py-2 text-xs font-medium border border-border rounded-lg text-ink hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted" />
                  {t("cleaner.guided.btn_set_null")}
                </button>

                {/* 3. Ignore / Unignore */}
                <button
                  onClick={() => {
                    onSetCellIgnored(activeErrorPanel.rowId, activeErrorPanel.col);
                    setActiveErrorPanel(null);
                  }}
                  className="w-full py-2 text-xs font-medium border border-border rounded-lg text-muted hover:text-ink hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  {cellReviewStates[`${activeErrorPanel.rowId}:${activeErrorPanel.col}`] === "ignored"
                    ? t("cleaner.guided.btn_unignore")
                    : t("cleaner.guided.btn_ignore")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
