---
title: Phiên làm việc và Bộ nhớ tạm
updated: 2026-11-02
related:
  - cleaner/confirm-and-next
  - report/export
---

# Phiên làm việc và Bộ nhớ tạm {#session}

DataMind được thiết kế với nguyên tắc bảo mật và tôn trọng quyền riêng tư dữ liệu cao nhất. Hệ thống không lưu trữ tệp bảng tính của bạn vĩnh viễn trên máy chủ.

## Bảng vòng đời lưu trữ dữ liệu (Data Retention)

| Thành phần dữ liệu | Nơi lưu trữ | Thời gian lưu | Cơ chế khi hết hạn |
| :--- | :--- | :--- | :--- |
| **Nội dung file nhị phân (bytes)** | Bộ nhớ tạm Redis (`filebytes:`) | **5 giờ** | Tự động xóa sạch khỏi máy chủ. Bạn chỉ cần tải lại đúng file cũ để tiếp tục làm sạch/vẽ biểu đồ. |
| **Kết quả phân tích cột (Profile data)** | Bộ nhớ đệm Redis (`profile:`) | **24 giờ** | Lưu theo mã hash và tài khoản của bạn. Mở lại không cần quét lại từ đầu. |
| **Mô tả ngữ cảnh & Lĩnh vực AI** | Bộ nhớ đệm Redis (`profiler_ctx:`) | **24 giờ** | Giữ nguyên các chỉnh sửa mô tả, kết quả AI và độ tin cậy. |
| **Tổng quan báo cáo (Report Intro)** | Bộ nhớ đệm Redis (`report_intro:`) | **24 giờ** | Giữ nguyên nội dung do AI tạo hoặc bạn tự sửa. |
| **Phiên làm việc trên trình duyệt** | Trình duyệt (`localStorage`) | Đến khi **Đăng xuất** | Xóa sạch khi bạn bấm Đăng xuất hoặc chuyển tài khoản. |

## Đồng hồ đếm ngược bảo mật (5 giờ) {#session-countdown}

Ở thanh trạng thái của màn hình Đánh giá dữ liệu, bạn sẽ thấy một dòng thông báo có biểu tượng đồng hồ:
`File [Tên file của bạn] tự động xóa sau HH:MM:SS để bảo mật.`

- **Thời hạn lưu trữ nhị phân**: Toàn bộ nội dung thô của tệp tin chỉ tồn tại trong bộ nhớ tạm (RAM/Redis) tối đa **5 giờ** kể từ thời điểm tải lên.
- **Trạng thái màu sắc**:
  - Dưới **30 phút**: Đồng hồ và khung chuyển sang màu **vàng cam** nhắc nhở bạn sắp hết phiên làm việc.
  - Dưới **5 phút**: Chuyển sang màu **đỏ đậm** cảnh báo khẩn cấp: *"File tự động xóa sau HH:MM:SS — hãy lưu kết quả!"*.
- **Khi hết hạn 5 giờ**: File nhị phân sẽ tự động biến mất khỏi máy chủ. Hệ thống sẽ hiển thị một biểu ngữ màu vàng cam êm dịu, cho phép bạn tải lại đúng file đó để tiếp tục ngay tại bước hiện tại mà không mất các thiết lập ghi đè hay mô tả đã lưu.

## Tùy chọn "Đọc lại file (miễn phí)" {#session-re-read}

Tại nút menu `ui:profiler.more` ở góc trên bên phải màn hình, bạn sẽ tìm thấy mục `ui:profiler.reread`.

- **Khi nào nên dùng**: Khi bạn vừa sửa đổi nội dung bảng tính trên máy tính và muốn cập nhật lại cấu trúc vào hệ thống.
- **Cơ chế hoạt động**: Thao tác này sẽ xóa sạch dữ liệu cache cũ trên máy chủ và phân tích lại toàn bộ cấu trúc file từ đầu. Thao tác này hoàn toàn **miễn phí** và không gọi AI.

## Huy hiệu "Đã lưu đệm" (Cached Badge) {#session-cached-badge}

Nếu một file đã từng được bạn tải lên trước đó trong vòng 24 giờ, hệ thống sẽ nhận diện qua mã băm duy nhất và hiển thị `ui:profiler.cached_badge`.

- **Tốc độ tức thì**: Trang Đánh giá dữ liệu mở ra ngay trong chớp mắt mà không cần chờ tính toán lại.
- **Tiết kiệm tối đa**: Mọi thông tin về cấu trúc cột, các ghi đè kiểu dữ liệu và mô tả ngữ cảnh bạn đã lưu trước đó đều được khôi phục nguyên vẹn và **không trừ lượt AI**.
