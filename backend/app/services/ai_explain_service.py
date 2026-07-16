import os
import json
import asyncio
import logging
import pandas as pd
import numpy as np
import scipy.stats as stats
from fastapi import HTTPException, status
from app.models import User, CreditsWallet, CreditTransaction, TransactionType

logger = logging.getLogger(__name__)

APP_ENV = os.getenv("APP_ENV", "production")
AI_EXPLAIN_COST = 500

async def check_ai_access(current_user: dict, db) -> CreditsWallet | None:
    """
    Check if the user can use the AI Insights feature.
    - If APP_ENV is development/local, bypass feature flag and credit check.
    - If production, check ai_insights_enabled flag, then wallet balance.
    Returns the wallet object if credit deduction is needed later, or None if bypassed.
    """
    if APP_ENV in ("development", "local"):
        return None

    # Step 2: Feature flag check
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user or not user.ai_insights_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tính năng đang trong giai đoạn thử nghiệm nội bộ. Vui lòng liên hệ admin để được kích hoạt."
        )

    # Step 3: Credit check
    wallet = db.query(CreditsWallet).filter(CreditsWallet.user_id == current_user["user_id"]).first()
    if not wallet or wallet.balance < AI_EXPLAIN_COST:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Số dư credit không đủ để sử dụng tính năng này."
        )

    return wallet


def build_explain_prompt(chart_type: str, col_stats: dict, col_x: str, col_y: str = None, auto_insights: list = None) -> str:
    """
    Build the prompt for Gemini acting as a Data Analyst.
    """
    if auto_insights is None:
        auto_insights = []
        
    insights_str = "\n".join([f"- {i['text']}" for i in auto_insights]) if auto_insights else "Không có nhận xét tự động."
    
    if chart_type in ("histogram", "bar", "pie", "box", "line"):
        context = f"Tôi đang xem biểu đồ {chart_type} cho cột '{col_x}'.\n"
        context += f"Thống kê cơ bản:\n{json.dumps(col_stats, indent=2, ensure_ascii=False)}\n"
        context += f"Nhận xét tự động từ hệ thống:\n{insights_str}\n"
    elif chart_type == "heatmap":
        context = f"Tôi đang xem mối tương quan giữa '{col_x}' và '{col_y}'.\n"
        context += f"Độ tương quan (r): {col_stats.get('r', 'N/A')}\n"
    else:
        context = f"Tôi đang xem biểu đồ về '{col_x}'."

    prompt = f"""Bạn là một chuyên viên phân tích dữ liệu (Data Analyst) chuyên nghiệp và sắc sảo.
Dựa vào các số liệu và nhận xét tự động sau đây:

{context}

Hãy viết một đoạn giải thích (khoảng 3-5 câu) phân tích ý nghĩa của biểu đồ này. 
Khuyến khích bạn sử dụng kiến thức nền tảng để đưa ra các giả thuyết kinh doanh hợp lý (ví dụ: nguyên nhân, hệ quả) đằng sau những con số này.
Hãy trả về ĐÚNG MỘT ĐOẠN VĂN bản giải thích (không markdown, không bullet point, không giải thích dông dài).
"""
    return prompt


from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception)
)
async def _call_gemini_with_retry(client, prompt: str):
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
    )

async def call_gemini_explain(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Tính năng AI Explain hiện không khả dụng (thiếu API Key)."

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = await _call_gemini_with_retry(client, prompt)
        text = response.text.strip()
        return text
    except Exception as e:
        import traceback
        logger.error(f"Gemini API error in explain: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Lỗi khi gọi AI: {str(e)}"
        )


def compute_cramers_v(df: pd.DataFrame, col_a: str, col_b: str) -> float:
    """
    Calculate Cramér's V statistic for categorical-categorical association.
    """
    try:
        crosstab = pd.crosstab(df[col_a], df[col_b])
        chi2 = stats.chi2_contingency(crosstab, correction=False)[0]
        n = crosstab.sum().sum()
        r, c = crosstab.shape
        if n == 0 or min(r, c) == 1:
            return 0.0
        return np.sqrt(chi2 / (n * min(r-1, c-1)))
    except Exception:
        return 0.0


def get_correlation_suggestions(df: pd.DataFrame, summary: dict) -> list[dict]:
    """
    Get top 3 suggestions (Tier 1.5) by combining Pearson correlation (numerical) 
    and Cramér's V (categorical).
    """
    suggestions = []
    
    # 1. Add top numerical correlations (Pearson) from summary
    top_corr = summary.get("top_correlations", [])
    for corr in top_corr:
        suggestions.append({
            "col_a": corr["col_a"],
            "col_b": corr["col_b"],
            "score": abs(corr["r"]),
            "type": "numeric",
            "metric": "Pearson",
            "value": corr["r"]
        })
        
    # 2. Calculate Cramér's V for top categorical columns
    categorical_cols = [col for col, info in summary.get("columns", {}).items() 
                        if info.get("dtype") in ("categorical", "boolean") and not info.get("skip_chart")]
    
    # Limit to max 10 categorical columns to avoid long processing
    categorical_cols = categorical_cols[:10]
    
    for i in range(len(categorical_cols)):
        for j in range(i+1, len(categorical_cols)):
            col_a = categorical_cols[i]
            col_b = categorical_cols[j]
            v_score = compute_cramers_v(df, col_a, col_b)
            if v_score > 0.3:
                suggestions.append({
                    "col_a": col_a,
                    "col_b": col_b,
                    "score": v_score,
                    "type": "categorical",
                    "metric": "Cramér's V",
                    "value": round(v_score, 4)
                })
                
    # Sort by score desc and take top 3
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    return suggestions[:3]
