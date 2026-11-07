import pandas as pd
import pytest
from app.services.visualize_service import _compute_column_stats, compute_statistics_df
from app.services.chart_insights import generate_insights


def test_6a_discrete_scale_5():
    """6a. Numeric column with 5 unique integer values (1..5) -> is_discrete=True, is_scale=True, scale_min=1, scale_max=5, distribution_bins length 5, skip_chart=False."""
    df = pd.DataFrame({"q1": [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 5, 4]})
    stats = _compute_column_stats(df, "q1")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is True
    assert stats["scale_min"] == 1
    assert stats["scale_max"] == 5
    assert len(stats["distribution_bins"]) == 5
    assert stats["skip_chart"] is False
    assert stats["discrete_values"] == [1, 2, 3, 4, 5]

    bin_1 = stats["distribution_bins"][0]
    assert bin_1["label"] == "1"
    assert bin_1["value"] == 1
    assert bin_1["count"] == 2
    assert bin_1["pct"] == 16.7


def test_6b_discrete_scale_7():
    """6b. Numeric column with 7 unique integer values (1..7) -> is_discrete=True, is_scale=True, scale_min=1, scale_max=7."""
    df = pd.DataFrame({"satisfaction": [1, 2, 3, 4, 5, 6, 7, 7, 6, 5]})
    stats = _compute_column_stats(df, "satisfaction")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is True
    assert stats["scale_min"] == 1
    assert stats["scale_max"] == 7
    assert len(stats["distribution_bins"]) == 7
    assert stats["skip_chart"] is False


def test_6c_discrete_non_scale_integer():
    """6c. Numeric column with 3 unique integer values (0, 1, 2) -> is_discrete=True, is_scale=False (max not in 5,7,10)."""
    df = pd.DataFrame({"status": [0, 1, 2, 1, 0, 2, 1]})
    stats = _compute_column_stats(df, "status")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is False
    assert stats["scale_min"] is None
    assert stats["scale_max"] is None
    assert len(stats["distribution_bins"]) == 3
    assert stats["skip_chart"] is False
    assert stats["discrete_values"] == [0, 1, 2]


def test_6d_discrete_floats():
    """6d. Numeric column with float values but <= 10 unique (1.5, 2.5, 3.5) -> is_discrete=True, is_scale=False (not integer)."""
    df = pd.DataFrame({"rates": [1.5, 2.5, 3.5, 2.5, 1.5]})
    stats = _compute_column_stats(df, "rates")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is False
    assert stats["scale_min"] is None
    assert stats["scale_max"] is None
    assert len(stats["distribution_bins"]) == 3
    assert stats["skip_chart"] is False
    assert stats["discrete_values"] == [1.5, 2.5, 3.5]


def test_6e_continuous_numeric():
    """6e. Numeric column with > 10 unique values -> is_discrete=False, normal continuous histogram bins."""
    df = pd.DataFrame({"val": list(range(1, 25))})
    stats = _compute_column_stats(df, "val")
    assert stats["is_discrete"] is False
    assert "distribution_bins" in stats
    assert len(stats["distribution_bins"]) > 0
    assert stats["skip_chart"] is False


def test_6f_missing_high():
    """6f. Column with missing_pct >= 60% -> skip_chart=True, skip_key='missing_high', in skipped_columns list."""
    df = pd.DataFrame({"sparse": [1, 2, None, None, None, None, None, None, None, None]})
    stats = _compute_column_stats(df, "sparse")
    assert stats["skip_chart"] is True
    assert stats["skip_key"] == "missing_high"

    summary = compute_statistics_df(df)
    assert any(
        col["column"] == "sparse" and col["reason"] == "missing_high" and col["missing_pct"] == 80.0
        for col in summary["skipped_columns"]
    )


def test_6g_single_value():
    """6g. Column with 1 unique value -> skip_chart=True, skip_key='single_value', in skipped_columns list."""
    df = pd.DataFrame({"constant": [42, 42, 42, 42]})
    stats = _compute_column_stats(df, "constant")
    assert stats["skip_chart"] is True
    assert stats["skip_key"] == "single_value"

    summary = compute_statistics_df(df)
    assert any(
        col["column"] == "constant" and col["reason"] == "single_value"
        for col in summary["skipped_columns"]
    )


def test_6h_free_text():
    """6h. Text column -> skip_chart=True, skip_key='free_text', in skipped_columns list."""
    df = pd.DataFrame({
        "comments": [f"This is user comment number {i} with long descriptive feedback" for i in range(25)]
    })
    stats = _compute_column_stats(df, "comments")
    assert stats["skip_chart"] is True
    assert stats["skip_key"] == "free_text"

    summary = compute_statistics_df(df)
    assert any(
        col["column"] == "comments" and col["reason"] == "free_text"
        for col in summary["skipped_columns"]
    )


