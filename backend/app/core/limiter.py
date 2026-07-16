"""
limiter.py
----------
Rate limiter dùng chung cho toàn app (chống brute-force login, spam register,
và lạm dụng các endpoint gọi LLM tốn phí).

LƯU Ý QUAN TRỌNG:
Mặc định dùng bộ nhớ trong tiến trình (in-memory) — CHỈ đúng khi backend chạy
1 instance duy nhất. Nếu Render scale lên nhiều instance, mỗi instance sẽ đếm
rate limit riêng (không dùng chung), làm giới hạn thực tế cao hơn dự kiến
(vd. limit 5/phút với 3 instance ~ thực tế cho phép ~15/phút).

Khi cần scale nhiều instance, đổi storage_uri sang Redis đã có sẵn (REDIS_URL,
dạng redis:// hoặc rediss://) để tất cả instance dùng chung bộ đếm:
    Limiter(key_func=get_remote_address, storage_uri=os.getenv("REDIS_URL"))
Nếu REDIS_URL là dạng Upstash HTTP (https://...), cần đổi sang connection string
TCP (rediss://...) vì slowapi/limits dùng redis-py, không hỗ trợ Upstash REST.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
