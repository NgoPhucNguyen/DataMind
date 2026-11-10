import os
import sys
import json
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core import cache
from app.routers.report import (
    save_report_methodology,
    save_report_text,
    get_report_state,
    SaveReportMethodologyRequest,
    SaveReportTextRequest,
    compute_charts_hash,
    get_stable_chart_id,
)
from pydantic import ValidationError
import pandas as pd
from app.services.visualize_service import compute_statistics_df

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

def test_save_methodology_and_get_state(mock_redis):
    """a) save then GET /report/state returns the text with source 'user'."""
    user = {"user_id": 101, "email": "userA@datamind.vn", "tier": "free"}
    file_hash = "test_file_hash_1"

    # Pre-populate cleaner section to test cleaning_hash linkage
    cache.set_report_section(101, file_hash, "cleaner", {
        "clean_mode": "auto",
        "actions_taken": [{"action": "drop_duplicates", "column": "all"}]
    })

    req = SaveReportMethodologyRequest(
        file_hash=file_hash,
        text="Phương pháp xử lý dữ liệu: Loại bỏ trùng lặp và làm sạch định dạng ngày."
    )
    save_res = save_report_methodology(req, current_user=user)
    assert save_res["data"] is not None
    assert save_res["data"]["text"] == req.text
    assert save_res["data"]["source"] == "user"
    assert save_res["data"]["cleaning_hash"] is not None

    # Call get_report_state
    state = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state["methodology"] is not None
    assert state["methodology"]["text"] == req.text
    assert state["methodology"]["source"] == "user"
    assert state["methodology"]["cleaning_hash"] == save_res["data"]["cleaning_hash"]
    assert state["cleaning_hash"] == save_res["data"]["cleaning_hash"]

def test_save_empty_methodology_resets_to_null(mock_redis):
    """b) save empty text -> methodology null (reverts to auto text)."""
    user = {"user_id": 101, "email": "userA@datamind.vn", "tier": "free"}
    file_hash = "test_file_hash_2"

    # Save initial text
    req1 = SaveReportMethodologyRequest(file_hash=file_hash, text="Bản sửa ban đầu của người dùng.")
    save_report_methodology(req1, current_user=user)
    state_before = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state_before["methodology"] is not None

    # Save empty string
    req_empty = SaveReportMethodologyRequest(file_hash=file_hash, text="")
    res_empty = save_report_methodology(req_empty, current_user=user)
    assert res_empty["data"] is None

    # State now returns methodology: null
    state_after = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state_after["methodology"] is None

    # Also test whitespace-only text
    save_report_methodology(SaveReportMethodologyRequest(file_hash=file_hash, text="Nội dung tạm"), current_user=user)
    save_report_methodology(SaveReportMethodologyRequest(file_hash=file_hash, text="   \n\t  "), current_user=user)
    state_after_ws = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state_after_ws["methodology"] is None

def test_charts_hash_stability():
    """
    c) charts_hash:
       - same ids different titles -> same hash
       - reordered -> same hash
       - one chart added -> different hash
       - stable id fallback when id missing -> derived from type + column (+ col_y)
    """
    charts_base = [
        {"chart_id": "cid_revenue", "user_title": "Doanh thu năm 2026", "type": "bar"},
        {"chart_id": "cid_cost", "user_title": "Chi phí vận hành", "type": "line"},
    ]

    # Renaming user_title must NOT change hash
    charts_renamed = [
        {"chart_id": "cid_revenue", "user_title": "Tên hoàn toàn mới", "type": "bar"},
        {"chart_id": "cid_cost", "user_title": "Chi phí đã đổi tên", "type": "line"},
    ]
    hash_base = compute_charts_hash(charts_base)
    hash_renamed = compute_charts_hash(charts_renamed)
    assert hash_base == hash_renamed

    # Reordering must NOT change hash
    charts_reordered = [charts_base[1], charts_base[0]]
    assert compute_charts_hash(charts_reordered) == hash_base

    # Adding a chart MUST change hash
    charts_added = charts_base + [{"chart_id": "cid_profit", "type": "bar", "user_title": "Lợi nhuận"}]
    assert compute_charts_hash(charts_added) != hash_base

    # Missing chart_id/id falls back to type + column
    charts_no_id_1 = [
        {"type": "bar", "column": "department", "user_title": "Phòng ban"},
        {"type": "scatter", "col_x": "age", "col_y": "salary", "user_title": "Tuổi vs Lương"}
    ]
    charts_no_id_2 = [
        {"type": "bar", "column": "department", "user_title": "Tiêu đề đã sửa"},
        {"type": "scatter", "col_x": "age", "col_y": "salary", "user_title": "Tiêu đề khác"}
    ]
    assert compute_charts_hash(charts_no_id_1) == compute_charts_hash(charts_no_id_2)

