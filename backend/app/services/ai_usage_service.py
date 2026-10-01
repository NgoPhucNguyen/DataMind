from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import UserAIUsage, AIUsageLog

def check_ai_quota(user_id: int, db: Session):
    usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).first()
    if not usage:
        # Default initialization if not exists
        usage = UserAIUsage(user_id=user_id, runs_used=0, runs_limit=2)
        db.add(usage)
        db.commit()
        db.refresh(usage)
    
    if usage.runs_used >= usage.runs_limit:
        raise HTTPException(
            status_code=402,
            detail={"error": "quota_exceeded", "message": "You have exceeded your AI usage quota."}
        )
    return usage

def record_ai_usage(db: Session, user_id: int, endpoint: str, result: str):
    counted = False
    if result == "success":
        usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).first()
        if usage:
            usage.runs_used += 1
            counted = True
    
    log_entry = AIUsageLog(
        user_id=user_id,
        endpoint=endpoint,
        result=result,
        counted_against_quota=counted
    )
    db.add(log_entry)
    db.commit()
