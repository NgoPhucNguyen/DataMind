import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import numpy as np
import pandas as pd
import pytest
from app.services.visualize_service import compute_statistics_df, get_scatter_data
from app.core.rules import VIZ_CORR_MAX_COLS, VIZ_CORR_MIN_PAIR_N


def test_5a_all_25_columns_in_correlation_v2():
    """a) 25 numeric columns -> all 25 in correlation_v2.columns (old 20 cap gone)."""
    np.random.seed(42)
    data = {f"col_{i}": np.random.randn(30) for i in range(25)}
    df = pd.DataFrame(data)

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    assert len(v2["columns"]) == 25
    assert v2["dropped_columns"] == []
    col_names = [c["name"] for c in v2["columns"]]
    for i in range(25):
        assert f"col_{i}" in col_names


def test_5b_45_columns_top_40_kept_and_5_dropped():
    """b) 45 columns -> 40 kept, the 5 with highest missing in dropped_columns as too_many_columns, output in file order."""
    np.random.seed(42)
    data = {}
    for i in range(45):
        data[f"c_{i}"] = np.random.randn(50)

    df = pd.DataFrame(data)
    # Make 5 specific columns have missing values (e.g. 20% missing)
    dropped_target_cols = ["c_5", "c_12", "c_20", "c_33", "c_40"]
    for col in dropped_target_cols:
        df.loc[:9, col] = np.nan  # 10 / 50 = 20% missing (< 60% high missing threshold)

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    assert len(v2["columns"]) == VIZ_CORR_MAX_COLS  # 40
    assert len(v2["dropped_columns"]) == 5

    # Check dropped columns
    dropped_names = [d["name"] for d in v2["dropped_columns"]]
    assert dropped_names == dropped_target_cols
    for d in v2["dropped_columns"]:
        assert d["reason"] == "too_many_columns"

    # Check kept columns are in original file order
    kept_names = [c["name"] for c in v2["columns"]]
    expected_kept = [f"c_{i}" for i in range(45) if f"c_{i}" not in dropped_target_cols]
    assert kept_names == expected_kept


def test_5c_constant_column_dropped_as_no_variance():
    """c) constant column -> dropped as no_variance."""
    df = pd.DataFrame({
        "a": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0],
        "b": [2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0],
        "const": [5.0] * 12,
    })

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    assert len(v2["columns"]) == 2
    assert [c["name"] for c in v2["columns"]] == ["a", "b"]

    no_var_cols = [d for d in v2["dropped_columns"] if d["reason"] == "no_variance"]
    assert any(d["name"] == "const" for d in no_var_cols)


def test_5d_pair_with_insufficient_rows_has_null_r():
    """d) pair with only 5 complete rows -> pearson/spearman null, n = 5."""
    # 10 rows: col_a has 5 non-null and 5 null (50% missing < 60% skip_chart threshold)
    a_vals = [1.0, 2.0, 3.0, 4.0, 5.0] + [np.nan] * 5
    b_vals = list(range(1, 11))
    c_vals = list(range(10, 20))

    df = pd.DataFrame({"a": a_vals, "b": b_vals, "c": c_vals})

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    # Find pair (a, b)
    pair_ab = next((p for p in v2["pairs"] if (p["a"] == "a" and p["b"] == "b") or (p["a"] == "b" and p["b"] == "a")), None)
    assert pair_ab is not None
    assert pair_ab["n"] == 5
    assert pair_ab["pearson"] is None
    assert pair_ab["spearman"] is None


def test_5e_monotonic_non_linear_spearman_one():
    """e) monotonic non-linear data (y = x^3) -> spearman 1.0, pearson < 1."""
    x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    y = [val**3 for val in x]
    z = list(range(12))  # need >= 2 cols anyway

    df = pd.DataFrame({"x": x, "y": y, "z": z})

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    pair_xy = next((p for p in v2["pairs"] if (p["a"] == "x" and p["b"] == "y") or (p["a"] == "y" and p["b"] == "x")), None)
    assert pair_xy is not None
    assert pair_xy["spearman"] == 1.0
    assert pair_xy["pearson"] < 1.0
    assert pair_xy["n"] == 12


