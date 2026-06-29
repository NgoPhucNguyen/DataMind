import { useState, useEffect, useRef } from "react";
import { useFileSession } from "../contexts/FileSessionContext";
import { Download, FileText } from "lucide-react";
import { PAGE, BTN } from "../constants/ui";
import api from "../services/axiosClient";
import {
  DistributionChart, CategoricalChart, TrendChart, 
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function Report({ pipelineMode, onComplete }) {
  const { fileSession } = useFileSession();
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(true);
  
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchIntro = async () => {
      try {
        // Lấy từ profileData hoặc fallback sang statisticalSummary
        const schemaFallback = fileSession.statisticalSummary?.columns 
          ? Object.entries(fileSession.statisticalSummary.columns).map(([name, info]) => ({ name, detected_type: info.dtype }))
          : [];

        const payload = {
          file_name: fileSession.fileName,
          row_count: fileSession.profileData?.row_count || fileSession.statisticalSummary?.shape?.[0] || 0,
          col_count: fileSession.profileData?.col_count || fileSession.statisticalSummary?.shape?.[1] || 0,
          schema: fileSession.profileData?.columns || schemaFallback,
          charts: fileSession.confirmedCharts || [],
          user_context: fileSession.userContext || null
        };
        const res = await api.post("/report/intro", payload);
        setIntro(res.data.intro);
      } catch (err) {
        console.error("Failed to fetch intro", err);
        setIntro("Không thể tạo được phần tóm tắt tự động vào lúc này.");
      } finally {
        setLoading(false);
      }
    };
    
    if (fileSession.profileData || fileSession.statisticalSummary) {
      fetchIntro();
    } else {
      setLoading(false);
    }
  }, [fileSession]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      // Tạm ẩn các nút không cần thiết nếu có class print:hidden
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
      
      pdf.save(`DataMind_Report_${fileSession.fileName || "Data"}.pdf`);
    } catch (error) {
      console.error("Export PDF failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const charts = fileSession.confirmedCharts || [];
  const stats = fileSession.statisticalSummary?.columns || {};

  return (
    <div className={`${PAGE.wrapper} bg-[#FBFBFA]`}>
      <div className="max-w-4xl mx-auto w-full print:max-w-none print:w-full print:m-0 print:p-0">
        
        {/* Header Actions (Not printed) */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-forest" />
            Báo cáo AI
          </h1>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`${BTN.primary} flex items-center gap-2 ${isExporting ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <Download className="w-4 h-4" /> {isExporting ? "Đang xử lý..." : "Xuất PDF"}
          </button>
        </div>

        {/* Document Container */}
        <div 
          ref={reportRef} 
          className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:rounded-none print:bg-white"
        >
          {/* Report Title */}
          <div className="border-b border-[#EAEAEA] pb-6 mb-8">
            <h1 className="text-3xl font-bold text-ink mb-2">Báo cáo Phân tích Dữ liệu</h1>
            <p className="text-muted">Tập dữ liệu: <span className="font-semibold text-ink">{fileSession.fileName || "Unknown"}</span></p>
            <p className="text-sm text-muted mt-1">Ngày tạo: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>

          {/* AI Intro Section */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded bg-[#EAF2EB] text-[#1B4324] flex items-center justify-center text-xs">✨</span> 
              Tổng quan từ AI
            </h2>
            
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-4/5"></div>
              </div>
            ) : (
              <div className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg p-5">
                <p className="text-ink leading-relaxed whitespace-pre-wrap">{intro}</p>
              </div>
            )}
          </div>

          {/* Charts Section */}
          <div>
            <h2 className="text-lg font-bold text-ink mb-6 border-b border-[#EAEAEA] pb-2">
              Phân tích Chi tiết
            </h2>
            
            {charts.length === 0 ? (
              <p className="text-muted italic">Không có biểu đồ nào được chọn để đưa vào báo cáo.</p>
            ) : (
              <div className="space-y-12">
                {charts.map((chart, idx) => {
                  const colName = chart.column || chart.col;
                  const colStats = stats[colName] || {};
                  const insights = chart.auto_insights || colStats.auto_insights || [];
                  
                  // Trích xuất data từ statisticalSummary
                  let chartData = [];
                  let matrix = null;
                  let topCorr = null;
                  
                  if (chart.type === "histogram") chartData = colStats.distribution_bins || [];
                  else if (chart.type === "bar" || chart.type === "pie") chartData = colStats.top_values || [];
                  else if (chart.type === "line") chartData = colStats.trend_data || [];
                  if (chart.type === "heatmap") {
                    matrix = fileSession.statisticalSummary?.correlation?.matrix;
                    topCorr = fileSession.statisticalSummary?.correlation?.top_corr;
                  }

                  const color = chart.color || "#1B4324";
                  
                  // Skip rendering if no data exists
                  if (chart.type === "heatmap" && (!matrix || Object.keys(matrix).length === 0)) return null;
                  if (chart.type !== "heatmap" && chart.type !== "box" && chartData.length === 0) return null;
                  if (chart.type === "box" && !colStats.min) return null;

                  return (
                    <div key={chart.id || idx} className="break-inside-avoid">
                      <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-forest text-white flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </span>
                        {chart.user_title || chart.title || chart.auto_title}
                      </h3>
                      
                      <div className="h-72 mb-6">
                        {chart.type === "histogram" && <DistributionChart data={chartData} color={color} />}
                        {chart.type === "bar" && <CategoricalChart data={chartData} color={color} />}
                        {chart.type === "line" && <TrendChart data={chartData} color={color} />}
                        {chart.type === "heatmap" && <CorrelationHeatmap matrix={matrix} topCorr={topCorr} />}
                        {chart.type === "pie" && <PieChartComponent data={chartData} color={color} />}
                        {chart.type === "box" && <BoxPlotChart stats={colStats} color={color} />}
                      </div>

                      {chart.type !== "heatmap" && insights.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 print:border-[#EAEAEA]">
                          <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                            📊 Nhận xét tự động
                          </p>
                          <ul className="space-y-1.5 list-none pl-1">
                            {insights.map((insight, i) => (
                              <li key={i} className="text-sm text-gray-700 leading-snug flex items-start gap-2">
                                <span className="text-forest mt-0.5">•</span>
                                {insight.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
