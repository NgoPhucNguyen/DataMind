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

from app.core import cache
from app.core.rules import (
    CLEANER_DROP_COLUMN_NULL_PCT,
    CLEANER_FILL_NUMERIC,
    CLEANER_FILL_CATEGORICAL,
    CLEANER_FILL_MULTIPLE_CHOICE,
    CLEANER_FILL_DATETIME,
    CLEANER_FILL_TEXT,
    CLEANER_PREVIEW_ROWS,
    CLEANER_NEAR_EMPTY_ROW_THRESHOLD,
    CLEANER_DUPLICATE_WARNING_PCT,
)
from app.services.profiler_service import clean_to_numeric, NULL_SYNONYMS, NUMERIC_PATTERNS_STRIP
from app.services import semantic_rules

logger = logging.getLogger(__name__)

# Ngưỡng để xác định cột có thể convert sang số
NUMERIC_CONVERTIBLE_THRESHOLD = 0.80   # 80% non-null parse thành số

# Ký tự encoding lỗi cần detect
_BAD_CHAR_PATTERN = re.compile(r"[\ufffd\x00-\x1f]")

VALID_TYPES = {"numeric", "datetime", "categorical", "multiple_choice", "text"}


def resolve_column_type(
    col_name: str,
    series: pd.Series,
    overridden_types: dict[str, str] | None = None,
    profile_types: dict[str, str] | None = None,
    user_id: int | None = None,
    file_hash: str | None = None,
) -> str:
    """
    Determine logical column type following SSOT priority:
      1. overridden_types[col] (if not 'auto' and in VALID_TYPES)
      2. profile detected_type from profile_types
      3. _infer_type fallback (profile missing)
    Same order as visualize_service. Does not call the cache.
    """
    col_str = str(col_name)
    col_override = (overridden_types or {}).get(col_name) or (overridden_types or {}).get(col_str)
    if col_override == "auto":
        col_override = None

    if col_override in VALID_TYPES:
        return col_override

    prof_detected = (profile_types or {}).get(col_name) or (profile_types or {}).get(col_str)
    if prof_detected in VALID_TYPES:
        return prof_detected

    if series is not None:
        return _infer_type(series)
    return "text"


def is_integer_numeric(series: pd.Series) -> bool:
    """Check if all non-empty values of a numeric series are whole numbers."""
    non_empty = series.dropna()
    if len(non_empty) == 0:
        return False
    if pd.api.types.is_integer_dtype(non_empty.dtype):
        return True
    try:
        numeric_vals = pd.to_numeric(non_empty, errors="coerce")
        if numeric_vals.isna().any():
            return False
        return bool((numeric_vals % 1 == 0).all())
    except Exception:
        return False


# ─── Helpers ────────────────────────────────────────────────────────────────

def _suggested_fill(col_type: str, null_pct: float) -> str:
    """Gợi ý cách fill missing mô tả chính xác hành vi của auto_clean theo từng kiểu."""
    if null_pct >= CLEANER_DROP_COLUMN_NULL_PCT:
        return "drop_column"
    if col_type == "numeric":
        return "median"
    if col_type == "datetime":
        return "keep_empty"
    # categorical hoặc text
    if col_type in ["categorical", "multiple_choice"]:
        return CLEANER_FILL_CATEGORICAL
    if col_type == "text":
        return "skipped"
    return CLEANER_FILL_CATEGORICAL


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


def _get_error_cells(
    df: pd.DataFrame,
    overridden_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    user_id: int | None = None,
    file_hash: str | None = None,
    profile_types: dict[str, str] | None = None,
    downgraded_cols: set[str] | None = None,
    resolved_types: dict[str, str] | None = None,
) -> list[dict]:
    """
    Trả về danh sách các ô (cell) bị lỗi.
    [{"row_id": int, "column": str, "issue_type": "missing" | "type_mismatch" | "encoding" | "semantic_error"}]
    Toàn bộ kiểm tra được vectorize theo cột (không dùng per-cell loop).
    """
    error_cells = []
    col_sem = column_semantics or {}
    downgraded = downgraded_cols or set()

    for col_name in df.columns:
        col_str = str(col_name)
        series = df[col_name]
        col_type = (resolved_types or {}).get(col_str) or resolve_column_type(col_name, series, overridden_types, profile_types, user_id, file_hash)

        # 4. Semantic errors (must be checked before skipping text columns)
        semantic_type = col_sem.get(col_str, "GENERAL_TEXT")
        if semantic_type != "GENERAL_TEXT":
            severity = "hint" if col_str in downgraded else semantic_rules.get_semantic_severity(semantic_type)
            non_null = series.dropna()
            if len(non_null) > 0:
                str_s = non_null.astype(str).str.strip()
                non_empty = str_s[str_s != ""]
                if len(non_empty) > 0:
                    if semantic_type == "EMAIL":
                        inv_mask = ~non_empty.str.match(semantic_rules.EMAIL_REGEX)
                        inv_indices = non_empty.index[inv_mask]
                    elif semantic_type == "PHONE_NUMBER":
                        cleaned_p = non_empty.str.replace(r'[\s\.\-\(\)]', '', regex=True)
                        inv_mask = ~cleaned_p.str.match(semantic_rules.PHONE_REGEX)
                        inv_indices = non_empty.index[inv_mask]
                    elif semantic_type == "MONEY":
                        inv_mask = ~non_empty.str.match(semantic_rules.MONEY_REGEX)
                        inv_indices = non_empty.index[inv_mask]
                    elif semantic_type == "CODE_ID":
                        inv_mask = ~non_empty.str.match(r"^[\w\.-]+$")
                        inv_indices = non_empty.index[inv_mask]
                    elif semantic_type == "DATE_TIME":
                        parsed_dt = pd.to_datetime(non_empty, format='mixed', errors='coerce')
                        inv_indices = non_empty.index[parsed_dt.isna()]
                    else:
                        inv_indices = [idx for idx, val in non_empty.items() if not semantic_rules.validate_cell(val, semantic_type)]

                    for idx in inv_indices:
                        error_cells.append({
                            "row_id": int(idx),
                            "column": col_str,
                            "issue_type": "semantic_error",
                            "severity": severity,
                            "semantic_type": semantic_type,
                        })

        if col_type == "text":
            continue

        # 1. Missing values
        missing_mask = series.isna()
        missing_indices = series.index[missing_mask]
        suggested_val = None
        if len(missing_indices) > 0:
            if col_type == "numeric":
                non_null_num = clean_to_numeric(series.dropna()).dropna()
                if len(non_null_num) > 0:
                    med = float(non_null_num.median())
                    if pd.notna(med):
                        suggested_val = int(round(med)) if is_integer_numeric(non_null_num) else round(med, 2)
            elif col_type in ["categorical", "multiple_choice"]:
                suggested_val = CLEANER_FILL_CATEGORICAL

            for idx in missing_indices:
                error_cells.append({
                    "row_id": int(idx),
                    "column": col_str,
                    "issue_type": "missing",
                    **({"suggested_value": suggested_val} if suggested_val is not None else {}),
                })

        # 2. Wrong type
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, _ = _is_numeric_convertible(series)
            if convertible:
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                mismatch_indices = non_null.index[parsed.isna()]
                for idx in mismatch_indices:
                    error_cells.append({
                        "row_id": int(idx),
                        "column": col_str,
                        "issue_type": "type_mismatch",
                    })

        # 3. Encoding lỗi
        if pd.api.types.is_object_dtype(series.dtype):
            non_null_str = series.dropna().astype(str)
            bad_mask = non_null_str.str.contains(_BAD_CHAR_PATTERN, regex=True)
            for idx in non_null_str.index[bad_mask]:
                error_cells.append({
                    "row_id": int(idx),
                    "column": col_str,
                    "issue_type": "encoding",
                })
                    
    return error_cells


