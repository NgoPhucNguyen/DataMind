import pytest
import pandas as pd
from app.services import cleaner_service
from app.schemas.cleaner import CleanAction, WindowInfo


def test_cleaner_window_offset_150():
    """400-row DataFrame with window offset 150 returns rows 150..299 with WindowInfo."""
    df = pd.DataFrame({
        "id": list(range(400)),
        "val": [f"val_{i}" for i in range(400)],
        "num": [float(i) for i in range(400)],
    })

    report = cleaner_service.detect_issues(
        df=df,
        filename="test_400.csv",
        file_hash="hash400",
        offset=150,
        mode="all",
    )

    window = report["window"]
    assert window is not None
    assert window["offset"] == 150
    assert window["size"] == 150
    assert window["mode"] == "all"
    assert window["total_rows"] == 400
    assert window["first_excel_row"] == 152  # 150 + 2
    assert window["last_excel_row"] == 301   # 299 + 2
    assert len(report["preview_data"]) == 150
    assert report["preview_data"][0]["original_index"] == 150
    assert report["preview_data"][-1]["original_index"] == 299


def test_cleaner_window_mode_errors():
    """Mode 'errors' pages only rows having errors across the whole file."""
    # 400 rows, only rows 10, 160, 310 have missing value in numeric column 'num'
    nums = [float(i) for i in range(400)]
    nums[10] = None
    nums[160] = None
    nums[310] = None

    df = pd.DataFrame({
        "id": list(range(400)),
        "val": [f"val_{i}" for i in range(400)],
        "num": nums,
    })

    report = cleaner_service.detect_issues(
        df=df,
        filename="test_errors.csv",
        file_hash="hash_err",
        offset=0,
        mode="errors",
    )

    window = report["window"]
    assert window is not None
    assert window["mode"] == "errors"
    assert window["total_error_rows"] == 3
    assert len(report["preview_data"]) == 3
    assert [r["original_index"] for r in report["preview_data"]] == [10, 160, 310]


def test_cleaner_locate_row():
    """Locate excel_row returns correct window offset or removed/not_found."""
    df = pd.DataFrame({
        "id": list(range(400)),
        "val": [f"val_{i}" for i in range(400)],
    })

    # excel_row 412 -> original_index = 410 -> window offset (410 // 150) * 150 = 300
    loc = cleaner_service.locate_row(df, excel_row=412, mode="all")
    assert loc["status"] == "found"
    assert loc["offset"] == 300
    assert loc["excel_row"] == 412

    # excel_row 1000 -> not found
    loc_nf = cleaner_service.locate_row(df, excel_row=1000, mode="all")
    assert loc_nf["status"] == "not_found"

    # Duplicate removal check: row 5 is duplicate of row 4
    df_with_dup = pd.DataFrame({
        "col": ["a", "b", "c", "d", "dup", "dup"],
    })
    cleaned_df = df_with_dup.drop_duplicates(keep="first")
    # row 5 (excel_row = 5 + 2 = 7) is removed
    loc_removed = cleaner_service.locate_row(cleaned_df, excel_row=7, original_df=df_with_dup)
    assert loc_removed["status"] == "removed"
    assert loc_removed["reason"] == "duplicate"


def test_cleaner_manual_edits_in_window_2_confirm():
    """Manual edits on window 2 (e.g. row 160) persist when applied to full dataset."""
    df = pd.DataFrame({
        "id": list(range(400)),
        "name": [f"name_{i}" for i in range(400)],
    })

    action = CleanAction(
        action_type="BATCH_EDIT_CELLS",
        column="all",
        params={
            "edits": [
                {"row_id": 160, "column": "name", "new_value": "Updated_160"}
            ]
        }
    )

    cleaned_df, logs = cleaner_service.apply_manual_actions(df, [action])
    assert cleaned_df.at[160, "name"] == "Updated_160"
    assert cleaned_df.at[0, "name"] == "name_0"
    assert len(cleaned_df) == 400

