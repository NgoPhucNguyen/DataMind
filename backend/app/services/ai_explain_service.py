import os
import json
import asyncio
import logging
import pandas as pd
import numpy as np
import scipy.stats as stats
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core import ai_client

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

async def call_gemini_explain(prompt: str, lang: str = "vi") -> str:
    text, _ = await ai_client.generate_text(prompt, feature="explain", lang=lang)
    return text




