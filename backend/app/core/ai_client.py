"""
ai_client.py
------------
AI Provider Layer with Gemini as primary, Groq as fallback, and dev mock mode.
All AI calls across DataMind route through this layer.
"""

import os
import json
import re
import time
import asyncio
import logging
from contextvars import ContextVar
from typing import Any, Optional, Tuple, Dict, List

import httpx
from app.core.errors import DataMindException, ErrorSeverity

logger = logging.getLogger(__name__)

_last_provider_var: ContextVar[str] = ContextVar("last_provider", default="")


def get_last_provider() -> str:
    """Returns the provider used for the most recent AI operation in the current context."""
    return _last_provider_var.get()


def is_dev() -> bool:
    """Returns True if current APP_ENV is development or local."""
    try:
        return os.getenv("APP_ENV", "production").lower() in ("development", "local")
    except Exception:
        return False


def get_dev_provider() -> Optional[str]:
    """
    Safely returns provider for API response in dev/local environments.
    Guaranteed never to raise an exception or fail.
    """
    try:
        if is_dev():
            val = get_last_provider()
            return val if val else None
    except Exception:
        pass
    return None


def _is_timeout_or_5xx(error: Exception) -> bool:
    """Helper to detect network timeout or 5xx server errors from Gemini/SDK."""
    err_str = str(error).lower()
    if isinstance(error, (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException)):
        return True
    if any(code in err_str for code in ["500", "502", "503", "504", "deadline_exceeded", "timeout", "server_error"]):
        return True
    return False


def _is_rate_limited(error: Exception) -> bool:
    """Helper to detect 429 rate limit or quota exhaustion."""
    err_str = str(error).lower()
    return any(code in err_str for code in ["429", "resource_exhausted", "quota", "rate_limit", "ratelimit"])


def _trim_prompt_for_groq(prompt: str, max_chars: int = 6000) -> str:
    """
    If the prompt is very long, trim column sample values (keep column names + first 3 sample values).
    """
    if len(prompt) <= max_chars:
        return prompt

    def _truncate_samples(match):
        prefix = match.group(1)
        raw_samples = match.group(2)
        items = [s.strip() for s in raw_samples.split(",") if s.strip()]
        return f"{prefix}[{', '.join(items[:3])}]"

    # Match patterns like mẫu=[...], sample=[...], sample_values=[...]
    trimmed = re.sub(
        r"(mẫu\s*=\s*|sample(?:_values)?\s*=\s*)\[([^\]\n]+)\]",
        _truncate_samples,
        prompt,
        flags=re.IGNORECASE
    )

    if len(trimmed) > max_chars:
        # If still oversized, trim list representations in square brackets
        def _trim_brackets(m):
            parts = [p.strip() for p in m.group(1).split(",") if p.strip()]
            return "[" + ", ".join(parts[:3]) + "]"
        trimmed = re.sub(r"\[([^[\]\n]{30,})\]", _trim_brackets, trimmed)

    return trimmed


