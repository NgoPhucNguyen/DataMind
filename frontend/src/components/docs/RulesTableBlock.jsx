import React, { useState } from "react";
import { Table, Search } from "lucide-react";

export default function RulesTableBlock({ rules = {} }) {
  const [filter, setFilter] = useState("");

  const profilerRules = [
    {
      key: "categorical_unique_threshold",
      name: "Ngưỡng số giá trị duy nhất (Danh mục)",
      value: rules["profiler.categorical_unique_threshold"] ?? 15,
      unit: "giá trị",
      desc: "Nếu số giá trị khác nhau <= ngưỡng này và có phần tử lặp lại, nhận diện là Danh mục (Categorical)",
    },
    {
      key: "datetime_parse_threshold",
      name: "Tỷ lệ parse ngày tháng thành công",
      value: rules["profiler.datetime_parse_threshold"] ? `${Number(rules["profiler.datetime_parse_threshold"]) * 100}%` : "80%",
      unit: "tỷ lệ mẫu",
      desc: "Mẫu các dòng đầu tiên có ít nhất 80% khớp định dạng ngày hợp lệ",
    },
    {
      key: "datetime_sample_limit",
      name: "Cỡ mẫu kiểm tra ngày tháng",
      value: rules["profiler.datetime_sample_limit"] ?? 100,
      unit: "dòng",
      desc: "Số lượng dòng tối đa được trích xuất để kiểm tra parse thời gian",
    },
    {
      key: "comma_row_ratio_threshold",
      name: "Tỷ lệ dòng chứa dấu phẩy (Nhiều lựa chọn)",
      value: rules["profiler.comma_row_ratio_threshold"] ? `${Number(rules["profiler.comma_row_ratio_threshold"]) * 100}%` : "20%",
      unit: "tỷ lệ dòng",
      desc: "Ít nhất 20% dòng chứa dấu phẩy phân tách nhiều lựa chọn",
    },
    {
      key: "multiple_choice_token_max",
      name: "Số token duy nhất tối đa (Nhiều lựa chọn)",
      value: rules["profiler.multiple_choice_token_max"] ?? 25,
      unit: "token",
      desc: "Số lượng các lựa chọn độc lập tách ra từ chuỗi không vượt quá ngưỡng này",
    },
    {
      key: "text_avg_length_threshold",
      name: "Độ dài ký tự trung bình (Văn bản)",
      value: rules["profiler.text_avg_length_threshold"] ?? 30,
      unit: "ký tự",
      desc: "Chuỗi có độ dài trung bình > 30 ký tự được xếp vào kiểu Văn bản (Text)",
    },
    {
      key: "disguised_numeric_threshold",
      name: "Tỷ lệ số bị ẩn trong chuỗi ký tự",
      value: rules["profiler.disguised_numeric_threshold"] ? `${Number(rules["profiler.disguised_numeric_threshold"]) * 100}%` : "60%",
      unit: "tỷ lệ dòng",
      desc: "Cột dạng chuỗi có >= 60% dữ liệu thực chất là số cần chú ý chuyển đổi",
    },
    {
      key: "thousands_numeric_threshold",
      name: "Tỷ lệ số có dấu phân cách hàng nghìn",
      value: rules["profiler.thousands_numeric_threshold"] ? `${Number(rules["profiler.thousands_numeric_threshold"]) * 100}%` : "60%",
      unit: "tỷ lệ dòng",
      desc: "Nhận diện định dạng tiền tệ / hàng nghìn (ví dụ 100,000) để không nhầm sang Nhiều lựa chọn",
    },
    {
      key: "null_warning_pct_threshold",
      name: "Cảnh báo tỷ lệ ô trống cao",
      value: rules["profiler.null_warning_pct_threshold"] ? `${rules["profiler.null_warning_pct_threshold"]}%` : "60%",
      unit: "tỷ lệ ô trống",
      desc: "Cột có trên 60% ô trống được gắn nhãn chú ý để cân nhắc xử lý hoặc loại bỏ",
    },
    {
      key: "sample_value_limit",
      name: "Số giá trị mẫu hiển thị trong bảng",
      value: rules["profiler.sample_value_limit"] ?? 5,
      unit: "giá trị",
      desc: "Số lượng mẫu đại diện trích xuất xem nhanh cho mỗi cột",
    },
  ];

  const filteredRules = profilerRules.filter(
    (r) =>
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.desc.toLowerCase().includes(filter.toLowerCase()) ||
      r.key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="my-6 border border-border rounded-xl bg-canvas overflow-hidden max-w-full">
      <div className="p-3 bg-sage/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-forest shrink-0" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Bảng quy tắc & ngưỡng nhận diện Đánh giá dữ liệu
          </span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Tìm quy tắc..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 pr-2.5 py-1 text-xs bg-white border border-border rounded-md text-ink placeholder:text-muted/60 focus:outline-none focus:border-forest"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-left text-xs border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-sage/10 border-b border-border text-muted font-medium">
              <th className="py-2.5 px-3">Tên quy tắc</th>
              <th className="py-2.5 px-3">Giá trị định mức</th>
              <th className="py-2.5 px-3">Ý nghĩa & điều kiện kích hoạt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredRules.map((rule) => (
              <tr key={rule.key} className="hover:bg-sage/20 transition-colors">
                <td className="py-2.5 px-3 font-medium text-ink">
                  <div>{rule.name}</div>
                  <div className="text-[11px] font-mono text-muted/80">{rule.key}</div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold bg-forest/10 text-forest border border-forest/20 text-xs">
                    {rule.value}
                  </span>
                  <span className="ml-1.5 text-muted text-[11px]">{rule.unit}</span>
                </td>
                <td className="py-2.5 px-3 text-muted leading-relaxed">
                  {rule.desc}
                </td>
              </tr>
            ))}
            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted">
                  Không tìm thấy quy tắc nào phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
