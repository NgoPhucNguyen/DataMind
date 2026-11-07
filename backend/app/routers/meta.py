"""
meta.py (router)
----------------
Endpoints cung cấp siêu dữ liệu hệ thống (metadata), các quy tắc/ngưỡng định lượng
và công cụ phân loại thử nghiệm nhanh kiểu dữ liệu không dùng AI.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
import pandas as pd
from typing import Any

from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from app.core import rules
from app.services.profiler_service import profile_dataframe

router = APIRouter(prefix="/meta", tags=["Metadata"])


@router.get("/rules", summary="Lấy danh mục các quy tắc, ngưỡng và hằng số hệ thống")
def get_system_rules() -> dict[str, Any]:
    """
    Trả về toàn bộ hằng số và ngưỡng tính toán gom nhóm theo {profiler, cleaner, session, ai}
    kèm theo đơn vị đo, mô tả tiếng Việt và phiên bản quy tắc hiện tại.
    Public endpoint (tài liệu docs), không tốn AI quota.
    """
    return rules.get_all_rules_metadata()


class ClassifyRequest(BaseModel):
    values: list[str] = Field(
        ...,
        max_length=200,
        description="Danh sách tối đa 200 giá trị chuỗi cần kiểm tra thử nghiệm kiểu dữ liệu"
    )


@router.post("/classify", summary="Phân loại thử nghiệm kiểu dữ liệu cho một danh sách giá trị")
@limiter.limit("30/minute")
def classify_values(
    request: Request,
    body: ClassifyRequest,
) -> dict[str, Any]:
    """
    Phân loại thử nghiệm kiểu dữ liệu cho một cột (tối đa 200 giá trị, mỗi giá trị <= 200 ký tự).
    Các chuỗi rỗng ("") được coi là ô trống (missing).
    Chạy cùng một giải thuật profile_dataframe với hệ thống chính, không dùng AI, không lưu cache.
    Public endpoint cho trang Docs, có rate-limit 30 req/phút.
    """
    if len(body.values) > 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tối đa 200 giá trị."
        )

    for val in body.values:
        if len(val) > 200:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Mỗi giá trị không được vượt quá 200 ký tự."
            )

    # Chuỗi rỗng -> None để coi là missing
    cleaned_values = [None if v.strip() == "" else v for v in body.values]

    df = pd.DataFrame({"sample_col": cleaned_values})
    results = profile_dataframe(df)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể phân tích dữ liệu."
        )

    col = results[0]
    return {
        "detected_type": col["detected_type"],
        "suggested_charts": col["suggested_charts"],
        "detection_reason": col.get("detection_reason"),
        "disguised_numeric": col.get("disguised_numeric"),
        "null_pct": col["null_pct"],
        "unique_count": col["unique_count"]
    }

