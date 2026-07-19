import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/axiosClient";
import { Check, X, AlertTriangle, ArrowLeft, ArrowRight, Lock, FolderUp, Upload, Info, Settings, Edit2, ChevronUp, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { useRef } from "react";
import { profileFile } from "../services/profilerService";
import { detectIssues, autoClean, confirmClean } from "../services/cleanerService";
import PageHeader from "../components/PageHeader";
import { TEXT, BTN, BADGE, CARD } from "../constants/ui";

// --- Components Biểu Đồ ---

import {
  DistributionChart, CategoricalChart, TrendChart,
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import PageHelpDocs from "../components/PageHelpDocs";

import AnchorScatterPanel from "../components/charts/AnchorScatterPanel";
import AIInsightsCard from "../components/charts/AIInsightsCard";
import CorrelationSuggestions from "../components/charts/CorrelationSuggestions";
import { getUser } from "../services/authService";



const COLOR_PRESETS = [
  { id: 'sage', color: '#1B4324', name: 'Sage Green' },
  { id: 'ocean', color: '#1D4ED8', name: 'Ocean Blue' },
  { id: 'coral', color: '#B91C1C', name: 'Coral Red' },
  { id: 'sunset', color: '#C2410C', name: 'Sunset Orange' },
];

const ENABLE_CHART_EDIT = false; // bật lại khi xử lý xong cache-invalidation cho edit chart

const ChartCard = ({ chart, isSelected, toggleChart, summary, onUpdate, onCellClick, anchorPair, ai_insights_enabled, sessionId, fileHash }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(chart.user_title || chart.title);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    onUpdate(chart.id, { user_title: localTitle });
  };

  const handleApplyConfig = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newType = formData.get("chart_type");
    const newCol = formData.get("column_x");
    const newColor = formData.get("color_preset");

    let newData = chart.data;
    let newStats = summary?.columns?.[newCol];

    if (newCol !== chart.col || !newData || newType !== chart.type) {
      if (newType === "histogram" || newType === "box") newData = newStats?.distribution_bins;
      else if (newType === "bar" || newType === "pie") newData = newStats?.top_values;
      else if (newType === "line") newData = newStats?.trend_data;
    }

    const newAutoTitle = newCol !== chart.col ? `${newType} - ${newCol}` : (chart.auto_title || chart.title);

    onUpdate(chart.id, {
      type: newType,
      col: newCol,
      color: newColor,
      data: newData,
      title: newCol !== chart.col ? newAutoTitle : chart.title,
      user_title: newCol !== chart.col ? newAutoTitle : (chart.user_title || chart.title),
      auto_title: newAutoTitle
    });
    setLocalTitle(newCol !== chart.col ? newAutoTitle : localTitle);
    setIsSettingsOpen(false);
  };

  const stats = summary?.columns?.[chart.col];
  const insights = stats?.auto_insights || [];
  const availableColumns = summary?.columns ? Object.keys(summary.columns) : [];

  return (
    <div className={`${CARD} relative transition-all ${isSelected ? "border-[#1B4324] shadow-[0_2px_8px_rgba(27,67,36,0.04)]" : "hover:border-[#626C65]/40"}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2 flex-1">
          {ENABLE_CHART_EDIT && (
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-1.5 text-muted hover:text-ink rounded-md hover:bg-sage/40 transition-colors"
              title="Cài đặt biểu đồ"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {isEditingTitle ? (
            <input
              autoFocus
              className="px-2 py-1 border border-forest rounded text-sm font-semibold outline-none w-full max-w-xs"
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
            />
          ) : (
            <div
              className="group flex items-center gap-2 cursor-pointer"
              onClick={() => setIsEditingTitle(true)}
            >
              <h2 className={`${TEXT.sectionTitle} mb-0`}>{chart.user_title || chart.title}</h2>
              <Edit2 className="w-3.5 h-3.5 text-transparent group-hover:text-muted transition-colors" />
            </div>
          )}
        </div>

        <button
          onClick={() => toggleChart(chart.id)}
          className={`w-6 h-6 rounded flex items-center justify-center border transition-colors shrink-0 ${isSelected ? "bg-[#121A14] border-[#121A14] text-white" : "border-[#EAEAEA] text-transparent hover:border-[#626C65]/50"}`}
        >
          <Check className="w-4 h-4" />
        </button>
      </div>

      {isSettingsOpen && (
        <form onSubmit={handleApplyConfig} className="mb-4 p-4 bg-[#F9F9F8] rounded-lg border border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Loại biểu đồ</label>
            <select name="chart_type" defaultValue={chart.type} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-white" disabled={chart.type === "heatmap"}>
              <option value="histogram">Histogram</option>
              <option value="box">Box Plot</option>
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="line">Line Chart</option>
              {chart.type === "heatmap" && <option value="heatmap">Heatmap</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Cột dữ liệu</label>
            <select name="column_x" defaultValue={chart.col} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-white" disabled={chart.type === "heatmap"}>
              {availableColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Màu sắc</label>
            <div className="flex items-center gap-2 mt-1">
              {COLOR_PRESETS.map(p => (
                <label key={p.id} className="cursor-pointer relative">
                  <input type="radio" name="color_preset" value={p.color} defaultChecked={p.color === (chart.color || COLOR_PRESETS[0].color)} className="peer sr-only" />
                  <div className="w-6 h-6 rounded-full border-2 border-transparent peer-checked:border-ink" style={{ backgroundColor: p.color }}></div>
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" className="text-xs bg-forest text-white px-3 py-1.5 rounded-md hover:bg-forest/90 font-medium">
              Áp dụng
            </button>
          </div>
        </form>
      )}

      <div className={chart.type === "heatmap" ? "h-[500px] lg:h-[70vh] lg:max-h-[800px] flex flex-col w-full" : "h-72"}>
        {chart.type === "histogram" && <DistributionChart data={chart.data} color={chart.color} />}
        {chart.type === "bar" && <CategoricalChart data={chart.data} color={chart.color} />}
        {chart.type === "line" && <TrendChart data={chart.data} color={chart.color} />}
        {chart.type === "heatmap" && <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} onCellClick={onCellClick} anchorPair={anchorPair} />}
        {chart.type === "pie" && <PieChartComponent data={chart.data} color={chart.color} />}
        {chart.type === "box" && <BoxPlotChart stats={stats} color={chart.color} />}
      </div>

      {chart.type !== "heatmap" && insights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
            📊 Nhận xét tự động
          </p>
          <ul className="space-y-1">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-sm text-gray-700 leading-snug">
                • {insight.text}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 italic mt-1.5">
            ⓘ Đây là nhận xét tự động dựa trên số liệu, có thể chưa đầy đủ.
          </p>
        </div>
      )}

      {ai_insights_enabled && chart.type !== "heatmap" && (
        <AIInsightsCard 
          sessionId={sessionId}
          fileHash={fileHash}
          chart={chart}
          autoInsights={insights}
        />
      )}
    </div>
  );
};

// --- Logic Tự Động Phân Loại Biểu Đồ ---

const generateCharts = (summary) => {
  const charts = {
    distribution: [],
    correlation: [],
    time: [],
    other: []
  };

  if (!summary || !summary.columns) return charts;

  // 1. Phân phối & Theo thời gian
  Object.entries(summary.columns).forEach(([colName, info]) => {
    if (info.skip_chart || info.missing_pct >= 60) return;

    if (info.dtype === "numeric" && info.distribution_bins) {
      charts.distribution.push({
        id: `dist_${colName}`,
        type: "histogram",
        col: colName,
        title: `Phân phối: ${colName}`,
        data: info.distribution_bins,
        score: (1 - info.missing_pct / 100) + (info.std / (Math.abs(info.mean) || 1) * 0.5) // Score ảo
      });
    } else if ((info.dtype === "categorical" || info.dtype === "boolean" || info.dtype === "multiple_choice") && info.top_values) {
      charts.distribution.push({
        id: `cat_${colName}`,
        type: "bar",
        col: colName,
        title: `Tần suất: ${colName}`,
        data: info.top_values,
        score: 1 - info.missing_pct / 100
      });
    } else if (info.dtype === "datetime" && info.trend_data) {
      charts.time.push({
        id: `time_${colName}`,
        type: "line",
        col: colName,
        title: `Xu hướng: ${colName}`,
        data: info.trend_data,
        score: 1.0
      });
    }
  });

  // 2. Tương quan
  if (summary.correlation_matrix && Object.keys(summary.correlation_matrix).length > 0) {
    charts.correlation.push({
      id: `corr_heatmap`,
      type: "heatmap",
      title: `Ma trận tương quan`,
      matrix: summary.correlation_matrix,
      topCorr: summary.top_correlations,
      score: 1.0
    });
  }

  // Sắp xếp theo score
  charts.distribution.sort((a, b) => b.score - a.score);
  charts.correlation.sort((a, b) => b.score - a.score);
  charts.time.sort((a, b) => b.score - a.score);

  return charts;
};

// --- Màn hình Chính ---

export default function Visualize({ pipelineMode, onComplete, onError }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();
  
  const currentUser = getUser() || {};
  const { ai_insights_enabled } = currentUser;

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("distribution");
  const [charts, setCharts] = useState({ distribution: [], correlation: [], time: [], other: [] });
  const [selectedChartIds, setSelectedChartIds] = useState(new Set());
  const [selectionExpanded, setSelectionExpanded] = useState(false);

  const [showDirectUpload, setShowDirectUpload] = useState(false);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [directSummary, setDirectSummary] = useState(null);
  const fileInputRef = useRef(null);

  // --- Anchor state (Correlation Heatmap click-to-explore) ---
  const [anchorPair, setAnchorPair] = useState(null);
  const [scatterData, setScatterData] = useState(null);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [scatterError, setScatterError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!fileSession.statisticalSummary && !fileSession.fileHash) {
      setShowDirectUpload(true);
      return;
    }

    const fetchStats = async () => {
      if (!fileSession.sessionId) return;
      setLoading(true);
      try {
        const res = await api.post("/visualize/compute", {
          session_id: fileSession.sessionId,
          warnings: fileSession.warnings || []
        });

        const summary = res.data;
        updateFileSession({ statisticalSummary: summary });

        const generated = generateCharts(summary);
        setCharts(generated);

        // Mặc định chọn top 3 của phân phối + heatmap (nếu có khả năng)
        const initialSelected = new Set();
        generated.distribution.slice(0, 3).forEach(c => {
          if (!fileSession.capabilities || (c.type === "histogram" ? fileSession.capabilities.histogram : true)) {
            initialSelected.add(c.id);
          }
        });
        if (generated.correlation[0] && (!fileSession.capabilities || fileSession.capabilities.correlation)) {
          initialSelected.add(generated.correlation[0].id);
        }
        if (generated.time[0] && (!fileSession.capabilities || fileSession.capabilities.line_chart)) {
          initialSelected.add(generated.time[0].id);
        }

        setSelectedChartIds(initialSelected);

        // Chuyển tab tự động nếu không có biểu đồ phân phối
        if (generated.distribution.length === 0 && generated.correlation.length > 0) setActiveTab("correlation");
        else if (generated.distribution.length === 0 && generated.time.length > 0) setActiveTab("time");

      } catch (err) {
        showToast(err.response?.data?.detail || "Không thể tải dữ liệu biểu đồ. Vui lòng thử lại sau.", "error");
      } finally {
        setLoading(false);
      }
    };

    if (!fileSession.statisticalSummary) {
      fetchStats();
    } else {
      // Đã có sẵn data trong session
      const generated = generateCharts(fileSession.statisticalSummary);
      setCharts(generated);
      if (fileSession.confirmedCharts) {
        setSelectedChartIds(new Set(fileSession.confirmedCharts.map(c => c.chart_id)));
      }
    }
  }, [fileSession.sessionId, fileSession.statisticalSummary, fileSession.fileHash]);

  const handleDirectUpload = async (file) => {
    if (!file) return;
    setIsDirectUploading(true);
    try {
      const profileRes = await profileFile(file);
      const fileHash = profileRes.data.file_hash;
      await detectIssues(fileHash, {});
      await autoClean(fileHash, {});
      const confirmRes = await confirmClean(fileHash, "auto", {});

      const diff = confirmRes.data.clean_report;
      const issuesFixed = (diff.missing_filled ? Object.keys(diff.missing_filled).length : 0) +
        (diff.types_converted ? Object.keys(diff.types_converted).length : 0) +
        (diff.encoding_fixed ? Object.keys(diff.encoding_fixed).length : 0) +
        (diff.duplicate_rows_removed || 0);

      updateFileSession({
        sessionId: confirmRes.data.session_id,
        capabilities: confirmRes.data.validation?.capabilities || null,
        warnings: confirmRes.data.validation?.warnings || [],
        fileHash: fileHash,
        fileName: file.name
      });

      setDirectSummary({
        rows: confirmRes.data.clean_report.clean_rows,
        cols: confirmRes.data.clean_report.clean_cols,
        issuesFixed: issuesFixed,
      });

    } catch (err) {
      showToast("Không thể phân tích trực tiếp. Vui lòng kiểm tra lại file.", "error");
    } finally {
      setIsDirectUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleDirectUpload(file);
  };

  const toggleChart = (id) => {
    const newSet = new Set(selectedChartIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedChartIds(newSet);
  };

  // --- Anchor handlers ---
  const handleAnchorSelect = async (colA, colB, r) => {
    // Abort any in-flight scatter request (race condition fix)
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Set anchor state immediately (UI responds instantly)
    setAnchorPair({ colA, colB, r });
    setScatterLoading(true);
    setScatterError(null);
    setScatterData(null);

    try {
      const res = await api.post("/visualize/scatter-data", {
        session_id: fileSession.sessionId,
        col_x: colA,
        col_y: colB,
      }, { signal: controller.signal });

      // Only update if this controller hasn't been aborted
      if (!controller.signal.aborted) {
        setScatterData(res.data);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && !controller.signal.aborted) {
        setScatterError(err.response?.data?.detail || "Không thể tải dữ liệu phân tán.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setScatterLoading(false);
      }
    }
  };

  const handleAnchorClear = () => {
    if (abortRef.current) abortRef.current.abort();
    setAnchorPair(null);
    setScatterData(null);
    setScatterError(null);
  };

  const handleUpdateChart = (id, newConfig) => {
    setCharts(prev => {
      const newCharts = { ...prev };
      for (const category in newCharts) {
        const idx = newCharts[category].findIndex(c => c.id === id);
        if (idx !== -1) {
          newCharts[category][idx] = { ...newCharts[category][idx], ...newConfig };
          break;
        }
      }
      return newCharts;
    });
  };

  const handleConfirm = () => {
    if (selectedChartIds.size === 0) {
      showToast("Vui lòng chọn ít nhất 1 biểu đồ để mang sang báo cáo.", "warning");
      return;
    }

    const allCharts = [...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other];
    const confirmed = allCharts
      .filter(c => selectedChartIds.has(c.id))
      .map(c => ({
        chart_id: c.id,
        user_title: c.user_title || c.title,
        auto_title: c.auto_title || c.title,
        type: c.type,
        column: c.col
      }));

    updateFileSession({ confirmedCharts: confirmed });
    showToast("Đã chốt danh sách biểu đồ! Tiếp tục sang Module 5.", "success");
    if (pipelineMode && onComplete) {
      onComplete();
    } else {
      navigate("/report");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] text-ink flex flex-col items-center justify-center py-20 px-6 font-sans">
        <div className="w-12 h-12 rounded-full border-4 border-forest border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-xl font-bold mb-2">Đang xử lý số liệu thống kê...</h2>
        <p className="text-muted text-sm text-center max-w-md">DataMind đang chạy hàng loạt thuật toán (Phân phối, Tương quan, Xu hướng) trên toàn bộ dataset của bạn. Tùy thuộc vào dung lượng file, việc này có thể mất vài giây.</p>
      </div>
    );
  }

  if (showDirectUpload && !directSummary) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex flex-col pt-20 px-6">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-xl font-semibold text-ink mb-2">Bắt đầu trực quan hóa dữ liệu</h2>
          <p className="text-sm text-muted mb-6">
            Tải lên dữ liệu của bạn để hệ thống tự động vẽ biểu đồ (phân phối, tương quan, xu hướng theo thời gian).
          </p>

          <div
            id="upload-zone"
            className={`
              border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors
              ${isDragging
                ? "border-[#1B4324] bg-[#EAF2EB]"
                : "border-border hover:border-[#1B4324] hover:bg-sage/40"
              }
              ${isDirectUploading ? "pointer-events-none opacity-60" : ""}
            `}
            onClick={() => !isDirectUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!isDirectUploading) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => handleDirectUpload(e.target.files?.[0])}
              id="file-input"
            />
            {isDirectUploading ? (
              <div>
                <div className="w-10 h-10 rounded-full border-4 border-[#1B4324] border-t-transparent animate-spin mx-auto mb-4"></div>
                <p className="text-ink font-medium text-lg mb-1">Đang phân tích & làm sạch ngầm...</p>
                <p className="text-muted text-sm">Quá trình này có thể mất vài giây tùy dung lượng file.</p>
              </div>
            ) : (
              <div className="text-muted text-sm">
                <Upload size={48} strokeWidth={1.5} className="mx-auto mb-4 text-[#1B4324]" />
                <span className="block mb-1.5 text-ink font-medium text-lg">Kéo thả file dữ liệu vào đây</span>
                hoặc click để duyệt file &mdash; hỗ trợ CSV, XLSX, XLS (tối đa 10MB)
              </div>
            )}
          </div>

          <div className="mt-8 bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-medium text-ink flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-[#1B4324]" />
              Lưu ý quá trình trực quan hóa
            </h3>
            <ul className="text-sm text-muted space-y-3 list-disc pl-5">
              <li><strong className="text-ink font-medium">Khám phá tự động:</strong> Dựa trên kiểu dữ liệu của các cột (Số, Chữ, Thời gian), hệ thống sẽ tự động vẽ Histogram, Biểu đồ thanh, Line chart và Ma trận tương quan.</li>
              <li><strong className="text-ink font-medium">Xử lý lỗi ngầm định:</strong> Khi tải file lên tại đây, DataMind tự chạy các bước Profiling và Cleaning để đảm bảo dữ liệu "sạch" trước khi vẽ.</li>
              <li><strong className="text-ink font-medium">Báo cáo phân tích:</strong> Các biểu đồ bạn chọn ở đây sẽ được đưa thẳng vào bước lập báo cáo cuối cùng để AI phân tích chuyên sâu.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (showDirectUpload && directSummary) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-border">
          <Check className="w-12 h-12 text-forest mx-auto mb-4 bg-sage rounded-full p-2" />
          <h2 className="text-xl font-bold mb-2 text-ink">Đã chuẩn bị xong dữ liệu</h2>
          <p className="text-lg font-mono mb-4 text-ink">
            {directSummary.rows} dòng · {directSummary.cols} cột · {directSummary.issuesFixed} vấn đề đã tự động xử lý
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => {
                setShowDirectUpload(false);
              }}
              className="bg-[#111111] hover:bg-[#222222] text-white py-3 rounded-lg font-semibold w-full transition-all"
            >
              Tiếp tục xem biểu đồ
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(pipelineMode ? "/pipeline/profiler" : "/profiler")}
                className="border border-border text-ink py-2 rounded-lg font-semibold w-full hover:bg-sage/20 transition-all text-sm"
              >
                Quay lại Phân tích
              </button>
              <button
                onClick={() => navigate(pipelineMode ? "/pipeline/cleaner" : "/cleaner")}
                className="border border-border text-ink py-2 rounded-lg font-semibold w-full hover:bg-sage/20 transition-all text-sm"
              >
                Chi tiết Làm sạch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeCharts = charts[activeTab] || [];

  return (
    <div className="min-h-full bg-[#FBFBFA] text-[#121A14] flex flex-col font-sans relative">

      {/* Main Content Area — full width */}
      <div className="flex-1 pb-12">
        <div className="px-6 sm:px-8 py-8 max-w-7xl mx-auto">
          <PageHeader
            title="Trực quan hóa Dữ liệu"
            subtitle="Hệ thống đã tự động chọn và xếp hạng các biểu đồ thú vị nhất. Bạn có thể chọn biểu đồ để đưa vào báo cáo cuối cùng."
            actions={
              <div className="flex items-center gap-3">
                <PageHelpDocs pageId="visualize" />
                {!pipelineMode && !showDirectUpload && (
                  <>
                    <button
                      onClick={() => navigate("/cleaner")}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <ArrowLeft className="w-4 h-4" /> Quay lại
                    </button>
                    <button
                      onClick={() => {
                        clearFileSession();
                        setShowDirectUpload(true);
                        setDirectSummary(null);
                      }}
                      className={`${BTN.secondary} flex items-center gap-1.5`}
                    >
                      <FolderUp className="w-4 h-4" /> Tải file khác
                    </button>
                  </>
                )}
              </div>
            }
          />

          {/* Capability Summary (Feature 2) */}
          {fileSession.capabilities && (
            <div className="bg-sage/20 border border-border rounded-xl p-5 mb-6">
              <h2 className="text-sm font-semibold mb-3 flex items-center justify-between text-ink">
                <span>Đánh giá khả năng trực quan hóa</span>
                {fileSession.warnings?.some(w => w.code === "LOW_ROW_COUNT") && (
                  <span className="text-xs font-normal text-[#956400] bg-[#FBF3DB] px-2 py-0.5 rounded border border-[#f0dda0] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 inline-block" /> Dữ liệu ít, kết quả mang tính tham khảo
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className={`flex items-center gap-1.5 ${(fileSession.capabilities.histogram || fileSession.capabilities.bar_chart) ? 'text-forest font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {(fileSession.capabilities.histogram || fileSession.capabilities.bar_chart) ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />} Phân phối
                </span>
                <span className={`flex items-center gap-1.5 ${fileSession.capabilities.correlation ? 'text-forest font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {fileSession.capabilities.correlation ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />} Tương quan
                </span>
                <span className={`flex items-center gap-1.5 ${fileSession.capabilities.line_chart ? 'text-forest font-semibold' : 'text-[#9F2F2D]/80'}`}>
                  {fileSession.capabilities.line_chart ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />} Theo thời gian
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border mb-6 pb-1 overflow-x-auto">
            {[
              { id: "distribution", label: `Phân phối (${charts.distribution.length})` },
              { id: "correlation", label: `Tương quan (${charts.correlation.length})` },
              { id: "time", label: `Theo thời gian (${charts.time.length})` },
            ].map(tab => {
              // Check capability to optionally style the tab
              const isSupported = !fileSession.capabilities || (
                (tab.id === "distribution" && fileSession.capabilities.histogram) ||
                (tab.id === "correlation" && fileSession.capabilities.correlation) ||
                (tab.id === "time" && fileSession.capabilities.line_chart)
              );

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id ? "border-forest text-forest font-semibold" : "border-transparent text-muted hover:text-ink"} ${!isSupported && activeTab !== tab.id ? 'opacity-50' : ''}`}
                >
                  {tab.label} {!isSupported && <AlertTriangle className="w-3 h-3 inline-block ml-1" />}
                </button>
              )
            })}
          </div>

          {/* Chart Grid */}
          {activeCharts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <p className="text-muted">Không có biểu đồ nào phù hợp trong mục này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {activeCharts.map(chart => {
                // Determine if chart is disabled by capabilities
                let isDisabled = false;
                let disableReason = "";

                if (fileSession.capabilities) {
                  if (chart.type === "histogram" && !fileSession.capabilities.histogram) {
                    isDisabled = true;
                    disableReason = "Cần ít nhất 1 cột số và 5 dòng dữ liệu.";
                  } else if (chart.type === "heatmap" && !fileSession.capabilities.correlation) {
                    isDisabled = true;
                    disableReason = "Cần ít nhất 2 cột số và 10 dòng dữ liệu.";
                  } else if (chart.type === "line" && !fileSession.capabilities.line_chart) {
                    isDisabled = true;
                    disableReason = "Cần ít nhất 2 dòng dữ liệu.";
                  }
                }

                return (
                  <div key={chart.id} className={`relative group ${chart.type === 'heatmap' ? 'xl:col-span-2' : ''}`}>
                    <div className={`transition-all ${isDisabled ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                      <ChartCard
                        chart={chart}
                        isSelected={selectedChartIds.has(chart.id)}
                        toggleChart={toggleChart}
                        summary={fileSession.statisticalSummary}
                        onUpdate={handleUpdateChart}
                        onCellClick={chart.type === "heatmap" ? handleAnchorSelect : undefined}
                        anchorPair={chart.type === "heatmap" ? anchorPair : undefined}
                        ai_insights_enabled={ai_insights_enabled}
                        sessionId={fileSession.sessionId}
                        fileHash={fileSession.fileHash}
                      />
                    </div>

                    {/* Disabled Overlay & Tooltip */}
                    {isDisabled && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/60 rounded-xl border border-border/10 backdrop-blur-[1px]">
                        <div className="bg-white px-4 py-3 rounded-lg border border-border text-center max-w-[80%] shadow-md">
                          <Lock className="w-6 h-6 mx-auto mb-2 text-ink/70" />
                          <p className="text-sm font-semibold text-ink mb-1">Không khả dụng</p>
                          <p className="text-xs text-muted">{disableReason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "correlation" && ai_insights_enabled && (
            <CorrelationSuggestions 
              sessionId={fileSession.sessionId}
              onSelectAnchor={handleAnchorSelect}
            />
          )}

          {/* Anchor Scatter Panel — appears below chart grid when a correlation cell is clicked */}
          {activeTab === "correlation" && anchorPair && (
            <AnchorScatterPanel
              colA={anchorPair.colA}
              colB={anchorPair.colB}
              rValue={anchorPair.r}
              scatterData={scatterData}
              loading={scatterLoading}
              error={scatterError}
              onClear={handleAnchorClear}
            />
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar (Selection Panel) */}
      <div className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] mt-auto">
        {/* Expanded panel — list of selected charts */}
        {selectionExpanded && (
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Biểu đồ đã chọn — sẽ xuất hiện trong báo cáo AI</h3>
              <button
                onClick={() => setSelectionExpanded(false)}
                className="text-muted hover:text-ink p-1 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {selectedChartIds.size === 0 ? (
              <p className="text-sm text-muted/60 py-3">Chưa có biểu đồ nào được chọn. Nhấn vào checkbox trên biểu đồ để chọn.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {[...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other]
                  .filter(c => selectedChartIds.has(c.id))
                  .map(c => (
                    <div key={`sel_${c.id}`} className="bg-[#F9F9F8] border border-border rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-ink">
                      <span className="truncate max-w-[200px] font-medium">{c.user_title || c.title}</span>
                      <button onClick={() => toggleChart(c.id)} className="text-muted hover:text-red-500 shrink-0 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Bottom action bar */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => setSelectionExpanded(!selectionExpanded)}
            className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
          >
            {selectionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="font-semibold text-forest">{selectedChartIds.size}</span>
            <span>biểu đồ đã chọn</span>
          </button>

          <button
            onClick={handleConfirm}
            className={`${BTN.primary} px-6 py-2.5 flex items-center gap-2`}
          >
            Chốt danh sách & Chuyển tiếp <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