def _parse_and_validate_json(raw_text: str, required_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """Parse JSON text and validate required keys."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback to regex finding JSON block
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise ValueError("No valid JSON found in response")
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON is not an object/dictionary")

    if required_keys:
        missing = [k for k in required_keys if k not in parsed]
        if missing:
            raise ValueError(f"Missing required keys in JSON response: {missing}")

    return parsed


def _get_mock_response(feature: str, lang: str, is_json: bool, required_keys: Optional[List[str]] = None) -> Any:
    """Return canned mock response matching feature and language."""
    norm_lang = lang if lang in ("vi", "en") else "vi"

    if feature == "semantic_context" or is_json:
        mock_json = {
            "domain": "E-commerce",
            "confidence": 0.95,
            "reasoning": (
                "Dữ liệu chứa thông tin sản phẩm và doanh số bán hàng."
                if norm_lang == "vi"
                else "Dataset contains product catalog and sales revenue details."
            ),
            "draft_summary": (
                "Tập dữ liệu giao dịch thương mại điện tử và kết quả bán hàng."
                if norm_lang == "vi"
                else "E-commerce transaction and sales performance dataset."
            ),
            "column_semantics": {}
        }
        if required_keys:
            for k in required_keys:
                if k not in mock_json:
                    mock_json[k] = {} if "semantic" in k else "mock_value"
        return mock_json

    if feature == "report_intro":
        if norm_lang == "en":
            return (
                "The dataset provides a comprehensive overview of core operational indicators and category distributions. "
                "Key visual charts highlight meaningful trends and notable variations across major segments. "
                "Data cleaning successfully handled missing entries and standardized formats. "
                "Overall, the dataset maintains high reliability for analytical evaluations."
            )
        return (
            "Tập dữ liệu phản ánh toàn diện các chỉ số hoạt động chính và phân bố danh mục. "
            "Các phân tích trực quan làm rõ các xu hướng quan trọng và biến động tiêu biểu giữa các nhóm. "
            "Quá trình tiền xử lý đã hoàn thiện các dữ liệu thiếu sót và chuẩn hóa định dạng. "
            "Tổng thể bộ dữ liệu đảm bảo chất lượng phục vụ cho việc đánh giá và ra quyết định."
        )

    # feature == "explain" or general text
    if norm_lang == "en":
        return (
            "The chart shows a well-distributed dataset with most values clustering around the primary range. "
            "The overall pattern indicates steady performance across the observed metric."
        )
    return (
        "Biểu đồ cho thấy sự phân bố dữ liệu tương đối đồng đều với phần lớn các giá trị tập trung ở phân khúc chủ đạo. "
        "Xu hướng tổng thể phản ánh tính ổn định của chỉ số đang theo dõi."
    )


def _raise_ai_unavailable(lang: str, feature: str, root_cause: str):
    """Raise DataMindException with ERR_AI_UNAVAILABLE."""
    user_msg = (
        "Hiện chưa sử dụng được AI. Bạn không bị trừ lượt, vui lòng thử lại sau."
        if lang == "vi"
        else "AI is currently unavailable. Your turns were not deducted, please try again later."
    )
    raise DataMindException(
        code="ERR_AI_UNAVAILABLE",
        severity=ErrorSeverity.BLOCKING,
        user_message=user_msg,
        technical_detail={
            "module": "ai_client",
            "location": feature,
            "root_cause": str(root_cause),
        },
        suggested_action=None,
    )


async def _call_gemini(prompt: str) -> str:
    """Call Google Gemini with 1 retry on 5xx/timeout."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    from google import genai
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    client = genai.Client(api_key=api_key)

    attempts = 0
    while attempts < 2:
        attempts += 1
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
            )
            raw_text = response.text.strip() if response and response.text else ""
            if not raw_text:
                raise ValueError("Empty text returned from Gemini")
            return raw_text
        except Exception as e:
            if _is_rate_limited(e):
                logger.warning("Gemini 429 rate limit encountered; skipping retry.")
                raise e
            if _is_timeout_or_5xx(e) and attempts == 1:
                logger.warning("Gemini 5xx/timeout error; retrying once after 1s...")
                await asyncio.sleep(1.0)
                continue
            raise e


async def _call_groq(prompt: str, is_json: bool = False) -> str:
    """Call Groq chat completion API (OpenAI compatible)."""
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL")
    if not api_key or not model:
        raise ValueError("GROQ_API_KEY or GROQ_MODEL is not configured")

    groq_prompt = _trim_prompt_for_groq(prompt)

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": groq_prompt}
        ],
        "temperature": 0.2 if is_json else 0.4,
    }
    if is_json:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise ValueError(f"Groq API error HTTP {resp.status_code}: {resp.text}")

        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        raw_text = content.strip()
        if not raw_text:
            raise ValueError("Empty text returned from Groq")
        return raw_text


