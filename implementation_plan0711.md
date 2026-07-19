# AI Explain Chart - Design Document (Updated v2)

Tài liệu thiết kế tính năng "AI Explain Chart", tập trung chi tiết vào Phase 1 (triển khai ngay) và định hướng ngắn gọn cho Phase 2 theo các quyết định mới nhất.

> [!IMPORTANT]
> ## Cần xác nhận trước / Hướng dẫn cho Engineer (Claude)
> Dưới đây là các định hướng liên quan đến hệ thống Credit và môi trường (Environment), dành cho Engineer (Claude) khi thực thi:
> 1. **Chi phí Credit**: Hiện tại hệ thống `CreditsWallet` cấp mặc định `100000` balance. Khi thực thi Phase 1, hãy cấu hình/định nghĩa một hằng số (ví dụ `AI_EXPLAIN_COST = 500`) trong config hoặc constants.
> 2. **Tên biến Môi trường (ENV)**: Trong codebase backend (FastAPI), hãy sử dụng một biến môi trường chuẩn như `APP_ENV` hoặc `ENVIRONMENT`. 
>    - Khi `APP_ENV=development` hoặc `APP_ENV=local`: bypass hoàn toàn việc check và trừ credit.
>    - Khi `APP_ENV=production`: bắt buộc check balance qua `CreditsWallet` và ghi log `CreditTransaction` (`TransactionType.DEBIT`).

## Phase 1: Triển khai ngay (Chi tiết)

### 1. Phân lớp Giải thích (Tiers)
#### 1.1. "Explain" tự động (Tier 0 - Không LLM)
- **Cơ chế**: Miễn phí, hiển thị ngay trên UI khi xem chart mà không cần user thao tác bấm nút.
- **Nguồn dữ liệu**: Tái sử dụng và mở rộng hệ thống `auto_insights` đã có sẵn. Không gọi Gemini API.
- **Mục tiêu**: Cung cấp ngay các mô tả số liệu thuần túy (ví dụ: "Đỉnh phân phối ở mức...", "Có 5% dữ liệu null").

#### 1.2. "Explain by AI" (Tier 1 - LLM)
- **Cơ chế**: Phải bấm nút thủ công. Áp dụng cho cả 7 loại chart. Trừ Credit người dùng.
- **Prompt Design (Data Analyst Persona)**:
  - System Prompt sẽ được cấu trúc để hướng dẫn LLM đóng vai trò một chuyên viên phân tích dữ liệu thực thụ.
  - **Khả năng suy luận**: Khuyến khích LLM dùng kiến thức nền ngoài dataset để đưa ra giả thuyết hợp lý. Ví dụ: "Dựa vào xu hướng tăng của cột Giá Vé vào tháng 6-8, có khả năng do nhu cầu du lịch mùa hè".
  - **Disclaimer**: Bắt buộc gắn disclaimer rõ ràng: *"Đây là suy đoán phân tích từ AI dựa trên bối cảnh, không phải kết luận chắc chắn."*

#### 1.3. Gợi ý tương quan (Tier 1.5 - Thuần số học, Không LLM)
- **Cơ chế**: Miễn phí, tự động tính toán và gợi ý các cột có liên hệ.
- **Thuật toán**:
  - **Cột Số (Numerical)**: Dùng Pearson correlation (đã có ở ma trận tương quan), lấy ngưỡng `|r| > 0.5`.
  - **Cột Phân loại (Categorical)**: Tính toán bổ sung chỉ số **Cramér's V** tại backend (dựa trên contingency table + chi-square), lấy ngưỡng `V > 0.3`.
  - **Hiển thị**: Lấy **Top 3** cột có độ liên kết mạnh nhất để gợi ý.

---

### 2. Quản lý Credits & Bypass Environment
Sử dụng hoàn toàn luồng **Credits Wallet** đã có sẵn (`app.models.CreditsWallet`, `app.models.CreditTransaction`) thông qua cơ sở dữ liệu.

#### 2.1 Logic Trừ Credit (Hướng dẫn chi tiết)
- **Cấu trúc hiện tại**: Mỗi user có một `CreditsWallet` lưu `balance` (mặc định 100,000 credit bonus). Bảng `CreditTransaction` lưu log gồm `user_id`, `amount`, `type`, `description`.
- **Workflow gọi API `/visualize/explain`**:
  - Truy vấn `CreditsWallet` của user hiện tại.
  - So sánh `wallet.balance` với `AI_EXPLAIN_COST` (ví dụ 500).
  - Đủ số dư: Gọi Gemini. Sau khi thành công, trừ `balance` và `db.add(CreditTransaction(..., type=TransactionType.DEBIT, amount=AI_EXPLAIN_COST))`.
  - Không đủ số dư: Trả về HTTP `402 Payment Required` (hoặc custom `400`).

