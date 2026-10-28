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
        "BẮT BUỘC: Bạn phải trả lời phần `reasoning`, `domain` và `draft_summary` hoàn toàn bằng TIẾNG ANH (English)."
        if lang == "en"
        else "BẮT BUỘC: Bạn phải trả lời phần `reasoning`, `domain` và `draft_summary` hoàn toàn bằng TIẾNG VIỆT (Vietnamese)."
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
    Gọi Gemini để nhận diện lĩnh vực của dataset kèm theo tóm tắt và phân loại cột.
    Nếu key không có hoặc lỗi → trả về fallback, không crash.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY chưa được set. Trả về fallback context.")
        fallback = dict(_FALLBACK_CONTEXT)
        fallback["draft_summary"] = (
            "Dataset overview not available." if lang == "en" else "Chưa có mô tả tổng quan dataset."
        )
        return fallback

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        prompt = _build_prompt(columns, lang=lang, user_correction=user_correction)

        response = await _call_gemini_with_retry(client, prompt)
        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)

        column_semantics = parsed.get("column_semantics", {})
        for col_name, info in column_semantics.items():
            conf = float(info.get("confidence", 0.0))
            stype = info.get("semantic_type", "GENERAL_TEXT")
            if conf < 0.75:
                info["semantic_type"] = "GENERAL_TEXT"

        domain = str(parsed.get("domain", "Unknown"))
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

    except asyncio.TimeoutError:
        logger.warning("Gemini API timeout sau %ds.", _LLM_TIMEOUT_SECONDS)
        fallback = dict(_FALLBACK_CONTEXT)
        fallback["draft_summary"] = (
            "Dataset overview timed out." if lang == "en" else "Hết thời gian phân tích mô tả dataset."
        )
        return fallback
    except json.JSONDecodeError as e:
        logger.warning("Gemini trả về JSON không hợp lệ: %s", e)
        fallback = dict(_FALLBACK_CONTEXT)
        fallback["draft_summary"] = (
            "Unable to parse dataset overview." if lang == "en" else "Không thể phân tích mô tả dataset."
        )
        return fallback
    except Exception as e:
        import traceback
        logger.error(f"Gemini thất bại sau 3 lần thử: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return _FALLBACK_CONTEXT

async def generate_report_intro(metadata: dict, charts: list) -> str:
    """
    Sử dụng Gemini để sinh đoạn intro 4-5 câu cho báo cáo phân tích.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Tập dữ liệu đã sẵn sàng để phân tích. Hệ thống hiện không thể tự động tổng hợp"

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        schema_summary = ", ".join([f"{c.get('name')} ({c.get('detected_type')})" for c in metadata.get('schema', [])[:10]])
        chart_summary = ", ".join([c.get('user_title', c.get('title', '')) for c in charts[:5]])

        user_ctx_str = ""
        user_ctx = metadata.get('user_context')
        if user_ctx and (user_ctx.get('description') or user_ctx.get('purpose')):
            user_ctx_str = f"- Ngữ cảnh từ người dùng: Mô tả: {user_ctx.get('description', '')}, Mục đích: {user_ctx.get('purpose', '')}\n"

        cleaner_ctx_str = ""
        cleaner_summary = metadata.get("cleaner_summary")
        if cleaner_summary and "stats" in cleaner_summary:
            stats = cleaner_summary["stats"]
            cleaner_ctx_str = f"- Quá trình làm sạch: đã xóa {stats.get('duplicate_rows_removed', 0)} dòng trùng, xử lý {sum(stats.get('missing_filled', {}).values())} ô trống.\n"

        prompt = f"""Bạn là chuyên gia phân tích dữ liệu. Dựa vào metadata của bộ dữ liệu sau:
- Tên file: {metadata.get('file_name', 'Unknown')}
- Số dòng: {metadata.get('row_count', 0)}, Số cột: {metadata.get('col_count', 0)}
- Một số cột chính: {schema_summary}
- Các biểu đồ đáng chú ý được chọn: {chart_summary}
{user_ctx_str}{cleaner_ctx_str}
Hãy viết CHÍNH XÁC 4-5 câu súc tích để giới thiệu bộ dữ liệu này và nêu bật 1-2 điểm đáng chú ý nhất dựa trên các biểu đồ đã chọn. Đặc biệt cần liên kết với 'Ngữ cảnh từ người dùng' (nếu có) và tóm tắt ngắn về 'Quá trình làm sạch'.
KHÔNG giải thích dông dài, KHÔNG dùng markdown, KHÔNG liệt kê bullet points, chỉ viết một đoạn văn duy nhất."""

        response = await _call_gemini_with_retry(client, prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Lỗi khi sinh intro: {e}")
        return "Tập dữ liệu đã được xử lý thành công. Dưới đây là các phân tích chi tiết dựa trên lựa chọn của bạn."