def test_5f_default_method_selection():
    """f) mostly Likert columns -> default_method spearman; continuous -> pearson."""
    # Mostly Likert (3 Likert 1..5 vs 1 continuous)
    df_likert = pd.DataFrame({
        "q1": [1, 2, 3, 4, 5] * 4,
        "q2": [5, 4, 3, 2, 1] * 4,
        "q3": [2, 3, 4, 3, 2] * 4,
        "cont": np.linspace(10.0, 100.0, 20),
    })
    summary_l = compute_statistics_df(df_likert)
    assert summary_l["correlation_v2"]["default_method"] == "spearman"

    # Mostly Continuous (1 Likert vs 3 continuous)
    df_cont = pd.DataFrame({
        "q1": [1, 2, 3, 4, 5] * 4,
        "c1": np.linspace(1.0, 10.0, 20),
        "c2": np.linspace(10.0, 100.0, 20),
        "c3": np.random.randn(20),
    })
    summary_c = compute_statistics_df(df_cont)
    assert summary_c["correlation_v2"]["default_method"] == "pearson"


def test_5g_grid_mode_for_two_likert_columns():
    """g) grid mode for two Likert columns: levels 1..5 both axes, 25 cells, counts sum to n, count-0 cells present."""
    np.random.seed(42)
    # Likert columns with values only in 1, 2, 3, 5 (level 4 not picked to test count-0)
    q1 = [1, 2, 3, 5] * 5
    q2 = [1, 1, 2, 5] * 5

    df = pd.DataFrame({"q1": q1, "q2": q2})

    scatter = get_scatter_data(df, "q1", "q2")

    assert scatter["mode"] == "grid"
    assert scatter["x_levels"] == [1, 2, 3, 4, 5]
    assert scatter["y_levels"] == [1, 2, 3, 4, 5]
    assert len(scatter["grid"]) == 25
    assert scatter["n"] == len(df)
    total_counts = sum(cell["count"] for cell in scatter["grid"])
    assert total_counts == scatter["n"]

    zero_cells = [c for c in scatter["grid"] if c["count"] == 0]
    assert len(zero_cells) > 0


def test_5h_pairs_sorted_and_letters_present():
    """h) pairs sorted by max |r| desc; letters present."""
    df = pd.DataFrame({
        "q1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0],
        "q2": [1.0, 2.1, 2.9, 4.2, 5.0, 6.1, 7.0, 8.0, 9.1, 9.9, 11.2, 12.0],  # very high r
        "q3": [12.0, 1.0, 7.0, 2.0, 11.0, 4.0, 8.0, 3.0, 10.0, 5.0, 6.0, 9.0],  # lower r
    })
    df.attrs["column_letters"] = {"q1": "A", "q2": "B", "q3": "C"}

    summary = compute_statistics_df(df)
    v2 = summary.get("correlation_v2")

    assert v2 is not None
    # Check column letters
    col_letters = {c["name"]: c["letter"] for c in v2["columns"]}
    assert col_letters["q1"] == "A"
    assert col_letters["q2"] == "B"
    assert col_letters["q3"] == "C"

    # Check pairs sorted by max(|pearson|, |spearman|) desc
    pairs = v2["pairs"]
    assert len(pairs) == 3
    for k in range(len(pairs) - 1):
        p1 = pairs[k]
        p2 = pairs[k + 1]
        score1 = max(abs(p1["pearson"] or 0), abs(p1["spearman"] or 0))
        score2 = max(abs(p2["pearson"] or 0), abs(p2["spearman"] or 0))
        assert score1 >= score2

    # Check scatter data has letter_x, letter_y
    scatter = get_scatter_data(df, "q1", "q2")
    assert scatter["letter_x"] == "A"
    assert scatter["letter_y"] == "B"
