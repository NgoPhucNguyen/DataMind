---
title: Đọc nhận xét tự động
updated: 2026-11-08
related:
  - profiler/column-stats
  - report/key-findings
---

# Đọc nhận xét tự động (Auto Insights) {#reading-insights}

Dưới mỗi thẻ biểu đồ trong phân hệ Visualize, DataMind tự động đúc kết 1 đến 2 dòng nhận xét thống kê quan trọng nhất (`auto_insights_title`). Các nhận xét này được tính toán trực tiếp từ dữ liệu thực tế, giúp bạn nắm bắt nhanh thông điệp cốt lõi mà không cần phải tự dò từng con số.

## 13 mẫu nhận xét tự động {#thirteen-insights}

Tùy theo cấu trúc dữ liệu của từng cột, hệ thống sẽ lựa chọn các mẫu nhận xét phù hợp:

### Dữ liệu danh mục & khảo sát

1. **`top_value` (Giá trị phổ biến nhất):** Nhận diện giá trị đứng đầu bảng phân phối.
   *Ví dụ:* "Nhóm 18–24 tuổi chiếm tỷ trọng cao nhất với 58% (145 người)."
2. **`top3_share` (Mức độ tập trung top 3):** Kích hoạt khi 3 nhóm đứng đầu chiếm từ 70% tổng mẫu trở lên.
   *Ví dụ:* "3 ngành nghề phổ biến nhất chiếm 76% toàn bộ người khảo sát."
3. **`mc_top` (Phương án nhiều lựa chọn dẫn đầu):** Chỉ ra đáp án được nhiều người tích chọn nhất.
   *Ví dụ:* "84% người tham gia khảo sát lựa chọn thanh toán qua Ví điện tử."
4. **`mc_avg` (Mức độ lựa chọn trung bình):** Kích hoạt khi số đáp án trung bình mỗi người chọn ≥ 1,5.
   *Ví dụ:* "Trung bình mỗi người lựa chọn 2,3 kênh tiếp cận thông tin."

### Thang đo đánh giá & Điểm Likert

5. **`scale_mean` (Điểm trung bình thang đo):** Tính điểm trung bình của toàn bộ phản hồi.
   *Ví dụ:* "Điểm đánh giá trung bình đạt 4,12 / 5 điểm."
6. **`scale_top_box` (Tỷ lệ hài lòng cao - Top-2 Boxes):** Tính tỷ lệ phần trăm người chọn hai mức điểm cao nhất của thang đo (mức 4 và 5 đối với thang 1–5; mức 6 và 7 đối với thang 1–7).
   *Ví dụ:* "Có 74% người khảo sát đánh giá ở mức 4 hoặc 5 (rất hài lòng)."
7. **`discrete_mean` (Trung bình số rời rạc):** Điểm trung bình của biến số đếm nguyên.
8. **`discrete_top` (Mức phổ biến nhất của số rời rạc):** Mức giá trị số nguyên xuất hiện với tần suất cao nhất.

### Dữ liệu số liên tục

9. **`typical_range` (Khoảng giá trị tiêu biểu):** Khoảng cách giữa phân vị 25% và phân vị 75% (P25 – P75), phản ánh vùng tập trung của 50% số mẫu ở giữa tập dữ liệu.
   *Ví dụ:* "50% đối tượng khảo sát có mức chi tiêu dao động từ 3.500.000đ đến 7.000.000đ."
10. **`outliers` (Cảnh báo giá trị dị biệt):** Thống kê số lượng bản ghi nằm ngoài ngưỡng 1,5 × IQR (khoảng tứ phân vị).
    *Ví dụ:* "Phát hiện 8 bản ghi có giá trị bất thường vượt xa phân phối thông thường."

### Chuỗi thời gian

11. **`trend_up` (Xu hướng tăng):** Ghi nhận dữ liệu có chiều hướng đi lên theo thời gian.
12. **`trend_down` (Xu hướng giảm):** Ghi nhận dữ liệu có chiều hướng suy giảm theo thời gian.
13. **`peak` (Đỉnh đột biến):** Nhận diện mốc thời gian ghi nhận giá trị cao vượt trội so với trung bình các mốc xung quanh.
    *Ví dụ:* "Ghi nhận mức phản hồi cao nhất vào ngày 15/10/2026 với 120 lượt gửi."

## Quy tắc làm tròn số chuẩn thống kê {#rounding-rules}

Nhằm đảm bảo sự chặt chẽ và không gây sai lệch số học, DataMind áp dụng các chuẩn làm tròn nhất quán:

- **Số trung bình (Means):** Luôn được làm tròn đến đúng **2 chữ số thập phân** bằng thuật toán làm tròn bán phần lên (`_round_half_up`, tương đương cơ chế hàm `ROUND` trong Excel). Thuật toán này triệt tiêu hoàn toàn sai số dấu phẩy động thường gặp trong ngôn ngữ lập trình.
- **Tỷ lệ phần trăm (%):** Được làm tròn thành **số nguyên** trên nhãn đồ thị để giữ bố cục biểu đồ thoáng đạt, dễ nhìn.
- **Xem con số thực tế:** Khi bạn rê chuột vào bất kỳ cột hoặc lát cắt nào, cửa sổ chi tiết (tooltip) sẽ luôn cung cấp số đếm chính xác từng người/dòng và tổng mẫu số N.

