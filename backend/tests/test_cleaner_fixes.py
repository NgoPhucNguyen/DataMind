"""
test_cleaner_fixes.py
---------------------
Unit tests for the 8 Cleaner fixes (from docs/guide/cleaner.md review):
1. Type source resolution priority (overridden_types -> profile -> _infer_type)
2. Suggestion = action for missing values
3. Invalid values replaced reason and DiffReport tracking
4. Integer numeric column median fill keeping Int64
5. Whole-file compute_diff_report for auto & manual modes
6. CLEANER_PREVIEW_ROWS constant (200)
7. Semantic notice check (semantic_checked flag)
8. Duplicates + near-empty rows warning (>20%)
"""

import numpy as np
import pandas as pd
import pytest

from app.core.rules import (
    CLEANER_PREVIEW_ROWS,
    CLEANER_NEAR_EMPTY_ROW_THRESHOLD,
    CLEANER_DUPLICATE_WARNING_PCT,
    CLEANER_DROP_COLUMN_NULL_PCT,
    CLEANER_FILL_CATEGORICAL,
)
from app.services.cleaner_service import (
    resolve_column_type,
    is_integer_numeric,
    compute_diff_report,
    compute_changed_cells,
    _suggested_fill,
    detect_issues,
    auto_clean,
    apply_manual_actions,
    apply_manual_actions_preview,
    _get_error_cells,
)


# ─── 1. TYPE SOURCE RESOLUTION ───────────────────────────────────────────────

def test_resolve_column_type_override_priority():
    """Override (not 'auto') takes top priority."""
    series = pd.Series(["1", "2", "3"])
    overridden = {"col1": "categorical"}
    profile = {"col1": "numeric"}

    col_type = resolve_column_type("col1", series, overridden, profile)
    assert col_type == "categorical"


def test_resolve_column_type_auto_override_falls_back_to_profile():
    """Override 'auto' falls back to profile detected_type."""
    series = pd.Series(["1", "2", "3"])
    overridden = {"col1": "auto"}
    profile = {"col1": "numeric"}

    col_type = resolve_column_type("col1", series, overridden, profile)
    assert col_type == "numeric"


def test_resolve_column_type_fallback_to_infer():
    """When override and profile are missing, fallback to _infer_type."""
    series = pd.Series([10, 20, 30])
    col_type = resolve_column_type("col1", series, None, None)
    assert col_type == "numeric"


# ─── 2. SUGGESTION = ACTION ──────────────────────────────────────────────────

def test_suggested_fill_exact_actions():
    """suggested_fill describes exactly what auto_clean does."""
    # >= 90% null -> drop_column
    assert _suggested_fill(null_pct=95.0, col_type="numeric") == "drop_column"
    assert _suggested_fill(null_pct=90.0, col_type="categorical") == "drop_column"

    # numeric -> median
    assert _suggested_fill(null_pct=10.0, col_type="numeric") == "median"

    # categorical / multiple_choice -> Không xác định
    assert _suggested_fill(null_pct=10.0, col_type="categorical") == CLEANER_FILL_CATEGORICAL
    assert _suggested_fill(null_pct=10.0, col_type="multiple_choice") == CLEANER_FILL_CATEGORICAL

    # datetime -> keep_empty
    assert _suggested_fill(null_pct=10.0, col_type="datetime") == "keep_empty"

    # text -> skipped
    assert _suggested_fill(null_pct=10.0, col_type="text") == "skipped"


# ─── 3. INVALID VALUES IN NUMERIC COLUMNS ────────────────────────────────────

def test_invalid_replaced_tracking_and_diff():
    """Unreadable values coerced to NaN and filled get reason='invalid_replaced'."""
    df = pd.DataFrame({
        "age": ["25", "invalid_num", "30", "40", np.nan]
    })
    profile_types = {"age": "numeric"}

    cleaned_df, diff_report, log = auto_clean(
        df=df,
        overridden_types=None,
        profile_types=profile_types,
    )

    # diff_report contains invalid_replaced count for 'age'
    assert "invalid_replaced" in diff_report
    assert diff_report["invalid_replaced"].get("age", 0) == 1

    # compute_changed_cells should mark row 1 (the invalid string) as invalid_replaced
    invalid_keys = diff_report.get("invalid_replaced_keys", set())
    changed_cells, _ = compute_changed_cells(
        original_df=df,
        cleaned_df=cleaned_df,
        preview_labels=list(cleaned_df.index),
        edited_keys=set(),
        invalid_replaced_keys=invalid_keys,
    )

    row1_change = next((c for c in changed_cells if c["row_id"] == 1 and c["column"] == "age"), None)
    assert row1_change is not None
    assert row1_change["reason"] == "invalid_replaced"

    # row 4 (was originally NaN) should be missing_filled
    row4_change = next((c for c in changed_cells if c["row_id"] == 4 and c["column"] == "age"), None)
    assert row4_change is not None
    assert row4_change["reason"] == "missing_filled"