def test_methodology_user_isolation(mock_redis):
    """
    d) ownership: another user cannot save to or overwrite this file_hash for user A
       (same scoped isolation check as intro save).
    """
    user_a = {"user_id": 101, "email": "userA@datamind.vn", "tier": "free"}
    user_b = {"user_id": 202, "email": "userB@datamind.vn", "tier": "free"}
    file_hash = "shared_file_123"

    # User A (user_id=101) saves methodology
    save_report_methodology(
        SaveReportMethodologyRequest(file_hash=file_hash, text="Bản ghi chép riêng của User 101."),
        current_user=user_a
    )

    # User B (user_id=202) accesses state -> does not see User A's methodology
    state_b = get_report_state(file_hash=file_hash, lang="vi", current_user=user_b)
    assert state_b["methodology"] is None

    # User B saves their own methodology
    save_report_methodology(
        SaveReportMethodologyRequest(file_hash=file_hash, text="Bản ghi chép riêng của User 202."),
        current_user=user_b
    )
    state_b_after = get_report_state(file_hash=file_hash, lang="vi", current_user=user_b)
    assert state_b_after["methodology"]["text"] == "Bản ghi chép riêng của User 202."

    # User A accesses state again -> User A's data remains untouched
    state_a_final = get_report_state(file_hash=file_hash, lang="vi", current_user=user_a)
    assert state_a_final["methodology"]["text"] == "Bản ghi chép riêng của User 101."

def test_save_key_findings_and_get_state(mock_redis):
    """Test save_report_text with section='key_findings', retrieval in get_report_state, and deletion."""
    user = {"user_id": 101, "email": "userA@datamind.vn", "tier": "free"}
    file_hash = "test_key_findings_hash"

    charts = [
        {"chart_id": "chart_1", "type": "bar", "column": "col_a"},
        {"chart_id": "chart_2", "type": "pie", "column": "col_b"},
    ]
    expected_charts_hash = compute_charts_hash(charts)

    # 1. Save key_findings
    req = SaveReportTextRequest(
        file_hash=file_hash,
        section="key_findings",
        text="• Doanh thu tăng trưởng mạnh mẽ ở Q4.",
        chart_ids=charts,
    )
    res = save_report_text(req, current_user=user)
    assert res["data"] is not None
    assert res["data"]["text"] == req.text
    assert res["data"]["source"] == "user"
    assert res["data"]["charts_hash"] == expected_charts_hash
    assert "updated_at" in res["data"]

    # 2. Get state returns key_findings
    state = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state["key_findings"] is not None
    assert state["key_findings"]["text"] == req.text
    assert state["key_findings"]["charts_hash"] == expected_charts_hash

    # 3. Empty text deletes key_findings (reverting to auto)
    req_del = SaveReportTextRequest(
        file_hash=file_hash,
        section="key_findings",
        text="",
    )
    del_res = save_report_text(req_del, current_user=user)
    assert del_res["data"] is None

    state_after = get_report_state(file_hash=file_hash, lang="vi", current_user=user)
    assert state_after["key_findings"] is None

def test_save_text_invalid_section_raises_validation_error():
    """Test that an invalid section raises ValidationError (FastAPI translates to 422)."""
    with pytest.raises(ValidationError):
        SaveReportTextRequest(
            file_hash="hash_abc",
            section="invalid_section",
            text="Some text",
        )

def test_summary_columns_have_letter():
    """Test that visualize summary includes 'letter' on every column entry."""
    df = pd.DataFrame({
        "Age": [25, 30, 35, 40],
        "Gender": ["M", "F", "M", "F"],
        "Income": [5000, 6000, 7000, 8000],
    })
    summary = compute_statistics_df(df)
    assert "columns" in summary
    assert "Age" in summary["columns"]
    assert summary["columns"]["Age"].get("letter") == "A"
    assert summary["columns"]["Gender"].get("letter") == "B"
    assert summary["columns"]["Income"].get("letter") == "C"

