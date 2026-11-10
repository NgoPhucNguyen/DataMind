import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Database,
  FileText,
  ListChecks,
  BarChart3,
  Lightbulb,
  Sparkles,
  ArrowLeft,
  FileDown,
  FileType2,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  Edit3,
  HelpCircle,
  X,
  AlertTriangle,
  SlidersHorizontal,
  BookOpen
} from "lucide-react";
import { PAGE, BTN } from "../constants/ui";
import api from "../services/axiosClient";
import { getAIUsage, getSessionStatus } from "../services/profilerService";
import { useAIAction } from "../hooks/useAIAction";
import FileExpiredBanner from "../components/FileExpiredBanner";
import UpgradeModal from "../components/UpgradeModal";
import AIUsageBadge from "../components/AIUsageBadge";
import PageHelpDocs from "../components/PageHelpDocs";
import {
  DistributionChart, CategoricalChart, TrendChart,
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import CorrelationReportView from "../components/charts/CorrelationReportView";
import { CorrelationGrid } from "../components/charts/CorrelationView";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import { formatInsight, getInsightTooltip } from "./Visualize";
import { computeEffectiveChart } from "../utils/chartView";
import { formatFigureTitle } from "../utils/reportNumbering";
import { buildKeyFindings, getIncludedSections } from "../utils/reportFindings";
import { buildReportDocument } from "../utils/reportDocument";
import { getCoverSettings } from "../contexts/FileSessionContext";
import { useChartTheme } from "../contexts/ChartThemeContext";
import { useConfirm } from "../components/ui/ConfirmDialog";
import md5 from "md5";

function formatR(val, locale = "vi-VN") {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMethodologySaveTime(isoString, lang = "vi") {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  if (!isoString) {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return isEn ? `Saved · ${hh}:${mm}` : `Đã lưu · ${hh}:${mm}`;
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      return isEn ? `Saved · ${hh}:${mm}` : `Đã lưu · ${hh}:${mm}`;
    }
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (isToday) {
      return isEn ? `Saved · ${hh}:${mm}` : `Đã lưu · ${hh}:${mm}`;
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    return isEn ? `Saved · ${dd}/${MM} ${hh}:${mm}` : `Đã lưu · ${dd}/${MM} ${hh}:${mm}`;
  } catch (_) {
    return isEn ? "Saved" : "Đã lưu";
  }
}

/**
 * Trích xuất chart id ổn định không phụ thuộc vào user_title:
 * 1. chart_id hoặc id nếu có.
 * 2. Nếu không có, suy ra từ type + column (+ col_y) ví dụ 'bar:<column>' hoặc 'scatter:<col_x>:<col_y>'.
 * Tuyệt đối không dùng user_title hay title.
 */
function getStableChartId(c) {
  if (typeof c === "string") return c;
  if (!c || typeof c !== "object") return "";
  const cid = c.chart_id || c.id;
  if (cid) return String(cid);
  const ctype = c.type || c.display_type || "chart";
  const col = c.column || c.col || c.col_x || "";
  const colY = c.col_y || "";
  return colY ? `${ctype}:${col}:${colY}` : `${ctype}:${col}`;
}

/**
 * Stable charts_hash algorithm (v2):
 * MD5 (first 12 hex chars) of comma-separated sorted stable chart IDs.
 * Stable chart ID = chart_id or id; if both missing, derived as '{type}:{column}'
 * or '{type}:{column}:{col_y}'.
 * Renaming user_title, reordering, or changing chart display settings does NOT change this hash.
 * Only adding or removing charts changes it.
 * Both backend (report.py) and frontend (Report.jsx) implement this exact algorithm.
 */
function computeChartsHash(chartList) {
  if (!chartList || chartList.length === 0) {
    return md5("").slice(0, 12);
  }
  const ids = chartList.map(getStableChartId).filter(Boolean);
  ids.sort();
  return md5(ids.join(",")).slice(0, 12);
}

/**
 * Legacy v1 hash calculator used for backward-compatibility with old saved intros.
 */
function computeChartsHashV1(chartList) {
  if (!chartList || chartList.length === 0) {
    return md5("").slice(0, 12);
  }
  const ids = chartList.map(c => {
    if (typeof c === "string") return c;
    return String(c.chart_id || c.id || c.user_title || c.title || "");
  });
  ids.sort();
  return md5(ids.join(",")).slice(0, 12);
}

function buildAutoMethodology(cleaner, t) {
  if (cleaner && cleaner.clean_mode && cleaner.clean_mode !== "skipped") {
    const stats = cleaner.stats || {};
    const duplicates = stats.duplicate_rows_removed ?? 0;
    const missing = Object.values(stats.missing_filled || {}).reduce((a, b) => a + b, 0);

    let methodStr = t("report.methodology_auto_summary", {
      mode: cleaner.clean_mode === "auto" ? "Tự động / Auto" : "Thủ công / Manual",
      duplicates,
      missing
    });

    if (stats.columns_dropped && stats.columns_dropped.length > 0) {
      methodStr += " " + t("report.methodology_dropped_cols", {
        cols: stats.columns_dropped.join(", ")
      });
    }

    if (stats.types_converted && Object.keys(stats.types_converted).length > 0) {
      methodStr += " " + t("report.methodology_types_converted", {
        count: Object.keys(stats.types_converted).length
      });
    }
    return methodStr;
  }
  return t("report.methodology_default");
}

export default function Report({ pipelineMode, onComplete }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "vi" ? "vi" : "en";
  const theme = useChartTheme();
  const { showToast } = useToast();
  const { user, subscription } = useAuth();
  const plan = (subscription?.plan || user?.tier || user?.plan || "free").toLowerCase();
  const isPro = plan === "pro";
  const { fileSession, updateFileSession } = useFileSession();
  const confirm = useConfirm();

  // State from server/session
  const [cachedIntroMeta, setCachedIntroMeta] = useState(null); // { text, source, charts_hash, hash_version, generated_at }
  const [introText, setIntroText] = useState("");
  const [contextData, setContextData] = useState(null); // { description, description_source, domain }
  const [cleanerState, setCleanerState] = useState(null);
  const [methodology, setMethodology] = useState("");
  const [serverMethodologyMeta, setServerMethodologyMeta] = useState(null); // { text, source, cleaning_hash, updated_at }
  const [methodologySaveStatus, setMethodologySaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [savedTimeString, setSavedTimeString] = useState("");
  const [currentCleaningHash, setCurrentCleaningHash] = useState(null);
  const [autoMethodology, setAutoMethodology] = useState("");
  const methodologySaveTimeoutRef = useRef(null);
  const pendingMethodologyTextRef = useRef(null);

  // Key Findings state
  const [keyFindingsUserText, setKeyFindingsUserText] = useState(null); // string if user edited, null if auto
  const [serverKeyFindingsMeta, setServerKeyFindingsMeta] = useState(null); // { text, source, charts_hash, updated_at }
  const [keyFindingsSaveStatus, setKeyFindingsSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [keyFindingsSavedTime, setKeyFindingsSavedTime] = useState("");
  const [isKeyFindingsEditing, setIsKeyFindingsEditing] = useState(false);
  const keyFindingsSaveTimeoutRef = useRef(null);
  const pendingKeyFindingsTextRef = useRef(null);

  // Appendix state
  const [isAppendixExpanded, setIsAppendixExpanded] = useState(false);

  // Charts
  const [charts, setCharts] = useState([]);

  // Usage & Upgrade
  const [aiUsage, setAiUsage] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [fileExpired, setFileExpired] = useState(false);

  // Check session status on mount
  useEffect(() => {
    if (!fileSession.fileHash) return;
    getSessionStatus(fileSession.fileHash)
      .then((res) => {
        if (!res.data.file_available) {
          setFileExpired(true);
        }
      })
      .catch((err) => {
        console.warn("Report session status check failed:", err);
      });
  }, [fileSession.fileHash]);

  // 1. Loading state initialization
  // Start loading only if there's a fileHash to fetch; otherwise false
  const [loadingState, setLoadingState] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [docxProgress, setDocxProgress] = useState(null); // { done, total }
  const [showPrintGuide, setShowPrintGuide] = useState(false);

  // Cover settings
  const coverSettings = useMemo(() => {
    return getCoverSettings(fileSession);
  }, [fileSession.reportCover]);

  const defaultCoverDate = useMemo(() => {
    return new Date().toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [lang]);

  const updateCover = (field, val) => {
    updateFileSession({
      reportCover: {
        ...coverSettings,
        [field]: val,
      },
    });
  };

  // Refs
  const reportRef = useRef(null);
  const chartRefs = useRef({});
  const introSaveTimeoutRef = useRef(null);
  const isUserTypingIntroRef = useRef(false);
  const printGuideRef = useRef(null);

  // Close print guide popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (printGuideRef.current && !printGuideRef.current.contains(e.target)) {
        setShowPrintGuide(false);
      }
    };
    if (showPrintGuide) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPrintGuide]);

  const fileHash = fileSession.fileHash;
  const fileName = fileSession.fileName || "Unknown";

  // Rows and columns resolution
  const totalRows = fileSession.profileData?.total_rows ??
    fileSession.profileData?.row_count ??
    fileSession.statisticalSummary?.shape?.[0] ?? 0;
  const totalCols = fileSession.profileData?.total_columns ??
    fileSession.profileData?.col_count ??
    fileSession.statisticalSummary?.shape?.[1] ?? 0;

  // Initial charts synchronization with persistence
  useEffect(() => {
    if (fileSession.confirmedCharts) {
      setCharts(fileSession.confirmedCharts);
    }
  }, [fileSession.confirmedCharts]);

  // Initial methodology sync from session if set
  useEffect(() => {
    if (fileSession.methodologyText !== undefined) {
      setMethodology(fileSession.methodologyText);
    }
  }, [fileSession.methodologyText]);

  // Initial key findings sync from session if set
  useEffect(() => {
    if (fileSession.keyFindingsText !== undefined && fileSession.keyFindingsText !== null) {
      setKeyFindingsUserText(fileSession.keyFindingsText);
    }
  }, [fileSession.keyFindingsText]);

  // Current charts hash
  const currentChartsHash = useMemo(() => {
    return computeChartsHash(charts);
  }, [charts]);

  // Default fallback template summary
  const defaultTemplateSummary = useMemo(() => {
    return t("report.overview_default_intro", {
      fileName,
      rows: Number(totalRows).toLocaleString(lang === "vi" ? "vi-VN" : "en-US"),
      cols: totalCols
    });
  }, [fileName, totalRows, totalCols, lang, t]);

  // 1. Fetch AI Usage on mount
  useEffect(() => {
    getAIUsage()
      .then(res => setAiUsage(res.data))
      .catch(err => console.error("Failed to fetch AI usage:", err));
  }, []);

  // 2. Fetch /report/state once per file_hash + lang
  useEffect(() => {
    if (!fileHash) {
      setLoadingState(false);
      return;
    }

    let isMounted = true;
    setLoadingState(true);

    api.get(`/report/state?file_hash=${encodeURIComponent(fileHash)}&lang=${lang}`)
      .then(res => {
        if (!isMounted) return;
        const data = res.data || {};

        // Context
        setContextData(data.context || null);

        // Cleaner & current cleaning_hash
        setCleanerState(data.cleaner || null);
        const resolvedCleaningHash = data.cleaning_hash || data.cleaner?.cleaning_hash || null;
        setCurrentCleaningHash(resolvedCleaningHash);

        const autoMethodStr = buildAutoMethodology(data.cleaner, t);
        setAutoMethodology(autoMethodStr);

        // Visualize: restore confirmed charts if not already in session
        if (!fileSession.confirmedCharts && data.visualize?.charts) {
          setCharts(data.visualize.charts);
          updateFileSession({ confirmedCharts: data.visualize.charts });
        }

        // Intro initialization logic:
        // a. Cached intro from /report/state (ai or user)
        // b. Else: profiler description (if any) + "\n\n" + free template summary
        if (data.intro && data.intro.text) {
          setCachedIntroMeta(data.intro);
          setIntroText(data.intro.text);
        } else {
          setCachedIntroMeta(null);
          const pDesc = data.context?.description ||
            (typeof fileSession.userContext === "string" ? fileSession.userContext : fileSession.userContext?.description) || "";
          if (pDesc.trim()) {
            setIntroText(`${pDesc.trim()}\n\n${defaultTemplateSummary}`);
          } else {
            setIntroText(defaultTemplateSummary);
          }
        }

        // Methodology resolution order:
        // 1. Server user version > 2. localStorage > 3. auto-generated text
        if (data.methodology && data.methodology.text && data.methodology.source === "user") {
          setMethodology(data.methodology.text);
          setServerMethodologyMeta(data.methodology);
          setSavedTimeString(formatMethodologySaveTime(data.methodology.updated_at, lang));
          setMethodologySaveStatus("saved");
          updateFileSession({ methodologyText: data.methodology.text });
        } else if (fileSession.methodologyText !== undefined && fileSession.methodologyText !== "") {
          setMethodology(fileSession.methodologyText);
          setServerMethodologyMeta(null);
          setMethodologySaveStatus("idle");
          setSavedTimeString("");
        } else {
          setMethodology(autoMethodStr);
          setServerMethodologyMeta(null);
          setMethodologySaveStatus("idle");
          setSavedTimeString("");
          updateFileSession({ methodologyText: autoMethodStr });
        }

        // Key Findings resolution order:
        // 1. Server user version > 2. localStorage > 3. auto text (null)
        if (data.key_findings && data.key_findings.text && data.key_findings.source === "user") {
          setKeyFindingsUserText(data.key_findings.text);
          setServerKeyFindingsMeta(data.key_findings);
          setKeyFindingsSavedTime(formatMethodologySaveTime(data.key_findings.updated_at, lang));
          setKeyFindingsSaveStatus("saved");
          updateFileSession({ keyFindingsText: data.key_findings.text });
        } else if (fileSession.keyFindingsText !== undefined && fileSession.keyFindingsText !== null && fileSession.keyFindingsText !== "") {
          setKeyFindingsUserText(fileSession.keyFindingsText);
          setServerKeyFindingsMeta(null);
          setKeyFindingsSaveStatus("idle");
          setKeyFindingsSavedTime("");
        } else {
          setKeyFindingsUserText(null);
          setServerKeyFindingsMeta(null);
          setKeyFindingsSaveStatus("idle");
          setKeyFindingsSavedTime("");
        }
      })
      .catch(err => {
        console.error("Failed to load report state:", err);
        if (isMounted) {
          setIntroText(defaultTemplateSummary);
          if (fileSession.methodologyText === undefined) {
            setMethodology(t("report.methodology_default"));
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoadingState(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fileHash, lang]);

  // Handle intro text change with debounce 800ms to /report/intro/save
  const handleIntroChange = (newVal) => {
    isUserTypingIntroRef.current = true;
    setIntroText(newVal);

    if (introSaveTimeoutRef.current) {
      clearTimeout(introSaveTimeoutRef.current);
    }

    introSaveTimeoutRef.current = setTimeout(async () => {
      if (!fileHash) return;
      try {
        const chartIds = (charts || []).map(getStableChartId).filter(Boolean);
        await api.post("/report/intro/save", {
          file_hash: fileHash,
          lang: lang,
          text: newVal,
          chart_ids: chartIds
        });
        setCachedIntroMeta(prev => ({
          ...(prev || {}),
          text: newVal,
          source: "user",
          charts_hash: currentChartsHash,
          hash_version: 2,
          generated_at: new Date().toISOString()
        }));
      } catch (err) {
        console.error("Failed to auto-save intro:", err);
      }
    }, 800);
  };

  // Methodology saving to server with offline localStorage fallback
  const saveMethodologyToServer = async (textToSave) => {
    if (!fileHash) return;
    setMethodologySaveStatus("saving");
    try {
      const res = await api.post("/report/methodology/save", {
        file_hash: fileHash,
        text: textToSave,
        cleaning_hash: currentCleaningHash
      });
      const savedData = res.data?.data;
      setServerMethodologyMeta(savedData || null);
      setSavedTimeString(formatMethodologySaveTime(savedData?.updated_at || new Date().toISOString(), lang));
      setMethodologySaveStatus("saved");
    } catch (err) {
      console.error("Failed to save methodology to server:", err);
      setMethodologySaveStatus("error");
    }
  };

  // Handle methodology text change: debounce 1s and save to localStorage
  const handleMethodologyChange = (newVal) => {
    setMethodology(newVal);
    pendingMethodologyTextRef.current = newVal;
    updateFileSession({ methodologyText: newVal });

    if (methodologySaveTimeoutRef.current) {
      clearTimeout(methodologySaveTimeoutRef.current);
    }
    methodologySaveTimeoutRef.current = setTimeout(() => {
      saveMethodologyToServer(newVal);
      pendingMethodologyTextRef.current = null;
    }, 1000);
  };

  // Handle methodology on blur: immediately flush pending debounce save
  const handleMethodologyBlur = () => {
    if (pendingMethodologyTextRef.current !== null) {
      if (methodologySaveTimeoutRef.current) {
        clearTimeout(methodologySaveTimeoutRef.current);
      }
      saveMethodologyToServer(pendingMethodologyTextRef.current);
      pendingMethodologyTextRef.current = null;
    }
  };

  // Restore auto-generated methodology via shared ConfirmDialog
  const handleRestoreAutoMethodology = async () => {
    if (!fileHash) return;
    const ok = await confirm({
      tone: "default",
      title: lang === "en" ? "Restore auto text?" : "Khôi phục bản tự động?",
      message: lang === "en"
        ? "Your edits will be replaced with the auto-generated text from the cleaning step."
        : "Nội dung bạn đã sửa sẽ bị thay bằng văn bản tạo tự động từ bước làm sạch.",
      confirmText: lang === "en" ? "Restore" : "Khôi phục",
      cancelText: lang === "en" ? "Cancel" : "Hủy",
    });
    if (!ok) return;

    try {
      await api.post("/report/methodology/save", {
        file_hash: fileHash,
        text: ""
      });
      setServerMethodologyMeta(null);
      const autoText = autoMethodology || buildAutoMethodology(cleanerState, t);
      setMethodology(autoText);
      updateFileSession({ methodologyText: autoText });
      setMethodologySaveStatus("idle");
      setSavedTimeString("");
    } catch (err) {
      console.error("Failed to restore auto methodology:", err);
      showToast(t("report.methodology_save_failed"), "error");
    }
  };

  // Auto Key Findings computation
  const autoKeyFindings = useMemo(() => {
    return buildKeyFindings(charts, fileSession.statisticalSummary, null, lang);
  }, [charts, fileSession.statisticalSummary, lang]);

  const autoKeyFindingsText = useMemo(() => {
    if (!autoKeyFindings || autoKeyFindings.length === 0) return "";
    return autoKeyFindings.map((b) => `• ${b}`).join("\n");
  }, [autoKeyFindings]);

  const isKeyFindingsChartsHashDifferent = useMemo(() => {
    if (!serverKeyFindingsMeta?.charts_hash) return false;
    return serverKeyFindingsMeta.charts_hash !== currentChartsHash;
  }, [serverKeyFindingsMeta, currentChartsHash]);

  // Key Findings saving to server
  const saveKeyFindingsToServer = async (textToSave) => {
    if (!fileHash) return;
    setKeyFindingsSaveStatus("saving");
    try {
      const res = await api.post("/report/text/save", {
        file_hash: fileHash,
        section: "key_findings",
        text: textToSave,
        charts_hash: currentChartsHash,
      });
      const savedData = res.data?.data;
      setServerKeyFindingsMeta(savedData || null);
      setKeyFindingsSavedTime(formatMethodologySaveTime(savedData?.updated_at || new Date().toISOString(), lang));
      setKeyFindingsSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save key findings to server:", err);
      setKeyFindingsSaveStatus("error");
    }
  };

  const handleKeyFindingsChange = (newVal) => {
    setKeyFindingsUserText(newVal);
    pendingKeyFindingsTextRef.current = newVal;
    updateFileSession({ keyFindingsText: newVal });

    if (keyFindingsSaveTimeoutRef.current) {
      clearTimeout(keyFindingsSaveTimeoutRef.current);
    }
    keyFindingsSaveTimeoutRef.current = setTimeout(() => {
      saveKeyFindingsToServer(newVal);
      pendingKeyFindingsTextRef.current = null;
    }, 1000);
  };

  const handleKeyFindingsBlur = () => {
    if (pendingKeyFindingsTextRef.current !== null) {
      if (keyFindingsSaveTimeoutRef.current) {
        clearTimeout(keyFindingsSaveTimeoutRef.current);
      }
      saveKeyFindingsToServer(pendingKeyFindingsTextRef.current);
      pendingKeyFindingsTextRef.current = null;
    }
  };

  const handleRestoreAutoKeyFindings = async () => {
    if (!fileHash) return;
    const ok = await confirm({
      tone: "default",
      title: lang === "en" ? "Restore auto key findings?" : "Khôi phục điểm chính tự động?",
      message: lang === "en"
        ? "Your edits will be replaced with the automatically extracted key findings."
        : "Nội dung bạn đã sửa sẽ bị thay bằng các điểm chính được trích xuất tự động.",
      confirmText: lang === "en" ? "Restore" : "Khôi phục",
      cancelText: lang === "en" ? "Cancel" : "Hủy",
    });
    if (!ok) return;

    try {
      await api.post("/report/text/save", {
        file_hash: fileHash,
        section: "key_findings",
        text: "",
      });
      setServerKeyFindingsMeta(null);
      setKeyFindingsUserText(null);
      updateFileSession({ keyFindingsText: null });
      setKeyFindingsSaveStatus("idle");
      setKeyFindingsSavedTime("");
      setIsKeyFindingsEditing(false);
    } catch (err) {
      console.error("Failed to restore auto key findings:", err);
      showToast(t("report.key_findings_save_failed"), "error");
    }
  };

  // Section inclusion state
  const includedSections = useMemo(() => {
    return getIncludedSections(fileSession);
  }, [fileSession.reportSectionsIncluded]);

  // Appendix data dictionary rows
  const appendixRows = useMemo(() => {
    const colsMap = fileSession.statisticalSummary?.columns || {};
    let colNames = [];
    if (fileSession.profileData?.columns && Array.isArray(fileSession.profileData.columns)) {
      colNames = fileSession.profileData.columns
        .map((c) => (typeof c === "string" ? c : c?.name))
        .filter((n) => n && colsMap[n]);
      Object.keys(colsMap).forEach((col) => {
        if (!colNames.includes(col)) colNames.push(col);
      });
    } else {
      colNames = Object.keys(colsMap);
    }

    return colNames.map((colName, idx) => {
      const stats = colsMap[colName] || {};
      const letter = stats.letter || String.fromCharCode(65 + (idx % 26));

      let typeLabel = t("report.appendix_type_text");
      const dtype = stats.dtype;
      const isScale = stats.is_scale === true || (dtype === "numeric" && stats.is_discrete && stats.is_scale);
      if (dtype === "numeric") {
        if (isScale) {
          typeLabel = t("report.appendix_type_scale");
        } else if (stats.is_discrete) {
          typeLabel = t("report.appendix_type_discrete");
        } else {
          typeLabel = t("report.appendix_type_numeric");
        }
      } else if (dtype === "categorical") {
        typeLabel = t("report.appendix_type_categorical");
      } else if (dtype === "multiple_choice") {
        typeLabel = t("report.appendix_type_multiple_choice");
      } else if (dtype === "datetime") {
        typeLabel = t("report.appendix_type_datetime");
      }

      let note = "";
      if (isScale) {
        note = t("report.appendix_scale_notes", {
          min: stats.scale_min ?? 1,
          max: stats.scale_max ?? 5,
        });
      } else if (stats.skip_chart) {
        let reason = stats.skip_reason || "";
        if (stats.skip_key === "missing_high") {
          reason = t("report.appendix_skip_missing_high");
        } else if (stats.skip_key === "single_value") {
          reason = t("report.appendix_skip_single_value");
        } else if (stats.skip_key === "free_text") {
          reason = t("report.appendix_skip_free_text");
        }
        note = `${t("report.appendix_skipped_prefix")}${reason}`;
      }

      return {
        colName,
        letter,
        typeLabel,
        missingPct: stats.missing_pct ?? 0,
        uniqueCount: stats.unique_count ?? 0,
        note,
      };
    });
  }, [fileSession.statisticalSummary, fileSession.profileData, lang, t]);

  // Warning when saved cleaning_hash differs from current cleaning_hash (data was re-cleaned)
  const isCleaningStale = Boolean(
    serverMethodologyMeta?.source === "user" &&
    serverMethodologyMeta?.cleaning_hash &&
    currentCleaningHash &&
    serverMethodologyMeta.cleaning_hash !== currentCleaningHash
  );

  // AI Action for generating / regenerating Intro
  const aiAction = useAIAction({
    actionFn: async ({ signal } = {}) => {
      const schemaFallback = fileSession.statisticalSummary?.columns
        ? Object.entries(fileSession.statisticalSummary.columns).map(([name, info]) => ({ name, detected_type: info.dtype }))
        : [];

      const payload = {
        file_hash: fileHash,
        session_id: fileSession.sessionId,
        file_name: fileName,
        row_count: totalRows,
        col_count: totalCols,
        schema: fileSession.profileData?.columns || schemaFallback,
        charts: charts || [],
        user_context: fileSession.userContext || null,
        lang: lang
      };

      const res = await api.post("/report/intro", payload, { signal });
      const data = res.data || {};

      if (data.is_fallback) {
        showToast(t("report.toast_ai_unavailable"), "error");
      } else if (data.intro) {
        setIntroText(data.intro);
        setCachedIntroMeta({
          text: data.intro,
          source: "ai",
          charts_hash: data.charts_hash || currentChartsHash,
          hash_version: 2,
          generated_at: new Date().toISOString()
        });
        if (data.usage) {
          setAiUsage(data.usage);
        }
      }
      return data;
    },
    usage: aiUsage,
    onUsageUpdated: setAiUsage,
    onUpgradeClick: () => {
      if (!user?.is_pro && aiUsage?.is_pro !== true) {
        setShowUpgradeModal(true);
      }
      showToast(t("errors.ERR_AI_QUOTA_EXCEEDED"), "error");
    },
    getPreviousContent: () => ({
      introText,
      cachedIntroMeta,
    }),
    onRestore: (prev) => {
      if (prev) {
        setIntroText(prev.introText);
        setCachedIntroMeta(prev.cachedIntroMeta);
      }
    },
    onError: (err) => {
      const errCode = err?.response?.data?.detail?.code || err?.response?.data?.code;
      const status = err?.response?.status;

      if (errCode === "ERR_AI_QUOTA_EXCEEDED" || status === 429 || status === 402) {
        if (!user?.is_pro && aiUsage?.is_pro !== true) {
          setShowUpgradeModal(true);
        }
        showToast(t("errors.ERR_AI_QUOTA_EXCEEDED"), "error");
      } else if (errCode === "ERR_AI_UNAVAILABLE" || status === 503) {
        showToast(t("report.toast_ai_unavailable"), "error");
      } else {
        showToast(t("report.toast_ai_unavailable"), "error");
      }
    },
  });

  // Generate / Regenerate Intro via AI
  const handleGenerateIntroAI = async () => {
    // If current text source is "user" (manually edited), confirm before overwriting
    if (cachedIntroMeta?.source === "user") {
      const ok = await confirm({
        tone: "danger",
        title: lang === "en" ? "Overwrite edited overview?" : "Ghi đè tổng quan đã sửa?",
        message: t("report.overview_confirm_overwrite_user"),
        confirmText: lang === "en" ? "Overwrite" : "Ghi đè",
        cancelText: lang === "en" ? "Cancel" : "Hủy",
      });
      if (!ok) return;
    }
    aiAction.execute();
  };

  // Chart order management
  const moveChart = (index, direction) => {
    const newCharts = [...charts];
    if (direction === -1 && index > 0) {
      [newCharts[index - 1], newCharts[index]] = [newCharts[index], newCharts[index - 1]];
    } else if (direction === 1 && index < newCharts.length - 1) {
      [newCharts[index + 1], newCharts[index]] = [newCharts[index], newCharts[index + 1]];
    }
    setCharts(newCharts);
    updateFileSession({ confirmedCharts: newCharts });
  };

  // Remove chart with confirmation dialog
  const handleRemoveChart = async (cid, figureTitle) => {
    const hasAiIntro = Boolean(cachedIntroMeta?.source === "ai" || cachedIntroMeta?.text);
    const line1 = lang === "en"
      ? `${figureTitle} will be removed from the report. The chart is still available in the Visualize step and can be re-added later.`
      : `${figureTitle} sẽ bị xóa khỏi báo cáo. Biểu đồ vẫn còn ở bước Visualize, bạn có thể thêm lại sau.`;
    const line2 = hasAiIntro
      ? (lang === "en"
          ? "The AI-generated Overview will be flagged as needing an update."
          : "Phần Tổng quan do AI viết sẽ được đánh dấu cần cập nhật.")
      : "";

    const ok = await confirm({
      tone: "danger",
      title: lang === "en" ? "Remove from report?" : "Xóa khỏi báo cáo?",
      message: line2 ? `${line1}\n\n${line2}` : line1,
      confirmText: lang === "en" ? "Remove" : "Xóa",
      cancelText: lang === "en" ? "Cancel" : "Hủy",
    });

    if (!ok) return;

    const newCharts = charts.filter((c) => (c.chart_id || c.id) !== cid);
    setCharts(newCharts);
    updateFileSession({ confirmedCharts: newCharts });
  };

  // Export to PDF via Browser Print
  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    const originalTitle = document.title;
    const cleanFileName = (fileName || "Report").replace(/\.[^/.]+$/, "");
    const printTitle = `DataMind_Report_${cleanFileName}`;

    // Inject dynamic @page style for margin box footer with file name and localized page numbers
    const safeFileName = (fileName || "Report").replace(/["\\]/g, "\\$&");
    const pageWord = lang === "en" ? "Page " : "Trang ";
    const styleEl = document.createElement("style");
    styleEl.id = "print-page-style";
    styleEl.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 16mm 14mm;
        @bottom-left {
          content: "DataMind · ${safeFileName}";
          font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
          font-size: 8pt;
          color: #626C65;
        }
        @bottom-right {
          content: "${pageWord}" counter(page) " / " counter(pages);
          font-family: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
          font-size: 8pt;
          color: #626C65;
        }
      }
    `;
    document.head.appendChild(styleEl);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.documentElement.classList.remove("is-printing");
      document.title = originalTitle;
      const injected = document.getElementById("print-page-style");
      if (injected) {
        injected.remove();
      }
      setIsExportingPdf(false);
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup, { once: true });

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      document.documentElement.classList.add("is-printing");

      // Wait for charts to re-layout (2 animation frames + ~320ms for ResponsiveContainer debounce)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 320));

      document.title = printTitle;
      window.print();
    } catch (error) {
      console.error("Export PDF failed:", error);
      showToast(t("report.toast_export_pdf_error"), "error");
      cleanup();
    } finally {
      // Browsers like Chromium block on window.print(); ensure fallback cleanup runs
      setTimeout(cleanup, 500);
    }
  };

  const statsMap = fileSession.statisticalSummary?.columns || {};

  // Export to Word (DOCX)
  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    setDocxProgress(null);
    try {
      const { exportReportToDocx } = await import("../utils/exportDocx");

      console.debug("[DOCX Export] Initiating export with plan:", plan, "from sources:", {
        subscriptionPlan: subscription?.plan,
        userTier: user?.tier,
        userPlan: user?.plan,
      });

      const documentModel = buildReportDocument({
        fileSession: {
          ...fileSession,
          introText,
          methodologyText: methodology,
          keyFindingsText: keyFindingsUserText,
        },
        summary: fileSession.statisticalSummary,
        charts,
        settings: fileSession.chartSettings || {},
        palette: theme,
        included: includedSections,
        cover: coverSettings,
        plan,
        lang,
        t,
      });

      await exportReportToDocx({
        documentModel,
        charts,
        statsMap,
        settings: fileSession.chartSettings || {},
        summary: fileSession.statisticalSummary || {},
        palette: theme,
        plan,
        lang,
        t,
        onProgress: (done, total) => {
          setDocxProgress({ done, total });
        },
      });
    } catch (error) {
      console.error("Export DOCX failed:", error);
      showToast(t("report.toast_export_docx_error"), "error");
    } finally {
      setIsExportingDocx(false);
      setDocxProgress(null);
    }
  };
  const descriptionContext = contextData?.description ||
    (typeof fileSession.userContext === "string" ? fileSession.userContext : fileSession.userContext?.description) || "";

  const isChartsHashDifferent = useMemo(() => {
    if (!cachedIntroMeta?.charts_hash) return false;
    // If intro has hash_version (v2+), compare directly with currentChartsHash
    if (cachedIntroMeta.hash_version) {
      return cachedIntroMeta.charts_hash !== currentChartsHash;
    }
    // Backward-compatibility for old saved intros without hash_version:
    // Check against both current v2 hash and legacy v1 hash. If it matches either, it is not stale!
    const legacyHash = computeChartsHashV1(charts);
    return (
      cachedIntroMeta.charts_hash !== currentChartsHash &&
      cachedIntroMeta.charts_hash !== legacyHash
    );
  }, [cachedIntroMeta, currentChartsHash, charts]);

  const formattedDate = useMemo(() => {
    const localeStr = lang === "vi" ? "vi-VN" : "en-US";
    return new Date().toLocaleDateString(localeStr, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }, [lang]);

  return (
    <div className={`${PAGE.wrapper} bg-[#FBFBFA]`}>
      <div className="max-w-4xl mx-auto w-full print:max-w-none print:w-full print:m-0 print:p-0">

        {/* Header Actions (Not printed) */}
        <div className="no-print flex flex-wrap gap-4 justify-between items-center mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted" />
              {t("report.title_interactive")}
            </h1>
            {aiUsage && (
              <AIUsageBadge
                usage={aiUsage}
                onUpgradeClick={() => setShowUpgradeModal(true)}
              />
            )}
            <PageHelpDocs pageId="report" />
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex items-center">
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf || isExportingDocx}
                className={`${BTN.secondary} flex items-center gap-2 text-ink rounded-r-none border-r-0`}
                title={t("report.export_pdf_tooltip")}
              >
                <FileDown className="w-4 h-4 text-muted" />
                {isExportingPdf ? t("report.exporting") : t("report.export_pdf")}
              </button>
              <div className="relative" ref={printGuideRef}>
                <button
                  type="button"
                  onClick={() => setShowPrintGuide(prev => !prev)}
                  className={`${BTN.secondary} px-2.5 rounded-l-none text-muted hover:text-ink hover:bg-[#EAEAEA] transition-colors border-l border-[#D1D5DB] flex items-center justify-center`}
                  title={t("report.print_guide_btn_title")}
                  aria-label={t("report.print_guide_btn_title")}
                >
                  <HelpCircle className="w-4 h-4 text-[#1B4324]" />
                </button>

                {showPrintGuide && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#EAEAEA] rounded-xl shadow-xl p-4 z-50 text-left text-xs leading-relaxed text-ink animate-slide-in">
                    <div className="flex items-center justify-between font-semibold text-sm mb-2 text-[#1B4324] pb-2 border-b border-[#EAEAEA]">
                      <span>{t("report.print_guide_title")}</span>
                      <button
                        type="button"
                        onClick={() => setShowPrintGuide(false)}
                        className="text-muted hover:text-ink p-1 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[#2C3E50]">
                      <li>
                        <span className="font-semibold text-ink">{t("report.print_guide_step1_label")}:</span>{" "}
                        {t("report.print_guide_step1_desc")}
                      </li>
                      <li>
                        <span className="font-semibold text-ink">{t("report.print_guide_step2_label")}:</span>{" "}
                        {t("report.print_guide_step2_desc")}
                      </li>
                      <li>
                        <span className="font-semibold text-ink">{t("report.print_guide_step3_label")}:</span>{" "}
                        {t("report.print_guide_step3_desc")}
                      </li>
                      <li>
                        <span className="font-semibold text-ink">{t("report.print_guide_step4_label")}:</span>{" "}
                        {t("report.print_guide_step4_desc")}
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleExportDocx}
              disabled={isExportingPdf || isExportingDocx}
              className={`${BTN.secondary} flex items-center gap-2 text-ink`}
            >
              <FileType2 className="w-4 h-4 text-muted" />
              {docxProgress
                ? t("report.export_docx_progress", {
                    done: docxProgress.done,
                    total: docxProgress.total,
                    defaultValue: lang === "en"
                      ? `Generating Word file… (${docxProgress.done}/${docxProgress.total} charts)`
                      : `Đang tạo file Word… (${docxProgress.done}/${docxProgress.total} biểu đồ)`,
                  })
                : isExportingDocx
                ? t("report.exporting")
                : t("report.export_docx")}
            </button>
          </div>
        </div>

        {fileExpired && (
          <div className="no-print print:hidden">
            <FileExpiredBanner
              fileName={fileName}
              fileHash={fileHash}
              onReuploaded={() => {
                setFileExpired(false);
              }}
            />
          </div>
        )}

        {/* Document Container */}
        <div
          ref={reportRef}
          className="report-print-root bg-white border border-[#EAEAEA] rounded-xl shadow-sm p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:rounded-none print:bg-white"
        >
          {/* Report Title (Screen only) */}
          <div className="report-screen-header border-b border-[#EAEAEA] pb-6 mb-8 text-center group relative print:hidden">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-2">
              {t("report.doc_title")}
            </h1>
            <p className="text-muted text-sm sm:text-base">
              {t("report.dataset_label")}{" "}
              <span className="font-semibold text-ink">{fileName}</span>
            </p>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {t("report.created_at_label")} {formattedDate}
            </p>
          </div>

          {/* Report Title (Print only: compact title + ONE meta line) */}
          <div className="report-print-header hidden print:block mb-4 pb-2 border-b border-[#1B4324]">
            <h1 className="font-bold text-ink mb-1" style={{ fontSize: "18pt", lineHeight: 1.25 }}>
              {t("report.doc_title")}
            </h1>
            <p className="report-meta-line text-[#626C65]" style={{ fontSize: "9.5pt", lineHeight: 1.35 }}>
              {fileName} · {t("report.rows_cols_summary", {
                rows: Number(totalRows).toLocaleString(lang === "vi" ? "vi-VN" : "en-US"),
                cols: totalCols
              })} · {formattedDate}
            </p>
          </div>

          {/* Sections in export selector (Screen only - Hidden in print) */}
          <div className="no-print print:hidden mb-8 p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-xl flex flex-col gap-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted" />
                <span className="font-semibold text-ink">{t("report.sections_included_label")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { key: "overview", label: t("report.sec_overview") },
                  { key: "key_findings", label: t("report.sec_key_findings") },
                  { key: "methodology", label: t("report.sec_methodology") },
                  { key: "detailed_analysis", label: t("report.sec_detailed_analysis") },
                  { key: "appendix", label: t("report.sec_appendix") },
                ].map(({ key, label }) => (
                  <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer select-none text-ink hover:text-forest transition-colors">
                    <input
                      type="checkbox"
                      checked={includedSections[key] !== false}
                      onChange={(e) => {
                        const next = { ...includedSections, [key]: e.target.checked };
                        updateFileSession({ reportSectionsIncluded: next });
                      }}
                      className="rounded border-[#D1D5DB] text-forest focus:ring-forest w-3.5 h-3.5 cursor-pointer accent-[#1B4324]"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}

                <div className="w-[1px] h-4 bg-[#D1D5DB] hidden sm:block mx-1"></div>

                {/* Two export-only checkboxes: Trang bìa & Mục lục */}
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-ink hover:text-forest transition-colors font-medium">
                  <input
                    type="checkbox"
                    checked={coverSettings.enabled !== false}
                    onChange={(e) => updateCover("enabled", e.target.checked)}
                    className="rounded border-[#D1D5DB] text-forest focus:ring-forest w-3.5 h-3.5 cursor-pointer accent-[#1B4324]"
                  />
                  <span>{t("report.export_cover_label")}</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-ink hover:text-forest transition-colors font-medium">
                  <input
                    type="checkbox"
                    checked={coverSettings.toc !== false}
                    onChange={(e) => updateCover("toc", e.target.checked)}
                    className="rounded border-[#D1D5DB] text-forest focus:ring-forest w-3.5 h-3.5 cursor-pointer accent-[#1B4324]"
                  />
                  <span>{t("report.export_toc_label")}</span>
                </label>
              </div>
            </div>

            {/* When Trang bìa is on: Show 4 fields + plan note */}
            {coverSettings.enabled !== false && (
              <div className="pt-3 border-t border-[#EAEAEA] flex flex-col gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      {t("report.cover_title_label")}
                    </label>
                    <input
                      type="text"
                      value={coverSettings.title}
                      placeholder={t("report.cover_default_title")}
                      onChange={(e) => updateCover("title", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-xs text-ink focus:border-forest focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      {t("report.cover_author_label")}
                    </label>
                    <input
                      type="text"
                      value={coverSettings.author}
                      placeholder={lang === "en" ? "Author name" : "Nguyễn Văn A"}
                      onChange={(e) => updateCover("author", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-xs text-ink focus:border-forest focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      {t("report.cover_org_label")}
                    </label>
                    <input
                      type="text"
                      value={coverSettings.organization}
                      placeholder={lang === "en" ? "Organization / Class" : "Công ty / Đơn vị / Lớp"}
                      onChange={(e) => updateCover("organization", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-xs text-ink focus:border-forest focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      {t("report.cover_date_label")}
                    </label>
                    <input
                      type="text"
                      value={coverSettings.date}
                      placeholder={defaultCoverDate}
                      onChange={(e) => updateCover("date", e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-xs text-ink focus:border-forest focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Plan note */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest/10 text-forest font-semibold text-[10px]">
                      PRO · Không logo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#EAEAEA] bg-white shadow-2xs">
                      <img src="/logo_icon.png" alt="DataMind" className="w-3.5 h-3.5 object-contain" />
                      <span className="font-semibold text-forest text-[10px]">FREE · Có logo DataMind</span>
                    </span>
                  )}
                  <span className="text-muted italic">
                    {isPro ? t("report.cover_pro_note") : t("report.cover_free_note")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 1. Dataset Info Section (Screen only - Hidden in print) */}
          <div className="report-section mb-10 group relative border-b border-[#EAEAEA] pb-8 print:hidden">
            <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-muted" />
              {t("report.sec_dataset_info")}
            </h2>
            <div className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg p-4 text-sm text-ink flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="text-muted">{t("report.dataset_label")}</span>{" "}
                <span className="font-semibold">{fileName}</span>
              </div>
              <div className="w-[1px] h-4 bg-[#EAEAEA] hidden sm:block"></div>
              <div>
                <span className="text-muted">{t("report.created_at_label")}</span>{" "}
                <span className="font-semibold">{formattedDate}</span>
              </div>
              <div className="w-[1px] h-4 bg-[#EAEAEA] hidden sm:block"></div>
              <div>
                <span className="font-semibold">
                  {t("report.rows_cols_summary", {
                    rows: Number(totalRows).toLocaleString(lang === "vi" ? "vi-VN" : "en-US"),
                    cols: totalCols
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Overview Section (Merged with context, single textarea, no blur) */}
          <div className={`report-section mb-10 group relative border-b border-[#EAEAEA] pb-8 print:border-b-0 print:pb-0 print:mb-[13pt] ${!includedSections.overview ? "opacity-50 report-section-excluded" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5">
                <h2 className="report-section-title text-base font-bold text-ink flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted" />
                  {t("report.sec_overview")}
                </h2>
                {cachedIntroMeta && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E5E7EB] text-ink">
                    {cachedIntroMeta.source === "user" ? t("report.overview_badge_edited") : t("report.overview_badge_ai")}
                  </span>
                )}
                {!includedSections.overview && (
                  <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-muted border border-[#E5E7EB]">
                    {t("report.section_excluded_badge")}
                  </span>
                )}
                {isChartsHashDifferent && (
                  <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {t("report.overview_charts_changed")}
                  </span>
                )}
              </div>

              {/* Action buttons (Not printed) */}
              <div className="no-print print:hidden flex items-center gap-2">
                {aiAction.loading ? (
                  aiAction.AIRunningBar
                ) : cachedIntroMeta ? (
                  <button
                    onClick={handleGenerateIntroAI}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest text-white hover:bg-forest/90 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t("report.overview_btn_regenerate")}
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateIntroAI}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest text-white hover:bg-forest/90 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("report.overview_btn_generate")}
                  </button>
                )}
              </div>
            </div>

            {/* Muted line under heading referencing profiler description */}
            <div className="mb-3 text-xs text-muted flex items-center gap-1.5">
              {descriptionContext.trim() ? (
                <>
                  <span>{t("report.overview_context_hint")}</span>
                  <Link
                    to="/dashboard/profiler"
                    className="no-print print:hidden text-forest hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    {t("report.overview_context_edit_link")}
                  </Link>
                </>
              ) : (
                <>
                  <span>{t("report.overview_no_context_hint")}</span>
                  <Link
                    to="/dashboard/profiler"
                    className="no-print print:hidden text-forest hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    {t("report.overview_no_context_link")}
                  </Link>
                </>
              )}
            </div>
            <textarea
              value={introText}
              readOnly={aiAction.loading || loadingState}
              onChange={(e) => handleIntroChange(e.target.value)}
              className="no-print print:hidden w-full min-h-[140px] p-4 bg-[#F9F9F8] border border-[#EAEAEA] hover:border-[#D1D5DB] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors"
              placeholder={loadingState || aiAction.loading ? t("report.overview_generating") : t("report.overview_placeholder")}
            />
            <div className="report-textbox print-only hidden print:block text-sm text-ink leading-relaxed whitespace-pre-wrap p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg">
              {introText || t("report.overview_placeholder")}
            </div>
          </div>

          {/* 3. Key Findings Section (Điểm chính) */}
          <div className={`report-section mb-10 group relative border-b border-[#EAEAEA] pb-8 print:border-b-0 print:pb-0 print:mb-[13pt] ${!includedSections.key_findings ? "opacity-50 report-section-excluded" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <h2 className="report-section-title text-base font-bold text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-forest" />
                  {t("report.sec_key_findings")}
                </h2>
                {serverKeyFindingsMeta?.source === "user" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E5E7EB] text-ink">
                    {t("report.overview_badge_edited")}
                  </span>
                )}
                {!includedSections.key_findings && (
                  <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-muted border border-[#E5E7EB]">
                    {t("report.section_excluded_badge")}
                  </span>
                )}
                {/* Small save status with fixed min-width */}
                <div className="no-print print:hidden min-w-[140px] inline-flex items-center">
                  {keyFindingsSaveStatus === "saving" && (
                    <span className="text-xs text-[#626C65] font-medium animate-pulse">
                      {lang === "en" ? "Saving…" : "Đang lưu…"}
                    </span>
                  )}
                  {keyFindingsSaveStatus === "saved" && (
                    <span className="text-xs text-[#626C65] font-medium">
                      {keyFindingsSavedTime || (lang === "en" ? "Saved" : "Đã lưu")}
                    </span>
                  )}
                  {keyFindingsSaveStatus === "error" && (
                    <button
                      type="button"
                      onClick={() => saveKeyFindingsToServer(keyFindingsUserText ?? autoKeyFindingsText)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {t("report.key_findings_save_failed")}
                    </button>
                  )}
                </div>
              </div>

              {/* Actions: Edit toggle & Restore */}
              <div className="no-print print:hidden flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isKeyFindingsEditing && keyFindingsUserText === null) {
                      setKeyFindingsUserText(autoKeyFindingsText);
                    }
                    setIsKeyFindingsEditing((prev) => !prev);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#EAEAEA] bg-white text-ink hover:bg-[#F9F9F8] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-muted" />
                  {isKeyFindingsEditing ? t("report.key_findings_btn_done") : t("report.key_findings_btn_edit")}
                </button>

                {(serverKeyFindingsMeta?.source === "user" || keyFindingsUserText !== null) && (
                  <button
                    type="button"
                    onClick={handleRestoreAutoKeyFindings}
                    className="text-xs text-muted hover:text-ink font-medium inline-flex items-center gap-1 cursor-pointer ml-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t("report.key_findings_btn_restore")}
                  </button>
                )}
              </div>
            </div>

            {/* Stale warning if charts changed after user edited */}
            {isKeyFindingsChartsHashDifferent && (serverKeyFindingsMeta?.source === "user" || keyFindingsUserText !== null) && (
              <div className="no-print print:hidden mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>{t("report.key_findings_stale_warning")}</span>
                </span>
                <button
                  type="button"
                  onClick={handleRestoreAutoKeyFindings}
                  className="ml-3 font-semibold text-amber-900 hover:underline cursor-pointer flex-shrink-0"
                >
                  {t("report.key_findings_btn_restore")}
                </button>
              </div>
            )}

            {/* Content (Screen) */}
            <div className="no-print print:hidden">
              {isKeyFindingsEditing ? (
                <textarea
                  value={keyFindingsUserText ?? autoKeyFindingsText}
                  onChange={(e) => handleKeyFindingsChange(e.target.value)}
                  onBlur={handleKeyFindingsBlur}
                  placeholder={t("report.key_findings_placeholder")}
                  className="w-full min-h-[140px] p-4 bg-[#F9F9F8] border border-[#EAEAEA] hover:border-[#D1D5DB] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors font-sans"
                />
              ) : keyFindingsUserText !== null ? (
                <div className="p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {keyFindingsUserText}
                </div>
              ) : autoKeyFindings.length === 0 ? (
                <div className="p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg text-sm text-muted italic">
                  {t("report.key_findings_empty")}
                </div>
              ) : (
                <div className="p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg text-sm text-ink leading-relaxed">
                  <ul className="space-y-2 list-none p-0 m-0">
                    {autoKeyFindings.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="text-forest font-bold leading-relaxed select-none">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Content (Print only) */}
            <div className="report-textbox print-only hidden print:block text-sm text-ink leading-relaxed p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg">
              {keyFindingsUserText !== null ? (
                <div className="whitespace-pre-wrap">{keyFindingsUserText}</div>
              ) : autoKeyFindings.length === 0 ? (
                <p className="text-muted italic">{t("report.key_findings_empty")}</p>
              ) : (
                <ul className="space-y-1.5 list-none p-0 m-0">
                  {autoKeyFindings.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#1B4324] font-bold leading-relaxed select-none">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 4. Methodology Section */}
          <div className={`report-section mb-10 group relative border-b border-[#EAEAEA] pb-8 print:border-b-0 print:pb-0 print:mb-[13pt] ${!includedSections.methodology ? "opacity-50 report-section-excluded" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <h2 className="report-section-title text-base font-bold text-ink flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-muted" />
                  {t("report.sec_methodology")}
                </h2>
                {serverMethodologyMeta?.source === "user" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E5E7EB] text-ink">
                    {t("report.overview_badge_edited")}
                  </span>
                )}
                {!includedSections.methodology && (
                  <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-muted border border-[#E5E7EB]">
                    {t("report.section_excluded_badge")}
                  </span>
                )}
                {/* Small save status with fixed min-width to avoid layout jump */}
                <div className="no-print print:hidden min-w-[140px] inline-flex items-center">
                  {methodologySaveStatus === "saving" && (
                    <span className="text-xs text-[#626C65] font-medium animate-pulse">
                      {lang === "en" ? "Saving…" : "Đang lưu…"}
                    </span>
                  )}
                  {methodologySaveStatus === "saved" && (
                    <span className="text-xs text-[#626C65] font-medium">
                      {savedTimeString || (lang === "en" ? "Saved" : "Đã lưu")}
                    </span>
                  )}
                  {methodologySaveStatus === "error" && (
                    <button
                      type="button"
                      onClick={() => saveMethodologyToServer(methodology)}
                      className="text-xs text-[#B42318] hover:underline font-medium cursor-pointer"
                    >
                      {lang === "en" ? "Save failed — Retry" : "Lưu thất bại — Thử lại"}
                    </button>
                  )}
                </div>
              </div>

              {/* Restore auto text button (only when user version exists and not already showing stale warning) */}
              {serverMethodologyMeta?.source === "user" && !isCleaningStale && (
                <div className="no-print print:hidden">
                  <button
                    type="button"
                    onClick={handleRestoreAutoMethodology}
                    className="text-xs text-muted hover:text-ink font-medium underline transition-colors"
                  >
                    {t("report.methodology_btn_restore")}
                  </button>
                </div>
              )}
            </div>

            {/* Muted warning if data was re-cleaned */}
            {isCleaningStale && (
              <div className="no-print print:hidden mb-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t("report.methodology_stale_warning")}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreAutoMethodology}
                  className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 shrink-0"
                >
                  {t("report.methodology_btn_restore")}
                </button>
              </div>
            )}

            <textarea
              value={methodology}
              onChange={(e) => handleMethodologyChange(e.target.value)}
              onBlur={handleMethodologyBlur}
              className="no-print print:hidden w-full min-h-[85px] p-4 bg-[#F9F9F8] border border-[#EAEAEA] hover:border-[#D1D5DB] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors"
              placeholder={t("report.methodology_placeholder")}
            />
            <div className="report-textbox print-only hidden print:block text-sm text-ink leading-relaxed whitespace-pre-wrap p-4 bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg">
              {methodology || t("report.methodology_placeholder")}
            </div>
          </div>

          {/* 5. Detailed Analysis Section */}
          <div className={`report-section mb-10 group relative border-b border-[#EAEAEA] pb-8 print:border-b-0 print:pb-0 print:mb-[13pt] ${!includedSections.detailed_analysis ? "opacity-50 report-section-excluded" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-[#EAEAEA] pb-2 print:border-b-0 print:pb-0 print:mb-[8pt]">
              <h2 className="report-section-title text-base font-bold text-ink flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted" />
                {t("report.sec_detailed_analysis")}
              </h2>
              {!includedSections.detailed_analysis && (
                <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-muted border border-[#E5E7EB]">
                  {t("report.section_excluded_badge")}
                </span>
              )}
            </div>

            {charts.length === 0 ? (
              <div className="bg-[#F9F9F8] border border-dashed border-[#D1D5DB] rounded-lg p-6 text-center">
                <p className="text-muted text-sm mb-2">{t("report.charts_empty")}</p>
                <Link
                  to="/dashboard/visualize"
                  className="no-print text-forest hover:underline text-xs font-semibold print:hidden inline-flex items-center gap-1"
                >
                  {t("report.charts_add_hint")} →
                </Link>
              </div>
            ) : (
              <div className="space-y-12 report-charts-grid print:space-y-0">
                {charts.map((chart, idx) => {
                  const cid = chart.chart_id || chart.id;
                  const colName = chart.column || chart.col;
                  const colStats = statsMap[colName] || {};

                  // Resolve settings: live chartSettings in fileSession takes priority, else chart.settings, else defaults
                  const chartSettings = fileSession.chartSettings?.[cid] ?? chart.settings ?? {};
                  const effective = computeEffectiveChart(
                    chart,
                    colStats,
                    chartSettings,
                    fileSession.statisticalSummary,
                    t,
                    lang
                  );

                  const displayType = effective.displayType;
                  const effectiveData = effective.effectiveData;
                  const effectiveStats = effective.effectiveStats || colStats;

                  let matrix = null;
                  let topCorr = null;

                  if (displayType === "heatmap") {
                    matrix = fileSession.statisticalSummary?.correlation_matrix ||
                      fileSession.statisticalSummary?.correlation?.matrix;
                    topCorr = fileSession.statisticalSummary?.top_correlations ||
                      fileSession.statisticalSummary?.correlation?.top_corr;
                  }

                  const isCorrPair = chart.type === "corr_pair";
                  const color = chart.color || theme.primary;

                  if (displayType === "heatmap") {
                    if (!matrix && !fileSession.statisticalSummary?.correlation_v2 && !chart.correlation_v2) return null;
                  } else if (isCorrPair) {
                    if (!chart.payload) return null;
                  } else {
                    if (displayType !== "box" && effectiveData.length === 0) return null;
                    if (displayType === "box" && !effectiveStats.min) return null;
                  }

                  const autoInsights = colStats.auto_insights || [];
                  const aiExplanation = chart.ai_explanation || fileSession.chartExplanations?.[cid]?.content;

                  const isFullWidth = Boolean(
                    (aiExplanation && aiExplanation.trim()) ||
                    displayType === "heatmap" ||
                    isCorrPair ||
                    (displayType === "pie" && effectiveData && effectiveData.length > 6) ||
                    (displayType === "bar" && effectiveData && effectiveData.length > 8)
                  );

                  const containerHeight = isCorrPair
                    ? "auto"
                    : displayType === "bar"
                    ? Math.max(288, effective.calculatedBarHeight || 0)
                    : (displayType === "heatmap" || displayType === "pie")
                    ? "auto"
                    : 288;

                  const chartTitle = isCorrPair
                    ? (chart.user_title || `[${chart.letter_x}] ${chart.col_x} × [${chart.letter_y}] ${chart.col_y}`)
                    : (chart.user_title || chart.title || chart.auto_title);

                  const figureTitle = formatFigureTitle(idx + 1, chartTitle, lang);
                  const isHeatmap = displayType === "heatmap";

                  return (
                    <div
                      key={cid || idx}
                      data-chart-type={isCorrPair ? "corr_pair" : displayType}
                      className={`report-chart-card relative group border border-transparent hover:border-[#EAEAEA] p-4 rounded-xl transition-colors print:p-2 print:border print:border-[#EAEAEA] ${
                        isHeatmap ? "report-card-heatmap break-inside-auto" : "break-inside-avoid"
                      } ${
                        isFullWidth
                          ? "col-span-2 report-chart-full"
                          : "col-span-1 report-chart-half"
                      }`}
                    >
                      {/* Controls (Hidden in print) */}
                      <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 print:hidden bg-white shadow-sm border border-[#EAEAEA] rounded-md p-1 z-10">
                        <button
                          onClick={() => moveChart(idx, -1)}
                          disabled={idx === 0}
                          title="Di chuyển lên"
                          className="p-1.5 text-muted hover:text-ink disabled:opacity-30 rounded hover:bg-gray-100"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveChart(idx, 1)}
                          disabled={idx === charts.length - 1}
                          title="Di chuyển xuống"
                          className="p-1.5 text-muted hover:text-ink disabled:opacity-30 rounded hover:bg-gray-100"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] bg-[#EAEAEA] mx-1"></div>
                        <button
                          onClick={() => handleRemoveChart(cid, figureTitle)}
                          title="Xóa biểu đồ"
                          className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Chart Title with Figure Numbering */}
                      <h3 className="report-chart-title text-base font-bold text-ink mb-3 flex items-center gap-2">
                        <span className="report-chart-title-text">
                          {figureTitle}
                        </span>
                      </h3>

                      {/* Chart Container */}
                      <div
                        className="report-chart-container mb-3 w-full"
                        style={{
                          minHeight: (displayType === "pie" || displayType === "heatmap" || isCorrPair || displayType === "box") ? "auto" : "288px",
                          height: (displayType === "box" || displayType === "pie") ? "auto" : (typeof containerHeight === "number" ? `${containerHeight}px` : containerHeight)
                        }}
                        ref={(el) => (chartRefs.current[cid] = el)}
                      >
                        {displayType === "histogram" && (
                          <DistributionChart
                            data={effectiveData}
                            color={color}
                            isDiscrete={effectiveStats?.is_discrete}
                          />
                        )}
                        {displayType === "bar" && (
                          <CategoricalChart data={effectiveData} color={color} />
                        )}
                        {displayType === "line" && (
                          <TrendChart data={effectiveData} color={color} />
                        )}
                        {displayType === "heatmap" && (
                          <CorrelationReportView
                            chart={chart}
                            summary={fileSession.statisticalSummary}
                            settings={chartSettings}
                            tableNumber={1}
                          />
                        )}
                        {isCorrPair && (
                          <div className="w-full">
                            <p className="text-xs text-[#626C65] font-medium mb-3">
                              r = {formatR(chart.r, lang === "en" ? "en-US" : "vi-VN")} ({chart.method === "pearson" ? "Pearson" : "Spearman"}) · n = {chart.n}
                            </p>
                            {chart.payload?.mode === "grid" ? (
                              <CorrelationGrid
                                gridData={chart.payload}
                                colA={{ letter: chart.letter_x, name: chart.col_x }}
                                colB={{ letter: chart.letter_y, name: chart.col_y }}
                                noScroll={true}
                              />
                            ) : (
                              <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart margin={{ top: 15, right: 25, bottom: 35, left: 15 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.borderGrid} />
                                    <XAxis
                                      dataKey="x"
                                      type="number"
                                      name={chart.col_x}
                                      stroke={theme.tickColor}
                                      tick={{ fill: theme.tickColor, fontFamily: theme.fontFamily }}
                                      fontSize={10}
                                      label={{
                                        value: `[${chart.letter_x}] ${chart.col_x}`,
                                        position: "insideBottomRight",
                                        offset: -5,
                                        fill: theme.tickColor,
                                        fontSize: 11,
                                        fontFamily: theme.fontFamily,
                                      }}
                                    />
                                    <YAxis
                                      dataKey="y"
                                      type="number"
                                      name={chart.col_y}
                                      stroke={theme.tickColor}
                                      tick={{ fill: theme.tickColor, fontFamily: theme.fontFamily }}
                                      fontSize={10}
                                      label={{
                                        value: `[${chart.letter_y}] ${chart.col_y}`,
                                        position: "insideTopLeft",
                                        offset: -5,
                                        fill: theme.tickColor,
                                        fontSize: 11,
                                        angle: -90,
                                        fontFamily: theme.fontFamily,
                                      }}
                                    />
                                    <RechartsTooltip
                                      cursor={{ strokeDasharray: "3 3", stroke: theme.tickColor }}
                                      contentStyle={{
                                        backgroundColor: "#ffffff",
                                        border: `1px solid ${theme.borderGrid}`,
                                        borderRadius: 8,
                                        color: theme.textDark,
                                        fontSize: 12,
                                        fontFamily: theme.fontFamily,
                                      }}
                                      wrapperStyle={{ zIndex: 1000, fontFamily: theme.fontFamily }}
                                      formatter={(value, name) => [
                                        typeof value === "number" ? value.toFixed(2) : value,
                                        name === "x" ? chart.col_x : chart.col_y,
                                      ]}
                                    />
                                    <Scatter
                                      data={chart.payload?.points || []}
                                      fill={theme.primary}
                                      fillOpacity={0.6}
                                      r={3.5}
                                    />
                                  </ScatterChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        )}
                        {displayType === "pie" && (
                          <PieChartComponent
                            data={effectiveData}
                            color={color}
                            isDiscrete={effectiveStats?.is_discrete}
                            isScale={effectiveStats?.is_scale}
                          />
                        )}
                        {displayType === "box" && (
                          <BoxPlotChart stats={effectiveStats} color={color} />
                        )}
                      </div>

                      {/* Discrete scale / rating subtitle */}
                      {effectiveStats?.is_discrete && (
                        <p className="text-[11px] text-[#626C65] mt-1 mb-3">
                          {effectiveStats.is_scale
                            ? t("visualize.scale_subtitle", { min: effectiveStats.scale_min, max: effectiveStats.scale_max, n: effectiveStats.respondents })
                            : t("visualize.discrete_subtitle", { n: effectiveStats.respondents })
                          }
                        </p>
                      )}

                      {/* Multiple choice note */}
                      {colStats.dtype === "multiple_choice" && (
                        <p className="text-[11px] text-[#626C65] mt-1 mb-3 italic">
                          {t("report.mc_disclaimer")}
                        </p>
                      )}

                      {/* Auto Insights (Lightbulb) - Same formatting as Visualize */}
                      {displayType !== "heatmap" && autoInsights.length > 0 && (
                        <div className="report-auto-insights mt-3 pt-3 border-t border-[#EAEAEA] print:mt-1.5 print:pt-1.5">
                          <p className="text-xs font-semibold text-[#1B4324] mb-1.5 flex items-center gap-1.5 print:text-[8.5pt] print:mb-0.5">
                            <Lightbulb className="w-3.5 h-3.5 text-[#1B4324]" />
                            {t("report.auto_insights_title")}
                          </p>
                          <ul className="space-y-1 print:space-y-0.5">
                            {autoInsights.slice(0, 2).map((ins, insIdx) => {
                              const text = formatInsight(ins, t);
                              if (!text) return null;
                              const tooltip = getInsightTooltip(ins, t);
                              return (
                                <li
                                  key={insIdx}
                                  className={`text-xs text-[#2A342D] leading-snug line-clamp-2 print:text-[8.5pt] print:leading-tight ${tooltip ? "cursor-help" : ""}`}
                                  title={tooltip}
                                >
                                  • {text}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* AI Explanation (Read-only with link to Visualize) */}
                      {!aiExplanation || !aiExplanation.trim() ? (
                        <div className="no-print print:hidden mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-muted" />
                              {t("report.ai_explanation_title")}
                            </p>
                            <Link
                              to="/dashboard/visualize"
                              className="text-[11px] font-medium text-forest hover:underline inline-flex items-center gap-1"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              {t("report.ai_explanation_create_link")}
                            </Link>
                          </div>
                          <p className="text-xs text-muted italic">
                            {t("report.ai_explanation_none")}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 pt-3 border-t border-gray-100 print:border-[#EAEAEA] print:mt-2 print:pt-2">
                          <div className="flex items-center justify-between mb-1.5 print:hidden">
                            <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-muted" />
                              {t("report.ai_explanation_title")}
                            </p>
                            <Link
                              to="/dashboard/visualize"
                              className="no-print print:hidden text-[11px] font-medium text-forest hover:underline inline-flex items-center gap-1"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              {t("report.ai_explanation_edit_link")}
                            </Link>
                          </div>
                          <div className="report-textbox bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg p-3 text-xs text-ink leading-relaxed whitespace-pre-wrap">
                            {aiExplanation}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Appendix: Data Dictionary Section */}
          <div className={`report-section group relative pt-4 ${!includedSections.appendix ? "opacity-50 report-section-excluded" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-[#EAEAEA] pb-2 print:border-b-0 print:pb-0 print:mb-[8pt]">
              <h2 className="report-section-title text-base font-bold text-ink flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted" />
                {t("report.sec_appendix")}
              </h2>
              {!includedSections.appendix && (
                <span className="no-print print:hidden text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-muted border border-[#E5E7EB]">
                  {t("report.section_excluded_badge")}
                </span>
              )}
            </div>

            {appendixRows.length === 0 ? (
              <p className="text-muted text-sm italic">{t("report.charts_empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#1B4324] text-ink font-semibold bg-[#F9F9F8] print:bg-transparent">
                      <th className="py-2.5 px-3 w-12 text-center">{t("report.appendix_th_col")}</th>
                      <th className="py-2.5 px-3 min-w-[140px]">{t("report.appendix_th_name")}</th>
                      <th className="py-2.5 px-3 w-28">{t("report.appendix_th_type")}</th>
                      <th className="py-2.5 px-3 w-20 text-right">{t("report.appendix_th_missing")}</th>
                      <th className="py-2.5 px-3 w-24 text-right">{t("report.appendix_th_unique")}</th>
                      <th className="py-2.5 px-3 min-w-[160px]">{t("report.appendix_th_notes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA]">
                    {appendixRows.map((row, rIdx) => {
                      const isHiddenScreen = !isAppendixExpanded && rIdx >= 10;
                      return (
                        <tr
                          key={row.colName || rIdx}
                          className={`hover:bg-[#F9F9F8] transition-colors ${isHiddenScreen ? "hidden print:table-row" : ""}`}
                        >
                          <td className="py-2 px-3 text-center font-mono font-semibold text-forest text-xs">
                            {row.letter}
                          </td>
                          <td className="py-2 px-3 font-medium text-ink break-words whitespace-normal">
                            {row.colName}
                          </td>
                          <td className="py-2 px-3 text-muted">
                            {row.typeLabel}
                          </td>
                          <td className="py-2 px-3 text-right text-muted tabular-nums">
                            {row.missingPct}%
                          </td>
                          <td className="py-2 px-3 text-right text-muted tabular-nums">
                            {Number(row.uniqueCount).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}
                          </td>
                          <td className="py-2 px-3 text-muted text-xs break-words whitespace-normal">
                            {row.note || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {appendixRows.length > 10 && (
                  <div className="mt-4 text-center no-print print:hidden">
                    <button
                      type="button"
                      onClick={() => setIsAppendixExpanded((prev) => !prev)}
                      className="text-xs font-semibold text-forest hover:underline inline-flex items-center gap-1 cursor-pointer py-1.5 px-3.5 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F9F9F8] shadow-sm transition-colors"
                    >
                      {isAppendixExpanded
                        ? t("report.appendix_btn_collapse")
                        : t("report.appendix_btn_expand", { n: appendixRows.length })}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Upgrade Pro Modal */}
      {aiAction.AIConfirmModal}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => {
          getAIUsage().then(r => setAiUsage(r.data)).catch(console.error);
        }}
      />
    </div>
  );
}
