import os

# Biến môi trường tối thiểu để import app khi chạy test (chỉ dùng cho test)
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-0123456789abcdef")

