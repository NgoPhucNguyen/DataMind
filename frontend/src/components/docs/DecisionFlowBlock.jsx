import React, { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Layers, CheckCircle2 } from "lucide-react";
import { TypeBadge } from "../Profiler/Badges";

export default function DecisionFlowBlock({ rules = {} }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const steps = [
    {
      title: "1. Kiểm tra Kiểu Dữ Liệu Số (Native Numeric)",
      badge: "numeric",
      summary: "Kiểm tra xem cột có phải là kiểu số gốc (int64, float64) và không phải kiểu boolean hay không.",
      condition: "is_numeric_dtype(series) && !is_bool_dtype(series)",
      passType: "numeric",
    },
    {
      title: "2. Kiểm tra Kiểu Ngày Tháng (Native Datetime)",
      badge: "datetime",
      summary: "Cột đã được lưu trữ ở định dạng datetime gốc hoặc timestamp.",
      condition: "is_datetime64_any_dtype(series)",
      passType: "datetime",
    },
    {
      title: "3. Kiểm tra Kiểu Boolean (Native Bool hoặc Chuỗi Boolean)",
      badge: "categorical",
      summary: "Các giá trị chỉ gồm True/False, chuỗi 'true'/'false', hoặc 'có'/'không'.",
      condition: "is_bool_dtype(series) || all_values_in({'true', 'false', 'có', 'không'})",
      passType: "categorical",
    },
    {
      title: "4. Parse Thử Chuỗi Ngày Tháng (Datetime Parse)",
      badge: "datetime",
      summary: `Mẫu tối đa ${rules["profiler.datetime_sample_limit"] ?? 100} dòng đầu tiên có ít nhất ${rules["profiler.datetime_parse_threshold"] ? `${Number(rules["profiler.datetime_parse_threshold"]) * 100}%` : "80%"} số dòng parse thành công dạng ngày.`,
      condition: `parse_success_ratio >= ${rules["profiler.datetime_parse_threshold"] ? `${Number(rules["profiler.datetime_parse_threshold"]) * 100}%` : "80%"} (mẫu ${rules["profiler.datetime_sample_limit"] ?? 100} dòng)`,
      passType: "datetime",
    },
    {
      title: "5. Kiểm tra Số Có Phân Cách Hàng Nghìn (Thousands Separator)",
      badge: null,
      summary: `Nếu >= ${rules["profiler.thousands_numeric_threshold"] ? `${Number(rules["profiler.thousands_numeric_threshold"]) * 100}%` : "60%"} dòng chứa số có dấu phẩy phân cách hàng nghìn (ví dụ 100,000 VND), bỏ qua kiểm tra Multiple Choice để tránh nhận diện nhầm.`,
      condition: `thousands_ratio >= ${rules["profiler.thousands_numeric_threshold"] ? `${Number(rules["profiler.thousands_numeric_threshold"]) * 100}%` : "60%"} -> Bỏ qua Multiple Choice`,
      passType: null,
    },
    {
      title: "6. Kiểm tra Nhiều Lựa Chọn (Multiple Choice)",
      badge: "multiple_choice",
      summary: `Cột dạng chuỗi có >= ${rules["profiler.comma_row_ratio_threshold"] ? `${Number(rules["profiler.comma_row_ratio_threshold"]) * 100}%` : "20%"} số dòng chứa dấu phẩy và tổng số tag duy nhất sau khi tách <= ${rules["profiler.multiple_choice_token_max"] ?? 25}.`,
      condition: `comma_row_ratio >= ${rules["profiler.comma_row_ratio_threshold"] ? `${Number(rules["profiler.comma_row_ratio_threshold"]) * 100}%` : "20%"} && unique_tokens <= ${rules["profiler.multiple_choice_token_max"] ?? 25}`,
      passType: "multiple_choice",
    },
    {
      title: "7. Kiểm tra Danh Mục Ít Nhóm (Categorical)",
      badge: "categorical",
      summary: `Số lượng giá trị duy nhất <= ${rules["profiler.categorical_unique_threshold"] ?? 15} và có ít nhất 1 giá trị lặp lại giữa các dòng.`,
      condition: `unique_count <= ${rules["profiler.categorical_unique_threshold"] ?? 15} && unique_count < non_null_count`,
      passType: "categorical",
    },
    {
      title: "8. Kiểm tra Văn Bản Tự Do (Text)",
      badge: "text",
      summary: `Chuỗi văn bản có độ dài trung bình > ${rules["profiler.text_avg_length_threshold"] ?? 30} ký tự.`,
      condition: `avg_length > ${rules["profiler.text_avg_length_threshold"] ?? 30} ký tự`,
      passType: "text",
    },
    {
      title: "9. Mặc Định Còn Lại (Fallback)",
      badge: "text",
      summary: "Nếu không thỏa mãn các bước trên, xếp vào dạng Văn bản (Text).",
      condition: "Không khớp các điều kiện trên",
      passType: "text",
    },
  ];

  return (
    <div className="my-6 border border-border rounded-xl bg-canvas overflow-hidden max-w-full">
      <div className="p-3 bg-sage/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-forest shrink-0" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Cây quyết định phân loại tự động
          </span>
        </div>
        <span className="text-xs text-muted">9 bước kiểm tra logic</span>
      </div>

      <div className="divide-y divide-border/60">
        {steps.map((step, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div key={idx} className="p-3 hover:bg-sage/10 transition-colors">
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between text-left gap-2 focus:outline-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-ink truncate">{step.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {step.badge && <TypeBadge type={step.badge} />}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2.5 pt-2 border-t border-border/40 text-xs space-y-2 animate-fade-in-up">
                  <p className="text-muted leading-relaxed break-words">{step.summary}</p>
                  <div className="p-2 rounded bg-sage/40 font-mono text-[11.5px] text-forest border border-border/50 max-w-full break-all">
                    <strong>Điều kiện:</strong> {step.condition}
                  </div>
                  {step.passType && (
                    <div className="flex items-center gap-1.5 text-emerald-800 text-[11.5px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Nếu thỏa mãn: Kết luận kiểu <strong>{step.passType}</strong> và dừng kiểm tra.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
