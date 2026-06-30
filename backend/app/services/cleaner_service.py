"""
cleaner_service.py
------------------
Logic Pandas thuần để detect issues và làm sạch dữ liệu.
KHÔNG hardcode tên cột — toàn bộ là dynamic iteration.

3 hàm chính:
  - detect_issues(df, overridden_types)  → dict (IssueReport-compatible)
  - auto_clean(df, overridden_types)     → (cleaned_df, dict DiffReport-compatible)
  - validate_clean_dataset(df)           → dict (can_proceed, hard_blocks, warnings, capabilities)
  - build_report_header(warnings, count) → dict (blocked, reason/disclaimer)
"""

import logging
import re
from typing import Any

import numpy as np
import pandas as pd

from app.services.profiler_service import clean_to_numeric

logger = logging.getLogger(__name__)

# Ngưỡng để xác định cột có thể convert sang số
NUMERIC_CONVERTIBLE_THRESHOLD = 0.80   # 80% non-null parse thành số

# Ký tự encoding lỗi cần detect
_BAD_CHAR_PATTERN = re.compile(r"[\ufffd\x00-\x1f]")


# ─── Helpers ────────────────────────────────────────────────────────────────

def _suggested_fill(col_type: str, null_pct: float) -> str:
    """Gợi ý cách fill missing dựa theo kiểu cột và tỷ lệ rỗng."""
    if null_pct >= 90.0:
        return "drop_column"
    if col_type == "numeric":
        return "median"
    if col_type == "datetime":
        return "drop_rows"
    # categorical hoặc text
    return "mode" if col_type == "categorical" else "Unknown"


def _count_bad_chars(series: pd.Series) -> tuple[int, list[str]]:
    """Đếm số ô có ký tự encoding lỗi và trả về vài ví dụ."""
    bad_count = 0
    bad_examples: list[str] = []
    for val in series.dropna():
        s = str(val)
        if _BAD_CHAR_PATTERN.search(s):
            bad_count += 1
            if len(bad_examples) < 3:
                bad_examples.append(s[:80])  # cắt ngắn để an toàn
    return bad_count, bad_examples


def _strip_bad_chars(val: Any) -> Any:
    """Strip ký tự encoding lỗi khỏi một ô dữ liệu. Dùng với Series.apply()."""
    if pd.isna(val):
        return val
    cleaned = _BAD_CHAR_PATTERN.sub("", str(val)).strip()
    return cleaned if cleaned else np.nan


def _is_numeric_convertible(series: pd.Series) -> tuple[bool, float]:
    """
    Kiểm tra xem cột object/string có thể convert thành số không.
    Trả về (có thể convert, tỷ lệ thành công).
    """
    non_null = series.dropna()
    if len(non_null) == 0:
        return False, 0.0

    parsed = clean_to_numeric(non_null)
    success_rate = float(parsed.notna().mean())
    return success_rate >= NUMERIC_CONVERTIBLE_THRESHOLD, round(success_rate * 100, 1)


def _safe_sample(series: pd.Series, n: int = 3) -> list[Any]:
    """Lấy n giá trị mẫu, JSON-safe."""
    samples = series.dropna().head(n).tolist()
    result = []
    for v in samples:
        if isinstance(v, (np.integer,)):
            result.append(int(v))
        elif isinstance(v, (np.floating,)):
            result.append(float(v))
        elif isinstance(v, (np.bool_,)):
            result.append(bool(v))
        else:
            result.append(str(v))
    return result


# ─── detect_issues ──────────────────────────────────────────────────────────

def detect_issues(
    df: pd.DataFrame,
    filename: str,
    file_hash: str,
    overridden_types: dict[str, str] | None = None,
) -> dict:
    """
    Quét toàn bộ DataFrame và phân loại vấn đề theo 4 nhóm.
    Trả về dict tương thích với IssueReport schema.
    """
    overridden_types = overridden_types or {}
    total_rows = len(df)

    missing_values = []
    wrong_types = []
    encoding_errors = []
    duplicates_info = None

    for col_name in df.columns:
        series = df[col_name]
        col_type = overridden_types.get(col_name, _infer_type(series))

        if col_type == "text":
            continue

        # ── 1. Missing values ──────────────────────────────
        null_count = int(series.isna().sum())
        if null_count > 0:
            null_pct = round(null_count / total_rows * 100, 2) if total_rows > 0 else 0.0
            missing_values.append({
                "column": str(col_name),
                "null_count": null_count,
                "null_pct": null_pct,
                "detected_type": col_type,
                "suggested_fill": _suggested_fill(col_type, null_pct),
            })

        # ── 2. Wrong type (chỉ kiểm tra cột object) ───────
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, pct = _is_numeric_convertible(series)
            if convertible:
                wrong_types.append({
                    "column": str(col_name),
                    "current_dtype": str(series.dtype),
                    "convertible_pct": pct,
                    "suggested_type": "float",
                    "sample_values": _safe_sample(series),
                })

        # ── 3. Encoding lỗi (chỉ cột string) ──────────────
        if pd.api.types.is_object_dtype(series.dtype):
            bad_count, bad_examples = _count_bad_chars(series)
            if bad_count > 0:
                encoding_errors.append({
                    "column": str(col_name),
                    "bad_char_count": bad_count,
                    "sample_bad_values": bad_examples,
                })

    # ── 4. Duplicate rows ──────────────────────────────────
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        duplicates_info = {
            "duplicate_count": dup_count,
            "total_rows": total_rows,
        }

    has_issues = bool(missing_values or wrong_types or encoding_errors or duplicates_info)

    return {
        "file_hash": file_hash,
        "filename": filename,
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "missing_values": missing_values,
        "wrong_types": wrong_types,
        "encoding_errors": encoding_errors,
        "duplicates": duplicates_info,
        "has_issues": has_issues,
    }


