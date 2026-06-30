"""
files.py (router)
-----------------
Endpoint: POST /api/v1/files/profile
Upload CSV hoặc XLSX → phân tích bằng Pandas → ngữ cảnh từ Gemini → cache Redis → ProfileResponse
File KHÔNG ghi vào disk. Đọc từ memory buffer (io.BytesIO).
"""

import io
import re
import hashlib
import logging
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_current_user
from app.core import cache
from app.schemas.files import ProfileResponse, SemanticContext, ColumnProfile
from app.schemas.cleaner import (
    IssueDetectRequest, IssueReport,
    AutoCleanRequest, AutoCleanResponse, DiffReport,
    ConfirmCleanRequest, CleanDatasetResponse, SummaryForModule3,
    ValidationResult,
)
from pydantic import BaseModel
from app.services import profiler_service, llm_service, cleaner_service

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
            df = pd.read_csv(file_bytes)
        else:
            df = pd.read_excel(file_bytes)

        # ── Filter cột Unnamed ──────────────────────────────────────
        # Phân biệt 2 trường hợp:
        #   1. Unnamed + 100% NaN → xóa hẳn (cột rác do Pandas tự đặt)
        #   2. Unnamed + CÓ data  → giữ lại, đổi tên placeholder
        cols_to_drop = []
        rename_map = {}
        unnamed_counter = 0

        for col in df.columns:
            col_str = str(col)
            is_unnamed = bool(re.match(r'^Unnamed: \d+$', col_str))

            if is_unnamed and df[col].isna().all():
                # Cột trống hoàn toàn + tên tự động → xóa
                cols_to_drop.append(col)
            elif is_unnamed and not df[col].isna().all():
                # Cột có data nhưng không có header → đổi tên placeholder
                rename_map[col] = f"Cột không tên ({chr(65 + unnamed_counter)})"
                unnamed_counter += 1

        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        if rename_map:
            df = df.rename(columns=rename_map)

        # Xóa dòng 100% trống
        df = df.dropna(how='all')

        return df
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
    force_refresh: bool = False,
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
    CACHE_VERSION = "v4"
    file_hash = f"{CACHE_VERSION}:{hashlib.md5(content).hexdigest()}"

    # 4. Kiểm tra Redis cache
    if force_refresh:
        # User bấm "Phân tích lại" → xóa cache cũ trước, rồi chạy lại từ đầu
        cache.delete_profile(file_hash)
        logger.info("Force refresh: deleted cache for file_hash=%s user=%s", file_hash, current_user["user_id"])
    else:
        cached_data = cache.get_profile(file_hash)
        if cached_data:
            logger.info("Cache HIT: file_hash=%s user=%s", file_hash, current_user["user_id"])
            # FIX: Mặc dù profile cache hit (TTL 24h), file bytes có thể đã hết hạn (TTL 1h).
            # Ta cần đảm bảo file bytes được lưu lại vào cache.
            cache.set_file_bytes(file_hash, content, file.filename, ext)
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

    # 10. Lưu file bytes vào Redis để Cleaner endpoints tái dùng (TTL 1h)
    cache.set_file_bytes(file_hash, content, file.filename, ext)

    logger.info(
        "Profiled: file=%s rows=%d cols=%d domain=%s user=%s",
        file.filename, len(df), len(df.columns),
        semantic.domain, current_user["user_id"],
    )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/session/context
# ─────────────────────────────────────────────────────────────────────────────

class SessionContextRequest(BaseModel):
    session_id: str
    description: str = ""
    purpose: str = ""

@router.post(
    "/session/context",
    summary="Lưu ngữ cảnh dataset",
)
async def save_session_context(
    body: SessionContextRequest,
    current_user: dict = Depends(get_current_user),
):
    cache.set_user_context(body.session_id, body.description, body.purpose)
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: tái tải DataFrame từ Redis cache
# ─────────────────────────────────────────────────────────────────────────────

