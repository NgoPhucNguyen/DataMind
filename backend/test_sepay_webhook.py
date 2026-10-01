import os
import json
import time
import hmac
import hashlib
from unittest import mock
from sqlalchemy.exc import SQLAlchemyError

# Set environments BEFORE importing app and settings so they take effect
os.environ["SEPAY_WEBHOOK_SECRET"] = "test_secret_key"
os.environ["SEPAY_ALLOWED_IPS"] = "127.0.0.1,::1,testclient,192.168.1.100"
os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/datamind_local"

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import PaymentEvent, PendingOrder, UserAIUsage, PaymentStatus, PaymentEventStatus, User

client = TestClient(app)

def generate_signature(payload_bytes: bytes, timestamp: int, secret: str) -> str:
    payload_to_sign = f"{timestamp}.".encode('utf-8') + payload_bytes
    return "sha256=" + hmac.new(
        secret.encode('utf-8'),
        payload_to_sign,
        hashlib.sha256
    ).hexdigest()

def test_sepay_webhook():
    print("Testing SePay Webhook Endpoint...")
    db = SessionLocal()
    
    # --- Prepare Test Environment ---
    # 1. Ensure user exists
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, full_name="Test User", email="test_sepay@example.com")
        db.add(user)
        db.commit()

    # 2. Clean up previous test data
    db.query(PaymentEvent).filter(PaymentEvent.transaction_id.in_([999999, 999998, 999997, 999996])).delete()
    db.query(PendingOrder).filter(PendingOrder.order_ref.in_(["DM-TEST-123456", "DM-TEST-MISMATCH", "DM-TEST-ERROR"])).delete()
    
    # 3. Setup UserAIUsage to default state
    user_usage = db.query(UserAIUsage).filter(UserAIUsage.user_id == 1).first()
    if user_usage:
        user_usage.plan = 'free'
        user_usage.runs_limit = 10
        user_usage.runs_used = 5
    else:
        db.add(UserAIUsage(user_id=1, plan='free', runs_limit=10, runs_used=5))
    db.commit()

    # 4. Setup Pending Orders
    order1 = PendingOrder(user_id=1, order_ref="DM-TEST-123456", amount=500000, status=PaymentStatus.PENDING)
    order2 = PendingOrder(user_id=1, order_ref="DM-TEST-MISMATCH", amount=500000, status=PaymentStatus.PENDING)
    order3 = PendingOrder(user_id=1, order_ref="DM-TEST-ERROR", amount=500000, status=PaymentStatus.PENDING)
    db.add_all([order1, order2, order3])
    db.commit()

    def make_request(payload, secret="test_secret_key", client_ip="127.0.0.1", offset_time=0):
        payload_bytes = json.dumps(payload).encode('utf-8')
        timestamp = int(time.time()) + offset_time
        signature = generate_signature(payload_bytes, timestamp, secret)
        headers = {
            "X-SePay-Timestamp": str(timestamp),
            "X-SePay-Signature": signature,
            "Content-Type": "application/json",
            "X-Forwarded-For": client_ip
        }
        return client.post("/api/v1/payments/sepay-webhook", content=payload_bytes, headers=headers)

    # ==========================================
    # TEST 1: Valid Request (matched_success)
    # ==========================================
    print("1. Testing Valid Request (matched_success)...")
    payload1 = {
        "id": 999999,
        "gateway": "vietqr",
        "transactionDate": "2023-10-10 10:10:10",
        "accountNumber": "123456789",
        "code": "test code",
        "content": "Thanh toan DM-TEST-123456",
        "transferType": "in",
        "transferAmount": 500000,
        "accumulated": 1000000,
        "referenceCode": "ref123"
    }
    resp1 = make_request(payload1)
    assert resp1.status_code == 200, f"Expected 200, got {resp1.status_code}. Response: {resp1.json()}"
    assert resp1.json() == {"success": True}
    
    # Assert DB updates
    db.expire_all()
    usage1 = db.query(UserAIUsage).filter(UserAIUsage.user_id == 1).first()
    assert usage1.plan == 'pro', f"Plan should be upgraded to pro, got {usage1.plan}"
    assert usage1.runs_limit == 50, "Limit should be 50"
    assert usage1.runs_used == 0, "Runs used should be reset to 0"
    
    event1 = db.query(PaymentEvent).filter(PaymentEvent.transaction_id == 999999).first()
    assert event1.status == PaymentEventStatus.MATCHED_SUCCESS
    print("✓ Valid request processed successfully & DB upgraded correctly")

    # ==========================================
    # TEST 2: Idempotency (Duplicate Request)
    # ==========================================
    print("2. Testing Idempotency (Duplicate Request)...")
    resp2 = make_request(payload1)
    assert resp2.status_code == 200
    assert resp2.json() == {"success": True}
    events_count = db.query(PaymentEvent).filter(PaymentEvent.transaction_id == 999999).count()
    assert events_count == 1
    print("✓ Idempotency works (no duplicate insertions)")

    # ==========================================
    # TEST 3: Unmatched Request
    # ==========================================
    print("3. Testing Unmatched...")
    payload3 = {
        "id": 999998,
        "gateway": "vietqr",
        "transactionDate": "2023-10-10 10:10:10",
        "accountNumber": "123456789",
        "code": "test code",
        "content": "Thanh toan ma DM-TEST-INVALID",
        "transferType": "in",
        "transferAmount": 500000,
        "accumulated": 1500000,
        "referenceCode": "ref124"
    }
    # Reset usage to free to verify it stays free
    usage1 = db.query(UserAIUsage).filter(UserAIUsage.user_id == 1).first()
    usage1.plan = 'free'
    db.commit()

    resp3 = make_request(payload3)
    assert resp3.status_code == 200
    assert resp3.json() == {"success": True}
    
    db.expire_all()
    event3 = db.query(PaymentEvent).filter(PaymentEvent.transaction_id == 999998).first()
    assert event3.status == PaymentEventStatus.UNMATCHED
    usage3 = db.query(UserAIUsage).filter(UserAIUsage.user_id == 1).first()
    assert usage3.plan == 'free', "Plan should remain free on unmatched"
    print("✓ Unmatched handled correctly")

    # ==========================================
    # TEST 4: Amount Mismatch
    # ==========================================
    print("4. Testing Amount Mismatch...")
    payload4 = {
        "id": 999997,
        "gateway": "vietqr",
        "transactionDate": "2023-10-10 10:10:10",
        "accountNumber": "123456789",
        "code": "test code",
        "content": "Thanh toan DM-TEST-MISMATCH",
        "transferType": "in",
        "transferAmount": 100000, # Missing 400000
        "accumulated": 1600000,
        "referenceCode": "ref125"
    }
    resp4 = make_request(payload4)
    assert resp4.status_code == 200
    assert resp4.json() == {"success": True}
    
    db.expire_all()
    event4 = db.query(PaymentEvent).filter(PaymentEvent.transaction_id == 999997).first()
    assert event4.status == PaymentEventStatus.AMOUNT_MISMATCH
    usage4 = db.query(UserAIUsage).filter(UserAIUsage.user_id == 1).first()
    assert usage4.plan == 'free', "Plan should remain free on amount mismatch"
    print("✓ Amount mismatch handled correctly")

    # ==========================================
    # TEST 5: DB Rollback on Error
    # ==========================================
    print("5. Testing DB Rollback on Error...")
    payload5 = {
        "id": 999996,
        "gateway": "vietqr",
        "transactionDate": "2023-10-10 10:10:10",
        "accountNumber": "123456789",
        "code": "test code",
        "content": "Thanh toan DM-TEST-ERROR",
        "transferType": "in",
        "transferAmount": 500000,
        "accumulated": 2100000,
        "referenceCode": "ref126"
    }
    
    # Need to catch 500 from TestClient
    client_500 = TestClient(app, raise_server_exceptions=False)
    
    def make_request_500(payload, secret="test_secret_key", client_ip="127.0.0.1", offset_time=0):
        payload_bytes = json.dumps(payload).encode('utf-8')
        timestamp = int(time.time()) + offset_time
        signature = generate_signature(payload_bytes, timestamp, secret)
        headers = {
            "X-SePay-Timestamp": str(timestamp),
            "X-SePay-Signature": signature,
            "Content-Type": "application/json",
            "X-Forwarded-For": client_ip
        }
        return client_500.post("/api/v1/payments/sepay-webhook", content=payload_bytes, headers=headers)

    # Mocking commit to throw an error on the second call (the business update commit)
    original_commit = db.commit
    commit_calls = 0
    def mock_commit(*args, **kwargs):
        nonlocal commit_calls
        commit_calls += 1
        if commit_calls == 2:
            raise SQLAlchemyError("DB Error mock")
        return original_commit(*args, **kwargs)

    with mock.patch('sqlalchemy.orm.Session.commit', side_effect=mock_commit):
        resp5 = make_request_500(payload5)
        assert resp5.status_code == 500, f"Should return 500 on DB exception, got {resp5.status_code}"
    
    db.expire_all()
    order_error = db.query(PendingOrder).filter(PendingOrder.order_ref == "DM-TEST-ERROR").first()
    assert order_error.status == PaymentStatus.PENDING, "Order status should be rolled back to pending"
    print("✓ Rollback on DB error handled correctly")

    # ==========================================
    # TEST 6: IP Whitelist
    # ==========================================
    print("6. Testing IP Whitelist...")
    # TestClient always uses 'testclient' as the client IP, so we mock the allowed IPs to exclude it
    with mock.patch('app.services.sepay_service.get_sepay_allowed_ips', return_value=['127.0.0.1', '::1']):
        resp6 = make_request(payload4)
        assert resp6.status_code == 401, f"Expected 401, got {resp6.status_code}"
        assert resp6.json()["detail"] == "Unauthorized IP"
    print("✓ Unauthorized IP blocked")

    # ==========================================
    # TEST 7: Invalid Signature
    # ==========================================
    print("7. Testing Invalid Signature...")
    resp7 = make_request(payload4, secret="wrong_secret")
    assert resp7.status_code == 401
    assert resp7.json()["detail"] == "Invalid signature"
    print("✓ Invalid signature rejected")

    # ==========================================
    # TEST 8: Replay Attack (Old Timestamp)
    # ==========================================
    print("8. Testing Replay Attack...")
    resp8 = make_request(payload4, offset_time=-400)
    assert resp8.status_code == 401
    assert resp8.json()["detail"] == "Invalid signature"
    print("✓ Replay attack blocked (timestamp check works)")

    # --- Clean up after success ---
    db.query(PaymentEvent).filter(PaymentEvent.transaction_id.in_([999999, 999998, 999997, 999996])).delete()
    db.query(PendingOrder).filter(PendingOrder.order_ref.in_(["DM-TEST-123456", "DM-TEST-MISMATCH", "DM-TEST-ERROR"])).delete()
    db.commit()
    db.close()
    print("All tests passed successfully!")

if __name__ == "__main__":
    test_sepay_webhook()
