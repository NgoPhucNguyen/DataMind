---
title: Ghi đè kiểu dữ liệu và Ảnh hưởng
updated: 2026-11-02
---

# Ghi đè kiểu dữ liệu và Ảnh hưởng {#override}

Mặc dù giải thuật nhận diện tự động có độ chính xác rất cao, nhưng trong một số trường hợp nghiệp vụ, máy móc không thể hiểu hết ý định của người thu thập dữ liệu (ví dụ: cột "Mã bưu điện" chứa các con số như 70000, 10000 nhưng về bản chất đây là mã định danh khu vực chứ không phải số lượng để cộng trừ).

Hệ thống cho phép bạn ghi đè kiểu dữ liệu một cách dễ dàng và hoàn toàn miễn phí.

## Cách thay đổi kiểu dữ liệu của cột {#override-how-to}

1. Tìm cột bạn muốn điều chỉnh trong bảng **Cấu trúc cột & Vấn đề dữ liệu**.
2. Bấm vào nút `ui:profiler.type_dropdown` hiển thị tại cột "Ghi đè kiểu".
3. Chọn một trong 5 kiểu bạn mong muốn: `ui:type.numeric`, `ui:type.datetime`, `ui:type.categorical`, `ui:type.multiple_choice`, `ui:type.text`.
4. Nút bấm sẽ đổi màu sang viền vàng cam và hiện dòng chữ nhỏ: `ui:profiler.changed_from` kèm nút **"Hoàn tác"**.
5. Bạn có thể bấm nút **"Hoàn tác"** bất cứ lúc nào để trả cột về đúng kiểu tự động ban đầu.

```dm-callout tip
Việc ghi đè kiểu dữ liệu tại bước Đánh giá dữ liệu hoàn toàn MIỄN PHÍ và không tiêu tốn lượt dùng AI.
```

## Ảnh hưởng trực tiếp tới bước Làm sạch (Cleaner) {#override-impact-cleaner}

Khi bạn đổi kiểu cột, bộ phận Làm sạch dữ liệu tự động (Auto-Clean) sẽ áp dụng các quy tắc tương ứng:

- **Nếu đổi sang `ui:type.numeric`**:
  - Giá trị lỗi hoặc ô trống sẽ được tự động điền bằng **số trung vị (median)** của cột.
  - Các ký tự văn bản hoặc ký hiệu tiền tệ bị bóc tách để chuyển đổi thành số thực tế.
- **Nếu đổi sang `ui:type.categorical` hoặc `ui:type.multiple_choice`**:
  - Các ô trống được tự động điền bằng nhãn **"Không xác định"**.
- **Nếu đổi sang `ui:type.datetime`**:
  - Cột được chuẩn hóa sang định dạng ngày giờ chuẩn.
  - Các ô trống được **giữ nguyên** (không tự tiện điền ngày giả định).
- **Nếu đổi sang `ui:type.text`**:
  - Bỏ qua toàn bộ các bước kiểm tra cấu trúc, không chuẩn hóa số và không điền khuyết tự động.

## Ảnh hưởng tới bước Trực quan hóa (Visualize) {#override-impact-visualize}

- **Gợi ý biểu đồ thay đổi tức thì**: Ngay khi bạn chọn kiểu mới, các huy hiệu gợi ý biểu đồ ở cột bên cạnh sẽ lập tức cập nhật theo kiểu mới mà không cần tải lại trang.
- **Mở khóa biểu đồ tương thích**: Ví dụ, nếu bạn đổi một cột số sang `ui:type.categorical`, hệ thống sẽ mở khóa biểu đồ `ui:chart.pie` cho cột đó tại tab Trực quan hóa.