def _load_df_from_cache(file_hash: str) -> tuple[pd.DataFrame, str, str]:
    """
    Lấy file bytes từ Redis cache và parse thành DataFrame.
    Raise 404 nếu không tìm thấy (hết TTL hoặc Redis chưa có).
    Trả về (df, filename, ext).
    """
    cached = cache.get_file_bytes(file_hash)
    if cached is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Phiên làm việc đã hết hạn hoặc file không tìm thấy. "
                "Vui lòng upload lại."
            ),
        )
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])
    return df, cached["filename"], cached["ext"]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/detect-issues
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/detect-issues",
    response_model=IssueReport,
    summary="Quét và phân loại các vấn đề dữ liệu",
    description=(
        "Nhận file_hash của file đã profile. "
        "Trả về báo cáo các issue (missing, wrong type, encoding, duplicate)."
    ),
)
async def detect_issues(
    body: IssueDetectRequest,
    current_user: dict = Depends(get_current_user),
):
    df, filename, _ = _load_df_from_cache(body.file_hash)

    report_raw = cleaner_service.detect_issues(
        df=df,
        filename=filename,
        file_hash=body.file_hash,
        overridden_types=body.overridden_types,
    )

    logger.info(
        "IssueDetect: file=%s missing=%d wrong_type=%d encoding=%d dup=%s user=%s",
        filename,
        len(report_raw["missing_values"]),
        len(report_raw["wrong_types"]),
        len(report_raw["encoding_errors"]),
        report_raw["duplicates"],
        current_user["user_id"],
    )
    return IssueReport(**report_raw)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/auto-clean
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/auto-clean",
    response_model=AutoCleanResponse,
    summary="Tự động làm sạch dữ liệu",
    description=(
        "Áp dụng rule mặc định để làm sạch: fill missing, convert type, strip encoding, drop duplicate. "
        "Trả về DiffReport (chưa lưu — user cần bấm Xác nhận)."
    ),
)
async def auto_clean(
    body: AutoCleanRequest,
    current_user: dict = Depends(get_current_user),
):
    df, filename, _ = _load_df_from_cache(body.file_hash)

    cleaned_df, diff_raw = cleaner_service.auto_clean(
        df=df,
        overridden_types=body.overridden_types,
    )

    # Kiểm tra gàng buộc sau khi clean
    validation_dict = cleaner_service.validate_clean_dataset(cleaned_df)
    validation_res = ValidationResult(**validation_dict)

    # Nếu có lỗi cứng, có thể block luôn ở server nếu muốn (tuỳ business logic).
    # Nhưng theo yêu cầu, frontend sẽ đọc can_proceed để hiển thị lỗi. 
    # Ta vẫn nên trả về 200 kèm validation result để UI vẽ lỗi rõ ràng.

    # Cache kết quả DataFrame đã clean (1h) để confirm step dùng
    import io as _io
    buf = _io.BytesIO()
    cleaned_df.to_csv(buf, index=False)
    buf.seek(0)
    clean_hash = f"{body.file_hash}_clean"
    cache.set_file_bytes(clean_hash, buf.read(), filename, ".csv")

    logger.info(
        "AutoClean: file=%s rows %d→%d user=%s",
        filename, diff_raw["original_rows"], diff_raw["clean_rows"],
        current_user["user_id"],
    )
    import math
    preview_df = cleaned_df.head(500).copy()
    preview_df = preview_df.replace({float('nan'): None, pd.NaT: None})
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

    return AutoCleanResponse(
        file_hash=body.file_hash,
        diff_report=DiffReport(**diff_raw),
        validation=validation_res,
        preview_data=preview_df.to_dict(orient="records"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/confirm-clean
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/confirm-clean",
    response_model=CleanDatasetResponse,
    summary="Xác nhận và chốt Clean Dataset",
    description=(
        "Chạy lại clean lần cuối, validate, rồi lưu lên Supabase Storage. "
        "Clean Dataset được chốt và có thể truyền sang Module 3."
    ),
)
async def confirm_clean(
    body: ConfirmCleanRequest,
    current_user: dict = Depends(get_current_user),
):
    df, filename, _ = _load_df_from_cache(body.file_hash)

    # Chạy auto_clean lần cuối (manual mode: user tự sửa trước — cần luồng kéo dài sau)
    cleaned_df, diff_raw = cleaner_service.auto_clean(
        df=df,
        overridden_types=body.overridden_types,
    )

    # Validate cuối
    validation_dict = cleaner_service.validate_clean_dataset(cleaned_df)
    validation_res = ValidationResult(**validation_dict)
    
    if not validation_res.can_proceed:
        # Lấy thông báo lỗi đầu tiên để show, thực tế có list lỗi trong hard_blocks
        reason = validation_res.hard_blocks[0].message if validation_res.hard_blocks else "Dữ liệu không hợp lệ."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=reason,
        )

    # Xuất ra CSV bytes
    import io as _io
    buf = _io.BytesIO()
    cleaned_df.to_csv(buf, index=False)
    csv_bytes = buf.getvalue()

    # Upload lên Supabase Storage (nếu có cấu hình)
    clean_file_url = _upload_to_supabase(csv_bytes, filename, current_user["user_id"])

    # Tạo session
    session_id = str(uuid.uuid4())
    confirmed_at = datetime.now(timezone.utc).isoformat()
    summary = cleaner_service.build_summary_for_module3(cleaned_df)

    # Cache file bytes theo session_id để Module 3 có thể lấy ra
    cache.set_file_bytes(session_id, csv_bytes, filename, ".csv")

    logger.info(
        "ConfirmClean: session=%s file=%s mode=%s rows=%d user=%s",
        session_id, filename, body.clean_mode,
        diff_raw["clean_rows"], current_user["user_id"],
    )

    return CleanDatasetResponse(
        session_id=session_id,
        filename=filename,
        clean_file_url=clean_file_url,
        clean_report=DiffReport(**diff_raw),
        summary_for_module3=SummaryForModule3(**summary),
        clean_mode=body.clean_mode,
        confirmed_at=confirmed_at,
        validation=validation_res,
    )

