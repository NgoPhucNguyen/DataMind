from typing import Optional
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, ExpiredSignatureError, JWTError
import os

from app.core.errors import DataMindException, ErrorSeverity
from app.core.security import SECRET_KEY, ALGORITHM

security = HTTPBearer(auto_error=False)

JWT_SECRET = SECRET_KEY
JWT_ALGORITHM = ALGORITHM


def _detect_lang(request: Request) -> str:
    if not request:
        return "vi"
    query_lang = request.query_params.get("lang")
    if query_lang:
        return "en" if query_lang.lower().startswith("en") else "vi"
    header_lang = request.headers.get("x-lang") or request.headers.get("accept-language", "")
    if "en" in header_lang.lower() and "vi" not in header_lang.lower():
        return "en"
    return "vi"


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    lang = _detect_lang(request)

    if not credentials or not credentials.credentials:
        user_msg = (
            "Vui lòng đăng nhập để tiếp tục."
            if lang == "vi"
            else "Please log in to continue."
        )
        raise DataMindException(
            code="ERR_AUTH_INVALID",
            severity=ErrorSeverity.BLOCKING,
            user_message=user_msg,
            technical_detail={
                "module": "auth",
                "location": "get_current_user",
                "root_cause": "Missing Authorization header or credentials",
            },
            suggested_action={"action_type": "REDIRECT_LOGIN", "payload": {"reason": "missing_token"}},
            status_code=401,
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        sub = payload.get("sub")
        if sub is None:
            raise JWTError("Missing 'sub' subject claim in token")

        return {
            "user_id": int(sub),
            "email": payload.get("email", "")
        }

    except ExpiredSignatureError as e:
        user_msg = (
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            if lang == "vi"
            else "Your session has expired. Please log in again."
        )
        raise DataMindException(
            code="ERR_AUTH_TOKEN_EXPIRED",
            severity=ErrorSeverity.BLOCKING,
            user_message=user_msg,
            technical_detail={
                "module": "auth",
                "location": "get_current_user",
                "root_cause": str(e),
            },
            suggested_action={"action_type": "REDIRECT_LOGIN", "payload": {"reason": "expired"}},
            status_code=401,
        )
    except (JWTError, Exception) as e:
        user_msg = (
            "Token không hợp lệ hoặc đã bị thay đổi."
            if lang == "vi"
            else "Invalid authentication token."
        )
        raise DataMindException(
            code="ERR_AUTH_INVALID",
            severity=ErrorSeverity.BLOCKING,
            user_message=user_msg,
            technical_detail={
                "module": "auth",
                "location": "get_current_user",
                "root_cause": str(e),
            },
            suggested_action={"action_type": "REDIRECT_LOGIN", "payload": {"reason": "invalid_token"}},
            status_code=401,
        )

from app.core.database import get_db
from sqlalchemy.orm import Session
from app.models import User

def get_current_user_with_tier(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    tier = getattr(user, 'tier', "free") if user else "free"
    current_user["tier"] = tier
    return current_user