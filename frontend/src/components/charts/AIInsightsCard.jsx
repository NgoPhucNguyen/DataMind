import React, { useState } from "react";
import { Sparkles, Edit2, Save, X, RefreshCw } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { explainChart, saveExplanation } from "../../services/visualizeService";
import { BTN, BADGE } from "../../constants/ui";

export default function AIInsightsCard({ sessionId, fileHash, chart, autoInsights }) {
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [insightData, setInsightData] = useState(null); // { content, source: "ai" | "user", cached }
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const res = await explainChart({
        session_id: sessionId,
        chart_type: chart.type,
        col_x: chart.col,
        col_y: chart.anchor ? chart.anchor : (chart.type === "heatmap" && chart.topCorr?.length > 0 ? chart.topCorr[0].col_b : null),
        tier: "tier1",
        auto_insights: autoInsights || []
      });
      setInsightData(res);
      setEditContent(res.content);
      setIsExpanded(true);
    } catch (err) {
      showToast(err.response?.data?.detail || "Không thể phân tích bằng AI lúc này.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      showToast("Nội dung không được để trống.", "warning");
      return;
    }
    
    setLoading(true);
    try {
      await saveExplanation({
        session_id: sessionId,
        chart_type: chart.type,
        col_x: chart.col,
        col_y: chart.anchor ? chart.anchor : (chart.type === "heatmap" && chart.topCorr?.length > 0 ? chart.topCorr[0].col_b : null),
        tier: "tier1",
        content: editContent
      });
      setInsightData({ content: editContent, source: "user", cached: true });
      setIsEditing(false);
      showToast("Đã lưu bản phân tích thành công.", "success");
    } catch (err) {
      showToast("Không thể lưu nội dung chỉnh sửa.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!insightData && !loading) {
    return (
      <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
        <p className="text-sm text-muted">Bạn muốn phân tích chuyên sâu hơn?</p>
        <button 
          onClick={handleExplain}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF2EB] text-[#1B4324] hover:bg-[#dceddd] rounded text-sm font-medium transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Phân tích bởi AI (500 tín chỉ)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-forest" />
            AI Phân Tích
          </span>
          {insightData && (
            <span className={insightData.source === "user" ? BADGE.info : BADGE.neutral}>
              {insightData.source === "user" ? "Đã chỉnh sửa bởi bạn" : "Tạo bởi AI"}
            </span>
          )}
        </div>
        
        {insightData && !isEditing && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted hover:text-ink underline underline-offset-2"
            >
              {isExpanded ? "Thu gọn" : "Xem chi tiết"}
            </button>
            <button 
              onClick={() => { setIsEditing(true); setIsExpanded(true); }}
              className="p-1 text-muted hover:text-ink transition-colors"
              title="Chỉnh sửa nội dung"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {loading && !insightData && (
        <div className="animate-pulse space-y-2 mt-3">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
      )}

      {isExpanded && insightData && (
        <div className="mt-3 bg-[#F9F9F8] rounded-md border border-border p-3 text-sm text-ink leading-relaxed">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-32 p-2 border border-border rounded outline-none focus:border-forest text-sm bg-white"
                placeholder="Nhập nội dung phân tích..."
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className={`${BTN.secondary} px-3 py-1 text-xs`}
                >
                  <X className="w-3 h-3 inline-block mr-1" /> Hủy
                </button>
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className={`${BTN.primary} px-3 py-1 text-xs`}
                >
                  {loading ? <RefreshCw className="w-3 h-3 animate-spin inline-block mr-1" /> : <Save className="w-3 h-3 inline-block mr-1" />} 
                  Lưu thay đổi
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap">{insightData.content}</p>
              <p className="text-[10px] text-muted italic mt-3 pt-2 border-t border-border/50">
                ⓘ Đây là suy đoán phân tích từ AI dựa trên bối cảnh, không phải kết luận chắc chắn.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
