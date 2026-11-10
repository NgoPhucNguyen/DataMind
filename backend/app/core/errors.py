"""
errors.py
---------
Định nghĩa hệ thống Error Handling cốt lõi (Core Error Schema) cho DataMind.
Chuẩn hóa Pydantic schema cho lỗi 2 lớp (hỗ trợ hiển thị UI và debug backend).
"""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class ErrorSeverity(str, Enum):
    CRITICAL = "CRITICAL"    # Lỗi nghiêm trọng, hệ thống không thể xử lý
    BLOCKING = "BLOCKING"    # Lỗi chặn luồng hiện tại (ví dụ: file sai format)
    DEGRADED = "DEGRADED"    # Lỗi nhưng hệ thống vẫn tiếp tục được (fallback)
    WARNING = "WARNING"      # Cảnh báo (ví dụ: tự động điền giá trị thiếu)

class ErrorDetailSchema(BaseModel):
    module: str = Field(..., description="Tên module xảy ra lỗi, ví dụ: 'data_cleaner'")
    location: str = Field(..., description="Vị trí hàm hoặc class lỗi, ví dụ: 'drop_duplicates'")
    root_cause: str = Field(..., description="Nguyên nhân gốc (thường từ Exception message)")

class SuggestedActionSchema(BaseModel):
    action_type: str = Field(..., description="Loại hành động gợi ý, ví dụ: 'REUPLOAD_FILE', 'OPEN_MODAL'")
    payload: Optional[Dict[str, Any]] = Field(default=None, description="Dữ liệu kèm theo hành động")

class ErrorResponseSchema(BaseModel):
    code: str = Field(..., description="Mã lỗi chuẩn: PREFIX_MODULE_ISSUE (vd: ERR_VIZ_HEATMAP_NONUMERIC)")
    severity: ErrorSeverity = Field(..., description="Mức độ nghiêm trọng của lỗi")
    user_message: str = Field(..., description="Thông báo thân thiện để hiển thị cho người dùng")
    technical_detail: ErrorDetailSchema = Field(..., description="Thông tin debug cho backend")
    suggested_action: Optional[SuggestedActionSchema] = Field(default=None, description="Hành động gợi ý cho frontend UI")

class DataMindException(Exception):
    """
    Custom exception gốc của DataMind.
    Các exception cụ thể khác có thể kế thừa từ class này.
    """
    def __init__(
        self,
        code: str,
        severity: ErrorSeverity,
        user_message: str,
        technical_detail: dict,
        suggested_action: Optional[dict] = None,
        status_code: int = 400
    ):
        self.code = code
        self.severity = severity
        self.user_message = user_message
        self.technical_detail = technical_detail
        self.suggested_action = suggested_action
        self.status_code = status_code
        super().__init__(self.user_message)
        # Validate ngay lập tức để fail fast
        self.to_schema()

    def to_schema(self) -> ErrorResponseSchema:
        return ErrorResponseSchema(
            code=self.code,
            severity=self.severity,
            user_message=self.user_message,
            technical_detail=ErrorDetailSchema(**self.technical_detail),
            suggested_action=SuggestedActionSchema(**self.suggested_action) if self.suggested_action else None
        )