#Need checking!
def _upload_to_supabase(csv_bytes: bytes, original_filename: str, user_id: int) -> str:
    """
    Upload file CSV lên Supabase Storage (bucket: "datasets").
    Nếu chưa có Supabase key → trả về URL giả (dev mode).

    Tương thích: supabase-py >= 2.0.0
    Bucket type: Private (dùng signed URL 7 ngày) hoặc Public (dùng public URL).
    """
    import os
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase chưa cấu hình — dùng dev fallback URL.")
        stem = original_filename.rsplit(".", 1)[0]
        return f"https://dev-placeholder.local/clean/{user_id}/{stem}_clean.csv"

    try:
        import httpx
        stem = original_filename.rsplit(".", 1)[0]
        path = f"clean/{user_id}/{stem}_clean.csv"
        
        # 1. Upload file
        upload_url = f"{supabase_url}/storage/v1/object/datasets/{path}"
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
            "Content-Type": "text/csv",
            "x-upsert": "true"
        }
        
        with httpx.Client() as client:
            resp = client.post(upload_url, headers=headers, content=csv_bytes)
            resp.raise_for_status()
            logger.info("Supabase upload OK: path=%s", path)

            # 2. Get Signed URL
            sign_url = f"{supabase_url}/storage/v1/object/sign/datasets/{path}"
            sign_resp = client.post(sign_url, headers=headers, json={"expiresIn": 604800})
            
            if sign_resp.status_code == 200:
                signed_path = sign_resp.json().get("signedURL")
                if signed_path:
                    return f"{supabase_url}/storage/v1{signed_path}"
                    
            # Fallback public URL
            return f"{supabase_url}/storage/v1/object/public/datasets/{path}"

    except Exception as e:
        logger.error("Supabase upload lỗi: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể lưu file lên storage: {str(e)[:200]}",
        )
