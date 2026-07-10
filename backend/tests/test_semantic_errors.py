import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import pandas as pd
from app.services.cleaner_service import detect_issues, _get_error_cells
from app.services.semantic_rules import validate_cell

def test_semantic_fallback_and_validation():
    # Giả lập data
    df = pd.DataFrame({
        "emails": ["valid@email.com", "invalid-email", "test@test.com", "no-at-sign.com", "another@val.id"],
        "phones": ["+1234567890", "12345", "0987654321", "+442071234567", "invalid-phone"],
        "random_text": ["a", "b", "c", "d", "e"]
    })
    
    # 1. Test fallback logic (giống LLM fallback)
    # Gemini trả về confidence thấp cho cột random_text
    raw_column_semantics = {
        "emails": {"semantic_type": "EMAIL", "confidence": 0.9},
        "phones": {"semantic_type": "PHONE_NUMBER", "confidence": 0.8},
        "random_text": {"semantic_type": "CODE_ID", "confidence": 0.4} # Dưới 0.75
    }
    
    # Mô phỏng quá trình map từ raw LLM output thành column_semantics an toàn
    column_semantics = {}
    for col, info in raw_column_semantics.items():
        if info["confidence"] < 0.75:
            column_semantics[col] = "GENERAL_TEXT"
        else:
            column_semantics[col] = info["semantic_type"]
            
    assert column_semantics["random_text"] == "GENERAL_TEXT"
    
    # 2. Test detect_issues vs manual_clean_preview consistency
    # (Đảm bảo error_cells của 2 luồng đều bắt chung lỗi)
    
    report = detect_issues(
        df=df,
        filename="test.csv",
        file_hash="dummy_hash",
        overridden_types={"emails": "text", "phones": "text", "random_text": "text"},
        column_semantics=column_semantics
    )
    
    preview_error_cells = _get_error_cells(
        df=df, 
        overridden_types={"emails": "text", "phones": "text", "random_text": "text"}, 
        column_semantics=column_semantics
    )
    
    detect_semantic_cells = [c for c in report["error_cells"] if c["issue_type"] == "semantic_error"]
    preview_semantic_cells = [c for c in preview_error_cells if c["issue_type"] == "semantic_error"]
    
    # Phải bắt được lỗi ở dòng 1 và 3 cột emails
    assert len(detect_semantic_cells) == 4 # 2 email lỗi + 2 phone lỗi
    assert detect_semantic_cells == preview_semantic_cells
    
    # 3. Test report column level
    assert len(report["semantic_errors"]) == 0 # Tại sao bằng 0? Vì threshold = MAX(3, 5%). Email lỗi 2 cell < 3 -> không report cấp cột.
    
    # 4. Ép lỗi nhiều để test threshold
    df_large = pd.DataFrame({
        "emails": ["valid@email.com"] * 100 + ["invalid1", "invalid2", "invalid3", "invalid4"]
    })
    
    report_large = detect_issues(
        df=df_large,
        filename="test2.csv",
        file_hash="dummy_hash",
        overridden_types={"emails": "text"},
        column_semantics={"emails": "EMAIL"}
    )
    
    # 4 cells lỗi > MAX(3, 5% của 104 = 5.2) -> Khoan, 5.2 thì 4 cells < 5.2.
    # Vậy 4 cells chưa đủ, phải cần 6 cells.
    df_large_2 = pd.DataFrame({
        "emails": ["valid@email.com"] * 100 + ["i1", "i2", "i3", "i4", "i5", "i6"]
    })
    report_large_2 = detect_issues(
        df=df_large_2,
        filename="test3.csv",
        file_hash="dummy_hash",
        overridden_types={"emails": "text"},
        column_semantics={"emails": "EMAIL"}
    )
    assert len(report_large_2["semantic_errors"]) == 1
    assert report_large_2["semantic_errors"][0]["column"] == "emails"
    assert report_large_2["semantic_errors"][0]["severity"] == "error"

def test_semantic_safety_net():
    # Giả lập data bị LLM nhận diện sai
    df = pd.DataFrame({
        "sequence_id": ["SEQ-101", "SEQ-102", "SEQ-103", "SEQ-104", "110"]
    })
    
    # LLM nhận diện nhầm cột sequence_id (chứa chữ) thành SEQUENCE_NUMBER (error severity)
    report = detect_issues(
        df=df,
        filename="test.csv",
        file_hash="dummy_hash",
        overridden_types={"sequence_id": "text"},
        column_semantics={"sequence_id": "SEQUENCE_NUMBER"}
    )
    
    # 4/5 ô vi phạm rule SEQUENCE_NUMBER -> 80% violation > 50%
    # Hệ thống phải tự động downgrade severity xuống hint và KHÔNG báo lỗi ở cấp hệ thống (semantic_errors rỗng)
    assert len(report["semantic_errors"]) == 0
    
    # Kiểm tra error_cells ở cấp cell
    error_cells = report["error_cells"]
    assert len(error_cells) == 4
    for cell in error_cells:
        assert cell["issue_type"] == "semantic_error"
        assert cell["semantic_type"] == "SEQUENCE_NUMBER"
        assert cell["severity"] == "hint" # Đã được downgrade từ error xuống hint

if __name__ == "__main__":
    pytest.main(["-v", __file__])
