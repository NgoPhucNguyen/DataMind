---
title: Phụ lục: Từ điển dữ liệu
updated: 2026-11-10
related:
  - profiler/data-types
  - visualize/skipped-columns
  - cleaner/issue-types
---

# Phụ lục: Từ điển Dữ liệu {#appendix}

Trong các báo cáo phân tích số liệu hoàn chỉnh, bảng **Từ điển Dữ liệu (Data Dictionary / Codebook)** đóng vai trò là tài liệu tham chiếu chuẩn xác, giúp người đọc nắm bắt đầy đủ định nghĩa, cấu trúc và tính toàn vẹn của tất cả các biến số được khảo sát.

## Bảng từ điển dữ liệu tổng hợp {#dictionary-table}

Trên màn hình làm việc, mục Phụ lục được thiết kế dưới dạng khung gấp gọn để không chiếm dụng không gian đọc. Bạn có thể bấm vào thanh tiêu đề để mở rộng hoặc thu gọn bảng bất cứ lúc nào.

```dm-callout:note
Khi in ấn ra PDF hoặc xuất tệp Microsoft Word (.docx), bảng Phụ lục luôn tự động bung mở toàn bộ 100% các dòng, đảm bảo tài liệu lưu trữ của bạn có đầy đủ thông tin tra cứu chi tiết nhất.
```

Bảng tổng hợp cung cấp 5 cột thông tin cốt lõi cho từng cột dữ liệu:

1. **Cột & Ký hiệu:** Tên gốc của cột trong bộ dữ liệu kèm ký hiệu chữ cái đại diện `[A]`, `[B]`, `[C]`... tương ứng với ma trận tương quan và các biểu đồ phân tích.
2. **Kiểu dữ liệu:** Kiểu phân loại chuẩn hóa của biến số:
   - *Số liên tục:* Biến số định lượng đo lường thực tế (ví dụ: Thu nhập, Doanh thu, Cân nặng).
   - *Thang đo đánh giá:* Thang đo thứ bậc Likert (ví dụ: Điểm đánh giá mức độ hài lòng 1–5).
   - *Rời rạc:* Biến số nguyên đếm được (ví dụ: Số lượng đơn hàng, Tuổi năm).
   - *Phân loại:* Biến định tính chỉ chọn 1 đáp án duy nhất (ví dụ: Giới tính, Khu vực, Trạng thái đơn hàng).
   - *Nhiều lựa chọn:* Câu hỏi cho phép chọn nhiều phương án cùng lúc.
   - *Thời gian:* Mốc thời gian năm, tháng, ngày hoặc giờ.
   - *Văn bản:* Chuỗi ký tự tự do không qua phân nhóm.
3. **Tỷ lệ khuyết (% Thiếu):** Tỷ lệ phần trăm các ô bị trống hoặc không có thông tin hợp lệ trên tổng số dòng dữ liệu.
4. **Số giá trị duy nhất:** Số lượng các câu trả lời hoặc giá trị khác biệt nhau xuất hiện trong cột.
5. **Ghi chú kỹ thuật:**
   - Đối với biến thang đo: Ghi nhận khoảng giá trị đo lường, ví dụ: *"Thang đo đánh giá 1–5"*.
   - Đối với các cột không có biểu đồ: Nêu rõ lý do kỹ thuật tại sao cột bị ẩn ở bước Visualize.

## Các lý do cột bị ẩn biểu đồ {#skipped-reasons}

Nếu một cột dữ liệu trong tệp không được hiển thị biểu đồ ở bước Visualize, bảng từ điển dữ liệu sẽ giải thích rõ ràng nguyên nhân ở cột Ghi chú:

- **Thiếu dữ liệu quá nhiều:** Cột có tỷ lệ ô trống $\ge 60\%$. Dữ liệu thiếu quá lớn không đảm bảo tính đại diện thống kê để dựng biểu đồ.
- **Giá trị đơn nhất:** Toàn bộ cột chỉ chứa duy nhất 1 giá trị giống hệt nhau ở mọi dòng (độ biến thiên bằng 0), biểu đồ không mang lại giá trị so sánh.
- **Văn bản tự do:** Cột chứa các đoạn văn dài, ghi chú phản hồi của người dùng hoặc các chuỗi định danh duy nhất (ID, mã số) không có tính gom nhóm.

