---
title: Chọn biểu đồ cho báo cáo
updated: 2026-11-08
related:
  - report/overview
  - report/charts
  - cleaner/confirm-and-next
---

# Chọn biểu đồ cho báo cáo (To Report) {#to-report}

Mục tiêu cuối cùng của bước Trực quan hóa là giúp bạn sàng lọc những phát hiện có giá trị nhất để đưa vào văn bản nghiên cứu chính thức tại phân hệ **Báo cáo (Report)**.

## Nút chọn trên từng thẻ biểu đồ {#card-checkbox}

Tại góc trên bên trái của mỗi thẻ biểu đồ, bạn sẽ nhìn thấy nút chọn trạng thái:

- Khi chưa chọn: Nút có nhãn `ui:visualize.add_to_report`.
- Khi đã chọn: Nút chuyển sang màu xanh lá đậm có dấu tích `ui:visualize.added_to_report`.
- **Biểu đồ gợi ý sẵn:** Các biểu đồ có huy hiệu `ui:visualize.badge_suggested` đã được hệ thống tích chọn sẵn ngay từ đầu. Bạn chỉ cần bấm lại vào nút để bỏ chọn nếu cảm thấy biểu đồ đó không cần thiết cho mục đích báo cáo của mình.
- **Thêm cặp tương quan:** Bạn có thể tích chọn ma trận nhiệt tổng thể hoặc tích chọn từng cặp tương quan cụ thể trong danh sách để đưa vào tài liệu.

## Thanh tác vụ ghim cố định ở đáy trang {#sticky-bar}

Để bạn luôn kiểm soát được quy mô tài liệu xuất bản, thanh tác vụ ở đáy màn hình luôn hiển thị:

1. **Bộ đếm thời gian thực:** Thông báo số lượng biểu đồ đã chọn (ví dụ: *"3 biểu đồ đã chọn"*).
2. **Ngăn kéo xem lại (Selected Drawer):** Bấm vào biểu tượng danh sách trên thanh để mở ngăn kéo trượt lên. Tại đây, bạn có thể kiểm tra danh sách toàn bộ các biểu đồ đã chọn và bấm nút gỡ bỏ nhanh cho bất kỳ biểu đồ nào.
3. **Nút chuyển bước:** Bấm `ui:visualize.confirm_proceed` để tiến hành sang bước tạo Báo cáo.

## Hộp thoại cảnh báo khi chưa chọn biểu đồ {#empty-warning-modal}

Nếu bạn bấm chuyển bước khi chưa chọn bất kỳ biểu đồ nào, hệ thống sẽ mở hộp thoại cảnh báo:
- **Tiêu đề:** *"Chưa chọn biểu đồ nào"*.
- **Mô tả:** *"Bạn chưa chọn biểu đồ nào để đưa vào báo cáo. Báo cáo AI sẽ được tạo mà không có biểu đồ trực quan hóa. Bạn có chắc muốn tiếp tục không?"*
- Bạn có thể bấm **"Quay lại chọn"** để tiếp tục nhặt các biểu đồ quan trọng, hoặc bấm **"Tiếp tục không có biểu đồ"** nếu chỉ có nhu cầu nhận báo cáo phân tích bằng văn bản thuần túy.

## Những dữ liệu được bảo toàn sang Báo cáo {#preserved-settings}

Khi chuyển sang phân hệ Báo cáo, toàn bộ cấu hình bạn đã tinh chỉnh tại Visualize sẽ được đồng bộ 100%:

- **Danh sách biểu đồ:** Đúng các biểu đồ bạn đã tích chọn và giữ nguyên thứ tự sắp xếp.
- **Tiêu đề tùy chỉnh:** Nếu bạn đã sửa tiêu đề câu hỏi trên biểu đồ, tiêu đề mới sẽ xuất hiện trực tiếp trong Báo cáo.
- **Tùy chỉnh hiển thị:** Dạng biểu đồ (Cột/Tròn, Histogram/Boxplot), số lượng mục (Top 10, Tất cả) và thứ tự sắp xếp được giữ nguyên.
- **Bảng màu:** Bảng màu giao diện bạn đang chọn (ví dụ Đại dương hay Đen trắng) sẽ được áp dụng cho toàn bộ hình vẽ trong Báo cáo và file xuất Word/PDF.
- **Phân tích AI:** Các đoạn văn giải thích do AI tạo ra hoặc do bạn tự biên tập sẽ được tích hợp sẵn vào từng phần của báo cáo mà không cần tạo lại.

```dm-callout:tip
Nếu đang xem báo cáo mà bạn muốn bổ sung thêm biểu đồ hoặc đổi lại dạng biểu đồ, bạn chỉ cần bấm vào nút **"Quay lại Visualize"** ở đầu trang Báo cáo để điều chỉnh mà không bị mất dữ liệu đã làm.
```

