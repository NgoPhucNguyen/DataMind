from datetime import datetime, date, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.core.config import (
    AI_FREE_DAILY_LIMIT,
    AI_PRO_DAILY_LIMIT,
    PRO_DURATION_DAYS,
    VN_TZ,
)

FREE_DAILY_RUNS = AI_FREE_DAILY_LIMIT
PRO_DAILY_RUNS = AI_PRO_DAILY_LIMIT


def today_vn() -> date:
    """Trả về ngày hiện tại theo múi giờ Việt Nam (UTC+7)."""
    return datetime.now(VN_TZ).date()


def today_start_utc() -> datetime:
    """Trả về thời điểm 00:00:00 hôm nay theo giờ VN, quy đổi sang UTC."""
    d = today_vn()
    vn_midnight = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=VN_TZ)
    return vn_midnight.astimezone(timezone(timedelta(hours=0))).replace(tzinfo=None)


def next_reset_datetime() -> datetime:
    """Trả về thời điểm reset tiếp theo (00:00:00 ngày mai giờ VN)."""
    tomorrow = today_vn() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=VN_TZ)


def refresh_usage(usage):
    """
    Hàm refresh_usage (đồng bộ, không commit, trả về usage):
    1. Nếu plan == "pro" và (pro_expires_at is None hoặc pro_expires_at < datetime.utcnow()):
       plan = "free", runs_limit = AI_FREE_DAILY_LIMIT.
    2. Nếu runs_reset_date != today_vn():
       runs_used = 0, runs_reset_date = today_vn().
    3. Cập nhật runs_limit theo plan hiện tại từ config.
    """
    if usage.plan == "pro" and (usage.pro_expires_at is None or usage.pro_expires_at < datetime.utcnow()):
        usage.plan = "free"
        usage.runs_limit = AI_FREE_DAILY_LIMIT

    if usage.runs_reset_date != today_vn():
        usage.runs_used = 0
        usage.runs_reset_date = today_vn()

    if usage.plan == "free":
        usage.runs_limit = AI_FREE_DAILY_LIMIT
    elif usage.plan == "pro":
        usage.runs_limit = AI_PRO_DAILY_LIMIT

    return usage


def get_feature_breakdown(db: Session, user_id: int) -> dict[str, int]:
    """Lấy số lượt dùng trong ngày hiện tại theo từng tính năng."""
    from app.models import AIUsageRecord

    start_utc = today_start_utc()
    rows = (
        db.query(AIUsageRecord.feature, func.count(AIUsageRecord.id))
        .filter(
            AIUsageRecord.user_id == user_id,
            AIUsageRecord.created_at >= start_utc,
        )
        .group_by(AIUsageRecord.feature)
        .all()
    )

    breakdown = {
        "profiler": 0,
        "reanalyze": 0,
        "explain": 0,
        "re_explain": 0,
    }
    for feature, count in rows:
        breakdown[feature] = count
    return breakdown


def get_user_ai_usage_summary(db: Session, user_id: int) -> dict:
    """Trả về tổng hợp quota và per-feature breakdown hiện tại của user."""
    from app.models import UserAIUsage

    usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).first()
    if not usage:
        usage = UserAIUsage(
            user_id=user_id,
            runs_used=0,
            runs_limit=AI_FREE_DAILY_LIMIT,
            plan="free",
            runs_reset_date=today_vn(),
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)
    else:
        refresh_usage(usage)
        db.commit()

    breakdown = get_feature_breakdown(db, user_id)
    remaining = max(0, usage.runs_limit - usage.runs_used)

    return {
        "remaining": remaining,
        "limit": usage.runs_limit,
        "used": usage.runs_used,
        "reset_at": next_reset_datetime().isoformat(),
        "is_pro": usage.plan == "pro",
        "breakdown": breakdown,
    }


def check_ai_quota(user_id: int, db: Session):
    """
    Kiểm tra hạn mức AI dùng chung.
    Nếu vượt quá limit, raise HTTP 429 với mã lỗi ERR_AI_QUOTA_EXCEEDED.
    """
    from app.models import UserAIUsage

    usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).with_for_update().first()
    if not usage:
        usage = UserAIUsage(
            user_id=user_id,
            runs_used=0,
            runs_limit=AI_FREE_DAILY_LIMIT,
            plan="free",
            runs_reset_date=today_vn(),
        )
        db.add(usage)
        db.flush()

    refresh_usage(usage)
    db.commit()

    if usage.runs_used >= usage.runs_limit:
        reset_time_iso = next_reset_datetime().isoformat()
        raise HTTPException(
            status_code=429,
            detail={
                "code": "ERR_AI_QUOTA_EXCEEDED",
                "message": f"Bạn đã dùng hết {usage.runs_limit} lượt hôm nay.",
                "reset_at": reset_time_iso,
                "is_pro": usage.plan == "pro",
            },
        )
    return usage


def record_ai_feature_usage(db: Session, user_id: int, feature: str) -> dict:
    """
    Ghi nhận 1 lượt sử dụng AI thành công cho tính năng cụ thể.
    Tăng runs_used và lưu vào ai_usage_records.
    Trả về tóm tắt quota mới nhất.
    """
    from app.models import UserAIUsage, AIUsageRecord, AIUsageLog

    usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).with_for_update().first()
    if usage:
        refresh_usage(usage)
        usage.runs_used += 1

    record = AIUsageRecord(
        user_id=user_id,
        feature=feature,
        created_at=datetime.utcnow(),
    )
    db.add(record)

    # Vẫn ghi ai_usage_log để tương thích ngược
    log_entry = AIUsageLog(
        user_id=user_id,
        endpoint=feature,
        result="success",
        counted_against_quota=True,
    )
    db.add(log_entry)
    db.commit()

    return get_user_ai_usage_summary(db, user_id)


def record_ai_usage(db: Session, user_id: int, endpoint: str, result: str):
    """Hàm legacy tương thích ngược."""
    from app.models import UserAIUsage, AIUsageLog

    counted = False
    if result == "success":
        usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).with_for_update().first()
        if usage:
            refresh_usage(usage)
            usage.runs_used += 1
            counted = True

    log_entry = AIUsageLog(
        user_id=user_id,
        endpoint=endpoint,
        result=result,
        counted_against_quota=counted,
    )
    db.add(log_entry)
    db.commit()
