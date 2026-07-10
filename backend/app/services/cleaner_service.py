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
from app.services import semantic_rules

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

def _get_error_cells(
    df: pd.DataFrame, 
    overridden_types: dict[str, str], 
    column_semantics: dict[str, str] | None = None,
    downgraded_cols: set[str] | None = None
) -> list[dict]:
    """
    Trả về danh sách các ô (cell) bị lỗi.
    [{"row_id": int, "column": str, "issue_type": "missing" | "type_mismatch" | "encoding" | "semantic_error"}]
    """
    error_cells = []
    
    for col_name in df.columns:
        series = df[col_name]
        col_type = overridden_types.get(col_name, _infer_type(series))

        # 4. Semantic errors (must be checked before skipping text columns)
        col_sem = column_semantics or {}
        downgraded = downgraded_cols or set()
        semantic_type = col_sem.get(str(col_name), "GENERAL_TEXT")
        if semantic_type != "GENERAL_TEXT":
            severity = "hint" if str(col_name) in downgraded else semantic_rules.get_semantic_severity(semantic_type)
            for idx, val in series.items():
                if not semantic_rules.validate_cell(val, semantic_type):
                    error_cells.append({
                        "row_id": int(idx),
                        "column": str(col_name),
                        "issue_type": "semantic_error",
                        "severity": severity,
                        "semantic_type": semantic_type
                    })

        if col_type == "text":
            continue

        # 1. Missing values
        missing_indices = series[series.isna()].index
        for idx in missing_indices:
            error_cells.append({
                "row_id": int(idx),
                "column": str(col_name),
                "issue_type": "missing"
            })

        # 2. Wrong type
        if pd.api.types.is_object_dtype(series.dtype) and col_type == "numeric":
            convertible, _ = _is_numeric_convertible(series)
            if convertible:
                # Tìm các dòng không convert được (sau khi ép kiểu thành số bị NaN nhưng gốc không NaN)
                non_null = series.dropna()
                parsed = clean_to_numeric(non_null)
                mismatch_indices = parsed[parsed.isna()].index
                for idx in mismatch_indices:
                    error_cells.append({
                        "row_id": int(idx),
                        "column": str(col_name),
                        "issue_type": "type_mismatch"
                    })


        # 3. Encoding lỗi
        if pd.api.types.is_object_dtype(series.dtype):
            non_null = series.dropna()
            for idx, val in non_null.items():
                if _BAD_CHAR_PATTERN.search(str(val)):
                    error_cells.append({
                        "row_id": int(idx),
                        "column": str(col_name),
                        "issue_type": "encoding"
                    })
                    
    return error_cells

# ─── detect_issues ──────────────────────────────────────────────────────────

