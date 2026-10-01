"""
context_builder.py
------------------
SSOT module: serialize JSON data → Markdown context cho LLM prompts.
Không gọi API, không query DB — chỉ nhận dict/list, trả str.
"""

from app.services import chart_insights
import json

def build_dataset_context(profile_data: dict) -> str:
    """
    Part 1 — Dataset Context (từ Profiler).
    Build 1 lần khi profile xong, cache theo file_hash.
    
    Input: profile_data dict từ Redis cache `profile:{file_hash}`
    Output: Markdown string
    """
    if not profile_data:
        return ""
        
    filename = profile_data.get("filename", "Unknown")
    total_rows = profile_data.get("total_rows", 0)
    total_columns = profile_data.get("total_columns", 0)
    
    semantic = profile_data.get("semantic_context", {})
    domain = semantic.get("domain", "Unknown")
    confidence = semantic.get("confidence", 0.0)
    reasoning = semantic.get("reasoning", "")
    
    if domain == "Chưa phân tích" or not domain:
        domain_str = "Chưa được phân tích bởi AI"
    else:
        domain_str = f"{domain} ({confidence*100:.0f}%)"
        
    md = "## Dataset Overview\n"
    md += f"- File: {filename}\n"
    md += f"- Rows: {total_rows} | Columns: {total_columns}\n"
    md += f"- Domain: {domain_str}\n"
    if reasoning:
        md += f"- Domain reasoning: {reasoning}\n"
        
    md += "\n⚠️ Hệ thống nhận diện các giá trị sau là NULL synonym: n/a, na, null, none, nil, -, --, ?, missing, trống, không có.\n"

    md += "\n## Column Schema\n"
    md += "| Column | Type | Semantic | Missing% | Note |\n"
    md += "|--------|------|----------|----------|------|\n"
    
    for col in profile_data.get("columns", []):
        name = col.get("name", "")
        dtype = col.get("detected_type", "text")
        sem_type = col.get("semantic_type", "GENERAL_TEXT")
        null_pct = col.get("null_pct", 0.0)
        
        notes = []
        if col.get("disguised_numeric"):
            notes.append("Có thể là số (disguised numeric)")
        if col.get("type_warning"):
            notes.append(col.get("type_warning"))
        if null_pct > 60:
            notes.append("Low confidence (>60% missing)")
        elif col.get("low_confidence"):
            notes.append("Low confidence")
        if col.get("skip_chart"):
            reason = col.get("skip_reason", "")
            notes.append(f"Skipped: {reason}")
            
        note_str = ", ".join(notes) if notes else "—"
        
        md += f"| {name} | {dtype} | {sem_type} | {null_pct:.1f}% | {note_str} |\n"
        
    return md

def build_chart_context(chart_type: str, col_x: str, col_stats: dict, col_y: str = None) -> str:
    """
    Part 2 — Chart Content (từ Visualization).
    Build mỗi lần user bấm Explain.
    """
    if chart_type == "heatmap" or chart_type == "scatter":
        md = f"## Chart: {chart_type} of '{col_x}' vs '{col_y}'\n"
        r_val = col_stats.get("r", "N/A")
        if isinstance(r_val, (int, float)):
            r_val = round(r_val, 4)
        md += f"- Correlation (r): {r_val}\n"
        
        def _get_rep_value(stats):
            dtype = stats.get("dtype")
            if dtype == "numeric":
                val = stats.get("mean", "N/A")
                return f"Mean: {round(val, 2) if isinstance(val, float) else val}"
            elif dtype in ["categorical", "boolean", "multiple_choice"]:
                val = stats.get("mode", "N/A")
                return f"Mode: {val}"
            return "N/A"
            
        md += f"- {col_x} (Semantic: {col_stats.get('col_x_semantic', 'Unknown')}): {_get_rep_value(col_stats.get('col_x_stats', {}))}\n"
        md += f"- {col_y} (Semantic: {col_stats.get('col_y_semantic', 'Unknown')}): {_get_rep_value(col_stats.get('col_y_stats', {}))}\n"
    else:
        md = f"## Chart: {chart_type} of '{col_x}'\n"
        
        dtype = col_stats.get("dtype")
        if dtype == "numeric":
            mean = col_stats.get("mean", "N/A")
            median = col_stats.get("median", "N/A")
            std = col_stats.get("std", "N/A")
            if isinstance(mean, float): mean = round(mean, 2)
            if isinstance(median, float): median = round(median, 2)
            if isinstance(std, float): std = round(std, 2)
            
            md += f"- Mean: {mean} | Median: {median} | Std: {std}\n"
            
            skewness = col_stats.get("skewness")
            kurtosis = col_stats.get("kurtosis")
            if skewness is not None and kurtosis is not None:
                md += f"- Skewness: {round(skewness, 2)} | Kurtosis: {round(kurtosis, 2)}\n"
                
            outliers = col_stats.get("outlier_count", 0)
            md += f"- Outliers: {outliers} values\n"
            
            p25 = col_stats.get("p25")
            p75 = col_stats.get("p75")
            iqr = col_stats.get("iqr")
            if p25 is not None and p75 is not None and iqr is not None:
                md += f"- P25: {round(p25, 2)} | P75: {round(p75, 2)} | IQR: {round(iqr, 2)}\n"
                
        elif dtype in ["categorical", "boolean", "multiple_choice"]:
            mode = col_stats.get("mode", "N/A")
            md += f"- Mode (most frequent): {mode}\n"
            top_values = col_stats.get("top_values", [])
            if top_values:
                md += "- Top Values:\n"
                for tv in top_values[:5]:
                    md += f"  * {tv.get('value')}: {tv.get('count')} ({tv.get('pct')}...)\n"

    # Server-generated auto insights
    auto_insights = chart_insights.generate_insights(col_stats)
    if auto_insights:
        md += "\n### Auto Insights (server-generated)\n"
        for insight in auto_insights:
            md += f"- {insight['text']}\n"
            
    return md

