/**
 * tableUtils.js
 * Shared helpers for Cleaner PreviewTables
 */

/**
 * Calculate column width between 72px and 200px.
 * Takes the longest value in sample rows and header length.
 */
export function getColumnWidth(col, rows = []) {
  if (!col) return 72;
  const colStr = String(col);

  // Measure header length (approx 8px per char, padded by ~24px for icon/padding)
  let headerEst = colStr.length * 8 + 24;
  if (headerEst > 160) headerEst = 160;

  // Sample up to 200 rows
  const sample = rows.slice(0, 200);
  let maxCellEst = 0;
  for (const row of sample) {
    const val = row[col];
    if (val !== null && val !== undefined) {
      const len = String(val).length;
      const est = len * 7.5 + 20;
      if (est > maxCellEst) maxCellEst = est;
    }
  }

  const estWidth = Math.max(headerEst, maxCellEst);
  return Math.max(72, Math.min(200, Math.round(estWidth)));
}

/**
 * Returns an ordered list of unique error cells that exist within current preview rows
 * Sorted by row_id ascending, then column order.
 */
export function getOrderedErrorCells(errorCells = [], previewRows = [], columns = []) {
  if (!errorCells || errorCells.length === 0 || !previewRows || previewRows.length === 0) {
    return [];
  }

  // Set of valid row_ids present in the preview data
  const validRowIds = new Set(previewRows.map(r => r.original_index).filter(id => id !== undefined));
  
  // Col index map for tie-breaking
  const colOrder = new Map();
  columns.forEach((c, idx) => colOrder.set(c, idx));

  const filtered = errorCells.filter(err => validRowIds.has(err.row_id));

  // Sort by row_id asc, then col order asc
  filtered.sort((a, b) => {
    if (a.row_id !== b.row_id) return a.row_id - b.row_id;
    const colA = colOrder.get(a.column) ?? 9999;
    const colB = colOrder.get(b.column) ?? 9999;
    return colA - colB;
  });

  return filtered;
}

/**
 * Error navigation helpers: find next and previous error cell in the ordered list
 */
export function getNextError(orderedErrors, currentError) {
  if (!orderedErrors || orderedErrors.length === 0) return null;
  if (!currentError) return orderedErrors[0];

  const idx = orderedErrors.findIndex(
    e => e.row_id === currentError.row_id && e.column === currentError.column
  );
  if (idx === -1 || idx === orderedErrors.length - 1) {
    return orderedErrors[0]; // Wrap around
  }
  return orderedErrors[idx + 1];
}

export function getPrevError(orderedErrors, currentError) {
  if (!orderedErrors || orderedErrors.length === 0) return null;
  if (!currentError) return orderedErrors[orderedErrors.length - 1];

  const idx = orderedErrors.findIndex(
    e => e.row_id === currentError.row_id && e.column === currentError.column
  );
  if (idx <= 0) {
    return orderedErrors[orderedErrors.length - 1]; // Wrap around
  }
  return orderedErrors[idx - 1];
}

/**
 * Highlight an Excel cell, its column letter header, and its row number cell.
 * Keeps highlight until user clicks elsewhere, presses Esc, or jumps again.
 * Offsets scrolling so the cell is not hidden under the sticky header (2 rows) or sticky column.
 */
