"""
files.py (router)
-----------------
Endpoint: POST /api/v1/files/profile
Upload CSV hoặc XLSX → phân tích bằng Pandas → ngữ cảnh từ Gemini → cache Redis → ProfileResponse
File KHÔNG ghi vào disk. Đọc từ memory buffer (io.BytesIO).
"""

import io
import hashlib
import logging

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_current_user
from app.core import cache
from app.schemas.files import ProfileResponse, SemanticContext, ColumnProfile
from app.services import profiler_service, llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["Files"])

# Các đuôi file được chấp nhận
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _validate_extension(filename: str) -> str:
    """Kiểm tra extension hợp lệ. Trả về extension (vd: '.csv')."""
    lower = filename.lower()
    for ext in ALLOWED_EXTENSIONS:
        if lower.endswith(ext):
            return ext
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Chỉ chấp nhận file: {', '.join(ALLOWED_EXTENSIONS)}",
    )


def _read_dataframe(file_bytes: io.BytesIO, ext: str) -> pd.DataFrame:
    """Parse file bytes thành DataFrame theo extension."""
    try:
        if ext == ".csv":
            return pd.read_csv(file_bytes)
        else:
            return pd.read_excel(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Không thể đọc file: {str(e)}",
        )


@router.post(
    "/profile",
    response_model=ProfileResponse,
    summary="Phân tích cấu trúc file CSV/Excel",
    description=(
        "Upload file CSV hoặc Excel. "
        "Hệ thống phân loại từng cột (Numeric/Datetime/Categorical/Text), "
        "gợi ý biểu đồ, và dùng Gemini AI để đoán lĩnh vực của dataset."
    ),
)
async def profile_file(
    file: UploadFile = File(..., description="File CSV hoặc Excel cần phân tích"),
    current_user: dict = Depends(get_current_user),
):
    # 1. Validate extension
    ext = _validate_extension(file.filename)

    # 2. Đọc bytes vào RAM — KHÔNG ghi disk
    content = await file.read()

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File vượt quá giới hạn 10MB.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File rỗng.",
        )

    # 3. Tính hash để kiểm tra cache
    file_hash = hashlib.md5(content).hexdigest()

    # 4. Kiểm tra Redis cache
    cached_data = cache.get_profile(file_hash)
    if cached_data:
        logger.info("Cache HIT: file_hash=%s user=%s", file_hash, current_user["user_id"])
        return ProfileResponse(**cached_data, cached=True)

    # 5. Parse DataFrame từ memory buffer
    file_bytes = io.BytesIO(content)
    df = _read_dataframe(file_bytes, ext)

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File không có dữ liệu.",
        )

    # 6. Profile bằng Pandas (dynamic, không hardcode tên cột)
    columns_raw = profiler_service.profile_dataframe(df)
    columns = [ColumnProfile(**col) for col in columns_raw]

    # 7. Gọi Gemini LLM để phân tích ngữ cảnh (có fallback nếu lỗi)
    semantic_raw = await llm_service.get_semantic_context(columns_raw)
    semantic = SemanticContext(**semantic_raw)

    # 8. Tạo response
    result = ProfileResponse(
        file_hash=file_hash,
        filename=file.filename,
        total_rows=len(df),
        total_columns=len(df.columns),
        columns=columns,
        semantic_context=semantic,
        cached=False,
    )

    # 9. Lưu vào Redis cache (bỏ qua nếu Redis lỗi)
    cache_data = result.model_dump()
    cache_data.pop("cached", None)  # Không lưu field cached vào Redis
    cache.set_profile(file_hash, cache_data)

    logger.info(
        "Profiled: file=%s rows=%d cols=%d domain=%s user=%s",
        file.filename, len(df), len(df.columns),
        semantic.domain, current_user["user_id"],
    )

    return result
