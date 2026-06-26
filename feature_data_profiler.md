# Prompt: Data Profiler & Auto-Chart Suggestion (cho Antigravity)

```
[BỐI CẢNH DỰ ÁN CẬP NHẬT]
Dự án: DataMind - Công cụ phân tích dữ liệu UI-First dành cho sinh viên khối Kinh tế. Triết lý hệ thống là Hybrid AI (Pandas xử lý logic cốt lõi, LLM diễn dịch ngữ cảnh).
Tech Stack chuẩn xác: 
- Backend: FastAPI (Deploy trên Render)
- Frontend: React + Vite + Tailwind CSS (Bám sát design system SKILL.md)
- Database & Cache: PostgreSQL (Migration bằng Alembic), Upstash Redis (Caching).
- Chạy qua Docker (có pgAdmin).

[NHIỆM VỤ CỦA BẠN]
Hãy đóng vai trò là Senior Software Architect. Đọc kỹ tech stack và các file cấu hình hiện tại. Hãy lập một Kế Hoạch Triển Khai (Implementation Plan) để xây dựng tính năng "Data Profiler & Auto-Chart Suggestion".

[YÊU CẦU NGHIỆP VỤ & TƯ DUY KIẾN TRÚC]
1. TUYỆT ĐỐI KHÔNG HARDCODE TÊN CỘT: Mọi logic xử lý trong Pandas phải mang tính "động" (Dynamic Iteration). Hệ thống không được phép đoán kiểu dữ liệu qua tên cột, mà phải đọc nội dung dữ liệu bên trong để suy luận (Sử dụng `df.dtypes` và các hàm kiểm tra của Pandas).
2. THUẬT TOÁN PHÂN LOẠI (HEURISTICS): 
   - Số liệu (Numeric): Nhận diện qua dtypes là int/float.
   - Thời gian (Datetime): Cố gắng parse thử, nếu tỷ lệ thành công cao thì gán nhãn Datetime.
   - Danh mục (Categorical): Cột Object/String CÓ số lượng giá trị duy nhất (unique values) nhỏ hơn hoặc bằng 15. -> Đề xuất biểu đồ Tròn (Pie) / Cột (Bar).
   - Văn bản tự do (Text): Cột Object/String CÓ số lượng giá trị duy nhất lớn hơn 15. -> Không đề xuất biểu đồ.
3. PHÂN TÍCH NGỮ CẢNH (SEMANTIC CONTEXT): Lên phương án tích hợp một hàm phụ (có thể mock data trước) để nhận cái Schema vừa quét được từ Pandas, ném vào LLM để LLM đoán xem đây là dataset về lĩnh vực gì (Marketing, HR, Finance...)

[RÀNG BUỘC KỸ THUẬT]
- Backend: Tạo router mới `app/routers/files.py`. Sử dụng `UploadFile` của FastAPI. KHÔNG lưu file vật lý vào ổ cứng (Disk) để tránh rác server, hãy đọc file trực tiếp từ memory buffer (ví dụ dùng `io.BytesIO`) và xử lý bằng Pandas ngay trên RAM.
- Caching: Đề xuất cách dùng Upstash Redis để cache lại kết quả Profiling này (lưu theo mã file_hash) để người dùng reload trang không bị quét lại file từ đầu.
- Output: Kế hoạch trả ra dạng Step-by-Step, bao gồm cấu trúc Pydantic Schema mong muốn cho response, và sơ đồ logic xử lý. CHỈ VIẾT KẾ HOẠCH, KHÔNG SINH CODE CHÈN VÀO HỆ THỐNG NGAY.
```

## Câu hỏi mở (chưa đưa vào prompt, để bàn riêng)

Với bản thiết kế này, có nên cho phép người dùng **"Ghi đè" (Override)** lại quyết định của hệ thống không?
Ví dụ: hệ thống nhận diện cột "Mã Nhân Viên" là Số và đòi cộng tổng → người dùng có thể gạt nút ép nó thành dạng Chữ/Text ngay trên giao diện UI.
