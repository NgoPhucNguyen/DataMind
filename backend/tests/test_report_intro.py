import os
import sys
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.core import cache

# Fake user & test data
MOCK_USER = {"user_id": 999, "email": "test@datamind.vn", "tier": "free"}

def override_get_current_user():
    return MOCK_USER

app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

class MockCacheStore:
    def __init__(self):
        self.store = {}
    def get(self, key):
        return self.store.get(key)
    def set(self, key, value, ex=None):
        self.store[key] = value
    def delete(self, key):
        self.store.pop(key, None)

@pytest.fixture(autouse=True)
def mock_redis():
    mock_store = MockCacheStore()
    with patch("app.core.cache._get_client", return_value=mock_store):
        yield mock_store

def test_get_report_state_never_calls_gemini_or_changes_usage(mock_redis):
    """GET /api/v1/report/state never calls Gemini or changes usage."""
    # Pre-populate some cache
    user_id = 999
    file_hash = "hash123"
    
    # 1. Without cache
    with patch("app.routers.report.generate_report_intro") as mock_gen:
        resp = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
        assert resp.status_code == 200
        data = resp.json()
        assert data["intro"] is None
        assert data["cleaner"] is None
        assert data["context"] is None
        mock_gen.assert_not_called()

    # 2. With cache
    cache.set_report_intro(user_id, file_hash, "vi", {
        "text": "Đoạn giới thiệu báo cáo mẫu.",
        "source": "ai",
        "charts_hash": "abc123456789",
        "generated_at": "2026-11-02T15:00:00Z"
    })
    cache.set_report_section(user_id, file_hash, "cleaner", {
        "clean_mode": "auto",
        "stats": {"duplicate_rows_removed": 5},
        "actions_taken": 2,
        "ignored_cells_count": 0
    })
    cache.set_profiler_context(user_id, file_hash, {
        "description": "Mô tả tập dữ liệu",
        "description_source": "user",
        "semantic_context": {"domain": "E-commerce"}
    })

    with patch("app.routers.report.generate_report_intro") as mock_gen:
        resp = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
        assert resp.status_code == 200
        data = resp.json()
        assert data["intro"]["text"] == "Đoạn giới thiệu báo cáo mẫu."
        assert data["intro"]["source"] == "ai"
        assert data["cleaner"]["clean_mode"] == "auto"
        assert data["context"]["description"] == "Mô tả tập dữ liệu"
        assert data["context"]["domain"] == "E-commerce"
        mock_gen.assert_not_called()

def test_post_report_intro_success_and_cached(mock_redis):
    """POST /api/v1/report/intro success -> usage +1, cached; second GET returns it."""
    file_hash = "hash_succ"
    
    with patch("app.routers.report.generate_report_intro", new_callable=AsyncMock) as mock_gen, \
         patch("app.routers.report.check_ai_quota") as mock_quota, \
         patch("app.routers.report.record_ai_feature_usage") as mock_usage:
        
        mock_gen.return_value = ("Intro được sinh bởi AI chính thức.", False)
        mock_usage.return_value = {"remaining": 5, "used": 1, "limit": 6}

        req_body = {
            "file_hash": file_hash,
            "charts": [{"id": "chart_1"}, {"id": "chart_2"}],
            "lang": "vi"
        }
        resp = client.post("/api/v1/report/intro", json=req_body)
        assert resp.status_code == 200
        body = resp.json()
        assert body["intro"] == "Intro được sinh bởi AI chính thức."
        assert body["is_fallback"] is False
        assert body["charts_hash"] is not None
        assert body["usage"]["used"] == 1
        
        mock_quota.assert_called_once()
        mock_usage.assert_called_once()

    # Second request GET /api/v1/report/state returns the cached intro
    state_resp = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
    assert state_resp.status_code == 200
    state_data = state_resp.json()
    assert state_data["intro"] is not None
    assert state_data["intro"]["text"] == "Intro được sinh bởi AI chính thức."
    assert state_data["intro"]["source"] == "ai"
    assert state_data["intro"]["charts_hash"] == body["charts_hash"]

def test_post_report_intro_fallback_not_cached_no_usage(mock_redis):
    """Fallback -> usage unchanged, not cached."""
    file_hash = "hash_fallback"

    with patch("app.routers.report.generate_report_intro", new_callable=AsyncMock) as mock_gen, \
         patch("app.routers.report.check_ai_quota") as mock_quota, \
         patch("app.routers.report.record_ai_feature_usage") as mock_usage, \
         patch("app.routers.report.get_user_ai_usage_summary") as mock_summary:
        mock_gen.return_value = ("Tập dữ liệu đã được xử lý thành công...", True)

        req_body = {
            "file_hash": file_hash,
            "charts": [{"id": "chart_1"}],
            "lang": "vi"
        }
        resp = client.post("/api/v1/report/intro", json=req_body)
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_fallback"] is True
        
        mock_quota.assert_called_once()
        mock_usage.assert_not_called()

    # GET /api/v1/report/state confirms nothing was cached
    state_resp = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
    assert state_resp.status_code == 200
    assert state_resp.json()["intro"] is None

def test_save_report_intro_get_returns_user_source(mock_redis):
    """save -> GET returns source 'user'."""
    file_hash = "hash_save"

    save_body = {
        "file_hash": file_hash,
        "lang": "vi",
        "text": "Nội dung người dùng tự tay chỉnh sửa lại.",
        "chart_ids": ["chart_a", "chart_b"]
    }
    resp = client.post("/api/v1/report/intro/save", json=save_body)
    assert resp.status_code == 200

    state_resp = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
    assert state_resp.status_code == 200
    intro = state_resp.json()["intro"]
    assert intro is not None
    assert intro["text"] == "Nội dung người dùng tự tay chỉnh sửa lại."
    assert intro["source"] == "user"

def test_lang_en_separate_cache_from_vi(mock_redis):
    """lang en -> separate cache entry from vi."""
    file_hash = "hash_i18n"
    user_id = 999

    cache.set_report_intro(user_id, file_hash, "vi", {
        "text": "Bản tiếng Việt",
        "source": "ai",
        "charts_hash": "vi123",
        "generated_at": "2026-11-02T15:00:00Z"
    })

    cache.set_report_intro(user_id, file_hash, "en", {
        "text": "English version",
        "source": "ai",
        "charts_hash": "en123",
        "generated_at": "2026-11-02T15:00:00Z"
    })

    resp_vi = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=vi")
    resp_en = client.get(f"/api/v1/report/state?file_hash={file_hash}&lang=en")

    assert resp_vi.json()["intro"]["text"] == "Bản tiếng Việt"
    assert resp_en.json()["intro"]["text"] == "English version"


