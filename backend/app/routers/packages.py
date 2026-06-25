from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user

from app.models import (
    PaymentPackage,
    CreditsWallet,
    CreditTransaction,
    UserSubscription,
    TransactionType,
    SubscriptionStatus
    
)

router = APIRouter(
    prefix="/packages",
    tags=["Packages"]
)
@router.get("")
def get_packages(
    db: Session = Depends(get_db)
):
    return (
        db.query(PaymentPackage)
        .filter(PaymentPackage.is_active == "true")
        .all()
    )
@router.post("/purchase")
def purchase_package(
    package_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    package = (
        db.query(PaymentPackage)
        .filter(PaymentPackage.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    wallet = (
        db.query(CreditsWallet)
        .filter(CreditsWallet.user_id == current_user["user_id"])
        .first()
    )

    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if wallet.balance < package.price:
        raise HTTPException(status_code=400, detail="Not enough credits")

    # Trừ tiền
    wallet.balance -= package.price

    transaction = CreditTransaction(
        user_id=current_user["user_id"],
        amount=package.price,
        type=TransactionType.DEBIT,
        description=f"Purchase package {package.name}"
    )
    db.add(transaction)

    # Kiểm tra subscription cùng gói còn active không
    now = datetime.utcnow()
    existing = (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == current_user["user_id"],
            UserSubscription.package_id == package_id,
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.end_date > now
        )
        .first()
    )

    if existing:
        # Cùng gói → cộng dồn thời gian từ end_date hiện tại
        existing.end_date = existing.end_date + timedelta(days=package.duration_days)
    else:
        # Gói mới → tạo subscription mới
        subscription = UserSubscription(
            user_id=current_user["user_id"],
            package_id=package.id,
            start_date=now,
            end_date=now + timedelta(days=package.duration_days)
        )
        db.add(subscription)

    db.commit()

    return {
        "message": "Package purchased successfully",
        "remaining_credits": float(wallet.balance)
    }
@router.get("/my-subscription")
def my_subscription(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    subscriptions = (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == current_user["user_id"],
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.end_date > now
        )
        .order_by(UserSubscription.end_date.desc())
        .all()
    )

    if not subscriptions:
        return {"message": "No active subscription found"}

    return [
        {
            "package_id": sub.package_id,
            "status": sub.status,
            "start_date": sub.start_date,
            "end_date": sub.end_date
        }
        for sub in subscriptions
    ]