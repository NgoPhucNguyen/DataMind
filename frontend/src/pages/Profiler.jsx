import { useState, useRef } from "react";
import { profileFile } from "../services/profilerService";

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

export default function Profiler() {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Override state: { [colName]: overriddenType }
  const [overrides, setOverrides] = useState({});

  const fileInputRef = useRef(null);

  // ── Handlers ──────────────────────────────────────────────

  const handleFile = async (file) => {
    if (!file) return;

    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      setError("Chỉ chấp nhận file .csv, .xlsx, .xls");
      return;
    }

    setError(null);
    setResult(null);
    setOverrides({});
    setLoading(true);

    try {
      const res = await profileFile(file);
      setResult(res.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Có lỗi xảy ra khi phân tích file.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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

  const getEffectiveType = (col) => overrides[col.name] || col.detected_type;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans px-6 py-12 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl tracking-tight mb-1">Data Profiler</h1>
        <p className="text-muted text-sm">
          Upload file CSV hoặc Excel để phân tích cấu trúc và nhận gợi ý biểu đồ.
        </p>
      </div>

      {/* Upload zone */}
      <div
        id="upload-zone"
        className={`
          border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
          ${isDragging
            ? "border-forest bg-sage"
            : "border-border hover:border-forest hover:bg-sage/40"
          }
        `}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
          <span className="block mb-1 text-ink font-medium">Kéo thả file vào đây</span>
          hoặc click để chọn file &mdash; CSV, XLSX, XLS (tối đa 10MB)
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb]">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-10 flex items-center gap-3 text-muted text-sm">
          <svg
            className="animate-spin h-5 w-5 text-forest"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Đang phân tích dữ liệu...
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-10 space-y-6">

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="px-3 py-1 rounded-full border border-border bg-white text-muted">
              <span className="text-ink font-medium">{result.filename}</span>
            </span>
            <span className="px-3 py-1 rounded-full border border-border bg-white text-muted">
              {result.total_rows.toLocaleString()} dòng
            </span>
            <span className="px-3 py-1 rounded-full border border-border bg-white text-muted">
              {result.total_columns} cột
            </span>
            {result.cached && (
              <span className="px-3 py-1 rounded-full border border-[#EAF2EB] bg-sage text-forest text-xs font-medium">
                Kết quả từ cache
              </span>
            )}
          </div>

          {/* Semantic context banner */}
          <div className="border border-border rounded-lg p-5 bg-white">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">Phân tích AI</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-serif text-xl text-ink">{result.semantic_context.domain}</span>
              <span className="text-sm text-muted">
                Độ tin cậy: {Math.round(result.semantic_context.confidence * 100)}%
              </span>
            </div>
            {result.semantic_context.reasoning && (
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {result.semantic_context.reasoning}
              </p>
            )}
          </div>

          {/* Column table */}
          <div className="border border-border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9F9F8] border-b border-border text-muted text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Tên cột</th>
                  <th className="text-left px-4 py-3 font-medium">Kiểu phát hiện</th>
                  <th className="text-left px-4 py-3 font-medium">Override</th>
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
                      <td className="px-4 py-3 font-mono text-xs text-ink max-w-[180px] truncate">
                        {col.name}
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
                          <span className={col.null_pct > 30 ? "text-[#9F2F2D]" : ""}>
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

          {/* Sample values accordion hint */}
          <p className="text-xs text-muted">
            * Override kiểu cột chỉ ảnh hưởng giao diện (state local). File hash:{" "}
            <code className="font-mono bg-[#F9F9F8] px-1 rounded">{result.file_hash.slice(0, 8)}...</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────

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
