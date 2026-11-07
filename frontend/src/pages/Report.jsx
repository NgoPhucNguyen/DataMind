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
  Edit3
} from "lucide-react";
import { PAGE, BTN } from "../constants/ui";
import api from "../services/axiosClient";
import { getAIUsage, getSessionStatus } from "../services/profilerService";
import { useAIAction } from "../hooks/useAIAction";
import FileExpiredBanner from "../components/FileExpiredBanner";
import UpgradeModal from "../components/UpgradeModal";
import AIUsageBadge from "../components/AIUsageBadge";
import {
  DistributionChart, CategoricalChart, TrendChart,
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import { formatInsight } from "./Visualize";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import md5 from "md5";

function computeChartsHash(chartList) {
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

export default function Report({ pipelineMode, onComplete }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { fileSession, updateFileSession } = useFileSession();

  // State from server/session
  const [cachedIntroMeta, setCachedIntroMeta] = useState(null); // { text, source, charts_hash, generated_at }
  const [introText, setIntroText] = useState("");
  const [contextData, setContextData] = useState(null); // { description, description_source, domain }
  const [cleanerState, setCleanerState] = useState(null);
  const [methodology, setMethodology] = useState("");

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

  // Refs
  const reportRef = useRef(null);
  const chartRefs = useRef({});
  const introSaveTimeoutRef = useRef(null);
  const isUserTypingIntroRef = useRef(false);

  const lang = i18n.language === "vi" ? "vi" : "en";
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

  // Initial methodology sync
  useEffect(() => {
    if (fileSession.methodologyText !== undefined) {
      setMethodology(fileSession.methodologyText);
    }
  }, [fileSession.methodologyText]);

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

        // Cleaner
        setCleanerState(data.cleaner || null);

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

        // Methodology: if fileSession already has methodologyText, respect it; otherwise construct from cleaner
        if (fileSession.methodologyText === undefined) {
          const cleaner = data.cleaner;
          let methodStr = "";
          if (cleaner && cleaner.clean_mode && cleaner.clean_mode !== "skipped") {
            const stats = cleaner.stats || {};
            const duplicates = stats.duplicate_rows_removed ?? 0;
            const missing = Object.values(stats.missing_filled || {}).reduce((a, b) => a + b, 0);

            methodStr = t("report.methodology_auto_summary", {
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
          } else {
            methodStr = t("report.methodology_default");
          }
          setMethodology(methodStr);
          updateFileSession({ methodologyText: methodStr });
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
        const chartIds = (charts || []).map(c => c.chart_id || c.id || "");
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
          generated_at: new Date().toISOString()
        }));
      } catch (err) {
        console.error("Failed to auto-save intro:", err);
      }
    }, 800);
  };

  // Handle methodology text change with session persistence
  const handleMethodologyChange = (newVal) => {
    setMethodology(newVal);
    updateFileSession({ methodologyText: newVal });
  };

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
  const handleGenerateIntroAI = () => {
    // If current text source is "user" (manually edited), confirm before overwriting
    if (cachedIntroMeta?.source === "user") {
      const confirmOverwrite = window.confirm(t("report.overview_confirm_overwrite_user"));
      if (!confirmOverwrite) return;
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

  const removeChart = (chartId) => {
    const newCharts = charts.filter(c => (c.chart_id || c.id) !== chartId);
    setCharts(newCharts);
    updateFileSession({ confirmedCharts: newCharts });
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`DataMind_Report_${fileName}.pdf`);
    } catch (error) {
      console.error("Export PDF failed:", error);
      showToast(t("report.toast_export_pdf_error"), "error");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export to Word (DOCX)
  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const children = [];
      const localeStr = lang === "vi" ? "vi-VN" : "en-US";
      const formattedDate = new Date().toLocaleDateString(localeStr, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });

      // 1. Title & Header
      children.push(new Paragraph({
        text: t("report.word_doc_title"),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({
        text: t("report.word_dataset", { name: fileName }),
        alignment: AlignmentType.CENTER
      }));
      children.push(new Paragraph({
        text: t("report.word_created_at", { date: formattedDate }),
        alignment: AlignmentType.CENTER
      }));
      children.push(new Paragraph({ text: "" }));

      // 2. Dataset Info Section (if info exists)
      children.push(new Paragraph({ text: t("report.sec_dataset_info"), heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({
        text: `${t("report.dataset_label")} ${fileName} | ${t("report.rows_cols_summary", {
          rows: Number(totalRows).toLocaleString(localeStr),
          cols: totalCols
        })}`
      }));
      children.push(new Paragraph({ text: "" }));

      // 3. Overview Section (only if non-empty)
      if (introText && introText.trim()) {
        children.push(new Paragraph({ text: t("report.sec_overview"), heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: introText.trim() }));
        children.push(new Paragraph({ text: "" }));
      }

      // 4. Methodology Section (only if non-empty)
      if (methodology && methodology.trim()) {
        children.push(new Paragraph({ text: t("report.sec_methodology"), heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: methodology.trim() }));
        children.push(new Paragraph({ text: "" }));
      }

      // 6. Detailed Analysis Section
      if (charts.length > 0) {
        children.push(new Paragraph({ text: t("report.sec_detailed_analysis"), heading: HeadingLevel.HEADING_2 }));

        for (let i = 0; i < charts.length; i++) {
          const chart = charts[i];
          const cid = chart.chart_id || chart.id;
          const title = chart.user_title || chart.title || chart.auto_title || `Biểu đồ ${i + 1}`;

          children.push(new Paragraph({ text: `${i + 1}. ${title}`, heading: HeadingLevel.HEADING_3 }));

          const chartEl = chartRefs.current[cid];
          if (chartEl) {
            try {
              const canvas = await html2canvas(chartEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
              const imgData = canvas.toDataURL("image/png");
              const base64Data = imgData.replace(/^data:image\/png;base64,/, "");

              children.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                    transformation: {
                      width: 500,
                      height: 500 * (canvas.height / canvas.width),
                    },
                  })
                ],
                alignment: AlignmentType.CENTER
              }));
            } catch (err) {
              console.warn("Could not capture chart for docx:", err);
            }
          }

          // Auto insights (Lightbulb)
          const colName = chart.column || chart.col;
          const stats = statsMap[colName] || {};
          const autoInsights = stats.auto_insights || [];
          if (chart.type !== "heatmap" && autoInsights.length > 0) {
            children.push(new Paragraph({
              text: `${t("report.auto_insights_title")}:`,
              spacing: { before: 120 }
            }));
            autoInsights.forEach(ins => {
              children.push(new Paragraph({ text: `• ${formatInsight(ins, t)}` }));
            });
          }

          // AI explanation - only if present and non-empty (never empty AI heading)
          const aiExpl = chart.ai_explanation || fileSession.chartExplanations?.[cid]?.content;
          if (aiExpl && aiExpl.trim()) {
            children.push(new Paragraph({
              text: `${t("report.ai_explanation_title")}:`,
              spacing: { before: 160 }
            }));
            children.push(new Paragraph({ text: aiExpl.trim() }));
          }

          children.push(new Paragraph({ text: "" }));
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `DataMind_Report_${fileName}.docx`);

    } catch (error) {
      console.error("Export DOCX failed:", error);
      showToast(t("report.toast_export_docx_error"), "error");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const statsMap = fileSession.statisticalSummary?.columns || {};
  const descriptionContext = contextData?.description ||
    (typeof fileSession.userContext === "string" ? fileSession.userContext : fileSession.userContext?.description) || "";

  const isChartsHashDifferent = cachedIntroMeta?.charts_hash && cachedIntroMeta.charts_hash !== currentChartsHash;

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
        <div className="flex flex-wrap gap-4 justify-between items-center mb-6 print:hidden">
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || isExportingDocx}
              className={`${BTN.secondary} flex items-center gap-2 text-ink`}
            >
              <FileDown className="w-4 h-4 text-muted" />
              {isExportingPdf ? t("report.exporting") : t("report.export_pdf")}
            </button>
            <button
              onClick={handleExportDocx}
              disabled={isExportingPdf || isExportingDocx}
              className={`${BTN.secondary} flex items-center gap-2 text-ink`}
            >
              <FileType2 className="w-4 h-4 text-muted" />
              {isExportingDocx ? t("report.exporting") : t("report.export_docx")}
            </button>
          </div>
        </div>

        {fileExpired && (
          <FileExpiredBanner
            fileName={fileName}
            fileHash={fileHash}
            onReuploaded={() => {
              setFileExpired(false);
            }}
          />
        )}

        {/* Document Container */}
        <div
          ref={reportRef}
          className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:rounded-none print:bg-white"
        >
          {/* Report Title */}
          <div className="border-b border-[#EAEAEA] pb-6 mb-8 text-center group relative">
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

          {/* 1. Dataset Info Section */}
          <div className="mb-10 group relative border-b border-[#EAEAEA] pb-8">
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
          <div className="mb-10 group relative border-b border-[#EAEAEA] pb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted" />
                  {t("report.sec_overview")}
                </h2>
                {cachedIntroMeta && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E5E7EB] text-ink">
                    {cachedIntroMeta.source === "user" ? t("report.overview_badge_edited") : t("report.overview_badge_ai")}
                  </span>
                )}
                {isChartsHashDifferent && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {t("report.overview_charts_changed")}
                  </span>
                )}
              </div>

              {/* Action buttons (Not printed) */}
              <div className="print:hidden flex items-center gap-2">
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
                    className="text-forest hover:underline font-medium inline-flex items-center gap-0.5 print:hidden"
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
                    className="text-forest hover:underline font-medium inline-flex items-center gap-0.5 print:hidden"
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
              className="w-full min-h-[140px] p-4 bg-[#F9F9F8] border border-[#EAEAEA] hover:border-[#D1D5DB] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors print:border-none print:bg-transparent print:resize-none print:p-0"
              placeholder={loadingState || aiAction.loading ? t("report.overview_generating") : t("report.overview_placeholder")}
            />
          </div>

          {/* 3. Methodology Section */}
          <div className="mb-10 group relative border-b border-[#EAEAEA] pb-8">
            <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-muted" />
              {t("report.sec_methodology")}
            </h2>
            <textarea
              value={methodology}
              onChange={(e) => handleMethodologyChange(e.target.value)}
              className="w-full min-h-[85px] p-4 bg-[#F9F9F8] border border-[#EAEAEA] hover:border-[#D1D5DB] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors print:border-none print:bg-transparent print:resize-none print:p-0"
              placeholder={t("report.methodology_placeholder")}
            />
          </div>

          {/* 5. Detailed Analysis Section */}
          <div>
            <h2 className="text-base font-bold text-ink mb-6 flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
              <BarChart3 className="w-4 h-4 text-muted" />
              {t("report.sec_detailed_analysis")}
            </h2>

            {charts.length === 0 ? (
              <div className="bg-[#F9F9F8] border border-dashed border-[#D1D5DB] rounded-lg p-6 text-center">
                <p className="text-muted text-sm mb-2">{t("report.charts_empty")}</p>
                <Link
                  to="/dashboard/visualize"
                  className="text-forest hover:underline text-xs font-semibold print:hidden inline-flex items-center gap-1"
                >
                  {t("report.charts_add_hint")} →
                </Link>
              </div>
            ) : (
              <div className="space-y-12">
                {charts.map((chart, idx) => {
                  const cid = chart.chart_id || chart.id;
                  const colName = chart.column || chart.col;
                  const colStats = statsMap[colName] || {};

                  let chartData = [];
                  let matrix = null;
                  let topCorr = null;

                  if (chart.type === "histogram") {
                    chartData = colStats.distribution_bins || [];
                  } else if (chart.type === "bar" || chart.type === "pie") {
                    chartData = colStats.top_values || [];
                  } else if (chart.type === "line") {
                    chartData = colStats.trend_data || [];
                  }

                  if (chart.type === "heatmap") {
                    matrix = fileSession.statisticalSummary?.correlation_matrix ||
                      fileSession.statisticalSummary?.correlation?.matrix;
                    topCorr = fileSession.statisticalSummary?.top_correlations ||
                      fileSession.statisticalSummary?.correlation?.top_corr;
                  }

                  const color = chart.color || "#1B4324";

                  if (chart.type === "heatmap" && (!matrix || Object.keys(matrix).length === 0)) return null;
                  if (chart.type !== "heatmap" && chart.type !== "box" && chartData.length === 0) return null;
                  if (chart.type === "box" && !colStats.min) return null;

                  const autoInsights = colStats.auto_insights || [];
                  const aiExplanation = chart.ai_explanation || fileSession.chartExplanations?.[cid]?.content;

                  return (
                    <div
                      key={cid || idx}
                      className="break-inside-avoid relative group border border-transparent hover:border-[#EAEAEA] p-4 rounded-xl transition-colors"
                    >
                      {/* Controls (Hidden in print) */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 print:hidden bg-white shadow-sm border border-[#EAEAEA] rounded-md p-1 z-10">
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
                          onClick={() => removeChart(cid)}
                          title="Xóa biểu đồ"
                          className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Chart Title */}
                      <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#1B4324] text-white flex items-center justify-center text-xs shrink-0 font-medium">
                          {idx + 1}
                        </span>
                        {chart.user_title || chart.title || chart.auto_title}
                      </h3>

                      {/* Chart Container */}
                      <div className="h-72 mb-4" ref={(el) => (chartRefs.current[cid] = el)}>
                        {chart.type === "histogram" && <DistributionChart data={chartData} color={color} />}
                        {chart.type === "bar" && <CategoricalChart data={chartData} color={color} />}
                        {chart.type === "line" && <TrendChart data={chartData} color={color} />}
                        {chart.type === "heatmap" && <CorrelationHeatmap matrix={matrix} topCorr={topCorr} />}
                        {chart.type === "pie" && <PieChartComponent data={chartData} color={color} />}
                        {chart.type === "box" && <BoxPlotChart stats={colStats} color={color} />}
                      </div>

                      {/* Multiple choice note */}
                      {colStats.dtype === "multiple_choice" && (
                        <p className="text-[11px] text-[#626C65] mt-1 mb-3 italic">
                          {t("report.mc_disclaimer")}
                        </p>
                      )}

                      {/* Auto Insights (Lightbulb) - Same formatting as Visualize */}
                      {chart.type !== "heatmap" && autoInsights.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#EAEAEA]">
                          <p className="text-xs font-semibold text-[#1B4324] mb-1.5 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-[#1B4324]" />
                            {t("report.auto_insights_title")}
                          </p>
                          <ul className="space-y-1">
                            {autoInsights.slice(0, 2).map((ins, insIdx) => (
                              <li key={insIdx} className="text-xs text-[#2A342D] leading-snug line-clamp-2">
                                • {formatInsight(ins, t)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI Explanation (Read-only with link to Visualize) */}
                      <div className="mt-3 pt-3 border-t border-gray-100 print:border-[#EAEAEA]">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-muted" />
                            {t("report.ai_explanation_title")}
                          </p>
                          <Link
                            to="/dashboard/visualize"
                            className="text-[11px] font-medium text-forest hover:underline print:hidden inline-flex items-center gap-1"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            {aiExplanation ? t("report.ai_explanation_edit_link") : t("report.ai_explanation_create_link")}
                          </Link>
                        </div>

                        {aiExplanation && aiExplanation.trim() ? (
                          <div className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg p-3 text-xs text-ink leading-relaxed whitespace-pre-wrap">
                            {aiExplanation}
                          </div>
                        ) : (
                          <p className="text-xs text-muted italic">
                            {t("report.ai_explanation_none")}
                          </p>
                        )}
                      </div>

                    </div>
                  );
                })}
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
