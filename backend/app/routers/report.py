from fastapi import APIRouter, Depends, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from app.services.llm_service import generate_report_intro
from app.core.dependencies import get_current_user
from app.core.limiter import limiter

router = APIRouter(tags=["report"])

class ReportIntroRequest(BaseModel):
    file_name: str | None = None
    row_count: int | None = 0
    col_count: int | None = 0
    schema: List[Dict[str, Any]] | None = []
    charts: List[Dict[str, Any]] | None = []
    user_context: Dict[str, Any] | None = None

@router.post("/report/intro")
@limiter.limit("20/hour")
async def get_report_intro(
    request: Request,
    body: ReportIntroRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Tạo đoạn giới thiệu 4-5 câu dựa trên metadata và các chart đã chọn.
    Yêu cầu đăng nhập + giới hạn tần suất để tránh bị lạm dụng gọi Gemini API tốn phí.
    """
    metadata = {
        "file_name": body.file_name,
        "row_count": body.row_count,
        "col_count": body.col_count,
        "schema": body.schema,
        "user_context": body.user_context
    }
    intro = await generate_report_intro(metadata, body.charts)
    return {"intro": intro}
