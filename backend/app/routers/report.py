import os
import json
import logging
from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime, timezone
import hashlib
from pydantic import BaseModel, Field
from app.services.llm_service import generate_report_intro
from app.core.dependencies import get_current_user
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import check_ai_quota, record_ai_feature_usage, get_user_ai_usage_summary
from app.core.limiter import limiter
from app.core import cache
from app.core.ai_client import get_dev_provider

router = APIRouter(tags=["report"])
logger = logging.getLogger(__name__)

def get_stable_chart_id(item: Any) -> str:
    """
    Trích xuất chart id ổn định không phụ thuộc vào user_title:
    1. chart_id hoặc id nếu có.
    2. Nếu không có, suy ra từ type + column (+ col_y) ví dụ 'bar:<column>' hoặc 'scatter:<col_x>:<col_y>'.
    Tuyệt đối không dùng user_title hay title.
    """
    if isinstance(item, str):
        return item
    if not isinstance(item, dict):
        return str(item) if item else ""
    cid = item.get("chart_id") or item.get("id")
    if cid:
        return str(cid)
    ctype = item.get("type") or item.get("display_type") or "chart"
    col = item.get("column") or item.get("col") or item.get("col_x") or ""
    col_y = item.get("col_y") or ""
    if col_y:
        return f"{ctype}:{col}:{col_y}"
    return f"{ctype}:{col}"

def compute_charts_hash(charts_or_ids: List[Any] | None) -> str:
    """
    Stable charts_hash algorithm (v2):
    MD5 (first 12 hex chars) of comma-separated sorted stable chart IDs.
    Stable chart ID = chart_id or id; if both missing, derived as '{type}:{column}'
    or '{type}:{column}:{col_y}'.
    Renaming user_title, reordering, or changing chart display settings does NOT change this hash.
    Only adding or removing charts changes it.
    Both backend (report.py) and frontend (Report.jsx) implement this exact algorithm.
    """
    if not charts_or_ids:
        return hashlib.md5("".encode("utf-8")).hexdigest()[:12]
    
    ids: List[str] = [get_stable_chart_id(item) for item in charts_or_ids]
    ids = [i for i in ids if i]
    ids.sort()
    combined = ",".join(ids)
    return hashlib.md5(combined.encode("utf-8")).hexdigest()[:12]

def compute_cleaning_hash(cleaning_log: Any) -> str:
    """
    MD5 (first 12 hex chars) của cleaning_log được tuần tự hóa nhất quán.
    Dùng để phát hiện dữ liệu có bị làm sạch lại sau khi methodology được lưu hay không.
    """
    if not cleaning_log:
        return hashlib.md5("".encode("utf-8")).hexdigest()[:12]
    serialized = json.dumps(cleaning_log, sort_keys=True, separators=(',', ':'))
    return hashlib.md5(serialized.encode("utf-8")).hexdigest()[:12]

class ReportIntroRequest(BaseModel):
    file_hash: str | None = None
    session_id: str | None = None
    file_name: str | None = None
    row_count: int | None = 0
    col_count: int | None = 0
    dataset_schema: List[Dict[str, Any]] | None = Field(default=[], alias="schema")
    charts: List[Dict[str, Any]] | None = []
    user_context: Dict[str, Any] | None = None
    lang: str = "vi"

class SaveReportIntroRequest(BaseModel):
    file_hash: str
    lang: str = "vi"
    text: str
    chart_ids: Optional[List[str]] = None

class SaveReportMethodologyRequest(BaseModel):
    file_hash: str
    text: str = ""
    cleaning_hash: Optional[str] = None

class SaveReportTextRequest(BaseModel):
    file_hash: str
    section: Literal["methodology", "key_findings"]
    text: str = ""
    cleaning_hash: Optional[str] = None
    charts_hash: Optional[str] = None
    chart_ids: Optional[List[Any]] = None

