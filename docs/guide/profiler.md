# Tài liệu Chuyên sâu: Mô-đun Profiler (Đánh giá Dữ liệu)

> **Tài liệu kỹ thuật và hướng dẫn người dùng cho DataMind Profiler**  
> Dành cho: Người dùng cuối (giải thích trực quan, dễ hiểu) & Lập trình viên / Quản trị viên hệ thống (chi tiết mã nguồn, thuật toán, ngưỡng định lượng, file:line).

---

## MỤC LỤC
1. [PHẦN A — Hành trình người dùng (User Journey)](#phần-a--hành-trình-người-dùng-user-journey)
2. [PHẦN B — Chi tiết từng thành phần trên màn hình](#phần-b--chi-tiết-từng-thành-phần-trên-màn-hình)
3. [PHẦN C — Cơ chế nhận diện kiểu dữ liệu (Data Type Classification Engine)](#phần-c--cơ-chế-nhận-diện-kiểu-dữ-liệu-data-type-classification-engine)
4. [PHẦN D — AI trong Profiler (Gemini, Groq & Semantic Context)](#phần-d--ai-trong-profiler-gemini-groq--semantic-context)
5. [PHẦN E — Bảng tra cứu số liệu & thời hạn (Constants, Limits & TTLs)](#phần-e--bảng-tra-cứu-số-liệu--thời-hạn-constants-limits--ttls)
6. [PHẦN F — Các vấn đề & bất cập phát hiện trong hệ thống (Issues & Inconsistencies)](#phần-f--các-vấn-đề--bất-cập-phát-hiện-trong-hệ-thống-issues--inconsistencies)

---

## PHẦN A — Hành trình người dùng (User Journey)

Hành trình từ khi người dùng truy cập trang Profiler đến khi nhấn chuyển sang bước Làm sạch (Cleaner):

```
┌─────────────────┐      1. Kéo thả file     ┌────────────────────────┐
│  Trang Profiler │ ───────────────────────> │  Upload & Phân tích    │
│  (Chưa có file) │                          │  POST /files/profile   │
└─────────────────┘                          └───────────┬────────────┘
                                                         │
                                    2. Render bảng cột   ▼
┌─────────────────┐      3. (Tùy chọn) AI    ┌────────────────────────┐
│  Tiếp tục:      │ <─────────────────────── │  Xem xét cấu trúc,     │
│  Làm sạch       │   Ghi đè kiểu / Sửa text │  Ghi đè, Tự động lưu   │
└─────────────────┘                          └────────────────────────┘
```

### Bước 1: Mở trang và Tải dữ liệu
1. Người dùng mở đường dẫn `/dashboard/profiler`.
2. Giao diện kiểm tra `FileSessionContext`:
   - Nếu trong `localStorage` (`datamind_session`) đã có `profileData` hợp lệ, giao diện hiển thị ngay bảng kết quả mà không cần tải lại.
   - Nếu chưa có, hiển thị khung tải file `UploadZone`.
3. Người dùng kéo thả hoặc bấm chọn file (`.csv`, `.xlsx`, `.xls` dung lượng $\le$ 10MB).
4. Frontend gửi request:
   - **API**: `POST /api/v1/files/profile` (dạng `multipart/form-data`).
   - Tham số: `file` (dữ liệu nhị phân), `force_refresh=false`.
5. Backend xử lý:
   - Kiểm tra định dạng đuôi file (`_validate_extension`, `files.py:62`).
   - Đọc toàn bộ nội dung file vào RAM qua `io.BytesIO` (không ghi ra ổ cứng đĩa vật lý).
   - Tính toán `file_hash = "v4:" + md5(content).hexdigest()`.
   - Kiểm tra cache Redis Upstash: key `profile:{user_id, file_hash}`.
     - **Nếu Cache HIT**: Trả về ngay cấu trúc đã phân tích trước đó, đồng thời làm mới `filebytes:{user_id, file_hash}` với TTL 5 giờ (18000). Không tốn tài nguyên CPU phân tích lại.
     - **Nếu Cache MISS**: Đọc DataFrame qua Pandas (`_read_dataframe`), làm sạch cột rác vô danh `Unnamed`, loại bỏ dòng rỗng hoàn toàn, sau đó chạy hàm phân tích thuần toán học `profiler_service.profile_dataframe(df)`.
   - Kết quả phân tích được lưu vào Redis:
     - `profile:{user_id, file_hash}` (TTL: 86.400 giây = 24 giờ).
     - `filebytes:{user_id, file_hash}` (TTL: 18.000 giây = 5 giờ).
     - `report_sections:{user_id}:{file_hash}` section `"profiler"` (TTL: 24 giờ).
     - `llm_ctx:{user_id}:{file_hash}` (Part 1 Markdown tóm tắt dataset cho AI Explain sau này, TTL: 24 giờ).
6. Frontend nhận phản hồi:
   - Lưu vào `FileSessionContext` và đồng bộ xuống `localStorage`.
   - Khởi tạo đồng hồ đếm ngược 5 giờ xóa file tạm trên footer.

### Bước 2: Xem xét cấu trúc & Kiểm tra các cột cảnh báo
1. Giao diện hiển thị thanh tóm tắt số lượng dòng, số lượng cột và chip cảnh báo cam nếu có cột bất thường (ví dụ: `2 cột cần xem`).
2. Tải song song:
   - `GET /api/v1/files/profiler-state?file_hash=...`: Lấy mô tả ngữ cảnh hoặc bản nháp AI đã lưu trước đó (nếu người dùng quay lại file cũ). Hoàn toàn miễn phí, không tốn quota.
   - `GET /api/v1/files/ai-usage`: Lấy hạn mức AI trong ngày của tài khoản (Free 5 lượt hoặc Pro 20 lượt).
3. Người dùng duyệt danh sách 10 cột đầu tiên (hoặc bấm "Hiển thị toàn bộ").
4. Người dùng bấm vào chip lọc để xem nhanh các cột có vấn đề: thiếu nhiều ô trống (>60%), chỉ có 1 giá trị duy nhất (không có biến thiên), hoặc số liệu bị lưu nhầm dạng văn bản tiền tệ/phần trăm (`disguised_numeric`).

### Bước 3: Ghi đè kiểu dữ liệu (Type Override)
1. Nếu phát hiện hệ thống tự động nhận diện chưa tối ưu (ví dụ cột mã nhân viên dạng số nguyên nhưng người dùng muốn coi là danh mục), người dùng bấm vào dropdown kiểu dữ liệu của cột đó và chọn kiểu mới: `numeric`, `categorical`, `datetime`, `multiple_choice`, `text`.
2. Hành động này **hoàn toàn miễn phí**, không gọi API backend tại bước này mà được lưu vào `fileSession.overrides` trong bộ nhớ frontend (và `localStorage`).
3. Giao diện hiển thị badge cam `Đã đổi từ [kiểu cũ]` kèm nút `Hoàn tác`.

### Bước 4: (Tùy chọn) Phân tích ngữ cảnh AI
1. Người dùng bấm nút **"Phân tích AI"** tại hộp bối cảnh dữ liệu.
2. Gửi request:
   - **API**: `POST /api/v1/files/ai-context`.
   - Payload: `{"file_hash": "...", "lang": "vi", "is_reanalyze": false}`.
3. Backend kiểm tra hạn mức `check_ai_quota`: Nếu đã hết lượt, trả về lỗi HTTP 429 `ERR_AI_QUOTA_EXCEEDED` (Frontend mở `UpgradeModal`).
4. Backend gọi tầng AI Client (`ai_client.py`):
   - Ưu tiên gọi Google Gemini (`gemini-2.0-flash` hoặc model trong biến môi trường).
   - Nếu Gemini lỗi 5xx hoặc timeout, tự động thử lại 1 lần sau 1s.
   - Nếu Gemini bị giới hạn 429 hoặc tiếp tục lỗi, tự động chuyển đổi dự phòng (fallback) sang Groq API (`GROQ_MODEL`).
   - Nếu cả 2 nhà cung cấp AI đều không phản hồi, trả về HTTP 503 `ERR_AI_UNAVAILABLE` (người dùng **không bị trừ lượt**).
5. Khi thành công:
   - Trừ 1 lượt quota vào bảng `user_ai_usage` (ghi nhận feature `profiler`).
   - Cập nhật thông tin lĩnh vực `domain`, độ tin cậy `confidence`, bản tóm tắt `draft_summary` vào Redis `profiler_ctx:{user_id}:{file_hash}` và `profile:{user_id, file_hash}` (TTL 24 giờ).
   - Tự động điền bản nháp vào ô văn bản mô tả.

### Bước 5: Chỉnh sửa mô tả & Tự động lưu (Autosave)
1. Người dùng có thể sửa đổi nội dung ô mô tả ngữ cảnh dataset.
2. Bộ đếm thời gian Debounce 800ms kích hoạt:
   - **API**: `POST /api/v1/files/profiler-state`.
   - Payload: `{"file_hash": "...", "description": "...", "description_source": "ai_edited" | "user"}`.
   - Hoàn toàn **miễn phí**, lưu trực tiếp vào Redis `profiler_ctx:{user_id}:{file_hash}` và `user_context:{user_id, file_hash}`.
   - Icon góc phải hiện `Đang lưu...` -> `Đã lưu phân tích AI · HH:mm`.

### Bước 6: Nhấn "Tiếp tục: Làm sạch"
1. Người dùng bấm nút chính màu xanh lá `Tiếp tục: Làm sạch →`.
2. Frontend thực hiện đồng bộ (flush) ngay lập tức bản lưu mô tả cuối cùng qua `saveProfilerState`.
3. Chuyển hướng sang `/dashboard/cleaner`.
4. Toàn bộ `overridden_types` được mang theo để mô-đun Cleaner áp dụng các giải thuật điền khuyết và chuẩn hóa kiểu tương ứng.

---

## PHẦN B — Mỗi thứ trên màn hình

---

### 1. Vùng tải dữ liệu (Upload Zone)
- **id**: `profiler-upload-zone`
- **Người dùng thấy gì**:
  - Tiếng Việt: `"Kéo thả file vào đây"` / `"hoặc click để chọn file — CSV, XLSX, XLS (tối đa 10MB)"`.
  - English: `"Drag and drop data file here"` / `"or click to browse — supports CSV, XLSX, XLS (max 10MB)"`.
- **Ý nghĩa**: Khu vực tương tác nhận file dữ liệu dạng kéo thả hoặc mở hộp thoại chọn tệp tin từ máy tính.
- **Cách tính / quy tắc**:
  - Hỗ trợ định dạng phần mở rộng: `.csv`, `.xlsx`, `.xls` (`ALLOWED_EXTENSIONS`, so sánh chữ thường không phân biệt hoa thường).
  - Dung lượng file tối đa: $10 \times 1024 \times 1024 = 10.485.760$ bytes (10MB).
  - Trạng thái kéo file hover: chuyển viền sang màu xanh `forest` (`#1B4324`) và nền `sage`.
- **Ví dụ thật**:
  - File `sales_2024.xlsx` (2.4MB) $\rightarrow$ Chấp nhận, bắt đầu phân tích.
  - File `large_database.csv` (11.2MB) $\rightarrow$ Báo lỗi `ERR_FILE_TOO_LARGE`.
  - File `report.pdf` $\rightarrow$ Báo lỗi `ERR_FILE_EXT_INVALID`.
- **Người dùng có thể làm gì**: Kéo thả tệp tin hoặc click chuột để chọn file. Chi phí: Miễn phí.
- **Ảnh hưởng tới bước sau**: Xác định toàn bộ dữ liệu gốc truyền vào bộ nhớ đệm phục vụ cho Cleaner và Visualize.
- **Trường hợp đặc biệt / dễ hiểu nhầm**:
  - Chọn file CSV nhưng phân tách bằng dấu chấm phẩy (`;`) thay vì dấu phẩy (`,`) có thể khiến Pandas gộp toàn bộ vào 1 cột duy nhất.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/UploadZone.jsx:1-45`.
  - Backend: `backend/app/routers/files.py:58-80, 150-180`.
- **Tooltip**: Kéo thả file dữ liệu CSV hoặc Excel (tối đa 10MB) để bắt đầu phân tích. / Drag and drop a CSV or Excel file (up to 10MB) to start analyzing.
- **Giải thích ngắn cho bảng Info**:
  - VI: Khu vực tải tệp dữ liệu lên hệ thống. Hỗ trợ định dạng bảng tính thông dụng với dung lượng tối đa 10MB. File được xử lý hoàn toàn trong bộ nhớ RAM bảo mật.
  - EN: Upload zone for dataset files. Supports common spreadsheet formats up to 10MB. Files are processed securely in memory buffer.

---

### 2. Tiêu đề và Mô tả phụ của trang (Page Header & Subtitle)
- **id**: `profiler-page-header`
- **Người dùng thấy gì**:
  - Tiêu đề: `"Đánh giá dữ liệu"` / `"Data Profiler"`.
  - Khi chưa có file: `"Tổng quan cấu trúc và phân tích chất lượng dữ liệu"` / `"Structural overview and data quality analysis"`.
  - Khi đã có file: `"{cols} cột · {rows} dòng · {displayDomain}"` (Ví dụ: `"64 cột · 232 dòng · Thương mại điện tử"`).
- **Ý nghĩa**: Cung cấp ngữ cảnh cấp cao về quy mô của tập dữ liệu và lĩnh vực hoạt động sau khi nhận diện.
- **Cách tính / quy tắc**:
  - Định dạng số theo ngôn ngữ giao diện: `vi-VN` (phân cách hàng nghìn bằng dấu chấm `.`), `en-US` (dấu phẩy `,`).
  - Lĩnh vực `displayDomain`: Ánh xạ mã chuẩn từ `getDomainI18nKey(domain)` ra ngôn ngữ hiển thị. Chỉ hiển thị đuôi `· Lĩnh vực` khi AI đã phân tích (`aiAnalyzed = true`).
- **Ví dụ thật**: `total_columns = 64`, `total_rows = 232`, `domain = "E-commerce"` $\rightarrow$ Hiển thị: `"64 cột · 232 dòng · Thương mại điện tử"`.
- **Người dùng có thể làm gì**: Xem thông tin tổng quan, bấm nút trợ giúp. Miễn phí.
- **Ảnh hưởng tới bước sau**: Số dòng và số cột ban đầu là căn cứ tính toán tỷ lệ làm sạch ở Bước 2.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Số dòng này là số dòng dữ liệu thực tế sau khi đã tự động loại bỏ các dòng rỗng 100% (`df.dropna(how='all')`).
- **Code**:
  - Frontend: `frontend/src/pages/Profiler.jsx:475-485`.
  - Backend: `backend/app/routers/files.py:115, 252-253`.
- **Tooltip**: Thông tin quy mô và lĩnh vực của tập dữ liệu. / Dataset dimension and domain overview.
- **Giải thích ngắn cho bảng Info**:
  - VI: Cho biết số lượng dòng và cột của tệp dữ liệu đã tải lên. Nếu đã kích hoạt AI, hệ thống sẽ gắn kèm nhãn lĩnh vực dự đoán của tập dữ liệu.
  - EN: Displays the total rows and columns of the uploaded file. Displays the predicted domain tag once AI analysis is triggered.

---

### 3. Nút "Tải file khác" (Upload New File Button)
- **id**: `profiler-btn-upload-new`
- **Người dùng thấy gì**: Icon `FileSpreadsheet` + `"Tải file khác"` / `"Upload New File"`.
- **Ý nghĩa**: Cho phép người dùng hủy phiên phân tích hiện tại để tải lên một tệp tin dữ liệu mới.
- **Cách tính / quy tắc**: Kích hoạt hàm `handleReset()`, xóa toàn bộ trạng thái trong React state, xóa `overrides`, xóa `profileData` trong `fileSessionContext`.
- **Ví dụ thật**: Bấm nút $\rightarrow$ Màn hình quay trở về trạng thái khung Upload rỗng ban đầu.
- **Người dùng có thể làm gì**: Click để tải file mới. Miễn phí.
- **Ảnh hưởng tới bước sau**: Xóa sạch phiên làm việc cục bộ của file cũ, buộc người dùng phải nạp lại từ đầu nếu muốn tiếp tục.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Không xóa file cache trên server Redis (file cache 24h vẫn tồn tại trên server cho đến khi hết hạn TTL).
- **Code**: `frontend/src/pages/Profiler.jsx:502-510`.
- **Tooltip**: Xóa phiên làm việc hiện tại để tải lên một file khác. / Clear current session to upload another file.
- **Giải thích ngắn cho bảng Info**:
  - VI: Nút bấm giúp làm mới giao diện và đặt lại phiên làm việc để người dùng có thể chọn một file dữ liệu hoàn toàn mới.
  - EN: Resets the current session interface so the user can select and upload a new dataset.

---

### 4. Menu tùy chọn khác "⋯" (More Actions Dropdown)
- **id**: `profiler-menu-more`
- **Người dùng thấy gì**: Nút icon ba chấm ngang `⋯` (`MoreHorizontal`). Khi click xổ ra 2 mục:
  1. Icon `RotateCw` + `"Đọc lại file (miễn phí)"` / `"Re-read file (free)"`.
  2. Icon `Download` + `"Tải báo cáo JSON"` / `"Download Report"`.
- **Ý nghĩa**: Cung cấp các thao tác bổ trợ không nằm trong luồng chính của giao diện.
- **Cách tính / quy tắc**:
  - Menu tự đóng khi click ra ngoài (`useRef` + `mousedown listener`).
  - Mục 1: Gọi lại `handleFile(lastFile, forceRefresh=true)`. Gửi param `force_refresh=true` lên backend để xóa cache cũ trong Redis và phân tích lại từ đầu.
  - Mục 2: Xuất toàn bộ JSON của `result` (ProfileResponse) ra file `${fileName}_report.json`.
- **Ví dụ thật**: File đang có cache cũ nhưng người dùng vừa cập nhật lại cấu trúc logic $\rightarrow$ Chọn "Đọc lại file (miễn phí)" để ép server tính toán lại.
- **Người dùng có thể làm gì**: Buộc tính toán lại hoặc tải file JSON về máy tính. Miễn phí.
- **Ảnh hưởng tới bước sau**: "Đọc lại file" sẽ xóa cache profile trong Redis, buộc Cleaner cũng phải tính toán trên dữ liệu mới.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: "Đọc lại file" không gọi Gemini nên hoàn toàn không mất lượt AI quota.
- **Code**: `frontend/src/pages/Profiler.jsx:512-548`.
- **Tooltip**: Các tùy chọn nâng cao: đọc lại file hoặc tải báo cáo phân tích. / Advanced options: re-parse file or download report.
- **Giải thích ngắn cho bảng Info**:
  - VI: Menu chứa các thao tác mở rộng gồm đọc lại cấu trúc file từ đầu (xóa bộ nhớ đệm) và tải về bản tóm tắt phân tích định dạng JSON.
  - EN: Dropdown menu providing advanced actions: re-reading raw file data (bypassing cache) and downloading the JSON profile report.

---

### 5. Nút chính "Tiếp tục: Làm sạch →" (Continue to Clean Button)
- **id**: `profiler-next-btn`
- **Người dùng thấy gì**: Nút màu xanh lục đậm (`bg-forest`) nổi bật: `"Tiếp tục: Làm sạch"` kèm icon mũi tên sang phải `ArrowRight`.
- **Ý nghĩa**: Nút chuyển bước chính (CTA - Call To Action) để hoàn tất giai đoạn Đánh giá và tiến sang giai đoạn Làm sạch dữ liệu.
- **Cách tính / quy tắc**:
  - Xóa timer debounce tự động lưu.
  - Gọi cưỡng bức `saveProfilerState` để đồng bộ ngay lập tức mô tả cuối cùng lên Redis.
  - Đồng bộ `overrides` vào `fileSessionContext`.
  - Điều hướng sang `/dashboard/cleaner`.
- **Ví dụ thật**: Người dùng vừa nhập mô tả và sửa 2 cột từ `text` sang `numeric` $\rightarrow$ Nhấn nút $\rightarrow$ Dữ liệu được lưu ngay lập tức và trang chuyển sang Cleaner.
- **Người dùng có thể làm gì**: Click để tiến sang bước tiếp theo. Miễn phí.
- **Ảnh hưởng tới bước sau**: Kích hoạt việc truyền cấu trúc cột đã sửa đổi sang cho thuật toán Auto-Clean.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Nếu người dùng chỉnh sửa loại dữ liệu mà không bấm nút này (ví dụ bấm trực tiếp vào menu thanh bên để đổi trang), các thay đổi override vẫn được lưu trong `localStorage` nhưng có thể chưa được đẩy lên Redis nếu chưa hết thời gian debounce.
- **Code**: `frontend/src/pages/Profiler.jsx:201-216, 551-560`.
- **Tooltip**: Lưu cấu trúc và chuyển sang bước Làm sạch dữ liệu. / Save schema and proceed to data cleaning step.
- **Giải thích ngắn cho bảng Info**:
  - VI: Nút điều hướng chính đưa người dùng từ bước Đánh giá sang bước Làm sạch. Hệ thống sẽ tự động lưu lại toàn bộ các thiết lập ghi đè kiểu dữ liệu trước khi chuyển trang.
  - EN: Primary action button that moves the user from Profiler to Cleaner, automatically saving all column type overrides beforehand.

---

### 6. Dải tóm tắt quy mô dữ liệu (Summary Band)
- **id**: `profiler-summary-band`
- **Người dùng thấy gì**:
  - Dòng chữ: `"{rows} dòng · {cols} cột"` (Ví dụ: `"1.250 dòng · 14 cột"`).
  - Chip cảnh báo (nếu có cột có vấn đề): Icon `AlertTriangle` + `"{count} cột cần xem"`.
  - Bộ đếm hiển thị: `"Đang hiển thị {visible} trên {total} cột"`.
  - Nút trợ giúp icon dấu chấm hỏi tròn `HelpCircle`.
- **Ý nghĩa**: Bảng điều khiển nhanh giúp nắm bắt khối lượng dữ liệu và số lượng cột bất thường cần người dùng kiểm tra lại.
- **Cách tính / quy tắc**:
  - Số cột cần xem (`attentionCount`) được tính bằng cách đếm các cột thỏa mãn ít nhất 1 trong 4 điều kiện nghiêm ngặt:
    1. Cột rỗng hơn 60% (`null_pct > 60`).
    2. Cột chỉ có 1 giá trị duy nhất (`unique_count === 1`).
    3. Cột số bị lưu nhầm dạng chuỗi (`disguised_numeric.is_disguised === true`).
    4. Cột không có tên ban đầu (`unnamed_warning !== null`).
  - *Lưu ý*: Cột chữ bình thường (`text`) **không** bị tính là cảnh báo.
- **Ví dụ thật**: Dataset có 10 cột, trong đó cột A rỗng 70%, cột B chỉ chứa chữ "VN", cột C chứa "100.000 VND" $\rightarrow$ `attentionCount = 3` $\rightarrow$ Hiện chip `"3 cột cần xem"`.
- **Người dùng có thể làm gì**: Nhấn vào chip `"x cột cần xem"` để bật/tắt chế độ lọc chỉ xem các cột này. Miễn phí.
- **Ảnh hưởng tới bước sau**: Giúp người dùng xử lý sớm các cột dị biệt trước khi đưa sang Cleaner.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Chip cảnh báo màu vàng cam không phải là lỗi hệ thống, mà là lời nhắc dữ liệu có điểm đặc biệt cần lưu ý.
- **Code**: `frontend/src/components/Profiler/ColumnTable.jsx:28-34, 78-136`.
- **Tooltip**: Tóm tắt số dòng, số cột và các cột cần lưu ý trong dataset. / Summary of rows, columns, and columns requiring attention.
- **Giải thích ngắn cho bảng Info**:
  - VI: Thanh thông tin tóm lược quy mô của bảng dữ liệu và tổng hợp số lượng các cột có nguy cơ lỗi cao như thiếu nhiều dữ liệu hoặc bị sai định dạng.
  - EN: Summary strip displaying total dataset dimensions and highlighting columns that require user review due to missing data or type issues.

---

### 7. Chip lọc "Cột cần xem" (Attention Filter Chip)
- **id**: `profiler-chip-needs-review`
- **Người dùng thấy gì**:
  - Trạng thái chưa bấm: Nền vàng nhạt, chữ nâu cam, icon tam giác cảnh báo: `"{n} cột cần xem"` (Ví dụ: `"2 cột cần xem"`).
  - Trạng thái đang lọc: Nền cam đậm, chữ trắng, kèm icon chữ `X` nhỏ: `"{n} cột cần xem ✕"` kèm chú thích `"(đang lọc các cột cần xem)"`.
- **Ý nghĩa**: Bộ lọc nhanh một chạm (one-click filter) thu gọn bảng chỉ hiển thị những cột có vấn đề cần can thiệp.
- **Cách tính / quy tắc**:
  - Khi click: đảo trạng thái `filterNeedsReview = !filterNeedsReview`.
  - Danh sách cột hiển thị `filteredCols` sẽ chuyển từ toàn bộ `cols` sang `cols.filter(isAttentionColumn)`.
- **Ví dụ thật**: Bảng có 50 cột, chỉ có 2 cột bị rỗng 90% $\rightarrow$ Bấm chip $\rightarrow$ Bảng ngay lập tức chỉ hiện đúng 2 cột này.
- **Người dùng có thể làm gì**: Click để lọc hoặc bỏ lọc. Miễn phí.
- **Ảnh hưởng tới bước sau**: Không ảnh hưởng tới dữ liệu cuối, chỉ thay đổi giao diện hiển thị cho người dùng.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Nếu không có cột nào có vấn đề (`attentionCount === 0`), chip này hoàn toàn ẩn đi.
- **Code**: `frontend/src/components/Profiler/ColumnTable.jsx:88-119`.
- **Tooltip**: Bấm để lọc các cột cần xem / Bấm để xem tất cả cột. / Click to filter columns needing review / Click to show all columns.
- **Giải thích ngắn cho bảng Info**:
  - VI: Nút lọc nhanh giúp người dùng tập trung ngay vào các cột dữ liệu bất thường (thiếu dữ liệu nặng, thiếu tiêu đề cột hoặc số bị lẫn ký tự) thay vì phải tìm kiếm thủ công.
  - EN: Quick toggle button allowing users to isolate problematic columns (high missing rate, unnamed headers, disguised numbers) without manual scrolling.

---

### 8. Popover giải thích tác động ghi đè (Override Help Popover)
- **id**: `profiler-popover-override-help`
- **Người dùng thấy gì**: Nút icon tròn `HelpCircle`. Khi bấm hiện hộp thoại giải thích:
  - Tiêu đề: `"Tác động khi đổi loại dữ liệu"` / `"Impact of changing data types"`.
  - Danh sách quy tắc xử lý của bước Làm sạch:
    - **Số liệu (Numeric)**: Điền ô trống bằng số trung vị (median) & chuyển đổi sang số.
    - **Danh mục (Categorical)**: Điền ô trống bằng giá trị phổ biến nhất (mode).
    - **Văn bản (Text)**: Bỏ qua các bước kiểm tra cấu trúc & chuẩn hóa số.
- **Ý nghĩa**: Minh bạch hóa quy tắc nghiệp vụ giúp người dùng hiểu rõ việc đổi loại dữ liệu ở đây sẽ làm thay đổi kết quả làm sạch ở bước sau như thế nào.
- **Cách tính / quy tắc**:
  - Hiển thị tĩnh từ bộ từ điển dịch ngôn ngữ (`popover_rule_numeric`, `popover_rule_categorical`, `popover_rule_text`).
- **Ví dụ thật**: Người dùng phân vân có nên đổi cột điểm khảo sát từ Văn bản sang Số liệu không $\rightarrow$ Mở popover để biết hệ thống sẽ điền trung vị nếu đổi sang Số liệu.
- **Người dùng có thể làm gì**: Bấm để xem hướng dẫn nghiệp vụ. Miễn phí.
- **Ảnh hưởng tới bước sau**: Giúp người dùng đưa ra quyết định override chính xác cho Cleaner.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: UI popover ghi "điền bằng mode" cho Categorical, nhưng thực tế code `auto_clean` trong backend hiện đang điền `"Không xác định"` (xem Phần F).
- **Code**: `frontend/src/components/Profiler/ColumnTable.jsx:137-189`.
- **Tooltip**: Tác động khi đổi loại dữ liệu sang bước Làm sạch. / Impact of overriding data types on Cleaner step.
- **Giải thích ngắn cho bảng Info**:
  - VI: Hộp thoại giải thích quy tắc ứng xử của hệ thống khi người dùng can thiệp đổi kiểu dữ liệu, cho biết mỗi kiểu sẽ được điền khuyết và chuyển đổi thế nào ở bước Làm sạch.
  - EN: Explanatory dialog detailing how the Cleaner module will treat and impute missing cells based on the user's manual type overrides.

---

### 9. Cột bảng: Tên cột & Cảnh báo (Column Name & Badges)
- **id**: `profiler-col-name`
- **Người dùng thấy gì**:
  - Tên cột in đậm (nếu tên dài tự động thu gọn và có nút "Xem thêm" / "Thu gọn").
  - Các icon/badge trạng thái xuất hiện cạnh tên cột:
    - `null_pct > 60`: Icon tròn đỏ `AlertCircle` kèm tooltip `"Thiếu hơn 60% dữ liệu"`.
    - `unique_count === 1`: Icon tròn cam `AlertCircle` kèm tooltip `"Chỉ có 1 giá trị duy nhất"`.
    - `disguised_numeric.is_disguised`: Badge chữ nhật màu cam vàng `"Có thể là số"` (`AlertTriangle`).
    - `unnamed_warning`: Dòng ghi chú màu xanh dương `"Cột này chưa có tên — bạn có thể đặt tên trong phần 'Sửa kiểu dữ liệu'."`.
- **Ý nghĩa**: Nhận diện danh tính của thuộc tính trong bảng kèm theo các cảnh báo nhanh về dị biệt cấu trúc.
- **Cách tính / quy tắc**:
  - `null_pct = round((null_count / total_rows) * 100, 2)`.
  - `unique_count = df[col].nunique()`.
  - Cột vô danh: Kiểm tra tiền tố `col.name.startswith("Cột không tên")` từ backend (`profiler_service.py:210`).
- **Ví dụ thật**: Cột `Unnamed: 3` có dữ liệu $\rightarrow$ Đổi thành `Cột không tên (A)` kèm dòng nhắc màu xanh dương.
- **Người dùng có thể làm gì**: Đọc tên cột, rê chuột xem tooltip cảnh báo, bấm "Xem thêm" nếu tên cột dài quá 3 dòng. Miễn phí.
- **Ảnh hưởng tới bước sau**: Tên cột được giữ nguyên để lập biểu đồ và làm sạch.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Cột có tên ban đầu là `Unnamed` nhưng toàn bộ ô đều rỗng (100% NaN) đã bị hệ thống tự động xóa bỏ hoàn toàn ngay từ lúc đọc file (`files.py:101-103`).
- **Code**:
  - Frontend: `frontend/src/components/Profiler/ColumnTable.jsx:243-289`.
  - Backend: `backend/app/services/profiler_service.py:208-212`.
- **Tooltip**: Tên của thuộc tính trong dữ liệu kèm các cảnh báo bất thường. / Attribute name with structural warning indicators.
- **Giải thích ngắn cho bảng Info**:
  - VI: Cột hiển thị tiêu đề thuộc tính trong file của bạn. Các biểu tượng cảnh báo bên cạnh sẽ báo hiệu nếu cột bị trống quá nhiều, không có sự biến thiên giá trị, hoặc có dấu hiệu là số liệu bị ghi nhầm thành chữ.
  - EN: Displays the attribute header. Warning icons indicate severe data emptiness, zero variance (single value), or numeric data disguised as text.

---

### 10. Dropdown chọn kiểu dữ liệu (Type Dropdown Button)
- **id**: `profiler-type-dropdown`
- **Người dùng thấy gì**:
  - Nút bấm thể hiện kiểu hiện tại: Icon kiểu + Tên tiếng Việt (`Số liệu`, `Thời gian`, `Danh mục`, `Nhiều lựa chọn`, `Văn bản`) + Mũi tên trỏ xuống `ChevronDown`.
  - Nếu đã bị người dùng đổi: Nút chuyển sang viền màu vàng cam, bên dưới xuất hiện dòng chú thích nhỏ `Đã đổi từ [Kiểu gốc]` kèm nút gạch chân `"Hoàn tác"`.
  - Khi bấm: Mở menu chọn nhanh gồm 5 kiểu dữ liệu chuẩn với icon trực quan.
- **Ý nghĩa**: Cho phép người dùng ghi đè (override) quyết định nhận diện tự động của máy móc khi phát hiện hệ thống hiểu sai ý định của dữ liệu.
- **Cách tính / quy tắc**:
  - Kiểu hiệu lực: `effectiveType = overrides[col.name] || col.detected_type`.
  - Khi bấm chọn một kiểu mới: gọi `handleOverride(colName, newType)` cập nhật state `overrides`.
  - Khi bấm "Hoàn tác": gọi `onReset(colName, detectedType)` xóa key ghi đè khỏi state.
- **Ví dụ thật**: Cột `Mã bưu chính` gồm các số như `70000`, `10000` bị máy nhận là `numeric` $\rightarrow$ Người dùng đổi sang `categorical` để không bị tính trung bình cộng vô nghĩa.
- **Người dùng có thể làm gì**: Chọn lại 1 trong 5 kiểu dữ liệu hoặc hoàn tác về ban đầu. Miễn phí.
- **Ảnh hưởng tới bước sau**: Tác động trực tiếp đến giải thuật làm sạch (Cleaner) và các loại biểu đồ được phép vẽ (Visualize).
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Việc đổi kiểu ở đây chưa làm biến đổi giá trị của dữ liệu thật; nó chỉ lưu lại thiết lập để mô-đun Cleaner biết cách ép kiểu và chuẩn hóa ở bước sau.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/TypeDropdownButton.jsx:1-140`.
  - Hằng số: `frontend/src/constants/dataTypes.js:16-50`.
- **Tooltip**: Nhấn để thay đổi kiểu dữ liệu của cột cho các bước xử lý sau. / Click to override column data type for downstream steps.
- **Giải thích ngắn cho bảng Info**:
  - VI: Cho phép người dùng điều chỉnh lại phân loại dữ liệu của cột nếu máy nhận diện chưa đúng thực tế. Bạn có thể dễ dàng hoàn tác lại kiểu ban đầu bất cứ lúc nào.
  - EN: Enables manual correction of column data types. Overrides direct downstream imputation rules, and can be undone at any time.

---

### 11. Cột "Giá trị khác nhau" (Unique Count)
- **id**: `profiler-col-unique-count`
- **Người dùng thấy gì**:
  - Tiêu đề 2 dòng: `"Giá trị"` / `"khác nhau"` (English: `"Unique"`).
  - Nội dung ô: Số nguyên định dạng phông chữ đơn cách `font-mono`, căn giữa. Ví dụ: `2`, `15`, `2.430`.
- **Ý nghĩa**: Cho biết số lượng giá trị phân biệt (cardinality) có trong cột, không tính các giá trị trùng lặp.
- **Cách tính / quy tắc**:
  - Backend: `series.nunique()`, tương đương số lượng phần tử duy nhất sau khi loại bỏ giá trị rỗng NaN.
  - Nếu `unique_count === 1`: Cột không có tính biến thiên (zero variance), backend đánh dấu `skip_chart = True` và kích hoạt cảnh báo cam.
- **Ví dụ thật**: Cột `Giới tính` có 1.000 dòng gồm "Nam", "Nữ", "Nam", "Nam" $\rightarrow$ `unique_count = 2`.
- **Người dùng có thể làm gì**: Đánh giá độ phân tán của dữ liệu. Miễn phí.
- **Ảnh hưởng tới bước sau**: Cột có `unique_count <= 1` sẽ bị mô-đun Visualize từ chối vẽ biểu đồ để tránh tạo biểu đồ vô nghĩa.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Không bao gồm số lượng ô rỗng `NaN`. Một cột có 100 dòng rỗng và 1 dòng có số `5` thì `unique_count` vẫn là `1`.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/ColumnTable.jsx:302-306`.
  - Backend: `backend/app/services/profiler_service.py:198, 213-215`.
- **Tooltip**: Số lượng các giá trị khác nhau xuất hiện trong cột này. / Count of distinct values found in this column.
- **Giải thích ngắn cho bảng Info**:
  - VI: Thể hiện số lượng các giá trị không trùng lặp có trong cột {col_name}. Số giá trị càng nhỏ chứng tỏ dữ liệu mang tính phân nhóm danh mục; số giá trị bằng 1 cho thấy dữ liệu đơn điệu không thể vẽ biểu đồ.
  - EN: Shows the count of distinct values in {col_name}. Low cardinality indicates categorical data; a count of 1 denotes zero variance which prevents chart generation.

---

### 12. Cột "Ô trống" (Null Percentage)
- **id**: `profiler-col-null-pct`
- **Người dùng thấy gì**:
  - Tiêu đề: `"Ô trống"` (English: `"Null%"`).
  - Nội dung: Tỷ lệ phần trăm có ký hiệu `%`.
    - Bằng 0%: Màu xám nhạt `0%`.
    - Dưới 30%: Màu chữ bình thường.
    - Từ 30% đến 60%: Màu cam đậm `text-[#B45309]` in vừa.
    - Trên 60%: Màu đỏ đậm `text-[#9F2F2D]` in đậm kèm icon cảnh báo đỏ ở tên cột.
- **Ý nghĩa**: Đo lường mức độ hoàn thiện của cột dữ liệu, chỉ ra lượng dữ liệu bị khuyết thiếu.
- **Cách tính / quy tắc**:
  - Công thức: $\text{null\_pct} = \text{round}\left(\frac{\text{null\_count}}{\text{total\_rows}} \times 100, 2\right)$.
  - `null_count = int(series.isna().sum())`.
  - Nếu `total_rows == 0` thì trả về `0.0`.
- **Ví dụ thật**: Bảng 200 dòng, cột có 50 ô trống $\rightarrow$ $\frac{50}{200} \times 100 = 25.0\%$ (màu thường). Có 150 ô trống $\rightarrow$ $75.0\%$ (màu đỏ đậm).
- **Người dùng có thể làm gì**: Đánh giá mức độ tin cậy để quyết định giữ hay xóa cột ở bước Cleaner. Miễn phí.
- **Ảnh hưởng tới bước sau**: Trong bước Làm sạch tự động (Auto-Clean), mọi cột có tỷ lệ trống $\ge 90\%$ sẽ bị tự động xóa bỏ hoàn toàn (`columns_dropped`, `cleaner_service.py:344`).
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Tỷ lệ này trong Profiler chỉ tính trên các ô `NaN` thực tế của Pandas. Các chuỗi như `"N/A"`, `"missing"` chưa được tính vào ô trống ở bước này trừ khi chúng được xử lý qua hàm nhận diện số ẩn.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/ColumnTable.jsx:308-324`.
  - Backend: `backend/app/services/profiler_service.py:196-197`.
- **Tooltip**: Tỷ lệ phần trăm dữ liệu bị bỏ trống hoặc không có giá trị. / Percentage of missing or empty cells in this column.
- **Giải thích ngắn cho bảng Info**:
  - VI: Cho biết tỷ lệ phần trăm các dòng bị thiếu thông tin trong cột {col_name}. Các cột thiếu trên 60% dữ liệu sẽ bị cảnh báo đỏ và những cột thiếu trên 90% sẽ tự động bị loại bỏ trong bước Làm sạch.
  - EN: Indicates the percentage of missing cells in {col_name}. Columns with over 60% missing data are flagged in red, and those exceeding 90% will be dropped during Auto-Clean.

---

### 13. Cột "Gợi ý biểu đồ" (Suggested Charts)
- **id**: `profiler-col-chart-hints`
- **Người dùng thấy gì**:
  - Các pill badge màu xanh lá nhạt với viền xanh: Icon biểu đồ + Tên loại (`Cột`, `Tròn`, `Đường`, `Phân phối`).
  - Nếu kiểu là `text`: Dòng chữ nghiêng màu xám `"Không phù hợp để vẽ biểu đồ"`.
  - Nếu không có biểu đồ phù hợp khác: Ký tự gạch ngang `—`.
- **Ý nghĩa**: Báo trước cho người dùng biết cột này có thể sử dụng cho những loại trực quan hóa nào ở Mô-đun 3 (Visualize).
- **Cách tính / quy tắc**:
  - Hàm `getSuggestedChartsForType(effectiveType, originalCol)`:
    - Nếu `skip_chart === true` hoặc `unique_count <= 1`: Trả về `[]`.
    - `numeric`: `["bar", "line", "histogram"]`.
    - `datetime`: `["line"]`.
    - `categorical`: `["pie", "bar"]`.
    - `multiple_choice`: `["bar", "pie"]`.
    - `text`: `[]`.
- **Ví dụ thật**: Cột `Doanh số` kiểu `numeric` $\rightarrow$ Hiện 3 huy hiệu: `Cột`, `Đường`, `Phân phối`. Khi người dùng đổi kiểu sang `categorical` $\rightarrow$ Tự động đổi thành: `Tròn`, `Cột`.
- **Người dùng có thể làm gì**: Tham khảo định hướng trực quan hóa. Khi thay đổi kiểu cột, các gợi ý này cập nhật ngay lập tức. Miễn phí.
- **Ảnh hưởng tới bước sau**: Quyết định bộ biểu đồ được kích hoạt tự động trong tab Trực quan hóa.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Đây là gợi ý sơ bộ dựa trên loại thuộc tính đơn lẻ. Biểu đồ tương quan (Heatmap) hoặc biểu đồ chéo (Scatter) sẽ được quyết định dựa trên mối quan hệ giữa 2 cột ở bước Visualize.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/ColumnTable.jsx:327-353`, `frontend/src/constants/dataTypes.js:74-80`.
  - Backend: `backend/app/services/profiler_service.py:122-181`.
- **Tooltip**: Các loại biểu đồ trực quan hóa phù hợp nhất với dữ liệu của cột này. / Recommended visual charts best suited for this column.
- **Giải thích ngắn cho bảng Info**:
  - VI: Danh mục các dạng biểu đồ (cột, tròn, xu hướng, phân phối) tương thích tốt nhất với cột {col_name}. Danh sách gợi ý sẽ tự động cập nhật ngay khi bạn đổi kiểu dữ liệu.
  - EN: Recommended chart types (bar, pie, line, histogram) compatible with {col_name}. These recommendations adapt dynamically if you override the column type.

---

### 14. Nút "Hiển thị toàn bộ / Thu gọn bớt" (Show All / Show Less Toggle)
- **id**: `profiler-btn-show-all`
- **Người dùng thấy gì**:
  - Trạng thái thu gọn: Icon `ChevronDown` + `"Hiển thị toàn bộ {count} cột"` / `"Show all {count} columns"`.
  - Trạng thái mở rộng: Icon `ChevronUp` + `"Thu gọn bớt"` / `"Show less"`.
- **Ý nghĩa**: Tối ưu hiệu năng hiển thị và không gian trang cho các tập dữ liệu có hàng chục đến hàng trăm cột.
- **Cách tính / quy tắc**:
  - Hằng số mặc định: `DEFAULT_VISIBLE = 10`.
  - Nếu `filteredCols.length > 10`: Nút xuất hiện.
  - Khi click: Đảo cờ boolean `showAll = !showAll`.
- **Ví dụ thật**: Dataset có 64 cột $\rightarrow$ Mặc định chỉ vẽ 10 dòng bảng đầu tiên $\rightarrow$ Bấm nút $\rightarrow$ Mở rộng vẽ toàn bộ 64 dòng.
- **Người dùng có thể làm gì**: Click để mở rộng hoặc thu gọn danh sách cột. Miễn phí.
- **Ảnh hưởng tới bước sau**: Không ảnh hưởng.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Khi đang bật bộ lọc "Cột cần xem", nút này sẽ hiển thị số lượng theo danh sách đã lọc (ví dụ: "Hiển thị toàn bộ 4 cột").
- **Code**: `frontend/src/components/Profiler/ColumnTable.jsx:21, 65-66, 469-494`.
- **Tooltip**: Mở rộng để xem tất cả các cột hoặc thu gọn danh sách về 10 cột. / Expand to view all columns or collapse back to 10 rows.
- **Giải thích ngắn cho bảng Info**:
  - VI: Giúp quản lý độ dài của trang dữ liệu. Mặc định hệ thống chỉ hiển thị 10 cột đầu tiên để duyệt nhanh; người dùng có thể mở rộng toàn bộ bảng bất cứ lúc nào.
  - EN: Manages vertical screen space by showing the first 10 columns by default. Users can expand the list to inspect all columns in full.

---

### 15. Hộp bối cảnh dữ liệu (Merged Description Box)
- **id**: `profiler-description-box`
- **Người dùng thấy gì**:
  - Nhãn tiêu đề: `"Mô tả ngữ cảnh dữ liệu"` kèm icon trợ giúp `HelpCircle`.
  - Badge nguồn dữ liệu:
    - `"Tạo bởi AI"` (xanh ngọc, icon `Sparkles`).
    - `"Đã chỉnh sửa"` (vàng hổ phách, icon `Check`).
  - Trạng thái lưu: `Đang lưu...` hoặc `Đã lưu phân tích AI · 14:30` (icon `CheckCircle2` màu xanh).
  - Badge hiển thị hạn mức AI (`AIUsageBadge`).
  - Ô nhập văn bản nhiều dòng (textarea) cho phép nhập mô tả ngữ cảnh.
  - Hàng nút hành động: Nút `"Phân tích AI"`, nút `"Phân tích lại theo chỉnh sửa của tôi"`, và 4 nút chọn mục đích dữ liệu.
- **Ý nghĩa**: Nơi lưu giữ "linh hồn ngữ nghĩa" của tập dữ liệu. Giúp AI hiểu bản chất của bảng số liệu để sinh phân tích sâu sắc ở bước Báo cáo.
- **Cách tính / quy tắc**:
  - Textarea kích hoạt cơ chế debounce 800ms tự động gọi `saveProfilerState`.
  - Nguồn `descriptionSource`: khởi tạo là `user`, chuyển sang `ai_draft` khi AI tạo, chuyển sang `ai_edited` nếu người dùng can thiệp gõ thêm chữ.
- **Ví dụ thật**: Nhập `"Dữ liệu khảo sát khách hàng mua đồ gia dụng năm 2024"` $\rightarrow$ Sau 800ms hệ thống báo `"Đã lưu phân tích AI · 15:20"`.
- **Người dùng có thể làm gì**: Nhập tự do, sửa nội dung, hoặc bấm nút nhờ AI viết hộ. Việc gõ và lưu tự động là Miễn phí.
- **Ảnh hưởng tới bước sau**: Nội dung mô tả này được truyền thẳng vào bước Trực quan hóa và mở đầu Báo cáo tổng quan (Report Intro).
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Ô này không bắt buộc phải có nội dung; nếu để trống, hệ thống vẫn cho phép tiếp tục bình thường.
- **Code**: `frontend/src/components/Profiler/MergedDescriptionBox.jsx:19-358`.
- **Tooltip**: Mô tả ý nghĩa của dữ liệu giúp AI hỗ trợ chính xác hơn. / Dataset description helping AI provide context-aware insights.
- **Giải thích ngắn cho bảng Info**:
  - VI: Khu vực cung cấp thông tin bối cảnh của tập dữ liệu. Bạn có thể tự viết bằng tay hoặc nhờ AI phân tích tự động. Nội dung được lưu trữ tức thì và hoàn toàn miễn phí.
  - EN: Dedicated panel for dataset contextual information. Can be written manually or generated via AI. Content is autosaved without consuming quota.

---

### 16. Banner Lĩnh vực & Độ tin cậy (Domain & Confidence Banner)
- **id**: `profiler-domain-banner`
- **Người dùng thấy gì**:
  - Nhãn: `"Lĩnh vực:"` kèm tên lĩnh vực in đậm (Ví dụ: `"Thương mại điện tử"`, `"Tài chính"`, `"Y tế"`...).
  - Badge độ tin cậy:
    - $\ge 85\%$: Xanh lá `"Độ tin cậy cao"` (icon `CheckCircle2`).
    - $60\% - 84\%$: Vàng cam `"Cần xác nhận lại"` (icon `AlertTriangle`).
    - $< 60\%$: Đỏ nhạt `"Tham khảo thêm"` (icon `AlertCircle`).
  - Dòng lý giải: Diễn giải 1-2 câu từ AI giải thích vì sao nhận diện ra lĩnh vực đó.
- **Ý nghĩa**: Thể hiện kết quả suy luận nghiệp vụ của mô hình AI về mục đích của toàn bộ file dữ liệu.
- **Cách tính / quy tắc**:
  - Nhận diện từ response của Gemini/Groq: `parsed["domain"]` và `parsed["confidence"]`.
  - Danh mục chuẩn gồm 8 lĩnh vực: `Marketing`, `HR`, `Finance`, `Education`, `Healthcare`, `E-commerce`, `Logistics`, `Other`.
- **Ví dụ thật**: Dataset có các cột `customer_age`, `spending_score`, `annual_income` $\rightarrow$ AI trả về domain `Marketing`, confidence `0.92` $\rightarrow$ Hiện badge xanh `"Độ tin cậy cao"`.
- **Người dùng có thể làm gì**: Đọc nhận định của AI. Nếu thấy sai, có thể sửa lại ô mô tả và bấm "Phân tích lại".
- **Ảnh hưởng tới bước sau**: Tên lĩnh vực được hiển thị trên tiêu đề Báo cáo và làm ngữ cảnh cho AI sinh nhận xét biểu đồ.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Nếu chưa bấm nút "Phân tích AI", banner hiển thị `"Chưa phân tích"` với lời nhắc kích hoạt.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/MergedDescriptionBox.jsx:197-217`, `frontend/src/components/Profiler/Badges.jsx:5-44`.
  - Backend: `backend/app/services/llm_service.py:128-150`.
- **Tooltip**: Lĩnh vực hoạt động của tập dữ liệu do AI dự đoán kèm độ tin cậy. / AI-predicted dataset industry domain with confidence rating.
- **Giải thích ngắn cho bảng Info**:
  - VI: Kết quả phân tích từ AI chỉ ra ngành nghề chính của dữ liệu cùng với mức độ chắc chắn. Giúp định hình cách hành văn và phân tích ở các bước kế tiếp.
  - EN: Shows the AI-predicted industry domain along with its confidence score, tailoring analytical wording in subsequent report steps.

---

### 17. Banner cảnh báo lệch ngôn ngữ (Language Mismatch Banner)
- **id**: `profiler-lang-mismatch-banner`
- **Người dùng thấy gì**:
  - Hộp cảnh báo màu vàng nhạt viền vàng: Icon quả địa cầu `Globe` + dòng chữ `"Phân tích AI đang lưu bằng Tiếng Việt, bạn có muốn phân tích lại theo ngôn ngữ hiện tại?"` (hoặc `English`).
  - Nút bấm: `"Phân tích lại theo ngôn ngữ này"`.
- **Ý nghĩa**: Cảnh báo khi người dùng đổi ngôn ngữ giao diện (ví dụ từ Tiếng Việt sang Tiếng Anh) nhưng nội dung ngữ cảnh trước đó vẫn đang là ngôn ngữ cũ.
- **Cách tính / quy tắc**:
  - Điều kiện hiển thị: `savedLang && savedLang !== getCurrentLang() && aiAnalyzed`.
  - Khi người dùng bấm nút: Tự động kích hoạt `handleAnalyzeAI(true)` gửi ngôn ngữ mới lên AI để sinh lại bản nháp.
- **Ví dụ thật**: Phân tích ban đầu bằng tiếng Việt (`savedLang = "vi"`). Người dùng bấm cờ chuyển sang English (`lang = "en"`) $\rightarrow$ Banner xuất hiện mời phân tích lại sang tiếng Anh.
- **Người dùng có thể làm gì**: Bấm để yêu cầu AI viết lại bằng ngôn ngữ hiện tại (tính 1 lượt AI), hoặc lờ đi nếu không cần.
- **Ảnh hưởng tới bước sau**: Đảm bảo báo cáo xuất ra Word/PDF đồng nhất một ngôn ngữ.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Nếu người dùng tự gõ tay mô tả thì banner này không ép buộc phải chạy lại.
- **Code**: `frontend/src/components/Profiler/MergedDescriptionBox.jsx:220-240`.
- **Tooltip**: Chuyển đổi ngôn ngữ phân tích AI theo ngôn ngữ giao diện hiện tại. / Synchronize AI analysis language with current UI locale.
- **Giải thích ngắn cho bảng Info**:
  - VI: Thông báo xuất hiện khi bạn chuyển đổi ngôn ngữ của ứng dụng. Bạn có thể yêu cầu AI dịch và phân tích lại nội dung tóm tắt cho ăn khớp với ngôn ngữ đang chọn.
  - EN: Alerts the user when the application language changes, offering to regenerate the AI analysis in the matching language.

---

### 18. Nút "Phân tích AI" & "Phân tích lại" (AI Analyze Action Buttons)
- **id**: `profiler-ai-analyze-btn`
- **Người dùng thấy gì**:
  - Nút 1: Màu xanh lá đậm: Icon `Sparkles` + `"Phân tích AI"` / `"AI Analysis"` (khi chạy đổi thành icon xoay `RefreshCw` + `"Đang phân tích..."`).
  - Nút 2 (chỉ hiện khi đã phân tích và có chữ trong ô): Nút viền xám `"Phân tích lại theo chỉnh sửa của tôi"` / `"Re-analyze with my correction"`.
- **Ý nghĩa**: Kích hoạt khả năng đọc hiểu ngữ nghĩa của mô hình ngôn ngữ lớn (Gemini/Groq).
- **Cách tính / quy tắc**:
  - Nút 1: Gọi `POST /files/ai-context` với `is_reanalyze=false`. Nếu ô mô tả đã có chữ, mở modal xác nhận ghi đè (`showOverwriteModal`).
  - Nút 2: Gọi `POST /files/ai-context` với `is_reanalyze=true`, truyền kèm `description` hiện tại vào biến `user_correction` trong prompt AI.
  - **Chi phí**: 1 lượt sử dụng AI (`check_ai_quota` $\rightarrow$ `record_ai_feature_usage`).
- **Ví dụ thật**: Người dùng thấy AI đoán nhầm domain là "Finance", người dùng gõ vào ô: "Đây là dữ liệu điểm danh sinh viên" rồi bấm "Phân tích lại" $\rightarrow$ AI đọc lời hiệu chỉnh và sửa domain thành "Education".
- **Người dùng có thể làm gì**: Bấm để AI phân tích lần đầu hoặc hiệu chỉnh lại. Chi phí: 1 lượt AI/lần.
- **Ảnh hưởng tới bước sau**: Cập nhật semantic context và phân loại ngữ nghĩa từng cột (`column_semantics`).
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Nếu AI gặp sự cố (503), người dùng nhận thông báo lỗi nhưng **không bị trừ lượt**.
- **Code**:
  - Frontend: `frontend/src/components/Profiler/MergedDescriptionBox.jsx:67-85, 263-296`.
  - Backend: `backend/app/routers/files.py:302-390`.
- **Tooltip**: Nhấn để AI đọc cấu trúc dữ liệu và sinh mô tả ngữ cảnh (tốn 1 lượt AI). / Generate AI contextual summary and domain prediction (costs 1 turn).
- **Giải thích ngắn cho bảng Info**:
  - VI: Các nút thao tác với trí tuệ nhân tạo. AI sẽ đọc lướt các cột và mẫu dữ liệu để tóm tắt và xác định lĩnh vực. Thao tác này tiêu tốn 1 lượt dùng AI trong ngày.
  - EN: Action buttons invoking AI inference. The model inspects column schemas and sample data to extract context. Consumes 1 daily AI turn.

---

### 19. Mục đích dữ liệu (Purpose Radio Selector)
- **id**: `profiler-purpose-selector`
- **Người dùng thấy gì**: 4 nút tùy chọn dạng viên thuốc:
  - `"Tìm xu hướng chung"` (`purpose_trends`)
  - `"So sánh các nhóm"` (`purpose_compare`)
  - `"Phát hiện vấn đề"` (`purpose_issues`)
  - `"Báo cáo định kỳ"` (`purpose_report`)
- **Ý nghĩa**: Thu thập mục tiêu phân tích kinh doanh của người dùng đối với tệp dữ liệu này.
- **Cách tính / quy tắc**:
  - Lưu vào state `contextPurpose`, đồng bộ vào `fileSession.userContext.purpose` và lưu đệm vào Redis `user_context:{user_id, file_hash}`.
- **Ví dụ thật**: Người dùng chọn "So sánh các nhóm" $\rightarrow$ Nút sáng viền xanh `forest`, lưu vào session.
- **Người dùng có thể làm gì**: Click chọn 1 trong 4 mục đích. Hoàn toàn Miễn phí.
- **Ảnh hưởng tới bước sau**: Được đưa vào prompt của Báo cáo tổng quan (Report Intro) để AI hướng phân tích đúng trọng tâm mong muốn.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Không bắt buộc phải chọn, có thể bỏ qua nếu người dùng không có nhu cầu đặc thù.
- **Code**: `frontend/src/components/Profiler/MergedDescriptionBox.jsx:298-325`.
- **Tooltip**: Chọn mục tiêu phân tích chính để AI định hướng kết quả phù hợp. / Select analytical objective to steer AI insights.
- **Giải thích ngắn cho bảng Info**:
  - VI: Cho phép người dùng gắn nhãn mục đích phân tích cho tập dữ liệu. Thông tin này giúp AI ở bước Báo cáo tập trung nhấn mạnh vào khía cạnh bạn quan tâm nhất.
  - EN: Flags the primary objective of your analysis, prompting subsequent AI reporting to tailor its focus accordingly.

---

### 20. Thanh chân trang đếm ngược & Badge bộ nhớ đệm (Calm Footer Line)
- **id**: `profiler-footer-line`
- **Người dùng thấy gì**:
  - Dòng thông tin đếm ngược: Icon đồng hồ `Clock` + `"File [Tên file] tự động xóa sau HH:MM:SS để bảo mật."`.
  - Nếu thời gian còn dưới 5 phút (300 giây): Dòng chữ và icon chuyển sang màu đỏ cảnh báo `"tự động xóa sau MM:SS — hãy lưu kết quả!"`.
  - Badge lưu đệm (nếu tệp đã có trong cache): Huy hiệu xanh lá `Zap` + `"Đã lưu đệm"` / `"Cached"`.
- **Ý nghĩa**: Đảm bảo quyền riêng tư và an toàn dữ liệu cho người dùng bằng cách minh bạch thời hạn xóa dữ liệu tạm trên RAM/Redis.
- **Cách tính / quy tắc**:
  - Thời hạn session file: `SESSION_TTL_MS = 18000 * 1000` (5 giờ = 18000 giây).
  - Đồng hồ đếm lùi từng giây dựa trên mốc `file_expires_at` hoặc `uploadedAt`.
  - Khi hết hạn 5 giờ: Dữ liệu nhị phân của file trên Redis `filebytes` tự động bốc hơi.
- **Ví dụ thật**: File upload lúc 14:00 $\rightarrow$ Đồng hồ hiện `04:59:59` $\rightarrow$ Đến 18:56 đồng hồ đổi sang màu đỏ: `tự động xóa sau 03:59 — hãy lưu kết quả!`.
- **Người dùng có thể làm gì**: Theo dõi thời gian để hoàn tất các bước phân tích. Miễn phí.
- **Ảnh hưởng tới bước sau**: Nếu để quá 5 giờ mà chưa bấm "Làm sạch", người dùng sẽ phải nạp lại file vì bộ nhớ tạm đã bị giải phóng.
- **Trường hợp đặc biệt / dễ hiểu nhầm**: Chỉ có dữ liệu file nhị phân (bytes) bị xóa sau 5 giờ. Bản kết quả phân tích cột và mô tả AI vẫn được lưu giữ an toàn suốt 24 giờ trong Redis.
- **Code**: `frontend/src/pages/Profiler.jsx:39-93, 623-628`.
- **Tooltip**: Thời gian tệp tin tạm được lưu trong bộ nhớ máy chủ trước khi tự động hủy. / Server-side temporary file retention countdown.
- **Giải thích ngắn cho bảng Info**:
  - VI: Đồng hồ đếm ngược bảo mật cho biết tệp dữ liệu của bạn sẽ được xóa sạch khỏi bộ nhớ máy chủ sau 5 giờ. Các mô tả và phân tích vẫn được lưu an toàn 24 giờ.
  - EN: Privacy countdown indicating your uploaded file will be purged from memory after 5 hours. Analysis metadata persists securely for 24 hours.

---

## PHẦN C — Cơ chế nhận diện kiểu dữ liệu (Data Type Classification Engine)

Thuật toán phân loại cột hoạt động hoàn toàn tự động dựa trên **nội dung dữ liệu thực tế**, hoàn toàn **không dựa vào tên cột** (`profiler_service.py:5, 125`).

### Sơ đồ luồng quyết định (Decision Flow Diagram)

```
                     Dữ liệu 1 Cột (pd.Series)
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   pd.is_numeric_dtype &               pd.is_bool_dtype?
   not pd.is_bool_dtype?                          │ (Có)
        │ (Có)                                    ▼
        ▼                                    [ CATEGORICAL ]
   [ NUMERIC ]
        │ (Không)
        ▼
   pd.is_datetime64? ────────────────(Có)───> [ DATETIME ]
        │ (Không)
        ▼
   Là chuỗi (Object / String)
        │
        ▼
   _try_datetime()? ─────────────────(Có)───> [ DATETIME ]
        │ (Không)
        ▼
   Chuỗi boolean ("true"/"false"/"có"/"không")? ──(Có)──> [ CATEGORICAL ]
        │ (Không)
        ▼
   Pattern số hàng nghìn >= 60%? ────(Có)───> Bỏ qua Multiple Choice
        │ (Không)                                     │
        ▼                                             │
   Có dấu phẩy > 20% dòng & ─────────(Có)───> [ MULTIPLE_CHOICE ]
   unique tokens <= 25?                               │
        │ (Không)                                     ▼
        └───────────────────────────────> unique_count <= 15 &
                                          unique_count < valid_count? ─(Có)─> [ CATEGORICAL ]
                                                      │ (Không)
                                                      ▼
                                          avg_len > 30 ký tự? ────────(Có)─> [ TEXT ]
                                                      │ (Không)
                                                      ▼
                                          unique_count <= 15? ────────(Có)─> [ CATEGORICAL ]
                                                      │ (Không)
                                                      ▼
                                                  [ TEXT ]
                                                      │
                                                      ▼ (Kiểm tra hậu kỳ)
            Nếu là TEXT hoặc CATEGORICAL:
            is_disguised_numeric(series) >= 60%? ──(Có)──> [ NUMERIC ]
                                                            (Gắn cờ disguised)
```

---

### Danh mục 5 Kiểu dữ liệu Chuẩn & Ví dụ Thực nghiệm

#### 1. Kiểu Số liệu (`numeric`)
- **Định nghĩa**: Các cột chứa dữ liệu định lượng, số đếm hoặc số đo lường liên tục/rời rạc.
- **Điều kiện nhận diện**:
  - `pd.api.types.is_numeric_dtype(series.dtype) == True` (loại trừ boolean).
  - HOẶC là cột dạng text/categorical nhưng có tỷ lệ chuyển đổi số ẩn $\ge 60\%$ (`is_disguised_numeric`).
- **Biểu đồ gợi ý**: Cột (`bar`), Đường (`line`), Phân phối (`histogram`).
- **Ứng xử ở bước sau**:
  - *Cleaner*: Tự động điền ô trống bằng số trung vị (`median`), chuyển đổi kiểu về `float64`.
  - *Visualize*: Được tính toán các chỉ số thống kê (Mean, Median, Min, Max, Độ lệch chuẩn, Tứ phân vị, Ma trận tương quan Heatmap).
- **Ví dụ thật**:
  - *Khớp chuẩn 1*: `[10, 25, 40, 15, 80]` $\rightarrow$ `dtype: int64` $\rightarrow$ Nhận diện `numeric`.
  - *Khớp chuẩn 2 (Số ẩn)*: `["(100)", "200", "300", "400", "500"]` $\rightarrow$ Nhận diện `numeric` (cảnh báo `disguised_numeric`).
  - *Trường hợp suýt soát (Near-miss)*: `["100", "200", "Chưa rõ", "N/A", "Không tính", "Lỗi"]` $\rightarrow$ Tỷ lệ số chỉ đạt $2 / 6 = 33.3\% < 60\%$ $\rightarrow$ Bị đẩy thành `categorical` hoặc `text`.

#### 2. Kiểu Thời gian (`datetime`)
- **Định nghĩa**: Các cột lưu trữ mốc ngày tháng, năm hoặc giờ phút.
- **Điều kiện nhận diện**:
  - `pd.api.types.is_datetime64_any_dtype(dtype) == True`.
  - HOẶC hàm `_try_datetime(series)` đạt tỷ lệ thành công $\ge 80\%$ (`DATETIME_PARSE_THRESHOLD = 0.8` trên mẫu tối đa 100 dòng đầu tiên bằng `pd.to_datetime(sample, format='mixed', errors='coerce')`).
- **Biểu đồ gợi ý**: Đường (`line`).
- **Ứng xử ở bước sau**:
  - *Cleaner*: Chuẩn hóa về định dạng `datetime64`, bỏ qua không điền khuyết giá trị rỗng.
  - *Visualize*: Làm trục hoành (X-axis) cho các biểu đồ phân tích chuỗi thời gian (Time-series trend).
- **Ví dụ thật**:
  - *Khớp chuẩn 1*: `["2024-01-15", "2024-02-20", "2024-03-25"]` $\rightarrow$ Parse thành công $100\%$ $\rightarrow$ Nhận diện `datetime`.
  - *Khớp chuẩn 2*: `["15/01/2024", "16/01/2024", "17/01/2024", None]` $\rightarrow$ Parse thành công $100\%$ trên dòng không rỗng $\rightarrow$ `datetime`.
  - *Trường hợp suýt soát (Near-miss)*: Cột ngày tháng bị lẫn quá nhiều ghi chú tự do: `["2024-01-01", "2024-01-02", "Đang cập nhật", "Chưa có ngày", "Tuần sau"]` $\rightarrow$ Tỷ lệ parse thành công chỉ đạt $40\% < 80\%$ $\rightarrow$ Trở thành `text`.

#### 3. Kiểu Danh mục (`categorical`)
- **Định nghĩa**: Cột định tính gồm một tập hữu hạn các nhóm hoặc nhãn được lặp đi lặp lại.
- **Điều kiện nhận diện**:
  - Thuộc kiểu boolean (`pd.api.types.is_bool_dtype`).
  - HOẶC là chuỗi ký tự mà `unique_count <= 15` (`CATEGORICAL_UNIQUE_THRESHOLD = 15`) và có sự lặp lại (`unique_count < valid_count`).
- **Biểu đồ gợi ý**: Tròn (`pie`), Cột (`bar`).
- **Ứng xử ở bước sau**:
  - *Cleaner*: Điền ô trống bằng giá trị `"Không xác định"`.
  - *Visualize*: Nhóm và đếm tần suất xuất hiện (`value_counts`) để vẽ biểu đồ cơ cấu và phân loại.
- **Ví dụ thật**:
  - *Khớp chuẩn 1*: `["Hà Nội", "Đà Nẵng", "TP.HCM", "Hà Nội", "TP.HCM"]` $\rightarrow$ 3 giá trị duy nhất trên 5 dòng $\rightarrow$ `categorical`.
  - *Khớp chuẩn 2*: `[True, False, True, True, False]` $\rightarrow$ `dtype: bool` $\rightarrow$ `categorical`.
  - *Trường hợp suýt soát (Near-miss)*: Danh sách 16 mã tỉnh thành khác nhau trong bảng 16 dòng: `unique_count = 16 > 15` $\rightarrow$ Không đạt ngưỡng 15 $\rightarrow$ Trở thành `text`.

#### 4. Kiểu Nhiều lựa chọn (`multiple_choice`)
- **Định nghĩa**: Cột khảo sát hoặc nhãn thẻ (tags) nơi mỗi ô chứa nhiều phương án chọn phân tách bằng dấu phẩy.
- **Điều kiện nhận diện**:
  - Tỷ lệ số dòng chứa dấu phẩy `,` lớn hơn $20\%$ tổng số dòng hợp lệ: `(comma_count > 0).sum() > valid_count * 0.2`.
  - Khi tách các phần tử bằng dấu phẩy (`split(',')`), tổng số nhãn duy nhất sinh ra $\le 25$: `all_tokens.nunique() <= 25`.
- **Biểu đồ gợi ý**: Cột (`bar`), Tròn (`pie`).
- **Ứng xử ở bước sau**:
  - *Cleaner*: Điền ô trống bằng `"Không xác định"`.
  - *Visualize*: Tách chuỗi theo dấu phẩy để đếm tần suất độc lập của từng nhãn (kèm ghi chú giải thích phương pháp đếm).
- **Ví dụ thật**:
  - *Khớp chuẩn 1*: `["Bóng đá, Bơi lội", "Cầu lông", "Bơi lội, Cầu lông", "Bóng đá"]` $\rightarrow$ Số dòng có phẩy = 50% > 20%, tổng token có 3 môn $\le 25$ $\rightarrow$ Nhận diện `multiple_choice`.
  - *Khớp chuẩn 2*: `["Đỏ, Xanh", "Vàng", "Đỏ, Vàng", "Trắng, Đỏ"]` $\rightarrow$ `multiple_choice`.
  - *Trường hợp suýt soát (Near-miss)*: Chuỗi địa chỉ nhà: `"Số 10, Phố Huế, Phường Hàng Bài, Quận Hoàn Kiếm, Hà Nội"`. Mặc dù có nhiều dấu phẩy nhưng các token tách ra là các số nhà và ngõ ngách duy nhất $\rightarrow$ `tokens.nunique() = 120 > 25` $\rightarrow$ Trở thành `text`.

#### 5. Kiểu Văn bản tự do (`text`)
- **Định nghĩa**: Cột chứa chuỗi văn bản dài, nhận xét, địa chỉ, hoặc các mã định danh không lặp lại.
- **Điều kiện nhận diện**:
  - Là chuỗi nhưng không phải datetime và không phải multiple choice.
  - Có độ dài trung bình ký tự lớn hơn 30: `avg_len = valid_strings.str.len().mean() > 30`.
  - HOẶC có số lượng giá trị duy nhất lớn hơn 15: `unique_count > 15`.
- **Biểu đồ gợi ý**: Không có (`[]`).
- **Ứng xử ở bước sau**:
  - *Cleaner*: Bỏ qua các quy tắc ép kiểu số và không điền khuyết tự động.
  - *Visualize*: Bị vô hiệu hóa khỏi danh sách vẽ biểu đồ đơn biến.
- **Ví dụ thật**:
  - *Khớp chuẩn 1*: Cột phản hồi ý kiến: `["Giao hàng nhanh, nhân viên nhiệt tình chu đáo", "Sản phẩm đóng gói cẩn thận"]` $\rightarrow$ Chiều dài trung bình > 30 ký tự $\rightarrow$ Nhận diện `text`.
  - *Khớp chuẩn 2*: Cột mã UUID: `["a1b2-c3d4-e5f6", "b2c3-d4e5-f6a7", ...]` $\rightarrow$ 100 mã duy nhất trên 100 dòng $\rightarrow$ `text`.
  - *Trường hợp suýt soát (Near-miss)*: Chuỗi nhận xét rất ngắn: `["Tốt", "Tệ", "OK", "Tốt", "OK"]` $\rightarrow$ Độ dài trung bình < 30 và `unique_count = 3 <= 15` $\rightarrow$ Trở thành `categorical`.

---

### Các cơ chế xử lý đặc biệt

#### 1. Nhận diện số bị ẩn / ngụy trang (`disguised_numeric`)
- **Quy tắc**:
  - Danh sách ký tự bị tước bỏ (`NUMERIC_PATTERNS_STRIP`): `[\$,đ\s%VND]` (dấu đô-la, dấu phẩy, chữ đ, khoảng trắng, dấu phần trăm, chữ VND).
  - Dấu ngoặc đơn biểu diễn số âm: `(100)` $\rightarrow$ thay bằng `-100`.
  - Danh sách các từ đồng nghĩa với ô trống (`NULL_SYNONYMS`): `n/a`, `na`, `null`, `none`, `nil`, `-`, `--`, `?`, `missing`, `trống`, `không có`.
  - **Ngưỡng tỷ lệ (Threshold)**: Nếu số ô chuyển đổi thành công sang số thực chiếm $\ge 60\%$ tổng số dòng có nghĩa $\rightarrow$ Chuyển kiểu cột thành `numeric`, gắn nhãn `"Có thể là số"`.

#### 2. Cột không có tính biến thiên (`skip_chart = True`)
- **Quy tắc**: Khi `unique_count <= 1`, backend gán `skip_chart = True` kèm lý do `"Không đủ variance (unique_count ≤ 1)"`.
- Toàn bộ gợi ý biểu đồ bị xóa bỏ để ngăn chặn việc vẽ đồ thị đơn điệu 1 điểm.

#### 3. Độ tin cậy thấp (`low_confidence = True`)
- **Quy tắc**: Backend tự động gán cờ `low_confidence = True` khi:
  - Cột được phân loại là `text`.
  - HOẶC cột có tỷ lệ rỗng lớn hơn 60% (`null_pct > 60`).

#### 4. Cột vô danh do Pandas tự đặt (`Unnamed`)
- **Quy tắc**:
  - Kiểm tra biểu thức chính quy `^Unnamed: \d+$`.
  - Nếu cột trống 100% NaN $\rightarrow$ Xóa hẳn khỏi DataFrame (`cols_to_drop`).
  - Nếu cột có chứa dữ liệu $\rightarrow$ Đổi tên thành placeholder: `Cột không tên (A)`, `Cột không tên (B)`... và gắn cảnh báo `unnamed_warning`.

---

### Cấu trúc thực tế của `detection_reason` (Explainability Engine)

Mỗi cột trong kết quả phân tích `profile_dataframe` đều đi kèm trường `detection_reason` (tùy chọn) với cấu trúc chi tiết:

```json
{
  "rule_id": "categorical_repeats",
  "metrics": {
    "native_dtype": "object",
    "non_null_count": 3,
    "unique_count": 2,
    "datetime_parse_rate": 0.0,
    "thousands_match_ratio": 0.0,
    "comma_row_ratio": 0.0
  },
  "checks": [
    {
      "check": "datetime_parse_rate",
      "value": 0.0,
      "threshold": 0.8,
      "op": ">=",
      "passed": false
    },
    {
      "check": "comma_row_ratio",
      "value": 0.0,
      "threshold": 0.2,
      "op": ">",
      "passed": false
    },
    {
      "check": "categorical_unique_and_repeats",
      "value": 2,
      "threshold": 15,
      "op": "<=",
      "passed": true
    }
  ]
}
```

Các mã `rule_id` chuẩn gồm:
- `native_numeric`: Pandas dtype đã là số nguyên hoặc số thực.
- `native_bool`: Pandas dtype gốc là boolean.
- `native_datetime`: Pandas dtype gốc là datetime64.
- `datetime_parsed`: Cột chuỗi parse thành công ngày tháng $\ge 80\%$.
- `bool_strings`: Cột chuỗi chứa toàn các giá trị boolean dạng chữ (`true`, `false`, `có`, `không`).
- `multiple_choice`: Tỷ lệ dòng có dấu phẩy $> 20\%$ và số tag duy nhất $\le 25$.
- `categorical_repeats`: Số giá trị duy nhất $\le 15$ và nhỏ hơn số dòng hợp lệ (có sự lặp lại).
- `text_long`: Độ dài chuỗi trung bình $> 30$ ký tự.
- `categorical_fallback`: Số giá trị duy nhất $\le 15$ (fallback nhánh sau).
- `text_fallback`: Số giá trị duy nhất $> 15$ không khớp bất kỳ luật nào trước đó.
- `disguised_numeric`: Tỷ lệ chuyển đổi sau khi bỏ ký tự tiền tệ $\ge 60\%$.

---

## PHẦN D — AI trong Profiler

### 1. Dữ liệu gửi đi (Prompt Payload - Fields Only)
Hệ thống **không bao giờ** gửi toàn bộ tập dữ liệu thô lên AI để bảo vệ quyền riêng tư và tiết kiệm băng thông. Prompt chỉ chứa:
- Tên từng cột (`col.name`).
- Kiểu dữ liệu máy tự nhận diện (`col.detected_type`).
- Số lượng giá trị duy nhất (`col.unique_count`).
- **Tối đa 5 giá trị mẫu** của mỗi cột (`sample_values[:5]`).
- Nội dung hiệu chỉnh của người dùng (nếu là Re-analyze).
- Chỉ thị ngôn ngữ trả về (`vi` hoặc `en`).

### 2. Dữ liệu nhận về (Response JSON Schema)
```json
{
  "domain": "E-commerce",
  "confidence": 0.95,
  "reasoning": "Dữ liệu chứa thông tin sản phẩm và doanh số bán hàng.",
  "draft_summary": "Tập dữ liệu giao dịch thương mại điện tử và kết quả bán hàng.",
  "column_semantics": {
    "order_id": { "semantic_type": "CODE_ID", "confidence": 0.98 },
    "customer_name": { "semantic_type": "PERSON_NAME", "confidence": 0.92 }
  }
}
```

### 3. Danh mục 8 Lĩnh vực chuẩn (Valid Domains)
AI bị ràng buộc bắt buộc chỉ được chọn 1 trong 8 mã lĩnh vực sau:
1. `Marketing`
2. `HR` (Nhân sự)
3. `Finance` (Tài chính)
4. `Education` (Giáo dục)
5. `Healthcare` (Y tế)
6. `E-commerce` (Thương mại điện tử)
7. `Logistics` (Vận tải / Logistics)
8. `Other` (Khác)

Backend có bộ lọc chuẩn hóa (`domain_mapping`, `llm_service.py:131-138`) để đưa các từ đồng nghĩa tiếng Việt/tiếng Anh về đúng 8 mã này.

### 4. Ý nghĩa mức độ tin cậy (Confidence Rating)
- $\ge 0.85$ ($85\%$): **Độ tin cậy cao** (Xanh lục). Các cột và giá trị mẫu mang đặc trưng ngành nghề rõ nét.
- $0.60 - 0.84$ ($60\% - 84\%$): **Cần xác nhận lại** (Vàng cam). Dữ liệu có tính đa dụng hoặc ít mẫu.
- $< 0.60$ ($< 60\%$): **Tham khảo thêm** (Đỏ nhạt). Cột quá ngắn hoặc dữ liệu bị mã hóa khó nhận biết.

### 5. Chi phí & Cơ chế Hạn mức (AI Quotas & Free Actions)
- Thao tác tốn **1 lượt AI**:
  - Nhấn nút "Phân tích AI" (`feature = "profiler"`).
  - Nhấn nút "Phân tích lại theo chỉnh sửa của tôi" (`feature = "reanalyze"`).
- Thao tác **hoàn toàn MIỄN PHÍ** (0 lượt):
  - Tải file lên và nhận diện cấu trúc 5 kiểu dữ liệu.
  - Đọc lại file (Force refresh).
  - Ghi đè kiểu dữ liệu (Type Override).
  - Gõ văn bản mô tả và tự động lưu (Autosave sau 800ms).
  - Tải lại trang (F5) khi file đã có kết quả trong cache Redis.

### 6. Kiến trúc Dự phòng Hai tầng (Gemini $\rightarrow$ Groq Fallback)
1. **Tầng 1 (Primary)**: Google Gemini API (`GEMINI_MODEL`, mặc định `gemini-2.0-flash`). Thử lại 1 lần sau 1s nếu gặp lỗi mạng hoặc HTTP 5xx/Timeout.
2. **Tầng 2 (Fallback)**: Nếu Gemini trả về 429 (hết quota Google) hoặc lỗi kéo dài, request được tự động chuyển sang Groq API qua giao thức tương thích OpenAI (`GROQ_MODEL`, ví dụ `llama-3.3-70b-versatile`).
   - Nếu prompt quá dài, hàm `_trim_prompt_for_groq` sẽ tự động rút gọn các mẫu giá trị xuống còn 3 mẫu để đảm bảo giới hạn token.
3. **Khi cả hai cùng thất bại**: Ném lỗi `ERR_AI_UNAVAILABLE` (HTTP 503). Hệ thống hủy giao dịch quota, đảm bảo người dùng **không bị trừ bất kỳ lượt dùng nào**.

---

## PHẦN E — Bảng tra cứu số liệu & thời hạn (Constants, Limits & TTLs)

> **Lưu ý**: Toàn bộ hằng số và ngưỡng nghiệp vụ dưới đây được quản lý tập trung tại Single Source of Truth: [`backend/app/core/rules.py`](file:///d:/datamind_prod/backend/app/core/rules.py).

| Thông số / Hằng số | Giá trị | Ý nghĩa thực tế | Vị trí trong Code |
| :--- | :--- | :--- | :--- |
| `MAX_FILE_SIZE_BYTES` | `10.485.760` bytes (10MB) | Giới hạn dung lượng tệp tin tải lên tối đa | `backend/app/core/rules.py:45` |
| `CACHE_DEFAULT_TTL` | `86.400` giây (24 giờ) | Thời gian lưu cache phân tích cột (`profile`), ngữ cảnh AI (`profiler_ctx`), và báo cáo | `backend/app/core/rules.py:72` |
| `FILE_BYTES_TTL` | `18.000` giây (5 giờ) | Thời gian lưu dữ liệu nhị phân file (bytes) trên Redis để làm sạch | `backend/app/core/rules.py:88` |
| `SESSION_TTL_MS` | `18.000.000` ms (5 giờ) | Thời gian đếm lùi trên thanh footer của trang Profiler | `frontend/src/pages/Profiler.jsx:39` |
| `DEFAULT_VISIBLE` | `10` cột | Số dòng cột mặc định hiển thị trước khi bấm "Hiển thị toàn bộ" | `frontend/src/components/Profiler/ColumnTable.jsx:21` |
| `NULL_WARNING_PCT_THRESHOLD` | `> 60.0%` | Kích hoạt cờ đỏ cảnh báo và tính vào danh sách "cột cần xem" | `backend/app/core/rules.py:38` |
| `CLEANER_DROP_COLUMN_NULL_PCT` | `\ge 90.0%` | Cột bị xóa bỏ hoàn toàn trong quy trình Auto-Clean của bước Làm sạch | `backend/app/core/rules.py:53` |
| `CATEGORICAL_UNIQUE_THRESHOLD` | `15` giá trị | Số lượng giá trị duy nhất tối đa để xếp vào nhóm danh mục | `backend/app/core/rules.py:14` |
| `DATETIME_PARSE_THRESHOLD` | `0.8` (80%) | Tỷ lệ parse thành công tối thiểu để một cột chuỗi được coi là ngày tháng | `backend/app/core/rules.py:18` |
| `DATETIME_SAMPLE_LIMIT` | `100` dòng đầu | Số lượng dòng tối đa dùng để test parse datetime trong hàm `_try_datetime` | `backend/app/core/rules.py:21` |
| `COMMA_ROW_RATIO_THRESHOLD` | `> 20.0%` dòng | Tỷ lệ số dòng có dấu phẩy tối thiểu để kiểm tra dạng Multiple Choice | `backend/app/core/rules.py:25` |
| `MULTIPLE_CHOICE_TOKEN_MAX` | `\le 25` nhãn | Tổng số lượng tag duy nhất tối đa sau khi bóc tách dấu phẩy | `backend/app/core/rules.py:28` |
| `TEXT_AVG_LENGTH_THRESHOLD` | `> 30` ký tự | Độ dài ký tự trung bình tối thiểu để coi một cột là văn bản tự do | `backend/app/core/rules.py:32` |
| `DISGUISED_NUMERIC_THRESHOLD` | `0.6` (60%) | Tỷ lệ chuyển đổi thành công tối thiểu để phát hiện số bị ngụy trang dạng chữ | `backend/app/core/rules.py:35` |
| `THOUSANDS_NUMERIC_THRESHOLD` | `0.6` (60%) | Tỷ lệ khớp số phân cách hàng nghìn để bỏ qua Multiple Choice | `backend/app/core/rules.py:38` |
| `SAMPLE_VALUE_LIMIT` | `5` giá trị | Số lượng mẫu đại diện tối đa trả về cho mỗi cột | `backend/app/core/rules.py:42` |
| Thời gian Debounce tự động lưu | `800` ms | Độ trễ chờ người dùng ngừng gõ trước khi gửi API lưu mô tả | `frontend/src/pages/Profiler.jsx:183` |
| Ngưỡng cảnh báo khẩn cấp Footer | `< 300` giây (5 phút) | Thời gian còn lại khiến đồng hồ chuyển sang màu đỏ khẩn cấp | `frontend/src/pages/Profiler.jsx:62` |
| `AI_FREE_DAILY_LIMIT` | `2` lượt (mặc định) | Định mức sử dụng AI dùng chung miễn phí mỗi ngày (reset lúc 00:00 VN) | `backend/app/core/config.py:7` |
| `AI_PRO_DAILY_LIMIT` | `20` lượt (mặc định) | Định mức sử dụng AI cho tài khoản Pro mỗi ngày | `backend/app/core/config.py:8` |
| `CACHE_VERSION` | `"v5"` | Tiền tố phiên bản cache hồ sơ profile tránh nhầm với logic cũ | `backend/app/routers/files.py:183` |

---

## PHẦN F — Các vấn đề & bất cập phát hiện trong hệ thống (Issues & Inconsistencies)

Qua quá trình rà soát toàn diện từ mã nguồn frontend đến backend, các điểm bất cập sau đây đã được kiểm tra và xử lý:

### 1. Bất nhất giữa Popover UI và Thuật toán Điền khuyết Categorical [ĐÃ SỬA]
- **Hiện trạng**: Tại Popover hướng dẫn `ColumnTable.jsx:178-180` và từ điển dịch `vi.json:147`, hệ thống từng ghi: *"Danh mục: Điền ô trống bằng giá trị phổ biến nhất (mode)"*, trong khi backend `cleaner_service.py:401` điền `"Không xác định"`.
- **Khắc phục**: Đã sửa nội dung popover và các khóa `popover_rule_*` trong `frontend/src/i18n/locales/vi.json` và `en.json` cùng `frontend/src/components/Profiler/ColumnTable.jsx` để phản ánh đúng quy tắc điền khuyết thực tế: Categorical/Multiple Choice điền `"Không xác định"`, Datetime giữ nguyên không điền.
- **Trạng thái**: **ĐÃ SỬA** (`frontend/src/components/Profiler/ColumnTable.jsx:177-185`, `frontend/src/i18n/locales/vi.json:146-150`, `frontend/src/i18n/locales/en.json:146-150`).

### 2. Xung đột logic giữa Dấu phẩy Phân cách Nghìn và Multiple Choice [ĐÃ SỬA]
- **Hiện trạng**: Cột số tiền có phân cách hàng nghìn (như `"100,000 VND"`, `"(2,500)"`) từng bị gán nhầm thành `multiple_choice` do chứa dấu phẩy > 20% dòng.
- **Khắc phục**: Trước khi quét `multiple_choice`, hệ thống kiểm tra nếu $\ge 60\%$ giá trị khớp mẫu số có phân cách hàng nghìn (`THOUSANDS_NUMERIC_PATTERN`) thì bỏ qua nhánh `multiple_choice` để hàm `is_disguised_numeric` chuyển đổi chuẩn xác sang `numeric`.
- **Trạng thái**: **ĐÃ SỬA** (`backend/app/services/profiler_service.py:168-180`).

### 3. Ép kiểu Boolean thành Numeric thay vì Categorical ở Profiler [ĐÃ SỬA]
- **Hiện trạng**: `is_numeric_dtype(dtype)` trong Pandas trả về True với boolean, khiến cột bool bị phân loại thành `numeric` với biểu đồ histogram thay vì `categorical` với biểu đồ pie.
- **Khắc phục**: Loại trừ boolean khỏi nhánh số (`is_numeric_dtype(dtype) and not is_bool_dtype(dtype)`). Đưa nhánh `is_bool_dtype` lên thành `categorical`. Đồng thời với cột object chuỗi, nếu các giá trị chỉ gồm `true`/`false`/`có`/`không` thì tự động xếp vào `categorical`.
- **Trạng thái**: **ĐÃ SỬA** (`backend/app/services/profiler_service.py:138-166`).

### 4. Chuỗi văn bản tiếng Việt bị hardcode chưa qua hàm `t()` [ĐÃ SỬA]
- **Hiện trạng**:
  - `TypeDropdownButton.jsx`: Fallback text dùng `"Đã đổi từ ${detectedType}"` thay vì bản dịch i18n.
  - `files.py:243`: Backend hardcode câu tiếng Việt trong `reasoning` khi chưa phân tích AI.
- **Khắc phục**:
  - `TypeDropdownButton.jsx`: Dùng `t("profiler.overridden_from", { original: t(...) })`.
  - `ColumnTable.jsx`: Đã xác nhận dùng `t("profiler.col_header_unique_line1")` và `t("profiler.col_header_unique_line2")`.
  - `backend/app/routers/files.py:243`: Đặt `reasoning=""` để frontend tự hiển thị placeholder đa ngôn ngữ từ `t("profiler.ai_hint")`.
- **Trạng thái**: **ĐÃ SỬA** (`frontend/src/components/Profiler/TypeDropdownButton.jsx:125-131`, `backend/app/routers/files.py:243`).

### 5. Cột cảnh báo Unnamed nhắc sửa tên ở nơi không hỗ trợ đổi tên [ĐÃ SỬA]
- **Hiện trạng**: Thông báo cảnh báo ghi: *"bạn có thể đặt tên trong phần 'Sửa kiểu dữ liệu'"* nhưng UI Profiler không có chức năng đổi tên cột.
- **Khắc phục**: Đã sửa câu cảnh báo thành: *"Cột này chưa có tên — bạn có thể đặt lại tên ở bước Làm sạch (menu thao tác thủ công)."* trong backend và tệp i18n vi/en.
- **Trạng thái**: **ĐÃ SỬA** (`backend/app/services/profiler_service.py:242`, `frontend/src/i18n/locales/vi.json:101`, `frontend/src/i18n/locales/en.json:101`).

