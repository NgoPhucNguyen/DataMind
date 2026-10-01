import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models import User, UserAIUsage, PaymentEvent, PendingOrder

def main():
    db = SessionLocal()
    try:
        users = db.execute(select(User)).scalars().all()
        for user in users:
            print(f"User: id={user.id}, email={user.email}, full_name={user.full_name}, tier={user.tier}")
            
            usage = db.execute(select(UserAIUsage).where(UserAIUsage.user_id == user.id)).scalar_one_or_none()
            if usage:
                print(f"  AI Usage: plan={usage.plan}, runs_used={usage.runs_used}, runs_limit={usage.runs_limit}, period_start={usage.period_start}")
            else:
                print("  AI Usage: None")
                
            # Payment events are global, no user_id
            orders = db.execute(select(PendingOrder).where(PendingOrder.user_id == user.id)).scalars().all()
            print(f"  Pending Orders: {len(orders)}")
            for o in orders:
                print(f"    - id={o.id}, amount={o.amount}, status={o.status}, order_ref={o.order_ref}")
        
        print("\n--- ALL PAYMENT EVENTS ---")
        payments = db.execute(select(PaymentEvent)).scalars().all()
        print(f"Total Payment Events: {len(payments)}")
        for p in payments:
            print(f"  - id={p.id}, status={p.status}, tx_id={p.transaction_id}")
            print(f"  Pending Orders: {len(orders)}")
            for o in orders:
                print(f"    - id={o.id}, amount={o.amount}, status={o.status}, order_ref={o.order_ref}")
                
    finally:
        db.close()

if __name__ == "__main__":
    main()
