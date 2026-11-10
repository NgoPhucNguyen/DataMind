---
title: Cột không có biểu đồ
updated: 2026-11-08
related:
  - profiler/attention
  - cleaner/issue-types
  - report/appendix
---

# Cột không có biểu đồ {#skipped-columns}

Trong quá trình trực quan hóa, bạn có thể nhận thấy một số cột có trong bảng dữ liệu nhưng không xuất hiện biểu đồ nào ở tab Phân phối. Ở cuối danh sách biểu đồ, DataMind bố trí một bảng thông báo có thể thu gọn mang tên `ui:visualize.skipped_panel` để giải thích tường tận nguyên nhân cho từng cột.

## 3 lý do cột bị bỏ qua {#three-reasons}

Một cột dữ liệu bị tạm thời không vẽ biểu đồ khi rơi vào một trong 3 trường hợp thống kê sau:

1. **Trống trên 60% (`missing_high`):**
   - *Thông báo:* "Trống XX% — quá ít dữ liệu để vẽ."
   - Khi tỷ lệ ô trống vượt quá ngưỡng 60%, số lượng phản hồi còn lại không còn đủ tính đại diện để dựng biểu đồ phân phối khoa học. Việc vẽ biểu đồ từ một cột bị khuyết đa số rất dễ dẫn đến những kết luận sai lầm.

2. **Chỉ có một giá trị duy nhất (`single_value`):**
   - *Thông báo:* "Mọi dòng có cùng một giá trị, không có gì để so sánh."
   - Ví dụ: Cột *Quốc gia* mà 100% người trả lời đều ghi là *"Việt Nam"*. Một cột không hề có độ biến thiên thì không thể so sánh hay phân loại thành các cột biểu đồ.

3. **Văn bản tự do (`free_text`):**
   - *Thông báo:* "Câu trả lời tự do không vẽ được. Nếu thực ra là danh mục, đổi kiểu ở bước Kiểm tra dữ liệu."
   - Các cột chứa câu văn dài, đoạn văn nhận xét đóng góp ý kiến, họ tên hoặc địa chỉ email không có cấu trúc cố định nên không thể tổng hợp thành các cột số lượng.

## Cách kích hoạt lại biểu đồ cho cột {#how-to-fix}

Nếu một cột bị xếp vào dạng Văn bản tự do nhưng trên thực tế chỉ bao gồm các câu trả lời ngắn lặp lại (ví dụ cột ghi tên Chi nhánh hoặc Phòng ban):

1. Bấm vào đường link dẫn hiển thị ngay trên dòng thông báo lỗi: **"đổi kiểu ở bước Kiểm tra dữ liệu"**.
2. Hệ thống sẽ đưa bạn trở lại màn hình Đánh giá dữ liệu (Profiler).
3. Tại cột đó, bấm vào menu chọn kiểu dữ liệu và chuyển từ `Text` sang `Categorical` (Danh mục).
4. Lưu thay đổi và quay lại Visualize: Biểu đồ phân phối của cột này sẽ xuất hiện ngay lập tức.

## Vì sao Tab Tương quan chỉ chứa các cột số? {#correlation-numeric-only}

Trong tab Tương quan (Correlation), bạn sẽ chỉ nhìn thấy các cột số nguyên, số thực hoặc các thang đo đánh giá:

- Hai thuật toán tương quan chuẩn được hệ thống áp dụng là **Pearson** và **Spearman**:
  - Pearson đo lường mối quan hệ tuyến tính dựa trên giá trị số học cụ thể.
  - Spearman đo lường mối quan hệ đồng biến hoặc nghịch biến dựa trên thứ bậc sắp xếp (ranks).
- Cả hai phương pháp thống kê này đều bắt buộc dữ liệu đầu vào phải là số lượng định lượng. Các cột văn bản định tính hoặc danh mục không có thứ bậc số học sẽ không thể tính toán hiệp phương sai, do đó được hệ thống tự động loại trừ khỏi ma trận tương quan để đảm bảo tính chuẩn xác.

