# Feature Spec: Data Cleaner — Module 2

**Project:** DataMind  
**Module:** 2 — Data Cleaning  
**Status:** Draft  
**Last updated:** 2026-06

---

## 1. Tổng quan

Module 2 là cổng vào bắt buộc của toàn bộ pipeline DataMind. Mọi dataset đều phải đi qua đây trước khi được phép tiếp tục sang Module 3 (Tính toán thống kê) và các module tiếp theo.

Người dùng được chọn **một trong ba chế độ làm sạch** tùy theo mức độ kiểm soát họ muốn có trên dữ liệu của mình. Kết quả cuối cùng của Module 2 — dù theo chế độ nào — luôn là một **bản Clean Dataset duy nhất** được xác nhận, và chỉ bản này mới được truyền vào pipeline tiếp theo.

```
Upload file
    │
    ▼
Validate (kích thước, định dạng)
    │
    ▼
Detect Issues (missing, wrong type, encoding, duplicate)
    │
    ├─── Chế độ 1: Auto Clean ──────────────────────────────► Clean Dataset ──► Module 3+
    │
    ├─── Chế độ 2: Manual Edit ─── User tự sửa ────────────► Clean Dataset ──► Module 3+
    │
    └─── Chế độ 3: Guided Fix ──── Detect → Gợi ý → User điều chỉnh ──────► Clean Dataset ──► Module 3+
```

---

## 2. Đầu vào được hỗ trợ

| Định dạng | Ghi chú |
|---|---|
| `.xlsx`, `.xls` | Đọc bằng `openpyxl`, hỗ trợ multi-sheet (chọn sheet khi upload) |
| `.csv` | Tự động detect encoding (`chardet`), fallback `latin-1` nếu cần |

**Giới hạn kích thước (bảo vệ RAM 512MB của Render free):**

- Tối đa **10MB** dung lượng file
- Tối đa **50.000 dòng**
- Vượt giới hạn → từ chối ngay sau khi parse header, trả về thông báo rõ lý do

---

## 3. Các loại vấn đề dữ liệu được phát hiện

Module 2 tự động quét toàn bộ dataset và phân loại vấn đề theo 4 nhóm:

### 3.1 Missing Values
- Ô trống, `NaN`, `NULL`, chuỗi rỗng
- Báo cáo: số lượng + % theo từng cột
- Gợi ý fill: `mean` (phân phối đều) / `median` (phân phối lệch) / `mode` (cột text) / `"Unknown"`

### 3.2 Sai kiểu dữ liệu
- Cột số bị lưu dạng text (ví dụ: `"1,200"`, `"$500"`, `"N/A"`)
- Phát hiện: nếu >80% giá trị non-null của cột object có thể convert thành số → đánh dấu `wrong_type`
- Gợi ý: chuyển sang `float`/`int`, giá trị không hợp lệ → `NaN`

### 3.3 Encoding lỗi / Ký tự đặc biệt
- Ký tự replacement (`\ufffd`), ký tự control (`\x00`–`\x1f`)
- Thường xảy ra khi file Excel xuất từ hệ thống cũ hoặc encoding không khớp
- Gợi ý: strip ký tự lỗi, giữ lại phần text hợp lệ

### 3.4 Duplicate Rows
- Dòng trùng hoàn toàn (tất cả cột giống nhau)
- Báo cáo: tổng số dòng trùng / tổng dòng
- Gợi ý: xóa duplicate, giữ lại dòng đầu tiên

---

## 4. Ba chế độ làm sạch

### Chế độ 1 — Auto Clean (Tự động làm sạch)

**Dành cho:** người dùng muốn nhanh, không cần kiểm soát từng bước.

**Luồng:**
1. Upload file → hệ thống detect toàn bộ issues
2. Hiển thị tóm tắt nhanh: "Tìm thấy X vấn đề, sẽ tự động xử lý"
3. User bấm **"Clean ngay"** → hệ thống xử lý tất cả theo rule mặc định
4. Hiển thị **Diff Report**: trước/sau (số dòng bị xóa, cột được đổi kiểu, giá trị được fill)
5. User xem xong → bấm **"Xác nhận dùng bản này"** → Clean Dataset được chốt
6. Nếu không hài lòng → có thể quay lại chọn chế độ khác

