import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, CheckCircle2, ChevronRight, PlayCircle, ArrowLeft, MousePointerClick, ChevronDown, Edit2, AlignLeft, Save } from "lucide-react";
import { TEXT, BTN, CARD } from "../../constants/ui";
import { manualCleanPreview } from "../../services/cleanerService";
import { useToast } from "../../contexts/ToastContext";

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

export default function ManualCleanWorkspace({ columns, fileHash, onConfirm, onBack, initialPreviewData = null, initialErrorCells = null }) {
  const [actions, setActions] = useState([]);
  const [previewData, setPreviewData] = useState(initialPreviewData || []);
  const [errorCells, setErrorCells] = useState(initialErrorCells || []); // Array of ErrorCell
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pendingCellEdits, setPendingCellEdits] = useState([]); // Array of {row_id, column, new_value}
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  
  const debounceTimer = useRef(null);
  const { showToast } = useToast();

  // Load ban đầu
  useEffect(() => {
    if (!initialPreviewData || initialPreviewData.length === 0) {
      handlePreview([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Unmount: clear timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handlePreview = async (currentActions = actions) => {
    setIsPreviewing(true);
    try {
      const res = await manualCleanPreview(fileHash, currentActions);
      setPreviewData(res.data.preview_data || []);
      setErrorCells(res.data.error_cells || []);
      return true;
    } catch (err) {
      showToast(err.response?.data?.detail || "Không thể xem trước dữ liệu.", "error");
      return false;
    } finally {
      setIsPreviewing(false);
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
    
    const success = await handlePreview(newActions);
    if (success) {
      setActions(newActions);
      setPendingCellEdits([]); // Clear pending state only on success
      showToast("Đã lưu các thay đổi.", "success");
      return true;
    } else {
      // Failed to sync (e.g. 400 error). Do not clear pendingCellEdits.
      return false;
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
      return newEdits;
    });
  };
  
  const executeAction = async (newAction) => {
    if (pendingCellEdits.length > 0) {
      const confirmed = window.confirm("Có thay đổi chưa lưu. Bạn có muốn bỏ qua chúng để thực hiện thao tác mới không?");
      if (!confirmed) return;
      setPendingCellEdits([]); // Bỏ qua thay đổi cũ
    }
    
    const newActions = [...actions, newAction];
    const success = await handlePreview(newActions);
    if (success) {
      setActions(newActions);
    }
  };

  const handleRemoveAction = async (index) => {
    if (pendingCellEdits.length > 0) {
      const confirmed = window.confirm("Có thay đổi chưa lưu. Bạn có muốn bỏ qua chúng để thực hiện thao tác mới không?");
      if (!confirmed) return;
      setPendingCellEdits([]); // Bỏ qua thay đổi cũ
    }
    
    const newActions = [...actions];
    newActions.splice(index, 1);
    const success = await handlePreview(newActions);
    if (success) {
      setActions(newActions);
    }
  };
  
  const handleBack = () => {
    if (pendingCellEdits.length > 0) {
      if (!window.confirm("Có thay đổi chưa lưu được. Bạn có chắc muốn rời khỏi màn hình này không? Dữ liệu chưa lưu sẽ bị mất.")) {
         return;
      }
    }
    onBack();
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="text-muted hover:text-ink flex items-center text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
          </button>
          
          <div className="h-6 w-px bg-border" />
          
          <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
            <input 
              type="checkbox" 
              checked={isFullEditMode}
              onChange={(e) => setIsFullEditMode(e.target.checked)}
              className="rounded border-border text-forest focus:ring-forest/30"
            />
            Chế độ Full-Edit (Sửa mọi ô)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSavePendingEdits}
            disabled={pendingCellEdits.length === 0 || isPreviewing}
            className={`${pendingCellEdits.length > 0 ? BTN.secondary : "rounded-md px-4 py-2 text-sm font-medium bg-[#EAEAEA] text-[#626C65] cursor-not-allowed"} flex items-center gap-2`}
          >
            <Save className="w-4 h-4" /> 
            Lưu thay đổi {pendingCellEdits.length > 0 && `(${pendingCellEdits.length})`}
          </button>

          <button
            onClick={() => {
              if (pendingCellEdits.length > 0) {
                 if (!window.confirm("Có thay đổi chưa lưu. Bạn có muốn bỏ qua chúng để chốt file không?")) {
                    return;
                 }
              }
              onConfirm(actions);
            }}
            className={`${BTN.primary} flex items-center gap-2`}
          >
            Chốt File (Manual) <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Phần Trái: Bảng (chiếm 3/4) */}
        <div className="xl:col-span-3">
          <PreviewTable 
            data={previewData} 
            actions={actions} 
            originalColumns={columns} 
            isLoading={isPreviewing}
            pendingCellEdits={pendingCellEdits}
            errorCells={errorCells}
            isFullEditMode={isFullEditMode}
            onAddPendingEdit={handleAddPendingEdit}
            onExecuteAction={executeAction}
            onFlushPendingEdits={async () => {
              if (window.confirm("Có thay đổi chưa lưu. Bạn có muốn bỏ qua chúng để tiếp tục thao tác không?")) {
                setPendingCellEdits([]);
                return true;
              }
              return false;
            }}
          />
        </div>

        {/* Phần Phải: Nhật ký (chiếm 1/4) */}
        <div className="xl:col-span-1">
          <div className={CARD + " h-full max-h-[600px] flex flex-col sticky top-4"}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className={`${TEXT.sectionTitle} flex items-center gap-2 mb-0`}>
                <CheckCircle2 className="w-5 h-5 text-forest" /> Nhật ký thao tác
              </h3>
              <span className="text-xs font-medium bg-sage/30 text-forest px-2 py-0.5 rounded-full">
                {actions.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted py-10 opacity-60">
                  <PlayCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm text-center">Chưa có thao tác nào.<br/>Hãy thao tác trực tiếp trên bảng.</p>
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
                           <p className="text-sm font-medium text-ink truncate">{ACTION_LABELS[act.action_type] || act.action_type}</p>
                           <p className="text-xs text-muted truncate mt-0.5">
                             Cột: <span className="font-mono bg-sage/30 px-1 rounded text-ink">{act.column}</span>
                             {act.params?.new_name && ` ➔ ${act.params.new_name}`}
                             {act.params?.value !== undefined && ` ➔ "${act.params.value}"`}
                             {act.params?.edits && ` ➔ ${act.params.edits.length} ô`}
                           </p>
                         </div>
                         <button 
                           onClick={() => handleRemoveAction(idx)}
                           className="p-1.5 text-muted hover:text-[#9F2F2D] hover:bg-[#FDEBEC] rounded transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                           title="Xóa thao tác này (Undo)"
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
    </div>
  );
}

// ─── Form Thêm Action Cũ (Thu gọn) ───────────────────────────────────────────
function AdvancedActionForm({ columns, onExecuteAction }) {
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
           <Plus className="w-4 h-4 text-forest" /> Thao tác nâng cao
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="p-3 pt-0 space-y-3 border-t border-border mt-2 bg-white">
          <div className="mt-2">
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Cột áp dụng</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full text-sm border border-border rounded p-1.5 focus:outline-none focus:border-forest"
              disabled={selectedAction === "DROP_DUPLICATES"}
            >
              <option value="">-- Chọn cột --</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">Thao tác</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full text-sm border border-border rounded p-1.5 focus:outline-none focus:border-forest"
            >
              <option value="">-- Chọn --</option>
              {Object.entries(ACTION_LABELS).filter(([k])=>k!=="BATCH_EDIT_CELLS").map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {needsParam && (
            <div>
              <label className="block text-[11px] font-medium text-muted uppercase tracking-wider mb-1">
                {selectedAction === "RENAME_COLUMN" ? "Tên cột mới" : "Giá trị điền vào"}
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
            Thêm thao tác
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: PreviewTable ──────────────────────────────────────────────

const ISSUE_TOOLTIPS = {
  missing: "Thiếu dữ liệu (missing)",
  type_mismatch: "Sai kiểu dữ liệu (type mismatch)",
  encoding: "Lỗi ký tự (encoding)"
};

function PreviewTable({ data, actions, originalColumns, isLoading, pendingCellEdits, errorCells, isFullEditMode, onAddPendingEdit, onExecuteAction, onFlushPendingEdits }) {
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, col }
  const [editValue, setEditValue] = useState("");
  const [openHeaderMenu, setOpenHeaderMenu] = useState(null); // column name
  const [renamingCol, setRenamingCol] = useState(null); // column name
  const [renameValue, setRenameValue] = useState("");

  const rowsPerPage = 10;
  if (!data || data.length === 0) return (
     <div className={CARD + " h-full flex items-center justify-center min-h-[400px] relative"}>
       {isLoading ? (
          <div className="flex flex-col items-center text-muted animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-forest border-t-transparent animate-spin mb-3" />
            <p className="text-sm">Đang tải dữ liệu...</p>
          </div>
       ) : (
          <p className="text-muted text-sm">Không có dữ liệu hiển thị.</p>
       )}
     </div>
  );

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const currentData = data.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  
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
  const displayCols = [...activeCols];
  droppedCols.forEach(col => {
    if (!displayCols.includes(col)) displayCols.push(col);
  });

  const getCellStatus = (rowId, col) => {
    // 1. Check if pending
    const pending = pendingCellEdits.find(e => e.row_id === rowId && e.column === col);
    if (pending) return { type: "pending", value: pending.new_value };
    
    // 2. Check if confirmed edit (in BATCH_EDIT_CELLS actions)
    const confirmed = BATCHED_EDITS.find(e => e.row_id === rowId && e.column === col);
    if (confirmed) return { type: "confirmed", value: confirmed.new_value }; // wait, the backend actually returns the updated value in `data`. But we can mark it as confirmed.
    
    // 3. Check if error
    const err = errorCells.find(e => e.row_id === rowId && e.column === col);
    if (err) return { type: "error", issue: err.issue_type };
    
    return { type: "normal" };
  };

  const handleCellClick = (idx, col, status, isDropped) => {
    if (isDropped) return;
    
    // Guided mode: only error cells can be clicked. Full mode: all can be clicked
    const canEdit = isFullEditMode || status.type === "error" || status.type === "pending" || status.type === "confirmed";
    if (!canEdit) return;

    setEditingCell({ rowIdx: idx, col });
    
    // Initialize edit value
    const rowId = currentData[idx].original_index;
    const pending = pendingCellEdits.find(e => e.row_id === rowId && e.column === col);
    setEditValue(pending ? pending.new_value : (currentData[idx][col] === null ? "" : currentData[idx][col]));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { rowIdx, col } = editingCell;
    const rowId = currentData[rowIdx].original_index;
    
    if (rowId !== undefined) {
       // Validate on client simply (no need for complex validation, just pass to backend, 
       // but we could prevent empty string for numbers etc. Here we just let backend catch it 
       // or we just save it)
       onAddPendingEdit({ row_id: rowId, column: col, new_value: editValue });
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
  
  const handlePageChange = async (newPage) => {
     if (pendingCellEdits.length > 0) {
        const flushed = await onFlushPendingEdits();
        if (!flushed) return; // Nếu flush thất bại thì không chuyển trang để user sửa
     }
     setPage(newPage);
  };

  return (
    <div className={CARD + " h-full flex flex-col relative"}>
      {isLoading && (
         <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-[1px] rounded-2xl">
            <div className="bg-white p-3 rounded-lg shadow-lg flex items-center gap-3 border border-border">
               <div className="w-5 h-5 rounded-full border-2 border-forest border-t-transparent animate-spin" />
               <span className="text-sm font-medium text-ink">Đang tải...</span>
            </div>
         </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className={`${TEXT.sectionTitle} flex items-center gap-2 mb-0`}>
          Bảng dữ liệu
          <span className="text-xs font-normal text-muted bg-gray-100 px-2 py-0.5 rounded-full">
            {isFullEditMode ? "Chế độ Full-Edit" : "Guided Mode (Chỉ sửa ô lỗi)"}
          </span>
        </h3>
        {pendingCellEdits.length > 0 && (
           <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full animate-pulse">
              Đang chờ đồng bộ {pendingCellEdits.length} ô...
           </span>
        )}
      </div>

      <div className="overflow-x-auto border border-border rounded-lg bg-white min-h-[400px] max-h-[600px] overflow-y-auto relative flex-1">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#F9F9F8] border-b border-border sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-semibold text-ink w-12 text-center bg-[#F9F9F8]">#</th>
              {displayCols.map(col => {
                const isDropped = droppedCols.has(col);
                const isRenamed = renamedCols[col];
                
                return (
                  <th key={col} className={`px-4 py-2 font-semibold bg-[#F9F9F8] ${isDropped ? "text-gray-400" : "text-ink"}`}>
                    <div className="flex items-center justify-between group/header min-w-[80px]">
                      {renamingCol === col ? (
                         <input 
                           autoFocus
                           type="text"
                           value={renameValue}
                           onChange={e => setRenameValue(e.target.value)}
                           onBlur={() => handleRenameSubmit(col)}
                           onKeyDown={e => { if(e.key === "Enter") handleRenameSubmit(col); if(e.key === "Escape") setRenamingCol(null); }}
                           className="w-[120px] border border-forest rounded px-1 py-0.5 text-sm font-normal text-ink outline-none"
                         />
                      ) : (
                         <div className="flex items-center gap-1">
                           <span className={isDropped ? "line-through" : ""}>{col}</span>
                           {isDropped && <span className="text-[10px] text-red-500 font-normal border border-red-200 bg-red-50 px-1 py-0.5 rounded">Đã xóa</span>}
                           {isRenamed && <span className="text-[10px] text-blue-600 font-normal border border-blue-200 bg-blue-50 px-1 py-0.5 rounded" title={`Tên cũ: ${isRenamed}`}>Đã đổi tên</span>}
                         </div>
                      )}
                      
                      {!isDropped && renamingCol !== col && (
                         <div className="relative ml-2">
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
                                    <button onClick={() => { setRenamingCol(col); setRenameValue(col); setOpenHeaderMenu(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2">
                                       <Edit2 className="w-3.5 h-3.5 text-muted" /> Đổi tên cột
                                    </button>
                                    <div className="h-px bg-border my-1" />
                                    <button onClick={() => handleHeaderAction(col, "FILL_MISSING_MEAN")} className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2">
                                       <AlignLeft className="w-3.5 h-3.5 text-muted" /> Điền rỗng (Trung bình)
                                    </button>
                                    <button onClick={() => handleHeaderAction(col, "FILL_MISSING_UNKNOWN")} className="w-full text-left px-3 py-2 text-xs hover:bg-sage/20 text-ink flex items-center gap-2">
                                       <AlignLeft className="w-3.5 h-3.5 text-muted" /> Điền rỗng ("Không xác định")
                                    </button>
                                    <div className="h-px bg-border my-1" />
                                    <button onClick={() => handleHeaderAction(col, "DROP_COLUMN")} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2">
                                       <Trash2 className="w-3.5 h-3.5 text-red-500" /> Xóa cột
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
          <tbody>
            {currentData.map((row, idx) => (
              <tr key={idx} className="border-b border-border last:border-0 hover:bg-sage/10 transition-colors">
                <td className="px-4 py-2 text-muted text-center border-r border-border/50 bg-[#F9F9F8]/50">
                  {row.original_index !== undefined ? row.original_index : (page - 1) * rowsPerPage + idx + 1}
                </td>
                {displayCols.map(col => {
                  const isDropped = droppedCols.has(col);
                  if (isDropped) {
                    return <td key={col} className="px-4 py-2 text-gray-300 bg-gray-50/50 italic">-</td>;
                  }
                  
                  const rowId = row.original_index;
                  const status = getCellStatus(rowId, col);
                  const isEditing = editingCell?.rowIdx === idx && editingCell?.col === col;
                  
                  // Value to display
                  let displayVal = row[col];
                  if (status.type === "pending") displayVal = status.value;
                  
                  const isNull = displayVal === null || displayVal === undefined;
                  
                  // Style logic
                  let cellClasses = "px-4 py-2 truncate max-w-[200px] transition-colors ";
                  let tooltip = null;
                  
                  if (status.type === "pending") {
                     cellClasses += "bg-blue-50/80 text-blue-900 border-x border-blue-200 font-medium cursor-pointer";
                     tooltip = "Đang chờ đồng bộ...";
                  } else if (status.type === "confirmed") {
                     cellClasses += "bg-[#FEF9C3]/80 text-amber-900 cursor-pointer hover:border-amber-300 border border-transparent";
                     tooltip = "Đã sửa thủ công (Server đã áp dụng)";
                  } else if (status.type === "error") {
                     cellClasses += "bg-red-50/80 text-red-900 cursor-pointer border border-transparent hover:border-red-300";
                     tooltip = ISSUE_TOOLTIPS[status.issue] || "Lỗi dữ liệu";
                  } else {
                     cellClasses += "text-muted ";
                     if (isFullEditMode) {
                        cellClasses += "cursor-pointer border border-transparent hover:border-gray-300 hover:bg-gray-50";
                        tooltip = "Nhấn để sửa";
                     } else {
                        tooltip = !isNull ? String(displayVal) : null;
                     }
                  }

                  return (
                    <td 
                      key={col} 
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
                          onBlur={handleCellSave}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCellSave();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full bg-white border border-forest rounded px-1 py-0.5 text-ink outline-none text-sm"
                        />
                      ) : (
                        !isNull ? String(displayVal) : <span className="text-gray-400 italic flex items-center gap-1">null <MousePointerClick className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-muted">Trang {page} / {totalPages} (Mẫu {data.length} dòng)</span>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-white border border-border rounded text-sm disabled:opacity-50 hover:bg-sage/20 transition-all text-ink font-medium"
          >
            Trước
          </button>
          <button
            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-white border border-border rounded text-sm disabled:opacity-50 hover:bg-sage/20 transition-all text-ink font-medium"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
