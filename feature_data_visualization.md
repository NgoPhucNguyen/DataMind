# Feature Spec: Data Visualization — Module 3 & 4

**Project:** DataMind  
**Module:** 3 — Statistical Computation / 4 — Data Visualization  
**Depends on:** Module 1 (Profiling metadata), Module 2 (Clean Dataset)  
**Status:** Draft  
**Last updated:** 2026-06

---

## 1. Tổng quan & Phân tách trách nhiệm

Module 3 và 4 được tách biệt hoàn toàn theo nguyên tắc:

> **Module 3 (Backend)** — tính số, trả JSON  
> **Module 4 (Frontend)** — nhận JSON, render chart

Lý do tách:
- Module 5 (AI Report) đọc cùng JSON từ Module 3 mà không cần render lại chart — không tính toán hai lần
- User đổi loại chart hoặc chỉnh màu → không gọi backend, Recharts chỉ re-render từ data đã có
- LLM **không đọc ảnh chart** — đọc thẳng JSON số liệu → báo cáo chính xác hơn vision

```
Clean Dataset (Module 2)
        │
        ▼
Module 3 — Tính toán (Python/Backend)
        │
        └──► statistical_summary JSON  (lưu Postgres, dùng chung)
                    │
                    ├──► Module 4 — Recharts render → User nhìn
                    │
                    └──► Module 5 — Gemini đọc → Viết báo cáo
```

---

## 2. Module 3 — Statistical Computation

### 2.1 Đầu vào

Nhận từ Module 2:
- `file_hash` — trỏ tới Clean Dataset trên Redis/Supabase Storage
- `summary_for_module3` — metadata cột (column names, dtypes, shape)
- `overrides` từ Module 1 — kiểu dữ liệu user đã xác nhận

### 2.2 Tính toán theo loại cột

**Numeric columns:**
```
- min, max, mean, median, std
- skewness (để detect phân phối lệch)
- kurtosis
- percentiles: P25, P75, IQR
- outlier_count (IQR method: < Q1-1.5×IQR hoặc > Q3+1.5×IQR)
- distribution_bins: 20 bins cho histogram
- missing_pct
- unique_count
```

**Categorical / Boolean columns:**
```
- unique_count
- top_values: top 10 (value + count + pct)
- missing_pct
- mode
```

**Datetime columns:**
```
- min_date, max_date
- range_days
- trend_data: aggregate theo tháng/tuần tùy range
```

**Correlation (toàn bộ numeric columns):**
```
- correlation_matrix: tất cả cặp numeric
- top_correlations: các cặp có |r| > 0.5, sorted descending
```

### 2.3 Output — statistical_summary JSON

```json
{
  "shape": [4876, 12],
  "computed_at": "2026-06-27T10:30:00Z",
  "columns": {
    "age": {
      "dtype": "numeric",
      "min": 18, "max": 65,
      "mean": 34.2, "median": 32.0, "std": 10.1,
      "skewness": 0.8, "kurtosis": 1.2,
      "p25": 26.0, "p75": 42.0, "iqr": 16.0,
      "outlier_count": 12,
      "missing_pct": 2.1,
      "unique_count": 45,
      "distribution_bins": [[18,21,45], [21,24,123], "..."]
    },
    "region": {
      "dtype": "categorical",
      "unique_count": 6,
      "missing_pct": 0.5,
      "mode": "Hà Nội",
      "top_values": [
        {"value": "Hà Nội", "count": 1200, "pct": 24.6},
        "..."
      ]
    },
    "created_at": {
      "dtype": "datetime",
      "min_date": "2023-01-01",
      "max_date": "2026-06-01",
      "range_days": 1247,
      "trend_data": [
        {"period": "2023-01", "count": 45},
        "..."
      ]
    }
  },
  "correlation_matrix": {
    "age": {"income": 0.72, "score": 0.31},
    "income": {"age": 0.72, "score": 0.45}
  },
  "top_correlations": [
    {"col_a": "age", "col_b": "income", "r": 0.72},
    {"col_a": "income", "col_b": "score", "r": 0.45}
  ]
}
```

### 2.4 Điều kiện bỏ qua cột

| Điều kiện | Hành động |
|---|---|
| `missing_pct > 60%` | Tính nhưng đánh dấu `"low_confidence": true`, cảnh báo ở FE |
| `unique_count = 1` | Bỏ qua — không có variance |
| `dtype = "text"` (free text dài) | Bỏ qua phần chart — không có cấu trúc để vẽ |
| `row_count < 10` sau clean | Không tính — trả lỗi, yêu cầu quay lại Module 2 |

### 2.5 Giới hạn kỹ thuật

- Không dùng `df.copy()` khi tính — thao tác read-only
- Correlation matrix chỉ tính cho tối đa **20 cột numeric** đầu tiên — tránh O(n²) quá nặng trên 0.1 CPU
- Kết quả lưu vào **Postgres** (JSON column) theo `session_id` — Module 4 và 5 đọc từ đây, không tính lại

---

## 3. Module 4 — Data Visualization

### 3.1 Nguyên tắc render

- Toàn bộ chart render **client-side** bằng **Recharts** — không tốn RAM/CPU Render
- Module 4 chỉ đọc `statistical_summary` từ Postgres, không gọi lại backend để tính toán
- LLM không được gửi ảnh chart — chỉ gửi JSON số liệu

### 3.2 Auto Chart Selection — Logic chọn chart tự động

#### Bước 1 — Phân loại chart theo nhóm (Tab)

| Tab | Điều kiện xuất hiện |
|---|---|
| **Phân phối** | Có ít nhất 1 cột numeric hoặc categorical |
| **Tương quan** | Có ít nhất 2 cột numeric |
| **Theo thời gian** | Có ít nhất 1 cột datetime |
| **Khác** | Chart không thuộc 3 nhóm trên |