#### 2.2 Cơ chế Bypass (Development)
- Đọc biến môi trường (ví dụ `os.getenv("APP_ENV")`).
- Nếu ứng dụng chạy ở môi trường `development` / `local`: **Tắt hoàn toàn** luồng check số dư ở bước 2.1.
- Nếu ở Production: Bắt buộc áp dụng rule chặt chẽ, báo lỗi rõ ràng nếu user hết credit. UI sẽ bắt lỗi này để hiện thông báo lịch sự, có tính hướng dẫn giáo dục user.

---

### 3. Thiết kế Cache (Redis) Phân tầng
Hệ thống Cache sử dụng chung **TTL dài (30 ngày)** và được thiết kế 2 tầng tách bạch để đảm bảo tính an toàn dữ liệu và tối ưu chi phí (Phase Generate Report `/report/intro` có thể tái sử dụng trực tiếp cấu trúc này):

#### 3.1 Tầng 1: `original_content` (Bản gốc sinh bởi AI)
- **Phạm vi**: **Shared (Dùng chung)**. Cache này dựa trên `file_hash` nên mọi user upload cùng 1 tệp dữ liệu (hoặc xem 1 dashboard chia sẻ) đều được tái sử dụng, giúp tiết kiệm đáng kể credit và API call. Hoàn toàn an toàn do không chứa thông tin user.
- **Key Pattern**: `ai_explain:original:{file_hash}:{chart_type}:{col_x}:{col_y}:{tier}`
  - *(Lưu ý: `col_x`, `col_y` luôn được sort bảng chữ cái với các Tier 1.5 và Tier 2)*.

#### 3.2 Tầng 2: `edited_content` (Bản do user sửa)
- **Phạm vi**: **Private (Cá nhân)**. Chỉnh sửa của người này không đè lên của người khác.
- **Key Pattern**: `ai_explain:edited:{user_id}:{file_hash}:{chart_type}:{col_x}:{col_y}:{tier}`

---

### 4. Thiết kế UI/UX (Edit Card & Badge)
- **Vị trí**: Card nổi hiển thị bên dưới chart, có thể toggle thu gọn/mở rộng.
- **Chỉnh sửa**: Hỗ trợ Inline-edit trực tiếp vào văn bản của AI giải thích. Khi user bấm lưu, API sẽ gọi backend để lưu vào Tầng Cache 2 (`edited_content`).
- **Gắn nhãn (Badge)**: 
  - Khi xem bản gốc: Hiện badge xám *"Tạo bởi AI"*.
  - Khi xem bản sửa: Hiện badge nổi *"Đã chỉnh sửa bởi bạn"*.
- Có nút toggle để user xem lại và so sánh giữa bản gốc và bản tự sửa bất kỳ lúc nào.

---

## Phase 2: Định hướng Tương lai (Không đi sâu)
- **Tier 1.5 "AI"**: Không chỉ gợi ý bằng số học, AI sẽ quét toàn bộ dataset context để gợi ý các **liên kết chéo giữa các chart khác loại** (vd: so sánh Bar chart với Pie chart vì có ý nghĩa business logic chung).
- **Tier 2 Mở rộng**: AI giải thích chi tiết cho các mối liên kết chéo chart này.
- **Feature Gating**: Có thể tiếp tục dùng chung hệ thống Credits hoặc áp dụng Check Gói Cước (Pro Plan) để phân cấp người dùng.

---

## 5. Cơ chế Feature Flag theo tài khoản (Account Whitelist)

> [!IMPORTANT]
> Mục này bổ sung để cho phép bật tính năng **AI Insights** có kiểm soát trên Production — phục vụ việc test nội bộ trước khi mở rộng cho toàn bộ user. Áp dụng cho mọi tier có gọi Gemini (Tier 1 và Tier 2 sau này).

### 5.1 Schema

