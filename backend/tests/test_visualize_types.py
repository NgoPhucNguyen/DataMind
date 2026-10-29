import io
import asyncio
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services import visualize_service
from app.services import chart_insights
from app.core.errors import DataMindException


def _make_csv_bytes(df: pd.DataFrame) -> dict:
    csv_buf = io.BytesIO()
    df.to_csv(csv_buf, index=False)
    return {"bytes": csv_buf.getvalue(), "ext": ".csv"}


# ---------------------------------------------------------------------------
# 1. Multiple Choice Aggregation
# ---------------------------------------------------------------------------
def test_multiple_choice_aggregation():
    """
    Test multiple_choice ["A, B", "B, C", "A"]:
    - Respondents = 3
    - Total tokens = 5
    - avg_choices = 1.7
    - A: 2 (66.67%), B: 2 (66.67%), C: 1 (33.33%)
    """
    df = pd.DataFrame({
        "survey": ["A, B", "B, C", "A"]
    })
    cached_file = _make_csv_bytes(df)
    user_id = 1
    session_id = "sess_mc_123"
    file_hash = "hash_mc_123"

    session_meta = {"file_hash": file_hash}
    profile_data = {
        "columns": [
            {"name": "survey", "detected_type": "multiple_choice"}
        ]
    }

    with patch("app.core.cache.get_file_bytes", return_value=cached_file), \
         patch("app.core.cache.get_session_metadata", return_value=session_meta), \
         patch("app.core.cache.get_cleaning_log", return_value=[]), \
         patch("app.core.cache.get_profile", return_value=profile_data):
        
        result = visualize_service.compute_statistics(user_id, session_id)

    assert "columns" in result
    assert "survey" in result["columns"]
    col = result["columns"]["survey"]

    assert col["dtype"] == "multiple_choice"
    assert col["respondents"] == 3
    assert col["avg_choices"] == 1.7

    top_values = {v["value"]: (v["count"], v["pct"]) for v in col["top_values"]}
    assert top_values["A"] == (2, 66.67)
    assert top_values["B"] == (2, 66.67)
    assert top_values["C"] == (1, 33.33)


# ---------------------------------------------------------------------------
# 2. Override Categorical -> Text Drops/Marks Skipped
# ---------------------------------------------------------------------------
def test_override_categorical_to_text_marks_skipped():
    """
    Overriding a categorical column to 'text' should mark skip_chart=True
    with skip_reason='free_text'.
    """
    df = pd.DataFrame({
        "status": ["active", "inactive", "pending", "active"]
    })
    cached_file = _make_csv_bytes(df)
    user_id = 1
    session_id = "sess_override_123"
    file_hash = "hash_override_123"

    session_meta = {"file_hash": file_hash}
    profile_data = {
        "columns": [
            {"name": "status", "detected_type": "categorical"}
        ]
    }

    with patch("app.core.cache.get_file_bytes", return_value=cached_file), \
         patch("app.core.cache.get_session_metadata", return_value=session_meta), \
         patch("app.core.cache.get_cleaning_log", return_value=[]), \
         patch("app.core.cache.get_profile", return_value=profile_data):
        
        result = visualize_service.compute_statistics(
            user_id, session_id, overridden_types={"status": "text"}
        )

    col = result["columns"]["status"]
    assert col["dtype"] == "text"
    assert col["skip_chart"] is True
    assert col["skip_reason"] == "free_text"


# ---------------------------------------------------------------------------
# 3. 15 Categories -> Top 10 + __other__ with other_n: 5
# ---------------------------------------------------------------------------
def test_15_categories_top_10_plus_other():
    """
    A categorical column with 15 unique categories should return 10 top values
    plus a 11th '__other__' entry with other_n: 5 and aggregated count/pct.
    all_values should contain all 15 items.
    """
    # Create 15 categories with descending counts: cat_0 has 15 rows, cat_14 has 1 row
    rows = []
    for i in range(15):
        rows.extend([f"cat_{i:02d}"] * (15 - i))
    
    df = pd.DataFrame({"category": rows})
    total_rows = len(rows)
    cached_file = _make_csv_bytes(df)
    user_id = 1
    session_id = "sess_cat15_123"
    file_hash = "hash_cat15_123"

    session_meta = {"file_hash": file_hash}
    profile_data = {
        "columns": [
            {"name": "category", "detected_type": "categorical"}
        ]
    }

    with patch("app.core.cache.get_file_bytes", return_value=cached_file), \
         patch("app.core.cache.get_session_metadata", return_value=session_meta), \
         patch("app.core.cache.get_cleaning_log", return_value=[]), \
         patch("app.core.cache.get_profile", return_value=profile_data):
        
        result = visualize_service.compute_statistics(user_id, session_id)

    col = result["columns"]["category"]
    assert col["dtype"] == "categorical"
    assert len(col["top_values"]) == 11
    assert len(col["all_values"]) == 15

    other_item = col["top_values"][-1]
    assert other_item["value"] == "__other__"
    assert other_item["other_n"] == 5

    # Sum of rest: cat_10 (5), cat_11 (4), cat_12 (3), cat_13 (2), cat_14 (1) = 15
    assert other_item["count"] == 15
    assert other_item["pct"] == round(15 / total_rows * 100, 2)


