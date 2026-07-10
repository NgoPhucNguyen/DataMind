# Thiết Kế Cơ Chế Phát Hiện Lỗi Ngữ Nghĩa (Semantic Errors)

Tài liệu này đề xuất thiết kế kiến trúc nhằm nâng cấp khả năng phát hiện lỗi của Data Cleaner, từ việc chỉ phát hiện lỗi cấu trúc sang nhận diện các lỗi ngữ nghĩa/nghiệp vụ (Semantic Errors) dựa vào context của dữ liệu.

---

## 1. Khảo sát hiện trạng (Current State)

### a. Profiler Context Guessing
Dựa trên mã nguồn tại `routers/files.py` và `services/profiler_service.py`:
- **Đoán kiểu cấu trúc (Pandas):** Hàm `_classify_column` trong Profiler hoàn toàn dựa vào `pandas.dtypes` và các chỉ số thống kê (unique count, length, string patterns) để chia cột thành `numeric`, `datetime`, `categorical`, `multiple_choice`, `text`. **Không có sự hiểu biết về nghiệp vụ** (Ví dụ: Không biết cột tên "STT" phải là số thứ tự tăng dần, cột "Họ Tên" phải là chữ).
- **Đoán Context bằng LLM (Gemini):** Sau khi profile bằng Pandas, hệ thống gọi `llm_service.get_semantic_context` gửi sang Gemini. Tuy nhiên, schema `SemanticContext` trả về hiện tại chỉ chứa `domain` (lĩnh vực), `confidence`, và `reasoning`.
- **Kết luận:** Context ở Profiler hiện tại **chỉ dùng để mô tả chung cho toàn bộ dataset**. Hoàn toàn không có field nào biểu diễn "kiểu ngữ nghĩa" (semantic type) cho từng cột riêng biệt.

### b. Logic _get_error_cells trong Cleaner
Hàm `_get_error_cells` (trong `services/cleaner_service.py`) thực hiện duyệt qua từng cột (dynamic iteration) để tìm lỗi mức cell. Hiện chỉ bắt 4 loại:
1. **Missing (Thiếu dữ liệu):** Check bằng `series.isna()`. Áp dụng ở mức từng cell. Bất kỳ cell nào NA đều bị coi là lỗi.
2. **Type Mismatch (Sai kiểu dũ liệu):** Chỉ kiểm tra nếu `col_type` mong muốn là `numeric` nhưng dtype thực tế là `object`. Dùng hàm `_is_numeric_convertible` với **ngưỡng threshold 80%** (nếu >= 80% số dòng non-null có thể ép thành số, cột đó được coi là số). Những cell ép lỗi (ra NaN) bị đánh dấu `type_mismatch`.
3. **Encoding (Ký tự lạ):** Quét regex `_BAD_CHAR_PATTERN` trên các cột object. Bắt lỗi tại từng cell, không có ngưỡng theo cột.
4. **Duplicate (Trùng lặp dòng):** Xử lý riêng biệt ở row-level (hàm `detect_issues`), không được trả ra ở mức cell.

**Tồn tại:** Cleaner hoàn toàn *mù* ngữ nghĩa. Cột "Email" chứa "123" (được coi là text/numeric), hay cột "STT" chứa "abc" đều được coi là hợp lệ về mặt cấu trúc hiện tại.

---

## 2. Đề xuất Thiết kế Rule + Threshold

### a. Cơ chế sinh Rule ngữ nghĩa cho từng cột (Phương án 1 - Sinh nhãn từ LLM)
Thay vì dùng rule cứng nhắc hay gọi LLM liên tục, ta sẽ:
- **Cập nhật Profiler:** Mở rộng prompt tại `/files/profile`. Gemini sẽ trả về thêm một mảng map mỗi cột với 1 nhãn `semantic_type` cố định (VD: `SEQUENCE_NUMBER`, `PERSON_NAME`, `PHONE_NUMBER`, `EMAIL`, `ADDRESS`, `MONEY`, `GENERAL_TEXT`, `DATE_TIME`, `CODE_ID`), kèm theo `confidence` (độ tự tin) riêng cho từng cột.
- **Quản lý Cache (Không gọi lại LLM):** Sau khi Profiler trả về, thông tin `semantic_type` (và `confidence`) của từng cột sẽ được lưu trực tiếp vào Redis Cache (cùng với `ProfileResponse` lưu theo `file_hash`). Nhờ vậy, khi gọi API `/detect-issues` hay `/manual-clean-preview`, hệ thống chỉ cần đọc lại từ Redis để có nhãn ngữ nghĩa, **đảm bảo không bao giờ gọi lại Gemini nhiều lần**.

### b. Cơ chế Fallback (Bảo vệ tính an toàn)
Để tránh rủi ro AI gắn nhãn sai lệch và ép rule khắt khe lên một cột bình thường:
- Nếu `confidence` của 1 `semantic_type` nhỏ hơn ngưỡng chỉ định (**< 0.75**), hệ thống **BẮT BUỘC fallback về `GENERAL_TEXT`**. Thêm cơ chế logging lại phân phối confidence thực tế của từng lần Gemini phân loại (lưu vào log hệ thống, không lưu DB) để sau này có dữ liệu tinh chỉnh ngưỡng.
- Đối với `GENERAL_TEXT` (và bất kỳ nhãn nào không nằm trong danh sách regex hỗ trợ), hệ thống sẽ **bỏ qua, không áp dụng bất kỳ rule ngữ nghĩa nào**.

