---
title: Giải thích bằng AI
updated: 2026-11-08
related:
  - profiler/ai-context
  - report/ai-overview
---

# Giải thích bằng AI (AI Insights) {#ai-explain}

Khi cần một góc nhìn phân tích sâu sắc hơn các con số thống kê cơ bản, bạn có thể sử dụng tính năng **Giải thích bằng AI** để nhận các đoạn văn nhận xét ngữ cảnh thông minh.

## Dữ liệu gửi đến mô hình AI {#what-ai-receives}

Để bảo mật dữ liệu và tối ưu hóa phản hồi, hệ thống không gửi toàn bộ tệp thô của bạn lên mô hình trí tuệ nhân tạo, mà chỉ trích xuất phần dữ liệu tổng hợp:

- **Với biểu đồ đơn lẻ:** Mô hình chỉ nhận loại biểu đồ, tên cột và tọa độ các điểm đã vẽ (tối đa 30 điểm tiêu biểu nhất).
- **Với phân hệ Tương quan:** Nút AI giải thích nằm ngay trên thẻ ma trận tương quan. Khi bấm, hệ thống sẽ gửi danh sách **top 10 cặp chỉ số có tương quan mạnh nhất** theo thuật toán mặc định của bảng. *Lưu ý: Không có nút AI riêng cho từng cặp nhỏ lẻ.*

## Hộp thoại xác nhận & Minh bạch lượt dùng {#confirmation-and-quota}

- **Hiển thị hạn mức rõ ràng:** Trên nút bấm luôn ghi rõ số lượt còn lại trong ngày của bạn, ví dụ: `ui:visualize.ai_explain` (*"AI giải thích · 1 lượt · còn 2/3"*).
- **Hộp thoại xác nhận:** Trước khi tiến hành gọi AI, một hộp thoại xác nhận sẽ bật lên để thông báo rõ ràng thao tác này sẽ tiêu tốn 1 lượt sử dụng, giúp bạn hoàn toàn chủ động, tránh việc bấm nhầm ngoài ý muốn.

## Khả năng hủy yêu cầu (Cancel) an toàn {#abort-request}

Nếu đang trong quá trình chờ AI phản hồi mà bạn muốn dừng lại:
- Bạn có thể bấm nút **"Hủy"** bất kỳ lúc nào.
- Trình duyệt sẽ kích hoạt cơ chế `AbortController` để ngắt luồng tải ngay lập tức, máy chủ phản hồi mã HTTP 499 và dừng sinh văn bản.
- **Bảo toàn lượt dùng:** Lượt AI của bạn hoàn toàn không bị trừ, và kết quả dang dở sẽ không bị ghi đè vào bộ nhớ đệm.

## Bộ nhớ đệm 30 ngày: Dùng lại miễn phí {#free-cache-reuse}

DataMind áp dụng cơ chế lưu đệm thông minh 2 tầng (Tier 1 cho bản nháp do AI sinh ra, và Tier 2 cho nội dung do bạn chỉnh sửa) với thời hạn lưu trữ lên đến **30 ngày** trong bộ nhớ đệm:
- Sau khi một biểu đồ đã có đoạn giải thích, bạn có thể tải lại trang hoặc mở đi mở lại nhiều lần mà không hề bị tính thêm lượt.
- Ngay cả khi bạn chuyển đổi dạng biểu đồ (ví dụ từ Biểu đồ cột sang Biểu đồ tròn), nội dung phân tích AI đã sinh ra vẫn được giữ nguyên vẹn mà không cần gọi lại mô hình.

## Tự chỉnh sửa và lưu nhận xét cá nhân {#edit-and-save}

Nếu muốn bổ sung góc nhìn chuyên môn hoặc hiệu chỉnh từ ngữ cho phù hợp với phong cách của bài thuyết trình:
1. Bấm vào nút **"Chỉnh sửa nội dung"** bên dưới đoạn văn giải thích.
2. Sửa trực tiếp nội dung văn bản trong ô nhập liệu.
3. Bấm **"Lưu thay đổi"**. Thao tác này sẽ lưu bản biên tập của bạn vào hệ thống hoàn toàn miễn phí.
4. Huy hiệu nhận xét sẽ tự động đổi từ **"Tạo bởi AI"** (màu xanh lá) sang **"Đã chỉnh sửa bởi bạn"** (màu xám trung tính).

## Cơ chế dự phòng thông minh (Multi-Provider Fallback) {#fallback-flow}

Hệ thống AI của DataMind được thiết lập hạ tầng dự phòng tự động:
**Yêu cầu phân tích** → **Google Gemini** → (nếu sự cố/quá tải) **Groq Llama** → (nếu vẫn lỗi) **Báo lỗi an toàn**

- Nếu mô hình chính gặp sự cố mạng hoặc vượt hạn ngạch tải, hệ thống lập tức tự chuyển sang mô hình dự phòng mà không làm gián đoạn trải nghiệm của bạn.
- Trong trường hợp xấu nhất nếu cả hai nhà cung cấp đều không phản hồi, hệ thống sẽ trả về mã lỗi an toàn `ERR_AI_UNAVAILABLE` và **hoàn lại 100% lượt dùng**, tuyệt đối không trừ oan hạn mức của bạn.

## Ghi chú miễn trừ trách nhiệm {#disclaimer}

Dưới mọi đoạn văn giải thích do AI tạo ra luôn có dòng thông báo chuẩn:
> *"Đây là suy đoán phân tích từ AI dựa trên bối cảnh, không phải kết luận chắc chắn."*

Người dùng cần kết hợp kiến thức chuyên môn và kiểm tra chéo các con số thực tế trước khi đưa vào các quyết định kinh doanh hoặc công trình nghiên cứu chính thức.

