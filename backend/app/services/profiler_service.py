"""
profiler_service.py
-------------------
Phân tích cấu trúc DataFrame bằng Pandas.
KHÔNG hardcode tên cột — toàn bộ logic là dynamic iteration qua df.dtypes.
"""

import pandas as pd
import numpy as np
import re
from typing import Any

NUMERIC_PATTERNS_STRIP = r'[\$,đ\s%VND]'
NULL_SYNONYMS = {
    'n/a', 'na', 'null', 'none', 'nil', '-',
    '--', '?', 'missing', 'trống', 'không có'
}

def is_disguised_numeric(series: pd.Series, threshold: float = 0.6) -> dict:
    non_null = series.dropna()
    if len(non_null) == 0:
        return {"is_disguised": False}

    numeric_count = 0
    null_synonym_count = 0
    sample_convertible = []
    sample_problematic = []

    for val in non_null:
        cleaned = str(val).strip()
        lower = cleaned.lower()
        if lower in NULL_SYNONYMS:
            null_synonym_count += 1
            continue
        stripped = re.sub(NUMERIC_PATTERNS_STRIP, '', cleaned)
        stripped = stripped.replace('(', '-').replace(')', '')
        try:
            float(stripped)
            numeric_count += 1
            if len(sample_convertible) < 3:
                sample_convertible.append(f'"{val}" → {float(stripped)}')
        except ValueError:
            if len(sample_problematic) < 3:
                sample_problematic.append(str(val))

    total_meaningful = len(non_null) - null_synonym_count
    if total_meaningful == 0:
        return {"is_disguised": False}

    ratio = numeric_count / total_meaningful
    return {
        "is_disguised": ratio >= threshold,
        "convertible_ratio": round(ratio, 2),
        "null_synonym_count": null_synonym_count,
        "sample_convertible": sample_convertible,
        "sample_problematic": sample_problematic,
        "suggested_fix": "Chuyển sang kiểu số, giá trị không hợp lệ → NaN"
    }

def clean_to_numeric(series: pd.Series) -> pd.Series:
    def convert_val(val):
        if pd.isna(val):
            return None
        cleaned = str(val).strip()
        if cleaned.lower() in NULL_SYNONYMS:
            return None
        stripped = re.sub(NUMERIC_PATTERNS_STRIP, '', cleaned)
        stripped = stripped.replace('(', '-').replace(')', '')
        try:
            return float(stripped)
        except ValueError:
            return None
    return series.apply(convert_val)


# Ngưỡng phân loại categorical vs text
CATEGORICAL_UNIQUE_THRESHOLD = 15

# Ngưỡng tỷ lệ parse thành công để gán nhãn datetime
DATETIME_PARSE_THRESHOLD = 0.8

# Số giá trị mẫu tối đa trả về
SAMPLE_VALUE_LIMIT = 5


def _try_datetime(series: pd.Series) -> bool:
    """
    Thử parse cột string thành datetime.
    Nếu tỷ lệ parse thành công >= 80% → đây là cột datetime.
    """
    sample = series.dropna().head(100)
    if len(sample) == 0:
        return False
    try:
        parsed = pd.to_datetime(sample, format='mixed', errors="coerce") #add mixed
        success_rate = parsed.notna().mean()
        return float(success_rate) >= DATETIME_PARSE_THRESHOLD
    except Exception:
        return False


def _safe_sample_values(series: pd.Series, n: int = SAMPLE_VALUE_LIMIT) -> list[Any]:
    """
    Lấy n giá trị mẫu không null, convert sang Python native type để JSON-serializable.
    """
    samples = series.dropna().head(n).tolist()
    result = []
    for v in samples:
        if isinstance(v, (np.integer,)):
            result.append(int(v))
        elif isinstance(v, (np.floating,)):
            result.append(float(v))
        elif isinstance(v, (np.bool_,)):
            result.append(bool(v))
        elif pd.isna(v):
            continue
        else:
            result.append(str(v))
    return result


