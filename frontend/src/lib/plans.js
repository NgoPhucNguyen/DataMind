/**
 * plans.js — Nguồn dữ liệu duy nhất cho thông tin gói dịch vụ.
 * Chỉ sửa ở đây khi cần thay đổi giá hoặc tính năng gói.
 *
 * Định mức:
 *   - Free: 2 lượt AI/ngày, reset 00:00 UTC+7
 *   - Pro : 20 lượt AI/ngày, hạn 30 ngày, giá 50.000đ, reset 00:00 UTC+7
 */

export const PRO_PRICE = 50000; // VNĐ
export const PRO_DURATION_DAYS = 30; // Ngày
export const FREE_AI_RUNS = 2;
export const PRO_AI_RUNS = 20;

/** Format số tiền theo locale (VND) */
export function formatPrice(amount, lang = "vi") {
  if (amount === 0) {
    return lang?.startsWith("en") ? "0 VND" : "0đ";
  }
  if (lang?.startsWith("en")) {
    return `${amount.toLocaleString("en-US")} VND`;
  }
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/** Format số thành chuỗi VNĐ, ví dụ 50000 → "50.000đ" */
export function formatVND(amount) {
  return amount.toLocaleString("vi-VN") + "đ";
}

/**
 * Trả về thông tin gói dịch vụ đã được dịch theo i18n
 */
export function getLocalizedPlans(t, lang = "vi") {
  const isEn = lang?.startsWith("en");
  return {
    free: {
      id: "free",
      name: t("pricing.free_name", "Free"),
      price: 0,
      priceLabel: t("pricing.free_price_label", "Miễn phí"),
      subtitle: t("pricing.free_subtitle", "Trải nghiệm cơ bản"),
      aiRuns: FREE_AI_RUNS,
      periodLabel: t("pricing.free_period_label", isEn ? "day (resets 00:00)" : "ngày (reset 00:00)"),
      resetNote: t("pricing.reset_note", "Reset 00:00 hàng ngày (giờ Việt Nam)"),
      features: [
        t("pricing.free_feat_ai", "{{count}} lượt AI Insights mỗi ngày", { count: FREE_AI_RUNS }),
        t("pricing.free_feat_reset", "Reset 00:00 hàng ngày (giờ VN)"),
        t("pricing.free_feat_profiling", "Phân tích dữ liệu không giới hạn"),
        t("pricing.free_feat_clean", "Làm sạch dữ liệu thủ công"),
        t("pricing.free_feat_viz", "Trực quan hóa & xuất biểu đồ"),
        t("pricing.free_feat_logo", "Báo cáo có logo DataMind trên trang bìa và chân trang"),
      ],
    },
    pro: {
      id: "pro",
      name: t("pricing.pro_name", "Pro"),
      price: PRO_PRICE,
      priceLabel: formatPrice(PRO_PRICE, lang),
      subtitle: t("pricing.pro_subtitle", "Dành cho phân tích chuyên sâu"),
      aiRuns: PRO_AI_RUNS,
      durationDays: PRO_DURATION_DAYS,
      periodLabel: t("pricing.pro_period_label", "{{days}} ngày", { days: PRO_DURATION_DAYS }),
      resetNote: t("pricing.reset_note", "Reset 00:00 hàng ngày (giờ Việt Nam)"),
      features: [
        t("pricing.pro_feat_ai", "{{count}} lượt AI Insights mỗi ngày", { count: PRO_AI_RUNS }),
        t("pricing.pro_feat_duration", "Hạn dùng {{days}} ngày", { days: PRO_DURATION_DAYS }),
        t("pricing.pro_feat_reset", "Reset 00:00 hàng ngày (giờ VN)"),
        t("pricing.pro_feat_all_free", "Tất cả tính năng của gói Free"),
        t("pricing.pro_feat_auto_clean", "Làm sạch dữ liệu tự động bằng AI"),
        t("pricing.pro_feat_no_logo", "Xuất báo cáo chuyên nghiệp không có logo"),
        t("pricing.pro_feat_support", "Ưu tiên hỗ trợ kỹ thuật"),
      ],
    },
  };
}

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "Miễn phí",
    subtitle: "Trải nghiệm cơ bản",
    aiRuns: FREE_AI_RUNS,
    periodLabel: "mỗi ngày",
    resetNote: "Reset 00:00 hàng ngày (giờ Việt Nam)",
    features: [
      "2 lượt AI Insights mỗi ngày",
      "Reset 00:00 hàng ngày (giờ VN)",
      "Phân tích dữ liệu không giới hạn",
      "Làm sạch dữ liệu thủ công",
      "Trực quan hóa & xuất biểu đồ",
      "Báo cáo có logo DataMind trên trang bìa và chân trang",
    ],
  },
  pro: {
    name: "Pro",
    price: PRO_PRICE,
    priceLabel: formatVND(PRO_PRICE),
    subtitle: "Dành cho phân tích chuyên sâu",
    aiRuns: PRO_AI_RUNS,
    durationDays: PRO_DURATION_DAYS,
    periodLabel: `${PRO_DURATION_DAYS} ngày`,
    resetNote: "Reset 00:00 hàng ngày (giờ Việt Nam)",
    features: [
      "20 lượt AI Insights mỗi ngày",
      `Hạn dùng ${PRO_DURATION_DAYS} ngày`,
      "Reset 00:00 hàng ngày (giờ VN)",
      "Tất cả tính năng của gói Free",
      "Làm sạch dữ liệu tự động bằng AI",
      "Xuất báo cáo chuyên nghiệp không có logo",
      "Ưu tiên hỗ trợ kỹ thuật",
    ],
  },
};