def test_format_normalized_not_in_changed_cells():
    """'10,000,000 VND' -> 10000000 is NOT in changed_cells but counted in format_normalized; 'lỗi số liệu' still invalid_replaced."""
    df = pd.DataFrame({
        "luong_thang": ["10,000,000 VND", "lỗi số liệu", "20,000,000 VND", "30,000,000 VND"]
    })
    profile_types = {"luong_thang": "numeric"}

    cleaned_df, diff_report, log = auto_clean(
        df=df,
        profile_types=profile_types,
    )

    # Counted in format_normalized
    assert "format_normalized" in diff_report
    assert diff_report["format_normalized"].get("luong_thang") == 3
    # Invalid value replaced by median
    assert "invalid_replaced" in diff_report
    assert diff_report["invalid_replaced"].get("luong_thang") == 1

    invalid_keys = diff_report.get("invalid_replaced_keys", set())
    changed_cells, _ = compute_changed_cells(
        original_df=df,
        cleaned_df=cleaned_df,
        preview_labels=list(cleaned_df.index),
        invalid_replaced_keys=invalid_keys,
    )

    # '10,000,000 VND' at row 0 is NOT in changed_cells
    row0_change = next((c for c in changed_cells if c["row_id"] == 0 and c["column"] == "luong_thang"), None)
    assert row0_change is None

    # 'lỗi số liệu' at row 1 IS still in changed_cells with reason 'invalid_replaced'
    row1_change = next((c for c in changed_cells if c["row_id"] == 1 and c["column"] == "luong_thang"), None)
    assert row1_change is not None
    assert row1_change["reason"] == "invalid_replaced"


# ─── 4. INTEGER COLUMNS ──────────────────────────────────────────────────────

def test_is_integer_numeric():
    """Identify whole numbers vs floating point."""
    int_series = pd.Series([10.0, 20.0, np.nan, 30.0])
    assert is_integer_numeric(int_series) is True

    float_series = pd.Series([10.5, 20.0, 30.0])
    assert is_integer_numeric(float_series) is False


def test_integer_numeric_fill_median_keeps_int64():
    """Integer numeric columns filled with round(median) and converted to Int64."""
    df = pd.DataFrame({
        "count": [10.0, 20.0, np.nan, 40.0]
    })
    profile_types = {"count": "numeric"}

    cleaned_df, diff_report, log = auto_clean(
        df=df,
        profile_types=profile_types,
    )

    # Median of [10, 20, 40] is 20
    assert cleaned_df["count"].isna().sum() == 0
    assert cleaned_df["count"].dtype.name == "Int64"
    assert cleaned_df["count"].iloc[2] == 20


# ─── 5. REAL DIFF REPORT OVER WHOLE FILE ──────────────────────────────────────

def test_compute_diff_report_whole_file():
    """Diff report computes real changes over the whole DataFrame."""
    orig_df = pd.DataFrame({
        "id": [1, 2, 2, 3],
        "name": ["An", "Bình", "Bình", "Cường"],
        "empty_col": [np.nan, np.nan, np.nan, np.nan]
    })

    cleaned_df = pd.DataFrame({
        "id": [1, 2, 3],
        "full_name": ["An", "Bình", "Cường"],
    })

    actions = [
        {"action_type": "DROP_DUPLICATES", "column": "all"},
        {"action_type": "DROP_COLUMN", "column": "empty_col"},
        {"action_type": "RENAME_COLUMN", "column": "name", "params": {"new_name": "full_name"}}
    ]

    report = compute_diff_report(orig_df, cleaned_df, actions_or_log=actions)

    assert report["original_rows"] == 4
    assert report["clean_rows"] == 3
    assert report["duplicate_rows_removed"] == 1
    assert "empty_col" in report["columns_dropped"]
    assert report["columns_renamed"].get("name") == "full_name"


# ─── 6. PREVIEW SIZE CONSTANT ────────────────────────────────────────────────

def test_cleaner_preview_rows_constant():
    """Preview constant is 150."""
    assert CLEANER_PREVIEW_ROWS == 150


# ─── 7. SEMANTIC NOTICE CHECK ────────────────────────────────────────────────