@router.get("/report/state")
def get_report_state(
    file_hash: str = Query(...),
    lang: str = Query("vi"),
    current_user: dict = Depends(get_current_user),
):
    """
    Trả về trạng thái báo cáo mà không gọi Gemini hay tiêu tốn hạn mức AI:
    - intro: giá trị đã cache (source: ai/user, text, charts_hash, generated_at) hoặc null.
    - cleaner: thông tin report section 'cleaner' (clean_mode, stats, actions_taken count, ignored_cells_count) hoặc null.
    - context: {description, description_source, domain} từ profiler_context hoặc null.
    - methodology: {text, source: 'user', cleaning_hash, updated_at} từ report_sections hoặc null.
    - key_findings: {text, source: 'user', charts_hash, updated_at} từ report_sections hoặc null.
    - cleaning_hash: hash của cleaning_log hiện tại.
    """
    user_id = current_user["user_id"]
    cached_intro = cache.get_report_intro(user_id, file_hash, lang)
    
    # Cleaner, Visualize, Methodology & Key Findings sections từ report_sections
    sections = cache.get_all_report_sections(user_id, file_hash) or {}
    cleaner_section = sections.get("cleaner")
    visualize_section = sections.get("visualize")
    methodology_section = sections.get("methodology")
    key_findings_section = sections.get("key_findings")
    
    # Profiler context
    p_ctx = cache.get_profiler_context(user_id, file_hash)
    context_data = None
    if p_ctx:
        sem_ctx = p_ctx.get("semantic_context") or {}
        context_data = {
            "description": p_ctx.get("description"),
            "description_source": p_ctx.get("description_source"),
            "domain": sem_ctx.get("domain") or p_ctx.get("domain")
        }

    # Current cleaning_hash
    current_cleaning_hash = None
    if cleaner_section:
        current_cleaning_hash = compute_cleaning_hash(cleaner_section.get("actions_taken"))
        cleaner_section["cleaning_hash"] = current_cleaning_hash
    else:
        raw_log = cache.get_cleaning_log(user_id, file_hash)
        if raw_log:
            current_cleaning_hash = compute_cleaning_hash(raw_log)

    return {
        "intro": cached_intro,
        "cleaner": cleaner_section,
        "visualize": visualize_section,
        "context": context_data,
        "methodology": methodology_section,
        "key_findings": key_findings_section,
        "cleaning_hash": current_cleaning_hash,
    }

