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
from app.core.rules import (
    CATEGORICAL_UNIQUE_THRESHOLD,
    DATETIME_PARSE_THRESHOLD,
    DATETIME_SAMPLE_LIMIT,
    COMMA_ROW_RATIO_THRESHOLD,
    MULTIPLE_CHOICE_TOKEN_MAX,
    TEXT_AVG_LENGTH_THRESHOLD,
    DISGUISED_NUMERIC_THRESHOLD,
    THOUSANDS_NUMERIC_THRESHOLD,
    NULL_WARNING_PCT_THRESHOLD,
    SAMPLE_VALUE_LIMIT,
)

NUMERIC_PATTERNS_STRIP = r'[\$,đ\s%VND]'
NULL_SYNONYMS = {
    'n/a', 'na', 'null', 'none', 'nil', '-',
    '--', '?', 'missing', 'trống', 'không có'
}

BOOLEAN_STRING_VALUES = {
    'true', 'false', 'có', 'không'
}

THOUSANDS_NUMERIC_PATTERN = re.compile(
    r'^\s*\(?\s*[\$]?\s*-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*(?:[đĐ]|VND|vnd|%|\$)?\s*\)?\s*$',
    re.IGNORECASE
)

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


def _try_datetime(series: pd.Series) -> tuple[bool, float]:
    """
    Thử parse cột string thành datetime.
    Nếu tỷ lệ parse thành công >= 80% → đây là cột datetime.
    Trả về: (is_datetime, parse_rate)
    """
    sample = series.dropna().head(DATETIME_SAMPLE_LIMIT)
    if len(sample) == 0:
        return False, 0.0
    try:
        parsed = pd.to_datetime(sample, format='mixed', errors="coerce")
        success_rate = float(parsed.notna().mean())
        return success_rate >= DATETIME_PARSE_THRESHOLD, round(success_rate, 3)
    except Exception:
        return False, 0.0


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


