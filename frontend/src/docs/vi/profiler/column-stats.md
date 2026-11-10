---
title: Thống kê cột và Gợi ý biểu đồ
updated: 2026-11-02
related:
  - cleaner/find-errors
  - visualize/reading-insights
  - report/key-findings
---

# Thống kê cột và Gợi ý biểu đồ {#column-stats}

Bảng **Cấu trúc cột & Vấn đề dữ liệu** trên giao diện Đánh giá dữ liệu cung cấp các chỉ số thống kê cơ bản nhằm giúp bạn đánh giá nhanh tính toàn vẹn và mức độ phân tán của từng trường dữ liệu.

## Duy nhất (Unique Count) {#stat-unique-count}

Chỉ số **Duy nhất** cho biết số lượng phần tử phân biệt (không tính trùng lặp và không tính các ô trống) xuất hiện trong cột đó.

- **Ý nghĩa phân tích**:
  - Nếu số giá trị duy nhất rất ít (từ 2 đến 15): Dữ liệu mang tính phân nhóm danh mục rất rõ ràng, rất thích hợp để làm bộ lọc hoặc vẽ biểu đồ cơ cấu.
  - Nếu số giá trị duy nhất xấp xỉ bằng tổng số dòng của bảng: Đây thường là các cột định danh cá nhân (mã khách hàng, số điện thoại, email) hoặc các số đo liên tục có độ chi tiết cao.
- **Trường hợp đơn biến (Chỉ có 1 giá trị duy nhất)**: Cột bị coi là không có tính biến thiên. Hệ thống hiển thị cảnh báo "Chỉ có 1 giá trị duy nhất" và tự động tắt gợi ý biểu đồ vì việc vẽ đồ thị cho một thuộc tính không đổi là không mang lại giá trị phân tích.

## Rỗng% (Null Percentage) {#stat-null-pct}

Cột **Rỗng%** hiển thị tỷ lệ phần trăm số dòng bị thiếu thông tin hoặc để trống trong tổng số dòng của tập dữ liệu.

- **Thang đánh giá màu sắc trực quan**:
  - `0%` (Xám nhạt): Cột hoàn chỉnh, không có bất kỳ dòng nào bị khuyết thiếu.
  - `Dưới 30%` (Chữ đen bình thường): Tỷ lệ thiếu ở mức chấp nhận được, có thể dễ dàng bù đắp bằng các quy tắc điền khuyết ở bước Làm sạch.
  - `Từ 30% đến 60%` (Màu cam đậm): Cột thiếu dữ liệu đáng kể, cần cân nhắc trước khi sử dụng làm tiêu chí phân tích chính.
  - `Trên 60%` (Màu đỏ đậm): Kích hoạt cảnh báo "Thiếu hơn 60% dữ liệu", có nguy cơ làm sai lệch kết quả thống kê.

```dm-callout warning
Trong bước Làm sạch tự động, bất kỳ cột nào có tỷ lệ ô trống từ 90% trở lên sẽ bị hệ thống tự động loại bỏ để bảo vệ chất lượng dữ liệu.
```

## Gợi ý biểu đồ (Chart Hints) {#stat-chart-hints}

Tại mỗi dòng cột, hệ thống hiển thị sẵn các huy hiệu biểu đồ màu xanh lá đại diện cho các dạng trực quan hóa phù hợp nhất:
- `ui:chart.bar`: Thích hợp cho cột `ui:type.numeric`, `ui:type.categorical` và `ui:type.multiple_choice` để so sánh độ lớn giữa các nhóm.
- `ui:chart.pie`: Thích hợp cho `ui:type.categorical` ít nhóm hoặc `ui:type.multiple_choice` để quan sát tỷ trọng cơ cấu phần trăm.
- `ui:chart.line`: Thích hợp cho cột `ui:type.datetime` và `ui:type.numeric` để nhận biết xu hướng tăng giảm liên tục.
- `ui:chart.histogram`: Thích hợp cho cột `ui:type.numeric` để theo dõi hình chuông phân phối tần suất và các khoảng tập trung giá trị.
- **Không phù hợp để vẽ biểu đồ**: Xuất hiện ở các cột kiểu `ui:type.text` hoặc các cột chỉ có 1 giá trị duy nhất.
