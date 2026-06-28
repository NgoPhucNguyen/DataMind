import api from "./axiosClient";

/**
 * Quét và phân loại các vấn đề dữ liệu.
 * @param {string} file_hash - MD5 của file (từ profileData.file_hash)
 * @param {Object} overridden_types - Override type mapping {"col_name": "categorical"}
 * @returns {Promise<IssueReport>}
 */
export const detectIssues = (file_hash, overridden_types = {}) =>
  api.post("/files/detect-issues", { file_hash, overridden_types });

/**
 * Tự động làm sạch dữ liệu theo rule mặc định.
 * Trả về DiffReport — chưa lưu, cần bấm confirmClean để chốt.
 * @param {string} file_hash
 * @param {Object} overridden_types
 * @returns {Promise<AutoCleanResponse>}
 */
export const autoClean = (file_hash, overridden_types = {}) =>
  api.post("/files/auto-clean", { file_hash, overridden_types });

/**
 * Xác nhận và chốt Clean Dataset.
 * Upload lên Supabase Storage, trả về CleanDatasetResponse.
 * @param {string} file_hash
 * @param {"auto"|"manual"} clean_mode
 * @param {Object} overridden_types
 * @returns {Promise<CleanDatasetResponse>}
 */
export const confirmClean = (file_hash, clean_mode = "auto", overridden_types = {}) =>
  api.post("/files/confirm-clean", { file_hash, clean_mode, overridden_types });
