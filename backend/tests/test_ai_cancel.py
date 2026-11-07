"""
backend/tests/test_ai_cancel.py
-------------------------------
Tests for AI request cancellation:
- Disconnected request: usage unchanged and nothing cached, logs 'ai.cancelled feature=...'
- Normal request: usage recorded (+1) and result cached
"""

import os
import sys
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-0123456789abcdef")

from app.routers.files import analyze_ai_context, AIContextRequest
from app.routers.visualize import explain_chart, ExplainRequest
from app.routers.report import get_report_intro, ReportIntroRequest
from app.core.limiter import limiter


@pytest.mark.asyncio
async def test_ai_context_disconnected_no_usage_no_cache():
    """Khi client ngắt kết nối (abort), không ghi nhận usage và không lưu cache."""
    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=True)

    mock_user = {"user_id": 123, "email": "user@test.vn"}
    mock_db = MagicMock()
    body = AIContextRequest(file_hash="dummy_hash_1", lang="vi", is_reanalyze=False)

    profile_dummy = {"columns": [{"name": "col_a"}], "file_hash": "dummy_hash_1"}
    semantic_dummy = {
        "domain": "E-commerce",
        "confidence": 0.88,
        "reasoning": "Reason text",
        "draft_summary": "Draft summary text",
        "column_semantics": {"col_a": {"semantic_type": "GENERAL_TEXT", "confidence": 0.9}},
    }

    with patch("app.routers.files.check_ai_quota"), \
         patch("app.routers.files.cache.get_profile", return_value=profile_dummy), \
         patch("app.routers.files.cache.set_profile") as mock_set_profile, \
         patch("app.routers.files.cache.set_profiler_context") as mock_set_profiler_ctx, \
         patch("app.routers.files.llm_service.get_semantic_context", new_callable=AsyncMock, return_value=semantic_dummy), \
         patch("app.routers.files.record_ai_feature_usage") as mock_record_usage, \
         patch("app.routers.files.logger.info") as mock_logger_info:

        response = await analyze_ai_context(
            request=mock_request,
            body=body,
            current_user=mock_user,
            db=mock_db
        )

        # 1. Không ghi nhận usage
        mock_record_usage.assert_not_called()

        # 2. Không lưu cache
        mock_set_profile.assert_not_called()
        mock_set_profiler_ctx.assert_not_called()

        # 3. Log ai.cancelled
        mock_logger_info.assert_called_with("ai.cancelled feature=profiler")

        # 4. Trả về response 499
        assert response.status_code == 499


@pytest.mark.asyncio
async def test_ai_context_normal_records_usage_and_cache():
    """Khi kết nối bình thường, ghi nhận usage và lưu cache."""
    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=False)

    mock_user = {"user_id": 123, "email": "user@test.vn"}
    mock_db = MagicMock()
    body = AIContextRequest(file_hash="dummy_hash_2", lang="vi", is_reanalyze=False)

    profile_dummy = {"columns": [{"name": "col_b"}], "file_hash": "dummy_hash_2"}
    semantic_dummy = {
        "domain": "Finance",
        "confidence": 0.95,
        "reasoning": "Finance reasoning",
        "draft_summary": "Finance summary",
        "column_semantics": {"col_b": {"semantic_type": "GENERAL_TEXT", "confidence": 0.9}},
    }

    with patch("app.routers.files.check_ai_quota"), \
         patch("app.routers.files.cache.get_profile", return_value=profile_dummy), \
         patch("app.routers.files.cache.set_profile") as mock_set_profile, \
         patch("app.routers.files.cache.set_profiler_context") as mock_set_profiler_ctx, \
         patch("app.routers.files.cache.set_dataset_context_md"), \
         patch("app.routers.files.cache.set_user_context"), \
         patch("app.routers.files.llm_service.get_semantic_context", new_callable=AsyncMock, return_value=semantic_dummy), \
         patch("app.routers.files.record_ai_feature_usage", return_value={"remaining": 9, "limit": 10}) as mock_record_usage:

        res = await analyze_ai_context(
            request=mock_request,
            body=body,
            current_user=mock_user,
            db=mock_db
        )

        # 1. Ghi nhận usage
        mock_record_usage.assert_called_once_with(mock_db, 123, "profiler")

        # 2. Đã lưu cache
        mock_set_profile.assert_called_once()
        mock_set_profiler_ctx.assert_called_once()
        assert res["semantic_context"]["domain"] == "Finance"


@pytest.mark.asyncio
async def test_explain_chart_disconnected_no_usage_no_cache():
    """AI Explain bị hủy -> Không trừ lượt, không lưu cache, log cancel."""
    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=True)

    mock_user = {"user_id": 456}
    mock_db = MagicMock()
    body = ExplainRequest(
        session_id="session_123",
        chart_type="bar",
        col_x="category",
        col_y="sales",
        tier="tier1",
        is_reanalyze=False
    )

    with patch("app.routers.visualize.check_ai_quota"), \
         patch("app.routers.visualize.cache.get_session_metadata", return_value={"file_hash": "h_1"}), \
         patch("app.routers.visualize.cache.get_all_report_sections", return_value={}), \
         patch("app.routers.visualize.cache.get_file_bytes", return_value={"bytes": b"mock_csv_data"}), \
         patch("app.routers.visualize.cache.get_ai_explain_edited", return_value=None), \
         patch("app.routers.visualize.cache.get_ai_explain_original", return_value=None), \
         patch("app.routers.visualize.cache.get_dataset_context_md", return_value=""), \
         patch("app.routers.visualize.visualize_service.compute_statistics", return_value={"columns": {}}), \
         patch("app.services.ai_explain_service.call_gemini_explain", new_callable=AsyncMock, return_value="AI explanation"), \
         patch("app.routers.visualize.record_ai_feature_usage") as mock_record_usage, \
         patch("app.routers.visualize.cache.set_ai_explain_original") as mock_set_cache, \
         patch("app.routers.visualize.logger.info") as mock_logger_info:

        response = await explain_chart(
            request=mock_request,
            body=body,
            current_user=mock_user,
            db=mock_db
        )

        mock_record_usage.assert_not_called()
        mock_set_cache.assert_not_called()
        mock_logger_info.assert_called_with("ai.cancelled feature=explain")
        assert response.status_code == 499


@pytest.mark.asyncio
async def test_report_intro_disconnected_no_usage_no_cache():
    """Report Intro bị hủy -> Không trừ lượt, không lưu cache, log cancel."""
    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=True)

    mock_user = {"user_id": 789}
    mock_db = MagicMock()
    body = ReportIntroRequest(
        file_hash="fh_123",
        file_name="data.csv",
        row_count=100,
        col_count=5,
        dataset_schema=[],
        charts=[]
    )

    with patch.object(limiter, "enabled", False), \
         patch("app.routers.report.check_ai_quota"), \
         patch("app.routers.report.cache.get_all_report_sections", return_value=None), \
         patch("app.routers.report.generate_report_intro", new_callable=AsyncMock, return_value=("Generated intro text", False)), \
         patch("app.routers.report.record_ai_feature_usage") as mock_record_usage, \
         patch("app.routers.report.cache.set_report_intro") as mock_set_cache, \
         patch("app.routers.report.logger.info") as mock_logger_info:

        response = await get_report_intro(
            request=mock_request,
            body=body,
            current_user=mock_user,
            db=mock_db
        )

        mock_record_usage.assert_not_called()
        mock_set_cache.assert_not_called()
        mock_logger_info.assert_called_with("ai.cancelled feature=report_intro")
        assert response.status_code == 499

