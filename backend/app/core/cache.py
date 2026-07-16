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
_FILE_BYTES_TTL = 3600 #test 5p     # 1 giờ — đủ cho session làm sạch


def _get_client():
    """
    Khởi tạo Redis client từ REDIS_URL.

    Hỗ trợ 3 dạng URL:
      - https://...   → Upstash HTTP REST (upstash_redis)
      - rediss://...  → Upstash TCP with SSL (redis-py, production trên Render)
      - redis://...   → Local Redis TCP (redis-py, dev local)
    """
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None

    try:
        if redis_url.startswith("https://"):
            # Upstash Redis (HTTP REST)
            from upstash_redis import Redis
            token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
            return Redis(url=redis_url, token=token)

        if redis_url.startswith("rediss://"):
            # Upstash TCP with SSL (production) — cần ssl_cert_reqs=None
            import redis as redis_lib
            return redis_lib.from_url(
                redis_url,
                decode_responses=True,
                ssl_cert_reqs=None,
            )

        # Local Redis (TCP, không SSL)
        import redis as redis_lib
        return redis_lib.from_url(redis_url, decode_responses=True)

    except Exception as e:
        logger.warning("Không thể khởi tạo Redis client: %s", e)
        return None

def _scope(user_id, key: str) -> str:
    if user_id is None:
        raise ValueError("user_id là bắt buộc khi truy cập cache.")
    return f"u{user_id}:{key}"


def get_profile(user_id: int,file_hash: str) -> dict[str, Any] | None:
    """
    Lấy kết quả profile từ cache.
    Trả về dict nếu có, None nếu cache miss hoặc Redis lỗi.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        raw = client.get(f"profile:{user_id, file_hash}")
        if raw is None:
            return None
        # upstash_redis trả về str, redis-py trả về str (decode_responses=True)
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET lỗi: %s", e)
        return None


def delete_profile(user_id: int,file_hash: str) -> None:
    """
    Xóa kết quả profile khỏi cache.
    Dùng khi force_refresh — xóa trước, tính toán lại, rồi lưu mới.
    """
    client = _get_client()
    if client is None:
        return
    try:
        client.delete(f"profile:{user_id, file_hash}")
        logger.info("Deleted cached profile: %s", file_hash)
    except Exception as e:
        logger.warning("Redis DELETE lỗi: %s", e)


def set_profile(user_id: int,file_hash: str, data: dict[str, Any], ttl: int = _DEFAULT_TTL) -> None:
    """
    Lưu kết quả profile vào cache với TTL.
    Nếu Redis lỗi → bỏ qua, không crash.
    """
    client = _get_client()
    if client is None:
        return

    try:
        client.set(f"profile:{user_id, file_hash}", json.dumps(data), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET lỗi: %s", e)


def set_file_bytes(user_id: int,file_hash: str, content: bytes, filename: str, ext: str) -> None:
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
        client.set(f"filebytes:{user_id, file_hash}", payload, ex=_FILE_BYTES_TTL)
        logger.debug("Cached file bytes: hash=%s size=%d", file_hash, len(content))
    except Exception as e:
        logger.warning("Redis SET file bytes lỗi: %s", e)


def get_file_bytes(user_id: int,file_hash: str) -> dict | None:
    """
    Lấy raw file bytes từ cache.
    Trả về {"bytes": bytes, "filename": str, "ext": str} hoặc None nếu miss.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(f"filebytes:{user_id, file_hash}")
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

def set_user_context(user_id: int,session_id: str, description: str, purpose: str) -> None:
    """
    Lưu context của user (description, purpose) vào Redis.
    TTL 1 giờ.
    """
    client = _get_client()
    if client is None:
        return
    try:
        payload = json.dumps({"description": description, "purpose": purpose})
        client.set(f"user_context:{user_id, session_id}", payload, ex=3600)
    except Exception as e:
        logger.warning("Redis SET user context lỗi: %s", e)

def set_session_metadata(user_id: int,session_id: str, metadata: dict[str, Any], ttl: int = _FILE_BYTES_TTL) -> None:
    """
    Lưu metadata của session vào Redis (ví dụ: schema, loại cột lấy từ Profiler).
    TTL mặc định 1 giờ.
    """
    client = _get_client()
    if client is None:
        return
    try:
        payload = json.dumps(metadata)
        client.set(f"session_metadata:{user_id, session_id}", payload, ex=ttl)
        logger.debug("Cached session metadata: session_id=%s", session_id)
    except Exception as e:
        logger.warning("Redis SET session metadata lỗi: %s", e)

def get_session_metadata(user_id: int,session_id: str) -> dict[str, Any] | None:
    """
    Lấy metadata của session từ Redis.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(f"session_metadata:{user_id, session_id}")
        if raw is None:
            return None
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET session metadata lỗi: %s", e)