def test_semantic_checked_flag():
    """detect_issues returns semantic_checked=False when no column has semantic_type != GENERAL_TEXT."""
    df = pd.DataFrame({"name": ["Nguyen", "Tran"], "age": [20, 30]})

    # Without semantic types
    report1 = detect_issues(
        df=df,
        filename="test.csv",
        file_hash="hash1",
        column_semantics={"name": "GENERAL_TEXT", "age": "GENERAL_TEXT"}
    )
    assert report1["semantic_checked"] is False

    # With semantic type from AI Profiler
    report2 = detect_issues(
        df=df,
        filename="test.csv",
        file_hash="hash1",
        column_semantics={"name": "PERSON_NAME", "age": "GENERAL_TEXT"}
    )
    assert report2["semantic_checked"] is True


# ─── 8. DUPLICATES & NEAR-EMPTY ROWS ─────────────────────────────────────────

def test_duplicates_and_near_empty_warning():
    """Detect near-empty rows and warn when (dups + near_empty) > 20%."""
        # 10 rows: 1 duplicate, 2 near-empty rows -> 3/10 = 30% > 20%
    # Total = 3 / 10 = 30% > 20%
    data = [
        {"c1": "a", "c2": "b", "c3": "c", "c4": "d", "c5": "e"},
        {"c1": "a", "c2": "b", "c3": "c", "c4": "d", "c5": "e"}, # dup
        {"c1": None, "c2": None, "c3": None, "c4": None, "c5": "x"}, # 80% empty
        {"c1": "f", "c2": "g", "c3": "h", "c4": "i", "c5": "j"},
        {"c1": "k", "c2": "l", "c3": "m", "c4": "n", "c5": "o"},
        {"c1": "p", "c2": "q", "c3": "r", "c4": "s", "c5": "t"},
        {"c1": "u", "c2": "v", "c3": "w", "c4": "x", "c5": "y"},
        {"c1": "z", "c2": "1", "c3": "2", "c4": "3", "c5": "4"},
        {"c1": "5", "c2": "6", "c3": "7", "c4": "8", "c5": "9"},
        {"c1": None, "c2": None, "c3": None, "c4": None, "c5": "%"},
    ]
    df = pd.DataFrame(data)

    report = detect_issues(
        df=df,
        filename="test.csv",
        file_hash="hash_dups",
    )

    dup_info = report["duplicates"]
    assert dup_info["duplicate_count"] == 1
    assert dup_info["near_empty_count"] >= 1
    assert dup_info["warning"] is not None
    assert "kiểm tra trước khi xóa" in dup_info["warning"]


# ─── 9. MANUAL PREVIEW MATCHES CONFIRM CLEAN ON PREVIEW ROWS ────────────────

def test_manual_preview_matches_confirm_clean():
    """For a 1,000-row DataFrame with [CONVERT_TO_NUMERIC, FILL_MISSING_MEDIAN, DROP_DUPLICATES, BATCH_EDIT_CELLS],
    the first 200 rows of confirm-clean output equal manual-clean-preview output (excluding removed rows)."""
    n = 1000
    num_vals = [f"{(i % 50) * 1000:,} VND" if i % 7 != 0 else None for i in range(n)]
    cat_vals = [f"category_{(i % 30)}" for i in range(n)]
    # introduce duplicates inside and outside the first 200 rows
    cat_vals[10] = cat_vals[9]
    num_vals[10] = num_vals[9]
    cat_vals[250] = cat_vals[249]
    num_vals[250] = num_vals[249]

    batch_vals = ["pending" if i % 3 == 0 else "approved" for i in range(n)]

    df = pd.DataFrame({
        "price": num_vals,
        "category": cat_vals,
        "status": batch_vals,
    })

    actions = [
        {"action_type": "CONVERT_TO_NUMERIC", "column": "price"},
        {"action_type": "FILL_MISSING_MEDIAN", "column": "price"},
        {"action_type": "DROP_DUPLICATES", "column": "all"},
        {"action_type": "BATCH_EDIT_CELLS", "column": "status", "params": {"find": "pending", "replace": "processed"}},
    ]

    # Full clean (confirm-clean)
    full_cleaned, _ = apply_manual_actions(df, actions)

    # Preview clean (manual-clean-preview)
    preview_df = df.head(CLEANER_PREVIEW_ROWS).copy()
    preview_cleaned, _, removed_rows = apply_manual_actions_preview(
        preview_df=preview_df,
        actions=actions,
        full_df=df,
    )
    preview_surviving = preview_cleaned.loc[~preview_cleaned.index.isin(removed_rows)]

    # The rows in full_cleaned that originated from the first 200 rows must match preview_surviving
    full_preview_rows = full_cleaned.loc[full_cleaned.index < CLEANER_PREVIEW_ROWS]

    assert len(preview_surviving) == len(full_preview_rows)
    pd.testing.assert_frame_equal(preview_surviving, full_preview_rows)


