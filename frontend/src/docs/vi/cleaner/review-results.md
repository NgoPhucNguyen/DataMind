---
title: Xem kết quả thay đổi (Báo cáo sai khác)
updated: 2026-11-04
related:
  - profiler/column-stats
  - visualize/overview
  - report/methodology
---

# Xem kết quả thay đổi (Báo cáo sai khác) {#review-results}

Sau khi bạn bấm `ui:cleaner.auto` (Tự động sửa), hệ thống không vội vàng chốt ngay mà sẽ chuyển bạn đến màn hình **Báo cáo sai khác (Diff Report)** để bạn kiểm duyệt và hoàn toàn an tâm trước khi bước tiếp.

## 1. Bảng số liệu tổng kết sai khác (Diff Summary) {#diff-summary}

Phía trên cùng của màn hình là các thẻ số liệu thống kê trung thực toàn bộ những thay đổi đã diễn ra trên toàn bộ file:

- **Dòng còn lại & Dòng ban đầu:** Thể hiện rõ số dòng sạch sau khi đã trừ đi các dòng trùng lặp bị loại bỏ.
- **Dòng trùng lặp đã xóa:** Số lượng dòng bị lặp lại nội dung đã được hệ thống dọn dẹp.
- **Cột đã xóa:** Tên những cột bị xóa tự động do chứa trên 90% ô trống.
- **Cột đã đổi tên:** Danh sách các cột đã được bạn hoặc hệ thống đổi tên chuẩn.
- **Giá trị thiếu đã điền:** Tổng số ô trống đã được điền số trung vị hoặc nhãn phân loại.
- **Giá trị không đọc được đã thay:** Số lượng ô chữ bị lỗi trong cột số đã được quy đổi sang số trung vị.
- **Chuẩn hóa định dạng:** Đối với những cột được chuyển đổi chỉ về mặt định dạng, hệ thống thông báo bằng dòng tóm tắt tinh gọn:  
  *“Cột [Tên cột]: đã chuyển X ô sang dạng số/ngày”*.

## 2. Bảng xem trước dữ liệu đã xử lý (200 dòng) {#preview-table}

Bảng dữ liệu bên dưới hiển thị 200 dòng mẫu đầu tiên sau khi đã áp dụng thuật toán làm sạch:

- **Tô màu ô thay đổi (`ui:legend.changed`):**  
  Mọi ô có giá trị thực tế bị thay đổi (như ô trống được điền hoặc ô lỗi được sửa) đều được tô màu xanh ngọc bích êm dịu kèm viền rõ nét.
- **Tooltip đối chiếu "cũ → mới":**  
  Khi bạn rê chuột lên bất kỳ ô màu xanh nào, một bảng chú giải nhỏ sẽ hiện lên tức thì cho bạn biết chính xác:  
  `Giá trị cũ: "..." → Giá trị mới: "..."`  
  kèm theo lý do thay đổi (ví dụ: *"Không đọc được thành số → thay bằng trung vị"* hoặc *"Điền ô trống"*).
- **Không gây rối mắt với ô chỉ đổi định dạng:**  
  Các ô chỉ đổi cách viết tiền tệ hoặc ngày tháng sẽ hiển thị dưới dạng văn bản bình thường để bạn dễ đọc bảng tính.

## 3. Minh họa trực quan Báo cáo sai khác {#diff-visual}

```dm-diff
{
  "columns": ["id", "ho_ten", "luong_thang", "ngay_sinh", "phong_ban"],
  "before": [
    [1, "Nguyễn Văn A", "10,000,000 VND", "2000-05-15", "Kế toán"],
    [2, "Trần Thị B", "lỗi số liệu", "1998-12-20", null],
    [3, "Lê Văn C", null, "1995-03-10", "Kinh doanh"]
  ],
  "after": [
    [1, "Nguyễn Văn A", 10000000, "2000-05-15", "Kế toán"],
    [2, "Trần Thị B", 12500000, "1998-12-20", "Không xác định"],
    [3, "Lê Văn C", 12500000, "1995-03-10", "Kinh doanh"]
  ],
  "note": "Rê chuột vào ô 12,500,000 của dòng 2 sẽ thấy: Giá trị cũ: 'lỗi số liệu' → Mới: 12500000 (Không đọc được thành số → thay bằng trung vị). Rê chuột vào ô của dòng 1 chỉ thấy thông báo đã chuẩn hóa định dạng."
}
```

## 4. Quyết định bước tiếp theo {#next-action}

Ở góc dưới bên phải màn hình kiểm duyệt, bạn có 2 lựa chọn:

- `ui:cleaner.use_this` (**Xác nhận dùng bản này**):  
  Bạn hài lòng với kết quả làm sạch tự động của hệ thống. Bấm nút này để chốt tập dữ liệu và chuyển thẳng sang phân hệ Trực quan hóa dữ liệu.
- `ui:cleaner.edit_more` (**Sửa thủ công tiếp**):  
  Nếu bạn thấy có một vài ô cần chỉnh sửa lại theo ý riêng, hãy bấm nút này. Toàn bộ kết quả vừa xử lý sẽ được giữ nguyên và đưa vào Không gian làm việc thủ công để bạn tiếp tục tinh chỉnh.

