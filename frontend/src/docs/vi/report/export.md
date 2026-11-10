---
title: Xuất báo cáo
updated: 2026-11-10
related:
  - profiler/session
  - visualize/to-report
---

# Xuất bản Báo cáo (PDF & Word) {#export}

DataMind hỗ trợ hai định dạng xuất bản tài liệu chuyên nghiệp phục vụ các mục đích khác nhau: **PDF vector chất lượng in ấn A4** (thông qua trình duyệt) và **Microsoft Word (.docx)** dạng văn bản và bảng thật để bạn có thể tiếp tục định dạng hoặc trình bày trong các báo cáo của tổ chức.

## Tùy chọn nội dung đưa vào tệp {#select-sections}

Trước khi xuất file, bạn có thể cấu hình bảng điều khiển **"Nội dung đưa vào file"** ở đầu trang:

1. **Chọn các phân hệ nội dung:** Tích chọn hoặc bỏ chọn 5 mục chính: *Tổng quan*, *Điểm chính*, *Phương pháp*, *Phân tích chi tiết*, *Phụ lục*. Những phần bỏ tích sẽ không được xuất ra.
2. **Trang bìa (`ui:report.export_docx` / PDF):** Khi bật tùy chọn này, bạn có thể điền:
   - *Tên báo cáo:* Mặc định là "Báo cáo phân tích dữ liệu" (bạn có thể đổi thành tên đề tài nghiên cứu).
   - *Người thực hiện:* Họ tên người thực hiện báo cáo.
   - *Đơn vị / Lớp:* Tên phòng ban, công ty hoặc lớp học.
   - *Ngày báo cáo:* Tự động điền ngày hiện tại hoặc chỉnh sửa theo ý muốn.
   - *Quy mô:* Hệ thống tự động điền kích thước tệp (ví dụ: `1,250 dòng × 18 cột`). Bảng thông tin trên bìa chỉ hiển thị các trường bạn thực sự điền, không bao giờ để lại dòng trống.
3. **Mục lục tự động:** Tùy chọn bật bảng Mục lục tóm tắt các đề mục chính trong báo cáo.

## Quy định hiển thị Logo thương hiệu theo hạng tài khoản {#branding-rules}

- **Gói Miễn phí (Free):**
  - Tệp Word xuất ra có logo DataMind kích thước trang trọng (~3 cm) căn giữa trên đầu trang bìa và logo nhỏ kèm dòng chữ *"Tạo bằng DataMind"* ở góc chân trang bên trái.
  - Tệp PDF in ra có dòng ghi chú *"DataMind · [Tên file]"* ở góc chân trang.
- **Gói Chuyên nghiệp (Pro):**
  - Toàn bộ trang bìa, chân trang và tiêu đề **hoàn toàn không gắn logo thương hiệu DataMind**, mang lại tài liệu trung tính chuẩn mực để bạn nộp cho khách hàng, giảng viên hoặc ban giám đốc.

## Xuất file Word (.docx) chuyên nghiệp {#export-word}

Bấm nút `ui:report.export_docx` trên thanh công cụ:

1. Hệ thống sẽ kết xuất tài liệu theo mô hình tài liệu chuẩn Word:
   - **Bố cục Trang 1 tối ưu:** Khối Trang bìa và Mục lục được đặt gọn gàng trên cùng Trang 1, theo sau là lệnh ngắt trang sang Trang 2 cho phần thân bài. Nếu tắt Mục lục, phần thân bài sẽ tiếp nối ngay dưới bìa ở Trang 1 mà không tạo trang trắng thừa.
   - **Bố cục 2 biểu đồ / hàng:** Các biểu đồ phân phối đơn lẻ (Histogram, Bar, Boxplot) có chiều rộng bán phần sẽ được tự động ghép đôi thành 2 biểu đồ trên một hàng ngang.
   - **Bảng dữ liệu thật (Native Word Tables):** Bảng Top 8 cặp tương quan, ma trận thu gọn có tô màu phân kỳ và bảng Từ điển dữ liệu là bảng Word thật, cho phép bạn copy số liệu trực tiếp sang Excel.
   - **Kiểu chữ và khoảng cách chuẩn:** Font chữ Arial, Heading 1 màu xanh `#1B4324`, khoảng cách dòng thoáng đãng, số trang tự động `Trang X / Y`.
2. **Lưu ý khi mở tệp Word lần đầu:**  
   Do bảng Mục lục sử dụng chuẩn trường OpenXML native, Microsoft Word sẽ hiện thông báo hỏi:  
   *"This document contains fields that may refer to other files. Do you want to update the fields in this document?"*  
   **Bạn hãy chọn Yes (Có)** để Word tự động tính toán số trang chính xác nhất cho từng mục.

## Xuất file PDF qua hộp thoại in của trình duyệt {#export-pdf}

Bấm nút `ui:report.export_pdf` trên thanh công cụ:

1. Hệ thống sẽ tự động co giãn toàn bộ nội dung báo cáo về đúng khổ giấy A4 (718px), đồng bộ lại kích thước biểu đồ Recharts và mở hộp thoại in của trình duyệt.
2. Để tệp PDF xuất ra đẹp và chuẩn nhất, hãy kiểm tra **4 bước cài đặt trong hộp thoại in**:
   - **Bước 1 — Máy in đích:** Chọn *"Lưu dưới dạng PDF"* (Save as PDF).
   - **Bước 2 — Màu sắc:** Chọn *"Màu"* (Color).
   - **Bước 3 — Tùy chọn nâng cao:**
     - **TẮT** mục *"Đầu trang và chân trang"* (để tránh trình duyệt in ngày giờ và đường link URL của website lên viền giấy).
     - **BẬT** mục *"Đồ họa nền"* (Background graphics) để in đầy đủ màu nền các ô ma trận tương quan và các bảng thống kê.
   - **Bước 4 — Lề:** Chọn *"Mặc định"* (Default). Lề in chuẩn 16mm trên/dưới và 14mm hai bên đã được DataMind tích hợp sẵn.
3. Bấm **Lưu (Save)** để tải tệp PDF chất lượng vector sắc nét về máy tính.

```dm-callout:tip
Mẹo rút gọn số trang báo cáo: Nếu muốn bản báo cáo ngắn gọn hơn (khoảng 3–5 trang), bạn có thể:
1. Bỏ chọn mục "Phụ lục: Từ điển dữ liệu" trong bảng chọn nội dung.
2. Tại bước Visualize, chỉ chọn lọc 4–6 biểu đồ tiêu biểu nhất.
3. Tắt tùy chọn "Mục lục" nếu báo cáo dưới 5 trang.
```

