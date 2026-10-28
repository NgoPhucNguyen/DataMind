"""
test_ai_usage_and_profiler.py
------------------------------
Unit tests for:
  1. Config defaults: Free=2, Pro=20 daily limits.
  2. check_ai_quota: blocks at limit with ERR_AI_QUOTA_EXCEEDED (HTTP 429).
  3. record_ai_feature_usage: increments usage and returns updated summary.
  4. get_feature_breakdown: returns correct per-feature counts.
  5. set_profiler_context / get_profiler_context: round-trip via Redis mock.
  6. set_ai_explain_original: keys are strictly isolated by lang.
"""

import sys
import os
import json
from unittest.mock import MagicMock, patch, call
from datetime import datetime, date, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi import HTTPException

from app.core.config import AI_FREE_DAILY_LIMIT, AI_PRO_DAILY_LIMIT, VN_TZ
from app.services.ai_usage_service import (
    check_ai_quota,
    record_ai_feature_usage,
    get_feature_breakdown,
    get_user_ai_usage_summary,
    refresh_usage,
)
from app.core.cache import (
    set_profiler_context,
    get_profiler_context,
    set_ai_explain_original,
    get_ai_explain_original,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_usage(user_id=1, plan="free", runs_used=0, runs_limit=None, runs_reset_date=None):
    """Build a mock UserAIUsage-like object."""
    usage = MagicMock()
    usage.user_id = user_id
    usage.plan = plan
    usage.runs_used = runs_used
    usage.runs_limit = runs_limit if runs_limit is not None else (
        AI_FREE_DAILY_LIMIT if plan == "free" else AI_PRO_DAILY_LIMIT
    )
    usage.runs_reset_date = runs_reset_date or datetime.now(VN_TZ).date()
    # Pro users need a future expiry so refresh_usage() doesn't downgrade them to free
    if plan == "pro":
        usage.pro_expires_at = datetime.utcnow() + timedelta(days=30)
    else:
        usage.pro_expires_at = None
    return usage


def _make_db(usage_obj=None):
    """Build a mock SQLAlchemy Session."""
    db = MagicMock()
    chain = db.query.return_value.filter.return_value
    chain.with_for_update.return_value.first.return_value = usage_obj
    chain.first.return_value = usage_obj
    return db


# ---------------------------------------------------------------------------
# 1. Config defaults
# ---------------------------------------------------------------------------

class TestConfigDefaults:
    def test_free_limit_is_2(self):
        assert AI_FREE_DAILY_LIMIT == 2, f"Expected 2, got {AI_FREE_DAILY_LIMIT}"

    def test_pro_limit_is_20(self):
        assert AI_PRO_DAILY_LIMIT == 20, f"Expected 20, got {AI_PRO_DAILY_LIMIT}"


# ---------------------------------------------------------------------------
# 2. check_ai_quota
# ---------------------------------------------------------------------------

class TestCheckAIQuota:
    def test_free_user_under_limit_passes(self):
        usage = _make_usage(user_id=1, plan="free", runs_used=0, runs_limit=2)
        db = _make_db(usage)
        result = check_ai_quota(user_id=1, db=db)
        assert result is usage

    def test_free_user_at_limit_raises_429(self):
        usage = _make_usage(user_id=2, plan="free", runs_used=2, runs_limit=2)
        db = _make_db(usage)
        with pytest.raises(HTTPException) as exc_info:
            check_ai_quota(user_id=2, db=db)
        err = exc_info.value
        assert err.status_code == 429
        assert err.detail["code"] == "ERR_AI_QUOTA_EXCEEDED"
        assert err.detail["is_pro"] is False
        assert "reset_at" in err.detail

    def test_pro_user_at_limit_raises_429(self):
        usage = _make_usage(user_id=3, plan="pro", runs_used=20, runs_limit=20)
        db = _make_db(usage)
        with pytest.raises(HTTPException) as exc_info:
            check_ai_quota(user_id=3, db=db)
        err = exc_info.value
        assert err.status_code == 429
        assert err.detail["code"] == "ERR_AI_QUOTA_EXCEEDED"
        assert err.detail["is_pro"] is True

    def test_pro_user_one_run_remaining_passes(self):
        usage = _make_usage(user_id=4, plan="pro", runs_used=19, runs_limit=20)
        db = _make_db(usage)
        result = check_ai_quota(user_id=4, db=db)
        assert result is usage

    def test_new_user_gets_free_limit(self):
        """When no usage row exists, a new one is created with FREE limit."""
        db = MagicMock()
        # Simulate no existing row
        chain = db.query.return_value.filter.return_value
        chain.with_for_update.return_value.first.return_value = None

        # After add + flush, the new usage is used — we need to intercept db.add
        new_usage_holder = {}

        def capture_add(obj):
            new_usage_holder["obj"] = obj
            # Simulate the new object having correct defaults
            obj.plan = "free"
            obj.runs_used = 0
            obj.runs_limit = AI_FREE_DAILY_LIMIT
            obj.runs_reset_date = datetime.now(VN_TZ).date()
            obj.pro_expires_at = None

        db.add.side_effect = capture_add

        result = check_ai_quota(user_id=99, db=db)
        assert result.runs_limit == 2


# ---------------------------------------------------------------------------
# 3. record_ai_feature_usage
# ---------------------------------------------------------------------------

class TestRecordAIFeatureUsage:
    def test_adds_usage_record(self):
        usage = _make_usage(user_id=10, plan="free", runs_used=0, runs_limit=2)
        db = _make_db(usage)

        # record_ai_feature_usage calls get_user_ai_usage_summary at end
        # Patch it to avoid another DB chain
        with patch(
            "app.services.ai_usage_service.get_user_ai_usage_summary",
            return_value={"remaining": 1, "limit": 2, "used": 1, "reset_at": "x", "is_pro": False, "breakdown": {}}
        ):
            result = record_ai_feature_usage(db=db, user_id=10, feature="profiler")

        # db.add should have been called at least once (AIUsageRecord + AIUsageLog = 2)
        assert db.add.call_count >= 1
        assert result["remaining"] == 1

    def test_increments_runs_used(self):
        usage = _make_usage(user_id=11, plan="free", runs_used=1, runs_limit=2)
        db = _make_db(usage)

        with patch(
            "app.services.ai_usage_service.get_user_ai_usage_summary",
            return_value={"remaining": 0, "limit": 2, "used": 2, "reset_at": "x", "is_pro": False, "breakdown": {}}
        ):
            result = record_ai_feature_usage(db=db, user_id=11, feature="explain")

        # usage.runs_used should have been incremented
        assert usage.runs_used == 2
        assert result["used"] == 2


# ---------------------------------------------------------------------------
# 4. get_feature_breakdown
# ---------------------------------------------------------------------------

class TestGetFeatureBreakdown:
    def test_returns_dict_with_all_keys(self):
        db = MagicMock()
        mock_rows = [
            ("profiler", 1),
            ("reanalyze", 2),
            ("explain", 3),
        ]
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = mock_rows

        result = get_feature_breakdown(db=db, user_id=5)

        assert result["profiler"] == 1
        assert result["reanalyze"] == 2
        assert result["explain"] == 3
        # Key not in rows defaults to 0
        assert result.get("re_explain", 0) == 0

    def test_empty_rows_returns_zeros(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []

        result = get_feature_breakdown(db=db, user_id=6)
        assert result["profiler"] == 0
        assert result["explain"] == 0


# ---------------------------------------------------------------------------
# 5. Profiler context cache (Redis mock)
# ---------------------------------------------------------------------------

class TestProfilerContextCache:
    DUMMY_CTX = {
        "domain": "E-Commerce",
        "description": "User description of sales data",
        "description_source": "ai_draft",
        "column_semantics": {"order_id": "CODE_ID"},
        "updated_at": "2026-10-23T15:00:00Z",
    }

    def test_set_uses_correct_key_and_ttl(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis

            set_profiler_context(user_id=1, file_hash="hash123", data=self.DUMMY_CTX)

            mock_redis.set.assert_called_once()
            args, kwargs = mock_redis.set.call_args
            assert args[0] == "profiler_ctx:1:hash123"
            assert json.loads(args[1])["domain"] == "E-Commerce"
            assert kwargs.get("ex") == 86400  # 24h TTL

    def test_get_returns_parsed_json(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis
            mock_redis.get.return_value = json.dumps(self.DUMMY_CTX)

            result = get_profiler_context(user_id=1, file_hash="hash123")

            mock_redis.get.assert_called_once_with("profiler_ctx:1:hash123")
            assert result["domain"] == "E-Commerce"
            assert result["description_source"] == "ai_draft"

    def test_get_returns_none_on_cache_miss(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis
            mock_redis.get.return_value = None

            result = get_profiler_context(user_id=1, file_hash="missing")
            assert result is None


# ---------------------------------------------------------------------------
# 6. Multilingual explain cache key isolation
# ---------------------------------------------------------------------------

class TestMultilingualExplainCache:
    COMMON = dict(file_hash="fileA", chart_type="bar", col_x="category", col_y="revenue", tier="free")

    def _get_set_key(self, mock_redis):
        """Extract the Redis key used in the last .set() call."""
        args, _ = mock_redis.set.call_args
        return args[0]

    def test_vi_key_format(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis

            set_ai_explain_original(**self.COMMON, content="Phân tích doanh thu", lang="vi")

            key = self._get_set_key(mock_redis)
            assert key == "ai_explain:original:vi:fileA:bar:category:revenue:free"

    def test_en_key_format(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis

            set_ai_explain_original(**self.COMMON, content="Revenue analysis", lang="en")

            key = self._get_set_key(mock_redis)
            assert key == "ai_explain:original:en:fileA:bar:category:revenue:free"

    def test_vi_and_en_keys_differ(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis

            set_ai_explain_original(**self.COMMON, content="VI content", lang="vi")
            vi_key = self._get_set_key(mock_redis)

            set_ai_explain_original(**self.COMMON, content="EN content", lang="en")
            en_key = self._get_set_key(mock_redis)

            assert vi_key != en_key

    def test_get_uses_correct_lang_key(self):
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis
            mock_redis.get.return_value = "cached VI text"

            result = get_ai_explain_original(**self.COMMON, lang="vi")

            mock_redis.get.assert_called_once_with(
                "ai_explain:original:vi:fileA:bar:category:revenue:free"
            )
            assert result == "cached VI text"

    def test_vi_cache_miss_when_only_en_cached(self):
        """If VI is not cached but EN is, get_ai_explain_original(lang='vi') must return None."""
        with patch("app.core.cache._get_client") as mock_get:
            mock_redis = MagicMock()
            mock_get.return_value = mock_redis

            # Simulate: only EN key returns a value
            def fake_get(key):
                return "EN cached text" if ":en:" in key else None

            mock_redis.get.side_effect = fake_get

            vi_result = get_ai_explain_original(**self.COMMON, lang="vi")
            en_result = get_ai_explain_original(**self.COMMON, lang="en")

            assert vi_result is None
            assert en_result == "EN cached text"
