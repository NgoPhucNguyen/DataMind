from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models import (
    User,
    CreditsWallet,
    CreditTransaction,
    TransactionType
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RegisterResponse,
    LoginResponse,
    UserResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        created_at=user.created_at.isoformat(),
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản mới",
)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Kiểm tra email
    existing = db.query(User).filter(User.email == body.email).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email này đã được sử dụng. Vui lòng dùng email khác.",
        )

    # Tạo user mới
    new_user = User(
        full_name=body.full_name,
        email=body.email,
        password=hash_password(body.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Tạo ví credits
    wallet = CreditsWallet(
        user_id=new_user.id,
        balance=100000
    )

    db.add(wallet)

    # Lịch sử credits
    transaction = CreditTransaction(
        user_id=new_user.id,
        amount=100000,
        type=TransactionType.CREDIT,
        description="Welcome bonus"
    )

    db.add(transaction)

    db.commit()

    return RegisterResponse(
        message="Đăng ký thành công!",
        user=_user_to_response(new_user),
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập và nhận JWT token",
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user or not verify_password(body.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng.",
        )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})

    return LoginResponse(
        message="Đăng nhập thành công!",
        user=_user_to_response(user),
        token=TokenResponse(access_token=access_token),
    )
