from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user

from app.models import (
    CreditsWallet,
    CreditTransaction,
    TransactionType  # thêm vào đây
)

router = APIRouter(
    prefix="/credits",
    tags=["Credits"]
)


@router.get("/wallet")
def get_wallet(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wallet = (
        db.query(CreditsWallet)
        .filter(CreditsWallet.user_id == current_user["user_id"])
        .first()
    )

    if wallet is None:
        wallet = CreditsWallet(user_id=current_user["user_id"], balance=100000)
        db.add(wallet)
        transaction = CreditTransaction(
            user_id=current_user["user_id"],
            amount=100000,
            type=TransactionType.CREDIT,
            description="Welcome bonus"
        )
        db.add(transaction)
        db.commit()
        db.refresh(wallet)

    return {
        "balance": float(wallet.balance)
    }


@router.get("/history")
def get_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions = (
        db.query(CreditTransaction)
        .filter(
            CreditTransaction.user_id ==
            current_user["user_id"]
        )
        .order_by(
            CreditTransaction.created_at.desc()
        )
        .all()
    )

    return transactions