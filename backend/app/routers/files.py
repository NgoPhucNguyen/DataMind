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
from app.models import User

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_current_user, get_current_user_with_tier
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import check_ai_quota, record_ai_usage
from app.core import cache
from app.core.errors import DataMindException, ErrorSeverity
from app.schemas.files import ProfileResponse, SemanticContext, ColumnProfile
from app.schemas.cleaner import (
    IssueDetectRequest, IssueReport,
    AutoCleanRequest, AutoCleanResponse, DiffReport,
    ConfirmCleanRequest, CleanDatasetResponse, SummaryForModule3,
    ValidationResult, ManualCleanPreviewRequest
)
from pydantic import BaseModel
from app.services import profiler_service, llm_service, cleaner_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["Files"])

def _mark_first_upload(db: Session, user_id: int) -> bool:
    """Trả True đúng 1 lần cho mỗi user (lần upload đầu tiên)."""
    updated = (
        db.query(User)
        .filter(User.id == user_id, User.first_upload_at.is_(None))
        .update({"first_upload_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return updated == 1

# Các đuôi file được chấp nhận
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _validate_extension(filename: str) -> str:
    """Kiểm tra extension hợp lệ. Trả về extension (vd: '.csv')."""
    lower = filename.lower()
    for ext in ALLOWED_EXTENSIONS:
        if lower.endswith(ext):
            return ext
    raise DataMindException(
        code="ERR_FILE_EXT_INVALID",
        severity=ErrorSeverity.BLOCKING,
        user_message=f"Chỉ chấp nhận file: {', '.join(ALLOWED_EXTENSIONS)}",
        technical_detail={
            "module": "files",
            "location": "_validate_extension",
            "root_cause": f"Extension không hợp lệ từ filename: '{filename}'"
        },
        suggested_action=None
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
    except DataMindException:
        raise
    except Exception as e:
        raise DataMindException(
            code="ERR_FILE_PARSE_FAILED",
            severity=ErrorSeverity.BLOCKING,
            user_message=f"Không thể đọc file: {str(e)}",
            technical_detail={
                "module": "files",
                "location": "_read_dataframe",
                "root_cause": f"Exception khi parse file (ext={ext}): {str(e)}"
            },
            suggested_action=None
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
    current_user: dict = Depends(get_current_user_with_tier),
    db: Session = Depends(get_db),
):
    # 1. Validate extension
    ext = _validate_extension(file.filename)

    # 2. Đọc bytes vào RAM — KHÔNG ghi disk
    content = await file.read()

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise DataMindException(
            code="ERR_FILE_TOO_LARGE",
            severity=ErrorSeverity.BLOCKING,
            user_message="File vượt quá giới hạn 10MB.",
            technical_detail={
                "module": "files",
                "location": "profile_file",
                "root_cause": f"File size {len(content)} bytes vượt quá MAX_FILE_SIZE_BYTES={MAX_FILE_SIZE_BYTES}"
            },
            suggested_action=None
        )

    if len(content) == 0:
        raise DataMindException(
            code="ERR_FILE_EMPTY",
            severity=ErrorSeverity.BLOCKING,
            user_message="File rỗng.",
            technical_detail={
                "module": "files",
                "location": "profile_file",
                "root_cause": "File upload có content length = 0"
            },
            suggested_action=None
        )

    # 3. Tính hash để kiểm tra cache
    CACHE_VERSION = "v4"
    file_hash = f"{CACHE_VERSION}:{hashlib.md5(content).hexdigest()}"

    if current_user.get("tier") == "free":
        if not cache.check_active_session(current_user["user_id"], file_hash):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đang xử lý file khác, vui lòng đợi hoàn tất hoặc nâng cấp Pro để xử lý nhiều file cùng lúc."
            )
    cache.set_active_session(current_user["user_id"], file_hash)

    # 4. Kiểm tra Redis cache
    if force_refresh:
        # User bấm "Phân tích lại" → xóa cache cũ trước, rồi chạy lại từ đầu
        cache.delete_profile(current_user["user_id"], file_hash)
        logger.info("Force refresh: deleted cache for file_hash=%s user=%s", file_hash, current_user["user_id"])
    else:
        cached_data = cache.get_profile(current_user["user_id"], file_hash)
        if cached_data:
            logger.info("Cache HIT: file_hash=%s user=%s", file_hash, current_user["user_id"])
            # FIX: Mặc dù profile cache hit (TTL 24h), file bytes có thể đã hết hạn (TTL 1h).
            # Ta cần đảm bảo file bytes được lưu lại vào cache.
            cache.set_file_bytes(current_user["user_id"], file_hash, content, file.filename, ext)
            cached_data.pop("is_first_upload", None)
            return ProfileResponse(
      **cached_data, cached=True,
      is_first_upload=_mark_first_upload(db, current_user["user_id"]),
  )
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

    # 7. Ngữ cảnh mặc định (KHÔNG gọi Gemini tự động — user bấm nút để kích hoạt)
    semantic = SemanticContext(
        domain="Chưa phân tích",
        confidence=0.0,
        reasoning="Nhấn nút 'Phân tích AI' để hệ thống nhận diện lĩnh vực dữ liệu.",
    )
    
    for col in columns:
        col.semantic_type = "GENERAL_TEXT"
        col.semantic_confidence = 0.0

    # 8. Tạo response
    result = ProfileResponse(
        file_hash=file_hash,
        filename=file.filename,
        total_rows=len(df),
        total_columns=len(df.columns),
        columns=columns,
        semantic_context=semantic,
        cached=False,
        is_first_upload=_mark_first_upload(db, current_user["user_id"]),
    )

    # 9. Lưu vào Redis cache (bỏ qua nếu Redis lỗi)
    cache_data = result.model_dump()
    cache_data.pop("cached", None)  # Không lưu field cached vào Redis
    cache_data.pop("is_first_upload", None) 
    cache.set_profile(current_user["user_id"], file_hash, cache_data)

    # 10. Lưu file bytes vào Redis để Cleaner endpoints tái dùng (TTL 1h)
    cache.set_file_bytes(current_user["user_id"], file_hash, content, file.filename, ext)

    # Save profiler report section
    cache.set_report_section(current_user["user_id"], file_hash, "profiler", {
        "file_name": file.filename,
        "row_count": len(df),
        "col_count": len(df.columns),
        "schema": [c.model_dump() for c in columns]
    })

    # 11. Build và cache Markdown Dataset Context (Part 1) cho AI Explain
    from app.services.context_builder import build_dataset_context
    dataset_md = build_dataset_context(cache_data)
    cache.set_dataset_context_md(current_user["user_id"], file_hash, dataset_md)

    logger.info(
        "Profiled: file=%s rows=%d cols=%d domain=%s user=%s",
        file.filename, len(df), len(df.columns),
        semantic.domain, current_user["user_id"],
    )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/ai-context
# Gọi Gemini theo yêu cầu (không tự động) để phân tích ngữ cảnh dataset
# ─────────────────────────────────────────────────────────────────────────────

class AIContextRequest(BaseModel):
    file_hash: str

@router.post(
    "/ai-context",
    summary="Phân tích ngữ cảnh AI theo yêu cầu",
    description="Gọi Gemini để nhận diện lĩnh vực dataset. Yêu cầu file đã được profile trước đó.",
)
async def analyze_ai_context(
    body: AIContextRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_ai_quota(current_user["user_id"], db)

    # 1. Lấy profile từ cache
    profile_data = cache.get_profile(current_user["user_id"], body.file_hash)
    if not profile_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dữ liệu profile. Vui lòng upload lại file.",
        )

    columns_raw = profile_data.get("columns", [])

    # 2. Gọi Gemini
    semantic_raw = await llm_service.get_semantic_context(columns_raw)
    
    if semantic_raw.get("domain") == "Unknown" and semantic_raw.get("confidence") == 0.0:
        record_ai_usage(db, current_user["user_id"], "ai-context", "fallback_used")
    else:
        record_ai_usage(db, current_user["user_id"], "ai-context", "success")

    column_semantics = semantic_raw.pop("column_semantics", {})

    # 3. Cập nhật profile trong cache với kết quả AI
    profile_data["semantic_context"] = {
        "domain": semantic_raw["domain"],
        "confidence": semantic_raw["confidence"],
        "reasoning": semantic_raw["reasoning"],
    }
    for col in profile_data.get("columns", []):
        sem_info = column_semantics.get(col["name"], {})
        col["semantic_type"] = sem_info.get("semantic_type", "GENERAL_TEXT")
        col["semantic_confidence"] = float(sem_info.get("confidence", 0.0))

    cache.set_profile(current_user["user_id"], body.file_hash, profile_data)

    # 4. Re-build và cache lại Markdown Dataset Context (Part 1) vì có domain mới
    from app.services.context_builder import build_dataset_context
    dataset_md = build_dataset_context(profile_data)
    cache.set_dataset_context_md(current_user["user_id"], body.file_hash, dataset_md)

    logger.info(
        "AI Context: file_hash=%s domain=%s confidence=%.2f user=%s",
        body.file_hash, semantic_raw["domain"], semantic_raw["confidence"],
        current_user["user_id"],
    )

    return {
        "semantic_context": profile_data["semantic_context"],
        "column_semantics": column_semantics,
    }


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
    cache.set_user_context(current_user["user_id"], body.session_id, body.description, body.purpose)
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: tái tải DataFrame từ Redis cache
# ─────────────────────────────────────────────────────────────────────────────

def _load_df_from_cache(user_id: int, file_hash: str) -> tuple[pd.DataFrame, str, str]:
    """
    Lấy file bytes từ Redis cache (chỉ trong phạm vi user_id sở hữu) và parse thành DataFrame.
    Raise 404 nếu không tìm thấy (hết TTL, Redis chưa có, hoặc file_hash thuộc user khác).
    Trả về (df, filename, ext).
    """
    cached = cache.get_file_bytes(user_id, file_hash)
    if cached is None:
        raise DataMindException(
            code="ERR_SYS_CACHE_EXPIRED",
            severity=ErrorSeverity.CRITICAL,
            user_message="Phiên làm việc đã hết hạn hoặc file không tìm thấy. Vui lòng upload lại.",
            technical_detail={
                "module": "files",
                "location": "_load_df_from_cache",
                "root_cause": f"cache.get_file_bytes(user={user_id}, '{file_hash}') trả về None — TTL hết, Redis miss, hoặc không thuộc sở hữu user này"
            },
            suggested_action=None
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
    df, filename, _ = _load_df_from_cache(current_user["user_id"], body.file_hash)
    
    # Load profile to get semantic mapping
    profile_data = cache.get_profile(current_user["user_id"], body.file_hash)
    column_semantics = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")

    report_raw = cleaner_service.detect_issues(
        df=df,
        filename=filename,
        file_hash=body.file_hash,
        overridden_types=body.overridden_types,
        column_semantics=column_semantics,
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
    current_user: dict = Depends(get_current_user_with_tier),
):
    if current_user.get("tier") == "free":
        if not cache.check_active_session(current_user["user_id"], body.file_hash):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đang xử lý file khác, vui lòng đợi hoàn tất hoặc nâng cấp Pro để xử lý nhiều file cùng lúc."
            )
    cache.set_active_session(current_user["user_id"], body.file_hash)

    df, filename, _ = _load_df_from_cache(current_user["user_id"], body.file_hash)

    cleaned_df, diff_raw, cleaning_log = cleaner_service.auto_clean(
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
    cache.set_file_bytes(current_user["user_id"], clean_hash, buf.read(), filename, ".csv")

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

    preview_df = preview_df.reset_index(names="original_index")

    # Tính toán lại error_cells cho tập dữ liệu sau auto-clean
    profile_data = cache.get_profile(current_user["user_id"], body.file_hash)
    column_semantics = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
    
    # Chỉ tính lỗi trên preview_df để hiển thị cho nhẹ, hoặc tính trên cleaned_df nếu muốn đầy đủ
    # Chú ý: Auto-clean không chủ động sửa semantic error nên ta báo cáo lỗi trên preview_df
    error_cells = cleaner_service._get_error_cells(preview_df, body.overridden_types, column_semantics)

    return AutoCleanResponse(
        file_hash=body.file_hash,
        diff_report=DiffReport(**diff_raw),
        validation=validation_res,
        preview_data=preview_df.to_dict(orient="records"),
        error_cells=error_cells,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/manual-clean-preview
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/manual-clean-preview",
    summary="Xem trước kết quả làm sạch thủ công",
    description="Áp dụng chuỗi hành động làm sạch thủ công và trả về dữ liệu mẫu mà chưa lưu vào cache."
)
async def manual_clean_preview(
    body: ManualCleanPreviewRequest,
    current_user: dict = Depends(get_current_user_with_tier),
):
    if current_user.get("tier") == "free":
        if not cache.check_active_session(current_user["user_id"], body.file_hash):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đang xử lý file khác, vui lòng đợi hoàn tất hoặc nâng cấp Pro để xử lý nhiều file cùng lúc."
            )
    cache.set_active_session(current_user["user_id"], body.file_hash)

    try:
        df, filename, _ = _load_df_from_cache(current_user["user_id"], body.file_hash)
    except DataMindException as dme:
        # file cache expired
        raise HTTPException(status_code=410, detail=dme.user_message)
    except Exception as e:
        logger.error(f"Load cache error in manual-clean-preview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Không thể tải dữ liệu từ bộ nhớ đệm.")

    try:
        # Áp dụng các hành động thủ công
        cleaned_df, _ = cleaner_service.apply_manual_actions(df, body.actions)
        
        # Lấy 100 dòng đầu tiên giữ nguyên thứ tự gốc (tương tự như detect_issues)
        # để tránh việc row nhảy vị trí liên tục khi user edit (Smart Preview cũ dùng nan_mask gây lộn xộn index)
        preview_df = cleaned_df.head(100).copy()
        
        profile_data = cache.get_profile(current_user["user_id"], body.file_hash)
        column_semantics = {}
        if profile_data:
            for col in profile_data.get("columns", []):
                column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
        
        # Phân tích lỗi trên preview_df (giữ nguyên original index)
        error_cells = cleaner_service._get_error_cells(preview_df, {}, column_semantics)
        
        preview_df = preview_df.replace({float('nan'): None, pd.NaT: None})
        for col in preview_df.columns:
            if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                
        # Lưu index gốc thành original_index
        preview_df = preview_df.reset_index(names="original_index")
                
        return {
            "preview_data": preview_df.to_dict(orient="records"),
            "error_cells": error_cells
        }
        
    except ValueError as ve:
        logger.warning(f"Manual Clean Validation Error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Manual Clean Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Đã xảy ra lỗi hệ thống khi áp dụng thao tác làm sạch thủ công.")

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
    current_user: dict = Depends(get_current_user_with_tier),
):
    if current_user.get("tier") == "free":
        if not cache.check_active_session(current_user["user_id"], body.file_hash):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đang xử lý file khác, vui lòng đợi hoàn tất hoặc nâng cấp Pro để xử lý nhiều file cùng lúc."
            )
    cache.set_active_session(current_user["user_id"], body.file_hash)

    df, filename, _ = _load_df_from_cache(current_user["user_id"], body.file_hash)

    if body.clean_mode == "manual":
        try:
            logger.info(f"CONFIRM_CLEAN MANUAL ACTIONS: {body.actions}")
            cleaned_df, cleaning_log = cleaner_service.apply_manual_actions(df, body.actions)
        except ValueError as ve:
            logger.warning(f"Manual Clean Validation Error in confirm_clean: {ve}")
            raise HTTPException(status_code=400, detail=str(ve))
        
        # Giả lập diff_raw đơn giản cho manual mode để tránh lỗi serialize
        diff_raw = {
            "original_rows": len(df),
            "clean_rows": len(cleaned_df),
            "original_cols": len(df.columns),
            "clean_cols": len(cleaned_df.columns),
            "duplicate_rows_removed": len(df) - len(cleaned_df),
            "columns_dropped": [],
            "missing_filled": {},
            "types_converted": {},
            "encoding_fixed": {}
        }
    else:
        # Chạy auto_clean lần cuối (mặc định)
        cleaned_df, diff_raw, cleaning_log = cleaner_service.auto_clean(
            df=df,
            overridden_types=body.overridden_types,
        )

    # Validate cuối
    validation_dict = cleaner_service.validate_clean_dataset(cleaned_df)
    validation_res = ValidationResult(**validation_dict)
    
    if not validation_res.can_proceed:
        # Lấy thông báo lỗi đầu tiên để show, thực tế có list lỗi trong hard_blocks
        reason = validation_res.hard_blocks[0].message if validation_res.hard_blocks else "Dữ liệu không hợp lệ."
        raise DataMindException(
            code="ERR_CLN_VALIDATION_FAILED",
            severity=ErrorSeverity.BLOCKING,
            user_message=reason,
            technical_detail={
                "module": "files",
                "location": "confirm_clean",
                "root_cause": f"validation_res.can_proceed=False, hard_blocks={[b.message for b in validation_res.hard_blocks]}"
            },
            suggested_action=None
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
    
    # Store file_hash in metadata so visualize service can lookup provenance
    summary["file_hash"] = body.file_hash

    # Lưu metadata session vào Redis để Module Visualization sử dụng
    cache.set_session_metadata(current_user["user_id"], session_id, summary)

    # Cache file bytes theo session_id để Module 3 có thể lấy ra
    cache.set_file_bytes(current_user["user_id"], session_id, csv_bytes, filename, ".csv")

    cache.set_cleaning_log(current_user["user_id"], body.file_hash, cleaning_log)
    cache.set_report_section(current_user["user_id"], body.file_hash, "cleaner", {
        "actions_taken": cleaning_log,
        "clean_mode": body.clean_mode,
        "stats": diff_raw
    })
    cache.invalidate_downstream_state(current_user["user_id"], body.file_hash)

    logger.info(
        "ConfirmClean: session=%s file=%s mode=%s rows=%d user=%s",
        session_id, filename, body.clean_mode,
        diff_raw["clean_rows"], current_user["user_id"],
    )
    
    # Generate preview data from cleaned_df
    preview_df = cleaned_df.head(100).copy()
    preview_df = preview_df.replace({float('nan'): None, pd.NaT: None})
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
    if "original_index" not in preview_df.columns:
        preview_df = preview_df.reset_index(names="original_index")
    preview_data = preview_df.to_dict(orient="records")

    return CleanDatasetResponse(
        session_id=session_id,
        filename=filename,
        clean_file_url=clean_file_url,
        clean_report=DiffReport(**diff_raw),
        summary_for_module3=SummaryForModule3(**summary),
        clean_mode=body.clean_mode,
        confirmed_at=confirmed_at,
        validation=validation_res,
        preview_data=preview_data
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

@router.delete(
    "/session/active",
    summary="Hủy session hiện tại",
    description="Cho phép user hủy tiến trình để xử lý file khác."
)
async def clear_active_session_endpoint(
    current_user: dict = Depends(get_current_user_with_tier),
):
    cache.clear_active_session(current_user["user_id"])
    return {"message": "Session đã được hủy thành công."}