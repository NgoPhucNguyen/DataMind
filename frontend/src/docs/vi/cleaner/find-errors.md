---
title: Tìm & định vị lỗi nhanh chóng
updated: 2026-11-04
related:
  - profiler/column-stats
  - visualize/reading-insights
---

# Tìm & định vị lỗi nhanh chóng {#find-errors}

Khi bảng tính có tới hàng chục cột và hàng trăm dòng, việc dùng mắt thường rà soát từng ô là bất khả thi. DataMind trang bị cho bạn hệ thống công cụ định vị lỗi tự động cực kỳ nhanh nhạy.

## 1. Dải chip tóm tắt lỗi ở đầu trang {#issue-chips}

Ngay phía dưới phần thông tin file, bạn sẽ nhìn thấy dải chip hiển thị tất cả các vấn đề phát hiện được trên toàn bộ tập dữ liệu:

- **Số đếm toàn diện trên toàn file:** Mỗi chip đại diện cho một cột bị lỗi, hiển thị tên cột và số lượng lỗi (ví dụ: `Gia_ban · 15 ô trống`). Số liệu này được tính toán trên 100% dòng dữ liệu của cả file.
- **Chỉ số hiển thị trong bảng xem trước:** Phía sau số đếm, hệ thống ghi rõ có bao nhiêu ô lỗi nằm trong 200 dòng đang hiển thị (ví dụ: `(5 trong bảng)`).
- **Nhấp một chạm để nhảy tới cột:** Bạn chỉ cần bấm vào chip bất kỳ, bảng dữ liệu sẽ tự động cuộn mượt mà đến vị trí cột đó và nhấp nháy viền nổi bật để bạn nhận biết ngay.
- **Lỗi nằm ngoài vùng xem trước:** Nếu tất cả các ô lỗi của cột đó nằm ở các dòng phía sau (từ dòng 201 trở đi), chip sẽ có màu xám nhạt kèm ghi chú: *"Vấn đề nằm ngoài 200 dòng xem trước. Bấm để cuộn tới cột"*.

## 2. Nút duyệt lỗi tuần tự trên thanh công cụ {#error-navigation}

Tại thanh tác vụ ghim cố định ở đáy màn hình, bạn có thể sử dụng hai phím điều hướng:
- `ui:cleaner.prev_error` (Lỗi trước): Nhảy lùi về ô lỗi phía trước.
- `ui:cleaner.next_error` (Lỗi sau): Nhảy tiến tới ô lỗi tiếp theo.

Mỗi lần bấm, tiêu điểm bảng dữ liệu sẽ tự động di chuyển đến chính xác ô lỗi và mở popup hướng dẫn xử lý giúp bạn không bao giờ bỏ sót bất kỳ ô nào.

## 3. Bộ lọc cột và dòng có lỗi {#filter-tools}

Để tập trung xử lý mà không bị rối mắt bởi các cột và dòng dữ liệu đã hoàn hảo, bạn có thể bật các bộ lọc:

- `ui:cleaner.filter_cols` (**Chỉ cột có lỗi**):  
  Tạm thời ẩn đi tất cả các cột dữ liệu đã sạch, chỉ giữ lại những cột đang có vấn đề cần xử lý trên màn hình.
- `ui:cleaner.filter_rows` (**Chỉ dòng có lỗi**):  
  Thu gọn bảng để chỉ hiển thị các dòng chứa ít nhất một ô lỗi, giúp bạn quét qua các lỗi cực nhanh mà không cần cuộn trang dài.

## 4. Bảng mã màu & Trạng thái ô dữ liệu {#cell-legends}

Mỗi ô dữ liệu trên bảng được gắn mã màu trực quan giúp bạn nhận diện tức thì:

| Trạng thái | Mã màu hiển thị | Ý nghĩa |
| :--- | :--- | :--- |
| `ui:legend.pending` | Nền vàng cam, viền cam nhạt | Ô chứa lỗi do hệ thống phát hiện và đang chờ bạn xem xét hoặc xử lý. |
| `ui:legend.fixed` | Nền xanh lá nhạt, chữ xanh | Ô lỗi đã được bạn hoặc hệ thống chỉnh sửa giá trị thành công. Rê chuột để xem giá trị cũ. |
| `ui:legend.ignored` | Nền xám nhạt, gạch nhẹ | Ô lỗi mà bạn đã đánh dấu chủ động bỏ qua và giữ nguyên giá trị gốc. |
| `ui:legend.changed` | Nền xanh ngọc bích viền đậm | Ô đã được cập nhật giá trị mới thông qua các thao tác làm sạch tự động hoặc hàng loạt. |

