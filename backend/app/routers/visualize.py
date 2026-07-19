from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
import logging

from app.core.dependencies import get_current_user
from app.core.database import get_db
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
    auto_insights: list = []

@router.post("/explain", summary="Giải thích biểu đồ bằng AI")
async def explain_chart(
    body: ExplainRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    from app.services.ai_explain_service import check_ai_access, build_explain_prompt, call_gemini_explain, AI_EXPLAIN_COST
    from app.models import CreditTransaction, TransactionType
    
    # 0. Lấy file hash
    metadata = cache.get_session_metadata(body.session_id)
    cached_file = cache.get_file_bytes(body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    # Lấy hash từ session_id hoặc tự tạo nếu cần (trong hệ thống hiện tại file_hash thường được lưu cùng lúc)
    # Tuy nhiên vì session_id thường sinh từ hash nên lấy trực tiếp
    # Tốt nhất lấy thông tin metadata để có stats
    import hashlib
    # Tái tạo hash từ session bytes (dùng làm key tạm nếu ko có file_hash gốc)
    file_hash = hashlib.md5(cached_file["bytes"]).hexdigest()
    
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

    # 3. Cache Miss -> Check AI Access (Bypass -> Feature Flag -> Credits)
    wallet = await check_ai_access(current_user, db)

    # 4. Load stats & Build prompt
    # metadata["columns"] can be: list of strings, list of dicts, or a dict.
    # In most cases it's a list of column names (strings), so stats are minimal.
    # The frontend already sends auto_insights which carries the important context.
    col_stats = {}
    try:
        if metadata and isinstance(metadata, dict) and "columns" in metadata:
            columns = metadata["columns"]
            if isinstance(columns, dict):
                col_stats = columns.get(body.col_x, {})
            elif isinstance(columns, list) and len(columns) > 0 and isinstance(columns[0], dict):
                col_stats = next((c for c in columns if c.get("name") == body.col_x), {})
    except Exception:
        col_stats = {}
    
    prompt = build_explain_prompt(body.chart_type, col_stats, body.col_x, body.col_y, body.auto_insights)
    
    # 5. Call Gemini
    explanation = await call_gemini_explain(prompt)
    
    # 6. Save original cache
    cache.set_ai_explain_original(
        file_hash, body.chart_type, sorted_x, sorted_y, body.tier, explanation
    )
    
    # 7. Deduct credit (Safe none check)
    if wallet is not None:
        wallet.balance = float(wallet.balance) - AI_EXPLAIN_COST
        tx = CreditTransaction(
            user_id=current_user["user_id"],
            amount=AI_EXPLAIN_COST,
            type=TransactionType.DEBIT,
            description=f"AI Explain Chart ({body.chart_type})"
        )
        db.add(tx)
        db.commit()

    return {"content": explanation, "tier": body.tier, "source": "ai", "cached": False}


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
    cached_file = cache.get_file_bytes(body.session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
    
    import hashlib
    file_hash = hashlib.md5(cached_file["bytes"]).hexdigest()
    
    sorted_x, sorted_y = body.col_x, body.col_y
    if body.col_y:
        sorted_x, sorted_y = sorted([body.col_x, body.col_y])
        
    cache.set_ai_explain_edited(
        current_user["user_id"], file_hash, body.chart_type, sorted_x, sorted_y, body.tier, body.content
    )
    return {"message": "Đã lưu bản nháp."}


@router.get("/explain/suggestions", summary="Gợi ý tương quan tự động (Tier 1.5)")
async def get_suggestions(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    from app.services.ai_explain_service import get_correlation_suggestions
    
    cached_file = cache.get_file_bytes(session_id)
    if not cached_file:
        raise HTTPException(status_code=410, detail="Phiên làm việc đã hết hạn.")
        
    file_bytes = io.BytesIO(cached_file["bytes"])
    try:
        df = _read_dataframe(file_bytes, cached_file["ext"])
    except Exception as e:
        logger.error(f"Error reading df: {e}")
        raise HTTPException(status_code=400, detail="Không đọc được dữ liệu")
        
    summary = visualize_service.compute_statistics(session_id)
    
    suggestions = get_correlation_suggestions(df, summary)
    return suggestions

