"""
test_ai_client.py
-----------------
Unit tests for the AI Provider Layer (Gemini primary, Groq fallback, Dev Mock).
Mocks all HTTP/external calls.
"""

import os
import sys
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core import ai_client
from app.core.errors import DataMindException, ErrorSeverity
from app.main import app
from app.core.dependencies import get_current_user
from app.core.database import get_db

MOCK_USER = {"user_id": 999, "email": "test@datamind.vn", "tier": "free"}

def override_get_current_user():
    return MOCK_USER

app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Gemini OK -> Groq never called
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gemini_ok_groq_never_called():
    with patch.dict(os.environ, {"GEMINI_MOCK": "0", "GEMINI_API_KEY": "fake_gemini", "GROQ_API_KEY": "fake_groq", "GROQ_MODEL": "llama-3"}):
        with patch("app.core.ai_client._call_gemini", new_callable=AsyncMock) as mock_gemini, \
             patch("app.core.ai_client._call_groq", new_callable=AsyncMock) as mock_groq:
            
            mock_gemini.return_value = "Gemini plain text response"
            text, provider = await ai_client.generate_text("Sample prompt", feature="explain", lang="vi")
            
            assert text == "Gemini plain text response"
            assert provider == "gemini"
            mock_gemini.assert_called_once()
            mock_groq.assert_not_called()

        with patch("app.core.ai_client._call_gemini", new_callable=AsyncMock) as mock_gemini_json, \
             patch("app.core.ai_client._call_groq", new_callable=AsyncMock) as mock_groq_json:
            
            mock_gemini_json.return_value = '{"domain": "Finance", "confidence": 0.9, "reasoning": "test", "column_semantics": {}}'
            parsed, provider = await ai_client.generate_json(
                "Sample prompt",
                feature="semantic_context",
                lang="vi",
                required_keys=["domain", "confidence", "reasoning", "column_semantics"]
            )
            
            assert parsed["domain"] == "Finance"
            assert provider == "gemini"
            mock_gemini_json.assert_called_once()
            mock_groq_json.assert_not_called()


# ---------------------------------------------------------------------------
# 2. Gemini 429 -> Groq used, result returned
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gemini_429_groq_used():
    with patch.dict(os.environ, {"GEMINI_MOCK": "0", "GEMINI_API_KEY": "fake_gemini", "GROQ_API_KEY": "fake_groq", "GROQ_MODEL": "llama-3"}):
        with patch("app.core.ai_client._call_gemini", side_effect=Exception("429 ResourceExhausted: rate limit exceeded")), \
             patch("app.core.ai_client._call_groq", new_callable=AsyncMock) as mock_groq:
            
            mock_groq.return_value = "Groq fallback text response"
            text, provider = await ai_client.generate_text("Sample prompt", feature="explain", lang="vi")
            
            assert text == "Groq fallback text response"
            assert provider == "groq"
            mock_groq.assert_called_once()

        with patch("app.core.ai_client._call_gemini", side_effect=Exception("429 Quota Exceeded")), \
             patch("app.core.ai_client._call_groq", new_callable=AsyncMock) as mock_groq_json:
            
            mock_groq_json.return_value = '{"domain": "Healthcare", "confidence": 0.85, "reasoning": "from groq", "column_semantics": {}}'
            parsed, provider = await ai_client.generate_json(
                "Sample prompt",
                feature="semantic_context",
                lang="vi",
                required_keys=["domain", "confidence", "reasoning", "column_semantics"]
            )
            
            assert parsed["domain"] == "Healthcare"
            assert provider == "groq"
            mock_groq_json.assert_called_once()


# ---------------------------------------------------------------------------
# 3. Gemini invalid JSON -> Groq used
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gemini_invalid_json_groq_used():
    with patch.dict(os.environ, {"GEMINI_MOCK": "0", "GEMINI_API_KEY": "fake_gemini", "GROQ_API_KEY": "fake_groq", "GROQ_MODEL": "llama-3"}):
        # Gemini returns invalid JSON / missing required keys
        with patch("app.core.ai_client._call_gemini", new_callable=AsyncMock) as mock_gemini, \
             patch("app.core.ai_client._call_groq", new_callable=AsyncMock) as mock_groq:
            
            mock_gemini.return_value = "Sorry, I cannot format this as JSON."
            mock_groq.return_value = '{"domain": "Marketing", "confidence": 0.88, "reasoning": "groq success", "column_semantics": {}}'
            
            parsed, provider = await ai_client.generate_json(
                "Sample prompt",
                feature="semantic_context",
                lang="vi",
                required_keys=["domain", "confidence", "reasoning", "column_semantics"]
            )
            
            assert parsed["domain"] == "Marketing"
            assert provider == "groq"
            mock_gemini.assert_called_once()
            mock_groq.assert_called_once()


