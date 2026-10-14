import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { useAuth } from "../contexts/AuthContext";
import { profileFile, requestAIContext } from "../services/profilerService";
import api from "../services/axiosClient";
import { useToast } from "../contexts/ToastContext";
import { AlertTriangle, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Zap, Clock } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageHelpDocs from "../components/PageHelpDocs";
import { PAGE, BTN } from "../constants/ui";

// Profiler sub-components
import { UploadZone } from "../components/Profiler/UploadZone";
import { LoadingOverlay } from "../components/Profiler/LoadingOverlay";
import { ColumnTable } from "../components/Profiler/ColumnTable";
import { DatasetContext } from "../components/Profiler/DatasetContext";
import { SemanticContext } from "../components/Profiler/SemanticContext";

// ── Expiry Banner ── slim countdown strip shown below the table ──
const SESSION_TTL_MS = 3600 * 1000;

function ExpiryBanner({ uploadedAt, filename }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!uploadedAt) return SESSION_TTL_MS / 1000;
    return Math.max(0, Math.floor((SESSION_TTL_MS - (Date.now() - uploadedAt)) / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const ref = uploadedAt || Date.now();
      setSecondsLeft(Math.max(0, Math.floor((SESSION_TTL_MS - (Date.now() - ref)) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [uploadedAt]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const isUrgent = secondsLeft > 0 && secondsLeft < 300;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${
      isUrgent
        ? "bg-[#FDEBEC] border-[#f5c6cb] text-[#9F2F2D]"
        : "bg-[#F9F9F8] border-border text-muted"
    }`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>
        File <strong className={isUrgent ? "text-[#9F2F2D]" : "text-ink"}>{filename}</strong>{" "}
        {isUrgent
          ? <><span className="font-semibold">auto-deletes in <span className="font-mono">{formatted}</span> — save your work!</span></>  
          : <>auto-deletes in <span className="font-mono font-medium">{formatted}</span> for security.</>}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function Profiler({ pipelineMode, onComplete, onError }) {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFile, setLastFile] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  // Timestamp (ms) of when the file was uploaded — drives the 1-hour countdown
  const [uploadedAt, setUploadedAt] = useState(
    () => fileSession.uploadedAt || null
  );

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
    else navigate("/dashboard/cleaner");
  };

  const handleSkipContext = () => {
    if (pipelineMode && onComplete) onComplete();
    else navigate("/dashboard/cleaner");
  };

  const setResult = (data, isNewUpload = false) => {
    if (!data) {
      clearFileSession();
      setUploadedAt(null);
    } else {
      const ts = isNewUpload ? Date.now() : (fileSession.uploadedAt || Date.now());
      setUploadedAt(ts);
      updateFileSession({ profileData: data, fileHash: data.file_hash, fileName: data.filename, uploadedAt: ts });
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

    // Gate: must be logged in to upload
    if (!user) {
      showToast("Vui lòng đăng nhập để tải file lên và phân tích.", "warning");
      navigate("/login", { state: { from: location } });
      return;
    }
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
    setAiAnalyzed(false);

    try {
      const res = await profileFile(file, forceRefresh);
      setResult(res.data, true); // mark as fresh upload to reset countdown
      
      showToast(forceRefresh ? "Analysis refreshed!" : "File analyzed successfully!", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg;
      if (err?.response?.status === 413) {
        msg = "File exceeds the 10MB size limit. Please choose a smaller file.";
      } else if (err?.response?.status === 422) {
        msg = "File is corrupted or has an invalid format. Please check the file and try again.";
      } else if (err?.code === "ECONNABORTED" || !err?.response) {
        msg = "Cannot reach server. Please check your connection and retry.";
      } else {
        msg = typeof detail === "string" ? detail : "Unable to analyze file right now. Please try again later.";
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
    setAiAnalyzed(false);
  };

  const handleRequestAI = async () => {
    if (!result?.file_hash || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await requestAIContext(result.file_hash);
      const { semantic_context } = res.data;
      // Update the semantic context in the result
      setResult({
        ...result,
        semantic_context: semantic_context,
      });
      setAiAnalyzed(true);
      showToast("AI analysis complete!", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      showToast(
        typeof detail === "string" ? detail : "AI analysis failed. Please try again later.",
        "error"
      );
    } finally {
      setAiLoading(false);
    }
  };

  const getEffectiveType = (col) => overrides[col.name] || col.detected_type;

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <div className={PAGE.wrapper}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <PageHeader
          title="Data Profiler"
          subtitle={result
            ? `${result.total_columns} columns · ${result.total_rows.toLocaleString()} rows${aiAnalyzed ? ` · ${result.semantic_context.domain}` : ""}`
            : "Structural overview and data quality analysis"
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PageHelpDocs pageId="profiler" />

              {!pipelineMode && !result && (
                <button
                  onClick={() => navigate("/")}
                  className={`${BTN.secondary} flex items-center gap-1.5`}
                >
                  <ArrowLeft className="w-4 h-4" /> Home
                </button>
              )}

              {/* Stats summary + Upload New File — shown when result is loaded */}
              {result && (
                <>
                  <button
                    id="profiler-reanalyze-btn"
                    onClick={handleReset}
                    className={`${BTN.secondary} flex items-center gap-1.5 text-xs`}
                  >
                    <RotateCcw size={13} /> Upload New File
                  </button>

                  {/* Cache badge + re-analyze — only when result came from cache */}
                  {result.cached && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full border border-[#EAF2EB] bg-sage text-forest text-[10px] font-medium flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Cached
                      </span>
                      <button
                        onClick={() => handleFile(lastFile, true)}
                        disabled={!lastFile}
                        className="flex items-center gap-1 text-[10px] font-medium text-forest hover:text-ink underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCw className="w-3 h-3" /> Re-analyze
                      </button>
                    </div>
                  )}

                  {/* divider */}
                  <div className="w-px h-5 bg-border hidden sm:block" />

                  <button onClick={handleSkipContext} className={`${BTN.secondary} text-xs`}>
                    Skip
                  </button>
                  <button
                    id="profiler-next-btn"
                    onClick={handleSaveContext}
                    className={`${BTN.primary} flex items-center gap-1.5 text-xs`}
                  >
                    {pipelineMode ? "Save & Continue" : "Save & Clean"} <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
          }
        />

        {/* ── Upload zone (no result yet) ─────────────────────────── */}
        {!result && (
          <UploadZone
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            loading={loading}
            fileInputRef={fileInputRef}
            handleDrop={handleDrop}
            handleInputChange={handleInputChange}
          />
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-[#FDEBEC] text-[#9F2F2D] text-sm border border-[#f5c6cb] flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && <LoadingOverlay />}

        {/* ── Results ─────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-4">
            {/* 1. Column table — first thing visible */}
            <ColumnTable
              result={result}
              overrides={overrides}
              getEffectiveType={getEffectiveType}
              handleOverride={handleOverride}
            />

            {/* 2. Auto-delete countdown — slim strip below the table */}
            <ExpiryBanner uploadedAt={uploadedAt} filename={result.filename} />

            {/* 3. Context panels — side-by-side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <DatasetContext
                  contextDescription={contextDescription}
                  setContextDescription={setContextDescription}
                  contextPurpose={contextPurpose}
                  setContextPurpose={setContextPurpose}
                />
              </div>
              <div className="lg:col-span-1">
                <SemanticContext
                  aiAnalyzed={aiAnalyzed}
                  aiLoading={aiLoading}
                  result={result}
                  handleRequestAI={handleRequestAI}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