def test_6i_scale_insights():
    """6i. Insights for scale column produce scale_mean and scale_top_box, NO typical_range or outliers."""
    df = pd.DataFrame({"rating": [1, 2, 3, 4, 5] * 6})
    stats = _compute_column_stats(df, "rating")
    insights = stats["auto_insights"]
    keys = [ins["key"] for ins in insights]
    assert "scale_mean" in keys
    assert "scale_top_box" in keys
    assert "typical_range" not in keys
    assert "outliers" not in keys

    mean_ins = next(ins for ins in insights if ins["key"] == "scale_mean")
    assert mean_ins["params"]["max"] == 5
    assert mean_ins["params"]["n"] == 30
    assert mean_ins["params"]["mean"] == 3.0

    top_box_ins = next(ins for ins in insights if ins["key"] == "scale_top_box")
    assert top_box_ins["params"]["low"] == 4
    assert top_box_ins["params"]["high"] == 5
    assert top_box_ins["params"]["pct"] == 40
    assert top_box_ins["params"]["count"] == 12
    assert top_box_ins["params"]["n"] == 30


def test_6j_continuous_insights_regression():
    """6j. Insights for continuous numeric STILL produce typical_range, outliers (regression check)."""
    df = pd.DataFrame({"salary": list(range(10, 100)) + [1000, 2000]})
    stats = _compute_column_stats(df, "salary")
    insights = stats["auto_insights"]
    keys = [ins["key"] for ins in insights]
    assert "typical_range" in keys
    assert "outliers" in keys
    assert "scale_mean" not in keys
    assert "scale_top_box" not in keys


def test_skipped_columns_order_and_letters():
    """Verify skipped_columns list preserves original column order and resolves letter."""
    df = pd.DataFrame({
        "sparse_col": [1, None, None, None, None],
        "good_num": [1, 2, 3, 4, 5],
        "single_col": [9, 9, 9, 9, 9]
    })
    df.attrs["column_letters"] = {"sparse_col": "A", "good_num": "B", "single_col": "C"}
    summary = compute_statistics_df(df)
    skipped = summary["skipped_columns"]
    assert len(skipped) == 2
    assert skipped[0]["column"] == "sparse_col"
    assert skipped[0]["letter"] == "A"
    assert skipped[0]["reason"] == "missing_high"
    assert skipped[1]["column"] == "single_col"
    assert skipped[1]["letter"] == "C"
    assert skipped[1]["reason"] == "single_value"


def test_scale_detection_missing_level_one_float64():
    """Real survey scale: values {2, 3, 4, 5} (level 1 has 0 count) + NaN as float64."""
    import numpy as np
    data = [2, 3, 4, 5] * 50 + [np.nan] * 32
    df = pd.DataFrame({"q": pd.Series(data, dtype="float64")})
    stats = _compute_column_stats(df, "q")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is True
    assert stats["scale_min"] == 1
    assert stats["scale_max"] == 5
    assert stats["discrete_values"] == [1, 2, 3, 4, 5]
    assert len(stats["distribution_bins"]) == 5
    bin_1 = stats["distribution_bins"][0]
    assert bin_1["label"] == "1"
    assert bin_1["value"] == 1
    assert bin_1["count"] == 0
    assert bin_1["pct"] == 0.0

    insights = stats["auto_insights"]
    keys = [ins["key"] for ins in insights]
    assert "scale_mean" in keys
    assert "scale_top_box" in keys


def test_scale_detection_missing_level_one_int64_nullable():
    """Real survey scale: values {2, 3, 4, 5} + pd.NA as Int64."""
    data = [2, 3, 4, 5] * 50 + [pd.NA] * 32
    df = pd.DataFrame({"q": pd.Series(data, dtype="Int64")})
    stats = _compute_column_stats(df, "q")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is True
    assert stats["scale_min"] == 1
    assert stats["scale_max"] == 5
    assert stats["discrete_values"] == [1, 2, 3, 4, 5]
    assert len(stats["distribution_bins"]) == 5
    bin_1 = stats["distribution_bins"][0]
    assert bin_1["count"] == 0

    insights = stats["auto_insights"]
    keys = [ins["key"] for ins in insights]
    assert "scale_mean" in keys
    assert "scale_top_box" in keys


def test_scale_detection_missing_level_one_float64_nullable():
    """Real survey scale: values {2.0, 3.0, 4.0, 5.0} + pd.NA as Float64."""
    data = [2.0, 3.0, 4.0, 5.0] * 50 + [pd.NA] * 32
    df = pd.DataFrame({"q": pd.Series(data, dtype="Float64")})
    stats = _compute_column_stats(df, "q")
    assert stats["is_discrete"] is True
    assert stats["is_scale"] is True
    assert stats["scale_min"] == 1
    assert stats["scale_max"] == 5
    assert stats["discrete_values"] == [1, 2, 3, 4, 5]
    assert len(stats["distribution_bins"]) == 5
    bin_1 = stats["distribution_bins"][0]
    assert bin_1["count"] == 0

    insights = stats["auto_insights"]
    keys = [ins["key"] for ins in insights]
    assert "scale_mean" in keys
    assert "scale_top_box" in keys

