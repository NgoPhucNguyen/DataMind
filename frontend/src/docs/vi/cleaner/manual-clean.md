---
title: Sửa thủ công & Không gian làm việc
updated: 2026-11-04
---

# Sửa thủ công & Không gian làm việc {#manual-clean}

Nếu bạn muốn nắm quyền kiểm soát chi tiết từng ô dữ liệu hoặc áp dụng các công thức tính toán theo ý muốn riêng, hãy bấm nút `ui:cleaner.manual` (hoặc `ui:cleaner.edit_more`). Hệ thống sẽ đưa bạn vào **Không gian làm việc sửa thủ công (Manual Clean Workspace)**.

## 1. Chế độ hướng dẫn (Guided Mode) & Hộp thoại Guided Fix {#guided-mode}

Ở chế độ mặc định, khi bạn click chuột vào bất kỳ ô lỗi nào trên bảng xem trước, một hộp thoại thông minh sẽ xuất hiện với 4 tùy chọn rõ ràng:

1. `ui:cleaner.cell_apply_suggestion` (**Áp dụng gợi ý**):  
   Nếu hệ thống có tính toán sẵn giá trị gợi ý (ví dụ số trung vị cho ô số hoặc nhãn phân loại), bạn chỉ cần bấm 1 click để đưa giá trị này vào ô.
2. `ui:cleaner.cell_edit` (**Sửa giá trị**):  
   Mở ô nhập liệu cho phép bạn gõ trực tiếp giá trị mong muốn.
3. `ui:cleaner.cell_set_empty` (**Đặt thành rỗng**):  
   Chuyển ô về trạng thái rỗng (`null` thực sự).
   *Mẹo nhỏ:* Nếu bạn muốn lưu chữ `"null"` như một đoạn văn bản bình thường, hãy gõ chữ "null" vào ô. Nếu bạn xóa sạch nội dung và bấm Lưu, hệ thống sẽ hiểu là bạn muốn để ô rỗng hoàn toàn.
4. `ui:cleaner.cell_ignore` (**Bỏ qua**):  
   Đánh dấu ô lỗi thành trạng thái đã bỏ qua (`ui:legend.ignored`) nếu bạn cho rằng giá trị đó hoàn toàn bình thường trong ngữ cảnh công việc của bạn.

## 2. Chế độ sửa tự do (Full-Edit Mode) {#full-edit-mode}

Khi bạn cần sửa các ô không bị gắn cờ lỗi (ví dụ sửa lại chính tả tên một khách hàng hay chỉnh lại số liệu khảo sát):
- Bấm nút `ui:cleaner.full_edit` trên thanh công cụ.
- Bảng dữ liệu sẽ chuyển sang trạng thái cho phép bạn nhấp đúp và chỉnh sửa nội dung của **bất kỳ ô nào** trên bảng.
- Sau khi chỉnh sửa xong các ô, nút `ui:cleaner.save` sẽ sáng lên hiển thị số ô đang chờ ghi nhận. Hãy bấm nút này để hệ thống lưu lại các thay đổi của bạn.

## 3. Menu thao tác nhanh tại đầu mỗi cột {#column-header-menu}

Bên cạnh tiêu đề của mỗi cột, bạn sẽ nhìn thấy nút menu ba chấm `ui:cleaner.header_menu`. Khi bấm vào, bạn có thể thực thi các thao tác cấp độ toàn cột:

- **Đổi tên cột:** Đặt lại tên cột ngắn gọn, dễ hiểu trước khi đưa vào biểu đồ.
- **Xóa cột:** Loại bỏ hoàn toàn một cột không cần thiết ra khỏi tập dữ liệu.
- **Điền khuyết bằng Trung bình (Mean):** Dành cho những ai muốn điền giá trị trung bình cộng thay vì số trung vị.
- **Điền khuyết bằng "Không xác định":** Gán nhãn cho tất cả các ô trống còn lại trong cột.

## 4. Nhật ký thao tác & Cơ chế Hoàn tác (Undo) {#action-log-undo}

Mỗi khi bạn thực hiện một thao tác (xóa cột, đổi tên, sửa ô), thao tác đó sẽ được ghi nhận vào bảng **Nhật ký thao tác** ở góc phải màn hình:
- Bạn luôn biết rõ mình đã làm những gì và theo thứ tự nào.
- Nếu lỡ tay xóa nhầm một cột hoặc sửa sai, bạn chỉ cần bấm vào biểu tượng thùng rác bên cạnh thao tác đó để **Hoàn tác (Undo)** ngay lập tức. Dữ liệu bảng sẽ quay trở về trạng thái trước đó trong chớp mắt.

## 5. Nút Hoàn tất & Áp dụng toàn file {#finalize-manual}

Khi bạn đã hoàn thành việc rà soát và chỉnh sửa ưng ý trên bảng mẫu:
- Bấm nút `ui:cleaner.finalize` (Hoàn tất) trên thanh công cụ ghim ở đáy trang.
- Hệ thống sẽ tự động tổng hợp toàn bộ các thao tác bạn đã thực hiện và áp dụng một lượt lên **toàn bộ 100% dòng dữ liệu** của cả tệp dữ liệu gốc.

