import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { colLetter, parseAddress } from "../../utils/cellAddress";
import { useToast } from "../../contexts/ToastContext";
import { highlightExcelCell } from "./tableUtils";

export function GoToCellInput({
  columnLetters = {},
  allColumns = [],
  visibleColumns = [],
  rows = [],
  containerRef,
  onCellFound,
  onLocateRow,
  previewRowsLimit = 150,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [address, setAddress] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGo = () => {
    const parsed = parseAddress(address);
    if (!parsed.valid) {
      showToast(t("cleaner.goto_invalid_address", { defaultValue: "Địa chỉ không hợp lệ (ví dụ: A1, C15)" }), "warning");
      return;
    }

    // Match column
    let matchedCol = null;
    let colWasDropped = false;

    // Check visible columns first
    for (const col of visibleColumns) {
      const letForCol = columnLetters[col] || colLetter(allColumns.indexOf(col));
      if (letForCol === parsed.letter) {
        matchedCol = col;
        break;
      }
    }

    // If not found in visibleColumns, check if it was in allColumns or columnLetters and got dropped
    if (!matchedCol) {
      for (const [colName, letter] of Object.entries(columnLetters)) {
        if (letter === parsed.letter && !visibleColumns.includes(colName)) {
          colWasDropped = true;
          break;
        }
      }
      if (!colWasDropped) {
        for (let i = 0; i < allColumns.length; i++) {
          if (colLetter(i) === parsed.letter && !visibleColumns.includes(allColumns[i])) {
            colWasDropped = true;
            break;
          }
        }
      }

      if (colWasDropped) {
        showToast(t("cleaner.goto_col_dropped", { letter: parsed.letter, defaultValue: `Cột ${parsed.letter} đã bị xóa` }), "warning");
        return;
      }

      showToast(t("cleaner.goto_invalid_address", { defaultValue: "Địa chỉ không hợp lệ (ví dụ: A1, C15)" }), "warning");
      return;
    }

    // Match row in current rows
    const targetRow = rows.find((r, idx) => ((r.original_index !== undefined && r.original_index !== null ? r.original_index : idx) + 2) === parsed.row);
    if (!targetRow) {
      if (onLocateRow) {
        onLocateRow({ excelRow: parsed.row, letter: parsed.letter, matchedCol });
        return;
      }
      if (parsed.row > previewRowsLimit) {
        showToast(t("cleaner.goto_row_outside_preview", { row: parsed.row, max: previewRowsLimit, defaultValue: `Dòng ${parsed.row} nằm ngoài ${previewRowsLimit} dòng xem trước` }), "warning");
        return;
      }
      showToast(t("cleaner.goto_cell_not_found", { addr: `${parsed.letter}${parsed.row}`, defaultValue: `Không tìm thấy ô ${parsed.letter}${parsed.row}` }), "warning");
      return;
    }

    const addr = `${parsed.letter}${parsed.row}`;
    const rowId = targetRow.original_index;
    const elem = containerRef?.current?.querySelector(`[data-addr="${addr}"]`) ||
                 containerRef?.current?.querySelector(`[data-cell-id="${rowId}:${matchedCol}"]`);

    if (containerRef?.current) {
      highlightExcelCell(containerRef.current, {
        cellEl: elem,
        addr,
        letter: parsed.letter,
        excelRow: parsed.row,
        rowId,
        colName: matchedCol,
      });
    }

    if (onCellFound) {
      onCellFound({
        targetRow,
        targetCol: matchedCol,
        rowId,
        letter: parsed.letter,
        excelRow: parsed.row,
        val: targetRow[matchedCol]
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5" data-goto-input="true">
      <input
        ref={inputRef}
        data-goto-input="true"
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGo();
          else if (e.key === "Escape") setAddress("");
        }}
        placeholder={t("cleaner.goto_cell_placeholder", { defaultValue: "Đi tới ô, vd C15" })}
        className="px-2.5 py-1 text-xs border border-border rounded-md bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-forest w-32 uppercase font-mono tracking-wider shadow-2xs"
        title="Ctrl+G / Cmd+G"
      />
      <button
        type="button"
        onClick={handleGo}
        className="px-2 py-1 text-xs font-medium border border-border rounded-md bg-neutral-100 hover:bg-neutral-200 text-ink cursor-pointer transition-colors shadow-2xs"
      >
        {t("cleaner.goto_cell_button", { defaultValue: "Đi" })}
      </button>
    </div>
  );
}

