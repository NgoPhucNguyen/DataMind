from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv


from app.routers import auth as auth_router
from app.routers import credits as credits_router
from app.routers import packages as packages_router
from app.routers import files as files_router
from app.routers import visualize as visualize_router
from app.routers import report as report_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 DataMind API Starting...")
    yield
    print("🛑 DataMind API Shutting down...")

app = FastAPI(
    title="DataMind API",
    description="Excel/CSV Analysis Engine with AI Insights",
    version="0.1.0",
    lifespan=lifespan
)

raw_frontend_urls = os.getenv(
    "FRONTEND_URLS", 
    "http://localhost:3000,http://localhost:5173"
)

# 🛠️ Parse the comma-separated string into a python list
FRONTEND_URLS = [url.strip() for url in raw_frontend_urls.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(credits_router.router, prefix="/api/v1")
app.include_router(packages_router.router, prefix="/api/v1")
app.include_router(files_router.router, prefix="/api/v1")
app.include_router(visualize_router.router, prefix="/api/v1")
app.include_router(report_router.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "message": "DataMind API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "True") == "True"
    )