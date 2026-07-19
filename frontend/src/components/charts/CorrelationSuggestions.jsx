import React, { useState, useEffect } from "react";
import { Link2, AlertTriangle, ChevronRight } from "lucide-react";
import { getCorrelationSuggestions } from "../../services/visualizeService";

export default function CorrelationSuggestions({ sessionId, onSelectAnchor }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const data = await getCorrelationSuggestions(sessionId);
        if (isMounted) setSuggestions(data);
      } catch (err) {
        // Silent fail for suggestions, as it's an enhancement
        console.error("Failed to load suggestions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchSuggestions();
    return () => { isMounted = false; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="bg-sage/10 border border-border rounded-xl p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't render if no strong correlations
  }

  return (
    <div className="bg-sage/10 border border-[#EAEAEA] rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-forest" />
        AI Gợi ý Khám phá Tương quan
      </h3>
      <p className="text-xs text-muted mb-4">
        Hệ thống tự động phát hiện các cặp cột có liên kết dữ liệu mạnh (cả số và chữ). Chọn để phân tích chi tiết.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {suggestions.map((sug, idx) => {
          // Score classification
          let strength = "Vừa";
          let color = "text-[#956400]";
          let bg = "bg-[#FBF3DB]";
          
          if (sug.score >= 0.7) {
            strength = "Rất mạnh";
            color = "text-[#9F2F2D]";
            bg = "bg-[#FDEBEC]";
          } else if (sug.score >= 0.5) {
            strength = "Mạnh";
            color = "text-[#1B4324]";
            bg = "bg-[#EAF2EB]";
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectAnchor(sug.col_a, sug.col_b, sug.value)}
              className="flex flex-col text-left p-3 bg-white border border-[#EAEAEA] rounded-lg hover:border-forest/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${bg} ${color}`}>
                  {strength} ({sug.metric})
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-ink transition-colors" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-ink line-clamp-1">
                <span className="truncate">{sug.col_a}</span>
                <span className="text-muted shrink-0">&harr;</span>
                <span className="truncate">{sug.col_b}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
