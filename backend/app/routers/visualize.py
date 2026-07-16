from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import logging

from app.core.dependencies import get_current_user
from app.core import cache
from app.core.errors import DataMindException, ErrorSeverity
from app.routers.files import _read_dataframe
from app.services import visualize_service

router = APIRouter(prefix="/visualize", tags=["Visualize"])
logger = logging.getLogger(__name__)

class ComputeRequest(BaseModel):
    session_id: str
    warnings: list = []

@router.post("/compute", summary="Tính toán các thống kê cho module trực quan hóa")
async def compute(
    body: ComputeRequest,
    current_user: dict = Depends(get_current_user)
):
    # Logic metadata short-circuit + DataFrame loading đã được chuyển vào
    # visualize_service.compute_statistics(session_id) — router chỉ dispatch.
    try:
        summary = visualize_service.compute_statistics(
            current_user["user_id"], body.session_id, warnings=body.warnings
        )
    except DataMindException as e:
        logger.warning(f"DataMindException in compute: {e.code} - {e.user_message}")
        error_schema = e.to_schema()
        return JSONResponse(
            status_code=422,
            content={"error": error_schema.model_dump()}
        )
    except Exception as e:
        logger.error(f"Error computing statistics: {e}")
        raise HTTPException(status_code=500, detail="Lỗi trong quá trình tính toán thống kê.")
    
    return summary


class ScatterRequest(BaseModel):
    session_id: str
    col_x: str
    col_y: str


@router.post("/scatter-data", summary="Trả về dữ liệu điểm phân tán cho cặp cột anchor")
async def scatter_data(
    body: ScatterRequest,
    current_user: dict = Depends(get_current_user)
):
    # Validate col_x != col_y
    if body.col_x == body.col_y:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hai cột phải khác nhau."
        )

    # ── Short-circuit: kiểm tra metadata cho scatter validation ─────────────
    # Nếu metadata tồn tại, kiểm tra cột có hợp lệ và là numeric không
    # trước khi load toàn bộ file bytes.
    metadata = cache.get_session_metadata(current_user["user_id"], body.session_id)
    if metadata is not None:
        # Đảm bảo metadata là dict (Redis có thể trả về JSON string)
        if isinstance(metadata, str):
            import json
            metadata = json.loads(metadata)

        all_columns = metadata.get("columns", [])
        numeric_columns = metadata.get("numeric_columns", [])

        # Kiểm tra cột tồn tại và là numeric
        for col_name, col_label in [(body.col_x, "col_x"), (body.col_y, "col_y")]:
            if col_name not in all_columns:
                err = DataMindException(
                    code="ERR_VIZ_SCATTER_INVALID_COL",
                    severity=ErrorSeverity.BLOCKING,
                    user_message=f"Cột '{col_name}' không tồn tại trong dữ liệu.",
                    technical_detail={
                        "module": "visualize",
                        "location": "scatter_data (short-circuit via metadata)",
                        "root_cause": f"{col_label}='{col_name}' không có trong metadata.get('columns')"
                    },
                    suggested_action=None
                )
                return JSONResponse(
                    status_code=422,
                    content={"error": err.to_schema().model_dump()}
                )
            if col_name not in numeric_columns:
                err = DataMindException(
                    code="ERR_VIZ_SCATTER_INVALID_COL",
                    severity=ErrorSeverity.BLOCKING,
                    user_message=f"Cột '{col_name}' không phải kiểu số.",
                    technical_detail={
                        "module": "visualize",
                        "location": "scatter_data (short-circuit via metadata)",
                        "root_cause": f"{col_label}='{col_name}' không nằm trong metadata.get('numeric_columns')"
                    },
                    suggested_action=None
                )
                return JSONResponse(
                    status_code=422,
                    content={"error": err.to_schema().model_dump()}
                )
        logger.debug(
            "Metadata scatter validation OK: session=%s col_x=%s col_y=%s",
            body.session_id, body.col_x, body.col_y
        )

    # ── Load file bytes & parse DataFrame (chỉ chạy khi metadata pass/absent) ──
    cached = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if cached is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Phiên làm việc đã hết hạn (cache TTL 1 giờ). Vui lòng tải lại file."
        )
    
    file_bytes = io.BytesIO(cached["bytes"])
    try:
        df = _read_dataframe(file_bytes, cached["ext"])
    except Exception as e:
        logger.error(f"Error parsing file for scatter-data: {e}")
        raise HTTPException(status_code=400, detail="Lỗi khi đọc dữ liệu.")
    
    try:
        result = visualize_service.get_scatter_data(df, body.col_x, body.col_y)
    except DataMindException as e:
        logger.warning(f"DataMindException in scatter-data: {e.code} - {e.user_message}")
        error_schema = e.to_schema()
        return JSONResponse(
            status_code=422,
            content={"error": error_schema.model_dump()}
        )
    except Exception as e:
        logger.error(f"Error computing scatter data: {e}")
        raise HTTPException(status_code=500, detail="Lỗi trong quá trình tính toán dữ liệu phân tán.")
    
    return result