def _infer_type(series: pd.Series) -> str:
    """Suy luận nhanh kiểu cột để hỗ trợ detect_issues (không cần gọi profiler lại)."""
    if pd.api.types.is_numeric_dtype(series.dtype):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series.dtype):
        return "datetime"
    if pd.api.types.is_object_dtype(series.dtype):
        if series.nunique() <= 15:
            return "categorical"
    return "text"


# ─── auto_clean ─────────────────────────────────────────────────────────────
# Đây làm hàm auto_clean : chức năng là dọn dẹp dữ liệu dựa trên các quy tắc 
def auto_clean(
    df: pd.DataFrame,
    overridden_types: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, dict]:
    """
    Làm sạch tự động theo rule mặc định:
      - Duplicate rows → drop, giữ dòng đầu
      - Wrong type → convert sang numeric, lỗi → NaN
      - Encoding lỗi → strip ký tự xấu
      - Missing numeric → fill median
      - Missing text/categorical → fill mode hoặc "Unknown"

    Trả về (cleaned_df, diff_report_dict).
    """
    overridden_types = overridden_types or {}
    original_rows = len(df)
    original_cols = len(df.columns)

    # Làm việc trên bản copy để không mutate input
    cleaned = df.copy()

    missing_filled: dict[str, int] = {}
    types_converted: dict[str, str] = {}
    encoding_fixed: dict[str, int] = {}
    columns_dropped: list[str] = []

    # ── 0. Drop quá rỗng (>= 90%) ──────────────────────────
    for col_name in cleaned.columns:
        null_pct = cleaned[col_name].isna().sum() / original_rows * 100
        if null_pct >= 90.0:
            cleaned = cleaned.drop(columns=[col_name])
            columns_dropped.append(str(col_name))

    # ── 1. Drop duplicates ─────────────────────────────────
    before_dedup = len(cleaned)
    cleaned = cleaned.drop_duplicates(keep="first")
    duplicate_rows_removed = before_dedup - len(cleaned)

    # ── 2. Per-column operations ───────────────────────────
    for col_name in cleaned.columns:
        series = cleaned[col_name]
        col_type = overridden_types.get(col_name, _infer_type(series))

        if col_type == "text":
            continue

        # 2a. Strip encoding lỗi (chỉ cột string)
        if pd.api.types.is_object_dtype(series.dtype):
            new_series = series.apply(_strip_bad_chars)
            bad_fixed = int((series.fillna("").astype(str) != new_series.fillna("").astype(str)).sum())
            if bad_fixed > 0:
                encoding_fixed[str(col_name)] = bad_fixed
            cleaned[col_name] = new_series
            series = cleaned[col_name]  # refresh

        # 2b. Convert wrong type → numeric
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            original_dtype = str(series.dtype)
            converted = clean_to_numeric(series)
            cleaned[col_name] = converted
            types_converted[str(col_name)] = f"{original_dtype} → float64"
            series = cleaned[col_name]  # refresh

        # 2b2. Convert wrong type → datetime
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "datetime":
            original_dtype = str(series.dtype)
            converted = pd.to_datetime(series, errors='coerce')
            cleaned[col_name] = converted
            types_converted[str(col_name)] = f"{original_dtype} → datetime64"
            series = cleaned[col_name]  # refresh

        # 2c. Fill missing
        null_before = int(series.isna().sum())
        if null_before > 0:
            if col_type == "numeric":
                fill_val = series.median()
                cleaned[col_name] = series.fillna(fill_val)
            elif col_type in ["categorical", "multiple_choice"]:
                cleaned[col_name] = series.fillna("Không xác định")
            elif col_type == "datetime":
                pass
            else:
                cleaned[col_name] = series.fillna("Không xác định")

        null_after = int(cleaned[col_name].isna().sum()) if col_name in cleaned.columns else 0
        filled_count = null_before - null_after
        if filled_count > 0:
            missing_filled[str(col_name)] = filled_count

    diff_report = {
        "original_rows": original_rows,
        "clean_rows": len(cleaned),
        "original_cols": original_cols,
        "clean_cols": len(cleaned.columns),
        "duplicate_rows_removed": duplicate_rows_removed,
        "columns_dropped": columns_dropped,
        "missing_filled": missing_filled,
        "types_converted": types_converted,
        "encoding_fixed": encoding_fixed,
    }

    return cleaned, diff_report


