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

// ─── Helpers ────────────────────────────────────────────────────────────────

const STEPS = ["detecting", "choosing_mode", "cleaning", "reviewing_diff", "confirmed"];

function IssueCountBadge({ count, label, color }) {
  if (count === 0) return null;
  const colors = {
    red: "bg-[#FDEBEC] text-[#9F2F2D] border border-[#f5c6cb]",
    yellow: "bg-[#FBF3DB] text-[#956400] border border-[#f0dda0]",
    orange: "bg-[#FFF0E6] text-[#A84300] border border-[#ffd0aa]",
    blue: "bg-[#E1F3FE] text-[#1F6C9F] border border-[#b3d9f8]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
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
    <div className={`border border-border rounded-xl p-5 bg-white ${className}`}>
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

  if (!issues.has_issues) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <p className="font-medium text-ink">Dữ liệu sạch!</p>
            <p className="text-sm text-muted mt-0.5">
              Không phát hiện vấn đề nào. Bạn vẫn có thể xác nhận và chuyển sang bước tiếp theo.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Kết quả quét dữ liệu</SectionTitle>
      <div className="flex flex-wrap gap-2 mb-4">
        <IssueCountBadge count={missingCount} label="cột có giá trị thiếu" color="red" />
        <IssueCountBadge count={wrongTypeCount} label="cột sai kiểu" color="yellow" />
        <IssueCountBadge count={encodingCount} label="cột lỗi encoding" color="orange" />
        <IssueCountBadge count={dupCount} label="dòng trùng" color="blue" />
      </div>

      {/* Missing values detail */}
      {missingCount > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink mb-1.5">Giá trị thiếu theo cột:</p>
          <div className="space-y-1">
            {issues.missing_values.slice(0, 6).map((m) => (
              <div key={m.column} className="flex items-center justify-between text-xs">
                <code className="font-mono text-ink bg-[#F9F9F8] px-1.5 py-0.5 rounded">
                  {m.column}
                </code>
                <div className="flex items-center gap-2 text-muted">
                  <span>{m.null_count} ô ({m.null_pct}%)</span>
                  <span className="text-[#956400] bg-[#FBF3DB] px-1.5 py-0.5 rounded">
                    Gợi ý: {m.suggested_fill}
                  </span>
                </div>
              </div>
            ))}
            {missingCount > 6 && (
              <p className="text-xs text-muted">...và {missingCount - 6} cột khác</p>
            )}
          </div>
        </div>
      )}

      {/* Wrong type detail */}
      {wrongTypeCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-ink mb-1.5">Cột sai kiểu dữ liệu:</p>
          <div className="space-y-1">
            {issues.wrong_types.map((w) => (
              <div key={w.column} className="flex items-center justify-between text-xs">
                <code className="font-mono text-ink bg-[#F9F9F8] px-1.5 py-0.5 rounded">
                  {w.column}
                </code>
                <span className="text-muted">
                  {w.current_dtype} → float ({w.convertible_pct}% parse được)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicates */}
      {dupCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted">
            Phát hiện <span className="font-semibold text-ink">{dupCount}</span> dòng trùng lặp
            trong tổng số <span className="font-semibold text-ink">{issues.total_rows}</span> dòng —
            sẽ xóa và giữ dòng đầu tiên.
          </p>
        </div>
      )}
    </Card>
  );
}

function ModeSelector({ onSelect }) {
  return (
    <Card>
      <SectionTitle>Chọn chế độ làm sạch</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Auto Clean */}
        <button
          id="clean-mode-auto-btn"
          onClick={() => onSelect("auto")}
          className="
            text-left p-4 rounded-xl border-2 border-border
            hover:border-[#1B4324] hover:bg-sage/30 transition-all group
          "
        >
          <div className="text-lg mb-2">⚡</div>
          <p className="font-medium text-ink text-sm">Làm sạch tự động</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Hệ thống tự xử lý theo quy tắc mặc định (bao gồm tự xóa cột rỗng). Nhanh nhất.
          </p>
        </button>

        {/* Manual Edit */}
        <button
          id="clean-mode-manual-btn"
          onClick={() => onSelect("manual")}
          className="
            text-left p-4 rounded-xl border-2 border-border
            hover:border-[#1B4324] hover:bg-sage/30 transition-all group
          "
        >
          <div className="text-lg mb-2">✏️</div>
          <p className="font-medium text-ink text-sm">Chỉnh sửa thủ công</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Chỉnh sửa trực tiếp trên bảng dữ liệu. Toàn quyền kiểm soát.
          </p>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[#E1F3FE] text-[#1F6C9F]">
            Sắp ra mắt
          </span>
        </button>

        {/* Guided Fix */}
        <button
          id="clean-mode-guided-btn"
          disabled
          className="
            text-left p-4 rounded-xl border-2 border-border
            opacity-50 cursor-not-allowed
          "
        >
          <div className="text-lg mb-2">🧭</div>
          <p className="font-medium text-ink text-sm">Hướng dẫn xử lý</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Xử lý từng vấn đề một theo hướng dẫn. Linh hoạt nhất.
          </p>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[#F9F9F8] text-muted border border-border">
            Sắp ra mắt
          </span>
        </button>

      </div>
    </Card>
  );
}

function DiffReportView({ diff, filename, onConfirm, onBack, confirming }) {
  const rows = [
    { label: "Dòng trùng bị xóa", value: diff.duplicate_rows_removed, warn: diff.duplicate_rows_removed > 0 },
    { label: "Dòng còn lại", value: `${diff.original_rows} → ${diff.clean_rows}` },
    { label: "Cột còn lại", value: `${diff.original_cols} → ${diff.clean_cols}` },
  ];

  const missingEntries = Object.entries(diff.missing_filled || {});
  const typeEntries = Object.entries(diff.types_converted || {});
  const encodingEntries = Object.entries(diff.encoding_fixed || {});
  const droppedColumns = diff.columns_dropped || [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Báo cáo thay đổi (Diff Report)</SectionTitle>

        {/* Tóm tắt chính */}
        <div className="grid grid-cols-3 gap-3 mb-4">
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

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <button
          id="cleaner-back-to-mode-btn"
          onClick={onBack}
          className="text-sm text-muted hover:text-ink border border-border rounded-lg px-4 py-2 hover:bg-[#F9F9F8] transition-colors"
        >
          ← Chọn lại chế độ
        </button>
        <button
          id="cleaner-confirm-btn"
          onClick={onConfirm}
          disabled={confirming}
          className="
            flex items-center gap-2 bg-[#1B4324] text-white text-sm font-medium
            px-6 py-2.5 rounded-lg hover:bg-[#163820] transition-colors
            disabled:opacity-60 disabled:cursor-not-allowed
          "
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
            <>Xác nhận dùng bản này ✓</>
          )}
        </button>
      </div>
    </div>
  );
}

function ConfirmedView({ result, onGoHome, onGoVisualize }) {
  const summary = result.summary_for_module3;
  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="border border-[#c8e0cb] rounded-xl p-5 bg-sage">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✓</span>
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

      {/* Next steps */}
      <div className="flex items-center justify-between gap-3">
        <button
          id="cleaner-go-home-btn"
          onClick={onGoHome}
          className="text-sm text-muted hover:text-ink border border-border rounded-lg px-4 py-2 hover:bg-[#F9F9F8] transition-colors"
        >
          ← Về trang chủ
        </button>
        <button
          id="cleaner-go-module3-btn"
          onClick={onGoVisualize}
          className="
            flex items-center gap-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium
            px-6 py-2.5 rounded-lg border border-transparent transition-all shadow-md shadow-violet-500/20
          "
        >
          Trực quan hóa dữ liệu →
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

export default function Cleaner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const { fileSession, updateFileSession } = useFileSession();

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
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("Đang quét vấn đề dữ liệu...");
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      showToast("Chỉ chấp nhận file .csv, .xlsx, .xls", "error");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const res = await profileFile(file);
      setFileHash(res.data.file_hash);
      setFileName(file.name);
      setOverrides({});
      showToast("Upload thành công! Đang quét lỗi...", "success");
    } catch (err) {
      showToast("Có lỗi xảy ra khi upload file.", "error");
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
      setStep("choosing_mode");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Không thể quét dữ liệu.";
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    }
  };

  const handleModeSelect = async (mode) => {
    if (mode === "manual") {
      showToast("Tính năng đang được phát triển.", "info");
      return;
    }
    setSelectedMode(mode);
    try {
      setLoadingMsg("Đang tự động làm sạch dữ liệu...");
      setStep("cleaning");
      const res = await autoClean(fileHash, overrides);
      setDiffReport(res.data.diff_report);
      setStep("reviewing_diff");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Có lỗi khi làm sạch dữ liệu.";
      setError(msg);
      showToast(msg, "error");
      setStep("error");
    }
  };

  const handleConfirmClean = async () => {
    setConfirming(true);
    try {
      const res = await confirmClean(fileHash, selectedMode || "auto", overrides);
      setConfirmedResult(res.data);
      setStep("confirmed");
      showToast("Clean Dataset đã được chốt!", "success");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Không thể lưu Clean Dataset.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between bg-white sticky top-0 z-10">
        <button
          onClick={() => navigate(fileHash ? "/ua_profiler" : "/home")}
          className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1.5"
        >
          ← {fileHash ? "Profiler" : "Trang chủ"}
        </button>
        <span className="text-sm font-medium text-ink">
          {fileName ? `Đang làm sạch: ${fileName}` : "Công cụ Làm sạch Dữ liệu"}
        </span>

        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
          {[
            { key: "detecting", label: "Quét" },
            { key: "choosing_mode", label: "Chọn chế độ" },
            { key: "reviewing_diff", label: "Xem trước" },
            { key: "confirmed", label: "Hoàn tất" },
          ].map((s, i, arr) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`
                ${step === s.key ? "text-forest font-semibold" : ""}
                ${STEPS.indexOf(step) > STEPS.indexOf(s.key) ? "text-ink" : ""}
              `}>
                {s.label}
              </span>
              {i < arr.length - 1 && <span className="text-border">›</span>}
            </span>
          ))}
        </div>
      </header>

      <div className="px-6 py-10 max-w-3xl mx-auto">

        {/* Upload Zone (Nếu chưa có fileHash) */}
        {!fileHash ? (
          <div className="text-center py-12">
            <h1 className="font-serif text-3xl tracking-tight mb-2">Làm sạch dữ liệu</h1>
            <p className="text-muted text-sm mb-10">Tải file của bạn lên để bắt đầu quét và sửa lỗi dữ liệu tự động.</p>

            <div
              className={`
                border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors mx-auto bg-white
                ${isDragging ? "border-forest bg-sage" : "border-border hover:border-forest hover:bg-sage/40"}
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
              />
              {isUploading ? (
                <LoadingStep message="Đang upload và phân tích file..." />
              ) : (
                <div className="text-muted text-sm">
                  <div className="text-3xl mb-3">🧹</div>
                  <span className="block mb-1 text-ink font-medium">Kéo thả file vào đây để làm sạch</span>
                  hoặc click để chọn file &mdash; CSV, XLSX, XLS (tối đa 10MB)
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Page title */}
            <div className="mb-8">
              <h1 className="font-serif text-3xl tracking-tight mb-1">Làm sạch dữ liệu</h1>
              <p className="text-muted text-sm">
                <span className="font-medium text-ink">{fileName}</span>
              </p>
            </div>

            {/* Error inline */}
            {error && (
              <div className="mb-6 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start gap-2">
                <span className="shrink-0">⚠</span>
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
                <div className="text-4xl mb-4">⚠️</div>
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
                    className="text-sm border border-border rounded-lg px-4 py-2 hover:bg-[#F9F9F8] transition-colors"
                  >
                    Upload file khác
                  </button>
                  <button
                    onClick={() => navigate("/ua_profiler")}
                    className="bg-[#1B4324] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163820] transition-colors shadow-sm"
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

            {/* ── Step: choosing_mode ── */}
            {step === "choosing_mode" && issues && (
              <div className="space-y-4">
                <IssuesSummary issues={issues} />
                <ModeSelector onSelect={handleModeSelect} />
              </div>
            )}

            {/* ── Step: reviewing_diff ── */}
            {step === "reviewing_diff" && diffReport && (
              <DiffReportView
                diff={diffReport}
                filename={fileName}
                onConfirm={handleConfirmClean}
                onBack={() => setStep("choosing_mode")}
                confirming={confirming}
              />
            )}

            {step === "confirmed" && confirmedResult && (
              <ConfirmedView
                result={confirmedResult}
                onGoHome={() => navigate("/home")}
                onGoVisualize={() => {
                  updateFileSession({ sessionId: confirmedResult.session_id });
                  navigate("/ua_visualize");
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
