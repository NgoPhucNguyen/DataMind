import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from datetime import timedelta
import pytest
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-0123456789abcdef")

from app.core.security import create_access_token
from app.core.dependencies import get_current_user
from app.core.errors import DataMindException


def make_dummy_request(query_string: str = "", headers: dict = None) -> Request:
    raw_headers = []
    if headers:
        for k, v in headers.items():
            raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/auth/me/subscription",
        "query_string": query_string.encode("latin-1"),
        "headers": raw_headers,
    }
    return Request(scope)


def test_expired_token_raises_err_auth_token_expired():
    expired_token = create_access_token(
        data={"sub": "123", "email": "test@datamind.vn"},
        expires_delta=timedelta(minutes=-5)
    )
    req = make_dummy_request()
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)

    with pytest.raises(DataMindException) as exc_info:
        get_current_user(request=req, credentials=creds)

    exc = exc_info.value
    assert exc.code == "ERR_AUTH_TOKEN_EXPIRED"
    assert exc.status_code == 401
    assert "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." in exc.user_message


def test_expired_token_english():
    expired_token = create_access_token(
        data={"sub": "123", "email": "test@datamind.vn"},
        expires_delta=timedelta(minutes=-10)
    )
    req = make_dummy_request(query_string="lang=en")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)

    with pytest.raises(DataMindException) as exc_info:
        get_current_user(request=req, credentials=creds)

    exc = exc_info.value
    assert exc.code == "ERR_AUTH_TOKEN_EXPIRED"
    assert exc.status_code == 401
    assert "Your session has expired. Please log in again." in exc.user_message


def test_invalid_token_raises_err_auth_invalid():
    req = make_dummy_request()
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="garbage.token.here")

    with pytest.raises(DataMindException) as exc_info:
        get_current_user(request=req, credentials=creds)

    exc = exc_info.value
    assert exc.code == "ERR_AUTH_INVALID"
    assert exc.status_code == 401
    assert "Token không hợp lệ" in exc.user_message


def test_missing_credentials_raises_err_auth_invalid():
    req = make_dummy_request()

    with pytest.raises(DataMindException) as exc_info:
        get_current_user(request=req, credentials=None)

    exc = exc_info.value
    assert exc.code == "ERR_AUTH_INVALID"
    assert exc.status_code == 401
    assert "Vui lòng đăng nhập để tiếp tục." in exc.user_message


def test_valid_token_decodes_successfully():
    valid_token = create_access_token(
        data={"sub": "456", "email": "user@datamind.vn"},
        expires_delta=timedelta(hours=2)
    )
    req = make_dummy_request()
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)

    user = get_current_user(request=req, credentials=creds)
    assert user["user_id"] == 456
    assert user["email"] == "user@datamind.vn"
