---
title: 4 lý do cột cần xem xét
updated: 2026-11-02
related:
  - cleaner/find-errors
  - cleaner/auto-clean
  - visualize/skipped-columns
---

# 4 lý do cột cần xem xét {#attention}

Khi phân tích xong bảng tính, nếu phát hiện bất thường, màn hình Đánh giá dữ liệu sẽ hiển thị ngay một nút màu vàng cam: `ui:profiler.attention_chip`. Bạn chỉ cần bấm vào nút này để lọc nhanh bảng chỉ hiển thị những cột có vấn đề cần can thiệp.

Một cột chỉ bị đưa vào danh sách cần xem khi thỏa mãn **ít nhất 1 trong 4 lý do nghiêm ngặt** sau:

```dm-callout tip
Cột kiểu `ui:type.text` thông thường KHÔNG bị coi là có vấn đề và sẽ không kích hoạt cảnh báo này.
```

## 1. Thiếu hơn 60% dữ liệu {#attention-missing-60}

- **Hiện tượng**: Tỷ lệ ô trống vượt quá 60% tổng số dòng.
- **Biểu tượng**: Cảnh báo màu đỏ "Thiếu hơn 60% dữ liệu" nằm cạnh tên cột.
- **Tại sao cần xem**: Cột bị khuyết thiếu quá nặng có thể không còn đại diện chính xác cho toàn bộ tập dữ liệu. Nếu bạn để Auto-Clean chạy và tỷ lệ này vượt qua 90%, cột sẽ bị tự động loại bỏ hoàn toàn.
- **Bạn nên làm gì**: Đánh giá xem cột này có bắt buộc cho bài toán kinh doanh hay không. Nếu không quan trọng, bạn có thể chủ động bỏ qua hoặc để hệ thống xử lý loại bỏ.

## 2. Chỉ có 1 giá trị duy nhất {#attention-unique-1}

- **Hiện tượng**: Số lượng giá trị duy nhất bằng 1 (toàn bộ các dòng hợp lệ đều chứa một nội dung y hệt nhau, không có sự thay đổi).
- **Biểu tượng**: Cảnh báo màu cam "Chỉ có 1 giá trị duy nhất" nằm cạnh tên cột.
- **Tại sao cần xem**: Trong phân tích dữ liệu, một trường thông tin không có sự biến thiên thì không thể dùng để so sánh, phân nhóm hay tìm mối tương quan. Hệ thống sẽ tắt chức năng vẽ biểu đồ cho cột này.
- **Bạn nên làm gì**: Cân nhắc xem cột này có cần thiết phải đưa vào báo cáo hay không.

## 3. Cột số bị lưu dưới dạng văn bản (Có thể là số) {#attention-disguised-numeric}

- **Hiện tượng**: Dữ liệu thực chất là các con số nhưng bị chèn thêm ký tự tiền tệ (`$`, `đ`, `VND`), dấu phần trăm `%`, dấu phẩy phân cách hàng nghìn (ví dụ: `100,000`), hoặc dấu ngoặc đơn số âm `(100)` với tỷ lệ từ 60% trở lên.
- **Biểu tượng**: Huy hiệu chữ nhật màu cam ghi nhãn **"Có thể là số"**.
- **Thông báo**: "Cột chứa dữ liệu số nhưng lưu dưới dạng văn bản. Hãy ghi đè kiểu để chuyển đổi."
- **Tại sao cần xem**: Nếu để nguyên dạng chữ, bạn sẽ không thể tính trung bình cộng, không thể vẽ biểu đồ phân phối và không thể tìm giá trị lớn nhất/nhỏ nhất.
- **Bạn nên làm gì**: Hệ thống đã tự động gán kiểu gợi ý là `ui:type.numeric`. Bạn chỉ cần để nguyên để bước Làm sạch tự động chuyển đổi thành số thực tế.

## 4. Cột chưa có tên trong file gốc {#attention-unnamed}

- **Hiện tượng**: File gốc của bạn có một cột dữ liệu nhưng dòng tiêu đề đầu tiên bị bỏ trống. Hệ thống sẽ tự động hiển thị tên tạm đại diện như `Cột không tên (A)`.
- **Dòng thông báo**: Dòng chữ màu xanh dương *"Cột này chưa có tên — bạn có thể đặt lại tên ở bước Làm sạch (menu thao tác thủ công)."*
- **Tại sao cần xem**: Cột không có tên rõ ràng sẽ khiến người xem báo cáo không hiểu được ý nghĩa con số bên trong.
- **Bạn nên làm gì**: Khi chuyển sang bước Làm sạch, bạn có thể vào menu thao tác thủ công để đổi lại tên cột theo đúng ý nghĩa thực tế.
