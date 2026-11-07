---
title: Nhận diện 5 kiểu dữ liệu
updated: 2026-11-02
---

# Nhận diện 5 kiểu dữ liệu {#data-types}

Hệ thống DataMind phân loại mọi cột dữ liệu trong file của bạn vào đúng **1 trong 5 kiểu dữ liệu chuẩn**. Quá trình phân loại diễn ra hoàn toàn tự động dựa trên **nội dung giá trị thực tế**, không đoán mò theo tên cột.

## Sơ đồ quy trình nhận diện tự động {#type-decision-flow}

Mỗi cột khi đưa vào phân tích sẽ lần lượt đi qua các bài kiểm tra logic theo đúng thứ tự nghiêm ngặt dưới đây:

```dm-flow profiler-type
```

## Chi tiết 5 kiểu dữ liệu chuẩn {#type-details}

### 1. Số liệu (Numeric) {#type-numeric}

Dành cho các cột chứa số đo lường, doanh thu, số lượng, tỷ lệ phần trăm hoặc các chỉ số định lượng.

- **Dấu hiệu nhận biết**: Cột chứa số nguyên (ví dụ: `1`, `2`, `100`), số thập phân (ví dụ: `2,5`, `3.14`), hoặc chuỗi văn bản chứa số tiền có ký hiệu đặc biệt (ví dụ: `100.000đ`, `$250`) đạt từ 60% số dòng trở lên.
- **Gợi ý biểu đồ**: `ui:chart.bar`, `ui:chart.line`, `ui:chart.histogram`.

```dm-example
{
  "pair": true,
  "match": {
    "values": ["100,000 VND", "250,000 VND", "1,200,000 VND"],
    "expect": "numeric",
    "note": "Số tiền kèm chữ VND và dấu phẩy phân cách hàng nghìn được nhận diện là số ngụy trang"
  },
  "near": {
    "values": ["100", "200", "Chưa rõ", "N/A", "Lỗi dữ liệu"],
    "expect": "text",
    "note": "Tỷ lệ số hợp lệ dưới ngưỡng nên không thể coi là cột số"
  }
}
```

### 2. Thời gian (Datetime) {#type-datetime}

Dành cho các cột mốc thời gian, ngày đặt hàng, năm sinh, ngày giao dịch hoặc giờ giấc.

- **Dấu hiệu nhận biết**: Định dạng ngày tháng hoặc giờ giấc (ví dụ: `15/01/2024`, `2024-03-20 08:30`) có thể đọc hiểu chính xác từ 80% số dòng trở lên (kiểm tra trên tối đa 100 dòng đầu).
- **Gợi ý biểu đồ**: `ui:chart.line` theo chuỗi thời gian.

```dm-example
{
  "pair": false,
  "match": {
    "values": ["2024-01-15", "16/02/2024", "2024-03-20"],
    "expect": "datetime",
    "note": "Các định dạng ngày tháng phổ biến đều được nhận diện chuẩn xác"
  }
}
```

### 3. Danh mục (Categorical) {#type-categorical}

Dành cho các thuộc tính phân loại nhóm, trạng thái, giới tính, khu vực địa lý hoặc đánh giá mức độ.

- **Dấu hiệu nhận biết**: Cột dạng đúng/sai (ví dụ: `Đúng/Sai`, `có/không`), hoặc có số lượng giá trị duy nhất không vượt quá 15 và có sự lặp lại giữa các dòng.
- **Gợi ý biểu đồ**: `ui:chart.bar`, `ui:chart.pie`.

```dm-example
{
  "pair": true,
  "match": {
    "values": ["Hà Nội", "Đà Nẵng", "TP.HCM", "Hà Nội", "TP.HCM"],
    "expect": "categorical",
    "note": "Số nhóm ít (3 nhóm) và có sự lặp lại giữa các dòng"
  },
  "near": {
    "values": ["Mã 01", "Mã 02", "Mã 03", "Mã 04", "Mã 05", "Mã 06", "Mã 07", "Mã 08", "Mã 09", "Mã 10", "Mã 11", "Mã 12", "Mã 13", "Mã 14", "Mã 15", "Mã 16"],
    "expect": "text",
    "note": "16 giá trị khác nhau hoàn toàn vượt quá ngưỡng 15 nên chuyển sang Văn bản"
  }
}
```

### 4. Nhiều lựa chọn (Multiple Choice) {#type-multiple-choice}

Dành cho các câu hỏi khảo sát cho phép chọn nhiều đáp án hoặc các danh sách thẻ gắn nhãn phân tách bằng dấu phẩy.

- **Dấu hiệu nhận biết**: Có hơn 20% số dòng chứa dấu phẩy `,` (ví dụ: `Đỏ, Xanh`) và tổng số lượng nhãn duy nhất sau khi tách không vượt quá 25.
- **Gợi ý biểu đồ**: `ui:chart.bar`, `ui:chart.pie`.

```dm-example
{
  "pair": true,
  "match": {
    "values": ["Đỏ, Xanh", "Vàng", "Đỏ, Vàng", "Trắng, Đỏ"],
    "expect": "multiple_choice",
    "note": "Các nhãn được phân tách bằng dấu phẩy và lặp lại trong danh mục phương án"
  },
  "near": {
    "values": ["Số 10, Phố Huế, Quận Hai Bà Trưng, Hà Nội"],
    "expect": "text",
    "note": "Địa chỉ nhà chứa nhiều dấu phẩy nhưng các cụm từ không lặp lại thành bộ lựa chọn"
  }
}
```

### 5. Văn bản (Text) {#type-text}

Dành cho các cột phản hồi ý kiến mở, ghi chú cá nhân, địa chỉ nhà chi tiết hoặc mã đơn hàng duy nhất.

- **Dấu hiệu nhận biết**: Đoạn chữ có độ dài trung bình vượt quá 30 ký tự hoặc có hơn 15 giá trị phân biệt không theo quy luật danh mục.
- **Gợi ý biểu đồ**: Không có biểu đồ phù hợp để vẽ trực tiếp.

## Thử nghiệm nhanh bộ phân loại dữ liệu {#try-classifier}

Bạn có thể dán thử vài dòng dữ liệu vào ô dưới đây để kiểm tra trực tiếp xem hệ thống sẽ nhận diện là kiểu gì:

```dm-try
```