@router.post("/report/intro")
@limiter.limit("20/hour")
async def get_report_intro(
    request: Request,
    body: ReportIntroRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tạo đoạn giới thiệu 4-5 câu dựa trên metadata và các chart đã chọn.
    Yêu cầu đăng nhập + giới hạn tần suất.
    Chỉ ghi nhận usage quota và lưu cache khi thành công (không phải fallback).
    """
    user_id = current_user["user_id"]
    norm_lang = body.lang if body.lang in ("vi", "en") else "vi"

    metadata = {
        "file_name": body.file_name,
        "row_count": body.row_count,
        "col_count": body.col_count,
        "schema": body.dataset_schema,
        "user_context": body.user_context
    }
    
    if body.file_hash:
        sections = cache.get_all_report_sections(user_id, body.file_hash)
        if sections:
            if "profiler" in sections:
                metadata["schema"] = sections["profiler"].get("schema", metadata["schema"])
            if "cleaner" in sections:
                metadata["cleaner_summary"] = sections["cleaner"]
            
            # Save visualize charts into report sections if available
            if body.charts:
                cache.set_report_section(user_id, body.file_hash, "visualize", {"charts": body.charts})
    
    # 1. Kiểm tra quota trước khi gọi
    check_ai_quota(user_id, db)

    # 2. Sinh intro
    intro_text, is_fallback = await generate_report_intro(metadata, body.charts or [], lang=norm_lang)
    charts_hash = compute_charts_hash(body.charts or [])

    feature_name = "report_intro"
    if await request.is_disconnected():
        logger.info(f"ai.cancelled feature={feature_name}")
        return JSONResponse(status_code=499, content={"detail": "Client closed request", "cancelled": True})

    # 3. Quota & Cache
    if not is_fallback:
        usage = record_ai_feature_usage(db, user_id, "report_intro")
        if body.file_hash:
            cache.set_report_intro(
                user_id,
                body.file_hash,
                norm_lang,
                {
                    "text": intro_text,
                    "source": "ai",
                    "charts_hash": charts_hash,
                    "hash_version": 2,
                    "generated_at": datetime.now(timezone.utc).isoformat()
                }
            )
    else:
        usage = get_user_ai_usage_summary(db, user_id)

    res = {
        "intro": intro_text,
        "is_fallback": is_fallback,
        "usage": usage,
        "charts_hash": charts_hash
    }
    if not is_fallback:
        dev_prov = get_dev_provider()
        if dev_prov:
            res["provider"] = dev_prov

    return res

@router.post("/report/intro/save")
def save_report_intro(
    body: SaveReportIntroRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Lưu văn bản intro do user trực tiếp chỉnh sửa (source: 'user').
    Không tiêu tốn quota AI, không gọi Gemini.
    """
    user_id = current_user["user_id"]
    norm_lang = body.lang if body.lang in ("vi", "en") else "vi"
    charts_hash = compute_charts_hash(body.chart_ids or [])

    data = {
        "text": body.text,
        "source": "user",
        "charts_hash": charts_hash,
        "hash_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    cache.set_report_intro(user_id, body.file_hash, norm_lang, data)
    return {"message": "Đã lưu bản chỉnh sửa.", "data": data}

@router.post("/report/text/save")
def save_report_text(
    body: SaveReportTextRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Lưu văn bản do user trực tiếp chỉnh sửa (source: 'user') cho section:
    'methodology' hoặc 'key_findings' vào report_sections.
    Không tiêu tốn quota AI, không gọi Gemini.
    Nếu text rỗng hoặc chỉ khoảng trắng -> xóa bản user (quay lại auto text).
    """
    user_id = current_user["user_id"]
    if not body.text or not body.text.strip():
        cache.delete_report_section(user_id, body.file_hash, body.section)
        return {"message": f"Đã xóa bản chỉnh sửa {body.section} (khôi phục auto text).", "data": None}

    if body.section == "methodology":
        cleaning_hash = body.cleaning_hash
        if not cleaning_hash:
            cleaner_sec = (cache.get_all_report_sections(user_id, body.file_hash) or {}).get("cleaner")
            actions = cleaner_sec.get("actions_taken") if cleaner_sec else None
            cleaning_hash = compute_cleaning_hash(actions or cache.get_cleaning_log(user_id, body.file_hash))

        data = {
            "text": body.text,
            "source": "user",
            "cleaning_hash": cleaning_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        cache.set_report_section(user_id, body.file_hash, "methodology", data)
        return {"message": "Đã lưu bản chỉnh sửa methodology.", "data": data}

    elif body.section == "key_findings":
        charts_hash = body.charts_hash
        if not charts_hash:
            if body.chart_ids is not None:
                charts_hash = compute_charts_hash(body.chart_ids)
            else:
                vis_sec = (cache.get_all_report_sections(user_id, body.file_hash) or {}).get("visualize")
                charts = vis_sec.get("charts") if vis_sec else None
                charts_hash = compute_charts_hash(charts or [])

        data = {
            "text": body.text,
            "source": "user",
            "charts_hash": charts_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        cache.set_report_section(user_id, body.file_hash, "key_findings", data)
        return {"message": "Đã lưu bản chỉnh sửa key_findings.", "data": data}

@router.post("/report/methodology/save")
def save_report_methodology(
    body: SaveReportMethodologyRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Backward-compatible wrapper for save_report_text with section='methodology'.
    """
    return save_report_text(
        SaveReportTextRequest(
            file_hash=body.file_hash,
            section="methodology",
            text=body.text,
            cleaning_hash=body.cleaning_hash
        ),
        current_user=current_user
    )



