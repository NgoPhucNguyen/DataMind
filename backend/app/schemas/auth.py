import re
from pydantic import BaseModel, EmailStr, field_validator


ALLOWED_EMAIL_DOMAINS = re.compile(r".+\.(com|fpt)$", re.IGNORECASE)


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        if not ALLOWED_EMAIL_DOMAINS.match(v):
            raise ValueError("Email phải có đuôi .com hoặc .fpt (ví dụ: user@gmail.com, user@fpt.edu.fpt)")
        return v.lower()

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Mật khẩu phải có ít nhất 6 ký tự")
        return v

class GoogleLoginRequest(BaseModel):
    credential: str 
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    created_at: str

    model_config = {"from_attributes": True}


class RegisterResponse(BaseModel):
    message: str
    user: UserResponse


class LoginResponse(BaseModel):
    message: str
    user: UserResponse
    token: TokenResponse
