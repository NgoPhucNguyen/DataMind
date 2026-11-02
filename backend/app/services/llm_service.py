"""
llm_service.py
--------------
Gọi Gemini 2.5 Flash để phân tích ngữ cảnh (semantic context) của dataset.
Input: list thông tin các cột từ profiler
Output: {domain, confidence, reasoning}
Fallback an toàn nếu API lỗi hoặc key không tồn tại.
"""

import os
import json
import asyncio
import logging
from typing import Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core import ai_client
from app.core.errors import DataMindException

logger = logging.getLogger(__name__)

_FALLBACK_CONTEXT = {
    "domain": "Unknown",
    "confidence": 0.0,
    "reasoning": "Không thể phân tích ngữ cảnh tự động.",
    "column_semantics": {}
}

_GEMINI_MODEL = os.getenv("GEMINI_MODEL")
_LLM_TIMEOUT_SECONDS = 15

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception) # Thử lại khi gặp lỗi 503 hoặc timeout
)

async def _call_gemini_with_retry(client, prompt):
    # Chọn model từ env, nếu lỗi 503 sẽ thử lại với model đó hoặc model dự phòng
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
    )
def _build_prompt(columns: list[dict], lang: str = "vi", user_correction: str | None = None) -> str:
    """
    Tạo prompt gửi cho Gemini từ danh sách cột đã profile, ngôn ngữ yêu cầu, và hiệu chỉnh người dùng (nếu có).
    """
    col_summary_lines = []
    for col in columns:
        line = (
            f"- Cột '{col['name']}': kiểu={col['detected_type']}, "
            f"unique={col['unique_count']}, "
            f"mẫu={col.get('sample_values', [])[:5]}"
        )
        col_summary_lines.append(line)

    col_summary = "\n".join(col_summary_lines)

    correction_section = ""
    if user_correction and user_correction.strip():
        correction_section = f"""
THÔNG TIN HIỆU CHỈNH TỪ NGƯỜI DÙNG:
Người dùng mô tả hoặc hiệu chỉnh về dataset này như sau: "{user_correction.strip()}".
Hãy sử dụng ngữ cảnh này để nhận diện chính xác lĩnh vực và phân loại semantic_type của các cột.
"""

    lang_instruction = (
        "BẮT BUỘC: Bạn phải trả lời phần `reasoning` và `draft_summary` hoàn toàn bằng TIẾNG ANH (English). Riêng `domain` BẮT BUỘC chọn chính xác 1 mã code trong: Marketing, HR, Finance, Education, Healthcare, E-commerce, Logistics, Other."
        if lang == "en"
        else "BẮT BUỘC: Bạn phải trả lời phần `reasoning` và `draft_summary` hoàn toàn bằng TIẾNG VIỆT (Vietnamese). Riêng `domain` BẮT BUỘC chọn chính xác 1 mã code tiếng Anh trong: Marketing, HR, Finance, Education, Healthcare, E-commerce, Logistics, Other."
    )

    return f"""Bạn là chuyên gia phân tích dữ liệu. Dưới đây là cấu trúc của một dataset:

{col_summary}
{correction_section}
Hãy đoán dataset này thuộc lĩnh vực nào (Marketing, HR, Finance, Education, Healthcare, E-commerce, Logistics, hoặc Other).
Đồng thời, với mỗi cột, hãy phân loại `semantic_type` thành một trong các nhãn sau: 
SEQUENCE_NUMBER, PERSON_NAME, PHONE_NUMBER, EMAIL, ADDRESS, MONEY, GENERAL_TEXT, DATE_TIME, CODE_ID.

QUAN TRỌNG: 
- Bạn phải ưu tiên phân loại dựa trên GIÁ TRỊ MẪU THẬT SỰ thay vì chỉ dựa vào tên cột.
- Nếu cột có giá trị dạng "chữ + số" hoặc "tiền tố + số" (ví dụ "SEQ-101", "ORD-2024-001"), PHẢI phân loại là CODE_ID, KHÔNG phải SEQUENCE_NUMBER.
- SEQUENCE_NUMBER chỉ được dùng cho cột có giá trị là số nguyên thuần túy (không có chữ hay ký tự đặc biệt).
- {lang_instruction}

Trả về JSON theo đúng format sau, KHÔNG có markdown, KHÔNG có giải thích thêm:
{{
  "domain": "<tên lĩnh vực>",
  "confidence": <số thực 0.0 đến 1.0>,
  "reasoning": "<lý giải ngắn gọn trong 1-2 câu>",
  "draft_summary": "<mô tả ngắn gọn súc tích 1-2 câu về dataset này>",
  "column_semantics": {{
    "<tên cột 1>": {{
      "semantic_type": "<nhãn>",
      "confidence": <số thực 0.0 đến 1.0>
    }}
  }}
}}"""


