---
title: Tự động sửa với 1 cú click
updated: 2026-11-04
related:
  - profiler/data-types
  - visualize/to-report
  - report/methodology
---

# Tự động sửa với 1 cú click {#auto-clean}

Chế độ **Tự động sửa (Auto-Clean)** được kích hoạt thông qua nút `ui:cleaner.auto` tại thanh điều hướng đáy màn hình. Đây là giải pháp hoàn hảo giúp bạn giải quyết toàn bộ các vấn đề dữ liệu phổ biến nhất chỉ trong một nốt nhạc dựa trên các quy tắc chuẩn mực ngành khoa học dữ liệu.

## Quy trình 3 bước xử lý tự động {#pipeline}

Khi bạn bấm nút `ui:cleaner.auto`, máy chủ sẽ thực thi chuỗi quy trình làm sạch tuần tự như sau:

1. **Bước 1: Quét & Xóa các cột quá rỗng (`>= 90%` ô trống)**:  
   Nếu một cột gần như không có dữ liệu (90% trở lên là ô trống), giữ lại cột này chỉ làm tốn diện tích và gây nhiễu biểu đồ. Hệ thống sẽ tự động gỡ bỏ cột đó.
2. **Bước 2: Xóa toàn bộ các dòng trùng lặp**:  
   Hệ thống quét toàn bộ file, giữ lại dòng đầu tiên xuất hiện và loại bỏ các dòng bị lặp lại phía sau.
3. **Bước 3: Chuẩn hóa & Điền khuyết từng cột theo đúng kiểu dữ liệu**:  
   Lọc sạch các ký tự lỗi font, ép kiểu dữ liệu về dạng chuẩn và áp dụng chiến lược điền khuyết tương ứng.

## Quy tắc điền khuyết chi tiết theo kiểu dữ liệu {#fill-strategies}

Hệ thống tuân thủ chặt chẽ nguyên lý: *Hành động thực tế luôn khớp 100% với nội dung gợi ý*:

- **Cột Số (Numeric):**
  Điền bằng **số trung vị (Median)** của tất cả các ô hợp lệ trong cột.
  *Đặc biệt với cột số nguyên:* Nếu toàn bộ các giá trị hiện có trong cột đều là số nguyên (ví dụ: tuổi, số lượng sản phẩm, số ngày công), hệ thống sẽ làm tròn trung vị và chuyển cột sang kiểu số nguyên chuẩn (`Int64`), tránh tình trạng tuổi bị điền thành `24.5` hay số lượng hàng thành `12.7`.
- **Cột Danh mục (Categorical) & Nhiều lựa chọn (Multiple Choice):**
  Điền bằng giá trị quy ước chuẩn: `"Không xác định"`. Nhờ đó, khi bạn vẽ biểu đồ tròn hay biểu đồ cột, những ô trống này sẽ được gom thành một nhóm riêng rõ ràng mà không làm mất dòng dữ liệu.
- **Cột Thời gian (Datetime):**
  **Giữ nguyên rỗng (không điền)**. Hệ thống không bao giờ tự ý gán ngày giả mạo (như 01/01/1970) vì điều đó sẽ làm sai lệch hoàn toàn biểu đồ xu hướng thời gian của bạn.
- **Cột Văn bản tự do (Text):**
  **Bỏ qua hoàn toàn (Skip)**. Các cột ghi chú, phản hồi khảo sát hay mô tả chi tiết được giữ nguyên trạng thái nguyên bản của người nhập.

## Phân biệt 3 loại chuyển đổi ô dữ liệu {#change-types}

Để giúp bạn nắm bắt chính xác mức độ can thiệp vào dữ liệu, hệ thống phân định rạch ròi 3 khái niệm:

1. **Điền ô trống (`missing_filled`):**
   Ô ban đầu vốn dĩ bị bỏ trống hoàn toàn, nay được hệ thống tính toán và bù đắp bằng một giá trị hợp lý (ví dụ: điền số trung vị hoặc `"Không xác định"`). Ô này được tô màu xanh lá nổi bật trên bảng.
2. **Thay giá trị không đọc được (`invalid_replaced`):**
   Ô ban đầu **có chứa chữ** (ví dụ: người nhập gõ nhầm chữ `"lỗi số liệu"` hoặc `"chưa có"` vào cột tiền lương). Khi hệ thống chuyển cột sang định dạng số, giá trị này không đọc được nên bị biến thành rỗng, sau đó được thay bằng số trung vị của cột. Trên bảng sai khác, ô này được tô màu xanh kèm lý do rõ ràng: *"Không đọc được thành số → thay bằng trung vị"*.
3. **Chỉ đổi định dạng (`format_normalized`):**
   Bản chất giá trị không thay đổi, chỉ có cách biểu diễn được chuẩn hóa cho máy tính đọc (ví dụ: chuyển `"10,000,000 VND"` thành số `10000000`, hoặc `"15/03/2023"` thành `"2023-03-15"`).
   
```dm-callout:tip
**Tại sao chuyển đổi định dạng không bị tô màu ô?**  
Để bảo vệ thị giác của bạn và tránh làm rối mắt, những ô **chỉ đổi định dạng** sẽ được hiển thị như dữ liệu bình thường (không tô viền xanh lá trên từng ô). Bạn vẫn có thể xem tổng số ô đã chuẩn hóa này trong Báo cáo thay đổi (Diff Report).
```

## Minh họa Before / After thực tế {#example-diff}

Dưới đây là bảng ví dụ minh họa cách Auto-Clean xử lý các trường hợp trên:

```dm-diff
{
  "columns": ["id", "ho_ten", "luong_thang", "ngay_sinh", "phong_ban"],
  "before": [
    [1, "Nguyễn Văn A", "10,000,000 VND", "2000-05-15", "Kế toán"],
    [2, "Trần Thị B", "lỗi số liệu", "1998-12-20", null],
    [2, "Trần Thị B", "lỗi số liệu", "1998-12-20", null],
    [3, "Lê Văn C", null, "1995-03-10", "Kinh doanh"]
  ],
  "after": [
    [1, "Nguyễn Văn A", 10000000, "2000-05-15", "Kế toán"],
    [2, "Trần Thị B", 12500000, "1998-12-20", "Không xác định"],
    [3, "Lê Văn C", 12500000, "1995-03-10", "Kinh doanh"]
  ],
  "note": "Kết quả Auto-Clean: Dòng trùng lặp #2 bị loại bỏ; Cột lương tháng được ép sang dạng số (ô dòng 1 chỉ đổi định dạng không tô màu; ô dòng 2 là chữ lỗi được thay bằng trung vị 12,500,000; ô dòng 3 rỗng được điền trung vị 12,500,000); Cột phòng ban rỗng ở dòng 2 được điền 'Không xác định'."
}
```

