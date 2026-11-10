---
title: Điểm chính
updated: 2026-11-10
related:
  - visualize/reading-insights
  - visualize/correlation
  - profiler/column-stats
---

# Điểm chính của Báo cáo {#key-findings}

Mục **Điểm chính (Key Findings)** tập hợp các phát hiện thống kê nổi bật nhất từ các biểu đồ bạn đã chọn. Phần này giúp người đọc nắm bắt ngay những kết luận quan trọng của dữ liệu mà không cần phải đọc qua toàn bộ báo cáo chi tiết.

## Cách trích xuất điểm chính tự động {#auto-extraction}

Khác với phần Tổng quan, phần Điểm chính **hoàn toàn không sử dụng AI** và **không tiêu tốn bất kỳ lượt AI nào**. Hệ thống áp dụng thuật toán thống kê độc lập để rà soát toàn bộ các biểu đồ đã chốt và chấm điểm ưu tiên các phát hiện:

| Loại chỉ số | Tiêu chí đánh giá | Điểm ưu tiên | Mẫu phát hiện tự động |
| :--- | :--- | :---: | :--- |
| **Thang đo Likert** | Cực trị điểm trung bình (cao nhất và thấp nhất) | 90 | Tiêu chí được đánh giá cao nhất là 'A' với điểm trung bình 4,2 / 5 (Hình 1); thấp nhất là 'B' đạt 2,8 / 5 (Hình 2). |
| **Phân loại / Nhiều lựa chọn** | Một giá trị chiếm ưu thế áp đảo ($\ge 70\%$ hoặc $\ge 50\%$) | 85 / 65 | 'Hà Nội' là lựa chọn áp đảo ở 'Khu vực' với 74% (Hình 3). |
| **Tương quan** | Cặp chỉ số có liên quan mạnh nhất ($\|r\| \ge 0,5$) | 80 / 70 | Mối tương quan mạnh nhất giữa 'Chi phí' và 'Doanh thu' (r = 0,82, thuận). |
| **Thang đo Likert** | Tỷ lệ đánh giá mức cao đạt $\ge 70\%$ hoặc $\le 30\%$ | 75 / 50 | 78% người tham gia đánh giá cao 'Chất lượng' (mức 4–5, Hình 1). |
| **Thời gian** | Xu hướng tăng hoặc giảm rõ rệt $\ge 30\%$ | 60 | Xu hướng tăng 42% ở 'Doanh số theo tháng' (Hình 4). |
| **Phân loại** | Top 3 giá trị chiếm phần lớn ($\ge 70\%$) | 55 | Top 3 giá trị ở 'Ngành nghề' chiếm 82% tổng số (Hình 5). |
| **Số liên tục** | Phát hiện có các giá trị ngoại lai đáng chú ý | 40 | Phát hiện 15 giá trị ngoại lai ở 'Thu nhập' (Hình 6). |

```dm-callout:note
Hệ thống áp dụng quy tắc: Mỗi biểu đồ chỉ đóng góp tối đa 1 điểm chính và toàn bộ mục chỉ chọn tối đa 5 điểm có điểm ưu tiên cao nhất để đảm bảo tính cô đọng. Các số Hình tham chiếu (ví dụ: Hình 1, Hình 2) được đồng bộ tự động theo đúng thứ tự hiển thị của biểu đồ.
```

## Chỉnh sửa và lưu trên máy chủ {#edit-and-save}

Nếu muốn diễn đạt lại theo ngôn từ của cơ quan hoặc bổ sung thêm nhận định:

1. Bấm nút `ui:report.edit_btn` ở góc phải tiêu đề Điểm chính.
2. Danh sách các gạch đầu dòng sẽ chuyển thành khung soạn thảo văn bản.
3. Khi bạn nhập nội dung, sau 1 giây ngừng gõ (hoặc khi nhấp chuột ra ngoài khung nhập liệu), hệ thống sẽ tự động lưu văn bản lên máy chủ và hiển thị huy hiệu `ui:report.badge_saved` kèm thời gian lưu (ví dụ: `Đã lưu · 14:35`).

## Khôi phục về bản tính toán tự động {#restore-auto}

Khi đang ở chế độ chỉnh sửa, bạn sẽ thấy nút `ui:report.restore_auto`:
- Nhấp vào nút này sẽ mở hộp thoại xác nhận theo giao diện chuẩn của DataMind: *"Nội dung bạn đã sửa sẽ bị thay bằng các điểm chính được trích xuất tự động."*.
- Bấm **Khôi phục**: Hệ thống sẽ xóa bản ghi đã chỉnh sửa trên máy chủ và lập tức hoàn trả lại danh sách các điểm trích xuất tự động chuẩn xác nhất theo dữ liệu biểu đồ.

## Cảnh báo khi danh sách biểu đồ thay đổi {#charts-changed-warning}

Nếu bạn đã tự sửa văn bản Điểm chính, sau đó quay lại thêm/bớt biểu đồ hoặc đổi thứ tự, huy hiệu màu vàng `ui:report.badge_charts_changed` sẽ xuất hiện:
- Nhắc nhở bạn rằng số Hình tham chiếu (ví dụ: `Hình 1`, `Hình 2`) hoặc nội dung các điểm đã ghi chép có thể không còn khớp với danh sách biểu đồ mới.
- Bạn chỉ cần bấm "Chỉnh sửa" để cập nhật lại số Hình, hoặc bấm `ui:report.restore_auto` để hệ thống tự động đánh số và trích xuất lại từ đầu.

