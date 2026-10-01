import os
import sys
from app.core.database import SessionLocal
from app.models import UserAIUsage

def main():
    app_env = os.getenv("APP_ENV", "production")
    if app_env not in ("local", "development"):
        print(f"SECURITY ERROR: Cannot reset quota in '{app_env}' environment!")
        sys.exit(1)
        
    db = SessionLocal()
    # Assuming test user is user_id = 1
    user_id = 1
    usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == user_id).first()
    
    if usage:
        usage.runs_used = 0
        db.commit()
        print(f"Successfully reset runs_used to 0 for user_id {user_id}")
    else:
        print(f"No usage record found for user_id {user_id}")

if __name__ == "__main__":
    main()
