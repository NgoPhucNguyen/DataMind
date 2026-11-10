---
title: Tương quan
updated: 2026-11-08
related:
  - profiler/column-stats
  - report/charts
  - report/key-findings
---

# Phân tích tương quan (Correlation) {#correlation}

Tab `ui:visualize.tab_correlation` giúp bạn phát hiện những quy luật ngầm và mối quan hệ giữa các câu hỏi hoặc chỉ số số học trong tập dữ liệu.

## Khái niệm: r là gì? {#what-is-r}

Khi bấm vào nút `ui:visualize.what_is_r`, hệ thống hiển thị định nghĩa chuẩn xác:

> *“r (hệ số tương quan) cho biết câu trả lời của hai câu hỏi có xu hướng thay đổi cùng nhau hay không. r nằm trong khoảng từ −1 đến 1. Gần 1: ai chọn mức cao ở câu này thường cũng chọn mức cao ở câu kia. Gần −1: ngược lại, chọn cao ở câu này thường chọn thấp ở câu kia. Gần 0: gần như không liên quan. Mức độ: dưới 0,3 yếu · 0,3–0,5 vừa · 0,5–0,7 khá mạnh · từ 0,7 mạnh. n là số người trả lời cả hai câu. Liên quan không có nghĩa là cái này gây ra cái kia.”*

### 4 mức độ tương quan theo độ lớn |r|
- **Dưới 0,3:** Yếu (mối liên hệ mờ nhạt, khó rút ra kết luận).
- **0,3 đến 0,5:** Vừa (bắt đầu có xu hướng liên kết đáng chú ý).
- **0,5 đến 0,7:** Khá mạnh (mối quan hệ rõ rệt, mang giá trị nghiên cứu cao).
- **Từ 0,7 trở lên:** Mạnh (hai biến số thay đổi rất sát sao cùng nhau).

### Chiều hướng và quy mô mẫu n
- **Cùng chiều (r > 0):** Hai câu trả lời cùng tăng hoặc cùng giảm (ví dụ: điểm hài lòng về dịch vụ càng cao thì điểm sẵn sàng giới thiệu bạn bè càng cao).
- **Ngược chiều (r < 0):** Câu này tăng thì câu kia giảm (ví dụ: thời gian chờ đợi càng lâu thì điểm hài lòng càng thấp).
- **Mẫu số n:** Số lượng người trả lời cả hai câu hỏi đó. Giá trị n càng lớn thì hệ số tương quan càng đáng tin cậy. Nếu n < 10, hệ thống sẽ hiển thị cảnh báo không đủ dữ liệu.

## Chọn phương pháp: Pearson vs Spearman {#pearson-vs-spearman}

Hệ thống hỗ trợ 2 thuật toán tính tương quan:
- **Spearman:** Đo lường tương quan dựa trên thứ bậc sắp xếp (ranks). Đây là phương pháp tối ưu nhất cho các câu hỏi thang điểm đánh giá (Likert 1–5, 1–7) và dữ liệu có thứ bậc.
- **Pearson:** Đo lường tương quan tuyến tính dựa trên giá trị số học cụ thể, phù hợp nhất cho các biến số liên tục (tuổi tác, thu nhập, điểm trung bình tích lũy).
- **Cơ chế chọn tự động:** Nếu từ 50% số cột số trong bảng là biến rời rạc hoặc thang đo, hệ thống sẽ tự động ưu tiên chọn **Spearman**. Ngược lại, nếu đa phần là biến số liên tục, hệ thống sẽ chọn **Pearson**.

## Bộ lọc ngưỡng tương quan {#threshold-chips}

Trên thanh công cụ, bạn có thể chuyển đổi giữa 3 chip ngưỡng: `ui:visualize.threshold_03`, `ui:visualize.threshold_05` và `ui:visualize.threshold_07`:
- Các cặp chỉ số luôn được sắp xếp theo thứ tự giảm dần của độ lớn tương quan (|r|).
- Khi bạn chuyển sang ngưỡng cao hơn (ví dụ từ 0,3 lên 0,5), các cặp mạnh nhất ở đầu danh sách **hoàn toàn không thay đổi thứ tự**, mà hệ thống chỉ ẩn bớt các cặp yếu hơn nằm ở phía dưới để bạn tập trung vào những cặp nổi bật nhất.