**Rule mặc định:**
- Missing numeric → fill `median`
- Missing text → fill `"Unknown"`
- Wrong type → convert to numeric, lỗi → `NaN`
- Encoding lỗi → strip ký tự xấu
- Duplicate rows → drop, giữ dòng đầu

**Lưu ý UX:** Luôn có bước "Xác nhận" cuối — không bao giờ tự động chốt mà không có hành động của user.

---

### Chế độ 2 — Manual Edit (User tự sửa)

**Dành cho:** người dùng am hiểu dữ liệu, muốn toàn quyền kiểm soát.

**Luồng:**
1. Upload file → hệ thống detect issues và highlight các ô/cột có vấn đề
2. Hiển thị **bảng dữ liệu dạng lưới (data grid)** — có thể scroll, search, filter
3. Các ô có vấn đề được tô màu theo loại:
   - 🔴 Missing values
   - 🟡 Sai kiểu dữ liệu
   - 🟠 Encoding lỗi
4. User chỉnh sửa trực tiếp trên grid: sửa giá trị, xóa dòng, đổi kiểu cột
5. Panel bên phải hiển thị tóm tắt thay đổi đang thực hiện (live diff)
6. Bấm **"Hoàn tất chỉnh sửa"** → hệ thống validate lại lần cuối
7. Nếu còn issues nghiêm trọng → cảnh báo, user quyết định bỏ qua hay sửa tiếp
8. Bấm **"Xác nhận dùng bản này"** → Clean Dataset được chốt

**Tính năng hỗ trợ trong grid:**
- Filter theo cột có issue
- Bulk action: chọn nhiều dòng → xóa / fill cùng một giá trị
- Undo/Redo (tối thiểu 10 bước)
- Export bản đang sửa để kiểm tra ngoài app

---

### Chế độ 3 — Guided Fix (Làm sạch có hướng dẫn)

**Dành cho:** người dùng muốn hiểu dữ liệu của mình, quyết định từng vấn đề một, có thể quay lui điều chỉnh nhiều lần.

**Đây là chế độ phức tạp nhất và linh hoạt nhất.**

**Luồng:**

```
Detect Issues
     │
     ▼
Hiển thị danh sách issues theo thứ tự ưu tiên
     │
     ▼
[Với mỗi issue]:
  ├── Mô tả vấn đề + ví dụ giá trị thực tế
  ├── Gợi ý fix (có thể có nhiều lựa chọn)
  └── User chọn action:
        ├── Áp dụng gợi ý
        ├── Nhập giá trị/rule tự chọn
        ├── Bỏ qua issue này
        └── Xem trước kết quả trước khi quyết định
     │
     ▼
Sau mỗi quyết định → Preview dataset cập nhật real-time
     │
     ▼
User có thể:
  ├── Tiếp tục issue kế tiếp
  ├── Quay lại issue trước để thay đổi quyết định
  └── Điều chỉnh lại bất kỳ quyết định nào đã làm
     │
     ▼
Hoàn tất tất cả issues → Tổng kết toàn bộ thay đổi
     │
     ▼
Bấm "Xác nhận" → Clean Dataset được chốt
```

**Điểm khác biệt của chế độ này:**
- User **không bị buộc** phải xử lý theo thứ tự — có thể nhảy qua lại giữa các issues
- Mỗi quyết định được lưu lại và có thể **undo riêng lẻ** mà không ảnh hưởng các quyết định khác
- Hệ thống hiển thị **tác động cascade**: ví dụ, nếu fill missing theo mean nhưng cột đó có outlier, sẽ cảnh báo "mean hiện tại bị ảnh hưởng bởi outlier, bạn có muốn dùng median không?"
- Sau khi chốt xong, vẫn có thể **quay lại chỉnh sửa** (về chế độ 2 hoặc làm lại guided) trước khi đẩy sang Module 3

---

## 5. Clean Dataset — Output duy nhất của Module 2

Dù người dùng chọn chế độ nào, output của Module 2 luôn là một **Clean Dataset được xác nhận**, bao gồm:

