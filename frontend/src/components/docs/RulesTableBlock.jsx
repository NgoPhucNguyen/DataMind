import React, { useState } from "react";
import { Table, Search } from "lucide-react";

export default function RulesTableBlock({ rules = {}, initialGroup = "all" }) {
  const [filter, setFilter] = useState("");
  const [activeGroup, setActiveGroup] = useState(initialGroup || "all");

  const profilerRules = [
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "categorical_unique_threshold",
      name: "Ngưỡng số giá trị duy nhất (Danh mục)",
      value: rules["profiler.categorical_unique_threshold"] ?? 15,
      unit: "giá trị",
      desc: "Nếu số giá trị khác nhau <= ngưỡng này và có phần tử lặp lại, nhận diện là Danh mục (Categorical)",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "datetime_parse_threshold",
      name: "Tỷ lệ parse ngày tháng thành công",
      value: rules["profiler.datetime_parse_threshold"] ? `${Number(rules["profiler.datetime_parse_threshold"]) * 100}%` : "80%",
      unit: "tỷ lệ mẫu",
      desc: "Mẫu các dòng đầu tiên có ít nhất 80% khớp định dạng ngày hợp lệ",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "datetime_sample_limit",
      name: "Cỡ mẫu kiểm tra ngày tháng",
      value: rules["profiler.datetime_sample_limit"] ?? 100,
      unit: "dòng",
      desc: "Số lượng dòng tối đa được trích xuất để kiểm tra parse thời gian",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "comma_row_ratio_threshold",
      name: "Tỷ lệ dòng chứa dấu phẩy (Nhiều lựa chọn)",
      value: rules["profiler.comma_row_ratio_threshold"] ? `${Number(rules["profiler.comma_row_ratio_threshold"]) * 100}%` : "20%",
      unit: "tỷ lệ dòng",
      desc: "Ít nhất 20% dòng chứa dấu phẩy phân tách nhiều lựa chọn",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "multiple_choice_token_max",
      name: "Số token duy nhất tối đa (Nhiều lựa chọn)",
      value: rules["profiler.multiple_choice_token_max"] ?? 25,
      unit: "token",
      desc: "Số lượng các lựa chọn độc lập tách ra từ chuỗi không vượt quá ngưỡng này",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "text_avg_length_threshold",
      name: "Độ dài ký tự trung bình (Văn bản)",
      value: rules["profiler.text_avg_length_threshold"] ?? 30,
      unit: "ký tự",
      desc: "Chuỗi có độ dài trung bình > 30 ký tự được xếp vào kiểu Văn bản (Text)",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "disguised_numeric_threshold",
      name: "Tỷ lệ số bị ẩn trong chuỗi ký tự",
      value: rules["profiler.disguised_numeric_threshold"] ? `${Number(rules["profiler.disguised_numeric_threshold"]) * 100}%` : "60%",
      unit: "tỷ lệ dòng",
      desc: "Cột dạng chuỗi có >= 60% dữ liệu thực chất là số cần chú ý chuyển đổi",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "thousands_numeric_threshold",
      name: "Tỷ lệ số có dấu phân cách hàng nghìn",
      value: rules["profiler.thousands_numeric_threshold"] ? `${Number(rules["profiler.thousands_numeric_threshold"]) * 100}%` : "60%",
      unit: "tỷ lệ dòng",
      desc: "Nhận diện định dạng tiền tệ / hàng nghìn (ví dụ 100,000) để không nhầm sang Nhiều lựa chọn",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "null_warning_pct_threshold",
      name: "Cảnh báo tỷ lệ ô trống cao",
      value: rules["profiler.null_warning_pct_threshold"] ? `${rules["profiler.null_warning_pct_threshold"]}%` : "60%",
      unit: "tỷ lệ ô trống",
      desc: "Cột có trên 60% ô trống được gắn nhãn chú ý để cân nhắc xử lý hoặc loại bỏ",
    },
    {
      group: "profiler",
      groupLabel: "Profiler",
      key: "sample_value_limit",
      name: "Số giá trị mẫu hiển thị trong bảng",
      value: rules["profiler.sample_value_limit"] ?? 5,
      unit: "giá trị",
      desc: "Số lượng mẫu đại diện trích xuất xem nhanh cho mỗi cột",
    },
  ];

  const cleanerRules = [
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "drop_column_null_pct",
      name: "Ngưỡng xóa cột quá rỗng",
      value: rules["cleaner.drop_column_null_pct"] ? `${rules["cleaner.drop_column_null_pct"]}%` : "90.0%",
      unit: "tỷ lệ ô trống",
      desc: "Cột có tỷ lệ ô trống >= 90% sẽ tự động bị xóa trong Auto-Clean để thu gọn tập dữ liệu",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "preview_rows",
      name: "Số dòng xem trước chuẩn",
      value: rules["cleaner.preview_rows"] ?? 200,
      unit: "dòng",
      desc: "Số lượng dòng mẫu xem trước chuẩn hiển thị trong bảng dữ liệu Cleaner (200 dòng đầu)",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "near_empty_row_threshold",
      name: "Ngưỡng dòng gần như trống",
      value: rules["cleaner.near_empty_row_threshold"] ? `${Number(rules["cleaner.near_empty_row_threshold"]) * 100}%` : "80%",
      unit: "tỷ lệ cột",
      desc: "Dòng có từ 80% số cột bị rỗng được xếp vào diện dòng gần như trống",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "duplicate_warning_pct",
      name: "Ngưỡng cảnh báo dòng trùng & gần trống",
      value: rules["cleaner.duplicate_warning_pct"] ? `${rules["cleaner.duplicate_warning_pct"]}%` : "20.0%",
      unit: "tỷ lệ dòng",
      desc: "Nếu tổng số dòng trùng lặp và gần trống > 20% tổng số dòng, hệ thống hiển thị cảnh báo kiểm tra trước khi xóa",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "fill_numeric",
      name: "Quy tắc điền khuyết cột số",
      value: "Trung vị (Median)",
      unit: "thống kê",
      desc: "Điền số trung vị của các ô hợp lệ; nếu là cột số nguyên thì làm tròn nguyên và ép kiểu Int64",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "fill_categorical",
      name: "Quy tắc điền khuyết cột danh mục & nhiều lựa chọn",
      value: '"Không xác định"',
      unit: "giá trị chuẩn",
      desc: 'Điền nhãn "Không xác định" cho các ô trống trong cột phân loại để không làm mất dòng khi vẽ biểu đồ',
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "fill_datetime",
      name: "Quy tắc điền khuyết cột ngày tháng",
      value: "Giữ nguyên rỗng",
      unit: "mặc định",
      desc: "Không tự ý điền ngày giả mạo nhằm bảo toàn tính chính xác của chuỗi thời gian",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "fill_text",
      name: "Quy tắc xử lý cột văn bản",
      value: "Bỏ qua (Skip)",
      unit: "mặc định",
      desc: "Văn bản tự do không bị ép kiểu hay điền khuyết tự động",
    },
    {
      group: "cleaner",
      groupLabel: "Cleaner",
      key: "file_retention_ttl",
      name: "Thời hạn lưu trữ file nhị phân trong RAM",
      value: rules["session.file_bytes_ttl_hours"] ? `${rules["session.file_bytes_ttl_hours"]} giờ` : "5 giờ",
      unit: "thời gian",
      desc: "Dữ liệu file tải lên được lưu trong bộ nhớ tạm Redis tối đa 5 giờ (18.000 giây) trước khi tự động hủy",
    },
  ];

  const allRules = [...profilerRules, ...cleanerRules];

  const rulesToFilter =
    activeGroup === "profiler"
      ? profilerRules
      : activeGroup === "cleaner"
      ? cleanerRules
      : allRules;

  const filteredRules = rulesToFilter.filter(
    (r) =>
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.desc.toLowerCase().includes(filter.toLowerCase()) ||
      r.key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="my-6 border border-border rounded-xl bg-canvas overflow-hidden max-w-full">
      {/* Header Bar */}
      <div className="p-3 bg-sage/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-forest shrink-0" />
          <span className="text-xs font-bold text-ink uppercase tracking-wider">
            Bảng quy tắc & ngưỡng hệ thống
          </span>
        </div>

        {/* Group tabs and search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveGroup("all")}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                activeGroup === "all" ? "bg-forest text-white" : "text-muted hover:text-ink"
              }`}
            >
              Tất cả ({allRules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroup("profiler")}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                activeGroup === "profiler" ? "bg-forest text-white" : "text-muted hover:text-ink"
              }`}
            >
              Profiler ({profilerRules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroup("cleaner")}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                activeGroup === "cleaner" ? "bg-forest text-white" : "text-muted hover:text-ink"
              }`}
            >
              Cleaner ({cleanerRules.length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Tìm quy tắc..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-white border border-border rounded-lg text-ink placeholder:text-muted/60 focus:outline-none focus:border-forest w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse bg-white">
          <thead className="bg-[#FAF9F5] text-ink font-semibold border-b border-border">
            <tr>
              <th className="py-2.5 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider w-24">
                Phân hệ
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Tên quy tắc / Ngưỡng
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider w-28">
                Giá trị
              </th>
              <th className="py-2.5 px-3 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Ý nghĩa & Cách áp dụng
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.length > 0 ? (
              filteredRules.map((r) => (
                <tr key={`${r.group}-${r.key}`} className="border-b border-border/40 hover:bg-sage/10 transition-colors">
                  <td className="py-2 px-3 text-[11px]">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        r.group === "profiler"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {r.groupLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-semibold text-ink">{r.name}</div>
                    <code className="text-[10px] text-muted font-mono">{r.key}</code>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="font-mono font-bold text-forest bg-sage/40 px-1.5 py-0.5 rounded text-[11px] border border-border/60">
                      {String(r.value)}
                    </span>
                    {r.unit && <span className="text-[10px] text-muted ml-1">({r.unit})</span>}
                  </td>
                  <td className="py-2 px-3 text-muted leading-relaxed text-[11.5px]">{r.desc}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted text-xs">
                  Không tìm thấy quy tắc nào khớp với từ khóa "{filter}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
