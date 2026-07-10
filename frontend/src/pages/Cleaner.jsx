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

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import { profileFile } from "../services/profilerService";
import { useToast } from "../contexts/ToastContext";
import { ArrowRight, ArrowLeft, Info, CheckCircle, AlertTriangle, Upload, RefreshCw, Eye, MousePointerClick, ShieldCheck, Save, Clock, FolderUp, Download, Lock, Zap, PenTool, Compass, Wand2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageHelpDocs from "../components/PageHelpDocs";
import ManualCleanWorkspace from "../components/cleaner/ManualCleanWorkspace";
import { TEXT, PAGE, BTN, CARD, BADGE } from "../constants/ui";

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

function IssuesSummary({ issues }) {
  const missingCount = issues.missing_values?.length ?? 0;
  const wrongTypeCount = issues.wrong_types?.length ?? 0;
  const encodingCount = issues.encoding_errors?.length ?? 0;
  const dupCount = issues.duplicates?.duplicate_count ?? 0;
  const semanticCount = issues.semantic_errors?.length ?? 0;
  
  const structuralCount = missingCount + wrongTypeCount + encodingCount + (dupCount > 0 ? 1 : 0);

  if (!issues.has_issues) {
    return (
      <div className="bg-sage/30 border border-[#c8e0cb] rounded-lg p-3 text-sm text-forest flex items-center gap-2">
        <CheckCircle className="w-5 h-5 shrink-0" />
        Dữ liệu sạch! Không phát hiện vấn đề cấu trúc hay ngữ nghĩa nào.
      </div>
    );
  }

  return (
    <div className="bg-[#FBF3DB] border border-[#f0dda0] rounded-lg p-3 text-sm text-[#956400] flex items-center gap-2">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span>
        Phát hiện <strong>{structuralCount}</strong> lỗi cấu trúc
        {semanticCount > 0 ? (
          <> và <strong>{semanticCount}</strong> lỗi ngữ nghĩa</>
        ) : ""} cần xem xét.
      </span>
    </div>
  );
}

function CleanerActionBar({ onAutoClean, onManualClean }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
      <button
        id="clean-mode-auto-btn"
        onClick={onAutoClean}
        className={`${BTN.primary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
      >
        <Zap className="w-5 h-5" /> Tự động sửa
      </button>
      <button
        id="clean-mode-manual-btn"
        onClick={onManualClean}
        className={`${BTN.secondary} flex-1 justify-center py-3 text-base flex items-center gap-2`}
      >
        <PenTool className="w-5 h-5" /> Sửa thủ công
      </button>
    </div>
  );
}
function PreviewTable({ data, errorCells = [], title = "Bảng dữ liệu xem trước" }) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  if (!data || data.length === 0) return null;

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const currentData = data.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  // Hide original_index from columns if it exists
  const columns = Object.keys(data[0] || {}).filter(c => c !== "original_index");

  return (
    <Card className="mt-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto border border-border rounded-lg mt-3 bg-white">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#F9F9F8] border-b border-border">
            <tr>
              <th className="px-4 py-2 font-semibold text-ink w-12 text-center">#</th>
              {columns.map(col => (
                <th key={col} className="px-4 py-2 font-semibold text-ink">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, idx) => (
              <tr key={idx} className="border-b border-border last:border-0 hover:bg-sage/10 transition-colors">
                <td className="px-4 py-2 text-muted text-center border-r border-border/50 bg-[#F9F9F8]/50">
                  {row.original_index !== undefined ? row.original_index : (page - 1) * rowsPerPage + idx + 1}
                </td>
                {columns.map(col => {
                  let cellClasses = "px-4 py-2 truncate max-w-[200px] text-muted";
                  const rowId = row.original_index;
                  
                  if (rowId !== undefined) {
                    const cellError = errorCells.find(e => e.row_id === rowId && e.column === col);
                    if (cellError) {
                      if (cellError.severity === "error") {
                        cellClasses = "px-4 py-2 truncate max-w-[200px] bg-red-50 text-red-900 border border-red-200";
                      } else {
                        cellClasses = "px-4 py-2 truncate max-w-[200px] bg-[#FEF9C3]/80 text-amber-900 border border-[#FEF08A]";
                      }
                    }
                  }

                  return (
                    <td key={col} className={cellClasses} title={row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-gray-400 italic">null</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted">Trang {page} / {totalPages} (Mẫu {data.length} dòng)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white border border-border rounded text-sm disabled:opacity-50 hover:bg-sage/20 transition-all text-ink font-medium"
            >
              Trang trước
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white border border-border rounded text-sm disabled:opacity-50 hover:bg-sage/20 transition-all text-ink font-medium"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function DiffReportView({ diff, validationState, filename, previewData, errorCells = [], onConfirm, onBack, confirming, onManualClean }) {
  const rows = [
    { label: "Dòng trùng bị xóa", value: diff.duplicate_rows_removed, warn: diff.duplicate_rows_removed > 0 },
    { label: "Dòng còn lại", value: `${diff.original_rows} → ${diff.clean_rows}` },
    { label: "Cột còn lại", value: `${diff.original_cols} → ${diff.clean_cols}` },
  ];

  const missingEntries = Object.entries(diff.missing_filled || {});
  const typeEntries = Object.entries(diff.types_converted || {});
  const encodingEntries = Object.entries(diff.encoding_fixed || {});
  const droppedColumns = diff.columns_dropped || [];

  const semanticErrorsCount = errorCells.filter(e => e.severity === "error").length;
  const semanticHintsCount = errorCells.filter(e => e.severity === "hint").length;
  const hasSemanticIssues = semanticErrorsCount > 0 || semanticHintsCount > 0;
  
  const structuralFixedCount = Object.values(diff.missing_filled || {}).reduce((a,b)=>a+b,0) + 
                               Object.keys(diff.types_converted || {}).length + 
                               Object.values(diff.encoding_fixed || {}).reduce((a,b)=>a+b,0) + 
                               diff.duplicate_rows_removed;

  return (
    <div className="space-y-4">
      {/* Semantic Issues Banner */}
      {hasSemanticIssues && (
        <div className="bg-[#FFF0E6] border border-[#ffd0aa] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#A84300] mt-0.5" />
            <div>
              <p className="font-semibold text-[#A84300] text-sm">
                Auto-clean đã xử lý {structuralFixedCount} lỗi cấu trúc.
              </p>
              <p className="text-xs text-[#A84300]/80 mt-0.5">
                Phát hiện thêm {hasSemanticIssues} lỗi ngữ nghĩa ({semanticErrorsCount} lỗi, {semanticHintsCount} cảnh báo) cần xem xét thủ công.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <SectionTitle>Báo cáo thay đổi (Diff Report)</SectionTitle>

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

        {/* Dropped columns */}
        {droppedColumns.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink mb-1.5">Cột đã xóa (do rỗng trên 90%):</p>
            <div className="flex flex-wrap gap-1.5">
              {droppedColumns.map((col) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-[#FDEBEC] text-[#9F2F2D] border border-[#f5c6cb]">
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing filled */}
        {missingEntries.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink mb-1.5">Giá trị thiếu đã điền:</p>
            <div className="flex flex-wrap gap-1.5">
              {missingEntries.map(([col, cnt]) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-sage text-forest border border-[#c8e0cb]">
                  {col}: {cnt} ô
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Types converted */}
        {typeEntries.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink mb-1.5">Kiểu dữ liệu đã chuyển đổi:</p>
            <div className="flex flex-wrap gap-1.5">
              {typeEntries.map(([col, change]) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-[#FBF3DB] text-[#956400] border border-[#f0dda0]">
                  {col}: {change}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Encoding fixed */}
        {encodingEntries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-ink mb-1.5">Ký tự lỗi đã xử lý:</p>
            <div className="flex flex-wrap gap-1.5">
              {encodingEntries.map(([col, cnt]) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-[#FFF0E6] text-[#A84300] border border-[#ffd0aa]">
                  {col}: {cnt} ô
                </span>
              ))}
            </div>
          </div>
        )}

        {missingEntries.length === 0 && typeEntries.length === 0 && encodingEntries.length === 0 && diff.duplicate_rows_removed === 0 && droppedColumns.length === 0 && (
          <p className="text-sm text-muted">Không có thay đổi nào được thực hiện.</p>
        )}
      </Card>

      {/* Warnings Banner */}
      {validationState?.warnings?.length > 0 && (
        <div className="bg-[#FBF3DB] border border-[#f0dda0] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-[#956400] text-sm mb-1">Cảnh báo về chất lượng dữ liệu</p>
              <ul className="space-y-1">
                {validationState.warnings.map(w => (
                  <li key={w.code} className="text-xs text-[#956400]/80">
                    <span className="font-medium">• {w.message}</span>
                    {w.impact && <span className="block ml-2 opacity-80 mt-0.5">↳ Ảnh hưởng: {w.impact}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <PreviewTable data={previewData} errorCells={errorCells} title="Bảng dữ liệu đã xử lý (Auto-Clean)" />

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          id="cleaner-back-to-mode-btn"
          onClick={onBack}
          className={`${BTN.secondary} flex items-center gap-2 max-sm:w-full justify-center`}
        >
          <ArrowLeft className="w-4 h-4 inline-block mr-1" /> Chọn lại chế độ
        </button>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onManualClean}
            className={`${BTN.secondary} flex items-center gap-2 max-sm:w-full justify-center`}
          >
            <Wand2 className="w-4 h-4 inline-block mr-1" /> Sửa thủ công tiếp
          </button>
          <button
            id="cleaner-confirm-btn"
            onClick={onConfirm}
            disabled={confirming}
            className={`${BTN.primary} flex items-center gap-2 max-sm:w-full justify-center`}
          >
            {confirming ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Đang lưu...
              </>
            ) : (
              <>Xác nhận dùng bản này <CheckCircle className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmedView({ result, previewData, onGoHome, onGoVisualize }) {
  const summary = result.summary_for_module3;
  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="border border-[#c8e0cb] rounded-xl p-5 bg-sage">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-forest" />
          <div>
            <p className="font-medium text-forest">Clean Dataset đã được chốt!</p>
            <p className="text-sm text-forest/70 mt-0.5">
              File đã được làm sạch và lưu thành công. Sẵn sàng cho Module 3.
            </p>
          </div>
        </div>
      </div>

      {/* Summary for Module 3 */}
      <Card>
        <SectionTitle>Tóm tắt chuyển sang Module 3</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Dòng dữ liệu", value: summary?.shape?.[0]?.toLocaleString() ?? "—" },
            { label: "Cột dữ liệu", value: summary?.shape?.[1] ?? "—" },
            { label: "Cột số", value: summary?.numeric_columns?.length ?? "—" },
            { label: "Cột phân loại", value: summary?.categorical_columns?.length ?? "—" },
          ].map((s) => (
            <div key={s.label} className="text-center py-3 rounded-lg bg-[#F9F9F8] border border-border">
              <p className="text-lg font-semibold font-mono text-ink">{s.value}</p>
              <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Session info */}
        <div className="text-xs text-muted space-y-0.5 pt-3 border-t border-border">
          <p>Session ID: <code className="font-mono bg-[#F9F9F8] px-1 rounded">{result.session_id.slice(0, 12)}...</code></p>
          <p>Chế độ: <span className="font-medium text-ink">{result.clean_mode === "auto" ? "Làm sạch tự động" : "Chỉnh sửa thủ công"}</span></p>
          <p>Xác nhận lúc: <span className="font-medium text-ink">{new Date(result.confirmed_at).toLocaleString("vi-VN")}</span></p>
        </div>
      </Card>

      {/* Preview Table */}
      <PreviewTable data={previewData} />

      {/* Next steps */}
      <div className="flex items-center justify-between gap-3">
        <button
          id="cleaner-go-home-btn"
          onClick={onGoHome}
          className={`${BTN.secondary} flex items-center gap-2`}
        >
          <ArrowLeft className="w-4 h-4 inline-block mr-1" /> Về trang chủ
        </button>
        <button
          id="cleaner-go-module3-btn"
          onClick={onGoVisualize}
          className={`${BTN.primary} flex items-center gap-2`}
        >
          Trực quan hóa dữ liệu <ArrowRight className="w-4 h-4 inline-block ml-1" />
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
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

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
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState("Đang quét vấn đề dữ liệu...");
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      showToast("Định dạng file không hợp lệ. Vui lòng tải lên file Excel (.xlsx, .xls) hoặc CSV.", "error");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const res = await profileFile(file);
      setFileHash(res.data.file_hash);
      setFileName(file.name);
      setProfileData(res.data);
      setOverrides({});
      showToast("Tải file lên thành công! Hệ thống đang tiến hành kiểm tra...", "success");
    } catch (err) {
      showToast("Không thể tải file lên. Vui lòng kiểm tra lại kết nối mạng hoặc thử file khác.", "error");
      setError("Không thể upload file. Vui lòng thử lại.");
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
    try {
      const res = await detectIssues(fileHash, overrides);
      setIssues(res.data);
      setPreviewData(res.data.preview_data || []);
      setStep("previewing_issues");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Không thể quét dữ liệu. Vui lòng thử lại sau.";
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    }
  };

  const handleModeSelect = async (mode) => {
    setSelectedMode(mode);
    if (mode === "manual") {
      setStep("manual_workspace");
      return;
    }

    try {
      setLoadingMsg("Đang tự động làm sạch dữ liệu...");
      setStep("cleaning");
      const finalOverrides = Object.fromEntries(Object.entries(overrides).filter(([_, v]) => v !== "auto"));
      console.log("auto-clean payload:", JSON.stringify({ file_hash: fileHash, overridden_types: finalOverrides }));
      const res = await autoClean(fileHash, finalOverrides);
      setDiffReport(res.data.diff_report);
      setPreviewData(res.data.preview_data || []);
      setAutoCleanErrorCells(res.data.error_cells || []);
      // Nếu có lỗi cứng, server đã quăng 422, hoặc trả về validation=False (tùy cài đặt)
      if (res.data.validation && !res.data.validation.can_proceed) {
        const err = res.data.validation.hard_blocks[0]?.message || "Dữ liệu gặp sự cố nghiêm trọng không thể tự động khắc phục.";
        setError(err);
        showToast(err, "error");
        setStep("error");
        return;
      }

      // Update session with validation capabilities/warnings early or wait for confirm
      setValidationState(res.data.validation);
      
      // Chuyển sang reviewing_diff, UI hiển thị PreviewTable của dữ liệu ĐÃ CLEAN (previewData)
      // kèm DiffReportView. Nếu errorCells còn semantic error, DiffReportView sẽ hiển thị banner.
      setStep("reviewing_diff");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Không thể tự động làm sạch dữ liệu. Vui lòng thử lại sau.";
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    }
  };

  const handleConfirmClean = async (manualActions = []) => {
    setConfirming(true);
    try {
      const res = await confirmClean(fileHash, selectedMode || "auto", overrides, manualActions);
      setConfirmedResult(res.data);
      setStep("confirmed");
      showToast("Đã hoàn tất làm sạch dữ liệu! Bạn có thể tiếp tục bước tiếp theo.", "success");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Không thể lưu dữ liệu đã làm sạch. Vui lòng thử lại.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <div className={PAGE.wrapper}>
        <PageHeader
          title="Làm sạch dữ liệu"
          subtitle={fileName ? `Đang làm sạch: ${fileName}` : "Sửa lỗi dữ liệu tự động"}
          actions={
            <div className="flex items-center gap-3">
              <PageHelpDocs pageId="cleaner" />
              {!pipelineMode && (
                <>
                  <button
                    onClick={() => navigate(fileHash ? "/profiler" : "/home")}
                    className={`${BTN.secondary} flex items-center gap-1.5`}
                  >
                    <ArrowLeft className="w-4 h-4" /> Quay lại
                  </button>
                  {fileHash && (
                    <button
                      onClick={() => {
                        clearFileSession();
                        setStep("detecting");
                      }}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <FolderUp className="w-4 h-4" /> Tải file khác
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        {/* Upload Zone (Nếu chưa có fileHash) */}
        {!fileHash ? (
          <div className="max-w-3xl mx-auto py-8">
            <h2 className="text-xl font-semibold text-ink mb-2">Bắt đầu làm sạch dữ liệu</h2>
            <p className="text-sm text-muted mb-6">
              Tải lên dữ liệu của bạn để hệ thống tự động quét và phân loại các vấn đề như dữ liệu bị thiếu, sai kiểu định dạng, hoặc các dòng trùng lặp.
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
                <span className="block mb-1.5 text-ink font-medium text-lg">Kéo thả file dữ liệu vào đây</span>
                hoặc click để duyệt file &mdash; hỗ trợ CSV, XLSX, XLS (tối đa 10MB)
              </div>
            </div>

            <div className="mt-8 bg-white border border-border rounded-xl p-6 shadow-sm">
              <h3 className="font-medium text-ink flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-[#1B4324]" />
                Lưu ý quá trình làm sạch
              </h3>
              <ul className="text-sm text-muted space-y-3 list-disc pl-5">
                <li><strong className="text-ink font-medium">Bảo toàn dữ liệu gốc:</strong> Quá trình làm sạch sẽ không bao giờ ghi đè lên file gốc của bạn. Dữ liệu đã làm sạch sẽ được lưu thành một phiên bản mới.</li>
                <li><strong className="text-ink font-medium">Làm sạch tự động (Auto-clean):</strong> Hệ thống sử dụng các chiến lược thông minh để điền dữ liệu thiếu, xóa các dòng trùng lặp hoàn toàn, và chuẩn hóa kiểu dữ liệu.</li>
                <li><strong className="text-ink font-medium">Kiểm soát hoàn toàn:</strong> Bạn luôn có thể xem lại "Diff Report" (Báo cáo thay đổi) chi tiết trước khi xác nhận lưu kết quả làm sạch.</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Error inline */}
            {error && (
              <div className="mb-6 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Step: detecting ── */}
            {step === "detecting" && (
              <LoadingStep message="Đang quét và phân loại vấn đề dữ liệu..." />
            )}

            {/* ── Step: error ── */}
            {step === "error" && (
              <div className="text-center py-10 bg-white border border-[#f5c6cb] rounded-xl shadow-sm">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[#9F2F2D]" />
                <h2 className="text-lg font-semibold text-[#9F2F2D] mb-2">Làm sạch dữ liệu thất bại</h2>
                <p className="text-sm text-muted whitespace-pre-line mb-6 max-w-md mx-auto leading-relaxed">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      updateFileSession({ fileHash: null, fileName: null, profileData: null, overrides: null, sessionId: null });
                      // Reset local states to prepare for a new upload
                      setStep("detecting");
                      setError(null);
                    }}
                    className={BTN.secondary}
                  >
                    Upload file khác
                  </button>
                  <button
                    onClick={() => navigate("/profiler")}
                    className={BTN.primary}
                  >
                    Xem lại dữ liệu gốc
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: cleaning ── */}
            {step === "cleaning" && (
              <LoadingStep message="Đang áp dụng rule làm sạch..." />
            )}

            {/* ── Step: previewing_issues ── */}
            {step === "previewing_issues" && issues && (
              <div className="space-y-4">
                <IssuesSummary issues={issues} />
                <PreviewTable 
                  data={previewData} 
                  errorCells={issues.error_cells || []} 
                  title="Bảng dữ liệu xem trước (Tô màu các vấn đề)"
                />
                <CleanerActionBar 
                  onAutoClean={() => handleModeSelect("auto")} 
                  onManualClean={() => handleModeSelect("manual")} 
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
                  onBack={() => setStep("previewing_issues")}
                  initialPreviewData={previewData}
                  initialErrorCells={selectedMode === "auto" ? autoCleanErrorCells : (issues?.error_cells || [])}
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
                onConfirm={() => handleConfirmClean()}
                onBack={() => setStep("previewing_issues")}
                confirming={confirming}
                onManualClean={() => setStep("manual_workspace")}
              />
            )}

            {step === "confirmed" && confirmedResult && (
              <ConfirmedView
                result={confirmedResult}
                previewData={previewData}
                onGoHome={() => navigate("/home")}
                onGoVisualize={() => {
                  updateFileSession({
                    sessionId: confirmedResult.session_id,
                    capabilities: confirmedResult.validation?.capabilities || null,
                    warnings: confirmedResult.validation?.warnings || []
                  });
                  if (pipelineMode && onComplete) onComplete();
                  else navigate("/visualize");
                }}
              />
            )}
          </>
        )}
      </div>
    </div >
  );
}
