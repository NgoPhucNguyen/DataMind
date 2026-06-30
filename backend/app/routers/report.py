from fastapi import APIRouter
from typing import List, Dict, Any
from pydantic import BaseModel
from app.services.llm_service import generate_report_intro

router = APIRouter(tags=["report"])

class ReportIntroRequest(BaseModel):
    file_name: str | None = None
    row_count: int | None = 0
    col_count: int | None = 0
    schema: List[Dict[str, Any]] | None = []
    charts: List[Dict[str, Any]] | None = []
    user_context: Dict[str, Any] | None = None

@router.post("/report/intro")
async def get_report_intro(request: ReportIntroRequest):
    """
    Tạo đoạn giới thiệu 4-5 câu dựa trên metadata và các chart đã chọn.
    """
    metadata = {
        "file_name": request.file_name,
        "row_count": request.row_count,
        "col_count": request.col_count,
        "schema": request.schema,
        "user_context": request.user_context
    }
    intro = await generate_report_intro(metadata, request.charts)
    return {"intro": intro}
