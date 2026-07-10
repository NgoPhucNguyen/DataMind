import pytest
import pandas as pd
from app.services.cleaner_service import _get_error_cells, apply_manual_actions
from app.schemas.cleaner import CleanAction

def test_batch_edit_cells_no_op():
    """Test case 5: Sửa 1 cell không đổi giá trị -> xác nhận cột đó KHÔNG bị null toàn bộ."""
    # Dữ liệu ban đầu
    df = pd.DataFrame({
        "id": [1, 2, 3],
        "name": ["Alice", "Bob", "Charlie"],
        "age": [25, 30, 35]
    })
    
    # Giả lập no-op edit (Bob -> Bob)
    action = CleanAction(
        action_type="BATCH_EDIT_CELLS",
        column="all",
        params={
            "edits": [
                {"row_id": 1, "column": "name", "new_value": "Bob"}
            ]
        }
    )
    
    cleaned_df = apply_manual_actions(df, [action])
    
    # Xác nhận cột name không bị ảnh hưởng (không null, giữ nguyên giá trị)
    assert cleaned_df["name"].tolist() == ["Alice", "Bob", "Charlie"]
    assert cleaned_df.isna().sum().sum() == 0

def test_batch_edit_cells_invalid_row_id():
    """Test case 1: Gửi EDIT_CELL với row_id=None -> phải raise ValueError 400 rõ ràng."""
    df = pd.DataFrame({
        "id": [1, 2, 3],
        "name": ["Alice", "Bob", "Charlie"]
    })
    
    action = CleanAction(
        action_type="BATCH_EDIT_CELLS",
        column="all",
        params={
            "edits": [
                {"row_id": None, "column": "name", "new_value": "David"}
            ]
        }
    )
    
    with pytest.raises(ValueError, match="Không thể sửa ô: row_id không được để trống"):
        apply_manual_actions(df, [action])

def test_batch_edit_cells_missing_row_id():
    """Test case 1b: row_id không tồn tại trong index -> phải raise ValueError."""
    df = pd.DataFrame({
        "id": [1, 2, 3],
        "name": ["Alice", "Bob", "Charlie"]
    })
    
    action = CleanAction(
        action_type="BATCH_EDIT_CELLS",
        column="all",
        params={
            "edits": [
                {"row_id": 999, "column": "name", "new_value": "David"}
            ]
        }
    )
    
    with pytest.raises(ValueError, match="Không thể sửa ô: Dòng 999 không tồn tại"):
        apply_manual_actions(df, [action])