def get_error_row_indices(
    df: pd.DataFrame,
    overridden_types: dict[str, str] | None = None,
    profile_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    downgraded_cols: set[str] | None = None,
    resolved_types: dict[str, str] | None = None,
    include_duplicates: bool = True,
) -> list[int]:
    """
    Trả về danh sách row index (original index) có ít nhất 1 lỗi trên toàn bộ file:
    - Missing values ở cột không phải text
    - Wrong types (cột object có thể chuyển sang số nhưng có ô không parse được)
    - Encoding lỗi (chứa replacement/control chars)
    - Semantic errors (vi phạm regex/rule ngữ nghĩa)
    - Duplicates & near-empty rows (nếu include_duplicates=True)
    """
    if df.empty:
        return []

    error_mask = pd.Series(False, index=df.index)

    if include_duplicates:
        dup_mask = df.duplicated()
        error_mask = error_mask | dup_mask

        total_cols = len(df.columns)
        if total_cols > 0:
            null_per_row = df.isna().sum(axis=1)
            for c in df.select_dtypes(include=["object"]).columns:
                str_empty = df[c].dropna().astype(str).str.strip().isin(["", "nan", "None", "null", "NaN"])
                if len(str_empty[str_empty]) > 0:
                    null_per_row.loc[str_empty[str_empty].index] += 1
            near_empty_mask = (null_per_row / total_cols >= CLEANER_NEAR_EMPTY_ROW_THRESHOLD)
            error_mask = error_mask | near_empty_mask

    col_sem = column_semantics or {}
    downgraded = downgraded_cols or set()

    for col_name in df.columns:
        col_str = str(col_name)
        series = df[col_name]
        col_type = (resolved_types or {}).get(col_str) or resolve_column_type(
            col_name, series, overridden_types, profile_types
        )

        # Semantic error rows
        semantic_type = col_sem.get(col_str, "GENERAL_TEXT")
        if semantic_type != "GENERAL_TEXT":
            non_null = series.dropna()
            if len(non_null) > 0:
                str_s = non_null.astype(str).str.strip()
                non_empty = str_s[str_s != ""]
                if len(non_empty) > 0:
                    if semantic_type == "EMAIL":
                        inv_mask = ~non_empty.str.match(semantic_rules.EMAIL_REGEX)
                        error_mask.loc[non_empty.index[inv_mask]] = True
                    elif semantic_type == "PHONE_NUMBER":
                        cleaned_p = non_empty.str.replace(r'[\s\.\-\(\)]', '', regex=True)
                        inv_mask = ~cleaned_p.str.match(semantic_rules.PHONE_REGEX)
                        error_mask.loc[non_empty.index[inv_mask]] = True
                    elif semantic_type == "MONEY":
                        inv_mask = ~non_empty.str.match(semantic_rules.MONEY_REGEX)
                        error_mask.loc[non_empty.index[inv_mask]] = True
                    elif semantic_type == "CODE_ID":
                        inv_mask = ~non_empty.str.match(r"^[\w\.-]+$")
                        error_mask.loc[non_empty.index[inv_mask]] = True
                    elif semantic_type == "DATE_TIME":
                        parsed_dt = pd.to_datetime(non_empty, format='mixed', errors='coerce')
                        error_mask.loc[non_empty.index[parsed_dt.isna()]] = True
                    else:
                        inv_indices = [idx for idx, val in non_empty.items() if not semantic_rules.validate_cell(val, semantic_type)]
                        if inv_indices:
                            error_mask.loc[inv_indices] = True

        if col_type == "text":
            continue

        # Missing values
        missing_mask = series.isna()
        if missing_mask.any():
            error_mask = error_mask | missing_mask

        # Wrong type
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, _ = _is_numeric_convertible(series)
            if convertible:
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                mismatch_indices = non_null.index[parsed.isna()]
                if len(mismatch_indices) > 0:
                    error_mask.loc[mismatch_indices] = True

        # Bad encoding
        if pd.api.types.is_object_dtype(series.dtype):
            non_null_str = series.dropna().astype(str)
            bad_mask = non_null_str.str.contains(_BAD_CHAR_PATTERN, regex=True)
            if bad_mask.any():
                error_mask.loc[non_null_str.index[bad_mask]] = True

    return [int(idx) for idx in df.index[error_mask].tolist()]


