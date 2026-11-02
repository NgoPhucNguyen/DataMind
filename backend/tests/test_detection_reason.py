"""
test_detection_reason.py
------------------------
Unit and integration tests for detection_reason explainability and metadata endpoints:
 - For each case in test_profiler_types.py, rule_id is the expected one and the last check has passed=True.
 - categorical ["A","B","A"]: checks include unique_count 2 <= 15.
 - "16 unique strings" -> text_fallback with unique_count 16 > 15.
 - /meta/classify returns same type as profile_dataframe; >200 values -> 422.
 - /meta/rules contains categorical threshold 15 and ai free limit from config.
 - Existing tests still pass.
"""

import os
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-chars-long-123456"

import pytest
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_user
from app.services.profiler_service import profile_dataframe
from app.core.rules import CATEGORICAL_UNIQUE_THRESHOLD, AI_FREE_DAILY_LIMIT


@pytest.fixture
def client():
    # Override auth dependency
    app.dependency_overrides[get_current_user] = lambda: {"user_id": 999, "email": "test@datamind.vn", "tier": "pro"}
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_rule_id_and_last_check_passed():
    test_cases = [
        ("bool_native", pd.DataFrame({"col": [True, False, True]}), "categorical", "native_bool"),
        ("bool_str", pd.DataFrame({"col": ["true", "false", "true"]}), "categorical", "bool_strings"),
        ("curr", pd.DataFrame({"col": ["100,000 VND", "250,000 VND", "1,200,000 VND"]}), "numeric", "disguised_numeric"),
        ("neg", pd.DataFrame({"col": ["(2,500)", "3,000", "4,500"]}), "numeric", "disguised_numeric"),
        ("mc_txt", pd.DataFrame({"col": ["Đỏ, Xanh", "Vàng", "Đỏ, Vàng"]}), "multiple_choice", "multiple_choice"),
        ("mc_num", pd.DataFrame({"col": ["1, 2", "2, 3", "1"]}), "multiple_choice", "multiple_choice"),
        ("cat", pd.DataFrame({"col": ["Hà Nội", "Đà Nẵng", "Hà Nội"]}), "categorical", "categorical_repeats"),
        ("text_16", pd.DataFrame({"col": [f"item_{i}" for i in range(16)]}), "text", "text_fallback"),
    ]

    for name, df, expected_type, expected_rule in test_cases:
        res = profile_dataframe(df)[0]
        assert res["detected_type"] == expected_type, f"Failed type for {name}"
        reason = res["detection_reason"]
        assert reason is not None
        assert reason["rule_id"] == expected_rule, f"Failed rule_id for {name}: got {reason['rule_id']}"
        checks = reason["checks"]
        assert len(checks) > 0
        assert checks[-1]["passed"] is True, f"Last check did not pass for {name}"


def test_categorical_checks_include_unique_count():
    df = pd.DataFrame({"col": ["A", "B", "A"]})
    res = profile_dataframe(df)[0]
    reason = res["detection_reason"]
    assert reason["rule_id"] == "categorical_repeats"
    matching_checks = [
        c for c in reason["checks"]
        if c["check"] == "unique_count" and c["value"] == 2 and c["threshold"] == 15 and c["passed"] is True
    ]
    assert len(matching_checks) == 1
    repeats_checks = [
        c for c in reason["checks"]
        if c["check"] == "has_repeats" and c["value"] == 1 and c["threshold"] == 0 and c["passed"] is True
    ]
    assert len(repeats_checks) == 1


def test_16_unique_strings_text_fallback():
    df = pd.DataFrame({"col": [f"item_{i}" for i in range(16)]})
    res = profile_dataframe(df)[0]
    reason = res["detection_reason"]
    assert reason["rule_id"] == "text_fallback"
    fallback_checks = [
        c for c in reason["checks"]
        if c["check"] == "text_fallback" and c["value"] == 16 and c["threshold"] == 15 and c["passed"] is True
    ]
    assert len(fallback_checks) == 1


def test_meta_rules_endpoint(client):
    res = client.get("/api/v1/meta/rules")
    assert res.status_code == 200
    data = res.json()
    assert "profiler" in data
    assert "cleaner" in data
    assert "session" in data
    assert "ai" in data
    assert data["profiler"]["categorical_unique_threshold"]["value"] == 15
    assert data["ai"]["free_daily_limit"]["value"] == AI_FREE_DAILY_LIMIT


def test_meta_classify_endpoint_success(client):
    values = ["100,000 VND", "200,000 VND", "300,000 VND"]
    res = client.post("/api/v1/meta/classify", json={"values": values})
    assert res.status_code == 200
    data = res.json()
    assert data["detected_type"] == "numeric"
    assert data["detection_reason"]["rule_id"] == "disguised_numeric"

    # Compare with profile_dataframe directly
    direct = profile_dataframe(pd.DataFrame({"col": values}))[0]
    assert data["detected_type"] == direct["detected_type"]
    assert data["detection_reason"]["rule_id"] == direct["detection_reason"]["rule_id"]


def test_meta_classify_over_200_values_422(client):
    values = [f"val_{i}" for i in range(201)]
    res = client.post("/api/v1/meta/classify", json={"values": values})
    assert res.status_code == 422

