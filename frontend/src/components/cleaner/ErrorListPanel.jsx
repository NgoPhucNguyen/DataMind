import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Check, EyeOff, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorCells } from "../../services/cleanerService";

export function getTypeLabel(type, t) {
  switch (type) {
    case "missing":
      return t("cleaner.group_missing", { defaultValue: "ô trống" });
    case "wrong_type":
      return t("cleaner.group_wrong_type", { defaultValue: "sai kiểu dữ liệu" });
    case "encoding":
      return t("cleaner.group_encoding", { defaultValue: "lỗi mã hóa" });
    case "semantic":
      return t("cleaner.group_semantic", { defaultValue: "lỗi định dạng" });
    default:
      return type;
  }
}

export function getGroupTooltip(group, semanticErrors = [], t) {
  let meaning = "";
  switch (group.issueType) {
    case "missing":
      meaning = t("cleaner.tooltip_group_missing", {
        defaultValue: "Ô không có giá trị. Bấm để xem từng ô.",
      });
      break;
    case "wrong_type":
      meaning = t("cleaner.tooltip_group_wrong_type", {
        defaultValue: "Giá trị không đọc được theo kiểu của cột (vd chữ trong cột số). Bấm để xem từng ô.",
      });
      break;
    case "encoding":
      meaning = t("cleaner.tooltip_group_encoding", {
        defaultValue: "Ký tự lỗi hoặc vỡ font mã hóa. Bấm để xem từng ô.",
      });
      break;
    case "semantic": {
      const matchedErr = semanticErrors.find((e) => e.column === group.column);
      const semType = matchedErr?.semantic_type;
      if (semType === "EMAIL") {
        meaning = t("cleaner.tooltip_group_semantic_email", {
          defaultValue: "Không đúng định dạng email. Bấm để xem từng ô.",
        });
      } else if (semType === "PHONE") {
        meaning = t("cleaner.tooltip_group_semantic_phone", {
          defaultValue: "Không đúng định dạng số điện thoại. Bấm để xem từng ô.",
        });
      } else if (semType === "FULL_NAME") {
        meaning = t("cleaner.tooltip_group_semantic_name", {
          defaultValue: "Không đúng định dạng họ tên. Bấm để xem từng ô.",
        });
      } else {
        meaning = t("cleaner.tooltip_group_semantic", {
          defaultValue: "Không đúng định dạng quy chuẩn của cột. Bấm để xem từng ô.",
        });
      }
      break;
    }
    default:
      meaning = `${group.issueType}. ${t("cleaner.tooltip_click_view_cells", { defaultValue: "Bấm để xem từng ô." })}`;
      break;
  }
  return meaning;
}

/**
 * Build sorted array of issue groups from columnIssueCounts.
 */
export function getIssueGroups(columnIssueCounts = {}, columnLetters = {}) {
  const groups = [];
  if (!columnIssueCounts) return groups;

  Object.entries(columnIssueCounts).forEach(([col, counts]) => {
    if (!counts) return;
    ["missing", "wrong_type", "encoding", "semantic"].forEach((type) => {
      const cnt = counts[type] || 0;
      if (cnt > 0) {
        groups.push({
          key: `${col}::${type}`,
          column: col,
          issueType: type,
          count: cnt,
          letter: columnLetters[col] || "",
        });
      }
    });
  });

  groups.sort((a, b) => b.count - a.count);
  return groups;
}

/**
 * ErrorChipsRow: Shows top 5 issue groups by count and a toggle button to open/close ErrorListPanel.
 */
