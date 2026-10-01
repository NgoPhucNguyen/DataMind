import asyncio
import os
import sys

# Add backend dir to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.context_builder import build_llm_context
from app.services.ai_explain_service import call_gemini_explain

async def test():
    profile_data = {
        "filename": "sales_data.csv",
        "total_rows": 1000,
        "total_columns": 5,
        "columns": [
            {"name": "Marketing_Spend", "detected_type": "numeric", "null_pct": 0},
            {"name": "Revenue", "detected_type": "numeric", "null_pct": 0}
        ],
        "semantic_context": {
            "domain": "Sales & Marketing",
            "confidence": 0.9,
            "reasoning": "Columns clearly related to sales and marketing spend."
        }
    }
    
    col_stats = {
        "r": 0.85,
        "col_x_stats": {"dtype": "numeric", "mean": 15000.5},
        "col_y_stats": {"dtype": "numeric", "mean": 450000.2},
        "col_x_semantic": "Marketing Expenditure ($)",
        "col_y_semantic": "Total Sales Revenue ($)"
    }
    
    prompt = build_llm_context(
        profile_data=profile_data,
        chart_type="heatmap",
        col_x="Marketing_Spend",
        col_y="Revenue",
        col_stats=col_stats
    )
    
    print("PROMPT:")
    print(prompt)
    print("---------")
    
    res = await call_gemini_explain(prompt)
    print("GEMINI RESPONSE:")
    print(res)

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test())
