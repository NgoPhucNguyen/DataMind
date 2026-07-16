from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi import Request   # thêm Request vào import fastapi có sẵn
from app.core.limiter import limiter
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, verify_google_id_token
from app.models import (
    User,
    CreditsWallet,
    CreditTransaction,
    TransactionType
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    GoogleLoginRequest, 
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
        ai_insights_enabled=user.ai_insights_enabled,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản mới",
)
@limiter.limit("10/hour")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
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
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
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
@router.post("/google", response_model=LoginResponse, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
def login_with_google(request: Request, body: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        idinfo = verify_google_id_token(body.credential)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Không thể xác thực tài khoản Google. Vui lòng thử lại.")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "").lower()
    full_name = idinfo.get("name") or email.split("@")[0]
    avatar_url = idinfo.get("picture")

    if not email or not idinfo.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Email Google chưa được xác minh.")

    user = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Tài khoản email/password đã tồn tại → liên kết Google
            user.google_id = google_id
            user.avatar_url = user.avatar_url or avatar_url
        else:
            # Tạo user mới
            user = User(full_name=full_name, email=email, password=None,
                        google_id=google_id, avatar_url=avatar_url)
            db.add(user)
            db.commit()
            db.refresh(user)
            db.add(CreditsWallet(user_id=user.id, balance=100000))
            db.add(CreditTransaction(user_id=user.id, amount=100000,
                                     type=TransactionType.CREDIT, description="Welcome bonus"))

    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return LoginResponse(message="Đăng nhập bằng Google thành công!",
                         user=_user_to_response(user),
                         token=TokenResponse(access_token=access_token))