def _classify_column(series: pd.Series) -> tuple[str, list[str], dict]:
    """
    Phân loại 1 cột và trả về (detected_type, suggested_charts, detection_reason).
    Logic hoàn toàn dựa vào nội dung dữ liệu, không dùng tên cột.
    """
    dtype = series.dtype
    native_dtype_str = str(dtype)
    valid_series = series.dropna()
    valid_count = len(valid_series)
    unique_count = int(series.nunique())

    metrics: dict[str, Any] = {
        "native_dtype": native_dtype_str,
        "non_null_count": valid_count,
        "unique_count": unique_count,
    }
    checks: list[dict[str, Any]] = []

    # 1. Numeric (loại trừ boolean vì trong Pandas bool có thể thỏa mãn is_numeric_dtype)
    if pd.api.types.is_numeric_dtype(dtype) and not pd.api.types.is_bool_dtype(dtype):
        checks.append({
            "check": "is_numeric_dtype",
            "value": 1,
            "threshold": 1,
            "op": "==",
            "passed": True
        })
        reason = {
            "rule_id": "native_numeric",
            "metrics": metrics,
            "checks": checks
        }
        return "numeric", ["bar", "line", "histogram"], reason

    # 2. Boolean gốc → coi như categorical
    if pd.api.types.is_bool_dtype(dtype):
        checks.append({
            "check": "is_bool_dtype",
            "value": 1,
            "threshold": 1,
            "op": "==",
            "passed": True
        })
        reason = {
            "rule_id": "native_bool",
            "metrics": metrics,
            "checks": checks
        }
        return "categorical", ["pie", "bar"], reason

    # 3. Datetime gốc (pandas đã nhận ra)
    if pd.api.types.is_datetime64_any_dtype(dtype):
        checks.append({
            "check": "is_datetime64_dtype",
            "value": 1,
            "threshold": 1,
            "op": "==",
            "passed": True
        })
        reason = {
            "rule_id": "native_datetime",
            "metrics": metrics,
            "checks": checks
        }
        return "datetime", ["line"], reason

    # 4. Object/String — phân tích sâu hơn
    if pd.api.types.is_object_dtype(dtype) or pd.api.types.is_string_dtype(dtype):
        # Thử datetime trước
        is_dt, dt_rate = _try_datetime(series)
        metrics["datetime_parse_rate"] = dt_rate
        dt_passed = is_dt
        checks.append({
            "check": "datetime_parse_rate",
            "value": dt_rate,
            "threshold": DATETIME_PARSE_THRESHOLD,
            "op": ">=",
            "passed": dt_passed
        })
        if dt_passed:
            reason = {
                "rule_id": "datetime_parsed",
                "metrics": metrics,
                "checks": checks
            }
            return "datetime", ["line"], reason

        if valid_count > 0:
            valid_strings = valid_series.astype(str)
            stripped_lower = valid_strings.str.strip().str.lower()

            # Kiểm tra object cột có phải toàn giá trị Boolean dạng chuỗi: true/false/có/không
            is_bool_str = bool(stripped_lower.isin(BOOLEAN_STRING_VALUES).all())
            if is_bool_str:
                checks.append({
                    "check": "all_bool_strings",
                    "value": 1,
                    "threshold": 1,
                    "op": "==",
                    "passed": True
                })
                reason = {
                    "rule_id": "bool_strings",
                    "metrics": metrics,
                    "checks": checks
                }
                return "categorical", ["pie", "bar"], reason

            # Kiểm tra số có phân cách hàng nghìn (ví dụ "100,000", "1,250,000 VND", "(2,500)")
            thousands_match_count = int(stripped_lower.apply(lambda s: bool(THOUSANDS_NUMERIC_PATTERN.match(s))).sum())
            thousands_ratio = round(thousands_match_count / valid_count, 3)
            metrics["thousands_match_ratio"] = thousands_ratio
            is_likely_thousands = thousands_ratio >= THOUSANDS_NUMERIC_THRESHOLD

            if is_likely_thousands:
                checks.append({
                    "check": "thousands_match_ratio",
                    "value": thousands_ratio,
                    "threshold": THOUSANDS_NUMERIC_THRESHOLD,
                    "op": ">=",
                    "passed": True
                })
            else:
                comma_count = valid_strings.str.count(',')
                comma_ratio = round(float((comma_count > 0).sum() / valid_count), 3)
                metrics["comma_row_ratio"] = comma_ratio
                has_many_commas = comma_ratio > COMMA_ROW_RATIO_THRESHOLD

                checks.append({
                    "check": "comma_row_ratio",
                    "value": comma_ratio,
                    "threshold": COMMA_ROW_RATIO_THRESHOLD,
                    "op": ">",
                    "passed": has_many_commas
                })

                if has_many_commas:
                    all_tokens = valid_strings.str.split(',').explode().str.strip()
                    token_unique = int(all_tokens.nunique())
                    metrics["token_unique_count"] = token_unique
                    is_mc = token_unique <= MULTIPLE_CHOICE_TOKEN_MAX
                    checks.append({
                        "check": "token_unique_count",
                        "value": token_unique,
                        "threshold": MULTIPLE_CHOICE_TOKEN_MAX,
                        "op": "<=",
                        "passed": is_mc
                    })
                    if is_mc:
                        reason = {
                            "rule_id": "multiple_choice",
                            "metrics": metrics,
                            "checks": checks
                        }
                        return "multiple_choice", ["bar", "pie"], reason

            # Nếu có ít giá trị unique và CÓ SỰ LẶP LẠI (chắc chắn là danh mục)
            is_unique_le_thresh = unique_count <= CATEGORICAL_UNIQUE_THRESHOLD
            checks.append({
                "check": "unique_count",
                "value": unique_count,
                "threshold": CATEGORICAL_UNIQUE_THRESHOLD,
                "op": "<=",
                "passed": is_unique_le_thresh
            })
            if is_unique_le_thresh:
                repeat_count = valid_count - unique_count
                has_repeats = repeat_count > 0
                checks.append({
                    "check": "has_repeats",
                    "value": repeat_count,
                    "threshold": 0,
                    "op": ">",
                    "passed": has_repeats
                })
                if has_repeats:
                    reason = {
                        "rule_id": "categorical_repeats",
                        "metrics": metrics,
                        "checks": checks
                    }
                    return "categorical", ["pie", "bar"], reason

            # Nếu là các giá trị unique hoặc số lượng unique lớn, kiểm tra độ dài
            avg_len = round(float(valid_strings.str.len().mean()), 1)
            metrics["avg_len"] = avg_len
            is_long_text = avg_len > TEXT_AVG_LENGTH_THRESHOLD
            checks.append({
                "check": "avg_len",
                "value": avg_len,
                "threshold": TEXT_AVG_LENGTH_THRESHOLD,
                "op": ">",
                "passed": is_long_text
            })
            if is_long_text:
                reason = {
                    "rule_id": "text_long",
                    "metrics": metrics,
                    "checks": checks
                }
                return "text", [], reason

        # Fallback
        is_cat_fallback = unique_count <= CATEGORICAL_UNIQUE_THRESHOLD
        checks.append({
            "check": "categorical_unique_fallback",
            "value": unique_count,
            "threshold": CATEGORICAL_UNIQUE_THRESHOLD,
            "op": "<=",
            "passed": is_cat_fallback
        })
        if is_cat_fallback:
            reason = {
                "rule_id": "categorical_fallback",
                "metrics": metrics,
                "checks": checks
            }
            return "categorical", ["pie", "bar"], reason

        # Text tự do
        checks.append({
            "check": "text_fallback",
            "value": unique_count,
            "threshold": CATEGORICAL_UNIQUE_THRESHOLD,
            "op": ">",
            "passed": True
        })
        reason = {
            "rule_id": "text_fallback",
            "metrics": metrics,
            "checks": checks
        }
        return "text", [], reason

    # 5. Boolean fallback (nếu có kiểu bool đặc biệt khác)
    if pd.api.types.is_bool_dtype(dtype):
        checks.append({
            "check": "is_bool_dtype_fallback",
            "value": 1,
            "threshold": 1,
            "op": "==",
            "passed": True
        })
        reason = {
            "rule_id": "native_bool",
            "metrics": metrics,
            "checks": checks
        }
        return "categorical", ["pie", "bar"], reason

    # Fallback
    checks.append({
        "check": "general_fallback",
        "value": 1,
        "threshold": 1,
        "op": "==",
        "passed": True
    })
    reason = {
        "rule_id": "text_fallback",
        "metrics": metrics,
        "checks": checks
    }
    return "text", [], reason


