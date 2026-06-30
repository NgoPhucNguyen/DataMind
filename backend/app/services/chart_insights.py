def generate_insights(stats: dict) -> list[dict]:
    insights = []
    if not stats:
        return insights
        
    dtype = stats.get("dtype")

    if dtype == "numeric":
        if stats.get("outlier_count", 0) > 0:
            insights.append({
                "type": "outlier",
                "text": f"Phát hiện {stats['outlier_count']} giá trị ngoại lệ (outliers), có thể cần làm sạch thêm."
            })
            
        skewness = stats.get("skewness")
        if skewness is not None:
            if skewness > 1:
                insights.append({
                    "type": "distribution",
                    "text": "Phân phối bị lệch phải (right-skewed), tập trung ở các giá trị nhỏ."
                })
            elif skewness < -1:
                insights.append({
                    "type": "distribution",
                    "text": "Phân phối bị lệch trái (left-skewed), tập trung ở các giá trị lớn."
                })
            else:
                insights.append({
                    "type": "distribution",
                    "text": "Dữ liệu có phân phối tương đối đối xứng."
                })
                
        mean = stats.get("mean")
        median = stats.get("median")
        std = stats.get("std", 1.0)
        if mean is not None and median is not None:
            if abs(mean - median) > std:
                insights.append({
                    "type": "variance",
                    "text": f"Giá trị trung bình ({mean:.2f}) chênh lệch với trung vị ({median:.2f}), cho thấy dữ liệu có biến động."
                })

    elif dtype in ["categorical", "boolean"]:
        unique_count = stats.get("unique_count")
        if unique_count is not None:
            insights.append({
                "type": "unique",
                "text": f"Cột có {unique_count} giá trị khác biệt."
            })
            
        top_values = stats.get("top_values", [])
        if len(top_values) > 0:
            top = top_values[0]
            pct = top.get("pct", 0)
            insights.append({
                "type": "top_value",
                "text": f"Giá trị phổ biến nhất là \"{top['value']}\" chiếm {pct}% tổng số."
            })

    return insights