# ---------------------------------------------------------------------------
# 4. Both fail -> ERR_AI_UNAVAILABLE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_both_fail_raises_err_ai_unavailable():
    with patch.dict(os.environ, {"GEMINI_MOCK": "0", "GEMINI_API_KEY": "fake_gemini", "GROQ_API_KEY": "fake_groq", "GROQ_MODEL": "llama-3"}):
        with patch("app.core.ai_client._call_gemini", side_effect=Exception("503 Service Unavailable")), \
             patch("app.core.ai_client._call_groq", side_effect=Exception("Groq connection timeout")):
            
            # Vietnamese error message check
            with pytest.raises(DataMindException) as exc_info_vi:
                await ai_client.generate_text("Sample prompt", feature="explain", lang="vi")
            
            assert exc_info_vi.value.code == "ERR_AI_UNAVAILABLE"
            assert exc_info_vi.value.user_message == "Hiện chưa sử dụng được AI. Bạn không bị trừ lượt, vui lòng thử lại sau."
            
            # English error message check
            with pytest.raises(DataMindException) as exc_info_en:
                await ai_client.generate_text("Sample prompt", feature="explain", lang="en")
            
            assert exc_info_en.value.code == "ERR_AI_UNAVAILABLE"
            assert exc_info_en.value.user_message == "AI is currently unavailable. Your turns were not deducted, please try again later."


# ---------------------------------------------------------------------------
# 5. Explain endpoint: both fail -> usage unchanged
# ---------------------------------------------------------------------------

def test_explain_endpoint_both_fail_usage_unchanged():
    with patch.dict(os.environ, {"GEMINI_MOCK": "0"}):
        unavailable_exc = DataMindException(
            code="ERR_AI_UNAVAILABLE",
            severity=ErrorSeverity.BLOCKING,
            user_message="Hiện chưa sử dụng được AI. Bạn không bị trừ lượt, vui lòng thử lại sau.",
            technical_detail={"module": "ai_client", "location": "explain", "root_cause": "both providers failed"}
        )

        with patch("app.routers.visualize.check_ai_quota"), \
             patch("app.routers.visualize.cache.get_file_bytes", return_value={"bytes": b"col1,col2\n1,2", "filename": "test.csv", "ext": ".csv"}), \
             patch("app.routers.visualize.cache.get_session_metadata", return_value={"file_hash": "hash123"}), \
             patch("app.routers.visualize.cache.get_profile", return_value={"columns": [{"name": "col1", "detected_type": "numeric"}]}), \
             patch("app.routers.visualize.cache.get_ai_explain_original", return_value=None), \
             patch("app.routers.visualize.cache.get_ai_explain_edited", return_value=None), \
             patch("app.routers.visualize.record_ai_feature_usage") as mock_record_usage:

            resp = client.post(
                "/api/v1/visualize/explain",
                json={
                    "session_id": "test_sess",
                    "chart_type": "bar",
                    "col_x": "col1",
                    "tier": "tier1",
                    "lang": "vi"
                }
            )

            # Response code is 503 (or handled error), code is ERR_AI_UNAVAILABLE
            assert resp.status_code == 503
            assert resp.json()["code"] == "ERR_AI_UNAVAILABLE"
            # Crucial assertion: record_ai_feature_usage (quota deduction) was NEVER called
            mock_record_usage.assert_not_called()


# ---------------------------------------------------------------------------
# 6. Mock mode makes no HTTP calls and returns valid shapes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mock_mode_returns_valid_shapes():
    # 6a. Default mock mode (provider="mock")
    with patch.dict(os.environ, {"GEMINI_MOCK": "1", "APP_ENV": "development", "GEMINI_MOCK_ERROR": ""}):
        with patch("app.core.ai_client._call_gemini") as mock_g, \
             patch("app.core.ai_client._call_groq") as mock_gr:
            
            # Text - explain
            text, provider = await ai_client.generate_text("Prompt", feature="explain", lang="vi")
            assert len(text) > 20
            assert provider == "mock"

            # Text - report_intro
            intro, provider = await ai_client.generate_text("Prompt", feature="report_intro", lang="vi")
            assert len(intro) > 30
            assert provider == "mock"

            # JSON - semantic_context
            parsed, provider = await ai_client.generate_json(
                "Prompt",
                feature="semantic_context",
                lang="vi",
                required_keys=["domain", "confidence", "reasoning", "column_semantics"]
            )
            assert "domain" in parsed
            assert "confidence" in parsed
            assert "reasoning" in parsed
            assert "column_semantics" in parsed
            assert provider == "mock"

            # HTTP calls must be zero
            mock_g.assert_not_called()
            mock_gr.assert_not_called()

    # 6b. Mock mode with GEMINI_MOCK_ERROR=gemini -> fallback mock provider="groq"
    with patch.dict(os.environ, {"GEMINI_MOCK": "1", "APP_ENV": "development", "GEMINI_MOCK_ERROR": "gemini"}):
        text, provider = await ai_client.generate_text("Prompt", feature="explain", lang="vi")
        assert provider == "groq"

    # 6c. Mock mode with GEMINI_MOCK_ERROR=all -> ERR_AI_UNAVAILABLE
    with patch.dict(os.environ, {"GEMINI_MOCK": "1", "APP_ENV": "development", "GEMINI_MOCK_ERROR": "all"}):
        with pytest.raises(DataMindException) as exc_info:
            await ai_client.generate_text("Prompt", feature="explain", lang="vi")
        assert exc_info.value.code == "ERR_AI_UNAVAILABLE"

    # 6d. Refuse mock mode in production
    with patch.dict(os.environ, {"GEMINI_MOCK": "1", "APP_ENV": "production"}):
        with pytest.raises(RuntimeError) as exc_info:
            await ai_client.generate_text("Prompt", feature="explain", lang="vi")
        assert "not allowed when APP_ENV=production" in str(exc_info.value)