def build_llm_context(profile_data: dict | None, chart_type: str, col_x: str,
                       col_stats: dict, col_y: str = None,
                       dataset_context_md: str = None,
                       user_context: dict = None) -> str:
    """
    Hàm SSOT chính — ghép Part 1 + Part 2 + instruction thành prompt cuối.
    """
    md = "# Context cho Data Analyst AI\n\n"
    
    # Part 1
    if dataset_context_md:
        md += dataset_context_md + "\n"
    elif profile_data:
        md += build_dataset_context(profile_data) + "\n"
        
    if user_context and (user_context.get("description") or user_context.get("purpose")):
        md += "## User Context\n"
        if user_context.get("description"):
            md += f"- Description: {user_context.get('description')}\n"
        if user_context.get("purpose"):
            md += f"- Purpose: {user_context.get('purpose')}\n"
        md += "\n"

    # Part 2
    md += build_chart_context(chart_type, col_x, col_stats, col_y) + "\n"
    
    # Instructions
    md += """
## Instructions
Bạn là chuyên viên phân tích dữ liệu (Data Analyst) chuyên nghiệp và sắc sảo.

NGUYÊN TẮC BẮT BUỘC:
1. CẤM: Bịa đặt hoặc thay đổi số liệu không khớp với phần "Dataset Overview" và "Chart Content" ở trên.
   Ví dụ: KHÔNG được tự nói sai giá trị mean/std/missing% đã cho, không được "làm tròn" hay "ước lượng" số liệu không tồn tại.
2. ĐƯỢC PHÉP và KHUYẾN KHÍCH: Dùng kiến thức nền chung (ngoài dataset) để đưa ra giả thuyết/góc nhìn phân tích
   hợp lý giải thích cho pattern quan sát được trong số liệu.
   Ví dụ: xu hướng tăng theo mùa vụ, hành vi tiêu dùng phổ biến, quy luật ngành...
   Đây là giả thuyết tham khảo, không phải kết luận chắc chắn.
3. Nếu thiếu thông tin để phân tích một khía cạnh cụ thể, nói rõ: "Không đủ dữ liệu để phân tích điểm này."
4. Giá trị trong cột "Missing%" ở bảng Column Schema đã LOẠI BỎ các NULL synonym
   (n/a, na, null, none, nil, -, --, ?, missing, trống, không có) — đây là tỷ lệ missing thực sự.
5. BẮT BUỘC: Trả lời HOÀN TOÀN BẰNG TIẾNG VIỆT, kể cả khi dữ liệu gốc, tên cột hay nội dung biểu đồ đang dùng ngôn ngữ khác.

Hãy viết một đoạn giải thích (3-5 câu) phân tích ý nghĩa của biểu đồ.
Trả về ĐÚNG MỘT ĐOẠN VĂN bản (không markdown, không bullet point).
KHÔNG cần thêm disclaimer hay cảnh báo "đây là suy đoán" — phần đó đã được xử lý riêng.
"""
    return md
