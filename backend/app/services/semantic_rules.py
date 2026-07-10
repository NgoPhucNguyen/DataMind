"""
semantic_rules.py
-----------------
Single Source of Truth cho các rule ngữ nghĩa: Regex, Severity, và Threshold.
"""

import re
import pandas as pd
from typing import Any

# Danh sách các semantic type
SEMANTIC_TYPES = [
    "SEQUENCE_NUMBER",
    "PERSON_NAME",
    "PHONE_NUMBER",
    "EMAIL",
    "ADDRESS",
    "MONEY",
    "GENERAL_TEXT",
    "DATE_TIME",
    "CODE_ID"
]

# Regex patterns (đơn giản, mang tính minh họa, cần điều chỉnh theo thực tế)
EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")
# Generic international phone pattern — not locale-specific. 
# Nếu sau này cần validate chặt theo quốc gia cụ thể, cần thêm locale/country vào semantic context ở Profiler trước.
PHONE_REGEX = re.compile(r"^\+?\d{7,15}$")
# MONEY: cho phép dấu phẩy, chấm, ký hiệu tiền tệ
MONEY_REGEX = re.compile(r"^[+-]?\s*\$?\s*[\d,.]+\s*(?:VNĐ|VND|đ|\$)?$", re.IGNORECASE)

# Thresholds
MIN_ABSOLUTE_VIOLATION = 3
VIOLATION_PERCENT_THRESHOLD = 0.05

def is_valid_sequence(value: Any) -> bool:
    try:
        val = float(str(value).replace(',', ''))
        return val.is_integer() and val > 0
    except ValueError:
        return False

def validate_cell(value: Any, semantic_type: str) -> bool:
    """
    Kiểm tra tính hợp lệ của 1 cell dựa trên semantic_type.
    Trả về True nếu hợp lệ, False nếu vi phạm.
    """
    if pd.isna(value):
        return True # Tránh trùng lặp với lỗi Missing

    str_val = str(value).strip()
    if not str_val:
        return True

    if semantic_type == "EMAIL":
        return bool(EMAIL_REGEX.match(str_val))
    
    elif semantic_type == "PHONE_NUMBER":
        # Bỏ qua khoảng trắng, chấm, gạch ngang
        cleaned_phone = re.sub(r'[\s\.\-\(\)]', '', str_val)
        return bool(PHONE_REGEX.match(cleaned_phone))
        
    elif semantic_type == "SEQUENCE_NUMBER":
        return is_valid_sequence(value)
        
    elif semantic_type == "MONEY":
        return bool(MONEY_REGEX.match(str_val))
        
    elif semantic_type == "DATE_TIME":
        # Sử dụng pandas để parse xem có phải datetime không
        try:
            pd.to_datetime(str_val, errors='raise')
            return True
        except (ValueError, TypeError, OverflowError):
            return False

    elif semantic_type == "CODE_ID":
        # Mã thường không chứa khoảng trắng ở giữa (tùy định dạng, tạm dùng regex đơn giản không có ký tự đặc biệt)
        # Giả sử CODE_ID là các ký tự alphanumeric và gạch nối/ngang
        return bool(re.match(r"^[\w\.-]+$", str_val))

    elif semantic_type in ["PERSON_NAME", "ADDRESS"]:
        # Tên và địa chỉ tiếng Việt rất phức tạp, tạm thời chỉ check độ dài tối thiểu và không toàn số
        if len(str_val) < 2:
            return False
        if str_val.isdigit():
            return False
        return True

    # GENERAL_TEXT hoặc các loại chưa hỗ trợ: bỏ qua, coi như đúng
    return True

def get_semantic_severity(semantic_type: str) -> str:
    """
    Trả về mức độ nghiêm trọng ("error" hoặc "hint") của một semantic_type.
    """
    if semantic_type in ["EMAIL", "SEQUENCE_NUMBER", "DATE_TIME"]:
        return "error"
    return "hint"

def is_semantic_error_column(violation_count: int, total_non_null_rows: int) -> bool:
    """
    Kiểm tra xem số lượng vi phạm có vượt ngưỡng hệ thống để cảnh báo toàn cột hay không.
    MAX(3 cells, 5%)
    """
    if total_non_null_rows == 0:
        return False
        
    threshold_limit = max(MIN_ABSOLUTE_VIOLATION, total_non_null_rows * VIOLATION_PERCENT_THRESHOLD)
    return violation_count >= threshold_limit