# ---------------------------------------------------------------------------
# 4. Cache Miss on Profile Falls Back Gracefully
# ---------------------------------------------------------------------------
def test_cache_miss_on_profile_fallback():
    """
    When profile cache is expired/missing (None), compute_statistics falls back
    to pandas dtype inference without raising any exception.
    """
    df = pd.DataFrame({
        "num_col": list(range(25)),
        "cat_col": (["A", "B", "C", "D"] * 7)[:25],
        "txt_col": [f"long_text_entry_{i}" for i in range(25)]
    })

    cached_file = _make_csv_bytes(df)
    user_id = 1
    session_id = "sess_fallback_123"
    session_meta = {"file_hash": "hash_fallback_123"}

    with patch("app.core.cache.get_file_bytes", return_value=cached_file), \
         patch("app.core.cache.get_session_metadata", return_value=session_meta), \
         patch("app.core.cache.get_cleaning_log", return_value=[]), \
         patch("app.core.cache.get_profile", return_value=None):  # Profile miss!
        
        result = visualize_service.compute_statistics(user_id, session_id)

    assert "columns" in result
    assert result["columns"]["num_col"]["dtype"] == "numeric"
    assert result["columns"]["cat_col"]["dtype"] == "categorical"
    assert result["columns"]["txt_col"]["dtype"] == "text"
    assert result["columns"]["txt_col"]["skip_chart"] is True


# ---------------------------------------------------------------------------
# 5. Structured Insights Format and Max 2 Cap
# ---------------------------------------------------------------------------
def test_structured_insights_categorical():
    stats = {
        "dtype": "categorical",
        "top_values": [
            {"value": "Alpha", "count": 50, "pct": 50.0},
            {"value": "Beta", "count": 25, "pct": 25.0},
            {"value": "Gamma", "count": 15, "pct": 15.0},
            {"value": "__other__", "count": 10, "pct": 10.0, "other_n": 3}
        ],
        "all_values": [
            {"value": "Alpha", "count": 50, "pct": 50.0},
            {"value": "Beta", "count": 25, "pct": 25.0},
            {"value": "Gamma", "count": 15, "pct": 15.0},
            {"value": "Delta", "count": 5, "pct": 5.0},
            {"value": "Epsilon", "count": 5, "pct": 5.0},
        ],
        "unique_count": 5
    }
    insights = chart_insights.generate_insights(stats)
    assert len(insights) <= 2
    assert all("key" in ins and "params" in ins for ins in insights)

    keys = [ins["key"] for ins in insights]
    assert "top_value" in keys
    assert "top3_share" in keys
    assert insights[0]["params"] == {"value": "Alpha", "pct": 50.0}
    assert insights[1]["params"] == {"pct": 90.0}


def test_structured_insights_multiple_choice():
    stats = {
        "dtype": "multiple_choice",
        "top_values": [
            {"value": "Python", "count": 80, "pct": 80.0},
            {"value": "JavaScript", "count": 60, "pct": 60.0}
        ],
        "avg_choices": 2.1,
        "respondents": 100
    }
    insights = chart_insights.generate_insights(stats)
    assert len(insights) == 2
    assert insights[0] == {"key": "mc_top", "params": {"value": "Python", "pct": 80.0}}
    assert insights[1] == {"key": "mc_avg", "params": {"avg": 2.1}}


def test_structured_insights_numeric():
    stats = {
        "dtype": "numeric",
        "p25": 12.5,
        "p75": 45.0,
        "outlier_count": 4
    }
    insights = chart_insights.generate_insights(stats)
    assert len(insights) == 2
    assert insights[0] == {"key": "typical_range", "params": {"low": 12.5, "high": 45.0}}
    assert insights[1] == {"key": "outliers", "params": {"n": 4}}


def test_structured_insights_datetime():
    stats = {
        "dtype": "datetime",
        "trend_data": [
            {"period": "2024-01", "count": 100},
            {"period": "2024-02", "count": 180},
            {"period": "2024-03", "count": 150}
        ]
    }
    insights = chart_insights.generate_insights(stats)
    assert len(insights) == 2
    assert insights[0] == {"key": "trend_up", "params": {"pct": 50.0}}
    assert insights[1] == {"key": "peak", "params": {"period": "2024-02"}}
