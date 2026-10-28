import os
from datetime import timezone, timedelta

VN_TZ = timezone(timedelta(hours=7))

# AI Quota limits (configured via environment variables with defaults)
AI_FREE_DAILY_LIMIT = int(os.getenv("AI_FREE_DAILY_LIMIT", 2))
AI_PRO_DAILY_LIMIT = int(os.getenv("AI_PRO_DAILY_LIMIT", 20))
PRO_DURATION_DAYS = int(os.getenv("PRO_DURATION_DAYS", 30))
AI_RESET_PERIOD = os.getenv("AI_RESET_PERIOD", "daily")
