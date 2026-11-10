import pandas as pd
import pytest
from app.services.visualize_service import _compute_column_stats


def test_box_stats_with_known_outliers():
    """Test continuous numeric column with known outliers."""
    # 21 regular values from 10 to 30 (step 1) -> 21 unique values (> 20, so continuous)
    # Q1 = 15.0, Median = 20.0, Q3 = 25.0, IQR = 10.0
    # Q1 - 1.5 * IQR = 15 - 15 = 0.0 -> whisker_low should be smallest value >= 0.0 -> 10.0
    # Q3 + 1.5 * IQR = 25 + 15 = 40.0 -> whisker_high should be largest value <= 40.0 -> 30.0
    # Outliers added: -20, 100, 100, 150 (4 total outliers, 3 unique: -20.0, 100.0, 150.0)
    regular_vals = list(range(10, 31))  # 10..30 inclusive (21 items)
    outlier_vals = [-20, 100, 100, 150]
    df = pd.DataFrame({"income": regular_vals + outlier_vals})

    stats = _compute_column_stats(df, "income")
    assert stats["is_discrete"] is False
    assert "box" in stats

    box = stats["box"]
    assert isinstance(box["q1"], float)
    assert isinstance(box["median"], float)
    assert isinstance(box["q3"], float)
    assert isinstance(box["iqr"], float)
    assert isinstance(box["whisker_low"], float)
    assert isinstance(box["whisker_high"], float)
    assert isinstance(box["mean"], float)

    # Whisker checks
    assert box["whisker_low"] == 10.0
    assert box["whisker_high"] == 30.0

    # Outliers check
    assert box["outliers_total"] == 4
    assert box["outliers"] == [-20.0, 100.0, 150.0]
    assert all(isinstance(x, float) for x in box["outliers"])


def test_box_stats_without_outliers():
    """Test continuous numeric column without outliers -> whiskers = min/max."""
    # Values from 1 to 25 -> uniform distribution without outliers
    df = pd.DataFrame({"val": list(range(1, 26))})
    stats = _compute_column_stats(df, "val")
    assert stats["is_discrete"] is False
    assert "box" in stats

    box = stats["box"]
    assert box["whisker_low"] == 1.0  # min
    assert box["whisker_high"] == 25.0  # max
    assert box["outliers"] == []
    assert box["outliers_total"] == 0
    assert box["median"] == 13.0


def test_discrete_column_has_no_box():
    """Test that discrete numeric columns (Likert scales or discrete numbers) do NOT have 'box'."""
    # Likert scale 1..5
    df_scale = pd.DataFrame({"satisfaction": [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 5, 4]})
    stats_scale = _compute_column_stats(df_scale, "satisfaction")
    assert stats_scale["is_discrete"] is True
    assert "box" not in stats_scale

    # Discrete integer with <= 10 unique values
    df_discrete = pd.DataFrame({"items": [0, 1, 2, 3, 2, 1, 0, 3]})
    stats_discrete = _compute_column_stats(df_discrete, "items")
    assert stats_discrete["is_discrete"] is True
    assert "box" not in stats_discrete

