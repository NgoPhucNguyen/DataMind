from fastapi import APIRouter, Request, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import PendingOrder, PaymentStatus, PaymentPackage
from datetime import datetime, timedelta
import random
import string
from app.services.sepay_service import (
    verify_sepay_signature,
    verify_sepay_ip,
    process_sepay_webhook
)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

@router.post("/sepay-webhook")
async def sepay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    import os
    if os.getenv("DEBUG_SEPAY") == "true":
        print(f"=== X-Forwarded-For: {request.headers.get('x-forwarded-for')} ===")
        print(f"=== X-Real-IP: {request.headers.get('x-real-ip')} ===")
        print(f"=== request.client.host: {request.client.host if request.client else None} ===")
    
    # Extract IP from X-Forwarded-For due to ngrok/docker proxy
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else ""
    if not verify_sepay_ip(client_ip):
        raise HTTPException(status_code=401, detail="Unauthorized IP")

    # Get raw body for HMAC verification
    raw_body = await request.body()
    
    timestamp = request.headers.get("X-SePay-Timestamp")
    signature = request.headers.get("X-SePay-Signature")
    
    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="Missing signature headers")
        
    if not verify_sepay_signature(raw_body, timestamp, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    return process_sepay_webhook(db, raw_body)

@router.post("/create-order")
def create_order(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["user_id"]
    
    # Tạm tắt logic check order cũ để luôn tạo order mới (giá 2000đ)
    # twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    # existing_order = db.query(PendingOrder).filter(
    #     PendingOrder.user_id == user_id,
    #     PendingOrder.status == PaymentStatus.PENDING,
    #     PendingOrder.created_at >= twenty_four_hours_ago
    # ).first()
    
    # if existing_order:
    #     import os
    #     return {
    #         "order_ref": existing_order.order_ref,
    #         "amount": existing_order.amount,
    #         "transfer_info": {
    #             "bank_name": os.getenv("SEPAY_BANK_CODE", "ACB"),
    #             "account_number": os.getenv("SEPAY_BANK_ACCOUNT_NUMBER", "49310387"),
    #             "account_name": os.getenv("SEPAY_BANK_ACCOUNT_NAME", "NGO PHUC NGUYEN"),
    #             "content": existing_order.order_ref
    #         }
    #     }
        
    # Get Pro package amount, default to 2000 if not found (for testing)
    amount = 2000.00
    # Generate unique order_ref
    while True:
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        order_ref = f"DM-{user_id}-{random_suffix}"
        
        # Check uniqueness
        if not db.query(PendingOrder).filter(PendingOrder.order_ref == order_ref).first():
            break
            
    new_order = PendingOrder(
        user_id=user_id,
        order_ref=order_ref,
        amount=amount,
        status=PaymentStatus.PENDING
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    import os
    bank_code = os.getenv("SEPAY_BANK_CODE", "ACB")
    account_number = os.getenv("SEPAY_BANK_ACCOUNT_NUMBER", "49310387")
    account_name = os.getenv("SEPAY_BANK_ACCOUNT_NAME", "NGO PHUC NGUYEN")
    
    return {
        "order_ref": new_order.order_ref,
        "amount": new_order.amount,
        "transfer_info": {
            "bank_name": bank_code,
            "account_number": account_number,
            "account_name": account_name,
            "content": new_order.order_ref
        }
    }

@router.get("/order-status")
def get_order_status(
    order_ref: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(PendingOrder).filter(
        PendingOrder.order_ref == order_ref,
        PendingOrder.user_id == current_user["user_id"]
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    return {
        "order_ref": order.order_ref,
        "status": order.status,
        "amount": order.amount
    }
