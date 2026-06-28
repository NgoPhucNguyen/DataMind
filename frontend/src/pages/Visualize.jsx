import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/axiosClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line
} from "recharts";

// --- Components Biểu Đồ ---

const DistributionChart = ({ data, color = "#8b5cf6" }) => {
  const chartData = data.map(d => ({
    name: `${d.bin_start.toFixed(1)} - ${d.bin_end.toFixed(1)}`,
    count: d.count
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" vertical={false} />
        <XAxis dataKey="name" stroke="#ffffff66" fontSize={10} tickFormatter={(val) => val.split(" - ")[0]} />
        <YAxis stroke="#ffffff66" fontSize={10} />
        <Tooltip cursor={{ fill: "#ffffff1a" }} contentStyle={{ backgroundColor: "#1e1e2d", border: "none", borderRadius: 8, color: "#fff" }} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const CategoricalChart = ({ data, color = "#10b981" }) => {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" horizontal={false} />
        <XAxis type="number" stroke="#ffffff66" fontSize={10} />
        <YAxis dataKey="value" type="category" width={80} stroke="#ffffff66" fontSize={10} />
        <Tooltip cursor={{ fill: "#ffffff1a" }} contentStyle={{ backgroundColor: "#1e1e2d", border: "none", borderRadius: 8, color: "#fff" }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const TrendChart = ({ data, color = "#f59e0b" }) => {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" vertical={false} />
        <XAxis dataKey="period" stroke="#ffffff66" fontSize={10} />
        <YAxis stroke="#ffffff66" fontSize={10} />
        <Tooltip contentStyle={{ backgroundColor: "#1e1e2d", border: "none", borderRadius: 8, color: "#fff" }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const CorrelationHeatmap = ({ matrix, topCorr }) => {
  if (!matrix || Object.keys(matrix).length === 0) return <p className="text-muted text-sm">Không đủ cột số để tính tương quan.</p>;
  
  const cols = Object.keys(matrix);
  
  const getColor = (val) => {
    if (val === 1) return "bg-violet-500/20 text-violet-300";
    if (val > 0.5) return "bg-emerald-500/40 text-emerald-200";
    if (val > 0) return "bg-emerald-500/10 text-emerald-300/70";
    if (val < -0.5) return "bg-rose-500/40 text-rose-200";
    if (val < 0) return "bg-rose-500/10 text-rose-300/70";
    return "bg-white/5 text-white/40";
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-white/10 bg-white/5"></th>
              {cols.map(c => <th key={c} className="p-2 border border-white/10 bg-white/5 truncate max-w-[80px]" title={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {cols.map(row => (
              <tr key={row}>
                <th className="p-2 border border-white/10 bg-white/5 text-left truncate max-w-[80px]" title={row}>{row}</th>
                {cols.map(col => {
                  const val = matrix[row][col];
                  return (
                    <td key={col} className={`p-2 border border-white/10 ${getColor(val)}`}>
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
          <p className="text-sm font-semibold mb-2">Tương quan mạnh nhất:</p>
          <div className="flex flex-wrap gap-2">
            {topCorr.slice(0, 5).map((tc, idx) => (
              <span key={idx} className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">
                {tc.col_a} ↔ {tc.col_b}: <span className={tc.r > 0 ? "text-emerald-400" : "text-rose-400"}>{tc.r}</span>
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
      showToast("Không tìm thấy session. Vui lòng làm sạch dữ liệu trước.", "error");
      navigate("/ua_cleaner");
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await api.post("/visualize/compute", { session_id: fileSession.sessionId });
        
        const summary = res.data;
        updateFileSession({ statisticalSummary: summary });
        
        const generated = generateCharts(summary);
        setCharts(generated);
        
        // Mặc định chọn top 3 của phân phối + heatmap
        const initialSelected = new Set();
        generated.distribution.slice(0, 3).forEach(c => initialSelected.add(c.id));
        if (generated.correlation[0]) initialSelected.add(generated.correlation[0].id);
        if (generated.time[0]) initialSelected.add(generated.time[0].id);
        
        setSelectedChartIds(initialSelected);

        // Chuyển tab tự động nếu không có biểu đồ phân phối
        if (generated.distribution.length === 0 && generated.correlation.length > 0) setActiveTab("correlation");
        else if (generated.distribution.length === 0 && generated.time.length > 0) setActiveTab("time");

      } catch (err) {
        showToast(err.response?.data?.detail || "Lỗi khi tính toán dữ liệu", "error");
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
        className={`bg-white/5 border rounded-xl p-5 relative transition-all ${isSelected ? "border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)]" : "border-white/10 hover:border-white/30"}`}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-sm">{chart.title}</h3>
          <button 
            onClick={() => toggleChart(chart.id)}
            className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${isSelected ? "bg-violet-500 border-violet-500 text-white" : "border-white/20 text-transparent hover:border-white/50"}`}
          >
            ✓
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
      <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col items-center justify-center py-20 px-6">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-xl font-bold mb-2">Đang xử lý số liệu thống kê...</h2>
        <p className="text-muted text-sm text-center max-w-md">DataMind đang chạy hàng loạt thuật toán (Phân phối, Tương quan, Xu hướng) trên toàn bộ dataset của bạn. Tùy thuộc vào dung lượng file, việc này có thể mất vài giây.</p>
      </div>
    );
  }

  const activeCharts = charts[activeTab] || [];

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col lg:flex-row">
      
      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl tracking-tight mb-2">Trực quan hóa Dữ liệu</h1>
          <p className="text-muted text-sm">Hệ thống đã tự động chọn và xếp hạng các biểu đồ thú vị nhất. Bạn có thể chọn biểu đồ để đưa vào báo cáo cuối cùng.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mb-6 pb-1 overflow-x-auto">
          {[
            { id: "distribution", label: `Phân phối (${charts.distribution.length})` },
            { id: "correlation", label: `Tương quan (${charts.correlation.length})` },
            { id: "time", label: `Theo thời gian (${charts.time.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id ? "border-violet-500 text-violet-400" : "border-transparent text-white/50 hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chart Grid */}
        {activeCharts.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-xl">
            <p className="text-muted">Không có biểu đồ nào phù hợp trong mục này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeCharts.map(renderChartCard)}
          </div>
        )}
      </div>

      {/* Sidebar (Selection Panel) */}
      <div className="w-full lg:w-80 bg-[#12182B] border-l border-white/10 flex flex-col shrink-0 lg:h-screen lg:sticky lg:top-0">
        <div className="p-6 border-b border-white/10">
          <h2 className="font-bold text-lg mb-1">Biểu đồ đã chọn</h2>
          <p className="text-xs text-muted">Sẽ xuất hiện trong báo cáo AI</p>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-3">
          {selectedChartIds.size === 0 ? (
            <p className="text-sm text-white/30 text-center py-10">Chưa có biểu đồ nào được chọn.</p>
          ) : (
            [...charts.distribution, ...charts.correlation, ...charts.time, ...charts.other]
              .filter(c => selectedChartIds.has(c.id))
              .map(c => (
                <div key={`sel_${c.id}`} className="bg-white/5 border border-white/10 rounded-lg p-3 flex justify-between items-center text-sm">
                  <span className="truncate pr-2">{c.title}</span>
                  <button onClick={() => toggleChart(c.id)} className="text-white/40 hover:text-rose-400 shrink-0">✕</button>
                </div>
              ))
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-[#12182B]">
          <div className="flex justify-between items-center mb-4 text-sm">
            <span className="text-muted">Tổng cộng</span>
            <span className="font-bold text-violet-400">{selectedChartIds.size} biểu đồ</span>
          </div>
          <button 
            onClick={handleConfirm}
            className="w-full bg-violet-500 hover:bg-violet-400 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-violet-500/20"
          >
            Chốt danh sách & Chuyển tiếp →
          </button>
        </div>
      </div>
      
    </div>
  );
}
