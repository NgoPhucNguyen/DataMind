import sys
from app.core.database import SessionLocal
from app.models import UserAIUsage, AIUsageLog

def main():
    db = SessionLocal()
    
    users = db.query(UserAIUsage).all()
    if not users:
        print("No users found in user_ai_usage")
        return
        
    print("--- UserAIUsage ---")
    for u in users:
        print(f"User ID: {u.user_id}, Runs Used: {u.runs_used}, Runs Limit: {u.runs_limit}")
        
        logs = db.query(AIUsageLog).filter(AIUsageLog.user_id == u.user_id).order_by(AIUsageLog.id.asc()).all()
        print(f"--- AIUsageLog for User ID {u.user_id} ---")
        for log in logs:
            print(f"  Log ID: {log.id}, Endpoint: {log.endpoint}, Result: {log.result}, Counted: {log.counted_against_quota}")

if __name__ == "__main__":
    main()
