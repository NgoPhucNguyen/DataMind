# Tiến độ triển khai hạn mức AI theo ngày (Free = 3 lượt/ngày, Pro = 20 lượt/ngày)

## Mục tiêu
- Free: 3 lượt AI/ngày
- Pro: 20 lượt AI/ngày, hạn 30 ngày, giá 50.000đ
- Lượt reset 00:00 giờ Việt Nam (UTC+7)
- Khi Pro hết hạn tự động hạ về Free và thông báo cho user
- Không in/lộ secret nào

---

## Trạng thái các giai đoạn

- [x] **GIAI ĐOẠN 1**: Hằng số và model (backend) - **Hoàn thành**
  - File: `backend/app/services/ai_usage_service.py` (định nghĩa `FREE_DAILY_RUNS = 3`, `PRO_DAILY_RUNS = 20`, `PRO_DURATION_DAYS = 30`, `VN_TZ = timezone(timedelta(hours=7))`, `today_vn()`).
  - File: `backend/app/models/__init__.py` (thêm `Date`, `FREE_DAILY_RUNS`, `pro_expires_at`, `runs_reset_date`, default `runs_limit=FREE_DAILY_RUNS`).
  - File: `backend/app/services/sepay_service.py` (thay `50` bằng `PRO_DAILY_RUNS`).

- [x] **GIAI ĐOẠN 2**: Migration viết tay (alembic) - **Hoàn thành**
  - File: `backend/migrations/versions/9f1a2b3c4d5e_add_pro_expires_at_and_runs_reset_date.py` (down_revision = `'8d4b85caaeb2'`).
  - Thao tác: add 2 column `pro_expires_at` (DateTime), `runs_reset_date` (Date).
  - Đã kiểm tra `alembic heads` -> đúng 1 head (`9f1a2b3c4d5e (head)`). Không chạy upgrade lên Supabase.

- [x] **GIAI ĐOẠN 3**: Logic hạn mức, refresh_usage, with_for_update và webhook (backend) - **Hoàn thành**
  - File: `backend/app/services/ai_usage_service.py` (hàm `refresh_usage` xử lý hết hạn Pro -> Free, reset ngày mới -> `runs_used=0`; `check_ai_quota` và `record_ai_usage` dùng `with_for_update`, gọi `refresh_usage` và commit; thông báo 402 dùng f-string với hằng số).
  - File: `backend/app/services/sepay_service.py` (cộng dồn 30 ngày nếu Pro còn hạn, reset lượt về 0, runs_limit = PRO_DAILY_RUNS, runs_reset_date = today_vn, bỏ period_start, dùng `with_for_update`).
  - File: `backend/app/routers/auth.py` (`get_my_subscription` dùng `with_for_update`, gọi `refresh_usage` + commit, trả `pro_expires_at` ISO 8601 UTC có đuôi `Z`).
  - File: `backend/app/services/subscription_service.py` (hàm `is_pro` gọi `refresh_usage`).
  - File: `backend/app/routers/payments.py` (amount đọc từ `PRO_PRICE_VND`, mặc định `50000`).

- [x] **GIAI ĐOẠN 4**: Frontend UI (plans.js, Landing, Pricing, Subscription, Banner hết hạn, UpgradeModal) - **Hoàn thành**
  - File: `frontend/src/lib/plans.js` (`free.aiRuns = 3`, `pro.aiRuns = 20`, `PRO_DURATION_DAYS = 30`, "50.000đ / 30 ngày", ghi rõ reset 00:00 VN).
  - File: `frontend/src/pages/Pricing.jsx` (cập nhật thông tin gói, nút "Gia hạn thêm 30 ngày" cho user Pro).
  - File: `frontend/src/pages/Subscription.jsx` (hiển thị số lượt dùng hôm nay `X/20` hoặc `X/3` từ API, ngày hết hạn và số ngày còn lại, cảnh báo sắp hết hạn `<= 3 ngày`).
  - File: `frontend/src/components/ExpiredProBanner.jsx` (Banner trong `DashboardLayout` hiển thị khi gói Pro hết hạn trong quá khứ, hỗ trợ tắt lưu `localStorage` bọc `try/catch`).
  - File: `frontend/src/components/UpgradeModal.jsx` (nếu đang là Pro còn hạn, hiển thị gia hạn thêm 30 ngày và tính ngày hết hạn mới = hạn hiện tại + 30 ngày).
  - File: `frontend/src/pages/LandingPage.jsx` và `frontend/src/pages/Docs.jsx` (đồng bộ hoàn toàn thông tin định mức mới).

- [x] **GIAI ĐOẠN 5**: Kiểm tra, Test suite, Build check và Grep báo cáo - **Hoàn thành**
  - Python import: `python -c "import app.main"` -> thành công.
  - Alembic heads: `9f1a2b3c4d5e (head)` -> duy nhất 1 head.
  - Test suite `backend/test_sepay_webhook.py`: đã thêm test cho `refresh_usage` (Pro hết hạn -> Free, sang ngày mới -> reset lượt về 0) và webhook cộng dồn 30 ngày.
  - Grep kiểm tra toàn bộ `backend` và `frontend/src`:
    - "50 lượt": 0 kết quả
    - "2 lượt": 0 kết quả
    - "runs_limit = 50": 0 kết quả
    - "= 2": 0 chỗ hardcode hạn mức
    - "credit": 0 kết quả
    - "wallet": 0 kết quả