Thêm cột `ai_insights_enabled` vào model `User` trong [\_\_init\_\_.py](file:///d:/datamind_prod/backend/app/models/__init__.py):

```python
class User(Base):
    __tablename__ = "users"

    # ... các cột hiện tại giữ nguyên ...

    ai_insights_enabled = Column(Boolean, default=False, nullable=False)
```

- **Mặc định `False`** cho mọi user mới đăng ký — không cần sửa gì ở `POST /auth/register` vì `default=False` đã tự áp dụng ở tầng DB/model.
- Cần thêm `Boolean` vào dòng import nếu chưa có:
  ```python
  from sqlalchemy import ..., Boolean
  ```

---

### 5.2 Migration

Vì bảng `users` trên Supabase **đã có dữ liệu thật**, cần thực hiện migration cẩn thận:

#### 5.2.1 SQL thủ công (chạy qua Supabase SQL Editor)

```sql
ALTER TABLE users ADD COLUMN ai_insights_enabled BOOLEAN NOT NULL DEFAULT false;
```

#### 5.2.2 Alembic migration

> [!NOTE]
> Dự án đang dùng Alembic (thư mục `backend/migrations/`). Cần tạo file migration tương ứng để giữ đồng bộ giữa code và DB schema.

Tạo file migration mới (ví dụ `migrations/versions/xxxx_add_ai_insights_enabled.py`):

```python
"""add ai_insights_enabled to users

Revision ID: <auto-generate>
Revises: <revision trước đó>
Create Date: <auto>
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "<auto-generate>"
down_revision = "<revision trước đó>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ai_insights_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "ai_insights_enabled")
```

> [!WARNING]
> **Trên Production (Supabase)**: Nên chạy câu SQL ở mục 5.2.1 trực tiếp qua SQL Editor. Sau đó đánh dấu migration đã áp dụng bằng `alembic stamp head` để tránh conflict. Không chạy `alembic upgrade head` trực tiếp trên prod DB nếu chưa review kỹ.

---

### 5.3 Thứ tự kiểm tra tại endpoint `/visualize/explain`

Áp dụng cho mọi tier có gọi Gemini (Tier 1 hiện tại và Tier 2 trong tương lai). Luồng kiểm tra theo **đúng thứ tự** sau:

```
┌─────────────────────────────────────────────────────────┐
│  Request đến /visualize/explain                         │
├─────────────────────────────────────────────────────────┤
│  Bước 1: Đọc APP_ENV                                   │
│  ├─ development / local → BYPASS bước 2 & 3 → Gọi AI  │
│  └─ production → Tiếp bước 2                           │
├─────────────────────────────────────────────────────────┤
│  Bước 2: Check Feature Flag                            │
│  ├─ current_user.ai_insights_enabled == True → Bước 3  │
│  └─ False → 403 Forbidden                              │
├─────────────────────────────────────────────────────────┤
│  Bước 3: Check Credits                                 │
│  ├─ wallet.balance >= AI_EXPLAIN_COST → Gọi AI + Trừ  │
│  └─ Không đủ → 402 Payment Required                    │
└─────────────────────────────────────────────────────────┘
```

#### 5.3.1 Chi tiết implementation

```python
import os
from fastapi import HTTPException, status

APP_ENV = os.getenv("APP_ENV", "production")  # default production = an toàn nhất


async def check_ai_access(current_user, db):
    """
    Gọi trước khi invoke Gemini API.
    Trả về wallet nếu pass, raise HTTPException nếu fail.
    """

    # Bước 1: Bypass toàn bộ nếu dev/local
    if APP_ENV in ("development", "local"):
        return None  # Không cần wallet, không trừ credit

    # Bước 2: Feature flag
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user or not user.ai_insights_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tính năng đang trong giai đoạn thử nghiệm nội bộ. "
                   "Vui lòng liên hệ admin để được kích hoạt.",
        )

    # Bước 3: Check credit (logic hiện tại ở Mục 2)
    wallet = db.query(CreditsWallet).filter(
        CreditsWallet.user_id == current_user["user_id"]
    ).first()
    if not wallet or wallet.balance < AI_EXPLAIN_COST:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Số dư credit không đủ để sử dụng tính năng này.",
        )

    return wallet
```

> [!CAUTION]
> **Bước 2 phải trước Bước 3**: Nếu user chưa được whitelist, không nên để lộ thông tin "hết credit" — chỉ trả message chung chung "đang thử nghiệm nội bộ" để user thường không biết tính năng tồn tại.

---

### 5.4 Frontend

#### 5.4.1 Backend: Bổ sung `ai_insights_enabled` vào response

**File [auth.py](file:///d:/datamind_prod/backend/app/schemas/auth.py)** — Schema `UserResponse`:

```diff
 class UserResponse(BaseModel):
     id: int
     full_name: str
     email: str
     created_at: str
+    ai_insights_enabled: bool = False

     model_config = {"from_attributes": True}
```

**File [auth.py](file:///d:/datamind_prod/backend/app/routers/auth.py)** — Helper `_user_to_response`:

```diff
 def _user_to_response(user: User) -> UserResponse:
     return UserResponse(
         id=user.id,
         full_name=user.full_name,
         email=user.email,
         created_at=user.created_at.isoformat(),
+        ai_insights_enabled=user.ai_insights_enabled,
     )
```

Các endpoint trả `UserResponse` (login, register, Google OAuth callback) sẽ tự động bao gồm field mới mà không cần sửa thêm.

#### 5.4.2 Frontend: Ẩn UI AI Insights khi chưa được bật

Trong `Visualize.jsx` (hoặc component tương ứng):

```jsx
// Lấy từ user context / auth state
const { ai_insights_enabled } = currentUser;

// Chỉ render khối AI Insights khi user đã được whitelist
{ai_insights_enabled && (
  <>
    {/* Nút "Explain by AI" (Tier 1) */}
    <ExplainByAIButton />

    {/* Gợi ý tương quan Tier 1.5 */}
    <CorrelationSuggestions />

    {/* Card hiển thị kết quả AI */}
    <AIInsightsCard />
  </>
)}
```

> [!IMPORTANT]
> **Ẩn hoàn toàn** — không phải disable/grey-out. User thường không nên biết tính năng tồn tại cho đến khi được admin bật `ai_insights_enabled = True` qua Supabase hoặc admin panel.
