from pydantic import BaseModel
from typing import Any, Literal


class ColumnProfile(BaseModel):
    """
    Thông tin phân tích của một cột dữ liệu.
    """
    name: str
    detected_type: Literal["numeric", "datetime", "categorical", "text"]
    unique_count: int
    null_count: int
    null_pct: float                 # Phần trăm giá trị rỗng (0.0 → 100.0)
    sample_values: list[Any]        # Tối đa 5 giá trị mẫu
    suggested_charts: list[str]     # ["bar", "pie"] hoặc [] nếu type=text
    skip_chart: bool = False
    skip_reason: str | None = None
    low_confidence: bool = False
    disguised_numeric: dict | None = None
    type_warning: str | None = None
    unnamed_warning: str | None = None


class SemanticContext(BaseModel):
    """
    Kết quả phân tích ngữ cảnh từ Gemini LLM.
    domain: lĩnh vực dữ liệu (Marketing, HR, Finance, Education...)
    confidence: mức độ tự tin (0.0 → 1.0)
    reasoning: lý giải ngắn từ LLM
    """
    domain: str
    confidence: float
    reasoning: str


class ProfileResponse(BaseModel):
    """
    Response đầy đủ trả về cho frontend sau khi profile xong file.
    """
    file_hash: str          # MD5 của file, dùng làm cache key
    filename: str
    total_rows: int
    total_columns: int
    columns: list[ColumnProfile]
    semantic_context: SemanticContext
    cached: bool            # True nếu kết quả lấy từ Redis cache
