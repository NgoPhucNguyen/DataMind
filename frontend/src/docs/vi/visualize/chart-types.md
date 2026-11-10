---
title: Các loại biểu đồ
updated: 2026-11-08
related:
  - profiler/data-types
  - report/charts
  - cleaner/auto-clean
---

# Các loại biểu đồ trong Visualize {#chart-types}

Hệ thống DataMind phân tích cấu trúc thống kê của từng cột và tự động lựa chọn dạng trực quan hóa tối ưu nhất. Bạn không cần phải thiết lập thủ công từng trục toạ độ hay công thức gộp.

## 1. Dữ liệu số liên tục (Continuous Numeric) {#continuous-numeric}

Dành cho các biến số có khoảng giá trị trải rộng, chẳng hạn như *Thu nhập*, *Chi tiêu*, *Tuổi*, hoặc *Thời gian sử dụng*:

- **Biểu đồ mặc định:** Histogram gồm 20 khoảng (bins) chia đều từ giá trị nhỏ nhất đến giá trị lớn nhất.
- **Các thông số thống kê tự động:** Giá trị nhỏ nhất (`min`), giá trị lớn nhất (`max`), trung bình (`mean`), trung vị (`median`), phân vị 25% (`p25`), phân vị 75% (`p75`) và số lượng điểm ngoại lệ (`outliers`).
- **Chuyển đổi dạng xem:** Thông qua nút `ui:visualize.settings`, bạn có thể chuyển đổi linh hoạt giữa Histogram và biểu đồ hộp (Boxplot) để kiểm tra các giá trị dị biệt.

### Biểu đồ hộp (Box Plot) {#box-plot}

Biểu đồ hộp tóm tắt cách các giá trị phân bố. Hộp chứa 50% giá trị ở giữa: cạnh trái là Q1 (25% giá trị nhỏ hơn), cạnh phải là Q3 (75% giá trị nhỏ hơn). Vạch đậm trong hộp là trung vị. Hai râu kéo tới giá trị nhỏ nhất và lớn nhất không tính ngoại lai. Các chấm bên ngoài là ngoại lai: giá trị cách hộp hơn 1,5 lần độ rộng hộp (IQR). Hộp càng hẹp, các giá trị càng gần nhau; trung vị lệch về một phía cho thấy dữ liệu bị lệch.

**Ví dụ thực tế với cột "Thu nhập (triệu đồng/tháng)":**
- Q1 = 12 triệu: 25% người khảo sát có thu nhập dưới 12 triệu.
- Trung vị = 18 triệu: một nửa số người có thu nhập dưới 18 triệu, một nửa trên 18 triệu.
- Q3 = 26 triệu: 75% người có thu nhập dưới 26 triệu (50% người ở giữa có thu nhập dao động từ 12 đến 26 triệu, IQR = 14 triệu).
- Râu dưới = 6 triệu, râu trên = 45 triệu: phạm vi thu nhập thông thường không tính ngoại lai.
- Ngoại lai: các chấm tròn ở mức 60, 85 triệu đồng/tháng (nằm ngoài ngưỡng Q3 + 1,5 x IQR = 47 triệu).

**Khi nào nên dùng Histogram vs Biểu đồ hộp?**
- Dùng Histogram khi bạn muốn nhìn rõ hình dạng phân phối cụ thể (đồ thị hình chuông đối xứng, phân phối lệch trái/phải, hay có hai đỉnh tách biệt).
- Dùng Biểu đồ hộp khi bạn muốn tóm tắt nhanh vị trí trung vị, khoảng tứ phân vị và định vị chính xác các điểm ngoại lai dị biệt.

## 2. Thang đo đánh giá & Số rời rạc (Rating Scale & Discrete) {#rating-scale}

Dành cho các câu hỏi khảo sát dạng thang điểm Likert (ví dụ: *Đánh giá độ hài lòng từ 1 đến 5 sao*, hoặc *Mức độ đồng ý từ 1 đến 7*):

