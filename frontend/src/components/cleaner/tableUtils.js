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

  // Sample up to 100 rows
  const sample = rows.slice(0, 100);
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
 * Scroll to and flash column header and cell
 */
export function scrollToCell(tableContainer, colName, rowId) {
  if (!tableContainer) return;

  // 1. Scroll header into view horizontally
  const thEl = tableContainer.querySelector(`#th-col-${CSS.escape(colName)}`);
  if (thEl) {
    thEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    thEl.classList.remove("ring-2", "ring-forest", "ring-inset");
    // Trigger reflow for animation restart
    void thEl.offsetWidth;
    thEl.classList.add("ring-2", "ring-forest", "ring-inset", "transition-all", "duration-1000");
    setTimeout(() => {
      thEl.classList.remove("ring-2", "ring-forest", "ring-inset");
    }, 1200);
  }

  // 2. Scroll row into view vertically if rowId is provided
  if (rowId !== undefined && rowId !== null) {
    const tdEl = tableContainer.querySelector(`[data-cell-id="${CSS.escape(String(rowId))}:${CSS.escape(colName)}"]`);
    if (tdEl) {
      tdEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      tdEl.classList.remove("ring-2", "ring-[#D97706]");
      void tdEl.offsetWidth;
      tdEl.classList.add("ring-2", "ring-[#D97706]", "transition-all", "duration-1000");
      setTimeout(() => {
        tdEl.classList.remove("ring-2", "ring-[#D97706]");
      }, 1200);
    }
  }
}

