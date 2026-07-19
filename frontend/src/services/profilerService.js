import api from "./axiosClient";

/**
 * Upload file CSV/Excel để profile.
 * Dùng FormData vì multipart/form-data (không phải JSON).
 * Axios tự set Content-Type boundary khi nhận FormData.
 *
 * @param {File} file - File object từ input hoặc drag-drop
 * @returns {Promise} ProfileResponse từ backend
 */
export const profileFile = (file, forceRefresh = false) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/files/profile${forceRefresh ? '?force_refresh=true' : ''}`, formData, {
    headers: {
      // Override Content-Type để Axios tự set multipart boundary
      "Content-Type": "multipart/form-data",
    },
  });
};

/**
 * Gọi Gemini AI để phân tích ngữ cảnh dataset (on-demand).
 * @param {string} fileHash - Hash của file đã profile
 * @returns {Promise} { semantic_context, column_semantics }
 */
export const requestAIContext = (fileHash) => {
  return api.post("/files/ai-context", { file_hash: fileHash });
};
