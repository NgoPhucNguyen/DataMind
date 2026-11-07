---
title: Tổng quan về Đánh giá dữ liệu (Profiler)
updated: 2026-11-02
---

# Tổng quan về Đánh giá dữ liệu (Profiler) {#overview}

Bước **Đánh giá dữ liệu** (Profiler) là điểm khởi đầu trong quy trình phân tích của DataMind. Khi bạn tải lên một tệp bảng tính (Excel hoặc CSV), hệ thống sẽ lập tức quét toàn bộ cấu trúc để hiểu rõ số lượng dòng, số lượng cột, kiểm tra chất lượng từng thuộc tính và định hướng các bước xử lý tiếp theo.

```dm-callout tip
Toàn bộ quá trình quét cấu trúc bảng tính diễn ra hoàn toàn trong bộ nhớ tạm của máy chủ (RAM), không lưu file vĩnh viễn và hoàn toàn miễn phí.
```

## Mục tiêu của bước Đánh giá {#overview-goals}

Bước này giúp bạn trả lời 3 câu hỏi quan trọng trước khi làm sạch hoặc vẽ đồ thị:
1. **Dữ liệu có kích thước và hình thái như thế nào?** Bao nhiêu dòng hợp lệ, bao nhiêu cột, tên từng cột là gì?
2. **Mỗi cột đang chứa loại thông tin nào?** Là `ui:type.numeric` đo lường, `ui:type.datetime`, `ui:type.categorical` phân loại, `ui:type.multiple_choice` hay `ui:type.text` tự do?
3. **Có những rủi ro nào tiềm ẩn?** Cột nào bị bỏ trống nhiều, cột nào bị sai định dạng tiền tệ hoặc cột nào thiếu sự biến thiên?

```dm-rules profiler
```

## Các thành phần chính trên màn hình {#overview-components}

Trên trang Đánh giá dữ liệu, bạn sẽ thấy các khối chức năng chính:
- **Thanh tóm tắt quy mô dữ liệu**: Hiển thị tổng số dòng, số cột, nút `ui:profiler.upload_new`, nút menu `ui:profiler.more` chứa `ui:profiler.reread` và `ui:profiler.download_report`. Nếu phát hiện bất thường, hệ thống sẽ hiện nút cảnh báo `ui:profiler.attention_chip`.
- **Bảng Cấu trúc cột & Vấn đề dữ liệu**: Liệt kê chi tiết từng thuộc tính kèm theo Kiểu nhận diện tự động, menu `ui:profiler.type_dropdown`, chỉ số Duy nhất, Rỗng% và Gợi ý biểu đồ.
- **Ngữ cảnh của AI**: Nơi ghi chú ý nghĩa của tập dữ liệu và nút bấm `ui:profiler.ai_analyze` để AI nhận diện lĩnh vực kinh doanh.

## Luồng di chuyển tiếp theo {#overview-next-steps}

Sau khi xem xét cấu trúc cột và ghi đè kiểu (nếu cần), bạn chỉ cần nhấn nút `ui:profiler.continue` ở góc trên bên phải. Hệ thống sẽ tự động chuyển toàn bộ thiết lập sang bước Làm sạch dữ liệu.
