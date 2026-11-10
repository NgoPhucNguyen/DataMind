---
title: Tổng quan Làm sạch dữ liệu
updated: 2026-11-04
related:
  - profiler/overview
  - visualize/overview
  - report/methodology
---

# Tổng quan Làm sạch dữ liệu {#overview}

Sau khi hoàn tất bước Đánh giá dữ liệu (Profiler), hệ thống DataMind sẽ đưa bạn đến bước **Làm sạch dữ liệu (Cleaner)**. Đây là chặng xử lý quan trọng giúp dữ liệu của bạn trở nên chuẩn xác, đồng nhất và sẵn sàng để tạo nên những biểu đồ trực quan sắc nét mà không gặp phải lỗi gián đoạn.

```flow
nhan:
- Kiểu dữ liệu 5 loại đã xác nhận từ 1. Profiler
- Danh sách cột cần chú ý & tỷ lệ ô trống
chuyen:
- Bảng dữ liệu sạch chuẩn hóa sang 3. Visualize
- Nhật ký thao tác & khóa băm làm sạch sang 4. Report
```

```dm-callout:tip
Quá trình làm sạch dữ liệu tại DataMind hoàn toàn không ghi đè lên tệp gốc của bạn. Bạn luôn có thể tải lại file hoặc thử nghiệm các thao tác mà không sợ mất mát dữ liệu ban đầu.
```

## Làm sạch dữ liệu giải quyết vấn đề gì? {#why-clean}

Trong thực tế thu thập dữ liệu (khảo sát Google Forms, xuất từ phần mềm kế toán, file Excel nhập tay), các bảng tính hầu như luôn chứa các hạt sạn gây lỗi:
- Các ô bị bỏ trống khiến thuật toán không vẽ được biểu đồ hoặc tính sai tỷ lệ phần trăm.
- Cột số bị gõ lẫn chữ (như `"10,000,000 VND"` hay chữ `"lỗi số liệu"`) khiến hệ thống không thể tính tổng hay vẽ biểu đồ cột.
- Ký tự tiếng Việt bị lỗi font (ký tự lạ, ký tự điều khiển ẩn).
- Các dòng bị gửi trùng lặp nhiều lần hoặc các dòng khảo sát dở dang chỉ có 1-2 ô có chữ.

## 3 lựa chọn xử lý dữ liệu {#three-branches}

Tại thanh công cụ đáy của màn hình, DataMind cung cấp cho bạn 3 hướng tiếp cận linh hoạt:

1. `ui:cleaner.auto` — **Tự động sửa một chạm**:
   Hệ thống tự động thực hiện trọn gói: xóa các cột rỗng trên 90%, xóa dòng trùng lặp, dọn dẹp ký tự lạ, chuyển cột về đúng định dạng số/ngày và điền giá trị khuyết theo chuẩn thống kê. Phù hợp cho 90% nhu cầu xử lý nhanh.

2. `ui:cleaner.manual` — **Sửa thủ công theo ý bạn**:
   Mở ra không gian làm việc chi tiết cho phép bạn bấm vào từng ô lỗi để xem gợi ý, sửa giá trị trực tiếp, đổi tên cột, xóa cột tùy chọn hoặc lựa chọn công thức điền khuyết nâng cao.

3. `ui:cleaner.skip` — **Bỏ qua bước làm sạch**:
   Nếu bạn tự tin tập dữ liệu của mình đã hoàn toàn chuẩn chỉnh, bạn có thể bỏ qua bước này để đi thẳng tới vẽ biểu đồ tại phân hệ Trực quan hóa.

## Vùng xem trước 200 dòng và Phạm vi áp dụng {#preview-scope}

Để đảm bảo trang web luôn phản hồi mượt mà trong chưa đầy nửa giây ngay cả khi tệp của bạn có hàng chục nghìn dòng, bảng dữ liệu trên màn hình chỉ hiển thị **200 dòng đầu tiên** (`ui:cleaner.preview_rows`).

```dm-callout:warning
**Lưu ý quan trọng về phạm vi:** Mặc dù bảng chỉ hiển thị 200 dòng mẫu, nhưng khi bạn bấm `ui:cleaner.auto` hoặc `ui:cleaner.finalize`, tất cả các quy tắc làm sạch sẽ được áp dụng lên **toàn bộ 100% dòng dữ liệu** của toàn bộ file. Thống kê số trung vị, số xuất hiện nhiều nhất hay kiểm tra dòng trùng lặp đều được tính toán chính xác trên toàn file.
```

## An toàn dữ liệu & Thời hạn lưu trữ {#data-safety}

- **Bảo toàn file gốc:** Mọi thao tác xử lý diễn ra trên bản sao độc lập trong bộ nhớ đệm tốc độ cao.
- **Thời hạn lưu file:** File dữ liệu tải lên được lưu tạm trong bộ nhớ đệm tối đa **5 giờ**. Sau thời gian này, dữ liệu sẽ tự động giải phóng để bảo đảm tính an toàn và quyền riêng tư tuyệt đối cho tài liệu của bạn.

## Bảng quy tắc & Ngưỡng làm sạch {#cleaner-rules}

Dưới đây là các định mức và quy tắc định lượng đang được áp dụng trong hệ thống:

```dm-rules cleaner
```

