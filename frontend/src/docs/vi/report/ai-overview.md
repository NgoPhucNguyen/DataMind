---
title: Tổng quan viết bằng AI
updated: 2026-11-10
related:
  - profiler/ai-context
  - visualize/ai-explain
---

# Tổng quan viết bằng AI {#ai-overview}

Phần mở đầu báo cáo cần một đoạn tóm tắt ngắn gọn (4–5 câu) nêu bật quy mô dữ liệu, phương pháp xử lý và các phát hiện then chốt. Thay vì phải tự viết từ đầu, bạn có thể sử dụng trí tuệ nhân tạo để tạo đoạn tóm tắt này chỉ với một cú nhấp chuột.

## Cách tạo tổng quan bằng AI {#generate-intro}

1. Nhấp vào nút `ui:report.ai_write` ở góc trên bên phải mục Tổng quan.
2. Hộp thoại xác nhận sẽ xuất hiện, hiển thị rõ số lượt AI bạn đã dùng và số lượt còn lại trong ngày (tài khoản Miễn phí có 5 lượt/ngày, tài khoản Pro có 30 lượt/ngày).
3. Bấm **Tiếp tục**. Thanh tiến trình màu xanh hiển thị đồng hồ đếm giây thời gian thực.
4. Sau 3–8 giây, đoạn tóm tắt mở đầu súc tích sẽ xuất hiện trên khung văn bản kèm huy hiệu `ui:report.badge_ai`.

```dm-callout:tip
Nếu bạn đã điền bối cảnh hoặc mục đích nghiên cứu ở bước Đánh giá (Profiler), AI sẽ sử dụng thông tin đó để viết đoạn mở đầu sát thực tế hơn. Bạn có thể bấm liên kết "Sửa mô tả" hoặc "Thêm mô tả" ngay dưới tiêu đề Tổng quan để cập nhật.
```

## Cơ chế hủy an toàn & Bảo toàn lượt sử dụng {#safe-cancel}

- **Hủy yêu cầu bất cứ lúc nào:** Khi AI đang xử lý, bạn có thể bấm nút **Hủy** màu đỏ trên thanh tiến trình. Hệ thống sẽ ngắt kết nối an toàn ngay lập tức.
- **Không trừ lượt khi hủy hoặc gặp lỗi:** Hệ thống chỉ ghi nhận trừ 1 lượt AI khi đoạn văn bản được tạo thành công từ mô hình. Nếu bạn bấm Hủy hoặc nếu xảy ra sự cố mạng, **tuyệt đối không bị trừ lượt**.
- **Lưu bộ nhớ đệm (Cache):** Đoạn tổng quan do AI tạo được lưu đệm trên hệ thống trong 24 giờ. Khi bạn tải lại trang (F5) hoặc mở lại báo cáo, văn bản sẽ hiển thị ngay lập tức mà không cần gọi lại AI.

## Tự do chỉnh sửa và lưu văn bản của riêng bạn {#edit-and-save}

Bạn có thể chỉnh sửa lại nội dung đoạn mở đầu bất cứ lúc nào:

1. Nhấp chuột trực tiếp vào khung soạn thảo Tổng quan và gõ chỉnh sửa nội dung theo ý muốn.
2. Sau 800 mili-giây ngừng gõ, hệ thống sẽ tự động gửi bản lưu lên máy chủ hoàn toàn miễn phí (không gọi AI, không tốn lượt).
3. Huy hiệu chuyển sang `ui:report.badge_edited`.
4. Nếu sau đó bạn muốn tạo lại bằng AI, khi bấm `ui:report.ai_regenerate`, hệ thống sẽ hiển thị hộp thoại cảnh báo xác nhận trước khi ghi đè lên nội dung bạn đã tự tay biên tập.

## Cảnh báo "Biểu đồ đã thay đổi" {#charts-changed}

Khi danh sách biểu đồ đưa vào báo cáo có sự thay đổi (bạn quay lại bước Visualize thêm bớt biểu đồ, hoặc xóa biểu đồ trong mục Phân tích chi tiết), cạnh tiêu đề Tổng quan sẽ xuất hiện huy hiệu màu vàng `ui:report.badge_charts_changed`:

- **Ý nghĩa cảnh báo:** Đoạn tổng quan hiện tại được tạo dựa trên danh sách biểu đồ cũ, có thể không còn nhắc đúng các biểu đồ đang có trong báo cáo.
- **Cách xử lý:**
  - Nếu nội dung cũ vẫn phù hợp với nhận định chung của bạn: Bạn có thể giữ nguyên mà không cần thao tác gì thêm.
  - Nếu muốn cập nhật chính xác theo các biểu đồ mới: Bấm `ui:report.ai_regenerate` để tạo lại bản tổng quan mới nhất (tiêu tốn 1 lượt AI), hoặc tự tay bổ sung ý vào khung soạn thảo.

