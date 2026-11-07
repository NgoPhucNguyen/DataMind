---
title: 5 loại vấn đề dữ liệu thường gặp
updated: 2026-11-04
---

# 5 loại vấn đề dữ liệu thường gặp {#issue-types}

Khi bạn tải file vào hệ thống, DataMind sẽ tự động rà soát toàn bộ bảng dữ liệu và phân loại các vấn đề tìm thấy thành 5 nhóm rõ ràng.

## 1. Ô bị thiếu dữ liệu (Missing Values) {#missing-values}

Ô trống là những vị trí không có bất kỳ thông tin nào trong bảng (xuất hiện dưới dạng rỗng, `NaN` hoặc `null`).

- **Tại sao cần xử lý:** Khi một cột có quá nhiều ô trống, các phép tính trung bình, tổng tiền hoặc tỷ lệ phần trăm sẽ bị sai lệch nghiêm trọng.
- **Cách nhận biết trên màn hình:** Ô trống được viền màu cam nhạt kèm nhãn cảnh báo `ui:legend.pending`.
- **Ngưỡng xóa cột tự động:** Nếu một cột có từ **90% số dòng bị rỗng** trở lên, hệ thống sẽ tự động đề xuất xóa bỏ cột đó trong chế độ Tự động sửa để tinh gọn tập dữ liệu.

## 2. Sai kiểu dữ liệu (Wrong Types) {#wrong-types}

Xảy ra khi một cột chứa dữ liệu đáng lẽ là số nhưng lại bị lưu dưới dạng chữ.

- **Nguyên nhân phổ biến:**
  - Số tiền có kèm theo ký hiệu tiền tệ hoặc dấu phân cách: `"10,000,000 VND"`, `"50%"`, `"$25.5"`.
  - Cột số bị gõ lẫn ghi chú bằng chữ: `"không có"`, `"lỗi số liệu"`, `"N/A"`.
- **Cách xử lý:** Hệ thống sẽ nhận diện nếu cột có trên 80% giá trị có thể trích xuất ra số hợp lệ, từ đó đề xuất chuyển toàn bộ cột sang dạng số chuẩn.

## 3. Lỗi font & Ký tự mã hóa (Encoding Errors) {#encoding-errors}

Xảy ra khi tệp dữ liệu được lưu bằng bảng mã cũ hoặc xuất từ các phần mềm kế toán không tương thích hoàn toàn với chuẩn Unicode quốc tế.

- **Dấu hiệu:** Bạn sẽ thấy các ký tự bị biến thành hình ô vuông có dấu chấm hỏi `` hoặc chứa các mã điều khiển ẩn.
- **Khắc phục:** Hệ thống tự động lọc sạch các ký tự lỗi này để phục hồi văn bản tiếng Việt nguyên bản, sạch đẹp.

## 4. Dòng trùng lặp & Dòng gần như trống {#duplicates-near-empty}

Đây là hai vấn đề liên quan đến cấu trúc dòng cần bạn lưu tâm:

### Dòng trùng lặp hoàn toàn (Duplicate Rows)
- Hai hoặc nhiều dòng có nội dung giống hệt nhau ở tất cả các cột dữ liệu.
- Nguyên nhân thường do bấm gửi biểu mẫu nhiều lần hoặc gộp dữ liệu từ nhiều file con.
- Hệ thống sẽ giữ lại dòng đầu tiên và đánh dấu xóa các dòng lặp lại phía sau.

### Dòng gần như trống (Near-Empty Rows)
- Những dòng có trên **80% số cột là ô trống** (ví dụ bảng có 10 cột nhưng dòng chỉ có mỗi mã số, còn 9 cột kia bỏ trống hoàn toàn).
- Thường là các dòng khảo sát bị người dùng bỏ dở giữa chừng.

```dm-callout:warning
**Cảnh báo khi tỷ lệ vượt quá 20%:** Nếu tổng số dòng trùng lặp và dòng gần như trống chiếm hơn **20% tổng số dòng** của file, màn hình sẽ hiển thị banner màu vàng cảnh báo: *"Có X dòng trùng hoặc gần như trống (Y%) — kiểm tra trước khi xóa"*. Bạn nên mở xem trước danh sách dòng này để tránh xóa nhầm dữ liệu quan trọng của khách hàng chưa kịp điền đủ thông tin.
```

## 5. Lỗi ngữ nghĩa miền nghiệp vụ (Semantic Errors) {#semantic-errors}

Khác với lỗi cấu trúc máy móc, lỗi ngữ nghĩa là những lỗi vi phạm quy tắc thực tế của cuộc sống:
- Cột email chứa chuỗi không có đuôi `@gmail.com` hay `@company.com`.
- Cột số điện thoại chứa chữ cái hoặc quá ngắn (dưới 7 chữ số).
- Cột ngày tháng có ngày 31 tháng 2 hoặc ngày tháng trong tương lai vô lý.
- Cột họ tên chỉ gồm toàn chữ số.

### Vai trò của "Phân tích AI" tại bước Đánh giá (Profiler)
Để phát hiện được các lỗi nghiệp vụ tinh tế này, hệ thống cần biết được cột đó mang ý nghĩa gì. Ý nghĩa này được suy luận thông minh khi bạn bấm nút `ui:profiler.ai_analyze` (Phân tích AI) ở bước Đánh giá dữ liệu trước đó.

```dm-callout:cost
**Điều gì xảy ra nếu bạn bỏ qua Phân tích AI?**  
Nếu bạn không chạy AI ở bước Profiler, hệ thống sẽ tạm coi các cột này là văn bản thông thường (`GENERAL_TEXT`). Hệ thống sẽ hiển thị một dòng thông báo nhỏ:  
*"Chưa kiểm tra lỗi email, số điện thoại, họ tên… vì chưa dùng Phân tích AI ở bước Đánh giá. [Đến bước Kiểm tra dữ liệu để chạy AI]"*.  
Tuy nhiên, mọi lỗi cấu trúc cơ bản khác (ô trống, sai định dạng số, dòng trùng) vẫn được quét và sửa bình thường 100%!
```

