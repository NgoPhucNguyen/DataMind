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
} from "../services/profilerService";
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
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageHelpDocs from "../components/PageHelpDocs";
import { PAGE, BTN } from "../constants/ui";
import { getDomainI18nKey } from "../constants/dataTypes";

// Profiler sub-components
import { UploadZone } from "../components/Profiler/UploadZone";
import { LoadingOverlay } from "../components/Profiler/LoadingOverlay";
import { ColumnTable } from "../components/Profiler/ColumnTable";
import MergedDescriptionBox from "../components/Profiler/MergedDescriptionBox";
import UpgradeModal from "../components/UpgradeModal";

// ── Calm Footer Strip ── contains Cached status & Countdown ──
const SESSION_TTL_MS = 3600 * 1000;

function ProfilerFooterLine({ uploadedAt, filename, isCached }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!uploadedAt) return SESSION_TTL_MS / 1000;
    return Math.max(0, Math.floor((SESSION_TTL_MS - (Date.now() - uploadedAt)) / 1000));
  });
  const { t } = useTranslation();

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
    <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-border/70 bg-[#FBFBFA] text-xs text-muted">
      {/* Expiry countdown */}
      <div className="flex items-center gap-2">
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isUrgent ? "text-[#9F2F2D]" : "text-muted"}`} />
        <span>
          {t("profiler.expiry_file", "File")}{" "}
          <strong className={isUrgent ? "text-[#9F2F2D]" : "text-ink"}>{filename}</strong>{" "}
          {isUrgent ? (
            <span className="font-semibold text-[#9F2F2D]">
              {t("profiler.expiry_urgent", { time: formatted })}
            </span>
          ) : (
            <span>{t("profiler.expiry_normal", { time: formatted })}</span>
          )}
        </span>
      </div>

      {/* Cached badge on the footer line */}
      {isCached && (
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full border border-[#C8E0CB] bg-[#EAF2EB] text-[#1B4324] text-[11px] font-medium flex items-center gap-1">
            <Zap className="w-3 h-3 text-forest" />
            <span>{t("profiler.badge_cached", "Đã lưu đệm")}</span>
          </span>
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

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
  const [contextPurpose, setContextPurpose] = useState(fileSession?.userContext?.purpose || "");
  const [savedAt, setSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiUsage, setAiUsage] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
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
            updateFileSession({
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
    setDescription("");
    setDescriptionSource("user");
    setSavedAt(null);
    setIsFromCache(false);
    setSavedLang(null);
  };

  const handleAnalyzeAI = async (replace = true) => {
    if (!result?.file_hash || aiLoading) return;
    setAiLoading(true);
    setIsFromCache(false);
    try {
      const currentLanguage = getCurrentLang();
      const res = await requestAIContext(
        result.file_hash,
        currentLanguage,
        replace ? null : description,
        false
      );
      const data = res.data;
      setResult({
        ...result,
        semantic_context: data.semantic_context,
      });
      setAiAnalyzed(true);
      setSavedLang(currentLanguage);

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
        userContext: {
          description: replace ? (data.draft_summary || data.description || "") : description,
          purpose: contextPurpose,
          description_source: replace ? "ai_draft" : descriptionSource,
        },
      });
      showToast(t("profiler.saved_status", { time: formatSavedTime(data.saved_at) }), "success");
    } catch (err) {
      const errCode = err?.response?.data?.detail?.code || err?.response?.data?.code;
      if (errCode === "ERR_AI_QUOTA_EXCEEDED" || err?.response?.status === 429 || err?.response?.status === 402) {
        if (!user?.is_pro && aiUsage?.is_pro !== true) {
          setShowUpgradeModal(true);
        }
        showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
      } else {
        showToast(translateError(errCode), "error");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleReanalyzeWithCorrection = async () => {
    if (!result?.file_hash || aiLoading) return;
    setAiLoading(true);
    setIsFromCache(false);
    try {
      const currentLanguage = getCurrentLang();
      const res = await requestAIContext(
        result.file_hash,
        currentLanguage,
        description,
        true
      );
      const data = res.data;
      setResult({
        ...result,
        semantic_context: data.semantic_context,
      });
      setAiAnalyzed(true);
      setSavedLang(currentLanguage);
      setDescriptionSource("ai_edited");
      if (data.saved_at) {
        setSavedAt(data.saved_at);
      }
      if (data.usage) {
        setAiUsage(data.usage);
      }
      setIsFromCache(Boolean(data.from_cache));
      updateFileSession({
        userContext: {
          description,
          purpose: contextPurpose,
          description_source: "ai_edited",
        },
      });
      showToast(t("profiler.saved_status", { time: formatSavedTime(data.saved_at) }), "success");
    } catch (err) {
      const errCode = err?.response?.data?.detail?.code || err?.response?.data?.code;
      if (errCode === "ERR_AI_QUOTA_EXCEEDED" || err?.response?.status === 429 || err?.response?.status === 402) {
        if (!user?.is_pro && aiUsage?.is_pro !== true) {
          setShowUpgradeModal(true);
        }
        showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
      } else {
        showToast(translateError(errCode), "error");
      }
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
      <div className={PAGE.wrapper}>
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

              {result && (
                <>
                  {/* Secondary button: Tải file khác */}
                  <button
                    type="button"
                    id="profiler-reanalyze-btn"
                    onClick={handleReset}
                    className={`${BTN.secondary} flex items-center gap-1.5 text-xs font-medium text-ink`}
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
                      className={`${BTN.secondary} p-1.5 text-muted hover:text-ink`}
                      title={t("profiler.action_menu_more", "Tùy chọn khác")}
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    {showMoreMenu && (
                      <div className="absolute right-0 top-8 z-30 w-52 py-1 bg-white border border-border rounded-xl shadow-lg text-xs space-y-0.5 animate-in fade-in">
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
                          onClick={handleDownloadReport}
                          className="w-full text-left px-3 py-2 text-ink hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <Download size={13} className="text-muted" />
                          <span>{t("profiler.col_download_report", "Tải báo cáo JSON")}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Primary Button: Tiếp tục: Làm sạch → */}
                  <button
                    type="button"
                    id="profiler-next-btn"
                    onClick={handleContinueClean}
                    className={`${BTN.primary} flex items-center gap-1.5 text-xs font-semibold`}
                  >
                    <span>{t("profiler.btn_continue_clean", "Tiếp tục: Làm sạch")}</span>
                    <ArrowRight size={14} />
                  </button>
                </>
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
            {/* 1. Column Table */}
            <ColumnTable
              result={result}
              overrides={overrides}
              getEffectiveType={getEffectiveType}
              handleOverride={handleOverride}
            />

            {/* 2. Merged Description & Context panel */}
            <MergedDescriptionBox
              fileHash={result.file_hash}
              description={description}
              setDescription={handleDescriptionChange}
              descriptionSource={descriptionSource}
              setDescriptionSource={setDescriptionSource}
              savedAt={savedAt}
              isSaving={isSaving}
              aiAnalyzed={aiAnalyzed}
              aiLoading={aiLoading}
              semanticContext={result.semantic_context}
              handleAnalyzeAI={handleAnalyzeAI}
              handleReanalyzeWithCorrection={handleReanalyzeWithCorrection}
              contextPurpose={contextPurpose}
              setContextPurpose={setContextPurpose}
              usage={aiUsage}
              isFromCache={isFromCache}
              savedLang={savedLang}
              onUpgradeClick={() => setShowUpgradeModal(true)}
            />

            {/* 3. Calm Footer Line: Countdown + Cached badge */}
            <ProfilerFooterLine
              uploadedAt={uploadedAt}
              filename={result.filename}
              isCached={Boolean(result.cached)}
            />
          </div>
        )}
      </div>

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
