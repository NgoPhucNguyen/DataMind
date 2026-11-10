---
title: Tổng quan Báo cáo
updated: 2026-11-10
related:
  - visualize/overview
  - cleaner/overview
  - profiler/overview
---

# Tổng quan Module Báo cáo (Report) {#overview}

Sau khi hoàn tất việc trực quan hóa dữ liệu tại bước Visualize, hệ thống DataMind đưa bạn đến chặng cuối cùng: **Báo cáo (Report)**. Phân hệ này là trang biên tập và đóng gói báo cáo điều hành toàn diện, tập hợp các kết quả phân tích quan trọng nhất thành một tài liệu nghiên cứu hoàn chỉnh, sẵn sàng xuất bản ra file PDF hoặc Microsoft Word (.docx).

```flow
nhan:
- Biểu đồ đã chọn & phân tích AI từ 3. Visualize
- Nhật ký làm sạch & khóa băm dữ liệu từ 2. Cleaner
chuyen:
- Báo cáo hoàn chỉnh xuất bản định dạng Word (.docx)
- Tùy chọn in ấn hoặc xuất tệp PDF chuyên nghiệp
```

```dm-callout:tip
Báo cáo không phải là bảng điều khiển thời gian thực (live dashboard) mà là tài liệu báo cáo tĩnh chuyên nghiệp. Mọi chỉnh sửa của bạn về nội dung tóm tắt, phương pháp và điểm chính đều được lưu tự động trên hệ thống.
```

## Cấu trúc 5 phần nội dung tiêu chuẩn {#section-order}

Tài liệu báo cáo trong DataMind được sắp xếp theo đúng trình tự phân tích nghiên cứu tiêu chuẩn:

1. **Phần 1 — Tổng quan:** Khái quát quy mô bộ dữ liệu (tên tệp, số dòng, số cột), ngày tạo, bối cảnh nghiên cứu và đoạn tóm tắt mở đầu súc tích kết nối toàn bộ phát hiện.
2. **Phần 2 — Điểm chính:** Các nhận xét thống kê trọng tâm được trích xuất tự động từ danh sách biểu đồ (kèm số Hình tham chiếu), hoàn toàn không tốn lượt AI, cho phép bạn tự do chỉnh sửa hoặc khôi phục.
3. **Phần 3 — Phương pháp & Làm sạch Dữ liệu:** Minh bạch nhật ký chuẩn hóa dữ liệu từ bước Cleaner (số dòng trùng đã xóa, số ô trống đã điền, danh sách cột bị loại bỏ, kiểu dữ liệu đã đổi).
4. **Phần 4 — Phân tích Chi tiết:** Trưng bày các biểu đồ bạn đã chốt từ bước Visualize theo thứ tự tùy biến, kèm số thứ tự Hình/Bảng, nhận xét thống kê tự động và luận giải kinh doanh chuyên sâu của AI.
5. **Phần 5 — Phụ lục: Từ điển Dữ liệu:** Bảng danh mục tra cứu toàn bộ các cột trong bộ dữ liệu, ký hiệu chữ cái, kiểu dữ liệu, tỷ lệ khuyết, số giá trị duy nhất và nguyên nhân ẩn biểu đồ (nếu có).

## Nguồn dữ liệu tiếp nhận từ các bước trước {#data-sources}

Module Báo cáo tiếp nhận và liên kết chặt chẽ thông tin từ 3 chặng xử lý trước đó:

| Phân hệ nguồn | Dữ liệu tiếp nhận | Vị trí sử dụng trong Báo cáo |
| :--- | :--- | :--- |
| **Profiler** | Tên tệp, số dòng, số cột thực tế | Tiêu đề báo cáo, trang bìa và đoạn văn bản mở đầu |
| **Profiler** | Mô tả bối cảnh và mục đích nghiên cứu | Cung cấp ngữ cảnh cho AI viết đoạn tóm tắt tổng quan |
| **Cleaner** | Chế độ làm sạch, số dòng trùng, ô trống, cột bỏ | Tự động sinh nội dung phần Phương pháp & Làm sạch Dữ liệu |
| **Cleaner** | Khóa băm làm sạch (cleaning hash) | Phát hiện và cảnh báo khi dữ liệu bị làm sạch lại sau đó |
| **Visualize** | Danh sách biểu đồ đã chốt | Dựng các khối phân tích chi tiết và trích xuất Điểm chính |
| **Visualize** | Tùy chỉnh hiển thị và bảng màu | Đồng bộ màu sắc biểu đồ và thang đo tương quan theo giao diện |
| **Visualize** | Nhận xét tự động và giải thích AI | Hiển thị song song dưới mỗi biểu đồ |

## Bảng chọn "Nội dung đưa vào file" {#content-selector}

Ngay phía trên khung tài liệu có thanh công cụ **"Nội dung đưa vào file"**:
- Cho phép bạn tích chọn hoặc bỏ chọn từng phân hệ trong 5 phần trên tùy theo mục đích báo cáo. Phần nào bỏ chọn sẽ không xuất hiện trên giao diện in và không được đưa vào tệp Word/PDF.
- Cung cấp hai tùy chọn đóng gói xuất file: `Trang bìa` (cho phép điền Tên báo cáo, Người thực hiện, Đơn vị/Lớp, Ngày) và `Mục lục` tự động.

