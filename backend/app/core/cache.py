"""
cache.py
--------
Wrapper Upstash Redis cho việc cache ProfileResponse JSON.
Key = md5(file_bytes), Value = JSON string, TTL = 24 giờ.

Nếu Redis không kết nối được → log warning và bỏ qua cache (không crash request).
"""

import os
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_TTL = 86400  # 24 giờ


def _get_client():
    """
    Khởi tạo Upstash Redis client từ REDIS_URL.
    Upstash dùng HTTP REST, nên URL có dạng: https://...upstash.io
    Redis local dùng: redis://localhost:6379
    """
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None

    try:
        # Upstash Redis (HTTP REST) — dùng khi deploy
        if redis_url.startswith("https://") or redis_url.startswith("rediss://"):
            from upstash_redis import Redis
            token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
            # Nếu URL dạng https://..., dùng upstash_redis
            return Redis(url=redis_url, token=token)

        # Local Redis (TCP) — dùng khi dev local
        import redis as redis_lib
        return redis_lib.from_url(redis_url, decode_responses=True)

    except Exception as e:
        logger.warning("Không thể khởi tạo Redis client: %s", e)
        return None


def get_profile(file_hash: str) -> dict[str, Any] | None:
    """
    Lấy kết quả profile từ cache.
    Trả về dict nếu có, None nếu cache miss hoặc Redis lỗi.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        raw = client.get(f"profile:{file_hash}")
        if raw is None:
            return None
        # upstash_redis trả về str, redis-py trả về str (decode_responses=True)
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET lỗi: %s", e)
        return None


def set_profile(file_hash: str, data: dict[str, Any], ttl: int = _DEFAULT_TTL) -> None:
    """
    Lưu kết quả profile vào cache với TTL.
    Nếu Redis lỗi → bỏ qua, không crash.
    """
    client = _get_client()
    if client is None:
        return

    try:
        client.set(f"profile:{file_hash}", json.dumps(data), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET lỗi: %s", e)
