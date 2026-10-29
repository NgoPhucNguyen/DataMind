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
_FILE_BYTES_TTL = 3600     # 1 giờ (dùng cho session làm sạch và preview)


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

def get_user_context(user_id: int, session_id: str) -> dict | None:
    """
    Lấy context của user từ Redis.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(f"user_context:{user_id, session_id}")
        if raw is None:
            return None
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET user context lỗi: %s", e)
        return None

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

# --- AI Explain Cache (2 Tiers) with Multilingual & Context Hash Support ---

_AI_EXPLAIN_TTL = 2592000  # 30 ngày

def get_ai_explain_original(file_hash: str, chart_type: str, col_x: str, col_y: str, tier: str, lang: str = "vi", context_hash: str = "") -> str | None:
    client = _get_client()
    if client is None: return None
    try:
        col_y_key = col_y if col_y else "none"
        norm_lang = lang if lang in ("vi", "en") else "vi"
        ctx_suffix = f":{context_hash}" if context_hash else ""
        key = f"ai_explain:original:{norm_lang}:{file_hash}:{chart_type}:{col_x}:{col_y_key}:{tier}{ctx_suffix}"
        return client.get(key)
    except Exception as e:
        logger.warning("Redis GET ai_explain_original lỗi: %s", e)
        return None

def set_ai_explain_original(file_hash: str, chart_type: str, col_x: str, col_y: str, tier: str, content: str, lang: str = "vi", context_hash: str = "") -> None:
    client = _get_client()
    if client is None: return
    try:
        col_y_key = col_y if col_y else "none"
        norm_lang = lang if lang in ("vi", "en") else "vi"
        ctx_suffix = f":{context_hash}" if context_hash else ""
        key = f"ai_explain:original:{norm_lang}:{file_hash}:{chart_type}:{col_x}:{col_y_key}:{tier}{ctx_suffix}"
        client.set(key, content, ex=_AI_EXPLAIN_TTL)
    except Exception as e:
        logger.warning("Redis SET ai_explain_original lỗi: %s", e)

def get_ai_explain_edited(user_id: int, file_hash: str, chart_type: str, col_x: str, col_y: str, tier: str, lang: str = "vi", context_hash: str = "") -> dict | str | None:
    """
    Returns dict {"content": str, "context_hash": str} or string if stored simply.
    """
    client = _get_client()
    if client is None: return None
    try:
        col_y_key = col_y if col_y else "none"
        norm_lang = lang if lang in ("vi", "en") else "vi"
        key = f"ai_explain:edited:{norm_lang}:{user_id}:{file_hash}:{chart_type}:{col_x}:{col_y_key}:{tier}"
        raw = client.get(key)
        if raw is None:
            return None
        # Attempt JSON decode
        try:
            data = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
            if isinstance(data, dict) and "content" in data:
                return data
        except Exception:
            pass
        # Fallback to plain string
        return {"content": raw, "context_hash": ""}
    except Exception as e:
        logger.warning("Redis GET ai_explain_edited lỗi: %s", e)
        return None

def set_ai_explain_edited(user_id: int, file_hash: str, chart_type: str, col_x: str, col_y: str, tier: str, content: str, lang: str = "vi", context_hash: str = "") -> None:
    client = _get_client()
    if client is None: return
    try:
        col_y_key = col_y if col_y else "none"
        norm_lang = lang if lang in ("vi", "en") else "vi"
        key = f"ai_explain:edited:{norm_lang}:{user_id}:{file_hash}:{chart_type}:{col_x}:{col_y_key}:{tier}"
        payload = json.dumps({"content": content, "context_hash": context_hash})
        client.set(key, payload, ex=_AI_EXPLAIN_TTL)
    except Exception as e:
        logger.warning("Redis SET ai_explain_edited lỗi: %s", e)

# --- Profiler Context Persistence (24h TTL) ---

def set_profiler_context(user_id: int, file_hash: str, data: dict[str, Any], ttl: int = 86400) -> None:
    """
    Lưu context của Profiler (description, description_source, semantic_context, column_semantics, updated_at).
    TTL 24 giờ — cùng vòng đời với profile.
    """
    client = _get_client()
    if client is None: return
    try:
        key = f"profiler_ctx:{user_id}:{file_hash}"
        client.set(key, json.dumps(data), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET profiler_context lỗi: %s", e)

def get_profiler_context(user_id: int, file_hash: str) -> dict[str, Any] | None:
    """
    Lấy context của Profiler từ Redis (description, description_source, semantic_context, etc.).
    """
    client = _get_client()
    if client is None: return None
    try:
        key = f"profiler_ctx:{user_id}:{file_hash}"
        raw = client.get(key)
        if raw is None: return None
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET profiler_context lỗi: %s", e)
        return None

def set_dataset_context_md(user_id: int, file_hash: str, md_text: str, ttl: int = 86400) -> None:
    """Cache Part 1 markdown, cùng vòng đời với profile."""
    client = _get_client()
    if client is None: return
    try:
        client.set(f"llm_ctx:{user_id}:{file_hash}", md_text, ex=ttl)
    except Exception as e:
        logger.warning("Redis SET dataset context md lỗi: %s", e)

def get_dataset_context_md(user_id: int, file_hash: str) -> str | None:
    """Lấy Part 1 markdown từ cache."""
    client = _get_client()
    if client is None: return None
    try:
        return client.get(f"llm_ctx:{user_id}:{file_hash}")
    except Exception as e:
        logger.warning("Redis GET dataset context md lỗi: %s", e)
        return None

def set_cleaning_log(user_id: int, file_hash: str, log_data: list, ttl: int = 86400) -> None:
    """Lưu cleaning_log vào Redis."""
    client = _get_client()
    if client is None: return
    try:
        client.set(f"cleaning_log:{user_id}:{file_hash}", json.dumps(log_data), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET cleaning_log lỗi: %s", e)

def get_cleaning_log(user_id: int, file_hash: str) -> list | None:
    """Lấy cleaning_log từ Redis."""
    client = _get_client()
    if client is None: return None
    try:
        raw = client.get(f"cleaning_log:{user_id}:{file_hash}")
        if not raw: return None
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET cleaning_log lỗi: %s", e)
        return None

def set_report_section(user_id: int, file_hash: str, section_name: str, data: dict, ttl: int = 86400) -> None:
    """Cập nhật hoặc thêm một section vào report_sections."""
    client = _get_client()
    if client is None: return
    try:
        key = f"report_sections:{user_id}:{file_hash}"
        raw = client.get(key)
        sections = json.loads(raw) if raw and isinstance(raw, str) else json.loads(raw.decode()) if raw else {}
        sections[section_name] = data
        client.set(key, json.dumps(sections), ex=ttl)
    except Exception as e:
        logger.warning("Redis SET report_section lỗi: %s", e)

def get_all_report_sections(user_id: int, file_hash: str) -> dict | None:
    """Lấy toàn bộ các report sections."""
    client = _get_client()
    if client is None: return None
    try:
        raw = client.get(f"report_sections:{user_id}:{file_hash}")
        if not raw: return None
        return json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
    except Exception as e:
        logger.warning("Redis GET report_sections lỗi: %s", e)
        return None

def invalidate_downstream_state(user_id: int, file_hash: str) -> None:
    """Xóa hoặc làm cũ các state phụ thuộc vào dataset khi user quay lại bước làm sạch."""
    client = _get_client()
    if client is None: return
    try:
        # Xóa phần visualize trong report_sections vì biểu đồ cũ không còn đúng với dữ liệu mới
        key = f"report_sections:{user_id}:{file_hash}"
        raw = client.get(key)
        if raw:
            sections = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
            if "visualize" in sections:
                sections.pop("visualize", None)
                client.set(key, json.dumps(sections), ex=86400)
        
        logger.info(f"Invalidated downstream states for user={user_id}, file_hash={file_hash}")
    except Exception as e:
        logger.warning("Redis invalidate downstream state lỗi: %s", e)

def check_active_session(user_id: int, file_hash: str) -> bool:
    """
    Check if user is processing a different file.
    Returns True if allowed (same file or no active session), False if blocked.
    Fails safe (returns True) if Redis errors out.
    """
    client = _get_client()
    if client is None: return True
    try:
        active = client.get(f"active_session:{user_id}")
        if active and active != file_hash:
            return False
        return True
    except Exception as e:
        logger.error(f"Redis GET active_session error: {e}")
        return True

def set_active_session(user_id: int, file_hash: str) -> None:
    """
    Sets or refreshes the active session TTL for 10 minutes (600s).
    """
    client = _get_client()
    if client is None: return
    try:
        client.set(f"active_session:{user_id}", file_hash, ex=600)
    except Exception as e:
        logger.error(f"Redis SET active_session error: {e}")

def clear_active_session(user_id: int) -> None:
    """
    Clears the active session lock explicitly.
    """
    client = _get_client()
    if client is None: return
    try:
        client.delete(f"active_session:{user_id}")
    except Exception as e:
        logger.error(f"Redis DELETE active_session error: {e}")
