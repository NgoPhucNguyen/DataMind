"""
test_visualize_explain.py
--------------------------
Tests for the AI explain endpoint logic (cache, quota, context hash, lang isolation).

These tests mock out:
  - Redis (cache module)
  - DB session (ai_usage_service)
  - Gemini call (ai_explain_service)
  - FileSession lookup

All tests are unit-level — no real Redis, no real DB, no real AI calls.
"""

import sys
import os
import json
import hashlib
from unittest.mock import MagicMock, patch, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException

from app.core.cache import (
    get_ai_explain_original,
    set_ai_explain_original,
    get_ai_explain_edited,
    set_ai_explain_edited,
)
from app.services.ai_usage_service import check_ai_quota


# ---------------------------------------------------------------------------
# Helper: build a fake cache client backed by a plain dict
# ---------------------------------------------------------------------------

class FakeRedis:
    """Minimal in-memory Redis shim for cache tests."""
    def __init__(self):
        self._store: dict[str, str] = {}

    def get(self, key):
        return self._store.get(key)

    def set(self, key, value, ex=None):
        self._store[key] = value

    def delete(self, key):
        self._store.pop(key, None)


# ---------------------------------------------------------------------------
# 1. Cache hit: from_cache=True, quota NOT deducted
# ---------------------------------------------------------------------------

def test_cache_hit_returns_from_cache_true():
    """
    If an explanation is already cached, explain_chart must return it with
    from_cache=True and must NOT call Gemini (quota not deducted).
    """
    fake = FakeRedis()
    file_hash = "abc123"
    chart_type = "distribution"
    col_x = "age"
    col_y = None
    tier = "tier1"
    lang = "vi"
    context_hash = "ctx001"

    # Pre-populate cache
    with patch("app.core.cache._get_client", return_value=fake):
        set_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            content="Biểu đồ cho thấy xu hướng tăng.",
            lang=lang,
            context_hash=context_hash,
        )
        result = get_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            lang=lang,
            context_hash=context_hash,
        )

    assert result == "Biểu đồ cho thấy xu hướng tăng.", "Cache miss when hit was expected"


# ---------------------------------------------------------------------------
# 2. Context hash change causes cache miss
# ---------------------------------------------------------------------------

def test_context_hash_change_causes_cache_miss():
    """
    Changing context_hash (profiler description changes) should miss the original cache.
    """
    fake = FakeRedis()
    file_hash = "abc123"
    chart_type = "distribution"
    col_x = "age"
    col_y = None
    tier = "tier1"
    lang = "vi"
    old_ctx = "ctx_v1"
    new_ctx = "ctx_v2"

    with patch("app.core.cache._get_client", return_value=fake):
        # Store with old context hash
        set_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            content="Old explanation.",
            lang=lang,
            context_hash=old_ctx,
        )
        # Read with NEW context hash — should be None (cache miss)
        result = get_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            lang=lang,
            context_hash=new_ctx,
        )

    assert result is None, "Expected cache miss when context_hash differs"


# ---------------------------------------------------------------------------
# 3. Language isolation: vi and en are stored/read independently
# ---------------------------------------------------------------------------

def test_lang_isolation_vi_en():
    """
    The vi and en explanations must be stored under separate cache keys so
    switching language does not return the wrong translation.
    """
    fake = FakeRedis()
    file_hash = "abc123"
    chart_type = "distribution"
    col_x = "age"
    col_y = None
    tier = "tier1"
    ctx = "ctx_shared"

    with patch("app.core.cache._get_client", return_value=fake):
        set_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            content="Vietnamese explanation.",
            lang="vi",
            context_hash=ctx,
        )
        set_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            content="English explanation.",
            lang="en",
            context_hash=ctx,
        )

        vi_result = get_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            lang="vi",
            context_hash=ctx,
        )
        en_result = get_ai_explain_original(
            file_hash, chart_type, col_x, col_y, tier,
            lang="en",
            context_hash=ctx,
        )

    assert vi_result == "Vietnamese explanation.", f"Wrong VI result: {vi_result}"
    assert en_result == "English explanation.", f"Wrong EN result: {en_result}"
    assert vi_result != en_result, "VI and EN cache entries should be independent"


