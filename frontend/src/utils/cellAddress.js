/**
 * cellAddress.js
 * Utility helpers for Excel-style cell addressing (e.g. A1, C15, AA100).
 */

/**
 * Convert 0-indexed column position to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 * @param {number} idx 0-based column index
 * @returns {string} Excel column letter
 */
export function colLetter(idx) {
  if (typeof idx !== "number" || idx < 0 || isNaN(idx)) return "";
  let result = "";
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Format Excel-style address "C15".
 * @param {string} letter
 * @param {number} excelRow (1-based, e.g. original_index + 2)
 * @returns {string}
 */
export function cellAddress(letter, excelRow) {
  if (!letter || excelRow === undefined || excelRow === null) return "";
  return `${String(letter).toUpperCase()}${excelRow}`;
}

/**
 * Format address in words "Cột C · Dòng 15".
 * @param {string} letter
 * @param {number} excelRow
 * @param {string} lang "vi" | "en"
 * @returns {string}
 */
export function cellAddressWords(letter, excelRow, lang = "vi") {
  const l = (letter || "").toUpperCase();
  if (lang === "en") {
    return `Col ${l} · Row ${excelRow}`;
  }
  return `Cột ${l} · Dòng ${excelRow}`;
}

/**
 * Parse an address string like "C15", "c15", "AA10".
 * @param {string} str
 * @returns {{ valid: boolean, letter?: string, row?: number }}
 */
export function parseAddress(str) {
  if (!str || typeof str !== "string") return { valid: false };
  const trimmed = str.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { valid: false };
  const letter = match[1];
  const row = parseInt(match[2], 10);
  if (isNaN(row) || row < 1) return { valid: false };
  return { valid: true, letter, row };
}

/**
 * Convert Excel column letter back to 0-based index (A -> 0, Z -> 25, AA -> 26).
 * @param {string} letter
 * @returns {number}
 */
export function letterToColIndex(letter) {
  if (!letter || typeof letter !== "string") return -1;
  let idx = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

