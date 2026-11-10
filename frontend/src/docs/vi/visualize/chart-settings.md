---
title: Tùy chỉnh biểu đồ
updated: 2026-11-08
related:
  - report/charts
  - cleaner/manual-clean
---

# Tùy chỉnh biểu đồ (Chart Settings) {#chart-settings}

Mỗi thẻ biểu đồ trên DataMind đều tích hợp một menu cài đặt riêng biệt, giúp bạn linh hoạt tinh chỉnh hình thức trình bày và chiều sâu dữ liệu theo đúng ý định báo cáo.

## Menu cài đặt biểu đồ ⚙ {#chart-menu}

Bấm vào biểu tượng `ui:visualize.settings` ở góc trên bên phải mỗi thẻ biểu đồ để mở bảng điều khiển:

### 1. Dạng hiển thị biểu đồ
- **Dữ liệu danh mục & khảo sát:** Chuyển đổi qua lại giữa **Biểu đồ cột (Bar)** và **Biểu đồ tròn (Pie)**.
- **Dữ liệu số liên tục:** Chuyển đổi qua lại giữa **Histogram** (xem phân phối hình chuông) và **Biểu đồ hộp (Boxplot)**. *Lưu ý: Tùy chọn này chỉ hiển thị khi cột có thông số phân phối hộp (box stats).*

#### Biểu đồ hộp (Box Plot) {#box-plot-guide}

Biểu đồ hộp tóm tắt cách các giá trị phân bố. Hộp chứa 50% giá trị ở giữa: cạnh trái là Q1 (25% giá trị nhỏ hơn), cạnh phải là Q3 (75% giá trị nhỏ hơn). Vạch đậm trong hộp là trung vị. Hai râu kéo tới giá trị nhỏ nhất và lớn nhất không tính ngoại lai. Các chấm bên ngoài là ngoại lai: giá trị cách hộp hơn 1,5 lần độ rộng hộp (IQR). Hộp càng hẹp, các giá trị càng gần nhau; trung vị lệch về một phía cho thấy dữ liệu bị lệch.

**Ví dụ thực tế với cột "Thu nhập (triệu đồng/tháng)":**
- Q1 = 12 triệu: 25% người khảo sát có thu nhập dưới 12 triệu.
- Trung vị = 18 triệu: một nửa số người có thu nhập dưới 18 triệu, một nửa trên 18 triệu.
- Q3 = 26 triệu: 75% người có thu nhập dưới 26 triệu (50% người ở giữa có thu nhập từ 12 đến 26 triệu, IQR = 14 triệu).
- Râu dưới = 6 triệu, râu trên = 45 triệu: phạm vi thu nhập thông thường không tính ngoại lai.
- Ngoại lai: các chấm tròn ở mức 60, 85 triệu đồng/tháng (nằm ngoài ngưỡng Q3 + 1,5 x IQR = 47 triệu).

**Khi nào nên dùng Histogram vs Biểu đồ hộp?**
- Chọn Histogram khi cần phân tích hình thái phân phối (độ dốc, đỉnh phân phối, khoảng trống giá trị).
- Chọn Biểu đồ hộp khi cần tóm tắt trung vị, đo độ rộng khoảng giữa (IQR) và phát hiện tức thì các giá trị ngoại lai.

### 2. Số lượng mục hiển thị
- Cung cấp các mức: **Top 10**, **Top 15**, **Tất cả** hoặc **Tự động**.
- Các nhóm ngoài khoảng hiển thị sẽ tự động được gom vào nhóm **"Khác"**.
- *Lưu ý hiệu năng:* Để đảm bảo trình duyệt không bị treo đơ khi tệp có hàng nghìn giá trị rời rạc, hệ thống áp dụng trần hiển thị an toàn tối đa là 200 mục.

### 3. Quy tắc sắp xếp thông minh
- **Theo số lượng:** Sắp xếp các cột theo số người chọn giảm dần hoặc tăng dần.
- **Theo giá trị tự nhiên:** Hệ thống tự động phân tích nhãn chuỗi bằng bộ giải mã `parseSortKey`. Các nhóm tuổi (*"Dưới 18 tuổi"*, *"18–25 tuổi"*, *"26–35 tuổi"*, *"Trên 50 tuổi"*) hoặc thang đo Likert (*"Hoàn toàn không đồng ý"* → *"Hoàn toàn đồng ý"*) sẽ được sắp xếp đúng theo trật tự logic tự nhiên, thay vì bị đảo lộn theo bảng chữ cái A-Z.

### 4. Ẩn mức không ai chọn (Thang đo Likert)
- Mặc định, hệ thống giữ nguyên các bậc điểm không có người chọn (độ cao bằng 0) để bảo toàn thang đo. Nếu muốn đồ thị cô đọng hơn, bạn có thể bật tùy chọn này để ẩn các bậc điểm trống.

### 5. Nút Khôi phục mặc định
- Nhanh chóng đưa mọi cài đặt của biểu đồ hiện tại về trạng thái tự động ban đầu.

## Nguyên tắc phối màu biểu đồ tròn {#pie-colors}

Để biểu đồ tròn vừa trực quan vừa đảm bảo tính khoa học, DataMind áp dụng nguyên tắc phối màu chuyên biệt:
- **Dữ liệu danh mục thông thường:** Sử dụng các dải màu phân biệt rõ ràng để dễ nhận biết từng thành phần.
- **Dữ liệu thang đo thứ bậc (Likert):** Tự động chuyển sang dải màu chuyển tiếp từ nhạt đến đậm (light → dark), giúp người đọc cảm nhận trực giác sự gia tăng của mức độ đánh giá.
- **Lát cắt "Khác":** Luôn được tô bằng màu xám trung tính, tránh tạo cảm giác đây là một nhóm dữ liệu đặc biệt quan trọng.

## 5 Bảng màu giao diện toàn hệ thống {#color-palettes}

Tại thanh công cụ phía trên trang Visualize, nút `ui:visualize.palette` cho phép bạn đổi bảng màu áp dụng đồng bộ cho toàn bộ biểu đồ:

1. **DataMind (Mặc định):** Tông xanh lá rừng (forest), màu xô thơm (sage) và vàng cát nhẹ nhàng mang tính biên tập hiện đại.
2. **Đại dương (Ocean):** Các sắc độ xanh dương mát mẻ, chuyên nghiệp, phù hợp cho báo cáo công nghệ và tài chính.
3. **Ấm áp (Warm):** Tông màu cam đất, đỏ gạch và hổ phách, phù hợp cho các dữ liệu tiêu dùng và dịch vụ.
4. **Dễ phân biệt (Colorblind-friendly):** Bảng màu khoa học theo chuẩn Okabe-Ito, đảm bảo độ tương phản rõ rệt cho người khiếm thị màu.
5. **Đen trắng (Print):** Thang độ xám tương phản cao, tối ưu tuyệt đối cho in ấn tài liệu giấy hoặc nộp luận văn đen trắng.

```dm-callout:tip
Mọi tinh chỉnh về dạng biểu đồ, sắp xếp danh mục và bảng màu bạn chọn tại Visualize sẽ được tự động lưu trữ và bảo toàn nguyên vẹn khi chuyển sang Báo cáo (Report), cũng như khi xuất ra tệp Word (DOCX) hoặc PDF.
```

