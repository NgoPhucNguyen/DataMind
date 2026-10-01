import { useState, useEffect, useRef } from "react";
import { useFileSession } from "../contexts/FileSessionContext";
import { Download, FileText, FileDown, ArrowUp, ArrowDown, Trash2, Sparkles, Edit2 } from "lucide-react";
import { PAGE, BTN } from "../constants/ui";
import api from "../services/axiosClient";
import {
  DistributionChart, CategoricalChart, TrendChart, 
  CorrelationHeatmap, PieChartComponent, BoxPlotChart
} from "../components/charts/ChartComponents";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

export default function Report({ pipelineMode, onComplete }) {
  const { fileSession } = useFileSession();
  const [intro, setIntro] = useState("");
  const [methodology, setMethodology] = useState("Dữ liệu đã được xử lý và làm sạch thông qua hệ thống DataMind. Các giá trị khuyết (missing values) và ngoại lai (outliers) đã được kiểm tra và chuẩn hóa để đảm bảo độ tin cậy cho các phân tích thống kê dưới đây.");
  const [loading, setLoading] = useState(true);
  
  const [charts, setCharts] = useState([]);
  const [aiInsights, setAiInsights] = useState({});
  const [editedInsights, setEditedInsights] = useState({});
  
  const reportRef = useRef(null);
  const chartRefs = useRef({});

  useEffect(() => {
    setCharts(fileSession.confirmedCharts || []);

    const fetchIntro = async () => {
      try {
        const schemaFallback = fileSession.statisticalSummary?.columns 
          ? Object.entries(fileSession.statisticalSummary.columns).map(([name, info]) => ({ name, detected_type: info.dtype }))
          : [];

        const payload = {
          file_hash: fileSession.fileHash,
          session_id: fileSession.sessionId,
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
      }
    };
    
    const fetchBatchInsights = async () => {
      if (!fileSession.confirmedCharts || fileSession.confirmedCharts.length === 0) return;
      try {
        const payload = {
          session_id: fileSession.sessionId,
          charts: fileSession.confirmedCharts.map(c => ({
              chart_id: c.chart_id,
              chart_type: c.type,
              col_x: c.column || "none"
          }))
        };
        const res = await api.post("/visualize/explain/batch", payload);
        setAiInsights(res.data.explanations || {});
        
        const initialEdited = {};
        Object.entries(res.data.explanations || {}).forEach(([id, data]) => {
          initialEdited[id] = data.content;
        });
        setEditedInsights(initialEdited);
      } catch (err) {
        console.error("Failed to fetch batch insights", err);
      }
    };
    
    const init = async () => {
      if (fileSession.profileData || fileSession.statisticalSummary) {
        await Promise.all([fetchIntro(), fetchBatchInsights()]);
      }
      setLoading(false);
    };

    init();
  }, [fileSession]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const moveChart = (index, direction) => {
    const newCharts = [...charts];
    if (direction === -1 && index > 0) {
      [newCharts[index - 1], newCharts[index]] = [newCharts[index], newCharts[index - 1]];
    } else if (direction === 1 && index < newCharts.length - 1) {
      [newCharts[index + 1], newCharts[index]] = [newCharts[index], newCharts[index + 1]];
    }
    setCharts(newCharts);
  };

  const removeChart = (chartId) => {
    setCharts(charts.filter(c => c.chart_id !== chartId));
  };

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
      
      pdf.save(`DataMind_Report_${fileSession.fileName || "Data"}.pdf`);
    } catch (error) {
      console.error("Export PDF failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const children = [];

      children.push(new Paragraph({
        text: "Báo cáo Phân tích Dữ liệu",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({ text: `Tập dữ liệu: ${fileSession.fileName || "Unknown"}`, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: `Ngày tạo: ${new Date().toLocaleDateString('vi-VN')}`, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: "" }));

      children.push(new Paragraph({ text: "Tổng quan từ AI", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: intro }));
      children.push(new Paragraph({ text: "" }));

      children.push(new Paragraph({ text: "Phương pháp & Làm sạch Dữ liệu", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: methodology }));
      children.push(new Paragraph({ text: "" }));

      children.push(new Paragraph({ text: "Phân tích Chi tiết", heading: HeadingLevel.HEADING_2 }));

      for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        const title = chart.user_title || chart.title || chart.auto_title;
        
        children.push(new Paragraph({ text: `${i + 1}. ${title}`, heading: HeadingLevel.HEADING_3 }));
        
        const chartEl = chartRefs.current[chart.chart_id];
        if (chartEl) {
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
        }

        const insight = editedInsights[chart.chart_id];
        if (insight) {
          children.push(new Paragraph({ text: "AI Phân tích:", spacing: { before: 200 } }));
          children.push(new Paragraph({ text: insight }));
        }
        children.push(new Paragraph({ text: "" }));
      }

      const doc = new Document({
        sections: [{ properties: {}, children }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `DataMind_Report_${fileSession.fileName || "Data"}.docx`);

    } catch (error) {
      console.error("Export DOCX failed:", error);
      alert("Đã xảy ra lỗi khi xuất file Word. Vui lòng kiểm tra console.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const stats = fileSession.statisticalSummary?.columns || {};

  return (
    <div className={`${PAGE.wrapper} bg-[#FBFBFA]`}>
      <div className="max-w-4xl mx-auto w-full print:max-w-none print:w-full print:m-0 print:p-0">
        
        {/* Header Actions (Not printed) */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-forest" />
            Báo cáo AI (Interactive)
          </h1>
          <div className="flex gap-2">
            <button 
              onClick={handleExportPdf}
              disabled={isExportingPdf || isExportingDocx}
              className={`${BTN.secondary} flex items-center gap-2`}
            >
              <Download className="w-4 h-4" /> {isExportingPdf ? "Đang xử lý..." : "Xuất PDF"}
            </button>
            <button 
              onClick={handleExportDocx}
              disabled={isExportingPdf || isExportingDocx}
              className={`${BTN.primary} flex items-center gap-2`}
            >
              <FileDown className="w-4 h-4" /> {isExportingDocx ? "Đang xử lý..." : "Xuất Word (.docx)"}
            </button>
          </div>
        </div>

        {/* Document Container */}
        <div 
          ref={reportRef} 
          className="bg-white border border-[#EAEAEA] rounded-xl shadow-sm p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:rounded-none print:bg-white"
        >
          {/* Report Title */}
          <div className="border-b border-[#EAEAEA] pb-6 mb-8 text-center group relative">
            <h1 className="text-3xl font-bold text-ink mb-2">Báo cáo Phân tích Dữ liệu</h1>
            <p className="text-muted">Tập dữ liệu: <span className="font-semibold text-ink">{fileSession.fileName || "Unknown"}</span></p>
            <p className="text-sm text-muted mt-1">Ngày tạo: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>

          {/* AI Intro Section */}
          <div className="mb-10 group relative">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded bg-[#EAF2EB] text-[#1B4324] flex items-center justify-center text-xs">✨</span> 
              Tổng quan từ AI
            </h2>
            
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ) : (
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="w-full min-h-[100px] p-4 bg-[#F9F9F8] border border-transparent hover:border-[#EAEAEA] focus:border-forest focus:bg-white rounded-lg text-ink leading-relaxed outline-none resize-y transition-colors print:border-none print:bg-transparent print:resize-none"
                placeholder="Nhập tóm tắt báo cáo..."
              />
            )}
          </div>

          {/* Methodology Section */}
          <div className="mb-10 group relative">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-4">
              <Edit2 className="w-5 h-5 text-forest" />
              Phương pháp & Làm sạch Dữ liệu
            </h2>
            <textarea
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              className="w-full min-h-[80px] p-4 bg-[#F9F9F8] border border-transparent hover:border-[#EAEAEA] focus:border-forest focus:bg-white rounded-lg text-ink leading-relaxed outline-none resize-y transition-colors print:border-none print:bg-transparent print:resize-none"
              placeholder="Mô tả quá trình làm sạch dữ liệu..."
            />
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
                  
                  if (chart.type === "heatmap" && (!matrix || Object.keys(matrix).length === 0)) return null;
                  if (chart.type !== "heatmap" && chart.type !== "box" && chartData.length === 0) return null;
                  if (chart.type === "box" && !colStats.min) return null;

                  return (
                    <div key={chart.chart_id || idx} className="break-inside-avoid relative group border border-transparent hover:border-border p-4 rounded-xl transition-colors">
                      {/* Controls (Hidden in print) */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 print:hidden bg-white shadow-sm border border-border rounded-md p-1 z-10">
                        <button onClick={() => moveChart(idx, -1)} disabled={idx === 0} className="p-1.5 text-muted hover:text-ink disabled:opacity-30 rounded hover:bg-gray-100"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => moveChart(idx, 1)} disabled={idx === charts.length - 1} className="p-1.5 text-muted hover:text-ink disabled:opacity-30 rounded hover:bg-gray-100"><ArrowDown className="w-4 h-4" /></button>
                        <div className="w-[1px] bg-border mx-1"></div>
                        <button onClick={() => removeChart(chart.chart_id)} className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-forest text-white flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </span>
                        {chart.user_title || chart.title || chart.auto_title}
                      </h3>
                      
                      <div className="h-72 mb-6" ref={(el) => (chartRefs.current[chart.chart_id] = el)}>
                        {chart.type === "histogram" && <DistributionChart data={chartData} color={color} />}
                        {chart.type === "bar" && <CategoricalChart data={chartData} color={color} />}
                        {chart.type === "line" && <TrendChart data={chartData} color={color} />}
                        {chart.type === "heatmap" && <CorrelationHeatmap matrix={matrix} topCorr={topCorr} />}
                        {chart.type === "pie" && <PieChartComponent data={chartData} color={color} />}
                        {chart.type === "box" && <BoxPlotChart stats={colStats} color={color} />}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 print:border-[#EAEAEA]">
                        <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-forest" /> AI Phân tích
                        </p>
                        <textarea
                          value={editedInsights[chart.chart_id] || ""}
                          onChange={(e) => setEditedInsights({...editedInsights, [chart.chart_id]: e.target.value})}
                          className="w-full min-h-[100px] p-3 bg-[#F9F9F8] border border-transparent hover:border-[#EAEAEA] focus:border-forest focus:bg-white rounded-lg text-sm text-ink leading-relaxed outline-none resize-y transition-colors print:border-none print:bg-transparent print:resize-none print:p-0"
                          placeholder="Chưa có phân tích AI hoặc nhập phân tích của bạn tại đây..."
                        />
                      </div>
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