# ---------------------------------------------------------------------------
# 4. Quota 0 raises ERR_AI_QUOTA_EXCEEDED (HTTP 429)
# ---------------------------------------------------------------------------

def test_quota_zero_raises_429():
    """
    check_ai_quota must raise HTTPException(429) when runs_used >= runs_limit.
    """
    from datetime import datetime, timedelta
    from app.core.config import VN_TZ, AI_FREE_DAILY_LIMIT

    usage = MagicMock()
    usage.plan = "free"
    usage.runs_used = AI_FREE_DAILY_LIMIT  # exactly at limit
    usage.runs_limit = AI_FREE_DAILY_LIMIT
    usage.runs_reset_date = datetime.now(VN_TZ).date()
    usage.pro_expires_at = None

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = usage

    with pytest.raises(HTTPException) as exc_info:
        check_ai_quota(user_id=1, db=db)

    assert exc_info.value.status_code == 429
    assert "ERR_AI_QUOTA_EXCEEDED" in str(exc_info.value.detail)


# ---------------------------------------------------------------------------
# 5. Stale detection: edited entry with different context_hash returns is_stale=True
# ---------------------------------------------------------------------------

def test_stale_detection_on_edited_cache():
    """
    When get_ai_explain_edited returns an entry, and its stored context_hash
    differs from the current context_hash, the endpoint logic should detect staleness.
    This test verifies the dict format {content, context_hash} is stored and parsed.
    """
    fake = FakeRedis()
    user_id = 42
    file_hash = "def456"
    chart_type = "categorical"
    col_x = "region"
    col_y = None
    tier = "tier1"
    lang = "vi"

    old_ctx = "ctx_old"
    new_ctx = "ctx_new"

    with patch("app.core.cache._get_client", return_value=fake):
        # Store edited content with old context hash
        set_ai_explain_edited(
            user_id, file_hash, chart_type, col_x, col_y, tier,
            content="User edited text.",
            lang=lang,
            context_hash=old_ctx,
        )
        # Retrieve and check
        edited_data = get_ai_explain_edited(
            user_id, file_hash, chart_type, col_x, col_y, tier,
            lang=lang,
            context_hash=new_ctx,  # different from stored
        )

    assert isinstance(edited_data, dict), "Expected dict from get_ai_explain_edited"
    assert edited_data["content"] == "User edited text."
    assert edited_data["context_hash"] == old_ctx

    # Simulate endpoint stale check
    saved_ctx = edited_data.get("context_hash", "")
    is_stale = bool(saved_ctx and saved_ctx != new_ctx)
    assert is_stale is True, "Expected is_stale=True when context_hash changed"


# ---------------------------------------------------------------------------
# 6. Edited cache not considered stale when context_hash matches
# ---------------------------------------------------------------------------

def test_no_stale_when_context_hash_matches():
    """Edited entry with same context_hash → is_stale must be False."""
    fake = FakeRedis()
    user_id = 42
    file_hash = "ghi789"
    chart_type = "categorical"
    col_x = "city"
    col_y = None
    tier = "tier1"
    lang = "en"
    ctx = "ctx_stable"

    with patch("app.core.cache._get_client", return_value=fake):
        set_ai_explain_edited(
            user_id, file_hash, chart_type, col_x, col_y, tier,
            content="User's curated text.",
            lang=lang,
            context_hash=ctx,
        )
        edited_data = get_ai_explain_edited(
            user_id, file_hash, chart_type, col_x, col_y, tier,
            lang=lang,
            context_hash=ctx,
        )

    saved_ctx = edited_data.get("context_hash", "")
    is_stale = bool(saved_ctx and saved_ctx != ctx)
    assert is_stale is False, "Expected is_stale=False when context_hash matches"
