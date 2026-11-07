"""
cleaner.py (schemas)
--------------------
Pydantic models cho Module 2 — Data Cleaner.

Flow:
  1. POST /files/detect-issues  → IssueReport
  2. POST /files/auto-clean     → AutoCleanResponse (DiffReport + ValidationResult)
  3. POST /files/confirm-clean  → CleanDatasetResponse (+ ValidationResult)
"""

from pydantic import BaseModel
from typing import Any


class WindowInfo(BaseModel):
    """Thông tin phân trang cửa sổ dữ liệu (Row Window)."""
    offset: int = 0
    size: int = 150
    mode: str = "all"  # "all" | "errors"
    total_rows: int = 0
    total_error_rows: int = 0
    first_excel_row: int | None = None
    last_excel_row: int | None = None


# ─── Sub-models cho từng loại issue ────────────────────────────────────────

class ErrorCell(BaseModel):
    """Lưu trữ tọa độ chính xác của các ô lỗi (missing, type_mismatch, encoding)."""
    row_id: int
    column: str
    issue_type: str
    severity: str | None = None
    semantic_type: str | None = None

class MissingIssue(BaseModel):
    """Thông tin missing values trong 1 cột."""
    column: str
    null_count: int
    null_pct: float           # 0.0 → 100.0
    detected_type: str        # "numeric" | "datetime" | "categorical" | "text"
    suggested_fill: str       # "median" | "mode" | "Unknown" | "drop"


class WrongTypeIssue(BaseModel):
    """Cột object có thể convert thành số nhưng chưa được convert."""
    column: str
    current_dtype: str        # Ví dụ: "object"
    convertible_pct: float    # % giá trị non-null có thể parse thành số
    suggested_type: str       # "float" | "int"
    sample_values: list[Any]  # Vài ví dụ giá trị


class EncodingIssue(BaseModel):
    """Cột có ký tự replacement/control character."""
    column: str
    bad_char_count: int
    sample_bad_values: list[str]


class DuplicateIssue(BaseModel):
    """Thông tin dòng trùng lặp."""
    duplicate_count: int      # Số dòng trùng (không tính dòng giữ lại)
    total_rows: int
    near_empty_count: int = 0
    warning: str | None = None

class SemanticIssue(BaseModel):
    """Cột có lỗi ngữ nghĩa vượt ngưỡng hệ thống."""
    column: str
    semantic_type: str
    violation_count: int
    violation_pct: float
    severity: str


# ─── IssueReport (response của detect-issues) ─────────────────────────────

class IssueReport(BaseModel):
    """
    Kết quả quét toàn bộ dataset, nhóm theo 4 loại issue.
    Trả về sau POST /files/detect-issues.
    """
    file_hash: str
    filename: str
    total_rows: int
    total_columns: int
    missing_values: list[MissingIssue]
    wrong_types: list[WrongTypeIssue]
    encoding_errors: list[EncodingIssue]
    semantic_errors: list[SemanticIssue] = []
    duplicates: DuplicateIssue | None     # None nếu không có duplicate nào
    error_cells: list[ErrorCell] = []
    has_issues: bool                      # True nếu có ít nhất 1 vấn đề
    preview_data: list[dict] = []         # Sample data kèm original_index
    semantic_status: str = "checked"      # "not_run" | "no_special_columns" | "checked"
    semantic_checked: bool | None = None  # Backward compatibility
    preview_rows: int = 150
    column_issue_counts: dict[str, dict[str, int]] = {}
    column_letters: dict[str, str] = {}
    window: WindowInfo | None = None


# ─── Request bodies ────────────────────────────────────────────────────────

class IssueDetectRequest(BaseModel):
    """Request body cho POST /files/detect-issues."""
    file_hash: str
    overridden_types: dict[str, str] = {}   # {"col_name": "categorical"}
    offset: int = 0
    mode: str = "all"  # "all" | "errors"


class AutoCleanRequest(BaseModel):
    """Request body cho POST /files/auto-clean."""
    file_hash: str
    overridden_types: dict[str, str] = {}
    offset: int = 0
    mode: str = "all"  # "all" | "errors"


class CleanAction(BaseModel):
    """
    Thao tác làm sạch thủ công (Manual Action Recipe).
    Hỗ trợ BATCH_EDIT_CELLS với params: {"edits": [{"row_id": int, "column": str, "new_value": any}]}
    """
    action_type: str            # "DROP_COLUMN", "FILL_MISSING_MEAN", "RENAME_COLUMN", "BATCH_EDIT_CELLS", v.v.
    column: str                 # Tên cột áp dụng ("all" nếu là DROP_DUPLICATES, BATCH_EDIT_CELLS có thể dùng "all" hoặc bỏ qua)
    params: dict[str, Any] = {} # Dữ liệu bổ sung (vd: {"value": 0}, {"new_name": "age"}, {"edits": [...]})


class ConfirmCleanRequest(BaseModel):
    """Request body cho POST /files/confirm-clean."""
    file_hash: str
    clean_mode: str                          # "auto" | "manual"
    overridden_types: dict[str, str] = {}
    actions: list[CleanAction] = []          # Dành cho chế độ manual
    ignored_cells_count: int = 0



class ManualCleanPreviewRequest(BaseModel):
    """Request body cho POST /files/manual-clean-preview."""
    file_hash: str
    actions: list[CleanAction] = []
    offset: int = 0
    mode: str = "all"  # "all" | "errors"


