---
title: Phân tích chi tiết
updated: 2026-11-10
related:
  - visualize/chart-types
  - visualize/chart-settings
  - visualize/to-report
---

# Phân tích Chi tiết & Quản lý Biểu đồ {#detailed-analysis}

Mục **Phân tích Chi tiết (Detailed Analysis)** là trọng tâm nội dung của báo cáo, nơi trình bày các biểu đồ bạn đã chọn từ bước Visualize. Từng biểu đồ được hiển thị trực quan kèm hệ thống đánh số thứ tự Hình/Bảng khoa học, nhận xét tự động và luận giải kinh doanh chuyên sâu.

## Đánh số thứ tự Hình và Bảng khoa học {#numbering}

Để thuận tiện cho việc trích dẫn trong văn bản và phần Điểm chính, mọi biểu đồ và bảng trong mục này đều được gắn số thứ tự tự động:

- **Biểu đồ (Figures):** Được gắn tiền tố `Hình 1. `, `Hình 2. `, v.v. (trong tiếng Anh là `Figure 1. `).
- **Bảng dữ liệu (Tables):** Được gắn tiền tố `Bảng 1. ` (trong tiếng Anh là `Table 1. `), ví dụ: `Bảng 1. Các cặp cột liên quan mạnh nhất`.
- Khi bạn thay đổi vị trí hoặc xóa bớt biểu đồ, các số thứ tự này sẽ **tự động cập nhật lại ngay lập tức**, đảm bảo không bao giờ bị nhảy cóc hay trùng lặp số.

## Quản lý vị trí và gỡ bỏ biểu đồ {#manage-charts}

Tại góc trên bên phải của mỗi thẻ biểu đồ có cụm công cụ thao tác nhanh:

- `ui:report.move_up` — **Di chuyển lên:** Đưa biểu đồ lên trước 1 vị trí (tự động khóa mờ nếu là biểu đồ đầu tiên).
- `ui:report.move_down` — **Di chuyển xuống:** Đưa biểu đồ xuống sau 1 vị trí (tự động khóa mờ nếu là biểu đồ cuối cùng).
- `ui:report.remove_chart` — **Xóa biểu đồ khỏi báo cáo:**
  - Nhấp vào nút này sẽ mở hộp thoại xác nhận DataMind: thông báo rõ biểu đồ này chỉ bị gỡ khỏi báo cáo hiện tại, dữ liệu biểu đồ vẫn được lưu giữ nguyên vẹn ở bước Visualize và bạn có thể quay lại thêm lại bất kỳ lúc nào.
  - Hộp thoại cũng nhắc nhở bạn rằng phần Tổng quan hoặc Điểm chính có thể cần được cập nhật lại sau khi xóa.

## Hỗ trợ đầy đủ các loại biểu đồ {#chart-types}

Phân hệ Báo cáo hỗ trợ hiển thị toàn diện mọi loại biểu đồ theo đúng bảng màu và thiết lập bạn đã cấu hình:

1. **Phân phối tần suất (Histogram):** Hiển thị dạng cột phân phối với các khoảng chia tự động, nhận diện độ lệch trái/phải hoặc đỉnh tập trung.
2. **Cột phân loại (Bar chart):** Cột nằm ngang biểu diễn thứ hạng các hạng mục từ cao đến thấp, tự động gom nhóm `"Khác"` nếu danh mục quá dài.
3. **Đường xu hướng (Trend chart):** Dành cho dữ liệu chuỗi thời gian, biểu diễn đường biến thiên liên tục theo ngày/tháng/năm.
4. **Biểu đồ tròn (Pie chart):** Biểu diễn cơ cấu tỷ trọng phần trăm của các cột có từ 2 đến 7 phân loại.
5. **Biểu đồ hộp toàn diện (Box plot):**
   - Biểu diễn phân phối thống kê 5 mốc quan trọng của biến số liên tục: Giá trị nhỏ nhất (Min / Râu dưới), Tứ phân vị thứ nhất (Q1), Trung vị (Median), Tứ phân vị thứ ba (Q3) và Giá trị lớn nhất (Max / Râu trên).
   - Đánh dấu trực quan điểm **Trung bình (Mean)** hình thoi và các điểm **Ngoại lai (Outliers)** nằm ngoài khoảng 1,5 lần IQR.
   - Kèm bảng số liệu chi tiết và khối hướng dẫn đọc biểu đồ hộp có thể đóng/mở.

```dm-callout:tip
Khi xuất ra tệp Microsoft Word (.docx), các biểu đồ phân phối đơn lẻ (Histogram, Bar, Boxplot) có chiều rộng bán phần sẽ được tự động ghép đôi thành 2 biểu đồ trên một hàng ngang, giúp tiết kiệm trang in và tạo bố cục trang trọng, cân đối.
```

## Chế độ xem Tương quan Báo cáo (Correlation Report View) {#correlation-view}

Khi đưa phân tích tương quan vào báo cáo, hệ thống hiển thị một khối báo cáo tĩnh chuyên biệt gồm 4 thành phần:

1. **Câu nhận định tổng quát:** Nêu rõ phương pháp tính (Pearson/Spearman), ngưỡng lọc $|r|$, tổng số cặp thỏa mãn và cặp có mối tương quan mạnh nhất.
2. **Bảng Top 8 cặp tương quan mạnh nhất:** Bảng số liệu chuẩn gồm Tên cặp (kèm ký hiệu chữ cái), Hệ số tương quan $r$ (làm tròn 2 chữ số thập phân), Mức độ (Mạnh / Khá mạnh / Vừa / Yếu), Chiều (Thuận / Nghịch) và Quy mô số quan sát $n$.
3. **Ma trận tương quan thu gọn (Compact Matrix):** Tự động lọc ra tối đa 12 cột xuất hiện trong top cặp để ma trận vừa vặn hoàn hảo trong khổ in A4 mà không cần thanh cuộn ngang. Từng ô hiển thị hệ số $r$ với màu sắc phân kỳ rõ nét.
4. **Danh mục ký hiệu chữ cái:** Liệt kê rõ ràng chữ cái đại diện cho từng cột (ví dụ: `[A] Doanh thu`, `[B] Chi phí Marketing`).

Nếu bạn chọn đưa một cặp tương quan chi tiết vào báo cáo (`corr_pair`), hệ thống sẽ hiển thị lưới đếm giao thoa 5×5 (với biến rời rạc/thang đo) hoặc biểu đồ phân tán điểm ScatterChart (với biến số liên tục).

## Nhận xét tự động & Luận giải AI {#insights-and-ai}

- **Điểm đáng chú ý:** Tự động trích dẫn các nhận xét thống kê quan trọng của từng cột (ví dụ: giá trị chiếm đa số, khoảng tứ phân vị, tỷ lệ đánh giá cao).
- **AI Phân tích:** Hiển thị lời giải thích kinh doanh chuyên sâu do AI tạo ra ở bước Visualize.
- **Quy tắc xuất bản:** Nếu một biểu đồ **chưa có lời giải thích AI**, toàn bộ khối này (bao gồm tiêu đề và chữ nhắc) **sẽ tự động bị ẩn hoàn toàn trong bản in PDF và file Word**, đảm bảo văn bản xuất ra không bao giờ có khoảng trống hay dòng chữ nhắc dở dang.

