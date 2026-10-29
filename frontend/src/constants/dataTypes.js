import {
  Hash,
  CalendarDays,
  Tags,
  ListChecks,
  Type,
  BarChart3,
  PieChart,
  LineChart,
  BarChart2,
} from "lucide-react";

/**
 * SSOT for Column Data Types across Profiler, Cleaner, Visualize, and Docs
 */
export const COLUMN_TYPES = [
  "numeric",
  "datetime",
  "categorical",
  "multiple_choice",
  "text",
];

export const TYPE_CONFIG = {
  numeric: {
    icon: Hash,
    i18nKey: "profiler.type_numeric",
    defaultCharts: ["bar", "line", "histogram"],
  },
  datetime: {
    icon: CalendarDays,
    i18nKey: "profiler.type_datetime",
    defaultCharts: ["line"],
  },
  categorical: {
    icon: Tags,
    i18nKey: "profiler.type_categorical",
    defaultCharts: ["pie", "bar"],
  },
  multiple_choice: {
    icon: ListChecks,
    i18nKey: "profiler.type_multiple_choice",
    defaultCharts: ["bar", "pie"],
  },
  text: {
    icon: Type,
    i18nKey: "profiler.type_text",
    defaultCharts: [],
  },
};

export const CHART_CONFIG = {
  bar: {
    icon: BarChart3,
    i18nKey: "profiler.chart_bar",
  },
  pie: {
    icon: PieChart,
    i18nKey: "profiler.chart_pie",
  },
  line: {
    icon: LineChart,
    i18nKey: "profiler.chart_line",
  },
  histogram: {
    icon: BarChart2,
    i18nKey: "profiler.chart_histogram",
  },
};

/**
 * Returns suggested charts following backend rules for effective type
 */
export function getSuggestedChartsForType(effectiveType, originalCol) {
  if (originalCol?.skip_chart || originalCol?.unique_count <= 1) {
    return [];
  }
  const cfg = TYPE_CONFIG[effectiveType];
  return cfg ? cfg.defaultCharts : [];
}

/**
 * Canonical domain translation key resolver with backward-compatibility
 */
export const VALID_DOMAIN_CODES = [
  "Marketing",
  "HR",
  "Finance",
  "Education",
  "Healthcare",
  "E-commerce",
  "Logistics",
  "Other",
];

export function getDomainI18nKey(rawDomain) {
  if (!rawDomain || rawDomain === "Chưa phân tích" || rawDomain === "Unanalyzed") {
    return "profiler.domain_not_analyzed";
  }
  const clean = String(rawDomain).trim();
  const lower = clean.toLowerCase();
  
  if (lower === "marketing") return "profiler.domain_marketing";
  if (lower === "hr" || lower === "nhân sự") return "profiler.domain_hr";
  if (lower === "finance" || lower === "tài chính") return "profiler.domain_finance";
  if (lower === "education" || lower === "giáo dục") return "profiler.domain_education";
  if (lower === "healthcare" || lower === "y tế") return "profiler.domain_healthcare";
  if (lower === "e-commerce" || lower === "ecommerce" || lower === "thương mại điện tử") return "profiler.domain_ecommerce";
  if (lower === "logistics" || lower === "vận tải") return "profiler.domain_logistics";
  
  return "profiler.domain_other";
}