#### Bước 2 — Rule chọn loại chart

**Một cột đơn:**
```
numeric + unique_count > 10     →  Histogram + Box plot
numeric + unique_count ≤ 10     →  Bar chart (treat as categorical)
categorical / boolean           →  Bar chart (top values)
datetime                        →  Line chart (trend theo thời gian)
text (free text)                →  Bỏ qua
```

**Kết hợp 2 cột:**
```
numeric × numeric               →  Scatter plot
categorical × numeric           →  Grouped bar chart
datetime × numeric              →  Line chart
categorical × categorical       →  Stacked bar chart
```

**Toàn bộ dataset:**
```
≥ 3 cột numeric                 →  Correlation heatmap (tab Tương quan)
```

#### Bước 3 — Ranking trong mỗi tab (auto top 3 trước)

Chart được rank theo điểm tổng hợp từ 3 tín hiệu:

```
score = (1 - missing_pct/100) × 0.4       ← missing thấp = đáng tin
      + (std / mean nếu numeric) × 0.3    ← variance cao = thú vị
      + (|correlation| nếu có) × 0.3      ← tương quan mạnh = ưu tiên
```

- Mỗi tab hiển thị **top 3 chart** có score cao nhất
- Nút **"Xem thêm (N chart)"** mở toàn bộ chart còn lại của tab đó

### 3.3 Hai chế độ người dùng

#### Chế độ A — Auto (Dành cho user lười)

1. Vào Module 4 → thấy ngay chart đã được chọn và render sẵn
2. Không cần làm gì — hệ thống đã tự chọn top chart mỗi tab
3. Bấm **"Dùng chart này cho báo cáo"** → chốt và qua Module 5
4. Có thể switch sang Chế độ B bất cứ lúc nào trước khi chốt

#### Chế độ B — Manual (Dành cho user muốn chỉnh)

Sau khi xem chart tự động, user có thể:

| Tùy chỉnh | Phạm vi v1 |
|---|---|
| Đổi loại chart (bar → line) | ✅ Có |
| Đổi title / label trục | ✅ Có |
| Đổi màu chart | ✅ Có (preset palette, không custom hex) |
| Thêm / bỏ cột trong chart | ✅ Có |
| Tick chọn chart nào vào báo cáo | ✅ Có |
| Custom layout / vị trí chart | ❌ Out of scope v1 |
| Annotation / vẽ tay lên chart | ❌ Out of scope v1 |
| Export chart riêng lẻ thành PNG | ❌ Out of scope v1 — để sau |

### 3.4 Chọn chart cho báo cáo (Module 5)

Cuối Module 4, user thấy màn hình **"Chọn chart cho báo cáo"**:

```
[✅] Histogram — age                    (auto-selected, score: 0.87)
[✅] Bar chart — region                 (auto-selected, score: 0.81)
[✅] Scatter — age × income             (auto-selected, score: 0.76)
[✅] Correlation heatmap                (auto-selected, score: 0.74)
[ ] Box plot — income                  (không được chọn, score: 0.51)
[ ] Bar chart — gender                 (không được chọn, score: 0.43)
```

- Mặc định: **auto-tick top chart** theo score (tối đa 6 chart)
- User có thể bỏ tick hoặc thêm tick tự do
- Bấm **"Xác nhận & Tạo báo cáo"** → danh sách chart đã chọn được lưu cùng `session_id`, truyền sang Module 5

### 3.5 Snapshot chart đã xác nhận

Khi user xác nhận, hệ thống lưu vào Postgres:

```json
{
  "session_id": "abc123",
  "confirmed_charts": [
    {
      "chart_id": "hist_age",
      "type": "histogram",
      "column": "age",
      "title": "Phân phối độ tuổi",
      "customized": false
    },
    {
      "chart_id": "scatter_age_income",
      "type": "scatter",
      "col_x": "age",
      "col_y": "income",
      "title": "Tương quan tuổi và thu nhập",
      "customized": true,
      "overrides": { "color": "blue", "label_x": "Tuổi" }
    }
  ]
}
```

Module 5 đọc `confirmed_charts` + `statistical_summary` → không cần render lại chart, chỉ cần số liệu để viết báo cáo.

---

## 4. Điều kiện để qua Module 5

| Điều kiện | Mô tả |
|---|---|
| `statistical_summary` đã được lưu | Module 3 chạy thành công |
| Có ít nhất 1 chart được tick chọn | Không thể tạo báo cáo không có chart |
| User đã bấm "Xác nhận" | Không tự động chuyển |

---

## 5. Out of scope — v1

- Export chart đơn lẻ thành PNG/SVG
- Custom màu hex tự do (chỉ có preset palette)
- Chart animation phức tạp
- Nhiều dataset cùng lúc trên một chart
- Chart 3D
- RAG-assisted chart suggestion (gợi ý chart bằng LLM đọc ngữ nghĩa cột)
- Xử lý file cấu trúc phức tạp, khó đoán (CSV phi chuẩn, merged cells Excel)

---

## 6. Luồng trạng thái toàn Module 3-4

```
[Module 2 chốt Clean Dataset]
        │
        ▼
[Module 3: Đang tính toán...] ← show spinner, async job
        │
        ▼
[Module 3: Hoàn tất] → statistical_summary lưu Postgres
        │
        ▼
[Module 4: Hiển thị chart theo tab]
        │
        ├── Chế độ A: Xem → Xác nhận → Module 5
        │
        └── Chế độ B: Chỉnh sửa → Xem lại → Xác nhận → Module 5
```

Người dùng có thể quay lại Module 4 để thay đổi chart đã chọn — nhưng khi đó kết quả Module 5 sẽ bị reset và cần tạo lại báo cáo.
