from fastapi import APIRouter, Depends, Request
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from app.services.llm_service import generate_report_intro
from app.core.dependencies import get_current_user
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import check_ai_quota, record_ai_usage
from app.core.limiter import limiter
from app.core import cache

router = APIRouter(tags=["report"])

class ReportIntroRequest(BaseModel):
    file_hash: str | None = None
    session_id: str | None = None
    file_name: str | None = None
    row_count: int | None = 0
    col_count: int | None = 0
    dataset_schema: List[Dict[str, Any]] | None = Field(default=[], alias="schema")
    charts: List[Dict[str, Any]] | None = []
    user_context: Dict[str, Any] | None = None

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
    Yêu cầu đăng nhập + giới hạn tần suất để tránh bị lạm dụng gọi Gemini API tốn phí.
    """
    metadata = {
        "file_name": body.file_name,
        "row_count": body.row_count,
        "col_count": body.col_count,
        "schema": body.dataset_schema,
        "user_context": body.user_context
    }
    
    if body.file_hash:
        sections = cache.get_all_report_sections(current_user["user_id"], body.file_hash)
        if sections:
            if "profiler" in sections:
                metadata["schema"] = sections["profiler"].get("schema", metadata["schema"])
            if "cleaner" in sections:
                metadata["cleaner_summary"] = sections["cleaner"]
            
            # Save visualize charts into report sections if available
            if body.charts:
                cache.set_report_section(current_user["user_id"], body.file_hash, "visualize", {"charts": body.charts})
    
    check_ai_quota(current_user["user_id"], db)
    intro = await generate_report_intro(metadata, body.charts)
    
    if "hệ thống hiện không thể tự động tổng hợp" in intro.lower() or "tập dữ liệu đã được xử lý thành công" in intro.lower():
        record_ai_usage(db, current_user["user_id"], "report-intro", "fallback_used")
    else:
        record_ai_usage(db, current_user["user_id"], "report-intro", "success")

    return {"intro": intro}


