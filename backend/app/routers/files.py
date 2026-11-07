"""
files.py (router)
-----------------
Endpoint: POST /api/v1/files/profile
Upload CSV hoặc XLSX → phân tích bằng Pandas → ngữ cảnh từ Gemini → cache Redis → ProfileResponse
File KHÔNG ghi vào disk. Đọc từ memory buffer (io.BytesIO).
"""

import io
import re
import os
import time
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from app.models import User

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.core.dependencies import get_current_user, get_current_user_with_tier
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import (
    check_ai_quota,
    record_ai_usage,
    record_ai_feature_usage,
    get_user_ai_usage_summary,
)
from app.core import cache
from app.core.rules import CLEANER_PREVIEW_ROWS
from app.core.errors import DataMindException, ErrorSeverity
from app.core.ai_client import get_dev_provider
from app.schemas.files import ProfileResponse, SemanticContext, ColumnProfile
from app.schemas.cleaner import (
    IssueDetectRequest, IssueReport,
    AutoCleanRequest, AutoCleanResponse, DiffReport,
    ConfirmCleanRequest, CleanDatasetResponse, SummaryForModule3,
    ValidationResult, ManualCleanPreviewRequest, ManualCleanPreviewResponse,
    WindowInfo, LocateRowRequest, LocateRowResponse,
    ErrorCellsRequest, ErrorCellsResponse,
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


def col_index_to_letter(idx: int) -> str:
    """Chuyển đổi 0-indexed column position sang ký hiệu chữ cái Excel (0 -> A, 25 -> Z, 26 -> AA)."""
    result = []
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        result.append(chr(65 + rem))
    return "".join(reversed(result))


def _read_dataframe(file_bytes: io.BytesIO, ext: str) -> pd.DataFrame:
    """Parse file bytes thành DataFrame theo extension."""
    try:
        if ext == ".csv":
            df = pd.read_csv(file_bytes, skip_blank_lines=False)
        else:
            df = pd.read_excel(file_bytes)

        # Ghi nhận vị trí cột gốc trong RAW file trước khi drop / rename bất kỳ cột nào
        raw_col_letters = {str(col): col_index_to_letter(i) for i, col in enumerate(df.columns)}

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
                # Cột trống hoàn toàn + tên tự động → xóa (vẫn lưu lại chữ cái gốc trong raw_col_letters)
                cols_to_drop.append(col)
            elif is_unnamed and not df[col].isna().all():
                # Cột có data nhưng không có header → đổi tên placeholder
                new_placeholder = f"Cột không tên ({col_index_to_letter(unnamed_counter)})"
                rename_map[col] = new_placeholder
                raw_col_letters[new_placeholder] = raw_col_letters[col_str]
                unnamed_counter += 1

        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
        if rename_map:
            df = df.rename(columns=rename_map)

        # Xóa dòng 100% trống nhưng giữ nguyên index của các dòng còn lại
        df = df.dropna(how='all')
        df.attrs["column_letters"] = raw_col_letters

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


def _process_profile(
    content: bytes,
    filename: str,
    ext: str,
    force_refresh: bool,
    user_id: int,
    db: Session,
) -> ProfileResponse:
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
    CACHE_VERSION = "v5"
    file_hash = f"{CACHE_VERSION}:{hashlib.md5(content).hexdigest()}"

    # 4. Kiểm tra Redis cache
    if force_refresh:
        # User bấm "Phân tích lại" → xóa cache cũ trước, rồi chạy lại từ đầu
        cache.delete_profile(user_id, file_hash)
        logger.info("Force refresh: deleted cache for file_hash=%s user=%s", file_hash, user_id)
    else:
        cached_data = cache.get_profile(user_id, file_hash)
        if cached_data:
            logger.info("Cache HIT: file_hash=%s user=%s", file_hash, user_id)
            # FIX: Mặc dù profile cache hit (TTL 24h), file bytes có thể đã hết hạn (TTL 5h).
            # Ta cần đảm bảo file bytes được lưu lại vào cache.
            cache.set_file_bytes(user_id, file_hash, content, filename, ext)
            
            # Tính file_expires_at thực tế từ Redis TTL
            ttl_sec = cache.get_file_bytes_ttl(user_id, file_hash) or cache._FILE_BYTES_TTL
            expires_at_iso = datetime.fromtimestamp(
                datetime.now(timezone.utc).timestamp() + ttl_sec, tz=timezone.utc
            ).isoformat()
            
            cached_data["cached"] = True
            cached_data["file_expires_at"] = expires_at_iso
            cached_data["is_first_upload"] = _mark_first_upload(db, user_id)
            return ProfileResponse(**cached_data)
    # 5. Parse DataFrame từ memory buffer
    file_bytes = io.BytesIO(content)
    df = _read_dataframe(file_bytes, ext)

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File không có dữ liệu.",
        )

    # 6. Profile bằng Pandas (dynamic, không hardcode tên cột)
    col_letters = dict(df.attrs.get("column_letters", {}))
    columns_raw = profiler_service.profile_dataframe(df)
    columns = [ColumnProfile(**col, letter=col_letters.get(col.get("name"))) for col in columns_raw]

    # 7.
    existing_ctx = cache.get_profiler_context(user_id, file_hash)
    if existing_ctx and existing_ctx.get('semantic_context'):
        sem_raw = existing_ctx['semantic_context']
        semantic = SemanticContext(
            domain=sem_raw.get('domain', 'Chưa phân tích'),
            confidence=float(sem_raw.get('confidence', 0.0)),
            reasoning=sem_raw.get('reasoning', ''),
        )
        col_sem_map = existing_ctx.get('column_semantics', {})
        for col in columns:
            if col.name in col_sem_map:
                col_info = col_sem_map[col.name]
                if isinstance(col_info, dict):
                    col.semantic_type = col_info.get('semantic_type', 'GENERAL_TEXT')
                    col.semantic_confidence = float(col_info.get('confidence', 0.0))
                else:
                    col.semantic_type = str(col_info)
                    col.semantic_confidence = 0.8
            else:
                col.semantic_type = 'GENERAL_TEXT'
                col.semantic_confidence = 0.0
    else:
        semantic = SemanticContext(
            domain='Chưa phân tích',
            confidence=0.0,
            reasoning="",
            )
        for col in columns:
            col.semantic_type = 'GENERAL_TEXT'
            col.semantic_confidence = 0.0

    result = ProfileResponse(
        file_hash=file_hash,
        filename=filename,
        total_rows=len(df),
        total_columns=len(df.columns),
        columns=columns,
        semantic_context=semantic,
        cached=False,
        is_first_upload=_mark_first_upload(db, user_id),
        column_letters=col_letters,
    )

    # 9. Lưu vào Redis cache (bỏ qua nếu Redis lỗi)
    cache_data = result.model_dump()
    cache_data.pop("cached", None)  # Không lưu field cached vào Redis
    cache_data.pop("is_first_upload", None) 
    cache.set_profile(user_id, file_hash, cache_data)

    # 10. Lưu file bytes vào Redis để Cleaner endpoints tái dùng (TTL 5h)
    cache.set_file_bytes(user_id, file_hash, content, filename, ext)

    ttl_sec = cache.get_file_bytes_ttl(user_id, file_hash) or cache._FILE_BYTES_TTL
    expires_at_iso = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() + ttl_sec, tz=timezone.utc
    ).isoformat()
    result.file_expires_at = expires_at_iso

    # Save profiler report section
    cache.set_report_section(user_id, file_hash, "profiler", {
        "file_name": filename,
        "row_count": len(df),
        "col_count": len(df.columns),
        "schema": [c.model_dump() for c in columns]
    })

    # 11. Build và cache Markdown Dataset Context (Part 1) cho AI Explain
    from app.services.context_builder import build_dataset_context
    dataset_md = build_dataset_context(cache_data)
    cache.set_dataset_context_md(user_id, file_hash, dataset_md)

    logger.info(
        "Profiled: file=%s rows=%d cols=%d domain=%s user=%s",
        filename, len(df), len(df.columns),
        semantic.domain, user_id,
    )

    return result


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

    # 2. Đọc bytes vào RAM — KHÔNG ghi disk (async I/O)
    content = await file.read()

    # 3. Chạy toàn bộ CPU profiling, parse DataFrame & Redis cache trong threadpool
    return await run_in_threadpool(
        _process_profile,
        content=content,
        filename=file.filename,
        ext=ext,
        force_refresh=force_refresh,
        user_id=current_user["user_id"],
        db=db,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/ai-context
# Gọi Gemini theo yêu cầu để phân tích hoặc phân tích lại ngữ cảnh dataset
# ─────────────────────────────────────────────────────────────────────────────

class AIContextRequest(BaseModel):
    file_hash: str
    lang: str = "vi"
    description: str | None = None
    is_reanalyze: bool = False

@router.post(
    "/ai-context",
    summary="Phân tích ngữ cảnh AI theo yêu cầu",
    description="Gọi Gemini để nhận diện lĩnh vực dataset và phân loại cột. Hỗ trợ tái phân tích với chỉnh sửa.",
)
async def analyze_ai_context(
    request: Request,
    body: AIContextRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Kiểm tra quota dùng chung
    check_ai_quota(current_user["user_id"], db)

    # 2. Lấy profile từ cache
    profile_data = cache.get_profile(current_user["user_id"], body.file_hash)
    if not profile_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy dữ liệu profile. Vui lòng upload lại file.",
        )

    columns_raw = profile_data.get("columns", [])

    # 3. Gọi Gemini với lang và user_correction (nếu là re-analyze)
    user_correction = body.description if body.is_reanalyze else None
    semantic_raw = await llm_service.get_semantic_context(
        columns_raw,
        lang=body.lang,
        user_correction=user_correction
    )

    feature_name = "reanalyze" if body.is_reanalyze else "profiler"
    if await request.is_disconnected():
        logger.info(f"ai.cancelled feature={feature_name}")
        return JSONResponse(status_code=499, content={"detail": "Client closed request", "cancelled": True})

    column_semantics = semantic_raw.pop("column_semantics", {})

    # 4. Cập nhật profile trong cache với kết quả AI
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

    # 5. Ghi nhận quota tiêu thụ
    feature_name = "reanalyze" if body.is_reanalyze else "profiler"
    usage_summary = record_ai_feature_usage(db, current_user["user_id"], feature_name)

    # 6. Re-build và cache lại Markdown Dataset Context (Part 1)
    from app.services.context_builder import build_dataset_context
    dataset_md = build_dataset_context(profile_data)
    cache.set_dataset_context_md(current_user["user_id"], body.file_hash, dataset_md)

    # 7. Lưu profiler_context vào Redis với cùng 24h TTL
    now_saved_at = datetime.utcnow().strftime("%H:%M")
    draft_summary = semantic_raw.get("draft_summary", "")
    profiler_ctx_payload = {
        "description": draft_summary,
        "description_source": "ai_draft",
        "semantic_context": profile_data["semantic_context"],
        "column_semantics": column_semantics,
        "saved_at": now_saved_at,
        "lang": body.lang or "vi",
    }
    cache.set_profiler_context(current_user["user_id"], body.file_hash, profiler_ctx_payload)
    cache.set_user_context(current_user["user_id"], body.file_hash, draft_summary, "")

    logger.info(
        "AI Context (%s): file_hash=%s domain=%s confidence=%.2f user=%s",
        feature_name, body.file_hash, semantic_raw["domain"], semantic_raw["confidence"],
        current_user["user_id"],
    )

    res = {
        "semantic_context": profile_data["semantic_context"],
        "column_semantics": column_semantics,
        "draft_summary": draft_summary,
        "description": draft_summary,
        "description_source": "ai_draft",
        "saved_at": now_saved_at,
        "usage": usage_summary,
    }
    dev_prov = get_dev_provider()
    if dev_prov:
        res["provider"] = dev_prov

    return res


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints: Profiler State Persistence (Không gọi Gemini)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/session-status", summary="Kiểm tra trạng thái khả dụng của file và cache (rẻ, không gọi AI)")
def get_session_status(
    file_hash: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Kiểm tra xem file bytes, profile data và context còn tồn tại trong Redis hay không.
    Trả về thời gian hết hạn file_expires_at thực tế nếu file còn hiệu lực.
    """
    user_id = current_user["user_id"]
    ttl_sec = cache.get_file_bytes_ttl(user_id, file_hash)
    file_available = ttl_sec is not None and ttl_sec > 0
    
    file_expires_at = None
    if file_available and ttl_sec:
        file_expires_at = datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + ttl_sec, tz=timezone.utc
        ).isoformat()

    profile_data = cache.get_profile(user_id, file_hash)
    profile_available = profile_data is not None

    ctx = cache.get_profiler_context(user_id, file_hash)
    context_available = ctx is not None

    return {
        "file_available": file_available,
        "file_expires_at": file_expires_at,
        "profile_available": profile_available,
        "context_available": context_available,
    }


@router.get("/profiler-state", summary="Lấy trạng thái Profiler đã lưu (không gọi AI)")
def get_profiler_state(
    file_hash: str,
    current_user: dict = Depends(get_current_user),
):
    ctx = cache.get_profiler_context(current_user["user_id"], file_hash)
    if ctx:
        return ctx

    # Fallback kiểm tra profile cache
    profile_data = cache.get_profile(current_user["user_id"], file_hash)
    if profile_data and profile_data.get("semantic_context"):
        sem = profile_data.get("semantic_context")
        if sem.get("domain") and sem.get("domain") != "Chưa phân tích":
            col_sem = {
                c.get("name"): c.get("semantic_type", "GENERAL_TEXT")
                for c in profile_data.get("columns", [])
            }
            return {
                "description": "",
                "description_source": "user",
                "semantic_context": sem,
                "column_semantics": col_sem,
                "saved_at": None,
            }

    return {
        "description": "",
        "description_source": "user",
        "semantic_context": None,
        "column_semantics": {},
        "saved_at": None,
    }


class SaveProfilerStateRequest(BaseModel):
    file_hash: str
    description: str
    description_source: str = "user"  # "user" | "ai_draft" | "ai_edited"


@router.post("/profiler-state", summary="Lưu nội dung chỉnh sửa Profiler mà không tốn quota")
def save_profiler_state(
    body: SaveProfilerStateRequest,
    current_user: dict = Depends(get_current_user),
):
    existing = cache.get_profiler_context(current_user["user_id"], body.file_hash) or {}
    saved_at = datetime.utcnow().strftime("%H:%M")
    data = {
        "description": body.description,
        "description_source": body.description_source,
        "semantic_context": existing.get("semantic_context"),
        "column_semantics": existing.get("column_semantics", {}),
        "saved_at": saved_at,
        "lang": existing.get("lang"),
    }
    cache.set_profiler_context(current_user["user_id"], body.file_hash, data)
    cache.set_user_context(current_user["user_id"], body.file_hash, body.description, "")
    return {"status": "ok", "saved_at": saved_at}


@router.get("/ai-usage", summary="Lấy thống kê định mức AI dùng chung")
def get_ai_usage_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_ai_usage_summary(db, current_user["user_id"])


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/session/context (Legacy compatibility)
# ─────────────────────────────────────────────────────────────────────────────

class SessionContextRequest(BaseModel):
    session_id: str
    description: str = ""
    purpose: str = ""

@router.post(
    "/session/context",
    summary="Lưu ngữ cảnh dataset",
)
def save_session_context(
    body: SessionContextRequest,
    current_user: dict = Depends(get_current_user),
):
    cache.set_user_context(current_user["user_id"], body.session_id, body.description, body.purpose)
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Helper: tái tải DataFrame từ Redis cache
# ─────────────────────────────────────────────────────────────────────────────

def _load_cached_file(user_id: int, file_hash: str) -> dict:
    cached = cache.get_file_bytes(user_id, file_hash)
    if cached is None:
        raise DataMindException(
            code="ERR_SYS_CACHE_EXPIRED",
            severity=ErrorSeverity.CRITICAL,
            user_message="Phiên làm việc đã hết hạn hoặc file không tìm thấy. Vui lòng upload lại.",
            technical_detail={
                "module": "files",
                "location": "_load_cached_file",
                "root_cause": f"cache.get_file_bytes(user={user_id}, '{file_hash}') trả về None — TTL hết, Redis miss, hoặc không thuộc sở hữu user này"
            },
            suggested_action=None
        )
    return cached


def _load_df_from_cache(user_id: int, file_hash: str) -> tuple[pd.DataFrame, str, str]:
    """
    Lấy file bytes từ Redis cache (chỉ trong phạm vi user_id sở hữu) và parse thành DataFrame.
    Raise 404 nếu không tìm thấy (hết TTL, Redis chưa có, hoặc file_hash thuộc user khác).
    Trả về (df, filename, ext).
    """
    cached = _load_cached_file(user_id, file_hash)
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
def detect_issues(
    body: IssueDetectRequest,
    current_user: dict = Depends(get_current_user),
):
    t_start = time.perf_counter()
    user_id = current_user["user_id"]

    # 1. Load bytes
    t0 = time.perf_counter()
    cached = _load_cached_file(user_id, body.file_hash)
    ms_load = int((time.perf_counter() - t0) * 1000)

    # 2. Parse DataFrame
    t1 = time.perf_counter()
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])
    filename = cached["filename"]
    ms_parse = int((time.perf_counter() - t1) * 1000)

    # 3. Resolve types once
    t2 = time.perf_counter()
    profile_data = cache.get_profile(user_id, body.file_hash)
    column_semantics = {}
    profile_types = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
            profile_types[col.get("name")] = col.get("detected_type", "text")

    resolved_types = {
        str(c): cleaner_service.resolve_column_type(
            str(c), df[c], body.overridden_types, profile_types
        )
        for c in df.columns
    }
    ms_types = int((time.perf_counter() - t2) * 1000)

    # 4. Detect issues
    t3 = time.perf_counter()
    report_raw = cleaner_service.detect_issues(
        df=df,
        filename=filename,
        file_hash=body.file_hash,
        overridden_types=body.overridden_types,
        user_id=user_id,
        profile_types=profile_types,
        column_semantics=column_semantics,
        resolved_types=resolved_types,
        offset=getattr(body, "offset", 0),
        mode=getattr(body, "mode", "all"),
        profiler_context=cache.get_profiler_context(user_id, body.file_hash),
    )
    ms_detect = int((time.perf_counter() - t3) * 1000)

    # 5. Serialize
    t4 = time.perf_counter()
    res = IssueReport(**report_raw)
    ms_ser = int((time.perf_counter() - t4) * 1000)
    ms_total = int((time.perf_counter() - t_start) * 1000)

    logger.info(
        "cleaner.detect_issues load=%d parse=%d types=%d detect=%d serialize=%d total=%d",
        ms_load, ms_parse, ms_types, ms_detect, ms_ser, ms_total
    )

    return res


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
def auto_clean(
    body: AutoCleanRequest,
    current_user: dict = Depends(get_current_user_with_tier),
):
    t_start = time.perf_counter()
    user_id = current_user["user_id"]

    # 1. Load bytes
    t0 = time.perf_counter()
    cached = _load_cached_file(user_id, body.file_hash)
    ms_load = int((time.perf_counter() - t0) * 1000)

    # 2. Parse DataFrame
    t1 = time.perf_counter()
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])
    filename = cached["filename"]
    ms_parse = int((time.perf_counter() - t1) * 1000)

    # 3. Resolve types once
    t2 = time.perf_counter()
    profile_data = cache.get_profile(user_id, body.file_hash)
    column_semantics = {}
    profile_types = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
            profile_types[col.get("name")] = col.get("detected_type", "text")

    resolved_types = {
        str(c): cleaner_service.resolve_column_type(
            str(c), df[c], body.overridden_types, profile_types
        )
        for c in df.columns
    }
    ms_types = int((time.perf_counter() - t2) * 1000)

    # 4. Auto clean
    t3 = time.perf_counter()
    cleaned_df, diff_raw, cleaning_log = cleaner_service.auto_clean(
        df=df,
        overridden_types=body.overridden_types,
        user_id=user_id,
        file_hash=body.file_hash,
        profile_types=profile_types,
        resolved_types=resolved_types,
    )
    ms_clean = int((time.perf_counter() - t3) * 1000)
    invalid_replaced_keys = diff_raw.pop("invalid_replaced_keys", set())

    # Kiểm tra ràng buộc sau khi clean
    validation_dict = cleaner_service.validate_clean_dataset(cleaned_df)
    validation_res = ValidationResult(**validation_dict)

    # Cache kết quả DataFrame đã clean (5h) để confirm step dùng
    buf = io.BytesIO()
    cleaned_df.to_csv(buf, index=False)
    buf.seek(0)
    clean_hash = f"{body.file_hash}_clean"
    cache.set_file_bytes(user_id, clean_hash, buf.read(), filename, ".csv")

    total_rows = len(cleaned_df)
    offset = max(0, getattr(body, "offset", 0))
    mode = getattr(body, "mode", "all")

    error_positions = cleaner_service.get_error_row_indices(
        cleaned_df,
        overridden_types=body.overridden_types,
        column_semantics=column_semantics,
        profile_types=profile_types,
        resolved_types=resolved_types,
    )
    total_error_rows = len(error_positions)

    if mode == "errors":
        slice_positions = error_positions[offset : offset + CLEANER_PREVIEW_ROWS]
    else:
        slice_positions = list(range(offset, min(offset + CLEANER_PREVIEW_ROWS, total_rows)))

    preview_df = cleaned_df.iloc[slice_positions].copy()
    preview_labels = list(preview_df.index)

    first_excel_row = (int(preview_labels[0]) + 2) if preview_labels else None
    last_excel_row = (int(preview_labels[-1]) + 2) if preview_labels else None

    window_info = WindowInfo(
        offset=offset,
        size=CLEANER_PREVIEW_ROWS,
        mode=mode,
        total_rows=total_rows,
        total_error_rows=total_error_rows,
        first_excel_row=first_excel_row,
        last_excel_row=last_excel_row,
    )

    preview_df = preview_df.where(pd.notna(preview_df), None)
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

    preview_df = preview_df.reset_index(names="original_index")

    # 5. Error cells on preview_df
    t4 = time.perf_counter()
    error_cells = cleaner_service._get_error_cells(
        preview_df,
        body.overridden_types,
        column_semantics,
        user_id=user_id,
        file_hash=body.file_hash,
        profile_types=profile_types,
        resolved_types=resolved_types,
    )
    ms_err = int((time.perf_counter() - t4) * 1000)

    # 6. Changed cells & removed rows
    t5 = time.perf_counter()
    changed_cells, changed_truncated = cleaner_service.compute_changed_cells(
        original_df=df,
        cleaned_df=cleaned_df,
        preview_labels=preview_labels,
        edited_keys=set(),
        invalid_replaced_keys=invalid_replaced_keys,
        cap=2000,
    )
    removed_rows = cleaner_service.compute_removed_rows(
        original_df=df,
        cleaned_df=cleaned_df,
        window_size=CLEANER_PREVIEW_ROWS,
        offset=offset,
    )
    ms_chg = int((time.perf_counter() - t5) * 1000)

    # 7. Serialize
    t6 = time.perf_counter()
    res = AutoCleanResponse(
        preview_rows=CLEANER_PREVIEW_ROWS,
        file_hash=body.file_hash,
        diff_report=DiffReport(**diff_raw),
        validation=validation_res,
        preview_data=[{k: cleaner_service._to_json_safe(v) for k, v in r.items()} for r in preview_df.to_dict(orient="records")],
        error_cells=error_cells,
        changed_cells=changed_cells,
        removed_rows=removed_rows,
        changed_truncated=changed_truncated,
        column_letters=dict(cleaned_df.attrs.get("column_letters", df.attrs.get("column_letters", {}))),
        window=window_info,
    )
    ms_ser = int((time.perf_counter() - t6) * 1000)
    ms_total = int((time.perf_counter() - t_start) * 1000)

    logger.info(
        "cleaner.auto_clean load=%d parse=%d types=%d clean=%d errors=%d changed=%d serialize=%d total=%d",
        ms_load, ms_parse, ms_types, ms_clean, ms_err, ms_chg, ms_ser, ms_total
    )

    return res


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint: POST /files/manual-clean-preview
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/manual-clean-preview",
    response_model=ManualCleanPreviewResponse,
    summary="Xem trước kết quả làm sạch thủ công",
    description="Áp dụng chuỗi hành động làm sạch thủ công và trả về dữ liệu mẫu mà chưa lưu vào cache."
)
def manual_clean_preview(
    body: ManualCleanPreviewRequest,
    current_user: dict = Depends(get_current_user_with_tier),
):
    t_start = time.perf_counter()
    user_id = current_user["user_id"]

    try:
        t0 = time.perf_counter()
        cached = _load_cached_file(user_id, body.file_hash)
        ms_load = int((time.perf_counter() - t0) * 1000)

        t1 = time.perf_counter()
        file_bytes = io.BytesIO(cached["bytes"])
        df = _read_dataframe(file_bytes, cached["ext"])
        filename = cached["filename"]
        ms_parse = int((time.perf_counter() - t1) * 1000)
    except DataMindException as dme:
        raise HTTPException(status_code=410, detail=dme.user_message)
    except Exception as e:
        logger.error(f"Load cache error in manual-clean-preview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Không thể tải dữ liệu từ bộ nhớ đệm.")

    try:
        t2 = time.perf_counter()
        profile_data = cache.get_profile(user_id, body.file_hash)
        column_semantics = {}
        profile_types = {}
        if profile_data:
            for col in profile_data.get("columns", []):
                column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
                profile_types[col.get("name")] = col.get("detected_type", "text")

        resolved_types = {
            str(c): cleaner_service.resolve_column_type(
                str(c), df[c], None, profile_types
            )
            for c in df.columns
        }
        ms_types = int((time.perf_counter() - t2) * 1000)

        offset = max(0, getattr(body, "offset", 0))
        mode = getattr(body, "mode", "all")

        t3 = time.perf_counter()
        cleaned_df, _ = cleaner_service.apply_manual_actions(
            df=df,
            actions=body.actions,
            overridden_types=None,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )
        ms_act = int((time.perf_counter() - t3) * 1000)

        total_rows = len(cleaned_df)
        error_positions = cleaner_service.get_error_row_indices(
            cleaned_df,
            overridden_types=None,
            column_semantics=column_semantics,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )
        total_error_rows = len(error_positions)

        if mode == "errors":
            slice_positions = error_positions[offset : offset + CLEANER_PREVIEW_ROWS]
        else:
            slice_positions = list(range(offset, min(offset + CLEANER_PREVIEW_ROWS, total_rows)))

        cleaned_preview_df = cleaned_df.iloc[slice_positions].copy()
        preview_labels = list(cleaned_preview_df.index)

        first_excel_row = (int(preview_labels[0]) + 2) if preview_labels else None
        last_excel_row = (int(preview_labels[-1]) + 2) if preview_labels else None

        window_info = WindowInfo(
            offset=offset,
            size=CLEANER_PREVIEW_ROWS,
            mode=mode,
            total_rows=total_rows,
            total_error_rows=total_error_rows,
            first_excel_row=first_excel_row,
            last_excel_row=last_excel_row,
        )

        t4 = time.perf_counter()
        error_cells = cleaner_service._get_error_cells(
            cleaned_preview_df,
            {},
            column_semantics,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )
        ms_err = int((time.perf_counter() - t4) * 1000)

        # Build edited_keys from BATCH_EDIT_CELLS actions
        edited_keys: set = set()
        for act in body.actions:
            act_type = getattr(act, "action_type", None) or (act.get("action_type") if isinstance(act, dict) else None)
            if act_type == "BATCH_EDIT_CELLS":
                params = getattr(act, "params", {}) or (act.get("params", {}) if isinstance(act, dict) else {})
                for edit in params.get("edits", []):
                    r_id = edit.get("row_id")
                    c_name = edit.get("column")
                    if r_id is not None and c_name is not None:
                        edited_keys.add((int(r_id), str(c_name)))

        t5 = time.perf_counter()
        changed_cells, changed_truncated = cleaner_service.compute_changed_cells(
            original_df=df,
            cleaned_df=cleaned_df,
            preview_labels=preview_labels,
            edited_keys=edited_keys,
            cap=2000,
        )
        removed_rows = cleaner_service.compute_removed_rows(
            original_df=df,
            cleaned_df=cleaned_df,
            window_size=CLEANER_PREVIEW_ROWS,
            offset=offset,
        )
        ms_chg = int((time.perf_counter() - t5) * 1000)

        t6 = time.perf_counter()
        disp_preview = cleaned_preview_df.where(pd.notna(cleaned_preview_df), None)
        for col in disp_preview.columns:
            if pd.api.types.is_datetime64_any_dtype(disp_preview[col]):
                disp_preview[col] = disp_preview[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        disp_preview = disp_preview.reset_index(names="original_index")
        preview_records = [
            {k: cleaner_service._to_json_safe(v) for k, v in r.items()}
            for r in disp_preview.to_dict(orient="records")
        ]

        col_issue_counts = cleaner_service.compute_column_issue_counts(
            df=cleaned_df,
            overridden_types={},
            profile_types=profile_types,
            column_semantics=column_semantics,
            resolved_types=resolved_types,
        )

        res = ManualCleanPreviewResponse(
            preview_data=preview_records,
            error_cells=error_cells,
            changed_cells=changed_cells,
            removed_rows=removed_rows,
            changed_truncated=changed_truncated,
            preview_rows=CLEANER_PREVIEW_ROWS,
            column_letters=dict(cleaned_preview_df.attrs.get("column_letters", df.attrs.get("column_letters", {}))),
            column_issue_counts=col_issue_counts,
            window=window_info,
        )
        ms_ser = int((time.perf_counter() - t6) * 1000)
        ms_total = int((time.perf_counter() - t_start) * 1000)

        logger.info(
            "cleaner.manual_preview load=%d parse=%d types=%d actions=%d errors=%d changed=%d serialize=%d total=%d",
            ms_load, ms_parse, ms_types, ms_act, ms_err, ms_chg, ms_ser, ms_total
        )

        return res

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
def confirm_clean(
    body: ConfirmCleanRequest,
    current_user: dict = Depends(get_current_user_with_tier),
):
    t_start = time.perf_counter()
    user_id = current_user["user_id"]

    # 1. Load bytes
    t0 = time.perf_counter()
    cached = _load_cached_file(user_id, body.file_hash)
    ms_load = int((time.perf_counter() - t0) * 1000)

    # 2. Parse DataFrame
    t1 = time.perf_counter()
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])
    filename = cached["filename"]
    ms_parse = int((time.perf_counter() - t1) * 1000)

    # 3. Resolve types once
    t2 = time.perf_counter()
    profile_data = cache.get_profile(user_id, body.file_hash)
    profile_types = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            profile_types[col.get("name")] = col.get("detected_type", "text")

    resolved_types = {
        str(c): cleaner_service.resolve_column_type(
            str(c), df[c], body.overridden_types, profile_types
        )
        for c in df.columns
    }
    ms_types = int((time.perf_counter() - t2) * 1000)

    # 4. Clean & Diff
    t3 = time.perf_counter()
    ms_diff = 0
    if body.clean_mode == "manual":
        try:
            logger.info(f"CONFIRM_CLEAN MANUAL ACTIONS: {body.actions}")
            cleaned_df, cleaning_log = cleaner_service.apply_manual_actions(
                df=df,
                actions=body.actions,
                overridden_types=body.overridden_types,
                user_id=user_id,
                file_hash=body.file_hash,
                profile_types=profile_types,
                resolved_types=resolved_types,
            )
        except ValueError as ve:
            logger.warning(f"Manual Clean Validation Error in confirm_clean: {ve}")
            raise HTTPException(status_code=400, detail=str(ve))
        
        t4 = time.perf_counter()
        diff_raw = cleaner_service.compute_diff_report(
            original_df=df,
            cleaned_df=cleaned_df,
            actions_or_log=body.actions,
        )
        ms_diff = int((time.perf_counter() - t4) * 1000)
    else:
        # Chạy auto_clean lần cuối (mặc định)
        cleaned_df, diff_raw, cleaning_log = cleaner_service.auto_clean(
            df=df,
            overridden_types=body.overridden_types,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )
        diff_raw.pop("invalid_replaced_keys", None)

    ms_clean = int((time.perf_counter() - t3) * 1000)

    # Validate cuối
    validation_dict = cleaner_service.validate_clean_dataset(cleaned_df)
    validation_res = ValidationResult(**validation_dict)
    
    if not validation_res.can_proceed:
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

    # Xuất ra CSV bytes & upload
    t_up0 = time.perf_counter()
    buf = io.BytesIO()
    cleaned_df.to_csv(buf, index=False)
    csv_bytes = buf.getvalue()
    clean_file_url = _upload_to_supabase(csv_bytes, filename, user_id)
    ms_up = int((time.perf_counter() - t_up0) * 1000)

    # Tạo session & Serialize
    t5 = time.perf_counter()
    session_id = str(uuid.uuid4())
    confirmed_at = datetime.now(timezone.utc).isoformat()
    summary = cleaner_service.build_summary_for_module3(cleaned_df)
    summary["file_hash"] = body.file_hash

    cache.set_session_metadata(user_id, session_id, summary)
    cache.set_file_bytes(user_id, session_id, csv_bytes, filename, ".csv")
    cache.set_cleaning_log(user_id, body.file_hash, cleaning_log)
    cache.set_report_section(user_id, body.file_hash, "cleaner", {
        "actions_taken": cleaning_log,
        "clean_mode": body.clean_mode,
        "stats": diff_raw,
        "ignored_cells_count": body.ignored_cells_count
    })
    cache.invalidate_downstream_state(user_id, body.file_hash)

    preview_df = cleaned_df.head(CLEANER_PREVIEW_ROWS).copy()
    preview_df = preview_df.where(pd.notna(preview_df), None)
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
    if "original_index" not in preview_df.columns:
        preview_df = preview_df.reset_index(names="original_index")
    preview_data = [{k: cleaner_service._to_json_safe(v) for k, v in r.items()} for r in preview_df.to_dict(orient="records")]

    res = CleanDatasetResponse(
        session_id=session_id,
        filename=filename,
        preview_rows=CLEANER_PREVIEW_ROWS,
        clean_file_url=clean_file_url,
        clean_report=DiffReport(**diff_raw),
        summary_for_module3=SummaryForModule3(**summary),
        clean_mode=body.clean_mode,
        confirmed_at=confirmed_at,
        validation=validation_res,
        preview_data=preview_data,
        column_letters=dict(cleaned_df.attrs.get("column_letters", df.attrs.get("column_letters", {}))),
    )
    ms_ser = int((time.perf_counter() - t5) * 1000)
    ms_total = int((time.perf_counter() - t_start) * 1000)

    logger.info(
        "cleaner.confirm_clean load=%d parse=%d types=%d clean=%d diff=%d upload=%d serialize=%d total=%d",
        ms_load, ms_parse, ms_types, ms_clean, ms_diff, ms_up, ms_ser, ms_total
    )

    return res


@router.post(
    "/cleaner/locate",
    response_model=LocateRowResponse,
    summary="Tìm offset của cửa sổ chứa dòng excel_row",
)
@router.post(
    "/locate-row",
    response_model=LocateRowResponse,
    summary="Tìm offset của cửa sổ chứa dòng excel_row (alias)",
)
def locate_row(
    body: LocateRowRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    cached = _load_cached_file(user_id, body.file_hash)
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])
    original_df = df

    profile_data = cache.get_profile(user_id, body.file_hash)
    column_semantics = {}
    profile_types = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
            profile_types[col.get("name")] = col.get("detected_type", "text")

    resolved_types = {
        str(c): cleaner_service.resolve_column_type(
            str(c), df[c], body.overridden_types, profile_types
        )
        for c in df.columns
    }

    target_df = df
    if body.clean_mode == "auto":
        target_df, _, _ = cleaner_service.auto_clean(
            df=df,
            overridden_types=body.overridden_types,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )
    elif body.clean_mode == "manual" and body.actions:
        target_df, _ = cleaner_service.apply_manual_actions(
            df=df,
            actions=body.actions,
            overridden_types=body.overridden_types,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )

    res = cleaner_service.locate_row(
        df=target_df,
        excel_row=body.excel_row,
        mode=body.mode,
        original_df=original_df,
        overridden_types=body.overridden_types,
        profile_types=profile_types,
        column_semantics=column_semantics,
        resolved_types=resolved_types,
    )
    return LocateRowResponse(**res)


@router.post(
    "/error-cells",
    response_model=ErrorCellsResponse,
    summary="Lấy danh sách các ô có lỗi thuộc nhóm (column, issue_type)",
)
def get_error_cells(
    body: ErrorCellsRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    cached = _load_cached_file(user_id, body.file_hash)
    file_bytes = io.BytesIO(cached["bytes"])
    df = _read_dataframe(file_bytes, cached["ext"])

    profile_data = cache.get_profile(user_id, body.file_hash)
    column_semantics = {}
    profile_types = {}
    if profile_data:
        for col in profile_data.get("columns", []):
            column_semantics[col.get("name")] = col.get("semantic_type", "GENERAL_TEXT")
            profile_types[col.get("name")] = col.get("detected_type", "text")

    resolved_types = {
        str(c): cleaner_service.resolve_column_type(
            str(c), df[c], body.overridden_types, profile_types
        )
        for c in df.columns
    }

    target_df = df
    if body.actions:
        target_df, _ = cleaner_service.apply_manual_actions(
            df=df,
            actions=body.actions,
            overridden_types=body.overridden_types,
            user_id=user_id,
            file_hash=body.file_hash,
            profile_types=profile_types,
            resolved_types=resolved_types,
        )

    res = cleaner_service.get_group_error_cells(
        df=target_df,
        column=body.column,
        issue_type=body.issue_type,
        offset=body.offset,
        limit=body.limit,
        overridden_types=body.overridden_types,
        profile_types=profile_types,
        column_semantics=column_semantics,
        resolved_types=resolved_types,
        column_letters=dict(target_df.attrs.get("column_letters", df.attrs.get("column_letters", {}))),
    )
    return ErrorCellsResponse(**res)


#Need checking!
def _safe_storage_name(name: str, max_len: int = 80) -> str:
    """Tên an toàn cho key Supabase: bỏ dấu, chỉ giữ A-Z a-z 0-9 . _ -"""
    import unicodedata
    name = name.replace("đ", "d").replace("Đ", "D")
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return (name[:max_len] or "dataset")


def _upload_to_supabase(csv_bytes: bytes, original_filename: str, user_id: int) -> str | None:
    """
    Upload CSV sạch lên Supabase Storage (bucket "datasets").
    Key luôn là ASCII an toàn + hash nội dung để không ghi đè file khác cùng tên.
    Lỗi upload KHÔNG chặn luồng chính: trả về None, người dùng vẫn sang Visualize được.
    """
    import os
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    stem = original_filename.rsplit(".", 1)[0]
    content_hash = hashlib.md5(csv_bytes).hexdigest()[:8]
    path = f"clean/{user_id}/{_safe_storage_name(stem)}_{content_hash}_clean.csv"

    if not supabase_url or not supabase_key:
        logger.warning("Supabase chưa cấu hình — dùng dev fallback URL.")
        return f"https://dev-placeholder.local/{path}"

    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "apikey": supabase_key,
    }

    try:
        import httpx
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{supabase_url}/storage/v1/object/datasets/{path}",
                headers={**headers, "Content-Type": "text/csv", "x-upsert": "true"},
                content=csv_bytes,
            )
            resp.raise_for_status()
            logger.info("Supabase upload OK: path=%s", path)

            sign_resp = client.post(
                f"{supabase_url}/storage/v1/object/sign/datasets/{path}",
                headers=headers,
                json={"expiresIn": 604800},
            )
            if sign_resp.status_code == 200:
                signed_path = sign_resp.json().get("signedURL")
                if signed_path:
                    return f"{supabase_url}/storage/v1{signed_path}"

            logger.error("Supabase sign lỗi: status=%s body=%s",
                         sign_resp.status_code, sign_resp.text[:300])
            return None

    except Exception as e:
        body = getattr(getattr(e, "response", None), "text", "")
        logger.error("Supabase upload lỗi: path=%s err=%s body=%s", path, e, body[:300])
        return None

@router.delete(
    "/session/active",
    summary="Hủy session hiện tại (no-op)",
    description="Kept for frontend compatibility. The per-file lock has been removed; this endpoint now always returns 200."
)
def clear_active_session_endpoint(
    current_user: dict = Depends(get_current_user),
):
    # No-op: the one-file-at-a-time lock has been removed.
    return {"message": "ok"}