def profile_dataframe(df: pd.DataFrame) -> list[dict]:
    """
    Hàm chính: nhận DataFrame, trả về list[dict] — mỗi dict là thông tin 1 cột.
    Tương ứng với list[ColumnProfile] trong schema.
    """
    total_rows = len(df)
    results = []

    for col_name in df.columns:
        series = df[col_name]

        detected_type, suggested_charts, detection_reason = _classify_column(series)

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
            unnamed_warning = "Cột này chưa có tên — bạn có thể đặt lại tên ở bước Làm sạch (menu thao tác thủ công)."
        
        if unique_count <= 1:
            skip_chart = True
            skip_reason = "Không đủ variance (unique_count ≤ 1)"
            
        if detected_type == "text" or null_pct > NULL_WARNING_PCT_THRESHOLD:
            low_confidence = True

        if detected_type in ("text", "categorical"):
            disguised = is_disguised_numeric(series, threshold=DISGUISED_NUMERIC_THRESHOLD)
            if disguised.get("is_disguised"):
                detected_type = "numeric"
                suggested_charts = ["bar", "line", "histogram"]
                type_warning = "Cột này có thể là số — hệ thống phát hiện phần lớn giá trị có thể chuyển đổi"
                disguised_numeric = disguised
                
                # Cập nhật detection_reason cho disguised_numeric
                conv_ratio = round(float(disguised.get("convertible_ratio", 0.0)), 3)
                detection_reason["rule_id"] = "disguised_numeric"
                detection_reason["metrics"]["disguised_ratio"] = conv_ratio
                detection_reason["checks"].append({
                    "check": "disguised_numeric_ratio",
                    "value": conv_ratio,
                    "threshold": DISGUISED_NUMERIC_THRESHOLD,
                    "op": ">=",
                    "passed": True
                })

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
            "detection_reason": detection_reason,
        })

    return results
