from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.live_stats_service import get_live_stats
from app.core.cache import get_cached_json, set_cached_json

router = APIRouter(prefix="/public", tags=["Public Stats"])

CACHE_KEY = "public:live_stats:v1"
CACHE_TTL = 30  # 30 seconds


@router.get("/live-stats", summary="Số liệu thống kê thời gian thực công khai")
def live_stats(response: Response, db: Session = Depends(get_db)):
    """API công khai, chỉ đọc, trả số liệu realtime từ cơ sở dữ liệu.

    Cache Redis key 'public:live_stats:v1' với TTL 30s.
    Header Cache-Control: public, max-age=10.
    """
    response.headers["Cache-Control"] = "public, max-age=10"

    # 1. Thử lấy từ Redis cache
    cached_data = get_cached_json(CACHE_KEY)
    if cached_data is not None:
        return cached_data

    # 2. Query cơ sở dữ liệu
    stats = get_live_stats(db)

    # 3. Lưu cache 30s (nếu Redis lỗi thì hàm set_cached_json tự bỏ qua không crash)
    set_cached_json(CACHE_KEY, stats, ttl=CACHE_TTL)

    return stats