def _classify_column(series: pd.Series) -> tuple[str, list[str]]:
    """
    Phân loại 1 cột và trả về (detected_type, suggested_charts).
    Logic hoàn toàn dựa vào nội dung dữ liệu, không dùng tên cột.
    """
    dtype = series.dtype

    # 1. Numeric
    if pd.api.types.is_numeric_dtype(dtype):
        return "numeric", ["bar", "line", "histogram"]

    # 2. Datetime gốc (pandas đã nhận ra)
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime", ["line"]

    # 3. Object/String — phân tích sâu hơn
    if pd.api.types.is_object_dtype(dtype) or pd.api.types.is_string_dtype(dtype):
        # Thử datetime trước
        if _try_datetime(series):
            return "datetime", ["line"]

        unique_count = series.nunique()
        valid_series = series.dropna()
        valid_count = len(valid_series)

        if valid_count > 0:
            valid_strings = valid_series.astype(str)
            
            # Kiểm tra delimiter (dấu phẩy)
            comma_count = valid_strings.str.count(',')
            has_many_commas = (comma_count > 0).sum() > valid_count * 0.2
            
            if has_many_commas:
                all_tokens = valid_strings.str.split(',').explode().str.strip()
                if all_tokens.nunique() <= 25:
                    return "multiple_choice", ["bar", "pie"]

            # Nếu có ít giá trị unique và CÓ SỰ LẶP LẠI (chắc chắn là danh mục)
            if unique_count <= CATEGORICAL_UNIQUE_THRESHOLD and unique_count < valid_count:
                return "categorical", ["pie", "bar"]

            # Nếu là các giá trị unique hoặc số lượng unique lớn, kiểm tra độ dài
            avg_len = valid_strings.str.len().mean()
            if avg_len > 30:
                return "text", []

        # Fallback
        if unique_count <= CATEGORICAL_UNIQUE_THRESHOLD:
            return "categorical", ["pie", "bar"]

        # Text tự do
        return "text", []

    # 4. Boolean → coi như categorical
    if pd.api.types.is_bool_dtype(dtype):
        return "categorical", ["pie", "bar"]

    # Fallback
    return "text", []


def profile_dataframe(df: pd.DataFrame) -> list[dict]:
    """
    Hàm chính: nhận DataFrame, trả về list[dict] — mỗi dict là thông tin 1 cột.
    Tương ứng với list[ColumnProfile] trong schema.
    """
    total_rows = len(df)
    results = []

    for col_name in df.columns:
        series = df[col_name]

        detected_type, suggested_charts = _classify_column(series)

        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_rows * 100) if total_rows > 0 else 0.0, 2)
        unique_count = int(series.nunique())
        sample_values = _safe_sample_values(series)

        skip_chart = False
        skip_reason = None
        low_confidence = False
        disguised_numeric = None
        type_warning = None
        unnamed_warning = None

        # Cảnh báo cột được đổi tên từ "Unnamed"
        col_name_str = str(col_name)
        if col_name_str.startswith("Cột không tên"):
            unnamed_warning = "Cột này chưa có tên — bạn có thể đặt tên trong phần 'Sửa kiểu dữ liệu'."
        
        if unique_count <= 1:
            skip_chart = True
            skip_reason = "Không đủ variance (unique_count ≤ 1)"
            
        if detected_type == "text" or null_pct > 60:
            low_confidence = True

        if detected_type in ("text", "categorical"):
            disguised = is_disguised_numeric(series)
            if disguised.get("is_disguised"):
                detected_type = "numeric"
                suggested_charts = ["bar", "line", "histogram"]
                type_warning = "Cột này có thể là số — hệ thống phát hiện phần lớn giá trị có thể chuyển đổi"
                disguised_numeric = disguised

        results.append({
            "name": str(col_name),
            "detected_type": detected_type,
            "unique_count": unique_count,
            "null_count": null_count,
            "null_pct": null_pct,
            "sample_values": sample_values,
            "suggested_charts": suggested_charts,
            "skip_chart": skip_chart,
            "skip_reason": skip_reason,
            "low_confidence": low_confidence,
            "disguised_numeric": disguised_numeric,
            "type_warning": type_warning,
            "unnamed_warning": unnamed_warning,
        })

    return results