def detect_issues(
    df: pd.DataFrame,
    filename: str,
    file_hash: str,
    overridden_types: dict[str, str] | None = None,
    column_semantics: dict[str, str] | None = None,
) -> dict:
    """
    Quét toàn bộ DataFrame và phân loại vấn đề theo 4 nhóm gốc + nhóm Semantic Errors.
    Trả về dict tương thích với IssueReport schema.
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

    for col_name in df.columns:
        series = df[col_name]
        col_type = overridden_types.get(col_name, _infer_type(series))

        # Check semantic errors regardless of basic text types
        semantic_type = column_semantics.get(str(col_name), "GENERAL_TEXT")
        if semantic_type != "GENERAL_TEXT":
            violation_count = 0
            for val in series:
                if not semantic_rules.validate_cell(val, semantic_type):
                    violation_count += 1
                    
            if violation_count > 0:
                total_non_null = len(series.dropna())
                is_system_error = semantic_rules.is_semantic_error_column(violation_count, total_non_null)
                severity = semantic_rules.get_semantic_severity(semantic_type)
                
                # Report as system semantic error ONLY IF it exceeds threshold and is "error" severity
                if is_system_error and severity == "error":
                    violation_pct = round(violation_count / (total_non_null if total_non_null > 0 else 1) * 100, 2)
                    if violation_pct > 50.0:
                        severity = "hint"
                        downgraded_cols.add(str(col_name))
                        logger.warning(f"Downgrading severity of {col_name} ({semantic_type}) to 'hint' because violation rate is suspiciously high ({violation_pct}%).")
                    else:
                        semantic_errors.append({
                            "column": str(col_name),
                            "semantic_type": semantic_type,
                            "violation_count": violation_count,
                            "violation_pct": violation_pct,
                            "severity": severity
                        })

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
        
    error_cells = _get_error_cells(df, overridden_types, column_semantics, downgraded_cols)

    has_issues = bool(missing_values or wrong_types or encoding_errors or duplicates_info or semantic_errors)

    # Lấy dữ liệu mẫu cho preview
    preview_df = df.head(100).copy()
    preview_df = preview_df.replace({float('nan'): None, pd.NaT: None})
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
    preview_df = preview_df.reset_index(names="original_index")

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
        "has_issues": has_issues,
        "preview_data": preview_df.to_dict(orient="records"),
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


# ─── apply_manual_actions ───────────────────────────────────────────────────

def apply_manual_actions(df: pd.DataFrame, actions: list) -> pd.DataFrame:
    """
    Áp dụng tuần tự các thao tác làm sạch thủ công (Manual Action Recipe) lên DataFrame.
    """
    cleaned = df.copy()
    
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
                    
            elif act_type == "DROP_DUPLICATES":
                cleaned = cleaned.drop_duplicates(keep="first")
                
            elif act_type == "STRIP_BAD_CHARS":
                if col in cleaned.columns and pd.api.types.is_object_dtype(cleaned[col].dtype):
                    cleaned[col] = cleaned[col].apply(_strip_bad_chars)
                    
            elif act_type == "CONVERT_TO_NUMERIC":
                if col in cleaned.columns:
                    cleaned[col] = clean_to_numeric(cleaned[col])
                    
            elif act_type == "CONVERT_TO_DATETIME":
                if col in cleaned.columns:
                    cleaned[col] = pd.to_datetime(cleaned[col], errors='coerce')
                    
            elif act_type == "FILL_MISSING_MEDIAN":
                if col in cleaned.columns:
                    fill_val = cleaned[col].median()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "FILL_MISSING_UNKNOWN":
                if col in cleaned.columns:
                    cleaned[col] = cleaned[col].fillna("Không xác định")
                    
            elif act_type == "FILL_MISSING_CUSTOM_VALUE":
                if col in cleaned.columns:
                    val = params.get("value")
                    cleaned[col] = cleaned[col].fillna(val)
                    
            elif act_type == "FILL_MISSING_MEAN":
                if col in cleaned.columns:
                    fill_val = cleaned[col].mean()
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "FILL_MISSING_MODE":
                if col in cleaned.columns:
                    mode_s = cleaned[col].mode()
                    # Nếu có mode thì lấy phần tử đầu, không thì dùng "Unknown" cho an toàn
                    fill_val = mode_s.iloc[0] if len(mode_s) > 0 else "Unknown"
                    cleaned[col] = cleaned[col].fillna(fill_val)
                    
            elif act_type == "RENAME_COLUMN":
                if col in cleaned.columns:
                    new_name = params.get("new_name")
                    if new_name:
                        cleaned = cleaned.rename(columns={col: str(new_name)})

            elif act_type == "BATCH_EDIT_CELLS":
                edits = params.get("edits", [])
                for edit in edits:
                    r_id = edit.get("row_id")
                    c_name = edit.get("column")
                    n_val = edit.get("new_value")
                    
                    if c_name not in cleaned.columns:
                        raise ValueError(f"Không thể sửa ô: Cột '{c_name}' không tồn tại (có thể đã bị xóa hoặc đổi tên trước đó).")
                        
                    if r_id is None or pd.isna(r_id):
                        raise ValueError("Không thể sửa ô: row_id không được để trống (None/NaN).")
                        
                    if r_id in cleaned.index:
                        try:
                            cleaned.at[r_id, c_name] = n_val
                        except Exception as e:
                            logger.warning(f"Không thể sửa ô tại dòng {r_id}, cột {c_name}: {e}")
                    else:
                        raise ValueError(f"Không thể sửa ô: Dòng {r_id} không tồn tại trong dữ liệu.")
                        
        except ValueError as ve:
            # Re-raise ValueError để router bắt và trả về 400
            raise ve
        except Exception as e:
            logger.warning(f"Error applying action {action}: {e}")
            
    return cleaned
