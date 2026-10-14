from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, Numeric, Enum, JSON, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import enum

Base = declarative_base()

# Định nghĩa các trạng thái chuẩn xác để tránh lỗi typo
class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

class PaymentEventStatus(str, enum.Enum):
    RECEIVED = "received"
    MATCHED_SUCCESS = "matched_success"
    UNMATCHED = "unmatched"
    AMOUNT_MISMATCH = "amount_mismatch"
    DUPLICATE = "duplicate"

class TransactionType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"

# ===== Payment / Subscription / Credits layer =====

class User(Base):
    __tablename__ = "users"
    first_upload_at = Column(DateTime, nullable=True)
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=True)

    google_id = Column(String, unique=True, nullable=True, index=True)
    avatar_url = Column(String, nullable=True)
    ai_insights_enabled = Column(Boolean, default=False, nullable=False)
    tier = Column(String, default="free", server_default="free", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    wallet = relationship("CreditsWallet", back_populates="user", uselist=False)
    subscriptions = relationship("UserSubscription", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    credit_transactions = relationship("CreditTransaction", back_populates="user")

class CreditsWallet(Base):
    __tablename__ = "credits_wallet"

    # Thêm index=True cho FK
    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True, index=True)
    # Dùng Numeric để xử lý tiền, nullable=False
    balance = Column(Numeric(10, 2), default=0.00, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="wallet")


class PaymentPackage(Base):
    __tablename__ = "payment_packages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    duration_days = Column(BigInteger, nullable=False)
    is_active = Column(String, default="true") # new : Soft delete hoặc ẩn gói cũ


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    package_id = Column(BigInteger, ForeignKey("payment_packages.id"), nullable=False, index=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    package_id = Column(BigInteger, ForeignKey("payment_packages.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    transaction_code = Column(String, unique=True, nullable=False, index=True)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="payments")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    type = Column(Enum(TransactionType), nullable=False)  
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="credit_transactions")


class CleanSession(Base):
    """
    Lưu metadata mỗi lần user xác nhận chốt Clean Dataset.
    Đây là kết quả cuối của Module 2, truyền metadata sang Module 3.
    """
    __tablename__ = "clean_sessions"

    id = Column(String, primary_key=True)                               # UUID
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    file_hash = Column(String, nullable=False, index=True)              # MD5 của file gốc
    original_filename = Column(String, nullable=False)
    clean_file_url = Column(String, nullable=True)                      # Supabase Storage URL
    clean_report = Column(JSON, nullable=True)                          # DiffReport dict
    summary_for_module3 = Column(JSON, nullable=True)                   # Shape, dtypes, columns
    clean_mode = Column(String, nullable=False, default="auto")         # "auto" | "manual"
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserAIUsage(Base):
    __tablename__ = "user_ai_usage"

    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True, index=True)
    runs_used = Column(BigInteger, default=0, nullable=False)
    runs_limit = Column(BigInteger, default=2, nullable=False)
    period_start = Column(DateTime, default=datetime.utcnow, nullable=False)
    plan = Column(String, default="free", nullable=False)

    user = relationship("User")

class AIUsageLog(Base):
    __tablename__ = "ai_usage_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    endpoint = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    result = Column(String, nullable=False)
    counted_against_quota = Column(Boolean, default=False, nullable=False)

    user = relationship("User")


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    transaction_id = Column(BigInteger, unique=True, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    status = Column(Enum(PaymentEventStatus), default=PaymentEventStatus.RECEIVED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PendingOrder(Base):
    __tablename__ = "pending_orders"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    order_ref = Column(String, unique=True, nullable=False, index=True) # Format DM-{user_id_short}-{random6}
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")