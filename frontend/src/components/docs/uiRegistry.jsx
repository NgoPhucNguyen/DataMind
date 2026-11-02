import React from "react";
import {
  FileSpreadsheet,
  MoreHorizontal,
  RotateCw,
  Download,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Zap,
  AlertTriangle,
  ChevronDown,
  BarChart2,
  TrendingUp,
  PieChart,
  BarChart3,
  Undo2,
} from "lucide-react";
import { TypeBadge } from "../Profiler/Badges";

/**
 * UI Element Registry for docs interactive UI chips.
 * Maps chip ID -> spec:
 *  - kind: 'button' | 'icon-button' | 'badge' | 'chip' | 'menu-item' | 'type-badge' | 'chart-pill' | 'custom'
 *  - variant: 'primary' | 'secondary' | 'urgent' | 'warning' | 'forest'
 *  - icon: Lucide component
 *  - labelKey: translation key in vi.json (or fallback string)
 */
export const UI_REGISTRY = {
  // Profiler Buttons & Actions
  "profiler.upload_new": {
    kind: "button",
    variant: "secondary",
    icon: FileSpreadsheet,
    labelKey: "profiler.btn_upload_new",
    fallback: "Tải file khác",
  },
  "profiler.more": {
    kind: "icon-button",
    variant: "secondary",
    icon: MoreHorizontal,
    labelKey: "profiler.action_menu_more",
    fallback: "Tùy chọn khác",
  },
  "profiler.reread": {
    kind: "menu-item",
    icon: RotateCw,
    iconColor: "text-forest",
    labelKey: "profiler.btn_reanalyze_file_free",
    fallback: "Đọc lại file (miễn phí)",
  },
  "profiler.download_report": {
    kind: "menu-item",
    icon: Download,
    labelKey: "profiler.col_download_report",
    fallback: "Tải báo cáo JSON",
  },
  "profiler.continue": {
    kind: "button",
    variant: "primary",
    iconRight: ArrowRight,
    labelKey: "profiler.btn_save_clean",
    fallback: "Lưu & Làm sạch",
  },
  "profiler.help": {
    kind: "button",
    variant: "secondary",
    icon: HelpCircle,
    labelKey: "common.help_btn",
    fallback: "Hướng dẫn",
  },
  "profiler.ai_analyze": {
    kind: "button",
    variant: "forest",
    icon: Sparkles,
    labelKey: "profiler.ai_analyze_btn",
    fallback: "Phân tích AI",
  },
  "profiler.ai_reanalyze": {
    kind: "button",
    variant: "forest",
    icon: Sparkles,
    labelKey: "profiler.reanalyze_btn",
    fallback: "Phân tích lại theo chỉnh sửa của tôi",
  },
  "profiler.attention_chip": {
    kind: "chip",
    variant: "warning",
    icon: AlertTriangle,
    fallback: "cột cần xem",
  },
  "profiler.cached_badge": {
    kind: "badge",
    variant: "forest",
    icon: Zap,
    labelKey: "profiler.badge_cached",
    fallback: "Đã lưu đệm",
  },
  "profiler.type_dropdown": {
    kind: "dropdown",
    fallback: "Ghi đè kiểu",
  },
  "profiler.changed_from": {
    kind: "changed",
    fallback: "Đã đổi từ",
  },

  // Types
  "type.numeric": { kind: "type-badge", type: "numeric" },
  "type.datetime": { kind: "type-badge", type: "datetime" },
  "type.categorical": { kind: "type-badge", type: "categorical" },
  "type.multiple_choice": { kind: "type-badge", type: "multiple_choice" },
  "type.text": { kind: "type-badge", type: "text" },

  // Charts
  "chart.bar": { kind: "chart-pill", icon: BarChart2, labelKey: "profiler.chart_bar", fallback: "Cột" },
  "chart.line": { kind: "chart-pill", icon: TrendingUp, labelKey: "profiler.chart_line", fallback: "Đường" },
  "chart.pie": { kind: "chart-pill", icon: PieChart, labelKey: "profiler.chart_pie", fallback: "Tròn" },
  "chart.histogram": { kind: "chart-pill", icon: BarChart3, labelKey: "profiler.chart_histogram", fallback: "Phân phối" },
};

/**
 * Render non-interactive decorative UI replica chip
 */