### c. Phân cấp mức độ lỗi (Severity: Hint vs. Error) theo Nhãn
Không phải mọi vi phạm Regex đều là lỗi cấu trúc nghiêm trọng. Tùy vào bản chất của `semantic_type`, ta phân cấp mức độ cảnh báo (Severity) khác nhau:
- **Chỉ dừng ở mức "Hint" (Màu vàng/cam):**
  - Gồm các nhãn: `PERSON_NAME`, `PHONE_NUMBER`, `ADDRESS`, `MONEY`, `CODE_ID`.
  - *Lý do:* Dữ liệu tiếng Việt (địa chỉ, SĐT) và định dạng tiền tệ đa dạng (dấu phẩy/chấm, VNĐ/$/đ). CODE_ID cũng có format riêng theo từng công ty. Regex tĩnh dễ bắt sai (false positive). Do độ tin cậy của Regex thấp hơn hẳn, những cột này dù sai rule cũng không bao giờ lên mức "error" đỏ, chỉ gợi ý nhẹ.
- **Được phép lên mức "Error" (Màu đỏ):**
  - Gồm các nhãn: `EMAIL`, `SEQUENCE_NUMBER`, `DATE_TIME`.
  - *Lý do:* Định dạng của những cột này có chuẩn mực rõ ràng toàn cầu hoặc quy luật (như STT phải là số), nên Regex có độ chính xác gần tuyệt đối. Cần test kỹ regex của `CODE_ID` trước khi áp dụng.

### d. Cơ chế Threshold (Ngưỡng cảnh báo cấp Hệ thống)
Để đánh giá một cột có bị "Lỗi Ngữ Nghĩa Hệ Thống" hay không (hiển thị báo cáo ở /detect-issues), ta tính `violation_count` cho cột đó.

```python
VIOLATION_PERCENT_THRESHOLD = 0.05 # 5%
MIN_ABSOLUTE_VIOLATION = 3         # Ít nhất 3 cell

# Ngưỡng động theo kích thước dữ liệu
threshold_limit = max(MIN_ABSOLUTE_VIOLATION, total_non_null_rows * VIOLATION_PERCENT_THRESHOLD)

if violation_count >= threshold_limit:
    # Cột bị cảnh báo lỗi hệ thống (Nếu nhãn được phép lên Error)
else:
    # Chỉ là lỗi lẻ tẻ
```
**Giao diện Manual Clean:**
- Cell sai lẻ tẻ hoặc sai ở cột "Hint" -> `severity: "hint"`, bôi màu **vàng/cam**, user tự xem qua Full-edit mode, **không bắt buộc phải sửa**.
- Cell sai ở cột vượt ngưỡng (nhóm Error) -> `severity: "error"`, bôi màu **đỏ**.

### e. Tương tác với Auto-Clean
**Xác nhận rõ ràng:** Auto-Clean (`/files/auto-clean`) **KHÔNG ĐƯỢC TỰ ĐỘNG SỬA** bất kỳ lỗi ngữ nghĩa nào.
- Tính năng tự động sửa (fill missing, ép kiểu, xóa dòng trùng) chỉ được áp dụng duy nhất cho 4 loại lỗi cấu trúc (Missing, Type, Encoding, Duplicate) như logic hiện tại.
- Lỗi ngữ nghĩa chỉ sinh ra với mục đích **hiển thị cảnh báo trực quan** (đỏ/vàng) trong Báo Cáo và bảng Manual Clean để người dùng con người tự xem xét quyết định.

---

## 3. Đảm bảo Single Source of Truth (SSOT)
Để rules và thresholds không bị trùng lặp, lệch pha giữa bảng Summary và màn Manual Clean:

1. **Central Rule Engine (`app/services/semantic_rules.py`):**
   - Tạo module mới này, chứa mọi Regex pattern, mọi hàm check (VD: `is_valid_email(val)`, `is_valid_phone(val)`).
   - Chứa hằng số Threshold và hàm phân loại Severity (Hint/Error).
2. **Áp dụng chung một đầu mối:**
   - Cả luồng `/files/detect-issues` (trả về Report hiển thị biểu đồ) và luồng `/files/manual-clean-preview` (gọi `_get_error_cells` để render ô màu) ĐỀU PHẢI import và sử dụng chung module `semantic_rules.py`. Không viết regex lẻ tẻ ở các module khác nhau.

---

## 4. Các quyết định đã chốt (Đóng)

1. **Danh sách các nhãn (Semantic Types):** `SEQUENCE_NUMBER`, `PERSON_NAME`, `PHONE_NUMBER`, `EMAIL`, `ADDRESS`, `MONEY`, `GENERAL_TEXT`, `DATE_TIME`, `CODE_ID` (dùng chung cho mã nhân viên/sản phẩm/SKU). KHÔNG dùng GENDER.
2. **Ngưỡng Fallback Confidence:** Nâng lên **0.75**. Nếu confidence < 0.75, fallback về `GENERAL_TEXT`. Có log phân phối confidence.
3. **Cấu hình Threshold vi phạm:** Giữ CỐ ĐỊNH ở `MAX(3 cells, 5%)`, không làm configurable theo ngành/domain ở MVP.
4. **Nhãn "MONEY" và "CODE_ID":** Chuyển sang nhóm `severity: "hint"` do format đa dạng, tránh false positive. Nhóm `error` chỉ có `EMAIL`, `SEQUENCE_NUMBER`, `DATE_TIME`.
