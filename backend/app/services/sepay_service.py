from datetime import datetime
import hmac
import hashlib
import time
import os
import re
import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.models import PaymentEvent, PendingOrder, UserAIUsage, PaymentEventStatus, PaymentStatus

# Helper function to get secrets securely
def get_sepay_secret():
    return os.getenv("SEPAY_WEBHOOK_SECRET", "")

def normalize(s: str) -> str:
    return re.sub(r'[^A-Z0-9]', '', s.upper()) if s else ""

def get_sepay_allowed_ips():
    ips = os.getenv("SEPAY_ALLOWED_IPS", "")
    return [ip.strip() for ip in ips.split(",") if ip.strip()]

def verify_sepay_signature(raw_body: bytes, timestamp_str: str, signature_header: str) -> bool:
    """
    Verifies the HMAC-SHA256 signature from SePay.
    Requires:
    - raw_body (bytes): exact raw bytes of the request.
    - timestamp_str (str): X-SePay-Timestamp header value.
    - signature_header (str): X-SePay-Signature header value.
    """
    try:
        timestamp = int(timestamp_str)
    except (ValueError, TypeError):
        return False
    
    # Check for replay attack (±300 seconds / 5 minutes) as recommended by SePay best practices & sample code
    if abs(time.time() - timestamp) > 300:
        return False
    
    secret = get_sepay_secret()
    if not secret:
        return False
        
    payload_to_sign = f"{timestamp}.".encode('utf-8') + raw_body
    expected_hash = hmac.new(
        secret.encode('utf-8'),
        payload_to_sign,
        hashlib.sha256
    ).hexdigest()
    
    expected_signature = f"sha256={expected_hash}"
    
    # --- DEBUG LOGS FOR DIAGNOSIS ---
    if os.getenv("DEBUG_SEPAY") == "true":
        print("\n--- SEPAY HMAC DEBUG ---")
        print("1. Raw body:", repr(raw_body))
        print("2. Timestamp:", timestamp_str)
        print("3. Signature Header:", signature_header)
        print("4. Payload to sign:", repr(payload_to_sign))
        print("5. Expected Signature:", expected_signature)
        print("--------------------------\n")
    
    return hmac.compare_digest(expected_signature, signature_header)

def verify_sepay_ip(client_ip: str) -> bool:
    allowed_ips = get_sepay_allowed_ips()
    if os.getenv("DEBUG_SEPAY") == "true":
        print(f"=== IP CHECK: received='{client_ip}', allowed={allowed_ips} ===")
    # If no IPs configured, we might bypass IP check in dev, but for prod should enforce
    if not allowed_ips:
        return True
    return client_ip in allowed_ips

def process_sepay_webhook(db: Session, raw_body: bytes):
    try:
        payload = json.loads(raw_body.decode('utf-8'))
    except json.JSONDecodeError:
        # Invalid JSON
        return {"success": True}

    transaction_id = payload.get("id")
    if not transaction_id:
        return {"success": True}
        
    # Idempotency check: INSERT ... ON CONFLICT DO NOTHING
    # Using SQLAlchemy Core or simple ORM check + insert
    try:
        event = PaymentEvent(
            transaction_id=transaction_id,
            payload=payload,
            status=PaymentEventStatus.RECEIVED
        )
        db.add(event)
        db.commit()
    except IntegrityError:
        # Transaction already exists
        db.rollback()
        event = db.query(PaymentEvent).filter(PaymentEvent.transaction_id == transaction_id).first()
        if not event:
            return {"success": True}
        if event.status in (
            PaymentEventStatus.MATCHED_SUCCESS,
            PaymentEventStatus.UNMATCHED,
            PaymentEventStatus.AMOUNT_MISMATCH,
        ):
            return {"success": True}
        if event.status == PaymentEventStatus.RECEIVED:
            pass
        else:
            return {"success": True}
        
    # Order Matching
    content = payload.get("content", "")
    code = payload.get("code", "")
    content_normalized = normalize(content)
    code_normalized = normalize(code)
    transfer_amount = payload.get("transferAmount", 0)
    transfer_type = payload.get("transferType", "")
    
    # We find pending orders whose order_ref is in content or code
    # Load pending orders and check (or we could use SQL LIKE)
    pending_orders = db.query(PendingOrder).filter(PendingOrder.status == PaymentStatus.PENDING).all()
    
    matched_order = None
    for order in pending_orders:
        ref_normalized = normalize(order.order_ref)
        if ref_normalized in content_normalized or ref_normalized in code_normalized:
            matched_order = order
            break
            
    if not matched_order:
        event.status = PaymentEventStatus.UNMATCHED
        db.commit()
        return {"success": True}
        
    if transfer_type != "in":
        event.status = PaymentEventStatus.UNMATCHED
        db.commit()
        return {"success": True}
        
    # Note: Using numeric type, we need to compare properly.
    if float(transfer_amount) < float(matched_order.amount):
        event.status = PaymentEventStatus.AMOUNT_MISMATCH
        db.commit()
        return {"success": True}
        
    # Database Transaction for business update
    try:
        event.status = PaymentEventStatus.MATCHED_SUCCESS
        matched_order.status = PaymentStatus.COMPLETED
        
        # Update UserAIUsage
        ai_usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == matched_order.user_id).first()
        if not ai_usage:
            ai_usage = UserAIUsage(user_id=matched_order.user_id)
            db.add(ai_usage)
            
        ai_usage.plan = "pro"
        ai_usage.runs_limit = 50
        ai_usage.runs_used = 0
        ai_usage.period_start = datetime.utcnow()
        
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        # Raise 500 to let SePay retry
        raise HTTPException(status_code=500, detail="Internal Server Error")
        
    return {"success": True}
