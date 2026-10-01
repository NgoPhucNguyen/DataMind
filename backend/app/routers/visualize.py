from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import logging

from app.core.dependencies import get_current_user
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import check_ai_quota, record_ai_usage
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

class ExplainRequest(BaseModel):
    session_id: str
    chart_type: str
    col_x: str
    col_y: str | None = None
    tier: str = "tier1"

@router.post("/explain", summary="Giải thích biểu đồ bằng AI")
async def explain_chart(
    body: ExplainRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    from app.services.ai_explain_service import call_gemini_explain
    from app.services.context_builder import build_llm_context, build_dataset_context
    import os
    
    # 0. Lấy file hash
    cached_file = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    import hashlib
    # Tái tạo hash từ session bytes (dùng làm key tạm nếu ko có file_hash gốc)
    # Vì file_hash đã bao gồm CACHE_VERSION trong files.py, ta lấy file_hash bằng cách tương tự
    # Để chắc chắn, ta dùng hàm băm chuẩn hoặc hash MD5.
    file_hash = "v4:" + hashlib.md5(cached_file["bytes"]).hexdigest()
    
    # Sort columns for consistent caching if 2 columns
    sorted_x, sorted_y = body.col_x, body.col_y
    if body.col_y:
        sorted_x, sorted_y = sorted([body.col_x, body.col_y])

    # 1. Check edited cache (Tier 2)
    edited = cache.get_ai_explain_edited(
        current_user["user_id"], file_hash, body.chart_type, sorted_x, sorted_y, body.tier
    )
    if edited:
        return {"content": edited, "tier": body.tier, "source": "user", "cached": True}

    # 2. Check original cache (Tier 1)
    original = cache.get_ai_explain_original(
        file_hash, body.chart_type, sorted_x, sorted_y, body.tier
    )
    if original:
        return {"content": original, "tier": body.tier, "source": "ai", "cached": True}

    # 3. Cache Miss -> Check AI Quota
    check_ai_quota(current_user["user_id"], db)

    # 4. Load stats & Build prompt
    # 4a. Lấy Part 1 từ cache (đã build khi profile)
    dataset_md = cache.get_dataset_context_md(current_user["user_id"], file_hash)
    if not dataset_md:
        profile_data = cache.get_profile(current_user["user_id"], file_hash)
        if profile_data:
            dataset_md = build_dataset_context(profile_data)
            cache.set_dataset_context_md(current_user["user_id"], file_hash, dataset_md)
            
    # 4b. Lấy user_context
    user_context = cache.get_user_context(current_user["user_id"], body.session_id)

    # 4c. Lấy col_stats đầy đủ bằng compute_statistics (tốn ~1-2s nhưng cần)
    summary = visualize_service.compute_statistics(current_user["user_id"], body.session_id)
    col_stats = {}
    if body.chart_type in ("heatmap", "scatter"):
        # For multi-column charts, we might need correlation from correlation_matrix
        corr_matrix = summary.get("correlation_matrix", {})
        r_val = corr_matrix.get(body.col_x, {}).get(body.col_y, "N/A")
        if r_val == "N/A":
            r_val = corr_matrix.get(body.col_y, {}).get(body.col_x, "N/A")
            
        # Get semantic types
        col_x_sem = "GENERAL_TEXT"
        col_y_sem = "GENERAL_TEXT"
        profile_data = cache.get_profile(current_user["user_id"], file_hash)
        if profile_data:
            for col in profile_data.get("columns", []):
                if col["name"] == body.col_x:
                    col_x_sem = col.get("semantic_type", "GENERAL_TEXT")
                if col["name"] == body.col_y:
                    col_y_sem = col.get("semantic_type", "GENERAL_TEXT")
                    
        col_stats = {
            "r": r_val,
            "col_x_stats": summary.get("columns", {}).get(body.col_x, {}),
            "col_y_stats": summary.get("columns", {}).get(body.col_y, {}),
            "col_x_semantic": col_x_sem,
            "col_y_semantic": col_y_sem
        }
    else:
        col_stats = summary.get("columns", {}).get(body.col_x, {})

    # 4d. Build prompt cuối (auto_insights tính nội bộ)
    prompt = build_llm_context(
        profile_data=None,
        chart_type=body.chart_type,
        col_x=body.col_x,
        col_stats=col_stats,
        col_y=body.col_y,
        dataset_context_md=dataset_md,
        user_context=user_context,
    )
    
    # 5. Gọi AI 
    try:
        explanation = await call_gemini_explain(prompt)
        
        if "tính năng ai explain hiện không khả dụng" in explanation.lower() or "lỗi khi gọi ai" in explanation.lower():
            record_ai_usage(db, current_user["user_id"], "explain-chart", "fallback_used")
        else:
            record_ai_usage(db, current_user["user_id"], "explain-chart", "success")
    except Exception as e:
        record_ai_usage(db, current_user["user_id"], "explain-chart", "failed")
        raise e

    # 6. Cache lại
    cache.set_ai_explain_original(
        file_hash, body.chart_type, sorted_x, sorted_y, body.tier, explanation
    )

    APP_ENV = os.getenv("APP_ENV", "production")
    response = {"content": explanation, "tier": body.tier, "source": "ai", "cached": False}
    
    if APP_ENV in ("development", "local"):
        response["_debug_prompt"] = prompt
        response["_debug_parts"] = {
            "part1_dataset_context": dataset_md or "(not available)"
        }

    return response


class SaveExplainRequest(BaseModel):
    session_id: str
    chart_type: str
    col_x: str
    col_y: str | None = None
    tier: str = "tier1"
    content: str

@router.post("/explain/save", summary="Lưu nội dung AI giải thích do user sửa")
async def save_explain(
    body: SaveExplainRequest,
    current_user: dict = Depends(get_current_user)
):
    cached_file = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    import hashlib
    file_hash = "v4:" + hashlib.md5(cached_file["bytes"]).hexdigest()
    
    sorted_x, sorted_y = body.col_x, body.col_y
    if body.col_y:
        sorted_x, sorted_y = sorted([body.col_x, body.col_y])
        
    cache.set_ai_explain_edited(
        current_user["user_id"], file_hash, body.chart_type, sorted_x, sorted_y, body.tier, body.content
    )
    return {"message": "Đã lưu bản nháp."}




class BatchExplainRequestItem(BaseModel):
    chart_id: str
    chart_type: str
    col_x: str
    col_y: str | None = None

class BatchExplainRequest(BaseModel):
    session_id: str
    tier: str = "tier1"
    charts: list[BatchExplainRequestItem]

@router.post("/explain/batch", summary="Lấy danh sách các AI Explain đã tạo cho nhiều biểu đồ")
async def get_batch_explain(
    body: BatchExplainRequest,
    current_user: dict = Depends(get_current_user)
):
    cached_file = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if not cached_file:
        return {"explanations": {}}
    
    import hashlib
    file_hash = "v4:" + hashlib.md5(cached_file["bytes"]).hexdigest()
    
    results = {}
    for item in body.charts:
        sorted_x, sorted_y = item.col_x, item.col_y
        if item.col_y:
            sorted_x, sorted_y = sorted([item.col_x, item.col_y])
            
        edited = cache.get_ai_explain_edited(
            current_user["user_id"], file_hash, item.chart_type, sorted_x, sorted_y, body.tier
        )
        if edited:
            results[item.chart_id] = {"content": edited, "source": "user"}
            continue
            
        original = cache.get_ai_explain_original(
            file_hash, item.chart_type, sorted_x, sorted_y, body.tier
        )
        if original:
            results[item.chart_id] = {"content": original, "source": "ai"}
            
    return {"explanations": results}
