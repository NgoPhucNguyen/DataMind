def generate_insights(stats: dict) -> list[dict]:
    """
    Tạo danh sách các nhận xét tự động (auto insights) cho biểu đồ dưới dạng có cấu trúc:
    [{"key": "...", "params": {...}}, ...] (tối đa 2 nhận xét mỗi biểu đồ).
    Không gọi Gemini / LLM. Frontend chịu trách nhiệm i18n theo key và params.
    """
    insights = []
    if not stats or stats.get("skip_chart"):
        return insights
        
    dtype = stats.get("dtype")

    if dtype in ("categorical", "boolean"):
        top_values = stats.get("top_values", [])
        if top_values:
            top1 = top_values[0]
            if top1.get("value") != "__other__":
                insights.append({
                    "key": "top_value",
                    "params": {"value": str(top1.get("value")), "pct": top1.get("pct", 0)}
                })
        
        # Check top3_share (chỉ hiển thị khi tổng thị phần top 3 >= 70%)
        all_vals = [v for v in stats.get("all_values", top_values) if v.get("value") != "__other__"]
        if len(all_vals) >= 3:
            top3_pct = round(sum(v.get("pct", 0) for v in all_vals[:3]), 1)
            if top3_pct >= 70:
                insights.append({
                    "key": "top3_share",
                    "params": {"pct": top3_pct}
                })

    elif dtype == "multiple_choice":
        top_values = stats.get("top_values", [])
        if top_values:
            top1 = top_values[0]
            if top1.get("value") != "__other__":
                insights.append({
                    "key": "mc_top",
                    "params": {"value": str(top1.get("value")), "pct": top1.get("pct", 0)}
                })
        
        avg_choices = stats.get("avg_choices")
        if avg_choices is not None and avg_choices >= 1.5:
            insights.append({
                "key": "mc_avg",
                "params": {"avg": avg_choices}
            })

    elif dtype == "numeric":
        p25 = stats.get("p25")
        p75 = stats.get("p75")
        if p25 is not None and p75 is not None:
            insights.append({
                "key": "typical_range",
                "params": {
                    "low": round(p25, 2) if isinstance(p25, (int, float)) else p25,
                    "high": round(p75, 2) if isinstance(p75, (int, float)) else p75
                }
            })
            
        outliers = stats.get("outlier_count", 0)
        if outliers and outliers > 0:
            insights.append({
                "key": "outliers",
                "params": {"n": int(outliers)}
            })

    elif dtype == "datetime":
        trend_data = stats.get("trend_data", [])
        if len(trend_data) >= 2:
            first_count = trend_data[0].get("count", 0)
            last_count = trend_data[-1].get("count", 0)
            if first_count > 0:
                pct_change = round(((last_count - first_count) / first_count) * 100, 1)
                if pct_change >= 10:
                    insights.append({
                        "key": "trend_up",
                        "params": {"pct": abs(pct_change)}
                    })
                elif pct_change <= -10:
                    insights.append({
                        "key": "trend_down",
                        "params": {"pct": abs(pct_change)}
                    })

        if trend_data:
            peak_item = max(trend_data, key=lambda x: x.get("count", 0))
            if peak_item and peak_item.get("count", 0) > 0:
                insights.append({
                    "key": "peak",
                    "params": {"period": str(peak_item.get("period"))}
                })

    return insights[:2]