export function UIChip({ id, t = (k, o) => o?.defaultValue || k }) {
  const spec = UI_REGISTRY[id];

  if (!spec) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[UIChip] Unknown ui id: "${id}"`);
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-neutral-700 border border-neutral-300">
        ui:{id}
      </span>
    );
  }

  // TypeBadge delegation
  if (spec.kind === "type-badge") {
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Kiểu dữ liệu"
        className="inline-flex align-middle cursor-default select-none mx-1 my-0.5 scale-95 origin-center"
      >
        <TypeBadge type={spec.type} />
      </span>
    );
  }

  // Chart pill
  if (spec.kind === "chart-pill") {
    const Icon = spec.icon;
    const label = spec.labelKey ? t(spec.labelKey, { defaultValue: spec.fallback }) : spec.fallback;
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Gợi ý biểu đồ"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB] cursor-default select-none mx-0.5 align-middle shadow-2xs"
      >
        {Icon && <Icon className="w-3 h-3 text-[#1B4324] shrink-0" />}
        <span>{label}</span>
      </span>
    );
  }

  // Icon Button (e.g. More ⋯)
  if (spec.kind === "icon-button") {
    const Icon = spec.icon;
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Nút tùy chọn"
        className="inline-flex items-center justify-center p-1 rounded-md bg-white border border-[#E5E5E3] text-muted shadow-2xs cursor-default select-none mx-0.5 align-middle"
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
    );
  }

  // Dropdown replica
  if (spec.kind === "dropdown") {
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Menu chọn kiểu"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white border border-[#D1D5DB] text-ink shadow-2xs cursor-default select-none mx-0.5 align-middle"
      >
        <span>{spec.fallback}</span>
        <ChevronDown className="w-3 h-3 text-muted shrink-0" />
      </span>
    );
  }

  // Changed indicator replica
  if (spec.kind === "changed") {
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Trạng thái đổi kiểu"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200 cursor-default select-none mx-0.5 align-middle"
      >
        <span>{spec.fallback}</span>
        <Undo2 className="w-2.5 h-2.5 text-amber-700" />
      </span>
    );
  }

  // Menu item replica
  if (spec.kind === "menu-item") {
    const Icon = spec.icon;
    const label = spec.labelKey ? t(spec.labelKey, { defaultValue: spec.fallback }) : spec.fallback;
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Tùy chọn menu"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white border border-border text-ink shadow-2xs cursor-default select-none mx-0.5 align-middle"
      >
        {Icon && <Icon className={`w-3.5 h-3.5 ${spec.iconColor || "text-muted"} shrink-0`} />}
        <span>{label}</span>
      </span>
    );
  }

  // Chip (e.g. attention chip)
  if (spec.kind === "chip") {
    const Icon = spec.icon;
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Cảnh báo cần xem"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300 cursor-default select-none mx-0.5 align-middle shadow-2xs"
      >
        {Icon && <Icon className="w-3 h-3 text-amber-700 shrink-0" />}
        <span>{spec.fallback}</span>
      </span>
    );
  }

  // Badge (e.g. cached badge)
  if (spec.kind === "badge") {
    const Icon = spec.icon;
    const label = spec.labelKey ? t(spec.labelKey, { defaultValue: spec.fallback }) : spec.fallback;
    return (
      <span
        aria-hidden="true"
        title="Minh họa giao diện: Huy hiệu"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB] cursor-default select-none mx-0.5 align-middle shadow-2xs"
      >
        {Icon && <Icon className="w-3 h-3 text-forest shrink-0" />}
        <span>{label}</span>
      </span>
    );
  }

  // General Button replica
  const IconLeft = spec.icon;
  const IconRight = spec.iconRight;
  const label = spec.labelKey ? t(spec.labelKey, { defaultValue: spec.fallback }) : spec.fallback;

  let btnClasses = "bg-white text-ink border-border hover:bg-white";
  if (spec.variant === "primary") {
    btnClasses = "bg-ink text-white border-transparent";
  } else if (spec.variant === "forest") {
    btnClasses = "bg-[#1B4324] text-white border-transparent";
  }

  return (
    <span
      aria-hidden="true"
      title="Minh họa giao diện"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-2xs cursor-default select-none mx-0.5 align-middle leading-none ${btnClasses}`}
    >
      {IconLeft && <IconLeft className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
      {IconRight && <IconRight className="w-3.5 h-3.5 shrink-0" />}
    </span>
  );
}

