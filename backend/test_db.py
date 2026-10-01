from app.core.database import SessionLocal
from app.models import UserAIUsage

db = SessionLocal()
try:
    usage = db.query(UserAIUsage).first()
    print("Query success:", usage)
except Exception as e:
    import traceback
    traceback.print_exc()
