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



