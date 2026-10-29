import asyncio
from unittest.mock import patch, MagicMock
from app.routers import visualize
from app.routers.visualize import ExplainRequest

async def main():
    print("1. Creating body and mock user")
    body = ExplainRequest(session_id="s1", chart_type="bar", col_x="category", tier="tier1", lang="vi")
    user = {"user_id": 1}
    db = MagicMock()

    print("2. Entering patches")
    with patch("app.core.cache.get_session_metadata", return_value={"file_hash": "h1"}), \
         patch("app.core.cache.get_file_bytes", return_value=None), \
         patch("app.core.cache.get_profiler_context", return_value={}), \
         patch("app.core.cache.get_user_context", return_value={}), \
         patch("app.core.cache.get_all_report_sections", return_value={}), \
         patch("app.core.cache.get_ai_explain_edited", return_value=None), \
         patch("app.core.cache.get_ai_explain_original", return_value="cached!"), \
         patch("app.services.ai_usage_service.get_user_ai_usage_summary", return_value={"runs_used": 0}):
        
        print("3. Calling explain_chart")
        res = await visualize.explain_chart(body, user, db)
        print("4. Finished explain_chart:", res)

if __name__ == "__main__":
    asyncio.run(main())

