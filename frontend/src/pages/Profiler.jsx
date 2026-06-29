import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { profileFile } from "../services/profilerService";
import { useToast } from "../contexts/ToastContext";
import { Upload, AlertTriangle, Clock, Download, AlertCircle, Info, RotateCw, RotateCcw, ArrowLeft, ArrowRight, Zap, CheckCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { TEXT, PAGE, BTN, BADGE, CARD } from "../constants/ui";

// Các kiểu cột người dùng có thể override
const COLUMN_TYPES = ["numeric", "datetime", "categorical", "multiple_choice", "text"];
// Label hiển thị thân thiện
const TYPE_LABELS = {
  numeric: "Số liệu",
  datetime: "Thời gian",
  categorical: "Danh mục",
  multiple_choice: "Nhiều lựa chọn",
  text: "Văn bản",
};

// Chart labels
const CHART_LABELS = {
  bar: "Cột",
  pie: "Tròn",
  line: "Đường",
  histogram: "Histogram",
};

import { ConfidenceBadge, TypeBadge } from '../components/Profiler/Badges';
import { LoadingOverlay } from '../components/Profiler/LoadingOverlay';

const ExpandableText = ({ text, maxLength = 40 }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text || text.length <= maxLength) return <span className="break-words">{text}</span>;
  return (
    <span className="break-words">
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="ml-1 text-[10px] text-forest hover:underline focus:outline-none font-sans"
        title={expanded ? "Thu gọn" : "Xem thêm"}
      >
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────
export default function Profiler({ pipelineMode, onComplete, onError }) {
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

  const [contextDescription, setContextDescription] = useState(fileSession?.userContext?.description || "");
  const [contextPurpose, setContextPurpose] = useState(fileSession?.userContext?.purpose || "");

  const handleSaveContext = async () => {
    if (contextDescription || contextPurpose) {
      try {
        await api.post("/session/context", {
          session_id: fileSession.sessionId || fileSession.fileHash,
          description: contextDescription,
          purpose: contextPurpose
        });
        updateFileSession({
          userContext: { description: contextDescription, purpose: contextPurpose }
        });
      } catch (e) {
        console.error(e);
      }
    }
    if (pipelineMode && onComplete) onComplete();
    else navigate("/cleaner");
  };

  const handleSkipContext = () => {
    if (pipelineMode && onComplete) onComplete();
    else navigate("/cleaner");
  };

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
      const msg = "Định dạng file không được hỗ trợ. Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV.";
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
      showToast(forceRefresh ? "Đã cập nhật lại kết quả phân tích!" : "Phân tích dữ liệu thành công!", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg;
      if (err?.response?.status === 413) {
        msg = "Dung lượng file vượt quá giới hạn. Vui lòng chọn file nhỏ hơn 10MB.";
      } else if (err?.response?.status === 422) {
        msg = "File bị hỏng hoặc định dạng không hợp lệ. Vui lòng kiểm tra lại file tải lên.";
      } else if (err?.code === "ECONNABORTED" || !err?.response) {
        msg = "Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.";
      } else {
        msg = typeof detail === "string" ? detail : "Không thể phân tích file vào lúc này. Vui lòng thử lại sau.";
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
    showToast("Đã lưu báo cáo về máy. Tính năng xuất file PDF sẽ sớm ra mắt.", "success");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <div className={PAGE.wrapper}>
        <PageHeader
          title="Phân tích dữ liệu"
          subtitle="Tổng quan cấu trúc và chất lượng tập dữ liệu"
          actions={
            pipelineMode ? (
              <button
                onClick={handleSkipContext}
                disabled={!result}
                className={`${BTN.primary} flex items-center gap-1.5 ${!result ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Tiếp tục <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/home")}
                className={`${BTN.secondary} flex items-center gap-1.5`}
              >
                <ArrowLeft className="w-4 h-4" /> Trang chủ
              </button>
            )
          }
        />

        {/* Upload zone */}
        {!result && (
          <div
            id="upload-zone"
            className={`
              border-2 border-dashed rounded-lg p-6 sm:p-10 text-center cursor-pointer transition-colors
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
              <Upload size={40} strokeWidth={1.5} className="mx-auto mb-3 text-forest" />
              <span className="block mb-1 text-ink font-medium">Kéo thả file vào đây</span>
              hoặc click để chọn file &mdash; CSV, XLSX, XLS (tối đa 10MB)
            </div>
          </div>
        )}

        {/* Error inline */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
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
              <Clock className="w-4 h-4 shrink-0 text-muted" />
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
                    <Zap className="w-3 h-3 inline-block" /> Cache
                  </span>
                  <button
                    onClick={() => handleFile(lastFile, true)}
                    disabled={!lastFile}
                    className="text-[10px] font-medium text-forest hover:text-ink underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Phân tích lại và làm mới dữ liệu"
                  >
                    <RotateCw className="w-3 h-3 inline-block mr-1" /> Phân tích lại
                  </button>
                </div>
              )}
              <button
                id="profiler-reanalyze-btn"
                onClick={handleReset}
                className={`${BTN.secondary} ml-auto flex items-center gap-2`}
              >
                <RotateCcw size={16} /> Phân tích file khác
              </button>
            </div>

            {/* Semantic Context card */}
            <div className={CARD}>
              <h2 className={TEXT.sectionTitle}>Ngữ cảnh tập dữ liệu</h2>
              <div className="flex items-center gap-3 flex-wrap mb-2 mt-4">
                <span className="font-serif text-xl text-ink">
                  {result.semantic_context.domain}
                </span>
                <ConfidenceBadge confidence={result.semantic_context.confidence} />
              </div>
              {result.semantic_context.reasoning && (
                <p className={TEXT.body}>
                  {result.semantic_context.reasoning}
                </p>
              )}
            </div>

            {/* Column table */}
            <div className={CARD}>
              <h2 className={TEXT.sectionTitle}>Cấu trúc cột & Vấn đề dữ liệu</h2>
              <div className="mt-4 border border-border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
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
                                <div className="max-w-[250px] whitespace-normal">
                                  <ExpandableText text={col.name} />
                                </div>
                                {col.null_pct > 60 && <AlertCircle className="w-3 h-3 text-red-500 cursor-help" title="Thiếu hơn 60% dữ liệu" />}
                                {col.unique_count === 1 && <AlertCircle className="w-3 h-3 text-amber-500 cursor-help" title="Chỉ có 1 giá trị duy nhất" />}
                                {col.low_confidence && !col.disguised_numeric?.is_disguised && <AlertCircle className="w-3 h-3 text-orange-500 cursor-help" title="Độ tin cậy thấp" />}
                                {col.disguised_numeric?.is_disguised && (
                                  <span
                                    title="Hệ thống phát hiện cột này chứa giá trị số dưới dạng text. Dùng 'Sửa kiểu dữ liệu' để chuyển đổi."
                                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700 cursor-help whitespace-nowrap border border-amber-200"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 inline mr-1" /> Có thể là số
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
                                  <Info className="w-3 h-3 shrink-0" />
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
              </div>

              {/* Footer: file hash */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-muted">
                  * Sửa kiểu dữ liệu cột chỉ ảnh hưởng giao diện (state local). File hash:{" "}
                  <code className="font-mono bg-[#F9F9F8] px-1 rounded">{result.file_hash.slice(0, 8)}...</code>
                </p>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
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
                    className={`${BTN.secondary} flex items-center gap-2`}
                  >
                    <Download size={16} /> Tải báo cáo
                  </button>
                </div>
              </div>
            </div>

            {/* Context Section (thêm mô tả để report chính xác hơn) */}
            <div className={CARD}>
              <h3 className={TEXT.sectionTitle}>Mô tả dataset (không bắt buộc)</h3>
              <p className={`${TEXT.secondary} mb-4 mt-1`}>
                Thêm mô tả giúp AI viết báo cáo chính xác hơn ở bước cuối
              </p>
              <textarea
                className="w-full border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#1B4324] outline-none mb-4"
                placeholder='Ví dụ: "Khảo sát 500 sinh viên, đánh giá chất lượng giảng dạy"'
                value={contextDescription}
                onChange={e => setContextDescription(e.target.value)}
                rows={3}
              />
              <div className="flex flex-wrap gap-3 mb-6">
                {["Tìm xu hướng chung", "So sánh các nhóm",
                  "Phát hiện vấn đề", "Báo cáo định kỳ"].map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer border border-border px-3 py-1.5 rounded-lg hover:bg-sage/10 transition-colors">
                      <input type="radio" name="purpose" value={opt}
                        checked={contextPurpose === opt}
                        onChange={() => setContextPurpose(opt)}
                        className="accent-[#1B4324]"
                      />
                      {opt}
                    </label>
                  ))}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleSkipContext}
                  className={BTN.secondary}
                >
                  Bỏ qua
                </button>
                <button
                  id="profiler-next-btn"
                  onClick={handleSaveContext}
                  className={`${BTN.primary} flex items-center gap-2`}
                >
                  {pipelineMode ? "Lưu & Tiếp tục" : "Lưu & Tiến hành làm sạch"} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
