"""
context_builder.py
------------------
SSOT module: serialize JSON data → Markdown context cho LLM prompts.
Không gọi API, không query DB — chỉ nhận dict/list, trả str.
"""

from app.services import chart_insights
import json

def build_dataset_context(profile_data: dict, relevant_columns: list[str] | None = None) -> str:
    """
    Part 1 — Dataset Context (từ Profiler).
    Trims Column Schema to relevant_columns if provided to save LLM tokens.
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

    md += "\n## Column Schema (Relevant to this chart)\n"
    md += "| Column | Type | Semantic | Missing% | Note |\n"
    md += "|--------|------|----------|----------|------|\n"
    
    all_cols = profile_data.get("columns", [])
    if relevant_columns:
        filtered_cols = [c for c in all_cols if c.get("name") in relevant_columns]
        if not filtered_cols:
            filtered_cols = all_cols
    else:
        filtered_cols = all_cols

    for col in filtered_cols:
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

def build_chart_context(chart_type: str, col_x: str, col_stats: dict, col_y: str = None,
                        chart_config: dict | None = None, plotted_data: list | None = None) -> str:
    """
    Part 2 — Chart Content (từ Visualization).
    Includes chart configuration, plotted data points, and statistical metrics.
    """
    chart_title = (chart_config or {}).get("title") or f"{chart_type} of {col_x}"
    if col_y:
        chart_title += f" vs {col_y}"
    
    md = f"## Chart Details\n"
    md += f"- Title: {chart_title}\n"
    md += f"- Chart Type: {chart_type}\n"
    md += f"- Column X: {col_x}\n"
    if col_y:
        md += f"- Column Y: {col_y}\n"
    if chart_config and chart_config.get("aggregation"):
        md += f"- Aggregation: {chart_config.get('aggregation')}\n"
    if chart_config and chart_config.get("filters"):
        md += f"- Active Filters: {chart_config.get('filters')}\n"

    # Aggregated plotted data points (capped)
    if plotted_data and isinstance(plotted_data, list) and len(plotted_data) > 0:
        md += "\n### Plotted Data Points (Aggregated Sample)\n"
        capped_data = plotted_data[:30]
        for idx, item in enumerate(capped_data):
            if isinstance(item, dict):
                pts = [f"{k}: {v}" for k, v in item.items() if k not in ("color", "id")]
                md += f"  {idx+1}. " + ", ".join(pts) + "\n"
            else:
                md += f"  {idx+1}. {item}\n"

    # Stats
    md += "\n### Statistical Distribution\n"
    if chart_type in ("heatmap", "scatter"):
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
            txt = insight.get("text") or f"{insight.get('key')}: {insight.get('params')}"
            md += f"- {txt}\n"
            
    return md

def build_llm_context(profile_data: dict | None, chart_type: str, col_x: str,
                       col_stats: dict, col_y: str = None,
                       dataset_context_md: str = None,
                       user_context: dict = None,
                       cleaning_summary: dict = None,
                       chart_config: dict = None,
                       plotted_data: list = None) -> str:
    """
    Hàm SSOT chính — ghép Part 1 + Part 2 + cleaning summary + user context + instruction.
    """
    md = "# Context cho Data Analyst AI\n\n"
    
    # Part 1: Dataset context (trimmed to relevant columns)
    relevant_cols = [c for c in [col_x, col_y] if c]
    if profile_data:
        md += build_dataset_context(profile_data, relevant_columns=relevant_cols) + "\n"
    elif dataset_context_md:
        md += dataset_context_md + "\n"

    # Cleaning Summary
    if cleaning_summary:
        md += "## Data Cleaning History\n"
        clean_mode = cleaning_summary.get("clean_mode", "auto")
        md += f"- Cleaning Mode: {clean_mode}\n"
        actions = cleaning_summary.get("actions_taken") or []
        md += f"- Total Cleaning Actions: {len(actions)}\n"
        if actions:
            action_desc = [f"{a.get('action', a.get('action_type', 'operation'))} on {a.get('column', 'all')}" for a in actions[:5]]
            md += f"- Sample Actions: {'; '.join(action_desc)}\n"
        ignored_count = cleaning_summary.get("ignored_cells_count")
        if ignored_count is not None:
            md += f"- Ignored Error Cells: {ignored_count}\n"
        md += "\n"
        
    # User / Profiler Context
    is_unedited_ai_draft = False
    if user_context and (user_context.get("description") or user_context.get("purpose")):
        md += "## Dataset Domain & User Context\n"
        if user_context.get("description"):
            md += f"- Description: {user_context.get('description')}\n"
        if user_context.get("description_source"):
            src = user_context.get("description_source")
            md += f"- Description Source: {src}\n"
            if src == "ai_draft":
                is_unedited_ai_draft = True
        if user_context.get("purpose"):
            md += f"- Purpose: {user_context.get('purpose')}\n"
        md += "\n"

    # Part 2: Chart details & Plotted data
    md += build_chart_context(chart_type, col_x, col_stats, col_y, chart_config, plotted_data) + "\n"
    
    # Instructions
    md += """
## Instructions
Bạn là chuyên viên phân tích dữ liệu (Data Analyst) chuyên nghiệp và sắc sảo.

NGUYÊN TẮC BẮT BUỘC:
1. CẤM: Bịa đặt hoặc thay đổi số liệu không khớp với phần thông tin ở trên.
2. ĐƯỢC PHÉP và KHUYẾN KHÍCH: Đưa ra góc nhìn sâu sắc về nghiệp vụ và quy luật xu hướng dựa trên các điểm dữ liệu cụ thể.
3. Nếu thiếu thông tin để phân tích một khía cạnh cụ thể, nói rõ: "Không đủ dữ liệu để phân tích điểm này."
"""

    if is_unedited_ai_draft:
        md += """4. LƯU Ý ĐẶC BIỆT: Mô tả ngữ cảnh của bộ dữ liệu hiện tại là bản nháp tự động từ AI và chưa qua người dùng xác nhận chỉnh sửa. Hãy lưu ý ngắn gọn về giới hạn ngữ cảnh dữ liệu trong lời giải thích của bạn.\n"""

    md += """
Hãy viết một đoạn giải thích (3-5 câu) phân tích ý nghĩa và điểm nổi bật của biểu đồ.
Trả về ĐÚNG MỘT ĐOẠN VĂN bản (không markdown, không bullet point).
"""
    return md

