"""
cache.py
--------
Wrapper Upstash Redis cho việc cache ProfileResponse JSON và raw file bytes.

Keys:
  - "profile:{file_hash}"      → JSON string, TTL 24h
  - "filebytes:{file_hash}"    → base64-encoded bytes, TTL 1h

Nếu Redis không kết nối được → log warning và bỏ qua cache (không crash request).
"""

import os
import json
import base64
import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_TTL = 86400       # 24 giờ
_FILE_BYTES_TTL = 3600     # 1 giờ — đủ cho session làm sạch


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


def delete_profile(file_hash: str) -> None:
    """
    Xóa kết quả profile khỏi cache.
    Dùng khi force_refresh — xóa trước, tính toán lại, rồi lưu mới.
    """
    client = _get_client()
    if client is None:
        return
    try:
        client.delete(f"profile:{file_hash}")
        logger.info("Deleted cached profile: %s", file_hash)
    except Exception as e:
        logger.warning("Redis DELETE lỗi: %s", e)


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


def set_file_bytes(file_hash: str, content: bytes, filename: str, ext: str) -> None:
    """
    Lưu raw file bytes vào Redis (base64-encoded) kèm metadata.
    TTL 1 giờ — đủ dùng cho session làm sạch.
    Nếu Redis lỗi → bỏ qua, không crash.
    """
    client = _get_client()
    if client is None:
        return
    try:
        payload = json.dumps({
            "bytes_b64": base64.b64encode(content).decode(),
            "filename": filename,
            "ext": ext,
        })
        client.set(f"filebytes:{file_hash}", payload, ex=_FILE_BYTES_TTL)
        logger.debug("Cached file bytes: hash=%s size=%d", file_hash, len(content))
    except Exception as e:
        logger.warning("Redis SET file bytes lỗi: %s", e)


def get_file_bytes(file_hash: str) -> dict | None:
    """
    Lấy raw file bytes từ cache.
    Trả về {"bytes": bytes, "filename": str, "ext": str} hoặc None nếu miss.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(f"filebytes:{file_hash}")
        if raw is None:
            return None
        payload = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
        return {
            "bytes": base64.b64decode(payload["bytes_b64"]),
            "filename": payload["filename"],
            "ext": payload["ext"],
        }
    except Exception as e:
        logger.warning("Redis GET file bytes lỗi: %s", e)
        return None
