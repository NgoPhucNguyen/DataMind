from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import io
import logging

from app.core.dependencies import get_current_user
from app.core import cache
from app.routers.files import _read_dataframe
from app.services import visualize_service

router = APIRouter(prefix="/visualize", tags=["Visualize"])
logger = logging.getLogger(__name__)

class ComputeRequest(BaseModel):
    session_id: str

@router.post("/compute", summary="Tính toán các thống kê cho module trực quan hóa")
async def compute(
    body: ComputeRequest,
    current_user: dict = Depends(get_current_user)
):
    cached = cache.get_file_bytes(body.session_id)
    if cached is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session ID không hợp lệ hoặc đã hết hạn. Vui lòng thử lại pipeline."
        )
    
    file_bytes = io.BytesIO(cached["bytes"])
    try:
        df = _read_dataframe(file_bytes, cached["ext"])
    except Exception as e:
        logger.error(f"Error parsing file for compute: {e}")
        raise HTTPException(status_code=400, detail="Lỗi khi đọc dữ liệu để tính toán.")
        
    try:
        summary = visualize_service.compute_statistics(df)
    except Exception as e:
        logger.error(f"Error computing statistics: {e}")
        raise HTTPException(status_code=500, detail="Lỗi trong quá trình tính toán thống kê.")
    
    return summary