async def get_semantic_context(
    columns: list[dict],
    lang: str = "vi",
    user_correction: str | None = None
) -> dict[str, Any]:
    """
    Nhận diện lĩnh vực của dataset kèm theo tóm tắt và phân loại cột qua ai_client.
    """
    prompt = _build_prompt(columns, lang=lang, user_correction=user_correction)
    parsed, _ = await ai_client.generate_json(
        prompt,
        feature="semantic_context",
        lang=lang,
        required_keys=["domain", "confidence", "reasoning", "column_semantics"]
    )

    column_semantics = parsed.get("column_semantics", {})
    for col_name, info in column_semantics.items():
        conf = float(info.get("confidence", 0.0))
        stype = info.get("semantic_type", "GENERAL_TEXT")
        if conf < 0.75:
            info["semantic_type"] = "GENERAL_TEXT"

    VALID_DOMAINS = {"Marketing", "HR", "Finance", "Education", "Healthcare", "E-commerce", "Logistics", "Other"}
    raw_dom = str(parsed.get("domain", "Other")).strip()
    # Canonical normalization
    domain_mapping = {
        "khác": "Other", "other": "Other", "tài chính": "Finance", "finance": "Finance",
        "nhân sự": "HR", "hr": "HR", "giáo dục": "Education", "education": "Education",
        "y tế": "Healthcare", "healthcare": "Healthcare", "thương mại điện tử": "E-commerce",
        "e-commerce": "E-commerce", "ecommerce": "E-commerce", "vận tải": "Logistics",
        "logistics": "Logistics", "marketing": "Marketing"
    }
    domain = domain_mapping.get(raw_dom.lower(), raw_dom if raw_dom in VALID_DOMAINS else "Other")
    reasoning = str(parsed.get("reasoning", ""))
    draft_summary = str(parsed.get("draft_summary", "")).strip()
    if not draft_summary:
        draft_summary = f"{domain}. {reasoning}" if reasoning else domain

    return {
        "domain": domain,
        "confidence": float(parsed.get("confidence", 0.0)),
        "reasoning": reasoning,
        "draft_summary": draft_summary,
        "column_semantics": column_semantics,
    }

analyze_semantic_context = get_semantic_context