export function ErrorChipsRow({
  columnIssueCounts = {},
  columnLetters = {},
  isPanelOpen = false,
  onTogglePanel,
  onSelectGroup,
  duplicateCount = 0,
  semanticErrors = [],
  className = "",
}) {
  const { t } = useTranslation();

  const groups = useMemo(
    () => getIssueGroups(columnIssueCounts, columnLetters),
    [columnIssueCounts, columnLetters]
  );

  const totalErrors = useMemo(
    () => groups.reduce((acc, g) => acc + g.count, 0),
    [groups]
  );

  const top5 = useMemo(() => groups.slice(0, 5), [groups]);

  if (groups.length === 0 && duplicateCount === 0) {
    return null;
  }

  const toggleBtnTooltip = isPanelOpen
    ? t("cleaner.tooltip_close_error_panel", { defaultValue: "Thu gọn danh sách lỗi." })
    : t("cleaner.tooltip_view_all_errors", { defaultValue: "Mở danh sách lỗi theo từng cột trong toàn bộ file." });

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {duplicateCount > 0 && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FDEBEC] text-[#9F2F2D] border border-[#f5c6cb]">
          {t("cleaner.chip_duplicates", { count: duplicateCount, defaultValue: `${duplicateCount} dòng trùng lặp` })}
        </span>
      )}

      {top5.map((g) => {
        const letterPrefix = g.letter ? `${g.letter} · ` : "";
        const shortName = g.column.length > 20 ? `${g.column.slice(0, 18)}…` : g.column;
        const typeText = getTypeLabel(g.issueType, t);
        const label = `${letterPrefix}${shortName} · ${g.count} ${typeText}`;
        const tooltip = getGroupTooltip(g, semanticErrors, t);

        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onSelectGroup?.(g)}
            title={tooltip}
            aria-label={tooltip}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-300 transition-colors"
          >
            <span>{label}</span>
          </button>
        );
      })}

      {totalErrors > 0 && (
        <button
          type="button"
          onClick={onTogglePanel}
          title={toggleBtnTooltip}
          aria-label={toggleBtnTooltip}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            isPanelOpen
              ? "bg-[#1E4D3A] text-white border-[#1E4D3A]"
              : "border-forest-300 text-forest-800 bg-forest-50 hover:bg-forest-100"
          }`}
        >
          <span>
            {isPanelOpen
              ? t("cleaner.collapse_error_list", { defaultValue: "Thu gọn danh sách" })
              : t("cleaner.view_all_errors", {
                  total: totalErrors,
                  defaultValue: `Xem tất cả lỗi (${totalErrors})`,
                })}
          </span>
          {isPanelOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * ErrorListPanel: Collapsible panel below the chips row listing error groups and paginated cells.
 */
export default function ErrorListPanel({
  isOpen = false,
  onClose,
  fileHash,
  actions = [],
  overriddenTypes = {},
  columnIssueCounts = {},
  columnLetters = {},
  cellReviewStates = {},
  pendingCellEdits = [],
  semanticErrors = [],
  onLocateCell,
  activeGroupKey = null,
  onActiveGroupKeyChange,
}) {
  const { t } = useTranslation();

  const groups = useMemo(
    () => getIssueGroups(columnIssueCounts, columnLetters),
    [columnIssueCounts, columnLetters]
  );

  const totalErrors = useMemo(
    () => groups.reduce((acc, g) => acc + g.count, 0),
    [groups]
  );

  const [expandedGroupKeys, setExpandedGroupKeys] = useState(
    () => new Set(activeGroupKey ? [activeGroupKey] : [])
  );
  const [groupData, setGroupData] = useState({});
  const [loadingGroup, setLoadingGroup] = useState({});

  const requestIdRef = useRef(0);
  const prevActionsRef = useRef(actions);

  // Sync activeGroupKey from outside (chip click)
  useEffect(() => {
    if (activeGroupKey) {
      setExpandedGroupKeys((prev) => new Set([...prev, activeGroupKey]));
    }
  }, [activeGroupKey]);

  // Lookup map for live values from pending edits and saved BATCH_EDIT_CELLS
  const cellEditsMap = useMemo(() => {
    const map = new Map();
    (actions || [])
      .filter((a) => a.action_type === "BATCH_EDIT_CELLS")
      .forEach((a) => {
        (a.params?.edits || []).forEach((e) => {
          map.set(`${e.row_id}:${e.column}`, e.new_value);
        });
      });
    (pendingCellEdits || []).forEach((e) => {
      map.set(`${e.row_id}:${e.column}`, e.new_value);
    });
    return map;
  }, [actions, pendingCellEdits]);

  const fetchGroupCells = useCallback(
    async (group, offset = 0, isAppend = false, reqId = null) => {
      if (!fileHash) return;
      const currentReqId = reqId !== null ? reqId : ++requestIdRef.current;
      const key = group.key;
      setLoadingGroup((prev) => ({ ...prev, [key]: true }));

      try {
        const res = await getErrorCells({
          file_hash: fileHash,
          actions,
          overridden_types: overriddenTypes,
          column: group.column,
          issue_type: group.issueType,
          offset,
          limit: 20,
        });

        // Ignore stale response
        if (currentReqId !== requestIdRef.current) {
          return;
        }

        const fetchedCells = res.data?.cells || [];
        const total = res.data?.total ?? group.count;

        setGroupData((prev) => {
          const existing = prev[key]?.cells || [];
          return {
            ...prev,
            [key]: {
              cells: isAppend ? [...existing, ...fetchedCells] : fetchedCells,
              total,
              offset: offset + fetchedCells.length,
            },
          };
        });
      } catch (_) {
        // silently ignore error
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoadingGroup((prev) => ({ ...prev, [key]: false }));
        }
      }
    },
    [fileHash, actions, overriddenTypes]
  );

  // Refetch ONLY currently expanded groups after column-wide action or undo.
  // Collapsed groups refresh lazily when opened. No refetch on typing/pendingCellEdits!
  useEffect(() => {
    const prev = prevActionsRef.current;
    prevActionsRef.current = actions;

    if (prev === actions) return;

    // Check if change is only adding a BATCH_EDIT_CELLS action
    const isOnlyBatchEdit =
      actions.length === prev.length + 1 &&
      actions[actions.length - 1]?.action_type === "BATCH_EDIT_CELLS";

    if (isOnlyBatchEdit) {
      // Single-cell edits do not refetch backend; live values update via cellEditsMap
      return;
    }

    // Column-wide action or undo/removal of action!
    // Invalidate collapsed groups in cache
    setGroupData((curr) => {
      const retained = {};
      expandedGroupKeys.forEach((k) => {
        if (curr[k]) retained[k] = curr[k];
      });
      return retained;
    });

    const reqId = ++requestIdRef.current;

    // Refetch each expanded group
    expandedGroupKeys.forEach((key) => {
      const group = groups.find((g) => g.key === key);
      if (group) {
        fetchGroupCells(group, 0, false, reqId);
      }
    });
  }, [actions, expandedGroupKeys, groups, fetchGroupCells]);

  // Handle toggling expansion of a group
  const handleToggleGroup = useCallback(
    (group) => {
      const key = group.key;
      const isCurrentlyExpanded = expandedGroupKeys.has(key);

      setExpandedGroupKeys((prev) => {
        const next = new Set(prev);
        if (isCurrentlyExpanded) {
          next.delete(key);
          onActiveGroupKeyChange?.(null);
        } else {
          next.add(key);
          onActiveGroupKeyChange?.(key);
        }
        return next;
      });

      // If opening and not loaded yet, fetch lazily
      if (!isCurrentlyExpanded && !groupData[key]) {
        fetchGroupCells(group, 0, false);
      }
    },
    [expandedGroupKeys, groupData, fetchGroupCells, onActiveGroupKeyChange]
  );

  // If a group was expanded via activeGroupKey but not loaded, fetch it
  useEffect(() => {
    expandedGroupKeys.forEach((key) => {
      if (!groupData[key] && !loadingGroup[key]) {
        const targetGroup = groups.find((g) => g.key === key);
        if (targetGroup) {
          fetchGroupCells(targetGroup, 0, false);
        }
      }
    });
  }, [expandedGroupKeys, groupData, loadingGroup, groups, fetchGroupCells]);

  const handleLoadMore = useCallback(
    (group) => {
      const current = groupData[group.key];
      const offset = current?.cells?.length || 0;
      fetchGroupCells(group, offset, true);
    },
    [groupData, fetchGroupCells]
  );

  if (!isOpen) return null;

  return (
    <div className="w-full my-3 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col text-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">
            {t("cleaner.error_list_panel_title", { defaultValue: "Danh sách lỗi chi tiết" })}
          </span>
          <span className="text-xs text-gray-500 font-medium">
            ({groups.length} {t("cleaner.groups_count", { defaultValue: "nhóm" })} · {totalErrors} {t("cleaner.errors_count", { defaultValue: "lỗi" })})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
          title={t("cleaner.tooltip_close_error_panel", { defaultValue: "Thu gọn danh sách lỗi." })}
          aria-label={t("cleaner.tooltip_close_error_panel", { defaultValue: "Thu gọn danh sách lỗi." })}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Groups List (max-h ~280px with own scroll) */}
      <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-100">
        {groups.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">
            {t("cleaner.no_errors_found", { defaultValue: "Không phát hiện lỗi" })}
          </div>
        ) : (
          groups.map((group) => {
            const isExpanded = expandedGroupKeys.has(group.key);
            const letterPrefix = group.letter ? `${group.letter} · ` : "";
            const shortName = group.column.length > 24 ? `${group.column.slice(0, 22)}…` : group.column;
            const typeText = getTypeLabel(group.issueType, t);
            const groupLabel = `${letterPrefix}${shortName} · ${group.count} ${typeText}`;
            const groupTooltip = getGroupTooltip(group, semanticErrors, t);

            const currentData = groupData[group.key];
            const cells = currentData?.cells || [];
            const groupTotal = currentData?.total ?? group.count;
            const isLoading = loadingGroup[group.key];

            // Count processed cells
            let processedCount = 0;
            if (cellReviewStates && Object.keys(cellReviewStates).length > 0) {
              processedCount = cells.filter((c) => {
                const cellKey = `${c.row_id}:${c.column}`;
                const st = cellReviewStates[cellKey];
                return st === "fixed" || st === "ignored" || cellEditsMap.has(cellKey);
              }).length;
            }

            return (
              <div key={group.key} className="flex flex-col">
                {/* Group Header */}
                <button
                  type="button"
                  onClick={() => handleToggleGroup(group)}
                  title={groupTooltip}
                  aria-label={groupTooltip}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    isExpanded ? "bg-gray-50/80 font-medium text-gray-900" : "hover:bg-gray-50/50 text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="truncate text-xs font-medium">{groupLabel}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {processedCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        {t("cleaner.processed_count", {
                          processed: processedCount,
                          total: group.count,
                          defaultValue: `đã xử lý ${processedCount}/${group.count}`,
                        })}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {group.count}
                    </span>
                  </div>
                </button>

                {/* Group Cells (Expanded) */}
                {isExpanded && (
                  <div className="bg-gray-50/30 border-t border-gray-100">
                    {isLoading && cells.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-gray-500 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin text-forest-600" />
                        <span>{t("cleaner.window_loading", { defaultValue: "Đang tải…" })}</span>
                      </div>
                    ) : cells.length === 0 ? (
                      <div className="py-3 px-4 text-center text-xs text-gray-400 italic">
                        {t("cleaner.no_errors_found", { defaultValue: "Không có ô lỗi nào" })}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {cells.map((cell, idx) => {
                          const cellKey = `${cell.row_id}:${cell.column}`;
                          const reviewState = cellReviewStates?.[cellKey];
                          const hasLocalEdit = cellEditsMap.has(cellKey);
                          const isFixed = reviewState === "fixed" || hasLocalEdit;
                          const editedVal = hasLocalEdit ? cellEditsMap.get(cellKey) : undefined;
                          const address = `${cell.letter || group.letter}${cell.excel_row}`;
                          const cellJumpTooltip = t("cleaner.tooltip_cell_jump", {
                            addr: address,
                            defaultValue: `Bấm để đi tới ô ${address} trong bảng.`,
                          });

                          return (
                            <div
                              key={`${cell.row_id || idx}:${cell.excel_row}:${cell.column}`}
                              onClick={() =>
                                onLocateCell?.({
                                  excelRow: cell.excel_row,
                                  letter: cell.letter || group.letter,
                                  matchedCol: cell.column,
                                })
                              }
                              title={cellJumpTooltip}
                              aria-label={cellJumpTooltip}
                              className="flex items-center justify-between px-4 py-2 hover:bg-forest-50/70 cursor-pointer text-xs transition-colors group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200 group-hover:border-forest-300 group-hover:bg-forest-100 group-hover:text-forest-900 transition-colors">
                                  {address}
                                </span>
                                <span className="text-gray-300">·</span>

                                {/* Live Value: "cũ → mới" if fixed/edited */}
                                <span className="truncate max-w-[140px] sm:max-w-[220px]">
                                  {isFixed && editedVal !== undefined ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                      <span className="text-gray-400 line-through">
                                        {cell.value === null || cell.value === undefined || cell.value === ""
                                          ? t("cleaner.empty_value", { defaultValue: "(trống)" })
                                          : String(cell.value)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-1 rounded border border-emerald-200">
                                        {editedVal === null || editedVal === undefined || editedVal === ""
                                          ? t("cleaner.empty_value", { defaultValue: "(trống)" })
                                          : String(editedVal)}
                                      </span>
                                    </span>
                                  ) : cell.value === null || cell.value === undefined || cell.value === "" ? (
                                    <span className="italic text-gray-400">
                                      {t("cleaner.empty_value", { defaultValue: "(trống)" })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-700">{String(cell.value)}</span>
                                  )}
                                </span>

                                <span className="text-gray-300">·</span>
                                <span className="text-gray-500 truncate max-w-[160px] sm:max-w-[240px]">
                                  {cell.issue || typeText}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {isFixed && (
                                  <span
                                    title={t("cleaner.tooltip_status_fixed", { defaultValue: "Bạn đã sửa ô này." })}
                                    aria-label={t("cleaner.tooltip_status_fixed", { defaultValue: "Bạn đã sửa ô này." })}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>{t("cleaner.review_fixed", { defaultValue: "Đã sửa" })}</span>
                                  </span>
                                )}
                                {!isFixed && reviewState === "ignored" && (
                                  <span
                                    title={t("cleaner.tooltip_status_ignored", { defaultValue: "Bạn đã chọn giữ nguyên ô này." })}
                                    aria-label={t("cleaner.tooltip_status_ignored", { defaultValue: "Bạn đã chọn giữ nguyên ô này." })}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                                  >
                                    <EyeOff className="w-3 h-3" />
                                    <span>{t("cleaner.review_ignored", { defaultValue: "Bỏ qua" })}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Load more */}
                        {cells.length < groupTotal && (
                          <div className="p-2 text-center bg-gray-50/60 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadMore(group);
                              }}
                              disabled={isLoading}
                              title={t("cleaner.tooltip_load_more_cells", { defaultValue: "Hiện thêm 20 ô." })}
                              aria-label={t("cleaner.tooltip_load_more_cells", { defaultValue: "Hiện thêm 20 ô." })}
                              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-forest-800 bg-white border border-forest-300 rounded hover:bg-forest-50 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-forest-600" />
                                  <span>{t("cleaner.window_loading", { defaultValue: "Đang tải…" })}</span>
                                </>
                              ) : (
                                <span>
                                  {t("cleaner.load_more_cells", { defaultValue: "Xem thêm" })} ({cells.length}/{groupTotal})
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