- **Biểu đồ mặc định:** Biểu đồ cột phân phối tần suất từng mức điểm.
- **Cơ chế đệm mức 0 (Zero-padding):** Nếu tập dữ liệu có thang điểm từ 1 đến 5 nhưng không có ai chọn mức 2, hệ thống vẫn giữ nguyên mức 2 trên trục hoành với độ cao cột bằng 0. Điều này giúp đồ thị phản ánh trung thực toàn bộ thang đo, tránh gây hiểu lầm thị giác như khi bị khuyết mất một bậc.
- **Dòng phụ đề chuẩn:** Luôn chỉ rõ quy mô thang điểm và số mẫu khảo sát, ví dụ: *"Thang 1–5 · trên 250 người trả lời"*.

## 3. Dữ liệu danh mục & Luận lý (Categorical & Boolean) {#categorical}

Dành cho các biến định danh như *Giới tính*, *Tỉnh/Thành phố*, *Ngành nghề*, hoặc *Tình trạng việc làm*:

- **Biểu đồ mặc định:** Biểu đồ cột đứng hoặc biểu đồ tròn.
- **Quy tắc hiển thị nhóm lớn (Top N):**
  - Chế độ tự động (`auto`): Nếu cột có từ 15 danh mục trở xuống, hệ thống hiển thị đầy đủ toàn bộ các danh mục.
  - Nếu cột có trên 15 danh mục, hệ thống tự động giữ lại **10 danh mục có số lượng lớn nhất** và gom tất cả các nhóm nhỏ còn lại vào một cột duy nhất mang tên **"Khác"**.
- **Xem chi tiết nhóm "Khác":** Khi di chuột lên cột hoặc lát cắt "Khác", một bảng thông tin nhỏ (tooltip) sẽ liệt kê danh sách cụ thể từng mục bị gộp cùng số lượt tương ứng.

## 4. Câu hỏi nhiều lựa chọn (Multiple Choice) {#multiple-choice}

Dành cho các câu hỏi khảo sát cho phép người tham gia chọn đồng thời nhiều đáp án (ví dụ: *"Bạn thường sử dụng những kênh mạng xã hội nào?"*):

- **Cách tính tỷ lệ phần trăm:** Tỷ lệ % của mỗi đáp án được tính dựa trên **tổng số người tham gia khảo sát (N)**, không tính dựa trên tổng số lượt tích chọn:
  Tỷ lệ % = (Số người chọn đáp án / N) × 100
- **Tổng tỷ lệ vượt 100%:** Vì một người có thể chọn nhiều phương án cùng lúc, tổng phần trăm của tất cả các cột cộng lại thường vượt quá 100%.
- **Ghi chú cảnh báo:** Dưới mỗi biểu đồ nhiều lựa chọn luôn có dòng ghi chú chuẩn: *"Mỗi người có thể chọn nhiều đáp án, nên tổng có thể vượt 100%."*

## 5. Chuỗi thời gian (Datetime) {#datetime}

Dành cho các tập dữ liệu có cột ngày giờ (ví dụ: *Thời điểm gửi biểu mẫu*, *Ngày giao dịch*):

Hệ thống tự động đo khoảng cách giữa mốc thời gian sớm nhất và muộn nhất để lựa chọn tần suất gộp mốc tối ưu:
- **Khoảng cách ≤ 48 giờ:** Tự động gom theo từng **Giờ** (`h`).
- **Khoảng cách ≤ 60 ngày:** Tự động gom theo từng **Ngày** (`D`).
- **Khoảng cách ≤ 730 ngày (2 năm):** Tự động gom theo từng **Tháng** (`M`).
- **Khoảng cách > 730 ngày:** Tự động gom theo từng **Năm** (`Y`).

Cách phân bổ này đảm bảo biểu đồ đường luôn hiển thị số lượng mốc vừa vặn trên màn hình, không bị chồng chéo nhãn ngày tháng.

