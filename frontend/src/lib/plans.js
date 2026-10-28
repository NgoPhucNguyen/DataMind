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

/** Format số thành chuỗi VNĐ, ví dụ 50000 → "50.000đ" */
export function formatVND(amount) {
  return amount.toLocaleString("vi-VN") + "đ";
}

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "Miễn phí",
    subtitle: "Trải nghiệm cơ bản",
    aiRuns: 2,
    periodLabel: "mỗi ngày",
    resetNote: "Reset 00:00 hàng ngày (giờ Việt Nam)",
    features: [
      "2 lượt AI Insights mỗi ngày",
      "Reset 00:00 hàng ngày (giờ VN)",
      "Phân tích dữ liệu không giới hạn",
      "Làm sạch dữ liệu thủ công",
      "Trực quan hóa & xuất biểu đồ",
    ],
  },
  pro: {
    name: "Pro",
    price: PRO_PRICE,
    priceLabel: formatVND(PRO_PRICE),
    subtitle: "Dành cho phân tích chuyên sâu",
    aiRuns: 20,
    durationDays: PRO_DURATION_DAYS,
    periodLabel: `${PRO_DURATION_DAYS} ngày`,
    resetNote: "Reset 00:00 hàng ngày (giờ Việt Nam)",
    features: [
      "20 lượt AI Insights mỗi ngày",
      `Hạn dùng ${PRO_DURATION_DAYS} ngày`,
      "Reset 00:00 hàng ngày (giờ VN)",
      "Tất cả tính năng của gói Free",
      "Làm sạch dữ liệu tự động bằng AI",
      "Tạo & xuất báo cáo chi tiết",
      "Ưu tiên hỗ trợ kỹ thuật",
    ],
  },
};