async def generate_text(prompt: str, feature: str, lang: str = "vi") -> Tuple[str, str]:
    """
    Generate plain text via Gemini primary -> Groq fallback -> dev mock.
    Returns: (text, provider)
    """
    norm_lang = lang if lang in ("vi", "en") else "vi"
    start_time = time.time()

    # 1. Check Mock Mode
    mock_env = os.getenv("GEMINI_MOCK", "0")
    if mock_env == "1":
        app_env = os.getenv("APP_ENV", "development")
        if app_env == "production":
            raise RuntimeError("GEMINI_MOCK=1 is not allowed when APP_ENV=production")

        mock_err = os.getenv("GEMINI_MOCK_ERROR", "").strip()
        if mock_err == "all":
            _raise_ai_unavailable(norm_lang, feature, "Mock error: all providers failed")
        provider = "mock"
        result = _get_mock_response(feature, norm_lang, is_json=False)
        _last_provider_var.set(provider)
        latency = time.time() - start_time
        logger.info("AI Provider: feature=%s provider=%s latency=%.2fs (mock)", feature, provider, latency)
        return result, provider

    # 2. Primary: Gemini
    gemini_error = None
    try:
        text = await _call_gemini(prompt)
        provider = "gemini"
        _last_provider_var.set(provider)
        latency = time.time() - start_time
        logger.info("AI Provider: feature=%s provider=%s latency=%.2fs", feature, provider, latency)
        return text, provider
    except Exception as e:
        gemini_error = e
        logger.warning("Gemini primary failed for feature '%s': %s", feature, e)

    # 3. Fallback: Groq
    groq_error = None
    if os.getenv("GROQ_API_KEY") and os.getenv("GROQ_MODEL"):
        try:
            text = await _call_groq(prompt, is_json=False)
            provider = "groq"
            _last_provider_var.set(provider)
            latency = time.time() - start_time
            logger.info("AI Provider: feature=%s provider=%s latency=%.2fs (fallback)", feature, provider, latency)
            return text, provider
        except Exception as e:
            groq_error = e
            logger.warning("Groq fallback failed for feature '%s': %s", feature, e)
    else:
        groq_error = ValueError("Groq is not configured (missing GROQ_API_KEY or GROQ_MODEL)")

    # 4. Both failed
    combined_err = f"Gemini: {gemini_error}; Groq: {groq_error}"
    _raise_ai_unavailable(norm_lang, feature, combined_err)


async def generate_json(
    prompt: str,
    feature: str,
    lang: str = "vi",
    required_keys: Optional[List[str]] = None
) -> Tuple[Dict[str, Any], str]:
    """
    Generate structured JSON via Gemini primary -> Groq fallback -> dev mock.
    Validates required_keys; on validation failure, falls back to Groq.
    Returns: (parsed_json_dict, provider)
    """
    norm_lang = lang if lang in ("vi", "en") else "vi"
    start_time = time.time()

    # 1. Check Mock Mode
    mock_env = os.getenv("GEMINI_MOCK", "0")
    if mock_env == "1":
        app_env = os.getenv("APP_ENV", "development")
        if app_env == "production":
            raise RuntimeError("GEMINI_MOCK=1 is not allowed when APP_ENV=production")

        mock_err = os.getenv("GEMINI_MOCK_ERROR", "").strip()
        if mock_err == "all":
            _raise_ai_unavailable(norm_lang, feature, "Mock error: all providers failed")
        provider = "mock"
        result = _get_mock_response(feature, norm_lang, is_json=True, required_keys=required_keys)
        _last_provider_var.set(provider)
        latency = time.time() - start_time
        logger.info("AI Provider: feature=%s provider=%s latency=%.2fs (mock)", feature, provider, latency)
        return result, provider

    # 2. Primary: Gemini
    gemini_error = None
    try:
        raw_text = await _call_gemini(prompt)
        parsed = _parse_and_validate_json(raw_text, required_keys=required_keys)
        provider = "gemini"
        _last_provider_var.set(provider)
        latency = time.time() - start_time
        logger.info("AI Provider: feature=%s provider=%s latency=%.2fs", feature, provider, latency)
        return parsed, provider
    except Exception as e:
        gemini_error = e
        logger.warning("Gemini primary failed for JSON feature '%s': %s", feature, e)

    # 3. Fallback: Groq
    groq_error = None
    if os.getenv("GROQ_API_KEY") and os.getenv("GROQ_MODEL"):
        try:
            raw_text = await _call_groq(prompt, is_json=True)
            parsed = _parse_and_validate_json(raw_text, required_keys=required_keys)
            provider = "groq"
            _last_provider_var.set(provider)
            latency = time.time() - start_time
            logger.info("AI Provider: feature=%s provider=%s latency=%.2fs (fallback)", feature, provider, latency)
            return parsed, provider
        except Exception as e:
            groq_error = e
            logger.warning("Groq fallback failed for JSON feature '%s': %s", feature, e)
    else:
        groq_error = ValueError("Groq is not configured (missing GROQ_API_KEY or GROQ_MODEL)")

    # 4. Both failed
    combined_err = f"Gemini: {gemini_error}; Groq: {groq_error}"
    _raise_ai_unavailable(norm_lang, feature, combined_err)

