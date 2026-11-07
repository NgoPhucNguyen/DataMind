import os
import logging
from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
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

def compute_charts_hash(charts_or_ids: List[Any] | None) -> str:
    """
    charts_hash = md5 of sorted chart_ids (first 12 chars).
    charts_or_ids can be list of chart objects with 'chart_id'/'id' or list of string chart_ids.
    """
    if not charts_or_ids:
        return hashlib.md5("".encode("utf-8")).hexdigest()[:12]
    
    ids: List[str] = []
    for item in charts_or_ids:
        if isinstance(item, dict):
            cid = item.get("chart_id") or item.get("id") or item.get("user_title") or item.get("title") or ""
            ids.append(str(cid))
        elif isinstance(item, str):
            ids.append(item)
        else:
            ids.append(str(item))
            
    ids.sort()
    combined = ",".join(ids)
    return hashlib.md5(combined.encode("utf-8")).hexdigest()[:12]

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
    """
    user_id = current_user["user_id"]
    cached_intro = cache.get_report_intro(user_id, file_hash, lang)
    
    # Cleaner section từ report_sections
    sections = cache.get_all_report_sections(user_id, file_hash) or {}
    cleaner_section = sections.get("cleaner")
    
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

    return {
        "intro": cached_intro,
        "cleaner": cleaner_section,
        "context": context_data
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
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    cache.set_report_intro(user_id, body.file_hash, norm_lang, data)
    return {"message": "Đã lưu bản chỉnh sửa.", "data": data}



