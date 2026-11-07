---
title: Ngữ cảnh AI và Lĩnh vực dữ liệu
updated: 2026-11-02
---

# Ngữ cảnh AI và Lĩnh vực dữ liệu {#ai-context}

Tại khối **Ngữ cảnh của AI** bên dưới bảng cột, bạn có thể bổ sung ý nghĩa của file hoặc bấm nút để trí tuệ nhân tạo (AI) tự động đọc hiểu và tóm tắt toàn bộ tập dữ liệu.

## Mô tả ngữ cảnh dữ liệu {#context-description}

Ô nhập văn bản nhiều dòng cho phép bạn ghi lại bối cảnh kinh doanh của file (ví dụ: *"Dữ liệu khảo sát khách hàng mua sắm đồ gia dụng năm 2024"*).

- **Tự động lưu**: Mọi ký tự bạn gõ sẽ tự động được lưu đệm lên máy chủ sau 800 mili-giây. Bạn sẽ thấy dòng trạng thái `Đã lưu phân tích AI · HH:mm` ở góc trên.
- **Hoàn toàn miễn phí**: Việc gõ mô tả, chỉnh sửa và tự động lưu diễn ra liên tục mà không tốn bất kỳ lượt sử dụng AI nào.

## Tính năng "Phân tích AI" {#ai-analysis-feature}

Khi bạn bấm nút `ui:profiler.ai_analyze`:
1. Hệ thống sẽ trích xuất tên các cột, kiểu dữ liệu và tối đa 5 giá trị mẫu tiêu biểu gửi lên mô hình ngôn ngữ lớn (không gửi toàn bộ file).
2. AI phân tích và đưa ra:
   - **Lĩnh vực**: Dự đoán 1 trong 8 ngành chuẩn (Marketing, Nhân sự, Tài chính, Giáo dục, Y tế, Thương mại điện tử, Logistics hoặc Khác).
   - **Mức độ tin cậy**: Đánh giá độ chắc chắn của dự đoán.
   - **Bản nháp tóm tắt**: Viết 1-2 câu giải thích súc tích về ý nghĩa của tập dữ liệu và tự động điền vào ô mô tả cho bạn (gắn nhãn "Tạo bởi AI").

```dm-callout cost
Mỗi lần bạn bấm nút "Phân tích AI" hoặc nút phân tích lại, hệ thống sẽ trừ 1 lượt trong hạn mức AI hàng ngày của bạn (tài khoản Free: 3 lượt/ngày, tài khoản Pro: 20 lượt/ngày).
```

## Các mức độ tin cậy của AI {#ai-confidence-levels}

- **Độ tin cậy cao** (Huy hiệu xanh lá): Các thuộc tính và giá trị mẫu mang đặc trưng ngành nghề rất rõ nét (ví dụ: có các cột `giá_bán`, `doanh_thu`, `mã_đơn` $\rightarrow$ chắc chắn là Thương mại điện tử).
- **Cần xác nhận lại** (Huy hiệu vàng cam): Dữ liệu có tính đa dụng, chưa thể hiện rạch ròi một ngành duy nhất.
- **Tham khảo thêm** (Huy hiệu đỏ nhạt): Cột bị viết tắt hoặc giá trị mẫu quá ít để kết luận chắc chắn.

## Phân tích lại theo chỉnh sửa của bạn {#ai-reanalyze}

Nếu bạn nhận thấy AI đoán nhầm ngành (ví dụ dữ liệu điểm số sinh viên nhưng bị đoán thành Khảo sát nhân sự):
1. Bạn chỉ cần gõ thêm ghi chú vào ô văn bản: *"Đây là bảng điểm học kỳ của sinh viên khoa Kinh tế"*.
2. Nút `ui:profiler.ai_reanalyze` sẽ xuất hiện.
3. AI sẽ đọc lời hiệu chỉnh của bạn để điều chỉnh lại lĩnh vực và phân loại cho chính xác tuyệt đối.

## Bộ nhớ đệm và Trường hợp KHÔNG bị trừ lượt {#ai-cache-free}

- **Tự động lưu đệm (24 giờ)**: Khi một tệp dữ liệu đã được AI phân tích, kết quả sẽ được lưu an toàn trong 24 giờ. Nếu bạn tải lại trang (F5) hoặc quay lại bước Đánh giá dữ liệu sau khi làm việc ở các trang khác, hệ thống sẽ nạp lại ngay từ bộ nhớ đệm `ui:profiler.cached_badge` và **không trừ thêm bất kỳ lượt nào**.
- **Không trừ lượt khi AI gặp sự cố**: Nếu nhà cung cấp AI gặp sự cố kỹ thuật hoặc quá tải, hệ thống sẽ thông báo lỗi: *"Hiện chưa sử dụng được AI. Bạn không bị trừ lượt, vui lòng thử lại sau."* Số lượt của bạn được bảo toàn 100%.
