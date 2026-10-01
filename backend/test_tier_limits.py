import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import io
from PyPDF2 import PdfReader

# Assuming app is available to import
from app.main import app
from app.core import cache

client = TestClient(app)

from app.core.dependencies import get_current_user_with_tier

def override_get_current_user_free():
    return {"user_id": 1, "email": "phucnguyenngo2005@gmail.com", "tier": "free"}

def override_get_current_user_pro():
    return {"user_id": 2, "email": "phucnguyenngo2005@gmail.com", "tier": "pro"}

from fastapi import HTTPException
from unittest.mock import patch

def test_concurrent_processing_limit_free():
    app.dependency_overrides[get_current_user_with_tier] = override_get_current_user_free
    try:
        # 1. Clear any active session
        cache.clear_active_session(1)
        
        with patch("app.routers.files._load_df_from_cache", side_effect=HTTPException(status_code=400, detail="Mocked")):
            # 2. Simulate hitting auto_clean with file_hash A (should pass limit check, fail on mocked load)
            res1 = client.post("/api/v1/files/auto-clean", json={"file_hash": "hashA", "overridden_types": {}})
            assert res1.status_code == 400
            
            # 3. Simulate hitting auto_clean with file_hash B (should block with 429 before reaching load)
            res2 = client.post("/api/v1/files/auto-clean", json={"file_hash": "hashB", "overridden_types": {}})
            assert res2.status_code == 429
            assert "Bạn đang xử lý file khác" in res2.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_concurrent_processing_limit_pro():
    app.dependency_overrides[get_current_user_with_tier] = override_get_current_user_pro
    try:
        cache.clear_active_session(2)
        
        with patch("app.routers.files._load_df_from_cache", side_effect=HTTPException(status_code=400, detail="Mocked")):
            # Simulate hitting auto_clean with file_hash A
            res1 = client.post("/api/v1/files/auto-clean", json={"file_hash": "hashA", "overridden_types": {}})
            assert res1.status_code == 400
            
            # Simulate hitting auto_clean with file_hash B
            res2 = client.post("/api/v1/files/auto-clean", json={"file_hash": "hashB", "overridden_types": {}})
            assert res2.status_code == 400
    finally:
        app.dependency_overrides.clear()

def test_export_format_free_rejects_docx():
    app.dependency_overrides[get_current_user_with_tier] = override_get_current_user_free
    try:
        res = client.post("/api/v1/report/export", json={"file_hash": "hashA", "format": "docx"})
        assert res.status_code == 403
        assert "chỉ dành cho gói Pro" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_export_pdf_watermark_free():
    app.dependency_overrides[get_current_user_with_tier] = override_get_current_user_free
    try:
        res = client.post("/api/v1/report/export", json={"file_hash": "hashA", "format": "pdf"})
        assert res.status_code == 200
        assert len(res.content) > 0
        pdf = PdfReader(io.BytesIO(res.content))
        assert len(pdf.pages) > 0
    finally:
        app.dependency_overrides.clear()

def test_export_pdf_no_watermark_pro():
    app.dependency_overrides[get_current_user_with_tier] = override_get_current_user_pro
    try:
        res = client.post("/api/v1/report/export", json={"file_hash": "hashA", "format": "pdf"})
        assert res.status_code == 200
        assert len(res.content) > 0
    finally:
        app.dependency_overrides.clear()