## Danh sách cặp tương quan rõ {#pairs-list}

Dưới tiêu đề *"Các cặp liên quan rõ · n cặp có |r| ≥ t"*:
- Mặc định hệ thống hiển thị **3 cặp** tương quan mạnh nhất.
- Bấm **"Xem thêm"** để mở rộng thêm 10 cặp tiếp theo.
- Bấm **"Thu gọn"** để quay về mức 3 cặp ban đầu.
- Mỗi hàng thể hiện đầy đủ: Ký tự định danh cột (ví dụ `[Y] ↔ [AT]`), tên câu hỏi, hệ số r, nhãn mức độ, chiều hướng, thanh tiến trình màu và quy mô mẫu n.

## Tìm kiếm theo cột (Find by Column) {#find-by-column}

Ô tìm kiếm phía trên ma trận cho phép bạn nhập tên cột hoặc ký tự viết tắt:
- Tìm kiếm hỗ trợ gõ tiếng Việt không phân biệt dấu.
- Khi chọn một cột (ví dụ cột `[M] Mức độ gắn kết`), hệ thống sẽ lập tức hiển thị bảng xếp hạng *"Liên quan với [M]..."* gồm toàn bộ các cột khác có mối liên hệ với cột này, xếp từ mạnh đến yếu. *Lưu ý: Danh sách tìm kiếm này không bị giới hạn bởi bộ lọc ngưỡng.*
- Đồng thời, trên ma trận nhiệt sẽ làm sáng dải hàng và cột giao thoa tương ứng. Bấm dấu × bên cạnh tên cột để xóa trạng thái lọc.

## Đọc ma trận nhiệt (Correlation Matrix) {#matrix-view}

- **Số trong ô:** Hiển thị trực tiếp hệ số tương quan r được làm tròn đến 2 chữ số thập phân.
- **Đường viền và cố định:** Tiêu đề hàng và cột được ghim cố định khi bạn cuộn trang.
- **Độ trong suốt:** Các ô có giá trị tương quan thấp hơn ngưỡng đang chọn sẽ được giảm độ đậm để làm nổi bật các mối tương quan thực sự mạnh.
- **Ký hiệu đặc biệt:** Đường chéo chính của các biến tự so với chính nó hiển thị dấu gạch ngang dài `—`. Các cặp có số lượng mẫu dưới 10 (n < 10) hiển thị dấu gạch ngang ngắn `–`.
- **Tương tác:** Bấm vào bất kỳ ô nào trong ma trận, hệ thống sẽ tự động cuộn xuống và hiển thị chi tiết cặp tương quan đó.

## Chi tiết từng cặp: Lưới đếm 5×5 vs Phân tán {#pair-details}

- **Với cặp biến thang đo / số rời rạc:** Hiển thị lưới tổ hợp 5×5 (`CorrelationGrid`). Mỗi ô biểu thị số lượng người chọn cùng lúc cả 2 mức điểm (ví dụ: vừa chọn mức 5 ở câu A, vừa chọn mức 5 ở câu B). Ô có màu xanh càng đậm thể hiện lượng người tập trung tại tổ hợp đó càng đông.
- **Với cặp biến số liên tục:** Hiển thị biểu đồ phân tán (Scatter plot) với từng chấm nhỏ là một đối tượng khảo sát kèm đường hồi quy xu hướng màu xanh.

## Nguyên tắc vàng: Tương quan không đồng nghĩa với Nhân quả {#golden-rule}

```dm-callout:warning
**Tương quan không đồng nghĩa với nhân quả:** Việc hai biến số có tương quan rất mạnh (r = 0,85) chỉ chứng minh rằng chúng cùng thay đổi đồng thời, không có nghĩa là biến số này là nguyên nhân sinh ra biến số kia.
```

*Ví dụ thực tế:* Cột `[Y] Giờ tự học trong tuần` và `[AT] Điểm thi cuối kỳ` có tương quan dương mạnh (r = 0,72). Ta chỉ có thể kết luận rằng những sinh viên dành nhiều giờ tự học thường đạt điểm thi cao hơn, chứ không thể khẳng định chỉ cần ngồi vào bàn học là chắc chắn điểm sẽ tăng, vì còn có các yếu tố trung gian khác như phương pháp học tập hay nền tảng kiến thức trước đó.

