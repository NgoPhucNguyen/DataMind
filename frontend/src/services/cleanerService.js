import api from "./axiosClient";

/**
 * Quét và phân loại các vấn đề dữ liệu.
 * @param {string} file_hash - MD5 của file (từ profileData.file_hash)
 * @param {Object} overridden_types - Override type mapping {"col_name": "categorical"}
 * @returns {Promise<IssueReport>}
 */
export const detectIssues = (file_hash, overridden_types = {}, offset = 0, mode = "all") =>
  api.post("/files/detect-issues", { file_hash, overridden_types, offset, mode });

/**
 * Tự động làm sạch dữ liệu theo rule mặc định.
 * Trả về DiffReport — chưa lưu, cần bấm confirmClean để chốt.
 * @param {string} file_hash
 * @param {Object} overridden_types
 * @param {number} offset
 * @param {string} mode
 * @returns {Promise<AutoCleanResponse>}
 */
export const autoClean = (file_hash, overridden_types = {}, offset = 0, mode = "all") =>
  api.post("/files/auto-clean", { file_hash, overridden_types, offset, mode });

/**
 * Xác nhận và chốt Clean Dataset.
 * Upload lên Supabase Storage, trả về CleanDatasetResponse.
 * @param {string} file_hash
 * @param {"auto"|"manual"} clean_mode
 * @param {Object} overridden_types
 * @param {Array} actions
 * @returns {Promise<CleanDatasetResponse>}
 */
export const confirmClean = (file_hash, clean_mode = "auto", overridden_types = {}, actions = []) =>
  api.post("/files/confirm-clean", { file_hash, clean_mode, overridden_types, actions });

/**
 * Lấy dữ liệu xem trước khi làm sạch thủ công.
 * Trả về dữ liệu preview phân trang theo offset và mode.
 * @param {string} file_hash
 * @param {Array} actions
 * @param {number} offset
 * @param {string} mode
 * @returns {Promise<Object>}
 */
export const manualCleanPreview = (file_hash, actions = [], offset = 0, mode = "all") =>
  api.post("/files/manual-clean-preview", { file_hash, actions, offset, mode });

/**
 * Định vị cửa sổ chứa excel_row.
 * @param {Object} payload - { file_hash, excel_row, mode, clean_mode, actions, overridden_types }
 * @returns {Promise<Object>}
 */
export const locateRow = (payload) =>
  api.post("/files/cleaner/locate", payload);

/**
 * Lấy danh sách ô lỗi theo nhóm (cột, loại lỗi) có phân trang.
 * @param {Object} payload - { file_hash, actions, overridden_types, column, issue_type, offset, limit }
 * @returns {Promise<Object>}
 */
export const getErrorCells = (payload) =>
  api.post("/files/error-cells", payload);
