import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { useAuth } from "../contexts/AuthContext";
import {
  profileFile,
  requestAIContext,
  getProfilerState,
  saveProfilerState,
  getAIUsage,
  getSessionStatus,
} from "../services/profilerService";
import FileExpiredBanner from "../components/FileExpiredBanner";
import { useToast } from "../contexts/ToastContext";
import { useTranslation } from "react-i18next";
import { getCurrentLang, translateError } from "../i18n";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Zap,
  Clock,
  MoreHorizontal,
  Download,
  FileSpreadsheet,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageHelpDocs from "../components/PageHelpDocs";
import { PAGE, BTN } from "../constants/ui";
import { getDomainI18nKey } from "../constants/dataTypes";

// Profiler sub-components
import { UploadZone } from "../components/Profiler/UploadZone";
import { LoadingOverlay } from "../components/Profiler/LoadingOverlay";
import { ColumnTable, isAttentionColumn } from "../components/Profiler/ColumnTable";
import MergedDescriptionBox from "../components/Profiler/MergedDescriptionBox";
import UpgradeModal from "../components/UpgradeModal";

// ── Compact Countdown Chip with Info Popover ──
const SESSION_TTL_MS = 18000 * 1000;

function ProfilerCountdownChip({ uploadedAt, fileExpiresAt }) {
  const { t } = useTranslation();
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (fileExpiresAt) {
      const expMs = new Date(fileExpiresAt).getTime();
      if (!isNaN(expMs)) {
        return Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      }
    }
    if (!uploadedAt) return SESSION_TTL_MS / 1000;
    return Math.max(0, Math.floor((SESSION_TTL_MS - (Date.now() - uploadedAt)) / 1000));
  });

  useEffect(() => {
    const tick = () => {
      if (fileExpiresAt) {
        const expMs = new Date(fileExpiresAt).getTime();
        if (!isNaN(expMs)) {
          setSecondsLeft(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
          return;
        }
      }
      const ref = uploadedAt || Date.now();
      setSecondsLeft(Math.max(0, Math.floor((SESSION_TTL_MS - (Date.now() - ref)) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [uploadedAt, fileExpiresAt]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const formatted = h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  const isRed = secondsLeft > 0 && secondsLeft < 300;
  const isAmber = secondsLeft >= 300 && secondsLeft < 1800;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover((prev) => !prev)}
        title={t("profiler.why_deletion_title", "Vì sao file bị xóa?")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors cursor-pointer select-none ${
          isRed
            ? "bg-[#FDEBEC] border-[#f5c6cb] text-[#9F2F2D]"
            : isAmber
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-neutral-50 hover:bg-neutral-100 border-border text-muted hover:text-ink"
        }`}
      >
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isRed ? "text-[#9F2F2D]" : isAmber ? "text-amber-600" : "text-muted"}`} />
        <span>{formatted}</span>
      </button>

      {showPopover && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 p-3.5 bg-white border border-border rounded-xl shadow-xl text-xs text-ink space-y-2 z-50 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between font-bold border-b border-border/80 pb-1.5 text-forest">
            <span>{t("profiler.why_deletion_title", "Vì sao file bị xóa?")}</span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="p-0.5 text-muted hover:text-ink rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-muted leading-relaxed">
            {t("profiler.why_deletion_p1")}
          </p>
          <p className="text-muted leading-relaxed">
            {t("profiler.why_deletion_p2")}
          </p>
          <p className="text-muted leading-relaxed">
            {t("profiler.why_deletion_p3")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Profiler({ pipelineMode, onComplete, onError }) {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();

  const [fileExpired, setFileExpired] = useState(false);
  const [fileExpiresAt, setFileExpiresAt] = useState(fileSession.fileExpiresAt || null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check session-status on mount if fileSession exists
  useEffect(() => {
    if (!fileSession.fileHash) {
      setFileExpired(false);
      return;
    }
    getSessionStatus(fileSession.fileHash)
      .then((res) => {
        const data = res.data;
        setFileExpired(!data.file_available);
        if (data.file_expires_at) {
          setFileExpiresAt(data.file_expires_at);
          updateFileSession({ fileExpiresAt: data.file_expires_at });
        }
      })
      .catch((err) => {
        console.warn("Failed to check session status:", err);
      });
  }, [fileSession.fileHash]);
  const [lastFile, setLastFile] = useState(null);
  const { t, i18n } = useTranslation();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [savedLang, setSavedLang] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  const [uploadedAt, setUploadedAt] = useState(
    () => fileSession.uploadedAt || null
  );

  const result = fileSession.profileData;
  const overrides = fileSession.overrides || {};

  const [description, setDescription] = useState(fileSession?.userContext?.description || "");
  const [descriptionSource, setDescriptionSource] = useState(fileSession?.userContext?.description_source || "user");
  const [analyzedDescription, setAnalyzedDescription] = useState(
    () => fileSession?.analyzedDescription || fileSession?.userContext?.analyzedDescription || null
  );
  const [contextPurpose, setContextPurpose] = useState(fileSession?.userContext?.purpose || "");
  const [savedAt, setSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiUsage, setAiUsage] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const cols = result?.columns || [];
  const attentionCount = cols.filter(isAttentionColumn).length;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const debounceTimerRef = useRef(null);

  // Close "..." dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Load server persisted profiler context & shared AI usage
  useEffect(() => {
    if (!result?.file_hash) return;

    getProfilerState(result.file_hash)
      .then((res) => {
        if (res.data) {
          if (res.data.description !== undefined && res.data.description !== "") {
            setDescription(res.data.description);
            setDescriptionSource(res.data.description_source || "user");
          }
          if (res.data.saved_at) {
            setSavedAt(res.data.saved_at);
          }
          if (res.data.lang) {
            setSavedLang(res.data.lang);
          }
          if (res.data.semantic_context?.domain && res.data.semantic_context.domain !== "Chưa phân tích") {
            setAiAnalyzed(true);
            const loadedAnalyzed = fileSession?.analyzedDescription || fileSession?.userContext?.analyzedDescription || res.data.description || "";
            setAnalyzedDescription((prev) => prev || loadedAnalyzed);
            updateFileSession({
              analyzedDescription: fileSession?.analyzedDescription || loadedAnalyzed,
              profileData: {
                ...result,
                semantic_context: res.data.semantic_context,
              },
            });
          }
        }
      })
      .catch((e) => console.warn("Failed to load persisted profiler state:", e));

    getAIUsage()
      .then((res) => setAiUsage(res.data))
      .catch((e) => console.warn("Failed to load AI usage:", e));
  }, [result?.file_hash]);

  const handleDescriptionChange = (newVal) => {
    setDescription(newVal);
    const newSource = descriptionSource === "ai_draft" ? "ai_edited" : descriptionSource || "user";
    setDescriptionSource(newSource);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (!result?.file_hash) return;
      setIsSaving(true);
      try {
        const res = await saveProfilerState(result.file_hash, newVal, newSource);
        setSavedAt(res.data?.saved_at || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        updateFileSession({
          userContext: { description: newVal, purpose: contextPurpose, description_source: newSource },
        });
      } catch (err) {
        console.warn("Auto-save profiler state failed:", err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  // One primary "Tiếp tục: Làm sạch →" button
  const handleContinueClean = async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (result?.file_hash) {
      try {
        await saveProfilerState(result.file_hash, description, descriptionSource);
        updateFileSession({
          userContext: { description, purpose: contextPurpose, description_source: descriptionSource }
        });
      } catch (e) {
        console.error("Flush save profiler state error:", e);
      }
    }
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
      const expiresAt = data.file_expires_at || fileSession.fileExpiresAt || null;
      if (expiresAt) setFileExpiresAt(expiresAt);
      setFileExpired(false);
      updateFileSession({
        profileData: data,
        fileHash: data.file_hash,
        fileName: data.filename,
        uploadedAt: ts,
        fileExpiresAt: expiresAt,
      });
    }
  };

  const setOverrides = (data) => {
    if (typeof data === "function") {
      updateFileSession({ overrides: data(fileSession.overrides || {}) });
    } else {
      updateFileSession({ overrides: data });
    }
  };

  const handleFile = async (file, forceRefresh = false) => {
    if (!file) return;

    if (!user) {
      showToast(t("profiler.login_required"), "warning");
      navigate("/login", { state: { from: location } });
      return;
    }
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowed.includes(ext)) {
      const msg = translateError("ERR_FILE_EXT_INVALID");
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
    setAnalyzedDescription(null);
    updateFileSession({ analyzedDescription: null });

    try {
      const res = await profileFile(file, forceRefresh);
      setResult(res.data, true);
      
      showToast(forceRefresh ? t("profiler.toast_refreshed") : t("profiler.toast_analyzed"), "success");
    } catch (err) {
      const errCode = err?.response?.data?.detail?.code || err?.response?.data?.code;
      let msg;
      if (err?.response?.status === 413) {
        msg = translateError("ERR_FILE_TOO_LARGE");
      } else if (err?.response?.status === 422) {
        msg = translateError("ERR_FILE_CORRUPTED");
      } else if (err?.code === "ECONNABORTED" || !err?.response) {
        msg = translateError("network");
      } else if (errCode) {
        msg = translateError(errCode);
      } else {
        msg = translateError("generic");
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
    setAnalyzedDescription(null);
    setDescription("");
    setDescriptionSource("user");
    setSavedAt(null);
    setIsFromCache(false);
    setSavedLang(null);
    updateFileSession({ analyzedDescription: null });
  };

  const handleAnalyzeAI = async (replace = true, signal = null) => {
    if (!result?.file_hash) return;
    setAiLoading(true);
    setIsFromCache(false);
    try {
      const currentLanguage = getCurrentLang();
      const res = await requestAIContext(
        result.file_hash,
        currentLanguage,
        replace ? null : description,
        false,
        { signal }
      );
      const data = res.data;
      setResult({
        ...result,
        semantic_context: data.semantic_context,
      });
      setAiAnalyzed(true);
      setSavedLang(currentLanguage);

      const newAnalyzedDesc = replace
        ? (data.draft_summary || data.description || "")
        : (description || "");
      setAnalyzedDescription(newAnalyzedDesc);

      if (replace) {
        setDescription(data.draft_summary || data.description || "");
        setDescriptionSource("ai_draft");
      }
      if (data.saved_at) {
        setSavedAt(data.saved_at);
      }
      if (data.usage) {
        setAiUsage(data.usage);
      }
      setIsFromCache(Boolean(data.from_cache));
      updateFileSession({
        analyzedDescription: newAnalyzedDesc,
        userContext: {
          description: replace ? (data.draft_summary || data.description || "") : description,
          purpose: contextPurpose,
          description_source: replace ? "ai_draft" : descriptionSource,
          analyzedDescription: newAnalyzedDesc,
        },
      });
      showToast(t("profiler.saved_status", { time: formatSavedTime(data.saved_at) }), "success");
      return data;
    } finally {
      setAiLoading(false);
    }
  };

  const handleReanalyzeWithCorrection = async (signal = null) => {
    if (!result?.file_hash) return;
    setAiLoading(true);
    setIsFromCache(false);
    try {
      const currentLanguage = getCurrentLang();
      const res = await requestAIContext(
        result.file_hash,
        currentLanguage,
        description,
        true,
        { signal }
      );
      const data = res.data;
      setResult({
        ...result,
        semantic_context: data.semantic_context,
      });
      setAiAnalyzed(true);
      setSavedLang(currentLanguage);
      setDescriptionSource("ai_edited");
      const newAnalyzedDesc = description || "";
      setAnalyzedDescription(newAnalyzedDesc);

      if (data.saved_at) {
        setSavedAt(data.saved_at);
      }
      if (data.usage) {
        setAiUsage(data.usage);
      }
      setIsFromCache(Boolean(data.from_cache));
      updateFileSession({
        analyzedDescription: newAnalyzedDesc,
        userContext: {
          description,
          purpose: contextPurpose,
          description_source: "ai_edited",
          analyzedDescription: newAnalyzedDesc,
        },
      });
      showToast(t("profiler.saved_status", { time: formatSavedTime(data.saved_at) }), "success");
      return data;
    } finally {
      setAiLoading(false);
    }
  };

  const formatSavedTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date();
        d.setUTCHours(h, m, 0, 0);
        return new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(d);
      }
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(d);
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  const getEffectiveType = (col) => overrides[col.name] || col.detected_type;

  const lang = getCurrentLang();
  const numberLocale = lang === "vi" ? "vi-VN" : "en-US";
  const displayDomain = result?.semantic_context?.domain
    ? t(getDomainI18nKey(result.semantic_context.domain), { defaultValue: result.semantic_context.domain })
    : "";

  const handleDownloadReport = () => {
    if (!result) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(result, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `${result.filename.split(".")[0]}_report.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowMoreMenu(false);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA]">
      <div className={`${PAGE.wrapper} ${result ? "pb-28" : ""}`}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <PageHeader
          title={t("profiler.title")}
          subtitle={
            result
              ? `${t("profiler.subtitle_with_result", {
                  cols: result.total_columns.toLocaleString(numberLocale),
                  rows: result.total_rows.toLocaleString(numberLocale),
                })}${aiAnalyzed && displayDomain ? ` · ${displayDomain}` : ""}`
              : t("profiler.subtitle_default")
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PageHelpDocs pageId="profiler" />

              {!pipelineMode && !result && (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className={`${BTN.secondary} flex items-center gap-1.5`}
                >
                  <ArrowLeft className="w-4 h-4" /> {t("profiler.btn_home")}
                </button>
              )}
            </div>
          }
        />

        {/* ── Upload zone ─────────────────────────────────────────── */}
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

        {/* ── File Expired Calm Amber Banner ──────────────────────── */}
        {fileExpired && result && (
          <FileExpiredBanner
            fileName={result.filename || fileSession.fileName}
            fileHash={result.file_hash || fileSession.fileHash}
            onReuploaded={(newProfile) => {
              setResult(newProfile, true);
              setFileExpired(false);
            }}
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
            {/* 1. Merged Description & Context panel (AI context box FIRST) */}
            <MergedDescriptionBox
              fileHash={result.file_hash}
              description={description}
              setDescription={handleDescriptionChange}
              descriptionSource={descriptionSource}
              setDescriptionSource={setDescriptionSource}
              savedAt={savedAt}
              isSaving={isSaving}
              aiAnalyzed={aiAnalyzed}
              analyzedDescription={analyzedDescription}
              aiLoading={aiLoading}
              semanticContext={result.semantic_context}
              handleAnalyzeAI={handleAnalyzeAI}
              handleReanalyzeWithCorrection={handleReanalyzeWithCorrection}
              contextPurpose={contextPurpose}
              setContextPurpose={setContextPurpose}
              usage={aiUsage}
              setAiUsage={setAiUsage}
              isFromCache={isFromCache}
              savedLang={savedLang}
              onUpgradeClick={() => setShowUpgradeModal(true)}
            />

            {/* 2. Column Table (below AI context box) */}
            <ColumnTable
              result={result}
              overrides={overrides}
              getEffectiveType={getEffectiveType}
              handleOverride={handleOverride}
              filterNeedsReview={filterNeedsReview}
              setFilterNeedsReview={setFilterNeedsReview}
            />
          </div>
        )}
      </div>

      {/* ── Sticky Bottom Bar (Profiler, same bar style as Cleaner/Visualize) ── */}
      {result && (
        <div
          className="fixed bottom-0 max-md:bottom-16 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E5E5E3] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] transition-all duration-300"
          style={{ left: "var(--app-sidebar-w, 0px)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {/* Left: Summary + Attention Chip + Countdown + Cached */}
            <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-start w-full sm:w-auto">
              {/* Row & Column count */}
              <span className="text-xs font-semibold text-ink">
                {result.total_rows.toLocaleString(numberLocale)}{" "}
                <span className="font-normal text-muted">{t("profiler.summary_rows", "dòng")}</span>
                {" · "}
                {result.total_columns.toLocaleString(numberLocale)}{" "}
                <span className="font-normal text-muted">{t("profiler.summary_cols", "cột")}</span>
              </span>

              {/* Attention Chip */}
              {attentionCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterNeedsReview((prev) => !prev)}
                  title={
                    filterNeedsReview
                      ? t("profiler.chip_filter_clear", "Bấm để xem tất cả cột")
                      : t("profiler.chip_filter_apply", "Bấm để lọc các cột cần xem")
                  }
                  aria-pressed={filterNeedsReview}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    filterNeedsReview
                      ? "bg-[#D97706] text-white ring-2 ring-[#D97706]/40 shadow-xs"
                      : "bg-[#FEF6E6] text-[#854D0E] border border-[#FDE68A] hover:bg-[#FDF0D5]"
                  }`}
                >
                  <AlertTriangle
                    size={13}
                    className={filterNeedsReview ? "text-white" : "text-[#D97706]"}
                    aria-hidden="true"
                  />
                  <span>
                    {t("profiler.chip_needs_review", {
                      count: attentionCount,
                      defaultValue: `${attentionCount} cột cần xem`,
                    })}
                  </span>
                  {filterNeedsReview && <X size={12} className="ml-0.5" aria-hidden="true" />}
                </button>
              )}

              {/* Compact Countdown Chip with popover */}
              <ProfilerCountdownChip
                uploadedAt={uploadedAt}
                fileExpiresAt={fileExpiresAt || result.file_expires_at}
              />

              {/* Cached Badge */}
              {(Boolean(result.cached) || isFromCache) && (
                <span className="px-2 py-0.5 rounded-full border border-[#C8E0CB] bg-[#EAF2EB] text-[#1B4324] text-[11px] font-medium flex items-center gap-1 select-none">
                  <Zap className="w-3 h-3 text-forest" />
                  <span>{t("profiler.badge_cached", "Đã lưu đệm")}</span>
                </span>
              )}
            </div>

            {/* Right: Tải file khác + ... menu + Primary button */}
            <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
              {/* Secondary button: Tải file khác */}
              <button
                type="button"
                id="profiler-reanalyze-btn"
                onClick={handleReset}
                className={`${BTN.secondary} flex items-center gap-1.5 text-xs font-medium text-ink py-2 px-3 shadow-2xs`}
              >
                <FileSpreadsheet size={13} className="text-muted" />
                <span>{t("profiler.btn_upload_new", "Tải file khác")}</span>
              </button>

              {/* "..." menu: Re-read file (free) + Download report */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowMoreMenu((prev) => !prev)}
                  aria-label={t("profiler.action_menu_more", "Tùy chọn khác")}
                  className={`${BTN.secondary} p-2 text-muted hover:text-ink shadow-2xs`}
                  title={t("profiler.action_menu_more", "Tùy chọn khác")}
                >
                  <MoreHorizontal size={15} />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 bottom-full mb-2 z-50 w-52 py-1 bg-white border border-border rounded-xl shadow-lg text-xs space-y-0.5 animate-in fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleFile(lastFile, true);
                      }}
                      disabled={!lastFile}
                      className="w-full text-left px-3 py-2 text-ink hover:bg-neutral-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <RotateCw size={13} className="text-forest" />
                      <span>{t("profiler.btn_reanalyze_file_free", "Đọc lại file (miễn phí)")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleDownloadReport();
                      }}
                      className="w-full text-left px-3 py-2 text-ink hover:bg-neutral-50 flex items-center gap-2"
                    >
                      <Download size={13} className="text-muted" />
                      <span>{t("profiler.col_download_report", "Tải báo cáo JSON")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Primary Button: Tiếp tục: Làm sạch → (full width on mobile) */}
              <button
                type="button"
                id="profiler-next-btn"
                onClick={handleContinueClean}
                className={`${BTN.primary} flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3.5 shadow-2xs`}
              >
                <span>{t("profiler.btn_continue_clean", "Tiếp tục: Làm sạch")}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => {
          getAIUsage().then((r) => setAiUsage(r.data)).catch(console.error);
        }}
      />
    </div>
  );
}
