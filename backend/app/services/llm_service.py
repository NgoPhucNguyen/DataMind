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

# Fallback trả về khi LLM lỗi hoặc không có key
_FALLBACK_CONTEXT = {
    "domain": "Unknown",
    "confidence": 0.0,
    "reasoning": "Không thể phân tích ngữ cảnh tự động.",
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
def _build_prompt(columns: list[dict]) -> str:
    """
    Tạo prompt gửi cho Gemini từ danh sách cột đã profile.
    """
    col_summary_lines = []
    for col in columns:
        line = (
            f"- Cột '{col['name']}': kiểu={col['detected_type']}, "
            f"unique={col['unique_count']}, "
            f"mẫu={col.get('sample_values', [])[:3]}"
        )
        col_summary_lines.append(line)

    col_summary = "\n".join(col_summary_lines)

    return f"""Bạn là chuyên gia phân tích dữ liệu. Dưới đây là cấu trúc của một dataset:

{col_summary}

Hãy đoán dataset này thuộc lĩnh vực nào (Marketing, HR, Finance, Education, Healthcare, E-commerce, Logistics, hoặc Other).

Trả về JSON theo đúng format sau, KHÔNG có markdown, KHÔNG có giải thích thêm:
{{
  "domain": "<tên lĩnh vực>",
  "confidence": <số thực 0.0 đến 1.0>,
  "reasoning": "<lý giải ngắn gọn trong 1-2 câu>"
}}"""


async def get_semantic_context(columns: list[dict]) -> dict[str, Any]:
    """
    Gọi Gemini 3.5 Flash để nhận diện lĩnh vực của dataset.
    Nếu key không có hoặc lỗi → trả về fallback, không crash.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY chưa được set. Trả về fallback context.")
        return _FALLBACK_CONTEXT

    try:
        # Import ở đây để tránh lỗi import khi chưa cài package
        from google import genai

        client = genai.Client(api_key=api_key)
        prompt = _build_prompt(columns)

        # Chạy blocking call trong thread pool để không block event loop
        response = await _call_gemini_with_retry(client, prompt)

        raw_text = response.text.strip()

        # Xóa markdown code block nếu model trả về có ```json
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)

        return {
            "domain": str(parsed.get("domain", "Unknown")),
            "confidence": float(parsed.get("confidence", 0.0)),
            "reasoning": str(parsed.get("reasoning", "")),
        }

    except asyncio.TimeoutError:
        logger.warning("Gemini API timeout sau %ds.", _LLM_TIMEOUT_SECONDS)
        return _FALLBACK_CONTEXT
    except json.JSONDecodeError as e:
        logger.warning("Gemini trả về JSON không hợp lệ: %s", e)
        return _FALLBACK_CONTEXT
    except Exception as e:
        logger.error(f"Gemini thất bại sau 3 lần thử: {e}")
        return _FALLBACK_CONTEXT
