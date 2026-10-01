from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
import os

security = HTTPBearer()

from app.core.security import SECRET_KEY, ALGORITHM

JWT_SECRET = SECRET_KEY
JWT_ALGORITHM = ALGORITHM


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        return {
            "user_id": int(payload["sub"]),
            "email": payload["email"]
        }

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
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