# ─── validate_clean_dataset ─────────────────────────────────────────────────

def validate_clean_dataset(df: pd.DataFrame) -> dict:
    """
    Kiểm tra dataset sau khi clean bằng hệ thống 2 tầng:
      - hard_blocks: lỗi nghiêm trọng, không cho đi tiếp
      - warnings: cảnh báo, cho đi tiếp nhưng thông báo cho user

    Trả về dict:
      {
        "can_proceed": bool,
        "hard_blocks": [...],
        "warnings": [...],
        "capabilities": {...}
      }
    """
    hard_blocks = []
    warnings = []

    # ── HARD BLOCK — chắc chắn crash nếu cho đi tiếp ──────────────────
    if len(df) == 0:
        hard_blocks.append({
            "code": "EMPTY_DATASET",
            "message": "Dataset không có dòng dữ liệu nào"
        })

    dupes = [c for c in df.columns if df.columns.tolist().count(c) > 1]
    if dupes:
        hard_blocks.append({
            "code": "DUPLICATE_COLUMNS",
            "message": f"Cột trùng tên: {', '.join(set(dupes))}"
        })

    # ── WARNING — cho đi tiếp nhưng cảnh báo ──────────────────────────
    if 0 < len(df) < 10:
        warnings.append({
            "code": "LOW_ROW_COUNT",
            "message": f"Dataset chỉ có {len(df)} dòng",
            "impact": "Correlation và thống kê suy diễn không có ý nghĩa"
        })

    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    if len(numeric_cols) == 0:
        warnings.append({
            "code": "NO_NUMERIC_COLUMNS",
            "message": "Không có cột số",
            "impact": "Chỉ có thể vẽ Bar Chart và Pie Chart"
        })

    # ── CAPABILITIES — tính dựa trên dataset properties ────────────────
    capabilities = {
        "bar_chart": len(df) >= 1,
        "pie_chart": len(df) >= 1,
        "histogram": len(numeric_cols) >= 1 and len(df) >= 5,
        "box_plot": len(numeric_cols) >= 1,
        "correlation": len(numeric_cols) >= 2 and len(df) >= 10,
        "scatter": len(numeric_cols) >= 2,
        "line_chart": len(df) >= 2,
    }

    return {
        "can_proceed": len(hard_blocks) == 0,
        "hard_blocks": hard_blocks,
        "warnings": warnings,
        "capabilities": capabilities,
    }


# ─── build_report_header ────────────────────────────────────────────────────

def build_report_header(warnings: list, row_count: int) -> dict:
    """
    Tạo header cho báo cáo/export.
    Nếu dataset quá nhỏ → block; nếu có warning LOW_ROW_COUNT → disclaimer.
    """
    if row_count < 2:
        return {"blocked": True, "reason": "Không đủ dữ liệu để tạo báo cáo"}

    disclaimer = None
    if any(
        (isinstance(w, dict) and w.get("code") == "LOW_ROW_COUNT") or 
        (hasattr(w, "code") and w.code == "LOW_ROW_COUNT") 
        for w in warnings
    ):
        disclaimer = (
            f"⚠ Báo cáo được tạo từ dataset chỉ có {row_count} dòng. "
            "Kết quả mang tính tham khảo."
        )

    return {"blocked": False, "disclaimer": disclaimer}


# ─── build_summary_for_module3 ──────────────────────────────────────────────

def build_summary_for_module3(df: pd.DataFrame) -> dict:
    """
    Tạo summary nhỏ gọn để truyền sang Module 3 mà không cần parse lại file.
    """
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = [
        c for c in df.columns
        if pd.api.types.is_object_dtype(df[c]) or isinstance(df[c].dtype, pd.CategoricalDtype)
    ]
    return {
        "shape": [len(df), len(df.columns)],
        "columns": list(df.columns.astype(str)),
        "dtypes": {str(c): str(df[c].dtype) for c in df.columns},
        "numeric_columns": [str(c) for c in numeric_cols],
        "categorical_columns": [str(c) for c in categorical_cols],
    }