def locate_row(
    df: pd.DataFrame,
    excel_row: int,
    mode: str = "all",
    original_df: pd.DataFrame | None = None,
    overridden_types: dict[str, str] | None = None,
    profile_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    downgraded_cols: set[str] | None = None,
    resolved_types: dict[str, str] | None = None,
    window_size: int = CLEANER_PREVIEW_ROWS,
) -> dict:
    """
    Định vị window offset của một dòng theo excel_row (1-based: header=1, row 0=2).
    - mode "all": offset trong toàn bộ dòng hiện tại
    - mode "errors": offset trong danh sách các dòng có lỗi
    """
    target_idx = excel_row - 2

    if original_df is not None:
        if target_idx not in original_df.index:
            return {"status": "not_found", "excel_row": excel_row, "offset": None, "mode": mode}
        if target_idx not in df.index:
            return {"status": "removed", "reason": "duplicate", "excel_row": excel_row, "offset": None, "mode": mode}
    else:
        if target_idx not in df.index:
            return {"status": "not_found", "excel_row": excel_row, "offset": None, "mode": mode}

    pos = int(df.index.get_loc(target_idx))

    if mode == "errors":
        err_indices = get_error_row_indices(
            df,
            overridden_types=overridden_types,
            profile_types=profile_types,
            column_semantics=column_semantics,
            downgraded_cols=downgraded_cols,
            resolved_types=resolved_types,
        )
        if target_idx in err_indices:
            err_pos = err_indices.index(target_idx)
            offset = (err_pos // window_size) * window_size
            return {"status": "found", "offset": offset, "excel_row": excel_row, "mode": "errors"}
        else:
            offset = (pos // window_size) * window_size
            return {"status": "not_in_errors", "offset": offset, "excel_row": excel_row, "mode": "errors"}
    else:
        offset = (pos // window_size) * window_size
        return {"status": "found", "offset": offset, "excel_row": excel_row, "mode": "all"}


def col_index_to_letter(idx: int) -> str:
    """Chuyển đổi 0-indexed column position sang ký hiệu chữ cái Excel (0 -> A, 25 -> Z, 26 -> AA)."""
    result = []
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        result.append(chr(65 + rem))
    return "".join(reversed(result))


def compute_column_issue_counts(
    df: pd.DataFrame,
    overridden_types: dict[str, str] | None = None,
    profile_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    resolved_types: dict[str, str] | None = None,
    user_id: int | None = None,
    file_hash: str | None = None,
) -> dict[str, dict[str, int]]:
    """Tính số lượng lỗi cho từng cột (missing, wrong_type, encoding, semantic) trên toàn bộ DataFrame."""
    overridden_types = overridden_types or {}
    column_semantics = column_semantics or {}
    profile_types = profile_types or {}
    counts: dict[str, dict[str, int]] = {}

    for col_name in df.columns:
        col_str = str(col_name)
        series = df[col_name]
        col_type = (resolved_types or {}).get(col_str) or resolve_column_type(
            col_name, series, overridden_types, profile_types, user_id, file_hash
        )

        semantic_type = column_semantics.get(col_str, "GENERAL_TEXT")
        violation_count = 0
        if semantic_type != "GENERAL_TEXT":
            non_null_s = series.dropna()
            if len(non_null_s) > 0:
                str_s = non_null_s.astype(str).str.strip()
                non_empty = str_s[str_s != ""]
                if len(non_empty) > 0:
                    if semantic_type == "EMAIL":
                        violation_count = int((~non_empty.str.match(semantic_rules.EMAIL_REGEX)).sum())
                    elif semantic_type == "PHONE_NUMBER":
                        cleaned_p = non_empty.str.replace(r'[\s\.\-\(\)]', '', regex=True)
                        violation_count = int((~cleaned_p.str.match(semantic_rules.PHONE_REGEX)).sum())
                    elif semantic_type == "MONEY":
                        violation_count = int((~non_empty.str.match(semantic_rules.MONEY_REGEX)).sum())
                    elif semantic_type == "CODE_ID":
                        violation_count = int((~non_empty.str.match(r"^[\w\.-]+$")).sum())
                    elif semantic_type == "DATE_TIME":
                        parsed_dt = pd.to_datetime(non_empty, format='mixed', errors='coerce')
                        violation_count = int(parsed_dt.isna().sum())
                    else:
                        violation_count = sum(1 for val in non_empty if not semantic_rules.validate_cell(val, semantic_type))

        null_count = int(series.isna().sum()) if col_type != "text" else 0

        wrong_type_count = 0
        if col_type != "text" and pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, _ = _is_numeric_convertible(series)
            if convertible:
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                wrong_type_count = int(parsed.isna().sum())

        bad_count = 0
        if col_type != "text" and pd.api.types.is_object_dtype(series.dtype):
            bad_count, _ = _count_bad_chars(series)

        counts[col_str] = {
            "missing": null_count,
            "wrong_type": wrong_type_count,
            "encoding": bad_count,
            "semantic": violation_count,
        }

    return counts


def get_group_error_cells(
    df: pd.DataFrame,
    column: str,
    issue_type: str,
    offset: int = 0,
    limit: int = 20,
    overridden_types: dict[str, str] | None = None,
    profile_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    resolved_types: dict[str, str] | None = None,
    column_letters: dict[str, str] | None = None,
) -> dict:
    """
    Trả về danh sách ô lỗi [{excel_row, letter, value, issue, row_id, column}] và total
    cho nhóm (column, issue_type), phân trang offset/limit.
    Vectorized, không dùng per-cell loop.
    """
    col_str = str(column)
    if col_str not in df.columns:
        return {
            "cells": [],
            "total": 0,
            "column": column,
            "issue_type": issue_type,
            "offset": offset,
            "limit": limit,
        }

    series = df[col_str]
    col_type = (resolved_types or {}).get(col_str) or resolve_column_type(
        col_str, series, overridden_types, profile_types
    )

    col_sem = column_semantics or {}
    col_letters = column_letters or dict(df.attrs.get("column_letters", {}))
    letter = col_letters.get(col_str)
    if not letter:
        try:
            col_pos = df.columns.get_loc(col_str)
            letter = col_index_to_letter(int(col_pos))
        except Exception:
            letter = "A"

    mask = pd.Series(False, index=series.index)
    issue_reason = issue_type

    if issue_type == "missing":
        if col_type != "text":
            mask = series.isna()
        issue_reason = "Giá trị bị thiếu"

    elif issue_type == "wrong_type":
        if col_type == "numeric" and pd.api.types.is_object_dtype(series.dtype):
            convertible, _ = _is_numeric_convertible(series)
            if convertible:
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                mismatch_indices = non_null.index[parsed.isna()]
                mask.loc[mismatch_indices] = True
        issue_reason = "Sai kiểu dữ liệu"

    elif issue_type == "encoding":
        if pd.api.types.is_object_dtype(series.dtype):
            non_null_str = series.dropna().astype(str)
            bad_mask = non_null_str.str.contains(_BAD_CHAR_PATTERN, regex=True)
            mask.loc[non_null_str.index[bad_mask]] = True
        issue_reason = "Lỗi ký tự / mã hóa"

    elif issue_type == "semantic":
        semantic_type = col_sem.get(col_str, "GENERAL_TEXT")
        if semantic_type != "GENERAL_TEXT":
            non_null = series.dropna()
            if len(non_null) > 0:
                str_s = non_null.astype(str).str.strip()
                non_empty = str_s[str_s != ""]
                if len(non_empty) > 0:
                    if semantic_type == "EMAIL":
                        inv = ~non_empty.str.match(semantic_rules.EMAIL_REGEX)
                        mask.loc[non_empty.index[inv]] = True
                    elif semantic_type == "PHONE_NUMBER":
                        cleaned_p = non_empty.str.replace(r'[\s\.\-\(\)]', '', regex=True)
                        inv = ~cleaned_p.str.match(semantic_rules.PHONE_REGEX)
                        mask.loc[non_empty.index[inv]] = True
                    elif semantic_type == "MONEY":
                        inv = ~non_empty.str.match(semantic_rules.MONEY_REGEX)
                        mask.loc[non_empty.index[inv]] = True
                    elif semantic_type == "CODE_ID":
                        inv = ~non_empty.str.match(r"^[\w\.-]+$")
                        mask.loc[non_empty.index[inv]] = True
                    elif semantic_type == "DATE_TIME":
                        parsed_dt = pd.to_datetime(non_empty, format='mixed', errors='coerce')
                        mask.loc[non_empty.index[parsed_dt.isna()]] = True
                    else:
                        inv_indices = [idx for idx, val in non_empty.items() if not semantic_rules.validate_cell(val, semantic_type)]
                        if inv_indices:
                            mask.loc[inv_indices] = True
        issue_reason = f"Sai định dạng {semantic_type}" if semantic_type != "GENERAL_TEXT" else "Sai định dạng"

    error_indices = series.index[mask].tolist()
    total = len(error_indices)
    page_indices = error_indices[offset : offset + limit]

    cells = []
    for idx in page_indices:
        val = _to_json_safe(series.at[idx])
        excel_row = int(idx) + 2
        cells.append({
            "excel_row": excel_row,
            "letter": letter,
            "value": val,
            "issue": issue_reason,
            "row_id": int(idx),
            "column": col_str,
        })

    return {
        "cells": cells,
        "total": total,
        "column": col_str,
        "issue_type": issue_type,
        "offset": offset,
        "limit": limit,
    }


# ─── detect_issues ──────────────────────────────────────────────────────────

def detect_issues(
    df: pd.DataFrame,
    filename: str,
    file_hash: str,
    overridden_types: dict[str, str] | None = None,
    user_id: int | None = None,
    profile_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
    resolved_types: dict[str, str] | None = None,
    column_letters: dict[str, str] | None = None,
    offset: int = 0,
    mode: str = "all",
    profiler_context: dict | None = None,
) -> dict:
    """
    Quét toàn bộ DataFrame và phân loại vấn đề theo 4 nhóm gốc + nhóm Semantic Errors.
    Trả về dict tương thích với IssueReport schema.
    Tối ưu hóa:
      - error_cells chỉ tính toán trên preview_rows (CLEANER_PREVIEW_ROWS).
      - Trả về column_issue_counts (missing, wrong_type, encoding, semantic) cho toàn bộ file để UI vẽ chip.
    """
    overridden_types = overridden_types or {}
    column_semantics = column_semantics or {}
    total_rows = len(df)

    missing_values = []
    wrong_types = []
    encoding_errors = []
    semantic_errors = []
    duplicates_info = None
    downgraded_cols = set()
    column_issue_counts: dict[str, dict[str, int]] = {}

    for col_name in df.columns:
        col_str = str(col_name)
        series = df[col_name]
        col_type = (resolved_types or {}).get(col_str) or resolve_column_type(col_name, series, overridden_types, profile_types, user_id, file_hash)

        # Check semantic errors regardless of basic text types
        semantic_type = column_semantics.get(col_str, "GENERAL_TEXT")
        violation_count = 0
        if semantic_type != "GENERAL_TEXT":
            non_null_s = series.dropna()
            if len(non_null_s) > 0:
                str_s = non_null_s.astype(str).str.strip()
                non_empty = str_s[str_s != ""]
                if len(non_empty) > 0:
                    if semantic_type == "EMAIL":
                        violation_count = int((~non_empty.str.match(semantic_rules.EMAIL_REGEX)).sum())
                    elif semantic_type == "PHONE_NUMBER":
                        cleaned_p = non_empty.str.replace(r'[\s\.\-\(\)]', '', regex=True)
                        violation_count = int((~cleaned_p.str.match(semantic_rules.PHONE_REGEX)).sum())
                    elif semantic_type == "MONEY":
                        violation_count = int((~non_empty.str.match(semantic_rules.MONEY_REGEX)).sum())
                    elif semantic_type == "CODE_ID":
                        violation_count = int((~non_empty.str.match(r"^[\w\.-]+$")).sum())
                    elif semantic_type == "DATE_TIME":
                        parsed_dt = pd.to_datetime(non_empty, format='mixed', errors='coerce')
                        violation_count = int(parsed_dt.isna().sum())
                    else:
                        violation_count = sum(1 for val in non_empty if not semantic_rules.validate_cell(val, semantic_type))

            if violation_count > 0:
                total_non_null = len(series.dropna())
                is_system_error = semantic_rules.is_semantic_error_column(violation_count, total_non_null)
                severity = semantic_rules.get_semantic_severity(semantic_type)
                
                # Report as system semantic error ONLY IF it exceeds threshold and is "error" severity
                if is_system_error and severity == "error":
                    violation_pct = round(violation_count / (total_non_null if total_non_null > 0 else 1) * 100, 2)
                    if violation_pct > 50.0:
                        severity = "hint"
                        downgraded_cols.add(col_str)
                        logger.warning(f"Downgrading severity of {col_name} ({semantic_type}) to 'hint' because violation rate is suspiciously high ({violation_pct}%).")
                    else:
                        semantic_errors.append({
                            "column": col_str,
                            "semantic_type": semantic_type,
                            "violation_count": violation_count,
                            "violation_pct": violation_pct,
                            "severity": severity,
                        })

        # ── 1. Missing values ──────────────────────────────
        null_count = int(series.isna().sum())
        if col_type != "text" and null_count > 0:
            null_pct = round(null_count / total_rows * 100, 2) if total_rows > 0 else 0.0
            missing_values.append({
                "column": col_str,
                "null_count": null_count,
                "null_pct": null_pct,
                "detected_type": col_type,
                "suggested_fill": _suggested_fill(col_type, null_pct),
            })

        # ── 2. Wrong type (chỉ kiểm tra cột object) ───────
        wrong_type_count = 0
        if col_type != "text" and pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, pct = _is_numeric_convertible(series)
            if convertible:
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                wrong_type_count = int(parsed.isna().sum())
                wrong_types.append({
                    "column": col_str,
                    "current_dtype": str(series.dtype),
                    "convertible_pct": pct,
                    "suggested_type": "float",
                    "sample_values": _safe_sample(series),
                })

        # ── 3. Encoding lỗi (chỉ cột string) ──────────────
        bad_count = 0
        if col_type != "text" and pd.api.types.is_object_dtype(series.dtype):
            bad_count, bad_examples = _count_bad_chars(series)
            if bad_count > 0:
                encoding_errors.append({
                    "column": col_str,
                    "bad_char_count": bad_count,
                    "sample_bad_values": bad_examples,
                })

        column_issue_counts[col_str] = {
            "missing": null_count if col_type != "text" else 0,
            "wrong_type": wrong_type_count,
            "encoding": bad_count,
            "semantic": violation_count,
        }

    # ── 4. Duplicate rows ──────────────────────────────────
    dup_mask = df.duplicated()
    dup_count = int(dup_mask.sum())

    total_cols = len(df.columns)
    null_per_row = df.isna().sum(axis=1)
    for c in df.select_dtypes(include=["object"]).columns:
        str_empty = df[c].dropna().astype(str).str.strip().isin(["", "nan", "None", "null", "NaN"])
        null_per_row.loc[str_empty[str_empty].index] += 1

    near_empty_mask = (null_per_row / total_cols >= CLEANER_NEAR_EMPTY_ROW_THRESHOLD) if total_cols > 0 else pd.Series(False, index=df.index)
    near_empty_count = int(near_empty_mask.sum())

    combined_mask = dup_mask | near_empty_mask
    combined_count = int(combined_mask.sum())
    combined_pct = round(combined_count / total_rows * 100, 1) if total_rows > 0 else 0.0

    dup_warning = None
    if combined_pct > CLEANER_DUPLICATE_WARNING_PCT:
        dup_warning = f"Có {combined_count} dòng trùng hoặc gần như trống ({combined_pct}%) — kiểm tra trước khi xóa"
    if dup_count > 0 or near_empty_count > 0:
        duplicates_info = {
            "duplicate_count": dup_count,
            "total_rows": total_rows,
            "near_empty_count": near_empty_count,
            "warning": dup_warning,
        }
    
    # Lấy dữ liệu mẫu cho preview theo row window
    error_row_indices = get_error_row_indices(
        df,
        overridden_types=overridden_types,
        profile_types=profile_types,
        column_semantics=column_semantics,
        downgraded_cols=downgraded_cols,
        resolved_types=resolved_types,
    )
    total_error_rows = len(error_row_indices)

    if mode == "errors":
        selected_indices = error_row_indices[offset : offset + CLEANER_PREVIEW_ROWS]
    else:
        selected_indices = list(df.index[offset : offset + CLEANER_PREVIEW_ROWS])

    preview_df = df.loc[selected_indices].copy()
    first_excel_row = int(selected_indices[0]) + 2 if selected_indices else None
    last_excel_row = int(selected_indices[-1]) + 2 if selected_indices else None

    window_info = {
        "offset": offset,
        "size": len(selected_indices),
        "mode": mode,
        "total_rows": total_rows,
        "total_error_rows": total_error_rows,
        "first_excel_row": first_excel_row,
        "last_excel_row": last_excel_row,
    }

    error_cells = _get_error_cells(
        preview_df,
        overridden_types=overridden_types,
        column_semantics=column_semantics,
        user_id=user_id,
        file_hash=file_hash,
        profile_types=profile_types,
        downgraded_cols=downgraded_cols,
        resolved_types=resolved_types,
    )
    FORMAT_CHECKED_SEMANTIC_TYPES = {
        "EMAIL", "PHONE_NUMBER", "PERSON_NAME", "ADDRESS", "MONEY", "CODE_ID", "DATE_TIME", "SEQUENCE_NUMBER"
    }

    # Determine semantic_status: "not_run" | "no_special_columns" | "checked"
    ai_analyzed = False
    if profiler_context is not None:
        sem_ctx = profiler_context.get("semantic_context") if isinstance(profiler_context, dict) else {}
        domain = sem_ctx.get("domain") if isinstance(sem_ctx, dict) else (profiler_context.get("domain") if isinstance(profiler_context, dict) else None)
        ai_analyzed = bool(domain and domain != "Chưa phân tích")
    elif user_id is not None and file_hash:
        ctx = cache.get_profiler_context(user_id, file_hash)
        if ctx:
            sem_ctx = ctx.get("semantic_context") if isinstance(ctx, dict) else {}
            domain = sem_ctx.get("domain") if isinstance(sem_ctx, dict) else ctx.get("domain")
            ai_analyzed = bool(domain and domain != "Chưa phân tích")
        else:
            p_data = cache.get_profile(user_id, file_hash)
            if p_data and p_data.get("semantic_context"):
                domain = p_data.get("semantic_context", {}).get("domain")
                ai_analyzed = bool(domain and domain != "Chưa phân tích")

    # If profiler context/cache was not available, check if column_semantics was explicitly supplied
    if not ai_analyzed and column_semantics:
        if any(sem in FORMAT_CHECKED_SEMANTIC_TYPES for sem in column_semantics.values()):
            ai_analyzed = True

    if not ai_analyzed:
        semantic_status = "not_run"
    else:
        has_special = any(sem in FORMAT_CHECKED_SEMANTIC_TYPES for sem in column_semantics.values())
        semantic_status = "checked" if has_special else "no_special_columns"

    semantic_checked = (semantic_status == "checked")

    has_issues = bool(missing_values or wrong_types or encoding_errors or duplicates_info or semantic_errors)

    preview_df = preview_df.where(pd.notna(preview_df), None)
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
    preview_df = preview_df.reset_index(names="original_index")

    if column_letters is None:
        column_letters = dict(df.attrs.get("column_letters", {}))

    return {
        "file_hash": file_hash,
        "filename": filename,
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "missing_values": missing_values,
        "wrong_types": wrong_types,
        "encoding_errors": encoding_errors,
        "semantic_errors": semantic_errors,
        "duplicates": duplicates_info,
        "error_cells": error_cells,
        "column_issue_counts": column_issue_counts,
        "has_issues": has_issues,
        "semantic_status": semantic_status,
        "semantic_checked": semantic_checked,
        "preview_rows": CLEANER_PREVIEW_ROWS,
        "column_letters": column_letters,
        "preview_data": [{k: _to_json_safe(v) for k, v in r.items()} for r in preview_df.to_dict(orient="records")],
        "window": window_info,
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


# ─── compute_diff_report ──────────────────────────────────────────────────

def compute_diff_report(
    original_df: pd.DataFrame,
    cleaned_df: pd.DataFrame,
    actions_or_log: list | None = None,
    invalid_replaced_keys: set | None = None,
) -> dict:
    """
    Báo cáo so sánh toàn diện trước/sau khi clean trên TOÀN BỘ file.
    Dùng chung cho cả auto-clean và manual-clean (confirm-clean).
    """
    original_rows = len(original_df)
    clean_rows = len(cleaned_df)
    original_cols = len(original_df.columns)
    clean_cols = len(cleaned_df.columns)
    duplicate_rows_removed = max(0, original_rows - clean_rows)

    columns_dropped: list[str] = []
    missing_filled: dict[str, int] = {}
    types_converted: dict[str, str] = {}
    encoding_fixed: dict[str, int] = {}
    invalid_replaced: dict[str, int] = {}
    format_normalized: dict[str, int] = {}
    columns_renamed: dict[str, str] = {}
    cells_edited_manually: int = 0

    if actions_or_log:
        for item in actions_or_log:
            act_type = getattr(item, "action_type", None) or (item.get("action_type") if isinstance(item, dict) else item.get("action"))
            col = getattr(item, "column", None) or (item.get("column") if isinstance(item, dict) else None)
            params = getattr(item, "params", {}) or (item.get("params") if isinstance(item, dict) else {})
            if act_type in ("RENAME_COLUMN", "rename_column"):
                new_name = params.get("new_name") if isinstance(params, dict) else None
                if col and new_name:
                    columns_renamed[str(col)] = str(new_name)
            elif act_type in ("BATCH_EDIT_CELLS", "batch_edit_cells"):
                edits = params.get("edits", []) if isinstance(params, dict) else []
                cells_edited_manually += len(edits)

    for c in original_df.columns:
        c_str = str(c)
        if c_str not in cleaned_df.columns and c_str not in columns_renamed:
            columns_dropped.append(c_str)

    common_indices = [idx for idx in cleaned_df.index if idx in original_df.index]
    inv_keys = invalid_replaced_keys or set()

    for clean_col in cleaned_df.columns:
        clean_col_str = str(clean_col)
        orig_col = next((k for k, v in columns_renamed.items() if v == clean_col_str), clean_col_str)
        if orig_col in original_df.columns:
            orig_s = original_df.loc[common_indices, orig_col]
            clean_s = cleaned_df.loc[common_indices, clean_col]

            if str(original_df[orig_col].dtype) != str(cleaned_df[clean_col].dtype):
                types_converted[clean_col_str] = f"{original_df[orig_col].dtype} → {cleaned_df[clean_col].dtype}"

            was_null = orig_s.isna()
            now_not_null = clean_s.notna()
            filled_count = int((was_null & now_not_null).sum())
            if filled_count > 0:
                missing_filled[clean_col_str] = filled_count

            if pd.api.types.is_object_dtype(original_df[orig_col].dtype):
                bad_in_orig = orig_s.dropna().astype(str).str.contains(_BAD_CHAR_PATTERN, regex=True)
                bad_count = int(bad_in_orig.sum())
                if bad_count > 0:
                    encoding_fixed[clean_col_str] = bad_count

            # Track format-only normalized count for numeric/datetime conversions (vectorized)
            if pd.api.types.is_object_dtype(original_df[orig_col].dtype):
                valid_mask = orig_s.notna() & clean_s.notna()
                if valid_mask.any():
                    sub_orig = orig_s[valid_mask]
                    sub_clean = clean_s[valid_mask]
                    if pd.api.types.is_numeric_dtype(cleaned_df[clean_col].dtype):
                        parsed_num = clean_to_numeric(sub_orig)
                        clean_num = pd.to_numeric(sub_clean, errors="coerce")
                        match_mask = parsed_num.notna() & clean_num.notna() & (parsed_num == clean_num)
                        if inv_keys:
                            match_indices = sub_orig.index[match_mask]
                            norm_count = sum(1 for idx in match_indices if (int(idx), clean_col_str) not in inv_keys)
                        else:
                            norm_count = int(match_mask.sum())
                        if norm_count > 0:
                            format_normalized[clean_col_str] = norm_count

                    elif pd.api.types.is_datetime64_any_dtype(cleaned_df[clean_col].dtype):
                        to = pd.to_datetime(sub_orig, format='mixed', errors='coerce')
                        tn = pd.to_datetime(sub_clean, format='mixed', errors='coerce')
                        match_mask = to.notna() & tn.notna() & (to == tn)
                        if inv_keys:
                            match_indices = sub_orig.index[match_mask]
                            norm_count = sum(1 for idx in match_indices if (int(idx), clean_col_str) not in inv_keys)
                        else:
                            norm_count = int(match_mask.sum())
                        if norm_count > 0:
                            format_normalized[clean_col_str] = norm_count

    if invalid_replaced_keys:
        for r_id, c_name in invalid_replaced_keys:
            c_str = str(c_name)
            invalid_replaced[c_str] = invalid_replaced.get(c_str, 0) + 1

    return {
        "original_rows": original_rows,
        "clean_rows": clean_rows,
        "original_cols": original_cols,
        "clean_cols": clean_cols,
        "duplicate_rows_removed": duplicate_rows_removed,
        "columns_dropped": columns_dropped,
        "missing_filled": missing_filled,
        "types_converted": types_converted,
        "encoding_fixed": encoding_fixed,
        "invalid_replaced": invalid_replaced,
        "format_normalized": format_normalized,
        "columns_renamed": columns_renamed,
        "cells_edited_manually": cells_edited_manually,
    }


# ─── auto_clean ─────────────────────────────────────────────────────────────
def auto_clean(
    df: pd.DataFrame,
    overridden_types: dict[str, str] | None = None,
    user_id: int | None = None,
    profile_types: dict[str, str] | None = None,
    file_hash: str | None = None,
    resolved_types: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, dict, list]:
    """
    Làm sạch tự động theo rule mặc định:
      - Duplicate rows → drop, giữ dòng đầu
      - Wrong type → convert sang numeric, lỗi → NaN
      - Encoding lỗi → strip ký tự xấu
      - Missing numeric → fill median
      - Missing text/categorical → fill mode hoặc "Unknown"

    Trả về (cleaned_df, diff_report_dict, cleaning_log).
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
    cleaning_log = []
    invalid_replaced_keys = set()

    # ── 0. Drop quá rỗng (>= 90%) ──────────────────────────
    for col_name in cleaned.columns:
        null_pct = cleaned[col_name].isna().sum() / original_rows * 100
        if null_pct >= CLEANER_DROP_COLUMN_NULL_PCT:
            cleaned = cleaned.drop(columns=[col_name])
            columns_dropped.append(str(col_name))
            cleaning_log.append({"column": str(col_name), "action": "drop_column", "reason": f">= {CLEANER_DROP_COLUMN_NULL_PCT}% missing values"})

    # ── 1. Drop duplicates ─────────────────────────────────
    before_dedup = len(cleaned)
    cleaned = cleaned.drop_duplicates(keep="first")
    duplicate_rows_removed = before_dedup - len(cleaned)
    if duplicate_rows_removed > 0:
        cleaning_log.append({"column": "all", "action": "drop_duplicates", "rows_affected": duplicate_rows_removed, "reason": "duplicate rows"})

    # ── 2. Per-column operations ───────────────────────────
    for col_name in cleaned.columns:
        series = cleaned[col_name]
        col_type = (resolved_types or {}).get(str(col_name)) or resolve_column_type(col_name, series, overridden_types, profile_types, user_id, file_hash)

        if col_type == "text":
            continue

        invalid_in_col = set()
        # 2a. Strip encoding lỗi (chỉ cột string)
        if pd.api.types.is_object_dtype(series.dtype):
            new_series = series.apply(_strip_bad_chars)
            bad_fixed = int((series.fillna("").astype(str) != new_series.fillna("").astype(str)).sum())
            if bad_fixed > 0:
                encoding_fixed[str(col_name)] = bad_fixed
                cleaning_log.append({"column": str(col_name), "action": "strip_bad_chars", "rows_affected": bad_fixed, "reason": "encoding errors"})
            cleaned[col_name] = new_series
            series = cleaned[col_name]  # refresh

        # 2b. Convert wrong type → numeric
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            original_dtype = str(series.dtype)
            was_not_null = series.notna() & (~series.astype(str).str.strip().isin(["", "nan", "None", "null", "NaN"]))
            converted = clean_to_numeric(series)
            invalid_mask = was_not_null & converted.isna()
            for idx in series[invalid_mask].index:
                invalid_in_col.add(int(idx))
            cleaned[col_name] = converted
            types_converted[str(col_name)] = f"{original_dtype} → float64"
            cleaning_log.append({"column": str(col_name), "action": "convert_to_numeric", "reason": "wrong type"})
            series = cleaned[col_name]  # refresh

        # 2b2. Convert wrong type → datetime
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "datetime":
            original_dtype = str(series.dtype)
            was_not_null = series.notna() & (~series.astype(str).str.strip().isin(["", "nan", "None", "null", "NaN"]))
            converted = pd.to_datetime(series, format='mixed', errors='coerce')
            invalid_mask = was_not_null & converted.isna()
            for idx in series[invalid_mask].index:
                invalid_in_col.add(int(idx))
            cleaned[col_name] = converted
            types_converted[str(col_name)] = f"{original_dtype} → datetime64"
            cleaning_log.append({"column": str(col_name), "action": "convert_to_datetime", "reason": "wrong type"})
            series = cleaned[col_name]  # refresh

        # 2c. Fill missing
        null_before = int(series.isna().sum())
        if null_before > 0:
            action_name = "fill_missing"
            if col_type == "numeric":
                if is_integer_numeric(series):
                    fill_val = int(round(series.median()))
                    cleaned[col_name] = series.fillna(fill_val).round().astype("Int64")
                    action_name = "fill_missing_median_int"
                else:
                    fill_val = float(series.median())
                    cleaned[col_name] = series.fillna(fill_val)
                    action_name = "fill_missing_median"

            elif col_type in ["categorical", "multiple_choice"]:
                cleaned[col_name] = series.fillna(CLEANER_FILL_CATEGORICAL)
                action_name = "fill_missing_unknown"

            elif col_type == "datetime":
                pass
            else:
                cleaned[col_name] = series.fillna(CLEANER_FILL_CATEGORICAL)
                action_name = "fill_missing_unknown"

        for inv_idx in invalid_in_col:
            if inv_idx in cleaned.index and pd.notna(cleaned.at[inv_idx, col_name]):
                invalid_replaced_keys.add((inv_idx, str(col_name)))
        null_after = int(cleaned[col_name].isna().sum()) if col_name in cleaned.columns else 0
        filled_count = null_before - null_after
        if filled_count > 0:
            missing_filled[str(col_name)] = filled_count
            cleaning_log.append({"column": str(col_name), "action": action_name, "rows_affected": filled_count, "reason": "missing values"})

    diff_report = compute_diff_report(original_df=df, cleaned_df=cleaned, actions_or_log=cleaning_log, invalid_replaced_keys=invalid_replaced_keys)
    diff_report["invalid_replaced_keys"] = invalid_replaced_keys

    return cleaned, diff_report, cleaning_log


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
            "message": "Dataset không có dòng dữ liệu nào",
        })

    dupes = [c for c in df.columns if df.columns.tolist().count(c) > 1]
    if dupes:
        hard_blocks.append({
            "code": "DUPLICATE_COLUMNS",
            "message": f"Cột trùng tên: {', '.join(set(dupes))}",
        })

    # ── WARNING — cho đi tiếp nhưng cảnh báo ──────────────────────────
    if 0 < len(df) < 10:
        warnings.append({
            "code": "LOW_ROW_COUNT",
            "message": f"Dataset chỉ có {len(df)} dòng",
            "impact": "Correlation và thống kê suy diễn không có ý nghĩa",
        })

    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    if len(numeric_cols) == 0:
        warnings.append({
            "code": "NO_NUMERIC_COLUMNS",
            "message": "Không có cột số",
            "impact": "Chỉ có thể vẽ Bar Chart và Pie Chart",
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


# ─── apply_manual_actions ───────────────────────────────────────────────────

def apply_manual_actions(
    df: pd.DataFrame,
    actions: list,
    overridden_types: dict | None = None,
    user_id: int | None = None,
    file_hash: str | None = None,
    profile_types: dict[str, str] | None = None,
    resolved_types: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, list]:
    """
    Áp dụng tuần tự các thao tác làm sạch thủ công (Manual Action Recipe) lên DataFrame.
    """
    cleaned = df.copy()
    cleaning_log = []
    
    for action in actions:
        try:
            # action có thể là Pydantic model (từ API) hoặc dict
            act_type = getattr(action, "action_type", None)
            if not act_type and isinstance(action, dict):
                act_type = action.get("action_type")
                
            col = getattr(action, "column", None)
            if not col and isinstance(action, dict):
                col = action.get("column")
                
            params = getattr(action, "params", {})
            if not params and isinstance(action, dict):
                params = action.get("params", {})
                
            if act_type == "DROP_COLUMN":
                if col in cleaned.columns:
                    cleaned = cleaned.drop(columns=[col])
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "DROP_DUPLICATES":
                before_dedup = len(cleaned)
                cleaned = cleaned.drop_duplicates(keep="first")
                dedup = before_dedup - len(cleaned)
                if dedup > 0:
                    cleaning_log.append({"column": "all", "action": act_type, "rows_affected": dedup, "reason": "manual"})
                
            elif act_type == "STRIP_BAD_CHARS":
                if col in cleaned.columns and pd.api.types.is_object_dtype(cleaned[col].dtype):
                    before = cleaned[col].copy()
                    cleaned[col] = cleaned[col].apply(_strip_bad_chars)
                    bad_fixed = int((before.fillna("").astype(str) != cleaned[col].fillna("").astype(str)).sum())
                    if bad_fixed > 0:
                        cleaning_log.append({"column": col, "action": act_type, "rows_affected": bad_fixed, "reason": "manual"})
                    
            elif act_type == "CONVERT_TO_NUMERIC":
                if col in cleaned.columns:
                    cleaned[col] = clean_to_numeric(cleaned[col])
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "CONVERT_TO_DATETIME":
                if col in cleaned.columns:
                    cleaned[col] = pd.to_datetime(cleaned[col], errors='coerce')
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "FILL_MISSING_MEDIAN":
                if col in cleaned.columns:
                    col_t = (resolved_types or {}).get(str(col)) or resolve_column_type(col, cleaned[col], overridden_types, profile_types, user_id, file_hash)
                    if is_integer_numeric(cleaned[col]):
                        fill_val = int(round(cleaned[col].median()))
                        cleaned[col] = cleaned[col].fillna(fill_val).round().astype("Int64")
                    else:
                        fill_val = float(cleaned[col].median())
                        cleaned[col] = cleaned[col].fillna(fill_val)

                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "FILL_MISSING_UNKNOWN":
                if col in cleaned.columns:
                    cleaned[col] = cleaned[col].fillna(CLEANER_FILL_CATEGORICAL)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "FILL_MISSING_CUSTOM_VALUE":
                if col in cleaned.columns:
                    val = params.get("value")
                    cleaned[col] = cleaned[col].fillna(val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "FILL_MISSING_MEAN":
                if col in cleaned.columns:
                    fill_val = float(cleaned[col].mean())
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "FILL_MISSING_MODE":
                if col in cleaned.columns:
                    mode_s = cleaned[col].mode()
                    fill_val = mode_s.iloc[0] if len(mode_s) > 0 else CLEANER_FILL_CATEGORICAL
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})
                    
            elif act_type == "RENAME_COLUMN":
                if col in cleaned.columns:
                    new_name = params.get("new_name")
                    if new_name:
                        cleaned = cleaned.rename(columns={col: str(new_name)})
                        if "column_letters" in cleaned.attrs and col in cleaned.attrs["column_letters"]:
                            cleaned.attrs["column_letters"][str(new_name)] = cleaned.attrs["column_letters"][col]
                        cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "BATCH_EDIT_CELLS":
                edits = params.get("edits", [])
                for edit in edits:
                    r_id = edit.get("row_id")
                    c_name = edit.get("column")
                    n_val = edit.get("new_value")
                    
                    if c_name not in cleaned.columns:
                        raise ValueError(f"Không thể sửa ô: Cột '{c_name}' không tồn tại.")
                        
                    if r_id is None or pd.isna(r_id):
                        raise ValueError("Không thể sửa ô: row_id không được để trống (None/NaN).")
                        
                    if r_id in cleaned.index:
                        try:
                            cleaned.at[r_id, c_name] = n_val
                            cleaning_log.append({"column": c_name, "action": act_type, "rows_affected": 1, "reason": "manual"})
                        except Exception as e:
                            logger.warning(f"Không thể sửa ô tại dòng {r_id}, cột {c_name}: {e}")
                            raise ValueError(f"Không thể cập nhật giá trị '{n_val}' vào cột '{c_name}'. Lỗi kiểu dữ liệu.")
                    else:
                        raise ValueError(f"Không thể sửa ô: Dòng {r_id} không tồn tại trong dữ liệu.")
                        
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.warning(f"Error applying action {action}: {e}")
            
    return cleaned, cleaning_log


def apply_manual_actions_preview(
    preview_df: pd.DataFrame,
    actions: list,
    full_df: pd.DataFrame,
    resolved_types: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, list, list[int]]:
    """
    Áp dụng các hành động làm sạch thủ công CHỈ trên preview_df (first CLEANER_PREVIEW_ROWS).
    - Các thống kê cột (median, mean, mode cho FILL_MISSING_*) được tính toán một lần trên toàn bộ cột gốc
      (sau các thao tác trước đó trên cột đó như CONVERT_TO_NUMERIC).
    - DROP_DUPLICATES: đánh dấu các dòng trùng lặp trong preview dựa trên df.duplicated() của toàn bộ file (vectorized).
    - Trả về (cleaned_preview_df, cleaning_log, removed_rows).
    """
    cleaned = preview_df.copy()
    cleaning_log = []
    original_preview_indices = list(preview_df.index)

    full_col_state: dict[str, pd.Series] = {}
    dropped_cols = set()

    for action in actions:
        try:
            act_type = getattr(action, "action_type", None) or (action.get("action_type") if isinstance(action, dict) else None)
            col = getattr(action, "column", None) or (action.get("column") if isinstance(action, dict) else None)
            params = getattr(action, "params", {}) or (action.get("params", {}) if isinstance(action, dict) else {})

            if act_type == "DROP_COLUMN":
                if col in cleaned.columns:
                    cleaned = cleaned.drop(columns=[col])
                    dropped_cols.add(col)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "DROP_DUPLICATES":
                active_cols = [c for c in full_df.columns if c not in dropped_cols]
                cols_dict = {c: (full_col_state[c] if c in full_col_state else full_df[c]) for c in active_cols}
                temp_full = pd.DataFrame(cols_dict, index=full_df.index)
                dup_mask = temp_full.duplicated(keep="first")
                preview_dups = set(preview_df.index[dup_mask.loc[preview_df.index]])
                before_len = len(cleaned)
                cleaned = cleaned.drop(index=[idx for idx in preview_dups if idx in cleaned.index])
                dedup = before_len - len(cleaned)
                if dedup > 0:
                    cleaning_log.append({"column": "all", "action": act_type, "rows_affected": dedup, "reason": "manual"})

            elif act_type == "STRIP_BAD_CHARS":
                if col in cleaned.columns and pd.api.types.is_object_dtype(cleaned[col].dtype):
                    before = cleaned[col].copy()
                    cleaned[col] = cleaned[col].apply(_strip_bad_chars)
                    bad_fixed = int((before.fillna("").astype(str) != cleaned[col].fillna("").astype(str)).sum())
                    if bad_fixed > 0:
                        cleaning_log.append({"column": col, "action": act_type, "rows_affected": bad_fixed, "reason": "manual"})
                    if col in full_col_state:
                        full_col_state[col] = full_col_state[col].apply(_strip_bad_chars)

            elif act_type == "CONVERT_TO_NUMERIC":
                if col in cleaned.columns:
                    cleaned[col] = clean_to_numeric(cleaned[col])
                    orig_full = full_col_state.get(col, full_df[col])
                    full_col_state[col] = clean_to_numeric(orig_full)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "CONVERT_TO_DATETIME":
                if col in cleaned.columns:
                    cleaned[col] = pd.to_datetime(cleaned[col], errors='coerce')
                    orig_full = full_col_state.get(col, full_df[col])
                    full_col_state[col] = pd.to_datetime(orig_full, errors='coerce')
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "FILL_MISSING_MEDIAN":
                if col in cleaned.columns:
                    s = full_col_state.get(col, full_df[col])
                    if is_integer_numeric(s):
                        fill_val = int(round(s.median()))
                        cleaned[col] = cleaned[col].fillna(fill_val).round().astype("Int64")
                        if col in full_col_state:
                            full_col_state[col] = s.fillna(fill_val).round().astype("Int64")
                    else:
                        fill_val = float(s.median())
                        cleaned[col] = cleaned[col].fillna(fill_val)
                        if col in full_col_state:
                            full_col_state[col] = s.fillna(fill_val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "FILL_MISSING_MEAN":
                if col in cleaned.columns:
                    s = full_col_state.get(col, full_df[col])
                    fill_val = float(s.mean())
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    if col in full_col_state:
                        full_col_state[col] = s.fillna(fill_val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "FILL_MISSING_MODE":
                if col in cleaned.columns:
                    s = full_col_state.get(col, full_df[col])
                    mode_s = s.mode()
                    fill_val = mode_s.iloc[0] if len(mode_s) > 0 else CLEANER_FILL_CATEGORICAL
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    if col in full_col_state:
                        full_col_state[col] = s.fillna(fill_val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "FILL_MISSING_UNKNOWN":
                if col in cleaned.columns:
                    cleaned[col] = cleaned[col].fillna(CLEANER_FILL_CATEGORICAL)
                    if col in full_col_state:
                        full_col_state[col] = full_col_state[col].fillna(CLEANER_FILL_CATEGORICAL)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "FILL_MISSING_CUSTOM_VALUE":
                if col in cleaned.columns:
                    val = params.get("value")
                    cleaned[col] = cleaned[col].fillna(val)
                    if col in full_col_state:
                        full_col_state[col] = full_col_state[col].fillna(val)
                    cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "RENAME_COLUMN":
                if col in cleaned.columns:
                    new_name = params.get("new_name")
                    if new_name:
                        cleaned = cleaned.rename(columns={col: str(new_name)})
                        if "column_letters" in cleaned.attrs and col in cleaned.attrs["column_letters"]:
                            cleaned.attrs["column_letters"][str(new_name)] = cleaned.attrs["column_letters"][col]
                        if col in full_col_state:
                            full_col_state[str(new_name)] = full_col_state.pop(col)
                        cleaning_log.append({"column": col, "action": act_type, "reason": "manual"})

            elif act_type == "BATCH_EDIT_CELLS":
                edits = params.get("edits", [])
                for edit in edits:
                    r_id = edit.get("row_id")
                    c_name = edit.get("column")
                    n_val = edit.get("new_value")
                    if c_name not in cleaned.columns:
                        raise ValueError(f"Không thể sửa ô: Cột '{c_name}' không tồn tại.")
                    if r_id is None or pd.isna(r_id):
                        raise ValueError("Không thể sửa ô: row_id không được để trống (None/NaN).")
                    if r_id in cleaned.index:
                        cleaned.at[r_id, c_name] = n_val
                        cleaning_log.append({"column": c_name, "action": act_type, "rows_affected": 1, "reason": "manual"})
                    if c_name in full_col_state and r_id in full_col_state[c_name].index:
                        full_col_state[c_name].at[r_id] = n_val
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.warning(f"Error applying action {action} in preview: {e}")

    clean_index_set = set(cleaned.index)
    removed_rows = [int(lbl) for lbl in original_preview_indices if lbl not in clean_index_set]
    return cleaned, cleaning_log, removed_rows


# ─── compute_changed_cells ──────────────────────────────────────────────────

def _to_json_safe(val) -> object:
    """Convert a single value to a JSON-serialisable Python type."""
    if val is None:
        return None
    if isinstance(val, float) and (val != val):   # NaN
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(val, pd.Timestamp):
        return val.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        f = float(val)
        return None if (f != f) else f
    if isinstance(val, (np.bool_,)):
        return bool(val)
    return val


def _is_null(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and (val != val):
        return True
    try:
        return bool(pd.isna(val))
    except (TypeError, ValueError):
        return False


def _normalize_clean_numeric(val) -> float | None:
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    cleaned = str(val).strip()
    if cleaned.lower() in NULL_SYNONYMS:
        return None
    stripped = re.sub(NUMERIC_PATTERNS_STRIP, '', cleaned)
    stripped = stripped.replace('(', '-').replace(')', '')
    try:
        return float(stripped)
    except (ValueError, TypeError):
        return None


def _values_equal(old, new, is_numeric: bool = False, is_datetime: bool = False) -> bool:
    """True when old and new are considered unchanged after normalization."""
    # Both null → unchanged
    if _is_null(old) and _is_null(new):
        return True
    if _is_null(old) or _is_null(new):
        return False

    # Normalized numeric comparison (uses clean_to_numeric parser)
    if is_numeric:
        norm_old = _normalize_clean_numeric(old)
        if norm_old is not None:
            try:
                if float(norm_old) == float(new):
                    return True
            except (TypeError, ValueError):
                pass

    # Normalized datetime comparison
    if is_datetime:
        try:
            to = pd.to_datetime(old, format='mixed', errors='coerce')
            tn = pd.to_datetime(new, format='mixed', errors='coerce')
            if not pd.isna(to) and not pd.isna(tn) and to == tn:
                return True
        except (TypeError, ValueError):
            pass

    # Numeric comparison: "25" vs 25.0
    try:
        fo, fn = float(old), float(new)
        if fo == fn:
            return True
    except (TypeError, ValueError):
        pass

    # Datetime comparison
    try:
        to = pd.to_datetime(old, errors='coerce')
        tn = pd.to_datetime(new, errors='coerce')
        if not pd.isna(to) and not pd.isna(tn) and to == tn:
            return True
    except (TypeError, ValueError):
        pass

    # String comparison
    return str(old) == str(new)


def _change_reason(old, new, col: str, edited_keys: set) -> str:
    """Infer why a cell changed."""
    # Explicit user edit takes priority
    # edited_keys elements: (row_id_int, col_str)
    # caller passes label as int when building edited_keys — checked externally
    if _is_null(old) and not _is_null(new):
        return "missing_filled"
    # Both strings → encoding fix
    if isinstance(old, str) and isinstance(new, str):
        return "encoding_fixed"
    return "type_converted"


def compute_changed_cells(
    original_df: pd.DataFrame,
    cleaned_df: pd.DataFrame,
    preview_labels: list,
    edited_keys: set | None = None,
    cap: int = 2000,
    invalid_replaced_keys: set | None = None,
) -> tuple[list[dict], bool]:
    """
    Compare original_df vs cleaned_df for rows in preview_labels.
    Vectorized column-wise to avoid per-cell Python loops.

    Returns (changed_cells, truncated).
    Each item: {"row_id": int, "column": str, "old": json-safe, "new": json-safe, "reason": str}
    """
    if edited_keys is None:
        edited_keys = set()

    valid_labels = [lbl for lbl in preview_labels if lbl in original_df.index and lbl in cleaned_df.index]
    if not valid_labels:
        return [], False

    common_cols = [c for c in original_df.columns if c in cleaned_df.columns]
    col_is_num = {c: pd.api.types.is_numeric_dtype(cleaned_df[c].dtype) for c in common_cols}
    col_is_dt = {c: pd.api.types.is_datetime64_any_dtype(cleaned_df[c].dtype) for c in common_cols}

    sub_orig = original_df.loc[valid_labels]
    sub_clean = cleaned_df.loc[valid_labels]

    items: list[dict] = []
    truncated = False

    for col in common_cols:
        col_str = str(col)
        o_s = sub_orig[col]
        c_s = sub_clean[col]

        both_null = o_s.isna() & c_s.isna()
        unchanged = both_null.copy()
        both_present = o_s.notna() & c_s.notna()

        if both_present.any():
            direct_eq = (o_s[both_present] == c_s[both_present])
            unchanged.loc[o_s[both_present].index[direct_eq]] = True

            remaining = both_present & (~unchanged)
            if remaining.any():
                if col_is_num[col]:
                    o_num = clean_to_numeric(o_s[remaining])
                    c_num = pd.to_numeric(c_s[remaining], errors='coerce')
                    num_eq = o_num.notna() & c_num.notna() & (o_num == c_num)
                    unchanged.loc[o_s[remaining].index[num_eq]] = True
                elif col_is_dt[col]:
                    o_dt = pd.to_datetime(o_s[remaining], format='mixed', errors='coerce')
                    c_dt = pd.to_datetime(c_s[remaining], format='mixed', errors='coerce')
                    dt_eq = o_dt.notna() & c_dt.notna() & (o_dt == c_dt)
                    unchanged.loc[o_s[remaining].index[dt_eq]] = True

                rem2 = both_present & (~unchanged)
                if rem2.any():
                    str_eq = o_s[rem2].astype(str) == c_s[rem2].astype(str)
                    unchanged.loc[o_s[rem2].index[str_eq]] = True

        changed_lbls = [l for l in valid_labels if not unchanged.loc[l]]
        for lbl in changed_lbls:
            if len(items) >= cap:
                truncated = True
                # Sort before return
                label_order = {lbl: i for i, lbl in enumerate(valid_labels)}
                items.sort(key=lambda x: (label_order.get(x["row_id"], 999999), x["column"]))
                return items, truncated

            old_val = o_s.at[lbl]
            new_val = c_s.at[lbl]

            if edited_keys and (int(lbl), col_str) in edited_keys:
                reason = "edited"
            elif invalid_replaced_keys and (int(lbl), col_str) in invalid_replaced_keys:
                reason = "invalid_replaced"
            else:
                reason = _change_reason(old_val, new_val, col_str, edited_keys)

            items.append({
                "row_id": int(lbl),
                "column": col_str,
                "old": _to_json_safe(old_val),
                "new": _to_json_safe(new_val),
                "reason": reason,
            })

    label_order = {lbl: i for i, lbl in enumerate(valid_labels)}
    items.sort(key=lambda x: (label_order.get(x["row_id"], 999999), x["column"]))
    return items, truncated


def compute_removed_rows(
    original_df: pd.DataFrame,
    cleaned_df: pd.DataFrame,
    window_size: int = CLEANER_PREVIEW_ROWS,
    offset: int = 0,
    cap: int = 500,
) -> list[int]:
    """
    Labels in original_df.index[offset : offset + window_size] that are missing from cleaned_df.index.
    """
    orig_labels = original_df.index[offset : offset + window_size]
    clean_index_set = set(cleaned_df.index)
    removed = [int(lbl) for lbl in orig_labels if lbl not in clean_index_set]
    return removed[:cap]
