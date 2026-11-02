/**
 * explainDetection.js
 * -------------------
 * Chuyển đổi đối tượng detection_reason thành danh sách các câu tiếng Việt dễ hiểu
 * thể hiện các bước kiểm tra logic mà cột dữ liệu đã trải qua.
 *
 * @param {object|null} detectionReason - Đối tượng detection_reason từ backend
 * @param {function} t - Hàm dịch i18n
 * @returns {Array<string>} Danh sách câu giải trình theo thứ tự
 */

export function explainDetection(detectionReason, t) {
  if (!detectionReason || !detectionReason.checks || !Array.isArray(detectionReason.checks)) {
    return [];
  }

  const result = [];
  const checks = detectionReason.checks;

  for (const item of checks) {
    const checkName = item.check;
    const value = item.value;
    const threshold = item.threshold;
    const passed = Boolean(item.passed);

    // Dịch qua i18n nếu có key
    const i18nKey = `docs.check.${checkName}.${passed ? "pass" : "fail"}`;
    let sentence = t ? t(i18nKey, { value, threshold, defaultValue: "" }) : "";

    // Fallback diễn giải trực quan nếu chưa có trong từ điển
    if (!sentence) {
      if (checkName === "is_numeric_dtype") {
        sentence = passed ? "Dữ liệu gốc là kiểu số hợp lệ ✓" : "Dữ liệu không phải là kiểu số thuần túy ✗";
      } else if (checkName === "is_bool_dtype" || checkName === "is_bool_dtype_fallback") {
        sentence = passed ? "Dữ liệu gốc là kiểu luận lý (Boolean: Đúng/Sai) ✓" : "Dữ liệu không phải Boolean ✗";
      } else if (checkName === "is_datetime64_dtype") {
        sentence = passed ? "Dữ liệu gốc đã được nhận dạng là Ngày giờ (datetime64) ✓" : "Dữ liệu không phải ngày giờ gốc ✗";
      } else if (checkName === "datetime_parse_rate") {
        const pct = Math.round(value * 100);
        sentence = passed
          ? `Tỷ lệ đọc thành công ngày tháng đạt ${pct}% (ngưỡng ≥ ${Math.round(threshold * 100)}%) ✓`
          : `Tỷ lệ đọc ngày tháng chỉ đạt ${pct}% (thấp hơn ngưỡng ${Math.round(threshold * 100)}%) ✗`;
      } else if (checkName === "all_bool_strings") {
        sentence = passed
          ? "Toàn bộ giá trị trong cột là các từ khóa Đúng/Sai ('true', 'false', 'có', 'không') ✓"
          : "Không phải chuỗi từ khóa Đúng/Sai ✗";
      } else if (checkName === "thousands_match_ratio") {
        const pct = Math.round(value * 100);
        sentence = passed
          ? `Có ${pct}% dòng là số có dấu phẩy phân cách hàng nghìn (bỏ qua Nhiều lựa chọn) ✓`
          : `Không phải số phân cách hàng nghìn ✗`;
      } else if (checkName === "comma_row_ratio") {
        const pct = Math.round(value * 100);
        sentence = passed
          ? `Có ${pct}% dòng chứa dấu phẩy phân cách (ngưỡng > ${Math.round(threshold * 100)}%) ✓`
          : `Tỷ lệ dòng chứa dấu phẩy không đáng kể (${pct}%) ✗`;
      } else if (checkName === "token_unique_count") {
        sentence = passed
          ? `Tổng số lựa chọn riêng biệt là ${value} (ngưỡng ≤ ${threshold}) ✓`
          : `Số lượng lựa chọn riêng biệt quá lớn (${value} > ${threshold}) ✗`;
      } else if (checkName === "unique_count") {
        sentence = passed
          ? `Có ${value} giá trị khác nhau (ngưỡng ≤ ${threshold}) ✓`
          : `Có ${value} giá trị khác nhau (vượt ngưỡng danh mục ${threshold}) ✗`;
      } else if (checkName === "has_repeats") {
        sentence = passed
          ? `Có giá trị lặp lại giữa các dòng (${value} dòng trùng lặp) ✓`
          : "Mỗi dòng là một giá trị duy nhất (không có sự lặp lại) ✗";
      } else if (checkName === "avg_len") {
        sentence = passed
          ? `Độ dài trung bình là ${value} ký tự (ngưỡng văn bản > ${threshold}) ✓`
          : `Độ dài trung bình ngắn (${value} ký tự ≤ ${threshold}) ✗`;
      } else if (checkName === "categorical_unique_fallback") {
        sentence = passed
          ? `Số giá trị khác nhau là ${value} (thuộc ngưỡng danh mục ≤ ${threshold}) ✓`
          : `Số giá trị khác nhau ${value} > ${threshold} ✗`;
      } else if (checkName === "text_fallback") {
        sentence = `Không khớp các mẫu trên, xếp vào Văn bản tự do (${value} giá trị khác nhau > ${threshold}) ✓`;
      } else if (checkName === "disguised_numeric_ratio") {
        const pct = Math.round(value * 100);
        sentence = passed
          ? `Phát hiện số ngụy trang: ${pct}% giá trị có thể chuyển đổi thành số sau khi bỏ ký tự tiền tệ/phần trăm (ngưỡng ≥ ${Math.round(threshold * 100)}%) ✓`
          : `Không đạt ngưỡng số ngụy trang (${pct}% < ${Math.round(threshold * 100)}%) ✗`;
      } else {
        sentence = `${checkName}: ${value} ${item.op} ${threshold} (${passed ? "Đạt" : "Không đạt"})`;
      }
    }

    result.push(sentence);
  }

  // Kết luận cuối cùng dựa trên rule_id
  const ruleId = detectionReason.rule_id;
  const conclusions = {
    native_numeric: "Kết luận: Số liệu (dữ liệu số gốc)",
    native_datetime: "Kết luận: Thời gian (dữ liệu ngày giờ gốc)",
    native_bool: "Kết luận: Danh mục (kiểu luận lý boolean)",
    bool_strings: "Kết luận: Danh mục (chuỗi từ khóa luận lý)",
    datetime_parsed: "Kết luận: Thời gian (chuỗi ngày tháng)",
    multiple_choice: "Kết luận: Nhiều lựa chọn (khảo sát đa lựa chọn)",
    categorical_repeats: "Kết luận: Danh mục (nhóm phân loại có lặp lại)",
    text_long: "Kết luận: Văn bản tự do (chuỗi văn bản dài)",
    categorical_fallback: "Kết luận: Danh mục (số nhóm hữu hạn)",
    text_fallback: "Kết luận: Văn bản tự do (nhiều giá trị khác biệt)",
    disguised_numeric: "Kết luận: Số liệu (số bị lưu dưới dạng văn bản)",
  };

  const finalConclusion = conclusions[ruleId] || `Kết luận: ${ruleId}`;
  result.push(`→ ${finalConclusion}`);

  return result;
}

