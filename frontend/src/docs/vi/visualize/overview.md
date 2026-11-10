---
title: Tổng quan Trực quan hóa
updated: 2026-11-08
related:
  - cleaner/overview
  - report/overview
  - profiler/overview
---

# Tổng quan Trực quan hóa dữ liệu {#overview}

Sau khi dữ liệu đã được chuẩn hóa tại bước Làm sạch (Cleaner), hệ thống DataMind đưa bạn đến bước **Trực quan hóa dữ liệu (Visualize)**. Phân hệ này tự động nhận diện kiểu dữ liệu của từng cột để dựng biểu đồ phù hợp, tính toán nhận xét thống kê tự động và sàng lọc các cặp chỉ số có tương quan đáng chú ý.

```flow
nhan:
- Tập dữ liệu sạch đã chuẩn hóa từ 2. Cleaner
- Thống kê phân phối & ma trận tương quan cột số
chuyen:
- Danh sách biểu đồ đã chọn sang 4. Report
- Bảng màu giao diện & giải thích kinh doanh của AI
```

```dm-callout:tip
Dữ liệu hiển thị tại phân hệ Visualize là dữ liệu đã được làm sạch hoàn chỉnh. Các biểu đồ bạn chọn tại đây sẽ được chuyển tiếp sang bước Báo cáo (Report) để kết xuất thành báo cáo tổng hợp hoặc xuất file DOCX/PDF.
```

## Vị trí trong luồng xử lý {#pipeline-position}

Quy trình xử lý dữ liệu chuẩn trên hệ thống DataMind gồm 4 chặng nối tiếp:

1. **Đánh giá dữ liệu (Profiler):** Đọc cấu trúc bảng, nhận diện kiểu cột, thống kê tỷ lệ khuyết và phát hiện vấn đề tiềm ẩn.
2. **Làm sạch dữ liệu (Cleaner):** Xử lý ô trống, dòng trùng lặp, chuyển đổi định dạng và đồng nhất dữ liệu.
3. **Trực quan hóa dữ liệu (Visualize):** Tự động vẽ biểu đồ phân phối, tính toán tương quan, theo dõi chuỗi thời gian và giải thích bằng AI theo nhu cầu.
4. **Báo cáo tổng hợp (Report):** Kết xuất báo cáo nghiên cứu hoàn chỉnh kèm biểu đồ sắc nét, bảng từ điển dữ liệu và bảng mô tả phương pháp.

## 3 tab phân tích chính {#three-tabs}

Màn hình Trực quan hóa phân chia nội dung theo 3 góc nhìn trực quan:

- `ui:visualize.tab_distribution` — **Phân phối:** Khám phá phân phối tần suất và độ biến thiên của từng cột riêng lẻ. Hệ thống tự động chọn biểu đồ cột (Bar), biểu đồ tròn (Pie), Histogram hoặc Boxplot dựa trên kiểu dữ liệu (Danh mục, Thang đo đánh giá, Số liên tục, Nhiều lựa chọn).
- `ui:visualize.tab_correlation` — **Tương quan:** Khám phá mối liên hệ giữa các cặp chỉ số số học. Hệ thống hiển thị ma trận nhiệt tổng quan, danh sách cặp tương quan xếp theo độ lớn |r| và biểu đồ phân tán hoặc lưới đếm 5×5 chi tiết.
- `ui:visualize.tab_time` — **Theo thời gian:** Dành riêng cho dữ liệu có cột ngày tháng (datetime), tự động gộp mốc thời gian theo giờ, ngày, tháng hoặc năm để vẽ đường xu hướng.

## Biểu đồ gợi ý sẵn cho báo cáo {#suggested-badge}

Khi vừa mở màn hình Visualize, một số biểu đồ xuất hiện huy hiệu `ui:visualize.badge_suggested` màu xanh lá ở góc trên bên trái:

- Thuật toán nội bộ tự động chấm điểm và chọn sẵn **3 đến 5 biểu đồ tiêu biểu nhất** của tập dữ liệu.
- Tiêu chí ưu tiên: Cột có tỷ lệ khuyết thấp, độ biến thiên thông tin rõ ràng hoặc có phát hiện thống kê đặc biệt (ví dụ: một đáp án chiếm đa số trên 70%, hoặc thang điểm có độ tập trung cao ở mức 4–5).
- Trong tab Tương quan, ma trận nhiệt cũng được gắn huy hiệu gợi ý nếu tồn tại ít nhất 1 cặp chỉ số có hệ số tương quan |r| ≥ 0,5.

Bạn có thể giữ nguyên các gợi ý này hoặc bấm vào nút trên từng thẻ để bỏ chọn hoặc chọn thêm bất kỳ biểu đồ nào khác.

## Thanh công cụ đáy màn hình {#bottom-bar}

Tại cạnh dưới màn hình luôn có một thanh tác vụ ghim cố định:
- Hiển thị tổng số biểu đồ đã chọn cho báo cáo (ví dụ: "4 biểu đồ đã chọn").
- Cho phép bấm mở ngăn kéo (drawer) xem lại danh sách biểu đồ đã tích lũy.
- Nút `ui:visualize.confirm_proceed` đưa toàn bộ các biểu đồ đã chọn sang trang Báo cáo. Nếu chưa chọn biểu đồ nào, hệ thống sẽ hiển thị hộp thoại cảnh báo trước khi chuyển tiếp.

