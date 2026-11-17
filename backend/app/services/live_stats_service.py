from datetime import datetime, timezone
from typing import Any
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import User, PendingOrder, UserAIUsage, PaymentStatus


def mask_email(email: str | None) -> str:
    """Mask email while preserving first character of local part and the full domain.
    e.g. 'lenhudat218@gmail.com' -> 'l***@gmail.com'
    """
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    first_char = local[0] if local else ""
    return f"{first_char}***@{domain}"


def mask_order_ref(order_ref: str | None) -> str:
    """Mask order_ref to show only last 4 characters preceded by '***'.
    e.g. 'DM-12-ABC12' -> '***BC12', 'ab12' -> '***ab12'
    """
    if not order_ref:
        return "***"
    suffix = order_ref[-4:] if len(order_ref) >= 4 else order_ref
    return f"***{suffix}"


def get_live_stats(db: Session) -> dict[str, Any]:
    # 1. Totals
    users_total = db.query(func.count(User.id)).scalar() or 0
    paying_users = (
        db.query(func.count(func.distinct(PendingOrder.user_id)))
        .filter(PendingOrder.status == PaymentStatus.COMPLETED)
        .scalar() or 0
    )
    transactions_completed = (
        db.query(func.count(PendingOrder.id))
        .filter(PendingOrder.status == PaymentStatus.COMPLETED)
        .scalar() or 0
    )
    revenue_val = (
        db.query(func.coalesce(func.sum(PendingOrder.amount), 0))
        .filter(PendingOrder.status == PaymentStatus.COMPLETED)
        .scalar() or 0
    )
    revenue_total = int(round(float(revenue_val)))

    average_order_value = (
        int(round(revenue_total / transactions_completed))
        if transactions_completed > 0
        else 0
    )
    conversion_rate = (
        round((paying_users / users_total) * 100, 1)
        if users_total > 0
        else 0.0
    )

    totals = {
        "users_total": int(users_total),
        "paying_users": int(paying_users),
        "transactions_completed": int(transactions_completed),
        "revenue_total": revenue_total,
        "average_order_value": average_order_value,
        "conversion_rate": float(conversion_rate),
    }

    # 2. By Channel (utm_source, NULL or empty -> 'direct')
    channel_expr = func.coalesce(
        func.nullif(func.trim(User.utm_source), ""),
        "direct"
    ).label("channel")

    user_channel_rows = (
        db.query(
            channel_expr,
            func.count(User.id).label("user_count")
        )
        .group_by(channel_expr)
        .all()
    )

    order_channel_rows = (
        db.query(
            channel_expr,
            func.count(func.distinct(PendingOrder.user_id)).label("paying_count"),
            func.coalesce(func.sum(PendingOrder.amount), 0).label("revenue_sum")
        )
        .join(PendingOrder, PendingOrder.user_id == User.id)
        .filter(PendingOrder.status == PaymentStatus.COMPLETED)
        .group_by(channel_expr)
        .all()
    )

    channels_dict: dict[str, dict[str, Any]] = {}
    for r in user_channel_rows:
        ch = str(r.channel) if r.channel else "direct"
        channels_dict[ch] = {
            "channel": ch,
            "users": int(r.user_count or 0),
            "paying_users": 0,
            "revenue": 0,
        }

    for r in order_channel_rows:
        ch = str(r.channel) if r.channel else "direct"
        if ch not in channels_dict:
            channels_dict[ch] = {
                "channel": ch,
                "users": 0,
                "paying_users": 0,
                "revenue": 0,
            }
        channels_dict[ch]["paying_users"] = int(r.paying_count or 0)
        channels_dict[ch]["revenue"] = int(round(float(r.revenue_sum or 0)))

    by_channel = sorted(
        channels_dict.values(),
        key=lambda x: x["users"],
        reverse=True
    )[:10]

    # 3. Recent Transactions (up to 50 latest completed orders)
    recent_orders = (
        db.query(
            PendingOrder.amount,
            PendingOrder.updated_at,
            PendingOrder.created_at,
            PendingOrder.order_ref,
            User.email,
            UserAIUsage.plan
        )
        .join(User, PendingOrder.user_id == User.id)
        .outerjoin(UserAIUsage, PendingOrder.user_id == UserAIUsage.user_id)
        .filter(PendingOrder.status == PaymentStatus.COMPLETED)
        .order_by(PendingOrder.updated_at.desc())
        .limit(50)
        .all()
    )

    recent_transactions: list[dict[str, Any]] = []
    for r in recent_orders:
        paid_time = r.updated_at or r.created_at
        paid_at = paid_time.isoformat() if paid_time else ""
        recent_transactions.append({
            "masked_email": mask_email(r.email),
            "plan": str(r.plan) if r.plan else "unknown",
            "amount": int(round(float(r.amount or 0))),
            "paid_at": paid_at,
            "payment_method": "SePay",
            "order_ref_masked": mask_order_ref(r.order_ref),
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": totals,
        "by_channel": by_channel,
        "recent_transactions": recent_transactions,
    }

