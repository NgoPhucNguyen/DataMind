---
title: Chốt dữ liệu & Chuyển sang Trực quan hóa
updated: 2026-11-04
---

# Chốt dữ liệu & Chuyển sang Trực quan hóa {#confirm-and-next}

Khi bạn bấm `ui:cleaner.use_this` từ màn hình Báo cáo sai khác hoặc bấm `ui:cleaner.finalize` trong chế độ sửa thủ công, hệ thống sẽ tiến hành chốt tập dữ liệu và chuyển bạn đến màn hình **Xác nhận thành công (Confirmed View)**.

## 1. Màn hình xác nhận thành công {#confirmed-view}

Tại màn hình này, bạn sẽ nhận được thông báo rõ ràng về trạng thái của tệp dữ liệu:

- **Mã phiên làm việc (Session ID):** Một chuỗi mã định danh duy nhất (ví dụ: `550e8400-e29b-41d4...`) gắn liền với bản dữ liệu sạch của bạn trong hệ thống.
- **Phương thức xử lý:** Ghi nhận phương thức bạn đã áp dụng (*Làm sạch tự động*, *Chỉnh sửa thủ công* hoặc *Đã bỏ qua làm sạch*).
- **Tóm tắt số liệu bàn giao:** Hiển thị số lượng dòng dữ liệu, số lượng cột dữ liệu và số lượng cột thuộc từng kiểu (cột số, cột danh mục, cột ngày tháng) sẵn sàng chuyển giao sang phân hệ kế tiếp.

## 2. Kiểm tra chất lượng dữ liệu (Quality Validation) {#quality-check}

Trước khi bàn giao sang bước Trực quan hóa, máy chủ tự động thực hiện bài kiểm tra tiêu chuẩn chất lượng:
- **Đủ số lượng dòng tối thiểu:** Tập dữ liệu phải có ít nhất 2 dòng dữ liệu để có thể so sánh và vẽ biểu đồ.
- **Có ít nhất một cột phân tích được:** Bảng phải có ít nhất một cột dạng số (để tính toán giá trị) hoặc dạng phân loại (để phân nhóm).
- **Dữ liệu không hoàn toàn rỗng:** Đảm bảo không còn cột nào bị trống 100%.

Nếu dữ liệu đáp ứng đầy đủ các tiêu chuẩn này, bạn sẽ nhận được huy hiệu màu xanh bảo chứng an toàn để tiếp tục.

## 3. Tải tệp dữ liệu sạch về máy tính {#download-clean-file}

Dữ liệu sau khi làm sạch không chỉ phục vụ cho DataMind mà còn là tài sản hữu ích của bạn:
- Bạn có thể tải ngay tệp bảng tính đã làm sạch định dạng CSV chuẩn Unicode về máy tính.
- Tệp sạch này hoàn toàn tương thích và có thể mở mượt mà trên Microsoft Excel, Google Sheets, SPSS hay Power BI mà không lo bị lỗi font hay sai số liệu.

## 4. Chuyển sang Trực quan hóa dữ liệu {#to-visualize}

Để bắt đầu khám phá các biểu đồ trực quan sinh động từ tập dữ liệu vừa được làm sạch:
- Bấm nút `ui:cleaner.to_visualize` (**Trực quan hóa dữ liệu**) nổi bật ở góc phải màn hình.
- Hệ thống sẽ tự động đưa bạn sang Module 3:
  - Tự động gợi ý các mẫu biểu đồ phù hợp nhất với cấu trúc dữ liệu của bạn.
  - Cho phép tùy chọn các loại biểu đồ: Cột, Đường, Tròn, Phân phối, Phân tán...
  - Hỗ trợ phân tích nhóm, tính toán tỷ trọng và trích xuất thông điệp từ số liệu.

```dm-callout:tip
**Lưu ý về thời hạn 5 giờ:** Phiên làm việc với dữ liệu sạch được lưu trữ trong bộ nhớ tạm tối đa **5 giờ**. Nếu bạn đóng trình duyệt và quay lại trong vòng 5 giờ, hệ thống vẫn giữ nguyên trạng thái làm việc của bạn. Sau 5 giờ, phiên sẽ tự động hết hạn để bảo mật dữ liệu.
```

