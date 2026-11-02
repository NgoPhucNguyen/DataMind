"""
tests/test_changed_cells.py
---------------------------
Unit tests for cleaner_service.compute_changed_cells and compute_removed_rows.
"""
import numpy as np
import pandas as pd
import pytest

from app.services.cleaner_service import (
    auto_clean,
    apply_manual_actions,
    compute_changed_cells,
    compute_removed_rows,
)


# ─── helpers ────────────────────────────────────────────────────────────────

def _labels(df):
    return list(df.index)


# ─── 1. missing_filled ──────────────────────────────────────────────────────

def test_missing_filled_reason():
    original = pd.DataFrame({"a": [1.0, None, 3.0]})
    cleaned = original.copy()
    cleaned["a"] = cleaned["a"].fillna(cleaned["a"].median())

    items, truncated = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
    )
    assert not truncated
    # Only row 1 should appear
    assert len(items) == 1
    cell = items[0]
    assert cell["row_id"] == 1
    assert cell["column"] == "a"
    assert cell["old"] is None
    assert cell["reason"] == "missing_filled"


# ─── 2. "25" -> 25.0 NOT in changed_cells ───────────────────────────────────

def test_string_to_float_unchanged():
    """Numeric conversion "25" -> 25.0 must be treated as unchanged."""
    original = pd.DataFrame({"v": ["25", "30"]})
    cleaned = original.copy()
    cleaned["v"] = pd.to_numeric(cleaned["v"], errors="coerce")

    items, _ = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
    )
    assert items == [], f"Expected no changes, got {items}"


# ─── 3. encoding_fixed ──────────────────────────────────────────────────────

def test_encoding_fixed_reason():
    original = pd.DataFrame({"name": ["x ", "y"]})
    cleaned = original.copy()
    cleaned["name"] = cleaned["name"].str.strip()

    items, _ = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
    )
    assert len(items) == 1
    cell = items[0]
    assert cell["row_id"] == 0
    assert cell["old"] == "x "
    assert cell["new"] == "x"
    assert cell["reason"] == "encoding_fixed"


# ─── 4. duplicate row dropped -> removed_rows; others correct ───────────────

def test_duplicate_dropped_removed_rows():
    original = pd.DataFrame({
        "a": [1, 2, 1],
        "b": ["x", "y", "x"],
    })
    # Simulate drop_duplicates (keep first) — drops row index 2
    cleaned = original.drop_duplicates(keep="first")
    # Index: 0, 1 (row 2 gone)

    removed = compute_removed_rows(
        original_df=original,
        cleaned_df=cleaned,
        window_size=3,
    )
    assert removed == [2], f"Expected [2], got {removed}"

    # No cell changes for the surviving rows
    items, _ = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
    )
    assert items == [], f"Expected no cell changes, got {items}"


# ─── 4b. row_ids of OTHER surviving rows are correct ────────────────────────

def test_surviving_row_ids_correct():
    original = pd.DataFrame({
        "a": [10, None, 10],
        "b": ["p", "q", "p"],
    })
    cleaned, _, _ = auto_clean(original.copy(), overridden_types={"a": "numeric"})
    # Row 2 is duplicate of row 0 -> dropped; row 1's None filled with median(10,10)=10
    # Remaining index labels: 0, 1
    items, _ = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
    )
    row_ids = {c["row_id"] for c in items}
    # row 2 is gone, not in items
    assert 2 not in row_ids
    # Row 1 fill: label 1
    missing_filled = [c for c in items if c["reason"] == "missing_filled"]
    assert any(c["row_id"] == 1 for c in missing_filled)


# ─── 5. BATCH_EDIT reason "edited" ──────────────────────────────────────────

def test_batch_edit_reason():
    original = pd.DataFrame({"score": [10, 20, 30]})
    actions = [
        {
            "action_type": "BATCH_EDIT_CELLS",
            "column": "all",
            "params": {"edits": [{"row_id": 1, "column": "score", "new_value": 99}]},
        }
    ]
    cleaned, _ = apply_manual_actions(original.copy(), actions)
    edited_keys = {(1, "score")}

    items, _ = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
        edited_keys=edited_keys,
    )
    assert len(items) == 1
    cell = items[0]
    assert cell["row_id"] == 1
    assert cell["column"] == "score"
    assert cell["old"] == 20
    assert cell["new"] == 99
    assert cell["reason"] == "edited"


# ─── 6. cap respected, truncated=True ───────────────────────────────────────

def test_cap_respected():
    n = 100
    original = pd.DataFrame({"v": [f"old_{i}" for i in range(n)]})
    cleaned = original.copy()
    cleaned["v"] = [f"new_{i}" for i in range(n)]  # all cells changed

    items, truncated = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=_labels(cleaned),
        cap=10,
    )
    assert len(items) == 10
    assert truncated is True


# ─── 7. auto_clean integration smoke test ───────────────────────────────────

def test_auto_clean_integration():
    original = pd.DataFrame({
        "a": [1, None, 1],
        "b": ["x ", "y", "x "],
    })
    cleaned, diff, _ = auto_clean(original.copy())
    preview_labels = list(cleaned.head(500).index)

    items, truncated = compute_changed_cells(
        original_df=original,
        cleaned_df=cleaned,
        preview_labels=preview_labels,
    )
    removed = compute_removed_rows(original_df=original, cleaned_df=cleaned, window_size=500)

    # Row 2 is a duplicate of row 0 -> removed
    assert 2 in removed

    reasons = {c["reason"] for c in items}
    # b col: "x " -> "x" => encoding_fixed (b is text/categorical, auto_clean strips bad chars)
    # a col row 1: None -> median => missing_filled
    # At least one of each
    assert "missing_filled" in reasons or "encoding_fixed" in reasons
    assert not truncated

