"""
profiler_service.py
-------------------
Phân tích cấu trúc DataFrame bằng Pandas.
KHÔNG hardcode tên cột — toàn bộ logic là dynamic iteration qua df.dtypes.
"""

import pandas as pd
import numpy as np
from typing import Any


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
        parsed = pd.to_datetime(sample, errors="coerce")
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

        # Categorical nếu unique <= ngưỡng
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

        results.append({
            "name": str(col_name),
            "detected_type": detected_type,
            "unique_count": unique_count,
            "null_count": null_count,
            "null_pct": null_pct,
            "sample_values": sample_values,
            "suggested_charts": suggested_charts,
        })

    return results
