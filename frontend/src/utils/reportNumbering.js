/**
 * reportNumbering.js
 * -------------------
 * Pure helpers for figure and table numbering across Report (screen, print, exports).
 */

/**
 * Returns figure prefix string, e.g. "Hình 1. " or "Figure 1. ".
 */
export function getFigurePrefix(n, lang = "vi") {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  return isEn ? `Figure ${n}. ` : `Hình ${n}. `;
}

/**
 * Returns formatted figure title with prefix, e.g. "Hình 1. Phân phối doanh thu".
 */
export function formatFigureTitle(n, title = "", lang = "vi") {
  const prefix = getFigurePrefix(n, lang);
  return `${prefix}${title || ""}`;
}

/**
 * Returns table prefix string, e.g. "Bảng 1. " or "Table 1. ".
 */
export function getTablePrefix(m, lang = "vi") {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  return isEn ? `Table ${m}. ` : `Bảng ${m}. `;
}

/**
 * Returns formatted table caption, e.g. "Bảng 1. <caption text>".
 */
export function formatTableCaption(m, caption = "", lang = "vi") {
  const prefix = getTablePrefix(m, lang);
  return `${prefix}${caption || ""}`;
}

/**
 * Returns default caption for correlation pairs table, e.g.
 * vi: "Bảng 1. Các cặp cột liên quan mạnh nhất"
 * en: "Table 1. Strongest related column pairs"
 */
export function getCorrTableCaption(m = 1, lang = "vi") {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  return isEn
    ? `Table ${m}. Strongest related column pairs`
    : `Bảng ${m}. Các cặp cột liên quan mạnh nhất`;
}