### 5.1 File dữ liệu đã sạch
- Lưu trên **Supabase Storage** (không lưu trên Render disk — mất khi service restart)
- Định dạng xuất: `.csv` (nhẹ, universal, phù hợp cho pipeline tiếp theo)
- URL truy cập được lưu vào Postgres cùng với session/project ID

### 5.2 Clean Report (JSON)
Đính kèm vào Clean Dataset, gồm:

```json
{
  "original_rows": 5000,
  "original_cols": 12,
  "clean_rows": 4876,
  "clean_cols": 12,
  "changes": {
    "duplicate_rows_removed": 124,
    "missing_filled": { "age": 43, "income": 17 },
    "type_converted": { "salary": "object → float64" },
    "encoding_fixed": { "name": 8 }
  },
  "columns": ["id", "name", "age", "income", "..."],
  "dtypes": { "id": "int64", "name": "object", "age": "float64" },
  "clean_mode_used": "guided_fix",
  "confirmed_at": "2026-06-27T10:30:00Z"
}
```

### 5.3 summary_for_module3
Phần tóm tắt nhỏ gọn được truyền thẳng sang Module 3 mà không cần parse lại file:

```json
{
  "shape": [4876, 12],
  "columns": ["id", "name", "age", "income"],
  "dtypes": { "id": "int64", "age": "float64" },
  "numeric_columns": ["id", "age", "income"],
  "categorical_columns": ["name", "gender", "region"]
}
```

---

## 6. Điều kiện để Clean Dataset được chốt và truyền tiếp

Clean Dataset chỉ được phép đi vào Module 3 khi thỏa **tất cả** điều kiện sau:

| Điều kiện | Mô tả |
|---|---|
| User đã xác nhận | Phải có hành động bấm "Xác nhận" — không tự động |
| Không có cột toàn NaN | Cột 100% missing sau khi clean → báo lỗi, yêu cầu xử lý |
| Tối thiểu 1 cột numeric | Module 3 cần ít nhất 1 cột số để tính toán |
| Tối thiểu 10 dòng dữ liệu | Dưới 10 dòng không đủ để tính thống kê có ý nghĩa |
| File lưu thành công lên Storage | Xác nhận upload Supabase trả về OK |

Nếu không đạt → hiển thị lý do cụ thể, hướng dẫn user sửa, không cho phép tiếp tục.

---

## 7. Giới hạn kỹ thuật & lưu ý triển khai

| Vấn đề | Giải pháp |
|---|---|
| RAM 512MB (Render free) | Không dùng `df.copy()` khi detect — read-only; validate size trước khi xử lý |
| Render disk không bền | Không lưu file trên local; upload ngay lên Supabase Storage sau khi clean |
| Cold start 30–60s | Luôn hiển thị loading spinner; tách pipeline thành async job nếu file lớn |
| Supabase 500MB Postgres | Chỉ lưu JSON summary vào Postgres — không lưu raw rows |
| Encoding đa dạng | `chardet` detect trên 50KB đầu; fallback `latin-1`; cảnh báo nếu không chắc |

---

## 8. Trạng thái Module và điều hướng

```
[Chờ upload] → [Đang xử lý] → [Chọn chế độ] → [Đang làm sạch] → [Xác nhận] → [Đã chốt ✓]
                                                                          ↑
                                                              User có thể quay lại
                                                              để điều chỉnh trước
                                                              khi bấm tiếp tục
```

Khi Module 2 ở trạng thái **"Đã chốt ✓"**, thanh điều hướng mới mở khóa Module 3. Người dùng vẫn có thể quay lại Module 2 để upload lại hoặc chọn chế độ khác — nhưng khi đó kết quả Module 3 trở đi sẽ bị reset.

---

## 9. Scope ngoài phạm vi (Out of scope — v1)

Những tính năng sau **chưa có trong v1**, để sau khi có ngân sách/infrastructure:

- Merge nhiều file thành một dataset
- Clean dữ liệu dạng JSON hoặc XML
- Outlier detection tự động (sẽ thuộc Module 3)
- Versioning nhiều bản clean song song
- RAG-assisted cleaning (gợi ý bằng LLM theo ngữ nghĩa cột)