class ManualCleanPreviewResponse(BaseModel):
    """Response trả về khi preview thao tác làm sạch thủ công."""
    preview_data: list[dict] = []
    error_cells: list[ErrorCell] = []
    changed_cells: list[dict] = []
    removed_rows: list[int] = []
    changed_truncated: bool = False
    preview_rows: int = 150
    column_letters: dict[str, str] = {}
    column_issue_counts: dict[str, dict[str, int]] = {}
    window: WindowInfo | None = None


class ErrorCellsRequest(BaseModel):
    """Request body cho POST /files/error-cells."""
    file_hash: str
    actions: list[CleanAction] = []
    overridden_types: dict[str, str] = {}
    column: str
    issue_type: str
    offset: int = 0
    limit: int = 20


class ErrorCellGroupItem(BaseModel):
    excel_row: int
    letter: str
    value: Any = None
    issue: str
    row_id: int
    column: str


class ErrorCellsResponse(BaseModel):
    """Response cho danh sách ô có lỗi của nhóm (column, issue_type)."""
    cells: list[ErrorCellGroupItem] = []
    total: int = 0
    column: str
    issue_type: str
    offset: int = 0
    limit: int = 20


class LocateRowRequest(BaseModel):
    """Request body cho định vị dòng (locate row offset & status)."""
    file_hash: str
    excel_row: int
    mode: str = "all"  # "all" | "errors"
    clean_mode: str = "detect"  # "detect" | "auto" | "manual"
    actions: list[CleanAction] = []
    overridden_types: dict[str, str] = {}


class LocateRowResponse(BaseModel):
    """Response cho định vị dòng."""
    status: str  # "found" | "removed" | "not_found" | "not_in_errors"
    offset: int | None = None
    excel_row: int
    reason: str | None = None
    mode: str = "all"
    window: WindowInfo | None = None


# ─── DiffReport (thay đổi sau khi clean) ──────────────────────────────────

class DiffReport(BaseModel):
    """
    Báo cáo so sánh trước/sau khi auto-clean.
    Trả về sau POST /files/auto-clean.
    """
    original_rows: int
    clean_rows: int
    original_cols: int
    clean_cols: int
    duplicate_rows_removed: int
    missing_filled: dict[str, int]            # {"age": 43, "income": 17}
    types_converted: dict[str, str]           # {"salary": "object → float64"}
    encoding_fixed: dict[str, int]            # {"name": 8}
    columns_dropped: list[str] = []
    invalid_replaced: dict[str, int] = {}     # {"col": count}
    format_normalized: dict[str, int] = {}    # {"col": count}
    columns_renamed: dict[str, str] = {}      # {"old": "new"}
    cells_edited_manually: int = 0


# ─── ValidationResult (kết quả validate 2 tầng) ──────────────────────────

class HardBlock(BaseModel):
    """Lỗi nghiêm trọng — không cho đi tiếp."""
    code: str
    message: str


class ValidationWarning(BaseModel):
    """Cảnh báo — cho đi tiếp nhưng hiện thông báo."""
    code: str
    message: str
    impact: str | None = None


class ValidationResult(BaseModel):
    """
    Kết quả validate 2 tầng:
      - can_proceed=False + hard_blocks → chặn hoàn toàn
      - can_proceed=True  + warnings    → cho đi tiếp, hiện cảnh báo
      - capabilities: chart types khả dụng cho Module 3
    """
    can_proceed: bool
    hard_blocks: list[HardBlock] = []
    warnings: list[ValidationWarning] = []
    capabilities: dict[str, bool] = {}


class AutoCleanResponse(BaseModel):
    """Response đầy đủ sau khi auto-clean (chưa confirm)."""
    file_hash: str
    diff_report: DiffReport
    validation: ValidationResult | None = None
    preview_data: list[dict] = []
    error_cells: list[ErrorCell] = []     # Lỗi (như semantic_error) còn tồn đọng sau auto-clean
    changed_cells: list[dict] = []        # Cell-level diff vs original
    removed_rows: list[int] = []          # Index labels dropped by dedup/drop
    changed_truncated: bool = False       # True when changed_cells hit cap
    preview_rows: int = 150
    column_letters: dict[str, str] = {}
    window: WindowInfo | None = None


# ─── summary_for_module3 ──────────────────────────────────────────────────

class SummaryForModule3(BaseModel):
    """
    Tóm tắt nhỏ gọn truyền sang Module 3 (Statistics).
    Không cần parse lại file — dùng trực tiếp để khởi tạo pipeline tiếp theo.
    """
    shape: list[int]                            # [rows, cols]
    columns: list[str]
    dtypes: dict[str, str]                      # {"id": "int64", "age": "float64"}
    numeric_columns: list[str]
    categorical_columns: list[str]


# ─── CleanDatasetResponse (response của confirm-clean) ────────────────────

class CleanDatasetResponse(BaseModel):
    """
    Response cuối cùng sau khi user bấm 'Xác nhận'.
    Dataset đã được lưu lên Supabase Storage.
    """
    session_id: str                # UUID của clean session
    filename: str
    clean_file_url: str | None = None          # Supabase Storage public/signed URL
    clean_report: DiffReport
    summary_for_module3: SummaryForModule3
    clean_mode: str                # "auto" | "manual"
    confirmed_at: str              # ISO datetime string
    validation: ValidationResult | None = None
    preview_data: list[dict] = []
    preview_rows: int = 150
    column_letters: dict[str, str] = {}
    window: WindowInfo | None = None
