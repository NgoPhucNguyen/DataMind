import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/axiosClient";
import { Check, X, AlertTriangle, ArrowRight, Lock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line
} from "recharts";

// --- Components Biểu Đồ ---

const DistributionChart = ({ data, color = "#1B4324" }) => {
  const chartData = data.map(d => ({
    name: `${d.bin_start.toFixed(1)} - ${d.bin_end.toFixed(1)}`,
    count: d.count
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
        <XAxis dataKey="name" stroke="#626C65" fontSize={10} tickFormatter={(val) => val.split(" - ")[0]} />
        <YAxis stroke="#626C65" fontSize={10} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const CategoricalChart = ({ data, color = "#1B4324" }) => {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" horizontal={false} />
        <XAxis type="number" stroke="#626C65" fontSize={10} />
        <YAxis dataKey="value" type="category" width={80} stroke="#626C65" fontSize={10} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const TrendChart = ({ data, color = "#1B4324" }) => {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
        <XAxis dataKey="period" stroke="#626C65" fontSize={10} />
        <YAxis stroke="#626C65" fontSize={10} />
        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const CorrelationHeatmap = ({ matrix, topCorr }) => {
  if (!matrix || Object.keys(matrix).length === 0) return <p className="text-muted text-sm">Không đủ cột số để tính tương quan.</p>;
  
  const cols = Object.keys(matrix);
  
  const getColor = (val) => {
    if (val === 1) return "bg-sage text-forest font-semibold border border-forest/10";
    if (val > 0.5) return "bg-[#EAF2EB] text-[#1B4324] font-medium border border-[#c8e0cb]/50";
    if (val > 0) return "bg-[#EAF2EB]/40 text-[#1B4324]/80";
    if (val < -0.5) return "bg-[#FDEBEC] text-[#9F2F2D] font-medium border border-[#f5c6cb]/50";
    if (val < 0) return "bg-[#FDEBEC]/40 text-[#9F2F2D]/80";
    return "bg-[#F9F9F8] text-muted";
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-border bg-[#F9F9F8]"></th>
              {cols.map(c => <th key={c} className="p-2 border border-border bg-[#F9F9F8] text-ink truncate max-w-[80px]" title={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {cols.map(row => (
              <tr key={row}>
                <th className="p-2 border border-border bg-[#F9F9F8] text-left text-ink truncate max-w-[80px]" title={row}>{row}</th>
                {cols.map(col => {
                  const val = matrix[row][col];
                  return (
                    <td key={col} className={`p-2 border border-border ${getColor(val)}`}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {topCorr && topCorr.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold mb-2 text-ink">Tương quan mạnh nhất:</p>
          <div className="flex flex-wrap gap-2">
            {topCorr.slice(0, 5).map((tc, idx) => (
              <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-[#F9F9F8] border border-border text-ink">
                {tc.col_a} ↔ {tc.col_b}: <span className={tc.r > 0 ? "text-forest font-semibold" : "text-[#9F2F2D] font-semibold"}>{tc.r}</span>
              </span>
            ))}
          </div>
        </div>
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
        score: (1 - info.missing_pct/100) + (info.std / (Math.abs(info.mean) || 1) * 0.5) // Score ảo
      });
    } else if ((info.dtype === "categorical" || info.dtype === "boolean") && info.top_values) {
      charts.distribution.push({
        id: `cat_${colName}`,
        type: "bar",
        col: colName,
        title: `Tần suất: ${colName}`,
        data: info.top_values,
        score: 1 - info.missing_pct/100
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

export default function Visualize() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { fileSession, updateFileSession } = useFileSession();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("distribution");
  const [charts, setCharts] = useState({ distribution: [], correlation: [], time: [], other: [] });
  const [selectedChartIds, setSelectedChartIds] = useState(new Set());

  useEffect(() => {
    if (!fileSession.sessionId) {
      showToast("Chưa có dữ liệu phân tích. Vui lòng thực hiện bước Làm sạch dữ liệu trước.", "error");
      navigate("/ua_cleaner");
      return;
    }

    const fetchStats = async () => {
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
  }, [fileSession.sessionId]);

  const toggleChart = (id) => {
    const newSet = new Set(selectedChartIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedChartIds(newSet);
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
        type: c.type,
        column: c.col,
        title: c.title
      }));
      
    updateFileSession({ confirmedCharts: confirmed });
    showToast("Đã chốt danh sách biểu đồ! Tiếp tục sang Module 5.", "success");
    // navigate("/report"); // Sau này chuyển sang module 5
  };

  const renderChartCard = (chart) => {
    const isSelected = selectedChartIds.has(chart.id);
    return (
      <div 
        key={chart.id} 
        className={`bg-white border rounded-xl p-5 relative transition-all ${isSelected ? "border-forest shadow-[0_2px_8px_rgba(27,67,36,0.04)]" : "border-border hover:border-muted/40"}`}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-serif font-semibold text-sm text-ink">{chart.title}</h3>
          <button 
            onClick={() => toggleChart(chart.id)}
            className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${isSelected ? "bg-forest border-forest text-white" : "border-border text-transparent hover:border-muted/50"}`}
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
        
        {chart.type === "histogram" && <DistributionChart data={chart.data} />}
        {chart.type === "bar" && <CategoricalChart data={chart.data} />}
        {chart.type === "line" && <TrendChart data={chart.data} />}
        {chart.type === "heatmap" && <CorrelationHeatmap matrix={chart.matrix} topCorr={chart.topCorr} />}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center py-20 px-6 font-sans">
        <div className="w-12 h-12 rounded-full border-4 border-forest border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-xl font-bold mb-2">Đang xử lý số liệu thống kê...</h2>
        <p className="text-muted text-sm text-center max-w-md">DataMind đang chạy hàng loạt thuật toán (Phân phối, Tương quan, Xu hướng) trên toàn bộ dataset của bạn. Tùy thuộc vào dung lượng file, việc này có thể mất vài giây.</p>
      </div>
    );
  }

  const activeCharts = charts[activeTab] || [];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col lg:flex-row font-sans">
      
      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl tracking-tight mb-2 text-ink">Trực quan hóa Dữ liệu</h1>
          <p className="text-muted text-sm">Hệ thống đã tự động chọn và xếp hạng các biểu đồ thú vị nhất. Bạn có thể chọn biểu đồ để đưa vào báo cáo cuối cùng.</p>
        </div>

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
              <span className={`flex items-center gap-1.5 ${fileSession.capabilities.histogram ? 'text-forest font-semibold' : 'text-[#9F2F2D]/80'}`}>
                {fileSession.capabilities.histogram ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />} Phân phối
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div key={chart.id} className="relative group">
                  <div className={`transition-all ${isDisabled ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                    {renderChartCard(chart)}
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
      </div>

      {/* Sidebar (Selection Panel) */}
      <div className="w-full lg:w-80 bg-[#F9F9F8] border-l border-border flex flex-col shrink-0 lg:h-screen lg:sticky lg:top-0">
        <div className="p-6 border-b border-border">
          <h2 className="font-bold text-lg mb-1 text-ink">Biểu đồ đã chọn</h2>
          <p className="text-xs text-muted">Sẽ xuất hiện trong báo cáo AI</p>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-3">
          {selectedChartIds.size === 0 ? (
            <p className="text-sm text-muted/60 text-center py-10">Chưa có biểu đồ nào được chọn.</p>
          ) : (
            [...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other]
              .filter(c => selectedChartIds.has(c.id))
              .map(c => (
                <div key={`sel_${c.id}`} className="bg-white border border-border rounded-lg p-3 flex justify-between items-center text-sm text-ink shadow-sm">
                  <span className="truncate pr-2 font-medium">{c.title}</span>
                  <button onClick={() => toggleChart(c.id)} className="text-muted hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ))
          )}
        </div>

        <div className="p-6 border-t border-border bg-[#F9F9F8]">
          <div className="flex justify-between items-center mb-4 text-sm">
            <span className="text-muted">Tổng cộng</span>
            <span className="font-semibold text-forest">{selectedChartIds.size} biểu đồ</span>
          </div>
          <button 
            onClick={handleConfirm}
            className="w-full bg-[#111111] hover:bg-[#333333] text-white py-3 rounded-lg font-semibold transition-all active:scale-[0.98] shadow-sm"
          >
            Chốt danh sách & Chuyển tiếp <ArrowRight className="w-4 h-4 inline-block ml-1" />
          </button>
        </div>
      </div>
      
    </div>
  );
}