async def generate_report_intro(metadata: dict, charts: list, lang: str = "vi") -> tuple[str, bool]:
    """
    Sử dụng Gemini để sinh đoạn intro 4-5 câu cho báo cáo phân tích.
    Trả về: (text, is_fallback: bool)
    """
    norm_lang = lang if lang in ("vi", "en") else "vi"
    fallback_text = (
        "The dataset has been successfully processed. Below are detailed analyses and visual insights based on your selection."
        if norm_lang == "en"
        else "Tập dữ liệu đã được xử lý thành công. Dưới đây là các phân tích chi tiết dựa trên lựa chọn của bạn."
    )

    try:
        schema_summary = ", ".join([f"{c.get('name')} ({c.get('detected_type')})" for c in metadata.get('schema', [])[:10]])
        
        # Format chart summary including titles and any available auto insights
        chart_lines = []
        for c in charts[:6]:
            t_name = c.get('user_title') or c.get('title') or c.get('auto_title') or c.get('column') or ''
            insights = c.get('auto_insights') or []
            ins_text = "; ".join([str(i.get('text', '')) for i in insights if i.get('text')])
            if ins_text:
                chart_lines.append(f"{t_name} (insights: {ins_text})")
            else:
                chart_lines.append(t_name)
        chart_summary = ", ".join(chart_lines)

        user_ctx_str = ""
        user_ctx = metadata.get('user_context')
        if user_ctx and (user_ctx.get('description') or user_ctx.get('purpose')):
            if norm_lang == "en":
                user_ctx_str = f"- User context: Description: {user_ctx.get('description', '')}, Purpose: {user_ctx.get('purpose', '')}\n"
            else:
                user_ctx_str = f"- Ngữ cảnh từ người dùng: Mô tả: {user_ctx.get('description', '')}, Mục đích: {user_ctx.get('purpose', '')}\n"

        cleaner_ctx_str = ""
        cleaner_summary = metadata.get("cleaner_summary")
        if cleaner_summary and "stats" in cleaner_summary:
            stats = cleaner_summary["stats"]
            if norm_lang == "en":
                cleaner_ctx_str = f"- Data cleaning process: removed {stats.get('duplicate_rows_removed', 0)} duplicates, filled {sum(stats.get('missing_filled', {}).values())} empty cells.\n"
            else:
                cleaner_ctx_str = f"- Quá trình làm sạch: đã xóa {stats.get('duplicate_rows_removed', 0)} dòng trùng, xử lý {sum(stats.get('missing_filled', {}).values())} ô trống.\n"

        if norm_lang == "en":
            prompt = f"""You are a professional data analyst. Based on the following dataset metadata:
- File name: {metadata.get('file_name', 'Unknown')}
- Row count: {metadata.get('row_count', 0)}, Column count: {metadata.get('col_count', 0)}
- Key columns: {schema_summary}
- Selected notable charts: {chart_summary}
{user_ctx_str}{cleaner_ctx_str}
Write EXACTLY 4-5 concise sentences introducing this dataset and highlighting 1-2 key insights based on the selected charts. Connect with the user context (if provided) and briefly summarize the cleaning process.
DO NOT provide conversational fluff, DO NOT use markdown or bullet points, write a single coherent paragraph in ENGLISH."""
        else:
            prompt = f"""Bạn là chuyên gia phân tích dữ liệu. Dựa vào metadata của bộ dữ liệu sau:
- Tên file: {metadata.get('file_name', 'Unknown')}
- Số dòng: {metadata.get('row_count', 0)}, Số cột: {metadata.get('col_count', 0)}
- Một số cột chính: {schema_summary}
- Các biểu đồ đáng chú ý được chọn: {chart_summary}
{user_ctx_str}{cleaner_ctx_str}
Hãy viết CHÍNH XÁC 4-5 câu súc tích để giới thiệu bộ dữ liệu này và nêu bật 1-2 điểm đáng chú ý nhất dựa trên các biểu đồ đã chọn. Đặc biệt cần liên kết với 'Ngữ cảnh từ người dùng' (nếu có) và tóm tắt ngắn về 'Quá trình làm sạch'.
KHÔNG giải thích dông dài, KHÔNG dùng markdown, KHÔNG liệt kê bullet points, chỉ viết một đoạn văn duy nhất bằng TIẾNG VIỆT."""

        intro_text, _ = await ai_client.generate_text(prompt, feature="report_intro", lang=norm_lang)
        if not intro_text:
            return fallback_text, True
        return intro_text, False
    except DataMindException:
        return fallback_text, True
    except Exception as e:
        logger.error(f"Lỗi khi sinh intro: {e}")
        return fallback_text, True
