# Hướng dẫn Test Tính năng AI Insights (Phase 1)

Dưới đây là các kịch bản kiểm thử (Test Cases) chi tiết cho tính năng "AI Explain Chart". Bạn có thể làm theo từng bước để đảm bảo hệ thống hoạt động ổn định.

---

## Bước 0: Chuẩn bị
1. **Migration**: Đảm bảo đã chạy thành công `alembic upgrade head`.
2. **Cấp quyền tài khoản (Feature Flag)**:
   - Chạy lệnh SQL sau trong `psql` hoặc pgAdmin để kích hoạt tính năng cho tài khoản của bạn:
     ```sql
     UPDATE users SET ai_insights_enabled = true WHERE email = 'email_cua_ban@gmail.com';
     ```
3. **Cập nhật Session**:
   - Đăng xuất khỏi hệ thống và đăng nhập lại để `localStorage` nhận giá trị `ai_insights_enabled` mới.
4. **Môi trường**: 
   - Đảm bảo Backend (Docker/uvicorn) và Frontend (npm run dev) đang chạy.
   - File `.env` Backend có `APP_ENV=development` để bypass bước trừ tiền.

---

## Test Case 1: Feature Flag — Ẩn/Hiện Giao Diện (UI)

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 1.1 | Login bằng tài khoản **chưa** bật flag (`ai_insights_enabled = false`). Upload file và xem biểu đồ. | **Không thấy** nút "Phân tích bởi AI" dưới bất kỳ biểu đồ nào. Tính năng bị ẩn hoàn toàn. | [ ] |
| 1.2 | Login bằng tài khoản **đã** bật flag (`ai_insights_enabled = true`). Upload file. | **Thấy** nút "Phân tích bởi AI (500 tín chỉ)" dưới mỗi biểu đồ (trừ biểu đồ Heatmap). | [ ] |

---

## Test Case 2: Cache-first + Gọi Gemini (Luồng hoạt động chính)
*(Yêu cầu: Dùng tài khoản đã bật flag. Upload một file dữ liệu mẫu có cột số)*

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 2.1 | Nhấp vào nút **"Phân tích bởi AI"** trên một biểu đồ. | Hiện hiệu ứng skeleton loading. Vài giây sau, xuất hiện đoạn phân tích của Gemini. Badge hiển thị: **"Tạo bởi AI"**. | [x] (Đã Pass) |
| 2.2 | Nhấp lại nút trên **cùng biểu đồ đó** (hoặc reload trang rồi nhấp lại). | Kết quả hiện ra **ngay lập tức** (lấy từ Redis cache), không có skeleton loading dài. Badge vẫn là "Tạo bởi AI". | [ ] |
| 2.3 | Xem Terminal Log của Backend | Lần 1: Thấy log gọi Gemini. Lần 2: **Không** thấy log gọi Gemini (vì là cache hit). | [ ] |

---

## Test Case 3: Chỉnh sửa & Lưu bản nháp (Tier 2 Cache)
*(Tính năng này lưu lại diễn giải của riêng người dùng)*

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 3.1 | Trên khung kết quả AI (từ Test Case 2), nhấp vào **icon bút chì (Edit)**. | Hiện khung `textarea` cho phép sửa nội dung văn bản. | [ ] |
| 3.2 | Sửa một vài chữ, sau đó bấm **"Lưu thay đổi"**. | Báo Toast: "Đã lưu bản phân tích thành công." Badge đổi màu xanh dương và ghi: **"Đã chỉnh sửa bởi bạn"**. | [ ] |
| 3.3 | Tải lại trang (F5) và bấm lại "Phân tích bởi AI" ở cùng biểu đồ. | Hiển thị **văn bản bạn vừa sửa** (không phải văn bản gốc của AI). Badge tiếp tục ghi: "Đã chỉnh sửa bởi bạn". | [X] |

---

## Test Case 4: Dev Bypass (Bỏ qua trừ Credit)
*(Môi trường phát triển không yêu cầu nạp tiền)*

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 4.1 | Trong lúc `.env` có `APP_ENV=development`, nhấp "Phân tích bởi AI" trên một biểu đồ mới. | Chạy thành công ra kết quả phân tích. Kiểm tra DB (bảng `credit_transactions`): **Không có** bản ghi nào bị trừ tiền (DEBIT). | [ ] |

---

## Test Case 5: Gợi ý Tương quan Tự động (Tier 1.5)

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 5.1 | Upload file có nhiều cột liên kết với nhau (Ví dụ: dữ liệu nhân sự, điểm sinh viên). Chuyển sang Tab **"Tương quan"**. | Thấy một khung nhỏ **"AI Gợi ý Khám phá Tương quan"** tự động xuất hiện, hiển thị tối đa 3 cặp cột (VD: Rất mạnh, Mạnh). | [ ] |
| 5.2 | Nhấp vào một trong các cặp cột được gợi ý. | Biểu đồ phân tán (Scatter panel) tự động bung ra ở phía dưới cùng, hiển thị chi tiết của hai cột đó. | [X] |

---

## Test Case 6: Xử lý Lỗi Ngoại Lệ (Error Handling)

| Bước | Hành động | Kết quả mong đợi | Trạng thái |
|---|---|---|---|
| 6.1 | Đổi `GEMINI_API_KEY` trong `.env` thành chuỗi sai, khởi động lại backend, bấm "Phân tích bởi AI". | Hệ thống báo lỗi thân thiện (Toast error), **không bị crash server**. | [ ] |
| 6.2 | Xóa file đang phân tích (reload cache Redis) rồi cố bấm "Phân tích". | Backend trả về mã 410, Toast báo: "Phiên làm việc đã hết hạn", **không bị crash server**. | [ ] |

---
**Ghi chú:** Bạn có thể đánh dấu `[x]` vào các cột Trạng thái sau khi hoàn tất kiểm thử ngày mai! Chúc bạn nghỉ ngơi thật tốt.
