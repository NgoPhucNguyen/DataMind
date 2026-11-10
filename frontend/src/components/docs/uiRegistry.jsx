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
  PenTool,
  Edit3,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Filter,
  Save,
  CheckCircle2,
  CheckCircle,
  MoreVertical,
  Check,
  Ban,
  EyeOff,
  Settings,
  Palette,
  Info,
  FileDown,
  FileType2,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
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

  // Cleaner Buttons, Chips & Legend Elements
  "cleaner.auto": {
    kind: "button",
    variant: "forest",
    icon: Zap,
    labelKey: "cleaner.btn_auto_clean",
    fallback: "Tự động sửa",
  },
  "cleaner.manual": {
    kind: "button",
    variant: "secondary",
    icon: PenTool,
    labelKey: "cleaner.btn_manual_clean",
    fallback: "Sửa thủ công",
  },
  "cleaner.skip": {
    kind: "button",
    variant: "secondary",
    icon: SkipForward,
    labelKey: "cleaner.btn_skip_cleaning",
    fallback: "Dữ liệu đã sạch, bỏ qua",
  },
  "cleaner.prev_error": {
    kind: "button",
    variant: "secondary",
    icon: ChevronLeft,
    labelKey: "cleaner.bar_btn_prev_error",
    fallback: "◀ Lỗi trước",
  },
  "cleaner.next_error": {
    kind: "button",
    variant: "secondary",
    icon: ChevronRight,
    labelKey: "cleaner.bar_btn_next_error",
    fallback: "Lỗi sau ▶",
  },
  "cleaner.filter_cols": {
    kind: "button",
    variant: "secondary",
    icon: Filter,
    labelKey: "cleaner.filter_only_error_cols",
    fallback: "Chỉ cột có lỗi",
  },
  "cleaner.filter_rows": {
    kind: "button",
    variant: "secondary",
    icon: Filter,
    labelKey: "cleaner.filter_only_error_rows",
    fallback: "Chỉ dòng có lỗi",
  },
  "cleaner.issue_chip": {
    kind: "chip",
    variant: "warning",
    icon: AlertTriangle,
    fallback: "Cột · số lỗi",
  },
  "cleaner.full_edit": {
    kind: "button",
    variant: "secondary",
    icon: Edit3,
    labelKey: "cleaner.workspace.full_edit_mode",
    fallback: "Chế độ Full-Edit (Sửa mọi ô)",
  },
  "cleaner.save": {
    kind: "button",
    variant: "primary",
    icon: Save,
    labelKey: "cleaner.workspace.save_changes",
    fallback: "Lưu thay đổi",
  },
  "cleaner.finalize": {
    kind: "button",
    variant: "forest",
    icon: CheckCircle2,
    labelKey: "cleaner.bar_btn_finalize",
    fallback: "Hoàn tất",
  },
  "cleaner.use_this": {
    kind: "button",
    variant: "forest",
    icon: CheckCircle,
    labelKey: "cleaner.btn_confirm_use_this",
    fallback: "Xác nhận dùng bản này",
  },
  "cleaner.edit_more": {
    kind: "button",
    variant: "secondary",
    icon: Edit3,
    labelKey: "cleaner.btn_manual_clean_more",
    fallback: "Sửa thủ công tiếp",
  },
  "cleaner.to_visualize": {
    kind: "button",
    variant: "forest",
    icon: ArrowRight,
    labelKey: "cleaner.btn_visualize",
    fallback: "Trực quan hóa dữ liệu",
  },
  "cleaner.header_menu": {
    kind: "icon-button",
    variant: "secondary",
    icon: MoreVertical,
    fallback: "Menu cột (⋮)",
  },
  "cleaner.cell_apply_suggestion": {
    kind: "button",
    variant: "forest",
    icon: Check,
    labelKey: "cleaner.guided.btn_apply_suggestion",
    fallback: "Áp dụng gợi ý",
  },
  "cleaner.cell_edit": {
    kind: "button",
    variant: "secondary",
    icon: Edit3,
    labelKey: "cleaner.guided.btn_edit_value",
    fallback: "Sửa giá trị",
  },
  "cleaner.cell_set_empty": {
    kind: "button",
    variant: "secondary",
    icon: Ban,
    labelKey: "cleaner.guided.btn_set_null",
    fallback: "Đặt thành rỗng (null)",
  },
  "cleaner.cell_ignore": {
    kind: "button",
    variant: "secondary",
    icon: EyeOff,
    labelKey: "cleaner.guided.btn_ignore",
    fallback: "Bỏ qua",
  },
  "legend.pending": {
    kind: "badge",
    variant: "warning",
    labelKey: "cleaner.guided.legend_pending",
    fallback: "Ô lỗi chờ xử lý",
  },
  "legend.fixed": {
    kind: "badge",
    variant: "forest",
    labelKey: "cleaner.guided.legend_fixed",
    fallback: "Đã sửa",
  },
  "legend.ignored": {
    kind: "badge",
    variant: "secondary",
    labelKey: "cleaner.guided.legend_ignored",
    fallback: "Đã bỏ qua",
  },
  "legend.changed": {
    kind: "badge",
    variant: "forest",
    fallback: "Ô đã đổi giá trị",
  },

  // Visualize Buttons, Tabs, Chips & Badges
  "visualize.settings": {
    kind: "icon-button",
    icon: Settings,
    labelKey: "visualize.settings_title",
    fallback: "Tùy chỉnh biểu đồ",
  },
  "visualize.add_to_report": {
    kind: "button",
    variant: "secondary",
    labelKey: "visualize.btn_add_to_report",
    fallback: "Thêm vào báo cáo",
  },
  "visualize.added_to_report": {
    kind: "button",
    variant: "forest",
    icon: Check,
    labelKey: "visualize.btn_added_to_report",
    fallback: "Đã thêm vào báo cáo",
  },
  "visualize.badge_suggested": {
    kind: "badge",
    variant: "forest",
    icon: Sparkles,
    labelKey: "visualize.badge_suggested",
    fallback: "Gợi ý",
  },
  "visualize.palette": {
    kind: "button",
    variant: "secondary",
    icon: Palette,
    labelKey: "visualize.palette_label",
    fallback: "Bảng màu",
  },
  "visualize.ai_explain": {
    kind: "button",
    variant: "forest",
    icon: Sparkles,
    labelKey: "visualize.ai_btn_explain",
    fallback: "AI giải thích · 1 lượt",
  },
  "visualize.what_is_r": {
    kind: "chip",
    icon: Info,
    labelKey: "visualize.corr_what_is_r_title",
    fallback: "ⓘ r là gì?",
  },
  "visualize.threshold_03": {
    kind: "chip",
    fallback: "0,3 (Yếu)",
  },
  "visualize.threshold_05": {
    kind: "chip",
    fallback: "0,5 (Vừa)",
  },
  "visualize.threshold_07": {
    kind: "chip",
    fallback: "0,7 (Mạnh)",
  },
  "visualize.confirm_proceed": {
    kind: "button",
    variant: "forest",
    iconRight: ArrowRight,
    labelKey: "visualize.btn_confirm_proceed",
    fallback: "Tiếp tục: Tạo báo cáo →",
  },
  "visualize.tab_distribution": {
    kind: "button",
    variant: "secondary",
    fallback: "Phân phối",
  },
  "visualize.tab_correlation": {
    kind: "button",
    variant: "secondary",
    fallback: "Tương quan",
  },
  "visualize.tab_time": {
    kind: "button",
    variant: "secondary",
    fallback: "Theo thời gian",
  },
  "visualize.skipped_panel": {
    kind: "button",
    variant: "secondary",
    fallback: "Các cột không có biểu đồ",
  },
  // Report UI elements
  "report.export_pdf": {
    kind: "button",
    variant: "secondary",
    icon: FileDown,
    labelKey: "report.export_pdf",
    fallback: "Xuất PDF",
  },
  "report.export_docx": {
    kind: "button",
    variant: "secondary",
    icon: FileType2,
    labelKey: "report.export_docx",
    fallback: "Xuất Word (.docx)",
  },
  "report.ai_write": {
    kind: "button",
    variant: "forest",
    icon: Sparkles,
    labelKey: "report.overview_btn_generate",
    fallback: "Viết tổng quan bằng AI · 1 lượt",
  },
  "report.ai_regenerate": {
    kind: "button",
    variant: "forest",
    icon: RotateCw,
    labelKey: "report.overview_btn_regenerate",
    fallback: "Tạo lại · 1 lượt",
  },
  "report.edit_btn": {
    kind: "button",
    variant: "secondary",
    icon: Edit3,
    labelKey: "report.overview_edit_btn",
    fallback: "Chỉnh sửa",
  },
  "report.restore_auto": {
    kind: "button",
    variant: "secondary",
    icon: RotateCcw,
    labelKey: "report.methodology_restore_auto",
    fallback: "Khôi phục bản tự động",
  },
  "report.move_up": {
    kind: "icon-button",
    icon: ArrowUp,
    fallback: "Di chuyển lên",
  },
  "report.move_down": {
    kind: "icon-button",
    icon: ArrowDown,
    fallback: "Di chuyển xuống",
  },
  "report.remove_chart": {
    kind: "icon-button",
    icon: Trash2,
    fallback: "Xóa biểu đồ",
  },
  "report.badge_ai": {
    kind: "badge",
    fallback: "AI",
  },
  "report.badge_edited": {
    kind: "badge",
    fallback: "Đã chỉnh sửa",
  },
  "report.badge_charts_changed": {
    kind: "chip",
    icon: AlertTriangle,
    fallback: "Biểu đồ đã thay đổi",
  },
  "report.badge_cleaning_stale": {
    kind: "chip",
    icon: AlertTriangle,
    fallback: "Dữ liệu đã làm sạch lại",
  },
  "report.badge_saved": {
    kind: "badge",
    fallback: "Đã lưu",
  },
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

