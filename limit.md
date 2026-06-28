# DataMind v1 — Giới hạn kỹ thuật (Technical Limits)

**Cập nhật:** 2026-06  
**Môi trường:** Render Free Tier + Supabase Free + Upstash Free

---

## 1. Giới hạn File Upload

| Giới hạn | Giá trị | Lý do |
|---|---|---|
| Dung lượng file | **10 MB** | RAM Render free 512MB — cần đủ cho Pandas xử lý |
| Số dòng | **50.000 dòng** | Giới hạn an toàn để tránh OOM crash |
| Định dạng | `.csv`, `.xlsx`, `.xls` | Pandas + openpyxl |
| File rỗng | Từ chối ngay | Validate trước khi xử lý |

---

## 2. Giới hạn Session / Cache (Upstash Redis)

| Cache key | TTL | Mô tả |
|---|---|---|
| `profile:{file_hash}` | **24 giờ** | Kết quả phân tích cột, AI context |
| `filebytes:{file_hash}` | **1 giờ** | Raw file bytes để Cleaner tái dùng |
| `filebytes:{file_hash}_clean` | **1 giờ** | DataFrame đã clean (dùng cho confirm) |

> ⚠️ **Quan trọng:** Nếu user upload file xong, đợi **hơn 1 giờ** mới vào trang Cleaner, các endpoint `/detect-issues`, `/auto-clean`, `/confirm-clean` sẽ trả về lỗi 404. User phải upload lại file từ trang Profiler.

---

## 3. Giới hạn Supabase Storage

| Giới hạn | Giá trị |
|---|---|
| Free tier Storage | **1 GB** tổng |
| Bucket | `datasets` — Private |
| Path format | `clean/{user_id}/{filename}_clean.csv` |
| URL type | Signed URL — **hết hạn sau 7 ngày** |

> Sau 7 ngày, URL trong `clean_file_url` sẽ không truy cập được. Module 3 cần đọc file trong vòng 7 ngày kể từ khi confirm clean.

---

## 4. Giới hạn Data Cleaning (Module 2)

| Điều kiện gating | Mô tả |
|---|---|
| User phải bấm "Xác nhận" | Không bao giờ tự động chốt |
| Tối thiểu **10 dòng** sau khi clean | Dưới 10 dòng không đủ để tính thống kê |
| Tối thiểu **1 cột numeric** | Module 3 yêu cầu ít nhất 1 cột số |
| Không có cột **100% null** | Cột toàn null phải được xử lý |
| Supabase upload thành công | Xác nhận trước khi trả về response |

---

## 5. Giới hạn AI (Gemini LLM)

| Giới hạn | Giá trị |
|---|---|
| Timeout | 15 giây |
| Retry | 3 lần (exponential backoff 2–10s) |
| Fallback | `domain: "Unknown", confidence: 0.0` nếu lỗi |
| Model | `GEMINI_MODEL` env var (mặc định `gemini-1.5-flash`) |

> AI chỉ dùng để đoán **ngữ cảnh dataset** (Marketing, HR...). Nếu lỗi, toàn bộ pipeline vẫn chạy bình thường với fallback.

---

## 6. Giới hạn Render Free Tier

| Giới hạn | Giá trị | Ảnh hưởng |
|---|---|---|
| RAM | 512 MB | File lớn có thể OOM — giới hạn 10MB/50K dòng |
| Cold start | 30–60 giây | Request đầu tiên sau 15 phút không hoạt động |
| Disk | **Không bền** (reset khi restart) | Không lưu file local — dùng Supabase Storage |
| CPU | Shared | Tác vụ Pandas nặng có thể chậm |

---

## 7. Tính năng ngoài phạm vi v1 (Out of Scope)

- [ ] Guided Fix (Chế độ 3 — wizard từng issue)
- [ ] Manual Edit grid (Chế độ 2 — edit trực tiếp trên bảng)
- [ ] Merge nhiều file thành 1 dataset
- [ ] Clean JSON/XML
- [ ] Outlier detection tự động (thuộc Module 3)
- [ ] Versioning nhiều bản clean song song
- [ ] Chia sẻ Clean Dataset giữa các user
- [ ] Signed URL tự động renew sau 7 ngày

---

## 8. Lỗi thường gặp khi test production

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `404` tại `/detect-issues` | File bytes đã hết TTL (>1h) | Upload lại file từ Profiler |
| `503` tại `/confirm-clean` | Supabase Storage lỗi hoặc bucket chưa tạo | Kiểm tra Render logs, Supabase Dashboard |
| `422` tại `/confirm-clean` | Dataset sau clean < 10 dòng hoặc không có cột số | Dùng file dữ liệu có đủ điều kiện |
| Response chậm 30–60s lần đầu | Render cold start | Bình thường — đợi hoặc dùng uptime monitor |
| `clean_file_url` là `dev-placeholder.local` | `SUPABASE_URL` chưa set trên Render | Kiểm tra Environment Variables trên Render dashboard |
