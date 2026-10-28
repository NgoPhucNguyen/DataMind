from sqlalchemy.orm import Session
from app.models import UserAIUsage, User

def is_pro(user_id: int, db: Session) -> bool:
    """
    Điểm duy nhất để kiểm tra xem một user có phải là Pro hay không.
    Tất cả các tính năng yêu cầu tài khoản Pro nên gọi hàm này thay vì check riêng lẻ.
    """
    # 1. Kiểm tra qua UserAIUsage (do sepay_service.py cập nhật plan = "pro" tại đây)
    from app.services.ai_usage_service import refresh_usage
    ai_usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).first()
    if ai_usage:
        refresh_usage(ai_usage)
        if ai_usage.plan.lower() == "pro":
            return True
    
    # 2. Kiểm tra fallback qua User tier (nếu có sử dụng)
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.tier and user.tier.lower() == "pro":
        return True
        
    return False