export function highlightExcelCell(tableContainer, { cellEl, addr, letter, excelRow, rowId, colName } = {}) {
  if (!tableContainer) return null;

  // 1. Locate the target cell if not directly passed
  let target = cellEl;
  if (!target && addr) {
    target = tableContainer.querySelector(`[data-addr="${CSS.escape(addr)}"]`);
  }
  if (!target && rowId !== undefined && rowId !== null && colName) {
    target = tableContainer.querySelector(`[data-cell-id="${CSS.escape(String(rowId))}:${CSS.escape(colName)}"]`);
  }
  if (!target && addr) {
    // Try case-insensitive attribute match
    const allCells = tableContainer.querySelectorAll("[data-addr]");
    const upperAddr = String(addr).toUpperCase();
    for (const c of allCells) {
      if (c.getAttribute("data-addr")?.toUpperCase() === upperAddr) {
        target = c;
        break;
      }
    }
  }

  // Clear any existing active selection across document
  document.querySelectorAll(".excel-cell-active").forEach((el) => el.classList.remove("excel-cell-active"));
  document.querySelectorAll(".excel-header-active").forEach((el) => el.classList.remove("excel-header-active"));

  if (window.__datamind_excel_dismiss) {
    try { window.__datamind_excel_dismiss(); } catch (_) {}
    window.__datamind_excel_dismiss = null;
  }

  if (!target) return null;

  // 2. Derive letter and excelRow from the element if not passed
  const colLetterVal = letter || target.getAttribute("data-col-letter");
  const rowNumVal = excelRow || target.getAttribute("data-row");

  // 3. Mark the active cell
  target.classList.add("excel-cell-active");

  // 4. Mark the matching column letter header
  let thLetter = null;
  if (colLetterVal) {
    thLetter = tableContainer.querySelector(`th[data-col-letter="${CSS.escape(colLetterVal)}"]`);
    if (thLetter) thLetter.classList.add("excel-header-active");
  }

  // 5. Mark the matching row number in the "Dòng" column
  let tdRow = null;
  if (rowNumVal !== undefined && rowNumVal !== null) {
    tdRow = tableContainer.querySelector(`td[data-row="${CSS.escape(String(rowNumVal))}"]`);
    if (tdRow) tdRow.classList.add("excel-header-active");
  }

  // 6. Offset scroll so cell lands in the visible area below the 2 sticky header rows and right of sticky column
  const thead = tableContainer.querySelector("thead");
  const stickyHeaderHeight = thead ? thead.offsetHeight : 64;
  const stickyCol = tableContainer.querySelector("th.sticky.left-0") || tableContainer.querySelector("td.sticky.left-0");
  const stickyColWidth = stickyCol ? stickyCol.offsetWidth : 48;

  const cellRect = target.getBoundingClientRect();
  const containerRect = tableContainer.getBoundingClientRect();

  const visibleTop = containerRect.top + stickyHeaderHeight;
  const visibleBottom = containerRect.bottom;
  const visibleLeft = containerRect.left + stickyColWidth;
  const visibleRight = containerRect.right;

  let newScrollTop = tableContainer.scrollTop;
  let newScrollLeft = tableContainer.scrollLeft;

  // Scroll vertically if needed (target within comfortable view)
  if (cellRect.top < visibleTop + 24 || cellRect.bottom > visibleBottom - 24) {
    const visibleHeight = Math.max(100, visibleBottom - visibleTop);
    const cellOffsetTop = (cellRect.top - containerRect.top) + tableContainer.scrollTop;
    newScrollTop = cellOffsetTop - stickyHeaderHeight - (visibleHeight / 2) + (cellRect.height / 2);
  }

  // Scroll horizontally if needed
  if (cellRect.left < visibleLeft + 24 || cellRect.right > visibleRight - 24) {
    const visibleWidth = Math.max(100, visibleRight - visibleLeft);
    const cellOffsetLeft = (cellRect.left - containerRect.left) + tableContainer.scrollLeft;
    newScrollLeft = cellOffsetLeft - stickyColWidth - (visibleWidth / 2) + (cellRect.width / 2);
  }

  tableContainer.scrollTo({
    top: Math.max(0, Math.round(newScrollTop)),
    left: Math.max(0, Math.round(newScrollLeft)),
    behavior: "smooth",
  });

  // 7. Setup dismiss listeners: Esc key or click on ANOTHER table cell
  const dismiss = () => {
    document.querySelectorAll(".excel-cell-active").forEach((el) => el.classList.remove("excel-cell-active"));
    document.querySelectorAll(".excel-header-active").forEach((el) => el.classList.remove("excel-header-active"));
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("pointerdown", onPointerDown);
    window.__datamind_excel_dismiss = null;
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      const activeEl = document.activeElement;
      const inTable = tableContainer && (tableContainer === activeEl || tableContainer.contains(activeEl));
      const inGoTo = activeEl && (activeEl.hasAttribute("data-goto-input") || activeEl.closest("[data-goto-input]"));
      if (inTable || inGoTo) {
        dismiss();
      }
    }
  };

  const onPointerDown = (e) => {
    // If target itself or inside target, keep
    if (target && (target === e.target || target.contains(e.target))) {
      return;
    }

    // Ignore clicks in dialogs, modals, popovers, portals, toolbars, buttons
    if (
      e.target.closest("[role='dialog']") ||
      e.target.closest("[data-modal]") ||
      e.target.closest("[data-portal]") ||
      e.target.closest("[data-popover]") ||
      e.target.closest("[data-toolbar]") ||
      e.target.closest("[data-goto-input]")
    ) {
      return;
    }

    // Clear it only when the user clicks ANOTHER table cell
    const otherCell = e.target.closest("td[data-cell-id]") || e.target.closest("td[data-addr]");
    if (otherCell && otherCell !== target) {
      dismiss();
    }
  };

  window.__datamind_excel_dismiss = dismiss;

  // Delay listener registration so current click/key event does not instantly cancel highlight
  setTimeout(() => {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
  }, 60);

  return target;
}

/**
 * Scroll to and flash column header and cell (or excel highlight if cell is targeted)
 */
export function scrollToCell(tableContainer, colName, rowId) {
  if (!tableContainer) return;

  // If rowId and colName provided, use highlightExcelCell
  if (colName && rowId !== undefined && rowId !== null) {
    const highlighted = highlightExcelCell(tableContainer, { colName, rowId });
    if (highlighted) return;
  }

  // Fallback if cell not found (e.g. col-only navigation)
  const thEl = tableContainer.querySelector(`#th-col-${CSS.escape(colName)}`);
  if (thEl) {
    thEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    thEl.classList.remove("ring-2", "ring-forest", "ring-inset");
    void thEl.offsetWidth;
    thEl.classList.add("ring-2", "ring-forest", "ring-inset", "transition-all", "duration-1000");
    setTimeout(() => {
      thEl.classList.remove("ring-2", "ring-forest", "ring-inset");
    }, 1200);
  }
}

