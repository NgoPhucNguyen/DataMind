---
title: Phương pháp & Làm sạch
updated: 2026-11-10
related:
  - cleaner/review-results
  - cleaner/auto-clean
  - profiler/override
---

# Phương pháp & Làm sạch Dữ liệu {#methodology}

Trong một báo cáo phân tích số liệu đáng tin cậy, việc minh bạch các bước chuẩn hóa và tiền xử lý dữ liệu là tiêu chuẩn bắt buộc. Mục **Phương pháp & Làm sạch Dữ liệu (Methodology)** ghi chép lại toàn bộ các can thiệp kỹ thuật đã diễn ra ở bước Cleaner trước khi dữ liệu được đưa vào trực quan hóa.

## Nội dung tự động sinh từ bước Làm sạch {#auto-content}

Hệ thống tự động đọc nhật ký xử lý dữ liệu và tạo văn bản tóm tắt theo các tiêu chí:

- **Chế độ làm sạch:** Ghi nhận quy trình được thực hiện theo chế độ Tự động (`Auto`) hay Sửa thủ công (`Manual`).
- **Xử lý dòng trùng lặp:** Số lượng dòng trùng lặp hoàn toàn đã bị loại bỏ khỏi bộ dữ liệu.
- **Xử lý ô trống (Missing values):** Tổng số ô dữ liệu bị thiếu đã được điền khuyết theo thuật toán trung vị (cột số) hoặc gán nhãn nhận diện (cột phân loại).
- **Loại bỏ cột chất lượng kém:** Liệt kê tên cụ thể các cột có tỷ lệ trống $\ge 90\%$ hoặc chỉ có một giá trị duy nhất đã bị xóa.
- **Chuẩn hóa kiểu dữ liệu:** Số lượng cột đã được chuyển đổi kiểu dữ liệu thành công (ví dụ: chuyển chuỗi văn bản ngày tháng thành kiểu datetime).
- **Trường hợp bỏ qua:** Nếu bạn bấm "Bỏ qua làm sạch", hệ thống sẽ ghi rõ: *"Dữ liệu được giữ nguyên, không làm sạch."*.

```dm-callout:note
Khi in ấn hoặc xuất ra tệp Word/PDF, khung nhập liệu sẽ tự động chuyển thành đoạn văn bản trải dài chuẩn typography, đảm bảo toàn bộ nội dung hiển thị trọn vẹn mà không bao giờ bị cắt dòng hay xuất hiện thanh cuộn.
```

## Biên tập và lưu trữ trên máy chủ {#edit-and-save}

Bạn có thể diễn giải chi tiết hơn về các chuẩn mực dữ liệu của tổ chức hoặc bổ sung phương pháp lấy mẫu:

1. Nhấp chuột vào khung văn bản và gõ chỉnh sửa nội dung.
2. Sau 1 giây ngừng gõ (hoặc ngay khi bạn nhấp chuột ra ngoài khung soạn thảo), hệ thống sẽ gửi yêu cầu lưu trữ lên máy chủ.
3. Khi lưu thành công, hệ thống hiển thị dòng trạng thái `ui:report.badge_saved` kèm mốc thời gian rõ ràng (ví dụ: `Đã lưu · 15:10` hoặc `Đã lưu · 10/11 15:10`). Nội dung này được lưu trữ an toàn trên máy chủ và sẽ nạp lại đầy đủ khi bạn mở lại báo cáo ở bất kỳ đâu.

## Khôi phục văn bản tự động {#restore-auto}

Nếu muốn hủy bỏ toàn bộ các câu chữ đã sửa và quay lại bản tóm tắt kỹ thuật ban đầu:

1. Bấm nút `ui:report.restore_auto` ở bên dưới khung văn bản.
2. Hộp thoại xác nhận DataMind sẽ hỏi: *"Nội dung bạn đã sửa sẽ bị thay bằng văn bản tạo tự động từ bước làm sạch."*.
3. Bấm **Khôi phục**: Bản lưu chỉnh sửa trên máy chủ sẽ được xóa và hệ thống lập tức tái lập đoạn tóm tắt từ các số liệu làm sạch gốc.

## Cảnh báo "Dữ liệu đã được làm sạch lại" {#cleaning-stale-warning}

Nếu sau khi đã chỉnh sửa phần Phương pháp, bạn quay trở lại bước Cleaner và tiến hành làm sạch lại tệp dữ liệu:

- Hệ thống sẽ phát hiện mã băm làm sạch (`cleaning_hash`) của tệp hiện tại không còn khớp với thời điểm bạn lưu văn bản phương pháp trước đó.
- Cạnh tiêu đề Phương pháp sẽ xuất hiện huy hiệu cảnh báo màu vàng: `ui:report.badge_cleaning_stale`.
- **Hành động khuyến nghị:** Bạn nên rà soát lại số lượng dòng và ô trống đã ghi trong văn bản, hoặc bấm `ui:report.restore_auto` để hệ thống tự động cập nhật lại các số liệu mới nhất sau khi làm sạch.

