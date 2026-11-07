import pytest
import pandas as pd
from app.services import cleaner_service
from app.schemas.cleaner import CleanAction


def test_error_cells_group_counts_and_paging():
    """
    Test 400-row DataFrame:
    1. Group counts match column_issue_counts
    2. offset/limit paging
    3. after FILL_MISSING_* action the missing group for that column becomes empty
    """
    # 1. Tạo 400 rows với các loại lỗi khác nhau
    nums = [float(i) for i in range(400)]
    for i in range(0, 50, 2):  # 25 missing values
        nums[i] = None

    text_nums = [str(i) for i in range(400)]
    for i in range(10):  # 10 wrong types
        text_nums[i * 10 + 1] = f"invalid_{i}"

    bad_encs = [f"valid_text_{i}" for i in range(400)]
    for i in range(15):  # 15 encoding errors
        bad_encs[i * 20 + 3] = f"text_\ufffd_{i}"

    emails = [f"user_{i}@example.com" for i in range(400)]
    for i in range(8):  # 8 invalid emails
        emails[i * 40 + 5] = f"not-an-email-{i}"

    df = pd.DataFrame({
        "id": list(range(400)),
        "num_col": nums,
        "text_num": text_nums,
        "bad_enc": bad_encs,
        "email": emails,
    })

    profile_types = {
        "id": "numeric",
        "num_col": "numeric",
        "text_num": "numeric",
        "bad_enc": "text",
        "email": "text",
    }
    column_semantics = {"email": "EMAIL"}

    # 2. Kiểm tra group counts khớp với column_issue_counts
    issue_counts = cleaner_service.compute_column_issue_counts(
        df=df,
        profile_types=profile_types,
        column_semantics=column_semantics,
    )

    assert issue_counts["num_col"]["missing"] == 25
    assert issue_counts["text_num"]["wrong_type"] == 10
    assert issue_counts["bad_enc"]["encoding"] == 15
    assert issue_counts["email"]["semantic"] == 8

    # Missing group
    res_missing = cleaner_service.get_group_error_cells(
        df=df,
        column="num_col",
        issue_type="missing",
        offset=0,
        limit=20,
        profile_types=profile_types,
    )
    assert res_missing["total"] == issue_counts["num_col"]["missing"] == 25
    assert len(res_missing["cells"]) == 20
    assert res_missing["cells"][0]["excel_row"] == 2  # index 0 -> row 2

    # Paging: trang 2 (offset 20, limit 20)
    res_missing_p2 = cleaner_service.get_group_error_cells(
        df=df,
        column="num_col",
        issue_type="missing",
        offset=20,
        limit=20,
        profile_types=profile_types,
    )
    assert res_missing_p2["total"] == 25
    assert len(res_missing_p2["cells"]) == 5
    assert res_missing["cells"][-1]["row_id"] < res_missing_p2["cells"][0]["row_id"]

    # Wrong type group
    res_wt = cleaner_service.get_group_error_cells(
        df=df,
        column="text_num",
        issue_type="wrong_type",
        offset=0,
        limit=20,
        profile_types=profile_types,
    )
    assert res_wt["total"] == issue_counts["text_num"]["wrong_type"] == 10
    assert len(res_wt["cells"]) == 10

    # Encoding group
    res_enc = cleaner_service.get_group_error_cells(
        df=df,
        column="bad_enc",
        issue_type="encoding",
        offset=0,
        limit=20,
        profile_types=profile_types,
    )
    assert res_enc["total"] == issue_counts["bad_enc"]["encoding"] == 15
    assert len(res_enc["cells"]) == 15

    # Semantic group
    res_sem = cleaner_service.get_group_error_cells(
        df=df,
        column="email",
        issue_type="semantic",
        offset=0,
        limit=20,
        profile_types=profile_types,
        column_semantics=column_semantics,
    )
    assert res_sem["total"] == issue_counts["email"]["semantic"] == 8
    assert len(res_sem["cells"]) == 8

    # 3. Sau thao tác FILL_MISSING_MEDIAN, nhóm missing cho cột num_col rỗng hoàn toàn
    action = CleanAction(action_type="FILL_MISSING_MEDIAN", column="num_col")
    cleaned_df, _ = cleaner_service.apply_manual_actions(
        df=df,
        actions=[action],
        profile_types=profile_types,
    )

    res_after_fill = cleaner_service.get_group_error_cells(
        df=cleaned_df,
        column="num_col",
        issue_type="missing",
        offset=0,
        limit=20,
        profile_types=profile_types,
    )
    assert res_after_fill["total"] == 0
    assert len(res_after_fill["cells"]) == 0

    issue_counts_after = cleaner_service.compute_column_issue_counts(
        df=cleaned_df,
        profile_types=profile_types,
        column_semantics=column_semantics,
    )
    assert issue_counts_after["num_col"]["missing"] == 0

