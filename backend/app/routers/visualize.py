from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import logging

from app.core.dependencies import get_current_user
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.services.ai_usage_service import (
    check_ai_quota,
    record_ai_usage,
    record_ai_feature_usage,
    get_user_ai_usage_summary,
)
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
    lang: str = "vi"
    is_reanalyze: bool = False
    chart_config: dict | None = None
    plotted_data: list | None = None

@router.post("/explain", summary="Giải thích biểu đồ bằng AI")
async def explain_chart(
    body: ExplainRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_explain_service import call_gemini_explain
    from app.services.context_builder import build_llm_context, build_dataset_context
    import os
    import hashlib
    
    # 0. Lấy file bytes và session metadata để tìm file_hash gốc
    cached_file = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    session_meta = cache.get_session_metadata(current_user["user_id"], body.session_id) or {}
    provenance_hash = session_meta.get("file_hash")
    file_hash = provenance_hash or ("v4:" + hashlib.md5(cached_file["bytes"]).hexdigest())

    # Sort columns for consistent caching if 2 columns
    sorted_x, sorted_y = body.col_x, body.col_y
    if body.col_y:
        sorted_x, sorted_y = sorted([body.col_x, body.col_y])

    # Profiler & User context
    profiler_ctx = cache.get_profiler_context(current_user["user_id"], file_hash) or {}
    user_context = cache.get_user_context(current_user["user_id"], file_hash) or {}
    
    # Merge context to get description & semantic info
    desc = profiler_ctx.get("description") or user_context.get("description") or ""
    desc_src = profiler_ctx.get("description_source") or "user"
    sem_ctx = profiler_ctx.get("semantic_context") or {}
    domain = sem_ctx.get("domain", "")

    # Calculate context_hash so that changes to description / domain invalidate or update cache
    ctx_raw_str = f"{desc}:{desc_src}:{domain}"
    context_hash = hashlib.md5(ctx_raw_str.encode("utf-8")).hexdigest()[:12]

    # Cleaning Summary from report_sections
    report_sections = cache.get_all_report_sections(current_user["user_id"], file_hash) or {}
    cleaner_summary = report_sections.get("cleaner") or {}

    # 1. Check edited cache (Tier 2) with lang
    edited_data = cache.get_ai_explain_edited(
        current_user["user_id"], file_hash, body.chart_type, sorted_x, sorted_y, body.tier, lang=body.lang, context_hash=context_hash
    )
    if edited_data:
        content = edited_data.get("content") if isinstance(edited_data, dict) else edited_data
        saved_ctx_hash = edited_data.get("context_hash") if isinstance(edited_data, dict) else ""
        is_stale = bool(saved_ctx_hash and saved_ctx_hash != context_hash)
        
        # If user explicitly pressed re-analyze, bypass cache
        if not body.is_reanalyze:
            usage_info = get_user_ai_usage_summary(db, current_user["user_id"])
            return {
                "content": content,
                "tier": body.tier,
                "source": "user",
                "cached": True,
                "from_cache": True,
                "is_stale": is_stale,
                "usage": usage_info,
            }

    # 2. Check original cache (Tier 1) with lang & context_hash
    if not body.is_reanalyze:
        original = cache.get_ai_explain_original(
            file_hash, body.chart_type, sorted_x, sorted_y, body.tier, lang=body.lang, context_hash=context_hash
        )
        if original:
            usage_info = get_user_ai_usage_summary(db, current_user["user_id"])
            return {
                "content": original,
                "tier": body.tier,
                "source": "ai",
                "cached": True,
                "from_cache": True,
                "is_stale": False,
                "usage": usage_info,
            }

    # 3. Cache Miss -> Check AI Quota (Shared pool)
    check_ai_quota(current_user["user_id"], db)

    # 4. Load stats & Build prompt
    profile_data = cache.get_profile(current_user["user_id"], file_hash)
    summary = visualize_service.compute_statistics(current_user["user_id"], body.session_id)
    
    col_stats = {}
    if body.chart_type in ("heatmap", "scatter"):
        corr_matrix = summary.get("correlation_matrix", {})
        r_val = corr_matrix.get(body.col_x, {}).get(body.col_y, "N/A")
        if r_val == "N/A":
            r_val = corr_matrix.get(body.col_y, {}).get(body.col_x, "N/A")
            
        col_x_sem = "GENERAL_TEXT"
        col_y_sem = "GENERAL_TEXT"
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

    # Plotted data: cap at 30 points max
    plotted_data = body.plotted_data
    if plotted_data and isinstance(plotted_data, list):
        plotted_data = plotted_data[:30]

    merged_user_context = {
        "description": desc,
        "description_source": desc_src,
        "purpose": user_context.get("purpose") or ""
    }

    prompt = build_llm_context(
        profile_data=profile_data,
        chart_type=body.chart_type,
        col_x=body.col_x,
        col_stats=col_stats,
        col_y=body.col_y,
        dataset_context_md=None,
        user_context=merged_user_context,
        cleaning_summary=cleaner_summary,
        chart_config=body.chart_config,
        plotted_data=plotted_data,
    )

    if body.lang == "en":
        prompt += "\n\nCRITICAL INSTRUCTION: You MUST write your complete analysis and explanation in ENGLISH."
    else:
        prompt += "\n\nCRITICAL INSTRUCTION: You MUST write your complete analysis and explanation in VIETNAMESE."
    
    # 5. Gọi AI 
    try:
        explanation = await call_gemini_explain(prompt)
    except Exception as e:
        record_ai_usage(db, current_user["user_id"], "explain-chart", "failed")
        raise e

    # 6. Ghi nhận quota tiêu thụ
    feature_name = "re_explain" if body.is_reanalyze else "explain"
    usage_summary = record_ai_feature_usage(db, current_user["user_id"], feature_name)

    # 7. Cache lại với lang và context_hash
    cache.set_ai_explain_original(
        file_hash, body.chart_type, sorted_x, sorted_y, body.tier, explanation, lang=body.lang, context_hash=context_hash
    )

    APP_ENV = os.getenv("APP_ENV", "production")
    response = {
        "content": explanation,
        "tier": body.tier,
        "source": "ai",
        "cached": False,
        "from_cache": False,
        "is_stale": False,
        "usage": usage_summary,
    }
    
    if APP_ENV in ("development", "local"):
        response["_debug_prompt"] = prompt

    return response


class SaveExplainRequest(BaseModel):
    session_id: str
    chart_type: str
    col_x: str
    col_y: str | None = None
    tier: str = "tier1"
    content: str
    lang: str = "vi"

@router.post("/explain/save", summary="Lưu nội dung AI giải thích do user sửa")
async def save_explain(
    body: SaveExplainRequest,
    current_user: dict = Depends(get_current_user)
):
    import hashlib
    cached_file = cache.get_file_bytes(current_user["user_id"], body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    session_meta = cache.get_session_metadata(current_user["user_id"], body.session_id) or {}
    provenance_hash = session_meta.get("file_hash")
    file_hash = provenance_hash or ("v4:" + hashlib.md5(cached_file["bytes"]).hexdigest())
    
    sorted_x, sorted_y = body.col_x, body.col_y
    if body.col_y:
        sorted_x, sorted_y = sorted([body.col_x, body.col_y])

    profiler_ctx = cache.get_profiler_context(current_user["user_id"], file_hash) or {}
    user_context = cache.get_user_context(current_user["user_id"], file_hash) or {}
    desc = profiler_ctx.get("description") or user_context.get("description") or ""
    desc_src = profiler_ctx.get("description_source") or "user"
    sem_ctx = profiler_ctx.get("semantic_context") or {}
    domain = sem_ctx.get("domain", "")
    ctx_raw_str = f"{desc}:{desc_src}:{domain}"
    context_hash = hashlib.md5(ctx_raw_str.encode("utf-8")).hexdigest()[:12]
        
    cache.set_ai_explain_edited(
        current_user["user_id"], file_hash, body.chart_type, sorted_x, sorted_y, body.tier, body.content, lang=body.lang, context_hash=context_hash
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
