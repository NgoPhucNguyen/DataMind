from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.limiter import limiter
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import time
import logging
from dotenv import load_dotenv

load_dotenv(override=True)

from app.routers import auth as auth_router
from app.routers import files as files_router
from app.routers import visualize as visualize_router
from app.routers import report as report_router
from app.routers import payments as payments_router
from app.routers import meta as meta_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 DataMind API Starting...")
    yield
    print("🛑 DataMind API Shutting down...")

from app.core.errors import DataMindException
from fastapi.responses import JSONResponse

app = FastAPI(
    title="DataMind API",
    description="Excel/CSV Analysis Engine with AI Insights",
    version="0.1.0",
    lifespan=lifespan
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(DataMindException)
async def datamind_exception_handler(request, exc: DataMindException):
    status_code = 503 if exc.code == "ERR_AI_UNAVAILABLE" else 400
    return JSONResponse(
        status_code=status_code,
        content=exc.to_schema().dict()
    )
raw_frontend_urls = os.getenv(
    "FRONTEND_URLS", 
    "http://localhost:3000,http://localhost:5173"
)

# 🛠️ Parse the comma-separated string into a python list
FRONTEND_URLS = [url.strip() for url in raw_frontend_urls.split(",")]

logger = logging.getLogger("timing")

@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    logger.info("req %s %s %s ms=%d", request.method, request.url.path, response.status_code, duration_ms)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(files_router.router, prefix="/api/v1")
app.include_router(visualize_router.router, prefix="/api/v1")
app.include_router(report_router.router, prefix="/api/v1")
app.include_router(payments_router.router, prefix="/api/v1")
app.include_router(meta_router.router, prefix="/api/v1")

from app.core.dependencies import get_current_user
from app.core.database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session
from app.services.ai_usage_service import get_user_ai_usage_summary

@app.get("/api/v1/ai/usage", summary="Lấy thống kê định mức AI dùng chung")
def get_shared_ai_usage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_user_ai_usage_summary(db, current_user["user_id"])


@app.get("/health")
def health():
    return {"status": "ok", "message": "DataMind API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "True") == "True"
    )


