import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { profileFile } from "../services/profilerService";
import { useToast } from "../contexts/ToastContext";

// Các kiểu cột người dùng có thể override
const COLUMN_TYPES = ["numeric", "datetime", "categorical", "text"];

// Label hiển thị thân thiện
const TYPE_LABELS = {
  numeric: "Số liệu",
  datetime: "Thời gian",
  categorical: "Danh mục",
  text: "Văn bản",
};

// Chart labels
const CHART_LABELS = {
  bar: "Cột",
  pie: "Tròn",
  line: "Đường",
  histogram: "Histogram",
};

// ── Confidence badge color ─────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100);
  let cls;
  if (pct >= 80) {
    cls = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25";
  } else if (pct >= 50) {
    cls = "bg-amber-500/15 text-amber-400 border border-amber-500/25";
  } else {
    cls = "bg-red-500/15 text-red-400 border border-red-500/25";
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {pct}% độ tin cậy
    </span>
  );
}

// ── TypeBadge ─────────────────────────────────────────────
function TypeBadge({ type }) {
  const styles = {
    numeric:     "bg-[#E1F3FE] text-[#1F6C9F]",
    datetime:    "bg-[#FBF3DB] text-[#956400]",
    categorical: "bg-sage text-forest",
    text:        "bg-[#F9F9F8] text-muted border border-border",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[type] || styles.text}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

// ── Loading Overlay ────────────────────────────────────────
function LoadingOverlay() {
  return (
    <div className="mt-10 space-y-3">
      <div className="flex items-center gap-3 text-muted text-sm">
        <svg
          className="animate-spin h-5 w-5 text-forest shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>Đang phân tích dữ liệu...</span>
      </div>
      {/* Animated progress bar */}
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        <div className="h-full bg-forest rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
      </div>
      <p className="text-xs text-muted">AI đang đọc cấu trúc dataset và nhận diện lĩnh vực...</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function Profiler() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFile, setLastFile] = useState(null);
  
  const result = fileSession.profileData;
  const overrides = fileSession.overrides || {};

  const setResult = (data) => {
    if (!data) {
      clearFileSession();
    } else {
      updateFileSession({ profileData: data, fileHash: data.file_hash, fileName: data.filename });
    }
  };
  
  const setOverrides = (data) => {
    if (typeof data === "function") {
      updateFileSession({ overrides: data(fileSession.overrides || {}) });
    } else {
      updateFileSession({ overrides: data });
    }
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleFile = async (file, forceRefresh = false) => {
    if (!file) return;

    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      const msg = "Chỉ chấp nhận file .csv, .xlsx, .xls";
      setError(msg);
      showToast(msg, "error");
      return;
    }

    setError(null);
    setResult(null);
    setOverrides({});
    setLoading(true);
    setLastFile(file);

    try {
      const res = await profileFile(file, forceRefresh);
      setResult(res.data);
      showToast(forceRefresh ? "Đã phân tích lại dữ liệu!" : "Phân tích hoàn tất!", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg;
      if (err?.response?.status === 413) {
        msg = "File quá lớn (tối đa 10MB).";
      } else if (err?.response?.status === 422) {
        msg = "File không đúng định dạng hoặc bị lỗi.";
      } else if (err?.code === "ECONNABORTED" || !err?.response) {
        msg = "Không thể kết nối đến server. Vui lòng thử lại.";
      } else {
        msg = detail || "Có lỗi xảy ra khi phân tích file.";
      }
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input để có thể upload cùng file lại
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleOverride = (colName, newType) => {
    setOverrides((prev) => ({ ...prev, [colName]: newType }));
  };

  const handleReset = () => {
    setResult(null);
    setOverrides({});
    setError(null);
  };

  const getEffectiveType = (col) => overrides[col.name] || col.detected_type;

  const handleDownloadReport = () => {
    if (!result) return;
    const reportData = JSON.stringify(result, null, 2);
    const blob = new Blob([reportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DataMind_Report_${result.filename || "file"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Đã tải báo cáo (dạng JSON). Tính năng xuất PDF đang được phát triển.", "success");
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      {/* Top nav */}
      <header className="border-b border-border px-6 py-3 flex justify-between items-center bg-white sticky top-0 z-10">
        <button
          id="profiler-back-btn"
          onClick={() => navigate("/home")}
          className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1.5"
        >
          ← Trang chủ
        </button>
        <span className="text-sm font-medium text-ink">Data Profiler</span>
        {result && (
          <button
            id="profiler-export-btn"
            onClick={handleDownloadReport}
            title="Tải báo cáo chi tiết về máy"
            className="text-xs text-ink border border-border rounded-lg px-3 py-1.5 hover:bg-[#F9F9F8] transition-colors flex items-center gap-1.5"
          >
            📥 Tải báo cáo
          </button>
        )}
        {!result && <div className="w-[72px]" />}
      </header>

      <div className="px-6 py-12 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl tracking-tight mb-1">Data Profiler</h1>
          <p className="text-muted text-sm">
            Upload file CSV hoặc Excel để phân tích cấu trúc và nhận gợi ý biểu đồ.
          </p>
        </div>

        {/* Upload zone */}
        {!result && (
          <div
            id="upload-zone"
            className={`
              border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
              ${isDragging
                ? "border-forest bg-sage"
                : "border-border hover:border-forest hover:bg-sage/40"
              }
              ${loading ? "pointer-events-none opacity-60" : ""}
            `}
            onClick={() => !loading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!loading) setIsDragging(true); }}
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
              <div className="text-3xl mb-3">📂</div>
              <span className="block mb-1 text-ink font-medium">Kéo thả file vào đây</span>
              hoặc click để chọn file &mdash; CSV, XLSX, XLS (tối đa 10MB)
            </div>
          </div>
        )}

        {/* Error inline */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingOverlay />}

        {/* Results */}
        {result && (
          <div className="space-y-6">

            {/* Expiration Note */}
            <div className="flex items-center gap-2 bg-[#F9F9F8] border border-border px-4 py-2.5 rounded-lg text-sm text-muted">
              <span>⏱️</span>
              <p>Tệp <strong className="text-ink">{result.filename}</strong> đang được lưu tạm trên máy chủ. Dữ liệu sẽ tự động xóa sau <strong>1 giờ</strong> để bảo vệ bảo mật.</p>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3 text-sm bg-[#F9F9F8] border border-border px-4 py-2.5 rounded-lg">
                <span className="font-medium text-ink">
                  Tìm thấy {result.total_columns} cột · {result.columns.filter(c => c.null_pct > 60 || c.unique_count === 1 || c.low_confidence).length} cột có vấn đề · {result.total_rows.toLocaleString()} dòng · Đề tài: {result.semantic_context.domain} ({Math.round(result.semantic_context.confidence * 100)}%)
                </span>
                {result.cached && (
                  <div className="flex items-center gap-2 ml-2">
                    <span className="px-2 py-0.5 rounded-full border border-[#EAF2EB] bg-sage text-forest text-[10px] font-medium">
                      ⚡ Cache
                    </span>
                    <button
                      onClick={() => handleFile(lastFile, true)}
                      disabled={!lastFile}
                      className="text-[10px] font-medium text-forest hover:text-ink underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Phân tích lại và làm mới dữ liệu"
                    >
                      ↻ Phân tích lại
                    </button>
                  </div>
                )}
                <button
                  id="profiler-reanalyze-btn"
                  onClick={handleReset}
                  className="ml-auto text-xs text-muted hover:text-ink border border-border rounded-lg px-3 py-1.5 bg-white hover:bg-[#F0F0F0] transition-colors"
                >
                  ↺ Phân tích file khác
                </button>
            </div>

            {/* Semantic Context card */}
            <div className="border border-border rounded-xl p-5 bg-white shadow-sm">
              <p className="text-[10px] text-muted uppercase tracking-[0.15em] font-medium mb-3">
                Phân tích AI — Ngữ cảnh Dataset
              </p>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="font-serif text-xl text-ink">
                  {result.semantic_context.domain}
                </span>
                <ConfidenceBadge confidence={result.semantic_context.confidence} />
              </div>
              {result.semantic_context.reasoning && (
                <p className="text-sm text-muted leading-relaxed">
                  {result.semantic_context.reasoning}
                </p>
              )}
            </div>

            {/* Column table */}
            <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9F9F8] border-b border-border text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Tên cột</th>
                    <th className="text-left px-4 py-3 font-medium">Kiểu phát hiện</th>
                    <th className="text-left px-4 py-3 font-medium" title="Hệ thống tự động nhận diện có thể sai — bạn có thể điều chỉnh lại tại đây.">Sửa kiểu dữ liệu</th>
                    <th className="text-right px-4 py-3 font-medium">Unique</th>
                    <th className="text-right px-4 py-3 font-medium">Null%</th>
                    <th className="text-left px-4 py-3 font-medium">Gợi ý biểu đồ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.columns.map((col, idx) => {
                    const effectiveType = getEffectiveType(col);
                    const isOverridden = overrides[col.name] !== undefined;

                    return (
                      <tr
                        key={col.name}
                        className={`border-b border-border last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}
                      >
                        {/* Tên cột */}
                        <td className="px-4 py-3 font-mono text-xs text-ink max-w-[250px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate max-w-[150px]">{col.name}</span>
                            {col.null_pct > 60 && <span title="Thiếu hơn 60% dữ liệu" className="text-[10px] cursor-help">🔴</span>}
                            {col.unique_count === 1 && <span title="Chỉ có 1 giá trị duy nhất" className="text-[10px] cursor-help">🟡</span>}
                            {col.low_confidence && !col.disguised_numeric?.is_disguised && <span title="Độ tin cậy thấp" className="text-[10px] cursor-help">🟠</span>}
                            {col.disguised_numeric?.is_disguised && (
                              <span
                                title="Hệ thống phát hiện cột này chứa giá trị số dưới dạng text. Dùng 'Sửa kiểu dữ liệu' để chuyển đổi."
                                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700 cursor-help whitespace-nowrap border border-amber-200"
                              >
                                ⚠ Có thể là số
                              </span>
                            )}
                          </div>
                          {col.disguised_numeric?.is_disguised && col.disguised_numeric.sample_convertible?.length > 0 && (
                            <div className="mt-1.5 text-[9px] text-muted flex flex-wrap gap-x-1.5 gap-y-0.5 leading-tight">
                              {col.disguised_numeric.sample_convertible.map((sample, i) => (
                                <span key={i}>
                                  {sample}{i < col.disguised_numeric.sample_convertible.length - 1 ? ' · ' : ''}
                                </span>
                              ))}
                              {col.disguised_numeric.null_synonym_count > 0 && (
                                <span>· N/A → NaN</span>
                              )}
                            </div>
                          )}
                          {col.unnamed_warning && (
                            <div className="mt-1 text-[9px] text-blue-600 flex items-center gap-1">
                              <span>ℹ️</span>
                              <span>{col.unnamed_warning}</span>
                            </div>
                          )}
                        </td>

                        {/* Kiểu phát hiện gốc */}
                        <td className="px-4 py-3">
                          <TypeBadge type={col.detected_type} />
                        </td>

                        {/* Override dropdown */}
                        <td className="px-4 py-3">
                          <select
                            id={`override-${col.name}`}
                            value={effectiveType}
                            onChange={(e) => handleOverride(col.name, e.target.value)}
                            className={`
                              text-xs rounded border px-2 py-1 bg-white outline-none
                              focus:ring-1 focus:ring-forest focus:border-forest
                              ${isOverridden ? "border-forest text-forest" : "border-border text-muted"}
                            `}
                          >
                            {COLUMN_TYPES.map((t) => (
                              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                          {isOverridden && (
                            <button
                              onClick={() => handleOverride(col.name, col.detected_type)}
                              className="ml-2 text-[10px] text-muted hover:text-ink underline"
                              title="Reset về mặc định"
                            >
                              Reset
                            </button>
                          )}
                        </td>

                        {/* Unique count */}
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                          {col.unique_count.toLocaleString()}
                        </td>

                        {/* Null % */}
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                          {col.null_pct > 0 ? (
                            <span className={col.null_pct > 30 ? "text-[#9F2F2D] font-medium" : ""}>
                              {col.null_pct}%
                            </span>
                          ) : "—"}
                        </td>

                        {/* Suggested charts */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {col.suggested_charts.length > 0
                              ? col.suggested_charts.map((chart) => (
                                  <span
                                    key={chart}
                                    className="px-2 py-0.5 text-[10px] rounded-full bg-sage text-forest border border-[#c8e0cb]"
                                  >
                                    {CHART_LABELS[chart] || chart}
                                  </span>
                                ))
                              : <span className="text-muted text-xs">—</span>
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer: file hash + nút chuyển sang Cleaner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
              <p className="text-xs text-muted">
                * Sửa kiểu dữ liệu cột chỉ ảnh hưởng giao diện (state local). File hash:{" "}
                <code className="font-mono bg-[#F9F9F8] px-1 rounded">{result.file_hash.slice(0, 8)}...</code>
              </p>

              <div className="flex items-center gap-3">
                {/* Nút Tải báo cáo */}
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", `${result.filename.split('.')[0]}_report.json`);
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                  }}
                  className="text-sm text-ink border border-border rounded-lg px-4 py-2.5 hover:bg-[#F9F9F8] transition-colors"
                >
                  Tải báo cáo
                </button>

                {/* Nút chính: tiếp tục sang Cleaner */}
                <button
                  id="profiler-next-btn"
                  onClick={() => navigate("/ua_cleaner")}
                  className="
                    shrink-0 flex items-center gap-2
                    bg-[#1B4324] text-white text-sm font-medium
                    px-5 py-2.5 rounded-lg
                    hover:bg-[#163820] transition-colors
                  "
                >
                  Tiến hành làm sạch
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
